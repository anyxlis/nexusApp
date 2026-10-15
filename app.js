// ============================================================
//  NEXUS — app.js
//  Supabase REST API + AngularJS 1.x
// ============================================================

const SUPA_URL = 'https://rqwpmxbzqxnnmnwuqxcv.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxd3BteGJ6cXhubm1ud3VxeGN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDA2MzUsImV4cCI6MjA5NDA3NjYzNX0.BaAwjQbGz0Y4ISNKgUhwUjSTJV2Amyn8EtKDTBnfC08';

// ── Supabase REST helpers ──────────────────────────────────
function sbHeaders(extra) {
  return Object.assign({
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }, extra || {});
}

function sbCheck(r) {
  if (r.ok) return r.json().catch(function() { return []; });
  return r.json().catch(function() { return {}; }).then(function(err) {
    console.error('Supabase error', r.status, err);
    throw new Error(err && err.message ? err.message : ('HTTP ' + r.status));
  });
}

function sbGet(table, params) {
  var qs = Object.entries(params || {}).map(function(e) { return e[0] + '=' + encodeURIComponent(e[1]); }).join('&');
  return fetch(SUPA_URL + '/rest/v1/' + table + (qs ? '?' + qs : ''), { headers: sbHeaders() })
    .then(sbCheck);
}

function sbPost(table, body) {
  return fetch(SUPA_URL + '/rest/v1/' + table, {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify(body)
  }).then(sbCheck);
}

function sbPatch(table, filter, body) {
  return fetch(SUPA_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(body)
  }).then(sbCheck);
}

function sbDelete(table, filter) {
  return fetch(SUPA_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'DELETE', headers: sbHeaders({ 'Prefer': 'return=minimal' })
  });
}

// ── Simple hash ──
function simpleHash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return 'h_' + Math.abs(h).toString(16) + '_' + str.length;
}

function parseISO(s) {
  var p = String(s).substring(0, 10).split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function addDays(iso, n) {
  var d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d);
}
function pad2(n) { return String(n).padStart(2, '0'); }

