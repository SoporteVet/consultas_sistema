// ==================== MÓDULO DE CONTROL DE VACUNAS ====================

// Función de navegación a la sección de vacunas
window.navigateToVacunas = function(sectionId, buttonId) {
  console.log('Navegando a Control de Vacunas...');
  
  // Ocultar todas las secciones
  document.querySelectorAll('.content section').forEach(section => {
    section.classList.remove('active');
    section.classList.add('hidden');
  });
  
  // Mostrar la sección de vacunas
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.remove('hidden');
    section.classList.add('active');
    console.log('Sección vacunas mostrada');
  } else {
    console.error('No se encontró la sección:', sectionId);
  }
  
  // Actualizar botón activo
  const allButtons = document.querySelectorAll('nav button, .submenu-btn');
  allButtons.forEach(btn => btn.classList.remove('active'));
  const button = document.getElementById(buttonId);
  if (button) {
    button.classList.add('active');
    console.log('Botón vacunas activado');
  } else {
    console.error('No se encontró el botón:', buttonId);
  }
  
  // Cerrar sidebar en móviles
  if (window.innerWidth <= 980) {
    closeSidebar();
  }
  
  // Inicializar el módulo de vacunas
  initializeVacunasModule();
};

// Variables globales para el módulo de vacunas
let currentVacunasFecha = '';
let currentVacunasTurno = '';
let inventarioActual = {};
/** Lecturas planas de temperatura (consulta por rango de fechas). Las lecturas antiguas pueden estar en vacunasTemperatura/{fecha_turno}. */
const VACUNAS_TEMP_LECTURAS_REF = 'vacunasTemperaturaLecturas';

