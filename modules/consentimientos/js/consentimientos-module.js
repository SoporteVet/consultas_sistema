// consentimientos.js - Funcionalidad para el módulo de consentimientos

// Variables globales para consentimientos
let selectedClient = null;
let selectedTemplate = null;
let consentimientos = [];
let consentSource = 'consulta'; // 'consulta' | 'quirofano' | 'internos'

// Función para obtener la fecha actual en formato YYYY-MM-DD
function getCurrentDateString() {
    const today = new Date();
    return today.getFullYear() + '-' + 
           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
           String(today.getDate()).padStart(2, '0');
}

// Función para verificar si un ticket fue creado en una fecha específica
function isTicketCreatedOnDate(ticket, targetDate = null) {
    // Si no se proporciona fecha, usar la fecha del calendario o la de hoy
    const dateToCheck = targetDate || getSelectedConsentDate() || getCurrentDateString();
    
    // Priorizar fechaConsulta (ya está en formato YYYY-MM-DD, sin problemas de zona horaria)
    if (ticket.fechaConsulta) {
        return ticket.fechaConsulta === dateToCheck;
    }
    
    // Verificar fechaCreacion (campo principal para tickets de quirófano)
    if (ticket.fechaCreacion) {
        const ticketDate = ticket.fechaCreacion.split('T')[0];
        return ticketDate === dateToCheck;
    }
    
    // Verificar fecha (campo para tickets de consulta)
    // Intentar extraer la fecha directamente del string ISO sin convertir a Date
    if (ticket.fecha) {
        // Si es un string ISO, extraer la fecha directamente
        if (typeof ticket.fecha === 'string' && ticket.fecha.includes('T')) {
            const ticketDate = ticket.fecha.split('T')[0];
            return ticketDate === dateToCheck;
        }
        // Si es un objeto Date o número timestamp, convertir con cuidado
        if (ticket.fecha instanceof Date || typeof ticket.fecha === 'number') {
            const ticketDateObj = new Date(ticket.fecha);
            if (!isNaN(ticketDateObj.getTime())) {
                // Usar métodos locales para evitar problemas de zona horaria
                const year = ticketDateObj.getFullYear();
                const month = String(ticketDateObj.getMonth() + 1).padStart(2, '0');
                const day = String(ticketDateObj.getDate()).padStart(2, '0');
                const ticketDateString = `${year}-${month}-${day}`;
                return ticketDateString === dateToCheck;
            }
        }
    }
    
    return false;
}

// Función para obtener la fecha seleccionada en el calendario de búsqueda
function getSelectedConsentDate() {
    const dateInput = document.getElementById('consentFechaBusqueda');
    if (dateInput && dateInput.value) {
        return dateInput.value;
    }
    return null;
}

