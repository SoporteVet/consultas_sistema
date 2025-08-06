// Quirófano Module - Sistema de tickets para cirugía
// Variables globales del módulo de quirófano
let quirofanoTickets = [];
let currentQuirofanoFilter = 'todos';
let quirofanoCurrentEditingId = null;



// Configuración de Firebase para quirófano
const quirofanoFirebaseRef = window.firebase.database().ref('quirofano-tickets');

// Función auxiliar para generar IDs aleatorios
function generateRandomId(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
    }
    return result;
}

// Función para inicializar el módulo de quirófano
function initQuirofanoModule() {
    console.log('Inicializando módulo de quirófano...');
    
    // Inicializar variable global inmediatamente
    window.quirofanoTickets = quirofanoTickets;
    
    loadQuirofanoTickets();
    setupQuirofanoEventListeners();
    
    // Configurar visibilidad del filtro "Todos" basado en el rol del usuario
    setupQuirofanoFilterVisibility();
}

// Función para configurar la visibilidad del filtro "Todos" para quirófano
function setupQuirofanoFilterVisibility() {
    const userRole = sessionStorage.getItem('userRole');
    const todosFilterBtn = document.getElementById('quirofanoFilterTodos');
    
    if (todosFilterBtn) {
        if (userRole === 'admin') {
            // Admin puede ver el filtro "Todos" (todos los tickets sin restricción de fecha)
            todosFilterBtn.style.display = 'inline-block';
        } else {
            // Otros usuarios no ven el filtro "Todos"
            todosFilterBtn.style.display = 'none';
            
            // Si el filtro actual es "todos", cambiarlo a "programado" por defecto
            if (currentQuirofanoFilter === 'todos') {
                currentQuirofanoFilter = 'programado';
                
                // Activar el botón de "programado"
                const programadoBtn = document.getElementById('quirofanoFilterProgramado');
                if (programadoBtn) {
                    setActiveQuirofanoFilter(programadoBtn);
                    
                    // Re-renderizar con el nuevo filtro
                    const searchTerm = document.getElementById('quirofanoSearchInput')?.value || '';
                    const dateFilter = document.getElementById('quirofanoFilterDate')?.value || '';
                    renderQuirofanoTicketsWithDateFilter('programado', searchTerm, dateFilter);
                }
            }
        }
    }
}

// Función para configurar acceso al módulo de quirófano según el rol
function setupQuirofanoFilterAccess() {
    const userRole = sessionStorage.getItem('userRole');
    const allowedRoles = ['admin', 'recepcion', 'consulta_externa', 'quirofano'];
    
    if (!allowedRoles.includes(userRole)) {
        console.log(`Acceso denegado al módulo de quirófano para rol: ${userRole}`);
        return false;
    }
    
    console.log(`Acceso concedido al módulo de quirófano para rol: ${userRole}`);
    return true;
}

// Función para configurar event listeners del módulo
function setupQuirofanoEventListeners() {
    // Formulario de crear ticket de quirófano
    const quirofanoForm = document.getElementById('quirofanoTicketForm');
    if (quirofanoForm) {
        quirofanoForm.addEventListener('submit', handleQuirofanoFormSubmit);
    }
    
    // Configurar el checkbox de exámenes prequirúrgicos
    const examenesCheckbox = document.getElementById('quirofanoExamenesPrequirurgicos');
    const examenesStatusContainer = document.getElementById('examenesStatusContainer');
    
    if (examenesCheckbox && examenesStatusContainer) {
        examenesCheckbox.addEventListener('change', function() {
            if (this.checked) {
                examenesStatusContainer.style.display = 'block';
            } else {
                examenesStatusContainer.style.display = 'none';
            }
        });
    }
    


    // Búsqueda en tiempo real
    const searchInput = document.getElementById('quirofanoSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleQuirofanoSearch);
    }

    // Filtro por fecha
    const dateFilter = document.getElementById('quirofanoFilterDate');
    if (dateFilter) {
        dateFilter.addEventListener('change', handleQuirofanoDateFilter);
    }

    // Filtros de estado
    const filterBtns = document.querySelectorAll('.quirofano-filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            setActiveQuirofanoFilter(btn);
            currentQuirofanoFilter = btn.dataset.filter;
            const searchTerm = document.getElementById('quirofanoSearchInput')?.value || '';
            const dateFilter = document.getElementById('quirofanoFilterDate')?.value || '';
            renderQuirofanoTicketsWithDateFilter(currentQuirofanoFilter, searchTerm, dateFilter);
        });
    });

    // Event listener para cerrar modales
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('quirofano-modal')) {
            closeQuirofanoModal();
        }
    });
}

// Función para manejar el envío del formulario
function handleQuirofanoFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const ticketData = {
        randomId: generateRandomId(),
        numero: getNextQuirofanoTicketNumber(),
        nombreMascota: document.getElementById('quirofanoMascota').value,
        nombrePropietario: document.getElementById('quirofanoNombre').value,
        cedula: document.getElementById('quirofanoCedula').value,
        correo: document.getElementById('quirofanoCorreo').value,
        telefono: document.getElementById('quirofanoTelefono').value,
        tipoMascota: document.getElementById('quirofanoTipoMascota').value,
        raza: document.getElementById('quirofanoRaza').value,
        peso: document.getElementById('quirofanoPeso').value,
        edad: document.getElementById('quirofanoEdad').value,
        idPaciente: document.getElementById('quirofanoIdPaciente').value,
        procedimiento: document.getElementById('quirofanoProcedimiento').value,
        tipoUrgencia: document.getElementById('quirofanoUrgencia').value,
        observaciones: document.getElementById('quirofanoMotivo').value,
        examenesPrequirurgicos: document.getElementById('quirofanoExamenesPrequirurgicos').checked,
        examenesStatus: document.getElementById('quirofanoExamenesPrequirurgicos').checked ? 
            document.getElementById('quirofanoExamenesStatus').value : null,
        fechaCreacion: new Date().toISOString(),
        fechaProgramada: document.getElementById('quirofanoFecha').value,
        horaProgramada: document.getElementById('quirofanoHora').value,
        estado: 'programado',
        creadoPor: sessionStorage.getItem('userName') || 'Usuario',
        doctorAtiende: document.getElementById('quirofanoDoctorAtiende').value,
        asistenteAtiende: document.getElementById('quirofanoAsistenteAtiende').value,
        // Combinar doctor y asistente como en consultas
        medicoAtiende: (() => {
            const doctor = document.getElementById('quirofanoDoctorAtiende').value;
            const asistente = document.getElementById('quirofanoAsistenteAtiende').value;
            if (doctor && asistente) {
                return `${doctor}, ${asistente}`;
            } else if (doctor) {
                return doctor;
            } else if (asistente) {
                return asistente;
            }
            return '';
        })(),
        // Horas automáticas del sistema
        horaLlegada: new Date().toLocaleTimeString('es-ES', { hour12: false }),
        horaAtencion: null,
        horaFinalizacion: null
    };

    // Debug: Verificar que se estén capturando los datos en creación
    console.log('Datos de creación:', ticketData);
    console.log('Cédula creación:', ticketData.cedula);
    console.log('ID Paciente creación:', ticketData.idPaciente);

    // Validación básica
    if (!ticketData.nombreMascota || !ticketData.nombrePropietario || !ticketData.procedimiento) {
        showNotification('Por favor, complete todos los campos obligatorios', 'error');
        return;
    }

    // Guardar en Firebase
    saveQuirofanoTicket(ticketData);
}

