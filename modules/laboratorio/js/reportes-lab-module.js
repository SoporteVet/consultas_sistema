// reportes-lab-module.js - Módulo de Reportes de Laboratorio

// ---------------------------------------------------------------------------
// CONFIGURACIÓN DEL ENVÍO DE CORREO (Resend)
// ---------------------------------------------------------------------------
// URL pública de la Cloud Function `sendLabReport`. Las funciones v2 se
// despliegan en Cloud Run y exponen un dominio `*.a.run.app`; este es el que
// imprime `firebase deploy` al final.
//
// Se puede sobreescribir desde el HTML asignando `window.LAB_EMAIL_FUNCTION_URL`
// antes de cargar este módulo (útil si se cambia el proyecto/región).
const LAB_EMAIL_FUNCTION_URL =
  (typeof window !== 'undefined' && window.LAB_EMAIL_FUNCTION_URL) ||
  'https://sendlabreport-kfopngff6a-uc.a.run.app';

// Mensajes preconfigurados. Texto idéntico al `EMAIL_MESSAGES` del servidor
// (functions/index.js); cualquier ajuste de copy debe replicarse en ambos
// archivos para que el preview coincida con lo que recibe el cliente.
const LAB_EMAIL_MESSAGES = {
  consulta_externa: {
    label: 'Consulta externa',
    body: `Buenas. De parte de laboratorio, es un gusto saludarle.

Se adjuntan los resultados de los exámenes realizados. El médico veterinario encargado cuenta con un plazo de 24 a 48 horas para brindarle el reporte correspondiente.

Si en ese plazo no ha sido contactado por el médico o los resultados aún no han sido reportados, y el paciente presenta una recaída o algún síntoma que comprometa su salud, le solicitamos traerlo a revaloración médica. De esta manera, se podrán interpretar los resultados y brindarle la receta médica correspondiente.

Después de las 8:00 p.m., puede comunicarse a la central telefónica 4000-1365 para verificar la disponibilidad médica para una revaloración de emergencia.

Si el médico veterinario ya se comunicó con usted, por favor omita este mensaje.

Laboratorio Clínico Veterinario San Martín de Porres
Tel.: 4000-1365 Ext. 106
WhatsApp: 8839-2214`
  },
  internos: {
    label: 'Paciente interno',
    body: `Buenas. De parte de laboratorio, es un gusto saludarle.

Se adjuntan los resultados de los exámenes realizados. El médico en turno en el Área de Internamiento le estará brindando el reporte de los mismos durante el siguiente reporte diario del paciente, a excepción que sea una emergencia.

Horario de reportes de internamiento: 9:00am a 2:00pm. Puede variar de acuerdo al estado de los pacientes. La salud de nuestros pacientes es la prioridad. Whatsapp de internamiento 8686-2140, no se aceptan llamadas vía Whatsapp.

Laboratorio Clínico Veterinario San Martin de Porres.
Tel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`
  },
  paquetes: {
    label: 'Paquete preventivo',
    body: `Buenas. De parte de laboratorio, es un gusto saludarle.

Se adjunta el hemograma realizado en paquete de castración o de limpieza dental, el cual fue reportado antes del procedimiento.

En caso de que la mascota presente una recaída que comprometa su salud se recomienda traerla a revaloración de manera inmediata antes de las 7:30pm. Después de las 8:00pm comunicarse a la central telefónica 4000-1365 para verificar la disponibilidad médica para una revaloración de emergencia.

Laboratorio Clínico Veterinario San Martin de Porres.
Tel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`
  },
  reportado: {
    label: 'Reportado por médico',
    body: `Buenas. De parte de laboratorio, es un gusto saludarle.

Se adjunta el Examen realizado, el cual fue reportado en consulta.

En caso de que la mascota presente una recaída que comprometa su salud se recomienda traerla a revaloración de manera inmediata antes de las 7:30pm. Después de las 8:00pm comunicarse a la central telefónica 4000-1365 para verificar la disponibilidad médica para una revaloración de emergencia.

Laboratorio Clínico Veterinario San Martin de Porres.
Tel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`
  },
  sin_medico: {
    label: 'Sin médico tratante',
    body: `Buenas. De parte de laboratorio, es un gusto saludarle.

Se adjunta el Examen realizado.

Laboratorio Clínico Veterinario San Martin de Porres.
Tel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`
  }
};

const LAB_EMAIL_MAX_ATTACHMENTS = 20;

// Estado del módulo
let labReportSelectedClient = null;
let labReportSelectedTemplate = null;
let labReportTicketsSearchCache = null;

// Cola de PDFs preparados para envío por correo: [{ id, fileName, pdfBase64, sizeKB }]
const labEmailQueue = [];

