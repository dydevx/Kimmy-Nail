'use strict';

const postgres = require('postgres');

const STATUSES = Object.freeze(['confirmed', 'cancelled', 'completed']);
const SLOT_FULL_MESSAGE = 'Khung giờ này đã đầy, vui lòng chọn giờ khác.';
let databaseClient;

class DatabaseBookingError extends Error {
  constructor(message, code = 'BOOKING_ERROR', statusCode = 400) {
    super(message);
    this.name = 'DatabaseBookingError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function getDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new DatabaseBookingError('DATABASE_URL chưa được cấu hình trên Vercel.', 'DATABASE_NOT_CONFIGURED', 503);
  }
  if (!databaseClient) {
    databaseClient = postgres(process.env.DATABASE_URL, {
      max: 1,
      prepare: false,
      ssl: 'require',
      connect_timeout: 10,
      idle_timeout: 20
    });
  }
  return databaseClient;
}

function normalizeDate(value) {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new DatabaseBookingError('Ngày đặt lịch không hợp lệ.', 'INVALID_DATE');
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new DatabaseBookingError('Ngày đặt lịch không hợp lệ.', 'INVALID_DATE');
  }
  return date;
}

function normalizeTime(value) {
  const time = String(value || '').trim();
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new DatabaseBookingError('Giờ đặt lịch không hợp lệ.', 'INVALID_TIME');
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 9 || hour >= 20 || minute % 5 !== 0) {
    throw new DatabaseBookingError('Giờ đặt lịch không hợp lệ.', 'INVALID_TIME');
  }
  return time;
}

function cleanText(value, label, maxLength) {
  const text = String(value || '').trim();
  if (!text) throw new DatabaseBookingError(`${label} là bắt buộc.`, 'INVALID_INPUT');
  if (text.length > maxLength) throw new DatabaseBookingError(`${label} quá dài.`, 'INVALID_INPUT');
  return text;
}

function normalizeBookingId(value) {
  const id = String(value || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new DatabaseBookingError('Không tìm thấy lịch hẹn hoặc liên kết đã hết hiệu lực.', 'NOT_FOUND', 404);
  }
  return id;
}

function generateSlots() {
  const slots = [];
  for (let minuteOfDay = 9 * 60; minuteOfDay < 20 * 60; minuteOfDay += 5) {
    slots.push(`${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`);
  }
  return slots;
}

function capacityFor(time) {
  return Number(time.slice(3, 5)) === 0 ? 3 : 1;
}

function mapDatabaseError(error) {
  if (error instanceof DatabaseBookingError) return error;
  if (error?.code === 'P0001' || error?.code === '23505') {
    return new DatabaseBookingError(SLOT_FULL_MESSAGE, 'SLOT_FULL', 409);
  }
  if (error?.code === '42P01') {
    return new DatabaseBookingError(
      'Chưa tìm thấy bảng bookings trên Supabase. Vui lòng chạy file supabase/schema.sql trong SQL Editor.',
      'DATABASE_SCHEMA_MISSING',
      503
    );
  }
  if (error?.code === '28P01' || /password authentication failed/i.test(error?.message || '')) {
    return new DatabaseBookingError(
      'Không thể đăng nhập Supabase. Vui lòng kiểm tra password trong DATABASE_URL.',
      'DATABASE_AUTH_FAILED',
      503
    );
  }
  if (/tenant or user not found/i.test(error?.message || '')) {
    return new DatabaseBookingError(
      'Supabase không nhận diện được pooler. Hãy dùng đúng Transaction pooler URL, port 6543.',
      'DATABASE_POOLER_INVALID',
      503
    );
  }
  if (['CONNECT_TIMEOUT', 'ENOTFOUND', 'ECONNREFUSED'].includes(error?.code)) {
    return new DatabaseBookingError(
      'Không thể kết nối Supabase. Vui lòng kiểm tra Transaction pooler URL trong DATABASE_URL.',
      'DATABASE_CONNECTION_FAILED',
      503
    );
  }
  return error;
}

function publicBooking(row) {
  return {
    booking_id: row.booking_id,
    customer_name: row.customer_name,
    phone: row.phone,
    service: row.service,
    booking_date: String(row.booking_date).slice(0, 10),
    booking_time: String(row.booking_time).slice(0, 5),
    notes: row.notes || '',
    status: row.status,
    ...(row.created_at ? { created_at: row.created_at } : {}),
    ...(row.updated_at ? { updated_at: row.updated_at } : {})
  };
}

