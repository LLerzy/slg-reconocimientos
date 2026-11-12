// Ejecutar: node tests/backend.test.js   (prueba Code.gs contra un simulador de Sheets)
const fs = require('fs'), path = require('path'), assert = require('assert');
const { createEnv, loadEngine } = require('../assets/mock-sheets.js');
const { make } = require('../assets/demo-data.js');
const code = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');
const NOW = '2026-11-11T15:00:00Z';
function boot(mut, now) {
  const t = make(new Date(NOW)); if (mut) mut(t);
  const env = createEnv(t, { now: now || NOW });
  return { t, call: loadEngine(code, env) };
}
const K = { clave: '2026' };
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };
const bad = (r, re) => { assert.strictEqual(r.ok, false, JSON.stringify(r)); assert.match(r.error, re); };

ok('init es público y calcula plazos', () => {
  const { call } = boot(); const r = call('GET', { action: 'init' });
  assert(r.ok && r.info.listasAbierto && r.info.votacionAbierto); assert.strictEqual(r.info.cupos.Cultural, 5);
});
ok('clave incorrecta se rechaza', () => { const { call } = boot(); bad(call('GET', { action: 'grupos', clave: '1111' }), /Clave/); bad(call('GET', { action: 'grupos' }), /Clave/); });
ok('lecturas no escriben y escrituras exigen POST', () => { const { call } = boot(); bad(call('GET', { action: 'guardar', ...K }), /no permitida/); });
ok('grupos devuelve los 6 grupos', () => { const { call } = boot(); assert.strictEqual(call('GET', { action: 'grupos', ...K }).grupos.length, 6); });
ok('datos del 10°1: listas, evento y roster', () => {
  const { call } = boot(); const r = call('GET', { action: 'datos', ...K, grado: '10°', grupo: '1' });
  assert.strictEqual(r.listas.Cultural.length, 6); assert.strictEqual(r.listas.Deportivo[0].evento.startsWith('Juegos'), true);
  assert.strictEqual(r.estudiantes.length, 12); assert.strictEqual(r.inspiracion.propuestas.length, 3); assert.strictEqual(r.inspiracion.totalGrupos, 3);
});
ok('10°1 tiene 6 en Cultural (1 excedente): guardar con 6 falla, con 5 pasa', () => {
  const { call } = boot(); const d = call('GET', { action: 'datos', ...K, grado: '10°', grupo: '1' });
  const D = d.listas.Deportivo, C = d.listas.Cultural, I = d.listas['Inspiración'][0].nombre;
  bad(call('POST', { action: 'guardar', ...K, grado: '10°', grupo: '1', Deportivo: D, Cultural: C, inspiracion: I }), /máximo 5/);
  const r = call('POST', { action: 'guardar', ...K, grado: '10°', grupo: '1', Deportivo: D, Cultural: C.slice(0, 5), inspiracion: I, autor: 'Docente Demo Tres' });
  assert(r.ok, JSON.stringify(r));
  const d2 = call('GET', { action: 'datos', ...K, grado: '10°', grupo: '1' }); assert.strictEqual(d2.listas.Cultural.length, 5);
});
ok('no se puede quitar a un estudiante destacado', () => {
  const { call } = boot(); const d = call('GET', { action: 'datos', ...K, grado: '10°', grupo: '1' });
  bad(call('POST', { action: 'guardar', ...K, grado: '10°', grupo: '1', Deportivo: d.listas.Deportivo.slice(1), Cultural: d.listas.Cultural.slice(0, 5), inspiracion: '' }), /destacado/);
  bad(call('POST', { action: 'guardar', ...K, grado: '10°', grupo: '1', Deportivo: d.listas.Deportivo, Cultural: d.listas.Cultural.slice(1), inspiracion: '' }), /destacado/);
});
ok('el cliente no puede inventar un evento destacado', () => {
  const { call } = boot(); const d = call('GET', { action: 'datos', ...K, grado: '10°', grupo: '2' });
  call('POST', { action: 'guardar', ...K, grado: '10°', grupo: '2', Deportivo: [{ nombre: 'Nuevo Estudiante', evento: 'Falso' }], Cultural: [], inspiracion: '' });
  const r = call('GET', { action: 'datos', ...K, grado: '10°', grupo: '2' }); assert.strictEqual(r.listas.Deportivo[0].evento, '');
});
ok('repetidos (sin importar tildes/mayúsculas) se rechazan; entre categorías sí se permiten', () => {
  const { call } = boot();
  bad(call('POST', { action: 'guardar', ...K, grado: '10°', grupo: '2', Deportivo: ['Ana Lucia', 'ANA LUCÍA'], Cultural: [], inspiracion: '' }), /repetido/);
  assert(call('POST', { action: 'guardar', ...K, grado: '10°', grupo: '2', Deportivo: ['Ana Lucía'], Cultural: ['Ana Lucía'], inspiracion: '' }).ok);
});
ok('guardar solo toca el grupo indicado y conserva el resto', () => {
  const { call, t } = boot(); const antes = t.Listas.filter(r => r[1] === 5).length;
  call('POST', { action: 'guardar', ...K, grado: '10°', grupo: '2', Deportivo: ['X Y Z'], Cultural: [], inspiracion: 'Q R S' });
  assert.strictEqual(t.Listas.filter(r => r[1] === 5).length, antes);
  assert(t.Listas.some(r => r[3] === 'Q R S' && r[8] === 'Docente Demo Cuatro'));
});
ok('fórmulas inyectadas se neutralizan', () => {
  const { call, t } = boot(); call('POST', { action: 'guardar', ...K, grado: '10°', grupo: '2', Deportivo: ['=HYPERLINK("x")'], Cultural: [], inspiracion: '' });
  assert(t.Listas.every(r => !String(r[3]).startsWith('=')));
});
ok('confirmar director cambia el estado', () => {
  const { call, t } = boot(); assert(call('POST', { action: 'confirmar', ...K, grado: '10°', grupo: '1' }).ok);
  const row = t.Grupos.find(r => r[1] === '10°' && r[2] === 1); assert.strictEqual(row[4], 'Confirmado'); assert.strictEqual(row[5], 'Docente Demo Tres');
});
ok('solicitud de cambio queda registrada y marca el grupo', () => {
  const { call, t } = boot();
  bad(call('POST', { action: 'solicitud', ...K, grado: '10°', grupo: '1', nombre: 'A', comentario: 'x' }), /nombre/);
  assert(call('POST', { action: 'solicitud', ...K, grado: '10°', grupo: '1', nombre: 'Marta Elena Ríos', comentario: 'Yo soy la nueva directora' }).ok);
  assert.strictEqual(t.Solicitudes.length, 2); assert.strictEqual(t.Solicitudes[1][6], 'Pendiente');
  assert.strictEqual(t.Grupos.find(r => r[1] === '10°' && r[2] === 1)[4], 'Cambio solicitado');
  assert.strictEqual(call('GET', { action: 'datos', ...K, grado: '10°', grupo: '1' }).solicitudesPendientes, 1);
});
ok('votación: un voto por grupo (el último vale), solo propuestos', () => {
  const { call } = boot(); const p = call('GET', { action: 'datos', ...K, grado: '10°', grupo: '1' }).inspiracion.propuestas;
  bad(call('POST', { action: 'votar', ...K, grado: '10°', grupo: '1', candidato: 'Nadie Conocido' }), /propuestos/);
  assert(call('POST', { action: 'votar', ...K, grado: '10°', grupo: '1', candidato: p[0].nombre }).ok);
  assert(call('POST', { action: 'votar', ...K, grado: '10°', grupo: '2', candidato: p[0].nombre }).ok);
  assert(call('POST', { action: 'votar', ...K, grado: '10°', grupo: '1', candidato: p[1].nombre.toUpperCase() }).ok);
  const r = call('GET', { action: 'datos', ...K, grado: '10°', grupo: '1' }).inspiracion;
  assert.strictEqual(r.votaron, 2); assert.strictEqual(r.miVoto, p[1].nombre);
  assert.strictEqual(r.propuestas.find(x => x.nombre === p[0].nombre).votos, 1); assert.strictEqual(r.propuestas.find(x => x.nombre === p[1].nombre).votos, 1);
});
ok('el voto no cuenta si se cambia la propuesta', () => {
  const { call } = boot(); const p = call('GET', { action: 'datos', ...K, grado: '10°', grupo: '1' }).inspiracion.propuestas;
  call('POST', { action: 'votar', ...K, grado: '10°', grupo: '2', candidato: p[0].nombre });
  const d = call('GET', { action: 'datos', ...K, grado: '10°', grupo: '1' });
  call('POST', { action: 'guardar', ...K, grado: '10°', grupo: '1', Deportivo: d.listas.Deportivo, Cultural: d.listas.Cultural.slice(0, 5), inspiracion: 'Otra Persona Nueva' });
  assert.strictEqual(call('GET', { action: 'datos', ...K, grado: '10°', grupo: '2' }).inspiracion.votaron, 0);
});
ok('después del plazo de listas: no se guarda, pero la votación sigue abierta', () => {
  const { call } = boot(null, '2026-11-15T12:00:00Z'); // listas cierran 14-nov 23:59, votación 16-nov 23:59
  const i = call('GET', { action: 'init' }).info; assert.strictEqual(i.listasAbierto, false); assert.strictEqual(i.votacionAbierto, true);
  bad(call('POST', { action: 'guardar', ...K, grado: '10°', grupo: '2', Deportivo: [], Cultural: [], inspiracion: '' }), /plazo/);
  bad(call('POST', { action: 'confirmar', ...K, grado: '10°', grupo: '2' }), /plazo/);
  const p = call('GET', { action: 'datos', ...K, grado: '10°', grupo: '1' }).inspiracion.propuestas;
  assert(call('POST', { action: 'votar', ...K, grado: '10°', grupo: '1', candidato: p[0].nombre }).ok);
});
ok('después de ambos plazos todo cierra; "abierto = NO" cierra de inmediato', () => {
  const a = boot(null, '2026-11-20T12:00:00Z').call; const p = a('GET', { action: 'datos', ...K, grado: '10°', grupo: '1' }).inspiracion.propuestas;
  bad(a('POST', { action: 'votar', ...K, grado: '10°', grupo: '1', candidato: p[0].nombre }), /cerró/);
  const b = boot(t => { t.Config.find(r => r[0] === 'abierto')[1] = 'NO'; }).call; assert.strictEqual(b('GET', { action: 'init' }).info.listasAbierto, false);
});
ok('la fecha límite puede venir como Date (Sheets) o como texto dd/mm/aaaa', () => {
  const a = boot(t => { t.Config.find(r => r[0] === 'fecha_limite_listas')[1] = new Date('2026-11-12T04:59:59Z'); }, '2026-11-12T05:30:00Z').call;
  assert.strictEqual(a('GET', { action: 'init' }).info.listasAbierto, false);
  const b = boot(t => { t.Config.find(r => r[0] === 'fecha_limite_listas')[1] = '13/11/2026'; }, '2026-11-14T04:30:00Z').call;
  assert.strictEqual(b('GET', { action: 'init' }).info.listasAbierto, true); // 13-nov 23:59 Bogotá = 14-nov 04:59 UTC
  const c = boot(t => { t.Config.find(r => r[0] === 'fecha_limite_listas')[1] = '13/11/2026'; }, '2026-11-14T05:30:00Z').call;
  assert.strictEqual(c('GET', { action: 'init' }).info.listasAbierto, false);
});
console.log(`\n${n} pruebas OK`);
