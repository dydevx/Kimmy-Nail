'use strict';

const { createBooking } = require('../lib/supabase-bookings');
const { bookingCancelUrl, buildWhatsAppUrl } = require('../lib/whatsapp');
const { assertMethod, handleError, readJson, sendJson } = require('../lib/vercel-api');

module.exports = async function bookingsHandler(request, response) {
  try {
    assertMethod(request, ['POST']);
    const booking = await createBooking(await readJson(request));
    const cancelUrl = bookingCancelUrl(request, booking);
    const whatsappUrl = buildWhatsAppUrl(booking, cancelUrl);
    const { cancel_token: _cancelToken, ...safeBooking } = booking;
    sendJson(response, 201, {
      booking: safeBooking,
      cancel_url: cancelUrl,
      whatsapp_url: whatsappUrl
    });
  } catch (error) {
    handleError(response, error);
  }
};
