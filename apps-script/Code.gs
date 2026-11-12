/**
 * SLG · Reconocimientos 2026 — API (Google Apps Script enlazado a la hoja de cálculo)
 *
 * Hojas requeridas: Config, Grupos, Estudiantes, Listas, Solicitudes, Votos, Envios
 * Lecturas por GET, escrituras por POST (Content-Type: text/plain para evitar preflight CORS).
 * Todo (excepto "init") exige la clave de acceso guardada en Config.
 */
var TZ_ = 'America/Bogota';
var CATS_ = ['Deportivo', 'Cultural', 'Inspiración'];
var LISTAS_COLS_ = ['Grado', 'Grupo', 'Categoría', 'Nombre', 'Evento destacado', 'Condición inicial', 'Origen', 'Actualizado', 'Autor'];

/* ---------- Entradas web ---------- */
function doGet(e) { return respond_(e && e.parameter ? e.parameter : {}, 'GET'); }

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (_) { return out_({ ok: false, error: 'Solicitud inválida' }); }
  return respond_(b, 'POST');
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function respond_(p, method) {
  try { return out_(route_(p, method)); }
  catch (err) { return out_({ ok: false, error: String((err && err.message) || err) }); }
}

function route_(p, method) {
  var a = String(p.action || '');
  var cfg = readConfig_();
  if (a === 'init') return { ok: true, info: info_(cfg) };
  if (String(p.clave == null ? '' : p.clave).trim() !== String(cfg.clave_acceso == null ? '' : cfg.clave_acceso).trim()) {
    throw new Error('Clave incorrecta');
  }
  if (a === 'grupos') return { ok: true, info: info_(cfg), grupos: grupos_() };
  if (a === 'datos') return datos_(p, cfg);
  if (method !== 'POST') throw new Error('Acción no permitida');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (a === 'confirmar') return confirmar_(p, cfg);
    if (a === 'solicitud') return solicitud_(p, cfg);
    if (a === 'guardar') return guardar_(p, cfg);
    if (a === 'votar') return votar_(p, cfg);
    throw new Error('Acción desconocida');
  } finally { lock.releaseLock(); }
}

/* ---------- Utilidades ---------- */
function norm_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Quita caracteres de control y signos que Sheets interpretaría como fórmula.
function clean_(s, max) {
  s = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[=+\-@]+/, '').trim();
  if (max && s.length > max) throw new Error('Texto demasiado largo (máximo ' + max + ' caracteres)');
  return s;
}

function stamp_() { return Utilities.formatDate(new Date(), TZ_, 'yyyy-MM-dd HH:mm:ss'); }

// Acepta Date (Sheets convierte el texto) o texto "AAAA-MM-DD[ HH:MM]" / "DD/MM/AAAA[ HH:MM]" en hora de Colombia (UTC-5).
function parseDate_(v) {
  if (v == null || v === '') return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v;
  var s = String(v).trim(), m;
  var y, mo, d, h = 23, mi = 59;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/))) { y = +m[1]; mo = +m[2]; d = +m[3]; if (m[4] != null) { h = +m[4]; mi = +m[5]; } }
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (m[4] != null) { h = +m[4]; mi = +m[5]; } }
  else return null;
  return new Date(Date.UTC(y, mo - 1, d, h + 5, mi, 59));
}

function num_(v, def) { var n = parseInt(v, 10); return isNaN(n) ? def : n; }

function readTable_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Falta la hoja "' + name + '"');
  var v = sh.getDataRange().getValues();
  var head = v[0] || [];
  var rows = [];
  for (var i = 1; i < v.length; i++) {
    var empty = true;
    for (var j = 0; j < v[i].length; j++) { if (String(v[i][j]).trim() !== '') { empty = false; break; } }
    if (!empty) rows.push({ _row: i + 1, _v: v[i] });
  }
  return {
    sh: sh, head: head, rows: rows,
    idx: function (n) { var k = head.indexOf(n); if (k < 0) throw new Error('Falta la columna "' + n + '" en ' + name); return k; },
    get: function (r, n) { return r._v[this.idx(n)]; }
  };
}

function readConfig_() {
  var t = readTable_('Config'), c = {};
  t.rows.forEach(function (r) { c[String(r._v[0]).trim()] = r._v[1]; });
  return c;
}

