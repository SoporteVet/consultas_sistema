// Sistema de Tickets para Veterinaria
let tickets = [];
let currentTicketId = 1;
let isDataLoaded = false;

// Referencias a elementos DOM
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

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Mostrar indicador de carga
    showLoading();
    
    // Inicializar Firebase Auth y cargar datos
    initAuth().then(() => {
        loadTickets().then(() => {
            hideLoading();
            isDataLoaded = true;
            
            // Mostrar por defecto la sección de crear ticket
            showSection(crearTicketSection);
            crearTicketBtn.classList.add('active');
            
            // Establecer fecha actual en el formulario
            if (document.getElementById('fecha')) {
                document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
            }
            
            // Establecer fecha actual en el campo de fecha del horario
            const today = new Date().toISOString().split('T')[0];
            if (fechaHorario) {
                fechaHorario.value = today;
            }
            
            renderTickets();
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
});

// Event listeners
crearTicketBtn.addEventListener('click', () => {
    showSection(crearTicketSection);
    setActiveButton(crearTicketBtn);
});

verTicketsBtn.addEventListener('click', () => {
    showSection(verTicketsSection);
    setActiveButton(verTicketsBtn);
    renderTickets();
});

estadisticasBtn.addEventListener('click', () => {
    showSection(estadisticasSection);
    setActiveButton(estadisticasBtn);
    updateStats();
    renderChart();
});

ticketForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addTicket();
});

// Event listeners para la sección de horario
if (horarioBtn) {
    horarioBtn.addEventListener('click', () => {
        showSection(horarioSection);
        setActiveButton(horarioBtn);
        mostrarHorario();
    });
}

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

// Funciones
function showSection(section) {
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
        // Cargar tickets desde Firebase
        ticketsRef.once('value')
            .then(snapshot => {
                tickets = [];
                currentTicketId = 1;
                
                // Convertir objeto de Firebase en array
                const data = snapshot.val() || {};
                
                Object.keys(data).forEach(key => {
                    tickets.push({
                        ...data[key],
                        firebaseKey: key // Guardar clave Firebase para operaciones futuras
                    });
                    
                    // Actualizar currentTicketId
                    if (data[key].id >= currentTicketId) {
                        currentTicketId = data[key].id + 1;
                    }
                });
                
                // Cargar configuración
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
            if (!isDataLoaded) return; // Evitar duplicados durante carga inicial
            
            const newTicket = {
                ...snapshot.val(),
                firebaseKey: snapshot.key
            };
            
            // Verificar si el ticket ya existe (evitar duplicados)
            if (!tickets.some(t => t.id === newTicket.id)) {
                tickets.push(newTicket);
                renderTickets();
                updateStats();
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
                renderTickets();
                updateStats();
            }
        });
        
        ticketsRef.on('child_removed', snapshot => {
            const index = tickets.findIndex(t => t.firebaseKey === snapshot.key);
            if (index !== -1) {
                tickets.splice(index, 1);
                renderTickets();
                updateStats();
            }
        });
    });
}

