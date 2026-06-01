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

function sbGet(table, params) {
  var qs = Object.entries(params || {}).map(function(e) { return e[0] + '=' + encodeURIComponent(e[1]); }).join('&');
  return fetch(SUPA_URL + '/rest/v1/' + table + (qs ? '?' + qs : ''), { headers: sbHeaders() })
    .then(function(r) { return r.json(); });
}

function sbPost(table, body) {
  return fetch(SUPA_URL + '/rest/v1/' + table, {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify(body)
  }).then(function(r) { return r.json(); });
}

function sbPatch(table, filter, body) {
  return fetch(SUPA_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(body)
  }).then(function(r) { return r.ok ? r.json().catch(function() { return []; }) : r.json(); });
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
  $scope.activeView  = 'agenda';
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
  function showToast(msg, type) {
    $scope.toast = { show: true, msg: msg, type: type || 'ok' };
    $timeout(function() { $scope.toast.show = false; }, 3000);
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
    loadRecetas();
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
        $timeout(function() { $scope.tasks = rows || []; $scope.loadingTasks = false; });
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
    var promise = $scope.editingEvent
      ? sbPatch('eventos', 'id=eq.' + $scope.editingEvent.id, body)
      : sbPost('eventos', body);
    promise.then(function() {
      $timeout(function() {
        var wasEditing = !!$scope.editingEvent;
        $scope.savingEvent = false;
        $scope.showEventModal = false;
        $scope.editingEvent = null;
        loadEvents();
        showToast(wasEditing ? 'Evento actualizado ✓' : 'Evento guardado ✓');
      });
    }).catch(function() {
      $timeout(function() { $scope.savingEvent = false; showToast('Error al guardar', 'err'); });
    });
  };

  $scope.deleteEvent = function(ev, $event) {
    if ($event) $event.stopPropagation();
    sbDelete('eventos', 'id=eq.' + ev.id).then(function() {
      $timeout(function() { loadEvents(); showToast('Evento eliminado'); });
    });
  };

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
    var nuevoValor = !t.completada;
    sbPatch('tareas', 'id=eq.' + t.id, { completada: nuevoValor }).then(function() {
      $timeout(function() { loadTasks(); });
    });
  };

  $scope.deleteTask = function(t) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    sbDelete('tareas', 'id=eq.' + t.id).then(function() {
      $timeout(function() { loadTasks(); showToast('Tarea eliminada'); });
    });
  };

  // ── Finanzas ──────────────────────────────────────────
  $scope.totalIncome  = function() { return $scope.transactions.filter(function(t) { return t.tipo==='ingreso'; }).reduce(function(s,t) { return s+(+t.monto||0); }, 0); };
  $scope.totalExpense = function() { return $scope.transactions.filter(function(t) { return t.tipo==='gasto';   }).reduce(function(s,t) { return s+(+t.monto||0); }, 0); };
  $scope.balance      = function() { return $scope.totalIncome() - $scope.totalExpense(); };
  $scope.savingsRate  = function() { var i=$scope.totalIncome(); return i ? Math.max(0,Math.round($scope.balance()/i*100)) : 0; };
  $scope.spentPct     = function() { var i=$scope.totalIncome(); return i ? Math.min(Math.round($scope.totalExpense()/i*100),100) : 0; };

  $scope.filteredTrans = function() {
    if ($scope.transFilter === 'historial') return [];
    if ($scope.transFilter === 'todos') return $scope.transactions;
    return $scope.transactions.filter(function(t) { return t.tipo === $scope.transFilter; });
  };

  $scope.expenseByCategory = function() {
    var map = {};
    $scope.transactions.filter(function(t) { return t.tipo==='gasto'; }).forEach(function(t) {
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
      $timeout(function() { loadTrans(); showToast('Eliminado'); });
    });
  };

  $scope.setView = function(v) {
    $scope.activeView = v;
    if (v === 'dashboard') pickQuote();
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

  $scope.eventsToday = function() {
    return $scope.eventsForDay(new Date()).length;
  };

  $scope.urgentTasks = function() {
    return $scope.tasks.filter(function(t) {
      return !t.completada && (t.prioridad === 'alta' || t.prioridad === 'media');
    }).sort(function(a,b) {
      var p = {alta:0,media:1,baja:2};
      return (p[a.prioridad]||2) - (p[b.prioridad]||2);
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
    var now = new Date();
    var meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    $scope.cerrarMesLabel = meses[now.getMonth()] + ' ' + now.getFullYear();
    $scope.showCerrarMesModal = true;
  };

  $scope.cerrarMes = function() {
    if (!$scope.cerrarMesLabel || $scope.savingCierre) return;
    $scope.savingCierre = true;
    var ingresos = $scope.totalIncome();
    var gastos   = $scope.totalExpense();
    var balance  = $scope.balance();
    var ahorro   = $scope.savingsRate();

    sbPost('historial_meses', {
      usuario_id:         $scope.currentUser.id,
      mes_label:          $scope.cerrarMesLabel,
      ingresos:           ingresos,
      gastos:             gastos,
      balance:            balance,
      tasa_ahorro:        ahorro,
      transacciones_json: $scope.transactions
    }).then(function() {
      return sbDelete('transacciones', 'usuario_id=eq.' + $scope.currentUser.id);
    }).then(function() {
      $timeout(function() {
        $scope.savingCierre = false;
        $scope.showCerrarMesModal = false;
        $scope.transactions = [];
        $scope.transFilter = 'historial';
        _loadHistorial();
        showToast('✓ Mes cerrado y guardado');
      });
    }).catch(function() {
      $timeout(function() {
        $scope.savingCierre = false;
        showToast('Error al cerrar mes', 'err');
      });
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
    if ($scope.ventaFilter==='pagadas') return $scope.ventasNegocio.filter(function(v){ return isPagado(v); });
    if ($scope.ventaFilter==='deben')   return $scope.ventasNegocio.filter(function(v){ return !isPagado(v); });
    return $scope.ventasNegocio;
  };

  $scope.openVentaModal = function() {
    loadFragancias();
    $scope.newVenta = { cliente:'', valor_total:0, abono:0, fecha:toISO(new Date()), ya_pago:'false', items:[] };
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
      abono:abono, ya_pago:yaPago, fragancias_desc:desc, fecha:$scope.newVenta.fecha
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
    }).catch(function(){$timeout(function(){$scope.savingVenta=false;showToast('Error','err');});});
  };

  $scope.openAbonoModal = function(v) { $scope.abonoVenta=v; $scope.nuevoAbono=0; $scope.showAbonoModal=true; };
  $scope.saveAbono = function() {
    var total=+$scope.abonoVenta.abono+(+$scope.nuevoAbono);
    var yaPago=total>=(+$scope.abonoVenta.valor_total);
    sbPatch('ventas_negocio','id=eq.'+$scope.abonoVenta.id,{abono:total,ya_pago:yaPago})
      .then(function(){$timeout(function(){$scope.showAbonoModal=false;loadVentasNegocio();showToast('Abono registrado ✓');});});
  };

  $scope.deleteVenta = function(v) {
    if(!confirm('¿Eliminar venta de '+v.cliente+'?')) return;
    sbDelete('ventas_negocio','id=eq.'+v.id)
      .then(function(){$timeout(function(){loadVentasNegocio();showToast('Venta eliminada');});});
  };

  $scope.editVentaData = {}; $scope.showEditVentaModal = false; $scope.editingVenta = null;

  $scope.openEditVenta = function(v) {
    $scope.editingVenta = v;
    $scope.editVentaData = angular.copy(v);
    var rawFecha = v.fecha || v.creado_en || '';
    $scope.editVentaData.fecha = rawFecha ? String(rawFecha).substring(0, 10) : toISO(new Date());
    $scope.editVentaData.ya_pago = ($scope.editVentaData.ya_pago === true || $scope.editVentaData.ya_pago === 'true') ? 'true' : 'false';
    $scope.editVentaData.items = [];
    if (v.fragancias_desc && v.fragancias_desc.indexOf('?') === -1 && v.fragancias_desc.trim() !== '') {
      var partes = v.fragancias_desc.split(', ');
      partes.forEach(function(parte) {
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
        $scope.editVentaData.items.push({ fragancia_id: frag ? frag.id : '', cantidad: cantidad });
      });
    }
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
      fecha: $scope.editVentaData.fecha
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
    sbPost('pedidos_mayorista', {
      mayorista_id: $scope.pedidoMayoristaTarget.id,
      usuario_id: $scope.currentUser.id,
      cantidad: +$scope.newPedidoMay.cantidad,
      precio_unitario: +$scope.newPedidoMay.precio_unitario,
      abono: +$scope.newPedidoMay.abono || 0,
      estado: $scope.newPedidoMay.estado,
      fecha: $scope.newPedidoMay.fecha
    }).then(function() {
      var nuevoTotal = (+$scope.pedidoMayoristaTarget.total_pedidos || 0) + total;
      sbPatch('mayoristas', 'id=eq.' + $scope.pedidoMayoristaTarget.id, { total_pedidos: nuevoTotal });
      $timeout(function() {
        $scope.showPedidoMayModal = false;
        loadMayoristas();
        showToast('Pedido registrado ✓');
      });
    });
  };

  // ── PRODUCCIÓN ───────────────────────────────────────

  $scope.prodTab      = 'materiales';
  $scope.matCatFilter = 'todos';
  $scope.materiales   = [];
  $scope.recetas      = [];
  $scope.loadingMat   = false;
  $scope.loadingRec   = false;
  $scope.loadingIng   = false;
  $scope.showMatModal = false;
  $scope.showRecModal = false;
  $scope.showIngModal = false;
  $scope.editingMat   = null;
  $scope.editingRec   = null;
  $scope.newMat       = {};
  $scope.newRec       = {};
  $scope.ingredientesVer = [];
  $scope.verIngRec    = {};

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

  function loadRecetas() {
    if (!$scope.currentUser) return;
    $scope.loadingRec = true;
    sbGet('receta_fragancia', { usuario_id: 'eq.' + $scope.currentUser.id, select: '*', order: 'nombre.asc' })
      .then(function(rows) {
        $timeout(function() {
          $scope.recetas = rows || [];
          $scope.loadingRec = false;
          $scope.recetas.forEach(function(r) { loadIngredientesReceta(r); });
        });
      }).catch(function() { $timeout(function() { $scope.loadingRec = false; }); });
  }

  var ingCache = {};

  function safeIngCache() {
    if (typeof ingCache !== 'object' || ingCache === null) ingCache = {};
    return ingCache;
  }

  function loadIngredientesReceta(r) {
    sbGet('receta_ingrediente', { receta_id: 'eq.' + r.id, select: '*' }).then(function(rows) {
      $timeout(function() { safeIngCache()[r.id] = rows || []; });
    });
  }

  $scope.getMaterial = function(id) {
    return $scope.materiales.find(function(m) { return m.id === id; }) || null;
  };

  $scope.getStockInventario = function(nombre) {
    var frag = ($scope.fragancias||[]).find(function(f) {
      return f.nombre.toLowerCase() === (nombre || '').toLowerCase();
    });
    return frag ? (+frag.stock || 0) : 0;
  };

  $scope.getMatUnidad = function(id) {
    var m = $scope.getMaterial(id);
    return m ? m.unidad : '';
  };

  $scope.costoProduccion = function(r) {
    var ings = (safeIngCache()[r.id] || []).filter(function(i) {
      var m = $scope.getMaterial(i.material_id);
      return m && (m.categoria === 'esencia' || m.categoria === 'feromona' || m.categoria === 'alcohol');
    });
    return ings.reduce(function(s, i) {
      var m = $scope.getMaterial(i.material_id);
      return s + (m ? +m.precio_por_unidad * +i.cantidad_usada : 0);
    }, 0);
  };

  $scope.costoEmpaque = function(r) {
    var ings = (safeIngCache()[r.id] || []).filter(function(i) {
      var m = $scope.getMaterial(i.material_id);
      return m && (m.categoria === 'frasco' || m.categoria === 'empaque');
    });
    return ings.reduce(function(s, i) {
      var m = $scope.getMaterial(i.material_id);
      return s + (m ? +m.precio_por_unidad * +i.cantidad_usada : 0);
    }, 0);
  };

  $scope.costoTotal = function(r) { return $scope.costoProduccion(r) + $scope.costoEmpaque(r); };
  $scope.gananciaUnitaria = function(r) { return (+r.precio_venta || 0) - $scope.costoTotal(r); };
  $scope.gananciaTotalLote = function(r) { return $scope.gananciaUnitaria(r) * (+r.stock || 0); };
  $scope.margenPct = function(r) {
    var venta = +r.precio_venta || 0;
    return venta > 0 ? Math.round($scope.gananciaUnitaria(r) / venta * 100) : 0;
  };
  $scope.margenClass = function(r) {
    var m = $scope.margenPct(r);
    if (m >= 40) return 'margen-ok';
    if (m >= 20) return 'margen-low';
    return 'margen-neg';
  };

  $scope.totalCostoProduccionGeneral = function() {
    return $scope.recetas.reduce(function(s, r) { return s + $scope.costoTotal(r) * (+r.stock || 0); }, 0);
  };
  $scope.totalStockGeneral = function() {
    return $scope.recetas.reduce(function(s, r) { return s + (+r.stock || 0); }, 0);
  };
  $scope.totalGananciaGeneral = function() {
    return $scope.recetas.reduce(function(s, r) { return s + $scope.gananciaTotalLote(r); }, 0);
  };
  $scope.margenGeneral = function() {
    var ventas = $scope.recetas.reduce(function(s, r) { return s + (+r.precio_venta || 0) * (+r.stock || 0); }, 0);
    return ventas > 0 ? Math.round($scope.totalGananciaGeneral() / ventas * 100) : 0;
  };

  $scope.totalInversionMat = function() {
    return $scope.materiales.reduce(function(s, m) { return s + (+m.precio_total || 0); }, 0);
  };
  $scope.costoEstimadoPorFrasco = function() {
    if (!$scope.recetas.length) return 0;
    var total = $scope.recetas.reduce(function(s, r) { return s + $scope.costoTotal(r); }, 0);
    return Math.round(total / $scope.recetas.length);
  };
  $scope.margenEstimado = function() {
    if (!$scope.recetas.length) return 0;
    var total = $scope.recetas.reduce(function(s, r) { return s + $scope.margenPct(r); }, 0);
    return Math.round(total / $scope.recetas.length);
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

  $scope.openRecetaModal = function(r) {
    $scope.editingRec = r || null;
    if (r) {
      $scope.newRec = { id: r.id, nombre: r.nombre, genero: r.genero, ml: r.ml, precio_venta: r.precio_venta, stock: r.stock, ingredientes: [] };
      var ings = safeIngCache()[r.id] || [];
      $scope.newRec.ingredientes = ings.map(function(i) {
        return { material_id: i.material_id, cantidad_usada: i.cantidad_usada };
      });
      if (!ings.length) {
        sbGet('receta_ingrediente', { receta_id: 'eq.' + r.id, select: '*' })
          .then(function(rows) {
            safeIngCache()[r.id] = rows || [];
            $scope.$apply(function() {
              $scope.newRec.ingredientes = (rows || []).map(function(i) {
                return { material_id: i.material_id, cantidad_usada: i.cantidad_usada };
              });
            });
          });
      }
    } else {
      $scope.newRec = { nombre:'', genero:'F', ml:30, precio_venta:0, stock:0, ingredientes:[] };
    }
    $scope.showRecModal = true;
  };

  $scope.addIngrediente = function() {
    $scope.newRec.ingredientes = $scope.newRec.ingredientes || [];
    $scope.newRec.ingredientes.push({ material_id:'', cantidad_usada:0 });
  };

  $scope.removeIngrediente = function(idx) { $scope.newRec.ingredientes.splice(idx, 1); };

  $scope.ingCosto = function(ing) {
    var m = $scope.getMaterial(ing.material_id);
    return m ? Math.round(+m.precio_por_unidad * +ing.cantidad_usada) : 0;
  };

  $scope.costoTotalNueva = function() {
    return ($scope.newRec.ingredientes || []).reduce(function(s, i) { return s + $scope.ingCosto(i); }, 0);
  };

  $scope.margenNueva = function() {
    var v = +$scope.newRec.precio_venta || 0;
    var ganancia = v - $scope.costoTotalNueva();
    return v > 0 ? Math.round((ganancia / v) * 100) : 0;
  };

  $scope.saveReceta = function() {
    if (!$scope.newRec.nombre) return;
    var body = {
      usuario_id: $scope.currentUser.id,
      nombre: $scope.newRec.nombre,
      genero: $scope.newRec.genero || 'F',
      ml: +$scope.newRec.ml || 30,
      precio_venta: +$scope.newRec.precio_venta || 0,
      stock: +$scope.newRec.stock || 0,
      activa: true
    };
    var promise = $scope.editingRec
      ? sbPatch('receta_fragancia', 'id=eq.' + $scope.editingRec.id, body)
      : sbPost('receta_fragancia', body);
    promise.then(function(res) {
      var recId = $scope.editingRec ? $scope.editingRec.id : (res && res[0] ? res[0].id : null);
      if (recId && $scope.newRec.ingredientes && $scope.newRec.ingredientes.length) {
        var deletePromise = $scope.editingRec
          ? sbDelete('receta_ingrediente', 'receta_id=eq.' + recId)
          : Promise.resolve();
        deletePromise.then(function() {
          var ingPromises = $scope.newRec.ingredientes
            .filter(function(i) { return i.material_id && i.cantidad_usada > 0; })
            .map(function(i) {
              return sbPost('receta_ingrediente', { receta_id: recId, material_id: i.material_id, cantidad_usada: +i.cantidad_usada });
            });
          Promise.all(ingPromises).then(function() {
            $timeout(function() {
              $scope.showRecModal = false;
              $scope.editingRec = null;
              ingCache = {};
              loadRecetas();
              showToast('Receta guardada ✓');
            });
          });
        });
      } else {
        $timeout(function() {
          $scope.showRecModal = false;
          $scope.editingRec = null;
          loadRecetas();
          showToast('Receta guardada ✓');
        });
      }
    });
  };

  $scope.deleteReceta = function(r) {
    if (!confirm('¿Eliminar receta de ' + r.nombre + '?')) return;
    sbDelete('receta_fragancia', 'id=eq.' + r.id)
      .then(function() { $timeout(function() { delete safeIngCache()[r.id]; loadRecetas(); showToast('Eliminada'); }); });
  };

  $scope.copiarReceta = function(r) {
    $scope.editingRec = null;
    $scope.newRec = { nombre: 'Copia de ' + r.nombre, genero: r.genero, ml: r.ml, precio_venta: r.precio_venta, stock: 0, ingredientes: [] };
    var ings = safeIngCache()[r.id] || [];
    $scope.newRec.ingredientes = ings.map(function(i) {
      return { material_id: i.material_id, cantidad_usada: i.cantidad_usada };
    });
    if (!ings.length) {
      sbGet('receta_ingrediente', { receta_id: 'eq.' + r.id, select: '*' })
        .then(function(rows) {
          safeIngCache()[r.id] = rows || [];
          $scope.$apply(function() {
            $scope.newRec.ingredientes = (rows || []).map(function(i) {
              return { material_id: i.material_id, cantidad_usada: i.cantidad_usada };
            });
          });
        });
    }
    $scope.showRecModal = true;
    showToast('Receta copiada — ajusta el nombre y guarda ✓');
  };

  $scope.verIngredientes = function(r) {
    $scope.verIngRec = r;
    $scope.ingredientesVer = [];
    $scope.loadingIng = true;
    $scope.showIngModal = true;
    sbGet('receta_ingrediente', { receta_id: 'eq.' + r.id, select: '*' })
      .then(function(rows) {
        $timeout(function() {
          $scope.ingredientesVer = (rows || []).map(function(i) {
            var m = $scope.getMaterial(i.material_id);
            return {
              mat_nombre: m ? m.nombre : '—',
              mat_unidad: m ? m.unidad : '',
              cantidad_usada: i.cantidad_usada,
              costo: m ? Math.round(+m.precio_por_unidad * +i.cantidad_usada) : 0
            };
          });
          $scope.loadingIng = false;
        });
      });
  };

  $scope.totalIngCostVer = function() {
    return $scope.ingredientesVer.reduce(function(s, i) { return s + i.costo; }, 0);
  };

}]);