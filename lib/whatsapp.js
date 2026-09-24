'use strict';

function bookingCancelUrl(request, booking) {
  const fallbackProtocol = request.socket?.encrypted ? 'https' : 'http';
  const protocol = String(request.headers['x-forwarded-proto'] || fallbackProtocol).split(',')[0];
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  return `${protocol}://${host}/booking/cancel?id=${encodeURIComponent(booking.booking_id)}&token=${encodeURIComponent(booking.cancel_token)}`;
}

function buildWhatsAppUrl(booking, cancelUrl) {
  const number = String(process.env.WHATSAPP_NUMBER || '4915112354787').replace(/\D/g, '');
  const lines = [
    'Neue Terminbuchung bei Kimmy Nails',
    '',
    `Buchungsnummer: ${booking.booking_id}`,
    `Name: ${booking.customer_name}`,
    `Telefon: ${booking.phone}`,
    `Leistungen: ${booking.service}`,
    `Datum: ${booking.booking_date}`,
    `Uhrzeit: ${booking.booking_time}`,
    ...(booking.notes ? [`Notiz: ${booking.notes}`] : []),
    '',
    `Termin verwalten oder stornieren: ${cancelUrl}`
  ];
  return `https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`;
}

module.exports = { bookingCancelUrl, buildWhatsAppUrl };