function addTicket() {
    const nombre = document.getElementById('nombre').value;
    const mascota = document.getElementById('mascota').value;
    const cedula = document.getElementById('cedula').value;
    const motivo = document.getElementById('motivo').value;
    const estado = document.getElementById('estado').value;
    const tipoMascota = document.getElementById('tipoMascota').value;
    const urgencia = document.getElementById('urgencia').value;
    
    // Campos adicionales
    const idPaciente = document.getElementById('idPaciente')?.value || '';
    const medicoAtiende = document.getElementById('medicoAtiende')?.value || '';
    const numFactura = document.getElementById('numFactura')?.value || '';
    const porCobrar = document.getElementById('porCobrar')?.value || '';
    
    // Obtener fecha y hora seleccionadas
    const fechaConsulta = document.getElementById('fecha')?.value;
    const horaConsulta = document.getElementById('hora')?.value;
    
    const fecha = new Date();
    
    // Crear nuevo ticket
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
        porCobrar,
        fecha: fecha.toISOString(),
        horaCreacion: fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    };
    
    // Añadir campos de fecha y hora de consulta si están disponibles
    if (fechaConsulta) nuevoTicket.fechaConsulta = fechaConsulta;
    if (horaConsulta) nuevoTicket.horaConsulta = horaConsulta;
    
    // Mostrar indicador de carga
    showLoadingButton(document.querySelector('.btn-submit'));
    
    // Guardar en Firebase
    ticketsRef.push(nuevoTicket)
        .then(() => {
            // Incrementar el ID para el siguiente ticket
            currentTicketId++;
            settingsRef.update({ currentTicketId });
            
            // Limpiar formulario
            ticketForm.reset();
            
            // Restaurar fecha actual en el formulario si existe el campo
            if (document.getElementById('fecha')) {
                document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
            }
            
            // Quitar indicador de carga
            hideLoadingButton(document.querySelector('.btn-submit'));
            
            // Mostrar mensaje de éxito
            showNotification('Consulta creada correctamente', 'success');
            
            // Opcional: cambiar a la vista de tickets
            setTimeout(() => {
                showSection(verTicketsSection);
                setActiveButton(verTicketsBtn);
            }, 1500);
        })
        .catch(error => {
            console.error("Error guardando ticket:", error);
            hideLoadingButton(document.querySelector('.btn-submit'));
            showNotification('Error al guardar la consulta', 'error');
        });
}

