// consentimientos.js - Funcionalidad para el módulo de consentimientos

// Variables globales para consentimientos
let selectedClient = null;
let selectedTemplate = null;
let consentimientos = [];

// Mapeo de plantillas disponibles
const CONSENT_TEMPLATES = {
    anestesia: {
        name: 'Autorización para Anestesia',
        file: 'plantilla/consentimiento_anestesia.html',
        description: 'Consentimiento para procedimientos bajo anestesia'
    },
    cirugia: {
        name: 'Consentimiento Cirugía',
        file: 'plantilla/consentimiento_cirugia.html',
        description: 'Autorización para procedimientos quirúrgicos'
    },
    emergencias: {
        name: 'Emergencias',
        file: 'plantilla/Emergencias_Plantilla.html',
        description: 'Consentimiento para atención de emergencias'
    },
    internamiento: {
        name: 'Internamiento',
        file: 'plantilla/internamiento.html',
        description: 'Autorización para internamiento hospitalario'
    },
    transfusion: {
        name: 'Transfusión',
        file: 'plantilla/transfusion.html',
        description: 'Consentimiento para transfusión sanguínea'
    },
    cesarea: {
        name: 'Consentimiento Cesárea',
        file: 'plantilla/consentimiento_cesarea.html',
        description: 'Autorización para cesárea'
    },
    eutanasia: {
        name: 'Consentimiento Eutanasia',
        file: 'plantilla/consentimiento_eutanasia.html',
        description: 'Autorización para eutanasia humanitaria'
    },
    alta_voluntaria: {
        name: 'Alta Voluntaria',
        file: 'plantilla/consentimiento_alta_voluntaria.html',
        description: 'Consentimiento informado por alta voluntaria'
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
    
    // Habilitar plantillas desde el inicio
    enableTemplateSelection();
    
    // Verificar si los datos están disponibles y esperar si es necesario
    waitForTicketsData();
    
    console.log('Módulo de consentimientos inicializado correctamente');
}

// Función para esperar a que los datos estén disponibles
function waitForTicketsData() {
    const maxWait = 10000; // 10 segundos máximo
    const interval = 500; // verificar cada 500ms
    let elapsed = 0;
    
    const checkData = () => {
        if (window.tickets && Array.isArray(window.tickets)) {
            console.log('Datos de tickets disponibles:', window.tickets.length, 'tickets cargados');
            return;
        }
        
        elapsed += interval;
        if (elapsed < maxWait) {
            setTimeout(checkData, interval);
        } else {
            console.warn('Timeout esperando datos de tickets');
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
    
    // Template cards
    setupTemplateCardListeners();
    
    // Botón cerrar formulario
    const closeBtn = document.getElementById('closeFormBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeConsentForm);
    }
}

function setupTemplateCardListeners() {
    const templateCards = document.querySelectorAll('.template-card');
    templateCards.forEach(card => {
        card.addEventListener('click', function() {
            const template = this.getAttribute('data-template');
            selectTemplate(template);
        });
    });
}

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
    
    console.log('Buscando clientes:', searchTerm);
    console.log('window.tickets disponible:', !!window.tickets);
    console.log('Cantidad de tickets:', window.tickets ? window.tickets.length : 'N/A');
    
    // Mostrar indicador de carga
    resultsContainer.innerHTML = '<div class="loading-consent"><i class="fas fa-spinner fa-spin"></i> Buscando clientes...</div>';
    resultsContainer.classList.add('active');
    
    // Verificar si los datos están disponibles
    if (!window.tickets) {
        console.warn('window.tickets no está disponible todavía');
        resultsContainer.innerHTML = `
            <div class="no-clients-found">
                <i class="fas fa-clock"></i>
                <h4>Cargando datos del sistema</h4>
                <p>Por favor espere mientras se cargan los datos...</p>
                <button onclick="searchClients()" class="btn-retry">Reintentar búsqueda</button>
            </div>
        `;
        return;
    }
    
    // Buscar en tickets existentes
    if (window.tickets && window.tickets.length > 0) {
        const filteredClients = filterClientsFromTickets(searchTerm);
        console.log('Clientes filtrados:', filteredClients.length);
        displayClientResults(filteredClients);
    } else {
        // Si no hay tickets, mostrar mensaje más descriptivo
        console.log('No hay tickets disponibles o el array está vacío');
        resultsContainer.innerHTML = `
            <div class="no-clients-found">
                <i class="fas fa-database"></i>
                <h4>No hay datos disponibles</h4>
                <p>No se encontraron registros de clientes en el sistema.</p>
                <p><small>Asegúrese de que haya consultas registradas antes de buscar clientes.</small></p>
                <button onclick="debugConsentimientos()" class="btn-retry">Ver información de debug</button>
            </div>
        `;
    }
}

function filterClientsFromTickets(searchTerm) {
    const term = searchTerm.toLowerCase();
    const clientsMap = new Map();
    
    // Filtrar tickets que coincidan con el término de búsqueda
    const matchingTickets = window.tickets.filter(ticket => {
        return (
            (ticket.nombre && ticket.nombre.toLowerCase().includes(term)) ||
            (ticket.cedula && ticket.cedula.toLowerCase().includes(term)) ||
            (ticket.mascota && ticket.mascota.toLowerCase().includes(term)) ||
            (ticket.telefono && ticket.telefono.includes(term))
        );
    });
    
    // Agrupar por cliente único
    matchingTickets.forEach(ticket => {
        const clientKey = ticket.cedula || ticket.nombre || 'sin-cedula-' + ticket.randomId;
        
        if (!clientsMap.has(clientKey)) {
            clientsMap.set(clientKey, {
                nombre: ticket.nombre || 'Sin nombre',
                cedula: ticket.cedula || 'Sin cédula',
                telefono: ticket.telefono || 'Sin teléfono',
                direccion: ticket.direccion || 'Sin dirección',
                mascota: ticket.mascota || 'Sin mascota',
                tipoMascota: ticket.tipoMascota || 'otro',
                ticketId: ticket.randomId,
                fechaUltimaConsulta: ticket.fechaConsulta
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
    
    const resultsHTML = clients.map((client, index) => `
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
                    <div class="client-detail">
                        <i class="fas fa-calendar"></i>
                        <span>Última consulta: ${client.fechaUltimaConsulta || 'N/A'}</span>
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
        const params = new URLSearchParams({
            clienteNombre: selectedClient.nombre,
            clienteCedula: selectedClient.cedula,
            clienteTelefono: selectedClient.telefono,
            clienteDireccion: selectedClient.direccion || '',
            mascotaNombre: selectedClient.mascota,
            mascotaTipo: selectedClient.tipoMascota,
            fecha: new Date().toLocaleDateString('es-ES'),
            hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        });
        
        templateUrl = template.file + '?' + params.toString();
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
    
    // Las plantillas permanecen habilitadas
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('selected');
    });
}

// Función para imprimir consentimiento desde iframe
function printConsentForm() {
    const iframe = document.getElementById('consentFormIframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
    } else {
        showConsentNotification('No hay formulario para imprimir', 'warning');
    }
}

// Exponer funciones globalmente para uso en HTML
window.selectClientByIndex = selectClientByIndex;
window.selectTemplate = selectTemplate;
window.closeConsentForm = closeConsentForm;
window.clearClientSearch = clearClientSearch;
window.printConsentForm = printConsentForm;

console.log('Módulo de consentimientos cargado correctamente');