// Mapeo de plantillas a archivos HTML del repositorio
// Las rutas son relativas a index.html que está en la raíz del proyecto
const LAB_REPORT_TEMPLATES = {
  hemograma: { name: 'Hemograma', file: 'modules/laboratorio/pages/hemograma_2.html' },
  tiempos_coagulacion: { name: 'Tiempos de Coagulación', file: 'modules/laboratorio/pages/tiempos_coagulacion.html' },
  tipificacion: { name: 'Tipificación', file: 'modules/laboratorio/pages/tipificacion.html' },
  panel_basico: { name: 'Panel Básico', file: 'modules/laboratorio/pages/Panel_Básico.html' },
  panel_plus: { name: 'Panel Plus', file: 'modules/laboratorio/pages/Panel_Plus.html' },
  perfil_quimico: { name: 'Perfil Químico', file: 'modules/laboratorio/pages/perfil_quimico.html' },
  analitos_laboratorio: { name: 'Analitos Laboratorio', file: 'modules/laboratorio/pages/analitos_laboratorio.html' },
  perfil_adulto: { name: 'Perfil Adulto Completo', file: 'modules/laboratorio/pages/perfil_adulto.html' },
  perfil_renal: { name: 'Perfil Renal', file: 'modules/laboratorio/pages/perfil_renal.html' },
  perfil_pre_quirurgico: { name: 'Perfil Pre-Quirúrgico', file: 'modules/laboratorio/pages/perfil_pre_quirurgico.html' },
  perfil_hepatico: { name: 'Perfil Hepático', file: 'modules/laboratorio/pages/perfil_hepatico.html' },
  electrolitos: { name: 'Electrolitos', file: 'modules/laboratorio/pages/electrolitos.html' },
  heces: { name: 'Análisis de Heces', file: 'modules/laboratorio/pages/heces.html' },
  urianalisis: { name: 'Urianálisis', file: 'modules/laboratorio/pages/urianalisis.html' },
  tira_reactiva: { name: 'Tira Reactiva', file: 'modules/laboratorio/pages/tira_reactiva.html' },
  frotis: { name: 'Frotis Sanguíneo', file: 'modules/laboratorio/pages/frotis.html' },
  hisopado_oido: { name: 'Hisopado de Oído', file: 'modules/laboratorio/pages/hisopado_oido.html' },
  reticulocitos: { name: 'Conteo de Reticulocitos', file: 'modules/laboratorio/pages/reticulocitos.html' },
  analisis_liquido_libre: { name: 'Análisis Líquido Libre', file: 'modules/laboratorio/pages/analisis_liquido_libre.html' },
  tests: { name: 'Pruebas Rápidas', file: 'modules/laboratorio/pages/Tests_Laboratorio.html' }
};

// Función auxiliar para convertir texto a formato de primera letra mayúscula
function capitalizeFirstLetter(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Si el texto ya tiene capitalización correcta (como nombres propios), no lo alteremos
  if (text.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/)) {
    return text;
  }
  
  // Para texto que no es nombre propio, aplicar capitalización estándar
  return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

// Asegurar inicialización aunque el DOM ya esté listo
(function() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReportesLabModule);
  } else {
    initReportesLabModule();
  }
})();

function initReportesLabModule() {
  try {
    console.log('🔧 Inicializando módulo de Reportes Lab...');
    
    // Verificar elementos del DOM
    const grid = document.getElementById('labReportTemplateGrid');
    const searchBtn = document.getElementById('searchLabReportClientBtn');
    const searchInput = document.getElementById('labReportClientSearch');
    const resultsContainer = document.getElementById('labReportClientResults');
    
    console.log('📋 Elementos DOM encontrados:', {
      grid: !!grid,
      searchBtn: !!searchBtn,
      searchInput: !!searchInput,
      resultsContainer: !!resultsContainer
    });
    
    renderLabReportTemplates();
    setupReportesLabEventListeners();
    console.log('✅ Módulo de Reportes Lab inicializado');
  } catch (e) {
    console.error('❌ Error inicializando módulo de Reportes Lab:', e);
  }
}