function renderTickets(filter = 'todos') {
    ticketContainer.innerHTML = '';
    
    let filteredTickets = [...tickets];
    
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
    } else if (filter === 'porCobrar') {
        // Filtrar tickets que tengan algo por cobrar
        filteredTickets = tickets.filter(ticket => ticket.porCobrar && ticket.porCobrar.trim() !== '');
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
        ticketElement.className = `ticket ticket-${ticket.estado} ${ticket.urgencia === 'alta' ? 'ticket-urgencia-alta' : ''}`;
        
        // Añadir clase especial si tiene algo por cobrar
        if (ticket.porCobrar && ticket.porCobrar.trim() !== '') {
            ticketElement.classList.add('ticket-por-cobrar');
        }
        
        ticketElement.dataset.id = ticket.id;
        
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
        
        // Añadir indicador visual si hay algo por cobrar
        const porCobrarIndicator = ticket.porCobrar 
            ? `<p class="por-cobrar-info"><i class="fas fa-exclamation-circle"></i> Por cobrar: ${ticket.porCobrar}</p>` 
            : '';
        
        ticketElement.innerHTML = `
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
                <p><i class="fas fa-clock"></i> ${ticket.horaCreacion}</p>
                ${ticket.fechaConsulta ? `<p><i class="fas fa-calendar-day"></i> Fecha: ${formatDate(ticket.fechaConsulta)}</p>` : ''}
                ${ticket.horaConsulta ? `<p><i class="fas fa-hourglass-start"></i> Hora: ${ticket.horaConsulta}</p>` : ''}
                <div class="estado-badge ${estadoClass}">
                    <i class="fas fa-${ticket.estado === 'espera' ? 'hourglass-half' : 
                                 ticket.estado.includes('consultorio') ? 'user-md' : 'check-circle'}"></i>
                    ${estadoText}
                </div>
                ${porCobrarIndicator}
            </div>
            <div class="ticket-actions">
                <button class="action-btn btn-editar" onclick="editTicket(${ticket.id})">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="action-btn btn-cambiar" onclick="changeStatus(${ticket.id})">
                    <i class="fas fa-exchange-alt"></i> Cambiar Estado
                </button>
                <button class="action-btn btn-eliminar" onclick="deleteTicket(${ticket.id})">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;
        
        // Agregar animación basada en el índice para escalonamiento
        ticketElement.style.animationDelay = `${index * 0.1}s`;
        
        ticketContainer.appendChild(ticketElement);
    });
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
        // Compatibilidad con tickets antiguos
        return new Date(ticket.fecha).toISOString().split('T')[0] === fecha;
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
        
        // Aplicar clase por cobrar si corresponde
        if (ticket.porCobrar && ticket.porCobrar.trim() !== '') {
            row.classList.add('fila-por-cobrar');
        }
        
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
            <td class="${urgenciaClass}">${ticket.urgencia.toUpperCase()}</td>
            <td>${ticket.medicoAtiende || '-'}</td>
            <td>${ticket.idPaciente || '-'}</td>
            <td>${ticket.numFactura || '-'}</td>
            <td>${ticket.porCobrar || '-'}</td>
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
    if (!ticket) return;
    
    // Mostrar un formulario modal para editar
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
    
    modal.innerHTML = `
        <div class="modal-content animate-scale">
            <h3>${animalIcon} Editar Ticket #${ticket.id}</h3>
            <form id="editForm">
                <div class="form-group">
                    <label for="editNombre">Nombre del Cliente</label>
                    <input type="text" id="editNombre" value="${ticket.nombre}" required>
                </div>
                <div class="form-group">
                    <label for="editMascota">Nombre de la Mascota</label>
                    <input type="text" id="editMascota" value="${ticket.mascota}" required>
                </div>
                <div class="form-group">
                    <label for="editCedula">Cédula</label>
                    <input type="text" id="editCedula" value="${ticket.cedula}" required>
                </div>
                <div class="form-group">
                    <label for="editIdPaciente">ID Paciente</label>
                    <input type="text" id="editIdPaciente" value="${ticket.idPaciente || ''}">
                </div>
                <!-- Añadir campos de fecha y hora -->
                <div class="form-group">
                    <label for="editFechaConsulta">Fecha de Consulta</label>
                    <input type="date" id="editFechaConsulta" value="${ticket.fechaConsulta || ''}" required>
                </div>
                <div class="form-group">
                    <label for="editHoraConsulta">Hora de Consulta</label>
                    <input type="time" id="editHoraConsulta" value="${ticket.horaConsulta || ''}" required>
                </div>
                <div class="form-group">
                    <label for="editMedicoAtiende">Médico que atiende</label>
                    <input type="text" id="editMedicoAtiende" value="${ticket.medicoAtiende || ''}">
                </div>
                <div class="form-group">
                    <label for="editMotivo">Motivo</label>
                    <textarea id="editMotivo" required>${ticket.motivo}</textarea>
                </div>
                <div class="form-group">
                    <label for="editNumFactura">Número de factura</label>
                    <input type="text" id="editNumFactura" value="${ticket.numFactura || ''}">
                </div>
                <div class="form-group">
                    <label for="editPorCobrar">Por Cobrar</label>
                    <input type="text" id="editPorCobrar" value="${ticket.porCobrar || ''}">
                </div>
                <div class="form-group">
                    <label for="editTipoMascota">Tipo de Mascota</label>
                    <select id="editTipoMascota" required>
                        <option value="perro" ${ticket.tipoMascota === 'perro' ? 'selected' : ''}>Perro</option>
                        <option value="gato" ${ticket.tipoMascota === 'gato' ? 'selected' : ''}>Gato</option>
                        <option value="ave" ${ticket.tipoMascota === 'ave' ? 'selected' : ''}>Ave</option>
                        <option value="otro" ${ticket.tipoMascota === 'otro' ? 'selected' : ''}>Otro</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="editUrgencia">Urgencia</label>
                    <select id="editUrgencia" required>
                        <option value="normal" ${ticket.urgencia === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="media" ${ticket.urgencia === 'media' ? 'selected' : ''}>Media</option>
                        <option value="alta" ${ticket.urgencia === 'alta' ? 'selected' : ''}>Alta</option>
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
    
    document.getElementById('editForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Actualizar ticket
        ticket.nombre = document.getElementById('editNombre').value;
        ticket.mascota = document.getElementById('editMascota').value;
        ticket.cedula = document.getElementById('editCedula').value;
        ticket.idPaciente = document.getElementById('editIdPaciente').value;
        // Actualizar fecha y hora
        ticket.fechaConsulta = document.getElementById('editFechaConsulta').value;
        ticket.horaConsulta = document.getElementById('editHoraConsulta').value;
        ticket.medicoAtiende = document.getElementById('editMedicoAtiende').value;
        ticket.motivo = document.getElementById('editMotivo').value;
        ticket.numFactura = document.getElementById('editNumFactura').value;
        ticket.porCobrar = document.getElementById('editPorCobrar').value;
        ticket.tipoMascota = document.getElementById('editTipoMascota').value;
        ticket.urgencia = document.getElementById('editUrgencia').value;
        
        saveEditedTicket(ticket);
    });
}

