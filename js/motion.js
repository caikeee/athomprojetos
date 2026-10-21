/* Athom — movimento da página.
   Separado de main.js: entradas ao rolar, contagem dos números, progresso de
   leitura, paralaxe da faixa e desenho do perfil técnico.
   Nada aqui é necessário para o conteúdo: sem este arquivo, ou com
   prefers-reduced-motion, a página fica estática e completa.
   As plantas e figuras de main.js (#plan, svg.fig) já se animam sozinhas e
   não são tocadas aqui. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.__athomMotion = true;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    root.classList.remove('has-motion');
    return;
  }
  root.classList.add('has-motion');

  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

  /* ---------- Entradas ao rolar ---------- */
  const REVEAL = [
    // home
    '.statement span', '.method__body .prose', '.table-wrap',
    '.travas__head > *', '.profile', '.problems li', '.travas__ask',
    '.services__head > *', '.services__nav', '.tabpanels',
    '.avulsos__head', '.avulsos__list a',
    '.cases-section__head', '.case', '.cases-section__content > .link-strong',
    '.contact__intro > *', '.form .field', '.form__actions',
    '.site-footer__top', '.site-footer__grid > *',
    // páginas internas
    '.section-title-sm', '.proof__body', '.stats--light .stats__item',
    '.pain__title', '.pain__text', '.solution__copy', '.receive', '.benefits > h3',
    '.steps-section h2', '.steps li', '.faq details',
    '.explore__note', '.explore h2', '.explore__list a',
    '.story__body > *', '.about-hero__copy > *', '.member', '.beliefs li',
    '.diff h2', '.diff__list li', '.diff .stats__item',
  ];

  const observeOnce = (els, onIn, options) => {
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        onIn(entry.target);
        io.unobserve(entry.target);
      });
    }, options);
    els.forEach((el) => io.observe(el));
  };

  const revealEls = [];
  const siblingCount = new Map();
  REVEAL.forEach((sel) => {
    $$(sel).forEach((el) => {
      if (el.closest('.hero') || el.classList.contains('reveal')) return;
      const n = siblingCount.get(el.parentElement) || 0;
      siblingCount.set(el.parentElement, n + 1);
      el.style.setProperty('--i', String(Math.min(n, 6)));
      el.classList.add('reveal');
      revealEls.push(el);
    });
  });
  observeOnce(revealEls, (el) => el.classList.add('is-in'), {
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.12,
  });

  /* ---------- Perfil técnico: terreno e redes se desenham ---------- */
  const profile = $('.profile');
  if (profile) {
    [['.profile__terreno', 0.1], ['.profile__dren', 0.6], ['.profile__san', 0.9]].forEach(([sel, d]) => {
      const path = $(sel, profile);
      if (!path) return;
      path.setAttribute('pathLength', '1');
      path.classList.add('draw-p');
      path.style.setProperty('--d', `${d}s`);
    });
  }

  /* ---------- Foto dos casos: cortina ----------
     Observa a seção, não a foto: com clip-path fechado a foto não tem área
     visível e o IntersectionObserver nunca a daria como visível. */
  observeOnce($$('.cases-section'), (section) => {
    const photo = $('.cases-section__photo', section);
    if (photo) photo.classList.add('is-in');
  }, { threshold: 0.15 });

  /* ---------- Travas: o fio da cadeia corre e as travas caem uma na outra;
     depois o fio desce para a faixa ---------- */
  observeOnce($$('.chain, .travas__turn'), (el) => el.classList.add('is-in'), {
    rootMargin: '0px 0px -12% 0px',
    threshold: 0.3,
  });

  /* ---------- Equipe nas travas: assenta devagar, depois segue a rolagem ----------
     Terminada a entrada, is-settled tira a transição para a paralaxe não arrastar. */
  observeOnce($$('.travas__team'), (team) => {
    team.classList.add('is-in');
    setTimeout(() => team.classList.add('is-settled'), 2500);
  }, { threshold: 0.15 });

  /* ---------- Números: contam até o valor publicado ---------- */
  // Aceita "12+", "230+", "10,8" (vírgula decimal) e "9.400+" (ponto de milhar).
  const parseStat = (text) => {
    const m = text.trim().match(/^([\d.,]+)(.*)$/);
    if (!m) return null;
    const [int, frac = ''] = m[1].split(',');
    const value = parseFloat(`${int.replace(/\./g, '')}.${frac || '0'}`);
    return Number.isFinite(value) ? { value, decimals: frac.length, suffix: m[2] } : null;
  };
  const formatStat = (v, decimals) => {
    const [int, frac] = v.toFixed(decimals).split('.');
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (frac ? `,${frac}` : '');
  };
  // O valor publicado fica num .sr (leitores de tela e busca leem o número
  // final); o que anima é um span aria-hidden que parte do zero.
  const prepareStat = (dd) => {
    const original = dd.textContent.trim();
    const stat = parseStat(original);
    if (!stat) return null;
    const label = document.createElement('span');
    label.className = 'sr';
    label.textContent = original;
    const live = document.createElement('span');
    live.setAttribute('aria-hidden', 'true');
    live.textContent = formatStat(0, stat.decimals) + stat.suffix;
    dd.textContent = '';
    dd.append(label, live);
    return { live, original, stat };
  };
  const countUp = ({ live, original, stat }, delay) => {
    const start = performance.now() + delay;
    const duration = 1800;
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 4);
      live.textContent = t < 1 ? formatStat(stat.value * eased, stat.decimals) + stat.suffix : original;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  // Cada faixa conta da esquerda para a direita, um número após o outro.
  const STAT_STAGGER = 140;
  $$('.stats').forEach((dl) => {
    const counters = $$('.stats__item', dl).map((item, i) => {
      item.style.setProperty('--i', String(i));
      const dd = $('dd', item);
      return dd ? prepareStat(dd) : null;
    });
    observeOnce([dl], () => {
      dl.classList.add('is-in');
      counters.forEach((c, i) => c && countUp(c, i * STAT_STAGGER));
    }, { threshold: 0.4 });
  });

  /* ---------- Rolagem: progresso de leitura e paralaxe da faixa ---------- */
  const header = $('.site-header');
  let bar = null;
  if (header) {
    bar = document.createElement('span');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    header.appendChild(bar);
  }
  const bands = $$('.band');
  const drifts = $$('.travas__team');

  let queued = false;
  const onScroll = () => {
    queued = false;
    const vh = window.innerHeight;
    if (header) {
      const max = document.documentElement.scrollHeight - vh;
      header.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : '0');
    }
    bands.forEach((band) => {
      const r = band.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const progress = (vh - r.top) / (vh + r.height); // 0 ao entrar, 1 ao sair
      band.style.setProperty('--py', `${((progress - 0.5) * r.height * 0.2).toFixed(1)}px`);
    });
    // mais contida que a faixa: a foto tem só 6% de sobra na escala
    drifts.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const progress = (vh - r.top) / (vh + r.height);
      el.style.setProperty('--py', `${((progress - 0.5) * r.height * 0.05).toFixed(1)}px`);
    });
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(onScroll);
  };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  onScroll();
})();
