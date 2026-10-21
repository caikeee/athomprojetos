/* Athom — interações da página.
   Sem dependências. Ordem: configuração → menu → planta → abas → formulário. */
(() => {
  'use strict';

  /* ---------- Configuração ----------
     Preencha WHATSAPP com DDI+DDD+número, só dígitos (ex.: '5519999999999').
     Enquanto estiver vazio, os botões "Falar no WhatsApp" levam ao formulário
     e o formulário abre o e-mail. */
  const WHATSAPP = '551922183135';
  const EMAIL = 'contato@athomprojetos.com.br';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- WhatsApp ---------- */
  const waUrl = (text) =>
    `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

  if (WHATSAPP) {
    $$('[data-whatsapp]').forEach((a) => {
      a.href = waUrl('Olá, vim pelo site e gostaria de solicitar um serviço.');
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  /* ---------- Menu móvel ---------- */
  const toggle = $('.nav-toggle');
  const menu = $('#menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Submenu de serviços ---------- */
  const navItem = $('.nav__item');
  if (navItem) {
    const trigger = $('.nav__trigger', navItem);
    const setOpen = (open) => {
      navItem.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
    };
    trigger.addEventListener('click', () => setOpen(!navItem.classList.contains('is-open')));
    document.addEventListener('click', (e) => {
      if (!navItem.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navItem.classList.contains('is-open')) {
        setOpen(false);
        trigger.focus();
      }
    });
  }

  /* ---------- Planta do loteamento ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const LAYERS = ['urbanismo', 'terraplenagem', 'drenagem', 'saneamento'];

  const el = (name, attrs = {}, parent) => {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  };

  /* Gera a planta dentro de `root`. Devolve referências para controlar camadas
     e interferências. A geometria vive num referencial local; o grupo "world"
     é girado para tirar o grid do esquadro. */
  function buildPlan(root, uid) {
    const gleba = [[46, 120], [300, 46], [560, 84], [612, 300], [566, 486], [270, 520], [70, 440]];
    const glebaD = 'M' + gleba.map((p) => p.join(' ')).join('L') + 'Z';

    const xs = [-20, 150, 280, 410, 530, 660];   // ruas verticais (eixos internos: 1..4)
    const ys = [-20, 210, 350, 580];             // avenidas horizontais (eixos internos: 1..2)
    const HX = 10;                               // meia largura das ruas
    const HY = 13;                               // meia largura das avenidas
    const special = { '2,1': 'verde', '1,2': 'bacia', '3,0': 'inst' };
    const clipId = `gleba-clip-${uid}`;

    const defs = el('defs', {}, root);
    el('path', { d: glebaD }, el('clipPath', { id: clipId }, defs));

    const world = el('g', { transform: 'rotate(-9 320 280)' }, root);
    const layers = Object.fromEntries(LAYERS.map((n) => [n, []]));

    // contorno do terreno: continua, discreto, para além da gleba
    const contourPath = (k, x0, x1, step) => {
      const yAt = (x) => 10 + k * 42 + 24 * Math.sin(x / 105 + k * 0.55) + 9 * Math.sin(x / 41 + k * 1.7);
      let d = '';
      for (let x = x0; x <= x1; x += step) d += `${d ? 'L' : 'M'}${x} ${yAt(x).toFixed(1)}`;
      return { d, yAt };
    };

    const terraOut = el('g', { class: 'layer', 'data-layer': 'terraplenagem' }, world);
    layers.terraplenagem.push(terraOut);
    const terraOutInner = el('g', { style: '--d:1s' }, terraOut);
    for (let k = -4; k <= 17; k++) {
      const { d } = contourPath(k, -340, 900, 12);
      el('path', { class: `contour contour--out${k % 4 === 0 ? ' contour--index' : ''} draw`, d, pathLength: 1 }, terraOutInner);
    }

    el('path', { class: 'gleba-fill', d: glebaD }, world);

    const clipped = el('g', { 'clip-path': `url(#${clipId})` }, world);
    const layer = (name, delay) => {
      const outer = el('g', { class: 'layer', 'data-layer': name }, clipped);
      layers[name].push(outer);
      return el('g', { style: `--d:${delay}s` }, outer);
    };

    /* Urbanismo: lotes, eixos viários, áreas públicas */
    const urb = layer('urbanismo', 0.2);
    let lotsD = '';
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i] + HX, x1 = xs[i + 1] - HX;
        const y0 = ys[j] + HY, y1 = ys[j + 1] - HY;
        const kind = special[`${i},${j}`];
        const rect = `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
        if (kind) {
          const cls = { verde: 'block-verde', bacia: 'block-bacia', inst: 'block-inst' }[kind];
          el('path', { class: `${cls} fade`, d: rect }, urb);
          continue;
        }
        lotsD += rect;
        const w = x1 - x0, h = y1 - y0;
        const cols = Math.max(2, Math.round(w / 15));
        const rows = Math.max(1, Math.round(h / 30));
        for (let c = 1; c < cols; c++) lotsD += `M${(x0 + (w / cols) * c).toFixed(1)} ${y0}V${y1}`;
        for (let r = 1; r < rows; r++) lotsD += `M${x0} ${(y0 + (h / rows) * r).toFixed(1)}H${x1}`;
      }
    }
    el('path', { class: 'lots fade', d: lotsD }, urb);

    let axisD = '';
    for (let j = 1; j < ys.length - 1; j++) axisD += `M-20 ${ys[j]}H660`;
    for (let i = 1; i < xs.length - 1; i++) axisD += `M${xs[i]} -20V580`;
    el('path', { class: 'axis fade', d: axisD }, urb);

    const tag = (text, x, y) => {
      el('text', { class: 'tag fade', x, y, 'text-anchor': 'middle' }, urb).textContent = text;
    };
    tag('Área verde', 345, 284);
    tag('Bacia de detenção', 215, 468);
    tag('Área institucional', 470, 96);

    /* Terraplenagem: curvas de nível dentro da gleba, com cotas */
    const terra = layer('terraplenagem', 1.0);
    for (let k = 0; k < 14; k++) {
      const idx = k % 4 === 0;
      const { d, yAt } = contourPath(k, -20, 660, 10);
      el('path', { class: `contour${idx ? ' contour--index' : ''} draw`, d, pathLength: 1 }, terra);
      if (idx) {
        const cx = 90 + ((k * 97) % 380);
        el('text', { class: 'cota fade', x: cx, y: (yAt(cx) - 3).toFixed(1), 'text-anchor': 'middle' }, terra)
          .textContent = String(728 - k * 2);
      }
    }

    /* Drenagem e saneamento: redes ao longo do viário, em lados opostos */
    const pipes = (name, delay, cls, offsetH, offsetV) => {
      const g = layer(name, delay);
      for (let j = 1; j < ys.length - 1; j++) {
        el('path', { class: `pipe ${cls} draw`, d: `M-20 ${ys[j] + offsetH}H660`, pathLength: 1 }, g);
      }
      for (let i = 1; i < xs.length - 1; i++) {
        el('path', { class: `pipe ${cls} draw`, d: `M${xs[i] + offsetV} -20V580`, pathLength: 1 }, g);
      }
      for (let i = 1; i < xs.length - 1; i++) {
        for (let j = 1; j < ys.length - 1; j++) {
          el('circle', {
            class: `pv pv--${name === 'drenagem' ? 'dren' : 'san'} fade`,
            cx: xs[i] + offsetV, cy: ys[j] + offsetH, r: 2.8,
          }, g);
        }
      }
    };
    pipes('drenagem', 1.9, 'pipe--dren', -6, -5);
    pipes('saneamento', 2.6, 'pipe--san', 6, 5);

    el('path', { class: 'gleba-edge draw', d: glebaD, pathLength: 1, style: '--d:0s' }, world);

    /* Interferências: onde a drenagem cruza a rede de esgoto na mesma cota */
    const conflictGroup = el('g', { class: 'conflicts' }, world);
    const markers = [[285, 204], [405, 356], [145, 356]].map(([cx, cy], n) => {
      const g = el('g', {
        class: 'conflict',
        transform: `translate(${cx} ${cy})`,
        style: `--d:${(3.7 + n * 0.2).toFixed(1)}s`,
      }, conflictGroup);
      el('circle', { class: 'conflict__ring', r: 10 }, g);
      el('path', { class: 'conflict__x', d: 'M-4 -4L4 4M4 -4L-4 4' }, g);
      el('path', { class: 'conflict__ok', d: 'M-5 0L-1.5 3.5L5 -4' }, g);
      return g;
    });

    return { layers, conflictGroup, markers };
  }

  const setLayer = (plan, name, on) =>
    plan.layers[name].forEach((g) => g.classList.toggle('is-off', !on));

  /* ---------- Hero: planta + camadas + compatibilização ---------- */
  const heroSvg = $('#plan');
  if (heroSvg) {
    const plan = buildPlan(heroSvg, 'hero');

    const dot = $('#plan-dot');
    const status = $('#plan-status');
    const resolveBtn = $('#plan-resolve');
    let resolved = false;

    const setStatus = (text, kind) => {
      status.textContent = text;
      dot.className = `status-dot${kind ? ` is-${kind}` : ''}`;
    };

    const showConflicts = () => {
      resolved = false;
      plan.markers.forEach((m) => m.classList.remove('is-resolved'));
      setStatus('3 interferências entre drenagem e esgoto', 'alert');
      resolveBtn.textContent = 'Compatibilizar modelo';
      resolveBtn.setAttribute('aria-pressed', 'false');
    };

    const resolveConflicts = () => {
      resolved = true;
      plan.markers.forEach((m) => m.classList.add('is-resolved'));
      setStatus('Modelo compatibilizado: 0 interferências', 'ok');
      resolveBtn.textContent = 'Ver interferências';
      resolveBtn.setAttribute('aria-pressed', 'true');
    };

    resolveBtn.addEventListener('click', () => (resolved ? showConflicts() : resolveConflicts()));

    const syncConflictVisibility = () => {
      const on = (name) => $(`[data-layer-toggle="${name}"]`).checked;
      plan.conflictGroup.classList.toggle('is-off', !(on('drenagem') && on('saneamento')));
    };
    $$('[data-layer-toggle]').forEach((input) => {
      input.addEventListener('change', () => {
        setLayer(plan, input.dataset.layerToggle, input.checked);
        syncConflictVisibility();
      });
    });

    const finish = () => {
      resolveBtn.disabled = false;
      showConflicts();
    };
    if (reduceMotion) {
      heroSvg.classList.add('is-drawn');
      finish();
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => heroSvg.classList.add('is-drawn')));
      window.setTimeout(finish, 4400);
    }
  }

  /* ---------- Serviços: abas + figura que mostra as camadas de cada serviço ---------- */
  const serviceSvg = $('#plan-service');
  let servicePlan = null;

  const SERVICE_STATES = {
    urbanismo: {
      layers: ['urbanismo'],
      conflicts: 'off',
      legend: 'Camada deste serviço: urbanismo',
    },
    infra: {
      layers: ['terraplenagem', 'drenagem', 'saneamento'],
      conflicts: 'resolved',
      legend: 'Camadas deste serviço: terraplenagem, drenagem e água e esgoto, compatibilizadas',
    },
    ciclo: {
      layers: LAYERS,
      conflicts: 'resolved',
      legend: 'Todas as camadas, da gleba ao cartório',
    },
    destrave: {
      layers: LAYERS,
      conflicts: 'open',
      legend: 'Exigências pendentes, em âmbar, a destravar',
    },
  };

  const showService = (key) => {
    if (!servicePlan) return;
    const state = SERVICE_STATES[key];
    if (!state) return;
    LAYERS.forEach((name) => setLayer(servicePlan, name, state.layers.includes(name)));
    servicePlan.conflictGroup.classList.toggle('is-off', state.conflicts === 'off');
    servicePlan.markers.forEach((m) => m.classList.toggle('is-resolved', state.conflicts === 'resolved'));
    const legend = $('#service-legend');
    if (legend) legend.textContent = state.legend;
  };

  if (serviceSvg) {
    servicePlan = buildPlan(serviceSvg, 'service');
    serviceSvg.classList.add('is-drawn'); // sem sequência de entrada: o estado já nasce desenhado
    showService('urbanismo');
  }

  const tabsRoot = $('[data-tabs]');
  if (tabsRoot) {
    const tabs = $$('[role="tab"]', tabsRoot);
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

    const select = (index, focus = false) => {
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      });
      showService(tabs[index].dataset.key);
      if (focus) tabs[index].focus();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i));
      tab.addEventListener('keydown', (e) => {
        const n = tabs.length;
        const map = {
          ArrowDown: (i + 1) % n, ArrowRight: (i + 1) % n,
          ArrowUp: (i - 1 + n) % n, ArrowLeft: (i - 1 + n) % n,
          Home: 0, End: n - 1,
        };
        if (e.key in map) {
          e.preventDefault();
          select(map[e.key], true);
        }
      });
    });

    // "Solicitar análise deste serviço" já seleciona o estágio no formulário
    $$('[data-pick-service]').forEach((a) => {
      a.addEventListener('click', () => {
        const field = $('#f-estagio');
        if (field) field.value = a.dataset.pickService;
      });
    });
  }

  /* ---------- Formulário ---------- */
  const form = $('#form-contato');
  if (form) {
    const feedback = $('#form-feedback');
    const required = ['f-nome', 'f-fone', 'f-estagio'].map((id) => document.getElementById(id));

    // páginas de serviço já chegam com o assunto escolhido
    if (form.dataset.default) form.elements.estagio.value = form.dataset.default;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      feedback.className = 'form__feedback';

      let firstInvalid = null;
      required.forEach((field) => {
        const bad = !field.value.trim();
        field.setAttribute('aria-invalid', String(bad));
        if (bad && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) {
        feedback.classList.add('is-error');
        feedback.textContent = 'Preencha nome, contato e estágio do empreendimento para continuar.';
        firstInvalid.focus();
        return;
      }

      const data = new FormData(form);
      const estagio = form.elements.estagio.selectedOptions[0].textContent;
      const lines = [
        'Olá, vim pelo site e gostaria de solicitar um serviço.',
        '',
        `*Nome:* ${data.get('nome').trim()}`,
        `*Contato:* ${data.get('fone').trim()}`,
        `*Como podemos ajudar:* ${estagio}`,
      ];
      const municipio = data.get('municipio').trim();
      if (municipio) lines.push(`*Município da gleba:* ${municipio}`);
      const message = lines.join('\n');

      if (WHATSAPP) {
        window.open(waUrl(message), '_blank', 'noopener');
        feedback.textContent = 'Abrimos o WhatsApp com a sua mensagem pronta. É só enviar.';
      } else {
        const subject = 'Solicitação de análise de loteamento';
        window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        feedback.textContent = `Abrimos seu e-mail com a mensagem pronta. Se nada abrir, escreva para ${EMAIL}.`;
      }
    });

    form.addEventListener('input', (e) => {
      if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) {
        e.target.setAttribute('aria-invalid', 'false');
      }
    });
  }

  /* ---------- Equipe: bio resumida com "Ler mais" ---------- */
  $$('.member__bio').forEach((bio) => {
    const btn = bio.nextElementSibling;
    if (!btn || !btn.classList.contains('member__more')) return;
    bio.classList.add('is-clamped');
    if (bio.scrollHeight <= bio.clientHeight + 2) { bio.classList.remove('is-clamped'); return; }
    btn.hidden = false;
    btn.addEventListener('click', () => {
      const open = bio.classList.toggle('is-clamped') === false;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Ler menos' : 'Ler mais';
    });
  });

  /* ---------- Rodapé ---------- */
  const year = $('#ano');
  if (year) year.textContent = String(new Date().getFullYear());
})();