function setupReportesLabEventListeners() {
  const searchBtn = document.getElementById('searchLabReportClientBtn');
  const searchInput = document.getElementById('labReportClientSearch');
  const templateCards = document.querySelectorAll('#labReportTemplateGrid .template-card');
  const closeBtn = document.getElementById('closeLabReportBtn');
  const printBtn = document.getElementById('printLabReportBtn');

  if (searchBtn) searchBtn.addEventListener('click', searchLabReportClients);
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchLabReportClients();
    });
    // Búsqueda en tiempo real con debounce
    let t;
    searchInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(searchLabReportClients, 400);
    });
  }

  if (templateCards.length) {
    templateCards.forEach(card => {
      card.addEventListener('click', () => {
        const key = card.getAttribute('data-template');
        selectLabReportTemplate(key);
      });
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeLabReportViewer);
  if (printBtn) printBtn.addEventListener('click', printLabReportFromIframe);

  // --- Flujo de envío por correo --------------------------------------------
  const addToEmailBtn = document.getElementById('addLabReportToEmailBtn');
  const openEmailModalBtn = document.getElementById('openLabEmailModalBtn');
  const clearQueueBtn = document.getElementById('clearLabEmailQueueBtn');
  const closeEmailModalBtn = document.getElementById('closeLabEmailModalBtn');
  const cancelEmailBtn = document.getElementById('cancelLabEmailBtn');
  const emailForm = document.getElementById('labEmailForm');
  const messageTypeSelect = document.getElementById('labEmailMessageType');

  if (addToEmailBtn) addToEmailBtn.addEventListener('click', addCurrentReportToEmailQueue);
  if (openEmailModalBtn) openEmailModalBtn.addEventListener('click', openLabEmailModal);
  if (clearQueueBtn) clearQueueBtn.addEventListener('click', clearLabEmailQueue);
  if (closeEmailModalBtn) closeEmailModalBtn.addEventListener('click', closeLabEmailModal);
  if (cancelEmailBtn) cancelEmailBtn.addEventListener('click', closeLabEmailModal);
  if (messageTypeSelect) messageTypeSelect.addEventListener('change', updateLabEmailPreview);
  if (emailForm) emailForm.addEventListener('submit', submitLabEmailForm);

  updateLabEmailPreview();
  renderLabEmailQueue();
}

function renderLabReportTemplates() {
  const grid = document.getElementById('labReportTemplateGrid');
  if (!grid) {
    console.warn('Grid labReportTemplateGrid no encontrado');
    return;
  }
  
  // Limpiar grid existente antes de renderizar
  grid.innerHTML = '';
  console.log('Renderizando plantillas de reportes lab...');

  const fragment = document.createDocumentFragment();
  Object.entries(LAB_REPORT_TEMPLATES).forEach(([key, tpl]) => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.setAttribute('data-template', key);
    card.innerHTML = `<h4>${tpl.name}</h4><p>Seleccionar</p>`;
    card.addEventListener('click', () => selectLabReportTemplate(key));
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);
  console.log(`${Object.keys(LAB_REPORT_TEMPLATES).length} plantillas renderizadas`);
}

async function searchLabReportClients() {
  const input = document.getElementById('labReportClientSearch');
  const resultsContainer = document.getElementById('labReportClientResults');
  const termRaw = (input?.value || '').trim();
  if (!termRaw || termRaw.length < 2) {
    if (resultsContainer) {
      resultsContainer.innerHTML = '<div class="no-clients-found"><i class="fas fa-info-circle"></i> Ingrese al menos 2 caracteres</div>';
      resultsContainer.classList.add('active');
    }
    return;
  }

  const term = termRaw.toLowerCase();

  if (resultsContainer) {
    resultsContainer.innerHTML = '<div class="no-clients-found"><i class="fas fa-spinner fa-spin"></i> Buscando tickets de laboratorio...</div>';
    resultsContainer.classList.add('active');
  }

  try {
    // Primero usa lo que ya cargó laboratorio.js. Si no hay resultados,
    // consulta Firebase completo; esto permite buscar sin abrir antes la
    // sección "Ver laboratorio" y también evita depender del rango reciente.
    const inMemorySource = Array.isArray(window.labTickets) ? window.labTickets : [];
    let clients = buildLabReportClientsFromTickets(inMemorySource, term);

    if (clients.length === 0) {
      const firebaseSource = await getAllLabTicketsForReportSearch();
      clients = buildLabReportClientsFromTickets(firebaseSource, term);
    }

    displayLabReportClientResults(clients);
  } catch (error) {
    console.error('Error buscando clientes de reportes lab:', error);
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="no-clients-found">
          <i class="fas fa-exclamation-triangle"></i>
          <h4>No se pudo cargar la búsqueda</h4>
          <p>${error?.message || 'Revise la conexión con Firebase.'}</p>
        </div>`;
      resultsContainer.classList.add('active');
    }
  }
}

function buildLabReportClientsFromTickets(source, term) {
  const tickets = Array.isArray(source) ? source : [];
  const clientsMap = new Map();

  tickets.forEach(t => {
    if (!t) return;
    const searchable = [
      t.nombre,
      t.nombreCliente,
      t.cedula,
      t.mascota,
      t.nombreMascota,
      t.idPaciente,
      t.factura,
      t.numFactura,
      t.telefono,
      t.correo,
      t.medicoSolicita,
      t.medicoAtiende
    ]
      .filter(Boolean)
      .map(value => String(value).toLowerCase());

    if (!searchable.some(value => value.includes(term))) return;

    const key = `${t.cedula || t.idPaciente || t.nombre || t.nombreCliente}|${t.mascota || t.nombreMascota || ''}`;
    if (!clientsMap.has(key)) {
      clientsMap.set(key, normalizeLabTicketToClient(t));
    }
  });

  return Array.from(clientsMap.values());
}

async function getAllLabTicketsForReportSearch() {
  if (Array.isArray(labReportTicketsSearchCache)) {
    return labReportTicketsSearchCache;
  }
  if (!window.database || typeof window.database.ref !== 'function') {
    return Array.isArray(window.labTickets) ? window.labTickets : [];
  }

  const snapshot = await window.database.ref('lab_tickets').once('value');
  const tickets = [];
  if (snapshot.exists()) {
    const data = snapshot.val();
    Object.keys(data).forEach(key => {
      tickets.push({ ...data[key], firebaseKey: key });
    });
  }

  labReportTicketsSearchCache = tickets;
  window.labTickets = tickets;
  return tickets;
}

function normalizeLabTicketToClient(t) {
  const normalized = {
    nombre: capitalizeFirstLetter(t.nombre || t.nombreCliente || 'Sin nombre'),
    cedula: t.cedula || t.idPaciente || '',
    telefono: t.telefono || '',
    correo: t.correo || '',
    mascota: capitalizeFirstLetter(t.mascota || t.nombreMascota || ''),
    tipoMascota: t.tipoMascota || 'otro',
    raza: capitalizeFirstLetter(t.raza || ''),
    edad: (t.edad || '').toLowerCase(), // Convertir edad a minúsculas
    peso: t.peso || '',
    sexo: t.sexo || '',
    idPaciente: t.idPaciente || '',
    fecha: t.fecha || t.fechaServicio || '',
    medico: t.medicoSolicita || t.medicoAtiende || '', // No aplicar capitalizeFirstLetter a nombres de doctores
    estado: t.estado || '',
    factura: t.factura || t.numFactura || '',
    ticketId: t.randomId || t.firebaseKey || ''
  };
  
  // Log para debugging de la normalización
  console.log('🔍 Datos normalizados del ticket:', {
    razaOriginal: t.raza,
    razaNormalizada: normalized.raza,
    edadOriginal: t.edad,
    edadNormalizada: normalized.edad,
    nombreOriginal: t.nombre,
    nombreNormalizado: normalized.nombre
  });
  
  return normalized;
}

function displayLabReportClientResults(clients) {
  const resultsContainer = document.getElementById('labReportClientResults');
  if (!resultsContainer) return;

  if (!clients || clients.length === 0) {
    resultsContainer.innerHTML = `
      <div class="no-clients-found">
        <i class="fas fa-user-slash"></i>
        <h4>No se encontraron clientes</h4>
      </div>`;
    resultsContainer.classList.add('active');
    return;
  }

  // Guardar global para seleccionar por índice
  window.foundLabReportClients = clients;
  const html = clients.map((c, idx) => `
    <div class="client-result-item" onclick="selectLabReportClient(${idx})">
      <div class="client-info">
        <h4>${c.nombre}</h4>
        <div class="client-details">
          <div class="client-detail"><i class="fas fa-id-card"></i> <span>${c.cedula}</span></div>
          <div class="client-detail"><i class="fas fa-phone"></i> <span>${c.telefono || '—'}</span></div>
          <div class="client-detail"><i class="fas fa-paw"></i> <span>${c.mascota || '—'}</span></div>
          <div class="client-detail"><i class="fas fa-dna"></i> <span>${c.raza || '—'}</span></div>
          <div class="client-detail"><i class="fas fa-user-md"></i> <span>${c.medico || '—'}</span></div>
        </div>
      </div>
    </div>`).join('');

  resultsContainer.innerHTML = html;
  resultsContainer.classList.add('active');
}

function selectLabReportClient(index) {
  if (!window.foundLabReportClients || !window.foundLabReportClients[index]) return;
  labReportSelectedClient = window.foundLabReportClients[index];

  // Marcar visualmente
  document.querySelectorAll('#labReportClientResults .client-result-item').forEach(el => el.classList.remove('selected'));
  const selectedEl = document.querySelectorAll('#labReportClientResults .client-result-item')[index];
  if (selectedEl) selectedEl.classList.add('selected');

  showLabReportNotification('Cliente seleccionado: ' + labReportSelectedClient.nombre, 'success');
}

function selectLabReportTemplate(templateKey) {
  if (!LAB_REPORT_TEMPLATES[templateKey]) {
    showLabReportNotification('Plantilla no encontrada', 'error');
    return;
  }
  labReportSelectedTemplate = templateKey;

  // UI selection
  document.querySelectorAll('#labReportTemplateGrid .template-card').forEach(c => c.classList.remove('selected'));
  const sel = document.querySelector(`#labReportTemplateGrid .template-card[data-template="${templateKey}"]`);
  if (sel) sel.classList.add('selected');

  const template = LAB_REPORT_TEMPLATES[templateKey];
  const title = document.getElementById('selectedLabReportTitle');
  if (title) title.textContent = template.name;

  openLabReportViewer(templateKey);
}

// Mapea el tipoMascota del ticket al valor que esperan los selectores de las
// plantillas (`Canino`, `Felino`, `Lagomorfo`, `Cuilo`).
function mapTipoMascotaToEspecie(tipoMascota) {
  if (!tipoMascota) return '';
  const t = tipoMascota.toString().trim().toLowerCase();
  if (t === 'perro' || t === 'canino' || t === 'can') return 'Canino';
  if (t === 'gato' || t === 'felino') return 'Felino';
  if (t === 'conejo' || t === 'lagomorfo') return 'Lagomorfo';
  if (t === 'cuilo' || t === 'cuy' || t === 'cobayo' || t === 'cobaya') return 'Cuilo';
  return capitalizeFirstLetter(tipoMascota);
}

// Normaliza "Macho"/"Hembra" para el selector de sexo.
function mapSexoToSelector(sexo) {
  if (!sexo) return '';
  const s = sexo.toString().trim().toLowerCase();
  if (s.startsWith('m')) return 'Macho';
  if (s.startsWith('h') || s.startsWith('f')) return 'Hembra';
  return capitalizeFirstLetter(sexo);
}

// Convierte un texto libre de edad ("5 meses", "1 año", "3 años", "1.5 años")
// al rango que entiende el `edadSelector` de las plantillas.
function mapEdadToRango(edad) {
  if (!edad) return '';
  const txt = edad.toString().trim().toLowerCase();
  const num = parseFloat(txt.replace(',', '.'));
  if (!isFinite(num) || num <= 0) return '';

  let meses = num;
  if (/a[nñ]o/.test(txt)) meses = num * 12;
  else if (/mes/.test(txt)) meses = num;
  else if (/sem/.test(txt)) meses = num / 4.345;
  else if (/d[ií]a/.test(txt)) meses = num / 30;
  else meses = num >= 1 && num <= 25 ? num * 12 : num;

  if (meses < 1.5) return 'Menor de mes y medio';
  if (meses < 6) return 'De mes y medio a 5 meses';
  if (meses < 12) return 'De 6 meses a 1 año';
  if (meses <= 12 * 12) return 'De 1 año a 12 años';
  return 'Todas las edades';
}

// Normaliza una fecha cualquiera (ISO, dd/mm/yyyy, dd-mm-yyyy) al formato
// `yyyy-mm-dd` que requiere `<input type="date">`.
function normalizeDateForInput(rawDate) {
  if (!rawDate) return '';
  const s = rawDate.toString().trim();
  if (!s) return '';
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    let yyyy = dmyMatch[3];
    if (yyyy.length === 2) yyyy = (parseInt(yyyy, 10) > 50 ? '19' : '20') + yyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

function openLabReportViewer(templateKey) {
  const container = document.getElementById('labReportFormContainer');
  const iframe = document.getElementById('labReportIframe');
  const template = LAB_REPORT_TEMPLATES[templateKey];
  if (!container || !iframe || !template) {
    console.error('Elementos no encontrados:', {container: !!container, iframe: !!iframe, template: !!template});
    return;
  }

  // Construir URL con parámetros de autollenado (compatibilidad con plantillas
  // que ya leen `URLSearchParams` directamente, p.ej. hemograma_2.html).
  const params = new URLSearchParams({ template: templateKey });
  let autofillData = null;

  if (labReportSelectedClient) {
    const c = labReportSelectedClient;
    autofillData = {
      mascotaNombre: c.mascota || '',
      propietarioNombre: c.nombre || '',
      propietarioCedula: c.cedula || '',
      propietarioTelefono: c.telefono || '',
      propietarioEmail: c.correo || '',
      nombreMedico: c.medico || '',
      mascotaEdad: c.edad || '',
      mascotaPeso: c.peso || '',
      mascotaRaza: c.raza || '',
      mascotaSexo: mapSexoToSelector(c.sexo),
      especie: mapTipoMascotaToEspecie(c.tipoMascota),
      edadRango: mapEdadToRango(c.edad || ''),
      propietarioFecha: normalizeDateForInput(c.fecha) || normalizeDateForInput(new Date().toISOString()),
      idPaciente: c.idPaciente || ''
    };
    Object.entries(autofillData).forEach(([k, v]) => params.set(k, v || ''));
  }

  const url = `${template.file}?${params.toString()}`;

  iframe.style.width = '100%';
  iframe.style.height = '80vh';
  iframe.style.border = 'none';
  iframe.style.display = 'block';

  // Inyectar autollenado al cargarse el iframe; cubre todas las plantillas
  // sin necesidad de modificar cada archivo HTML.
  iframe.onload = () => {
    if (autofillData) {
      try {
        applyAutofillToIframe(iframe, autofillData);
      } catch (e) {
        console.warn('No se pudo autocompletar el reporte:', e);
      }
    }
  };

  iframe.src = url;
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });

  console.log('🖼️ Visor de reportes abierto:', { url, templateKey });
}

/**
 * Aplica el autollenado dentro del iframe del reporte. Cubre tanto los
 * inputs de texto (mascota, propietario, médico, raza, edad, peso, fecha,
 * idPaciente) como los `<select>` de especie, sexo y rango de edad. Los
 * eventos `change` se disparan para que las plantillas recalculen valores
 * de referencia y datalists de razas dependientes.
 */
function applyAutofillToIframe(iframe, data) {
  const cw = iframe.contentWindow;
  const cd = iframe.contentDocument || cw?.document;
  if (!cd) return;

  const setInput = (id, value) => {
    if (value == null || value === '') return;
    const el = cd.getElementById(id);
    if (!el) return;
    el.value = value;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
  };

  const setSelect = (id, value) => {
    if (!value) return;
    const sel = cd.getElementById(id);
    if (!sel) return;
    const wanted = value.toString().toLowerCase();
    let matched = '';
    for (const opt of sel.options) {
      if ((opt.value || '').toLowerCase() === wanted) { matched = opt.value; break; }
    }
    if (!matched) {
      for (const opt of sel.options) {
        const txt = (opt.textContent || '').toLowerCase();
        if (txt === wanted || txt.includes(wanted)) { matched = opt.value; break; }
      }
    }
    if (!matched) return;
    sel.value = matched;
    try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
  };

  // 1) Selectores PRIMERO (especie y sexo). El listener `change` de la
  //    plantilla puede limpiar el campo `mascotaRaza` al cambiar la especie,
  //    por eso no llenamos la raza hasta después.
  setSelect('especieSelector', data.especie);
  setSelect('sexoSelector', data.mascotaSexo);
  setSelect('edadSelector', data.edadRango);

  // 2) Inputs de mascota / propietario.
  setInput('mascotaNombre', data.mascotaNombre);
  setInput('mascotaRaza', data.mascotaRaza);
  setInput('mascotaEdad', data.mascotaEdad);
  setInput('mascotaPeso', data.mascotaPeso);
  setInput('propietarioNombre', data.propietarioNombre);
  setInput('propietarioCedula', data.propietarioCedula);
  setInput('propietarioTelefono', data.propietarioTelefono);
  setInput('propietarioEmail', data.propietarioEmail);
  setInput('nombreMedico', data.nombreMedico);
  setInput('propietarioFecha', data.propietarioFecha);
  setInput('idPaciente', data.idPaciente);

  // 3) Espejo de especie/sexo en los inputs de la tabla (las plantillas a
  //    veces solo se actualizan al disparar `change`; aquí lo reforzamos).
  setInput('especieEnPlantilla', data.especie);
  setInput('sexoEnPlantilla', data.mascotaSexo);

  // 4) Algunas plantillas exponen un helper de revisión de médico.
  if (typeof cw?.verificarMedico === 'function') {
    try { cw.verificarMedico(); } catch (_) {}
  }

  // 5) Recalcular valores de referencia si la plantilla lo soporta.
  if (typeof cw?.actualizarValoresReferencia === 'function') {
    try { cw.actualizarValoresReferencia(); } catch (_) {}
  }
}

function closeLabReportViewer() {
  const container = document.getElementById('labReportFormContainer');
  const iframe = document.getElementById('labReportIframe');
  if (container) container.style.display = 'none';
  if (iframe) iframe.src = '';
  document.querySelectorAll('#labReportTemplateGrid .template-card').forEach(c => c.classList.remove('selected'));
  labReportSelectedTemplate = null;
}

function printLabReportFromIframe() {
  const iframe = document.getElementById('labReportIframe');
  if (iframe && iframe.contentWindow) {
    try {
      // Intentar invocar funciones propias de la plantilla si existen (generatePDF)
      if (iframe.contentWindow.generatePDF) {
        iframe.contentWindow.generatePDF();
        return;
      }
      iframe.contentWindow.print();
    } catch (e) {
      console.warn('No se pudo imprimir desde el iframe:', e);
      showLabReportNotification('No se pudo imprimir desde el iframe', 'warning');
    }
  }
}

function showLabReportNotification(message, type = 'info') {
  if (typeof showNotification === 'function') {
    showNotification(message, type);
    return;
  }
  // Fallback simple
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ===========================================================================
// FLUJO DE ENVÍO DE CORREO (Resend / Cloud Function `sendLabReport`)
// ===========================================================================

/**
 * Captura el reporte abierto en el iframe como PDF en formato data URI,
 * SIN disparar descarga ni cuadro de "Guardar como".
 *
 * Estrategia: invocar el `generatePDF()` propio de la plantilla (el mismo
 * que usa el botón "PDF" y que ya sabemos que produce un PDF con todos los
 * estilos, colores y tablas), pero parcheando temporalmente:
 *   - `jsPDF.prototype.save`     → captura el data URI sin descargar.
 *   - `window.showSaveFilePicker`→ falla intencionalmente para forzar el
 *                                   fallback que termina llamando a
 *                                   `pdf.save()` (en plantillas que usan la
 *                                   File System Access API).
 *   - `URL.createObjectURL`      → para algún caso edge donde la plantilla
 *                                   genera blob y lanza descarga manual.
 *
 * Cuando termina, restaura todo a su estado original.
 *
 * @returns {Promise<{fileName: string, dataUri: string}>}
 */
async function captureLabReportPdfFromIframe() {
  const log = (...args) => console.log('[lab-email][capture]', ...args);
  log('inicio captura');

  const iframe = document.getElementById('labReportIframe');
  if (!iframe || !iframe.contentWindow) {
    throw new Error('No hay reporte abierto.');
  }
  const cw = iframe.contentWindow;

  if (typeof cw.generatePDF !== 'function') {
    throw new Error('La plantilla no expone generatePDF(); abre primero un reporte válido.');
  }
  if (!cw.URL || typeof cw.URL.createObjectURL !== 'function') {
    throw new Error('El iframe no tiene URL.createObjectURL disponible.');
  }

  const templateName =
    (labReportSelectedTemplate && LAB_REPORT_TEMPLATES[labReportSelectedTemplate]?.name) ||
    'Reporte';
  const petName = (labReportSelectedClient?.mascota || 'Sin_nombre').toString();
  const apellido = primerApellidoDesdeNombre(
    labReportSelectedClient?.nombre || 'Sin_apellido'
  );
  const defaultFileName = `${templateName} - ${petName} ${apellido}`.trim() + '.pdf';

  const originalCreateObjectURL = cw.URL.createObjectURL.bind(cw.URL);
  const originalShowSaveFilePicker = cw.showSaveFilePicker;
  const originalAlert = cw.alert;

  const restore = () => {
    try { cw.URL.createObjectURL = originalCreateObjectURL; } catch (_) {}
    if (originalShowSaveFilePicker) {
      try { cw.showSaveFilePicker = originalShowSaveFilePicker; } catch (_) {}
    } else {
      try { delete cw.showSaveFilePicker; } catch (_) {}
    }
    try { cw.alert = originalAlert; } catch (_) {}
  };

  // Pre-cachear imágenes del iframe (timeout 3 s) para que html2canvas no
  // quede bloqueado esperando imágenes lentas o rotas.
  const tStart = performance.now();
  try {
    const imgs = Array.from(cw.document.getElementsByTagName('img') || []);
    if (imgs.length) {
      await Promise.race([
        Promise.all(
          imgs.map(
            (img) => new Promise((res) => {
              if (img.complete) return res();
              const done = () => { img.removeEventListener('load', done); img.removeEventListener('error', done); res(); };
              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
            })
          )
        ),
        new Promise((r) => setTimeout(r, 3000))
      ]);
    }
  } catch (_) {}
  log('pre-cache imgs ms=', Math.round(performance.now() - tStart));

  return new Promise((resolve, reject) => {
    let captured = false;
    const tCap = performance.now();

    // Estrategia: jsPDF llama a URL.createObjectURL(pdfBlob) justo antes de
    // intentar la descarga. Lo interceptamos aquí con un FileReader para leer
    // el blob como data URI. Devolvemos un string vacío para que FileSaver
    // no navegue a ningún lado (descarga bloqueada).
    cw.URL.createObjectURL = function interceptCreateObjectURL(blob) {
      if (captured) return '';
      if (blob && (blob.type === 'application/pdf' || blob.type === 'application/octet-stream' || blob.size > 0)) {
        const reader = new cw.FileReader();
        reader.onload = (e) => {
          if (captured) return;
          captured = true;
          restore();
          log('PDF capturado vía createObjectURL en', Math.round(performance.now() - tCap), 'ms');
          resolve({ fileName: defaultFileName, dataUri: e.target.result });
        };
        reader.onerror = () => {
          if (!captured) { restore(); reject(new Error('Error leyendo el blob del PDF.')); }
        };
        reader.readAsDataURL(blob);
        return '';
      }
      return originalCreateObjectURL(blob);
    };

    // Bloquear showSaveFilePicker (File System Access API) para forzar el
    // fallback a pdf.save() → jsPDF → createObjectURL.
    // Error genérico (no AbortError) hace que el catch de la plantilla ejecute pdf.save().
    cw.showSaveFilePicker = function() {
      return Promise.reject(new Error('captura interceptada'));
    };

    // Silenciar alerts de la plantilla.
    cw.alert = () => {};

    log('llamando cw.generatePDF()...');
    try {
      const ret = cw.generatePDF();
      Promise.resolve(ret).catch((err) => {
        if (!captured) { restore(); reject(err); }
      });
    } catch (err) {
      if (!captured) { restore(); reject(err); }
    }

    setTimeout(() => {
      if (!captured) {
        restore();
        reject(new Error('La captura del PDF tardó más de 25 s.'));
      }
    }, 25000);
  });
}

function withTimeout(promise, ms, errorMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(errorMessage || `Timeout tras ${ms}ms.`)),
      ms
    );
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function primerApellidoDesdeNombre(nombre) {
  if (!nombre || typeof nombre !== 'string') return '';
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0];
  if (partes.length === 2) return partes[1];
  return partes[2];
}

