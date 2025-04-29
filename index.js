let currentTicketId = 1;
let isDataLoaded = false;
// Add this missing declaration
let tickets = [];

// Function to safely add event listeners
function safeAddEventListener(elementId, eventType, handler) {
  const element = document.getElementById(elementId);
  if (element) {
    element.addEventListener(eventType, handler);
  } else {
    console.warn(`Element with ID '${elementId}' not found for event listener`);
  }
}

const crearTicketBtn = document.getElementById('crearTicketBtn');
const verTicketsBtn = document.getElementById('verTicketsBtn');
const estadisticasBtn = document.getElementById('estadisticasBtn');
const crearTicketSection = document.getElementById('crearTicketSection');
const verTicketsSection = document.getElementById('verTicketsSection');
const estadisticasSection = document.getElementById('estadisticasSection');
const ticketForm = document.getElementById('ticketForm');
const ticketContainer = document.getElementById('ticketContainer');
const filterBtns = document.querySelectorAll('.filter-btn');
const horarioBtn = document.getElementById('horarioBtn');
const horarioSection = document.getElementById('horarioSection');
const fechaHorario = document.getElementById('fechaHorario');
const verHorarioBtn = document.getElementById('verHorarioBtn');
const exportarDiaBtn = document.getElementById('exportarDiaBtn');
const exportarMesBtn = document.getElementById('exportarMesBtn');
const exportarGoogleBtn = document.getElementById('exportarGoogleBtn');
const backupBtn = document.getElementById('backupBtn');
const cleanDataBtn = document.getElementById('cleanDataBtn');

