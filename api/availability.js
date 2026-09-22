'use strict';

const { getAvailability } = require('../lib/supabase-bookings');
const { assertMethod, handleError, sendJson } = require('../lib/vercel-api');

module.exports = async function availabilityHandler(request, response) {
  try {
    assertMethod(request, ['GET']);
    const url = new URL(request.url, `https://${request.headers.host}`);
    sendJson(response, 200, { slots: await getAvailability(url.searchParams.get('date')) });
  } catch (error) {
    handleError(response, error);
  }
};
