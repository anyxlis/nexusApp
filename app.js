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

// ── Simple hash (no crypto API needed for demo; use bcrypt server-side in prod) ──
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

  $scope.cellH   = 60;   // px por hora en la grilla
  $scope.gridStart = 6;  // hora inicio grilla (6am)
  $scope.gridEnd   = 23; // hora fin grilla (11pm)
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

  // ── Toast ─────────────────────────────────────────────
  function showToast(msg, type) {
    $scope.toast = { show: true, msg: msg, type: type || 'ok' };
    $timeout(function() { $scope.toast.show = false; }, 3000);
  }

  // ── Session (localStorage) ────────────────────────────
  function saveSession(user) {
    try { localStorage.setItem('nexus_user', JSON.stringify(user)); } catch(e) {}
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem('nexus_user');
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
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

  // Click en celda vacia de la grilla -> abre modal con esa fecha y hora
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
      // Supabase devuelve HH:MM:SS — recortar a HH:MM para input[type=time]
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
      $scope.newEvent.hora_inicio = $scope.newEvent.hora_inicio || '09:00';
      $scope.newEvent.hora_fin    = $scope.newEvent.hora_fin    || '10:00';
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

    var promise;
    if ($scope.editingEvent) {
      promise = sbPatch('eventos', 'id=eq.' + $scope.editingEvent.id, body);
    } else {
      promise = sbPost('eventos', body);
    }

    promise.then(function() {
      $timeout(function() {
        $scope.savingEvent = false;
        $scope.showEventModal = false;
        $scope.editingEvent = null;
        loadEvents();
        showToast($scope.editingEvent ? 'Evento actualizado' : 'Evento guardado');
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

  // ── Weekly grid block position ────────────────────────
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
    sbPatch('tareas', 'id=eq.' + t.id, { completada: !t.completada }).then(function() {
      $timeout(function() { t.completada = !t.completada; });
    });
  };

  $scope.deleteTask = function(t) {
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

  $scope.openTransModal = function(tipo) {
    $scope.newTrans = {
      tipo: tipo,
      descripcion: '',
      monto: null,
      fecha: toISO(new Date()),
      categoria: tipo === 'ingreso' ? 'Salario' : 'Alimentación'
    };
    $scope.showTransModal = true;
  };

  $scope.closeTransModal = function() { $scope.showTransModal = false; };

  $scope.saveTrans = function() {
    if (!$scope.newTrans.descripcion || !$scope.newTrans.monto) return;
    $scope.savingTrans = true;
    sbPost('transacciones', {
      usuario_id: $scope.currentUser.id,
      tipo: $scope.newTrans.tipo,
      monto: +$scope.newTrans.monto,
      descripcion: $scope.newTrans.descripcion,
      categoria: $scope.newTrans.categoria,
      fecha: $scope.newTrans.fecha
    }).then(function() {
      $timeout(function() {
        $scope.savingTrans = false;
        $scope.showTransModal = false;
        loadTrans();
        showToast('Transacción guardada');
      });
    }).catch(function() {
      $timeout(function() { $scope.savingTrans = false; showToast('Error al guardar', 'err'); });
    });
  };

  $scope.deleteTrans = function(t) {
    sbDelete('transacciones', 'id=eq.' + t.id).then(function() {
      $timeout(function() { loadTrans(); showToast('Eliminado'); });
    });
  };

  $scope.setView = function(v) { $scope.activeView = v; };

}]);