// Inicialización with loop prevention
document.addEventListener('DOMContentLoaded', () => {
    // Prevent auto-redirect while loading
    window.noRedirectOnAuth = true;
    
    // Check authentication before doing anything else
    checkAuth().then(userData => {
        // Show the UI elements based on user role
        applyRoleBasedUI(userData.role);
        
        console.log("Successfully authenticated as", userData.role);
        
        // Continue with loading data
        showLoading();
        
        // Verify if the sections exist before trying to work with them
        const crearTicketSection = document.getElementById('crearTicketSection');
        const verTicketsSection = document.getElementById('verTicketsSection');
        const horarioSection = document.getElementById('horarioSection');
        const estadisticasSection = document.getElementById('estadisticasSection');
        
        if (!crearTicketSection || !verTicketsSection) {
            console.error("Critical sections missing in the DOM. Check your HTML structure.");
            hideLoading();
            showNotification('Error: Estructura HTML incompleta', 'error');
            return;
        }
        
        // Inicializar Firebase Auth y cargar datos
        initAuth().then(() => {
            loadTickets().then(() => {
                hideLoading();
                isDataLoaded = true;
                
                // Mostrar por defecto la sección de crear ticket si existe
                if (crearTicketSection) {
                    showSection(crearTicketSection);
                    if (crearTicketBtn) crearTicketBtn.classList.add('active');
                }
                
                // Establecer fecha actual en el formulario
                const fechaInput = document.getElementById('fecha');
                if (fechaInput) {
                    fechaInput.value = new Date().toISOString().split('T')[0];
                }
                
                // Establecer fecha actual en el campo de fecha del horario
                const today = new Date().toISOString().split('T')[0];
                if (fechaHorario) {
                    fechaHorario.value = today;
                }

                // --- reset diario del contador de tickets ---
                const todayDaily = new Date().toISOString().split('T')[0];
                const todaysTickets = tickets.filter(t => t.fechaConsulta === todayDaily);
                currentTicketId = todaysTickets.length
                    ? Math.max(...todaysTickets.map(t => t.id)) + 1
                    : 1;

                // mostrar sólo tickets del día al cargar
                renderTickets('fecha', todayDaily);
                updateStats();
            }).catch(err => {
                console.error("Error cargando tickets:", err);
                hideLoading();
                showNotification('Error al cargar los datos', 'error');
            });
        }).catch(err => {
            console.error("Error en autenticación:", err);
            hideLoading();
            showNotification('Error al conectar con el servidor', 'error');
        });
    }).catch(err => {
        // Si estamos en la página de login, no mostrar error ni notificación
        if (window.location.pathname.toLowerCase().includes('home.html')) {
            return;
        }
        console.error("Authentication error:", err);
        hideLoading();
        showNotification('Error de autenticación. Por favor inicie sesión nuevamente.', 'error');
        // Add a login button instead of auto-redirect
        const mainContainer = document.querySelector('.main-container');
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <h2>Sesión expirada</h2>
                    <p>Su sesión ha expirado o no ha iniciado sesión correctamente.</p>
                    <button onclick="window.location.href='home.html'" 
                            style="padding: 10px 20px; background: var(--primary-color); 
                            color: white; border: none; border-radius: 5px; cursor: pointer; 
                            margin-top: 20px;">
                        Iniciar sesión
                    </button>
                </div>
            `;
        }
    });

    // mostrar filtro de fecha para admin/recepción
    const dateFilter = document.getElementById('dateFilterContainer');
    if (dateFilter && hasPermission('canViewSchedule')) {
        dateFilter.classList.remove('hidden');
        // inicializar con fecha actual y filtrar al cargar
        const filterDateInput = document.getElementById('filterDate');
        if (filterDateInput) {
            const today = new Date().toISOString().split('T')[0];
            filterDateInput.value = today;
            renderTickets('fecha', today);
        }
    }

    // evento para filtrar por fecha
    safeAddEventListener('filterDate', 'change', () => {
        const d = document.getElementById('filterDate').value;
        if (d) renderTickets('fecha', d);
    });
});

// Improved version of applyRoleBasedUI with better debugging and role detection
function applyRoleBasedUI(role) {
    console.log(`Applying UI for role: ${role}`);
    
    // Set user info in UI
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    
    if (userNameElement) {
        userNameElement.textContent = sessionStorage.getItem('userName') || 'Usuario';
    }
    if (userRoleElement) {
        userRoleElement.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    }
    
    // Debug info to console
    console.log("User role from sessionStorage:", sessionStorage.getItem('userRole'));
    console.log("User name from sessionStorage:", sessionStorage.getItem('userName'));
    console.log("Admin permissions:", JSON.stringify(PERMISSIONS.admin));
    
    // Add role-specific class to body element for CSS targeting
    document.body.classList.add(`${role}-role`);
    console.log(`Added ${role}-role class to body`);
    
    // Check explicitly for admin role with string comparison
    if (role === 'admin') {
        console.log("ADMIN ROLE DETECTED - enabling all admin features");
        
        // Show all admin-specific buttons
        const adminElements = document.querySelectorAll('.admin-only');
        console.log(`Found ${adminElements.length} admin-only elements`);
        adminElements.forEach(el => {
            el.style.display = 'block';
            console.log(`Showing admin element:`, el);
        });

        // Enable export buttons for admin
        const exportButtons = document.querySelectorAll('.export-controls button');
        if (exportButtons && exportButtons.length > 0) {
            console.log(`Found ${exportButtons.length} export buttons`);
            exportButtons.forEach(btn => {
                btn.style.display = 'inline-flex';
            });
        } else {
            console.log("No export buttons found");
        }
        
        // Enable backup buttons for admin
        const backupButtons = document.querySelectorAll('.backup-controls button');
        if (backupButtons && backupButtons.length > 0) {
            console.log(`Found ${backupButtons.length} backup buttons`);
            backupButtons.forEach(btn => {
                btn.style.display = 'inline-flex';
            });
        } else {
            console.log("No backup buttons found");
        }
    } else {
        console.log(`Non-admin role detected: ${role}`);
        // For non-admin roles, hide features based on permissions
        if (!hasPermission('canCreateTickets')) {
            document.getElementById('crearTicketBtn').style.display = 'none';
        }
        
        if (!hasPermission('canViewStats')) {
            document.getElementById('estadisticasBtn').style.display = 'none';
        }
        
        if (!hasPermission('canViewSchedule')) {
            document.getElementById('horarioBtn').style.display = 'none';
        }
        
        // Hide export buttons for non-admin users without export permission
        const exportButtons = document.querySelectorAll('.export-controls button');
        if (exportButtons && !hasPermission('canExportData')) {
            exportButtons.forEach(btn => {
                btn.style.display = 'none';
            });
        }
        
        // Hide admin-only elements
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            el.style.display = 'none';
        });
    }
    
    // Add logout button event listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', signOut);
    }
    
    console.log("UI permissions applied successfully for role:", role);
}

// Event listeners
safeAddEventListener('crearTicketBtn', 'click', () => {
    const section = document.getElementById('crearTicketSection');
    if (section) {
        showSection(section);
        setActiveButton(document.getElementById('crearTicketBtn'));
    } else {
        console.error("Section 'crearTicketSection' not found");
    }
});

safeAddEventListener('verTicketsBtn', 'click', () => {
    const section = document.getElementById('verTicketsSection');
    if (section) {
        showSection(section);
        setActiveButton(document.getElementById('verTicketsBtn'));
        renderTickets();
    } else {
        console.error("Section 'verTicketsSection' not found");
    }
});

// Add proper event listener for horarioBtn
safeAddEventListener('horarioBtn', 'click', () => {
    const section = document.getElementById('horarioSection');
    if (section) {
        showSection(section);
        setActiveButton(document.getElementById('horarioBtn'));
        // Set today's date in the date field
        const fechaHorario = document.getElementById('fechaHorario');
        if (fechaHorario) {
            fechaHorario.value = new Date().toISOString().split('T')[0];
        }
        // Optionally load today's schedule automatically
        mostrarHorario();
    } else {
        console.error("Section 'horarioSection' not found");
    }
});

safeAddEventListener('estadisticasBtn', 'click', () => {
    const section = document.getElementById('estadisticasSection');
    if (section) {
        showSection(section);
        setActiveButton(document.getElementById('estadisticasBtn'));
        updateStats();
        
        // Asegurarnos que se vea la sección de tiempo de espera
        const waitTimeSection = document.querySelector('.wait-time-statistics');
        if (waitTimeSection) {
            waitTimeSection.style.display = 'block';
        }
        
        // Initialize personnel statistics 
        setTimeout(() => {
            llenarSelectorPersonal();
            generarEstadisticasPersonalServicios();
            
            // Regenerar el gráfico de tiempo de espera para asegurar que se muestre
            calculateWaitTimeStats();
        }, 200);
    } else {
        console.error("Section 'estadisticasSection' not found");
    }
});

if (ticketForm) {
    ticketForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addTicket();
    });
}

// Event listeners para la sección de horario
if (verHorarioBtn) {
    verHorarioBtn.addEventListener('click', mostrarHorario);
}

if (exportarDiaBtn) {
    exportarDiaBtn.addEventListener('click', exportarDia);
}

if (exportarMesBtn) {
    exportarMesBtn.addEventListener('click', exportarMes);
}

if (exportarGoogleBtn) {
    exportarGoogleBtn.addEventListener('click', exportarGoogle);
}

if (backupBtn) {
    backupBtn.addEventListener('click', backupData);
}

if (cleanDataBtn) {
    cleanDataBtn.addEventListener('click', cleanOldData);
}

// Filtros de tickets
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Quitar clase active de todos los botones
        filterBtns.forEach(b => b.classList.remove('active'));
        // Agregar clase active al botón clickeado
        btn.classList.add('active');
        // Filtrar tickets
        const filter = btn.getAttribute('data-filter');
        renderTickets(filter);
    });
});

// Update the showSection function to make it more robust with null checking
function showSection(section) {
    // Check if section exists
    if (!section) {
        console.error("Error: Attempted to show a section that doesn't exist");
        return; // Exit the function early
    }
    
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.content section');
    sections.forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    
    // Mostrar la sección solicitada con animación
    section.classList.remove('hidden');
    
    // Aplicar un pequeño retraso para la animación
    setTimeout(() => {
        section.classList.add('active');
    }, 50);
}

// Add a safer way to show sections using IDs
function showSectionById(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        showSection(section);
    } else {
        console.error(`Section with ID '${sectionId}' not found`);
    }
}

function setActiveButton(button) {
    // Quitar clase active de todos los botones
    const buttons = document.querySelectorAll('nav button');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Agregar clase active al botón seleccionado
    button.classList.add('active');
}

// Función para cargar tickets desde Firebase
function loadTickets() {
    return new Promise((resolve, reject) => {
        ticketsRef.once('value')
            .then(snapshot => {
                tickets = [];
                currentTicketId = 1;
                const data = snapshot.val() || {};
                Object.keys(data).forEach(key => {
                    const entry = data[key];
                    // Only keep valid tickets with id and mascota
                    if (entry && entry.id != null && entry.mascota) {
                        tickets.push({
                            ...entry,
                            firebaseKey: key
                        });
                        if (entry.id >= currentTicketId) currentTicketId = entry.id + 1;
                    } else {
                        // Remove invalid ticket from database
                        ticketsRef.child(key).remove();
                    }
                });
                return settingsRef.once('value');
            })
            .then(snapshot => {
                const settings = snapshot.val() || {};
                if (settings.currentTicketId && settings.currentTicketId > currentTicketId) {
                    currentTicketId = settings.currentTicketId;
                } else {
                    // Guardar el valor actual en Firebase si no existe o es menor
                    settingsRef.update({ currentTicketId });
                }
                resolve();
            })
            .catch(error => {
                console.error("Error cargando datos:", error);
                reject(error);
            });
            
        // Configurar escucha en tiempo real para actualizaciones
        ticketsRef.on('child_added', snapshot => {
            // Eliminar la condición de isDataLoaded para que todos los usuarios reciban updates
            const entry = snapshot.val();
            // Remove invalid tickets
            if (!entry || entry.id == null || !entry.mascota) {
                ticketsRef.child(snapshot.key).remove();
                return;
            }
            const newTicket = { ...entry, firebaseKey: snapshot.key };
            if (!tickets.some(t => t.id === newTicket.id)) {
                tickets.push(newTicket);
                // Usar el filtro activo actual
                const currentFilterBtn = document.querySelector('.filter-btn.active');
                const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'todos';
                renderTickets(currentFilter);
                updateStats();
                // Real-time UI update for active section
                if (horarioSection.classList.contains('active')) mostrarHorario();
                if (estadisticasSection.classList.contains('active')) generarEstadisticasPersonalServicios();
            }
        });
        
        ticketsRef.on('child_changed', snapshot => {
            const updatedTicket = {
                ...snapshot.val(),
                firebaseKey: snapshot.key
            };
            const index = tickets.findIndex(t => t.firebaseKey === snapshot.key);
            if (index !== -1) {
                tickets[index] = updatedTicket;
                // Usar el filtro activo actual
                const currentFilterBtn = document.querySelector('.filter-btn.active');
                const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'todos';
                renderTickets(currentFilter);
                updateStats();
                if (horarioSection.classList.contains('active')) mostrarHorario();
                if (estadisticasSection.classList.contains('active')) generarEstadisticasPersonalServicios();
            }
        });
        
        ticketsRef.on('child_removed', snapshot => {
            const index = tickets.findIndex(t => t.firebaseKey === snapshot.key);
            if (index !== -1) {
                tickets.splice(index, 1);
                // Usar el filtro activo actual
                const currentFilterBtn = document.querySelector('.filter-btn.active');
                const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'todos';
                renderTickets(currentFilter);
                updateStats();
                if (horarioSection.classList.contains('active')) mostrarHorario();
                if (estadisticasSection.classList.contains('active')) generarEstadisticasPersonalServicios();
            }
        });
    });
}

// Reemplaza la función addTicket() actual con esta versión corregida
function addTicket() {
    try {
        console.log("addTicket function called");
        // 1. Obtener valores del formulario
        const nombre = document.getElementById('nombre').value;
        const mascota = document.getElementById('mascota').value;
        const cedula = document.getElementById('cedula').value;
        const motivo = document.getElementById('motivo').value;
        const estado = document.getElementById('estado').value;
        const tipoMascota = document.getElementById('tipoMascota').value;
        const urgencia = document.getElementById('urgencia').value;
        const porCobrar = document.getElementById('porCobrar')?.value || '';

        // Campos adicionales
        const idPaciente = document.getElementById('idPaciente')?.value || '';
        
        // Nuevo código para combinar doctor y asistente
        const doctorAtiende = document.getElementById('doctorAtiende')?.value || '';
        const asistenteAtiende = document.getElementById('asistenteAtiende')?.value || '';
        let medicoAtiende = '';
        
        if (doctorAtiende && asistenteAtiende) {
            medicoAtiende = `${doctorAtiende}, ${asistenteAtiende}`;
        } else if (doctorAtiende) {
            medicoAtiende = doctorAtiende;
        } else if (asistenteAtiende) {
            medicoAtiende = asistenteAtiende;
        }
        
        const numFactura = document.getElementById('numFactura')?.value || '';
        const tipoServicio = document.getElementById('tipoServicio')?.value || 'consulta';
        
        // Obtener fecha y tiempos seleccionados
        const fechaConsulta = document.getElementById('fecha')?.value;
        const horaCita = document.getElementById('hora')?.value;
        const horaLlegada = document.getElementById('horaLlegada')?.value;
        const horaAtencion = document.getElementById('horaAtencion')?.value;
        
        console.log("Datos recopilados:", { 
            nombre, mascota, fechaConsulta, horaCita, horaLlegada, horaAtencion, tipoServicio 
        });
        
        const fecha = new Date();
        
        // 2. Crear nuevo ticket
        const nuevoTicket = {
            id: currentTicketId,
            nombre,
            mascota,
            cedula,
            motivo,
            estado,
            tipoMascota,
            urgencia,
            idPaciente,
            medicoAtiende,
            numFactura,
            tipoServicio,
            fecha: fecha.toISOString(),
            horaCreacion: fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            porCobrar
        };
        
        // Añadir campos de fecha y tiempos de consulta si están disponibles
        if (fechaConsulta) nuevoTicket.fechaConsulta = fechaConsulta;
        if (horaCita) nuevoTicket.horaConsulta = horaCita;
        if (horaLlegada) nuevoTicket.horaLlegada = horaLlegada;
        if (horaAtencion) nuevoTicket.horaAtencion = horaAtencion;
        
        // Mostrar indicador de carga
        showLoadingButton(document.querySelector('.btn-submit'));
        
        // Verificar la referencia a Firebase
        if (!ticketsRef) {
            console.error("Error: ticketsRef no está definido");
            showNotification('Error con la base de datos. Por favor recarga la página.', 'error');
            hideLoadingButton(document.querySelector('.btn-submit'));
            return;
        }
        
        // Guardar en Firebase con manejo de errores mejorado
        ticketsRef.push(nuevoTicket)
            .then(() => {
                console.log("Ticket guardado exitosamente");
                
                // Incrementar el ID para el siguiente ticket
                currentTicketId++;
                
                // Actualizar currentTicketId en Firebase si settingsRef existe
                if (settingsRef) {
                    settingsRef.update({ currentTicketId })
                        .catch(error => console.error("Error actualizando currentTicketId:", error));
                }
                
                // Limpiar formulario
                ticketForm.reset();
                
                // Restaurar fecha actual en el formulario
                if (document.getElementById('fecha')) {
                    document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
                }
                
                // Quitar indicador de carga
                hideLoadingButton(document.querySelector('.btn-submit'));
                
                // Mostrar mensaje de éxito
                showNotification('Consulta creada correctamente', 'success');
                
                // Cambiar a la vista de tickets
                setTimeout(() => {
                    showSection(verTicketsSection);
                    setActiveButton(verTicketsBtn);
                }, 1500);
            })
            .catch(error => {
                console.error("Error guardando ticket:", error);
                hideLoadingButton(document.querySelector('.btn-submit'));
                showNotification('Error al guardar la consulta: ' + error.message, 'error');
            });
    } catch (error) {
        console.error("Error en la función addTicket:", error);
        hideLoadingButton(document.querySelector('.btn-submit'));
        showNotification('Error en el proceso de creación: ' + error.message, 'error');
    }
}

function renderTickets(filter = 'todos', date = null) {
    ticketContainer.innerHTML = '';
    let filteredTickets;

    // 'todos' muestra sólo tickets activos, limitados a la fecha si hay datePicker
    if (filter === 'todos') {
        const filterDateInput = document.getElementById('filterDate');
        if (filterDateInput && filterDateInput.value) {
            filteredTickets = tickets.filter(t =>
                t.estado !== 'terminado' &&
                t.fechaConsulta === filterDateInput.value
            );
        } else {
            filteredTickets = tickets.filter(t => t.estado !== 'terminado');
        }
    }
    else if (filter === 'fecha' && date) {
        filteredTickets = tickets.filter(ticket => ticket.fechaConsulta === date);
    } else {
        filteredTickets = [...tickets];
    }
    
    // Aplicar filtros
    if (filter === 'espera') {
        filteredTickets = tickets.filter(ticket => ticket.estado === 'espera');
    } else if (filter === 'consultorio') {
        filteredTickets = tickets.filter(ticket => 
            ticket.estado === 'consultorio1' || 
            ticket.estado === 'consultorio2' || 
            ticket.estado === 'consultorio3'
        );
    } else if (filter === 'terminado') {
        filteredTickets = tickets.filter(ticket => ticket.estado === 'terminado');
    } else if (filter === 'urgentes') {
        // Filtrar tickets con urgencia alta
        filteredTickets = tickets.filter(ticket => ticket.urgencia === 'alta');
    }
    
    // Ordenar por urgencia y luego por fecha
    filteredTickets.sort((a, b) => {
        // Primero por urgencia (alta > media > normal)
        const urgenciaPrioridad = { 'alta': 3, 'media': 2, 'normal': 1 };
        if (urgenciaPrioridad[b.urgencia] !== urgenciaPrioridad[a.urgencia]) {
            return urgenciaPrioridad[b.urgencia] - urgenciaPrioridad[a.urgencia];
        }
        
        // Luego por fecha (más reciente primero)
        return new Date(b.fecha) - new Date(a.fecha);
    });
    
    if (filteredTickets.length === 0) {
        ticketContainer.innerHTML = `
            <div class="no-tickets">
                <i class="fas fa-paw" style="font-size: 3rem; color: #ccc; margin-bottom: 15px;"></i>
                <p>No hay tickets disponibles</p>
            </div>
        `;
        return;
    }
    
    filteredTickets.forEach((ticket, index) => {
        const ticketElement = document.createElement('div');
        
        // Set base class
        ticketElement.className = `ticket ticket-${ticket.estado}`;
        
        // Add urgency class based on ticket urgency level
        ticketElement.classList.add(`ticket-urgencia-${ticket.urgencia}`);
        
        // Add injectable class if service type is injectable - FIX ERROR
        if (ticket.tipoServicio && typeof ticket.tipoServicio === 'string' && ticket.tipoServicio.includes('inyectable')) {
            ticketElement.classList.add('ticket-inyectable');
        }
        
        ticketElement.dataset.id = ticket.id;
        
        let ticketContent = '';
        
        // Check if user is in 'visitas' role with limited view
        if (!hasPermission('canViewFullTicket')) {
            // Get urgency class and icon
            let urgenciaClass = '';
            let urgenciaIcon = '';
            switch(ticket.urgencia) {
                case 'alta':
                    urgenciaClass = 'urgencia-alta';
                    urgenciaIcon = 'fa-exclamation-triangle';
                    break;
                case 'media':
                    urgenciaClass = 'urgencia-media';
                    urgenciaIcon = 'fa-exclamation';
                    break;
                default: // normal
                    urgenciaClass = 'urgencia-normal';
                    urgenciaIcon = 'fa-info-circle';
            }
            
            // Get status text and class
            let estadoText = '';
            let estadoClass = '';
            switch(ticket.estado) {
                case 'espera':
                    estadoText = 'En sala de espera';
                    estadoClass = 'estado-espera';
                    break;
                case 'consultorio1':
                    estadoText = 'Consultorio 1';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio2':
                    estadoText = 'Consultorio 2';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio3':
                    estadoText = 'Consultorio 3';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'terminado':
                    estadoText = 'Consulta terminada';
                    estadoClass = 'estado-terminado';
                    break;
            }
            
            // Simplified view for 'visitas' role with added urgency and status
            ticketContent = `
                <div class="ticket-header">
                    <div class="ticket-title">${ticket.mascota}</div>
                    <div class="ticket-number">#${ticket.id}</div>
                </div>
                <div class="ticket-info">
                    <p><i class="fas fa-user"></i> ${ticket.nombre}</p>
                    ${ticket.medicoAtiende ? `<p><i class="fas fa-user-md"></i> ${ticket.medicoAtiende}</p>` : ''}
                    ${ticket.idPaciente ? `<p><i class="fas fa-fingerprint"></i> ID: ${ticket.idPaciente}</p>` : ''}
                    <p><i class="fas fa-stethoscope"></i> ${ticket.motivo}</p>
                    ${ticket.horaConsulta ? `<p><i class="fas fa-calendar-check"></i> Cita: ${ticket.horaConsulta}</p>` : ''}
                    ${ticket.horaLlegada ? `<p><i class="fas fa-sign-in-alt"></i> Llegada: ${ticket.horaLlegada}</p>` : ''}
                    ${ticket.horaAtencion ? `<p><i class="fas fa-user-md"></i> Atención: ${ticket.horaAtencion}</p>` : ''}
                    <p class="${urgenciaClass}"><i class="fas ${urgenciaIcon}"></i> Urgencia: ${(ticket.urgencia || '').toUpperCase()}</p>
                    <div class="estado-badge ${estadoClass}">
                        <i class="fas fa-${ticket.estado === 'espera' ? 'hourglass-half' : 
                                     typeof ticket.estado === 'string' && ticket.estado.includes('consultorio') ? 'user-md' : 'check-circle'}"></i>
                        ${estadoText}
                    </div>
                </div>
            `;
        } else {
            // Full view for other roles
            // ...existing code for full ticket display...
            
            let animalIcon = '';
            switch(ticket.tipoMascota) {
                case 'perro':
                    animalIcon = '<i class="fas fa-dog animal-icon"></i>';
                    break;
                case 'gato':
                    animalIcon = '<i class="fas fa-cat animal-icon"></i>';
                    break;
                case 'ave':
                    animalIcon = '<i class="fas fa-dove animal-icon"></i>';
                    break;
                default:
                    animalIcon = '<i class="fas fa-paw animal-icon"></i>';
            }
            
            let estadoText = '';
            let estadoClass = '';
            switch(ticket.estado) {
                case 'espera':
                    estadoText = 'En sala de espera';
                    estadoClass = 'estado-espera';
                    break;
                case 'consultorio1':
                    estadoText = 'Consultorio 1';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio2':
                    estadoText = 'Consultorio 2';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'consultorio3':
                    estadoText = 'Consultorio 3';
                    estadoClass = 'estado-consultorio';
                    break;
                case 'terminado':
                    estadoText = 'Consulta terminada';
                    estadoClass = 'estado-terminado';
                    break;
            }
            
            // Crear clase y texto para el nivel de urgencia
            let urgenciaClass = '';
            let urgenciaIcon = '';
            switch(ticket.urgencia) {
                case 'alta':
                    urgenciaClass = 'urgencia-alta';
                    urgenciaIcon = 'fa-exclamation-triangle';
                    break;
                case 'media':
                    urgenciaClass = 'urgencia-media';
                    urgenciaIcon = 'fa-exclamation';
                    break;
                default: // normal
                    urgenciaClass = 'urgencia-normal';
                    urgenciaIcon = 'fa-info-circle';
            }
            
            ticketContent = `
                <div class="ticket-header">
                    <div class="ticket-title">${animalIcon} ${ticket.mascota}</div>
                    <div class="ticket-number">#${ticket.id}</div>
                </div>
                <div class="ticket-info">
                    <p><i class="fas fa-user"></i> ${ticket.nombre}</p>
                    <p><i class="fas fa-id-card"></i> ${ticket.cedula}</p>
                    ${ticket.idPaciente ? `<p><i class="fas fa-fingerprint"></i> ID: ${ticket.idPaciente}</p>` : ''}
                    ${ticket.medicoAtiende ? `<p><i class="fas fa-user-md"></i> Médico: ${ticket.medicoAtiende}</p>` : ''}
                    ${ticket.numFactura ? `<p><i class="fas fa-file-invoice"></i> Factura: ${ticket.numFactura}</p>` : ''}
                    <p><i class="fas fa-stethoscope"></i> ${ticket.motivo}</p>
                    ${ticket.fechaConsulta ? `<p><i class="fas fa-calendar-day"></i> Fecha: ${formatDate(ticket.fechaConsulta)}</p>` : ''}
                    ${ticket.horaLlegada ? `<p><i class="fas fa-sign-in-alt"></i> Llegada: ${ticket.horaLlegada}</p>` : ''}
                    ${ticket.horaConsulta ? `<p><i class="fas fa-calendar-check"></i> Cita: ${ticket.horaConsulta}</p>` : ''}
                    ${ticket.horaAtencion ? `<p><i class="fas fa-user-md"></i> Atención: ${ticket.horaAtencion}</p>` : ''}
                    <p class="${urgenciaClass}"><i class="fas ${urgenciaIcon}"></i> Urgencia: ${(ticket.urgencia || '').toUpperCase()}</p>
                    <div class="estado-badge ${estadoClass}">
                        <i class="fas fa-${ticket.estado === 'espera' ? 'hourglass-half' : 
                                     typeof ticket.estado === 'string' && ticket.estado.includes('consultorio') ? 'user-md' : 'check-circle'}"></i>
                        ${estadoText}
                    </div>
                    ${ticket.porCobrar ? `<p><i class='fas fa-money-bill-wave'></i> <strong>Por Cobrar:</strong> ${ticket.porCobrar}</p>` : ''}
                </div>
            `;
        }
        
        // Add action buttons based on permissions
        let actionButtons = '';
        
        if (hasPermission('canEditTickets')) {
            actionButtons += `
                <button class="action-btn btn-editar" onclick="editTicket(${ticket.id})">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="action-btn btn-cambiar" onclick="changeStatus(${ticket.id})">
                    <i class="fas fa-exchange-alt"></i> Cambiar Estado
                </button>
            `;
        }
        
        if (hasPermission('canDeleteTickets')) {
            actionButtons += `
                <button class="action-btn btn-eliminar" onclick="deleteTicket(${ticket.id})">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            `;
        }
        
        // Only add action buttons container if there are buttons
        if (actionButtons) {
            ticketContent += `<div class="ticket-actions">${actionButtons}</div>`;
        }
        
        ticketElement.innerHTML = ticketContent;
        
        // Agregar animación basada en el índice para escalonamiento
        ticketElement.style.animationDelay = `${index * 0.1}s`;
        
        ticketContainer.appendChild(ticketElement);
    });
    
    // Agregar estilos para los niveles de urgencia si no existen
    if (!document.getElementById('urgencia-styles')) {
        const style = document.createElement('style');
        style.id = 'urgencia-styles';
        style.textContent = `
            .ticket-info .urgencia-alta {
                color: #e53935;
                font-weight: bold;
                background-color: rgba(229, 57, 53, 0.1);
                padding: 5px 10px;
                border-radius: 4px;
                margin: 5px 0;
                display: inline-block;
            }
            
            .ticket-info .urgencia-media {
                color: #fb8c00;
                font-weight: bold;
                background-color: rgba(251, 140, 0, 0.1);
                padding: 5px 10px;
                border-radius: 4px;
                margin: 5px 0;
                display: inline-block;
            }
            
            .ticket-info .urgencia-normal {
                color: #43a047;
                background-color: rgba(67, 160, 71, 0.1);
                padding: 5px 10px;
                border-radius: 4px;
                margin: 5px 0;
                display: inline-block;
            }
            
            /* Hacer que el nivel de urgencia sea más visible en tickets de urgencia alta */
            .ticket-urgencia-alta .urgencia-alta {
                animation: pulseUrgent 2s infinite;
                box-shadow: 0 0 5px rgba(229, 57, 53, 0.5);
            }
            
            @keyframes pulseUrgent {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Reemplazar la función formatDate actual con esta versión mejorada
function formatDate(dateString) {
    if (!dateString) return '';
    
    // Dividir la fecha en sus componentes (formato YYYY-MM-DD)
    const [year, month, day] = dateString.split('-');
    
    // Devolver fecha formateada sin crear un objeto Date (evita problemas de zona horaria)
    return `${day}/${month}/${year}`;
}

function mostrarHorario() {
    const fecha = fechaHorario.value;
    
    // Filtrar tickets por fecha de consulta
    const ticketsDelDia = tickets.filter(ticket => {
        // Si el ticket tiene los campos nuevos de fecha y hora
        if (ticket.fechaConsulta) {
            return ticket.fechaConsulta === fecha;
        }
        // Compatibilidad con tickets antiguos: validar fecha
        if (!ticket.fecha) return false;
        const parsedDate = new Date(ticket.fecha);
        if (isNaN(parsedDate.getTime())) return false;
        return parsedDate.toISOString().split('T')[0] === fecha;
    });
    
    // Ordenar por hora
    ticketsDelDia.sort((a, b) => {
        if (a.horaConsulta && b.horaConsulta) {
            return a.horaConsulta.localeCompare(b.horaConsulta);
        }
        return 0;
    });
    
    // Mostrar los tickets en la tabla
    const horarioBody = document.getElementById('horarioBody');
    if (!horarioBody) return;
    
    horarioBody.innerHTML = '';
    
    if (ticketsDelDia.length === 0) {
        horarioBody.innerHTML = `
            <tr>
                <td colspan="11" class="no-data">
                    <i class="fas fa-calendar-times"></i>
                    No hay consultas programadas para esta fecha
                </td>
            </tr>
        `;
        return;
    }
    
    ticketsDelDia.forEach((ticket, index) => {
        const row = document.createElement('tr');
        
        // Determinar la hora a mostrar
        const hora = ticket.horaConsulta || ticket.horaCreacion || '-';
        
        // Determinar el estado
        let estadoLabel = '';
        switch(ticket.estado) {
            case 'espera':
                estadoLabel = 'En Sala de Espera';
                break;
            case 'consultorio1':
                estadoLabel = 'Consultorio 1';
                break;
            case 'consultorio2':
                estadoLabel = 'Consultorio 2';
                break;
            case 'consultorio3':
                estadoLabel = 'Consultorio 3';
                break;
                case 'consultorio4':
                    estadoLabel = 'Consultorio 4'
                    break;
                    case 'consultorio5':
                        estadoLabel = 'Consultorio 5';
                        break;
            case 'terminado':
                estadoLabel = 'Terminado';
                break;
            default:
                estadoLabel = ticket.estado;
        }
        
        // Determinar el tipo de mascota
        let tipoLabel = '';
        switch(ticket.tipoMascota) {
            case 'perro':
                tipoLabel = 'Perro';
                break;
            case 'gato':
                tipoLabel = 'Gato';
                break;
            case 'ave':
                tipoLabel = 'Ave';
                break;
            default:
                tipoLabel = 'Otro';
        }
        
        // Clase de urgencia
        const urgenciaClass = `urgencia-${ticket.urgencia}`;
        
        // Setear el índice para la animación
        row.style.setProperty('--index', index);
        
        row.innerHTML = `
            <td>${hora}</td>
            <td>${ticket.nombre}</td>
            <td>${ticket.mascota}</td>
            <td>${tipoLabel}</td>
            <td>${estadoLabel}</td>
            <td class="${urgenciaClass}">${(ticket.urgencia || '').toUpperCase()}</td>
            <td>${ticket.medicoAtiende || '-'}</td>
            <td>${ticket.idPaciente || '-'}</td>
            <td>${ticket.numFactura || '-'}</td>
            <td>
                <button class="btn-edit" onclick="editTicket(${ticket.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-delete" onclick="deleteTicket(${ticket.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        horarioBody.appendChild(row);
    });
}

function editTicket(id) {
    const ticket = tickets.find(t => t.id === id);
    
    if (!ticket) {
        console.error("Ticket no encontrado con ID:", id);
        showNotification('Error: Ticket no encontrado', 'error');
        return;
    }
    
    console.log("Ticket encontrado:", ticket);
    console.log("Firebase Key:", ticket.firebaseKey);
    
    // Cerrar cualquier modal existente primero
    closeModal();
    
    // Crear un modal para editar
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    
    // Seleccionar icono según tipo de mascota
    let animalIcon = '';
    switch(ticket.tipoMascota) {
        case 'perro':
            animalIcon = '<i class="fas fa-dog"></i>';
            break;
        case 'gato':
            animalIcon = '<i class="fas fa-cat"></i>';
            break;
        case 'ave':
            animalIcon = '<i class="fas fa-dove"></i>';
            break;
        default:
            animalIcon = '<i class="fas fa-paw"></i>';
    }
    
    // Asegurar que todos los valores estén definidos para evitar errores en el formulario
    const safeTicket = {
        id: ticket.id,
        nombre: ticket.nombre || '',
        mascota: ticket.mascota || '',
        cedula: ticket.cedula || '',
        idPaciente: ticket.idPaciente || '',
        fechaConsulta: ticket.fechaConsulta || '',
        horaConsulta: ticket.horaConsulta || '',
        medicoAtiende: ticket.medicoAtiende || '',
        motivo: ticket.motivo || '',
        numFactura: ticket.numFactura || '',
        tipoMascota: ticket.tipoMascota || 'otro',
        urgencia: ticket.urgencia || 'normal',
        estado: ticket.estado || 'espera',
        firebaseKey: ticket.firebaseKey,
        horaLlegada: ticket.horaLlegada || '',
        horaAtencion: ticket.horaAtencion || ''
    };
    
    // Separar el médico y asistente si existe
    let doctorSeleccionado = "";
    let asistenteSeleccionado = "";
    
    if (ticket.medicoAtiende) {
        const personal = ticket.medicoAtiende.split(',').map(p => p.trim());
        
        // Intentar identificar el doctor y el asistente
        for (const persona of personal) {
            if (persona.startsWith("Dr.") || persona.startsWith("Dra.")) {
                doctorSeleccionado = persona;
            } else if (persona.startsWith("Tec.")) {
                asistenteSeleccionado = persona;
            }
        }
    }
    
    // Obtener el rol actual
    const userRole = sessionStorage.getItem('userRole');
    // Contador de ediciones para consulta externa
    if (!ticket.editCount) ticket.editCount = 0;
    const canEditPorCobrar = hasPermission('canEditTickets') && userRole !== 'recepcion' && (userRole !== 'consulta_externa' || ticket.editCount < 2);
    const porCobrarField = canEditPorCobrar
      ? `<div class="form-group">
            <label for="editPorCobrar">Por Cobrar</label>
            <input type="text" id="editPorCobrar" value="${ticket.porCobrar || ''}" placeholder="Introduzca lo que hay que cobrar al cliente">
        </div>`
      : `<div class="form-group">
            <label for="editPorCobrar">Por Cobrar</label>
            <input type="text" id="editPorCobrar" value="${ticket.porCobrar || ''}" readonly style="background:#f5f5f5; color:#888; cursor:not-allowed;">
        </div>`;
    
    // Crear el contenido del modal con el formulario
    modal.innerHTML = `
        <div class="modal-content animate-scale">
            <span class="close-modal" onclick="closeModal()">&times;</span>
            <h3>${animalIcon} Editar Consulta #${safeTicket.id}</h3>
            <form id="editTicketForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="editNombre">Nombre del Cliente</label>
                        <input type="text" id="editNombre" value="${safeTicket.nombre}" required>
                    </div>
                    <div class="form-group">
                        <label for="editMascota">Nombre de la Mascota</label>
                        <input type="text" id="editMascota" value="${safeTicket.mascota}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="editIdPaciente">Número ID del paciente</label>
                        <input type="text" id="editIdPaciente" value="${safeTicket.idPaciente}" required>
                    </div>
                    <div class="form-group">
                        <label for="editCedula">Cédula</label>
                        <input type="text" id="editCedula" value="${safeTicket.cedula}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="editFecha">Fecha de Consulta</label>
                        <input type="date" id="editFecha" value="${safeTicket.fechaConsulta}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="editHoraLlegada">Hora de Llegada</label>
                        <input type="time" id="editHoraLlegada" value="${safeTicket.horaLlegada || ''}">
                    </div>
                    <div class="form-group">
                        <label for="editHora">Hora de Cita</label>
                        <input type="time" id="editHora" value="${safeTicket.horaConsulta || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="editHoraAtencion">Hora de Atención</label>
                        <input type="time" id="editHoraAtencion" value="${safeTicket.horaAtencion || ''}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="editMedicoAtiende">Médico que atiende</label>
                    <input type="text" id="editMedicoAtiende" value="${safeTicket.medicoAtiende}">
                </div>
                
                <div class="form-group">
                    <label for="editMotivo">Motivo de Consulta</label>
                    <textarea id="editMotivo" required>${safeTicket.motivo}</textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="editEstado">Estado</label>
                        <select id="editEstado" required>
                            <option value="espera" ${safeTicket.estado === 'espera' ? 'selected' : ''}>En Sala de Espera</option>
                            <option value="consultorio1" ${safeTicket.estado === 'consultorio1' ? 'selected' : ''}>Consultorio 1</option>
                            <option value="consultorio2" ${safeTicket.estado === 'consultorio2' ? 'selected' : ''}>Consultorio 2</option>
                            <option value="consultorio3" ${safeTicket.estado === 'consultorio3' ? 'selected' : ''}>Consultorio 3</option>
                            <option value="consultorio4" ${safeTicket.estado === 'consultorio4' ? 'selected' : ''}>Consultorio 4</option>

                            <option value="consultorio5" ${safeTicket.estado === 'consultorio5' ? 'selected' : ''}>Consultorio 5</option>

                            <option value="terminado" ${safeTicket.estado === 'terminado' ? 'selected' : ''}>Consulta Terminada</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="editTipoMascota">Tipo de Mascota</label>
                        <select id="editTipoMascota" required>
                            <option value="perro" ${safeTicket.tipoMascota === 'perro' ? 'selected' : ''}>Perro</option>
                            <option value="gato" ${safeTicket.tipoMascota === 'gato' ? 'selected' : ''}>Gato</option>
                            <option value="ave" ${safeTicket.tipoMascota === 'ave' ? 'selected' : ''}>Ave</option>
                            <option value="otro" ${safeTicket.tipoMascota === 'otro' ? 'selected' : ''}>Otro</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="editUrgencia">Nivel de Urgencia</label>
                        <select id="editUrgencia" required>
                            <option value="normal" ${safeTicket.urgencia === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="media" ${safeTicket.urgencia === 'media' ? 'selected' : ''}>Media</option>
                            <option value="alta" ${safeTicket.urgencia === 'alta' ? 'selected' : ''}>Alta</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="editNumFactura">Número de factura</label>
                        <input type="text" id="editNumFactura" value="${safeTicket.numFactura}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="editTipoServicio">Tipo de Servicio</label>
                    <select id="editTipoServicio" required>
                        <option value="consulta" ${safeTicket.tipoServicio === 'consulta' ? 'selected' : ''}>Consulta general</option>
                        <option value="revaloracion" ${safeTicket.tipoServicio === 'revaloracion' ? 'selected' : ''}>Revaloración</option>
                        <option value="retiroHilos" ${safeTicket.tipoServicio === 'retiroHilos' ? 'selected' : ''}>Retiro de hilos</option>
                        <option value="rayosX" ${safeTicket.tipoServicio === 'rayosX' ? 'selected' : ''}>Rayos X</option>
                        <option value="desparasitacion" ${safeTicket.tipoServicio === 'desparasitacion' ? 'selected' : ''}>Desparasitación</option>
                        <option value="inyectable" ${safeTicket.tipoServicio === 'inyectable' ? 'selected' : ''}>Inyectables</option>
                        <option value="corteUnas" ${safeTicket.tipoServicio === 'corteUnas' ? 'selected' : ''}>Corte de uñas</option>
                        <option value="emergencia" ${safeTicket.tipoServicio === 'emergencia' ? 'selected' : ''}>Emergencia</option>
                        <option value="tomaMuestras" ${safeTicket.tipoServicio === 'tomaMuestras' ? 'selected' : ''}>Toma de muestras</option>
                        <option value="tests" ${safeTicket.tipoServicio === 'tests' ? 'selected' : ''}>Tests</option>
                        <option value="hemograma" ${safeTicket.tipoServicio === 'hemograma' ? 'selected' : ''}>Hemograma</option>
                        <option value="eutanasia" ${safeTicket.tipoServicio === 'eutanasia' ? 'selected' : ''}>Eutanasia</option>
                        <option value="quitarPuntos" ${safeTicket.tipoServicio === 'quitarPuntos' ? 'selected' : ''}>Quitar puntos</option>
                        <option value="otro" ${safeTicket.tipoServicio === 'otro' ? 'selected' : ''}>Otro</option>
                    </select>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="editDoctorAtiende">Doctor que atiende</label>
                        <select id="editDoctorAtiende">
                            <option value="">Seleccione un doctor</option>
                            <option value="Dr. Luis Coto" ${doctorSeleccionado === "Dr. Luis Coto" ? 'selected' : ''}>Dr. Luis Coto</option>
                            <option value="Dr. Randall Azofeifa" ${doctorSeleccionado === "Dr. Randall Azofeifa" ? 'selected' : ''}>Dr. Randall Azofeifa</option>
                            <option value="Dr. Gustavo González" ${doctorSeleccionado === "Dr. Gustavo González" ? 'selected' : ''}>Dr. Gustavo González</option>
                            <option value="Dra. Daniela Sancho" ${doctorSeleccionado === "Dra. Daniela Sancho" ? 'selected' : ''}>Dra. Daniela Sancho</option>
                            <option value="Dra. Kharen Moreno" ${doctorSeleccionado === "Dra. Kharen Moreno" ? 'selected' : ''}>Dra. Kharen Moreno</option>
                            <option value="Dra. Karina Madrigal" ${doctorSeleccionado === "Dra. Karina Madrigal" ? 'selected' : ''}>Dra. Karina Madrigal</option>
                            <option value="Dra. Lourdes Chacón" ${doctorSeleccionado === "Dra. Lourdes Chacón" ? 'selected' : ''}>Dra. Lourdes Chacón</option>
                            <option value="Dra. Sofia Carrillo" ${doctorSeleccionado === "Dra. Sofia Carrillo" ? 'selected' : ''}>Dra. Sofia Carrillo</option>
                            <option value="Dra. Francinny Nuñez" ${doctorSeleccionado === "Dra. Francinny Nuñez" ? 'selected' : ''}>Dra. Francinny Nuñez</option>
                            <option value="Dra. Karla Quesada" ${doctorSeleccionado === "Dra. Karla Quesada" ? 'selected' : ''}>Dra. Karla Quesada</option>
                            <option value="Dra. Natalia Alvarado" ${doctorSeleccionado === "Dra. Natalia Alvarado" ? 'selected' : ''}>Dra. Natalia Alvarado</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editAsistenteAtiende">Asistente que atiende</label>
                        <select id="editAsistenteAtiende">
                            <option value="">Seleccione un asistente</option>
                            <option value="Tec. Maribel Guzmán" ${asistenteSeleccionado === "Tec. Maribel Guzmán" ? 'selected' : ''}>Tec. Maribel Guzmán</option>
                            <option value="Tec. Juliana Perez" ${asistenteSeleccionado === "Tec. Juliana Perez" ? 'selected' : ''}>Tec. Juliana Perez</option>
                            <option value="Tec. Jafeth Bermudez" ${asistenteSeleccionado === "Tec. Jafeth Bermudez" ? 'selected' : ''}>Tec. Jafeth Bermudez</option>
                            <option value="Tec. Johnny Chacón" ${asistenteSeleccionado === "Tec. Johnny Chacón" ? 'selected' : ''}>Tec. Johnny Chacón</option>
                            <option value="Tec. Gabriela Zuñiga" ${asistenteSeleccionado === "Tec. Gabriela Zuñiga" ? 'selected' : ''}>Tec. Gabriela Zuñiga</option>
                            <option value="Tec. Indra Perez" ${asistenteSeleccionado === "Tec. Indra Perez" ? 'selected' : ''}>Tec. Indra Perez</option>
                        </select>
                    </div>
                </div>
                
                ${porCobrarField}
                
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-save">Guardar Cambios</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Añadir event listener al formulario para guardar los cambios
    document.getElementById('editTicketForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Combinar doctor y asistente
        const editDoctorAtiende = document.getElementById('editDoctorAtiende').value;
        const editAsistenteAtiende = document.getElementById('editAsistenteAtiende').value;
        let medicoAtiende = '';
        
        if (editDoctorAtiende && editAsistenteAtiende) {
            medicoAtiende = `${editDoctorAtiende}, ${editAsistenteAtiende}`;
        } else if (editDoctorAtiende) {
            medicoAtiende = editDoctorAtiende;
        } else if (editAsistenteAtiende) {
            medicoAtiende = editAsistenteAtiene;
        }
        
        // Recoger todos los datos del formulario
        const updatedTicket = {
            id: safeTicket.id,
            nombre: document.getElementById('editNombre').value,
            mascota: document.getElementById('editMascota').value,
            cedula: document.getElementById('editCedula').value,
            idPaciente: document.getElementById('editIdPaciente').value,
            fechaConsulta: document.getElementById('editFecha').value,
            horaConsulta: document.getElementById('editHora').value,
            horaLlegada: document.getElementById('editHoraLlegada').value,
            horaAtencion: document.getElementById('editHoraAtencion').value,
            medicoAtiende: medicoAtiende,
            motivo: document.getElementById('editMotivo').value,
            estado: document.getElementById('editEstado').value,
            tipoMascota: document.getElementById('editTipoMascota').value,
            urgencia: document.getElementById('editUrgencia').value,
            numFactura: document.getElementById('editNumFactura').value,
            tipoServicio: document.getElementById('editTipoServicio').value,
            firebaseKey: safeTicket.firebaseKey,
            porCobrar: document.getElementById('editPorCobrar')?.value || ''
        };
        
        // Guardar el ticket actualizado
        saveEditedTicket(updatedTicket);
    });
    
    // Deshabilitar el botón de guardar si se alcanzó el límite de ediciones
    if (userRole === 'consulta_externa' && ticket.editCount >= 2) {
        const saveBtn = modal.querySelector('.btn-save');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Límite de ediciones alcanzado';
            saveBtn.style.background = '#ccc';
            saveBtn.style.cursor = 'not-allowed';
        }
    }
}

function saveEditedTicket(ticket) {
    console.log("Guardando ticket actualizado:", ticket);
    
    if (!ticket.firebaseKey) {
        console.error("Error: No hay clave de Firebase para el ticket", ticket);
        showNotification('Error al guardar los cambios: falta identificador', 'error');
        return;
    }
    
    // Guardar la sección y filtro activos antes de actualizar
    const currentSection = document.querySelector('.content section.active');
    const currentFilterBtn = document.querySelector('.filter-btn.active');
    const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'todos';
    
    // Mostrar indicador de carga
    const saveButton = document.querySelector('.btn-save');
    if (saveButton) {
        showLoadingButton(saveButton);
    }
    
    // Eliminar la propiedad firebaseKey antes de guardar
    const ticketToSave = {...ticket};
    delete ticketToSave.firebaseKey;
    
    // Asegurarse de que ningún campo sea undefined
    Object.keys(ticketToSave).forEach(key => {
        if (ticketToSave[key] === undefined) {
            ticketToSave[key] = '';
        }
    });
    
    // Usar update en lugar de eliminar y recrear el ticket
    ticketsRef.child(ticket.firebaseKey).update(ticketToSave)
        .then(() => {
            closeModal();
            showNotification('Consulta actualizada correctamente', 'success');
            
            // Actualizar la página actual
            if (currentSection && currentSection.id === 'verTicketsSection') {
                renderTickets(currentFilter);
                
                // Mantener el filtro activo
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.getAttribute('data-filter') === currentFilter) {
                        btn.classList.add('active');
                    }
                });
                
                // Asegurar que el botón de navegación también está activo
                setActiveButton(verTicketsBtn);
            } else if (currentSection && currentSection.id === 'horarioSection') {
                mostrarHorario();
            } else {
                renderTickets();
            }
            
            updateStats();
        })
        .catch(error => {
            console.error("Error actualizando ticket:", error);
            if (saveButton) {
                hideLoadingButton(saveButton);
            }
            showNotification('Error al guardar los cambios: ' + error.message, 'error');
        });
}

function changeStatus(id) {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;
    
    // Mostrar modal para cambiar estado
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <div class="modal-content animate-scale">
            <h3>Cambiar Estado del Ticket #${ticket.id}</h3>
            <form id="statusForm">
                <div class="form-group">
                    <label for="changeEstado">Nuevo Estado</label>
                    <select id="changeEstado" required>
                        <option value="espera" ${ticket.estado === 'espera' ? 'selected' : ''}>En Sala de Espera</option>
                        <option value="consultorio1" ${ticket.estado === 'consultorio1' ? 'selected' : ''}>Consultorio 1</option>
                        <option value="consultorio2" ${ticket.estado === 'consultorio2' ? 'selected' : ''}>Consultorio 2</option>
                        <option value="consultorio3" ${ticket.estado === 'consultorio3' ? 'selected' : ''}>Consultorio 3</option>
                        <option value="consultorio4" ${ticket.estado === 'consultorio4' ? 'selected' : ''}>Consultorio 4</option>
                        <option value="consultorio5" ${ticket.estado === 'consultorio5' ? 'selected' : ''}>Consultorio 5</option>
                        <option value="terminado" ${ticket.estado === 'terminado' ? 'selected' : ''}>Consulta Terminada</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-save">Guardar Cambios</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('statusForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Actualizar estado del ticket
        const nuevoEstado = document.getElementById('changeEstado').value;
        ticket.estado = nuevoEstado;
        
        // Si el ticket pasa a consultorio y no tiene hora de atención, registrarla automáticamente
        if (nuevoEstado.includes('consultorio') && !ticket.horaAtencion) {
            const ahora = new Date();
            ticket.horaAtencion = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        
        // Mostrar indicador de carga
        const saveButton = document.querySelector('.btn-save');
        if (saveButton) {
            showLoadingButton(saveButton);
        }
        
        // Actualizar en Firebase
        const ticketToSave = {...ticket};
        delete ticketToSave.firebaseKey;
        
        ticketsRef.child(ticket.firebaseKey).update(ticketToSave)
            .then(() => {
                closeModal();
                showNotification('Estado actualizado correctamente', 'success');
                
                // If we're in the tickets view, show only finished tickets
                const ticketsSectionActive = document.getElementById('verTicketsSection').classList.contains('active');
                if (ticketsSectionActive) {
                    // Render only 'terminado' tickets and set filter button
                    renderTickets('terminado');
                    filterBtns.forEach(btn => btn.classList.remove('active'));
                    const terminadoBtn = document.querySelector('.filter-btn[data-filter="terminado"]');
                    if (terminadoBtn) terminadoBtn.classList.add('active');
                    // Ensure the navigation button remains active
                    setActiveButton(verTicketsBtn);
                }
                
                // If in schedule view, update schedule
                if (document.getElementById('horarioSection').classList.contains('active')) {
                    mostrarHorario();
                }
            })
            .catch(error => {
                console.error("Error actualizando estado:", error);
                if (saveButton) {
                    hideLoadingButton(saveButton);
                }
                showNotification('Error al cambiar el estado', 'error');
            });
    });
}