function saveEditedTicket(ticket) {
    if (!ticket.firebaseKey) {
        showNotification('Error al guardar los cambios', 'error');
        return;
    }
    
    // Mostrar indicador de carga
    const saveButton = document.querySelector('.btn-save');
    if (saveButton) {
        showLoadingButton(saveButton);
    }
    
    // Eliminar la propiedad firebaseKey antes de guardar
    const ticketToSave = {...ticket};
    delete ticketToSave.firebaseKey;
    
    ticketsRef.child(ticket.firebaseKey).update(ticketToSave)
        .then(() => {
            closeModal();
            showNotification('Consulta actualizada correctamente', 'success');
            
            // Si estamos en la vista de horario, actualizarla también
            if (document.getElementById('horarioSection').classList.contains('active')) {
                mostrarHorario();
            }
        })
        .catch(error => {
            console.error("Error actualizando ticket:", error);
            if (saveButton) {
                hideLoadingButton(saveButton);
            }
            showNotification('Error al guardar los cambios', 'error');
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
        ticket.estado = document.getElementById('changeEstado').value;
        
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
                
                // Si estamos en la vista de horario, actualizarla también
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

function deleteTicket(id) {
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
    
    // Mostrar indicador de carga
    const deleteButton = document.querySelector('.btn-delete');
    if (deleteButton) {
        showLoadingButton(deleteButton);
    }
    
    ticketsRef.child(ticket.firebaseKey).remove()
        .then(() => {
            showNotification('Consulta eliminada correctamente', 'success');
            closeModal();
            
            // Si estamos en la vista de horario, actualizarla también
            if (document.getElementById('horarioSection').classList.contains('active')) {
                mostrarHorario();
            }
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

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA0MKbA6xU2OlaCRFGNV_Ac22KmWU3Y2PI",
    authDomain: "consulta-7ece8.firebaseapp.com",
    projectId: "consulta-7ece8",
    storageBucket: "consulta-7ece8.firebasestorage.app",
    messagingSenderId: "960058925183",
    appId: "1:960058925183:web:9cec6000f0788d61b31f4a",
    measurementId: "G-6JVD4VRDBJ"
  };

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencia a la base de datos
const db = firebase.database();
const ticketsRef = db.ref('tickets');
const settingsRef = db.ref('settings');

// Sistema de autenticación básico
let userCredential = null;

// Iniciar sesión o crear cuenta anónima
function initAuth() {
    return new Promise((resolve, reject) => {
        // Comprobar si el usuario ya está autenticado
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                userCredential = user;
                resolve(user);
            } else {
                // Iniciar sesión anónima
                firebase.auth().signInAnonymously()
                    .then((credential) => {
                        userCredential = credential.user;
                        resolve(credential.user);
                    })
                    .catch((error) => {
                        console.error("Error de autenticación:", error);
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
    const pacientesPorCobrar = tickets.filter(t => t.porCobrar && t.porCobrar.trim() !== '').length;
    
    document.getElementById('totalPacientes').textContent = totalPacientes;
    document.getElementById('pacientesEspera').textContent = pacientesEspera;
    document.getElementById('pacientesConsulta').textContent = pacientesConsulta;
    document.getElementById('pacientesAtendidos').textContent = pacientesAtendidos;
    
    // Verificar si existe el elemento antes de intentar actualizarlo
    if (document.getElementById('pacientesPorCobrar')) {
        document.getElementById('pacientesPorCobrar').textContent = pacientesPorCobrar;
    }
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
        'Por Cobrar', 
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
        ticket.urgencia.toUpperCase(),
        ticket.numFactura || '',
        ticket.porCobrar || '',
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