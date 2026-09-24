'use strict';

const { cancelBooking, getBookingForCancellation } = require('../lib/supabase-bookings');
const { buildCancellationWhatsAppUrl } = require('../lib/whatsapp');
const { assertMethod, handleError, readJson, sendJson } = require('../lib/vercel-api');

module.exports = async function cancelBookingHandler(request, response) {
  try {
    assertMethod(request, ['GET', 'POST']);
    if (request.method === 'GET') {
      const url = new URL(request.url, `https://${request.headers.host}`);
      const booking = await getBookingForCancellation(url.searchParams.get('id'), url.searchParams.get('token'));
      return sendJson(response, 200, { booking });
    }
    const input = await readJson(request);
    const booking = await cancelBooking(input.id, input.token);
    return sendJson(response, 200, {
      booking,
      message: 'Lịch hẹn của bạn đã được hủy thành công.',
      whatsapp_url: buildCancellationWhatsAppUrl(booking)
    });
  } catch (error) {
    return handleError(response, error);
  }
};