// Modify the deleteTicket function to check permissions
function deleteTicket(id) {
    // Check if user has permission to delete
    if (!hasPermission('canDeleteTickets')) {
        showNotification('No tienes permiso para eliminar consultas', 'error');
        return;
    }
    
    // Confirmar antes de eliminar
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;
    
    // Seleccionar icono según tipo de mascota
    let animalIcon = '';
    switch(ticket.tipoMascota) {
        case 'perro':
            animalIcon = '<i class="fas fa-dog" style="font-size: 1.5rem; margin-right: 10px;"></i>';
            break;
        case 'gato':
            animalIcon = '<i class="fas fa-cat" style="font-size: 1.5rem; margin-right: 10px;"></i>';
            break;
        case 'ave':
            animalIcon = '<i class="fas fa-dove" style="font-size: 1.5rem; margin-right: 10px;"></i>';
            break;
        default:
            animalIcon = '<i class="fas fa-paw" style="font-size: 1.5rem; margin-right: 10px;"></i>';
    }
    
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <div class="modal-content animate-scale">
            <h3><i class="fas fa-exclamation-triangle" style="color: var(--accent-color);"></i> Eliminar Ticket</h3>
            <div style="text-align: center; margin: 25px 0;">
                <div style="margin-bottom: 15px;">
                    ${animalIcon}
                    <span style="font-size: 1.2rem;">${ticket.mascota}</span>
                </div>
                <p>¿Estás seguro que deseas eliminar el ticket #${ticket.id}?</p>
                <p style="margin-top: 10px; font-size: 0.9rem; color: #777;">Esta acción no se puede deshacer.</p>
            </div>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
                <button class="btn-delete" onclick="confirmDelete(${ticket.id})">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function confirmDelete(id) {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket || !ticket.firebaseKey) {
        showNotification('Error al eliminar la consulta', 'error');
        return;
    }
    
    // Store current active section and filter before deleting
    const currentSection = document.querySelector('.content section.active');
    const currentFilterBtn = document.querySelector('.filter-btn.active');
    const currentFilter = currentFilterBtn ? currentFilterBtn.getAttribute('data-filter') : 'todos';
    
    // Mostrar indicador de carga
    const deleteButton = document.querySelector('.btn-delete');
    if (deleteButton) {
        showLoadingButton(deleteButton);
    }
    
    ticketsRef.child(ticket.firebaseKey).remove()
        .then(() => {
            showNotification('Consulta eliminada correctamente', 'success');
            closeModal();
            
            // Mantener la vista actual
            if (currentSection) {
                // Si estamos en la vista de tickets, aplicar el filtro actual
                if (currentSection.id === 'verTicketsSection') {
                    renderTickets(currentFilter);
                    
                    // También actualizar el botón activo de filtro
                    if (currentFilterBtn) {
                        document.querySelectorAll('.filter-btn').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        currentFilterBtn.classList.add('active');
                    }
                    
                    // Asegurar que el botón de navegación también está activo
                    setActiveButton(verTicketsBtn);
                } 
                // Si estamos en la vista de horario, actualizarla
                else if (currentSection.id === 'horarioSection') {
                    mostrarHorario();
                }
            }
            
            // Actualizar estadísticas
            updateStats();
        })
        .catch(error => {
            console.error("Error eliminando ticket:", error);
            if (deleteButton) {
                hideLoadingButton(deleteButton);
            }
            showNotification('Error al eliminar la consulta', 'error');
        });
}