function info_(cfg) {
  var now = new Date();
  var abierto = String(cfg.abierto == null ? 'SI' : cfg.abierto).trim().toUpperCase() !== 'NO';
  var fl = parseDate_(cfg.fecha_limite_listas), fv = parseDate_(cfg.fecha_limite_votacion);
  return {
    titulo: String(cfg.titulo || 'Reconocimientos'),
    abierto: abierto,
    listasAbierto: abierto && (!fl || now.getTime() <= fl.getTime()),
    votacionAbierto: abierto && (!fv || now.getTime() <= fv.getTime()),
    fechaListas: fl ? fl.toISOString() : null,
    fechaVotacion: fv ? fv.toISOString() : null,
    mensajeCierre: String(cfg.mensaje_cierre || 'El plazo ha terminado.'),
    cupos: {
      'Deportivo': num_(cfg.cupo_deportivo, 5),
      'Cultural': num_(cfg.cupo_cultural, 5),
      'Inspiración': num_(cfg.cupo_inspiracion, 1)
    },
    ahora: now.toISOString()
  };
}

function grupos_() {
  var t = readTable_('Grupos');
  return t.rows.map(function (r) {
    return {
      grado: String(t.get(r, 'Grado')).trim(), grupo: String(t.get(r, 'Grupo')).trim(),
      director: String(t.get(r, 'Director(a) registrado')).trim(), estado: String(t.get(r, 'Estado')).trim()
    };
  });
}

function findGroup_(p) {
  var t = readTable_('Grupos');
  var g = String(p.grado == null ? '' : p.grado).trim(), gp = String(p.grupo == null ? '' : p.grupo).trim();
  for (var i = 0; i < t.rows.length; i++) {
    var r = t.rows[i];
    if (String(t.get(r, 'Grado')).trim() === g && String(t.get(r, 'Grupo')).trim() === gp) {
      return { t: t, row: r, grado: g, grupo: gp, director: String(t.get(r, 'Director(a) registrado')).trim() };
    }
  }
  throw new Error('Grupo no encontrado');
}

function setGroupFields_(g, fields) {
  var row = g.row._v.slice();
  Object.keys(fields).forEach(function (k) { row[g.t.idx(k)] = fields[k]; });
  g.t.sh.getRange(g.row._row, 1, 1, row.length).setValues([row]);
}

function log_(grado, grupo, accion, detalle) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Envios').appendRow([stamp_(), grado, grupo, accion, String(detalle).slice(0, 2000)]);
}

/* ---------- Lectura de un grupo ---------- */
function datos_(p, cfg) {
  var info = info_(cfg);
  var g = findGroup_(p);
  var lt = readTable_('Listas');
  var listas = { 'Deportivo': [], 'Cultural': [], 'Inspiración': [] };
  var props = [];
  lt.rows.forEach(function (r) {
    if (String(lt.get(r, 'Grado')).trim() !== g.grado) return;
    var gp = String(lt.get(r, 'Grupo')).trim(), cat = String(lt.get(r, 'Categoría')).trim();
    var item = { nombre: String(lt.get(r, 'Nombre')).trim(), evento: String(lt.get(r, 'Evento destacado') || '').trim() };
    if (cat === 'Inspiración') props.push({ grupo: gp, nombre: item.nombre });
    if (gp === g.grupo && listas[cat]) listas[cat].push(item);
  });

  var all = grupos_().filter(function (x) { return x.grado === g.grado; });
  var dir = {}, estado = {};
  all.forEach(function (x) { dir[x.grupo] = x.director; estado[x.grupo] = x.estado; });

  var vt = readTable_('Votos'), voto = {};
  vt.rows.forEach(function (r) {
    if (String(vt.get(r, 'Grado')).trim() === g.grado) voto[String(vt.get(r, 'Grupo (quien vota)')).trim()] = String(vt.get(r, 'Candidato')).trim();
  });
  var cuenta = {}, votaron = 0, miVoto = '';
  Object.keys(voto).forEach(function (gp) {
    var cand = props.filter(function (x) { return norm_(x.nombre) === norm_(voto[gp]); })[0];
    if (!cand) return;
    cuenta[norm_(cand.nombre)] = (cuenta[norm_(cand.nombre)] || 0) + 1;
    votaron++;
    if (gp === g.grupo) miVoto = cand.nombre;
  });
  props.sort(function (a, b) { return (+a.grupo) - (+b.grupo); });

  var et = readTable_('Estudiantes'), est = [];
  et.rows.forEach(function (r) {
    if (String(et.get(r, 'Grado')).trim() === g.grado && String(et.get(r, 'Grupo')).trim() === g.grupo) est.push(String(et.get(r, 'Nombre completo')).trim());
  });

  var st = readTable_('Solicitudes'), pend = 0;
  st.rows.forEach(function (r) {
    if (String(st.get(r, 'Grado')).trim() === g.grado && String(st.get(r, 'Grupo')).trim() === g.grupo && String(st.get(r, 'Estado')).trim() === 'Pendiente') pend++;
  });

  return {
    ok: true, info: info,
    grupo: { grado: g.grado, grupo: g.grupo, director: g.director, estado: estado[g.grupo] },
    listas: listas, estudiantes: est,
    inspiracion: {
      propuestas: props.map(function (x) {
        return { grupo: x.grupo, director: dir[x.grupo] || '', nombre: x.nombre, votos: cuenta[norm_(x.nombre)] || 0 };
      }),
      votaron: votaron, totalGrupos: all.length, miVoto: miVoto
    },
    solicitudesPendientes: pend
  };
}