// Función para guardar ticket en Firebase
function saveQuirofanoTicket(ticketData) {
    showLoading();
    
    quirofanoFirebaseRef.push(ticketData)
        .then(() => {
            hideLoading();
            showNotification('Ticket de quirófano creado exitosamente', 'success');
            document.getElementById('quirofanoTicketForm').reset();
            loadQuirofanoTickets();
            
            // Actualizar variable global inmediatamente después de crear
            setTimeout(() => {
                window.quirofanoTickets = quirofanoTickets;
                console.log('Variable global actualizada después de crear ticket');
                
                // Actualizar contador de exámenes prequirúrgicos
                if (typeof window.updatePrequirurgicoCounter === 'function') {
                    window.updatePrequirurgicoCounter();
                }
                
                // Redirigir a la vista de ver tickets después de actualizar
                redirectToQuirofanoView();
            }, 500);
        })
        .catch((error) => {
            hideLoading();
            console.error('Error al guardar ticket:', error);
            showNotification('Error al crear el ticket', 'error');
        });
}

// Función específica para redirigir a la vista de tickets de quirófano
function redirectToQuirofanoView() {
    console.log('Intentando redirigir a vista de tickets...');
    
    // Método 1: Buscar y hacer clic en el botón/enlace de ver tickets
    const verTicketsLink = document.querySelector('a[onclick*="verQuirofano"]') || 
                          document.querySelector('button[onclick*="verQuirofano"]') ||
                          document.querySelector('[data-section="verQuirofanoSection"]') ||
                          document.querySelector('.nav-item[onclick*="verQuirofano"]');
    
    if (verTicketsLink) {
        console.log('Haciendo clic en el enlace de ver tickets...');
        verTicketsLink.click();
        return;
    }
    
    // Método 2: Manipulación directa del DOM si los elementos existen
    const crearSection = document.getElementById('crearQuirofanoSection');
    const verSection = document.getElementById('verQuirofanoSection');
    
    if (crearSection && verSection) {
        console.log('Cambiando secciones manualmente...');
        
        // Ocultar todas las secciones primero
        const allSections = document.querySelectorAll('[id$="Section"]');
        allSections.forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        
        // Mostrar solo la sección de ver tickets
        verSection.style.display = 'block';
        verSection.classList.add('active');
        
        // Actualizar navegación
        const navItems = document.querySelectorAll('.nav-item, .menu-item, .tab');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.textContent && item.textContent.includes('Ver') && item.textContent.includes('Tickets')) {
                item.classList.add('active');
            }
        });
        
        console.log('Redirección manual exitosa');
        return;
    }
    
    // Método 3: Intentar con hash de URL
    if (window.location.hash !== '#quirofano-ver') {
        console.log('Cambiando hash de URL...');
        window.location.hash = '#quirofano-ver';
        
        // Trigger hashchange event
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    
    console.log('Todos los métodos de redirección probados');
}

// Función para cargar tickets desde Firebase
function loadQuirofanoTickets() {
    showLoading();
    
    quirofanoFirebaseRef.on('value', (snapshot) => {
        quirofanoTickets = [];
        
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const ticket = {
                    firebaseKey: childSnapshot.key,
                    ...childSnapshot.val()
                };
                
                // Migración automática: agregar horas si no existen
                if (!ticket.horaLlegada) {
                    ticket.horaLlegada = 'Migrado';
                }
                
                // Migración automática: crear medicoAtiende si no existe pero sí veterinario/asistente
                if (!ticket.medicoAtiende && (ticket.veterinario || ticket.asistente)) {
                    const doctor = ticket.veterinario || ticket.doctorAtiende || '';
                    const asistente = ticket.asistente || ticket.asistenteAtiende || '';
                    
                    if (doctor && asistente) {
                        ticket.medicoAtiende = `${doctor}, ${asistente}`;
                    } else if (doctor) {
                        ticket.medicoAtiende = doctor;
                    } else if (asistente) {
                        ticket.medicoAtiende = asistente;
                    }
                    
                    // También asegurar que doctorAtiende y asistenteAtiende estén definidos
                    if (!ticket.doctorAtiende) {
                        ticket.doctorAtiende = doctor;
                    }
                    if (!ticket.asistenteAtiende) {
                        ticket.asistenteAtiende = asistente;
                    }
                }
                
                quirofanoTickets.push(ticket);
            });
        }
        
        hideLoading();
        renderQuirofanoTicketsWithDateFilter(currentQuirofanoFilter, '', '');
        
        // Exportar tickets globalmente para el módulo de consentimientos
        window.quirofanoTickets = quirofanoTickets;
        console.log('Tickets de quirófano exportados globalmente:', quirofanoTickets.length, 'tickets disponibles');
        
        // Actualizar contador de exámenes prequirúrgicos
        if (typeof window.updatePrequirurgicoCounter === 'function') {
            window.updatePrequirurgicoCounter();
        }
    });
}

