'use strict';

const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const BOOKING_STATUSES = Object.freeze(['confirmed', 'cancelled', 'completed']);
const BOOKING_MINUTES = Object.freeze([0, 30, 45]);
const SLOT_FULL_MESSAGE = 'Khung giờ này đã đầy, vui lòng chọn giờ khác.';

class BookingError extends Error {
  constructor(message, code = 'BOOKING_ERROR', statusCode = 400) {
    super(message);
    this.name = 'BookingError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function normalizeDate(value) {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BookingError('Ngày đặt lịch không hợp lệ.', 'INVALID_DATE');
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new BookingError('Ngày đặt lịch không hợp lệ.', 'INVALID_DATE');
  }
  return date;
}

function normalizeTime(value) {
  const time = String(value || '').trim();
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new BookingError('Giờ đặt lịch không hợp lệ.', 'INVALID_TIME');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 9 || hour > 19 || !BOOKING_MINUTES.includes(minute) || (hour === 19 && minute !== 0)) {
    throw new BookingError('Giờ đặt lịch không hợp lệ.', 'INVALID_TIME');
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getSlotCapacity(time) {
  const normalized = normalizeTime(time);
  return Number(normalized.slice(3, 5)) === 0 ? 3 : 1;
}

function cleanRequiredText(value, label, maxLength) {
  const text = String(value || '').trim();
  if (!text) throw new BookingError(`${label} là bắt buộc.`, 'INVALID_INPUT');
  if (text.length > maxLength) throw new BookingError(`${label} quá dài.`, 'INVALID_INPUT');
  return text;
}

function generateSlots(openHour = 9, lastBookingHour = 19) {
  const slots = [];
  for (let hour = openHour; hour <= lastBookingHour; hour += 1) {
    for (const minute of BOOKING_MINUTES) {
      if (hour === lastBookingHour && minute !== 0) continue;
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return slots;
}

class BookingStore {
  constructor(databasePath = 'data/bookings.db') {
    this.db = new DatabaseSync(databasePath);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookings (
        booking_id TEXT PRIMARY KEY,
        cancel_token TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        service TEXT NOT NULL,
        booking_date TEXT NOT NULL,
        booking_time TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'confirmed'
          CHECK (status IN ('confirmed', 'cancelled', 'completed')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_bookings_slot_status
        ON bookings (booking_date, booking_time, status);
      CREATE INDEX IF NOT EXISTS idx_bookings_created_at
        ON bookings (created_at DESC);
    `);
  }

  countActiveBookings(bookingDate, bookingTime) {
    return this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM bookings
      WHERE booking_date = ? AND booking_time = ? AND status <> 'cancelled'
    `).get(normalizeDate(bookingDate), normalizeTime(bookingTime)).count;
  }

  getAvailability(bookingDate) {
    const date = normalizeDate(bookingDate);
    const counts = new Map(this.db.prepare(`
      SELECT booking_time, COUNT(*) AS count
      FROM bookings
      WHERE booking_date = ? AND status <> 'cancelled'
      GROUP BY booking_time
    `).all(date).map((row) => [row.booking_time, Number(row.count)]));

    return generateSlots().map((time) => {
      const capacity = getSlotCapacity(time);
      const booked = counts.get(time) || 0;
      return {
        time,
        capacity,
        booked,
        remaining: Math.max(0, capacity - booked),
        available: booked < capacity
      };
    });
  }

  createBooking(input) {
    const booking = {
      booking_id: crypto.randomUUID(),
      cancel_token: crypto.randomBytes(32).toString('hex'),
      customer_name: cleanRequiredText(input.customer_name, 'Tên khách hàng', 120),
      phone: cleanRequiredText(input.phone, 'Số điện thoại', 40),
      service: cleanRequiredText(input.service, 'Dịch vụ', 1000),
      booking_date: normalizeDate(input.booking_date),
      booking_time: normalizeTime(input.booking_time),
      notes: String(input.notes || '').trim().slice(0, 2000),
      status: 'confirmed'
    };
    const capacity = getSlotCapacity(booking.booking_time);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const currentCount = Number(this.db.prepare(`
        SELECT COUNT(*) AS count
        FROM bookings
        WHERE booking_date = ? AND booking_time = ? AND status <> 'cancelled'
      `).get(booking.booking_date, booking.booking_time).count);

      if (currentCount >= capacity) {
        throw new BookingError(SLOT_FULL_MESSAGE, 'SLOT_FULL', 409);
      }

      this.db.prepare(`
        INSERT INTO bookings (
          booking_id, cancel_token, customer_name, phone, service,
          booking_date, booking_time, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        booking.booking_id,
        booking.cancel_token,
        booking.customer_name,
        booking.phone,
        booking.service,
        booking.booking_date,
        booking.booking_time,
        booking.notes,
        booking.status
      );
      this.db.exec('COMMIT');
      return booking;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  getBookingForCancellation(bookingId, cancelToken) {
    const booking = this.db.prepare(`
      SELECT booking_id, customer_name, phone, service, booking_date, booking_time, status
      FROM bookings
      WHERE booking_id = ? AND cancel_token = ?
    `).get(String(bookingId || ''), String(cancelToken || ''));
    if (!booking) throw new BookingError('Không tìm thấy lịch hẹn hoặc liên kết đã hết hiệu lực.', 'NOT_FOUND', 404);
    return booking;
  }

  cancelBooking(bookingId, cancelToken) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const booking = this.getBookingForCancellation(bookingId, cancelToken);
      if (booking.status === 'cancelled') {
        throw new BookingError('Lịch hẹn này đã được hủy trước đó.', 'ALREADY_CANCELLED', 409);
      }
      if (booking.status === 'completed') {
        throw new BookingError('Không thể hủy lịch hẹn đã hoàn thành.', 'ALREADY_COMPLETED', 409);
      }
      this.db.prepare(`
        UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = ? AND cancel_token = ? AND status = 'confirmed'
      `).run(bookingId, cancelToken);
      this.db.exec('COMMIT');
      return { ...booking, status: 'cancelled' };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  listBookings({ date, status } = {}) {
    const clauses = [];
    const params = [];
    if (date) {
      clauses.push('booking_date = ?');
      params.push(normalizeDate(date));
    }
    if (status) {
      if (!BOOKING_STATUSES.includes(status)) throw new BookingError('Trạng thái không hợp lệ.', 'INVALID_STATUS');
      clauses.push('status = ?');
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return this.db.prepare(`
      SELECT booking_id, customer_name, phone, service, booking_date, booking_time,
             notes, status, created_at, updated_at
      FROM bookings ${where}
      ORDER BY booking_date DESC, booking_time DESC, created_at DESC
    `).all(...params);
  }

  setBookingStatus(bookingId, status) {
    if (!BOOKING_STATUSES.includes(status)) throw new BookingError('Trạng thái không hợp lệ.', 'INVALID_STATUS');
    const id = String(bookingId || '');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.db.prepare('SELECT * FROM bookings WHERE booking_id = ?').get(id);
      if (!current) throw new BookingError('Không tìm thấy lịch hẹn.', 'NOT_FOUND', 404);

      if (current.status === 'cancelled' && status !== 'cancelled') {
        const count = Number(this.db.prepare(`
          SELECT COUNT(*) AS count FROM bookings
          WHERE booking_date = ? AND booking_time = ? AND status <> 'cancelled'
        `).get(current.booking_date, current.booking_time).count);
        if (count >= getSlotCapacity(current.booking_time)) {
          throw new BookingError(SLOT_FULL_MESSAGE, 'SLOT_FULL', 409);
        }
      }

      this.db.prepare(`
        UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?
      `).run(status, id);
      const updated = this.db.prepare(`
        SELECT booking_id, customer_name, phone, service, booking_date, booking_time,
               notes, status, created_at, updated_at
        FROM bookings WHERE booking_id = ?
      `).get(id);
      this.db.exec('COMMIT');
      return updated;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = {
  BOOKING_STATUSES,
  BookingError,
  BookingStore,
  SLOT_FULL_MESSAGE,
  generateSlots,
  getSlotCapacity,
  normalizeDate,
  normalizeTime
};
