// ========== MÓDULO DE INTERNAMIENTO MEJORADO ==========
// Sistema completo de gestión de pacientes internados
// Optimizado para búsqueda por cédula y nombre de mascota

console.log('✅ Módulo de Internamiento cargado - Versión Mejorada');

// ========== VARIABLES GLOBALES ==========
let internamientoTickets = [];
let internamientoFirebaseRef = null;
let currentInternamientoView = 'ver';
let ticketsConsulta = []; // Tickets de consulta para búsqueda

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
    initializeInternamientoModule();
});

function initializeInternamientoModule() {
    try {
    // Configurar referencia de Firebase
    if (firebase && firebase.database) {
        internamientoFirebaseRef = firebase.database().ref('internamiento');
        
        // Cargar datos existentes
        loadInternamientoTickets();
            
            // Cargar tickets de consulta para búsqueda
            loadTicketsConsulta();
    } else {
            console.error('❌ Firebase no está disponible');
    }
    
    // Configurar event listeners
    setupInternamientoEventListeners();
    
    // Establecer fecha actual en formularios
    setInternamientoCurrentDate();
    } catch (error) {
        console.error('❌ Error al inicializar módulo de Internamiento:', error);
    }
}

// ========== CARGAR TICKETS DE CONSULTA PARA BÚSQUEDA ==========
function loadTicketsConsulta() {
    // Función para actualizar tickets desde window.tickets
    function actualizarDesdeTicketsGlobales() {
        if (typeof window.tickets !== 'undefined' && window.tickets && window.tickets.length > 0) {
            // FILTRAR: Excluir tickets con tipoServicio = 'internamiento'
            ticketsConsulta = window.tickets.filter(ticket => ticket.tipoServicio !== 'internamiento');
            return true;
        }
        return false;
    }
    
    // Intentar cargar inmediatamente
    if (actualizarDesdeTicketsGlobales()) {
        return;
    }
    
    // Si no están disponibles, esperar y reintentar
    let intentos = 0;
    const maxIntentos = 20;
    
    const intervalId = setInterval(() => {
        intentos++;
        
        if (actualizarDesdeTicketsGlobales()) {
            clearInterval(intervalId);
        } else if (intentos >= maxIntentos) {
            clearInterval(intervalId);
            cargarTicketsDesdeFirebase();
        }
    }, 500);
}

function cargarTicketsDesdeFirebase() {
    if (!firebase || !firebase.database) {
        console.error('❌ Firebase no está disponible');
        return;
    }
    
    const ticketsRef = firebase.database().ref('tickets');
    
    ticketsRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            ticketsConsulta = [];
            Object.keys(data).forEach(key => {
                const ticket = data[key];
                // FILTRAR: Excluir tickets con tipoServicio = 'internamiento'
                // Estos deben manejarse solo desde la tabla 'internamiento'
                if (ticket.tipoServicio !== 'internamiento') {
                    ticketsConsulta.push({
                        firebaseKey: key,
                        ...ticket
                    });
                }
            });
        } else {
            ticketsConsulta = [];
        }
    }).catch((error) => {
        console.error('❌ Error al cargar desde Firebase:', error);
    });
    
    // También configurar listener para actualizaciones en tiempo real
    ticketsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            ticketsConsulta = [];
            Object.keys(data).forEach(key => {
                const ticket = data[key];
                // FILTRAR: Excluir tickets con tipoServicio = 'internamiento'
                // Estos deben manejarse solo desde la tabla 'internamiento'
                if (ticket.tipoServicio !== 'internamiento') {
                    ticketsConsulta.push({
                        firebaseKey: key,
                        ...ticket
                    });
                }
            });
        }
    });
}

// ========== NAVEGACIÓN ==========
function navigateToInternamiento(sectionId, buttonId) {
    
    // Ocultar todas las secciones
    const allSections = document.querySelectorAll('.content section');
    allSections.forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');
        section.classList.add('active');
    } else {
        console.error(`❌ Sección ${sectionId} no encontrada`);
        return;
    }
    
    // Actualizar botones activos
    const button = document.getElementById(buttonId);
    if (button && typeof setActiveButton === 'function') {
        setActiveButton(button);
    }
    
    // Cargar datos específicos de la sección
    switch(sectionId) {
        case 'crearInternamientoSection':
            currentInternamientoView = 'crear';
            setupCrearInternamiento();
            break;
        case 'verInternamientoSection':
            currentInternamientoView = 'ver';
            // Aplicar filtro por defecto: activos (ingresados)
            renderInternamientoTickets('activos');
            // Asegurar que el botón activo esté marcado
            setTimeout(() => {
                document.querySelectorAll('.int-filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                const btnActivos = document.querySelector('.int-filter-btn[data-filter="activos"]');
                if (btnActivos) btnActivos.classList.add('active');
            }, 100);
            break;
        case 'monitoreoInternamientoSection':
            currentInternamientoView = 'monitoreo';
            setupMonitoreoInternamiento();
            break;
        // case 'medicamentosInternamientoSection':
        //     currentInternamientoView = 'medicamentos';
        //     setupMedicamentosInternamiento();
        //     break;
    }
}

// ========== CARGAR DATOS DE FIREBASE ==========
function loadInternamientoTickets() {
    if (!internamientoFirebaseRef) {
        console.error('❌ Firebase no está configurado');
        return;
    }
    
    
    internamientoFirebaseRef.on('value', (snapshot) => {
        const data = snapshot.val();
        internamientoTickets = [];
        
        if (data) {
            Object.keys(data).forEach(key => {
                internamientoTickets.push({
                    firebaseKey: key,
                    ...data[key]
                });
            });
        }
        
        
        // Actualizar vista si estamos en la sección de ver
        if (currentInternamientoView === 'ver') {
            renderInternamientoTickets(filtroActualInternamiento);
        }
    });
}

// ========== CONFIGURAR EVENT LISTENERS ==========
function setupInternamientoEventListeners() {
    
    // Formulario de creación
    const form = document.getElementById('internamientoForm');
    if (form) {
        form.addEventListener('submit', handleInternamientoFormSubmit);
    }
}

// ========== CREAR PACIENTE INTERNADO ==========
function setupCrearInternamiento() {
    
    // Establecer fecha actual
    const fechaIngreso = document.getElementById('intFechaIngreso');
    if (fechaIngreso && !fechaIngreso.value) {
        fechaIngreso.value = new Date().toISOString().split('T')[0];
    }
    
    // Configurar búsqueda de clientes mejorada
    setupBusquedaClientesMejorada();
}

// ========== BÚSQUEDA MEJORADA DE CLIENTES ==========
function setupBusquedaClientesMejorada() {
    let searchInput = document.getElementById('intClienteSearch');
    if (!searchInput) {
        console.error('❌ Campo de búsqueda no encontrado');
        return;
    }
    
    const resultsContainer = document.getElementById('intClienteResults');
    if (!resultsContainer) {
        console.error('❌ Contenedor de resultados no encontrado');
        return;
    }
    
    // Clonar el input para eliminar todos los event listeners anteriores
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    searchInput = newSearchInput;
    
    // Búsqueda en tiempo real
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        
        if (query.length >= 2) {
            buscarClientesPorCedulaYNombre(query);
        } else {
            ocultarResultadosBusqueda();
        }
    });
    
    // Ocultar resultados al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target)) {
            if (resultsContainer && !resultsContainer.contains(e.target)) {
                ocultarResultadosBusqueda();
            }
        }
    });
    
    // Mostrar ayuda visual en el campo de búsqueda
    searchInput.title = `Tickets disponibles: ${ticketsConsulta.length}`;
    
}

