'use strict';

const { DatabaseBookingError } = require('./supabase-bookings');

const BOOKING_ORIGINS = new Set([
  'https://kimmynail.de',
  'https://www.kimmynail.de'
]);

function allowBookingCors(request, response, methods) {
  const origin = request.headers.origin;
  if (BOOKING_ORIGINS.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Vary', 'Origin');
  }

  if (request.method !== 'OPTIONS') return false;
  response.statusCode = 204;
  response.end();
  return true;
}

function sendJson(response, statusCode, value) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string') return JSON.parse(request.body || '{}');
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 100_000) throw new DatabaseBookingError('Dữ liệu gửi lên quá lớn.', 'PAYLOAD_TOO_LARGE', 413);
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new DatabaseBookingError('Dữ liệu gửi lên không hợp lệ.', 'INVALID_JSON');
  }
}

function assertMethod(request, allowedMethods) {
  if (!allowedMethods.includes(request.method)) {
    throw new DatabaseBookingError('Phương thức không được hỗ trợ.', 'METHOD_NOT_ALLOWED', 405);
  }
}

function assertAdmin(request) {
  const adminKey = process.env.ADMIN_KEY || '';
  if (!adminKey) {
    throw new DatabaseBookingError('ADMIN_KEY chưa được cấu hình trên Vercel.', 'ADMIN_NOT_CONFIGURED', 503);
  }
  if (request.headers['x-admin-key'] !== adminKey) {
    throw new DatabaseBookingError('Không có quyền truy cập.', 'UNAUTHORIZED', 401);
  }
}

function handleError(response, error) {
  const known = error instanceof DatabaseBookingError;
  if (!known) console.error(error);
  sendJson(response, known ? error.statusCode : 500, {
    error: known ? error.message : 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại.',
    code: known ? error.code : 'INTERNAL_ERROR'
  });
}

module.exports = { allowBookingCors, assertAdmin, assertMethod, handleError, readJson, sendJson };
