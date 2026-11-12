/* Datos FICTICIOS para el modo demo y las pruebas. No contiene estudiantes reales. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLGDemoData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var N = ['Ana Lucía', 'Camilo', 'Valentina', 'Santiago', 'Mariana', 'Juan Pablo', 'Sara', 'Mateo', 'Luciana', 'Andrés', 'Isabela', 'Samuel'];
  var A = ['Pérez Gómez', 'Rojas Mejía', 'Cano Zapata', 'Ríos Duque', 'Soto Vélez', 'Mora Arias', 'Giraldo Ocampo', 'Ruiz Henao'];
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(d) { var b = new Date(d.getTime() - 5 * 3600e3); return b.getUTCFullYear() + '-' + pad(b.getUTCMonth() + 1) + '-' + pad(b.getUTCDate()) + ' 23:59'; }
  function make(now) {
    now = now || new Date();
    var d1 = new Date(now.getTime() + 3 * 864e5), d2 = new Date(now.getTime() + 5 * 864e5);
    var cfg = [['Clave', 'Valor', 'Descripción'],
      ['clave_acceso', '2026', ''], ['fecha_limite_listas', fmt(d1), ''], ['fecha_limite_votacion', fmt(d2), ''], ['abierto', 'SI', ''],
      ['cupo_deportivo', '5', ''], ['cupo_cultural', '5', ''], ['cupo_inspiracion', '1', ''],
      ['titulo', 'Reconocimientos 24 de noviembre de 2026', ''], ['mensaje_cierre', 'El plazo ha terminado. Si necesitas un cambio, comunícate con coordinación.', '']];
    var grupos = [['Sede', 'Grado', 'Grupo', 'Director(a) registrado', 'Estado', 'Confirmado por', 'Fecha', 'Nota']];
    var defs = [['6°', 1, 'Docente Demo Uno'], ['6°', 2, 'Docente Demo Dos'], ['10°', 1, 'Docente Demo Tres'], ['10°', 2, 'Docente Demo Cuatro'], ['10°', 5, 'Docente Demo Cinco'], ['CAMINAR', 0, 'Docente Demo Seis']];
    var est = [['Grado', 'Grupo', 'Nombre completo']];
    var k = 0;
    defs.forEach(function (g) {
      grupos.push(['Bachillerato', g[0], g[1], g[2], 'Sin confirmar', '', '', '']);
      for (var i = 0; i < 12; i++) { est.push([g[0], g[1], N[(k + i) % N.length] + ' ' + A[(k * 3 + i) % A.length]]); }
      k++;
    });
    function stu(gr, gp, i) { return est.filter(function (r) { return r[0] === gr && r[1] === gp; })[i][2]; }
    var L = [['Grado', 'Grupo', 'Categoría', 'Nombre', 'Evento destacado', 'Condición inicial', 'Origen', 'Actualizado', 'Autor']];
    function add(gr, gp, cat, i, ev, cond) { L.push([gr, gp, cat, stu(gr, gp, i), ev || '', cond || 'Dentro del cupo', 'Inicial', '', '']); }
    add('10°', 1, 'Deportivo', 0, 'Juegos Departamentales — Fase Regional'); add('10°', 1, 'Deportivo', 1); add('10°', 1, 'Deportivo', 2);
    add('10°', 1, 'Cultural', 3, 'Concurso nacional de música — Guitarra'); add('10°', 1, 'Cultural', 4); add('10°', 1, 'Cultural', 5);
    add('10°', 1, 'Cultural', 6); add('10°', 1, 'Cultural', 7); add('10°', 1, 'Cultural', 8, '', 'Excedente');
    add('10°', 1, 'Inspiración', 9);
    add('10°', 2, 'Deportivo', 0); add('10°', 2, 'Cultural', 1); add('10°', 2, 'Inspiración', 2);
    add('10°', 5, 'Inspiración', 4);
    add('6°', 1, 'Deportivo', 1); add('6°', 1, 'Cultural', 2); add('6°', 1, 'Inspiración', 3);
    return {
      Config: cfg, Grupos: grupos, Estudiantes: est, Listas: L,
      Solicitudes: [['Fecha', 'Grado', 'Grupo', 'Director registrado', 'Nombre indicado por quien escribe', 'Comentario', 'Estado', 'Resuelto por', 'Nota']],
      Votos: [['Grado', 'Grupo (quien vota)', 'Candidato', 'Fecha']],
      Envios: [['Fecha', 'Grado', 'Grupo', 'Acción', 'Detalle']]
    };
  }
  return { make: make };
});