function closeModal() {
    const modal = document.querySelector('.edit-modal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Sistema de autenticación básico
let userCredential = null;

// Iniciar sesión o crear cuenta anónima
function initAuth() {
  return new Promise((resolve, reject) => {
    console.log("Initializing auth...");
    
    // Check if the user is already authenticated first
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        console.log("User already authenticated:", user.uid);
        resolve(user);
      } else {
        console.log("No active user, signing in anonymously...");
        // Sign in anonymously with proper variable scoping
        firebase.auth().signInAnonymously()
          .then((credential) => {
            // Properly scope userCredential within this block
            const userCredential = credential.user;
            console.log("Anonymous auth successful:", userCredential.uid);
            resolve(userCredential);
          })
          .catch((error) => {
            console.error("Authentication error:", error);
            showNotification('Error al conectar con la base de datos', 'error');
            reject(error);
          });
      }
    });
  });
}

function showNotification(message, type = 'info') {
    // Crear notificación si no existe
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.innerHTML = `
            .notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                font-weight: 500;
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
                z-index: 1001;
                transform: translateY(100px);
                opacity: 0;
                transition: all 0.3s ease;
            }
            
            .notification.show {
                transform: translateY(0);
                opacity: 1;
            }
            
            .notification.info {
                background: var(--primary-color);
            }
            
            .notification.success {
                background: var(--secondary-color);
            }
            
            .notification.error {
                background: var(--accent-color);
            }
        `;
        document.head.appendChild(style);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerText = message;
    
    document.body.appendChild(notification);
    
    // Mostrar notificación
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function updateStats() {
    const totalPacientes = tickets.length;
    const pacientesEspera = tickets.filter(t => t.estado === 'espera').length;
    const pacientesConsulta = tickets.filter(t => 
        t.estado === 'consultorio1' || t.estado === 'consultorio2' || t.estado === 'consultorio3'
    ).length;
    const pacientesAtendidos = tickets.filter(t => t.estado === 'terminado').length;
    
    document.getElementById('totalPacientes').textContent = totalPacientes;
    document.getElementById('pacientesEspera').textContent = pacientesEspera;
    document.getElementById('pacientesConsulta').textContent = pacientesConsulta;
    document.getElementById('pacientesAtendidos').textContent = pacientesAtendidos;
    
    // Asegurarnos que la sección de tiempo promedio sea visible
    const waitTimeSection = document.querySelector('.wait-time-statistics');
    if (waitTimeSection) {
        waitTimeSection.style.display = 'block';
    }
    
    // Calcular estadísticas de tiempo de espera
    calculateWaitTimeStats();
}

function renderChart() {
    const ctx = document.getElementById('ticketsChart');
    if (!ctx) return;
    
    // Contar tickets por tipo de mascota
    const mascotas = {};
    tickets.forEach(ticket => {
        mascotas[ticket.tipoMascota] = (mascotas[ticket.tipoMascota] || 0) + 1;
    });
    
    // Si ya existe un gráfico, destruirlo
    if (window.ticketsChart) {
        window.ticketsChart.destroy();
    }
    
    // Crear nuevo gráfico
    window.ticketsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(mascotas).map(tipo => 
                tipo.charAt(0).toUpperCase() + tipo.slice(1)
            ),
            datasets: [{
                data: Object.values(mascotas),
                backgroundColor: [
                    '#4285f4',
                    '#ea4335',
                    '#fbbc05',
                    '#34a853'
                ],
                borderWidth: 2,
                borderColor: '#f9f9f9'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 15,
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Distribución por Tipo de Mascota',
                    font: {
                        size: 16
                    }
                }
            }
        }
    });
}

