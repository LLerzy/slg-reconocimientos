/* Simulador mínimo de Google Sheets/Apps Script.
 * Sirve para (1) probar Code.gs en Node y (2) el MODO DEMO del navegador. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLGMock = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function createEnv(tables, opts) {
    opts = opts || {};
    function save() { if (opts.onSave) opts.onSave(tables); }
    function trim(name) {
      var t = tables[name];
      while (t.length > 1 && t[t.length - 1].every(function (c) { return c === '' || c == null; })) t.pop();
    }
    function Sheet(name) {
      return {
        getLastRow: function () { return tables[name].length; },
        getDataRange: function () { return { getValues: function () { return tables[name].map(function (r) { return r.slice(); }); } }; },
        appendRow: function (r) { tables[name].push(r.slice()); save(); },
        getRange: function (r, c, nr, nc) {
          return {
            getValues: function () {
              var o = [];
              for (var i = 0; i < nr; i++) o.push((tables[name][r - 1 + i] || []).slice(c - 1, c - 1 + nc));
              return o;
            },
            setValues: function (v) {
              for (var i = 0; i < v.length; i++) {
                while (tables[name].length < r + i) tables[name].push([]);
                var row = tables[name][r - 1 + i];
                for (var j = 0; j < v[i].length; j++) row[c - 1 + j] = v[i][j];
              }
              save();
            },
            clearContent: function () {
              for (var i = 0; i < nr; i++) for (var j = 0; j < nc; j++) if (tables[name][r - 1 + i]) tables[name][r - 1 + i][c - 1 + j] = '';
              trim(name); save();
            }
          };
        }
      };
    }
    var fixed = opts.now ? new Date(opts.now) : null;
    function FakeDate() {
      var a = arguments;
      if (!a.length) return fixed ? new Date(fixed.getTime()) : new Date();
      return new (Function.prototype.bind.apply(Date, [null].concat([].slice.call(a))))();
    }
    FakeDate.UTC = Date.UTC; FakeDate.now = function () { return (fixed || new Date()).getTime(); };
    FakeDate.prototype = Date.prototype;
    return {
      SpreadsheetApp: { getActiveSpreadsheet: function () { return { getSheetByName: function (n) { return tables[n] ? Sheet(n) : null; } }; } },
      ContentService: {
        MimeType: { JSON: 'json' },
        createTextOutput: function (s) { return { setMimeType: function () { return this; }, getContent: function () { return s; } }; }
      },
      LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
      Utilities: {
        formatDate: function (d, tz, f) {
          var b = new Date(d.getTime() - 5 * 3600 * 1000), p = function (n) { return (n < 10 ? '0' : '') + n; };
          return b.getUTCFullYear() + '-' + p(b.getUTCMonth() + 1) + '-' + p(b.getUTCDate()) + ' ' + p(b.getUTCHours()) + ':' + p(b.getUTCMinutes()) + ':' + p(b.getUTCSeconds());
        }
      },
      Date: FakeDate
    };
  }

  /* Carga Code.gs con el entorno simulado y devuelve una función call(method, params) → objeto JSON. */
  function loadEngine(codeText, env) {
    var names = ['SpreadsheetApp', 'ContentService', 'LockService', 'Utilities', 'Date'];
    var fn = new Function(names.join(','), codeText + '\n;return {doGet:doGet,doPost:doPost};');
    var api = fn.apply(null, names.map(function (n) { return env[n]; }));
    return function call(method, params) {
      var res = method === 'POST'
        ? api.doPost({ postData: { contents: JSON.stringify(params) } })
        : api.doGet({ parameter: params });
      return JSON.parse(res.getContent());
    };
  }

  return { createEnv: createEnv, loadEngine: loadEngine };
});
