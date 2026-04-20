// Variables globales del módulo de quirófano
if (typeof window.quirofanoTickets === 'undefined') {
    window.quirofanoTickets = [];
}
// Usar la variable global directamente para evitar conflictos de redeclaración
if (typeof window.currentQuirofanoFilter === 'undefined') {
    window.currentQuirofanoFilter = 'en-preparacion';
}
let quirofanoCurrentEditingId = null;

// Variables para optimización de carga
let quirofanoActiveListener = null;
let quirofanoAllDataLoaded = false; // Flag para saber si ya se cargaron todos los datos
let quirofanoLoadDateRange = 60; // Días a cargar por defecto (últimos 60 días)



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
    // Evitar inicialización múltiple
    if (window.quirofanoModuleInitialized) {
        return;
    }
    
            // Inicializar variable global inmediatamente
        // window.quirofanoTickets ya está definido globalmente
    
    // Establecer fecha de hoy por defecto en el filtro de fecha
    const dateFilterInput = document.getElementById('quirofanoFilterDate');
    if (dateFilterInput && !dateFilterInput.value) {
        const today = new Date();
        const todayString = today.getFullYear() + '-' + 
                           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(today.getDate()).padStart(2, '0');
        dateFilterInput.value = todayString;
    }
    
    loadQuirofanoTickets();
    setupQuirofanoEventListeners();
    
    // Configurar visibilidad del filtro "Todos" basado en el rol del usuario
    setupQuirofanoFilterVisibility();
    
    // Marcar módulo como inicializado
    window.quirofanoModuleInitialized = true;
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
        }
    }
}

