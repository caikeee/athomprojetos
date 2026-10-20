/* Athom — blog (WordPress).
   Lê os posts da API pública do WordPress do cliente e desenha:
   · a faixa #blog da index         ([data-blog-home])
   · a página de listagem blog.html ([data-blog-index])
   · a página do artigo             ([data-blog-post])
   Sem dependências. Se a API falhar, a faixa da index some e as páginas
   mostram uma mensagem com o que fazer. */
(() => {
  'use strict';

  /* ---------- Configuração ---------- */
  const WP_URL = 'https://athomprojetos.com.br';
  const POSTS_NA_HOME = 6;
  const POSTS_POR_PAGINA = 9;
  const PALAVRAS_POR_MINUTO = 200;
  const LISTA_CAMPOS = 'slug,date,title,excerpt,content,_links,_embedded';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const getJSON = async (path, params = {}) => {
    const res = await fetch(`${WP_URL}/wp-json/wp/v2/${path}?${new URLSearchParams(params)}`);
    if (!res.ok) throw new Error(`WordPress ${res.status}`);
    return {
      data: await res.json(),
      pages: Number(res.headers.get('X-WP-TotalPages')) || 1,
      total: Number(res.headers.get('X-WP-Total')) || 0,
    };
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  /* O WordPress devolve título e resumo com entidades HTML (&#8220; etc.) */
  const plain = (html) => (new DOMParser().parseFromString(html || '', 'text/html').body.textContent || '').trim();

  const shorten = (text, max) => {
    if (text.length <= max) return text;
    return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
  };

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const formatDate = (iso) => {
    const [y, m, d] = (iso || '').slice(0, 10).split('-').map(Number);
    return y ? `${d} ${MESES[m - 1]} ${y}` : '';
  };

  const safeUrl = (url, protocols) => {
    try {
      const u = new URL(url, WP_URL);
      return protocols.includes(u.protocol) ? u.href : null;
    } catch (err) {
      return null;
    }
  };

  const slugify = (text) =>
    text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'secao';

  /* ---------- Dados ---------- */
  /* Capa: usa o tamanho que o WordPress gerou; capas antigas só têm o original */
  const coverOf = (post) => {
    const media = post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0];
    if (!media || !media.source_url) return null;
    const details = media.media_details || {};
    const sizes = details.sizes || {};
    const steps = ['medium_large', 'large', '1536x1536']
      .map((k) => sizes[k])
      .filter(Boolean);
    const best = steps[steps.length - 1];
    return {
      src: (sizes.large && sizes.large.source_url) || media.source_url,
      big: (sizes['1536x1536'] && sizes['1536x1536'].source_url) || media.source_url,
      srcset: steps.map((s) => `${s.source_url} ${s.width}w`).join(', '),
      width: (best && best.width) || details.width,
      height: (best && best.height) || details.height,
      alt: media.alt_text || '',
    };
  };

  const normalize = (p) => {
    const html = (p.content && p.content.rendered) || '';
    const words = (plain(html).match(/\S+/g) || []).length;
    return {
      slug: p.slug,
      title: plain(p.title.rendered),
      date: p.date,
      excerpt: shorten(plain(p.excerpt.rendered), 170),
      minutes: Math.max(1, Math.round(words / PALAVRAS_POR_MINUTO)),
      cover: coverOf(p),
      html,
    };
  };

  const href = (post) => `blog-post.html?slug=${encodeURIComponent(post.slug)}`;

  /* ---------- Peças visuais ---------- */
  const img = (cover, sizes, eager) => {
    const i = el('img');
    i.src = cover.src;
    if (cover.srcset) { i.srcset = cover.srcset; i.sizes = sizes; }
    if (cover.width && cover.height) { i.width = cover.width; i.height = cover.height; }
    i.alt = cover.alt;
    i.loading = eager ? 'eager' : 'lazy';
    i.decoding = 'async';
    return i;
  };

  const timeEl = (iso, className) => {
    const t = el('time', className, formatDate(iso));
    t.dateTime = iso;
    return t;
  };

  const cell = (label, value) => {
    const c = el('div', 'stamp__cell');
    c.appendChild(el('span', 'stamp__label', label));
    c.appendChild(value instanceof Node ? value : el('span', 'stamp__value', value));
    return c;
  };

  /* Prancha: capa com moldura e carimbo (data e tempo de leitura) */
  const plate = (post, sizes, eager) => {
    const fig = el('figure', 'plate');
    const frame = el('div', 'plate__img');
    if (post.cover) frame.appendChild(img(post.cover, sizes, eager));
    fig.appendChild(frame);
    const stamp = el('div', 'stamp');
    stamp.appendChild(cell('Publicado', timeEl(post.date, 'stamp__value')));
    stamp.appendChild(cell('Leitura', `${post.minutes} min`));
    fig.appendChild(stamp);
    return fig;
  };

  const more = () => el('span', 'more', 'Ler o artigo');

  const renderFeature = (post) => {
    const a = el('a', 'feature');
    a.href = href(post);
    a.appendChild(plate(post, '(max-width: 700px) 100vw, 440px', true));
    const panel = el('div', 'feature__panel');
    panel.appendChild(el('h3', 'feature__title', post.title));
    if (post.excerpt) panel.appendChild(el('p', 'feature__excerpt', post.excerpt));
    panel.appendChild(more());
    a.appendChild(panel);
    return a;
  };

  const renderCard = (post) => {
    const li = el('li', 'post-card');
    const a = el('a', 'post-card__link');
    a.href = href(post);
    a.appendChild(plate(post, '(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 400px'));
    const body = el('div', 'post-card__body');
    body.appendChild(el('h3', 'post-card__title', post.title));
    if (post.excerpt) body.appendChild(el('p', 'post-card__excerpt', post.excerpt));
    body.appendChild(more());
    a.appendChild(body);
    li.appendChild(a);
    return li;
  };

  /* ---------- Index: vitrine do blog ----------
     O cartão que para na primeira posição do trilho vira o destaque:
     assume o fundo da seção, o título e as ações à esquerda. */
  /* Cada cartão vem com a própria sombra no "chão"; a flutuação é defasada por cartão */
  const renderSlide = (post, i) => {
    const slot = el('div', 'bh-slot');
    slot.style.setProperty('--d', `${(i * -1.3).toFixed(1)}s`);
    const b = el('button', 'bh-card');
    b.type = 'button';
    b.dataset.index = String(i);
    if (post.cover) {
      const i2 = img(post.cover, '230px');
      i2.draggable = false;
      i2.alt = '';
      b.appendChild(i2);
    }
    const text = el('span', 'bh-card__text');
    text.appendChild(timeEl(post.date, 'bh-card__date'));
    text.appendChild(el('span', 'bh-card__title', post.title));
    b.appendChild(text);
    slot.append(b, el('span', 'bh-slot__shadow'));
    return slot;
  };

  const setupShowcase = (section, rail, posts) => {
    const cards = $$('.bh-card', rail);
    const layers = $$('.bh-bg__layer', section);
    const feature = $('[data-bh-feature]', section);
    const date = $('[data-bh-date]', section);
    const minutes = $('[data-bh-min]', section);
    const title = $('[data-bh-title]', section);
    const excerpt = $('[data-bh-excerpt]', section);
    const read = $('[data-bh-read]', section);
    const scale = $('[data-bh-scale]', section);
    const prev = $('[data-rail-prev]', section);
    const next = $('[data-rail-next]', section);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pad = (n) => String(n).padStart(2, '0');
    let active = -1;
    let front = 0;

    /* régua (linha de cota): um trecho numerado por artigo */
    const marks = posts.map((p, i) => {
      const li = el('li');
      const b = el('button', 'bh__mark');
      b.type = 'button';
      b.setAttribute('aria-label', `Artigo ${i + 1}: ${p.title}`);
      b.appendChild(el('span', 'bh__mark-num', pad(i + 1)));
      li.appendChild(b);
      scale.appendChild(li);
      return b;
    });

    const show = (i) => {
      if (i === active) return;
      active = i;
      const p = posts[i];
      cards.forEach((c, k) => {
        c.classList.toggle('is-active', k === i);
        c.setAttribute('aria-label', k === i ? `Abrir o artigo: ${posts[k].title}` : `Destacar: ${posts[k].title}`);
      });

      date.textContent = formatDate(p.date);
      date.dateTime = p.date;
      minutes.textContent = `${p.minutes} min de leitura`;
      title.textContent = p.title;
      excerpt.textContent = p.excerpt;
      read.href = href(p);
      feature.classList.remove('is-in');
      void feature.offsetWidth; // reinicia a entrada do texto
      feature.classList.add('is-in');

      marks.forEach((m, k) => {
        m.classList.toggle('is-on', k === i);
        if (k === i) m.setAttribute('aria-current', 'true');
        else m.removeAttribute('aria-current');
      });
      prev.disabled = i === 0;
      next.disabled = i === posts.length - 1;

      /* fundo: carrega na camada de trás e cruza as duas */
      if (!p.cover) return;
      const src = p.cover.big || p.cover.src;
      const pre = new Image();
      pre.onload = () => {
        if (active !== i) return;
        const back = layers[1 - front];
        back.style.backgroundImage = `url("${src.replace(/"/g, '%22')}")`;
        back.classList.add('is-on');
        layers[front].classList.remove('is-on');
        front = 1 - front;
      };
      pre.src = src;
    };

    /* posições medidas pelo encaixe (.bh-slot): o cartão é posicionado dentro dele */
    const slots = $$('.bh-slot', rail);
    const offset = (k) => slots[k].offsetLeft - slots[0].offsetLeft;
    const step = () => slots[0].offsetWidth + (parseFloat(getComputedStyle(rail).columnGap) || 0);
    const goTo = (i) => rail.scrollTo({ left: offset(i), behavior: reduce ? 'auto' : 'smooth' });

    /* sobra à direita para que o último cartão também chegue à primeira posição */
    const fit = () => { rail.style.paddingRight = `${Math.max(0, rail.clientWidth - slots[0].offsetWidth)}px`; };
    fit();
    window.addEventListener('resize', fit);

    /* Roda: cada cartão gira e recua conforme a distância (em cartões) até a
       posição de destaque. d > 0 = ainda vem; d < 0 = já passou. */
    const wheel = () => {
      const s = step();
      slots.forEach((slot, k) => {
        const d = (offset(k) - rail.scrollLeft) / s;
        const ahead = Math.min(Math.max(d, 0), 4);
        const behind = Math.min(Math.max(-d, 0), 1.5);
        const rotate = ahead * -16 + behind * 38;
        const depth = -(ahead * 110 + behind * 160);
        const shift = -(ahead * 34) - behind * 40;
        slot.style.transform = `perspective(1200px) translate3d(${shift}px, 0, ${depth}px) rotateY(${rotate}deg)`;
        slot.style.opacity = String(Math.max(0, 1 - ahead * 0.14 - behind * 0.9));
        slot.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
      });
    };

    let ticking = false;
    rail.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        wheel();
        show(Math.max(0, Math.min(posts.length - 1, Math.round(rail.scrollLeft / step()))));
      });
    }, { passive: true });
    window.addEventListener('resize', wheel);
    wheel();

    prev.addEventListener('click', () => goTo(Math.max(0, active - 1)));
    next.addEventListener('click', () => goTo(Math.min(posts.length - 1, active + 1)));
    marks.forEach((m, i) => m.addEventListener('click', () => goTo(i)));

    /* arraste com o mouse (no toque, a rolagem nativa já faz isso) */
    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let moved = false;
    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startLeft = rail.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) { moved = true; rail.classList.add('is-dragging'); }
      if (moved) rail.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      rail.classList.remove('is-dragging');
    });

    /* clique: num cartão comum, destaca; no destacado, abre o artigo */
    cards.forEach((c, i) => c.addEventListener('click', () => {
      if (moved) { moved = false; return; }
      if (i === active) location.href = href(posts[i]);
      else goTo(i);
    }));

    show(0);
  };

  const initHome = async (rail) => {
    const section = rail.closest('#blog');
    try {
      const { data } = await getJSON('posts', {
        per_page: POSTS_NA_HOME, _embed: 'wp:featuredmedia', _fields: LISTA_CAMPOS,
      });
      const posts = data.map(normalize);
      if (!posts.length) throw new Error('sem posts');
      posts.forEach((p, i) => rail.appendChild(renderSlide(p, i)));
      section.hidden = false;
      setupShowcase(section, rail, posts);
    } catch (err) {
      section.hidden = true;
    }
  };

  /* ---------- blog.html: todos os artigos ---------- */
  const initIndex = async (root) => {
    const lead = $('[data-blog-lead]', root);
    const grid = $('[data-blog-grid]', root);
    const skeleton = $('[data-blog-skeleton]', root);
    const status = $('[data-blog-status]', root);
    const button = $('[data-blog-load]', root);
    let page = 0;
    let pages = 1;

    const setStatus = (msg) => { status.textContent = msg || ''; status.hidden = !msg; };

    const load = async () => {
      button.disabled = true;
      button.textContent = 'Carregando…';
      setStatus('');
      try {
        const { data, pages: total } = await getJSON('posts', {
          per_page: POSTS_POR_PAGINA, page: page + 1, _embed: 'wp:featuredmedia', _fields: LISTA_CAMPOS,
        });
        const posts = data.map(normalize);
        page += 1;
        pages = total;
        if (page === 1) {
          if (!posts.length) {
            skeleton.hidden = true;
            return setStatus('Ainda não há artigos publicados. Volte em breve.');
          }
          lead.appendChild(renderFeature(posts.shift()));
          lead.hidden = false;
        }
        posts.forEach((p) => grid.appendChild(renderCard(p)));
        skeleton.hidden = true;
        button.hidden = page >= pages;
      } catch (err) {
        skeleton.hidden = true;
        setStatus(page === 0
          ? 'Não foi possível carregar os artigos agora. Atualize a página ou tente de novo em instantes.'
          : 'Não foi possível carregar mais artigos. Tente de novo.');
        button.hidden = page === 0;
      } finally {
        button.disabled = false;
        button.textContent = 'Carregar mais artigos';
      }
    };

    button.addEventListener('click', load);
    button.hidden = true;
    load();
  };

  /* ---------- Corpo do post (HTML do WordPress, filtrado) ----------
     Só passam as tags e atributos da lista abaixo; o resto é descartado.
     Isso remove scripts, estilos inline, iframes e os spans do editor. */
  const KEEP = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'STRONG', 'EM', 'A', 'BR', 'HR',
    'FIGURE', 'FIGCAPTION', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
  const RENAME = { B: 'strong', I: 'em', H1: 'h2', H5: 'h4', H6: 'h4' };
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'SVG', 'NOSCRIPT', 'LINK', 'META']);

  const clean = (node, into) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        into.appendChild(document.createTextNode(child.textContent));
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE || DROP.has(child.tagName.toUpperCase())) return;

      const tag = child.tagName.toUpperCase();

      if (tag === 'IMG') {
        const src = safeUrl(child.getAttribute('src'), ['https:', 'http:']);
        if (!src) return;
        const i = el('img');
        i.src = src;
        i.alt = child.getAttribute('alt') || '';
        i.loading = 'lazy';
        i.decoding = 'async';
        into.appendChild(i);
        return;
      }

      const name = RENAME[tag] || (KEEP.has(tag) ? tag.toLowerCase() : null);
      if (!name) { clean(child, into); return; } // span, div etc.: mantém só o conteúdo

      const out = el(name);
      if (name === 'a') {
        const url = safeUrl(child.getAttribute('href'), ['https:', 'http:', 'mailto:', 'tel:']);
        if (!url) { clean(child, into); return; }
        out.href = url;
        if (/^https?:/.test(url) && new URL(url).origin !== location.origin) { out.target = '_blank'; out.rel = 'noopener'; }
      }
      clean(child, out);
      /* descarta parágrafos e títulos que ficaram vazios (comuns no editor do WP) */
      const empty = !out.textContent.trim() && !out.querySelector('img');
      if (empty && /^(p|h2|h3|h4|li|blockquote|strong|em)$/.test(name)) return;
      into.appendChild(out);
    });
  };

  const renderBody = (html, root) => {
    clean(new DOMParser().parseFromString(html || '', 'text/html').body, root);
    /* tabelas largas rolam na horizontal em vez de estourar a página */
    $$('table', root).forEach((t) => {
      const wrap = el('div', 'post__table');
      t.replaceWith(wrap);
      wrap.appendChild(t);
    });
  };

  /* ---------- Artigo: índice, progresso e compartilhar ---------- */
  const buildToc = (body, aside) => {
    const heads = $$('h2', body);
    const used = new Set();
    heads.forEach((h) => {
      let id = slugify(h.textContent);
      while (used.has(id)) id += '-2';
      used.add(id);
      h.id = id;
    });
    if (heads.length < 3) return [];

    const list = $('[data-blog-toc-list]', aside);
    heads.forEach((h) => {
      const li = el('li');
      const a = el('a', null, h.textContent);
      a.href = `#${h.id}`;
      li.appendChild(a);
      list.appendChild(li);
    });
    aside.hidden = false;
    return heads.map((h, i) => ({ head: h, link: list.children[i].firstChild }));
  };

  const trackReading = (body, bar, toc) => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = body.getBoundingClientRect();
      const span = rect.height - window.innerHeight * 0.4;
      const progress = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      bar.style.transform = `scaleX(${progress})`;

      let current = null;
      toc.forEach((item) => { if (item.head.getBoundingClientRect().top <= 140) current = item; });
      toc.forEach((item) => {
        if (item === current) item.link.setAttribute('aria-current', 'location');
        else item.link.removeAttribute('aria-current');
      });
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  };

  const setupShare = (root, title) => {
    const url = location.href;
    const linkedin = $('[data-share="linkedin"]', root);
    const whatsapp = $('[data-share="whatsapp"]', root);
    const copy = $('[data-share="copy"]', root);
    linkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        copy.textContent = 'Link copiado';
      } catch (err) {
        copy.textContent = 'Copie pelo endereço';
      }
      setTimeout(() => { copy.textContent = 'Copiar link'; }, 2400);
    });
  };

  /* ---------- Página do artigo ---------- */
  const initPost = async (root) => {
    const slug = new URLSearchParams(location.search).get('slug');
    const skeleton = $('[data-blog-skeleton]', root);
    const status = $('[data-blog-status]', root);
    const fail = (title, msg) => {
      skeleton.hidden = true;
      $('[data-blog-status-title]', status).textContent = title;
      $('[data-blog-status-text]', status).textContent = msg;
      status.hidden = false;
    };

    if (!slug) return fail('Não encontramos este artigo', 'O endereço pode ter mudado. Veja os artigos publicados.');
    try {
      const { data } = await getJSON('posts', { slug, _embed: 'wp:featuredmedia', _fields: LISTA_CAMPOS });
      if (!data.length) return fail('Não encontramos este artigo', 'O endereço pode ter mudado. Veja os artigos publicados.');
      const post = normalize(data[0]);

      document.title = `${post.title} | Athom Projetos de Loteamentos`;
      const desc = $('meta[name="description"]');
      if (desc && post.excerpt) desc.content = post.excerpt;

      $('[data-blog-title]', root).textContent = post.title;
      const time = $('[data-blog-date]', root);
      time.textContent = formatDate(post.date);
      time.dateTime = post.date;
      $('[data-blog-reading]', root).textContent = `${post.minutes} min`;

      const cover = $('[data-blog-cover]', root);
      if (post.cover) $('.plate__img', cover).appendChild(img(post.cover, '(max-width: 1240px) 100vw, 1240px', true));
      else $('.plate__img', cover).hidden = true;

      const body = $('[data-blog-body]', root);
      renderBody(post.html, body);
      const toc = buildToc(body, $('[data-blog-toc]', root));
      setupShare(root, post.title);

      skeleton.hidden = true;
      $('[data-blog-article]', root).hidden = false;
      trackReading(body, $('[data-read-progress] span'), toc);

      loadMore(post.slug);
    } catch (err) {
      fail('Não foi possível carregar o artigo', 'Atualize a página ou tente de novo em instantes.');
    }
  };

  /* "Continue lendo": os artigos mais recentes, menos o que está aberto */
  const loadMore = async (currentSlug) => {
    const section = $('[data-blog-more]');
    if (!section) return;
    try {
      const { data } = await getJSON('posts', { per_page: 4, _embed: 'wp:featuredmedia', _fields: LISTA_CAMPOS });
      const posts = data.map(normalize).filter((p) => p.slug !== currentSlug).slice(0, 3);
      if (!posts.length) return;
      const grid = $('[data-blog-more-grid]', section);
      posts.forEach((p) => grid.appendChild(renderCard(p)));
      section.hidden = false;
    } catch (err) { /* sem relacionados, sem problema */ }
  };

  const home = $('[data-blog-home]');
  if (home) initHome(home);
  const index = $('[data-blog-index]');
  if (index) initIndex(index);
  const post = $('[data-blog-post]');
  if (post) initPost(post);
})();