// Función para formatear fecha YYYY-MM-DD a formato legible DD/MM/YYYY sin problemas de zona horaria
function formatConsentDate(dateString) {
    if (!dateString) return 'hoy';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

// Función para verificar si un ticket fue creado hoy (mantener compatibilidad)
function isTicketCreatedToday(ticket) {
    return isTicketCreatedOnDate(ticket, getCurrentDateString());
}

// Plantillas permitidas por origen
const ALLOWED_TEMPLATES_BY_SOURCE = {
    consulta: ['anestesia', 'emergencias', 'transfusion', 'cesarea', 'eutanasia', 'cirugia', 'alta_voluntaria', 'control_anestesico', 'internamiento'],
    quirofano: ['anestesia', 'cirugia', 'cesarea', 'control_anestesico', 'internamiento'],
    internos: ['alta_voluntaria', 'anestesia', 'transfusion', 'eutanasia', 'internamiento']
};

// Plantillas permitidas por rol (restricción adicional)
const ALLOWED_TEMPLATES_BY_ROLE = {
    lab_reportes: ['control_anestesico']
};

function getConsentUserRole() {
    return sessionStorage.getItem('userRole') || '';
}

function isLabReportesConsentRole() {
    return getConsentUserRole() === 'lab_reportes';
}

function getAllowedTemplatesForRole() {
    const role = getConsentUserRole();
    if (ALLOWED_TEMPLATES_BY_ROLE[role]) {
        return new Set(ALLOWED_TEMPLATES_BY_ROLE[role]);
    }
    return null;
}

// Mapeo de plantillas disponibles
// Las rutas son relativas a index.html que está en la raíz del proyecto
const CONSENT_TEMPLATES = {
    anestesia: {
        name: 'Autorización para Anestesia',
        file: 'modules/consentimientos/pages/consentimiento_anestesia.html',
        description: 'Consentimiento para procedimientos bajo anestesia'
    },
    cirugia: {
        name: 'Consentimiento Cirugía',
        file: 'modules/consentimientos/pages/consentimiento_cirugia.html',
        description: 'Autorización para procedimientos quirúrgicos'
    },
    emergencias: {
        name: 'Emergencias',
        file: 'modules/emergencias/pages/Emergencias_Plantilla.html',
        description: 'Consentimiento para atención de emergencias'
    },
    transfusion: {
        name: 'Transfusión',
        file: 'modules/laboratorio/pages/transfusion.html',
        description: 'Consentimiento para transfusión sanguínea'
    },
    cesarea: {
        name: 'Consentimiento Cesárea',
        file: 'modules/consentimientos/pages/consentimiento_cesarea.html',
        description: 'Autorización para cesárea'
    },
    eutanasia: {
        name: 'Consentimiento Eutanasia',
        file: 'modules/consentimientos/pages/consentimiento_eutanasia.html',
        description: 'Autorización para eutanasia humanitaria'
    },
    alta_voluntaria: {
        name: 'Alta Voluntaria',
        file: 'modules/consentimientos/pages/consentimiento_alta_voluntaria.html',
        description: 'Consentimiento informado por alta voluntaria'
    },
    control_anestesico: {
        name: 'Control Anestésico y Medicamentoso',
        file: 'modules/quirofano/pages/control_anestesico.html',
        description: 'Control de anestesia y medicamentos administrados durante cirugía'
    },
    internamiento: {
        name: 'Consentimiento Informado para Internamiento',
        file: 'modules/internamiento/pages/internamiento.html',
        description: 'Autorización para internamiento de mascota'
    }
};

// Inicialización del módulo de consentimientos
document.addEventListener('DOMContentLoaded', function() {
    initConsentimientos();
});

function initConsentimientos() {
    console.log('Inicializando módulo de consentimientos...');
    
    // Configurar event listeners
    setupConsentEventListeners();
    
    // Verificar que la sección existe
    const consentSection = document.getElementById('consentimientosSection');
    if (!consentSection) {
        console.error('Sección de consentimientos no encontrada');
        return;
    }
    
    // Configurar origen por defecto y disponibilidad de plantillas
    if (isLabReportesConsentRole()) {
        applyLabReportesConsentUI();
        setConsentSource('quirofano');
    } else {
        setConsentSource('consulta');
    }
    
    // Verificar datos de quirófano inmediatamente
    console.log('Estado inicial de datos de quirófano:');
    console.log('window.quirofanoTickets:', !!window.quirofanoTickets);
    
    if (window.quirofanoTickets) {
        console.log('✅ Datos de quirófano ya disponibles:', window.quirofanoTickets.length, 'tickets');
    } else {
        console.log('⏳ Esperando datos de quirófano...');
        // Verificar si los datos de quirófano están disponibles y esperar si es necesario
        waitForQuirofanoTicketsData();
    }
    
    console.log('Módulo de consentimientos inicializado correctamente');
    configureConsentimientosForRole();
}

function configureConsentimientosForRole() {
    if (!isLabReportesConsentRole()) return;

    applyLabReportesConsentUI();

    if (consentSource !== 'quirofano' && consentSource !== 'consulta') {
        setConsentSource('quirofano');
    } else {
        updateTemplateAvailabilityForSource();
    }

    if (typeof initQuirofanoDataForConsentimientos === 'function') {
        initQuirofanoDataForConsentimientos();
    }
}

window.configureConsentimientosForRole = configureConsentimientosForRole;

// Función para esperar a que los datos de quirófano estén disponibles
function waitForQuirofanoTicketsData() {
    const maxWait = 10000; // 10 segundos máximo
    const interval = 500; // verificar cada 500ms
    let elapsed = 0;
    
    const checkData = () => {
        if (window.quirofanoTickets && Array.isArray(window.quirofanoTickets)) {
            console.log('Datos de tickets de quirófano disponibles:', window.quirofanoTickets.length, 'tickets cargados');
            return;
        }
        
        elapsed += interval;
        if (elapsed < maxWait) {
            setTimeout(checkData, interval);
        } else {
            console.warn('Timeout esperando datos de tickets de quirófano');
        }
    };
    
    checkData();
}

function setupConsentEventListeners() {
    // Botón de búsqueda de clientes
    const searchBtn = document.getElementById('searchClientBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchClients);
    }
    
    // Input de búsqueda con Enter
    const searchInput = document.getElementById('consentClientSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchClients();
            }
        });
        
        // Búsqueda en tiempo real
        searchInput.addEventListener('input', debounce(searchClients, 500));
    }
    
    // Calendario de fecha de búsqueda
    const fechaBusquedaInput = document.getElementById('consentFechaBusqueda');
    if (fechaBusquedaInput) {
        fechaBusquedaInput.addEventListener('change', function() {
            // Si hay un término de búsqueda, actualizar automáticamente
            const searchTerm = document.getElementById('consentClientSearch').value.trim();
            if (searchTerm.length >= 2) {
                searchClients();
            }
        });
    }
    
    // Template cards
    setupTemplateCardListeners();
    
    // Botón cerrar formulario
    const closeBtn = document.getElementById('closeFormBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeConsentForm);
    }
    
    // Botones de origen
    const btnConsulta = document.getElementById('consentSourceConsulta');
    const btnQuirofano = document.getElementById('consentSourceQuirofano');
    const btnInternos = document.getElementById('consentSourceInternos');
    if (btnConsulta) btnConsulta.addEventListener('click', () => setConsentSource('consulta'));
    if (btnQuirofano) btnQuirofano.addEventListener('click', () => setConsentSource('quirofano'));
    if (btnInternos) btnInternos.addEventListener('click', () => setConsentSource('internos'));
}

