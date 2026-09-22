'use strict';

const { setBookingStatus } = require('../lib/supabase-bookings');
const { assertAdmin, assertMethod, handleError, readJson, sendJson } = require('../lib/vercel-api');

module.exports = async function adminBookingStatusHandler(request, response) {
  try {
    assertMethod(request, ['PATCH']);
    assertAdmin(request);
    const input = await readJson(request);
    const booking = await setBookingStatus(input.booking_id, input.status);
    sendJson(response, 200, { booking });
  } catch (error) {
    handleError(response, error);
  }
};
