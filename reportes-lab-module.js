// reportes-lab-module.js - Módulo de Reportes de Laboratorio

// Estado del módulo
let labReportSelectedClient = null;
let labReportSelectedTemplate = null;

// Mapeo de plantillas a archivos HTML del repositorio
const LAB_REPORT_TEMPLATES = {
  hemograma: { name: 'Hemograma', file: 'hemograma_2.html' },
  tiempos_coagulacion: { name: 'Tiempos de Coagulación', file: 'tiempos_coagulacion.html' },
  tipificacion: { name: 'Tipificación', file: 'tipificacion.html' },
  panel_basico: { name: 'Panel Básico', file: 'Panel_Básico.html' },
  panel_plus: { name: 'Panel Plus', file: 'Panel_Plus.html' },
  perfil_quimico: { name: 'Perfil Químico', file: 'perfil_quimico.html' },
  analitos_laboratorio: { name: 'Analitos Laboratorio', file: 'analitos_laboratorio.html' },
  perfil_adulto: { name: 'Perfil Adulto Completo', file: 'perfil_adulto.html' },
  perfil_renal: { name: 'Perfil Renal', file: 'perfil_renal.html' },
  perfil_pre_quirurgico: { name: 'Perfil Pre-Quirúrgico', file: 'perfil_pre_quirurgico.html' },
  perfil_hepatico: { name: 'Perfil Hepático', file: 'perfil_hepatico.html' },
  electrolitos: { name: 'Electrolitos', file: 'electrolitos.html' },
  heces: { name: 'Análisis de Heces', file: 'heces.html' },
  urianalisis: { name: 'Urianálisis', file: 'urianalisis.html' },
  tira_reactiva: { name: 'Tira Reactiva', file: 'tira_reactiva.html' },
  frotis: { name: 'Frotis Sanguíneo', file: 'frotis.html' },
  hisopado_oido: { name: 'Hisopado de Oído', file: 'hisopado_oido.html' },
  reticulocitos: { name: 'Conteo de Reticulocitos', file: 'reticulocitos.html' },
  analisis_liquido_libre: { name: 'Análisis Líquido Libre', file: 'analisis_liquido_libre.html' },
  tests: { name: 'Pruebas Rápidas', file: 'Tests_Laboratorio.html' }
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

function searchLabReportClients() {
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
  const source = Array.isArray(window.labTickets) ? window.labTickets : [];

  if (source.length === 0) {
    resultsContainer.innerHTML = '<div class="no-clients-found"><i class="fas fa-database"></i> No hay tickets de laboratorio cargados</div>';
    resultsContainer.classList.add('active');
    return;
  }

  // Unificar por cliente+mascota
  const clientsMap = new Map();
  source.forEach(t => {
    const match = (
      (t.nombre && String(t.nombre).toLowerCase().includes(term)) ||
      (t.cedula && String(t.cedula).toLowerCase().includes(term)) ||
      (t.mascota && String(t.mascota).toLowerCase().includes(term)) ||
      (t.idPaciente && String(t.idPaciente).toLowerCase().includes(term)) ||
      (t.factura && String(t.factura).toLowerCase().includes(term))
    );
    if (!match) return;

    const key = `${t.cedula || t.idPaciente || t.nombre}|${t.mascota || ''}`;
    if (!clientsMap.has(key)) {
      clientsMap.set(key, normalizeLabTicketToClient(t));
    }
  });

  const clients = Array.from(clientsMap.values());
  displayLabReportClientResults(clients);
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

function openLabReportViewer(templateKey) {
  const container = document.getElementById('labReportFormContainer');
  const iframe = document.getElementById('labReportIframe');
  const template = LAB_REPORT_TEMPLATES[templateKey];
  if (!container || !iframe || !template) {
    console.error('Elementos no encontrados:', {container: !!container, iframe: !!iframe, template: !!template});
    return;
  }

  // Construir URL con parámetros de autollenado
  let url = template.file;
  const params = new URLSearchParams({
    template: templateKey
  });
  
  if (labReportSelectedClient) {
    const c = labReportSelectedClient;
    params.set('mascotaNombre', c.mascota || '');
    params.set('propietarioNombre', c.nombre || '');
    params.set('propietarioCedula', c.cedula || '');
    params.set('propietarioTelefono', c.telefono || '');
    params.set('propietarioEmail', c.correo || '');
    params.set('nombreMedico', c.medico || '');
    params.set('mascotaEdad', c.edad || '');
    params.set('mascotaPeso', c.peso || '');
    params.set('mascotaRaza', c.raza || '');
    params.set('mascotaSexo', c.sexo || '');
    params.set('especie', capitalizeFirstLetter(c.tipoMascota || ''));
    params.set('propietarioFecha', c.fecha || '');
    params.set('idPaciente', c.idPaciente || '');
  }
  
  url = `${template.file}?${params.toString()}`;

  // Asegurar que el iframe tenga las dimensiones correctas
  iframe.style.width = '100%';
  iframe.style.height = '80vh';
  iframe.style.border = 'none';
  iframe.style.display = 'block';
  
  iframe.src = url;
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });
  
  console.log('🖼️ Visor de reportes abierto:', {url, templateKey});
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

// Exponer funciones globales usadas desde HTML
window.selectLabReportClient = selectLabReportClient;
window.initReportesLabModule = initReportesLabModule;
window.capitalizeFirstLetter = capitalizeFirstLetter;

console.log('reportes-lab-module.js cargado');


