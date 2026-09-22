'use strict';

const { listBookings } = require('../lib/supabase-bookings');
const { assertAdmin, assertMethod, handleError, sendJson } = require('../lib/vercel-api');

module.exports = async function adminBookingsHandler(request, response) {
  try {
    assertMethod(request, ['GET']);
    assertAdmin(request);
    const url = new URL(request.url, `https://${request.headers.host}`);
    const bookings = await listBookings({
      date: url.searchParams.get('date') || undefined,
      status: url.searchParams.get('status') || undefined
    });
    sendJson(response, 200, { bookings });
  } catch (error) {
    handleError(response, error);
  }
};