// Función para sanitizar claves de Firebase
function sanitizeFirebaseKey(key) {
  return key.replace(/[.#$/[\]]/g, '_');
}

// Función para habilitar/deshabilitar inputs de inventario
function habilitarInputsInventario(habilitar) {
  // Vacunas anuales
  vacunasDisponibles.anual.forEach(vacuna => {
    let inputId = `inventario${vacuna.replace(/\s+/g, '').replace(/\//g, '')}`;
    const input = document.getElementById(inputId);
    if (input) {
      input.disabled = !habilitar;
      input.style.opacity = habilitar ? '1' : '0.6';
      input.style.cursor = habilitar ? 'text' : 'not-allowed';
    }
  });
  
  // Vacunas trimestrales
  vacunasDisponibles.trimestral.forEach(vacuna => {
    const inputId = `inventario${vacuna.replace(/\s+/g, '').replace(/\//g, '')}`;
    const input = document.getElementById(inputId);
    if (input) {
      input.disabled = !habilitar;
      input.style.opacity = habilitar ? '1' : '0.6';
      input.style.cursor = habilitar ? 'text' : 'not-allowed';
    }
  });
  
  // Input de responsable
  const responsableInput = document.getElementById('responsableApertura');
  if (responsableInput) {
    responsableInput.disabled = !habilitar;
    responsableInput.style.opacity = habilitar ? '1' : '0.6';
    responsableInput.style.cursor = habilitar ? 'text' : 'not-allowed';
  }
}

// Función para agregar botón de guardar inventario
function agregarBotonGuardarInventario() {
  // Verificar si ya existe el botón
  if (document.getElementById('guardarInventarioBtn')) {
    return;
  }
  
  // Crear botón de guardar inventario
  const guardarBtn = document.createElement('button');
  guardarBtn.id = 'guardarInventarioBtn';
  guardarBtn.className = 'btn-submit';
  guardarBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios de Inventario';
  guardarBtn.style.marginTop = '15px';
  
  // Agregar event listener
  guardarBtn.addEventListener('click', guardarCambiosInventario);
  
  // Insertar el botón en el contenedor de inventario actual
  const inventarioSection = document.getElementById('inventarioActualSection');
  if (inventarioSection) {
    inventarioSection.appendChild(guardarBtn);
  }
}

// Función para guardar cambios de inventario
function guardarCambiosInventario() {
  if (!hasPermission('canEditTurnos')) {
    showNotification('Solo los administradores pueden editar el inventario', 'error');
    return;
  }
  
  // Recopilar inventario actualizado
  const inventarioActualizado = {};
  
  // Vacunas anuales
  vacunasDisponibles.anual.forEach(vacuna => {
    let inputId = `inventario${vacuna.replace(/\s+/g, '').replace(/\//g, '')}`;
    const input = document.getElementById(inputId);
    const valor = input ? parseInt(input.value) || 0 : 0;
    inventarioActualizado[sanitizeFirebaseKey(vacuna)] = valor;
  });
  
  // Vacunas trimestrales
  vacunasDisponibles.trimestral.forEach(vacuna => {
    const inputId = `inventario${vacuna.replace(/\s+/g, '').replace(/\//g, '')}`;
    const input = document.getElementById(inputId);
    const valor = input ? parseInt(input.value) || 0 : 0;
    inventarioActualizado[sanitizeFirebaseKey(vacuna)] = valor;
  });
  
  // Actualizar en Firebase
  const turnoKey = `${currentVacunasFecha}_${currentVacunasTurno}`;
  const database = firebase.database();
  const ref = database.ref(`inventarioTurnos/${turnoKey}/inventario`);
  
  ref.set(inventarioActualizado)
    .then(() => {
      showNotification('Inventario actualizado exitosamente', 'success');
      inventarioActual = inventarioActualizado;
      actualizarVistaInventario();
    })
    .catch((error) => {
      console.error('Error al actualizar inventario:', error);
      showNotification('Error al actualizar el inventario', 'error');
    });
}

// Lista de vacunas disponibles
const vacunasDisponibles = {
  anual: ['Mult', 'Puppy', 'Rab', 'Tos', 'Giardia', 'C4', 'C6', 'Vacuna Anual'],
  trimestral: ['Trip/Leu', 'Trip/Rab', 'Leu', 'Triple Felina']
};

function setVacunasModuleTab(which) {
  const panVac = document.getElementById('vacunasPanelVacunas');
  const panTemp = document.getElementById('vacunasPanelTemperatura');
  const btnVac = document.getElementById('vacunasTabBtnVacunas');
  const btnTemp = document.getElementById('vacunasTabBtnTemperatura');
  if (!panVac || !panTemp || !btnVac || !btnTemp) return;
  const isVac = which === 'vacunas';
  panVac.classList.toggle('active', isVac);
  panTemp.classList.toggle('active', !isVac);
  btnVac.classList.toggle('active', isVac);
  btnTemp.classList.toggle('active', !isVac);
  btnVac.setAttribute('aria-selected', isVac ? 'true' : 'false');
  btnTemp.setAttribute('aria-selected', !isVac ? 'true' : 'false');
}

function setVacunasTurnoRegistroVisible(show) {
  const rv = document.getElementById('vacunasRegistroVacunas');
  const rt = document.getElementById('vacunasRegistroTemperatura');
  const pv = document.getElementById('vacunasPlaceholderVacunas');
  const pt = document.getElementById('vacunasPlaceholderTemperatura');
  const regDisplay = show ? 'block' : 'none';
  const phDisplay = show ? 'none' : 'block';
  if (rv) rv.style.display = regDisplay;
  if (rt) rt.style.display = regDisplay;
  if (pv) pv.style.display = phDisplay;
  if (pt) pt.style.display = phDisplay;
}

// Inicializar módulo de vacunas
function initializeVacunasModule() {
  console.log('Inicializando módulo de vacunas...');

  // Configurar fecha actual
  const fechaInput = document.getElementById('vacunasFecha');
  if (fechaInput && !fechaInput.value) {
    fechaInput.value = getLocalDateString();
    console.log('Fecha configurada:', fechaInput.value);
  }

  setVacunasTurnoRegistroVisible(false);
  setVacunasModuleTab('vacunas');

  const histDesde = document.getElementById('vacunasTempHistDesde');
  const histHasta = document.getElementById('vacunasTempHistHasta');
  if (histDesde && histHasta && (!histDesde.value || !histHasta.value)) {
    const fin = new Date();
    const ini = new Date(fin);
    ini.setDate(ini.getDate() - 30);
    histDesde.value = getLocalDateString(ini);
    histHasta.value = getLocalDateString(fin);
  }

  // Configurar event listeners
  setupVacunasEventListeners();
}

// Configurar event listeners para vacunas
function setupVacunasEventListeners() {
  console.log('Configurando event listeners para vacunas...');
  
  // Botón para cargar el turno
  const cargarTurnoBtn = document.getElementById('cargarVacunasTurno');
  if (cargarTurnoBtn) {
    cargarTurnoBtn.replaceWith(cargarTurnoBtn.cloneNode(true));
    document.getElementById('cargarVacunasTurno').addEventListener('click', cargarVacunasTurno);
    console.log('Event listener del botón cargar turno configurado');
  }
  
  // Formulario de vacunas
  const form = document.getElementById('vacunasForm');
  if (form) {
    form.removeEventListener('submit', handleVacunasSubmit);
    form.addEventListener('submit', handleVacunasSubmit);
    console.log('Event listener del formulario configurado');
  }
  
  // Botón limpiar formulario
  const limpiarBtn = document.getElementById('limpiarVacunasForm');
  if (limpiarBtn) {
    limpiarBtn.replaceWith(limpiarBtn.cloneNode(true));
    document.getElementById('limpiarVacunasForm').addEventListener('click', limpiarFormularioVacunas);
    console.log('Event listener del botón limpiar configurado');
  }
  
  // Botón guardar notas
  const guardarNotasBtn = document.getElementById('guardarVacunasNotas');
  if (guardarNotasBtn) {
    guardarNotasBtn.replaceWith(guardarNotasBtn.cloneNode(true));
    document.getElementById('guardarVacunasNotas').addEventListener('click', guardarVacunasNotas);
    console.log('Event listener del botón guardar notas configurado');
  }

  const guardarTempBtn = document.getElementById('guardarVacunasTemperatura');
  if (guardarTempBtn) {
    guardarTempBtn.replaceWith(guardarTempBtn.cloneNode(true));
    document.getElementById('guardarVacunasTemperatura').addEventListener('click', guardarVacunasTemperatura);
  }
  const limpiarTempBtn = document.getElementById('limpiarVacunasTemperatura');
  if (limpiarTempBtn) {
    limpiarTempBtn.replaceWith(limpiarTempBtn.cloneNode(true));
    document.getElementById('limpiarVacunasTemperatura').addEventListener('click', limpiarFormularioTemperatura);
  }

  const histTempBtn = document.getElementById('cargarVacunasTemperaturaHistorial');
  if (histTempBtn) {
    histTempBtn.replaceWith(histTempBtn.cloneNode(true));
    document.getElementById('cargarVacunasTemperaturaHistorial').addEventListener('click', cargarVacunasTemperaturaHistorial);
  }

  const tabBtnVac = document.getElementById('vacunasTabBtnVacunas');
  const tabBtnTemp = document.getElementById('vacunasTabBtnTemperatura');
  if (tabBtnVac) {
    tabBtnVac.replaceWith(tabBtnVac.cloneNode(true));
    document.getElementById('vacunasTabBtnVacunas').addEventListener('click', () => setVacunasModuleTab('vacunas'));
  }
  if (tabBtnTemp) {
    tabBtnTemp.replaceWith(tabBtnTemp.cloneNode(true));
    document.getElementById('vacunasTabBtnTemperatura').addEventListener('click', () => setVacunasModuleTab('temperatura'));
  }

  // Botón abrir turno
  const abrirTurnoBtn = document.getElementById('abrirTurnoBtn');
  if (abrirTurnoBtn) {
    abrirTurnoBtn.replaceWith(abrirTurnoBtn.cloneNode(true));
    document.getElementById('abrirTurnoBtn').addEventListener('click', abrirTurno);
    console.log('Event listener del botón abrir turno configurado');
  }
  
  // Event listener para cambio de turno
  const turnoSelect = document.getElementById('vacunasTurno');
  if (turnoSelect) {
    turnoSelect.addEventListener('change', function() {
      // Actualizar el texto del botón si el formulario de apertura está visible
      const abrirSection = document.getElementById('abrirTurnoSection');
      if (abrirSection && abrirSection.style.display !== 'none') {
        const turno = this.value;
        const abrirTurnoBtn = document.getElementById('abrirTurnoBtn');
        if (abrirTurnoBtn) {
          let textoBoton = '';
          
          switch(turno) {
            case 'Mañana':
              textoBoton = '<i class="fas fa-play-circle"></i> Abrir Turno';
              break;
            case 'Tarde':
              textoBoton = '<i class="fas fa-handshake"></i> Entregar Turno';
              break;
            case 'Noche':
              textoBoton = '<i class="fas fa-stop-circle"></i> Cerrar Turno';
              break;
            default:
              textoBoton = '<i class="fas fa-play-circle"></i> Abrir Turno';
          }
          
          abrirTurnoBtn.innerHTML = textoBoton;
        }
      }
    });
    console.log('Event listener del select de turno configurado');
  }
}

// Cargar datos del turno seleccionado
function cargarVacunasTurno() {
  const fecha = document.getElementById('vacunasFecha').value;
  const turno = document.getElementById('vacunasTurno').value;
  
  if (!fecha || !turno) {
    showNotification('Debe seleccionar una fecha y un turno', 'error');
    return;
  }
  
  console.log('Cargando turno:', fecha, turno);
  
  currentVacunasFecha = fecha;
  currentVacunasTurno = turno;

  setVacunasTurnoRegistroVisible(true);

  // Cargar datos del turno desde Firebase
  loadVacunasData(fecha, turno);
  
  // Verificar si el turno ya está abierto
  verificarEstadoTurno(fecha, turno);
}

// Manejar envío del formulario de vacunas
function handleVacunasSubmit(event) {
  event.preventDefault();
  console.log('Formulario de vacunas enviado');
  
  if (!currentVacunasFecha || !currentVacunasTurno) {
    showNotification('Debe seleccionar una fecha y turno primero', 'error');
    return;
  }
  
  // Validar campos requeridos
  const nombrePaciente = document.getElementById('vacunaNombrePaciente').value.trim();
  const apellidoCliente = document.getElementById('vacunaApellidoCliente').value.trim();
  const idPaciente = document.getElementById('vacunaID').value.trim();
  const medico = document.getElementById('vacunaMedico').value.trim();
  const hora = document.getElementById('vacunaHora').value;
  const vacunaColocada = document.getElementById('vacunaColocada').value.trim();
  
  if (!nombrePaciente || !apellidoCliente || !idPaciente || !medico || !hora || !vacunaColocada) {
    showNotification('Debe completar todos los campos obligatorios marcados con *', 'error');
    return;
  }
  
  const facturaValue = document.getElementById('vacunaFactura').value.trim();
  const formData = {
    fecha: currentVacunasFecha,
    turno: currentVacunasTurno,
    nombrePaciente: nombrePaciente,
    apellidoCliente: apellidoCliente,
    id: idPaciente,
    medico: medico,
    hora: hora,
    vacunaColocada: vacunaColocada,
    factura: facturaValue || '', // Asegurar que siempre se guarde, incluso si está vacío
    timestamp: Date.now()
  };
  
  console.log('Valor de factura capturado:', facturaValue);
  
  console.log('Datos del formulario:', formData);
  
  // Verificar inventario antes de guardar
  if (verificarInventario(formData.vacunaColocada)) {
    // Guardar en Firebase
    saveVacunaToFirebase(formData);
    // Actualizar inventario
    actualizarInventario(formData.vacunaColocada, -1);
  } else {
    showNotification('No hay suficiente inventario de la vacuna seleccionada', 'error');
  }
}

// Guardar vacuna en Firebase
function saveVacunaToFirebase(data) {
  console.log('Intentando guardar vacuna en Firebase...');
  console.log('Datos a guardar:', data);
  
  if (!firebase || !firebase.database) {
    console.error('Firebase no está disponible');
    showNotification('Error: Firebase no está disponible', 'error');
    return;
  }
  
  const database = firebase.database();
  const ref = database.ref('vacunas');
  console.log('Referencia de Firebase creada:', ref);
  
  ref.push(data)
    .then(() => {
      console.log('Vacuna guardada exitosamente');
      console.log('Datos guardados incluyendo factura:', data);
      showNotification('Vacuna registrada exitosamente', 'success');
      limpiarFormularioVacunas();
      // Recargar datos después de un breve delay para asegurar que Firebase haya procesado el cambio
      setTimeout(() => {
        loadVacunasData(currentVacunasFecha, currentVacunasTurno);
      }, 500);
    })
    .catch((error) => {
      console.error('Error al guardar vacuna:', error);
      showNotification('Error al guardar la vacuna', 'error');
    });
}

// Cargar datos de vacunas desde Firebase
function loadVacunasData(fecha, turno) {
  if (!firebase || !firebase.database) {
    console.error('Firebase no está disponible');
    return;
  }
  
  console.log('Cargando vacunas para fecha:', fecha, 'turno:', turno);
  
  const database = firebase.database();
  const ref = database.ref('vacunas');
  
  ref.orderByChild('fecha').equalTo(fecha).once('value', (snapshot) => {
    const data = snapshot.val();
    console.log('Datos brutos de Firebase:', data);
    
    const vacunas = data 
      ? Object.entries(data)
          .map(([key, value]) => {
            const vacuna = { id: key, ...value };
            console.log(`Vacuna ${key} - factura:`, vacuna.factura, 'tipo:', typeof vacuna.factura);
            return vacuna;
          })
          .filter(v => {
            console.log('Filtrando vacuna:', v.fecha, '===', fecha, '&&', v.turno, '===', turno, 'factura:', v.factura);
            return v.fecha === fecha && v.turno === turno;
          })
          .sort((a, b) => a.hora.localeCompare(b.hora))
      : [];
    
    console.log('Vacunas filtradas:', vacunas);
    console.log('Facturas en vacunas filtradas:', vacunas.map(v => ({ id: v.id, factura: v.factura })));
    displayVacunasTable(vacunas);
  });
  
  // Cargar notas del turno
  loadVacunasNotas(fecha, turno);
  loadVacunasTemperatura(fecha, turno);
}

function formatVacunasFechaHoraDisplay(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);
  return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function vacunasTurnoEtiqueta(turno) {
  const map = {
    Mañana: 'Apertura de turno',
    Tarde: 'Entrega de turno',
    Noche: 'Cierre de turno'
  };
  return map[turno] || turno || '—';
}

function escapeVacunasHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function displayVacunasTemperaturaTable(rows) {
  const tbody = document.getElementById('vacunasTemperaturaTableBody');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="no-data">No hay lecturas de temperatura para este turno</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r) => {
    const temp = r.temperatura !== undefined && r.temperatura !== null
      ? Number(r.temperatura).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
      : '';
    const fh = formatVacunasFechaHoraDisplay(r.fechaHoraRegistro);
    return `<tr>
      <td>${escapeVacunasHtml(fh)}</td>
      <td>${escapeVacunasHtml(temp)}</td>
      <td>${escapeVacunasHtml(r.responsable)}</td>
    </tr>`;
  }).join('');
}