async function addCurrentReportToEmailQueue() {
  if (!labReportSelectedTemplate) {
    showLabReportNotification('Seleccione primero una plantilla de reporte.', 'warning');
    return;
  }
  if (labEmailQueue.length >= LAB_EMAIL_MAX_ATTACHMENTS) {
    showLabReportNotification(
      `Solo puede adjuntar hasta ${LAB_EMAIL_MAX_ATTACHMENTS} reportes por envío.`,
      'warning'
    );
    return;
  }

  const btn = document.getElementById('addLabReportToEmailBtn');
  const originalHtml = btn ? btn.innerHTML : null;
  let tickInterval = null;
  if (btn) {
    btn.disabled = true;
    const t0 = Date.now();
    const updateLabel = () => {
      const secs = Math.floor((Date.now() - t0) / 1000);
      btn.innerHTML =
        `<i class="fas fa-spinner fa-spin"></i> Generando PDF... ${secs}s`;
    };
    updateLabel();
    tickInterval = setInterval(updateLabel, 250);
  }
  try {
    const { fileName, dataUri } = await captureLabReportPdfFromIframe();
    const sizeKB = Math.max(1, Math.round((dataUri.length * 0.75) / 1024));
    labEmailQueue.push({
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fileName,
      pdfBase64: dataUri,
      sizeKB
    });
    renderLabEmailQueue();
    showLabReportNotification(
      `"${fileName}" añadido al correo (${labEmailQueue.length} adjunto${
        labEmailQueue.length === 1 ? '' : 's'
      }).`,
      'success'
    );
  } catch (err) {
    console.error('Error añadiendo reporte al correo:', err);
    showLabReportNotification(
      'No se pudo generar el PDF: ' + (err?.message || err),
      'error'
    );
  } finally {
    if (tickInterval) clearInterval(tickInterval);
    if (btn) {
      btn.disabled = false;
      if (originalHtml) btn.innerHTML = originalHtml;
    }
  }
}

