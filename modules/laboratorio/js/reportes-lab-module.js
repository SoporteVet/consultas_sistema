// reportes-lab-module.js - Módulo de Reportes de Laboratorio

// URL de la Firebase Cloud Function (actualizar después del deploy)
const LAB_EMAIL_FUNCTION_URL = 'https://sendlabreport-kfopngff6a-uc.a.run.app';

// Textos de los 5 tipos de mensaje de correo
const LAB_EMAIL_MESSAGES = {
  consulta_externa: `Buenas. De parte de laboratorio, es un gusto saludarle.\n\nSe adjuntan los resultados de los exámenes realizados. El médico veterinario encargado cuenta con un plazo de 24 a 48 horas para brindarle el reporte correspondiente.\n\nSi en ese plazo no ha sido contactado por el médico o los resultados aún no han sido reportados, y el paciente presenta una recaída o algún síntoma que comprometa su salud, le solicitamos traerlo a revaloración médica. De esta manera, se podrán interpretar los resultados y brindarle la receta médica correspondiente.\n\nDespués de las 8:00 p.m., puede comunicarse a la central telefónica 4000-1365 para verificar la disponibilidad médica para una revaloración de emergencia.\n\nSi el médico veterinario ya se comunicó con usted, por favor omita este mensaje.\n\nLaboratorio Clínico Veterinario San Martín de Porres\nTel.: 4000-1365 Ext. 106\nWhatsApp: 8839-2214`,

  internos: `Buenas. De parte de laboratorio, es un gusto saludarle.\n\nSe adjuntan los resultados de los exámenes realizados. El médico en turno en el Área de Internamiento le estará brindando el reporte de los mismos durante el siguiente reporte diario del paciente, a excepción que sea una emergencia.\n\nHorario de reportes de internamiento: 9:00am a 2:00pm. Puede variar de acuerdo al estado de los pacientes. La salud de nuestros pacientes es la prioridad. Whatsapp de internamiento 8686-2140, no se aceptan llamadas vía Whatsapp.\n\nLaboratorio Clínico Veterinario San Martin de Porres.\nTel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`,

  paquetes: `Buenas. De parte de laboratorio, es un gusto saludarle.\n\nSe adjunta el hemograma realizado en paquete de castración o de limpieza dental, el cual fue reportado antes del procedimiento.\n\nEn caso de que la mascota presente una recaída que comprometa su salud se recomienda traerla a revaloración de manera inmediata antes de las 7:30pm. Después de las 8:00pm comunicarse a la central telefónica 4000-1365 para verificar la disponibilidad médica para una revaloración de emergencia.\n\nLaboratorio Clínico Veterinario San Martin de Porres.\nTel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`,

  reportado: `Buenas. De parte de laboratorio, es un gusto saludarle.\n\nSe adjunta el Examen realizado, el cual fue reportado en consulta.\n\nEn caso de que la mascota presente una recaída que comprometa su salud se recomienda traerla a revaloración de manera inmediata antes de las 7:30pm. Después de las 8:00pm comunicarse a la central telefónica 4000-1365 para verificar la disponibilidad médica para una revaloración de emergencia.\n\nLaboratorio Clínico Veterinario San Martin de Porres.\nTel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`,

  sin_medico: `Buenas. De parte de laboratorio, es un gusto saludarle.\n\nSe adjunta el Examen realizado.\n\nLaboratorio Clínico Veterinario San Martin de Porres.\nTel.: 4000 1365 Ext 106  Whatsapp: 8839-2214`
};

// Estado del módulo
let labReportSelectedClient = null;
let labReportSelectedTemplate = null;

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

function loadScriptOnce(targetDoc, scriptId, src) {
  return new Promise((resolve, reject) => {
    if (!targetDoc) {
      reject(new Error('Documento no disponible para cargar librerías.'));
      return;
    }

    const existing = targetDoc.getElementById(scriptId);
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`No se pudo cargar: ${src}`)), { once: true });
      }
      return;
    }

    const script = targetDoc.createElement('script');
    script.id = scriptId;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      resolve();
    };
    script.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
    targetDoc.head.appendChild(script);
  });
}