function displayVacunasTemperaturaHistorialTable(rows) {
  const tbody = document.getElementById('vacunasTemperaturaHistorialBody');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">No hay lecturas en el rango seleccionado</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r) => {
    const temp = r.temperatura !== undefined && r.temperatura !== null
      ? Number(r.temperatura).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
      : '';
    const fh = formatVacunasFechaHoraDisplay(r.fechaHoraRegistro);
    return `<tr>
      <td>${escapeVacunasHtml(r.fecha || '')}</td>
      <td>${escapeVacunasHtml(vacunasTurnoEtiqueta(r.turno))}</td>
      <td>${escapeVacunasHtml(fh)}</td>
      <td>${escapeVacunasHtml(temp)}</td>
      <td>${escapeVacunasHtml(r.responsable)}</td>
    </tr>`;
  }).join('');
}

function cargarVacunasTemperaturaHistorial() {
  const desde = document.getElementById('vacunasTempHistDesde');
  const hasta = document.getElementById('vacunasTempHistHasta');
  const desdeVal = desde ? desde.value : '';
  const hastaVal = hasta ? hasta.value : '';
  const tbody = document.getElementById('vacunasTemperaturaHistorialBody');
  if (!tbody) return;
  if (!desdeVal || !hastaVal) {
    showNotification('Seleccione fecha desde y hasta', 'error');
    return;
  }
  if (desdeVal > hastaVal) {
    showNotification('La fecha inicial no puede ser posterior a la final', 'error');
    return;
  }
  if (!firebase || !firebase.database) {
    showNotification('Error: Firebase no está disponible', 'error');
    return;
  }
  const database = firebase.database();
  database.ref(VACUNAS_TEMP_LECTURAS_REF)
    .orderByChild('fecha')
    .startAt(desdeVal)
    .endAt(hastaVal)
    .once('value')
    .then((snapshot) => {
      const rows = [];
      snapshot.forEach((child) => {
        const v = child.val();
        if (v && typeof v.fecha === 'string' && v.fecha >= desdeVal && v.fecha <= hastaVal) {
          rows.push({ id: child.key, ...v });
        }
      });
      rows.sort((a, b) => new Date(b.fechaHoraRegistro || 0).getTime() - new Date(a.fechaHoraRegistro || 0).getTime());
      displayVacunasTemperaturaHistorialTable(rows);
    })
    .catch((err) => {
      console.error('Histórico temperatura vacunas:', err);
      showNotification('No se pudo cargar el histórico. Verifique las reglas e índice de Firebase (vacunasTemperaturaLecturas / fecha).', 'error');
    });
}