// Función para configurar acceso al módulo de quirófano según el rol
function setupQuirofanoFilterAccess() {
    const userRole = sessionStorage.getItem('userRole');
    const allowedRoles = ['admin', 'recepcion', 'consulta_externa', 'quirofano', 'laboratorio'];
    
    if (!allowedRoles.includes(userRole)) {
        return false;
    }
    
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
    
    // Configurar el checkbox de vía
    const viaCheckbox = document.getElementById('quirofanoVia');
    const viaStatusContainer = document.getElementById('viaStatusContainer');
    
    if (viaCheckbox && viaStatusContainer) {
        viaCheckbox.addEventListener('change', function() {
            if (this.checked) {
                viaStatusContainer.style.display = 'block';
            } else {
                viaStatusContainer.style.display = 'none';
            }
        });
    }
    
    // Controlar visibilidad del campo "vía" según el rol del usuario
    const userRole = sessionStorage.getItem('userRole');
    const viaField = document.querySelector('.quirofano-via-field');
    if (viaField) {
        if (userRole === 'visitas') {
            viaField.style.display = 'none';
        } else {
            viaField.style.display = '';
        }
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
            window.currentQuirofanoFilter = btn.dataset.filter;
            
            // Si se hace clic en "Todos" y no se han cargado todos los datos, cargarlos
            if (btn.dataset.filter === 'todos' && !quirofanoAllDataLoaded) {
                loadQuirofanoTickets(true);
                return;
            }
            
            const searchTerm = document.getElementById('quirofanoSearchInput')?.value || '';
            const dateFilter = document.getElementById('quirofanoFilterDate')?.value || '';
            renderQuirofanoTicketsWithDateFilter(window.currentQuirofanoFilter, searchTerm, dateFilter);
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
// Incluye validaciones de seguridad para evitar errores cuando los elementos del DOM no existen
function handleQuirofanoFormSubmit(e) {
    e.preventDefault();
    
    // Verificar que el formulario existe antes de procesar
    if (!e.target || !e.target.id) {
        showNotification('Error: Formulario no válido', 'error');
        return;
    }
    
    // Función auxiliar para obtener valor de campo de forma segura
    const getFieldValue = (fieldId, defaultValue = '') => {
        const element = document.getElementById(fieldId);
        if (!element) {
            console.warn(`Campo ${fieldId} no encontrado`);
            return defaultValue;
        }
        return element.value || defaultValue;
    };
    
    // Función auxiliar para obtener valor de checkbox de forma segura
    const getCheckboxValue = (fieldId, defaultValue = false) => {
        const element = document.getElementById(fieldId);
        if (!element) {
            console.warn(`Checkbox ${fieldId} no encontrado`);
            return defaultValue;
        }
        return element.checked || defaultValue;
    };
    
    const formData = new FormData(e.target);
    const ticketData = {
        randomId: generateRandomId(),
        numero: getNextQuirofanoTicketNumber(),
        nombreMascota: getFieldValue('quirofanoMascota'),
        nombrePropietario: getFieldValue('quirofanoNombre'),
        cedula: getFieldValue('quirofanoCedula'),
        correo: getFieldValue('quirofanoCorreo'),
        telefono: getFieldValue('quirofanoTelefono'),
        factura: getFieldValue('quirofanoFactura'),
        tipoMascota: getFieldValue('quirofanoTipoMascota'),
        raza: getFieldValue('quirofanoRaza'),
        peso: getFieldValue('quirofanoPeso'),
        edad: getFieldValue('quirofanoEdad'),
        idPaciente: getFieldValue('quirofanoIdPaciente'),
        procedimiento: getFieldValue('quirofanoProcedimiento'),
        tipoUrgencia: getFieldValue('quirofanoUrgencia'),
        observaciones: getFieldValue('quirofanoMotivo'),
        examenesPrequirurgicos: getCheckboxValue('quirofanoExamenesPrequirurgicos'),
        examenesStatus: getCheckboxValue('quirofanoExamenesPrequirurgicos') ? 
            getFieldValue('quirofanoExamenesStatus') : null,
        via: getCheckboxValue('quirofanoVia'),
        viaStatus: getCheckboxValue('quirofanoVia') ? 
            getFieldValue('quirofanoViaStatus') : null,
        fechaCreacion: new Date().toISOString(),
        fechaProgramada: getFieldValue('quirofanoFecha'),
        horaProgramada: getFieldValue('quirofanoHora'),
        estado: 'en-preparacion',
        creadoPor: sessionStorage.getItem('userName') || 'Usuario',
        doctorAtiende: getFieldValue('quirofanoDoctorAtiende'),
        asistenteAtiende: getFieldValue('quirofanoAsistenteAtiende'),
        // Combinar doctor y asistente como en consultas
        medicoAtiende: (() => {
            const doctor = getFieldValue('quirofanoDoctorAtiende');
            const asistente = getFieldValue('quirofanoAsistenteAtiende');
            if (doctor && asistente) {
                return `${doctor}, ${asistente}`;
            } else if (doctor) {
                return doctor;
            } else if (asistente) {
                return asistente;
            }
            return '';
        })(),
        empresa: getUserEmpresa(), // Agregar empresa del usuario
        // Horas automáticas del sistema
        horaLlegada: new Date().toLocaleTimeString('es-ES', { hour12: false }),
        horaAtencion: null,
        horaFinalizacion: null
    };

    // Verificar que se estén capturando los datos en creación

    // Validación básica
    if (!ticketData.nombreMascota || !ticketData.nombrePropietario || !ticketData.procedimiento) {
        showNotification('Por favor, complete todos los campos obligatorios', 'error');
        return;
    }
    
    // Validación adicional: verificar que los campos críticos tengan valores válidos
    if (ticketData.nombreMascota.trim() === '' || 
        ticketData.nombrePropietario.trim() === '' || 
        ticketData.procedimiento.trim() === '') {
        showNotification('Los campos nombre de mascota, propietario y procedimiento no pueden estar vacíos', 'error');
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
            try {
                // Guardar paciente en la base de datos relacional
                if (window.patientDatabase && ticketData.cedula) {
                    window.patientDatabase.savePatientFromTicket({
                        cedula: ticketData.cedula,
                        nombre: ticketData.nombrePropietario,
                        telefono: ticketData.telefono,
                        correo: ticketData.correo,
                        mascota: ticketData.nombreMascota,
                        tipoMascota: ticketData.tipoMascota,
                        idPaciente: ticketData.idPaciente,
                        raza: ticketData.raza,
                        edad: ticketData.edad,
                        peso: ticketData.peso,
                        sexo: ticketData.sexo
                    }).catch(err => console.error('Error guardando en BD de pacientes:', err));
                }
                
                hideLoading();
                showNotification('Ticket de quirófano creado exitosamente', 'success');
                
                const form = document.getElementById('quirofanoTicketForm');
                if (form) {
                    form.reset();
                }
                
                loadQuirofanoTickets();
                
                // Actualizar variable global inmediatamente después de crear
                setTimeout(() => {
                    try {
                        // Actualizar contador de exámenes prequirúrgicos
                        if (typeof window.updatePrequirurgicoCounter === 'function') {
                            window.updatePrequirurgicoCounter();
                        }
                        
                        // Actualizar contador de vía
                        if (typeof window.updateViaCounter === 'function') {
                            window.updateViaCounter();
                        }
                        
                        // Redirigir a la vista de ver tickets después de actualizar
                        redirectToQuirofanoView();
                    } catch (err) {
                        console.error('Error en actualizaciones post-creación:', err);
                    }
                }, 500);
            } catch (err) {
                // Si hay un error en el procesamiento posterior, no mostrar error al usuario
                // porque el ticket ya se creó exitosamente en Firebase
                console.error('Error en procesamiento post-creación:', err);
                hideLoading();
                showNotification('Ticket de quirófano creado exitosamente', 'success');
            }
        })
        .catch((error) => {
            hideLoading();
            console.error('Error real al crear el ticket en Firebase:', error);
            showNotification('Error al crear el ticket', 'error');
        });
}

// Función específica para redirigir a la vista de tickets de quirófano
function redirectToQuirofanoView() {
    // Método 1: Buscar y hacer clic en el botón/enlace de ver tickets
    const verTicketsLink = document.querySelector('a[onclick*="verQuirofano"]') || 
                          document.querySelector('button[onclick*="verQuirofano"]') ||
                          document.querySelector('[data-section="verQuirofanoSection"]') ||
                          document.querySelector('.nav-item[onclick*="verQuirofano"]');
    
    if (verTicketsLink) {
        verTicketsLink.click();
        return;
    }
    
    // Método 2: Manipulación directa del DOM si los elementos existen
    const crearSection = document.getElementById('crearQuirofanoSection');
    const verSection = document.getElementById('verQuirofanoSection');
    
    if (crearSection && verSection) {
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
        
        return;
    }
    
    // Método 3: Intentar con hash de URL
    if (window.location.hash !== '#quirofano-ver') {
        window.location.hash = '#quirofano-ver';
        
        // Trigger hashchange event
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
}

// Función auxiliar para procesar tickets (reutilizable)
function processQuirofanoTicket(ticketData, firebaseKey) {
    const ticket = {
        firebaseKey: firebaseKey,
        ...ticketData
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
    
    return ticket;
}

// Función para cargar tickets desde Firebase (OPTIMIZADA - carga diferida)
function loadQuirofanoTickets(loadAllData = false) {
    showLoading();
    
    // Desconectar listener anterior si existe
    if (quirofanoActiveListener) {
        quirofanoFirebaseRef.off('value', quirofanoActiveListener);
        quirofanoFirebaseRef.off('child_added', quirofanoActiveListener.handleChildAdded);
        quirofanoFirebaseRef.off('child_changed', quirofanoActiveListener.handleChildChanged);
        quirofanoActiveListener = null;
    }
    
    // Si ya se cargaron todos los datos y no se solicita recarga completa, usar listeners incrementales
    if (quirofanoAllDataLoaded && !loadAllData) {
        setupQuirofanoIncrementalListeners();
        hideLoading();
        return;
    }
    
    // Calcular rango de fechas a cargar
    let cutoffDate = null;
    if (!loadAllData) {
        const today = new Date();
        const daysAgo = new Date(today);
        daysAgo.setDate(today.getDate() - quirofanoLoadDateRange);
        cutoffDate = daysAgo.toISOString().split('T')[0];
    }
    
    // Carga inicial limitada o completa según parámetro
    const loadQuery = loadAllData 
        ? quirofanoFirebaseRef.once('value')
        : quirofanoFirebaseRef.orderByChild('fechaCreacion').startAt(cutoffDate).once('value');
    
    loadQuery.then((snapshot) => {
        window.quirofanoTickets = [];
        
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const ticket = processQuirofanoTicket(childSnapshot.val(), childSnapshot.key);
                window.quirofanoTickets.push(ticket);
            });
        }
        
        quirofanoAllDataLoaded = loadAllData;
        hideLoading();
        renderQuirofanoTicketsWithDateFilter(window.currentQuirofanoFilter, '', '');
        
        // Actualizar contador de exámenes prequirúrgicos
        if (typeof window.updatePrequirurgicoCounter === 'function') {
            window.updatePrequirurgicoCounter();
        }
        
        // Actualizar contador de vía
        if (typeof window.updateViaCounter === 'function') {
            window.updateViaCounter();
        }
        
        // Configurar listeners incrementales para cambios futuros
        setupQuirofanoIncrementalListeners();
    }).catch((error) => {
        console.error('Error cargando tickets de quirófano:', error);
        hideLoading();
    });
}