// Función para renderizar tickets
function renderQuirofanoTickets(filter = 'todos', searchTerm = '') {
    const container = document.getElementById('quirofanoTicketContainer');
    if (!container) return;

    let filteredTickets = quirofanoTickets;

    // Filtrar por estado
    if (filter && filter !== 'todos') {
        filteredTickets = filteredTickets.filter(ticket => ticket.estado === filter);
    }

    // Filtrar por búsqueda
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredTickets = filteredTickets.filter(ticket => 
            ticket.nombreMascota?.toLowerCase().includes(term) ||
            ticket.nombrePropietario?.toLowerCase().includes(term) ||
            ticket.procedimiento?.toLowerCase().includes(term) ||
            ticket.raza?.toLowerCase().includes(term) ||
            ticket.numero?.toString().includes(term)
        );
    }

    // Ordenar por fecha de creación (más recientes primero)
    filteredTickets.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));

    if (filteredTickets.length === 0) {
        container.innerHTML = `
            <div class="quirofano-no-data">
                <i class="fas fa-search"></i>
                <p>No se encontraron tickets de quirófano</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredTickets.map(ticket => {
        // Determine animal icon based on species
        let animalIcon = '';
        switch(ticket.tipoMascota) {
            case 'perro':
                animalIcon = '<i class="fas fa-dog animal-icon"></i>';
                break;
            case 'gato':
                animalIcon = '<i class="fas fa-cat animal-icon"></i>';
                break;
            case 'conejo':
                animalIcon = '<i class="fas fa-paw animal-icon"></i>';
                break;
            default:
                animalIcon = '<i class="fas fa-paw animal-icon"></i>';
        }

        // Determine species icon for info section
        let speciesIcon = '';
        switch(ticket.tipoMascota) {
            case 'perro':
                speciesIcon = '<i class="fas fa-dog"></i>';
                break;
            case 'gato':
                speciesIcon = '<i class="fas fa-cat"></i>';
                break;
            case 'conejo':
                speciesIcon = '<i class="fas fa-paw"></i>';
                break;
            default:
                speciesIcon = '<i class="fas fa-paw"></i>';
        }

        return `
        <div class="quirofano-ticket quirofano-ticket-${ticket.estado} quirofano-ticket-urgencia-${ticket.tipoUrgencia}" onclick="editQuirofanoTicket('${ticket.randomId}')">
            <div class="quirofano-ticket-header">
                <div class="quirofano-ticket-title">
                    ${animalIcon}
                    ${ticket.nombreMascota}
                </div>
                <div class="quirofano-ticket-number">
                    #${ticket.numero}
                </div>
            </div>
            
            <div class="quirofano-ticket-info">
                <p><i class="fas fa-user"></i> <strong>Propietario:</strong> ${ticket.nombrePropietario}</p>
                <p><i class="fas fa-envelope"></i> <strong>Correo:</strong> ${ticket.correo || 'No especificado'}</p>
                <p><i class="fas fa-phone"></i> <strong>Teléfono:</strong> ${ticket.telefono || 'No especificado'}</p>
                <p>${speciesIcon} <strong>Especie:</strong> ${getTipoMascotaLabel(ticket.tipoMascota)}</p>
                <p><i class="fas fa-dna"></i> <strong>Raza:</strong> ${ticket.raza || 'No especificada'}</p>
                <p><i class="fas fa-weight"></i> <strong>Peso:</strong> ${ticket.peso || 'No especificado'}</p>
                <p><i class="fas fa-birthday-cake"></i> <strong>Edad:</strong> ${ticket.edad || 'No especificada'}</p>
                <p><i class="fas fa-procedures"></i> <strong>Procedimiento:</strong> ${ticket.procedimiento}</p>
                <p><i class="fas fa-calendar-alt"></i> <strong>Fecha:</strong> ${formatQuirofanoDate(ticket.fechaProgramada)}</p>
                <p><i class="fas fa-user-md"></i> <strong>Médico:</strong> ${ticket.medicoAtiende || ticket.veterinario || 'No asignado'}</p>
                ${ticket.examenesPrequirurgicos ? `<p><i class="fas fa-vials"></i> <strong>Exámenes Pre Quirúrgicos:</strong> 
                    ${ticket.examenesStatus === 'realizado' ? 
                        '<span style="color: #28a745; font-weight: bold;">✅ Realizados</span>' : 
                        `<span style="color: #ff6b35; font-weight: bold;">⏳ Pendientes</span>
                         <button onclick="marcarExamenesRealizados('${ticket.randomId}')" 
                                 class="btn-examenes-realizados" 
                                 title="Marcar exámenes como realizados">
                            <i class="fas fa-check"></i> Marcar como realizados
                         </button>`
                    }</p>` : ''}
                ${ticket.observaciones ? `<p><i class="fas fa-sticky-note"></i> <strong>Observaciones:</strong> ${ticket.observaciones}</p>` : ''}
                
                <!-- Horas automáticas del sistema - Se muestran progresivamente según el estado -->
                <p><i class="fas fa-clock"></i> <strong>Hora de Llegada:</strong> ${ticket.horaLlegada || 'No registrada'}</p>
                ${(ticket.estado === 'cirugia' || ticket.estado === 'terminado') && ticket.horaAtencion ? `<p><i class="fas fa-clock"></i> <strong>Hora de Atención:</strong> ${ticket.horaAtencion}</p>` : ''}
                ${ticket.estado === 'terminado' && ticket.horaFinalizacion ? `<p><i class="fas fa-clock"></i> <strong>Hora de Finalización:</strong> ${ticket.horaFinalizacion}</p>` : ''}
                
                <div class="quirofano-urgencia-info urgencia-${ticket.tipoUrgencia}">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Categorización:</strong> ${getUrgenciaQuirofanoLabel(ticket.tipoUrgencia)}
                </div>
                
                <div class="quirofano-estado-badge estado-${ticket.estado}">
                    <i class="fas fa-circle"></i>
                    ${getEstadoQuirofanoLabel(ticket.estado)}
                </div>
            </div>
            
            <div class="quirofano-ticket-actions">
                ${sessionStorage.getItem('userRole') === 'admin' ? `
                <button class="quirofano-action-btn quirofano-btn-eliminar" onclick="event.stopPropagation(); deleteQuirofanoTicket('${ticket.randomId}')">
                    <i class="fas fa-trash"></i>
                    Eliminar
                </button>
                ` : ''}
                ${ticket.estado !== 'terminado' ? `
                <button class="quirofano-action-btn quirofano-btn-terminar" onclick="event.stopPropagation(); endQuirofanoSurgery('${ticket.randomId}')">
                    <i class="fas fa-check-circle"></i>
                    Terminar Cirugía
                </button>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');
}

// Función para renderizar tickets con filtro de fecha
function renderQuirofanoTicketsWithDateFilter(filter = 'todos', searchTerm = '', dateFilter = '') {
    const container = document.getElementById('quirofanoTicketContainer');
    if (!container) return;

    let filteredTickets = quirofanoTickets;
    const userRole = sessionStorage.getItem('userRole');

    // Filtrar por estado
    if (filter && filter !== 'todos') {
        filteredTickets = filteredTickets.filter(ticket => ticket.estado === filter);
    }

    // Filtrar por búsqueda
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredTickets = filteredTickets.filter(ticket => 
            ticket.nombreMascota?.toLowerCase().includes(term) ||
            ticket.nombrePropietario?.toLowerCase().includes(term) ||
            ticket.procedimiento?.toLowerCase().includes(term) ||
            ticket.raza?.toLowerCase().includes(term) ||
            ticket.numero?.toString().includes(term)
        );
    }

    // Filtrar por fecha programada
    if (dateFilter) {
        // Si hay un filtro de fecha específico, aplicarlo siempre
        // (independientemente del filtro de estado o rol del usuario)
        filteredTickets = filteredTickets.filter(ticket => {
            if (!ticket.fechaProgramada) return false;
            // Comparar directamente las cadenas de fecha (YYYY-MM-DD)
            return ticket.fechaProgramada === dateFilter;
        });
    } else if (filter === 'todos' && userRole !== 'admin') {
        // Solo para usuarios no admin: si no hay fecha específica y el filtro es "todos",
        // mostrar únicamente tickets de hoy
        const today = new Date();
        const todayString = today.getFullYear() + '-' + 
                           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(today.getDate()).padStart(2, '0');
        
        filteredTickets = filteredTickets.filter(ticket => {
            if (!ticket.fechaProgramada) return false;
            return ticket.fechaProgramada === todayString;
        });
    }
    // Si es admin y filter === 'todos' sin dateFilter específico,
    // se muestran TODOS los tickets sin restricción de fecha

    // Ordenar por fecha de creación (más recientes primero)
    filteredTickets.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));

    if (filteredTickets.length === 0) {
        let mensaje = 'No se encontraron tickets de quirófano';
        
        if (dateFilter) {
            // Si hay una fecha específica seleccionada
            const fechaFormateada = formatQuirofanoDate(dateFilter);
            if (filter === 'todos') {
                mensaje = `No se encontraron tickets para la fecha ${fechaFormateada}`;
            } else {
                const estadoLabel = getEstadoQuirofanoLabel(filter);
                mensaje = `No se encontraron tickets "${estadoLabel}" para la fecha ${fechaFormateada}`;
            }
        } else if (filter === 'todos' && userRole !== 'admin') {
            // Usuario no admin en filtro "todos" sin fecha específica
            const today = new Date();
            const todayFormatted = formatQuirofanoDate(today.getFullYear() + '-' + 
                                  String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                                  String(today.getDate()).padStart(2, '0'));
            mensaje = `No se encontraron tickets para hoy (${todayFormatted})`;
        } else if (filter === 'todos' && userRole === 'admin') {
            // Admin en filtro "todos" sin fecha específica
            mensaje = 'No se encontraron tickets (mostrando historial completo)';
        } else {
            // Filtro específico de estado
            const estadoLabel = getEstadoQuirofanoLabel(filter);
            mensaje = `No se encontraron tickets con estado "${estadoLabel}"`;
        }
        
        container.innerHTML = `
            <div class="quirofano-no-data">
                <i class="fas fa-search"></i>
                <p>${mensaje}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredTickets.map(ticket => {
        // Determine animal icon based on species
        let animalIcon = '';
        switch(ticket.tipoMascota) {
            case 'perro':
                animalIcon = '<i class="fas fa-dog animal-icon"></i>';
                break;
            case 'gato':
                animalIcon = '<i class="fas fa-cat animal-icon"></i>';
                break;
            case 'conejo':
                animalIcon = '<i class="fas fa-paw animal-icon"></i>';
                break;
            default:
                animalIcon = '<i class="fas fa-paw animal-icon"></i>';
        }

        // Determine species icon for info section
        let speciesIcon = '';
        switch(ticket.tipoMascota) {
            case 'perro':
                speciesIcon = '<i class="fas fa-dog"></i>';
                break;
            case 'gato':
                speciesIcon = '<i class="fas fa-cat"></i>';
                break;
            case 'conejo':
                speciesIcon = '<i class="fas fa-paw"></i>';
                break;
            default:
                speciesIcon = '<i class="fas fa-paw"></i>';
        }

        return `
        <div class="quirofano-ticket quirofano-ticket-${ticket.estado} quirofano-ticket-urgencia-${ticket.tipoUrgencia}" onclick="editQuirofanoTicket('${ticket.randomId}')">
            <div class="quirofano-ticket-header">
                <div class="quirofano-ticket-title">
                    ${animalIcon}
                    ${ticket.nombreMascota}
                </div>
                <div class="quirofano-ticket-number">
                    #${ticket.numero}
                </div>
            </div>
            
            <div class="quirofano-ticket-info">
                <p><i class="fas fa-user"></i> <strong>Propietario:</strong> ${ticket.nombrePropietario}</p>
                <p><i class="fas fa-envelope"></i> <strong>Correo:</strong> ${ticket.correo || 'No especificado'}</p>
                <p><i class="fas fa-phone"></i> <strong>Teléfono:</strong> ${ticket.telefono || 'No especificado'}</p>
                <p>${speciesIcon} <strong>Especie:</strong> ${getTipoMascotaLabel(ticket.tipoMascota)}</p>
                <p><i class="fas fa-dna"></i> <strong>Raza:</strong> ${ticket.raza || 'No especificada'}</p>
                <p><i class="fas fa-weight"></i> <strong>Peso:</strong> ${ticket.peso || 'No especificado'}</p>
                <p><i class="fas fa-birthday-cake"></i> <strong>Edad:</strong> ${ticket.edad || 'No especificada'}</p>
                <p><i class="fas fa-procedures"></i> <strong>Procedimiento:</strong> ${ticket.procedimiento}</p>
                <p><i class="fas fa-calendar-alt"></i> <strong>Fecha:</strong> ${formatQuirofanoDate(ticket.fechaProgramada)}</p>
                <p><i class="fas fa-user-md"></i> <strong>Médico:</strong> ${ticket.medicoAtiende || ticket.veterinario || 'No asignado'}</p>
                ${ticket.examenesPrequirurgicos ? `<p><i class="fas fa-vials"></i> <strong>Exámenes Pre Quirúrgicos:</strong> 
                    ${ticket.examenesStatus === 'realizado' ? 
                        '<span style="color: #28a745; font-weight: bold;">✅ Realizados</span>' : 
                        `<span style="color: #ff6b35; font-weight: bold;">⏳ Pendientes</span>
                         <button onclick="marcarExamenesRealizados('${ticket.randomId}')" 
                                 class="btn-examenes-realizados" 
                                 title="Marcar exámenes como realizados">
                            <i class="fas fa-check"></i> Marcar como realizados
                         </button>`
                    }</p>` : ''}
                ${ticket.observaciones ? `<p><i class="fas fa-sticky-note"></i> <strong>Observaciones:</strong> ${ticket.observaciones}</p>` : ''}
                
                <!-- Horas automáticas del sistema - Se muestran progresivamente según el estado -->
                <p><i class="fas fa-clock"></i> <strong>Hora de Llegada:</strong> ${ticket.horaLlegada || 'No registrada'}</p>
                ${(ticket.estado === 'cirugia' || ticket.estado === 'terminado') && ticket.horaAtencion ? `<p><i class="fas fa-clock"></i> <strong>Hora de Atención:</strong> ${ticket.horaAtencion}</p>` : ''}
                ${ticket.estado === 'terminado' && ticket.horaFinalizacion ? `<p><i class="fas fa-clock"></i> <strong>Hora de Finalización:</strong> ${ticket.horaFinalizacion}</p>` : ''}
                
                <div class="quirofano-urgencia-info urgencia-${ticket.tipoUrgencia}">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Categorización:</strong> ${getUrgenciaQuirofanoLabel(ticket.tipoUrgencia)}
                </div>
                
                <div class="quirofano-estado-badge estado-${ticket.estado}">
                    <i class="fas fa-circle"></i>
                    ${getEstadoQuirofanoLabel(ticket.estado)}
                </div>
            </div>
            
            <div class="quirofano-ticket-actions">
                ${userRole === 'admin' ? `
                <button class="quirofano-action-btn quirofano-btn-eliminar" onclick="event.stopPropagation(); deleteQuirofanoTicket('${ticket.randomId}')">
                    <i class="fas fa-trash"></i>
                    Eliminar
                </button>
                ` : ''}
                ${ticket.estado !== 'terminado' ? `
                <button class="quirofano-action-btn quirofano-btn-terminar" onclick="event.stopPropagation(); endQuirofanoSurgery('${ticket.randomId}')">
                    <i class="fas fa-check-circle"></i>
                    Terminar Cirugía
                </button>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');
}

// Función para obtener el siguiente número de ticket
function getNextQuirofanoTicketNumber() {
    // Obtener la fecha de hoy en formato YYYY-MM-DD
    const today = new Date();
    const todayString = today.getFullYear() + '-' + 
                       String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(today.getDate()).padStart(2, '0');
    
    // Filtrar solo los tickets creados hoy
    const todaysTickets = quirofanoTickets.filter(ticket => {
        if (!ticket.fechaCreacion) return false;
        
        // Extraer solo la fecha de la fechaCreacion (sin la hora)
        const ticketDate = ticket.fechaCreacion.split('T')[0];
        return ticketDate === todayString;
    });
    
    // Si no hay tickets de hoy, empezar con 1
    if (todaysTickets.length === 0) return 1;
    
    // Obtener el número más alto de los tickets de hoy y sumar 1
    const maxNumber = Math.max(...todaysTickets.map(t => parseInt(t.numero) || 0));
    return maxNumber + 1;
}

// Función para manejar búsqueda
function handleQuirofanoSearch(e) {
    const searchTerm = e.target.value;
    const dateFilter = document.getElementById('quirofanoFilterDate')?.value || '';
    renderQuirofanoTicketsWithDateFilter(currentQuirofanoFilter, searchTerm, dateFilter);
}

// Función para manejar filtro por fecha
function handleQuirofanoDateFilter(e) {
    const selectedDate = e.target.value;
    const searchTerm = document.getElementById('quirofanoSearchInput')?.value || '';
    
    // Debug para verificar el filtro de fecha
    console.log('Filtro de fecha seleccionado:', selectedDate);
    console.log('Tickets disponibles:', quirofanoTickets.map(t => ({
        nombre: t.nombreMascota,
        fechaProgramada: t.fechaProgramada
    })));
    
    renderQuirofanoTicketsWithDateFilter(currentQuirofanoFilter, searchTerm, selectedDate);
}

// Función para establecer filtro activo
function setActiveQuirofanoFilter(activeBtn) {
    document.querySelectorAll('.quirofano-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    activeBtn.classList.add('active');
}

// Función para limpiar filtro de fecha
function clearQuirofanoDateFilter() {
    const dateFilter = document.getElementById('quirofanoFilterDate');
    if (dateFilter) {
        dateFilter.value = '';
        const searchTerm = document.getElementById('quirofanoSearchInput')?.value || '';
        renderQuirofanoTicketsWithDateFilter(currentQuirofanoFilter, searchTerm, '');
    }
}

// Función para separar doctor y asistente del campo medicoAtiende combinado
function separateQuirofanoMedicoAtiende(medicoAtiende) {
    if (!medicoAtiende) return { doctor: '', asistente: '' };
    
    // Si contiene coma, separar doctor y asistente
    if (medicoAtiende.includes(', ')) {
        const parts = medicoAtiende.split(', ');
        const doctor = parts[0]?.trim() || '';
        const asistente = parts[1]?.trim() || '';
        return { doctor, asistente };
    }
    
    // Si no tiene coma, determinar si es doctor o asistente por el prefijo
    if (medicoAtiende.startsWith('Dr.') || medicoAtiende.startsWith('Dra.')) {
        return { doctor: medicoAtiende, asistente: '' };
    } else if (medicoAtiende.startsWith('Tec.')) {
        return { doctor: '', asistente: medicoAtiende };
    }
    
    // Por defecto, asumir que es doctor
    return { doctor: medicoAtiende, asistente: '' };
}

// Función para editar ticket - igual que consultas
function editQuirofanoTicket(randomId) {
    const ticket = quirofanoTickets.find(t => t.randomId === randomId);
    if (!ticket) return;

    quirofanoCurrentEditingId = randomId;
    
    // Separar doctor y asistente si están combinados en medicoAtiende
    const separatedMedico = separateQuirofanoMedicoAtiende(ticket.medicoAtiende);
    const doctorActual = ticket.doctorAtiende || ticket.veterinario || separatedMedico.doctor;
    const asistenteActual = ticket.asistenteAtiende || ticket.asistente || separatedMedico.asistente;
    
    // Crear modal de edición con la misma estructura que el formulario de creación
    const modalHTML = `
        <div class="quirofano-modal" id="quirofanoEditModal">
            <div class="quirofano-modal-content">
                <span class="close-modal" onclick="closeQuirofanoModal()">&times;</span>
                <h3><i class="fas fa-edit"></i> Editar ticket</h3>
                <div class="form-container">
                    <form id="quirofanoEditForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoNombre">Nombre del Cliente</label>
                            <input type="text" id="editQuirofanoNombre" name="nombrePropietario" value="${ticket.nombrePropietario}" required>
                        </div>
                        <div class="form-group">
                            <label for="editQuirofanoCedula">Cédula</label>
                            <input type="text" id="editQuirofanoCedula" name="cedula" value="${ticket.cedula || ''}" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoCorreo">Correo Electrónico</label>
                            <input type="email" id="editQuirofanoCorreo" name="correo" value="${ticket.correo || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editQuirofanoTelefono">Teléfono</label>
                            <input type="tel" id="editQuirofanoTelefono" name="telefono" value="${ticket.telefono || ''}" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoMascota">Nombre de la Mascota</label>
                            <input type="text" id="editQuirofanoMascota" name="nombreMascota" value="${ticket.nombreMascota}" required>
                        </div>
                        <div class="form-group">
                            <label for="editQuirofanoTipoMascota">Tipo de Mascota</label>
                            <select id="editQuirofanoTipoMascota" name="tipoMascota" required>
                                <option value="perro" ${ticket.tipoMascota === 'perro' ? 'selected' : ''}>Perro</option>
                                <option value="gato" ${ticket.tipoMascota === 'gato' ? 'selected' : ''}>Gato</option>
                                <option value="conejo" ${ticket.tipoMascota === 'conejo' ? 'selected' : ''}>Conejo</option>
                                <option value="otro" ${ticket.tipoMascota === 'otro' ? 'selected' : ''}>Otro</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoRaza">Raza</label>
                            <input type="text" id="editQuirofanoRaza" name="raza" value="${ticket.raza || ''}" placeholder="Ej: Labrador, Persa, SRD">
                        </div>
                        <div class="form-group">
                            <label for="editQuirofanoPeso">Peso</label>
                            <input type="text" id="editQuirofanoPeso" name="peso" value="${ticket.peso || ''}" placeholder="Ej: 5.5 kg, 2.3 kg">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoEdad">Edad de la Mascota</label>
                            <input type="text" id="editQuirofanoEdad" name="edad" value="${ticket.edad || ''}" placeholder="Ej: 3 años, 8 meses">
                        </div>
                        <div class="form-group">
                            <label for="editQuirofanoIdPaciente">ID del Paciente</label>
                            <input type="text" id="editQuirofanoIdPaciente" name="idPaciente" value="${ticket.idPaciente || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editQuirofanoFecha">Fecha de Cirugía</label>
                            <input type="date" id="editQuirofanoFecha" name="fechaProgramada" value="${ticket.fechaProgramada}" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoHora">Hora de Cirugía</label>
                            <input type="time" id="editQuirofanoHora" name="horaProgramada" value="${ticket.horaProgramada || ''}">
                        </div>
                        <div class="form-group">
                            <!-- Campo vacío para que Hora vaya sola -->
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoUrgencia">Categorización de Paciente</label>
                            <select id="editQuirofanoUrgencia" name="tipoUrgencia" required>
                                <option value="normal" ${ticket.tipoUrgencia === 'normal' ? 'selected' : ''}>🔵 Cirugía Regular</option>
                                <option value="media" ${ticket.tipoUrgencia === 'media' ? 'selected' : ''}>� Cirugía Programada</option>
                                <option value="alta" ${ticket.tipoUrgencia === 'alta' ? 'selected' : ''}>🟠 Cirugía Urgente</option>
                                <option value="emergencia" ${ticket.tipoUrgencia === 'emergencia' ? 'selected' : ''}>🔴 Cirugía de Emergencia</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <!-- Campo vacío para mantener estructura -->
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoDoctorAtiende"><i class="fas fa-user-md"></i> Doctor que atiende</label>
                            <select id="editQuirofanoDoctorAtiende" name="doctorAtiende">
                                <option value="">Seleccione un doctor</option>
                                <option value="Dr. Luis Coto" ${doctorActual === 'Dr. Luis Coto' ? 'selected' : ''}>Dr. Luis Coto</option>
                                <option value="Dr. Randall Azofeifa" ${doctorActual === 'Dr. Randall Azofeifa' ? 'selected' : ''}>Dr. Randall Azofeifa</option>
                                <option value="Dr. Gustavo Gonzalez" ${doctorActual === 'Dr. Gustavo Gonzalez' ? 'selected' : ''}>Dr. Gustavo Gonzalez</option>
                                <option value="Dra. Daniela Sancho" ${doctorActual === 'Dra. Daniela Sancho' ? 'selected' : ''}>Dra. Daniela Sancho</option>
                                <option value="Dra. Francinny Nuñez" ${doctorActual === 'Dra. Francinny Nuñez' ? 'selected' : ''}>Dra. Francinny Nuñez</option>
                                <option value="Dra. Kharen Moreno" ${doctorActual === 'Dra. Kharen Moreno' ? 'selected' : ''}>Dra. Kharen Moreno</option>
                                <option value="Dra. Karina Madrigal" ${doctorActual === 'Dra. Karina Madrigal' ? 'selected' : ''}>Dra. Karina Madrigal</option>
                                <option value="Dra. Lourdes Chacón" ${doctorActual === 'Dra. Lourdes Chacón' ? 'selected' : ''}>Dra. Lourdes Chacón</option>
                                <option value="Dra. Sofia Carrillo" ${doctorActual === 'Dra. Sofia Carrillo' ? 'selected' : ''}>Dra. Sofia Carrillo</option>
                                <option value="Dra. Karla Quesada" ${doctorActual === 'Dra. Karla Quesada' ? 'selected' : ''}>Dra. Karla Quesada</option>
                                <option value="Dra. Natalia Alvarado" ${doctorActual === 'Dra. Natalia Alvarado' ? 'selected' : ''}>Dra. Natalia Alvarado</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editQuirofanoAsistenteAtiende"><i class="fas fa-user-nurse"></i> Asistente que atiende</label>
                            <select id="editQuirofanoAsistenteAtiende" name="asistenteAtiende">
                                <option value="">Seleccione un asistente</option>
                                <option value="Tec. Maribel Guzmán" ${asistenteActual === 'Tec. Maribel Guzmán' ? 'selected' : ''}>Tec. Maribel Guzmán</option>
                                <option value="Tec. Juliana Perez" ${asistenteActual === 'Tec. Juliana Perez' ? 'selected' : ''}>Tec. Juliana Perez</option>
                                <option value="Tec. Jafeth Bermudez" ${asistenteActual === 'Tec. Jafeth Bermudez' ? 'selected' : ''}>Tec. Jafeth Bermudez</option>
                                <option value="Tec. Johnny Chacón" ${asistenteActual === 'Tec. Johnny Chacón' ? 'selected' : ''}>Tec. Johnny Chacón</option>
                                <option value="Tec. Gabriela Zuñiga" ${asistenteActual === 'Tec. Gabriela Zuñiga' ? 'selected' : ''}>Tec. Gabriela Zuñiga</option>
                                <option value="Tec. Indra Perez" ${asistenteActual === 'Tec. Indra Perez' ? 'selected' : ''}>Tec. Indra Perez</option>
                                <option value="Tec. Randy Arias" ${asistenteActual === 'Tec. Randy Arias' ? 'selected' : ''}>Tec. Randy Arias</option>
                                <option value="Tec. Yancy Picado" ${asistenteActual === 'Tec. Yancy Picado' ? 'selected' : ''}>Tec. Yancy Picado</option>
                                <option value="Tec. Maria Fernanda" ${asistenteActual === 'Tec. Maria Fernanda' ? 'selected' : ''}>Tec. Maria Fernanda</option>
                                <option value="Tec. Maria José Gutierrez" ${asistenteActual === 'Tec. Maria José Gutierrez' ? 'selected' : ''}>Tec. Maria José Gutierrez</option>
                                <option value="Tec. Jimena Urtecho" ${asistenteActual === 'Tec. Jimena Urtecho' ? 'selected' : ''}>Tec. Jimena Urtecho</option>
                                <option value="Tec. Nicole Gamboa" ${asistenteActual === 'Tec. Nicole Gamboa' ? 'selected' : ''}>Tec. Nicole Gamboa</option>
                                <option value="Tec. Paola López" ${asistenteActual === 'Tec. Paola López' ? 'selected' : ''}>Tec. Paola López</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoProcedimiento">Tipo de Procedimiento</label>
                            <input type="text" id="editQuirofanoProcedimiento" name="procedimiento" value="${ticket.procedimiento}" placeholder="Ej: Esterilización, Castración, Cesárea, etc.">
                        </div>
                        <div class="form-group">
                            <label for="editQuirofanoEstado">Estado</label>
                            <select id="editQuirofanoEstado" name="estado" required>
                                <option value="programado" ${ticket.estado === 'programado' ? 'selected' : ''}>Programado</option>
                                <option value="cirugia" ${ticket.estado === 'cirugia' ? 'selected' : ''}>En Cirugía</option>
                                <option value="terminado" ${ticket.estado === 'terminado' ? 'selected' : ''}>Terminado</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoExamenesPrequirurgicos">
                                <input type="checkbox" id="editQuirofanoExamenesPrequirurgicos" name="examenesPrequirurgicos" ${ticket.examenesPrequirurgicos ? 'checked' : ''} style="margin-right: 8px;">
                                Exámenes Pre Quirúrgicos
                            </label>
                            <small style="display: block; color: #666; margin-top: 4px;">
                                Marque si el paciente requiere exámenes antes de la cirugía
                            </small>
                            
                            <!-- Estado de los exámenes en edición -->
                            <div id="editExamenesStatusContainer" style="display: ${ticket.examenesPrequirurgicos ? 'block' : 'none'}; margin-top: 8px;">
                                <label for="editQuirofanoExamenesStatus" style="font-size: 13px; color: #555;">
                                    Estado de los exámenes:
                                </label>
                                <select id="editQuirofanoExamenesStatus" style="margin-left: 8px; padding: 2px 6px; font-size: 12px;">
                                    <option value="pendiente" ${ticket.examenesStatus === 'pendiente' || !ticket.examenesStatus ? 'selected' : ''}>⏳ Pendientes</option>
                                    <option value="realizado" ${ticket.examenesStatus === 'realizado' ? 'selected' : ''}>✅ Realizados</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <!-- Campo vacío para mantener estructura -->
                        </div>
                    </div>

                    <div class="form-group full-width">
                        <label for="editQuirofanoMotivo">Motivo/Descripción del Procedimiento</label>
                        <textarea id="editQuirofanoMotivo" name="observaciones" placeholder="Describa el motivo y detalles del procedimiento quirúrgico" required>${ticket.observaciones || ''}</textarea>
                    </div>

                    <!-- Horas automáticas del sistema - Solo lectura y progresivas -->
                    <div class="form-row">
                        <div class="form-group">
                            <label>Hora de Llegada (Automática)</label>
                            <input type="text" value="${ticket.horaLlegada || 'No registrada'}" readonly class="readonly-field">
                        </div>
                        ${(ticket.estado === 'cirugia' || ticket.estado === 'terminado') ? `
                        <div class="form-group">
                            <label>Hora de Atención (Automática)</label>
                            <input type="text" value="${ticket.horaAtencion || 'Pendiente'}" readonly class="readonly-field">
                        </div>
                        ` : `
                        <div class="form-group">
                            <!-- Campo vacío para mantener el diseño -->
                        </div>
                        `}
                    </div>

                    ${ticket.estado === 'terminado' ? `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Hora de Finalización (Automática)</label>
                            <input type="text" value="${ticket.horaFinalizacion || 'Pendiente'}" readonly class="readonly-field">
                        </div>
                        <div class="form-group">
                            <!-- Campo vacío para mantener el diseño -->
                        </div>
                    </div>
                    ` : ''}

                    <button type="submit" class="btn-submit"><i class="fas fa-save"></i> Guardar Cambios</button>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Event listener para el formulario de edición
    document.getElementById('quirofanoEditForm').addEventListener('submit', handleQuirofanoEdit);
    
    // Event listener para el checkbox de exámenes en edición
    const editExamenesCheckbox = document.getElementById('editQuirofanoExamenesPrequirurgicos');
    const editExamenesStatusContainer = document.getElementById('editExamenesStatusContainer');
    
    if (editExamenesCheckbox && editExamenesStatusContainer) {
        editExamenesCheckbox.addEventListener('change', function() {
            if (this.checked) {
                editExamenesStatusContainer.style.display = 'block';
            } else {
                editExamenesStatusContainer.style.display = 'none';
            }
        });
    }
    

}

// Función para manejar la edición
function handleQuirofanoEdit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const ticket = quirofanoTickets.find(t => t.randomId === quirofanoCurrentEditingId);
    
    if (!ticket) return;
    
    // Obtener valores directamente del formulario para asegurar que se capturen
    const doctorAtiende = document.getElementById('editQuirofanoDoctorAtiende').value;
    const asistenteAtiende = document.getElementById('editQuirofanoAsistenteAtiende').value;
    
    // Combinar doctor y asistente como en consultas
    let medicoAtiende = '';
    if (doctorAtiende && asistenteAtiende) {
        medicoAtiende = `${doctorAtiende}, ${asistenteAtiende}`;
    } else if (doctorAtiende) {
        medicoAtiende = doctorAtiende;
    } else if (asistenteAtiende) {
        medicoAtiende = asistenteAtiende;
    }
    
    const updatedData = {
        ...ticket,
        nombreMascota: document.getElementById('editQuirofanoMascota').value,
        nombrePropietario: document.getElementById('editQuirofanoNombre').value,
        cedula: document.getElementById('editQuirofanoCedula').value,
        correo: document.getElementById('editQuirofanoCorreo').value,
        telefono: document.getElementById('editQuirofanoTelefono').value,
        tipoMascota: document.getElementById('editQuirofanoTipoMascota').value,
        raza: document.getElementById('editQuirofanoRaza').value,
        peso: document.getElementById('editQuirofanoPeso').value,
        edad: document.getElementById('editQuirofanoEdad').value,
        idPaciente: document.getElementById('editQuirofanoIdPaciente').value,
        fechaProgramada: document.getElementById('editQuirofanoFecha').value,
        horaProgramada: document.getElementById('editQuirofanoHora').value,
        tipoUrgencia: document.getElementById('editQuirofanoUrgencia').value,
        doctorAtiende: doctorAtiende,
        asistenteAtiende: asistenteAtiende,
        medicoAtiende: medicoAtiende,
        veterinario: doctorAtiende, // Mantener compatibilidad hacia atrás
        asistente: asistenteAtiende, // Mantener compatibilidad hacia atrás
        procedimiento: document.getElementById('editQuirofanoProcedimiento').value,
        estado: document.getElementById('editQuirofanoEstado').value,
        observaciones: document.getElementById('editQuirofanoMotivo').value,
        examenesPrequirurgicos: document.getElementById('editQuirofanoExamenesPrequirurgicos').checked,
        examenesStatus: document.getElementById('editQuirofanoExamenesPrequirurgicos').checked ? 
            document.getElementById('editQuirofanoExamenesStatus').value : null,
        fechaModificacion: new Date().toISOString(),
        modificadoPor: sessionStorage.getItem('userName') || 'Usuario'
    };
    
    // Actualizar horas automáticamente según el cambio de estado
    const nuevoEstado = document.getElementById('editQuirofanoEstado').value;
    const estadoAnterior = ticket.estado;
    
    // Si cambia a "cirugia" y no tenía hora de atención, agregarla
    if (nuevoEstado === 'cirugia' && estadoAnterior !== 'cirugia' && !ticket.horaAtencion) {
        updatedData.horaAtencion = new Date().toLocaleTimeString('es-ES', { hour12: false });
    }
    
    // Si cambia a "terminado" y no tenía hora de finalización, agregarla
    if (nuevoEstado === 'terminado' && estadoAnterior !== 'terminado' && !ticket.horaFinalizacion) {
        updatedData.horaFinalizacion = new Date().toLocaleTimeString('es-ES', { hour12: false });
    }
    
    // Debug: Verificar que se estén capturando los datos
    console.log('Datos a actualizar:', updatedData);
    console.log('Cédula:', updatedData.cedula);
    console.log('ID Paciente:', updatedData.idPaciente);
    
    // Actualizar en Firebase
    quirofanoFirebaseRef.child(ticket.firebaseKey).update(updatedData)
        .then(() => {
            showNotification('Ticket actualizado exitosamente', 'success');
            closeQuirofanoModal();
            loadQuirofanoTickets();
        })
        .catch((error) => {
            console.error('Error al actualizar ticket:', error);
            showNotification('Error al actualizar el ticket', 'error');
        });
}

// Eliminar funciones de cambio de estado ya que ahora se hace desde el modal de edición
// function changeQuirofanoStatus() - ELIMINADA
// function updateQuirofanoStatus() - ELIMINADA

// Función para eliminar ticket
function deleteQuirofanoTicket(randomId) {
    const ticket = quirofanoTickets.find(t => t.randomId === randomId);
    if (!ticket) return;

    // Crear modal de confirmación personalizado
    showQuirofanoDeleteConfirmModal(ticket);
}

// Función para mostrar modal de confirmación de eliminación
function showQuirofanoDeleteConfirmModal(ticket) {
    const modalHTML = `
        <div class="quirofano-delete-modal" id="quirofanoDeleteModal">
            <div class="quirofano-delete-modal-content">
                <div class="quirofano-delete-modal-header">
                    <div class="quirofano-delete-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Eliminar Ticket</h3>
                </div>
                
                <div class="quirofano-delete-modal-body">
                    <div class="quirofano-pet-info">
                        <i class="fas fa-paw"></i>
                        <span>${ticket.nombreMascota}</span>
                    </div>
                    <p>¿Estás seguro que deseas eliminar el ticket #${ticket.numero}?</p>
                    <p class="quirofano-delete-warning">Esta acción no se puede deshacer.</p>
                </div>
                
                <div class="quirofano-delete-modal-actions">
                    <button class="quirofano-delete-btn-cancelar" onclick="closeQuirofanoDeleteModal()">
                        Cancelar
                    </button>
                    <button class="quirofano-delete-btn-eliminar" onclick="confirmDeleteQuirofanoTicket('${ticket.randomId}')">
                        <i class="fas fa-trash"></i>
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Agregar event listener para cerrar con click fuera del modal
    document.getElementById('quirofanoDeleteModal').addEventListener('click', (e) => {
        if (e.target.classList.contains('quirofano-delete-modal')) {
            closeQuirofanoDeleteModal();
        }
    });
}

// Función para cerrar modal de confirmación de eliminación
function closeQuirofanoDeleteModal() {
    const modal = document.getElementById('quirofanoDeleteModal');
    if (modal) {
        modal.remove();
    }
}

// Función para confirmar eliminación
function confirmDeleteQuirofanoTicket(randomId) {
    const ticket = quirofanoTickets.find(t => t.randomId === randomId);
    if (!ticket) return;

    quirofanoFirebaseRef.child(ticket.firebaseKey).remove()
        .then(() => {
            showNotification('Ticket eliminado exitosamente', 'success');
            closeQuirofanoDeleteModal();
            closeQuirofanoModal();
            loadQuirofanoTickets();
        })
        .catch((error) => {
            console.error('Error al eliminar ticket:', error);
            showNotification('Error al eliminar el ticket', 'error');
        });
}

// Función para terminar cirugía
function endQuirofanoSurgery(randomId) {
    const ticket = quirofanoTickets.find(t => t.randomId === randomId);
    if (!ticket) return;

    if (ticket.estado === 'terminado') {
        showNotification('Esta cirugía ya está terminada', 'info');
        return;
    }

    if (!confirm('¿Está seguro de que desea marcar esta cirugía como terminada?')) {
        return;
    }

    const updatedData = {
        estado: 'terminado',
        fechaTerminacion: new Date().toISOString(),
        terminadoPor: sessionStorage.getItem('userName') || 'Usuario',
        horaFinalizacion: new Date().toLocaleTimeString('es-ES', { hour12: false })
    };

    quirofanoFirebaseRef.child(ticket.firebaseKey).update(updatedData)
        .then(() => {
            showNotification('Cirugía marcada como terminada', 'success');
            loadQuirofanoTickets();
        })
        .catch((error) => {
            console.error('Error al terminar cirugía:', error);
            showNotification('Error al terminar la cirugía', 'error');
        });
}

// Función para formatear fecha específica de quirófano
function formatQuirofanoDate(dateString) {
    if (!dateString) return 'No especificada';
    
    try {
        // Evitar problemas de zona horaria usando split en lugar de new Date()
        const [year, month, day] = dateString.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            weekday: 'short'
        };
        return date.toLocaleDateString('es-ES', options);
    } catch (error) {
        return dateString;
    }
}

// Función para cerrar modal
function closeQuirofanoModal() {
    const modals = document.querySelectorAll('.quirofano-modal');
    modals.forEach(modal => modal.remove());
    quirofanoCurrentEditingId = null;
}

// Funciones auxiliares
function getEstadoQuirofanoLabel(estado) {
    const estados = {
        'programado': 'Programado',
        'cirugia': 'En Cirugía',
        'terminado': 'Terminado'
    };
    return estados[estado] || estado;
}

function getUrgenciaQuirofanoLabel(urgencia) {
    const urgencias = {
        'emergencia': 'EMERGENCIA',
        'alta': 'URGENTE',
        'media': 'PROGRAMADO',
        'normal': 'REGULAR'
    };
    return urgencias[urgencia] || urgencia;
}

// Funciones auxiliares para loading y notificaciones (si no están disponibles globalmente)
function showLoading() {
    // Si existe la función global, la usa, sino no hace nada
    if (window.showLoading) {
        window.showLoading();
    }
}

function hideLoading() {
    // Si existe la función global, la usa, sino no hace nada
    if (window.hideLoading) {
        window.hideLoading();
    }
}

function showNotification(message, type = 'info') {
    // Si existe la función global, la usa, sino usa console.log
    if (window.showNotification) {
        window.showNotification(message, type);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

function getTipoMascotaLabel(tipo) {
    const tipos = {
        'perro': 'Perro',
        'gato': 'Gato',
        'conejo': 'Conejo',
        'ave': 'Ave',
        'reptil': 'Reptil',
        'otro': 'Otro'
    };
    return tipos[tipo] || tipo;
}





// Función para marcar exámenes como realizados
function marcarExamenesRealizados(randomId) {
    const ticket = quirofanoTickets.find(t => t.randomId === randomId);
    if (!ticket) {
        showNotification('Ticket no encontrado', 'error');
        return;
    }
    
    if (!ticket.examenesPrequirurgicos) {
        showNotification('Este ticket no requiere exámenes prequirúrgicos', 'warning');
        return;
    }
    
    if (ticket.examenesStatus === 'realizado') {
        showNotification('Los exámenes ya están marcados como realizados', 'info');
        return;
    }
    
    // Confirmar la acción
    if (!confirm('¿Está seguro de marcar los exámenes prequirúrgicos como realizados?')) {
        return;
    }
    
    showLoading();
    
    // Actualizar el ticket
    const updatedData = {
        ...ticket,
        examenesStatus: 'realizado',
        fechaModificacion: new Date().toISOString(),
        modificadoPor: sessionStorage.getItem('userName') || 'Usuario'
    };
    
    // Guardar en Firebase
    quirofanoFirebaseRef.child(ticket.firebaseKey).update(updatedData)
        .then(() => {
            hideLoading();
            showNotification('Exámenes marcados como realizados exitosamente', 'success');
            
            // Actualizar array local
            const index = quirofanoTickets.findIndex(t => t.randomId === randomId);
            if (index !== -1) {
                quirofanoTickets[index] = updatedData;
                window.quirofanoTickets = quirofanoTickets;
            }
            
            // Actualizar contador
            if (typeof window.updatePrequirurgicoCounter === 'function') {
                window.updatePrequirurgicoCounter();
            }
            
            // Re-renderizar tickets
            loadQuirofanoTickets();
        })
        .catch((error) => {
            hideLoading();
            console.error('Error al actualizar exámenes:', error);
            showNotification('Error al marcar exámenes como realizados', 'error');
        });
}

// Exportar funciones necesarias globalmente
window.editQuirofanoTicket = editQuirofanoTicket;
window.deleteQuirofanoTicket = deleteQuirofanoTicket;
window.closeQuirofanoModal = closeQuirofanoModal;
window.endQuirofanoSurgery = endQuirofanoSurgery;
window.clearQuirofanoDateFilter = clearQuirofanoDateFilter;
window.setupQuirofanoFilterVisibility = setupQuirofanoFilterVisibility;
window.closeQuirofanoDeleteModal = closeQuirofanoDeleteModal;
window.confirmDeleteQuirofanoTicket = confirmDeleteQuirofanoTicket;
window.marcarExamenesRealizados = marcarExamenesRealizados;




// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Solo inicializar si estamos en la sección de quirófano
    if (window.location.hash === '#quirofano' || 
        document.getElementById('crearQuirofanoSection') || 
        document.getElementById('verQuirofanoSection')) {
        initQuirofanoModule();
    }
});

// También inicializar cuando se navegue a quirófano
window.addEventListener('hashchange', function() {
    if (window.location.hash === '#quirofano') {
        initQuirofanoModule();
    }
});

console.log('Módulo de quirófano cargado exitosamente');