function refrescarVacunasTemperaturaHistorialOpcional() {
  const desde = document.getElementById('vacunasTempHistDesde');
  const hasta = document.getElementById('vacunasTempHistHasta');
  if (!desde || !hasta || !currentVacunasFecha) return;
  const d0 = desde.value;
  const d1 = hasta.value;
  if (!d0 || !d1) return;
  if (currentVacunasFecha >= d0 && currentVacunasFecha <= d1) {
    cargarVacunasTemperaturaHistorial();
  }
}

function loadVacunasTemperatura(fecha, turno) {
  const tbody = document.getElementById('vacunasTemperaturaTableBody');
  if (!tbody) return;
  if (!firebase || !firebase.database) {
    return;
  }
  const turnoKey = `${fecha}_${turno}`;
  const database = firebase.database();
  const flatRef = database.ref(VACUNAS_TEMP_LECTURAS_REF).orderByChild('fecha').equalTo(fecha);
  const legacyRef = database.ref(`vacunasTemperatura/${turnoKey}`);

  Promise.all([
    new Promise((resolve) => { flatRef.once('value', resolve); }),
    new Promise((resolve) => { legacyRef.once('value', resolve); })
  ]).then(([snapFlat, snapLegacy]) => {
    const rows = [];
    snapFlat.forEach((child) => {
      const v = child.val();
      if (v && v.turno === turno) {
        rows.push({ id: child.key, ...v });
      }
    });
    const legacyData = snapLegacy.val();
    if (legacyData) {
      Object.entries(legacyData).forEach(([id, v]) => {
        if (v && (v.temperatura !== undefined && v.temperatura !== null)) {
          rows.push({ id: `legacy_${id}`, ...v });
        }
      });
    }
    rows.sort((a, b) => {
      const ta = new Date(a.fechaHoraRegistro || 0).getTime();
      const tb = new Date(b.fechaHoraRegistro || 0).getTime();
      return tb - ta;
    });
    displayVacunasTemperaturaTable(rows);
  }).catch((err) => {
    console.error('loadVacunasTemperatura:', err);
    tbody.innerHTML = '<tr><td colspan="3" class="no-data">Error al cargar lecturas (¿índice fecha en Firebase?)</td></tr>';
  });
}

function guardarVacunasTemperatura() {
  if (!currentVacunasFecha || !currentVacunasTurno) {
    showNotification('Debe seleccionar una fecha y turno primero', 'error');
    return;
  }
  const tempInput = document.getElementById('vacunaTempCelsius');
  const respInput = document.getElementById('vacunaTempResponsable');
  const rawTemp = tempInput ? String(tempInput.value).trim().replace(',', '.') : '';
  const responsable = respInput ? respInput.value.trim() : '';
  if (rawTemp === '' || !responsable) {
    showNotification('Indique temperatura y responsable', 'error');
    return;
  }
  const temperatura = parseFloat(rawTemp);
  if (Number.isNaN(temperatura)) {
    showNotification('La temperatura no es válida', 'error');
    return;
  }
  if (!firebase || !firebase.database) {
    showNotification('Error: Firebase no está disponible', 'error');
    return;
  }
  const now = new Date();
  const payload = {
    fecha: currentVacunasFecha,
    turno: currentVacunasTurno,
    temperatura,
    responsable,
    fechaHoraRegistro: now.toISOString()
  };
  const database = firebase.database();
  database.ref(VACUNAS_TEMP_LECTURAS_REF).push(payload)
    .then(() => {
      showNotification('Lectura de temperatura registrada', 'success');
      if (tempInput) tempInput.value = '';
      if (respInput) respInput.value = '';
      loadVacunasTemperatura(currentVacunasFecha, currentVacunasTurno);
      refrescarVacunasTemperaturaHistorialOpcional();
    })
    .catch((err) => {
      console.error('Error al guardar temperatura vacunas:', err);
      showNotification('Error al guardar la lectura de temperatura', 'error');
    });
}

function limpiarFormularioTemperatura() {
  const tempInput = document.getElementById('vacunaTempCelsius');
  const respInput = document.getElementById('vacunaTempResponsable');
  if (tempInput) tempInput.value = '';
  if (respInput) respInput.value = '';
}