// Configurar listeners incrementales (más eficientes que 'value')
function setupQuirofanoIncrementalListeners() {
    const handleChildAdded = (snapshot) => {
        const ticket = processQuirofanoTicket(snapshot.val(), snapshot.key);
        
        // Solo agregar si no existe
        if (!window.quirofanoTickets.some(t => t.firebaseKey === ticket.firebaseKey)) {
            window.quirofanoTickets.push(ticket);
            
            // Actualizar UI solo si es necesario (debounce)
            clearTimeout(window.quirofanoUpdateTimer);
            window.quirofanoUpdateTimer = setTimeout(() => {
                const dateFilter = document.getElementById('quirofanoFilterDate')?.value || '';
                renderQuirofanoTicketsWithDateFilter(window.currentQuirofanoFilter, '', dateFilter);
            }, 300);
        }
    };
    
    const handleChildChanged = (snapshot) => {
        const ticket = processQuirofanoTicket(snapshot.val(), snapshot.key);
        const index = window.quirofanoTickets.findIndex(t => t.firebaseKey === snapshot.key);
        
        if (index !== -1) {
            window.quirofanoTickets[index] = ticket;
        } else {
            window.quirofanoTickets.push(ticket);
        }
        
        // Actualizar UI solo si es necesario (debounce)
        clearTimeout(window.quirofanoUpdateTimer);
        window.quirofanoUpdateTimer = setTimeout(() => {
            const dateFilter = document.getElementById('quirofanoFilterDate')?.value || '';
            renderQuirofanoTicketsWithDateFilter(window.currentQuirofanoFilter, '', dateFilter);
        }, 300);
    };
    
    const handleChildRemoved = (snapshot) => {
        const index = window.quirofanoTickets.findIndex(t => t.firebaseKey === snapshot.key);
        if (index !== -1) {
            window.quirofanoTickets.splice(index, 1);
            
            // Actualizar UI
            const dateFilter = document.getElementById('quirofanoFilterDate')?.value || '';
            renderQuirofanoTicketsWithDateFilter(window.currentQuirofanoFilter, '', dateFilter);
        }
    };
    
    // Configurar listeners incrementales
    quirofanoFirebaseRef.on('child_added', handleChildAdded);
    quirofanoFirebaseRef.on('child_changed', handleChildChanged);
    quirofanoFirebaseRef.on('child_removed', handleChildRemoved);
    
    // Guardar referencias
    quirofanoActiveListener = {
        handleChildAdded,
        handleChildChanged,
        handleChildRemoved
    };
}