/* ---------- Escrituras ---------- */
function confirmar_(p, cfg) {
  var info = info_(cfg);
  if (!info.listasAbierto) throw new Error(info.mensajeCierre);
  var g = findGroup_(p);
  setGroupFields_(g, { 'Estado': 'Confirmado', 'Confirmado por': g.director, 'Fecha': stamp_() });
  log_(g.grado, g.grupo, 'confirmar', 'Director confirmado: ' + g.director);
  return { ok: true };
}

function solicitud_(p, cfg) {
  var info = info_(cfg);
  if (!info.listasAbierto) throw new Error(info.mensajeCierre);
  var g = findGroup_(p);
  var nombre = clean_(p.nombre, 80), com = clean_(p.comentario, 500);
  if (nombre.length < 5) throw new Error('Escribe tu nombre completo');
  if (com.length < 3) throw new Error('Escribe un comentario');
  var st = readTable_('Solicitudes'), pend = 0;
  st.rows.forEach(function (r) {
    if (String(st.get(r, 'Grado')).trim() === g.grado && String(st.get(r, 'Grupo')).trim() === g.grupo && String(st.get(r, 'Estado')).trim() === 'Pendiente') pend++;
  });
  if (pend >= 10) throw new Error('Este grupo ya tiene muchas solicitudes pendientes. Escribe a coordinación.');
  st.sh.appendRow([stamp_(), g.grado, g.grupo, g.director, nombre, com, 'Pendiente', '', '']);
  setGroupFields_(g, { 'Estado': 'Cambio solicitado' });
  log_(g.grado, g.grupo, 'solicitud', nombre + ': ' + com);
  return { ok: true };
}