// ========== BUSCAR CLIENTES POR CÉDULA Y NOMBRE DE MASCOTA ==========
function buscarClientesPorCedulaYNombre(query) {
    const resultsContainer = document.getElementById('intClienteResults');
    if (!resultsContainer) {
        console.error('❌ Contenedor de resultados no encontrado');
        return;
    }
    
    if (ticketsConsulta.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2em; color: var(--int-primary); margin-bottom: 10px;"></i>
                    <p><strong>⏳ Cargando datos de clientes...</strong></p>
                    <p style="font-size: 0.9em; color: #666;">Esto puede tomar unos segundos</p>
                    <button onclick="recargarTicketsInternamiento()" style="margin-top: 10px; padding: 8px 16px; background: var(--int-primary); color: white; border: none; border-radius: 6px; cursor: pointer;">
                        🔄 Reintentar
                    </button>
                </div>
            </div>
        `;
        resultsContainer.style.display = 'block';
        
        if (window.tickets && window.tickets.length > 0) {
            ticketsConsulta = [...window.tickets];
            setTimeout(() => buscarClientesPorCedulaYNombre(query), 100);
        } else {
            loadTicketsConsulta();
            setTimeout(() => {
                if (ticketsConsulta.length > 0) {
                    buscarClientesPorCedulaYNombre(query);
                }
            }, 2000);
        }
        return;
    }
    
    const searchQuery = query.toLowerCase();
    
    // Buscar por: nombre, cédula, nombre de mascota, ID paciente
    const filteredTickets = ticketsConsulta.filter(ticket => {
        const nombre = (ticket.nombre || '').toLowerCase();
        const cedula = (ticket.cedula || '').toLowerCase();
        const mascota = (ticket.mascota || '').toLowerCase();
        const idPaciente = (ticket.idPaciente || '').toLowerCase();
        
        return nombre.includes(searchQuery) || 
               cedula.includes(searchQuery) || 
               mascota.includes(searchQuery) || 
               idPaciente.includes(searchQuery);
    });
    
    
    if (filteredTickets.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">❌ No se encontraron clientes</div>';
    } else {
        resultsContainer.innerHTML = filteredTickets.map(ticket => createSearchResultItem(ticket)).join('');
    }
    
    resultsContainer.style.display = 'block';
}

function createSearchResultItem(ticket) {
    const fecha = ticket.fecha ? new Date(ticket.fecha).toLocaleDateString('es-CR') : 'Sin fecha';
    const tipoMascota = ticket.tipoMascota || 'No especificado';
    const randomId = ticket.randomId || ticket.firebaseKey || '';
    
    return `
        <div class="cliente-result-item" onclick="seleccionarClienteTicket('${randomId}')">
            <div class="cliente-result-info">
                <div class="cliente-result-name">👤 ${ticket.nombre || 'Sin nombre'}</div>
                <div class="cliente-result-details">
                    <span class="cliente-result-mascota">🐾 ${ticket.mascota || 'Sin mascota'}</span>
                    <span class="cliente-result-id">📋 ID: ${ticket.idPaciente || 'N/A'}</span>
                    <span class="cliente-result-cedula">🆔 Cédula: ${ticket.cedula || 'N/A'}</span>
                </div>
                <div style="color: #666; font-size: 0.85em; margin-top: 4px;">
                    <span>📅 ${fecha}</span> • <span>🏷️ ${tipoMascota}</span>
                </div>
            </div>
        </div>
    `;
}

function seleccionarClienteTicket(ticketId) {
    
    const ticket = ticketsConsulta.find(t => (t.randomId || t.firebaseKey) === ticketId);
    
    if (!ticket) {
        showNotification('❌ Cliente no encontrado', 'error');
        console.error('❌ Ticket no encontrado:', ticketId);
        return;
    }
    
    
    // Llenar formulario con datos del ticket
    autocompletarFormularioDesdeTicket(ticket);
    
    // Ocultar resultados
    ocultarResultadosBusqueda();
    
    // Actualizar campo de búsqueda
    const searchInput = document.getElementById('intClienteSearch');
    if (searchInput) {
        searchInput.value = `${ticket.mascota} (${ticket.cedula})`;
    }
    
    showNotification('✅ Datos del cliente cargados correctamente', 'success');
}

function autocompletarFormularioDesdeTicket(ticket) {
    
    // Información del paciente
    setFieldValue('intCedula', ticket.cedula);
    
    // Información de la mascota
    setFieldValue('intMascota', ticket.mascota);
    setFieldValue('intTipoMascota', ticket.tipoMascota || 'perro');
    setFieldValue('intEdad', ticket.edad);
    setFieldValue('intRaza', ticket.raza);
    setFieldValue('intPeso', ticket.peso);
    setFieldValue('intSexo', ticket.sexo);
    setFieldValue('intIdPaciente', ticket.idPaciente);
    setFieldValue('intTemperatura', ticket.temperatura);
    
    // Información del propietario
    setFieldValue('intPropietario', ticket.nombre);
    setFieldValue('intTelefono', ticket.telefono);
    setFieldValue('intEmail', ticket.email);
    setFieldValue('intFactura', ticket.numFactura);
    
    // Información médica
    setFieldValue('intMedicoEncargado', ticket.doctorAtiende);
    setFieldValue('intHistoriaClinica', ticket.motivo);
    // setFieldValue('intDiagnosticoPresuntivo', ticket.motivoLlegada); // Comentado: no se llena automáticamente
    
}

function setFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (field && value) {
        field.value = value;
    }
}

function ocultarResultadosBusqueda() {
    const resultsContainer = document.getElementById('intClienteResults');
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
}

// ========== SUBMIT DEL FORMULARIO ==========
function handleInternamientoFormSubmit(e) {
    e.preventDefault();
    
    // Obtener valores del formulario
    const formData = {
        randomId: generateInternamientoId(),
        
        // Información del paciente
        cedula: document.getElementById('intCedula')?.value || '',
        
        // Información de la mascota
        mascota: document.getElementById('intMascota')?.value || '',
        tipoMascota: document.getElementById('intTipoMascota')?.value || 'perro',
        edad: document.getElementById('intEdad')?.value || '',
        raza: document.getElementById('intRaza')?.value || '',
        peso: document.getElementById('intPeso')?.value || '',
        sexo: document.getElementById('intSexo')?.value || '',
        idPaciente: document.getElementById('intIdPaciente')?.value || '',
        temperatura: document.getElementById('intTemperatura')?.value || '',
        
        // Información del propietario
        propietario: document.getElementById('intPropietario')?.value || '',
        telefono: document.getElementById('intTelefono')?.value || '',
        email: document.getElementById('intEmail')?.value || '',
        factura: document.getElementById('intFactura')?.value || '',
        
        // Información médica
        medicoEncargado: document.getElementById('intMedicoEncargado')?.value || '',
        fechaIngreso: document.getElementById('intFechaIngreso')?.value || new Date().toISOString().split('T')[0],
        horaIngreso: new Date().toLocaleTimeString('es-CR', { hour12: false }),
        estadoPaciente: document.getElementById('intEstadoPaciente')?.value || 'estable',
        numeroJaula: document.getElementById('intNumeroJaula')?.value || '',
        cuarto: document.getElementById('intCuarto')?.value || '',
        historiaClinica: document.getElementById('intHistoriaClinica')?.value || '',
        diagnosticoPresuntivo: document.getElementById('intDiagnosticoPresuntivo')?.value || '',
        tratamientoIndicado: document.getElementById('intTratamientoIndicado')?.value || '',
        padecimientosPrevios: document.getElementById('intPadecimientosPrevios')?.value || '',
        
        // Checklist de procedimientos
        muestras: document.getElementById('intMuestras')?.checked || false,
        examenes: document.getElementById('intExamenes')?.checked || false,
        ultrasonido: document.getElementById('intUltrasonido')?.checked || false,
        castrado: document.getElementById('intCastrado')?.checked || false,
        vacunaDesparasitacion: document.getElementById('intVacunaDesparasitacion')?.checked || false,
        
        // Metadatos
        estado: 'internado',
        estadoPaciente: 'estable',
        fechaCreacion: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
        creadoPor: localStorage.getItem('currentUser') || sessionStorage.getItem('userName') || 'sistema'
    };
    
    // Validación básica
    if (!formData.mascota || !formData.idPaciente || !formData.medicoEncargado) {
        showNotification('❌ Por favor complete todos los campos obligatorios', 'error');
        console.error('❌ Validación fallida:', formData);
        return;
    }
    
    
    // Guardar en Firebase
    saveInternamientoTicket(formData);
}

function saveInternamientoTicket(ticketData) {
    if (!internamientoFirebaseRef) {
        showNotification('❌ Error de conexión con la base de datos', 'error');
        console.error('❌ Firebase no está configurado');
        return;
    }
    
    const submitBtn = document.querySelector('#internamientoForm .btn-submit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }
    
    
    internamientoFirebaseRef.push(ticketData)
        .then(() => {
            showNotification('✅ Paciente internado registrado exitosamente', 'success');
            resetInternamientoForm();
            
            // ⭐ REDIRECCIÓN AUTOMÁTICA A VER PACIENTES
            setTimeout(() => {
                navigateToInternamiento('verInternamientoSection', 'verInternamientoBtn');
            }, 1500);
        })
        .catch(error => {
            console.error('❌ Error al guardar:', error);
            showNotification('❌ Error al registrar el paciente', 'error');
        })
        .finally(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-home"></i> Registrar Paciente Internado';
            }
        });
}

function resetInternamientoForm() {
    const form = document.getElementById('internamientoForm');
    if (form) {
        form.reset();
        
        // Restablecer fecha
        const fechaIngreso = document.getElementById('intFechaIngreso');
        if (fechaIngreso) {
            fechaIngreso.value = new Date().toISOString().split('T')[0];
        }
        
        // Limpiar búsqueda
        const searchInput = document.getElementById('intClienteSearch');
        if (searchInput) {
            searchInput.value = '';
        }
        
        ocultarResultadosBusqueda();
    }
}

// ========== VER PACIENTES INTERNADOS ==========
let filtroActualInternamiento = 'activos';

function renderInternamientoTickets(filtro = 'activos') {
    filtroActualInternamiento = filtro;
    const container = document.getElementById('intPacientesContainer');
    if (!container) {
        console.error('❌ Contenedor de pacientes no encontrado');
        return;
    }
    
    // Obtener valores de filtros
    const dateFilter = document.getElementById('intFilterDate');
    const searchInput = document.getElementById('intSearchInput');
    const selectedDate = dateFilter && dateFilter.value ? dateFilter.value : '';
    const searchText = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    // Aplicar filtros
    let filteredTickets = [...internamientoTickets];
    
    // Filtro por estado/urgencia
    if (filtro === 'activos') {
        // Ingresados: todos excepto dados de alta
        filteredTickets = filteredTickets.filter(t => !t.estado || t.estado !== 'alta');
    } else if (filtro === 'observacion') {
        // En observación: estado = observacion
        filteredTickets = filteredTickets.filter(t => t.estadoPaciente === 'observacion');
    } else if (filtro === 'critico') {
        // Críticos: estado = critico
        filteredTickets = filteredTickets.filter(t => t.estadoPaciente === 'critico');
    } else if (filtro === 'alta') {
        // Dados de alta
        filteredTickets = filteredTickets.filter(t => t.estado === 'alta');
    }
    // 'todos' no filtra por estado
    
    // Filtro por fecha de ingreso
    if (selectedDate) {
        filteredTickets = filteredTickets.filter(t => t.fechaIngreso === selectedDate);
    }
    
    // Filtro por búsqueda de texto
    if (searchText) {
        filteredTickets = filteredTickets.filter(ticket => {
            return (
                (ticket.propietario && ticket.propietario.toLowerCase().includes(searchText)) ||
                (ticket.mascota && ticket.mascota.toLowerCase().includes(searchText)) ||
                (ticket.idPaciente && ticket.idPaciente.toLowerCase().includes(searchText)) ||
                (ticket.cedula && ticket.cedula.toLowerCase().includes(searchText)) ||
                (ticket.telefono && ticket.telefono.toLowerCase().includes(searchText))
            );
        });
    }
    
    // Mostrar resultados
    if (filteredTickets.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-search"></i>
                <p>No se encontraron pacientes con los filtros aplicados</p>
                <small>Intenta ajustar los filtros o limpiarlos</small>
            </div>
        `;
        return;
    }
    
    // Ordenar por fecha de ingreso (más recientes primero)
    filteredTickets.sort((a, b) => {
        const dateA = new Date(a.fechaIngreso || '2000-01-01');
        const dateB = new Date(b.fechaIngreso || '2000-01-01');
        return dateB - dateA;
    });
    
    container.innerHTML = filteredTickets.map(ticket => createInternamientoTicketCard(ticket)).join('');
}

function filtrarInternamiento(filtro) {
    // Actualizar botones activos
    document.querySelectorAll('.int-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const btnActivo = document.querySelector(`.int-filter-btn[data-filter="${filtro}"]`);
    if (btnActivo) {
        btnActivo.classList.add('active');
    }
    
    // Aplicar filtro
    renderInternamientoTickets(filtro);
}

function aplicarFiltrosInternamiento() {
    // Mantener el filtro actual y re-renderizar con los nuevos valores de búsqueda/fecha
    renderInternamientoTickets(filtroActualInternamiento);
}

function limpiarFiltrosInternamiento() {
    // Limpiar campos
    const dateFilter = document.getElementById('intFilterDate');
    const searchInput = document.getElementById('intSearchInput');
    
    if (dateFilter) dateFilter.value = '';
    if (searchInput) searchInput.value = '';
    
    // Volver al filtro por defecto (activos)
    filtrarInternamiento('activos');
}

function createInternamientoTicketCard(ticket) {
    const diasInternado = calcularDiasInternado(ticket.fechaIngreso);
    const estadoClass = getEstadoClass(ticket.estadoPaciente || 'estable');
    const estadoLabel = getEstadoLabel(ticket.estadoPaciente || 'estable');
    
    // Verificar si el usuario es admin
    const currentRole = sessionStorage.getItem('userRole') || '';
    const isAdmin = currentRole === 'admin';
    
    return `
        <div class="ticket-card ${estadoClass} int-clickable-card" data-ticket-id="${ticket.firebaseKey}" onclick="verDetalleInternamiento('${ticket.firebaseKey}')" style="cursor: pointer;">
            <div class="ticket-header">
                <div class="ticket-info">
                    <h3><i class="fas fa-paw"></i> ${ticket.mascota}</h3>
                    <p class="ticket-id">ID: ${ticket.idPaciente}</p>
                </div>
                <div class="ticket-status">
                    <span class="status-badge ${estadoClass}">${estadoLabel}</span>
                    <span class="dias-badge">${diasInternado} día${diasInternado !== 1 ? 's' : ''}</span>
                </div>
            </div>
            <div class="ticket-body">
                <div class="ticket-detail">
                    <i class="fas fa-user-md"></i>
                    <span><strong>Médico:</strong> ${ticket.medicoEncargado}</span>
                </div>
                <div class="ticket-detail">
                    <i class="fas fa-calendar"></i>
                    <span><strong>Ingreso:</strong> ${formatFecha(ticket.fechaIngreso)} ${ticket.horaIngreso || ''}</span>
                </div>
                ${ticket.cuarto ? `
                <div class="ticket-detail">
                    <i class="fas fa-door-open"></i>
                    <span><strong>Cuarto:</strong> ${ticket.cuarto}${ticket.numeroJaula ? ` - Jaula ${ticket.numeroJaula}` : ''}</span>
                </div>
                ` : ''}
                <div class="ticket-detail">
                    <i class="fas fa-notes-medical"></i>
                    <span><strong>Diagnóstico:</strong> ${ticket.diagnosticoPresuntivo || 'N/A'}</span>
                </div>
            </div>
            <div class="ticket-actions">
                <button class="btn-action btn-discharge" onclick="event.stopPropagation(); darAltaPaciente('${ticket.firebaseKey}')">
                    <i class="fas fa-home"></i> Dar de Alta
                </button>
                ${isAdmin ? `<button class="btn-delete-ticket" onclick="event.stopPropagation(); eliminarPacienteInternado('${ticket.firebaseKey}')" title="Eliminar paciente">
                    <i class="fas fa-trash-alt"></i> Eliminar
                </button>` : ''}
            </div>
        </div>
    `;
}

// ========== MONITOREO Y MEDICAMENTOS ==========
function setupMonitoreoInternamiento() {
    llenarSelectorPacientes('intPacienteMonitoreo');
}

// ========== MEDICAMENTOS - Variables globales ==========
let medicamentosTemporales = [];
let pacienteSeleccionadoMedicamentos = null;

function setupMedicamentosInternamiento() {
    llenarSelectorPacientes('intPacienteMedicamentos');
    setupMedicamentosEventListeners();
}

function setupMedicamentosEventListeners() {
    const selectorPaciente = document.getElementById('intPacienteMedicamentos');
    const btnAgregar = document.getElementById('intAgregarMedicamento');
    const formulario = document.getElementById('medicamentosForm');
    
    if (selectorPaciente) {
        selectorPaciente.addEventListener('change', function() {
            pacienteSeleccionadoMedicamentos = this.value;
            if (pacienteSeleccionadoMedicamentos) {
                document.getElementById('intMedicamentosForm').style.display = 'block';
                cargarMedicamentosPaciente(pacienteSeleccionadoMedicamentos);
        } else {
                document.getElementById('intMedicamentosForm').style.display = 'none';
        }
    });
}

    if (btnAgregar) {
        btnAgregar.addEventListener('click', agregarMedicamentoALista);
    }
    
    if (formulario) {
        formulario.addEventListener('submit', function(e) {
            e.preventDefault();
            guardarMedicamentosPaciente();
        });
    }
}

function agregarMedicamentoALista() {
    const medicamento = document.getElementById('intMedicamento').value.trim();
    const dosis = document.getElementById('intDosis').value.trim();
    const via = document.getElementById('intVia').value;
    const frecuencia = document.getElementById('intFrecuencia').value.trim();
    const duracion = document.getElementById('intDuracion').value.trim();
    const observaciones = document.getElementById('intObservacionesMed').value.trim();
    
    if (!medicamento || !dosis || !via || !frecuencia) {
        showNotification('⚠️ Por favor completa los campos obligatorios', 'warning');
        return;
    }
    
    const nuevoMedicamento = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        medicamento,
        dosis,
        via,
        frecuencia,
        duracion,
        observaciones,
        fechaAgregado: new Date().toISOString(),
        agregadoPor: sessionStorage.getItem('userName') || 'Usuario',
        horarios: []
    };
    
    medicamentosTemporales.push(nuevoMedicamento);
    renderMedicamentosTabla();
    limpiarFormularioMedicamento();
    showNotification('✅ Medicamento agregado a la lista', 'success');
}

