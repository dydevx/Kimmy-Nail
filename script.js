(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const $ = (selector, root = document) => root?.querySelector(selector) ?? null;
  const $$ = (selector, root = document) => root ? [...root.querySelectorAll(selector)] : [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  $$('.hero-copy > span').forEach((line) => {
    const text = line.textContent;
    const lineDelay = Number.parseFloat(line.dataset.lineDelay || '0');
    line.textContent = '';
    line.setAttribute('aria-hidden', 'true');
    const characterStagger = window.matchMedia('(max-width: 767px)').matches ? 0.08 : 0.1;
    Array.from(text).forEach((character, index) => {
      const glyph = document.createElement('span');
      glyph.className = 'hero-char';
      glyph.style.setProperty('--char-delay', `${lineDelay + (index * characterStagger)}s`);
      glyph.textContent = character;
      line.appendChild(glyph);
    });
  });

  const nav = $('.site-nav');
  const navMarker = $('[data-nav-marker]');
  if (nav && navMarker && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => nav.classList.toggle('site-nav--solid', !entry.isIntersecting), { threshold: 0 }).observe(navMarker);
  } else if (nav && !$('.hero')) {
    nav.classList.add('site-nav--solid');
  }

  const menu = $('[data-mobile-menu]');
  const menuButton = $('[data-menu-open]');
  const closeMenu = () => {
    if (!menu) return;
    menu.classList.remove('mobile-menu--open');
    menu.setAttribute('aria-hidden', 'true');
    menuButton?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
  };
  menuButton?.addEventListener('click', () => {
    menu.classList.add('mobile-menu--open');
    menu.setAttribute('aria-hidden', 'false');
    menuButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('no-scroll');
  });
  $('[data-menu-close]')?.addEventListener('click', closeMenu);
  $$('a', menu).forEach((link) => link.addEventListener('click', closeMenu));

  $$('a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => {
    const target = $(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }));

  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.13, rootMargin: '0px 0px -40px' });
    reveals.forEach((element) => observer.observe(element));
  } else {
    reveals.forEach((element) => element.classList.add('is-visible'));
  }

  function setupDots(containerSelector, apply, delay = 5000) {
    const container = $(containerSelector);
    if (!container) return null;
    const dots = $$('button', container);
    let index = 0;
    let timer;
    const choose = (next, manual = false) => {
      index = (next + dots.length) % dots.length;
      dots.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === index));
      apply(dots[index], index);
      if (manual && timer) window.clearInterval(timer);
    };
    dots.forEach((dot, dotIndex) => dot.addEventListener('click', () => choose(dotIndex, true)));
    if (!reducedMotion && dots.length > 1) timer = window.setInterval(() => choose(index + 1), delay);
    return { choose, current: () => index };
  }

  let aboutTransitionTimer;
  const aboutSlider = setupDots('[data-about-dots]', (dot, index) => {
    const image = $('#about-image');
    const media = $('.about-media');
    const copyBody = $('.about-copy-body');
    if (!image) return;

    const updateSlide = () => {
      image.src = dot.dataset.image;
      if ($('#about-title')) $('#about-title').textContent = dot.dataset.title;
      if ($('#about-text')) $('#about-text').textContent = dot.dataset.text;
      applyAboutOrganicShapes(index);
    };

    window.clearTimeout(aboutTransitionTimer);
    if (reducedMotion) {
      updateSlide();
      return;
    }

    media?.classList.remove('is-entering');
    copyBody?.classList.remove('is-entering');
    media?.classList.add('is-exiting');
    copyBody?.classList.add('is-exiting');
    const exitDuration = window.matchMedia('(max-width: 767px)').matches ? 900 : 1000;
    aboutTransitionTimer = window.setTimeout(() => {
      updateSlide();
      media?.classList.remove('is-exiting');
      copyBody?.classList.remove('is-exiting');
      media?.classList.add('is-entering');
      copyBody?.classList.add('is-entering');
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        media?.classList.remove('is-entering');
        copyBody?.classList.remove('is-entering');
      }));
    }, exitDuration);
  });

  setupDots('[data-review-dots]', (dot) => {
    const card = $('.review-card');
    card?.classList.add('is-changing');
    window.setTimeout(() => {
      $('[data-review-text]').textContent = dot.dataset.text;
      $('[data-review-name]').textContent = dot.dataset.name;
      $('[data-review-date]').textContent = dot.dataset.date;
      card?.classList.remove('is-changing');
    }, reducedMotion ? 0 : 220);
  });

  const setupSwipe = (element, onSwipe) => {
    if (!element) return;
    let startX = null;
    element.addEventListener('pointerdown', (event) => { startX = event.clientX; });
    element.addEventListener('pointerup', (event) => {
      if (startX === null) return;
      const distance = event.clientX - startX;
      startX = null;
      if (Math.abs(distance) >= 45) onSwipe(distance < 0 ? 1 : -1);
    });
    element.addEventListener('pointercancel', () => { startX = null; });
  };

  setupSwipe($('.about-media'), (direction) => aboutSlider?.choose(aboutSlider.current() + direction, true));

  const simplexGradients = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
  const simplexPermutationBase = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180];
  const simplexPermutation = [...simplexPermutationBase, ...simplexPermutationBase];
  const simplexDot = (gradient, x, y) => (gradient[0] * x) + (gradient[1] * y);
  const simplexNoise = (x, y) => {
    const skew = 0.5 * (Math.sqrt(3) - 1);
    const unskew = (3 - Math.sqrt(3)) / 6;
    const skewed = (x + y) * skew;
    const cellX = Math.floor(x + skewed);
    const cellY = Math.floor(y + skewed);
    const cellOffset = (cellX + cellY) * unskew;
    const x0 = x - cellX + cellOffset;
    const y0 = y - cellY + cellOffset;
    const stepX = x0 > y0 ? 1 : 0;
    const stepY = x0 > y0 ? 0 : 1;
    const x1 = x0 - stepX + unskew;
    const y1 = y0 - stepY + unskew;
    const x2 = x0 - 1 + (2 * unskew);
    const y2 = y0 - 1 + (2 * unskew);
    const wrappedX = cellX & 255;
    const wrappedY = cellY & 255;
    const gradient0 = simplexGradients[simplexPermutation[wrappedX + simplexPermutation[wrappedY]] % 12];
    const gradient1 = simplexGradients[simplexPermutation[wrappedX + stepX + simplexPermutation[wrappedY + stepY]] % 12];
    const gradient2 = simplexGradients[simplexPermutation[wrappedX + 1 + simplexPermutation[wrappedY + 1]] % 12];
    const contribution = (falloff, gradient, px, py) => {
      if (falloff < 0) return 0;
      const squared = falloff * falloff;
      return squared * squared * simplexDot(gradient, px, py);
    };
    return 70 * (
      contribution(0.5 - (x0 * x0) - (y0 * y0), gradient0, x0, y0)
      + contribution(0.5 - (x1 * x1) - (y1 * y1), gradient1, x1, y1)
      + contribution(0.5 - (x2 * x2) - (y2 * y2), gradient2, x2, y2)
    );
  };
  const organicPolygon = (seed = 0, variance = 6, steps = 100) => {
    const points = [];
    for (let index = 0; index <= steps; index += 1) {
      const angle = (index / steps) * Math.PI * 2;
      const radius = 44 + (simplexNoise((0.5 * Math.cos(angle)) + seed, (0.5 * Math.sin(angle)) + seed) * variance);
      points.push(`${50 + (Math.cos(angle) * radius)}% ${50 + (Math.sin(angle) * radius)}%`);
    }
    return `polygon(${points.join(', ')})`;
  };

  const applyAboutOrganicShapes = (index) => {
    const seed = 20 * index;
    const media = $('.about-media');
    const image = $('#about-image', media);
    const halos = $$('.halo', media);
    if (image) {
      image.style.setProperty('--about-clip-desktop', organicPolygon(seed, 6));
      image.style.setProperty('--about-clip-mobile', organicPolygon(seed, 5, 80));
    }
    halos.forEach((halo, haloIndex) => {
      const usesPinkShape = haloIndex === 1 || haloIndex === 3;
      halo.style.setProperty('--about-clip-desktop', organicPolygon(seed + (usesPinkShape ? 2 : 1), usesPinkShape ? 11 : 9));
      halo.style.setProperty('--about-clip-mobile', organicPolygon(seed + 1, 7, 80));
    });
  };
  applyAboutOrganicShapes(0);

  const serviceCards = $$('.service-card');
  serviceCards.forEach((card, index) => {
    const seed = 25 * index;
    const frame = $('.organic-frame', card);
    const image = $('img', frame);
    const halos = $$('.halo', frame);
    if (image) {
      image.style.setProperty('--service-clip-desktop', organicPolygon(seed, 5));
      image.style.setProperty('--service-clip-mobile', organicPolygon(seed, 4, 60));
    }
    halos.forEach((halo, haloIndex) => {
      const desktopShapes = [[seed + 1, 8], [seed + 2, 10], [seed + 3, 7], [seed + 1, 8]];
      const [desktopSeed, desktopVariance] = desktopShapes[haloIndex];
      halo.style.setProperty('--service-clip-desktop', organicPolygon(desktopSeed, desktopVariance));
      halo.style.setProperty('--service-clip-mobile', organicPolygon(seed + 1, 6, 60));
    });
  });
  const serviceDots = $$('[data-service-dots] button');
  let serviceIndex = 0;
  const showService = (next) => {
    serviceIndex = (next + serviceCards.length) % serviceCards.length;
    serviceCards.forEach((card, index) => card.classList.toggle('is-current', index === serviceIndex));
    serviceDots.forEach((dot, index) => dot.classList.toggle('active', index === serviceIndex));
  };
  $('[data-service-prev]')?.addEventListener('click', () => showService(serviceIndex - 1));
  $('[data-service-next]')?.addEventListener('click', () => showService(serviceIndex + 1));
  serviceDots.forEach((dot, index) => dot.addEventListener('click', () => showService(index)));
  setupSwipe($('[data-service-grid]'), (direction) => showService(serviceIndex + direction));

  let lastFocused;
  const modalCloseTimers = new WeakMap();
  const openModal = (modal) => {
    const pendingClose = modalCloseTimers.get(modal);
    if (pendingClose) window.clearTimeout(pendingClose);
    modal.classList.remove('is-closing');
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    $('.modal-close', modal)?.focus();
  };
  const closeModal = (modal, { restoreFocus = true } = {}) => {
    const finishClose = () => {
      modal.hidden = true;
      modal.classList.remove('is-closing');
      modalCloseTimers.delete(modal);
      document.body.classList.remove('no-scroll');
      if (restoreFocus) lastFocused?.focus?.();
    };
    if (modal.matches('[data-price-modal]') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      modal.classList.add('is-closing');
      modalCloseTimers.set(modal, window.setTimeout(finishClose, 500));
      return;
    }
    finishClose();
  };
  $('[data-open-prices]')?.addEventListener('click', () => openModal($('[data-price-modal]')));
  $('[data-modal-book]')?.addEventListener('click', () => closeModal($('[data-price-modal]'), { restoreFocus: false }));
  $$('.modal-backdrop').forEach((modal) => {
    modal.addEventListener('mousedown', (event) => { if (event.target === modal) closeModal(modal); });
    $$('[data-close-modal]', modal).forEach((button) => button.addEventListener('click', () => closeModal(modal)));
  });

  const galleryItems = $$('.gallery-item');
  const galleryExtra = $$('[data-gallery-extra]');
  const galleryToggle = $('[data-gallery-toggle]');
  let galleryExpanded = false;
  galleryToggle?.addEventListener('click', () => {
    galleryExpanded = !galleryExpanded;
    galleryExtra.forEach((item) => { item.hidden = !galleryExpanded; if (galleryExpanded) item.classList.add('is-visible'); });
    galleryToggle.textContent = galleryExpanded ? 'Weniger anzeigen' : 'Alle ansehen';
    galleryToggle.dataset.label = galleryToggle.textContent;
  });

  const lightbox = $('[data-lightbox]');
  const lightboxImage = $('img', lightbox);
  const lightboxCount = $('[data-lightbox-count]');
  let lightboxIndex = 0;
  const updateLightbox = (next) => {
    lightboxIndex = (next + galleryItems.length) % galleryItems.length;
    const source = $('img', galleryItems[lightboxIndex]);
    lightboxImage.src = source.src;
    lightboxImage.alt = source.alt;
    lightboxCount.textContent = `${lightboxIndex + 1} / ${galleryItems.length}`;
  };
  galleryItems.forEach((item, index) => item.addEventListener('click', () => { updateLightbox(index); openModal(lightbox); }));
  $('[data-lightbox-prev]')?.addEventListener('click', () => updateLightbox(lightboxIndex - 1));
  $('[data-lightbox-next]')?.addEventListener('click', () => updateLightbox(lightboxIndex + 1));

  document.addEventListener('keydown', (event) => {
    const activeModal = $$('.modal-backdrop').find((modal) => !modal.hidden);
    if (event.key === 'Escape') {
      if (activeModal) closeModal(activeModal);
      else closeMenu();
    }
    if (activeModal === lightbox && event.key === 'ArrowLeft') updateLightbox(lightboxIndex - 1);
    if (activeModal === lightbox && event.key === 'ArrowRight') updateLightbox(lightboxIndex + 1);
    if (activeModal && event.key === 'Tab') {
      const focusable = $$('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])', activeModal).filter((element) => !element.hidden && !element.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  const bookingButtons = $$('.select-list button');
  const bookingNext = $('[data-booking-next]');
  const bookingBack = $('[data-booking-back]');
  const bookingForm = $('[data-booking-form]');
  const bookingDate = $('[data-booking-date]');
  const bookingTime = $('[data-booking-time]');
  const availabilityMessage = $('[data-availability-message]');
  const bookingError = $('[data-booking-error]');
  let selectedServices = [];

  const localIsoDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  };

  const getSelectedServices = () => bookingButtons
    .filter((button) => button.classList.contains('selected'))
    .map((button) => {
      const category = $('h4', button.closest('section'))?.textContent.trim();
      const service = $('span', button)?.textContent.trim();
      return category ? `${category} — ${service}` : service;
    });

  const bookingValues = () => {
    const values = Object.fromEntries(new FormData(bookingForm).entries());
    return { ...values, service: selectedServices.join(', ') };
  };

  const formatBookingDate = (value) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  };

  const renderBookingSummary = (container, booking) => {
    if (!container) return;
    const fields = [
      ['Name', booking.customer_name],
      ['Telefon', booking.phone],
      ['Leistungen', booking.service],
      ['Datum', formatBookingDate(booking.booking_date)],
      ['Uhrzeit', booking.booking_time],
      ...(booking.notes ? [['Notiz', booking.notes]] : [])
    ];
    container.replaceChildren(...fields.flatMap(([label, value]) => {
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = label;
      detail.textContent = value;
      return [term, detail];
    }));
  };

  const loadAvailability = async () => {
    if (!bookingDate?.value) return;
    bookingTime.disabled = true;
    bookingTime.innerHTML = '<option value="">Freie Zeiten werden geladen…</option>';
    availabilityMessage.textContent = 'Verfügbarkeit wird geladen…';
    try {
      const response = await fetch(`/api/availability?date=${encodeURIComponent(bookingDate.value)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Verfügbarkeit konnte nicht geladen werden.');
      const previousTime = bookingTime.dataset.selectedTime || '';
      bookingTime.replaceChildren(new Option('Uhrzeit wählen', ''));
      payload.slots.forEach((slot) => {
        const label = slot.capacity === 3
          ? `${slot.time} — ${slot.remaining ? `Noch ${slot.remaining} ${slot.remaining === 1 ? 'Platz' : 'Plätze'}` : 'Ausgebucht'}`
          : `${slot.time} — ${slot.available ? 'Verfügbar' : 'Ausgebucht'}`;
        const option = new Option(label, slot.time, false, slot.time === previousTime && slot.available);
        option.disabled = !slot.available;
        bookingTime.append(option);
      });
      bookingTime.disabled = false;
      availabilityMessage.textContent = 'Volle Zeiten können nicht ausgewählt werden.';
    } catch (error) {
      bookingTime.replaceChildren(new Option('Keine Zeiten verfügbar', ''));
      availabilityMessage.textContent = error.message;
    }
  };

  if (bookingDate) {
    bookingDate.min = localIsoDate();
    bookingDate.addEventListener('change', () => {
      bookingTime.dataset.selectedTime = '';
      loadAvailability();
    });
  }
  bookingTime?.addEventListener('change', () => { bookingTime.dataset.selectedTime = bookingTime.value; });

  bookingButtons.forEach((button) => button.addEventListener('click', () => {
    button.classList.toggle('selected');
    button.setAttribute('aria-pressed', String(button.classList.contains('selected')));
    bookingNext.disabled = !bookingButtons.some((item) => item.classList.contains('selected'));
  }));

  bookingNext?.addEventListener('click', () => {
    selectedServices = getSelectedServices();
    $('[data-selected-services]').textContent = selectedServices.join(', ');
    $('[data-booking-services]').hidden = true;
    $('[data-calendar-step]').hidden = false;
    bookingNext.hidden = true;
    bookingBack.hidden = false;
    $('[data-step-one]').textContent = '✓';
    $('[data-step-line]').classList.add('active');
    $('[data-step-two]').classList.add('active');
  });

  $('[data-booking-review]')?.addEventListener('click', () => {
    if (!bookingForm.reportValidity()) return;
    const booking = bookingValues();
    renderBookingSummary($('[data-booking-summary]'), booking);
    bookingError.hidden = true;
    $('[data-booking-form-step]').hidden = true;
    $('[data-booking-review-step]').hidden = false;
    bookingBack.hidden = true;
  });

  $('[data-booking-edit]')?.addEventListener('click', () => {
    $('[data-booking-form-step]').hidden = false;
    $('[data-booking-review-step]').hidden = true;
    bookingBack.hidden = false;
    loadAvailability();
  });

  $('[data-booking-confirm]')?.addEventListener('click', async (event) => {
    const confirmButton = event.currentTarget;
    const whatsappWindow = window.open('about:blank', '_blank');
    if (whatsappWindow) whatsappWindow.opener = null;
    confirmButton.disabled = true;
    confirmButton.textContent = 'Wird gebucht…';
    bookingError.hidden = true;
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingValues())
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Die Buchung konnte nicht gespeichert werden.');
      renderBookingSummary($('[data-booking-success-summary]'), payload.booking);
      $('[data-cancel-link]').href = payload.cancel_url;
      $('[data-whatsapp-link]').href = payload.whatsapp_url;
      $('[data-booking-review-step]').hidden = true;
      $('[data-booking-success]').hidden = false;
      if (whatsappWindow) whatsappWindow.location.replace(payload.whatsapp_url);
    } catch (error) {
      whatsappWindow?.close();
      bookingError.textContent = error.message;
      bookingError.hidden = false;
      await loadAvailability();
    } finally {
      confirmButton.disabled = false;
      confirmButton.textContent = 'Termin bestätigen';
    }
  });

  bookingBack?.addEventListener('click', () => {
    $('[data-booking-services]').hidden = false;
    $('[data-calendar-step]').hidden = true;
    $('[data-booking-form-step]').hidden = false;
    $('[data-booking-review-step]').hidden = true;
    bookingNext.hidden = false;
    bookingBack.hidden = true;
    $('[data-step-one]').textContent = '1';
    $('[data-step-line]').classList.remove('active');
    $('[data-step-two]').classList.remove('active');
  });

  $$('.faq-item').forEach((item) => {
    const button = $('button', item);
    button.addEventListener('click', () => {
      const willOpen = !item.classList.contains('open');
      $$('.faq-item').forEach((other) => { other.classList.remove('open'); $('button', other).setAttribute('aria-expanded', 'false'); });
      item.classList.toggle('open', willOpen);
      button.setAttribute('aria-expanded', String(willOpen));
    });
  });

  $('[data-contact-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    event.currentTarget.reset();
    $('[data-form-success]').hidden = false;
  });

  $$('.footer-groups section > button').forEach((button) => button.addEventListener('click', () => button.parentElement.classList.toggle('open')));

  const cookieBanner = $('[data-cookie-banner]');
  if (cookieBanner && !window.localStorage.getItem('cookie_consent')) {
    window.setTimeout(() => { cookieBanner.hidden = false; }, reducedMotion ? 0 : 1500);
  }
  $$('[data-cookie]').forEach((button) => button.addEventListener('click', () => {
    window.localStorage.setItem('cookie_consent', button.dataset.cookie);
    cookieBanner.hidden = true;
  }));

  const backToTop = $('[data-back-to-top]');
  const backToTopMarker = $('[data-back-to-top-marker]');
  if (backToTop && backToTopMarker && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => backToTop.classList.toggle('visible', !entry.isIntersecting), { threshold: 0 }).observe(backToTopMarker);
  }
  backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }));
})();