function guardar_(p, cfg) {
  var info = info_(cfg);
  if (!info.listasAbierto) throw new Error(info.mensajeCierre);
  var g = findGroup_(p);
  var autor = clean_(p.autor, 80) || g.director;

  var lt = readTable_('Listas');
  var ncol = lt.head.length;
  var existing = { 'Deportivo': [], 'Cultural': [], 'Inspiración': [] };
  lt.rows.forEach(function (r) {
    if (String(lt.get(r, 'Grado')).trim() !== g.grado || String(lt.get(r, 'Grupo')).trim() !== g.grupo) return;
    var cat = String(lt.get(r, 'Categoría')).trim();
    if (existing[cat]) existing[cat].push({
      nombre: String(lt.get(r, 'Nombre')).trim(), evento: String(lt.get(r, 'Evento destacado') || '').trim(),
      origen: String(lt.get(r, 'Origen') || '').trim()
    });
  });
  function prev(cat, nombre) { return existing[cat].filter(function (x) { return norm_(x.nombre) === norm_(nombre); })[0]; }

  var nuevo = {};
  ['Deportivo', 'Cultural'].forEach(function (cat) {
    var arr = p[cat];
    if (!Array.isArray(arr)) throw new Error('Falta la lista de ' + cat);
    var seen = {}, out = [];
    arr.forEach(function (it) {
      var nom = clean_(typeof it === 'string' ? it : (it && it.nombre), 80);
      if (!nom) return;
      var k = norm_(nom);
      if (seen[k]) throw new Error('"' + nom + '" está repetido en ' + cat);
      seen[k] = 1;
      var ex = prev(cat, nom);
      out.push({ nombre: ex ? ex.nombre : nom, evento: ex ? ex.evento : '', origen: ex ? ex.origen : 'Docente' });
    });
    existing[cat].forEach(function (ex) {
      if (ex.evento && !seen[norm_(ex.nombre)]) {
        throw new Error('No se puede quitar a ' + ex.nombre + ' (' + ex.evento + '): es un estudiante destacado. Si hay un error, envía una solicitud.');
      }
    });
    if (out.length > info.cupos[cat]) throw new Error(cat + ': máximo ' + info.cupos[cat] + ' estudiantes (enviaste ' + out.length + ')');
    nuevo[cat] = out;
  });
  var insp = clean_(p.inspiracion, 80);
  var exI = insp ? prev('Inspiración', insp) : null;
  nuevo['Inspiración'] = insp ? [{ nombre: exI ? exI.nombre : insp, evento: '', origen: exI ? exI.origen : 'Docente' }] : [];

  var keep = lt.rows.map(function (r) { return r._v; }).filter(function (v) {
    var same = String(v[lt.idx('Grado')]).trim() === g.grado && String(v[lt.idx('Grupo')]).trim() === g.grupo;
    return !(same && CATS_.indexOf(String(v[lt.idx('Categoría')]).trim()) >= 0);
  });
  var ts = stamp_(), added = [];
  CATS_.forEach(function (cat) {
    nuevo[cat].forEach(function (x) {
      var row = new Array(ncol);
      for (var i = 0; i < ncol; i++) row[i] = '';
      row[lt.idx('Grado')] = g.grado; row[lt.idx('Grupo')] = Number(g.grupo);
      row[lt.idx('Categoría')] = cat; row[lt.idx('Nombre')] = x.nombre; row[lt.idx('Evento destacado')] = x.evento;
      row[lt.idx('Condición inicial')] = 'Dentro del cupo'; row[lt.idx('Origen')] = x.origen;
      row[lt.idx('Actualizado')] = ts; row[lt.idx('Autor')] = autor;
      added.push(row);
    });
  });
  var all = keep.concat(added);
  var sh = lt.sh, last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, ncol).clearContent();
  if (all.length) sh.getRange(2, 1, all.length, ncol).setValues(all);
  log_(g.grado, g.grupo, 'guardar', autor + ' | D=' + nuevo['Deportivo'].map(function (x) { return x.nombre; }).join('; ') +
    ' | C=' + nuevo['Cultural'].map(function (x) { return x.nombre; }).join('; ') + ' | I=' + insp);
  return { ok: true };
}

function votar_(p, cfg) {
  var info = info_(cfg);
  if (!info.votacionAbierto) throw new Error('La votación ya cerró.');
  var g = findGroup_(p);
  var cand = clean_(p.candidato, 80);
  var lt = readTable_('Listas'), nombre = null;
  lt.rows.forEach(function (r) {
    if (String(lt.get(r, 'Grado')).trim() === g.grado && String(lt.get(r, 'Categoría')).trim() === 'Inspiración' &&
      norm_(lt.get(r, 'Nombre')) === norm_(cand)) nombre = String(lt.get(r, 'Nombre')).trim();
  });
  if (!nombre) throw new Error('Ese estudiante no está entre los propuestos del grado');
  var vt = readTable_('Votos'), found = null;
  vt.rows.forEach(function (r) {
    if (String(vt.get(r, 'Grado')).trim() === g.grado && String(vt.get(r, 'Grupo (quien vota)')).trim() === g.grupo) found = r;
  });
  var row = [g.grado, Number(g.grupo), nombre, stamp_()];
  if (found) vt.sh.getRange(found._row, 1, 1, 4).setValues([row]); else vt.sh.appendRow(row);
  log_(g.grado, g.grupo, 'votar', nombre);
  return { ok: true };
}