async function getAvailability(dateValue) {
  const bookingDate = normalizeDate(dateValue);
  const sql = getDatabase();
  let rows;
  try {
    rows = await sql`
      select booking_time::text as booking_time, count(*)::integer as count
      from public.bookings
      where booking_date = ${bookingDate}::date and status <> 'cancelled'
      group by booking_time
    `;
  } catch (error) {
    throw mapDatabaseError(error);
  }
  const counts = new Map(rows.map((row) => [String(row.booking_time).slice(0, 5), Number(row.count)]));
  return generateSlots().map((time) => {
    const capacity = capacityFor(time);
    const booked = counts.get(time) || 0;
    return { time, capacity, booked, remaining: Math.max(0, capacity - booked), available: booked < capacity };
  });
}

async function createBooking(input) {
  const booking = {
    customer_name: cleanText(input.customer_name, 'Tên khách hàng', 120),
    phone: cleanText(input.phone, 'Số điện thoại', 40),
    service: cleanText(input.service, 'Dịch vụ', 1000),
    booking_date: normalizeDate(input.booking_date),
    booking_time: normalizeTime(input.booking_time),
    notes: String(input.notes || '').trim().slice(0, 2000)
  };
  const sql = getDatabase();
  try {
    const [row] = await sql`
      insert into public.bookings (
        customer_name, phone, service, booking_date, booking_time, notes, status
      ) values (
        ${booking.customer_name}, ${booking.phone}, ${booking.service},
        ${booking.booking_date}::date, ${booking.booking_time}::time,
        ${booking.notes}, 'confirmed'
      )
      returning booking_id, cancel_token, customer_name, phone, service,
                booking_date, booking_time, notes, status
    `;
    return { ...publicBooking(row), cancel_token: row.cancel_token };
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

async function getBookingForCancellation(bookingId, cancelToken) {
  const sql = getDatabase();
  const id = normalizeBookingId(bookingId);
  const [row] = await sql`
    select booking_id, customer_name, phone, service, booking_date, booking_time, notes, status
    from public.bookings
    where booking_id = ${id}::uuid
      and cancel_token = ${String(cancelToken || '')}
  `;
  if (!row) throw new DatabaseBookingError('Không tìm thấy lịch hẹn hoặc liên kết đã hết hiệu lực.', 'NOT_FOUND', 404);
  return publicBooking(row);
}

async function cancelBooking(bookingId, cancelToken) {
  const sql = getDatabase();
  const id = normalizeBookingId(bookingId);
  try {
    return await sql.begin(async (transaction) => {
      const [row] = await transaction`
        select booking_id, customer_name, phone, service, booking_date, booking_time, notes, status
        from public.bookings
        where booking_id = ${id}::uuid
          and cancel_token = ${String(cancelToken || '')}
        for update
      `;
      if (!row) throw new DatabaseBookingError('Không tìm thấy lịch hẹn hoặc liên kết đã hết hiệu lực.', 'NOT_FOUND', 404);
      if (row.status === 'cancelled') throw new DatabaseBookingError('Lịch hẹn này đã được hủy trước đó.', 'ALREADY_CANCELLED', 409);
      if (row.status === 'completed') throw new DatabaseBookingError('Không thể hủy lịch hẹn đã hoàn thành.', 'ALREADY_COMPLETED', 409);
      const [updated] = await transaction`
        update public.bookings set status = 'cancelled'
        where booking_id = ${row.booking_id}
        returning booking_id, customer_name, phone, service, booking_date, booking_time, notes, status
      `;
      return publicBooking(updated);
    });
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

async function listBookings({ date, status } = {}) {
  const bookingDate = date ? normalizeDate(date) : null;
  if (status && !STATUSES.includes(status)) throw new DatabaseBookingError('Trạng thái không hợp lệ.', 'INVALID_STATUS');
  const sql = getDatabase();
  const rows = await sql`
    select booking_id, customer_name, phone, service, booking_date, booking_time,
           notes, status, created_at, updated_at
    from public.bookings
    where (${bookingDate}::date is null or booking_date = ${bookingDate}::date)
      and (${status || null}::text is null or status = ${status || null}::text)
    order by booking_date desc, booking_time desc, created_at desc
  `;
  return rows.map(publicBooking);
}

async function setBookingStatus(bookingId, status) {
  if (!STATUSES.includes(status)) throw new DatabaseBookingError('Trạng thái không hợp lệ.', 'INVALID_STATUS');
  const sql = getDatabase();
  const id = normalizeBookingId(bookingId);
  try {
    const [row] = await sql`
      update public.bookings set status = ${status}
      where booking_id = ${id}::uuid
      returning booking_id, customer_name, phone, service, booking_date, booking_time,
                notes, status, created_at, updated_at
    `;
    if (!row) throw new DatabaseBookingError('Không tìm thấy lịch hẹn.', 'NOT_FOUND', 404);
    return publicBooking(row);
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

module.exports = {
  DatabaseBookingError,
  SLOT_FULL_MESSAGE,
  cancelBooking,
  createBooking,
  getAvailability,
  getBookingForCancellation,
  listBookings,
  setBookingStatus
};