// Funciones de exportación y respaldo
function exportarDia() {
    // Check permissions
    if (!hasPermission('canExportData')) {
        showNotification('No tienes permiso para exportar datos', 'error');
        return;
    }
    
    const fecha = fechaHorario.value;
    
    // Filtrar tickets por fecha
    const ticketsDelDia = tickets.filter(ticket => {
        if (ticket.fechaConsulta) {
            return ticket.fechaConsulta === fecha;
        }
        return new Date(ticket.fecha).toISOString().split('T')[0] === fecha;
    });
    
    if (ticketsDelDia.length === 0) {
        showNotification('No hay consultas para la fecha seleccionada', 'error');
        return;
    }
    
    // Generar el CSV
    exportToCSV(ticketsDelDia, `consultas_${fecha}`);
}

function exportarMes() {
    const fecha = fechaHorario.value;
const [year, month] = fecha.split('-');

// Filtrar tickets del mes seleccionado
const ticketsDelMes = tickets.filter(ticket => {
        let ticketDate;
        if (ticket.fechaConsulta) {
            ticketDate = new Date(ticket.fechaConsulta);
        } else {
            ticketDate = new Date(ticket.fecha);
        }
        
        return ticketDate.getFullYear() === parseInt(year) && 
               ticketDate.getMonth() === parseInt(month) - 1;
    });
    
    if (ticketsDelMes.length === 0) {
        showNotification('No hay consultas para el mes seleccionado', 'error');
        return;
    }
    
    // Generar el CSV
    exportToCSV(ticketsDelMes, `consultas_${year}_${month}`);
}

