(function () {
  'use strict';
  var CFG = window.SLG_CONFIG || {};
  var qs = new URLSearchParams(location.search);
  var DEMO = qs.has('demo') || !/^https:\/\//.test(CFG.APPS_SCRIPT_URL || '');
  var $app = document.getElementById('app'), $banner = document.getElementById('banner');
  var S = { clave: '', info: null, grupos: [], grado: null, grupo: null, data: null, draft: null, tab: 'Deportivo', autor: '', dirty: false, busy: false, readonly: false };

  /* ---------- utilidades ---------- */
  function h(tag, a) {
    var e = document.createElement(tag); a = a || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    });
    [].slice.call(arguments, 2).forEach(function add(c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) return c.forEach(add);
      e.append(c.nodeType ? c : document.createTextNode(c));
    });
    return e;
  }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (_) {} }
  function toast(m) { var t = document.getElementById('toast'); t.textContent = m; t.className = 'on'; clearTimeout(toast.t); toast.t = setTimeout(function () { t.className = ''; }, 3200); }
  function code(g, p) { return g === 'CAMINAR' ? 'Caminar' : String(parseInt(g, 10) * 100 + parseInt(p, 10)); }
  function gradeLabel(g) { return g === 'CAMINAR' ? 'Caminar' : g; }
  var dfmt = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

  /* ---------- API ---------- */
  var demoCall = null;
  function loadDemo() {
    if (demoCall) return Promise.resolve(demoCall);
    function js(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); }); }
    return js('assets/mock-sheets.js').then(function () { return js('assets/demo-data.js'); })
      .then(function () { return fetch('apps-script/Code.gs').then(function (r) { return r.text(); }); })
      .then(function (code) {
        var KEY = 'slg_demo_db_v1', tables;
        try { tables = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
        if (!tables || qs.has('reset')) tables = SLGDemoData.make(new Date());
        var env = SLGMock.createEnv(tables, { onSave: function (t) { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (_) {} } });
        demoCall = SLGMock.loadEngine(code, env);
        document.getElementById('demo').hidden = false;
        return demoCall;
      });
  }
  function api(method, params) {
    if (DEMO) return loadDemo().then(function (call) { return call(method, params); });
    var req;
    if (method === 'POST') req = fetch(CFG.APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(params) });
    else req = fetch(CFG.APPS_SCRIPT_URL + '?' + new URLSearchParams(params));
    return req.then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.' }; });
  }
  function base(extra) { return Object.assign({ clave: S.clave }, extra || {}); }

  /* ---------- banner de plazo ---------- */
  function paintBanner() {
    var i = S.info; if (!i) { $banner.hidden = true; return; }
    var now = Date.now(), fl = i.fechaListas && new Date(i.fechaListas), fv = i.fechaVotacion && new Date(i.fechaVotacion);
    $banner.className = 'banner'; $banner.hidden = false;
    if (!i.abierto) { $banner.className = 'banner cerrado'; $banner.textContent = 'Cerrado por coordinación. ' + i.mensajeCierre; return; }
    if (i.listasAbierto && fl) {
      var left = fl - now, hrs = left / 36e5;
      if (hrs < 24) $banner.className = 'banner urgente';
      $banner.textContent = 'Plazo para confirmar listas: ' + dfmt.format(fl) + (hrs < 24 ? ' · ¡quedan menos de 24 h!' : '');
    } else if (!i.listasAbierto) {
      $banner.className = 'banner cerrado';
      $banner.textContent = 'El plazo de listas terminó.' + (i.votacionAbierto && fv ? ' La votación de Inspiración sigue abierta hasta ' + dfmt.format(fv) + '.' : ' ' + i.mensajeCierre);
    }
  }
  function applyInfo(info) {
    S.info = info; S.readonly = !info.listasAbierto;
    document.getElementById('titulo').textContent = info.titulo || document.getElementById('titulo').textContent;
    paintBanner();
  }

  /* ---------- pantallas ---------- */
  function view() {
    window.scrollTo(0, 0);
    $app.replaceChildren();
    document.querySelectorAll('.savebar').forEach(function (n) { n.remove(); });
    if (!S.clave) return gate();
    if (!S.grado) return pickGrade();
    if (S.grupo == null) return pickGroup();
    if (!S.autor && !S.skipVerify) return verify();
    return editor();
  }

  function gate() {
    var inp = h('input', { type: 'password', id: 'clave', autocomplete: 'off', inputmode: 'text', placeholder: 'Clave de acceso' });
    var err = h('p', { class: 'err', hidden: true });
    function go() {
      var c = inp.value.trim(); if (!c) return;
      btn.disabled = true; err.hidden = true;
      api('GET', { action: 'grupos', clave: c }).then(function (r) {
        btn.disabled = false;
        if (!r.ok) { err.textContent = r.error; err.hidden = false; return; }
        S.clave = c; store('slg_clave', c); S.grupos = r.grupos; applyInfo(r.info); view();
      });
    }
    var btn = h('button', { class: 'primary', onclick: go }, 'Entrar');
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    $app.append(h('div', { class: 'card sage' },
      h('h2', null, 'Hola, docente 👋'),
      h('p', null, 'Aquí puedes verificar las listas de estudiantes que serán reconocidos el 24 de noviembre (Deportivo y Cultural) y participar en la elección de Inspiración de tu grado.'),
      h('p', { class: 'small muted' }, 'Toma menos de 3 minutos. Escribe la clave que viene en el mensaje de WhatsApp.'),
      h('label', { for: 'clave' }, 'Clave'), inp, err, h('div', { style: 'margin-top:10px' }, btn)));
    api('GET', { action: 'init' }).then(function (r) { if (r.ok) applyInfo(r.info); });
  }

  function pickGrade() {
    var seen = [], order = [];
    S.grupos.forEach(function (g) { if (seen.indexOf(g.grado) < 0) { seen.push(g.grado); order.push(g.grado); } });
    $app.append(h('h2', null, '1. ¿De qué grado eres director(a) de grupo?'),
      h('div', { class: 'chips' }, order.map(function (g) {
        var n = S.grupos.filter(function (x) { return x.grado === g; });
        var ok = n.filter(function (x) { return x.estado === 'Confirmado'; }).length;
        return h('button', { class: 'chip', onclick: function () { S.grado = g; view(); } }, gradeLabel(g), h('small', null, ok + ' de ' + n.length + ' confirmados'));
      })));
  }

  function pickGroup() {
    $app.append(crumb('Grado ' + gradeLabel(S.grado), function () { S.grado = null; view(); }),
      h('h2', null, '2. Elige tu grupo'),
      h('div', { class: 'chips' }, S.grupos.filter(function (g) { return g.grado === S.grado; }).map(function (g) {
        var cls = g.estado === 'Confirmado' ? 'c' : g.estado === 'Cambio solicitado' ? 's' : '';
        return h('button', { class: 'chip gchip', onclick: function () { selectGroup(g); } },
          h('span', null, 'Grupo ' + code(g.grado, g.grupo), h('small', null, g.director)),
          h('span', { class: 'dot ' + cls, title: g.estado }));
      })),
      h('p', { class: 'small muted' }, '● verde: director confirmado · ● amarillo: hay un cambio solicitado'));
  }
  function crumb(text, back) { return h('div', { class: 'crumb' }, h('strong', null, text), h('button', { class: 'ghost', onclick: back }, '← Cambiar')); }

  function selectGroup(g) {
    S.grupo = g.grupo; S.autor = ''; S.skipVerify = false; S.data = null; S.draft = null; S.tab = 'Deportivo'; S.dirty = false;
    $app.replaceChildren(h('p', { class: 'muted center' }, 'Cargando grupo…'));
    api('GET', base({ action: 'datos', grado: g.grado, grupo: g.grupo })).then(function (r) {
      if (!r.ok) { toast(r.error); S.grupo = null; return view(); }
      loadData(r); view();
    });
  }
  function loadData(r) {
    applyInfo(r.info); S.data = r;
    var cp = r.info.cupos;
    function prep(arr) { // destacados primero; los que pasan del cupo se marcan
      var a = arr.map(function (x) { return { nombre: x.nombre, evento: x.evento || '' }; });
      return a.filter(function (x) { return x.evento; }).concat(a.filter(function (x) { return !x.evento; }));
    }
    S.draft = { Deportivo: prep(r.listas.Deportivo), Cultural: prep(r.listas.Cultural), inspiracion: (r.listas['Inspiración'][0] || {}).nombre || '' };
    S.dirty = false;
  }

  function verify() {
    var d = S.data.grupo, nameBox = h('div', { class: 'card sky' },
      h('p', { class: 'small muted' }, 'Grupo ' + code(d.grado, d.grupo) + ' · registrado en la resolución de la institución'),
      h('h2', null, d.director), h('p', null, '¿Eres tú el director o la directora de este grupo?'));
    var form = h('div', { hidden: true });
    var nm = h('input', { type: 'text', id: 'rn', placeholder: 'Tu nombre y apellidos', autocomplete: 'name' });
    var cm = h('textarea', { id: 'rc', placeholder: 'Ej.: Soy el nuevo director de este grupo desde octubre / El director anterior se retiró / El nombre está mal escrito…' });
    var er = h('p', { class: 'err', hidden: true });
    var send = h('button', { class: 'primary', onclick: function () {
      send.disabled = true; er.hidden = true;
      api('POST', base({ action: 'solicitud', grado: d.grado, grupo: d.grupo, nombre: nm.value, comentario: cm.value })).then(function (r) {
        send.disabled = false;
        if (!r.ok) { er.textContent = r.error; er.hidden = false; return; }
        S.autor = nm.value.trim().replace(/\s+/g, ' '); toast('Solicitud enviada. Coordinación la revisará.'); view();
      });
    } }, 'Enviar y continuar');
    form.append(h('p', null, 'Cuéntanos quién eres y qué debe cambiar. Puedes continuar revisando la lista mientras se aprueba.'),
      h('label', { for: 'rn' }, 'Tu nombre'), nm, h('label', { for: 'rc', style: 'margin-top:10px' }, 'Comentario'), cm, er, h('div', { style: 'margin-top:10px' }, send));
    var yes = h('button', { class: 'ok', onclick: function () {
      if (S.readonly) { S.autor = d.director; return view(); }
      yes.disabled = true;
      api('POST', base({ action: 'confirmar', grado: d.grado, grupo: d.grupo })).then(function (r) {
        yes.disabled = false; if (!r.ok) return toast(r.error); S.autor = d.director; view();
      });
    } }, 'Sí, soy yo');
    var no = h('button', { class: 'ghost', onclick: function () {
      if (S.readonly) { S.autor = '(sin confirmar)'; return view(); }
      form.hidden = false; nm.focus();
    } }, 'No soy yo');
    nameBox.append(h('div', { class: 'row' }, yes, no));
    $app.append(crumb('Grupo ' + code(d.grado, d.grupo), function () { S.grupo = null; view(); }), nameBox, form);
  }

  /* ---------- editor ---------- */
  function editor() {
    var d = S.data.grupo, info = S.info, T = ['Deportivo', 'Cultural', 'Inspiración', 'Votación'];
    $app.append(h('div', { class: 'crumb' }, h('strong', null, 'Grupo ' + code(d.grado, d.grupo) + ' · ' + (S.autor || d.director)),
      h('button', { class: 'ghost', onclick: function () { if (!S.dirty || confirm('Tienes cambios sin guardar. ¿Salir?')) { S.grupo = null; view(); } } }, '← Salir')));
    if (S.readonly) $app.append(h('div', { class: 'card rose small' }, 'El plazo de edición terminó: puedes ver las listas' + (info.votacionAbierto ? ' y votar en Inspiración.' : '.')));
    $app.append(h('div', { class: 'tabs', role: 'tablist' }, T.map(function (t) {
      var over = (t === 'Deportivo' || t === 'Cultural') && S.draft[t].length > info.cupos[t];
      var c = (t === 'Deportivo' || t === 'Cultural') ? h('span', { class: 'count' + (over ? ' over' : '') }, S.draft[t].length + '/' + info.cupos[t]) : null;
      return h('button', { class: 'tab' + (S.tab === t ? ' sel' : ''), role: 'tab', onclick: function () { S.tab = t; view(); } }, t === 'Votación' ? 'Votación del grado' : t, c);
    })));
    if (S.tab === 'Deportivo' || S.tab === 'Cultural') listTab(S.tab);
    else if (S.tab === 'Inspiración') inspTab(); else voteTab();
    if (S.tab !== 'Votación' && !S.readonly) saveBar();
  }

  function rosterBox(onPick, exclude, placeholder, allowFree, btnText) {
    var wrap = h('div', { class: 'card' });
    var inp = h('input', { type: 'text', placeholder: placeholder, autocomplete: 'off', 'aria-label': placeholder });
    var sug = h('div', { class: 'sug' });
    var er = h('p', { class: 'err', hidden: true });
    function refresh() {
      var q = norm(inp.value).split(' ').filter(Boolean); sug.replaceChildren();
      if (!q.length) return;
      var ex = exclude().map(norm);
      var m = S.data.estudiantes.filter(function (n) { var k = norm(n); return ex.indexOf(k) < 0 && q.every(function (w) { return k.indexOf(w) >= 0; }); }).slice(0, 6);
      m.forEach(function (n) { sug.append(h('button', { onclick: function () { pick(n); } }, '＋ ' + n)); });
      if (!m.length) sug.append(h('p', { class: 'small muted' }, 'No aparece en la lista de tu grupo.' + (allowFree ? ' Puedes agregarlo escrito a mano con el botón.' : '')));
    }
    function pick(n) { er.hidden = true; var msg = onPick(n.replace(/\s+/g, ' ').trim()); if (msg) { er.textContent = msg; er.hidden = false; } }
    inp.addEventListener('input', refresh);
    wrap.append(h('label', null, 'Buscar en la lista de tu grupo'), h('div', { class: 'row' }, inp, h('button', { style: 'flex:0 0 auto', onclick: function () { if (!inp.value.trim()) return; pick(inp.value); } }, btnText || 'Agregar')), sug, er);
    return wrap;
  }

  function listTab(cat) {
    var cupo = S.info.cupos[cat], arr = S.draft[cat];
    var title = cat === 'Deportivo' ? 'Reconocimiento Deportivo' : 'Reconocimiento Cultural';
    var intro = cat === 'Deportivo' ? 'Estudiantes del grupo destacados en deporte.' : 'Estudiantes del grupo destacados en arte, música, danza, teatro o cultura.';
    $app.append(h('h2', null, title), h('p', { class: 'small muted' }, intro + ' Máximo ' + cupo + ' por grupo. ⭐ = ya tiene un evento destacado y no se puede quitar.'));
    if (!arr.length) $app.append(h('div', { class: 'card small muted' }, 'Aún no hay estudiantes en esta lista.'));
    arr.forEach(function (x, i) {
      var over = i >= cupo;
      $app.append(h('div', { class: 'item' + (x.evento ? ' prio' : '') + (over ? ' over' : '') },
        h('div', { class: 'nm' }, (x.evento ? '⭐ ' : '') + x.nombre,
          x.evento && h('small', { class: 'tag' }, x.evento), over && h('small', { class: 'warn' }, 'Pasa del cupo: quita o reemplaza para poder guardar')),
        !x.evento && !S.readonly && h('button', { class: 'x', 'aria-label': 'Quitar ' + x.nombre, onclick: function () { arr.splice(i, 1); S.dirty = true; view(); } }, 'Quitar')));
    });
    if (!S.readonly) {
      if (arr.length >= cupo) $app.append(h('p', { class: 'small muted' }, 'Cupo completo. Quita a alguien para agregar otro estudiante.'));
      else $app.append(rosterBox(function (n) {
        if (arr.some(function (y) { return norm(y.nombre) === norm(n); })) return 'Ese estudiante ya está en la lista.';
        if (n.length < 5 || n.split(' ').length < 2) return 'Escribe nombre y apellido.';
        arr.push({ nombre: n, evento: '' }); S.dirty = true; view();
      }, function () { return arr.map(function (y) { return y.nombre; }); }, 'Escribe nombre o apellido', true));
    }
    $app.append(h('p', { class: 'small muted' }, '¿Falta alguien con un reconocimiento especial o hay un error en un nombre? Agrégalo/corrígelo aquí; si es un ⭐ que debe cambiar, escribe a coordinación.'));
  }

  function inspTab() {
    var cur = S.draft.inspiracion;
    $app.append(h('h2', null, 'Reconocimiento Inspiración'),
      h('p', { class: 'small muted' }, 'Cada director de grupo propone UN estudiante que inspire a los demás por su ejemplo. Después, los directores del grado eligen a uno en la pestaña “Votación del grado”.'),
      h('div', { class: 'card sage' }, h('p', { class: 'small muted' }, 'Estudiante propuesto por el grupo ' + code(S.data.grupo.grado, S.data.grupo.grupo)),
        cur ? h('div', { class: 'item' }, h('div', { class: 'nm' }, cur), !S.readonly && h('button', { class: 'x', onclick: function () { S.draft.inspiracion = ''; S.dirty = true; view(); } }, 'Quitar'))
          : h('p', null, 'Todavía no hay propuesta.')));
    if (!S.readonly && !cur) $app.append(rosterBox(function (n) {
      if (n.length < 5 || n.split(' ').length < 2) return 'Escribe nombre y apellido.';
      S.draft.inspiracion = n; S.dirty = true; view();
    }, function () { return []; }, 'Escribe nombre o apellido', true, 'Proponer'));
    if (!S.readonly && cur) $app.append(h('p', { class: 'small muted' }, 'Para cambiar la propuesta, primero quita al estudiante actual.'));
  }

  function voteTab() {
    var ins = S.data.inspiracion, i = S.info, open = i.votacionAbierto, sel = ins.miVoto;
    var total = ins.propuestas.reduce(function (a, p) { return a + p.votos; }, 0), max = Math.max.apply(null, [1].concat(ins.propuestas.map(function (p) { return p.votos; })));
    $app.append(h('h2', null, 'Elección de Inspiración · grado ' + gradeLabel(S.grado)),
      h('p', { class: 'small muted' }, 'Solo uno de los estudiantes propuestos representará al grado. Cada grupo emite UN voto (el del director o directora); puedes cambiarlo hasta el cierre' + (i.fechaVotacion ? ' (' + dfmt.format(new Date(i.fechaVotacion)) + ')' : '') + '.'));
    if (S.dirty) $app.append(h('div', { class: 'card rose small' }, 'Tienes cambios sin guardar en las listas. Guárdalos antes: si cambias la propuesta de tu grupo, los votos de ese estudiante se anulan.'));
    if (!ins.propuestas.length) { $app.append(h('div', { class: 'card muted' }, 'Aún no hay propuestas en este grado.')); return; }
    var chosen = sel, btn;
    ins.propuestas.forEach(function (p) {
      var r = h('input', { type: 'radio', name: 'v', disabled: !open, checked: norm(p.nombre) === norm(sel), onchange: function () { chosen = p.nombre; btn && (btn.disabled = false); } });
      $app.append(h('label', { class: 'opt' + (norm(p.nombre) === norm(sel) ? ' sel' : '') }, r,
        h('div', { style: 'flex:1' }, h('strong', null, p.nombre), h('div', { class: 'small muted' }, 'Propone el grupo ' + code(S.grado, p.grupo) + (p.director ? ' · ' + p.director : '')),
          h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(p.votos / max * 100) + '%' })), h('div', { class: 'small' }, p.votos + (p.votos === 1 ? ' voto' : ' votos')))));
    });
    $app.append(h('p', { class: 'small muted' }, 'Han votado ' + ins.votaron + ' de ' + ins.totalGrupos + ' grupos' + (total ? '.' : ' — aún nadie.')));
    var er = h('p', { class: 'err', hidden: true });
    btn = h('button', { class: 'primary', disabled: true, onclick: function () {
      btn.disabled = true;
      api('POST', base({ action: 'votar', grado: S.data.grupo.grado, grupo: S.data.grupo.grupo, candidato: chosen })).then(function (r) {
        if (!r.ok) { er.textContent = r.error; er.hidden = false; btn.disabled = false; return; }
        toast('Voto del grupo ' + code(S.grado, S.grupo) + ' registrado ✔');
        api('GET', base({ action: 'datos', grado: S.grado, grupo: S.grupo })).then(function (d) { if (d.ok) { var keep = S.draft, dirty = S.dirty; loadData(d); S.draft = keep; S.dirty = dirty; } view(); });
      });
    } }, sel ? 'Cambiar el voto de mi grupo' : 'Votar por el grupo ' + code(S.grado, S.grupo));
    if (open) $app.append(er, btn); else $app.append(h('div', { class: 'card rose small' }, 'La votación ya cerró.'));
  }

  function saveBar() {
    var cp = S.info.cupos, over = ['Deportivo', 'Cultural'].filter(function (c) { return S.draft[c].length > cp[c]; });
    var btn = h('button', { class: 'primary', disabled: !S.dirty || over.length > 0, onclick: save }, 'Guardar y enviar');
    var msg = over.length ? 'Ajusta ' + over.join(' y ') + ' al cupo para guardar.' : S.dirty ? 'Tienes cambios sin guardar.' : 'Todo guardado ✔';
    document.body.append(h('div', { class: 'savebar' }, h('div', { class: 'in' }, h('div', { class: 'msg' }, msg), btn)));
    function save() {
      btn.disabled = true; btn.textContent = 'Guardando…';
      api('POST', base({ action: 'guardar', grado: S.data.grupo.grado, grupo: S.data.grupo.grupo, autor: S.autor === '(sin confirmar)' ? '' : S.autor, Deportivo: S.draft.Deportivo, Cultural: S.draft.Cultural, inspiracion: S.draft.inspiracion })).then(function (r) {
        if (!r.ok) { toast(r.error); return view(); }
        toast('¡Listo! Guardado. Gracias.');
        api('GET', base({ action: 'datos', grado: S.grado, grupo: S.grupo })).then(function (d) { if (d.ok) loadData(d); view(); });
      });
    }
  }
  window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- arranque ---------- */
  var saved = store('slg_clave');
  if (saved) {
    api('GET', { action: 'grupos', clave: saved }).then(function (r) {
      if (r.ok) { S.clave = saved; S.grupos = r.grupos; applyInfo(r.info); }
      view();
    });
  } else view();
  window.SLG = { state: S, view: view };
})();
