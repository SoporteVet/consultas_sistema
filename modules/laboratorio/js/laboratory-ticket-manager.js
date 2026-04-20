// fix-lab-ticket-creation.js
// Corrección para problemas de creación de tickets de laboratorio

// Variables para controlar la inicialización
let labSystemInitialized = false;
let labTicketsListener = null;

// Función mejorada para inicializar el sistema de laboratorio
function initLaboratorioSystemFixed() {
    // Prevenir inicialización múltiple
    if (labSystemInitialized) {
        console.log('Sistema de laboratorio ya inicializado');
        return;
    }
    
    // Verificar acceso al módulo de laboratorio
    if (!hasLabAccess()) {
        return;
    }
    
    try {
        // Limpiar listener anterior si existe
        if (labTicketsListener && labTicketsRef) {
            if (typeof labTicketsListener === 'function') {
                labTicketsRef.off('value', labTicketsListener);
            }
            labTicketsListener = null;
        }
        
        // Configurar referencia de Firebase
        if (window.database) {
            labTicketsRef = window.database.ref('lab_tickets');
            setupLabFirebaseListenersFixed();
        } else {
            console.error('Base de datos no disponible');
            return;
        }
        
        // Configurar event listeners primero
        setupLabEventListeners();
        
        // Establecer fecha por defecto
        setDefaultLabDate();
        
        // Configurar actualización en tiempo real de clientes
        setupClientesDataListener();
        
        // Marcar como inicializado
        labSystemInitialized = true;
        
        console.log('Sistema de laboratorio inicializado correctamente');
        
    } catch (error) {
        console.error('Error inicializando sistema de laboratorio:', error);
    }
}

// Función mejorada para configurar listeners de Firebase
function setupLabFirebaseListenersFixed() {
    if (!labTicketsRef) {
        console.error('Referencia de Firebase no disponible');
        return;
    }
    
    // Limpiar listener anterior si existe
    if (labTicketsListener && labTicketsRef) {
        if (typeof labTicketsListener === 'function') {
            labTicketsRef.off('value', labTicketsListener);
        }
    }
    
    // Crear nuevo listener y guardar referencia
    labTicketsListener = (snapshot) => {
        try {
            // Prevenir procesamiento múltiple
            if (labTicketsRef._processing) {
                return;
            }
            labTicketsRef._processing = true;
            
            // Limpiar arrays existentes
            labTickets = [];
            let maxId = 0;
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach(key => {
                    const ticket = { ...data[key], firebaseKey: key };
                    labTickets.push(ticket);
                    
                    // Actualizar el ID más alto
                    if (ticket.id && ticket.id > maxId) {
                        maxId = ticket.id;
                    }
                });
            }
            
            // Actualizar ID global de manera segura
            currentLabTicketId = maxId + 1;
            
            // Actualizar la vista si está activa
            const labSection = document.getElementById('verLabSection');
            if (labSection && !labSection.classList.contains('hidden')) {
                // Obtener filtros activos
                const activeFilterBtn = document.querySelector('.lab-filter-btn.active');
                const currentStateFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'todos';
                const medicoFilter = document.getElementById('labMedicoFilter');
                const currentMedicoFilter = medicoFilter ? medicoFilter.value : '';
                
                renderLabTickets(currentStateFilter, currentMedicoFilter);
                updateLabStats();
            }
            
            // Exportar globalmente para otros módulos
            try {
                window.labTickets = labTickets;
            } catch (e) {
                console.error('Error exportando tickets:', e);
            }
            
        } catch (error) {
            console.error('Error procesando snapshot de Firebase:', error);
        } finally {
            // Liberar el flag de procesamiento
            labTicketsRef._processing = false;
        }
    };
    
    // Configurar el listener
    labTicketsRef.on('value', labTicketsListener);
}