function exportToCSV(data, filename) {
    // Encabezados del CSV
    const headers = [
        'ID', 
        'Cliente', 
        'Mascota', 
        'Tipo', 
        'Cédula', 
        'ID Paciente',
        'Médico',
        'Fecha', 
        'Hora', 
        'Estado', 
        'Urgencia',
        'Factura',
        'Motivo'
    ];
    
    // Crear las filas de datos
    const rows = data.map(ticket => [
        ticket.id,
        ticket.nombre,
        ticket.mascota,
        getTipoMascotaLabel(ticket.tipoMascota),
        ticket.cedula,
        ticket.idPaciente || '',
        ticket.medicoAtiende || '',
        ticket.fechaConsulta || new Date(ticket.fecha).toISOString().split('T')[0],
        ticket.horaConsulta || ticket.horaCreacion,
        getEstadoLabel(ticket.estado),
        (ticket.urgencia || '').toUpperCase(),
        ticket.numFactura || '',
        ticket.motivo
    ]);
    
    // Combinar encabezados y filas
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Crear blob y enlace de descarga
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Archivo CSV generado correctamente', 'success');
}

function exportarGoogle() {
    showNotification('Para exportar a Google Sheets, configura la API en producción', 'info');
    
    // Opción alternativa: abrir Google Sheets en nueva pestaña
    window.open('https://docs.google.com/spreadsheets', '_blank');
}

function backupData() {
    // Crear una copia sin las claves de Firebase para el backup
    const ticketsBackup = tickets.map(ticket => {
        const { firebaseKey, ...ticketData } = ticket;
        return ticketData;
    });
    
    const backup = {
        tickets: ticketsBackup,
        currentTicketId: currentTicketId,
        timestamp: new Date().toISOString(),
        version: '1.0'
    };
    
    const jsonString = JSON.stringify(backup);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_veterinaria_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showNotification('Respaldo generado correctamente', 'success');
}

function cleanOldData() {
    if (!confirm('¿Estás seguro de limpiar las consultas terminadas con más de 3 meses de antigüedad? Esta acción no se puede deshacer.')) {
        return;
    }
    
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    
    // Mostrar indicador de carga
    showLoading();
    
    // Obtener tickets a eliminar (terminados con más de 3 meses)
    const ticketsToDelete = tickets.filter(ticket => {
        if (ticket.estado !== 'terminado') {
            return false; // Mantener tickets que no estén terminados
        }
        
        // Para tickets terminados, verificar la fecha
        const fechaTicket = new Date(ticket.fecha);
        return fechaTicket < tresMesesAtras;
    });
    
    // Contador para operaciones pendientes
    let pendingOperations = ticketsToDelete.length;
    
    if (pendingOperations === 0) {
        hideLoading();
        showNotification('No hay consultas antiguas para eliminar', 'info');
        return;
    }
    
    // Eliminar cada ticket en Firebase
    ticketsToDelete.forEach(ticket => {
        if (!ticket.firebaseKey) {
            pendingOperations--;
            if (pendingOperations === 0) {
                hideLoading();
                showNotification(`Se eliminaron ${ticketsToDelete.length} consultas antiguas`, 'success');
            }
            return;
        }
        
        ticketsRef.child(ticket.firebaseKey).remove()
            .then(() => {
                pendingOperations--;
                if (pendingOperations === 0) {
                    hideLoading();
                    showNotification(`Se eliminaron ${ticketsToDelete.length} consultas antiguas`, 'success');
                }
            })
            .catch(error => {
                console.error("Error eliminando ticket antiguo:", error);
                pendingOperations--;
                if (pendingOperations === 0) {
                    hideLoading();
                    showNotification('Hubo errores al eliminar algunas consultas antiguas', 'error');
                }
            });
    });
}