// Mostrar tabla de vacunas
function displayVacunasTable(vacunas) {
  const tbody = document.getElementById('vacunasTableBody');
  if (!tbody) return;
  
  if (vacunas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="no-data">No hay vacunas registradas para este turno</td></tr>';
    return;
  }
  
  // Verificar permisos de edición
  const canEdit = hasPermission('canEditTurnos');
  
  // Verificar permisos para mostrar botón de eliminar (solo admin y consulta externa)
  const canDelete = userRole === 'admin' || userRole === 'consulta_externa';
  
  tbody.innerHTML = vacunas.map(vacuna => {
    if (canEdit) {
      // Versión editable para admin
      return `
        <tr data-id="${vacuna.id}" data-firebase-key="${vacuna.id}">
          <td>
            <span class="field-display">${vacuna.hora || ''}</span>
            <input type="time" class="field-edit" value="${vacuna.hora || ''}" style="display: none;" data-field="hora">
          </td>
          <td>
            <span class="field-display">${vacuna.nombrePaciente || ''}</span>
            <input type="text" class="field-edit" value="${vacuna.nombrePaciente || ''}" style="display: none;" data-field="nombrePaciente">
          </td>
          <td>
            <span class="field-display">${vacuna.apellidoCliente || ''}</span>
            <input type="text" class="field-edit" value="${vacuna.apellidoCliente || ''}" style="display: none;" data-field="apellidoCliente">
          </td>
          <td>
            <span class="field-display">${vacuna.id || ''}</span>
            <input type="text" class="field-edit" value="${vacuna.id || ''}" style="display: none;" data-field="id">
          </td>
          <td>
            <span class="field-display">${vacuna.medico || ''}</span>
            <input type="text" class="field-edit" value="${vacuna.medico || ''}" style="display: none;" data-field="medico">
          </td>
          <td>
            <span class="field-display">${vacuna.vacunaColocada || ''}</span>
            <input type="text" class="field-edit" value="${vacuna.vacunaColocada || ''}" style="display: none;" data-field="vacunaColocada">
          </td>
          <td>
            <span class="field-display">${vacuna.factura !== undefined && vacuna.factura !== null ? vacuna.factura : ''}</span>
            <input type="text" class="field-edit" value="${vacuna.factura !== undefined && vacuna.factura !== null ? vacuna.factura : ''}" style="display: none;" data-field="factura">
          </td>
          <td>
            <button class="btn-edit-vacuna" onclick="editVacunaRow('${vacuna.id}')" title="Editar registro">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-save-vacuna" onclick="saveVacunaRow('${vacuna.id}')" style="display: none;" title="Guardar cambios">
              <i class="fas fa-save"></i>
            </button>
            <button class="btn-cancel-vacuna" onclick="cancelEditVacunaRow('${vacuna.id}')" style="display: none;" title="Cancelar edición">
              <i class="fas fa-times"></i>
            </button>
            <button class="btn-delete-vacuna" onclick="deleteVacunaRow('${vacuna.id}')" title="Eliminar registro">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    } else {
      // Versión solo lectura para consulta externa (solo puede editar factura)
      return `
        <tr data-id="${vacuna.id}" data-firebase-key="${vacuna.id}">
          <td>${vacuna.hora || ''}</td>
          <td>${vacuna.nombrePaciente || ''}</td>
          <td>${vacuna.apellidoCliente || ''}</td>
          <td>${vacuna.id || ''}</td>
          <td>${vacuna.medico || ''}</td>
          <td>${vacuna.vacunaColocada || ''}</td>
          <td>
            <span class="factura-display">${vacuna.factura !== undefined && vacuna.factura !== null ? vacuna.factura : ''}</span>
            <input type="text" class="factura-edit" value="${vacuna.factura !== undefined && vacuna.factura !== null ? vacuna.factura : ''}" style="display: none;">
          </td>
          <td>
            <button class="btn-edit-factura-vacuna" onclick="editVacunaFactura('${vacuna.id}')" title="Editar factura">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-save-factura-vacuna" onclick="saveVacunaFactura('${vacuna.id}')" style="display: none;" title="Guardar factura">
              <i class="fas fa-save"></i>
            </button>
            <button class="btn-cancel-factura-vacuna" onclick="cancelEditVacunaFactura('${vacuna.id}')" style="display: none;" title="Cancelar edición">
              <i class="fas fa-times"></i>
            </button>
          </td>
        </tr>
      `;
    }
  }).join('');
}

// Editar fila de vacuna (solo admin)
window.editVacunaRow = function(vacunaId) {
  // Verificar permisos - solo administradores pueden editar registros de vacunas
  if (!hasPermission('canEditTurnos')) {
    showNotification('Solo los administradores pueden editar registros de vacunas', 'error');
    return;
  }
  
  const row = document.querySelector(`tr[data-id="${vacunaId}"]`);
  if (!row) return;
  
  // Mostrar inputs y ocultar displays
  row.querySelectorAll('.field-display').forEach(display => {
    display.style.display = 'none';
  });
  row.querySelectorAll('.field-edit').forEach(input => {
    input.style.display = 'inline-block';
  });
  
  // Cambiar botones
  const editBtn = row.querySelector('.btn-edit-vacuna');
  const saveBtn = row.querySelector('.btn-save-vacuna');
  const cancelBtn = row.querySelector('.btn-cancel-vacuna');
  const deleteBtn = row.querySelector('.btn-delete-vacuna');
  
  editBtn.style.display = 'none';
  saveBtn.style.display = 'inline-block';
  cancelBtn.style.display = 'inline-block';
  if (deleteBtn) deleteBtn.style.display = 'none';
};

// Guardar cambios de fila de vacuna
window.saveVacunaRow = function(vacunaId) {
  const row = document.querySelector(`tr[data-id="${vacunaId}"]`);
  if (!row) return;
  
  const updatedData = {};
  row.querySelectorAll('.field-edit').forEach(input => {
    const field = input.getAttribute('data-field');
    // Asegurar que el campo factura siempre se guarde, incluso si está vacío
    if (field === 'factura') {
      updatedData[field] = input.value.trim() || '';
    } else {
      updatedData[field] = input.value;
    }
  });
  
  console.log('Actualizando vacuna:', vacunaId, 'datos:', updatedData);
  console.log('Campo factura en datos:', updatedData.factura);
  
  // Actualizar en Firebase
  if (!firebase || !firebase.database) {
    showNotification('Error: Firebase no está disponible', 'error');
    return;
  }
  
  const database = firebase.database();
  const ref = database.ref(`vacunas/${vacunaId}`);
  
  ref.update(updatedData)
    .then(() => {
      console.log('Vacuna actualizada exitosamente en Firebase');
      showNotification('Vacuna actualizada exitosamente', 'success');
      // Actualizar displays con nuevos valores
      row.querySelectorAll('.field-edit').forEach(input => {
        const field = input.getAttribute('data-field');
        const display = input.parentElement.querySelector('.field-display');
        if (display) {
          display.textContent = input.value;
        }
      });
      
      // Ocultar inputs y mostrar displays
      row.querySelectorAll('.field-display').forEach(display => {
        display.style.display = 'inline';
      });
      row.querySelectorAll('.field-edit').forEach(input => {
        input.style.display = 'none';
      });
      
      // Cambiar botones
      const editBtn = row.querySelector('.btn-edit-vacuna');
      const saveBtn = row.querySelector('.btn-save-vacuna');
      const cancelBtn = row.querySelector('.btn-cancel-vacuna');
      const deleteBtn = row.querySelector('.btn-delete-vacuna');
      
      editBtn.style.display = 'inline-block';
      saveBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      if (deleteBtn) deleteBtn.style.display = 'inline-block';
      
      // Recargar datos después de un breve delay para asegurar consistencia
      if (currentVacunasFecha && currentVacunasTurno) {
        setTimeout(() => {
          loadVacunasData(currentVacunasFecha, currentVacunasTurno);
        }, 300);
      }
    })
    .catch((error) => {
      console.error('Error al actualizar vacuna:', error);
      showNotification('Error al actualizar la vacuna', 'error');
    });
};

// Cancelar edición de fila de vacuna
window.cancelEditVacunaRow = function(vacunaId) {
  const row = document.querySelector(`tr[data-id="${vacunaId}"]`);
  if (!row) return;
  
  // Restaurar valores originales
  row.querySelectorAll('.field-edit').forEach(input => {
    const display = input.parentElement.querySelector('.field-display');
    if (display) {
      input.value = display.textContent;
    }
  });
  
  // Ocultar inputs y mostrar displays
  row.querySelectorAll('.field-display').forEach(display => {
    display.style.display = 'inline';
  });
  row.querySelectorAll('.field-edit').forEach(input => {
    input.style.display = 'none';
  });
  
  // Cambiar botones
  const editBtn = row.querySelector('.btn-edit-vacuna');
  const saveBtn = row.querySelector('.btn-save-vacuna');
  const cancelBtn = row.querySelector('.btn-cancel-vacuna');
  const deleteBtn = row.querySelector('.btn-delete-vacuna');
  
  editBtn.style.display = 'inline-block';
  saveBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
  if (deleteBtn) deleteBtn.style.display = 'inline-block';
};

// Eliminar registro de vacuna (solo admin)
window.deleteVacunaRow = function(vacunaId) {
  console.log('Intentando eliminar vacuna con ID:', vacunaId);
  
  // Verificar permisos - solo administradores pueden eliminar registros de vacunas
  if (!hasPermission('canEditTurnos')) {
    showNotification('Solo los administradores pueden eliminar registros de vacunas', 'error');
    return;
  }
  
  if (!confirm('¿Está seguro de que desea eliminar este registro de vacuna?')) {
    return;
  }
  
  if (!firebase || !firebase.database) {
    showNotification('Error: Firebase no está disponible', 'error');
    return;
  }
  
  // Obtener la fila para conseguir la clave de Firebase
  const row = document.querySelector(`tr[data-id="${vacunaId}"]`);
  if (!row) {
    showNotification('No se encontró la fila a eliminar', 'error');
    return;
  }
  
  const firebaseKey = row.getAttribute('data-firebase-key');
  console.log('Clave de Firebase obtenida:', firebaseKey);
  
  if (!firebaseKey) {
    showNotification('No se encontró la clave de Firebase', 'error');
    return;
  }
  
  // Primero obtener los datos de la vacuna para saber qué tipo era
  const database = firebase.database();
  const vacunaRef = database.ref(`vacunas/${firebaseKey}`);
  
  console.log('Buscando vacuna en Firebase con referencia:', `vacunas/${firebaseKey}`);
  
  vacunaRef.once('value', (snapshot) => {
    const vacunaData = snapshot.val();
    console.log('Datos obtenidos de Firebase:', vacunaData);
    
    if (!vacunaData) {
      console.error('No se encontraron datos para la vacuna con clave:', firebaseKey);
      showNotification('No se encontró la vacuna a eliminar', 'error');
      return;
    }
    
    const tipoVacuna = vacunaData.vacunaColocada;
    console.log('Eliminando vacuna:', tipoVacuna);
    
    // Eliminar la vacuna de Firebase
    vacunaRef.remove()
      .then(() => {
        console.log('Vacuna eliminada exitosamente de Firebase');
        showNotification('Vacuna eliminada exitosamente', 'success');
        
        // Remover la fila inmediatamente de la tabla
        if (row) {
          console.log('Removiendo fila de la tabla');
          row.remove();
          
          // Verificar si quedan más filas
          const remainingRows = document.querySelectorAll('#vacunasTableBody tr');
          if (remainingRows.length === 0) {
            // Si no quedan filas, mostrar mensaje de no datos
            const tbody = document.getElementById('vacunasTableBody');
            if (tbody) {
              tbody.innerHTML = '<tr><td colspan="8" class="no-data">No hay vacunas registradas para este turno</td></tr>';
            }
          }
        }
        
        // CRÍTICO: Actualizar el inventario del turno (sumar 1 a la vacuna eliminada)
        actualizarInventarioTurno(tipoVacuna, 1);
        
      })
      .catch((error) => {
        console.error('Error al eliminar vacuna:', error);
        showNotification('Error al eliminar la vacuna', 'error');
      });
  })
  .catch((error) => {
    console.error('Error al obtener datos de la vacuna:', error);
    showNotification('Error al obtener datos de la vacuna', 'error');
  });
};

// Editar solo factura (para consulta externa)
window.editVacunaFactura = function(vacunaId) {
  const row = document.querySelector(`tr[data-id="${vacunaId}"]`);
  if (!row) return;
  
  const facturaDisplay = row.querySelector('.factura-display');
  const facturaEdit = row.querySelector('.factura-edit');
  const editBtn = row.querySelector('.btn-edit-factura-vacuna');
  const saveBtn = row.querySelector('.btn-save-factura-vacuna');
  const cancelBtn = row.querySelector('.btn-cancel-factura-vacuna');
  
  if (facturaDisplay) facturaDisplay.style.display = 'none';
  if (facturaEdit) facturaEdit.style.display = 'inline-block';
  if (editBtn) editBtn.style.display = 'none';
  if (saveBtn) saveBtn.style.display = 'inline-block';
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
};

// Guardar factura
window.saveVacunaFactura = function(vacunaId) {
  const row = document.querySelector(`tr[data-id="${vacunaId}"]`);
  if (!row) return;
  
  const facturaEdit = row.querySelector('.factura-edit');
  const newFactura = facturaEdit ? facturaEdit.value.trim() : '';
  
  console.log('Guardando factura para vacuna:', vacunaId, 'valor:', newFactura);
  
  if (!firebase || !firebase.database) {
    showNotification('Error: Firebase no está disponible', 'error');
    return;
  }
  
  const database = firebase.database();
  const ref = database.ref(`vacunas/${vacunaId}`);
  
  // Asegurar que siempre se guarde el campo, incluso si está vacío
  const updateData = { factura: newFactura || '' };
  console.log('Datos a actualizar en Firebase:', updateData);
  
  ref.update(updateData)
    .then(() => {
      console.log('Factura actualizada exitosamente en Firebase');
      showNotification('Factura actualizada exitosamente', 'success');
      const facturaDisplay = row.querySelector('.factura-display');
      if (facturaDisplay) {
        facturaDisplay.textContent = newFactura;
        console.log('Display actualizado con valor:', newFactura);
      }
      cancelEditVacunaFactura(vacunaId);
      
      // Recargar datos después de un breve delay para asegurar consistencia
      if (currentVacunasFecha && currentVacunasTurno) {
        setTimeout(() => {
          loadVacunasData(currentVacunasFecha, currentVacunasTurno);
        }, 300);
      }
    })
    .catch((error) => {
      console.error('Error al actualizar factura:', error);
      showNotification('Error al actualizar la factura', 'error');
    });
};

// Cancelar edición de factura
window.cancelEditVacunaFactura = function(vacunaId) {
  const row = document.querySelector(`tr[data-id="${vacunaId}"]`);
  if (!row) return;
  
  const facturaDisplay = row.querySelector('.factura-display');
  const facturaEdit = row.querySelector('.factura-edit');
  const editBtn = row.querySelector('.btn-edit-factura-vacuna');
  const saveBtn = row.querySelector('.btn-save-factura-vacuna');
  const cancelBtn = row.querySelector('.btn-cancel-factura-vacuna');
  
  // Restaurar valor original
  if (facturaDisplay && facturaEdit) {
    facturaEdit.value = facturaDisplay.textContent;
  }
  
  if (facturaDisplay) facturaDisplay.style.display = 'inline';
  if (facturaEdit) facturaEdit.style.display = 'none';
  if (editBtn) editBtn.style.display = 'inline-block';
  if (saveBtn) saveBtn.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';
};

// Limpiar formulario de vacunas
function limpiarFormularioVacunas() {
  const form = document.getElementById('vacunasForm');
  if (form) {
    form.reset();
  }
}

// Cargar notas del turno
function loadVacunasNotas(fecha, turno) {
  if (!firebase || !firebase.database) {
    return;
  }
  
  const notasKey = `${fecha}_${turno}`;
  const database = firebase.database();
  const ref = database.ref(`vacunasNotas/${notasKey}`);
  
  ref.once('value', (snapshot) => {
    const notas = snapshot.val();
    const notasTextarea = document.getElementById('vacunasNotasTurno');
    if (notasTextarea) {
      notasTextarea.value = notas || '';
    }
  });
}

// Guardar notas del turno
function guardarVacunasNotas() {
  if (!currentVacunasFecha || !currentVacunasTurno) {
    showNotification('Debe seleccionar una fecha y turno primero', 'error');
    return;
  }
  
  const notasTextarea = document.getElementById('vacunasNotasTurno');
  const notas = notasTextarea ? notasTextarea.value : '';
  
  if (!firebase || !firebase.database) {
    showNotification('Error: Firebase no está disponible', 'error');
    return;
  }
  
  const notasKey = `${currentVacunasFecha}_${currentVacunasTurno}`;
  const database = firebase.database();
  const ref = database.ref(`vacunasNotas/${notasKey}`);
  
  ref.set(notas)
    .then(() => {
      showNotification('Notas guardadas exitosamente', 'success');
    })
    .catch((error) => {
      console.error('Error al guardar notas:', error);
      showNotification('Error al guardar las notas', 'error');
    });
}

// ==================== FUNCIONES DEL SISTEMA DE INVENTARIO ====================

// Verificar estado del turno (si ya está abierto)
function verificarEstadoTurno(fecha, turno) {
  const turnoKey = `${fecha}_${turno}`;
  const database = firebase.database();
  const ref = database.ref(`inventarioTurnos/${turnoKey}`);
  
  ref.once('value', (snapshot) => {
    const turnoData = snapshot.val();
    if (turnoData) {
      // El turno ya está abierto
      mostrarInventarioActual(turnoData);
      inventarioActual = turnoData.inventario || {};
    } else {
      // El turno no está abierto
      mostrarFormularioApertura();
    }
  });
}

// Mostrar formulario de apertura de turno
function mostrarFormularioApertura() {
  const abrirSection = document.getElementById('abrirTurnoSection');
  const inventarioSection = document.getElementById('inventarioActualSection');
  
  if (abrirSection) abrirSection.style.display = 'block';
  if (inventarioSection) inventarioSection.style.display = 'none';
  
  // Habilitar todos los inputs de inventario para edición
  habilitarInputsInventario(true);
  
  // Actualizar texto del botón según el turno
  const abrirTurnoBtn = document.getElementById('abrirTurnoBtn');
  if (abrirTurnoBtn) {
    const turno = currentVacunasTurno;
    let textoBoton = '';
    
    switch(turno) {
      case 'Mañana':
        textoBoton = '<i class="fas fa-play-circle"></i> Abrir Turno';
        break;
      case 'Tarde':
        textoBoton = '<i class="fas fa-handshake"></i> Entregar Turno';
        break;
      case 'Noche':
        textoBoton = '<i class="fas fa-stop-circle"></i> Cerrar Turno';
        break;
      default:
        textoBoton = '<i class="fas fa-play-circle"></i> Abrir Turno';
    }
    
    abrirTurnoBtn.innerHTML = textoBoton;
  }
}

// Mostrar inventario actual
function mostrarInventarioActual(turnoData) {
  const abrirSection = document.getElementById('abrirTurnoSection');
  const inventarioSection = document.getElementById('inventarioActualSection');
  
  if (abrirSection) abrirSection.style.display = 'none';
  if (inventarioSection) inventarioSection.style.display = 'block';
  
  // Verificar permisos para editar inventario
  const canEditInventario = hasPermission('canEditTurnos');
  
  // Deshabilitar/habilitar inputs según permisos
  habilitarInputsInventario(canEditInventario);
  
  // Actualizar información del responsable
  const responsableActual = document.getElementById('responsableActual');
  const horaApertura = document.getElementById('horaApertura');
  
  if (responsableActual) responsableActual.textContent = turnoData.responsable || 'No especificado';
  if (horaApertura) horaApertura.textContent = turnoData.horaApertura || 'No especificado';
  
  // Actualizar inventario
  inventarioActual = turnoData.inventario || {};
  actualizarVistaInventario();
  
  // Agregar botón de guardar inventario para administradores
  if (canEditInventario) {
    agregarBotonGuardarInventario();
  }
}


// Abrir turno con inventario inicial
function abrirTurno() {
  const responsable = document.getElementById('responsableApertura').value.trim();
  
  if (!responsable) {
    showNotification('Debe especificar el responsable de apertura', 'error');
    return;
  }
  
  // Verificar que tenemos fecha y turno
  if (!currentVacunasFecha || !currentVacunasTurno) {
    showNotification('Debe seleccionar fecha y turno primero', 'error');
    return;
  }
  
  // Configurar modal de confirmación según el tipo de turno
  let confirmConfig = {
    title: 'Confirmar acción',
    message: '¿Está seguro de que desea guardar los cambios?',
    iconClass: 'fas fa-save',
    confirmLabel: 'Confirmar'
  };
  
  switch(currentVacunasTurno) {
    case 'Mañana':
      confirmConfig = {
        title: 'Abrir turno',
        message: '¿Está seguro de que desea abrir el turno con el inventario configurado?',
        iconClass: 'fas fa-play-circle',
        confirmLabel: 'Abrir turno'
      };
      break;
    case 'Tarde':
      confirmConfig = {
        title: 'Entregar turno',
        message: '¿Está seguro de que desea entregar el turno con el inventario configurado?',
        iconClass: 'fas fa-handshake',
        confirmLabel: 'Entregar turno'
      };
      break;
    case 'Noche':
      confirmConfig = {
        title: 'Cerrar turno',
        message: '¿Está seguro de que desea cerrar el turno con el inventario configurado?',
        iconClass: 'fas fa-stop-circle',
        confirmLabel: 'Cerrar turno'
      };
      break;
    default:
      break;
  }
  
  // Mostrar confirmación custom con estilos
  showTurnoConfirmModal(confirmConfig, () => {
    // Recopilar inventario inicial
    const inventarioInicial = {};
    
    // Vacunas anuales
    vacunasDisponibles.anual.forEach(vacuna => {
      // Crear ID del input basado en el nombre de la vacuna
      let inputId = `inventario${vacuna.replace(/\s+/g, '').replace(/\//g, '')}`;
      const input = document.getElementById(inputId);
      const valor = input ? parseInt(input.value) || 0 : 0;
      // Usar clave sanitizada para Firebase
      inventarioInicial[sanitizeFirebaseKey(vacuna)] = valor;
    });
    
    // Vacunas trimestrales
    vacunasDisponibles.trimestral.forEach(vacuna => {
      const inputId = `inventario${vacuna.replace(/\s+/g, '').replace(/\//g, '')}`;
      const input = document.getElementById(inputId);
      const valor = input ? parseInt(input.value) || 0 : 0;
      // Usar clave sanitizada para Firebase
      inventarioInicial[sanitizeFirebaseKey(vacuna)] = valor;
    });
    
    // Crear datos del turno
    const turnoData = {
      responsable: responsable,
      fecha: currentVacunasFecha,
      turno: currentVacunasTurno,
      horaApertura: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      inventario: inventarioInicial
    };
    
    // Guardar en Firebase
    const turnoKey = `${currentVacunasFecha}_${currentVacunasTurno}`;
    const database = firebase.database();
    const ref = database.ref(`inventarioTurnos/${turnoKey}`);
    
    ref.set(turnoData)
      .then(() => {
        showNotification('Turno abierto exitosamente', 'success');
        inventarioActual = inventarioInicial;
        mostrarInventarioActual(turnoData);
        actualizarVistaInventario();
      })
      .catch((error) => {
        console.error('Error al abrir turno:', error);
        showNotification('Error al abrir el turno', 'error');
      });
  });
}

// Modal de confirmación estilizado para apertura/entrega/cierre de turno
function showTurnoConfirmModal(config, onConfirm) {
  const { title, message, iconClass, confirmLabel } = config;
  
  // Evitar duplicados
  const existing = document.getElementById('turnoConfirmModal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'turnoConfirmModal';
  modal.className = 'turno-confirm-overlay';
  modal.innerHTML = `
    <div class="turno-confirm-content animate-scale">
      <div class="turno-confirm-header">
        <div class="turno-confirm-icon">
          <i class="${iconClass}"></i>
        </div>
        <div>
          <h3>${title}</h3>
          <p>${message}</p>
        </div>
      </div>
      <div class="turno-confirm-actions">
        <button class="btn-cancel-confirm" type="button" id="turnoConfirmCancel">
          <i class="fas fa-times"></i> Cancelar
        </button>
        <button class="btn-accept-confirm" type="button" id="turnoConfirmAccept">
          <i class="fas fa-check"></i> ${confirmLabel}
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const closeModal = () => modal.remove();
  
  // Cerrar al hacer click fuera del contenido
  modal.addEventListener('click', (e) => {
    if (e.target.classList.contains('turno-confirm-overlay')) {
      closeModal();
    }
  });
  
  // Botones
  const cancelBtn = document.getElementById('turnoConfirmCancel');
  const acceptBtn = document.getElementById('turnoConfirmAccept');
  
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      closeModal();
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
    });
  }
}

// Actualizar vista del inventario
function actualizarVistaInventario() {
  // Actualizar inventario anual
  const gridAnual = document.querySelector('#inventarioAnual .inventario-grid-actual');
  if (gridAnual) {
    gridAnual.innerHTML = vacunasDisponibles.anual.map(vacuna => {
      const cantidad = inventarioActual[sanitizeFirebaseKey(vacuna)] || 0;
      const claseStock = cantidad === 0 ? 'sin-stock' : (cantidad <= 2 ? 'bajo-stock' : '');
      const claseCantidad = cantidad === 0 ? 'sin-stock' : (cantidad <= 2 ? 'bajo-stock' : '');
      
      return `
        <div class="inventario-item-actual ${claseStock}">
          <span class="vacuna-nombre">${vacuna}</span>
          <span class="vacuna-cantidad ${claseCantidad}">${cantidad}</span>
        </div>
      `;
    }).join('');
  }
  
  // Actualizar inventario trimestral
  const gridTrimestral = document.querySelector('#inventarioTrimestral .inventario-grid-actual');
  if (gridTrimestral) {
    gridTrimestral.innerHTML = vacunasDisponibles.trimestral.map(vacuna => {
      const cantidad = inventarioActual[sanitizeFirebaseKey(vacuna)] || 0;
      const claseStock = cantidad === 0 ? 'sin-stock' : (cantidad <= 2 ? 'bajo-stock' : '');
      const claseCantidad = cantidad === 0 ? 'sin-stock' : (cantidad <= 2 ? 'bajo-stock' : '');
      
      return `
        <div class="inventario-item-actual ${claseStock}">
          <span class="vacuna-nombre">${vacuna}</span>
          <span class="vacuna-cantidad ${claseCantidad}">${cantidad}</span>
        </div>
      `;
    }).join('');
  }
}

// Verificar inventario disponible
function verificarInventario(vacuna) {
  const cantidad = inventarioActual[sanitizeFirebaseKey(vacuna)] || 0;
  return cantidad > 0;
}

// Actualizar inventario (restar o sumar)
function actualizarInventario(vacuna, cantidad) {
  const key = sanitizeFirebaseKey(vacuna);
  if (!inventarioActual[key]) {
    inventarioActual[key] = 0;
  }
  
  inventarioActual[key] += cantidad;
  
  // Actualizar en Firebase
  const turnoKey = `${currentVacunasFecha}_${currentVacunasTurno}`;
  const database = firebase.database();
  const ref = database.ref(`inventarioTurnos/${turnoKey}/inventario`);
  
  ref.update(inventarioActual)
    .then(() => {
      actualizarVistaInventario();
    })
    .catch((error) => {
      console.error('Error al actualizar inventario:', error);
    });
}

// Función para actualizar inventario del turno cuando se elimina una vacuna
function actualizarInventarioTurno(vacuna, cantidad) {
  console.log('Actualizando inventario del turno para vacuna:', vacuna, 'cantidad:', cantidad);
  
  const key = sanitizeFirebaseKey(vacuna);
  const turnoKey = `${currentVacunasFecha}_${currentVacunasTurno}`;
  const database = firebase.database();
  const ref = database.ref(`inventarioTurnos/${turnoKey}/inventario`);
  
  // Obtener el inventario actual del turno
  ref.once('value', (snapshot) => {
    const inventarioTurno = snapshot.val() || {};
    
    if (!inventarioTurno[key]) {
      inventarioTurno[key] = 0;
    }
    
    inventarioTurno[key] += cantidad;
    
    // Actualizar el inventario en Firebase
    ref.update({ [key]: inventarioTurno[key] })
      .then(() => {
        console.log('Inventario del turno actualizado exitosamente');
        // Actualizar el inventario local
        inventarioActual[key] = inventarioTurno[key];
        actualizarVistaInventario();
      })
      .catch((error) => {
        console.error('Error al actualizar inventario del turno:', error);
      });
  });
}

// Función para cambiar tabs del inventario
window.mostrarInventarioTab = function(tipo) {
  // Ocultar todos los contenidos
  document.querySelectorAll('.inventario-tab-content').forEach(content => {
    content.style.display = 'none';
  });
  
  // Remover clase active de todos los botones
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Mostrar contenido seleccionado
  const content = document.getElementById(`inventario${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
  if (content) {
    content.style.display = 'block';
  }
  
  // Activar botón seleccionado
  const btn = document.querySelector(`[onclick="mostrarInventarioTab('${tipo}')"]`);
  if (btn) {
    btn.classList.add('active');
  }
};

// ==================== FIN FUNCIONES DEL SISTEMA DE INVENTARIO ====================

// ==================== FIN MÓDULO DE CONTROL DE VACUNAS ====================