function toISO(d) {
  if (!d) return '';
  var dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '';
  var y = dt.getFullYear();
  var m = String(dt.getMonth() + 1).padStart(2, '0');
  var day = String(dt.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

// ── Angular App ────────────────────────────────────────────
angular.module('nexusApp', [])

.filter('number', function() {
  return function(input) {
    if (input == null || isNaN(input)) return '0';
    return Number(input).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
})

.directive('strVal', function() {
  return {
    restrict: 'A', require: 'ngModel',
    link: function(scope, el, attr, ctrl) {
      var isTime = attr.type === 'time';
      ctrl.$formatters.push(function(v) {
        if (v == null || v === '') return null;
        if (v instanceof Date) return v;
        var s = String(v);
        if (isTime) { var t = s.split(':'); return new Date(1970, 0, 1, +t[0] || 0, +t[1] || 0, 0, 0); }
        return parseISO(s);
      });
      ctrl.$parsers.push(function(d) {
        if (!(d instanceof Date) || isNaN(d)) return '';
        return isTime ? pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : toISO(d);
      });
    }
  };
})

.controller('MainCtrl', ['$scope', '$timeout', function($scope, $timeout) {

  // ── Config ────────────────────────────────────────────
  $scope.categories = {
    trabajo:  { label: 'Trabajo',   color: '#64b5f6' },
    estudio:  { label: 'Estudio',   color: '#a99ef9' },
    gym:      { label: 'Gym',       color: '#3ecf8e' },
    salud:    { label: 'Salud',     color: '#26c6da' },
    personal: { label: 'Personal',  color: '#f48fb1' },
    social:   { label: 'Social',    color: '#ffb74d' },
    otro:     { label: 'Otro',      color: '#555861' }
  };

  var CAT_ICONS = {
    'Salario':'💼','Freelance':'💻','Inversión':'📈','Regalo':'🎁',
    'Alimentación':'🛒','Transporte':'🚌','Vivienda':'🏠','Salud':'💊',
    'Entretenimiento':'🎬','Ropa':'👕','Educación':'📚','Servicios':'⚡','Otros':'📦'
  };

  $scope.cellH    = 60;
  $scope.gridStart = 6;
  $scope.gridEnd   = 23;
  $scope.gridHours = [];
  for (var h = $scope.gridStart; h < $scope.gridEnd; h++) $scope.gridHours.push(h);

  // ── State ─────────────────────────────────────────────
  $scope.appLoading  = true;
  $scope.authLoading = false;
  $scope.authMode    = 'login';
  $scope.authData    = {};
  $scope.authError   = '';
  $scope.currentUser = null;
  // Modo app móvil: solo Semana y Finanzas (al instalarla o con ?app=movil)
  $scope.mobileApp = /[?&]app=movil/.test(location.search) ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  $scope.activeView  = $scope.mobileApp ? 'agenda' : 'dashboard';
  $scope.toast       = { show: false, msg: '', type: 'ok' };

  $scope.today        = new Date();
  $scope.selectedDate = new Date();
  $scope.weekOffset   = 0;

  $scope.events       = [];
  $scope.tasks        = [];
  $scope.transactions = [];

  $scope.loadingEvents = false;
  $scope.loadingTasks  = false;
  $scope.loadingTrans  = false;

  // Negocio fragancias
  $scope.negTab           = 'resumen';
  $scope.mayTab           = 'planes';
  $scope.ventasNegocio    = [];
  $scope.mayoristas       = [];
  $scope.loadingVentas    = false;
  $scope.loadingMayoristas = false;
  $scope.ventaFilter      = 'todas';
  $scope.invFilter        = 'todas';
  $scope.showVentaModal   = false;
  $scope.showMayoristaModal = false;
  $scope.showAbonoModal   = false;
  $scope.showPedidoMayModal = false;
  $scope.savingVenta      = false;
  $scope.newVenta         = {};
  $scope.newFragancia     = {};
  $scope.newMayorista     = {};
  $scope.newPedidoMay     = {};
  $scope.abonoVenta       = {};
  $scope.nuevoAbono       = 0;
  $scope.pedidoMayoristaTarget = {};
  $scope.taskFilter    = 'todas';
  $scope.transFilter   = 'todos';

  $scope.showEventModal = false;
  $scope.showTransModal = false;
  $scope.editingEvent   = null;
  $scope.newEvent       = {};
  $scope.newTrans       = {};
  $scope.savingEvent    = false;
  $scope.savingTrans    = false;
  $scope.newTask        = { texto: '', prioridad: 'media', fecha_limite: '' };

  // Historial meses
  $scope.historialMeses      = [];
  $scope.loadingHistorial    = false;
  $scope.showHistorialDetail = false;
  $scope.mesDetalle          = null;
  $scope.showCerrarMesModal  = false;
  $scope.cerrarMesLabel      = '';
  $scope.savingCierre        = false;

  // ── Toast ─────────────────────────────────────────────
  var toastTimer = null;
  function showToast(msg, type, undo) {
    if (toastTimer) $timeout.cancel(toastTimer);
    $scope.toast = { show: true, msg: msg, type: type || 'ok', undo: undo || null };
    toastTimer = $timeout(function() { $scope.toast.show = false; }, undo ? 7000 : 3000);
  }
  function undoInsert(table, row, reload, label) {
    return function() {
      var r = angular.copy(row); delete r.id; delete r.creado_en;
      sbPost(table, r).then(function() { $timeout(function() { reload(); showToast(label + ' restaurado ✓'); }); });
    };
  }

  // ── Session ───────────────────────────────────────────
  function saveSession(user) {
    try { localStorage.setItem('nexus_user', JSON.stringify(user)); } catch(e) {}
  }
  function loadSession() {
    try { var raw = localStorage.getItem('nexus_user'); return raw ? JSON.parse(raw) : null; } catch(e) { return null; }
  }
  function clearSession() {
    try { localStorage.removeItem('nexus_user'); } catch(e) {}
  }

  // ── Init ──────────────────────────────────────────────
  var saved = loadSession();
  if (saved) {
    $scope.currentUser = saved;
    buildWeek();
    loadAll();
  }
  $timeout(function() { $scope.appLoading = false; }, 600);

  // ── Auth ──────────────────────────────────────────────
  $scope.authEnter = function($event, mode) {
    if ($event.keyCode === 13) {
      if (mode === 'login') $scope.login();
      else $scope.register();
    }
  };

  $scope.login = function() {
    if (!$scope.authData.username || !$scope.authData.password) {
      $scope.authError = 'Completa todos los campos.'; return;
    }
    $scope.authLoading = true;
    $scope.authError   = '';
    var hash = simpleHash($scope.authData.password);
    sbGet('usuarios', {
      username: 'eq.' + $scope.authData.username,
      password_hash: 'eq.' + hash,
      select: '*'
    }).then(function(rows) {
      $timeout(function() {
        $scope.authLoading = false;
        if (!rows || !rows.length) {
          $scope.authError = 'Usuario o contraseña incorrectos.';
        } else {
          $scope.currentUser = rows[0];
          saveSession(rows[0]);
          buildWeek();
          loadAll();
        }
      });
    }).catch(function() {
      $timeout(function() { $scope.authLoading = false; $scope.authError = 'Error de conexión.'; });
    });
  };

  $scope.register = function() {
    if (!$scope.authData.nombre || !$scope.authData.username || !$scope.authData.password) {
      $scope.authError = 'Completa todos los campos.'; return;
    }
    if ($scope.authData.password.length < 6) {
      $scope.authError = 'La contraseña debe tener al menos 6 caracteres.'; return;
    }
    $scope.authLoading = true;
    $scope.authError   = '';
    sbGet('usuarios', { username: 'eq.' + $scope.authData.username, select: 'id' }).then(function(rows) {
      if (rows && rows.length) {
        $timeout(function() { $scope.authLoading = false; $scope.authError = 'Ese usuario ya existe.'; });
        return;
      }
      var hash = simpleHash($scope.authData.password);
      sbPost('usuarios', {
        nombre: $scope.authData.nombre,
        username: $scope.authData.username,
        password_hash: hash
      }).then(function(created) {
        $timeout(function() {
          $scope.authLoading = false;
          if (created && created[0]) {
            $scope.currentUser = created[0];
            saveSession(created[0]);
            buildWeek();
            loadAll();
          } else {
            $scope.authError = 'Error al crear la cuenta.';
          }
        });
      });
    }).catch(function() {
      $timeout(function() { $scope.authLoading = false; $scope.authError = 'Error de conexión.'; });
    });
  };

  $scope.logout = function() {
    clearSession();
    $scope.currentUser  = null;
    $scope.events       = [];
    $scope.tasks        = [];
    $scope.transactions = [];
    $scope.historialMeses = [];
    $scope.authData     = {};
    $scope.authMode     = 'login';
  };

  // ── Week ──────────────────────────────────────────────
  function buildWeek() {
    var t = new Date($scope.today.getFullYear(), $scope.today.getMonth(), $scope.today.getDate());
    t.setDate(t.getDate() + $scope.weekOffset * 7);
    var dow = t.getDay();
    var mondayDate = t.getDate() - ((dow + 6) % 7);
    $scope.weekDays = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(t.getFullYear(), t.getMonth(), mondayDate + i);
      $scope.weekDays.push({ date: d, iso: toISO(d) });
    }
  }

  $scope.prevWeek  = function() { $scope.weekOffset--; buildWeek(); };
  $scope.nextWeek  = function() { $scope.weekOffset++; buildWeek(); };
  $scope.goToday   = function() { $scope.weekOffset = 0; buildWeek(); $scope.selectedDate = new Date(); };
  $scope.selectDate = function(d) { $scope.selectedDate = new Date(d); };

  $scope.clickCell = function(dayDate, $event) {
    var body = $event.currentTarget;
    var rect = body.getBoundingClientRect();
    var y    = $event.clientY - rect.top;
    var hour = Math.floor(y / $scope.cellH) + $scope.gridStart;
    hour = Math.max($scope.gridStart, Math.min(hour, $scope.gridEnd - 1));
    var hStr = String(hour).padStart(2, '0') + ':00';
    var hEnd  = String(Math.min(hour + 1, 23)).padStart(2, '0') + ':00';
    $scope.editingEvent = null;
    $scope.showFullForm = false;
    $scope.newEvent = {
      fecha: toISO(dayDate),
      hora_inicio: hStr,
      hora_fin: hEnd,
      categoria: 'trabajo',
      titulo: '',
      descripcion: ''
    };
    $scope.showEventModal = true;
    $timeout(function() {
      var inp = document.querySelector('.quick-title-input');
      if (inp) inp.focus();
    }, 80);
  };

  $scope.isSameDay = function(a, b) {
    if (!a || !b) return false;
    var sa = (a instanceof Date) ? toISO(a) : String(a).substring(0,10);
    var sb = (b instanceof Date) ? toISO(b) : String(b).substring(0,10);
    return sa === sb;
  };

  $scope.hasEventsOn = function(d) {
    var iso = (d instanceof Date) ? toISO(d) : String(d).substring(0,10);
    return $scope.events.some(function(e) { return e.fecha === iso; });
  };

  // ── Load all data ─────────────────────────────────────
  function loadAll() {
    loadEvents();
    loadTasks();
    loadTrans();
    loadFragancias();
    loadVentasNegocio();
    loadMayoristas();
    loadMateriales();
    loadPedidosMay();
    _loadHistorial();
  }

  function loadEvents() {
    if (!$scope.currentUser) return;
    $scope.loadingEvents = true;
    sbGet('eventos', { usuario_id: 'eq.' + $scope.currentUser.id, select: '*', order: 'fecha.asc,hora_inicio.asc' })
      .then(function(rows) {
        $timeout(function() { $scope.events = rows || []; $scope.loadingEvents = false; });
      }).catch(function() { $timeout(function() { $scope.loadingEvents = false; }); });
  }

  function loadTasks() {
    if (!$scope.currentUser) return;
    $scope.loadingTasks = true;
    sbGet('tareas', { usuario_id: 'eq.' + $scope.currentUser.id, select: '*', order: 'creado_en.desc' })
      .then(function(rows) {
        $timeout(function() { $scope.tasks = rows || []; $scope.loadingTasks = false; buildTaskGroups(); });
      }).catch(function() { $timeout(function() { $scope.loadingTasks = false; }); });
  }

  function loadTrans() {
    if (!$scope.currentUser) return;
    $scope.loadingTrans = true;
    sbGet('transacciones', { usuario_id: 'eq.' + $scope.currentUser.id, select: '*', order: 'fecha.desc' })
      .then(function(rows) {
        $timeout(function() { $scope.transactions = rows || []; $scope.loadingTrans = false; });
      }).catch(function() { $timeout(function() { $scope.loadingTrans = false; }); });
  }

  // ── Eventos ───────────────────────────────────────────
  $scope.eventsForDay = function(d) {
    if (!d) return [];
    var iso = (typeof d === 'string') ? d : toISO(d);
    return $scope.events.filter(function(e) { return e.fecha === iso; });
  };

  $scope.formatHour = function(t) {
    if (!t) return '';
    var parts = t.split(':');
    var h = parseInt(parts[0]);
    var m = parts[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ampm;
  };

  $scope.openEventModal = function(ev) {
    $scope.editingEvent = ev || null;
    $scope.showFullForm = false;
    if (ev) {
      $scope.newEvent = angular.copy(ev);
      if ($scope.newEvent.hora_inicio) $scope.newEvent.hora_inicio = $scope.newEvent.hora_inicio.substring(0,5);
      if ($scope.newEvent.hora_fin)    $scope.newEvent.hora_fin    = $scope.newEvent.hora_fin.substring(0,5);
      if (!$scope.newEvent.hora_inicio) $scope.newEvent.hora_inicio = '09:00';
      if (!$scope.newEvent.hora_fin)    $scope.newEvent.hora_fin    = '10:00';
    } else {
      $scope.newEvent = {
        fecha: toISO($scope.selectedDate),
        hora_inicio: '09:00',
        hora_fin: '10:00',
        categoria: 'trabajo',
        titulo: '',
        descripcion: ''
      };
    }
    $scope.showEventModal = true;
    $timeout(function() {
      var inp = document.querySelector('.quick-title-input');
      if (inp) inp.focus();
    }, 80);
  };

  $scope.closeEventModal = function() {
    $scope.showEventModal = false;
    $scope.editingEvent   = null;
    $scope.showFullForm   = false;
  };

  $scope.quickSaveEnter = function($event) {
    if ($event.keyCode === 13 && $scope.newEvent.titulo) $scope.saveEvent();
  };

  $scope.saveEvent = function() {
    if (!$scope.newEvent.titulo) return;
    $scope.savingEvent = true;
    var body = {
      usuario_id: $scope.currentUser.id,
      titulo: $scope.newEvent.titulo,
      descripcion: $scope.newEvent.descripcion || '',
      fecha: $scope.newEvent.fecha,
      hora_inicio: $scope.newEvent.hora_inicio || null,
      hora_fin: $scope.newEvent.hora_fin || null,
      categoria: $scope.newEvent.categoria || 'otro'
    };
    var rep = !$scope.editingEvent && $scope.newEvent.repetir ? $scope.newEvent.repetir : '';
    var rows = null;
    if (rep) {
      rows = repeatDates($scope.newEvent.fecha, rep, $scope.newEvent.repetirSemanas)
        .map(function(d) { return Object.assign({}, body, { fecha: d }); });
    }
    var promise = $scope.editingEvent
      ? sbPatch('eventos', 'id=eq.' + $scope.editingEvent.id, body)
      : sbPost('eventos', rows || body);
    promise.then(function(created) {
      $timeout(function() {
        var wasEditing = !!$scope.editingEvent;
        $scope.savingEvent = false;
        $scope.showEventModal = false;
        $scope.editingEvent = null;
        loadEvents();
        if (rows) showToast(rows.length + ' eventos creados ✓', 'ok', undoBatch(created));
        else showToast(wasEditing ? 'Evento actualizado ✓' : 'Evento guardado ✓');
      });
    }).catch(function() {
      $timeout(function() { $scope.savingEvent = false; showToast('Error al guardar', 'err'); });
    });
  };

  $scope.deleteEvent = function(ev, $event) {
    if ($event) $event.stopPropagation();
    sbDelete('eventos', 'id=eq.' + ev.id).then(function() {
      $timeout(function() { loadEvents(); showToast('Evento eliminado', 'ok', undoInsert('eventos', ev, loadEvents, 'Evento')); });
    });
  };

  // ── Formulario rápido de evento ──
  function addMin(t, m) {
    var x = Math.min(23 * 60 + 59, Math.max(0, timeToMinutes(t) + m));
    return pad2(Math.floor(x / 60)) + ':' + pad2(x % 60);
  }
  $scope.durMin = function() {
    var e = $scope.newEvent;
    if (!e || !e.hora_inicio || !e.hora_fin) return 0;
    return timeToMinutes(e.hora_fin) - timeToMinutes(e.hora_inicio);
  };
  $scope.durLabel = function(m) {
    if (m < 60) return m + ' min';
    var hh = Math.floor(m / 60), mm = m % 60;
    return mm ? hh + ' h ' + mm : hh + ' h';
  };
  var lastDur = 60;
  $scope.onStartChange = function() {
    var e = $scope.newEvent; if (!e.hora_inicio) return;
    e.hora_fin = addMin(e.hora_inicio, lastDur);
  };
  $scope.onEndChange = function() { var d = $scope.durMin(); if (d > 0) lastDur = d; };
  $scope.setDur = function(m) {
    var e = $scope.newEvent; if (!e.hora_inicio) e.hora_inicio = '09:00';
    lastDur = m; e.hora_fin = addMin(e.hora_inicio, m);
  };
  $scope.weeksVal = function() { return Math.max(1, Math.min(+$scope.newEvent.repetirSemanas || 4, 26)); };
  $scope.stepWeeks = function(n) { $scope.newEvent.repetirSemanas = Math.max(1, Math.min($scope.weeksVal() + n, 26)); };
  $scope.repeatCount = function() {
    var e = $scope.newEvent;
    return e && e.repetir && e.fecha ? repeatDates(e.fecha, e.repetir, e.repetirSemanas).length : 1;
  };

  // ── Repetición y copia de semanas (ahorra trabajo manual) ──
  function repeatDates(startISO, mode, weeks) {
    weeks = Math.max(1, Math.min(+weeks || 4, 26));
    var out = [startISO], i;
    if (mode === 'semanal') {
      for (i = 1; i < weeks; i++) out.push(addDays(startISO, 7 * i));
    } else {
      for (i = 1; i < weeks * 7; i++) {
        var d = addDays(startISO, i), dow = parseISO(d).getDay();
        if (mode === 'laboral' && (dow === 0 || dow === 6)) continue;
        out.push(d);
      }
    }
    return out;
  }

  function undoBatch(created) {
    var ids = (created || []).map(function(r) { return r.id; });
    if (!ids.length) return null;
    return function() {
      sbDelete('eventos', 'id=in.(' + ids.join(',') + ')').then(function() {
        $timeout(function() { loadEvents(); showToast('Cambios deshechos'); });
      });
    };
  }

  $scope.duplicateWeek = function(srcStartISO, shift) {
    var srcEnd = addDays(srcStartISO, 6);
    var src = $scope.events.filter(function(e) { return e.fecha >= srcStartISO && e.fecha <= srcEnd; });
    var have = {};
    $scope.events.forEach(function(e) { have[e.fecha + '|' + e.titulo + '|' + String(e.hora_inicio || '').substring(0, 5)] = 1; });
    var rows = [];
    src.forEach(function(e) {
      var f = addDays(e.fecha, shift);
      if (have[f + '|' + e.titulo + '|' + String(e.hora_inicio || '').substring(0, 5)]) return;
      rows.push({
        usuario_id: $scope.currentUser.id, titulo: e.titulo, descripcion: e.descripcion || '',
        fecha: f, hora_inicio: e.hora_inicio || null, hora_fin: e.hora_fin || null, categoria: e.categoria || 'otro'
      });
    });
    if (!rows.length) { showToast('No hay nada nuevo que copiar', 'err'); return; }
    sbPost('eventos', rows).then(function(created) {
      $timeout(function() { loadEvents(); showToast(rows.length + ' eventos copiados ✓', 'ok', undoBatch(created)); });
    }).catch(function() { $timeout(function() { showToast('Error al copiar', 'err'); }); });
  };
  $scope.copyPrevWeek = function() { $scope.duplicateWeek(addDays($scope.weekDays[0].iso, -7), 7); };
  $scope.repeatToNextWeek = function() { $scope.duplicateWeek($scope.weekDays[0].iso, 7); };

  // ── Carga de trabajo ──
  $scope.dayHours = function(iso) {
    var total = 0;
    $scope.events.forEach(function(e) {
      if (e.fecha !== iso || !e.hora_inicio) return;
      var s = timeToMinutes(e.hora_inicio), f = e.hora_fin ? timeToMinutes(e.hora_fin) : s + 60;
      if (f > s) total += (f - s) / 60;
    });
    return Math.round(total * 10) / 10;
  };
  $scope.weekHours = function() {
    return Math.round(($scope.weekDays || []).reduce(function(s, d) { return s + $scope.dayHours(d.iso); }, 0) * 10) / 10;
  };
  $scope.dayLoad = function(iso) {
    var h = $scope.dayHours(iso);
    return h > 8 ? 'high' : (h > 6 ? 'warn' : 'ok');
  };
  $scope.barPct = function(iso) { return Math.min(100, Math.round($scope.dayHours(iso) / 10 * 100)); };
  $scope.fmtH = function(h) { return (Math.round(h * 10) / 10).toString().replace('.', ',') + ' h'; };
  $scope.heavyDays = function() {
    return ($scope.weekDays || []).filter(function(d) { return $scope.dayHours(d.iso) > 8; });
  };
  $scope.weekByCat = function() {
    var map = {};
    ($scope.weekDays || []).forEach(function(d) {
      $scope.events.forEach(function(e) {
        if (e.fecha !== d.iso || !e.hora_inicio) return;
        var s = timeToMinutes(e.hora_inicio), f = e.hora_fin ? timeToMinutes(e.hora_fin) : s + 60;
        if (f > s) map[e.categoria] = (map[e.categoria] || 0) + (f - s) / 60;
      });
    });
    var list = Object.keys(map).map(function(k) {
      return { key: k, label: ($scope.categories[k] || {}).label || k, color: ($scope.categories[k] || {}).color || '#555861', h: Math.round(map[k] * 10) / 10 };
    }).sort(function(a, b) { return b.h - a.h; });
    var sig = JSON.stringify(list);           // misma lista => mismo objeto (evita bucles de digest)
    if (sig !== wbcCache.sig) wbcCache = { sig: sig, val: list };
    return wbcCache.val;
  };
  var wbcCache = { sig: '', val: [] };

  $scope.blockStyle = function(ev) {
    if (!ev.hora_inicio) return { top: '0px', height: '20px' };
    var start = timeToMinutes(ev.hora_inicio);
    var end   = ev.hora_fin ? timeToMinutes(ev.hora_fin) : start + 60;
    var gridStartMin = $scope.gridStart * 60;
    var top    = ((start - gridStartMin) / 60) * $scope.cellH;
    var height = Math.max(((end - start) / 60) * $scope.cellH, 20);
    return { top: top + 'px', height: height + 'px' };
  };

  function timeToMinutes(t) {
    var parts = (t || '00:00').split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
  }

  // ── Tareas ────────────────────────────────────────────
  $scope.filteredTasks = function() {
    return $scope.tasks.filter(function(t) {
      if ($scope.taskFilter === 'pendientes') return !t.completada;
      if ($scope.taskFilter === 'hechas')     return  t.completada;
      return true;
    });
  };

  $scope.pendingTasks = function() { return $scope.tasks.filter(function(t) { return !t.completada; }).length; };
  $scope.doneTasks    = function() { return $scope.tasks.filter(function(t) {  return t.completada;  }).length; };

  $scope.taskGroupsList = [];
  function tdate(t) { return t.fecha_limite ? String(t.fecha_limite).substring(0, 10) : ''; }
  function buildTaskGroups() {
    var hoy = toISO(new Date()), semana = addDays(hoy, 7), f = $scope.taskFilter;
    var pri = { alta: 0, media: 1, baja: 2 };
    function cmp(a, b) {
      var da = tdate(a) || '9999', db = tdate(b) || '9999';
      if (da !== db) return da < db ? -1 : 1;
      return (pri[a.prioridad] == null ? 1 : pri[a.prioridad]) - (pri[b.prioridad] == null ? 1 : pri[b.prioridad]);
    }
    var pend = $scope.tasks.filter(function(t) { return !t.completada; }).sort(cmp);
    var done = $scope.tasks.filter(function(t) { return t.completada; });
    var g = [];
    function add(key, label, items) { if (items.length) g.push({ key: key, label: label, items: items }); }
    if (f !== 'hechas') {
      add('vencidas', 'Vencidas', pend.filter(function(t) { return tdate(t) && tdate(t) < hoy; }));
      add('hoy', 'Hoy', pend.filter(function(t) { return tdate(t) === hoy; }));
      add('semana', 'Próximos 7 días', pend.filter(function(t) { return tdate(t) > hoy && tdate(t) <= semana; }));
      add('despues', 'Más adelante', pend.filter(function(t) { return tdate(t) > semana; }));
      add('sinfecha', 'Sin fecha', pend.filter(function(t) { return !tdate(t); }));
    }
    if (f !== 'pendientes') {
      var shown = f === 'hechas' ? done : done.slice(0, 8);
      if (shown.length) g.push({ key: 'hechas', label: 'Completadas', total: done.length, items: shown });
    }
    $scope.taskGroupsList = g;
  }
  $scope.setTaskFilter = function(f) { $scope.taskFilter = f; buildTaskGroups(); };
  $scope.quickDate = function(n) { return addDays(toISO(new Date()), n); };
  $scope.taskDueLabel = function(t) {
    var d = tdate(t); if (!d) return '';
    var hoy = toISO(new Date());
    if (d === hoy) return 'Hoy';
    if (d === addDays(hoy, 1)) return 'Mañana';
    return null;
  };
  $scope.taskOverdue = function(t) { return !t.completada && tdate(t) && tdate(t) < toISO(new Date()); };

  $scope.addTaskEnter = function($event) { if ($event.keyCode === 13) $scope.addTask(); };
  $scope.editingTask   = null;
  $scope.showTaskModal = false;
  $scope.editTask      = {};

  $scope.openTaskModal = function(t) {
    $scope.editingTask = t;
    $scope.editTask = angular.copy(t);
    $scope.showTaskModal = true;
  };

  $scope.saveTaskEdit = function() {
    if (!$scope.editTask.texto) return;
    sbPatch('tareas', 'id=eq.' + $scope.editingTask.id, {
      texto: $scope.editTask.texto,
      prioridad: $scope.editTask.prioridad,
      fecha_limite: $scope.editTask.fecha_limite || null
    }).then(function() {
      $timeout(function() {
        $scope.showTaskModal = false;
        $scope.editingTask = null;
        loadTasks();
        showToast('Tarea actualizada ✓');
      });
    });
  };

  $scope.addTask = function() {
    if (!$scope.newTask.texto) return;
    var body = {
      usuario_id: $scope.currentUser.id,
      texto: $scope.newTask.texto,
      prioridad: $scope.newTask.prioridad || 'media',
      completada: false,
      fecha_limite: $scope.newTask.fecha_limite || null
    };
    sbPost('tareas', body).then(function() {
      $timeout(function() {
        $scope.newTask = { texto: '', prioridad: 'media', fecha_limite: '' };
        loadTasks();
        showToast('Tarea añadida');
      });
    });
  };

  $scope.toggleTask = function(t) {
    t.completada = !t.completada;
    buildTaskGroups();
    sbPatch('tareas', 'id=eq.' + t.id, { completada: t.completada }).catch(function() {
      $timeout(function() { t.completada = !t.completada; buildTaskGroups(); showToast('No se pudo guardar', 'err'); });
    });
  };

  $scope.deleteTask = function(t) {
    sbDelete('tareas', 'id=eq.' + t.id).then(function() {
      $timeout(function() { loadTasks(); showToast('Tarea eliminada', 'ok', undoInsert('tareas', t, loadTasks, 'Tarea')); });
    });
  };

  // ── Finanzas ──────────────────────────────────────────
  var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  function curMonth() { return toISO(new Date()).substring(0, 7); }
  $scope.finMonth = curMonth();
  function monthKey(t) { return String(t.fecha || '').substring(0, 7); }
  $scope.monthTrans = function() { return $scope.transactions.filter(function(t) { return monthKey(t) === $scope.finMonth; }); };
  $scope.finMonthLabel = function() { var p = $scope.finMonth.split('-'); return MESES[+p[1] - 1] + ' ' + p[0]; };
  $scope.shiftMonth = function(n) {
    var p = $scope.finMonth.split('-');
    $scope.finMonth = toISO(new Date(+p[0], +p[1] - 1 + n, 1)).substring(0, 7);
  };
  $scope.isCurrentMonth = function() { return $scope.finMonth === curMonth(); };
  $scope.goCurrentMonth = function() { $scope.finMonth = curMonth(); };
  $scope.expenseDelta = function() {
    var p = $scope.finMonth.split('-');
    var prev = toISO(new Date(+p[0], +p[1] - 2, 1)).substring(0, 7);
    var prevExp = $scope.transactions.filter(function(t) { return t.tipo === 'gasto' && monthKey(t) === prev; })
      .reduce(function(s, t) { return s + (+t.monto || 0); }, 0);
    if (!prevExp) return null;
    return Math.round(($scope.totalExpense() - prevExp) / prevExp * 100);
  };
  $scope.exportCSV = function() {
    var rows = [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto']];
    $scope.transactions.slice().sort(function(a, b) { return String(a.fecha) < String(b.fecha) ? -1 : 1; }).forEach(function(t) {
      rows.push([String(t.fecha).substring(0, 10), t.tipo, t.categoria, t.descripcion, t.monto]);
    });
    var csv = '\ufeff' + rows.map(function(r) {
      return r.map(function(c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'nexus-finanzas-' + toISO(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    showToast('Respaldo descargado ✓');
  };

  $scope.totalIncome  = function() { return $scope.monthTrans().filter(function(t) { return t.tipo==='ingreso'; }).reduce(function(s,t) { return s+(+t.monto||0); }, 0); };
  $scope.totalExpense = function() { return $scope.monthTrans().filter(function(t) { return t.tipo==='gasto';   }).reduce(function(s,t) { return s+(+t.monto||0); }, 0); };
  $scope.balance      = function() { return $scope.totalIncome() - $scope.totalExpense(); };
  $scope.savingsRate  = function() { var i=$scope.totalIncome(); return i ? Math.max(0,Math.round($scope.balance()/i*100)) : 0; };
  $scope.spentPct     = function() { var i=$scope.totalIncome(); return i ? Math.min(Math.round($scope.totalExpense()/i*100),100) : 0; };

  $scope.filteredTrans = function() {
    if ($scope.transFilter === 'historial') return [];
    if ($scope.transFilter === 'todos') return $scope.monthTrans();
    return $scope.monthTrans().filter(function(t) { return t.tipo === $scope.transFilter; });
  };

  $scope.expenseByCategory = function() {
    var map = {};
    $scope.monthTrans().filter(function(t) { return t.tipo==='gasto'; }).forEach(function(t) {
      map[t.categoria] = (map[t.categoria]||0) + (+t.monto||0);
    });
    var sorted = {};
    Object.keys(map).sort(function(a,b) { return map[b]-map[a]; }).forEach(function(k) { sorted[k]=map[k]; });
    return sorted;
  };

  $scope.categoryIcon = function(cat) { return CAT_ICONS[cat] || '💰'; };

  $scope.editingTrans = null;

  $scope.openTransModal = function(tipo, trans) {
    $scope.editingTrans = trans || null;
    if (trans) {
      $scope.newTrans = angular.copy(trans);
    } else {
      $scope.newTrans = {
        tipo: tipo,
        descripcion: '',
        monto: null,
        fecha: toISO(new Date()),
        categoria: tipo === 'ingreso' ? 'Salario' : 'Alimentación'
      };
    }
    $scope.showTransModal = true;
  };

  $scope.closeTransModal = function() { $scope.showTransModal = false; $scope.editingTrans = null; };

  $scope.saveTrans = function() {
    if (!$scope.newTrans.descripcion || !$scope.newTrans.monto) return;
    $scope.savingTrans = true;
    var body = {
      usuario_id: $scope.currentUser.id,
      tipo: $scope.newTrans.tipo,
      monto: +$scope.newTrans.monto,
      descripcion: $scope.newTrans.descripcion,
      categoria: $scope.newTrans.categoria,
      fecha: $scope.newTrans.fecha
    };
    var promise = $scope.editingTrans
      ? sbPatch('transacciones', 'id=eq.' + $scope.editingTrans.id, body)
      : sbPost('transacciones', body);
    promise.then(function() {
      $timeout(function() {
        $scope.savingTrans = false;
        $scope.showTransModal = false;
        $scope.editingTrans = null;
        if (body.fecha) $scope.finMonth = String(body.fecha).substring(0, 7);
        loadTrans();
        showToast($scope.editingTrans ? 'Actualizado ✓' : 'Transacción guardada ✓');
      });
    }).catch(function() {
      $timeout(function() { $scope.savingTrans = false; showToast('Error al guardar', 'err'); });
    });
  };

  $scope.deleteTrans = function(t) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    sbDelete('transacciones', 'id=eq.' + t.id).then(function() {
      $timeout(function() { loadTrans(); showToast('Movimiento eliminado', 'ok', undoInsert('transacciones', t, loadTrans, 'Movimiento')); });
    });
  };

  $scope.setView = function(v) {
    if ($scope.mobileApp && v !== 'agenda' && v !== 'finanzas') v = 'agenda';
    $scope.activeView = v;
    if (v === 'dashboard') {
      pickQuote();
      $scope.finMonth = curMonth();
      $scope.weekOffset = 0; buildWeek();
    }
    try { window.scrollTo(0, 0); } catch (e) {}
  };

  var QUOTES = [
    'Cada peso ahorrado hoy es libertad mañana.',
    'La disciplina es el puente entre metas y logros.',
    'Organiza tu tiempo como organizas tu dinero.',
    'El éxito es la suma de pequeños esfuerzos diarios.',
    'Un plan escrito vale más que mil intenciones.',
    'Controlar tus gastos es controlar tu futuro.',
    'El tiempo bien usado es el mayor activo.',
    'Cada tarea completada es una victoria.'
  ];

  function pickQuote() {
    $scope.motivationalQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }
  pickQuote();

  // ── Resumen del día ──
  $scope.greeting = function() {
    var h = new Date().getHours();
    return h < 12 ? 'Buenos días' : (h < 19 ? 'Buenas tardes' : 'Buenas noches');
  };
  $scope.dayBrief = function() {
    var hoy = toISO(new Date());
    var ev = $scope.eventsForDay(hoy).length;
    var tk = $scope.tasks.filter(function(t) { return !t.completada && tdate(t) && tdate(t) <= hoy; }).length;
    var cb = ($scope.cobrosVencidos ? $scope.cobrosVencidos().length : 0) + ($scope.cobrosHoy ? $scope.cobrosHoy().length : 0);
    var parts = [];
    parts.push(ev ? ev + (ev === 1 ? ' evento' : ' eventos') + ' en tu agenda' : 'Sin eventos en tu agenda');
    parts.push(tk ? tk + (tk === 1 ? ' tarea' : ' tareas') + ' para hoy o vencidas' : 'tareas al día');
    if (cb) parts.push(cb + (cb === 1 ? ' cobro' : ' cobros') + ' por gestionar');
    var sb = ($scope.stockBajo ? $scope.stockBajo().length : 0);
    if (sb) parts.push(sb + (sb === 1 ? ' fragancia' : ' fragancias') + ' por reponer');
    return 'Hoy: ' + parts.join(' · ') + '.';
  };
  $scope.goNewTask = function() {
    $scope.setView('tareas');
    $timeout(function() { var i = document.querySelector('.task-quick .task-input'); if (i) i.focus(); }, 120);
  };
  $scope.fabVisible = function() {
    return ['dashboard', 'agenda', 'semana', 'tareas', 'finanzas', 'negocio'].indexOf($scope.activeView) >= 0;
  };
  $scope.fabAction = function() {
    var v = $scope.activeView;
    if (v === 'tareas') $scope.goNewTask();
    else if (v === 'finanzas') $scope.openTransModal('gasto');
    else if (v === 'negocio') $scope.openVentaModal();
    else $scope.openEventModal(null);
  };
  // línea de "ahora" en la semana
  $scope.nowTop = function() {
    var n = new Date(), m = n.getHours() * 60 + n.getMinutes();
    var top = (m - $scope.gridStart * 60) / 60 * $scope.cellH;
    return top >= 0 && top <= $scope.gridHours.length * $scope.cellH ? top : -1;
  };
  (function tick() { $timeout(tick, 60000); })();

  $scope.eventsToday = function() {
    return $scope.eventsForDay(new Date()).length;
  };

  $scope.urgentTasks = function() {
    var hoy = toISO(new Date());
    return $scope.tasks.filter(function(t) {
      return !t.completada && ((tdate(t) && tdate(t) <= hoy) || t.prioridad === 'alta');
    }).sort(function(a, b) {
      var da = tdate(a) || '9999', db = tdate(b) || '9999';
      return da < db ? -1 : (da > db ? 1 : 0);
    });
  };

  // ── HISTORIAL DE MESES ────────────────────────────────

  function _loadHistorial() {
    if (!$scope.currentUser) return;
    $scope.loadingHistorial = true;
    sbGet('historial_meses', {
      usuario_id: 'eq.' + $scope.currentUser.id,
      select: '*',
      order: 'creado_en.desc'
    }).then(function(rows) {
      $timeout(function() {
        $scope.historialMeses = rows || [];
        $scope.loadingHistorial = false;
      });
    }).catch(function() { $timeout(function() { $scope.loadingHistorial = false; }); });
  }

  $scope.loadHistorial = function() { _loadHistorial(); };

  $scope.openCerrarMesModal = function() {
    $scope.cerrarMesLabel = $scope.finMonthLabel();
    $scope.showCerrarMesModal = true;
  };

  // Guarda una copia del resumen del mes. NO borra ninguna transacción.
  $scope.cerrarMes = function() {
    if (!$scope.cerrarMesLabel || $scope.savingCierre) return;
    $scope.savingCierre = true;
    sbPost('historial_meses', {
      usuario_id:         $scope.currentUser.id,
      mes_label:          $scope.cerrarMesLabel,
      ingresos:           $scope.totalIncome(),
      gastos:             $scope.totalExpense(),
      balance:            $scope.balance(),
      tasa_ahorro:        $scope.savingsRate(),
      transacciones_json: $scope.monthTrans()
    }).then(function() {
      $timeout(function() {
        $scope.savingCierre = false;
        $scope.showCerrarMesModal = false;
        $scope.transFilter = 'historial';
        _loadHistorial();
        showToast('✓ Resumen guardado · tus movimientos siguen intactos');
      });
    }).catch(function() {
      $timeout(function() { $scope.savingCierre = false; showToast('Error al guardar', 'err'); });
    });
  };

  $scope.verMesDetalle = function(mes) {
    $scope.mesDetalle = angular.copy(mes);
    try {
      var raw = mes.transacciones_json;
      $scope.mesDetalle._trans = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
    } catch(e) { $scope.mesDetalle._trans = []; }
    $scope.mesDetalle._totalInc = $scope.mesDetalle._trans
      .filter(function(t){ return t.tipo==='ingreso'; })
      .reduce(function(s,t){ return s+(+t.monto||0); }, 0);
    $scope.mesDetalle._totalGas = $scope.mesDetalle._trans
      .filter(function(t){ return t.tipo==='gasto'; })
      .reduce(function(s,t){ return s+(+t.monto||0); }, 0);
    $scope.showHistorialDetail = true;
  };

  $scope.deleteHistorial = function(mes, $event) {
    if ($event) $event.stopPropagation();
    if (!confirm('¿Eliminar el historial de ' + mes.mes_label + '?')) return;
    sbDelete('historial_meses', 'id=eq.' + mes.id)
      .then(function() { $timeout(function() { _loadHistorial(); showToast('Historial eliminado'); }); });
  };

  $scope.catIconH = function(cat) { return CAT_ICONS[cat] || '💰'; };

  $scope.histSpentPct = function(mes) {
    if (!mes || !mes.ingresos || +mes.ingresos === 0) return 0;
    return Math.min(Math.round((+mes.gastos / +mes.ingresos) * 100), 100);
  };

  // ── NEGOCIO FRAGANCIAS ────────────────────────────────

  function loadFragancias() {
    if (!$scope.currentUser) return;
    $scope.loadingFragancias = true;
    sbGet('fragancias', { usuario_id: 'eq.' + $scope.currentUser.id, select: '*', order: 'nombre.asc' })
      .then(function(rows) {
        $timeout(function() { $scope.fragancias = rows || []; $scope.loadingFragancias = false; });
      }).catch(function() { $timeout(function() { $scope.loadingFragancias = false; }); });
  }

  function hit(q, txt) { return !q || String(txt || '').toLowerCase().indexOf(String(q).toLowerCase()) !== -1; }
  $scope.filteredFragancias = function() {
    var list = ($scope.fragancias || []).filter(function(f) { return hit($scope.invQ, f.nombre); });
    if ($scope.invFilter === 'disponibles') return list.filter(function(f) { return +f.stock >= 3; });
    if ($scope.invFilter === 'poco')        return list.filter(function(f) { return +f.stock > 0 && +f.stock < 3; });
    if ($scope.invFilter === 'agotadas')    return list.filter(function(f) { return +f.stock <= 0; });
    return list;
  };

  function loadVentasNegocio() {
    if (!$scope.currentUser) return;
    $scope.loadingVentas = true;
    sbGet('ventas_negocio', { usuario_id: 'eq.' + $scope.currentUser.id, select: '*', order: 'creado_en.desc' })
      .then(function(rows) {
        $timeout(function() { $scope.ventasNegocio = rows || []; $scope.loadingVentas = false; });
      }).catch(function() { $timeout(function() { $scope.loadingVentas = false; }); });
  }

  function loadMayoristas() {
    if (!$scope.currentUser) return;
    $scope.loadingMayoristas = true;
    sbGet('mayoristas', { usuario_id: 'eq.' + $scope.currentUser.id, select: '*', order: 'creado_en.desc' })
      .then(function(rows) {
        $timeout(function() { $scope.mayoristas = rows || []; $scope.loadingMayoristas = false; });
      }).catch(function() { $timeout(function() { $scope.loadingMayoristas = false; }); });
  }

  function isPagado(v) { return v.ya_pago === true || v.ya_pago === 'true'; }

  $scope.totalVendido    = function() { return $scope.ventasNegocio.reduce(function(s,v) { return s+(+v.valor_total||0); }, 0); };
  $scope.totalRecibido   = function() {
    return $scope.ventasNegocio.reduce(function(s,v) {
      return isPagado(v) ? s+(+v.valor_total||0) : s+(+v.abono||0);
    }, 0);
  };
  $scope.totalPorCobrar  = function() {
    return $scope.ventasNegocio.filter(function(v){ return !isPagado(v); })
      .reduce(function(s,v){ return s+((+v.valor_total||0)-(+v.abono||0)); }, 0);
  };
  $scope.capitalInvertido = function() { return ($scope.fragancias||[]).reduce(function(s,f){return s+(+f.precio_costo||0)*(+f.stock||0);},0); };
  $scope.gananciasNetas  = function() { return $scope.totalRecibido() - $scope.capitalInvertido(); };
  $scope.rentabilidad    = function() { var c=$scope.capitalInvertido(); return c?Math.round($scope.gananciasNetas()/c*100):0; };
  $scope.clientesPagaron  = function() { return $scope.ventasNegocio.filter(function(v){ return isPagado(v); }).length; };
  $scope.clientesAbono    = function() { return $scope.ventasNegocio.filter(function(v){ return !isPagado(v)&&+v.abono>0; }).length; };
  $scope.clientesSinPagar = function() { return $scope.ventasNegocio.filter(function(v){ return !isPagado(v)&&+v.abono===0; }).length; };

  $scope.filteredVentas = function() {
    var base = $scope.ventasNegocio.filter(function(v) { return hit($scope.ventaQ, v.cliente + ' ' + (v.fragancias_desc || '')); });
    if ($scope.ventaFilter==='pagadas') return base.filter(function(v){ return isPagado(v); });
    if ($scope.ventaFilter==='deben')   return base.filter(function(v){ return !isPagado(v); });
    return base;
  };

  function cobroFecha(v) { return v.fecha_cobro ? String(v.fecha_cobro).substring(0,10) : ''; }
  function sumaPendiente(list) {
    return list.reduce(function(s,v){ return s+((+v.valor_total||0)-(+v.abono||0)); }, 0);
  }

  $scope.cobrosVencidos = function() {
    var hoy = toISO(new Date());
    return ($scope.ventasNegocio||[]).filter(function(v) {
      return !isPagado(v) && cobroFecha(v) && cobroFecha(v) < hoy;
    });
  };
  $scope.cobrosHoy = function() {
    var hoy = toISO(new Date());
    return ($scope.ventasNegocio||[]).filter(function(v) {
      return !isPagado(v) && cobroFecha(v) === hoy;
    });
  };
  $scope.cobrosFuturos = function() {
    var hoy = toISO(new Date());
    return ($scope.ventasNegocio||[]).filter(function(v) {
      return !isPagado(v) && cobroFecha(v) && cobroFecha(v) > hoy;
    });
  };
  $scope.totalCobrosVencidos = function() { return sumaPendiente($scope.cobrosVencidos()); };
  $scope.totalCobrosHoy      = function() { return sumaPendiente($scope.cobrosHoy()); };
  $scope.totalCobrosFuturos  = function() { return sumaPendiente($scope.cobrosFuturos()); };
  $scope.diasVencido = function(v) {
    var p = cobroFecha(v).split('-');
    var fc = new Date(+p[0], +p[1]-1, +p[2]);
    var hoy = new Date(); hoy.setHours(0,0,0,0);
    return Math.round((hoy - fc) / 86400000);
  };

  $scope.openVentaModal = function() {
    loadFragancias();
    $scope.newVenta = { cliente:'', valor_total:0, abono:0, fecha:toISO(new Date()), fecha_cobro:'', ya_pago:'false', items:[] };
    $scope.showVentaModal = true;
  };

  $scope.marcarPagado = function(v) {
    sbPatch('ventas_negocio', 'id=eq.' + v.id, { ya_pago: true, abono: +v.valor_total })
      .then(function() {
        $timeout(function() {
          v.ya_pago = true;
          v.abono   = +v.valor_total;
          loadVentasNegocio();
          showToast('Marcado como pagado ✓');
        });
      });
  };
  $scope.closeVentaModal = function() { $scope.showVentaModal = false; };
  $scope.addVentaItem    = function() { $scope.newVenta.items.push({ fragancia_id:'', cantidad:1 }); };
  $scope.removeVentaItem = function(idx) { $scope.newVenta.items.splice(idx,1); $scope.recalcularTotal(); };

  $scope.getFragancia = function(id) {
    return ($scope.fragancias||[]).find(function(f){ return f.id === id; }) || null;
  };

  function parseFraganciasDesc(desc) {
    if (!desc || desc.indexOf('?') !== -1 || desc.trim() === '') return [];
    return desc.split(', ').map(function(parte) {
      var xIdx = parte.lastIndexOf(' x');
      var nombre, cantidad;
      if (xIdx > 0 && !isNaN(parte.substring(xIdx + 2))) {
        nombre   = parte.substring(0, xIdx).trim();
        cantidad = +parte.substring(xIdx + 2);
      } else {
        nombre   = parte.trim();
        cantidad = 1;
      }
      var frag = ($scope.fragancias||[]).find(function(f) {
        return f.nombre.toLowerCase() === nombre.toLowerCase();
      });
      return { fragancia_id: frag ? frag.id : '', cantidad: cantidad };
    });
  }
  $scope.getStock = function(id) {
    var f = $scope.getFragancia(id);
    return f ? (+f.stock || 0) : 0;
  };
  $scope.getPrecioItem = function(item) {
    var f=$scope.getFragancia(item.fragancia_id);
    var precio=f?(+f.precio_venta||0):0;
    return precio*(+item.cantidad||0);
  };
  $scope.recalcularTotal = function() {
    $scope.newVenta.valor_total = $scope.newVenta.items.reduce(function(s,i){return s+$scope.getPrecioItem(i);},0);
  };
  $scope.onFraganciaSelect = function() { $scope.recalcularTotal(); };
  $scope.totalUnidadesVenta = function() {
    return ($scope.newVenta.items||[]).reduce(function(s,i){return s+(+i.cantidad||0);},0);
  };
  $scope.stockInsuficiente = function() {
    return ($scope.newVenta.items||[]).some(function(item) {
      if (!item.fragancia_id) return false;
      var f=$scope.getFragancia(item.fragancia_id);
      return f&&+item.cantidad>$scope.getStock(item.fragancia_id);
    });
  };

  $scope.saveVenta = function() {
    if (!$scope.newVenta.cliente||!$scope.newVenta.valor_total) return;
    if ($scope.stockInsuficiente()) return;
    $scope.savingVenta = true;
    var yaPago = $scope.newVenta.ya_pago==='true'||$scope.newVenta.ya_pago===true;
    var abono  = yaPago?+$scope.newVenta.valor_total:(+$scope.newVenta.abono||0);
    var desc = ($scope.newVenta.items||[])
      .filter(function(i){ return i.fragancia_id && $scope.getFragancia(i.fragancia_id); })
      .map(function(i){
        var f = $scope.getFragancia(i.fragancia_id);
        return f.nombre + (i.cantidad > 1 ? ' x' + i.cantidad : '');
      }).join(', ');
    sbPost('ventas_negocio',{
      usuario_id:$scope.currentUser.id, cliente:$scope.newVenta.cliente,
      cantidad:$scope.totalUnidadesVenta()||1, valor_total:+$scope.newVenta.valor_total,
      abono:abono, ya_pago:yaPago, fragancias_desc:desc, fecha:$scope.newVenta.fecha,
      fecha_cobro: $scope.newVenta.fecha_cobro || null
    }).then(function() {
      var stockPromises = ($scope.newVenta.items||[])
        .filter(function(i){ return i.fragancia_id && +i.cantidad > 0; })
        .map(function(i){
          var f = $scope.getFragancia(i.fragancia_id);
          if (!f) return Promise.resolve();
          var nuevoStock = Math.max(0, (+f.stock || 0) - +i.cantidad);
          f.stock = nuevoStock;
          return sbPatch('fragancias', 'id=eq.' + f.id, { stock: nuevoStock });
        });
      Promise.all(stockPromises).then(function(){
        $timeout(function(){
          $scope.savingVenta = false;
          $scope.showVentaModal = false;
          loadVentasNegocio();
          loadFragancias();
          showToast('Venta guardada · Stock descontado ✓');
        });
      });
    }).catch(function(e){$timeout(function(){$scope.savingVenta=false;showToast('Error al guardar: '+e.message,'err');});});
  };

  $scope.openAbonoModal = function(v) { $scope.abonoVenta=v; $scope.nuevoAbono=0; $scope.showAbonoModal=true; };
  $scope.saveAbono = function() {
    var total=+$scope.abonoVenta.abono+(+$scope.nuevoAbono);
    var yaPago=total>=(+$scope.abonoVenta.valor_total);
    sbPatch('ventas_negocio','id=eq.'+$scope.abonoVenta.id,{abono:total,ya_pago:yaPago})
      .then(function(){$timeout(function(){$scope.showAbonoModal=false;loadVentasNegocio();showToast('Abono registrado ✓');});});
  };

  $scope.deleteVenta = function(v) {
    if(!confirm('¿Eliminar venta de '+v.cliente+'? Se devolverá el stock.')) return;
    var items = parseFraganciasDesc(v.fragancias_desc);
    var restorePromises = items
      .filter(function(i){ return i.fragancia_id; })
      .map(function(i){
        var f = $scope.getFragancia(i.fragancia_id);
        if (!f) return Promise.resolve();
        var nuevoStock = (+f.stock || 0) + (+i.cantidad || 0);
        f.stock = nuevoStock;
        return sbPatch('fragancias', 'id=eq.' + f.id, { stock: nuevoStock });
      });
    Promise.all(restorePromises).then(function() {
      return sbDelete('ventas_negocio','id=eq.'+v.id);
    }).then(function(){
      $timeout(function(){
        loadVentasNegocio();
        loadFragancias();
        showToast('Venta eliminada · Stock devuelto ✓');
      });
    });
  };

  $scope.editVentaData = {}; $scope.showEditVentaModal = false; $scope.editingVenta = null;

  $scope.openEditVenta = function(v) {
    $scope.editingVenta = v;
    $scope.editVentaData = angular.copy(v);
    var rawFecha = v.fecha || v.creado_en || '';
    $scope.editVentaData.fecha = rawFecha ? String(rawFecha).substring(0, 10) : toISO(new Date());
    $scope.editVentaData.fecha_cobro = v.fecha_cobro ? String(v.fecha_cobro).substring(0, 10) : '';
    $scope.editVentaData.ya_pago = ($scope.editVentaData.ya_pago === true || $scope.editVentaData.ya_pago === 'true') ? 'true' : 'false';
    $scope.editVentaData.items = parseFraganciasDesc(v.fragancias_desc);
    if ($scope.editVentaData.items.length === 0) {
      $scope.editVentaData.items.push({ fragancia_id: '', cantidad: 1 });
    }
    $scope.showEditVentaModal = true;
  };

  $scope.recalcularTotalEdit = function() {
    var total = ($scope.editVentaData.items||[]).reduce(function(s,item){
      return s + $scope.getPrecioItem(item);
    }, 0);
    if (total > 0) $scope.editVentaData.valor_total = total;
  };

  $scope.saveEditVenta = function() {
    if (!$scope.editVentaData.cliente) return;
    var items = ($scope.editVentaData.items||[]).filter(function(i){ return i.fragancia_id && +i.cantidad>0; });
    var desc = items.map(function(i){
      var f = $scope.getFragancia(i.fragancia_id);
      return f ? f.nombre + (+i.cantidad>1?' x'+i.cantidad:'') : '';
    }).filter(Boolean).join(', ');
    var cantTotal = items.reduce(function(s,i){return s+(+i.cantidad||0);},0) || +$scope.editVentaData.cantidad || 1;
    var yaPago = $scope.editVentaData.ya_pago===true||$scope.editVentaData.ya_pago==='true';
    sbPatch('ventas_negocio','id=eq.'+$scope.editingVenta.id,{
      cliente: $scope.editVentaData.cliente,
      cantidad: cantTotal,
      valor_total: +$scope.editVentaData.valor_total,
      abono: +$scope.editVentaData.abono,
      ya_pago: yaPago,
      fragancias_desc: desc || '',
      fecha: $scope.editVentaData.fecha,
      fecha_cobro: $scope.editVentaData.fecha_cobro || null
    }).then(function(){
      $timeout(function(){
        $scope.showEditVentaModal=false;
        $scope.editingVenta=null;
        loadVentasNegocio();
        showToast('Venta actualizada ✓');
      });
    });
  };

  $scope.openFraganciaModal = function() {
    $scope.newFragancia={nombre:'',genero:'F',stock:0,precio_costo:0,precio_venta:0};
    $scope.showFraganciaModal=true;
  };
  $scope.saveFragancia = function() {
    if (!$scope.newFragancia.nombre) return;
    sbPost('fragancias',{
      usuario_id:   $scope.currentUser.id,
      nombre:       $scope.newFragancia.nombre.toUpperCase(),
      genero:       $scope.newFragancia.genero,
      stock:        +$scope.newFragancia.stock || 0,
      cantidad:     +$scope.newFragancia.cantidad || +$scope.newFragancia.stock || 0,
      precio_venta: +$scope.newFragancia.precio_venta || 0,
      activa:       true
    }).then(function(){$timeout(function(){$scope.showFraganciaModal=false;loadFragancias();showToast('Fragancia añadida ✓');});});
  };

  $scope.editingFragancia=null; $scope.showEditFragModal=false; $scope.editFragData={};
  $scope.openEditFragancia = function(f) {
    $scope.editingFragancia = f;
    $scope.editFragData = angular.copy(f);
    $scope.showEditFragModal = true;
  };
  $scope.saveEditFragancia = function() {
    if (!$scope.editingFragancia) return;
    sbPatch('fragancias','id=eq.'+$scope.editingFragancia.id,{
      nombre:       $scope.editFragData.nombre,
      genero:       $scope.editFragData.genero,
      stock:        +$scope.editFragData.stock || 0,
      cantidad:     +$scope.editFragData.cantidad || 0,
      precio_venta: +$scope.editFragData.precio_venta || 0
    }).then(function(){
      $timeout(function(){
        $scope.showEditFragModal=false;
        $scope.editingFragancia=null;
        loadFragancias();
        showToast('Fragancia actualizada ✓');
      });
    });
  };

  $scope.deleteFragancia = function(f) {
    if (!confirm('¿Eliminar ' + f.nombre + '?')) return;
    sbDelete('fragancias', 'id=eq.' + f.id)
      .then(function() { $timeout(function() { loadFragancias(); showToast('Fragancia eliminada'); }); });
  };

  // ── Resumen contable del negocio ──────────────────────
  // Costo = inversión en materiales repartida entre las unidades producidas (costo promedio).
  function memo(cache, list) {
    var sig = JSON.stringify(list);
    if (sig !== cache.sig) { cache.sig = sig; cache.val = list; }
    return cache.val;
  }
  var cDeudores = { sig: '', val: [] }, cTop = { sig: '', val: [] };
  $scope.unidadesProducidas = function() { return ($scope.fragancias || []).reduce(function(s, f) { return s + (+f.cantidad || +f.stock || 0); }, 0); };
  $scope.unidadesVendidas   = function() { return $scope.ventasNegocio.reduce(function(s, v) { return s + (+v.cantidad || 0); }, 0); };
  $scope.costoUnitario      = function() { var u = $scope.unidadesProducidas(); return u ? $scope.totalInversionMat() / u : 0; };
  $scope.costoVendido       = function() { return $scope.unidadesVendidas() * $scope.costoUnitario(); };
  $scope.utilidadEstimada   = function() { return $scope.totalVendido() - $scope.costoVendido(); };
  $scope.margenPct          = function() { var t = $scope.totalVendido(); return t ? Math.round($scope.utilidadEstimada() / t * 100) : 0; };
  $scope.recuperadoPct      = function() { var i = $scope.totalInversionMat(); return i ? Math.min(100, Math.round($scope.totalRecibido() / i * 100)) : 0; };
  $scope.valorInventario    = function() { return ($scope.fragancias || []).reduce(function(s, f) { return s + (+f.stock || 0) * (+f.precio_venta || 0); }, 0); };
  $scope.ventasDelMes = function() {
    var m = toISO(new Date()).substring(0, 7);
    return $scope.ventasNegocio.filter(function(v) { return String(v.fecha || v.creado_en || '').substring(0, 7) === m; })
      .reduce(function(s, v) { return s + (+v.valor_total || 0); }, 0);
  };
  $scope.stockBajo = function() { return ($scope.fragancias || []).filter(function(f) { return +f.stock < 3; }).sort(function(a, b) { return a.stock - b.stock; }); };
  $scope.deudores = function() {
    var map = {};
    $scope.ventasNegocio.forEach(function(v) {
      if (isPagado(v)) return;
      var d = (+v.valor_total || 0) - (+v.abono || 0);
      if (d > 0) map[v.cliente] = (map[v.cliente] || 0) + d;
    });
    return memo(cDeudores, Object.keys(map).map(function(k) { return { cliente: k, debe: map[k] }; }).sort(function(a, b) { return b.debe - a.debe; }).slice(0, 6));
  };
  $scope.masVendidas = function() {
    var map = {};
    $scope.ventasNegocio.forEach(function(v) {
      if (!v.fragancias_desc || v.fragancias_desc.indexOf('?') !== -1) return;
      v.fragancias_desc.split(', ').forEach(function(p) {
        var i = p.lastIndexOf(' x'), n = p, q = 1;
        if (i > 0 && !isNaN(p.substring(i + 2))) { n = p.substring(0, i); q = +p.substring(i + 2); }
        n = n.trim(); if (n) map[n] = (map[n] || 0) + q;
      });
    });
    return memo(cTop, Object.keys(map).map(function(k) { return { nombre: k, und: map[k] }; }).sort(function(a, b) { return b.und - a.und; }).slice(0, 5));
  };
  $scope.adjustStock = function(f, n) {
    var old = { stock: f.stock, cantidad: f.cantidad };
    var nuevo = Math.max(0, (+f.stock || 0) + n);
    var body = { stock: nuevo };
    if (nuevo > (+f.cantidad || 0)) body.cantidad = nuevo;
    f.stock = nuevo; if (body.cantidad) f.cantidad = body.cantidad;
    sbPatch('fragancias', 'id=eq.' + f.id, body).catch(function() {
      $timeout(function() { f.stock = old.stock; f.cantidad = old.cantidad; showToast('No se pudo actualizar el stock', 'err'); });
    });
  };

  // Mayoristas
  $scope.planLabel = function(plan) {
    return { '7a14':'Starter', '15a22':'Pro', '23mas':'Elite' }[plan] || plan;
  };

  $scope.editingMayorista = null;

  $scope.openMayoristaModal = function(plan, may) {
    $scope.editingMayorista = may || null;
    if (may) {
      $scope.newMayorista = angular.copy(may);
    } else {
      $scope.newMayorista = { nombre:'', telefono:'', ciudad:'', plan: plan || '7a14', estado:'activo', notas:'' };
    }
    $scope.showMayoristaModal = true;
  };

  $scope.saveMayorista = function() {
    if (!$scope.newMayorista.nombre) return;
    var body = {
      usuario_id: $scope.currentUser.id,
      nombre: $scope.newMayorista.nombre,
      telefono: $scope.newMayorista.telefono || '',
      ciudad: $scope.newMayorista.ciudad || '',
      plan: $scope.newMayorista.plan,
      estado: $scope.newMayorista.estado || 'activo',
      notas: $scope.newMayorista.notas || ''
    };
    var promise = $scope.editingMayorista
      ? sbPatch('mayoristas', 'id=eq.' + $scope.editingMayorista.id, body)
      : sbPost('mayoristas', Object.assign(body, { total_pedidos: 0, fecha_inicio: toISO(new Date()) }));
    promise.then(function() {
      $timeout(function() {
        var wasEditing = !!$scope.editingMayorista;
        $scope.showMayoristaModal = false;
        $scope.editingMayorista = null;
        loadMayoristas();
        showToast(wasEditing ? 'Revendedor actualizado ✓' : 'Revendedor registrado ✓');
      });
    });
  };

  $scope.deleteMayorista = function(m) {
    if (!confirm('¿Eliminar a ' + m.nombre + '?')) return;
    sbDelete('mayoristas', 'id=eq.' + m.id)
      .then(function() { $timeout(function() { loadMayoristas(); showToast('Eliminado'); }); });
  };

  $scope.openPedidoMayoristaModal = function(m) {
    $scope.pedidoMayoristaTarget = m;
    var precios = { '7a14': 14000, '15a22': 13000, '23mas': 12000 };
    $scope.newPedidoMay = {
      cantidad: null,
      precio_unitario: precios[m.plan] || 13000,
      abono: 0,
      fecha: toISO(new Date()),
      estado: 'pendiente'
    };
    $scope.showPedidoMayModal = true;
  };

  $scope.savePedidoMayorista = function() {
    if (!$scope.newPedidoMay.cantidad || !$scope.newPedidoMay.precio_unitario) return;
    var total = $scope.newPedidoMay.cantidad * $scope.newPedidoMay.precio_unitario;
    var target = $scope.pedidoMayoristaTarget;
    sbPost('pedidos_mayorista', {
      mayorista_id: $scope.pedidoMayoristaTarget.id,
      usuario_id: $scope.currentUser.id,
      cantidad: +$scope.newPedidoMay.cantidad,
      precio_unitario: +$scope.newPedidoMay.precio_unitario,
      abono: +$scope.newPedidoMay.abono || 0,
      estado: $scope.newPedidoMay.estado,
      fecha: $scope.newPedidoMay.fecha
    }).then(function() {
      var nuevoTotal = (+target.total_pedidos || 0) + total;
      return sbPatch('mayoristas', 'id=eq.' + target.id, { total_pedidos: nuevoTotal });
    }).then(function() {
      $timeout(function() {
        $scope.showPedidoMayModal = false;
        loadMayoristas(); loadPedidosMay();
        showToast('Pedido registrado ✓');
      });
    }).catch(function() { $timeout(function() { showToast('Error al guardar el pedido', 'err'); }); });
  };

  // ── Pedidos de mayoristas ──
  $scope.pedidosMay = [];
  function loadPedidosMay() {
    if (!$scope.currentUser) return;
    sbGet('pedidos_mayorista', { usuario_id: 'eq.' + $scope.currentUser.id, select: '*', order: 'fecha.desc' })
      .then(function(rows) { $timeout(function() { $scope.pedidosMay = rows || []; }); })
      .catch(function() {});
  }
  $scope.pedidosDe = function(m) { return $scope.pedidosMay.filter(function(p) { return p.mayorista_id === m.id; }); };
  $scope.pedTotal  = function(p) { return (+p.cantidad || 0) * (+p.precio_unitario || 0); };
  $scope.pedDebe   = function(p) { return Math.max(0, $scope.pedTotal(p) - (+p.abono || 0)); };
  $scope.mayTotal  = function(m) {
    var l = $scope.pedidosDe(m);
    return l.length ? l.reduce(function(s, p) { return s + $scope.pedTotal(p); }, 0) : (+m.total_pedidos || 0);
  };
  $scope.mayDebe   = function(m) { return $scope.pedidosDe(m).reduce(function(s, p) { return s + $scope.pedDebe(p); }, 0); };
  $scope.mayUnidades = function(m) { return $scope.pedidosDe(m).reduce(function(s, p) { return s + (+p.cantidad || 0); }, 0); };
  $scope.mayVendidoTotal = function() { return $scope.pedidosMay.reduce(function(s, p) { return s + $scope.pedTotal(p); }, 0); };
  $scope.mayDebeTotal    = function() { return $scope.pedidosMay.reduce(function(s, p) { return s + $scope.pedDebe(p); }, 0); };
  $scope.mayActivos      = function() { return $scope.mayoristas.filter(function(m) { return m.estado === 'activo'; }).length; };
  $scope.cyclePedidoEstado = function(p) {
    var next = { pendiente: 'enviado', enviado: 'entregado', entregado: 'pendiente' }[p.estado] || 'pendiente';
    var old = p.estado; p.estado = next;
    sbPatch('pedidos_mayorista', 'id=eq.' + p.id, { estado: next }).catch(function() { $timeout(function() { p.estado = old; showToast('No se pudo actualizar', 'err'); }); });
  };
  $scope.pagarPedido = function(p) {
    var old = p.abono; p.abono = $scope.pedTotal(p);
    sbPatch('pedidos_mayorista', 'id=eq.' + p.id, { abono: p.abono }).then(function() { $timeout(function() { showToast('Pedido pagado ✓'); }); })
      .catch(function() { $timeout(function() { p.abono = old; showToast('No se pudo guardar', 'err'); }); });
  };
  $scope.showPedAbonoModal = false; $scope.pedAbono = { p: null, monto: 0 };
  $scope.openPedAbono = function(p) { $scope.pedAbono = { p: p, monto: 0 }; $scope.showPedAbonoModal = true; };
  $scope.savePedAbono = function() {
    var p = $scope.pedAbono.p, total = (+p.abono || 0) + (+$scope.pedAbono.monto || 0);
    if (!(+$scope.pedAbono.monto > 0)) return;
    sbPatch('pedidos_mayorista', 'id=eq.' + p.id, { abono: total }).then(function() {
      $timeout(function() { p.abono = total; $scope.showPedAbonoModal = false; showToast('Abono registrado ✓'); });
    }).catch(function() { $timeout(function() { showToast('No se pudo guardar', 'err'); }); });
  };
  $scope.deletePedido = function(p) {
    if (!confirm('¿Eliminar este pedido?')) return;
    sbDelete('pedidos_mayorista', 'id=eq.' + p.id).then(function() {
      $timeout(function() { loadPedidosMay(); showToast('Pedido eliminado', 'ok', undoInsert('pedidos_mayorista', p, loadPedidosMay, 'Pedido')); });
    });
  };
  $scope.toggleRev = function(m) { m._open = !m._open; };
  function waNum(m) { var d = String(m.telefono || '').replace(/\D/g, ''); if (d.length === 10) d = '57' + d; return d; }
  $scope.waLink = function(m) { var n = waNum(m); return n ? 'https://wa.me/' + n : ''; };
  $scope.waCobro = function(m) {
    var n = waNum(m); if (!n) return '';
    var debe = $scope.mayDebe(m);
    var msg = 'Hola ' + m.nombre + ', ' + (debe > 0 ? 'te escribo para recordarte el saldo pendiente de $' + Number(debe).toLocaleString('es-CO') + '. ¡Gracias!' : 'quería saber cómo vas con tus ventas. ¡Gracias!');
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg);
  };

  // ── PRODUCCIÓN ───────────────────────────────────────

  $scope.prodTab      = 'materiales';
  $scope.matCatFilter = 'todos';
  $scope.materiales   = [];
  $scope.loadingMat   = false;
  $scope.showMatModal = false;
  $scope.editingMat   = null;
  $scope.newMat       = {};

  $scope.matCats = [
    { key: 'todos',    label: 'Todos' },
    { key: 'esencia',  label: 'Esencias' },
    { key: 'feromona', label: 'Feromonas' },
    { key: 'alcohol',  label: 'Alcohol' },
    { key: 'frasco',   label: 'Frascos' },
    { key: 'empaque',  label: 'Empaque' },
    { key: 'otro',     label: 'Otros' }
  ];

  $scope.filteredMateriales = function() {
    if ($scope.matCatFilter === 'todos') return $scope.materiales;
    return $scope.materiales.filter(function(m) { return m.categoria === $scope.matCatFilter; });
  };

  function loadMateriales() {
    if (!$scope.currentUser) return;
    $scope.loadingMat = true;
    sbGet('materiales', { usuario_id: 'eq.' + $scope.currentUser.id, select: '*', order: 'categoria.asc,nombre.asc' })
      .then(function(rows) {
        $timeout(function() { $scope.materiales = rows || []; $scope.loadingMat = false; });
      }).catch(function() { $timeout(function() { $scope.loadingMat = false; }); });
  }

  $scope.totalInversionMat = function() {
    return $scope.materiales.reduce(function(s, m) { return s + (+m.precio_total || 0); }, 0);
  };

  $scope.openMatModal = function(m) {
    $scope.editingMat = m || null;
    $scope.newMat = m ? angular.copy(m) : { nombre:'', categoria:'esencia', unidad:'g', cantidad_total:0, precio_total:0, cantidad_disponible:0 };
    $scope.showMatModal = true;
  };

  $scope.saveMaterial = function() {
    if (!$scope.newMat.nombre) return;
    var body = {
      usuario_id: $scope.currentUser.id,
      nombre: $scope.newMat.nombre,
      categoria: $scope.newMat.categoria,
      unidad: $scope.newMat.unidad,
      cantidad_total: +$scope.newMat.cantidad_total || 0,
      cantidad_disponible: +$scope.newMat.cantidad_disponible || +$scope.newMat.cantidad_total || 0,
      precio_total: +$scope.newMat.precio_total || 0
    };
    var promise = $scope.editingMat
      ? sbPatch('materiales', 'id=eq.' + $scope.editingMat.id, body)
      : sbPost('materiales', body);
    promise.then(function() {
      $timeout(function() {
        $scope.showMatModal = false;
        $scope.editingMat = null;
        loadMateriales();
        showToast('Material guardado ✓');
      });
    });
  };

  $scope.deleteMaterial = function(m) {
    if (!confirm('¿Eliminar ' + m.nombre + '?')) return;
    sbDelete('materiales', 'id=eq.' + m.id)
      .then(function() { $timeout(function() { loadMateriales(); showToast('Eliminado'); }); });
  };

}]);