// Funciones auxiliares
function getTipoMascotaLabel(tipo) {
    const tipos = {
        'perro': 'Perro',
        'gato': 'Gato',
        'ave': 'Ave',
        'otro': 'Otro'
    };
    return tipos[tipo] || tipo;
}

function getEstadoLabel(estado) {
    const estados = {
        'espera': 'En Sala de Espera',
        'consultorio1': 'Consultorio 1',
        'consultorio2': 'Consultorio 2',
        'consultorio3': 'Consultorio 3',
        'consultorio4': 'Consultorio 4',
        'consultorio5': 'Consultorio 5',
        'terminado': 'Terminado'
    };
    return estados[estado] || estado;
}

// Funciones para indicadores de carga
function showLoading() {
    // Crear overlay de carga
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loadingOverlay';
    loadingOverlay.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-paw fa-spin"></i>
            <p>Conectando...</p>
        </div>
    `;
    document.body.appendChild(loadingOverlay);
    
    // Añadir estilo si no existe
    if (!document.getElementById('loading-styles')) {
        const style = document.createElement('style');
        style.id = 'loading-styles';
        style.textContent = `
            #loadingOverlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            }
            .loading-spinner {
                text-align: center;
            }
            .loading-spinner i {
                font-size: 3rem;
                color: var(--primary-color);
                margin-bottom: 15px;
            }
            .loading-spinner p {
                color: var(--dark-color);
                font-size: 1.2rem;
            }
            .button-loading {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }
            .button-loading::after {
                content: '';
                display: inline-block;
                width: 1em;
                height: 1em;
                border: 2px solid currentColor;
                border-radius: 50%;
                border-right-color: transparent;
                animation: button-spinner 0.75s linear infinite;
                margin-left: 8px;
                vertical-align: text-bottom;
            }
            @keyframes button-spinner {
                to {transform: rotate(360deg);}
            }
        `;
        document.head.appendChild(style);
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

function showLoadingButton(button) {
    if (!button) return;
    button.classList.add('button-loading');
    button.innerHTML = button.innerHTML.replace(/<i.*<\/i>/, '');
    button.disabled = true;
}

function hideLoadingButton(button) {
    if (!button) return;
    button.classList.remove('button-loading');
    button.disabled = false;
}

// Agregar después de su función renderChart() actual

// Variables para los nuevos charts
let chartServiciosPersonal = null;
let chartDistribucionServicios = null;

// Función para obtener todos los nombres de personal único
function obtenerPersonalUnico() {
    const personal = new Set();
    
    tickets.forEach(ticket => {
        if (ticket.medicoAtiende) {
            // Dividir en caso de que haya múltiples personas separadas por comas
            const personas = ticket.medicoAtiende.split(',').map(p => p.trim());
            personas.forEach(persona => {
                if (persona) personal.add(persona);
            });
        }
    });
    
    return Array.from(personal).sort();
}

// Función para llenar el selector de personal
function llenarSelectorPersonal() {
    const personalUnico = obtenerPersonalUnico();
    const select = document.getElementById('filtroPersonal');
    
    if (!select) return;
    
    // Limpiar opciones existentes excepto "Todos"
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Agregar personal único
    personalUnico.forEach(persona => {
        const option = document.createElement('option');
        option.value = persona;
        option.textContent = persona;
        select.appendChild(option);
    });
}

// Función para obtener el nombre legible de un tipo de servicio
function getNombreServicio(tipoServicio) {
    const servicios = {
        'consulta': 'Consulta general',
        'revaloracion': 'Revaloración',
        'retiroHilos': 'Retiro de hilos',
        'rayosX': 'Rayos X',
        'desparasitacion': 'Desparasitación',
        'inyectable': 'Inyectables',
        'corteUnas': 'Corte de uñas',
        'emergencia': 'Emergencia',
        'tomaMuestras': 'Toma de muestras',
        'tests': 'Tests',
        'hemograma': 'Hemograma',
        'eutanasia': 'Eutanasia',
        'quitarPuntos': 'Quitar puntos',
        'otro': 'Otro'
    };
    
    return servicios[tipoServicio] || tipoServicio;
}

// Función para filtrar tickets por período
function filtrarPorPeriodo(tickets, periodo) {
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    
    let fechaInicio, fechaFin;
    
    switch(periodo) {
        case 'hoy':
            fechaInicio = inicioHoy;
            fechaFin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
            break;
        case 'semana':
            const diaSemana = hoy.getDay(); // 0 = domingo, 1 = lunes, etc.
            const inicioSemana = new Date(hoy);
            inicioSemana.setDate(hoy.getDate() - diaSemana);
            fechaInicio = new Date(inicioSemana.getFullYear(), inicioSemana.getMonth(), inicioSemana.getDate());
            fechaFin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
            break;
        case 'mes':
            fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'ano':
            fechaInicio = new Date(hoy.getFullYear(), 0, 1);
            fechaFin = new Date(hoy.getFullYear(), 11, 31, 23, 59, 59);
            break;
        case 'personalizado':
            const fechaInicioInput = document.getElementById('fechaInicioEstadisticas');
            const fechaFinInput = document.getElementById('fechaFinEstadisticas');
            
            if (fechaInicioInput && fechaInicioInput.value) {
                fechaInicio = new Date(fechaInicioInput.value);
            } else {
                fechaInicio = new Date(0); // Fecha más antigua posible
            }
            
            if (fechaFinInput && fechaFinInput.value) {
                fechaFin = new Date(fechaFinInput.value);
                fechaFin.setHours(23, 59, 59);
            } else {
                fechaFin = new Date(); // Fecha actual
            }
            break;
        default:
            fechaInicio = new Date(0); // Fecha más antigua posible
            fechaFin = new Date(); // Fecha actual
    }
    
    return tickets.filter(ticket => {
        const fechaTicket = ticket.fechaConsulta 
            ? new Date(ticket.fechaConsulta) 
            : new Date(ticket.fecha);
            
        return fechaTicket >= fechaInicio && fechaTicket <= fechaFin;
    });
}

// Función para generar las estadísticas de personal y servicios
function generarEstadisticasPersonalServicios() {
    console.log("Generating personnel and service statistics");
    
    // Get filter values
    const filtroPersonal = document.getElementById('filtroPersonal').value;
    const filtroServicio = document.getElementById('filtroServicio').value;
    const filtroPeriodo = document.getElementById('filtroPeriodo').value;
    
    console.log("Filters:", { personal: filtroPersonal, servicio: filtroServicio, periodo: filtroPeriodo });
    console.log("Total tickets:", tickets.length);
    
    // Filter tickets by period
    let ticketsFiltrados = filtrarPorPeriodo(tickets, filtroPeriodo);
    console.log("Filtered by period:", ticketsFiltrados.length);
    
    // Filter by service if not "todos"
    if (filtroServicio !== 'todos') {
        ticketsFiltrados = ticketsFiltrados.filter(ticket => 
            ticket && ticket.tipoServicio === filtroServicio);
        console.log("Filtered by service:", ticketsFiltrados.length);
    }
    
    // Prepare structure to count services by personnel
    const conteoPersonalServicio = {};
    const conteoServicios = {};
    let totalServicios = 0;
    
    // Count services by personnel
    ticketsFiltrados.forEach(ticket => {
        if (!ticket) return; // Skip undefined tickets
        
        // If no service type, assume "consulta"
        const servicio = ticket.tipoServicio || 'consulta';
        
        // Add to general service count - ONLY ONCE PER TICKET
        conteoServicios[servicio] = (conteoServicios[servicio] || 0) + 1;
        totalServicios++;
        
        // If no médico/personnel, add to "Sin asignar" category
        if (!ticket.medicoAtiende || ticket.medicoAtiende.trim() === '') {
            const persona = "Sin asignar";
            
            // Initialize structure if it doesn't exist
            if (!conteoPersonalServicio[persona]) {
                conteoPersonalServicio[persona] = {};
            }
            
            // Increment count
            conteoPersonalServicio[persona][servicio] = 
                (conteoPersonalServicio[persona][servicio] || 0) + 1;
            
            return;
        }
        
        // Split in case of multiple people
        const personas = ticket.medicoAtiene.split(',').map(p => p.trim());
        
        personas.forEach(persona => {
            if (!persona) return;
            
            // Filter by specific personnel if not "todos"
            if (filtroPersonal !== 'todos' && persona !== filtroPersonal) return;
            
            // Initialize structure if it doesn't exist
            if (!conteoPersonalServicio[persona]) {
                conteoPersonalServicio[persona] = {};
            }
            
            // Increment count for each person (the service is credited to each person)
            conteoPersonalServicio[persona][servicio] = 
                (conteoPersonalServicio[persona][servicio] || 0) + 1;
        });
    });
    
    console.log("Personnel count:", Object.keys(conteoPersonalServicio).length);
    console.log("Service count:", Object.keys(conteoServicios).length);
    console.log("Total services:", totalServicios);
    
    // Generate table data
    const tablaBody = document.getElementById('tablaEstadisticasBody');
    if (tablaBody) {
        tablaBody.innerHTML = '';
        
        if (totalServicios === 0) {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="4" class="no-data">No hay datos para los filtros seleccionados</td>
                </tr>
            `;
        } else {
            // For each person
            Object.keys(conteoPersonalServicio).sort().forEach(persona => {
                // For each service of that person
                Object.keys(conteoPersonalServicio[persona]).sort().forEach((servicio, index) => {
                    const cantidad = conteoPersonalServicio[persona][servicio];
                    const porcentaje = ((cantidad / totalServicios) * 100).toFixed(1);
                    
                    const row = document.createElement('tr');
                    
                    // In the first row of this person, show their name
                    if (index === 0) {
                        row.innerHTML = `
                            <td rowspan="${Object.keys(conteoPersonalServicio[persona]).length}">${persona}</td>
                            <td>${getNombreServicio(servicio)}</td>
                            <td>${cantidad}</td>
                            <td>${porcentaje}%</td>
                        `;
                    } else {
                        row.innerHTML = `
                            <td>${getNombreServicio(servicio)}</td>
                            <td>${cantidad}</td>
                            <td>${porcentaje}%</td>
                        `;
                    }
                    
                    tablaBody.appendChild(row);
                });
            });
        }
    }
    
    // Generate charts
    generarGraficosPersonalServicios(conteoPersonalServicio, conteoServicios);
}

