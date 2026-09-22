'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { bookingCancelUrl, buildWhatsAppUrl } = require('../lib/whatsapp');
const { formatDateValue } = require('../lib/supabase-bookings');

const booking = {
  booking_id: '4dfcc98f-34d3-4fd4-ad03-e834e0593bf4',
  cancel_token: 'secret-token',
  customer_name: 'Maria Test',
  phone: '0123456789',
  service: 'Handpflege — Maniküre',
  booking_date: '2030-06-10',
  booking_time: '10:00',
  notes: 'Bitte anrufen'
};

test('creates an absolute cancellation URL behind Vercel proxy', () => {
  const request = {
    headers: {
      host: 'internal.vercel.app',
      'x-forwarded-host': 'kimmy-nail.vercel.app',
      'x-forwarded-proto': 'https'
    }
  };
  assert.equal(
    bookingCancelUrl(request, booking),
    'https://kimmy-nail.vercel.app/booking/cancel?id=4dfcc98f-34d3-4fd4-ad03-e834e0593bf4&token=secret-token'
  );
});

test('creates a prefilled WhatsApp message without service prices', () => {
  const url = new URL(buildWhatsAppUrl(booking, 'https://example.com/cancel'));
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/4915141335015');
  const message = url.searchParams.get('text');
  assert.match(message, /Maria Test/);
  assert.match(message, /Handpflege — Maniküre/);
  assert.match(message, /https:\/\/example.com\/cancel/);
  assert.doesNotMatch(message, /€|Preis|price/i);
});

test('formats PostgreSQL date values as ISO calendar dates', () => {
  assert.equal(formatDateValue(new Date('2000-01-03T00:00:00.000Z')), '2000-01-03');
  assert.equal(formatDateValue('2030-06-10'), '2030-06-10');
});