async function ensurePdfLibrariesAvailable(iframeWin, parentWin) {
  const hasJsPdf = () => Boolean(
    (iframeWin.jspdf && iframeWin.jspdf.jsPDF) ||
    iframeWin.jsPDF ||
    (parentWin.jspdf && parentWin.jspdf.jsPDF) ||
    parentWin.jsPDF
  );
  const hasHtml2Canvas = () => Boolean(
    typeof iframeWin.html2canvas === 'function' ||
    typeof parentWin.html2canvas === 'function'
  );

  if (hasJsPdf() && hasHtml2Canvas()) return;

  // Cargar en la ventana principal para reutilizar en todas las plantillas
  const doc = parentWin.document;
  await loadScriptOnce(doc, 'lab-html2canvas-loader', 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  await loadScriptOnce(doc, 'lab-jspdf-loader', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

  if (!hasJsPdf() || !hasHtml2Canvas()) {
    throw new Error('No se pudieron cargar html2canvas/jsPDF para generar el PDF.');
  }
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
  const sendEmailBtn = document.getElementById('sendEmailLabReportBtn');

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
  if (sendEmailBtn) sendEmailBtn.addEventListener('click', sendLabReportByEmail);

  // Cerrar modal de email al hacer clic fuera del contenido
  const emailModal = document.getElementById('labEmailModal');
  if (emailModal) {
    emailModal.addEventListener('click', (e) => {
      if (e.target === emailModal) closeLabEmailModal();
    });
  }
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

/**
 * Marca de tiempo para ordenar tickets (más alto = más reciente).
 * Prioriza fechaCreacion (ISO), luego fecha/fechaServicio, luego id numérico.
 */
function getLabTicketRecencyTimestamp(t) {
  if (!t || typeof t !== 'object') return 0;
  if (t.fechaCreacion) {
    const ms = new Date(t.fechaCreacion).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  const fechaAlt = t.fecha || t.fechaServicio;
  if (fechaAlt) {
    const ms = new Date(fechaAlt).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  if (typeof t.id === 'number' && Number.isFinite(t.id)) return t.id;
  return 0;
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

  // Unificar por cliente+mascota: conservar siempre el ticket más reciente
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
    const ts = getLabTicketRecencyTimestamp(t);
    const prev = clientsMap.get(key);
    if (!prev || ts > prev.ts) {
      clientsMap.set(key, { ts, client: normalizeLabTicketToClient(t) });
    }
  });

  const clients = Array.from(clientsMap.values()).map(entry => entry.client);
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
    raza: capitalizeFirstLetter(t.raza || t.razaMascota || t.raza_mascota || ''),
    edad: (t.edad || '').toLowerCase(), // Convertir edad a minúsculas
    peso: t.peso || '',
    sexo: t.sexo || '',
    idPaciente: t.idPaciente || '',
    fecha: t.fecha || t.fechaServicio || (t.fechaCreacion ? String(t.fechaCreacion).split('T')[0] : ''),
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
    const _especieMap = { perro: 'Canino', gato: 'Felino', conejo: 'Lagomorfo', lagomorfo: 'Lagomorfo', cuilo: 'Cuilo' };
    const _especieMapped = _especieMap[(c.tipoMascota || '').toLowerCase()] || capitalizeFirstLetter(c.tipoMascota || '');
    params.set('especie', _especieMapped);
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

  // Inyectar función de captura PDF para email cuando cargue el iframe
  iframe.onload = function() {
    try {
      const iframeWin = iframe.contentWindow;
      const iframeDoc = iframe.contentDocument || iframeWin.document;

      iframeWin.generatePDFForEmail = async function() {
        const parentWin = window;
        await ensurePdfLibrariesAvailable(iframeWin, parentWin);

        // Compatibilidad entre versiones/cargas de jsPDF en plantillas y ventana padre
        const JsPdfCtor = (iframeWin.jspdf && iframeWin.jspdf.jsPDF)
          || iframeWin.jsPDF
          || (parentWin.jspdf && parentWin.jspdf.jsPDF)
          || parentWin.jsPDF;
        if (!JsPdfCtor) {
          throw new Error('jsPDF no disponible en esta plantilla ni en la ventana principal.');
        }
        const html2canvasFn = (typeof iframeWin.html2canvas === 'function')
          ? iframeWin.html2canvas
          : (typeof parentWin.html2canvas === 'function' ? parentWin.html2canvas : null);
        if (!html2canvasFn) {
          throw new Error('html2canvas no disponible en esta plantilla ni en la ventana principal.');
        }

        // Si la plantilla ya tiene su propia generación de PDF, reutilizarla para
        // conservar exactamente el formato/CSS del PDF normal.
        if (typeof iframeWin.generatePDF === 'function') {
          let capturedDataUri = null;
          const constructorRestores = [];
          const patchPdfInstance = (pdfInstance) => {
            if (!pdfInstance || typeof pdfInstance !== 'object') return pdfInstance;

            const originalSave = typeof pdfInstance.save === 'function' ? pdfInstance.save.bind(pdfInstance) : null;
            const originalOutput = typeof pdfInstance.output === 'function' ? pdfInstance.output.bind(pdfInstance) : null;

            if (originalOutput) {
              pdfInstance.output = function patchedOutput(...args) {
                const outputType = args && args.length ? args[0] : undefined;
                if (!capturedDataUri && (outputType === 'blob' || outputType === 'arraybuffer')) {
                  capturedDataUri = originalOutput('datauristring');
                }
                return originalOutput(...args);
              };
            }

            if (originalSave) {
              pdfInstance.save = function patchedSave(...args) {
                if (!capturedDataUri && originalOutput) {
                  capturedDataUri = originalOutput('datauristring');
                }
                return capturedDataUri || originalSave(...args);
              };
            }

            return pdfInstance;
          };

          const wrapJsPdfCtor = (owner, prop) => {
            if (!owner || !owner[prop] || owner[prop].__labEmailWrapped) return;
            const OriginalCtor = owner[prop];
            const WrappedCtor = function wrappedJsPdfCtor(...args) {
              const pdfInstance = new OriginalCtor(...args);
              return patchPdfInstance(pdfInstance);
            };
            WrappedCtor.prototype = OriginalCtor.prototype;
            WrappedCtor.__labEmailWrapped = true;
            owner[prop] = WrappedCtor;
            constructorRestores.push(() => { owner[prop] = OriginalCtor; });
          };

          wrapJsPdfCtor(iframeWin, 'jsPDF');
          if (iframeWin.jspdf && iframeWin.jspdf.jsPDF) {
            wrapJsPdfCtor(iframeWin.jspdf, 'jsPDF');
          }

          // Capturar también en APIs de guardado modernas usadas por algunas plantillas.
          const originalShowSaveFilePicker = iframeWin.showSaveFilePicker;
          iframeWin.showSaveFilePicker = async function patchedShowSaveFilePicker() {
            const err = new Error('Email mode - skip local save dialog');
            err.name = 'AbortError';
            throw err;
          };

          try {
            await Promise.resolve(iframeWin.generatePDF());
            if (capturedDataUri) return capturedDataUri;
          } finally {
            constructorRestores.forEach((restore) => restore());
            iframeWin.showSaveFilePicker = originalShowSaveFilePicker;
          }
        }

        // Intentar encontrar el elemento de la plantilla (varía por template)
        const el = iframeDoc.getElementById('template1')
          || iframeDoc.querySelector('.container')
          || iframeDoc.querySelector('.report-container')
          || iframeDoc.querySelector('[id*="Page"]')
          || iframeDoc.body;

        if (!el) throw new Error('No se encontró el elemento de la plantilla');

        const canvas = await html2canvasFn(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new JsPdfCtor('p', 'mm', 'a4');
        const imgWidth = 150;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const x = (pdf.internal.pageSize.getWidth() - imgWidth) / 2;

        // Manejar reportes multipágina
        let posY = 5;
        let remainingHeight = imgHeight;
        let sourceY = 0;

        while (remainingHeight > 0) {
          const sliceHeight = Math.min(remainingHeight, pageHeight - 10);
          const sliceCanvas = iframeDoc.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = (sliceHeight * canvas.width) / imgWidth;
          const ctx = sliceCanvas.getContext('2d');
          ctx.drawImage(canvas, 0, sourceY * (canvas.width / imgWidth), canvas.width, sliceCanvas.height, 0, 0, sliceCanvas.width, sliceCanvas.height);
          const sliceData = sliceCanvas.toDataURL('image/jpeg', 1.0);
          if (sourceY > 0) pdf.addPage();
          pdf.addImage(sliceData, 'JPEG', x, posY, imgWidth, sliceHeight);
          sourceY += sliceHeight;
          remainingHeight -= sliceHeight;
        }

        return pdf.output('datauristring');
      };
      console.log('✅ generatePDFForEmail inyectado en iframe');
    } catch (e) {
      console.warn('No se pudo inyectar generatePDFForEmail en el iframe:', e);
    }
  };

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
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ─── ENVÍO POR EMAIL ─────────────────────────────────────────────────────────

function sendLabReportByEmail() {
  const iframe = document.getElementById('labReportIframe');

  if (!iframe || !iframe.src || iframe.src === window.location.href) {
    showLabReportNotification('Primero debes abrir un reporte.', 'warning');
    return;
  }

  const emailValue = labReportSelectedClient ? (labReportSelectedClient.correo || '') : '';

  // Prellenar el campo de email en el modal
  const recipientInput = document.getElementById('labEmailRecipient');
  if (recipientInput) recipientInput.value = emailValue;

  // Mostrar el primer mensaje por defecto en el preview
  updateLabEmailPreview();

  // Abrir el modal
  const modal = document.getElementById('labEmailModal');
  if (modal) modal.style.display = 'flex';
}

function updateLabEmailPreview() {
  const select = document.getElementById('labEmailMessageType');
  const preview = document.getElementById('labEmailPreview');
  if (!select || !preview) return;
  const key = select.value;
  preview.value = LAB_EMAIL_MESSAGES[key] || '';
}

function closeLabEmailModal() {
  const modal = document.getElementById('labEmailModal');
  if (modal) modal.style.display = 'none';
}

async function confirmSendLabEmail() {
  const recipientInput = document.getElementById('labEmailRecipient');
  const messageTypeSelect = document.getElementById('labEmailMessageType');
  const confirmBtn = document.getElementById('confirmSendEmailBtn');
  const iframe = document.getElementById('labReportIframe');

  const to = (recipientInput?.value || '').trim();
  const messageType = messageTypeSelect?.value || 'sin_medico';

  if (!to || !to.includes('@')) {
    showLabReportNotification('Ingresa un correo electrónico válido.', 'warning');
    return;
  }

  if (!iframe || !iframe.contentWindow || typeof iframe.contentWindow.generatePDFForEmail !== 'function') {
    showLabReportNotification('El reporte aún no está listo para generar el PDF. Espera a que cargue completamente.', 'warning');
    return;
  }

  // Estado de carga
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF...';
  }

  try {
    // Generar PDF base64 desde el iframe
    const pdfDataUrl = await iframe.contentWindow.generatePDFForEmail();

    if (confirmBtn) {
      confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    }

    const clientName = labReportSelectedClient?.nombre || 'Propietario';
    const petName = labReportSelectedClient?.mascota || 'Paciente';
    const templateName = labReportSelectedTemplate
      ? (LAB_REPORT_TEMPLATES[labReportSelectedTemplate]?.name || 'Reporte')
      : 'Reporte';
    const fileName = `${templateName} - ${petName}.pdf`;

    const payload = {
      to,
      pdfBase64: pdfDataUrl,
      fileName,
      messageType,
      clientName,
      petName
    };

    const response = await fetch(LAB_EMAIL_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error || `Error del servidor: ${response.status}`);
    }

    closeLabEmailModal();
    showLabReportNotification(`✅ Reporte enviado correctamente a ${to}`, 'success');

  } catch (err) {
    console.error('Error al enviar el reporte por email:', err);
    showLabReportNotification(`Error al enviar: ${err.message}`, 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Confirmar Envío';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// Exponer funciones globales usadas desde HTML
window.selectLabReportClient = selectLabReportClient;
window.initReportesLabModule = initReportesLabModule;
window.capitalizeFirstLetter = capitalizeFirstLetter;
window.sendLabReportByEmail = sendLabReportByEmail;
window.updateLabEmailPreview = updateLabEmailPreview;
window.closeLabEmailModal = closeLabEmailModal;
window.confirmSendLabEmail = confirmSendLabEmail;

console.log('reportes-lab-module.js cargado');