// Modify the function to handle empty data gracefully
function generarGraficosPersonalServicios(conteoPersonalServicio, conteoServicios) {
    console.log("Generating charts for personnel and services");
    
    // Chart 1: Services by Personnel (bar chart)
    const ctxPersonal = document.getElementById('chartServiciosPersonal')?.getContext('2d');
    if (ctxPersonal) {
        // Check if there's data to display
        if (Object.keys(conteoPersonalServicio).length === 0) {
            // No data, display a message
            if (chartServiciosPersonal) {
                chartServiciosPersonal.destroy();
                chartServiciosPersonal = null;
            }
            
            // Draw "No data" text
            ctxPersonal.font = '16px Arial';
            ctxPersonal.fillStyle = '#888';
            ctxPersonal.textAlign = 'center';
            ctxPersonal.fillText('No hay datos para mostrar', ctxPersonal.canvas.width / 2, ctxPersonal.canvas.height / 2);
        } else {
            // Prepare data for the chart
            const datasets = [];
            const serviciosUnicos = new Set();
            
            // Collect all unique services
            Object.values(conteoPersonalServicio).forEach(servicios => {
                Object.keys(servicios).forEach(servicio => serviciosUnicos.add(servicio));
            });
            
            // Colors for services
            const colores = [
                '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
                '#6f42c1', '#fd7e14', '#20c9a6', '#858796', '#5a5c69',
                '#a3a4a5', '#d1d3e2', '#eaecf4'
            ];
            
            // Create a dataset for each service
            Array.from(serviciosUnicos).sort().forEach((servicio, index) => {
                const data = [];
                const labels = Object.keys(conteoPersonalServicio).sort();
                
                // For each person, get the amount of this service
                labels.forEach(persona => {
                    data.push(conteoPersonalServicio[persona][servicio] || 0);
                });
                
                datasets.push({
                    label: getNombreServicio(servicio),
                    data: data,
                    backgroundColor: colores[index % colores.length],
                    borderColor: colores[index % colores.length],
                    borderWidth: 1
                });
            });
            
            // Destroy previous chart if it exists
            if (chartServiciosPersonal) {
                chartServiciosPersonal.destroy();
            }
            
            // Create new chart
            chartServiciosPersonal = new Chart(ctxPersonal, {
                type: 'bar',
                data: {
                    labels: Object.keys(conteoPersonalServicio).sort(),
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    }
                }
            });
        }
    }
    
    // Chart 2: Service Distribution (pie chart)
    const ctxServicios = document.getElementById('chartDistribucionServicios')?.getContext('2d');
    if (ctxServicios) {
        // Check if there's data to display
        if (Object.keys(conteoServicios).length === 0) {
            // No data, display a message
            if (chartDistribucionServicios) {
                chartDistribucionServicios.destroy();
                chartDistribucionServicios = null;
            }
            
            // Draw "No data" text
            ctxServicios.font = '16px Arial';
            ctxServicios.fillStyle = '#888';
            ctxServicios.textAlign = 'center';
            ctxServicios.fillText('No hay datos para mostrar', ctxServicios.canvas.width / 2, ctxServicios.canvas.height / 2);
        } else {
            // Prepare data for the chart
            const labels = [];
            const data = [];
            const backgroundColor = [];
            
            // Colors for the chart
            const colores = [
                '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
                '#6f42c1', '#fd7e14', '#20c9a6', '#858796', '#5a5c69',
                '#a3a4a5', '#d1d3e2', '#eaecf4'
            ];
            
            // For each service, get its total
            Object.keys(conteoServicios).sort().forEach((servicio, index) => {
                labels.push(getNombreServicio(servicio));
                data.push(conteoServicios[servicio]);
                backgroundColor.push(colores[index % colores.length]);
            });
            
            // Destroy previous chart if it exists
            if (chartDistribucionServicios) {
                chartDistribucionServicios.destroy();
            }
            
            // Create new chart
            chartDistribucionServicios = new Chart(ctxServicios, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColor,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }
}

// Agregar esta función para calcular estadísticas de tiempo de espera
function calculateWaitTimeStats() {
    const tiemposEspera = {};
    let ticketsConTiempos = 0;
    
    // Filtrar tickets que tienen tanto hora de llegada como de atención
    tickets.forEach(ticket => {
        if (ticket.horaLlegada && ticket.horaAtencion) {
            const servicio = ticket.tipoServicio || 'consulta';
            
            // Convertir tiempos a minutos para calcular la diferencia
            const llegada = convertTimeToMinutes(ticket.horaLlegada);
            const atencion = convertTimeToMinutes(ticket.horaAtencion);
            
            // Calcular la diferencia en minutos
            const tiempoEspera = atencion - llegada;
            
            // Solo considerar diferencias válidas (positivas)
            if (tiempoEspera >= 0) {
                // Inicializar el objeto si no existe
                if (!tiemposEspera[servicio]) {
                    tiemposEspera[servicio] = {
                        total: 0,
                        count: 0,
                        tiempos: []
                    };
                }
                
                // Sumar el tiempo de espera y contar este ticket
                tiemposEspera[servicio].total += tiempoEspera;
                tiemposEspera[servicio].count++;
                tiemposEspera[servicio].tiempos.push(tiempoEspera);
                ticketsConTiempos++;
            }
        }
    });
    
    // Generar tabla de resultados
    const waitTimeStatsBody = document.getElementById('waitTimeStatsBody');
    if (waitTimeStatsBody) {
        waitTimeStatsBody.innerHTML = '';
        
        if (ticketsConTiempos === 0) {
            waitTimeStatsBody.innerHTML = `
                <tr>
                    <td colspan="3" class="no-data">No hay datos suficientes para calcular tiempos de espera</td>
                </tr>
            `;
        } else {
            // Ordenar servicios por tiempo promedio (mayor a menor)
            const serviciosOrdenados = Object.keys(tiemposEspera).sort((a, b) => {
                const avgA = tiemposEspera[a].total / tiemposEspera[a].count;
                const avgB = tiemposEspera[b].total / tiemposEspera[b].count;
                return avgB - avgA; // Orden descendente
            });
            
            serviciosOrdenados.forEach(servicio => {
                const { total, count } = tiemposEspera[servicio];
                const promedio = total / count;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${getNombreServicio(servicio)}</td>
                    <td>${formatMinutesToTime(promedio)}</td>
                    <td>${count}</td>
                `;
                waitTimeStatsBody.appendChild(row);
            });
        }
    }
    
    // Generar gráfico de tiempos de espera
    renderWaitTimeChart(tiemposEspera);
}

// Función para convertir hora (HH:MM) a minutos desde medianoche
function convertTimeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

// Función para formatear minutos a tiempo HH:MM
function formatMinutesToTime(minutes) {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hrs}h ${mins}m`;
}

// Función para renderizar gráfico de tiempos de espera
function renderWaitTimeChart(tiemposEspera) {
    const ctx = document.getElementById('waitTimeChart');
    if (!ctx) return;
    
    // Destruir gráfico anterior si existe y es un objeto Chart válido
    if (window.waitTimeChart && typeof window.waitTimeChart.destroy === 'function') {
        try {
            window.waitTimeChart.destroy();
        } catch (error) {
            console.error("Error al destruir el gráfico anterior:", error);
        }
    }
    
    // Si no hay datos para mostrar, no intentamos crear un gráfico
    const serviciosValidos = Object.keys(tiemposEspera)
        .filter(servicio => tiemposEspera[servicio] && tiemposEspera[servicio].count > 0);
    
    if (serviciosValidos.length === 0) {
        // No hay datos, dibujar un mensaje
        const ctxCanvas = ctx.getContext('2d');
        if (ctxCanvas) {
            ctxCanvas.clearRect(0, 0, ctx.width, ctx.height);
            ctxCanvas.font = '16px Arial';
            ctxCanvas.fillStyle = '#888';
            ctxCanvas.textAlign = 'center';
            ctxCanvas.fillText('No hay datos suficientes para calcular tiempos de espera', 
                ctx.width / 2 || 150, ctx.height / 2 || 150);
        }
        // Importante: no asignar el objeto window.waitTimeChart en este caso
        window.waitTimeChart = null;
        return;
    }
    
    // Preparar datos para el gráfico
    const labels = [];
    const data = [];
    const backgroundColors = [
        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
        '#6f42c1', '#fd7e14', '#20c9a6', '#858796', '#5a5c69'
    ];
    
    // Ordenar por tiempo promedio
    serviciosValidos.sort((a, b) => {
        const avgA = tiemposEspera[a].total / tiemposEspera[a].count;
        const avgB = tiemposEspera[b].total / tiemposEspera[b].count;
        return avgB - avgA; // Orden descendente
    });
    
    // Limitar a los 10 servicios con mayor tiempo de espera
    const serviciosMostrados = serviciosValidos.slice(0, 10);
    
    serviciosMostrados.forEach((servicio, index) => {
        const { total, count } = tiemposEspera[servicio];
        const promedio = total / count;
        
        labels.push(getNombreServicio(servicio));
        data.push(promedio);
    });
    
    try {
        // Crear gráfico con manejo de errores
        window.waitTimeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tiempo promedio de espera (minutos)',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Minutos'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                return `Tiempo de espera: ${formatMinutesToTime(value)}`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error al crear el gráfico de tiempos de espera:", error);
        window.waitTimeChart = null;
    }
}

// Integrar con estadísticas existentes
function updateStats() {
    const totalPacientes = tickets.length;
    const pacientesEspera = tickets.filter(t => t.estado === 'espera').length;
    const pacientesConsulta = tickets.filter(t => 
        t.estado === 'consultorio1' || t.estado === 'consultorio2' || t.estado === 'consultorio3'
    ).length;
    const pacientesAtendidos = tickets.filter(t => t.estado === 'terminado').length;
    
    document.getElementById('totalPacientes').textContent = totalPacientes;
    document.getElementById('pacientesEspera').textContent = pacientesEspera;
    document.getElementById('pacientesConsulta').textContent = pacientesConsulta;
    document.getElementById('pacientesAtendidos').textContent = pacientesAtendidos;
    
    // Asegurarnos que la sección de tiempo promedio sea visible
    const waitTimeSection = document.querySelector('.wait-time-statistics');
    if (waitTimeSection) {
        waitTimeSection.style.display = 'block';
    }
    
    // Calcular estadísticas de tiempo de espera
    calculateWaitTimeStats();
}

// Event listeners para los filtros
document.addEventListener('DOMContentLoaded', function() {
    // Selector de período personalizado
    const filtroPeriodo = document.getElementById('filtroPeriodo');
    const periodPersonalizado = document.getElementById('periodPersonalizado');
    
    if (filtroPeriodo && periodPersonalizado) {
        filtroPeriodo.addEventListener('change', function() {
            if (this.value === 'personalizado') {
                periodPersonalizado.style.display = 'flex';
            } else {
                periodPersonalizado.style.display = 'none';
            }
        });
    }
    
    // Botón para aplicar filtros
    const aplicarFiltrosBtn = document.getElementById('aplicarFiltrosBtn');
    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener('click', generarEstadisticasPersonalServicios);
    }
    
    // Inicializar estadísticas al cargar la sección
    const estadisticasBtn = document.getElementById('estadisticasBtn');
    if (estadisticasBtn) {
        estadisticasBtn.addEventListener('click', function() {
            // Llenar selector de personal después de cargar tickets
            setTimeout(() => {
                llenarSelectorPersonal();
                generarEstadisticasPersonalServicios();
            }, 100);
        });
    }
});