// Función para renderizar tickets
function renderQuirofanoTickets(filter = 'todos', searchTerm = '') {
    // Usar la función con filtro de fecha, pasando fecha vacía para que use hoy por defecto
    const dateFilter = document.getElementById('quirofanoFilterDate')?.value || '';
    renderQuirofanoTicketsWithDateFilter(filter, searchTerm, dateFilter);
}

// Función para renderizar tickets con filtro de fecha
function renderQuirofanoTicketsWithDateFilter(filter = 'todos', searchTerm = '', dateFilter = '') {
    const container = document.getElementById('quirofanoTicketContainer');
    if (!container) return;

    let filteredTickets = window.quirofanoTickets;
    const userRole = sessionStorage.getItem('userRole');

    // Filtrar por empresa primero
    const currentEmpresa = getCurrentEmpresa();
    filteredTickets = filteredTickets.filter(t => {
        // Si el ticket no tiene empresa, asignarlo a veterinaria_smp (migración automática)
        if (!t.empresa) {
            return currentEmpresa === 'veterinaria_smp';
        }
        return t.empresa === currentEmpresa;
    });

    // Si no hay dateFilter específico, usar la fecha de hoy por defecto
    let targetDate = dateFilter;
    if (!targetDate) {
        const today = new Date();
        targetDate = today.getFullYear() + '-' + 
                    String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(today.getDate()).padStart(2, '0');
    }

    // Luego filtrar por fecha (siempre aplicar filtro de fecha)
    filteredTickets = filteredTickets.filter(ticket => {
        if (!ticket.fechaProgramada) return false;
        return ticket.fechaProgramada === targetDate;
    });

    // Luego filtrar por estado si no es "todos"
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
            ticket.idPaciente?.toLowerCase().includes(term) ||
            ticket.numero?.toString().includes(term)
        );
    }

    // Ordenar por fecha de creación (más recientes primero)
    filteredTickets.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));

    if (filteredTickets.length === 0) {
        container.innerHTML = `
        <div class="quirofano-no-data">
            <i class="fas fa-cut"></i>
            <p>No hay tickets de quirófano para mostrar${dateFilter ? ` para la fecha ${dateFilter}` : ' para hoy'}</p>
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
                ${ticket.via && sessionStorage.getItem('userRole') !== 'visitas' ? `<p><i class="fas fa-syringe"></i> <strong>Vía:</strong> 
                    ${ticket.viaStatus === 'realizado' ? 
                        '<span style="color: #28a745; font-weight: bold;">✅ Realizada</span>' : 
                        `<span style="color: #ff6b35; font-weight: bold;">⏳ Pendiente</span>
                         <button onclick="marcarViaRealizada('${ticket.randomId}')" 
                                 class="btn-examenes-realizados" 
                                 title="Marcar vía como realizada">
                            <i class="fas fa-check"></i> Marcar como realizada
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
                ${ticket.estado === 'en-preparacion' ? `
                <button class="quirofano-action-btn quirofano-btn-listo" onclick="event.stopPropagation(); marcarListoParaCirugia('${ticket.randomId}')">
                    <i class="fas fa-thumbs-up"></i>
                    Listo para Cirugía
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
    const todaysTickets = window.quirofanoTickets.filter(ticket => {
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
            renderQuirofanoTicketsWithDateFilter(window.currentQuirofanoFilter, searchTerm, dateFilter);
}

// Función para manejar filtro por fecha
function handleQuirofanoDateFilter(e) {
    const selectedDate = e.target.value;
    const searchTerm = document.getElementById('quirofanoSearchInput')?.value || '';
    
    // Si se selecciona una fecha antigua y no se han cargado todos los datos, cargarlos
    if (selectedDate) {
        const selectedDateObj = new Date(selectedDate);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - quirofanoLoadDateRange);
        
        if (selectedDateObj < cutoffDate && !quirofanoAllDataLoaded) {
            // Fecha fuera del rango cargado, cargar todos los datos
            loadQuirofanoTickets(true);
            return;
        }
    }
    
    renderQuirofanoTicketsWithDateFilter(window.currentQuirofanoFilter, searchTerm, selectedDate);
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
        // En lugar de limpiar, establecer fecha de hoy
        const today = new Date();
        const todayString = today.getFullYear() + '-' + 
                           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(today.getDate()).padStart(2, '0');
        dateFilter.value = todayString;
        
        const searchTerm = document.getElementById('quirofanoSearchInput')?.value || '';
        renderQuirofanoTicketsWithDateFilter(window.currentQuirofanoFilter, searchTerm, todayString);
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
    const ticket = window.quirofanoTickets.find(t => t.randomId === randomId);
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
                            <input type="text" id="editQuirofanoCedula" name="cedula" value="${ticket.cedula || ''}" placeholder="Cualquier texto válido">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoCorreo">Correo Electrónico</label>
                            <input type="text" id="editQuirofanoCorreo" name="correo" value="${ticket.correo || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editQuirofanoTelefono">Teléfono</label>
                            <input type="tel" id="editQuirofanoTelefono" name="telefono" value="${ticket.telefono || ''}">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoFactura">Número de Factura</label>
                            <input type="text" id="editQuirofanoFactura" name="factura" value="${ticket.factura || ''}">
                        </div>
                        <div class="form-group">
                            <!-- Campo vacío para mantener el diseño de dos columnas -->
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
                        <div class="form-group edit-quirofano-via-field" style="display: ${sessionStorage.getItem('userRole') === 'visitas' ? 'none' : ''};">
                            <label for="editQuirofanoVia">
                                <input type="checkbox" id="editQuirofanoVia" name="via" ${ticket.via ? 'checked' : ''} style="margin-right: 8px;">
                                Vía
                            </label>
                            <small style="display: block; color: #666; margin-top: 4px;">
                                Marque si el paciente requiere vía
                            </small>
                            
                            <!-- Estado de la vía en edición -->
                            <div id="editViaStatusContainer" style="display: ${ticket.via ? 'block' : 'none'}; margin-top: 8px;">
                                <label for="editQuirofanoViaStatus" style="font-size: 13px; color: #555;">
                                    Estado de la vía:
                                </label>
                                <select id="editQuirofanoViaStatus" style="margin-left: 8px; padding: 2px 6px; font-size: 12px;">
                                    <option value="pendiente" ${ticket.viaStatus === 'pendiente' || !ticket.viaStatus ? 'selected' : ''}>⏳ Pendiente</option>
                                    <option value="realizado" ${ticket.viaStatus === 'realizado' ? 'selected' : ''}>✅ Realizada</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="editQuirofanoDoctorAtiende"><i class="fas fa-user-md"></i> Doctor que atiende</label>
                            <select id="editQuirofanoDoctorAtiende" name="doctorAtiende">
                                <option value="">Seleccione un doctor</option>
                                <!-- Los doctores se cargarán dinámicamente desde Firebase -->
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editQuirofanoAsistenteAtiende"><i class="fas fa-user-nurse"></i> Asistente que atiende</label>
                            <select id="editQuirofanoAsistenteAtiende" name="asistenteAtiende">
                                <option value="">Seleccione un asistente</option>
                                <!-- Los asistentes se cargarán dinámicamente desde Firebase -->
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
                                <option value="en-preparacion" ${ticket.estado === 'en-preparacion' ? 'selected' : ''}>En Preparación</option>
                                <option value="listo-para-cirugia" ${ticket.estado === 'listo-para-cirugia' ? 'selected' : ''}>Listo para Cirugía</option>
                                <option value="en-cirugia" ${ticket.estado === 'en-cirugia' ? 'selected' : ''}>En Cirugía</option>
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
    
    // Cargar doctores y asistentes dinámicamente en los selects del modal de edición
    if (window.loadDoctorsIntoSelects && window.loadAssistantsIntoSelects) {
        loadDoctorsIntoSelects().then(() => {
            // Después de cargar, seleccionar el doctor si existe
            const editQuirofanoDoctorSelect = document.getElementById('editQuirofanoDoctorAtiende');
            if (editQuirofanoDoctorSelect && doctorActual) {
                editQuirofanoDoctorSelect.value = doctorActual;
            }
        });
        loadAssistantsIntoSelects().then(() => {
            // Después de cargar, seleccionar el asistente si existe
            const editQuirofanoAsistenteSelect = document.getElementById('editQuirofanoAsistenteAtiende');
            if (editQuirofanoAsistenteSelect && asistenteActual) {
                editQuirofanoAsistenteSelect.value = asistenteActual;
            }
        });
    }
    
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
    
    // Event listener para el checkbox de vía en edición
    const editViaCheckbox = document.getElementById('editQuirofanoVia');
    const editViaStatusContainer = document.getElementById('editViaStatusContainer');
    
    if (editViaCheckbox && editViaStatusContainer) {
        editViaCheckbox.addEventListener('change', function() {
            if (this.checked) {
                editViaStatusContainer.style.display = 'block';
            } else {
                editViaStatusContainer.style.display = 'none';
            }
        });
    }
    

}

// Función para manejar la edición
function handleQuirofanoEdit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const ticket = window.quirofanoTickets.find(t => t.randomId === quirofanoCurrentEditingId);
    
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
        factura: document.getElementById('editQuirofanoFactura').value,
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
        via: document.getElementById('editQuirofanoVia') ? document.getElementById('editQuirofanoVia').checked : false,
        viaStatus: document.getElementById('editQuirofanoVia') && document.getElementById('editQuirofanoVia').checked ? 
            (document.getElementById('editQuirofanoViaStatus') ? document.getElementById('editQuirofanoViaStatus').value : 'pendiente') : null,
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
    
    // Actualizar en Firebase
    quirofanoFirebaseRef.child(ticket.firebaseKey).update(updatedData)
        .then(() => {
            try {
                showNotification('Ticket actualizado exitosamente', 'success');
                closeQuirofanoModal();
                loadQuirofanoTickets();
                
                // Actualizar contadores
                setTimeout(() => {
                    try {
                        if (typeof window.updatePrequirurgicoCounter === 'function') {
                            window.updatePrequirurgicoCounter();
                        }
                        if (typeof window.updateViaCounter === 'function') {
                            window.updateViaCounter();
                        }
                    } catch (err) {
                        console.error('Error actualizando contadores:', err);
                    }
                }, 300);
            } catch (err) {
                // Si hay un error en el procesamiento posterior, no mostrar error al usuario
                // porque el ticket ya se actualizó exitosamente en Firebase
                console.error('Error en procesamiento post-actualización:', err);
                showNotification('Ticket actualizado exitosamente', 'success');
            }
        })
        .catch((error) => {
            console.error('Error real al actualizar el ticket en Firebase:', error);
            showNotification('Error al actualizar el ticket', 'error');
        });
}

// Eliminar funciones de cambio de estado ya que ahora se hace desde el modal de edición
// function changeQuirofanoStatus() - ELIMINADA
// function updateQuirofanoStatus() - ELIMINADA

// Función para eliminar ticket
function deleteQuirofanoTicket(randomId) {
    const ticket = window.quirofanoTickets.find(t => t.randomId === randomId);
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
    const ticket = window.quirofanoTickets.find(t => t.randomId === randomId);
    if (!ticket) return;

    quirofanoFirebaseRef.child(ticket.firebaseKey).remove()
        .then(() => {
            try {
                showNotification('Ticket eliminado exitosamente', 'success');
                closeQuirofanoDeleteModal();
                closeQuirofanoModal();
                loadQuirofanoTickets();
                
                // Actualizar contadores
                setTimeout(() => {
                    try {
                        if (typeof window.updatePrequirurgicoCounter === 'function') {
                            window.updatePrequirurgicoCounter();
                        }
                        if (typeof window.updateViaCounter === 'function') {
                            window.updateViaCounter();
                        }
                    } catch (err) {
                        console.error('Error actualizando contadores:', err);
                    }
                }, 300);
            } catch (err) {
                // Si hay un error en el procesamiento posterior, no mostrar error al usuario
                // porque el ticket ya se eliminó exitosamente en Firebase
                console.error('Error en procesamiento post-eliminación:', err);
                showNotification('Ticket eliminado exitosamente', 'success');
            }
        })
        .catch((error) => {
            console.error('Error real al eliminar el ticket en Firebase:', error);
            showNotification('Error al eliminar el ticket', 'error');
        });
}

// Función para terminar cirugía
function endQuirofanoSurgery(randomId) {
    const ticket = window.quirofanoTickets.find(t => t.randomId === randomId);
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
            try {
                showNotification('Cirugía marcada como terminada', 'success');
                loadQuirofanoTickets();
                
                // Actualizar contadores
                setTimeout(() => {
                    try {
                        if (typeof window.updatePrequirurgicoCounter === 'function') {
                            window.updatePrequirurgicoCounter();
                        }
                        if (typeof window.updateViaCounter === 'function') {
                            window.updateViaCounter();
                        }
                    } catch (err) {
                        console.error('Error actualizando contadores:', err);
                    }
                }, 300);
            } catch (err) {
                // Si hay un error en el procesamiento posterior, no mostrar error al usuario
                // porque el ticket ya se actualizó exitosamente en Firebase
                console.error('Error en procesamiento post-terminación:', err);
                showNotification('Cirugía marcada como terminada', 'success');
            }
        })
        .catch((error) => {
            console.error('Error real al terminar la cirugía en Firebase:', error);
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
        'en-preparacion': 'En Preparación',
        'listo-para-cirugia': 'Listo para Cirugía',
        'en-cirugia': 'En Cirugía',
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

// Función para marcar un ticket como listo para cirugía
// Automáticamente marca los exámenes prequirúrgicos como realizados si los requiere
function marcarListoParaCirugia(randomId) {
    const ticket = window.quirofanoTickets.find(t => t.randomId === randomId);
    if (!ticket) {
        return;
    }

    // Confirmar la acción
    if (!confirm(`¿Está seguro de marcar "${ticket.nombreMascota}" como listo para cirugía?`)) {
        return;
    }

    showLoading();

    // Actualizar el estado del ticket
    ticket.estado = 'listo-para-cirugia';
    ticket.fechaListoParaCirugia = new Date().toISOString();
    
    // Si el ticket requiere exámenes prequirúrgicos, marcarlos como realizados automáticamente
    if (ticket.examenesPrequirurgicos) {
        ticket.examenesStatus = 'realizado';
        ticket.fechaExamenesRealizados = new Date().toISOString();
    }

    // Actualizar en Firebase
    const ticketRef = quirofanoFirebaseRef.child(ticket.firebaseKey || randomId);
    const updateData = {
        estado: 'listo-para-cirugia',
        fechaListoParaCirugia: ticket.fechaListoParaCirugia
    };
    
    // Agregar datos de exámenes si es necesario
    if (ticket.examenesPrequirurgicos) {
        updateData.examenesStatus = 'realizado';
        updateData.fechaExamenesRealizados = ticket.fechaExamenesRealizados;
    }
    
    ticketRef.update(updateData)
    .then(() => {
        try {
            hideLoading();
            
            let message = `${ticket.nombreMascota} ha sido marcado como listo para cirugía`;
            if (ticket.examenesPrequirurgicos) {
                message += ' y exámenes prequirúrgicos marcados como realizados automáticamente';
            }
            
            showNotification(message, 'success');
            
            // Actualizar array local para mantener consistencia
            const index = window.quirofanoTickets.findIndex(t => t.randomId === randomId);
            if (index !== -1) {
                window.quirofanoTickets[index] = ticket;
            }
            
            // Actualizar contador de exámenes prequirúrgicos si existe la función
            if (typeof window.updatePrequirurgicoCounter === 'function') {
                window.updatePrequirurgicoCounter();
            }
            
            // Actualizar contador de vía
            if (typeof window.updateViaCounter === 'function') {
                window.updateViaCounter();
            }
            
            // Re-renderizar los tickets
            const searchTerm = document.getElementById('quirofanoSearchInput')?.value || '';
            const dateFilter = document.getElementById('quirofanoFilterDate')?.value || '';
            const currentFilter = document.querySelector('.quirofanoFilterBtn.active')?.dataset.filter || 'todos';
            
            if (dateFilter) {
                renderQuirofanoTicketsWithDateFilter(currentFilter, searchTerm, dateFilter);
            } else {
                renderQuirofanoTickets(currentFilter, searchTerm);
            }
        } catch (err) {
            // Si hay un error en el procesamiento posterior, no mostrar error al usuario
            // porque el ticket ya se actualizó exitosamente en Firebase
            console.error('Error en procesamiento post-marcado como listo:', err);
            hideLoading();
            showNotification(`${ticket.nombreMascota} ha sido marcado como listo para cirugía`, 'success');
        }
    })
    .catch((error) => {
        hideLoading();
        console.error('Error real al marcar como listo para cirugía en Firebase:', error);
        showNotification('Error al marcar como listo para cirugía', 'error');
    });
}

// Funciones auxiliares para loading y notificaciones (si no están disponibles globalmente)
function showLoading() {
    // Si existe la función global, la usa, sino no hace nada
    if (window.showLoading && window.showLoading !== showLoading) {
        window.showLoading();
    } else {
        // Fallback: mostrar el loading spinner directamente
        const loadingElement = document.querySelector('.loading-spinner, .loading, #loading');
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }
    }
}

function hideLoading() {
    // Si existe la función global, la usa, sino no hace nada
    if (window.hideLoading && window.hideLoading !== hideLoading) {
        window.hideLoading();
    } else {
        // Fallback: ocultar el loading spinner directamente
        const loadingElement = document.querySelector('.loading-spinner, .loading, #loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

// Usar la función showNotification global de index.js
// No definir una función local para evitar recursión infinita

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
    const ticket = window.quirofanoTickets.find(t => t.randomId === randomId);
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
            try {
                hideLoading();
                showNotification('Exámenes marcados como realizados exitosamente', 'success');
                
                // Actualizar array local
                const index = window.quirofanoTickets.findIndex(t => t.randomId === randomId);
                if (index !== -1) {
                    window.quirofanoTickets[index] = updatedData;
                }
                
                // Actualizar contador
                if (typeof window.updatePrequirurgicoCounter === 'function') {
                    window.updatePrequirurgicoCounter();
                }
                
                // Re-renderizar tickets
                loadQuirofanoTickets();
            } catch (err) {
                // Si hay un error en el procesamiento posterior, no mostrar error al usuario
                // porque el ticket ya se actualizó exitosamente en Firebase
                console.error('Error en procesamiento post-marcado de exámenes:', err);
                hideLoading();
                showNotification('Exámenes marcados como realizados exitosamente', 'success');
            }
        })
        .catch((error) => {
            hideLoading();
            console.error('Error real al marcar exámenes como realizados en Firebase:', error);
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

// Función para marcar vía como realizada
function marcarViaRealizada(randomId) {
    const ticket = window.quirofanoTickets.find(t => t.randomId === randomId);
    if (!ticket) {
        showNotification('Ticket no encontrado', 'error');
        return;
    }
    
    if (!ticket.via) {
        showNotification('Este ticket no requiere vía', 'warning');
        return;
    }
    
    if (ticket.viaStatus === 'realizado') {
        showNotification('La vía ya está marcada como realizada', 'info');
        return;
    }
    
    // Confirmar la acción
    if (!confirm('¿Está seguro de marcar la vía como realizada?')) {
        return;
    }
    
    showLoading();
    
    const updateData = {
        viaStatus: 'realizado'
    };
    
    // Usar firebaseKey en lugar de randomId para la referencia de Firebase
    const ticketRef = ticket.firebaseKey ? quirofanoFirebaseRef.child(ticket.firebaseKey) : quirofanoFirebaseRef.child(randomId);
    
    ticketRef.update(updateData)
        .then(() => {
            try {
                ticket.viaStatus = 'realizado';
                const searchTerm = document.getElementById('quirofanoSearchInput')?.value || '';
                const dateFilter = document.getElementById('quirofanoFilterDate')?.value || '';
                renderQuirofanoTicketsWithDateFilter(window.currentQuirofanoFilter, searchTerm, dateFilter);
                if (typeof window.updateViaCounter === 'function') {
                    window.updateViaCounter();
                }
                hideLoading();
                showNotification('Vía marcada como realizada', 'success');
            } catch (err) {
                // Si hay un error en el procesamiento posterior, no mostrar error al usuario
                // porque el ticket ya se actualizó exitosamente en Firebase
                console.error('Error en procesamiento post-marcado de vía:', err);
                hideLoading();
                showNotification('Vía marcada como realizada', 'success');
            }
        })
        .catch((error) => {
            hideLoading();
            console.error('Error real al marcar la vía como realizada en Firebase:', error);
            showNotification('Error al marcar la vía como realizada', 'error');
        });
}

window.marcarViaRealizada = marcarViaRealizada;

// Función para obtener tickets de quirófano con vía para una fecha específica
window.getQuirofanoTicketsWithViaForDate = function(date) {
    // No mostrar la vía al rol visitas
    if (sessionStorage.getItem('userRole') === 'visitas') {
        return [];
    }
    
    if (typeof window.quirofanoTickets === 'undefined' || !Array.isArray(window.quirofanoTickets)) {
        return [];
    }
    
    return window.quirofanoTickets.filter(ticket => {
        if (!ticket.via || ticket.via !== true) return false;
        if (!ticket.fechaProgramada) return false;
        const ticketDate = ticket.fechaProgramada.split('T')[0];
        return ticketDate === date;
    }).map(ticket => {
        if (!ticket.randomId && ticket.id) {
            ticket.randomId = ticket.id;
        }
        return ticket;
    });
};




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

