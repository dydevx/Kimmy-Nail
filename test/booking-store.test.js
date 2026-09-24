'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { BookingStore, SLOT_FULL_MESSAGE, generateSlots, getSlotCapacity } = require('../lib/booking-store');

function withStore(run) {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'kimmy-bookings-'));
  const store = new BookingStore(path.join(tempDirectory, 'test.db'));
  try {
    return run(store);
  } finally {
    store.close();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function input(time, suffix = '') {
  return {
    customer_name: `Customer ${suffix}`,
    phone: `012345${suffix}`,
    service: 'Maniküre',
    booking_date: '2030-06-10',
    booking_time: time,
    notes: ''
  };
}

test('availability only contains :00, :30 and :45 through the final 19:00 slot', () => {
  const slots = generateSlots();
  assert.deepEqual(slots.slice(0, 6), ['09:00', '09:30', '09:45', '10:00', '10:30', '10:45']);
  assert.equal(slots.at(-1), '19:00');
  assert.equal(slots.length, 31);
  assert.equal(slots.every((slot) => ['00', '30', '45'].includes(slot.slice(3, 5))), true);
});

test('unsupported minutes and bookings after 19:00 are rejected', () => withStore((store) => {
  for (const minute of ['05', '10', '15', '20', '25', '35', '40', '50', '55']) {
    assert.throws(() => store.createBooking(input(`10:${minute}`)), { code: 'INVALID_TIME' });
  }
  assert.throws(() => store.createBooking(input('19:30')), { code: 'INVALID_TIME' });
  assert.equal(store.createBooking(input('19:00')).booking_time, '19:00');
}));

test('whole-hour slots allow three active bookings, then reject the fourth', () => withStore((store) => {
  assert.equal(getSlotCapacity('10:00'), 3);
  const first = store.createBooking(input('10:00', '1'));
  assert.equal(store.getAvailability('2030-06-10').find(({ time }) => time === '10:00').remaining, 2);
  store.createBooking(input('10:00', '2'));
  assert.equal(store.getAvailability('2030-06-10').find(({ time }) => time === '10:00').remaining, 1);
  store.createBooking(input('10:00', '3'));
  assert.throws(
    () => store.createBooking(input('10:00', '4')),
    (error) => error.code === 'SLOT_FULL' && error.message === SLOT_FULL_MESSAGE
  );
  const slot = store.getAvailability('2030-06-10').find(({ time }) => time === '10:00');
  assert.deepEqual(slot, { time: '10:00', capacity: 3, booked: 3, remaining: 0, available: false });

  store.cancelBooking(first.booking_id, first.cancel_token);
  const reopenedSlot = store.getAvailability('2030-06-10').find(({ time }) => time === '10:00');
  assert.deepEqual(reopenedSlot, { time: '10:00', capacity: 3, booked: 2, remaining: 1, available: true });
  assert.equal(store.createBooking(input('10:00', '4')).status, 'confirmed');
}));

test(':30 and :45 slots allow only one active booking', () => withStore((store) => {
  for (const time of ['10:30', '10:45']) {
    assert.equal(getSlotCapacity(time), 1);
    store.createBooking(input(time, time));
    assert.throws(() => store.createBooking(input(time, `${time}-2`)), { code: 'SLOT_FULL' });
    const slot = store.getAvailability('2030-06-10').find((item) => item.time === time);
    assert.deepEqual(slot, { time, capacity: 1, booked: 1, remaining: 0, available: false });
  }
}));

test('cancelled bookings remain stored and immediately release capacity', () => withStore((store) => {
  const first = store.createBooking(input('10:30', '1'));
  assert.throws(() => store.createBooking(input('10:30', '2')), { code: 'SLOT_FULL' });

  const cancelled = store.cancelBooking(first.booking_id, first.cancel_token);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(store.listBookings()[0].status, 'cancelled');
  assert.throws(
    () => store.cancelBooking(first.booking_id, first.cancel_token),
    { code: 'ALREADY_CANCELLED' }
  );

  const reopenedSlot = store.getAvailability('2030-06-10').find(({ time }) => time === '10:30');
  assert.deepEqual(reopenedSlot, { time: '10:30', capacity: 1, booked: 0, remaining: 1, available: true });

  const replacement = store.createBooking(input('10:30', '2'));
  assert.equal(replacement.status, 'confirmed');
  assert.equal(store.countActiveBookings('2030-06-10', '10:30'), 1);
}));

test('completed bookings count toward slot capacity', () => withStore((store) => {
  const booking = store.createBooking(input('11:45', '1'));
  store.setBookingStatus(booking.booking_id, 'completed');
  assert.throws(() => store.createBooking(input('11:45', '2')), { code: 'SLOT_FULL' });
}));

test('admin cannot reactivate a cancelled booking into a slot that filled up', () => withStore((store) => {
  const original = store.createBooking(input('12:45', '1'));
  store.cancelBooking(original.booking_id, original.cancel_token);
  store.createBooking(input('12:45', '2'));
  assert.throws(
    () => store.setBookingStatus(original.booking_id, 'confirmed'),
    { code: 'SLOT_FULL' }
  );
}));

test('legacy five-minute bookings remain stored and can still be cancelled', () => withStore((store) => {
  store.db.prepare(`
    INSERT INTO bookings (
      booking_id, cancel_token, customer_name, phone, service,
      booking_date, booking_time, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'legacy-booking', 'legacy-token', 'Legacy Customer', '012345', 'Maniküre',
    '2030-06-10', '14:05', '', 'confirmed'
  );

  assert.equal(store.listBookings()[0].booking_time, '14:05');
  assert.equal(store.getAvailability('2030-06-10').some(({ time }) => time === '14:05'), false);
  assert.equal(store.cancelBooking('legacy-booking', 'legacy-token').status, 'cancelled');
  assert.equal(store.listBookings()[0].status, 'cancelled');
}));

test('bookings and availability persist after the database is reopened', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'kimmy-bookings-persist-'));
  const databasePath = path.join(tempDirectory, 'test.db');
  const firstStore = new BookingStore(databasePath);
  firstStore.createBooking(input('13:00', '1'));
  firstStore.close();

  const reopenedStore = new BookingStore(databasePath);
  try {
    const slot = reopenedStore.getAvailability('2030-06-10').find(({ time }) => time === '13:00');
    assert.equal(slot.booked, 1);
    assert.equal(slot.remaining, 2);
    assert.equal(reopenedStore.listBookings().length, 1);
  } finally {
    reopenedStore.close();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