function limpiarFormularioMedicamento() {
    document.getElementById('intMedicamento').value = '';
    document.getElementById('intDosis').value = '';
    document.getElementById('intVia').value = '';
    document.getElementById('intFrecuencia').value = '';
    document.getElementById('intDuracion').value = '';
    document.getElementById('intObservacionesMed').value = '';
}

function renderMedicamentosTabla() {
    const tbody = document.getElementById('intMedicamentosTableBody');
    if (!tbody) return;
    
    if (medicamentosTemporales.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 24px; color: #666;">
                    <i class="fas fa-pills" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.3; display: block;"></i>
                    No hay medicamentos agregados
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = medicamentosTemporales.map(med => `
        <tr>
            <td>${med.medicamento}</td>
            <td>${med.dosis}</td>
            <td>${med.via}</td>
            <td>${med.frecuencia}</td>
            <td>${med.duracion || '-'}</td>
            <td>${med.observaciones || '-'}</td>
            <td>
                <button type="button" class="btn-icon btn-danger" onclick="eliminarMedicamentoTemporal('${med.id}')" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function eliminarMedicamentoTemporal(medId) {
    medicamentosTemporales = medicamentosTemporales.filter(m => m.id !== medId);
    renderMedicamentosTabla();
    showNotification('✅ Medicamento eliminado de la lista', 'success');
}

function cargarMedicamentosPaciente(ticketKey) {
    const medicamentosRef = firebase.database().ref(`internamiento/${ticketKey}/medicamentos`);
    
    medicamentosRef.once('value', (snapshot) => {
        const data = snapshot.val();
        medicamentosTemporales = [];
        
        if (data) {
            Object.keys(data).forEach(key => {
                medicamentosTemporales.push({
                    firebaseKey: key,
                    ...data[key]
                });
            });
        }
        
        renderMedicamentosTabla();
    });
}

function guardarMedicamentosPaciente() {
    if (!pacienteSeleccionadoMedicamentos) {
        showNotification('⚠️ Selecciona un paciente', 'warning');
        return;
    }
    
    if (medicamentosTemporales.length === 0) {
        showNotification('⚠️ Agrega al menos un medicamento', 'warning');
        return;
    }
    
    const medicamentosRef = firebase.database().ref(`internamiento/${pacienteSeleccionadoMedicamentos}/medicamentos`);
    
    // Guardar cada medicamento
    const promises = [];
    medicamentosTemporales.forEach(med => {
        if (med.firebaseKey) {
            // Actualizar existente
            promises.push(medicamentosRef.child(med.firebaseKey).update(med));
        } else {
            // Crear nuevo
            promises.push(medicamentosRef.push(med));
        }
    });
    
    Promise.all(promises)
        .then(() => {
            showNotification('✅ Medicamentos guardados exitosamente', 'success');
            medicamentosTemporales = [];
            renderMedicamentosTabla();
        })
        .catch(error => {
            console.error('Error al guardar medicamentos:', error);
            showNotification('❌ Error al guardar medicamentos', 'error');
        });
}

function llenarSelectorPacientes(selectorId) {
    const selector = document.getElementById(selectorId);
    if (!selector) return;
    
    const pacientesActivos = internamientoTickets.filter(t => t.estado !== 'alta');
    
    selector.innerHTML = '<option value="">Seleccione un paciente</option>' +
        pacientesActivos.map(t => `
            <option value="${t.firebaseKey}">${t.mascota} - ${t.nombre} (ID: ${t.idPaciente})</option>
        `).join('');
}

function agregarMonitoreo(ticketKey) {
    // Abrir el modal de detalle directamente en el tab de monitoreo
    verDetalleInternamiento(ticketKey);
    // Cambiar al tab de monitoreo después de un pequeño delay
    setTimeout(() => {
        cambiarTabDetalle('monitoreo');
    }, 300);
}

function agregarMedicamento(ticketKey) {
    // Abrir el modal de detalle directamente en el tab de medicamentos
    verDetalleInternamiento(ticketKey);
    // Cambiar al tab de medicamentos después de un pequeño delay
    setTimeout(() => {
        cambiarTabDetalle('medicamentos');
    }, 300);
}

// ========== DAR DE ALTA ==========
function darAltaPaciente(ticketKey) {
    if (!confirm('¿Está seguro que desea dar de alta a este paciente?')) {
        return;
    }
    
    const updates = {
        estado: 'alta',
        fechaAlta: new Date().toISOString(),
        horaAlta: new Date().toLocaleTimeString('es-CR', { hour12: false }),
        fechaActualizacion: new Date().toISOString()
    };
    
    internamientoFirebaseRef.child(ticketKey).update(updates)
        .then(() => {
            showNotification('✅ Paciente dado de alta exitosamente', 'success');
        })
        .catch(error => {
            console.error('❌ Error al dar de alta:', error);
            showNotification('❌ Error al dar de alta al paciente', 'error');
        });
}

function eliminarPacienteInternado(ticketKey) {
    const currentRole = sessionStorage.getItem('userRole') || '';
    
    if (currentRole !== 'admin') {
        showNotification('❌ Solo los administradores pueden eliminar pacientes', 'error');
        return;
    }
    
    const ticket = internamientoTickets.find(t => t.firebaseKey === ticketKey);
    if (!ticket) {
        showNotification('❌ Paciente no encontrado', 'error');
        return;
    }
    
    if (!confirm(`¿Está seguro que desea eliminar permanentemente el registro de ${ticket.mascota}?`)) {
        return;
    }
    
    internamientoFirebaseRef.child(ticketKey).remove()
        .then(() => {
            showNotification('✅ Paciente eliminado exitosamente', 'success');
        })
        .catch(error => {
            console.error('❌ Error al eliminar:', error);
            showNotification('❌ Error al eliminar el paciente', 'error');
        });
}

// ========== DETALLE DEL PACIENTE ==========
let currentTicketDetail = null;

function verDetalleInternamiento(ticketKey) {
    const ticket = internamientoTickets.find(t => t.firebaseKey === ticketKey);
    
    if (!ticket) {
        showNotification('❌ Paciente no encontrado', 'error');
        return;
    }
    
    currentTicketDetail = ticket;
    
    // Llenar información general
    document.getElementById('detMascota').textContent = ticket.mascota || '-';
    document.getElementById('detIdPaciente').textContent = ticket.idPaciente || '-';
    document.getElementById('detTipoMascota').textContent = ticket.tipoMascota || '-';
    document.getElementById('detRaza').textContent = ticket.raza || '-';
    document.getElementById('detEdad').textContent = ticket.edad || '-';
    document.getElementById('detSexo').textContent = ticket.sexo || '-';
    document.getElementById('detPeso').textContent = ticket.peso ? `${ticket.peso} kg` : '-';
    
    document.getElementById('detPropietario').textContent = ticket.propietario || '-';
    document.getElementById('detCedula').textContent = ticket.cedula || '-';
    document.getElementById('detTelefono').textContent = ticket.telefono || '-';
    document.getElementById('detEmail').textContent = ticket.email || '-';
    
    document.getElementById('detMedicoEncargado').textContent = ticket.medicoEncargado || '-';
    document.getElementById('detFechaIngreso').textContent = formatFecha(ticket.fechaIngreso) + (ticket.horaIngreso ? ` - ${ticket.horaIngreso}` : '');
    document.getElementById('detDiasInternado').textContent = calcularDiasInternado(ticket.fechaIngreso) + ' días';
    document.getElementById('detEstado').textContent = getEstadoLabel(ticket.estadoPaciente || 'estable');
    document.getElementById('detDiagnostico').textContent = ticket.diagnosticoPresuntivo || '-';
    document.getElementById('detHistoriaClinica').textContent = ticket.historiaClinica || '-';
    document.getElementById('detTratamiento').textContent = ticket.tratamientoIndicado || '-';
    document.getElementById('detPadecimientos').textContent = ticket.padecimientosPrevios || '-';
    
    // Nuevos campos
    document.getElementById('detNumeroJaula').textContent = ticket.numeroJaula || '-';
    document.getElementById('detCuarto').textContent = ticket.cuarto || '-';
    
    // Ocultar modo edición si estaba visible
    ocultarModoEdicion();
    
    // Mostrar modal
    document.getElementById('modalDetalleInternamiento').style.display = 'flex';
    
    // Asegurar que el tab de información general esté activo por defecto
    cambiarTabDetalle('info');
    
    // Cargar datos de los otros tabs en background
    setTimeout(() => {
        cargarBitacora(ticketKey);
        cargarMonitoreo(ticketKey);
        cargarMedicamentos(ticketKey);
    }, 200);
}

function toggleModoEdicion() {
    const modoLectura = document.getElementById('infoModoLectura');
    const modoEdicion = document.getElementById('infoModoEdicion');
    const btnEditar = document.getElementById('btnEditarInfo');
    
    if (!currentTicketDetail) {
        showNotification('❌ No hay paciente seleccionado', 'error');
        return;
    }
    
    if (modoEdicion.style.display === 'none') {
        // Activar modo edición
        modoLectura.style.display = 'none';
        modoEdicion.style.display = 'block';
        btnEditar.innerHTML = '<i class="fas fa-times"></i> Cancelar';
        btnEditar.classList.add('btn-cancel-edit');
        
        // Llenar formulario de edición con datos actuales
        document.getElementById('editEstado').value = currentTicketDetail.estadoPaciente || 'estable';
        document.getElementById('editNumeroJaula').value = currentTicketDetail.numeroJaula || '';
        document.getElementById('editCuarto').value = currentTicketDetail.cuarto || '';
        document.getElementById('editMedicoEncargado').value = currentTicketDetail.medicoEncargado || '';
        document.getElementById('editDiagnostico').value = currentTicketDetail.diagnosticoPresuntivo || '';
        document.getElementById('editHistoriaClinica').value = currentTicketDetail.historiaClinica || '';
        document.getElementById('editTratamiento').value = currentTicketDetail.tratamientoIndicado || '';
        document.getElementById('editPadecimientos').value = currentTicketDetail.padecimientosPrevios || '';
    } else {
        // Cancelar edición
        ocultarModoEdicion();
    }
}

function ocultarModoEdicion() {
    const modoLectura = document.getElementById('infoModoLectura');
    const modoEdicion = document.getElementById('infoModoEdicion');
    const btnEditar = document.getElementById('btnEditarInfo');
    
    if (modoLectura && modoEdicion && btnEditar) {
        modoLectura.style.display = 'block';
        modoEdicion.style.display = 'none';
        btnEditar.innerHTML = '<i class="fas fa-edit"></i> Editar Información';
        btnEditar.classList.remove('btn-cancel-edit');
    }
}

function guardarEdicionInformacion() {
    if (!currentTicketDetail) {
        showNotification('❌ No hay paciente seleccionado', 'error');
        return;
    }
    
    const datosActualizados = {
        estadoPaciente: document.getElementById('editEstado').value,
        numeroJaula: document.getElementById('editNumeroJaula').value.trim(),
        cuarto: document.getElementById('editCuarto').value,
        medicoEncargado: document.getElementById('editMedicoEncargado').value.trim(),
        diagnosticoPresuntivo: document.getElementById('editDiagnostico').value.trim(),
        historiaClinica: document.getElementById('editHistoriaClinica').value.trim(),
        tratamientoIndicado: document.getElementById('editTratamiento').value.trim(),
        padecimientosPrevios: document.getElementById('editPadecimientos').value.trim(),
        fechaModificacion: new Date().toISOString(),
        modificadoPor: sessionStorage.getItem('userName') || 'Usuario'
    };
    
    const ticketRef = firebase.database().ref(`internamiento/${currentTicketDetail.firebaseKey}`);
    
    ticketRef.update(datosActualizados)
        .then(() => {
            showNotification('✅ Información actualizada exitosamente', 'success');
            
            // Actualizar el objeto local
            Object.assign(currentTicketDetail, datosActualizados);
            
            // Actualizar la vista
            document.getElementById('detEstado').textContent = getEstadoLabel(datosActualizados.estadoPaciente);
            document.getElementById('detNumeroJaula').textContent = datosActualizados.numeroJaula || '-';
            document.getElementById('detCuarto').textContent = datosActualizados.cuarto || '-';
            document.getElementById('detMedicoEncargado').textContent = datosActualizados.medicoEncargado || '-';
            document.getElementById('detDiagnostico').textContent = datosActualizados.diagnosticoPresuntivo || '-';
            document.getElementById('detHistoriaClinica').textContent = datosActualizados.historiaClinica || '-';
            document.getElementById('detTratamiento').textContent = datosActualizados.tratamientoIndicado || '-';
            document.getElementById('detPadecimientos').textContent = datosActualizados.padecimientosPrevios || '-';
            
            // Ocultar modo edición
            ocultarModoEdicion();
            
            // Recargar la lista de pacientes para reflejar cambios
            loadInternamientoTickets();
        })
        .catch(error => {
            console.error('Error al actualizar información:', error);
            showNotification('❌ Error al actualizar la información', 'error');
        });
}

function cerrarModalDetalle() {
    document.getElementById('modalDetalleInternamiento').style.display = 'none';
    currentTicketDetail = null;
}

function cambiarTabDetalle(tabName) {
    // Ocultar todos los tabs y panes
    document.querySelectorAll('.int-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.int-tab-pane').forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
    });
    
    // Activar el tab seleccionado
    const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Mostrar el contenido correspondiente
    const paneMap = {
        'info': 'tabInfo',
        'bitacora': 'tabBitacora',
        'monitoreo': 'tabMonitoreo',
        'medicamentos': 'tabMedicamentos'
    };
    
    const selectedPane = document.getElementById(paneMap[tabName]);
    if (selectedPane) {
        selectedPane.classList.add('active');
        selectedPane.style.display = 'block';
    }
    
    // Si es el tab de bitácora, cargar datos
    if (tabName === 'bitacora' && currentTicketDetail) {
        setTimeout(() => {
            cargarBitacora(currentTicketDetail.firebaseKey);
        }, 100);
    }
}

// ========== FUNCIONES DE PERMISOS ==========
function isAdmin() {
    const userRole = sessionStorage.getItem('userRole');
    return userRole === 'admin';
}

// ========== SISTEMA DE BITÁCORA ==========
let checklistItems = [];

function toggleFormularioBitacora() {
    const formulario = document.getElementById('formularioBitacora');
    const btnTexto = document.getElementById('btnTextoBitacora');
    
    if (formulario.style.display === 'none' || formulario.style.display === '') {
        formulario.style.display = 'block';
        btnTexto.textContent = 'Ocultar Formulario';
        checklistItems = [];
        document.getElementById('checklistContainer').innerHTML = '';
    } else {
        cancelarEntradaBitacora();
    }
}

function agregarItemChecklist() {
    const input = document.getElementById('nuevoChecklistItem');
    const texto = input.value.trim();
    
    if (!texto) {
        showNotification('⚠️ Escribe una tarea u observación', 'warning');
        return;
    }
    
    const itemId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    checklistItems.push({
        id: itemId,
        text: texto,
        completed: false
    });
    
    renderChecklistItems();
    input.value = '';
    input.focus();
}

function renderChecklistItems() {
    const container = document.getElementById('checklistContainer');
    
    if (checklistItems.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No hay items en el checklist. Agrega uno arriba.</div>';
        return;
    }
    
    container.innerHTML = checklistItems.map(item => `
        <div class="checklist-item ${item.completed ? 'completed' : ''}" data-item-id="${item.id}">
            <input type="checkbox" ${item.completed ? 'checked' : ''} 
                   onchange="toggleChecklistItemTemp('${item.id}')">
            <span class="checklist-item-text">${item.text}</span>
            <button class="btn-remove-item" onclick="eliminarChecklistItemTemp('${item.id}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function toggleChecklistItemTemp(itemId) {
    const item = checklistItems.find(i => i.id === itemId);
    if (item) {
        item.completed = !item.completed;
        renderChecklistItems();
    }
}

function eliminarChecklistItemTemp(itemId) {
    checklistItems = checklistItems.filter(i => i.id !== itemId);
    renderChecklistItems();
}

function guardarEntradaBitacora() {
    const descripcion = document.getElementById('bitacoraDescripcion').value.trim();
    
    if (!descripcion) {
        showNotification('⚠️ Escribe una descripción para la entrada', 'warning');
        return;
    }
    
    if (!currentTicketDetail) {
        showNotification('❌ Error: No se encontró el paciente', 'error');
        return;
    }
    
    const entrada = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        fecha: new Date().toISOString(),
        descripcion: descripcion,
        checklist: checklistItems,
        autor: localStorage.getItem('currentUser') || sessionStorage.getItem('userName') || 'Usuario',
        pacienteKey: currentTicketDetail.firebaseKey
    };
    
    // Guardar en Firebase
    const bitacoraRef = firebase.database().ref(`internamiento/${currentTicketDetail.firebaseKey}/bitacora`);
    bitacoraRef.push(entrada)
        .then(() => {
            showNotification('✅ Entrada guardada exitosamente', 'success');
            cancelarEntradaBitacora();
            cargarBitacora(currentTicketDetail.firebaseKey);
        })
        .catch(error => {
            console.error('❌ Error al guardar bitácora:', error);
            showNotification('❌ Error al guardar la entrada', 'error');
        });
}

function cancelarEntradaBitacora() {
    document.getElementById('formularioBitacora').style.display = 'none';
    document.getElementById('btnTextoBitacora').textContent = 'Nueva Entrada';
    document.getElementById('bitacoraDescripcion').value = '';
    document.getElementById('nuevoChecklistItem').value = '';
    checklistItems = [];
    document.getElementById('checklistContainer').innerHTML = '';
}

function cargarBitacora(ticketKey) {
    const container = document.getElementById('bitacoraContainer');
    
    if (!container) {
        console.error('❌ No se encontró el contenedor de bitácora');
        return;
    }
    
    // Mostrar indicador de carga
    container.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--int-primary);"></i><p>Cargando bitácora...</p></div>';
    
    const bitacoraRef = firebase.database().ref(`internamiento/${ticketKey}/bitacora`);
    
    bitacoraRef.once('value', (snapshot) => {
        const entradas = [];
        
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const entradaData = childSnapshot.val();
                entradas.push({
                    firebaseKey: childSnapshot.key,
                    ...entradaData
                });
            });
        }
        
        // Ordenar por fecha (más reciente primero)
        entradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        if (entradas.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #666;">
                    <i class="fas fa-clipboard-list" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;"></i>
                    <h3 style="margin-bottom: 12px; color: var(--int-dark);">No hay entradas en la bitácora</h3>
                    <p style="font-size: 0.95rem;">Haz clic en "Nueva Entrada" para agregar la primera entrada de seguimiento del paciente.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = entradas.map(entrada => renderEntradaBitacora(entrada, ticketKey)).join('');
    }).catch(error => {
        console.error('❌ Error al cargar bitácora:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef5350;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 16px;"></i>
                <h3>Error al cargar la bitácora</h3>
                <p>${error.message}</p>
                <button class="btn-primary" onclick="cargarBitacora('${ticketKey}')" style="margin-top: 16px;">
                    <i class="fas fa-redo"></i> Reintentar
                            </button>
            </div>
        `;
    });
}

function renderEntradaBitacora(entrada, ticketKey) {
    const fecha = new Date(entrada.fecha);
    const fechaFormateada = fecha.toLocaleDateString('es-CR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let checklistHTML = '';
    if (entrada.checklist && entrada.checklist.length > 0) {
        const completados = entrada.checklist.filter(item => item.completed).length;
        const total = entrada.checklist.length;
        const porcentaje = (completados / total) * 100;
        
        checklistHTML = `
            <div class="int-bitacora-checklist">
                <div class="int-bitacora-checklist-header">
                    <div class="int-bitacora-checklist-title">
                        <i class="fas fa-tasks"></i>
                        Checklist (${completados}/${total} completados)
                    </div>
                    <button class="btn-add-checklist-item" onclick="mostrarFormularioAgregarChecklist('${ticketKey}', '${entrada.firebaseKey}')" title="Agregar nuevo item">
                        <i class="fas fa-plus"></i>
                            </button>
                </div>
                <div class="int-bitacora-checklist-items">
                    ${entrada.checklist.map(item => `
                        <div class="int-bitacora-checklist-item ${item.completed ? 'completed' : ''}">
                            <input type="checkbox" ${item.completed ? 'checked' : ''} 
                                   onchange="toggleChecklistItem('${ticketKey}', '${entrada.firebaseKey}', '${item.id}')">
                            <span>${item.text}</span>
                            ${isAdmin() ? `<button class="btn-remove-checklist-item" onclick="eliminarItemChecklist('${ticketKey}', '${entrada.firebaseKey}', '${item.id}')" title="Eliminar item">
                                <i class="fas fa-times"></i>
                            </button>` : ''}
                        </div>
                `).join('')}
                </div>
                <div class="int-bitacora-checklist-form" id="addChecklistForm-${entrada.firebaseKey}" style="display: none;">
                    <div class="add-checklist-input-group">
                        <input type="text" id="newChecklistItem-${entrada.firebaseKey}" placeholder="Nuevo item del checklist..." 
                               onkeypress="if(event.key === 'Enter') { event.preventDefault(); agregarItemChecklistExistente('${ticketKey}', '${entrada.firebaseKey}'); }">
                        <button class="btn-save-checklist" onclick="agregarItemChecklistExistente('${ticketKey}', '${entrada.firebaseKey}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-cancel-checklist" onclick="ocultarFormularioAgregarChecklist('${entrada.firebaseKey}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="int-bitacora-stats">
                    <span>${porcentaje.toFixed(0)}% completado</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${porcentaje}%"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="int-bitacora-entry" id="entrada-${entrada.firebaseKey}">
            <div class="int-bitacora-date">
                <i class="fas fa-calendar-day"></i>
                ${fechaFormateada}
            </div>
            <div class="int-bitacora-text">
                ${entrada.descripcion.replace(/\n/g, '<br>')}
            </div>
            <div class="int-bitacora-edit-form">
                <textarea id="editDescripcion-${entrada.firebaseKey}" placeholder="Editar descripción...">${entrada.descripcion}</textarea>
                <div class="int-bitacora-edit-actions">
                    <button class="btn-cancel" onclick="cancelarEdicionBitacora('${entrada.firebaseKey}')">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button class="btn-save" onclick="guardarEdicionBitacora('${entrada.firebaseKey}', '${ticketKey}')">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                </div>
            </div>
            ${checklistHTML}
            <div class="int-bitacora-author">
                <span>Por: ${entrada.autor || 'Sistema'}</span>
                <div class="int-bitacora-actions">
                    <button class="btn-edit" onclick="editarEntradaBitacora('${entrada.firebaseKey}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    ${isAdmin() ? `<button class="btn-delete" onclick="eliminarEntradaBitacora('${entrada.firebaseKey}', '${ticketKey}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>` : ''}
                </div>
            </div>
        </div>
    `;
}

function toggleChecklistItem(ticketKey, entradaKey, itemId) {
    const bitacoraRef = firebase.database().ref(`internamiento/${ticketKey}/bitacora/${entradaKey}`);
    
    bitacoraRef.once('value', (snapshot) => {
        const entrada = snapshot.val();
        if (entrada && entrada.checklist) {
            const item = entrada.checklist.find(i => i.id === itemId);
            if (item) {
                item.completed = !item.completed;
                
                bitacoraRef.update({ checklist: entrada.checklist })
        .then(() => {
                        // Recargar para actualizar el porcentaje
                        cargarBitacora(ticketKey);
        })
        .catch(error => {
                        console.error('Error al actualizar checklist:', error);
                        showNotification('❌ Error al actualizar el item', 'error');
                    });
            }
        }
    });
}

// ========== FUNCIONES DE EDICIÓN ==========
function editarEntradaBitacora(entradaKey) {
    const entradaElement = document.getElementById(`entrada-${entradaKey}`);
    if (entradaElement) {
        entradaElement.classList.add('editing');
        const textarea = document.getElementById(`editDescripcion-${entradaKey}`);
        if (textarea) {
            textarea.focus();
            // Mover cursor al final
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    }
}

function cancelarEdicionBitacora(entradaKey) {
    const entradaElement = document.getElementById(`entrada-${entradaKey}`);
    if (entradaElement) {
        entradaElement.classList.remove('editing');
    }
}

function guardarEdicionBitacora(entradaKey, ticketKey) {
    const textarea = document.getElementById(`editDescripcion-${entradaKey}`);
    if (!textarea) {
        showNotification('❌ Error: No se encontró el campo de edición', 'error');
        return;
    }
    
    const nuevaDescripcion = textarea.value.trim();
    if (!nuevaDescripcion) {
        showNotification('⚠️ La descripción no puede estar vacía', 'warning');
        return;
    }
    
    const bitacoraRef = firebase.database().ref(`internamiento/${ticketKey}/bitacora/${entradaKey}`);
    
    bitacoraRef.update({ 
        descripcion: nuevaDescripcion,
        fechaModificacion: new Date().toISOString(),
        modificadoPor: localStorage.getItem('currentUser') || sessionStorage.getItem('userName') || 'Usuario'
    })
        .then(() => {
        showNotification('✅ Entrada actualizada exitosamente', 'success');
        cancelarEdicionBitacora(entradaKey);
        cargarBitacora(ticketKey);
        })
        .catch(error => {
        console.error('Error al actualizar entrada:', error);
        showNotification('❌ Error al actualizar la entrada', 'error');
    });
}

function eliminarEntradaBitacora(entradaKey, ticketKey) {
    // Verificar permisos de administrador
    if (!isAdmin()) {
        showNotification('❌ Solo los administradores pueden eliminar entradas', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar esta entrada de la bitácora?')) {
        return;
    }
    
    const bitacoraRef = firebase.database().ref(`internamiento/${ticketKey}/bitacora/${entradaKey}`);
    
    bitacoraRef.remove()
        .then(() => {
            showNotification('✅ Entrada eliminada exitosamente', 'success');
            cargarBitacora(ticketKey);
        })
        .catch(error => {
            console.error('Error al eliminar entrada:', error);
            showNotification('❌ Error al eliminar la entrada', 'error');
        });
}

// ========== FUNCIONES DE CHECKLIST DINÁMICO ==========
function mostrarFormularioAgregarChecklist(ticketKey, entradaKey) {
    const form = document.getElementById(`addChecklistForm-${entradaKey}`);
    const input = document.getElementById(`newChecklistItem-${entradaKey}`);
    
    if (form && input) {
        form.style.display = 'block';
        input.focus();
    }
}

function ocultarFormularioAgregarChecklist(entradaKey) {
    const form = document.getElementById(`addChecklistForm-${entradaKey}`);
    const input = document.getElementById(`newChecklistItem-${entradaKey}`);
    
    if (form && input) {
        form.style.display = 'none';
        input.value = '';
    }
}

function agregarItemChecklistExistente(ticketKey, entradaKey) {
    const input = document.getElementById(`newChecklistItem-${entradaKey}`);
    if (!input) {
        showNotification('❌ Error: No se encontró el campo de entrada', 'error');
        return;
    }
    
    const texto = input.value.trim();
    if (!texto) {
        showNotification('⚠️ Escribe un item para agregar al checklist', 'warning');
        return;
    }
    
    const bitacoraRef = firebase.database().ref(`internamiento/${ticketKey}/bitacora/${entradaKey}`);
    
    bitacoraRef.once('value', (snapshot) => {
        const entrada = snapshot.val();
        if (entrada && entrada.checklist) {
            const nuevoItem = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                text: texto,
                completed: false
            };
            
            entrada.checklist.push(nuevoItem);
            
            bitacoraRef.update({ checklist: entrada.checklist })
                .then(() => {
                    showNotification('✅ Item agregado al checklist', 'success');
                    input.value = '';
                    ocultarFormularioAgregarChecklist(entradaKey);
                    cargarBitacora(ticketKey);
                })
                .catch(error => {
                    console.error('Error al agregar item:', error);
                    showNotification('❌ Error al agregar el item', 'error');
                });
        }
    });
}

function eliminarItemChecklist(ticketKey, entradaKey, itemId) {
    // Verificar permisos de administrador
    if (!isAdmin()) {
        showNotification('❌ Solo los administradores pueden eliminar items del checklist', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar este item del checklist?')) {
        return;
    }
    
    const bitacoraRef = firebase.database().ref(`internamiento/${ticketKey}/bitacora/${entradaKey}`);
    
    bitacoraRef.once('value', (snapshot) => {
        const entrada = snapshot.val();
        if (entrada && entrada.checklist) {
            entrada.checklist = entrada.checklist.filter(item => item.id !== itemId);
            
            bitacoraRef.update({ checklist: entrada.checklist })
                .then(() => {
                    showNotification('✅ Item eliminado del checklist', 'success');
                    cargarBitacora(ticketKey);
                })
                .catch(error => {
                    console.error('Error al eliminar item:', error);
                    showNotification('❌ Error al eliminar el item', 'error');
                });
        }
    });
}

// ========== SISTEMA DE MONITOREO ==========
function toggleFormularioMonitoreo() {
    const formulario = document.getElementById('formularioMonitoreo');
    const btnTexto = document.getElementById('btnTextoMonitoreo');
    
    if (formulario.style.display === 'none' || formulario.style.display === '') {
        formulario.style.display = 'block';
        btnTexto.textContent = 'Ocultar Formulario';
        // Establecer fecha actual
        document.getElementById('monFecha').valueAsDate = new Date();
    } else {
        cancelarTurnoMonitoreo();
    }
}

function cancelarTurnoMonitoreo() {
    document.getElementById('formularioMonitoreo').style.display = 'none';
    document.getElementById('btnTextoMonitoreo').textContent = 'Nuevo Turno';
    document.getElementById('turnoMonitoreoForm').reset();
}

function guardarTurnoMonitoreo() {
    if (!currentTicketDetail) {
        showNotification('❌ Error: No se encontró el paciente', 'error');
        return;
    }
    
    // Obtener valores del formulario
    const turno = document.getElementById('monTurno').value;
    const fecha = document.getElementById('monFecha').value;
    
    if (!turno || !fecha) {
        showNotification('⚠️ Complete al menos el turno y la fecha', 'warning');
        return;
    }
    
    // Obtener valores de radio buttons
    const getRadioValue = (name) => {
        const selected = document.querySelector(`input[name="${name}"]:checked`);
        return selected ? selected.value : '';
    };
    
    const turnoData = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        fecha: fecha,
        turno: turno,
        peso: document.getElementById('monPeso').value || '',
        
        // Signos vitales
        fc: document.getElementById('monFC').value || '',
        temp: document.getElementById('monTemp').value || '',
        mucosas: document.getElementById('monMucosas').value || '',
        fr: document.getElementById('monFR').value || '',
        tllc: document.getElementById('monTLLC').value || '',
        deshidratacion: document.getElementById('monDeshidratacion').value || '',
        
        // Estado
        estado: getRadioValue('monEstado'),
        nivelDolor: getRadioValue('monDolor'),
        
        // Fluidoterapia
        fluidoterapia: getRadioValue('monFluidoterapia'),
        fluidoterapiaTipo: document.getElementById('monFluidoterapiaTipo').value || '',
        fluidoterapiaFrec: document.getElementById('monFluidoterapiaFrec').value || '',
        
        // Ingesta y eliminación
        ingAgua: getRadioValue('monIngAgua'),
        apetito: getRadioValue('monApetito'),
        apetitoCantidad: document.getElementById('monApetitoCantidad').value || '',
        diarreas: getRadioValue('monDiarreas'),
        diarreasDesc: document.getElementById('monDiarreasDesc').value || '',
        vomitos: getRadioValue('monVomitos'),
        vomitosDesc: document.getElementById('monVomitosDesc').value || '',
        
        // Notas
        notas: document.getElementById('monNotas').value || '',
        
        // Metadatos
        registradoPor: localStorage.getItem('currentUser') || sessionStorage.getItem('userName') || 'Usuario',
        fechaRegistro: new Date().toISOString()
    };
    
    const monitoreoRef = firebase.database().ref(`internamiento/${currentTicketDetail.firebaseKey}/monitoreo`);
    monitoreoRef.push(turnoData)
        .then(() => {
            showNotification('✅ Turno de monitoreo registrado exitosamente', 'success');
            cancelarTurnoMonitoreo();
            cargarMonitoreo(currentTicketDetail.firebaseKey);
        })
        .catch(error => {
            console.error('Error al guardar monitoreo:', error);
            showNotification('❌ Error al guardar el turno', 'error');
        });
}

function cargarMonitoreo(ticketKey) {
    const container = document.getElementById('monitoreoContainer');
    
    // Mostrar indicador de carga
    container.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--int-primary);"></i><p>Cargando monitoreo...</p></div>';
    
    const monitoreoRef = firebase.database().ref(`internamiento/${ticketKey}/monitoreo`);
    
    monitoreoRef.once('value', (snapshot) => {
        const turnos = [];
        
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                turnos.push({
                    firebaseKey: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
        }
        
        // Ordenar por fecha y turno
        turnos.sort((a, b) => {
            const fechaCompare = b.fecha.localeCompare(a.fecha);
            if (fechaCompare !== 0) return fechaCompare;
            
            const turnoOrder = { 'mañana': 1, 'tarde': 2, 'noche': 3 };
            return (turnoOrder[b.turno] || 0) - (turnoOrder[a.turno] || 0);
        });
        
        if (turnos.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #666;">
                    <i class="fas fa-heartbeat" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;"></i>
                    <h3 style="margin-bottom: 12px; color: var(--int-dark);">No hay turnos de monitoreo registrados</h3>
                    <p style="font-size: 0.95rem;">Haz clic en "Nuevo Turno" para registrar el primer turno de monitoreo del paciente.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = turnos.map(turno => renderTurnoMonitoreo(turno, ticketKey)).join('');
    }).catch(error => {
        console.error('Error al cargar monitoreo:', error);
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #ef5350;">❌ Error al cargar el monitoreo</div>';
    });
}

function renderTurnoMonitoreo(turno, ticketKey) {
    const fecha = new Date(turno.fecha);
    const fechaFormateada = fecha.toLocaleDateString('es-CR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const turnoIcon = {
        'mañana': '☀️',
        'tarde': '🌤️',
        'noche': '🌙'
    };
    
    const turnoColor = {
        'mañana': '#ff9800',
        'tarde': '#2196f3',
        'noche': '#673ab7'
    };
    
    return `
        <div class="int-monitoreo-card" style="border-left-color: ${turnoColor[turno.turno] || '#999'};">
            <div class="int-monitoreo-header-card">
                <div class="int-monitoreo-title">
                    <span class="turno-icon">${turnoIcon[turno.turno] || '🕐'}</span>
                    <div>
                        <h4>Turno: ${turno.turno.charAt(0).toUpperCase() + turno.turno.slice(1)}</h4>
                        <p class="monitoreo-fecha">${fechaFormateada}</p>
                            </div>
                            </div>
                <div class="int-monitoreo-actions">
                    ${isAdmin() ? `<button class="btn-delete-small" onclick="eliminarTurnoMonitoreo('${turno.firebaseKey}', '${ticketKey}')" title="Eliminar turno">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                            </div>
                            </div>
            
            <div class="int-monitoreo-content">
                ${turno.peso ? `<div class="monitoreo-item"><strong>Peso:</strong> ${turno.peso} kg</div>` : ''}
                
                <!-- Signos Vitales -->
                <div class="monitoreo-section">
                    <h5><i class="fas fa-heartbeat"></i> Signos Vitales</h5>
                    <div class="monitoreo-grid">
                        ${turno.fc ? `<div class="monitoreo-item"><span class="label">FC:</span> <span>${turno.fc} lpm</span></div>` : ''}
                        ${turno.temp ? `<div class="monitoreo-item"><span class="label">Temp:</span> <span>${turno.temp}°C</span></div>` : ''}
                        ${turno.mucosas ? `<div class="monitoreo-item"><span class="label">Mucosas:</span> <span>${turno.mucosas}</span></div>` : ''}
                        ${turno.fr ? `<div class="monitoreo-item"><span class="label">FR:</span> <span>${turno.fr} rpm</span></div>` : ''}
                        ${turno.tllc ? `<div class="monitoreo-item"><span class="label">TLLC:</span> <span>${turno.tllc} seg</span></div>` : ''}
                        ${turno.deshidratacion ? `<div class="monitoreo-item"><span class="label">Deshidratación:</span> <span>${turno.deshidratacion}%</span></div>` : ''}
                            </div>
                            </div>
                
                <!-- Estado -->
                ${turno.estado || turno.nivelDolor ? `
                <div class="monitoreo-section">
                    <h5><i class="fas fa-user-md"></i> Estado General</h5>
                    <div class="monitoreo-grid">
                        ${turno.estado ? `<div class="monitoreo-item"><span class="label">Estado:</span> <span class="badge badge-${turno.estado}">${turno.estado.charAt(0).toUpperCase() + turno.estado.slice(1)}</span></div>` : ''}
                        ${turno.nivelDolor ? `<div class="monitoreo-item"><span class="label">Dolor:</span> <span class="badge badge-dolor-${turno.nivelDolor}">${turno.nivelDolor.replace('_', ' ').charAt(0).toUpperCase() + turno.nivelDolor.slice(1).replace('_', ' ')}</span></div>` : ''}
                            </div>
                            </div>
                ` : ''}
                
                <!-- Fluidoterapia -->
                ${turno.fluidoterapia === 'si' ? `
                <div class="monitoreo-section">
                    <h5><i class="fas fa-tint"></i> Fluidoterapia</h5>
                    <div class="monitoreo-grid">
                        ${turno.fluidoterapiaTipo ? `<div class="monitoreo-item"><span class="label">Tipo:</span> <span>${turno.fluidoterapiaTipo}</span></div>` : ''}
                        ${turno.fluidoterapiaFrec ? `<div class="monitoreo-item"><span class="label">Frecuencia:</span> <span>${turno.fluidoterapiaFrec}</span></div>` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Ingesta y Eliminación -->
                <div class="monitoreo-section">
                    <h5><i class="fas fa-utensils"></i> Ingesta y Eliminación</h5>
                    <div class="monitoreo-grid">
                        ${turno.ingAgua ? `<div class="monitoreo-item"><span class="label">Agua:</span> <span>${turno.ingAgua === 'si' ? '✅ SI' : '❌ NO'}</span></div>` : ''}
                        ${turno.apetito ? `<div class="monitoreo-item"><span class="label">Apetito:</span> <span>${turno.apetito === 'si' ? '✅ SI' : '❌ NO'}</span></div>` : ''}
                        ${turno.apetitoCantidad ? `<div class="monitoreo-item"><span class="label">Cantidad:</span> <span>${turno.apetitoCantidad}</span></div>` : ''}
                        ${turno.diarreas ? `<div class="monitoreo-item"><span class="label">Diarreas:</span> <span>${turno.diarreas === 'si' ? '⚠️ SI' : '✅ NO'}</span></div>` : ''}
                        ${turno.diarreasDesc ? `<div class="monitoreo-item"><span class="label">Desc:</span> <span>${turno.diarreasDesc}</span></div>` : ''}
                        ${turno.vomitos ? `<div class="monitoreo-item"><span class="label">Vómitos:</span> <span>${turno.vomitos === 'si' ? '⚠️ SI' : '✅ NO'}</span></div>` : ''}
                        ${turno.vomitosDesc ? `<div class="monitoreo-item"><span class="label">Desc:</span> <span>${turno.vomitosDesc}</span></div>` : ''}
                        </div>
                    </div>
                    
                <!-- Notas -->
                ${turno.notas ? `
                <div class="monitoreo-section">
                    <h5><i class="fas fa-sticky-note"></i> Notas del Turno</h5>
                    <p class="monitoreo-notas">${turno.notas}</p>
                        </div>
                ` : ''}
                
                <div class="monitoreo-footer">
                    <small>Registrado por: ${turno.registradoPor} - ${new Date(turno.fechaRegistro).toLocaleString('es-CR')}</small>
                </div>
                </div>
            </div>
        `;
}

function eliminarTurnoMonitoreo(turnoKey, ticketKey) {
    if (!isAdmin()) {
        showNotification('❌ Solo los administradores pueden eliminar turnos', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar este turno de monitoreo?')) {
        return;
    }
    
    const monitoreoRef = firebase.database().ref(`internamiento/${ticketKey}/monitoreo/${turnoKey}`);
    
    monitoreoRef.remove()
        .then(() => {
            showNotification('✅ Turno eliminado exitosamente', 'success');
            cargarMonitoreo(ticketKey);
        })
        .catch(error => {
            console.error('Error al eliminar turno:', error);
            showNotification('❌ Error al eliminar el turno', 'error');
        });
}

function cargarMonitoreoLegacy(ticketKey) {
    const container = document.getElementById('monitoreoContainer');
    
    // Ejemplo de cómo se verían los datos de monitoreo
    const diasEjemplo = calcularDiasInternado(currentTicketDetail?.fechaIngreso || new Date());
    
    let html = '';
    for (let i = 0; i < Math.min(diasEjemplo, 3); i++) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - i);
        
        html += `
            <div class="int-monitoreo-day">
                <div class="int-monitoreo-day-title">
                    <i class="fas fa-calendar"></i>
                    Día ${diasEjemplo - i} - ${fecha.toLocaleDateString('es-CR')}
                </div>
                <div class="int-monitoreo-grid">
                    <div class="int-monitoreo-card">
                        <div class="int-monitoreo-icon">🌡️</div>
                        <div class="int-monitoreo-label">Temperatura</div>
                        <div class="int-monitoreo-value">${(38 + Math.random()).toFixed(1)}°C</div>
                    </div>
                    <div class="int-monitoreo-card">
                        <div class="int-monitoreo-icon">💓</div>
                        <div class="int-monitoreo-label">Frecuencia Cardíaca</div>
                        <div class="int-monitoreo-value">${Math.floor(80 + Math.random() * 20)} bpm</div>
                    </div>
                    <div class="int-monitoreo-card">
                        <div class="int-monitoreo-icon">🫁</div>
                        <div class="int-monitoreo-label">Frecuencia Respiratoria</div>
                        <div class="int-monitoreo-value">${Math.floor(20 + Math.random() * 10)} rpm</div>
                    </div>
                    <div class="int-monitoreo-card">
                        <div class="int-monitoreo-icon">⚖️</div>
                        <div class="int-monitoreo-label">Peso</div>
                        <div class="int-monitoreo-value">${currentTicketDetail?.peso || '0'} kg</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html + `
        <div style="text-align: center; padding: 40px; color: #666; margin-top: 24px;">
            <i class="fas fa-heartbeat" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.3;"></i>
            <p>Los datos de monitoreo mostrados son ejemplos. La integración completa se implementará próximamente.</p>
        </div>
    `;
}

function cargarMedicamentos(ticketKey) {
    const container = document.getElementById('medicamentosContainer');
    
    if (!container) {
        console.error('Container de medicamentos no encontrado');
        return;
    }
    
    // Mostrar indicador de carga
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--int-primary);"></i>
            <p style="margin-top: 16px; color: #666;">Cargando medicamentos...</p>
        </div>
    `;
    
    const medicamentosRef = firebase.database().ref(`internamiento/${ticketKey}/medicamentos`);
    
    medicamentosRef.once('value', (snapshot) => {
        const data = snapshot.val();
        
        // Header con botón para agregar
        let html = `
            <div class="int-medicamentos-header">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h3><i class="fas fa-pills"></i> Medicamentos Prescritos</h3>
                    <button class="btn-primary" onclick="toggleFormularioMedicamento()" style="padding: 8px 16px; font-size: 0.9rem;">
                        <i class="fas fa-plus"></i> Agregar Medicamento
                    </button>
                </div>
            </div>
        `;
        
        // Formulario para agregar medicamentos (inicialmente oculto)
        html += `
            <div id="formularioMedicamento" class="int-medicamento-form" style="display: none;">
                <h4><i class="fas fa-prescription-bottle-alt"></i> Nuevo Medicamento</h4>
                <div class="int-form-grid">
                    <div class="int-form-group">
                        <label for="medMedicamento"><i class="fas fa-pills"></i> Medicamento *</label>
                        <input type="text" id="medMedicamento" placeholder="Nombre del medicamento" required>
                    </div>
                    <div class="int-form-group">
                        <label for="medDosis"><i class="fas fa-prescription-bottle"></i> Dosis *</label>
                        <input type="text" id="medDosis" placeholder="Ej: 10mg, 2ml" required>
                    </div>
                    <div class="int-form-group">
                        <label for="medVia"><i class="fas fa-syringe"></i> Vía de Administración *</label>
                        <select id="medVia" required>
                            <option value="">Seleccionar vía</option>
                            <option value="Oral">Oral</option>
                            <option value="Intravenosa">Intravenosa (IV)</option>
                            <option value="Intramuscular">Intramuscular (IM)</option>
                            <option value="Subcutánea">Subcutánea (SC)</option>
                            <option value="Tópica">Tópica</option>
                            <option value="Oftálmica">Oftálmica</option>
                            <option value="Ótica">Ótica</option>
                            <option value="Rectal">Rectal</option>
                        </select>
                    </div>
                    <div class="int-form-group">
                        <label for="medFrecuencia"><i class="fas fa-clock"></i> Frecuencia *</label>
                        <input type="text" id="medFrecuencia" placeholder="Ej: Cada 8 horas, 2 veces al día" required>
                    </div>
                    <div class="int-form-group">
                        <label for="medDuracion"><i class="fas fa-calendar"></i> Duración</label>
                        <input type="text" id="medDuracion" placeholder="Ej: 7 días, hasta mejoría">
                    </div>
                    <div class="int-form-group int-form-full">
                        <label for="medObservaciones"><i class="fas fa-notes-medical"></i> Observaciones</label>
                        <textarea id="medObservaciones" rows="3" placeholder="Instrucciones especiales..."></textarea>
                    </div>
                </div>
                <div class="int-form-actions">
                    <button class="btn-cancel" onclick="cancelarMedicamento()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button class="btn-save" onclick="guardarMedicamento('${ticketKey}')">
                        <i class="fas fa-save"></i> Guardar Medicamento
                    </button>
                </div>
            </div>
        `;
        
        // Lista de medicamentos
        if (!data || Object.keys(data).length === 0) {
            html += `
                <div class="int-empty-state">
                    <i class="fas fa-pills"></i>
                    <p>No hay medicamentos registrados</p>
                    <small>Agrega el primer medicamento para este paciente</small>
                </div>
            `;
    } else {
            html += '<div class="int-medicamentos-grid">';
            
            Object.keys(data).forEach(key => {
                const med = data[key];
                const esAdmin = isAdmin();
                
                html += `
                    <div class="int-medicamento-card">
                        <div class="int-medicamento-header">
                            <div class="int-medicamento-name">
                                <i class="fas fa-prescription-bottle"></i>
                                ${med.medicamento}
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <span class="int-badge int-badge-active">Activo</span>
                                ${esAdmin ? `
                                    <button class="btn-icon btn-danger" onclick="eliminarMedicamentoPaciente('${ticketKey}', '${key}')" title="Eliminar medicamento" style="padding: 4px 8px; font-size: 0.85rem;">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        <div class="int-medicamento-details">
                            <div class="int-medicamento-detail">
                                <span class="int-detail-label">Dosis</span>
                                <span class="int-detail-value">${med.dosis}</span>
                            </div>
                            <div class="int-medicamento-detail">
                                <span class="int-detail-label">Vía</span>
                                <span class="int-detail-value">${med.via}</span>
                            </div>
                            <div class="int-medicamento-detail">
                                <span class="int-detail-label">Frecuencia</span>
                                <span class="int-detail-value">${med.frecuencia}</span>
                            </div>
                            ${med.duracion ? `
                                <div class="int-medicamento-detail">
                                    <span class="int-detail-label">Duración</span>
                                    <span class="int-detail-value">${med.duracion}</span>
                                </div>
                            ` : ''}
                            ${med.observaciones ? `
                                <div class="int-medicamento-detail">
                                    <span class="int-detail-label">Observaciones</span>
                                    <span class="int-detail-value">${med.observaciones}</span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="int-medicamento-footer">
                            <small style="color: #888;">
                                <i class="fas fa-user"></i> ${med.agregadoPor || 'Usuario'} • 
                                <i class="fas fa-calendar"></i> ${formatDate(med.fechaAgregado)}
                            </small>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
        }
        
        container.innerHTML = html;
    }).catch(error => {
        console.error('Error al cargar medicamentos:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #e74c3c;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 16px;"></i>
                <p>Error al cargar los medicamentos</p>
            </div>
        `;
    });
}

function toggleFormularioMedicamento() {
    const form = document.getElementById('formularioMedicamento');
    if (form) {
        if (form.style.display === 'none') {
            form.style.display = 'block';
            form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
            form.style.display = 'none';
        }
    }
}

function cancelarMedicamento() {
    const form = document.getElementById('formularioMedicamento');
    if (form) {
        form.style.display = 'none';
    }
    limpiarFormularioMedicamentoModal();
}

function limpiarFormularioMedicamentoModal() {
    document.getElementById('medMedicamento').value = '';
    document.getElementById('medDosis').value = '';
    document.getElementById('medVia').value = '';
    document.getElementById('medFrecuencia').value = '';
    document.getElementById('medDuracion').value = '';
    document.getElementById('medObservaciones').value = '';
}

function guardarMedicamento(ticketKey) {
    const medicamento = document.getElementById('medMedicamento').value.trim();
    const dosis = document.getElementById('medDosis').value.trim();
    const via = document.getElementById('medVia').value;
    const frecuencia = document.getElementById('medFrecuencia').value.trim();
    const duracion = document.getElementById('medDuracion').value.trim();
    const observaciones = document.getElementById('medObservaciones').value.trim();
    
    if (!medicamento || !dosis || !via || !frecuencia) {
        showNotification('⚠️ Por favor completa los campos obligatorios', 'warning');
        return;
    }
    
    const nuevoMedicamento = {
        medicamento,
        dosis,
        via,
        frecuencia,
        duracion,
        observaciones,
        fechaAgregado: new Date().toISOString(),
        agregadoPor: sessionStorage.getItem('userName') || 'Usuario'
    };
    
    const medicamentosRef = firebase.database().ref(`internamiento/${ticketKey}/medicamentos`);
    
    medicamentosRef.push(nuevoMedicamento)
        .then(() => {
            showNotification('✅ Medicamento agregado exitosamente', 'success');
            limpiarFormularioMedicamentoModal();
            cancelarMedicamento();
            cargarMedicamentos(ticketKey);
        })
        .catch(error => {
            console.error('Error al guardar medicamento:', error);
            showNotification('❌ Error al guardar el medicamento', 'error');
        });
}

function eliminarMedicamentoPaciente(ticketKey, medicamentoKey) {
    if (!isAdmin()) {
        showNotification('❌ Solo los administradores pueden eliminar medicamentos', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar este medicamento?')) {
        return;
    }
    
    const medicamentoRef = firebase.database().ref(`internamiento/${ticketKey}/medicamentos/${medicamentoKey}`);
    
    medicamentoRef.remove()
        .then(() => {
            showNotification('✅ Medicamento eliminado correctamente', 'success');
            cargarMedicamentos(ticketKey);
        })
        .catch(error => {
            console.error('Error al eliminar medicamento:', error);
            showNotification('❌ Error al eliminar el medicamento', 'error');
        });
}

function imprimirDetalleInternamiento() {
    if (!currentTicketDetail) {
        showNotification('❌ No hay paciente seleccionado', 'error');
        return;
    }
    
    const ticket = currentTicketDetail;
    
    // Crear ventana de impresión
    const printWindow = window.open('', '_blank', 'width=900,height=600');
    
    // Obtener datos de bitácora, monitoreo y medicamentos
    const bitacoraRef = firebase.database().ref(`internamiento/${ticket.firebaseKey}/bitacora`);
    const medicamentosRef = firebase.database().ref(`internamiento/${ticket.firebaseKey}/medicamentos`);
    
    Promise.all([
        bitacoraRef.once('value'),
        medicamentosRef.once('value')
    ]).then(([bitacoraSnapshot, medicamentosSnapshot]) => {
        const bitacoraData = bitacoraSnapshot.val() || {};
        const medicamentosData = medicamentosSnapshot.val() || {};
        
        // Generar HTML de impresión
        const htmlContent = generarHTMLImpresion(ticket, bitacoraData, medicamentosData);
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Esperar a que cargue y luego imprimir
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.print();
            }, 250);
        };
        
        showNotification('🖨️ Preparando impresión...', 'info');
    }).catch(error => {
        console.error('Error al obtener datos para impresión:', error);
        showNotification('❌ Error al preparar la impresión', 'error');
    });
}

function generarHTMLImpresion(ticket, bitacoraData, medicamentosData) {
    const fechaActual = new Date().toLocaleDateString('es-CR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // HTML de bitácora
    let bitacoraHTML = '';
    if (Object.keys(bitacoraData).length > 0) {
        bitacoraHTML = '<div class="seccion"><h3>📋 Bitácora de Seguimiento</h3>';
        Object.keys(bitacoraData).forEach(key => {
            const entrada = bitacoraData[key];
            bitacoraHTML += `
                <div class="bitacora-entrada">
                    <div class="bitacora-fecha">${formatDate(entrada.fecha)} - ${entrada.autor || 'Usuario'}</div>
                    <div class="bitacora-descripcion">${(entrada.descripcion || '').replace(/\n/g, '<br>')}</div>
                    ${entrada.checklist && entrada.checklist.length > 0 ? `
                        <div class="bitacora-checklist">
                            <strong>Checklist:</strong>
                            <ul>
                                ${entrada.checklist.map(item => `
                                    <li style="text-decoration: ${item.completed ? 'line-through' : 'none'}">
                                        ${item.completed ? '✓' : '○'} ${item.text}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        bitacoraHTML += '</div>';
    }
    
    // HTML de medicamentos
    let medicamentosHTML = '';
    if (Object.keys(medicamentosData).length > 0) {
        medicamentosHTML = '<div class="seccion"><h3>💊 Medicamentos Prescritos</h3><table class="tabla-medicamentos">';
        medicamentosHTML += '<thead><tr><th>Medicamento</th><th>Dosis</th><th>Vía</th><th>Frecuencia</th><th>Duración</th></tr></thead><tbody>';
        Object.keys(medicamentosData).forEach(key => {
            const med = medicamentosData[key];
            medicamentosHTML += `
                <tr>
                    <td>${med.medicamento}</td>
                    <td>${med.dosis}</td>
                    <td>${med.via}</td>
                    <td>${med.frecuencia}</td>
                    <td>${med.duracion || '-'}</td>
                </tr>
            `;
        });
        medicamentosHTML += '</tbody></table></div>';
    }
    
    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Detalle de Internamiento - ${ticket.mascota}</title>
            <style>
                @media print {
                    @page {
                        margin: 1cm;
                        size: letter;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 20px;
                    background: white;
                    color: #333;
                    line-height: 1.6;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 3px solid #4285f4;
                }
                
                .header h1 {
                    color: #4285f4;
                    font-size: 28px;
                    margin-bottom: 10px;
                }
                
                .header .clinica {
                    font-size: 20px;
                    font-weight: 600;
                    color: #666;
                    margin-bottom: 5px;
                }
                
                .header .fecha-impresion {
                    font-size: 14px;
                    color: #888;
                }
                
                .seccion {
                    margin-bottom: 30px;
                    page-break-inside: avoid;
                }
                
                .seccion h3 {
                    background: #4285f4;
                    color: white;
                    padding: 12px 15px;
                    border-radius: 5px;
                    margin-bottom: 15px;
                    font-size: 18px;
                }
                
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    margin-bottom: 20px;
                }
                
                .info-item {
                    display: flex;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 5px;
                    border-left: 3px solid #4285f4;
                }
                
                .info-item .label {
                    font-weight: 700;
                    color: #555;
                    min-width: 150px;
                }
                
                .info-item .value {
                    color: #333;
                    flex: 1;
                }
                
                .estado-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 600;
                }
                
                .estado-estable { background: #e8f5e9; color: #2e7d32; }
                .estado-critico { background: #ffebee; color: #c62828; }
                .estado-observacion { background: #fff3e0; color: #ef6c00; }
                .estado-mejorando { background: #e3f2fd; color: #1565c0; }
                
                .bitacora-entrada {
                    background: #f8f9fa;
                    padding: 15px;
                    margin-bottom: 15px;
                    border-radius: 5px;
                    border-left: 4px solid #34a853;
                }
                
                .bitacora-fecha {
                    font-weight: 700;
                    color: #4285f4;
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                
                .bitacora-descripcion {
                    margin-bottom: 10px;
                    color: #333;
                    line-height: 1.8;
                }
                
                .bitacora-checklist {
                    margin-top: 10px;
                    padding-left: 10px;
                }
                
                .bitacora-checklist ul {
                    margin-top: 5px;
                    padding-left: 20px;
                }
                
                .bitacora-checklist li {
                    margin: 5px 0;
                }
                
                .tabla-medicamentos {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                }
                
                .tabla-medicamentos th {
                    background: #4285f4;
                    color: white;
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                }
                
                .tabla-medicamentos td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .tabla-medicamentos tbody tr:nth-child(even) {
                    background: #f8f9fa;
                }
                
                .footer {
                    margin-top: 50px;
                    padding-top: 20px;
                    border-top: 2px solid #e0e0e0;
                    text-align: center;
                    color: #888;
                    font-size: 12px;
                }
                
                @media print {
                    .bitacora-entrada {
                        page-break-inside: avoid;
                    }
                    
                    .seccion {
                        page-break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="clinica">Veterinaria San Martín de Porres</div>
                <h1>📋 Ficha de Internamiento</h1>
                <div class="fecha-impresion">Impreso el: ${fechaActual}</div>
            </div>
            
            <div class="seccion">
                <h3>🐾 Información del Paciente</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="label">Mascota:</span>
                        <span class="value">${ticket.mascota || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">ID Paciente:</span>
                        <span class="value">${ticket.idPaciente || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Tipo:</span>
                        <span class="value">${ticket.tipoMascota || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Raza:</span>
                        <span class="value">${ticket.raza || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Edad:</span>
                        <span class="value">${ticket.edad || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Sexo:</span>
                        <span class="value">${ticket.sexo || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Peso:</span>
                        <span class="value">${ticket.peso ? ticket.peso + ' kg' : '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Temperatura:</span>
                        <span class="value">${ticket.temperatura ? ticket.temperatura + '°C' : '-'}</span>
                    </div>
                </div>
            </div>
            
            <div class="seccion">
                <h3>👤 Información del Propietario</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="label">Propietario:</span>
                        <span class="value">${ticket.propietario || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Cédula:</span>
                        <span class="value">${ticket.cedula || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Teléfono:</span>
                        <span class="value">${ticket.telefono || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Email:</span>
                        <span class="value">${ticket.email || '-'}</span>
                    </div>
                </div>
            </div>
            
            <div class="seccion">
                <h3>🩺 Información Médica</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="label">Médico Encargado:</span>
                        <span class="value">${ticket.medicoEncargado || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Fecha de Ingreso:</span>
                        <span class="value">${formatFecha(ticket.fechaIngreso)}${ticket.horaIngreso ? ' - ' + ticket.horaIngreso : ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Días Internado:</span>
                        <span class="value">${calcularDiasInternado(ticket.fechaIngreso)} días</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Estado:</span>
                        <span class="value">
                            <span class="estado-badge estado-${getEstadoClass(ticket.estadoPaciente || 'estable').replace('status-', 'estado-')}">
                                ${getEstadoLabel(ticket.estadoPaciente || 'estable')}
                            </span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="label">Número de Jaula:</span>
                        <span class="value">${ticket.numeroJaula || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Cuarto:</span>
                        <span class="value">${ticket.cuarto || '-'}</span>
                    </div>
                </div>
                
                <div class="info-item" style="margin-top: 15px;">
                    <span class="label">Diagnóstico Presuntivo:</span>
                    <span class="value">${ticket.diagnosticoPresuntivo || '-'}</span>
                </div>
                
                ${ticket.historiaClinica ? `
                    <div class="info-item" style="margin-top: 10px;">
                        <span class="label">Historia Clínica:</span>
                        <span class="value">${ticket.historiaClinica}</span>
                    </div>
                ` : ''}
                
                ${ticket.tratamientoIndicado ? `
                    <div class="info-item" style="margin-top: 10px;">
                        <span class="label">Tratamiento Indicado:</span>
                        <span class="value">${ticket.tratamientoIndicado}</span>
                    </div>
                ` : ''}
                
                ${ticket.padecimientosPrevios ? `
                    <div class="info-item" style="margin-top: 10px;">
                        <span class="label">Padecimientos Previos:</span>
                        <span class="value">${ticket.padecimientosPrevios}</span>
                    </div>
                ` : ''}
            </div>
            
            ${bitacoraHTML}
            ${medicamentosHTML}
            
            <div class="footer">
                <p>Veterinaria San Martín de Porres - Sistema de Gestión de Internamiento</p>
                <p>Este documento es confidencial y contiene información médica sensible.</p>
            </div>
        </body>
        </html>
    `;
}

function filtrarMonitoreoPorFecha() {
    showNotification('🔍 Filtro de monitoreo en desarrollo', 'info');
}

// ========== FUNCIONES AUXILIARES ==========
function generateInternamientoId() {
    return 'INT_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function setInternamientoCurrentDate() {
    const dateInputs = document.querySelectorAll('#internamientoForm input[type="date"]');
    const today = new Date().toISOString().split('T')[0];
    dateInputs.forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
}

function calcularDiasInternado(fechaIngreso) {
    if (!fechaIngreso) return 0;
    const fecha = new Date(fechaIngreso);
    const hoy = new Date();
    const diff = hoy - fecha;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getEstadoClass(estado) {
    const estados = {
        'estable': 'status-estable',
        'critico': 'status-critico',
        'observacion': 'status-observacion',
        'mejorando': 'status-mejorando',
        'alta': 'status-alta'
    };
    return estados[estado] || 'status-estable';
}

function getEstadoLabel(estado) {
    const labels = {
        'estable': 'Estable',
        'critico': 'Crítico',
        'observacion': 'En Observación',
        'mejorando': 'Mejorando',
        'alta': 'De Alta'
    };
    return labels[estado] || 'Estable';
}

function formatFecha(fecha) {
    if (!fecha) return 'N/A';
    
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        const [year, month, day] = fecha.split('-');
        return `${day}/${month}/${year}`;
    }
    
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return 'N/A';
    
    return date.toLocaleDateString('es-CR');
}

function showNotification(message, type) {
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
        if (type === 'error') {
            alert('❌ ' + message);
        } else if (type === 'success') {
            alert('✅ ' + message);
        }
    }
}

// ========== FUNCIÓN PARA REINICIALIZAR BÚSQUEDA ==========
window.reinicializarBusquedaInternamiento = function() {
    // Recargar tickets si es necesario
    if (ticketsConsulta.length === 0 && window.tickets && window.tickets.length > 0) {
        ticketsConsulta = [...window.tickets];
    }
    
    // Reconfigurar eventos de búsqueda
    setupBusquedaClientesMejorada();
};

// ========== FUNCIÓN DE DEBUGGING ==========
window.probarBusquedaManual = function(query = 'koba') {
    const searchInput = document.getElementById('intClienteSearch');
    if (searchInput) {
        searchInput.value = query;
        buscarClientesPorCedulaYNombre(query);
    } else {
        console.error('❌ Campo de búsqueda no encontrado');
    }
    return 'Búsqueda manual ejecutada';
};

window.debugInternamientoBusqueda = function() {
    console.log('=== 🔍 DEBUG DE BÚSQUEDA DE INTERNAMIENTO ===');
    console.log('1. Tickets de consulta cargados:', ticketsConsulta.length);
    console.log('2. Window.tickets disponible:', typeof window.tickets !== 'undefined');
    console.log('3. Window.tickets length:', window.tickets ? window.tickets.length : 0);
    console.log('4. Firebase disponible:', typeof firebase !== 'undefined');
    console.log('5. Firebase Database:', firebase && firebase.database ? 'OK' : 'NO');
    
    // Verificar elementos del DOM
    const searchInput = document.getElementById('intClienteSearch');
    const resultsContainer = document.getElementById('intClienteResults');
    console.log('6. Campo de búsqueda:', searchInput ? 'OK' : 'NO ENCONTRADO');
    console.log('7. Contenedor de resultados:', resultsContainer ? 'OK' : 'NO ENCONTRADO');
    
    if (resultsContainer) {
        console.log('   - Display:', window.getComputedStyle(resultsContainer).display);
        console.log('   - Visibility:', window.getComputedStyle(resultsContainer).visibility);
        console.log('   - Position:', window.getComputedStyle(resultsContainer).position);
        console.log('   - Z-index:', window.getComputedStyle(resultsContainer).zIndex);
    }
    
    if (ticketsConsulta.length > 0) {
        console.log('📋 Primeros 3 tickets:', ticketsConsulta.slice(0, 3));
                } else {
        console.warn('⚠️ No hay tickets cargados');
    }
    
    // Intentar recargar
    console.log('🔄 Intentando recargar tickets...');
    loadTicketsConsulta();
    
    return {
        ticketsConsulta: ticketsConsulta.length,
        windowTickets: window.tickets ? window.tickets.length : 0,
        firebaseOK: !!(firebase && firebase.database),
        domElementsOK: !!(searchInput && resultsContainer)
    };
};

// ========== FUNCIÓN DE PRUEBA - MOSTRAR RESULTADOS DE PRUEBA ==========
window.probarBusquedaInternamiento = function() {
    const resultsContainer = document.getElementById('intClienteResults');
    if (!resultsContainer) {
        console.error('❌ Contenedor de resultados no encontrado');
        return;
    }
    
    // Datos de prueba
    const datosPrueba = [
        {
            nombre: 'Juan Pérez',
            cedula: '1-2345-6789',
            mascota: 'Firulais',
            idPaciente: 'PAC-001',
            tipoMascota: 'Perro',
            fecha: new Date().toISOString()
        },
        {
            nombre: 'María González',
            cedula: '2-3456-7890',
            mascota: 'Koba',
            idPaciente: 'PAC-002',
            tipoMascota: 'Gato',
            fecha: new Date().toISOString()
        }
    ];
    
    // Crear HTML de prueba
    const html = datosPrueba.map(ticket => {
        const fecha = new Date(ticket.fecha).toLocaleDateString('es-CR');
        return `
            <div class="cliente-result-item" style="padding: 15px; border-bottom: 1px solid #e0e0e0; cursor: pointer;">
                <div class="cliente-result-info">
                    <div class="cliente-result-name" style="font-weight: 700; margin-bottom: 8px;">
                        👤 ${ticket.nombre}
                    </div>
                    <div class="cliente-result-details" style="display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.9rem;">
                        <span style="color: #4285f4; font-weight: 600;">🐾 ${ticket.mascota}</span>
                        <span style="background: rgba(66,133,244,0.1); padding: 3px 10px; border-radius: 12px;">📋 ID: ${ticket.idPaciente}</span>
                        <span style="color: #34a853; font-weight: 600;">🆔 Cédula: ${ticket.cedula}</span>
                    </div>
                    <div style="margin-top: 4px; color: #666; font-size: 0.85rem;">
                        <span>📅 ${fecha}</span> • <span>🏷️ ${ticket.tipoMascota}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
    
    return 'Resultados de prueba mostrados. Revisa la pantalla.';
};

// ========== FUNCIÓN PARA FORZAR RECARGA ==========
window.recargarTicketsInternamiento = function() {
    // Primero intentar desde window.tickets
    if (window.tickets && window.tickets.length > 0) {
        ticketsConsulta = [...window.tickets];
        
        // Si hay una búsqueda activa, reintentar
        const searchInput = document.getElementById('intClienteSearch');
        if (searchInput && searchInput.value.trim().length >= 2) {
            buscarClientesPorCedulaYNombre(searchInput.value.trim());
        }
        
        return ticketsConsulta.length;
    }
    
    // Si no, desde Firebase
    cargarTicketsDesdeFirebase();
    
    // Reintentar después de cargar desde Firebase
    setTimeout(() => {
        if (ticketsConsulta.length > 0) {
            const searchInput = document.getElementById('intClienteSearch');
            if (searchInput && searchInput.value.trim().length >= 2) {
                buscarClientesPorCedulaYNombre(searchInput.value.trim());
            }
        }
    }, 1500);
    
    return 'Cargando desde Firebase...';
};

// ========== EXPORTAR FUNCIONES GLOBALES ==========
window.navigateToInternamiento = navigateToInternamiento;
window.seleccionarClienteTicket = seleccionarClienteTicket;
window.agregarMonitoreo = agregarMonitoreo;
window.agregarMedicamento = agregarMedicamento;
window.darAltaPaciente = darAltaPaciente;
window.verDetalleInternamiento = verDetalleInternamiento;
window.eliminarPacienteInternado = eliminarPacienteInternado;
window.cerrarModalDetalle = cerrarModalDetalle;
window.cambiarTabDetalle = cambiarTabDetalle;
window.imprimirDetalleInternamiento = imprimirDetalleInternamiento;
window.filtrarMonitoreoPorFecha = filtrarMonitoreoPorFecha;
window.toggleFormularioBitacora = toggleFormularioBitacora;
window.agregarItemChecklist = agregarItemChecklist;
window.guardarEntradaBitacora = guardarEntradaBitacora;
window.cancelarEntradaBitacora = cancelarEntradaBitacora;
window.toggleChecklistItemTemp = toggleChecklistItemTemp;
window.eliminarChecklistItemTemp = eliminarChecklistItemTemp;
window.toggleChecklistItem = toggleChecklistItem;
window.isAdmin = isAdmin;
window.editarEntradaBitacora = editarEntradaBitacora;
window.cancelarEdicionBitacora = cancelarEdicionBitacora;
window.guardarEdicionBitacora = guardarEdicionBitacora;
window.eliminarEntradaBitacora = eliminarEntradaBitacora;
window.mostrarFormularioAgregarChecklist = mostrarFormularioAgregarChecklist;
window.ocultarFormularioAgregarChecklist = ocultarFormularioAgregarChecklist;
window.agregarItemChecklistExistente = agregarItemChecklistExistente;
window.eliminarItemChecklist = eliminarItemChecklist;
window.toggleFormularioMonitoreo = toggleFormularioMonitoreo;
window.guardarTurnoMonitoreo = guardarTurnoMonitoreo;
window.cancelarTurnoMonitoreo = cancelarTurnoMonitoreo;
window.eliminarTurnoMonitoreo = eliminarTurnoMonitoreo;
window.eliminarMedicamentoTemporal = eliminarMedicamentoTemporal;
window.eliminarMedicamentoPaciente = eliminarMedicamentoPaciente;
window.toggleFormularioMedicamento = toggleFormularioMedicamento;
window.cancelarMedicamento = cancelarMedicamento;
window.guardarMedicamento = guardarMedicamento;
window.toggleModoEdicion = toggleModoEdicion;
window.guardarEdicionInformacion = guardarEdicionInformacion;
window.filtrarInternamiento = filtrarInternamiento;
window.aplicarFiltrosInternamiento = aplicarFiltrosInternamiento;
window.limpiarFiltrosInternamiento = limpiarFiltrosInternamiento;
// Funciones de debug y prueba comentadas - descomenta si las necesitas
/*
window.debugBitacora = function() {
    console.log('🔍 Debug Bitácora:');
    console.log('- currentTicketDetail:', currentTicketDetail);
    console.log('- Container bitacora:', document.getElementById('bitacoraContainer'));
    console.log('- Tab bitácora activo:', document.getElementById('tabBitacora').style.display);
    
    if (currentTicketDetail) {
        const bitacoraRef = firebase.database().ref(`internamiento/${currentTicketDetail.firebaseKey}/bitacora`);
        bitacoraRef.once('value', (snapshot) => {
            console.log('- Firebase bitácora exists:', snapshot.exists());
            console.log('- Firebase bitácora data:', snapshot.val());
        });
    }
};

window.crearEntradaPruebaBitacora = function() {
    if (!currentTicketDetail) {
        showNotification('❌ No hay paciente seleccionado', 'error');
        return;
    }
    
    console.log('🧪 Creando entrada de prueba para:', currentTicketDetail.firebaseKey);
    
    const entrada = {
        id: 'prueba_' + Date.now(),
        fecha: new Date().toISOString(),
        descripcion: `CONTROL MATUTINO - PACIENTE ESTABLE

Signos vitales:
• Temperatura: 38.2°C (normal)
• Frecuencia cardíaca: 120 lpm (dentro de rangos normales)
• Respiración: 24 rpm (regular, sin dificultad)

Observaciones generales:
El paciente se muestra alerta y responde bien a estímulos. Ha consumido aproximadamente el 80% de su ración matutina de alimento especializado. Se observa buena hidratación, membranas mucosas rosadas y húmedas.

Comportamiento:
- Activo y juguetón durante el paseo
- Interacción normal con el personal
- No presenta signos de dolor o incomodidad

Medicación:
Se administró la dosis matutina de antibiótico sin complicaciones. El paciente toleró bien la medicación.

Próximos controles:
Monitorear ingesta de agua durante el día y evaluar si requiere ajuste en la medicación.`,
        checklist: [
            { id: '1', text: 'Verificar temperatura corporal', completed: true },
            { id: '2', text: 'Administrar medicamento prescrito', completed: true },
            { id: '3', text: 'Observar comportamiento alimenticio', completed: true },
            { id: '4', text: 'Cambiar vendajes si es necesario', completed: false },
            { id: '5', text: 'Registrar consumo de agua', completed: false },
            { id: '6', text: 'Evaluar respuesta a medicación', completed: true }
        ],
        autor: 'Dr. Prueba'
    };
    
    const bitacoraRef = firebase.database().ref(`internamiento/${currentTicketDetail.firebaseKey}/bitacora`);
    bitacoraRef.push(entrada)
        .then(() => {
            showNotification('✅ Entrada de prueba creada', 'success');
            console.log('✅ Entrada guardada, recargando bitácora...');
            
            // Cambiar al tab de bitácora y recargar
            cambiarTabDetalle('bitacora');
            setTimeout(() => {
                cargarBitacora(currentTicketDetail.firebaseKey);
            }, 300);
        })
        .catch(error => {
            console.error('❌ Error:', error);
            showNotification('❌ Error al crear entrada de prueba', 'error');
        });
};
*/

// Módulo de Internamiento cargado
