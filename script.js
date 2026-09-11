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
    Array.from(text).forEach((character, index) => {
      const glyph = document.createElement('span');
      glyph.className = 'hero-char';
      glyph.style.setProperty('--char-delay', `${lineDelay + (index * 0.08)}s`);
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

  const aboutSlider = setupDots('[data-about-dots]', (dot) => {
    const image = $('#about-image');
    const copy = $('.about-copy');
    if (!image) return;
    image.classList.add('is-changing');
    copy?.classList.add('is-changing');
    window.setTimeout(() => {
      image.src = dot.dataset.image;
      if ($('#about-title')) $('#about-title').textContent = dot.dataset.title;
      if ($('#about-text')) $('#about-text').textContent = dot.dataset.text;
      const finish = () => {
        image.classList.remove('is-changing');
        copy?.classList.remove('is-changing');
      };
      if (image.complete) finish();
      else image.addEventListener('load', finish, { once: true });
    }, reducedMotion ? 0 : 260);
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

  setupSwipe($('.about-grid > .organic-frame'), (direction) => aboutSlider?.choose(aboutSlider.current() + direction, true));

  const serviceCards = $$('.service-card');
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
  const openModal = (modal) => {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    $('.modal-close', modal)?.focus();
  };
  const closeModal = (modal) => {
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    lastFocused?.focus?.();
  };
  $('[data-open-prices]')?.addEventListener('click', () => openModal($('[data-price-modal]')));
  $('[data-modal-book]')?.addEventListener('click', () => closeModal($('[data-price-modal]')));
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
  bookingButtons.forEach((button) => button.addEventListener('click', () => {
    button.classList.toggle('selected');
    bookingNext.disabled = !bookingButtons.some((item) => item.classList.contains('selected'));
  }));
  bookingNext?.addEventListener('click', () => {
    const names = bookingButtons.filter((button) => button.classList.contains('selected')).map((button) => $('span', button).textContent);
    $('[data-selected-services]').textContent = names.join(', ');
    $('[data-booking-services]').hidden = true;
    $('[data-calendar-step]').hidden = false;
    bookingNext.hidden = true;
    $('[data-booking-back]').hidden = false;
    $('[data-step-one]').textContent = '✓';
    $('[data-step-line]').classList.add('active');
    $('[data-step-two]').classList.add('active');
  });
  $('[data-booking-back]')?.addEventListener('click', () => {
    $('[data-booking-services]').hidden = false;
    $('[data-calendar-step]').hidden = true;
    bookingNext.hidden = false;
    $('[data-booking-back]').hidden = true;
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
