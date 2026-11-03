(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('[data-header]');

  const updateHeader = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 28);
  };
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  document.querySelectorAll('[data-reveal]').forEach((element) => {
    const delay = Number(element.getAttribute('data-delay') || 0);
    if (delay > 0) element.style.setProperty('--reveal-delay', String(delay));
  });

  if ('IntersectionObserver' in window && !reduced) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -7% 0px' },
    );
    document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));
  } else {
    document.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-visible'));
  }

  if (reduced || !window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-visible'));
    return;
  }

  document.querySelectorAll('.collection-card').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mx', x + '%');
      card.style.setProperty('--my', y + '%');
    });
  });

  const plate = document.querySelector('[data-tilt]');
  const stage = plate ? plate.closest('.hero-visual') : null;
  if (plate && stage) {
    stage.addEventListener('pointermove', (event) => {
      const rect = plate.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      if (x < -0.15 || x > 1.15 || y < -0.15 || y > 1.15) return;
      const rotateY = (x - 0.5) * 7;
      const rotateX = (0.5 - y) * 5;
      plate.style.transform =
        'rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' + rotateY.toFixed(2) + 'deg)';
    });
    stage.addEventListener('pointerleave', () => {
      plate.style.transform = '';
    });
  }
})();
