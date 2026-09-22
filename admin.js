(() => {
  'use strict';

  const filters = document.querySelector('[data-admin-filters]');
  const rows = document.querySelector('[data-booking-rows]');
  const message = document.querySelector('[data-admin-message]');

  const statusLabels = { confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed' };
  const getAdminKey = () => new FormData(filters).get('admin_key');
  const adminHeaders = (withJson = false) => ({
    ...(withJson ? { 'Content-Type': 'application/json' } : {}),
    ...(getAdminKey() ? { 'X-Admin-Key': getAdminKey() } : {})
  });

  const makeCell = (label, value, className = '') => {
    const cell = document.createElement('td');
    cell.dataset.label = label;
    cell.textContent = value;
    if (className) cell.className = className;
    return cell;
  };

  const updateStatus = async (bookingId, status) => {
    if (status === 'cancelled' && !window.confirm('Bạn có chắc chắn muốn hủy lịch này không?')) return;
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/status`, {
        method: 'PATCH',
        headers: adminHeaders(true),
        body: JSON.stringify({ status })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      await loadBookings();
    } catch (error) {
      message.textContent = error.message || 'Die Buchung konnte nicht aktualisiert werden.';
      message.hidden = false;
    }
  };

  const renderRows = (bookings) => {
    if (!bookings.length) {
      const row = document.createElement('tr');
      const cell = makeCell('', 'Keine Buchungen gefunden.', 'empty-state');
      cell.colSpan = 7;
      row.append(cell);
      rows.replaceChildren(row);
      return;
    }
    rows.replaceChildren(...bookings.map((booking) => {
      const row = document.createElement('tr');
      row.classList.toggle('is-cancelled', booking.status === 'cancelled');
      row.append(
        makeCell('Name', booking.customer_name),
        makeCell('Telefon', booking.phone),
        makeCell('Leistungen', booking.service, 'service-cell'),
        makeCell('Datum', booking.booking_date),
        makeCell('Uhrzeit', booking.booking_time)
      );
      const statusCell = makeCell('Status', '');
      const badge = document.createElement('span');
      badge.className = `status-badge ${booking.status}`;
      badge.textContent = statusLabels[booking.status] || booking.status;
      statusCell.append(badge);
      const actionCell = makeCell('Aktion', '');
      const actions = document.createElement('div');
      actions.className = 'admin-actions';
      if (booking.status === 'confirmed') {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel Booking';
        cancel.addEventListener('click', () => updateStatus(booking.booking_id, 'cancelled'));
        const complete = document.createElement('button');
        complete.type = 'button';
        complete.textContent = 'Completed';
        complete.addEventListener('click', () => updateStatus(booking.booking_id, 'completed'));
        actions.append(cancel, complete);
      }
      actionCell.append(actions);
      row.append(statusCell, actionCell);
      return row;
    }));
  };

  async function loadBookings() {
    message.hidden = true;
    const values = new FormData(filters);
    const query = new URLSearchParams();
    if (values.get('date')) query.set('date', values.get('date'));
    if (values.get('status')) query.set('status', values.get('status'));
    rows.innerHTML = '<tr><td colspan="7" class="empty-state">Buchungen werden geladen…</td></tr>';
    try {
      const response = await fetch(`/api/admin/bookings?${query}`, { headers: adminHeaders(), cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      renderRows(payload.bookings);
    } catch (error) {
      rows.innerHTML = '<tr><td colspan="7" class="empty-state">Keine Daten verfügbar.</td></tr>';
      message.textContent = error.message || 'Buchungen konnten nicht geladen werden.';
      message.hidden = false;
    }
  }

  filters.addEventListener('submit', (event) => {
    event.preventDefault();
    loadBookings();
  });

  loadBookings();
})();