// Función mejorada para guardar tickets
function saveLabTicketFixed(ticketData) {
    if (!labTicketsRef) {
        showNotification('Error de conexión con la base de datos', 'error');
        return;
    }
    
    // Verificar que no exista un ticket con el mismo randomId
    const existingTicket = labTickets.find(t => t.randomId === ticketData.randomId);
    if (existingTicket) {
        // Generar nuevo randomId si hay conflicto
        ticketData.randomId = generateRandomId();
        console.log('RandomId duplicado detectado, generando nuevo:', ticketData.randomId);
    }
    
    const submitBtn = document.querySelector('#labTicketForm .btn-submit');
    if (submitBtn) {
        showLoadingButton(submitBtn);
    }
    
    // Agregar timestamp de creación para mejor sincronización
    ticketData.timestampCreacion = Date.now();
    ticketData.usuarioCreacion = sessionStorage.getItem('userEmail') || 'usuario_desconocido';
    
    labTicketsRef.push(ticketData)
        .then((ref) => {
            showNotification('Ticket de laboratorio creado exitosamente', 'success');
            
            // Esperar un momento antes de resetear para asegurar sincronización
            setTimeout(() => {
                resetLabForm();
                
                // Cambiar a la vista de tickets de laboratorio
                showLabSection('verLabSection');
            }, 500);
        })
        .catch(error => {
            console.error('Error creando ticket:', error);
            showNotification('Error al crear el ticket de laboratorio', 'error');
        })
        .finally(() => {
            if (submitBtn) {
                hideLoadingButton(submitBtn);
            }
        });
}

// Función para limpiar listeners al salir
function cleanupLabSystem() {
    if (labTicketsListener && labTicketsRef) {
        if (typeof labTicketsListener === 'function') {
            labTicketsRef.off('value', labTicketsListener);
        }
        labTicketsListener = null;
    }
    labSystemInitialized = false;
    console.log('Sistema de laboratorio limpiado');
}

// Función para verificar integridad de datos
function verifyLabDataIntegrity() {
    try {
        // Verificar que no haya tickets duplicados
        const randomIds = labTickets.map(t => t.randomId);
        const duplicates = randomIds.filter((id, index) => randomIds.indexOf(id) !== index);
        
        if (duplicates.length > 0) {
            console.warn('Tickets duplicados detectados:', duplicates);
            showNotification('Se detectaron tickets duplicados. Contacte al administrador.', 'warning');
        }
        
        // Verificar consistencia de IDs
        const ids = labTickets.map(t => t.id).filter(id => id && !isNaN(id));
        if (ids.length > 0) {
            const maxId = Math.max(...ids);
            if (currentLabTicketId <= maxId) {
                currentLabTicketId = maxId + 1;
                console.log('ID de ticket corregido:', currentLabTicketId);
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error verificando integridad de datos:', error);
        return false;
    }
}

// Función para forzar recarga de datos
function forceReloadLabData() {
    try {
        if (labTicketsRef) {
            // Limpiar datos actuales
            labTickets = [];
            currentLabTicketId = 1;
            
            // Forzar recarga desde Firebase
            labTicketsRef.once('value')
                .then((snapshot) => {
                    if (labTicketsListener) {
                        labTicketsListener(snapshot);
                    }
                    showNotification('Datos de laboratorio recargados', 'success');
                })
                .catch(error => {
                    console.error('Error recargando datos:', error);
                    showNotification('Error al recargar datos', 'error');
                });
        }
    } catch (error) {
        console.error('Error en recarga forzada:', error);
    }
}

// Función para diagnosticar problemas
function diagnoseLabProblems() {
    const problems = [];
    
    // Verificar conexión a Firebase
    if (!window.database) {
        problems.push('No hay conexión a la base de datos');
    }
    
    // Verificar referencia de laboratorio
    if (!labTicketsRef) {
        problems.push('Referencia de laboratorio no configurada');
    }
    
    // Verificar listener activo
    if (!labTicketsListener) {
        problems.push('Listener de Firebase no activo');
    }
    
    // Verificar datos cargados
    if (labTickets.length === 0) {
        problems.push('No hay tickets cargados');
    }
    
    // Verificar ID actual
    if (currentLabTicketId < 1) {
        problems.push('ID de ticket inválido');
    }
    
    // Mostrar diagnóstico
    if (problems.length > 0) {
        const message = 'Problemas detectados:\n' + problems.join('\n');
        console.warn(message);
        showNotification(message, 'warning');
    } else {
        showNotification('No se detectaron problemas', 'success');
    }
    
    return problems;
}

// Exportar funciones para uso global
window.initLaboratorioSystemFixed = initLaboratorioSystemFixed;
window.saveLabTicketFixed = saveLabTicketFixed;
window.cleanupLabSystem = cleanupLabSystem;
window.verifyLabDataIntegrity = verifyLabDataIntegrity;
window.forceReloadLabData = forceReloadLabData;
window.diagnoseLabProblems = diagnoseLabProblems;

// Agregar listener para limpieza al salir de la página
window.addEventListener('beforeunload', cleanupLabSystem);

console.log('Sistema de corrección de tickets de laboratorio cargado');
