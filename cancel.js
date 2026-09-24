(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const token = params.get('token');
  const loading = document.querySelector('[data-cancel-loading]');
  const content = document.querySelector('[data-cancel-content]');
  const summary = document.querySelector('[data-cancel-summary]');
  const button = document.querySelector('[data-cancel-button]');
  const whatsappLink = document.querySelector('[data-cancel-whatsapp]');
  const message = document.querySelector('[data-cancel-message]');

  const showMessage = (text, success = false) => {
    message.textContent = text;
    message.classList.toggle('success', success);
    message.hidden = false;
  };

  const formatDate = (date) => new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'long',
    timeZone: 'UTC'
  }).format(new Date(`${date}T00:00:00Z`));

  const render = (booking) => {
    const fields = [
      ['Name', booking.customer_name],
      ['Leistungen', booking.service],
      ['Datum', formatDate(booking.booking_date)],
      ['Uhrzeit', booking.booking_time]
    ];
    summary.replaceChildren(...fields.flatMap(([label, value]) => {
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = label;
      detail.textContent = value;
      return [term, detail];
    }));
    if (booking.status === 'cancelled') {
      button.hidden = true;
      showMessage('Lịch hẹn này đã được hủy trước đó.');
    } else if (booking.status === 'completed') {
      button.hidden = true;
      showMessage('Không thể hủy lịch hẹn đã hoàn thành.');
    }
  };

  const loadBooking = async () => {
    if (!id || !token) {
      loading.hidden = true;
      showMessage('Liên kết hủy lịch không hợp lệ.');
      return;
    }
    try {
      const response = await fetch(`/api/cancel-booking?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      render(payload.booking);
      loading.hidden = true;
      content.hidden = false;
    } catch (error) {
      loading.hidden = true;
      showMessage(error.message || 'Không thể tải thông tin lịch hẹn.');
    }
  };

  button.addEventListener('click', async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy lịch này không?')) return;
    const whatsappWindow = window.open('about:blank', '_blank');
    if (whatsappWindow) whatsappWindow.opener = null;
    button.disabled = true;
    try {
      const response = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      button.hidden = true;
      whatsappLink.href = payload.whatsapp_url;
      whatsappLink.hidden = false;
      showMessage('Lịch hẹn của bạn đã được hủy thành công. Bitte senden Sie die vorbereitete WhatsApp-Nachricht an den Salon.', true);
      if (whatsappWindow) whatsappWindow.location.replace(payload.whatsapp_url);
    } catch (error) {
      whatsappWindow?.close();
      button.disabled = false;
      showMessage(error.message || 'Không thể hủy lịch hẹn.');
    }
  });

  loadBooking();
})();