function setupTemplateCardListeners() {
    const templateCards = document.querySelectorAll('.template-card');
    templateCards.forEach(card => {
        card.addEventListener('click', function() {
            const template = this.getAttribute('data-template');
            // Evitar seleccionar plantillas deshabilitadas por origen
            if (this.classList.contains('disabled')) {
                showConsentNotification('Esta plantilla no está disponible para el origen seleccionado', 'warning');
                return;
            }
            selectTemplate(template);
        });
    });
}

function setConsentSource(sourceKey) {
    if (!['consulta', 'quirofano', 'internos'].includes(sourceKey)) return;
    consentSource = sourceKey;
    // Actualizar etiqueta visual
    const label = document.getElementById('consentCurrentSourceLabel');
    if (label) {
        label.textContent = 'Origen actual: ' + (sourceKey === 'consulta' ? 'Consulta' : sourceKey === 'quirofano' ? 'Quirófano' : 'Internos');
    }
    // Resaltar botón activo
    document.querySelectorAll('.consent-source-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.consent-source-btn[data-source="${sourceKey}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    // Limpiar búsqueda y selección de cliente
    clearClientSearch();
    // Actualizar disponibilidad de plantillas
    updateTemplateAvailabilityForSource();
}

function applyLabReportesConsentUI() {
    const internosTab = document.getElementById('consentSourceInternos');
    if (internosTab) internosTab.style.display = 'none';

    const sectionTitle = document.querySelector('#consentimientosSection > h2');
    if (sectionTitle) {
        sectionTitle.innerHTML = '<i class="fas fa-syringe"></i> Control Anestésico';
    }

    const templateSectionTitle = document.querySelector('.consent-template-section h3');
    if (templateSectionTitle) {
        templateSectionTitle.innerHTML = '<i class="fas fa-syringe"></i> Control Anestésico y Medicamentoso';
    }
}

function updateTemplateAvailabilityForSource() {
    const allowedBySource = new Set(ALLOWED_TEMPLATES_BY_SOURCE[consentSource] || []);
    const allowedByRole = getAllowedTemplatesForRole();

    document.querySelectorAll('.template-card').forEach(card => {
        const key = card.getAttribute('data-template');
        if (!key) return;

        let allowed = allowedBySource.has(key);
        if (allowedByRole) {
            allowed = allowed && allowedByRole.has(key);
        }

        if (allowed) {
            card.classList.remove('disabled');
            card.style.display = '';
        } else {
            card.classList.add('disabled');
            card.style.display = 'none';
        }
    });
}

// Función para verificar y esperar datos de quirófano
function ensureQuirofanoDataAvailable() {
    return new Promise((resolve, reject) => {
        const maxWait = 15000; // 15 segundos máximo
        const interval = 500; // verificar cada 500ms
        let elapsed = 0;
        
        const checkData = () => {
            console.log('Verificando disponibilidad de datos de quirófano...');
            console.log('window.quirofanoTickets:', !!window.quirofanoTickets);
            console.log('Cantidad de tickets:', window.quirofanoTickets ? window.quirofanoTickets.length : 'N/A');
            
            if (window.quirofanoTickets && Array.isArray(window.quirofanoTickets)) {
                console.log('✅ Datos de quirófano disponibles:', window.quirofanoTickets.length, 'tickets');
                resolve(window.quirofanoTickets);
                return;
            }
            
            elapsed += interval;
            if (elapsed < maxWait) {
                setTimeout(checkData, interval);
            } else {
                console.warn('❌ Timeout esperando datos de quirófano');
                reject(new Error('Timeout esperando datos de quirófano'));
            }
        };
        
        checkData();
    });
}

// Función de debug para verificar estado del sistema
function debugConsentimientos() {
    console.log('=== DEBUG CONSENTIMIENTOS ===');
    console.log('window.quirofanoTickets existe:', !!window.quirofanoTickets);
    console.log('Tipo de dato:', typeof window.quirofanoTickets);
    
    if (window.quirofanoTickets) {
        console.log('Es array:', Array.isArray(window.quirofanoTickets));
        console.log('Cantidad de tickets:', window.quirofanoTickets.length);
        
        if (window.quirofanoTickets.length > 0) {
            console.log('Primer ticket:', window.quirofanoTickets[0]);
            console.log('Campos disponibles:', Object.keys(window.quirofanoTickets[0] || {}));
        }
    }
    
    // Mostrar información en pantalla
    const resultsContainer = document.getElementById('clientSearchResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="debug-info" style="background: #f0f8ff; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <h4>Información de Debug</h4>
                <p><strong>window.quirofanoTickets existe:</strong> ${!!window.quirofanoTickets ? '✅ Sí' : '❌ No'}</p>
                <p><strong>Tipo de dato:</strong> ${typeof window.quirofanoTickets}</p>
                ${window.quirofanoTickets ? `
                    <p><strong>Es array:</strong> ${Array.isArray(window.quirofanoTickets) ? '✅ Sí' : '❌ No'}</p>
                    <p><strong>Cantidad de tickets:</strong> ${window.quirofanoTickets.length}</p>
                    ${window.quirofanoTickets.length > 0 ? `
                        <p><strong>Campos del primer ticket:</strong> ${Object.keys(window.quirofanoTickets[0] || {}).join(', ')}</p>
                        <details style="margin-top: 10px;">
                            <summary>Ver primer ticket completo</summary>
                            <pre style="background: #fff; padding: 10px; margin-top: 5px; border-radius: 3px; overflow: auto; max-height: 200px;">${JSON.stringify(window.quirofanoTickets[0], null, 2)}</pre>
                        </details>
                    ` : '<p><em>No hay tickets disponibles</em></p>'}
                ` : '<p><em>No hay datos disponibles</em></p>'}
                <button onclick="location.reload()" style="margin-top: 10px;" class="btn btn-secondary">Recargar página</button>
            </div>
        `;
        resultsContainer.classList.add('active');
    }
    
    return window.quirofanoTickets;
}

// Exponer función globalmente para testing
window.debugConsentimientos = debugConsentimientos;

// Función para buscar clientes
function searchClients() {
    const searchTerm = document.getElementById('consentClientSearch').value.trim();
    const resultsContainer = document.getElementById('clientSearchResults');
    
    if (!searchTerm) {
        showConsentNotification('Por favor ingrese un término de búsqueda', 'warning');
        return;
    }
    
    if (searchTerm.length < 2) {
        showConsentNotification('Ingrese al menos 2 caracteres para buscar', 'warning');
        return;
    }
    
    // Mostrar indicador de carga
    resultsContainer.innerHTML = '<div class="loading-consent"><i class="fas fa-spinner fa-spin"></i> Buscando clientes...</div>';
    resultsContainer.classList.add('active');
    
    if (consentSource === 'quirofano') {
        if (!window.quirofanoTickets) {
            resultsContainer.innerHTML = `
                <div class="no-clients-found">
                    <i class="fas fa-clock"></i>
                    <h4>Cargando datos</h4>
                    <p>Esperando tickets de quirófano...</p>
                    <button onclick="searchClients()" class="btn-retry">Reintentar</button>
                </div>
            `;
            return;
        }
        const filteredClients = (window.quirofanoTickets.length > 0) ? filterClientsFromQuirofanoTickets(searchTerm) : [];
        if (filteredClients.length === 0) {
            const selectedDate = getSelectedConsentDate();
            const dateLabel = formatConsentDate(selectedDate);
            resultsContainer.innerHTML = `
                <div class="no-clients-found">
                    <i class="fas fa-database"></i>
                    <h4>Sin resultados</h4>
                    <p>No se encontraron clientes en quirófano con ese término para ${dateLabel}.</p>
                    <p class="search-info"><i class="fas fa-info-circle"></i> Mostrando tickets de ${dateLabel}</p>
                </div>
            `;
        } else {
            displayClientResults(filteredClients);
        }
    } else if (consentSource === 'consulta') {
        if (!window.tickets) {
            resultsContainer.innerHTML = `
                <div class="no-clients-found">
                    <i class="fas fa-clock"></i>
                    <h4>Cargando datos</h4>
                    <p>Esperando consultas...</p>
                    <button onclick="searchClients()" class="btn-retry">Reintentar</button>
                </div>
            `;
            return;
        }
        const filteredClients = (window.tickets.length > 0) ? filterClientsFromConsultaTickets(searchTerm) : [];
        if (filteredClients.length === 0) {
            const selectedDate = getSelectedConsentDate();
            const dateLabel = formatConsentDate(selectedDate);
            resultsContainer.innerHTML = `
                <div class="no-clients-found">
                    <i class="fas fa-database"></i>
                    <h4>Sin resultados</h4>
                    <p>No se encontraron clientes de consulta con ese término para ${dateLabel}.</p>
                    <p class="search-info"><i class="fas fa-info-circle"></i> Mostrando tickets de ${dateLabel}</p>
                </div>
            `;
        } else {
            displayClientResults(filteredClients);
        }
    } else if (consentSource === 'internos') {
        // Por ahora reutiliza tickets de consulta
        if (!window.tickets) {
            resultsContainer.innerHTML = `
                <div class="no-clients-found">
                    <i class="fas fa-clock"></i>
                    <h4>Cargando datos</h4>
                    <p>Esperando pacientes internos...</p>
                    <button onclick="searchClients()" class="btn-retry">Reintentar</button>
                </div>
            `;
            return;
        }
        const filteredClients = (window.tickets.length > 0) ? filterClientsFromInternos(searchTerm) : [];
        if (filteredClients.length === 0) {
            const selectedDate = getSelectedConsentDate();
            const dateLabel = formatConsentDate(selectedDate);
            resultsContainer.innerHTML = `
                <div class="no-clients-found">
                    <i class="fas fa-info-circle"></i>
                    <h4>Sin resultados</h4>
                    <p>No se encontraron pacientes internos con ese término para ${dateLabel}.</p>
                    <p class="search-info"><i class="fas fa-info-circle"></i> Mostrando tickets de ${dateLabel}</p>
                </div>
            `;
        } else {
            displayClientResults(filteredClients);
        }
    }
}

function filterClientsFromQuirofanoTickets(searchTerm) {
    const term = searchTerm.toLowerCase();
    const clientsMap = new Map();
    const selectedDate = getSelectedConsentDate();
    const dateFilter = selectedDate || getCurrentDateString();
    
    // Filtrar tickets de quirófano que coincidan con el término de búsqueda Y que sean de la fecha seleccionada
    const matchingTickets = window.quirofanoTickets.filter(ticket => {
        // Primero verificar que el ticket fue creado en la fecha seleccionada
        if (!isTicketCreatedOnDate(ticket, dateFilter)) {
            return false;
        }
        
        // Luego verificar que coincida con el término de búsqueda
        return (
            (ticket.nombrePropietario && ticket.nombrePropietario.toLowerCase().includes(term)) ||
            (ticket.cedula && ticket.cedula.toLowerCase().includes(term)) ||
            (ticket.nombreMascota && ticket.nombreMascota.toLowerCase().includes(term)) ||
            (ticket.telefono && ticket.telefono.includes(term)) ||
            (ticket.correo && ticket.correo.toLowerCase().includes(term))
        );
    });
    
    // Agrupar por cliente único
    matchingTickets.forEach(ticket => {
        const clientKey = ticket.cedula || ticket.nombrePropietario || 'sin-cedula-' + ticket.randomId;
        if (!clientsMap.has(clientKey)) {
            clientsMap.set(clientKey, {
                nombre: ticket.nombrePropietario || 'Sin nombre',
                cedula: ticket.cedula || 'Sin cédula',
                telefono: ticket.telefono || 'Sin teléfono',
                correo: ticket.correo || 'Sin correo',
                mascota: ticket.nombreMascota || 'Sin mascota',
                tipoMascota: ticket.tipoMascota || 'otro',
                raza: ticket.raza || 'Sin raza',
                edad: ticket.edad || 'Sin edad',
                peso: ticket.peso || 'Sin peso',
                sexo: ticket.sexo || ticket.mascotaSexo || '',
                ticketId: ticket.randomId,
                fechaCirugia: ticket.fechaProgramada || ticket.fechaCreacion,
                horaCirugia: ticket.horaProgramada || '',
                procedimiento: ticket.procedimiento || 'Sin procedimiento',
                doctorAtiende: ticket.medicoAtiende || ticket.veterinario || ticket.doctorAtiende || 'Sin doctor asignado',
                asistenteAtiende: ticket.asistenteAtiende || '',
                urgencia: ticket.tipoUrgencia || 'normal',
                estado: ticket.estado || 'programado',
                observaciones: ticket.observaciones || '',
                idPaciente: ticket.idPaciente || ''
            });
        }
    });
    
    return Array.from(clientsMap.values());
}

function displayClientResults(clients) {
    const resultsContainer = document.getElementById('clientSearchResults');
    
    if (clients.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-clients-found">
                <i class="fas fa-user-slash"></i>
                <h4>No se encontraron clientes</h4>
                <p>No hay clientes que coincidan con la búsqueda</p>
            </div>
        `;
        return;
    }
    
    // Agregar mensaje informativo sobre el filtro de fecha
    const selectedDate = getSelectedConsentDate();
    const dateFilter = selectedDate || getCurrentDateString();
    const dateLabel = formatConsentDate(selectedDate || getCurrentDateString());
    const infoMessage = `
        <div class="search-info-message">
            <i class="fas fa-calendar-day"></i>
            <span>Mostrando tickets de ${dateLabel} (${dateFilter})</span>
        </div>
    `;
    
    const resultsHTML = infoMessage + clients.map((client, index) => `
        <div class="client-result-item" onclick="selectClientByIndex(${index})">
            <div class="client-info">
                <h4>${client.nombre}</h4>
                <div class="client-details">
                    <div class="client-detail">
                        <i class="fas fa-id-card"></i>
                        <span>${client.cedula}</span>
                    </div>
                    <div class="client-detail">
                        <i class="fas fa-phone"></i>
                        <span>${client.telefono}</span>
                    </div>
                    <div class="client-detail">
                        <i class="fas fa-paw"></i>
                        <span>${client.mascota} (${getMascotaIcon(client.tipoMascota)})</span>
                    </div>
                    ${client.procedimiento ? `
                    <div class="client-detail">
                        <i class="fas fa-cut"></i>
                        <span>${client.procedimiento}</span>
                    </div>` : ''}
                    <div class="client-detail">
                        <i class="fas fa-calendar"></i>
                        <span>${client.fechaCirugia ? 'Fecha cirugía: ' + new Date(client.fechaCirugia).toLocaleDateString('es-ES') : (client.fechaConsulta ? 'Fecha consulta: ' + client.fechaConsulta : 'Sin fecha')}</span>
                    </div>
                    ${client.horaCirugia ? `
                    <div class="client-detail">
                        <i class="fas fa-clock"></i>
                        <span>Hora: ${client.horaCirugia}</span>
                    </div>
                    ` : (client.horaConsulta ? `
                    <div class="client-detail">
                        <i class="fas fa-clock"></i>
                        <span>Hora: ${client.horaConsulta}</span>
                    </div>` : '')}
                    <div class="client-detail">
                        <i class="fas fa-user-md"></i>
                        <span>${client.doctorAtiende}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    resultsContainer.innerHTML = resultsHTML;
    resultsContainer.classList.add('active');
    
    // Guardar clientes encontrados para selección
    window.foundClients = clients;
}

function selectClientByIndex(index) {
    if (!window.foundClients || !window.foundClients[index]) {
        showConsentNotification('Error al seleccionar cliente', 'error');
        return;
    }
    
    selectedClient = window.foundClients[index];
    console.log('Cliente seleccionado:', selectedClient);
    
    // Marcar como seleccionado visualmente
    document.querySelectorAll('.client-result-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.querySelectorAll('.client-result-item')[index].classList.add('selected');
    
    // Mostrar notificación
    showConsentNotification('Cliente seleccionado: ' + selectedClient.nombre, 'success');
}

function normalizeTicketToClient(ticket) {
    // Ticket de consulta a estructura común
    return {
        nombre: ticket.nombre || 'Sin nombre',
        cedula: ticket.cedula || ticket.idPaciente || 'Sin cédula',
        telefono: ticket.telefono || '',
        correo: ticket.correo || '',
        mascota: ticket.mascota || 'Sin mascota',
        tipoMascota: ticket.tipoMascota || 'otro',
        raza: ticket.raza || '',
        edad: ticket.edad || '',
        peso: ticket.peso || '',
        sexo: ticket.sexo || '',
        ticketId: ticket.randomId || '',
        fechaConsulta: ticket.fechaConsulta || ticket.fecha || '',
        horaConsulta: ticket.horaConsulta || ticket.horaAtencion || '',
        procedimiento: ticket.motivo || ticket.tipoServicio || '',
        doctorAtiende: ticket.medicoAtiende || ticket.doctorAtiende || '',
        asistenteAtiende: ticket.asistenteAtiende || '',
        urgencia: ticket.urgencia || '',
        estado: ticket.estado || '',
        observaciones: ticket.motivoLlegada || ticket.motivo || '',
        idPaciente: ticket.idPaciente || ''
    };
}

function filterClientsFromConsultaTickets(searchTerm) {
    const term = searchTerm.toLowerCase();
    const clientsMap = new Map();
    const source = Array.isArray(window.tickets) ? window.tickets : [];
    const selectedDate = getSelectedConsentDate();
    const dateFilter = selectedDate || getCurrentDateString();
    
    // Filtrar tickets que coincidan con el término de búsqueda Y que sean de la fecha seleccionada
    const matching = source.filter(t => {
        // Primero verificar que el ticket fue creado en la fecha seleccionada
        if (!isTicketCreatedOnDate(t, dateFilter)) {
            return false;
        }
        
        // Luego verificar que coincida con el término de búsqueda
        return (
            (t.nombre && t.nombre.toLowerCase().includes(term)) ||
            (t.cedula && t.cedula.toLowerCase().includes(term)) ||
            (t.mascota && t.mascota.toLowerCase().includes(term)) ||
            (t.idPaciente && String(t.idPaciente).toLowerCase().includes(term)) ||
            (t.numFactura && String(t.numFactura).toLowerCase().includes(term))
        );
    });
    
    matching.forEach(ticket => {
        const key = ticket.cedula || ticket.idPaciente || (ticket.nombre + '|' + ticket.mascota);
        if (!clientsMap.has(key)) {
            clientsMap.set(key, normalizeTicketToClient(ticket));
        }
    });
    return Array.from(clientsMap.values());
}

function filterClientsFromInternos(searchTerm) {
    // Por ahora, reutilizamos los tickets de consulta
    return filterClientsFromConsultaTickets(searchTerm);
}

function getMascotaIcon(tipoMascota) {
    const iconos = {
        'perro': '🐕',
        'gato': '🐱',
        'conejo': '🐰',
        'ave': '🐦',
        'reptil': '🦎',
        'otro': '🐾'
    };
    return iconos[tipoMascota] || iconos['otro'];
}

function enableTemplateSelection() {
    const templateCards = document.querySelectorAll('.template-card');
    templateCards.forEach(card => {
        card.classList.remove('disabled');
    });
}

function selectTemplate(templateKey) {
    if (!CONSENT_TEMPLATES[templateKey]) {
        showConsentNotification('Plantilla no encontrada', 'error');
        return;
    }

    const allowedBySource = new Set(ALLOWED_TEMPLATES_BY_SOURCE[consentSource] || []);
    const allowedByRole = getAllowedTemplatesForRole();
    if (!allowedBySource.has(templateKey) || (allowedByRole && !allowedByRole.has(templateKey))) {
        showConsentNotification('No tiene permiso para usar esta plantilla', 'error');
        return;
    }
    
    selectedTemplate = templateKey;
    console.log('Plantilla seleccionada:', templateKey);
    
    // Marcar plantilla como seleccionada
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector('[data-template="' + templateKey + '"]').classList.add('selected');
    
    // Mostrar notificación
    const template = CONSENT_TEMPLATES[templateKey];
    showConsentNotification('Plantilla seleccionada: ' + template.name, 'success');
    
    // Abrir formulario de consentimiento
    openConsentForm(templateKey);
}

function openConsentForm(templateKey) {
    const template = CONSENT_TEMPLATES[templateKey];
    const formContainer = document.getElementById('consentFormContainer');
    const formTitle = document.getElementById('selectedFormTitle');
    const iframe = document.getElementById('consentFormIframe');
    
    if (!formContainer || !formTitle || !iframe) {
        showConsentNotification('Error al abrir formulario', 'error');
        return;
    }
    
    // Actualizar título
    formTitle.textContent = template.name;
    
    // Construir URL con parámetros del cliente (si hay cliente seleccionado)
    let templateUrl = template.file;
    
    if (selectedClient) {
        const correoValue = selectedClient.correo || '';
        const fechaCirugiaFormatted = selectedClient.fechaCirugia ? 
            new Date(selectedClient.fechaCirugia).toLocaleDateString('es-ES') : 
            '';
        const fechaConsultaFormatted = selectedClient.fechaConsulta ? selectedClient.fechaConsulta : '';
            
        const params = new URLSearchParams({
            // Datos del cliente
            clienteNombre: selectedClient.nombre,
            clienteCedula: selectedClient.cedula,
            clienteTelefono: selectedClient.telefono,
            clienteCorreo: correoValue,
            correo: correoValue,
            
            // Datos de la mascota
            mascotaNombre: selectedClient.mascota,
            mascotaTipo: selectedClient.tipoMascota,
            mascotaRaza: selectedClient.raza || '',
            mascotaEdad: selectedClient.edad || '',
            mascotaPeso: selectedClient.peso || '',
            mascotaSexo: selectedClient.sexo || '',
            
            // Datos del procedimiento
            procedimiento: selectedClient.procedimiento || '',
            observaciones: selectedClient.observaciones || '',
            
            // Datos médicos
            doctorAtiende: selectedClient.doctorAtiende || '',
            asistenteAtiende: selectedClient.asistenteAtiende || '',
            
            // Datos de la cirugía
            fechaCirugia: fechaCirugiaFormatted,
            horaCirugia: selectedClient.horaCirugia || '',
            urgencia: selectedClient.urgencia || 'normal',
            estado: selectedClient.estado || 'programado',
            
            // Datos de la consulta
            fechaConsulta: fechaConsultaFormatted,
            horaConsulta: selectedClient.horaConsulta || '',
            
            // Datos del ticket
            ticketId: selectedClient.ticketId || '',
            idPaciente: selectedClient.idPaciente || '',
            
            // Datos de fecha y hora actuales
            fecha: new Date().toLocaleDateString('es-ES'),
            hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        });
        
        templateUrl = template.file + '?' + params.toString();
        
        console.log('=== DATOS ENVIADOS A PLANTILLA ===');
        console.log('Cliente seleccionado:', selectedClient);
        console.log('Parámetros URL:', params.toString());
        console.log('URL completa:', templateUrl);
    }
    
    // Cargar plantilla en iframe
    iframe.src = templateUrl;
    
    // Mostrar contenedor
    formContainer.style.display = 'block';
    
    // Scroll hacia el formulario
    formContainer.scrollIntoView({ behavior: 'smooth' });
    
    console.log('Formulario de consentimiento abierto:', templateUrl);
}

function closeConsentForm() {
    const formContainer = document.getElementById('consentFormContainer');
    const iframe = document.getElementById('consentFormIframe');
    
    if (formContainer) {
        formContainer.style.display = 'none';
    }
    
    if (iframe) {
        iframe.src = '';
    }
    
    // Limpiar selecciones
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    selectedTemplate = null;
    
    showConsentNotification('Formulario cerrado', 'success');
    console.log('Formulario de consentimiento cerrado');
}

// Función para mostrar notificaciones específicas de consentimientos
function showConsentNotification(message, type) {
    // Usar la función de notificación existente del sistema si está disponible
    if (typeof showNotification === 'function') {
        showNotification(message, type);
        return;
    }
    
    // Crear notificación personalizada si no existe la función del sistema
    const notification = document.createElement('div');
    notification.className = 'consent-notification ' + type;
    
    const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    const titleMap = {
        success: 'Éxito',
        error: 'Error',
        warning: 'Advertencia',
        info: 'Información'
    };
    
    notification.innerHTML = `
        <h4><i class="${iconMap[type]}"></i> ${titleMap[type]}</h4>
        <p>${message}</p>
    `;
    
    document.body.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Ocultar después de 4 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 4000);
}

// Función utilitaria para debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction() {
        const args = arguments;
        const later = function() {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Función para limpiar búsqueda
function clearClientSearch() {
    document.getElementById('consentClientSearch').value = '';
    document.getElementById('clientSearchResults').classList.remove('active');
    selectedClient = null;
    
    // No limpiar la fecha automáticamente, permitir que el usuario la mantenga si quiere
    
    // Las plantillas permanecen habilitadas
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('selected');
    });
}

// Función para agregar mensaje informativo sobre el filtro de fecha


// Función para imprimir consentimiento desde iframe
function printConsentForm() {
    const iframe = document.getElementById('consentFormIframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
    } else {
        showConsentNotification('No hay formulario para imprimir', 'warning');
    }
}

// Función de debug para verificar datos disponibles
function debugConsentimientos() {
    console.log('=== DEBUG CONSENTIMIENTOS ===');
    console.log('window.quirofanoTickets:', window.quirofanoTickets);
    console.log('Cantidad de tickets de quirófano:', window.quirofanoTickets ? window.quirofanoTickets.length : 'No disponible');
    
    if (window.quirofanoTickets && window.quirofanoTickets.length > 0) {
        console.log('Ejemplo de ticket de quirófano:', window.quirofanoTickets[0]);
    }
    
    const resultsContainer = document.getElementById('clientSearchResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="debug-info">
                <h4>Información de Debug</h4>
                <p><strong>Tickets de quirófano disponibles:</strong> ${window.quirofanoTickets ? window.quirofanoTickets.length : 'No disponible'}</p>
                <p><strong>Estado de la variable global:</strong> ${window.quirofanoTickets ? 'Disponible' : 'No disponible'}</p>
                <div style="margin-top: 15px;">
                    <button onclick="location.reload()" class="btn-retry">Recargar página</button>
                    <button onclick="searchClients()" class="btn-retry" style="margin-left: 10px;">Reintentar búsqueda</button>
                </div>
            </div>
        `;
    }
}

// Exponer funciones globalmente para uso en HTML
window.selectClientByIndex = selectClientByIndex;
window.selectTemplate = selectTemplate;
window.debugConsentimientos = debugConsentimientos;
window.closeConsentForm = closeConsentForm;
window.clearClientSearch = clearClientSearch;
window.printConsentForm = printConsentForm;

console.log('Módulo de consentimientos cargado correctamente');