function renderLabEmailQueue() {
  const bar = document.getElementById('labEmailQueueBar');
  const list = document.getElementById('labEmailQueueList');
  const summary = document.getElementById('labEmailQueueSummary');
  const countSpan = document.getElementById('labEmailQueueCount');
  const openBtn = document.getElementById('openLabEmailModalBtn');

  if (countSpan) countSpan.textContent = String(labEmailQueue.length);
  if (openBtn) openBtn.disabled = labEmailQueue.length === 0;

  if (!bar || !list || !summary) return;

  if (labEmailQueue.length === 0) {
    bar.style.display = 'none';
    list.innerHTML = '';
    summary.textContent = '0 archivos';
    return;
  }
  bar.style.display = 'block';
  const totalKB = labEmailQueue.reduce((acc, a) => acc + (a.sizeKB || 0), 0);
  summary.textContent = `${labEmailQueue.length} archivo${
    labEmailQueue.length === 1 ? '' : 's'
  } · ${totalKB} KB`;

  list.innerHTML = labEmailQueue
    .map(
      (att) => `
      <li style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;">
        <span style="display:flex;align-items:center;gap:8px;color:#0f172a;">
          <i class="fas fa-file-pdf" style="color:#dc2626;"></i>
          <span style="font-weight:500;">${escapeHtmlForEmail(att.fileName)}</span>
          <span style="color:#64748b;font-size:11px;">${att.sizeKB} KB</span>
        </span>
        <button type="button" data-id="${att.id}" class="lab-email-remove-att" style="background:transparent;border:none;color:#dc2626;cursor:pointer;" title="Eliminar adjunto">
          <i class="fas fa-times"></i>
        </button>
      </li>`
    )
    .join('');

  list.querySelectorAll('.lab-email-remove-att').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const idx = labEmailQueue.findIndex((a) => a.id === id);
      if (idx >= 0) {
        labEmailQueue.splice(idx, 1);
        renderLabEmailQueue();
      }
    });
  });
}

