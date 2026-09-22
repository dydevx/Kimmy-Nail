'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { BookingError, BookingStore } = require('./lib/booking-store');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const store = new BookingStore(process.env.BOOKING_DB_PATH || path.join(DATA_DIR, 'bookings.db'));
const port = Number(process.env.PORT || 4173);
const adminKey = process.env.ADMIN_KEY || '';

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new BookingError('Dữ liệu gửi lên quá lớn.', 'PAYLOAD_TOO_LARGE', 413));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new BookingError('Dữ liệu gửi lên không hợp lệ.', 'INVALID_JSON'));
      }
    });
    request.on('error', reject);
  });
}

function assertAdmin(request) {
  if (adminKey && request.headers['x-admin-key'] !== adminKey) {
    throw new BookingError('Không có quyền truy cập.', 'UNAUTHORIZED', 401);
  }
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/availability') {
    return sendJson(response, 200, { slots: store.getAvailability(url.searchParams.get('date')) });
  }

  if (request.method === 'POST' && url.pathname === '/api/bookings') {
    const booking = store.createBooking(await readJson(request));
    return sendJson(response, 201, {
      booking: {
        booking_id: booking.booking_id,
        customer_name: booking.customer_name,
        phone: booking.phone,
        service: booking.service,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        notes: booking.notes,
        status: booking.status
      },
      cancel_url: `/booking/cancel?id=${encodeURIComponent(booking.booking_id)}&token=${encodeURIComponent(booking.cancel_token)}`
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/booking/cancel') {
    const booking = store.getBookingForCancellation(url.searchParams.get('id'), url.searchParams.get('token'));
    return sendJson(response, 200, { booking });
  }

  if (request.method === 'POST' && url.pathname === '/api/booking/cancel') {
    const input = await readJson(request);
    const booking = store.cancelBooking(input.id, input.token);
    return sendJson(response, 200, { booking, message: 'Lịch hẹn của bạn đã được hủy thành công.' });
  }

  if (url.pathname === '/api/admin/bookings' && request.method === 'GET') {
    assertAdmin(request);
    const bookings = store.listBookings({
      date: url.searchParams.get('date') || undefined,
      status: url.searchParams.get('status') || undefined
    });
    return sendJson(response, 200, { bookings });
  }

  const statusMatch = /^\/api\/admin\/bookings\/([^/]+)\/status$/.exec(url.pathname);
  if (statusMatch && request.method === 'PATCH') {
    assertAdmin(request);
    const input = await readJson(request);
    const booking = store.setBookingStatus(decodeURIComponent(statusMatch[1]), input.status);
    return sendJson(response, 200, { booking });
  }

  return sendJson(response, 404, { error: 'Không tìm thấy API.', code: 'NOT_FOUND' });
}

function serveFile(response, pathname) {
  const routeAliases = {
    '/': '/index.html',
    '/booking/cancel': '/cancel.html',
    '/admin/bookings': '/admin.html'
  };
  const requestedPath = routeAliases[pathname] || pathname;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestedPath);
  } catch {
    response.writeHead(400);
    return response.end('Bad request');
  }
  const filePath = path.resolve(ROOT, `.${decodedPath}`);
  if (!filePath.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Not found');
  }
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff'
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) await handleApi(request, response, url);
    else serveFile(response, url.pathname);
  } catch (error) {
    const knownError = error instanceof BookingError;
    if (!knownError) console.error(error);
    if (!response.headersSent) {
      sendJson(response, knownError ? error.statusCode : 500, {
        error: knownError ? error.message : 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại.',
        code: knownError ? error.code : 'INTERNAL_ERROR'
      });
    }
  }
});

server.listen(port, () => {
  console.log(`Kimmy Nails is running at http://localhost:${port}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { server };
