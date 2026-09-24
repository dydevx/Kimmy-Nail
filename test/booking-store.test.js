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

test('the final booking slot is 19:00', () => {
  const slots = generateSlots();
  assert.equal(slots.at(-1), '19:00');
  assert.equal(slots.includes('19:05'), false);
});

test('bookings after 19:00 are rejected', () => withStore((store) => {
  assert.throws(() => store.createBooking(input('19:05')), { code: 'INVALID_TIME' });
  assert.equal(store.createBooking(input('19:00')).booking_time, '19:00');
}));

test('whole-hour slots allow three active bookings, then reject the fourth', () => withStore((store) => {
  assert.equal(getSlotCapacity('10:00'), 3);
  store.createBooking(input('10:00', '1'));
  store.createBooking(input('10:00', '2'));
  store.createBooking(input('10:00', '3'));
  assert.throws(
    () => store.createBooking(input('10:00', '4')),
    (error) => error.code === 'SLOT_FULL' && error.message === SLOT_FULL_MESSAGE
  );
  const slot = store.getAvailability('2030-06-10').find(({ time }) => time === '10:00');
  assert.deepEqual(slot, { time: '10:00', capacity: 3, booked: 3, remaining: 0, available: false });
}));

test('non-whole-hour slots allow only one booking', () => withStore((store) => {
  assert.equal(getSlotCapacity('10:05'), 1);
  store.createBooking(input('10:05', '1'));
  assert.throws(() => store.createBooking(input('10:05', '2')), { code: 'SLOT_FULL' });
}));

test('cancelled bookings remain stored and immediately release capacity', () => withStore((store) => {
  const first = store.createBooking(input('10:10', '1'));
  assert.throws(() => store.createBooking(input('10:10', '2')), { code: 'SLOT_FULL' });

  const cancelled = store.cancelBooking(first.booking_id, first.cancel_token);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(store.listBookings()[0].status, 'cancelled');
  assert.throws(
    () => store.cancelBooking(first.booking_id, first.cancel_token),
    { code: 'ALREADY_CANCELLED' }
  );

  const replacement = store.createBooking(input('10:10', '2'));
  assert.equal(replacement.status, 'confirmed');
  assert.equal(store.countActiveBookings('2030-06-10', '10:10'), 1);
}));

test('completed bookings count toward slot capacity', () => withStore((store) => {
  const booking = store.createBooking(input('11:05', '1'));
  store.setBookingStatus(booking.booking_id, 'completed');
  assert.throws(() => store.createBooking(input('11:05', '2')), { code: 'SLOT_FULL' });
}));

test('admin cannot reactivate a cancelled booking into a slot that filled up', () => withStore((store) => {
  const original = store.createBooking(input('12:05', '1'));
  store.cancelBooking(original.booking_id, original.cancel_token);
  store.createBooking(input('12:05', '2'));
  assert.throws(
    () => store.setBookingStatus(original.booking_id, 'confirmed'),
    { code: 'SLOT_FULL' }
  );
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