function clearLabEmailQueue() {
  if (labEmailQueue.length === 0) return;
  if (!confirm('¿Vaciar la cola de adjuntos preparados?')) return;
  labEmailQueue.length = 0;
  renderLabEmailQueue();
}

function openLabEmailModal() {
  if (labEmailQueue.length === 0) {
    showLabReportNotification(
      'Añada al menos un reporte al correo antes de enviar.',
      'warning'
    );
    return;
  }
  const modal = document.getElementById('labEmailModal');
  if (!modal) return;

  const toInput = document.getElementById('labEmailToInput');
  const clientNameInput = document.getElementById('labEmailClientName');
  const petNameInput = document.getElementById('labEmailPetName');

  if (toInput && labReportSelectedClient?.correo) {
    toInput.value = labReportSelectedClient.correo;
  }
  if (clientNameInput && labReportSelectedClient?.nombre) {
    clientNameInput.value = labReportSelectedClient.nombre;
  }
  if (petNameInput && labReportSelectedClient?.mascota) {
    petNameInput.value = labReportSelectedClient.mascota;
  }

  renderLabEmailModalAttachments();
  updateLabEmailPreview();
  setLabEmailFormError('');

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeLabEmailModal() {
  const modal = document.getElementById('labEmailModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
}

function renderLabEmailModalAttachments() {
  const list = document.getElementById('labEmailModalAttachmentsList');
  const count = document.getElementById('labEmailModalAttachmentsCount');
  if (count) count.textContent = String(labEmailQueue.length);
  if (!list) return;
  if (labEmailQueue.length === 0) {
    list.innerHTML = '<li style="color:#94a3b8;">Sin adjuntos.</li>';
    return;
  }
  list.innerHTML = labEmailQueue
    .map(
      (a) =>
        `<li><i class="fas fa-file-pdf" style="color:#dc2626;margin-right:6px;"></i>${escapeHtmlForEmail(
          a.fileName
        )} <span style="color:#94a3b8;font-size:11px;">(${a.sizeKB} KB)</span></li>`
    )
    .join('');
}

function updateLabEmailPreview() {
  const select = document.getElementById('labEmailMessageType');
  const preview = document.getElementById('labEmailPreview');
  if (!preview) return;
  const key = select ? select.value : 'consulta_externa';
  const message = LAB_EMAIL_MESSAGES[key];
  preview.textContent = message ? message.body : '';
}

function setLabEmailFormError(message) {
  const errEl = document.getElementById('labEmailFormError');
  if (!errEl) return;
  if (!message) {
    errEl.style.display = 'none';
    errEl.textContent = '';
    return;
  }
  errEl.style.display = 'block';
  errEl.textContent = message;
}

async function submitLabEmailForm(event) {
  event.preventDefault();
  setLabEmailFormError('');

  const toInput = document.getElementById('labEmailToInput');
  const messageTypeSelect = document.getElementById('labEmailMessageType');
  const clientNameInput = document.getElementById('labEmailClientName');
  const petNameInput = document.getElementById('labEmailPetName');
  const sendBtn = document.getElementById('sendLabEmailBtn');

  const to = (toInput?.value || '').trim();
  const messageType = messageTypeSelect?.value || '';
  const clientName = (clientNameInput?.value || '').trim();
  const petName = (petNameInput?.value || '').trim();

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    setLabEmailFormError('Ingrese un correo electrónico válido.');
    return;
  }
  if (!LAB_EMAIL_MESSAGES[messageType]) {
    setLabEmailFormError('Seleccione un tipo de mensaje válido.');
    return;
  }
  if (labEmailQueue.length === 0) {
    setLabEmailFormError('No hay adjuntos en la cola de envío.');
    return;
  }

  const payload = {
    to,
    messageType,
    clientName,
    petName,
    attachments: labEmailQueue.map((a) => ({
      fileName: a.fileName,
      pdfBase64: a.pdfBase64
    }))
  };

  const originalLabel = sendBtn ? sendBtn.innerHTML : null;
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  }

  try {
    const response = await fetch(LAB_EMAIL_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    let body = null;
    try {
      body = await response.json();
    } catch (_) {
      body = null;
    }
    if (!response.ok) {
      const msg =
        (body && body.error) ||
        `Error ${response.status} al enviar el correo.`;
      throw new Error(msg);
    }
    showLabReportNotification(
      `Correo enviado a ${to}${body?.id ? ' (ID: ' + body.id + ')' : ''}.`,
      'success'
    );
    labEmailQueue.length = 0;
    renderLabEmailQueue();
    closeLabEmailModal();
  } catch (err) {
    console.error('Error enviando correo de laboratorio:', err);
    setLabEmailFormError(err?.message || 'No se pudo enviar el correo.');
    showLabReportNotification(
      'No se pudo enviar el correo: ' + (err?.message || err),
      'error'
    );
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      if (originalLabel) sendBtn.innerHTML = originalLabel;
    }
  }
}

function escapeHtmlForEmail(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Exponer funciones globales usadas desde HTML
window.selectLabReportClient = selectLabReportClient;
window.initReportesLabModule = initReportesLabModule;
window.capitalizeFirstLetter = capitalizeFirstLetter;
window.LAB_EMAIL_MESSAGES = LAB_EMAIL_MESSAGES;

console.log('reportes-lab-module.js cargado');


