// Módulo de Integración de Búsqueda por Cédula
// Integra la API de Hacienda de Costa Rica para autocompletar datos del propietario

class CedulaSearchIntegration {
    constructor() {
        this.apiUrl = 'https://api.hacienda.go.cr/fe/ae?identificacion=';
        this.searchTimeout = null;
        this.init();
    }

    init() {
        console.log('🔍 Módulo de búsqueda por cédula inicializado');
        // Esperar a que patient-database esté listo
        this.waitForPatientDatabase();
    }

    waitForPatientDatabase() {
        if (window.patientDatabase && window.patientDatabase.initialized) {
            this.setupIntegration();
        } else {
            setTimeout(() => this.waitForPatientDatabase(), 500);
        }
    }

    setupIntegration() {
        // Integrar con formularios
        this.setupCedulaFieldEnhancement('cedula', 'consulta');
        this.setupCedulaFieldEnhancement('quirofanoCedula', 'quirofano');
        this.setupCedulaFieldEnhancement('labCedula', 'laboratorio');
        console.log('✅ Integración de búsqueda por cédula lista');
    }

    // Mejorar campo de cédula con búsqueda API y tickets
    setupCedulaFieldEnhancement(fieldId, formType) {
        const cedulaField = document.getElementById(fieldId);
        if (!cedulaField) return;

        // Agregar botón de búsqueda
        this.addSearchButton(cedulaField, formType);

        // Búsqueda automática cuando el campo pierde el foco
        cedulaField.addEventListener('blur', (e) => {
            const cedula = e.target.value.trim();
            if (cedula && cedula.length >= 5) {
                // Verificar primero en BD local, si no existe buscar en API
                this.searchCedulaInAPI(cedula, formType, false);
            }
        });

        // Permitir buscar con Enter
        cedulaField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const cedula = e.target.value.trim();
                if (cedula && cedula.length >= 5) {
                    this.searchCedulaInAPI(cedula, formType, false);
                }
            }
        });

        // Búsqueda automática cuando no se encuentra en BD local (después de escribir)
        let searchTimeout;
        cedulaField.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const cedula = e.target.value.trim();
            
            // Si tiene al menos 5 dígitos, esperar un momento y buscar
            if (cedula.length >= 5) {
                searchTimeout = setTimeout(() => {
                    // Primero verificar en BD local
                    if (window.patientDatabase) {
                        const existingPatient = window.patientDatabase.findPatientByCedula(cedula);
                        if (!existingPatient) {
                            // Si no existe en BD local, buscar en API externa
                            this.searchCedulaInAPI(cedula, formType, true);
                        }
                    } else {
                        // Si no hay BD local disponible, buscar directamente en API
                        this.searchCedulaInAPI(cedula, formType, true);
                    }
                }, 1000); // Esperar 1 segundo después de que el usuario deje de escribir
            }
        });
    }

    // Agregar botón de búsqueda visual
    addSearchButton(cedulaField, formType) {
        const formGroup = cedulaField.parentElement;
        if (!formGroup || formGroup.querySelector('.cedula-search-button')) return;

        // Crear contenedor de búsqueda
        const searchContainer = document.createElement('div');
        searchContainer.className = 'cedula-search-container';
        searchContainer.style.cssText = 'display: flex; gap: 8px; align-items: stretch;';

        // Envolver el input
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'flex: 1; position: relative;';
        cedulaField.parentNode.insertBefore(wrapper, cedulaField);
        wrapper.appendChild(cedulaField);

        // Crear botón de búsqueda de API
        const apiButton = document.createElement('button');
        apiButton.type = 'button';
        apiButton.className = 'cedula-search-button api-search-btn';
        apiButton.innerHTML = '<i class="fas fa-search"></i>';
        apiButton.title = 'Buscar información del propietario en base de datos nacional';
        apiButton.onclick = () => this.searchCedulaInAPI(cedulaField.value.trim(), formType);

        // Agregar botones al contenedor
        searchContainer.appendChild(wrapper);
        searchContainer.appendChild(apiButton);

        // Insertar después de la etiqueta (evita problemas con nodos de texto)
        const label = formGroup.querySelector('label');
        if (label && label.nextSibling) {
            formGroup.insertBefore(searchContainer, label.nextSibling);
        } else {
            formGroup.appendChild(searchContainer);
        }
    }

    // Buscar en la API de Hacienda de Costa Rica
    async searchCedulaInAPI(cedula, formType = 'consulta', skipLocalCheck = false) {
        if (!cedula || cedula.length < 5) {
            this.showSearchNotification('Por favor ingrese un número de cédula válido (mínimo 5 dígitos)', 'warning');
            return;
        }

        // Primero verificar si ya existe en nuestra BD (a menos que se indique lo contrario)
        if (!skipLocalCheck && window.patientDatabase) {
            const existingPatient = window.patientDatabase.findPatientByCedula(cedula);
            if (existingPatient) {
                // Notificación eliminada según solicitud del usuario
                // El sistema de patient-database ya mostrará el dropdown
                return;
            }
        }

        // Si no existe, buscar en API de Hacienda
        this.showLoadingIndicator(true);

        try {
            // Limpiar la cédula (solo números)
            const cedulaLimpia = cedula.replace(/\D/g, '');
            const url = `${this.apiUrl}${cedulaLimpia}`;
            
            // Intentar primero con fetch simple (sin headers para evitar problemas de CORS)
            let response;
            let useProxy = false;
            
            try {
                response = await fetch(url, {
                    method: 'GET',
                    mode: 'cors'
                });
            } catch (corsError) {
                // Si falla por CORS, usar proxy
                useProxy = true;
                console.warn('Error CORS directo, usando proxy:', corsError.message);
            }

            // Si hay error de CORS o la respuesta no es OK, intentar con proxy
            if (useProxy || (response && !response.ok && response.status === 0)) {
                try {
                    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
                    response = await fetch(proxyUrl, {
                        method: 'GET',
                        mode: 'cors'
                    });
                    
                    if (response.ok) {
                        const proxyData = await response.json();
                        // El proxy devuelve el contenido en el campo 'contents'
                        try {
                            const data = typeof proxyData.contents === 'string' 
                                ? JSON.parse(proxyData.contents) 
                                : proxyData.contents;
                            this.processAPIResponse(data, cedula, formType);
                            return;
                        } catch (parseError) {
                            console.error('Error parseando respuesta del proxy:', parseError);
                            throw new Error('Error al procesar respuesta de la API');
                        }
                    }
                } catch (proxyError) {
                    console.error('Error con proxy CORS:', proxyError);
                    throw new Error('No se pudo conectar con el servicio de búsqueda de cédulas');
                }
            }

            if (!response || !response.ok) {
                if (response && response.status === 404) {
                    this.showSearchNotification('No se encontró información para esta cédula en la base de datos nacional', 'warning');
                    return;
                }
                throw new Error(`HTTP error! status: ${response ? response.status : 'unknown'}`);
            }

            const data = await response.json();
            this.processAPIResponse(data, cedula, formType);

        } catch (error) {
            console.error('Error buscando en API de cédulas:', error);
            // Verificar si es un error de CORS específico
            if (error.message && error.message.includes('CORS') || error.name === 'TypeError') {
                this.showSearchNotification('Error de conexión con la API. Por favor, intente nuevamente o contacte al administrador.', 'error');
            } else {
                this.showSearchNotification('No se pudo conectar con el servicio de búsqueda de cédulas. Verifique su conexión a internet.', 'error');
            }
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    // Procesar respuesta de la API de Hacienda
    processAPIResponse(data, cedula, formType) {
        // Manejar diferentes formatos de respuesta de la API de Hacienda
        let nombre = '';
        if (data) {
            if (typeof data === 'string') {
                // Si la respuesta es un string, intentar parsearlo
                try {
                    const parsed = JSON.parse(data);
                    nombre = parsed.nombre || parsed.name || parsed.razonSocial || 
                            parsed.results?.nombre || parsed.results?.name || parsed.results?.razonSocial ||
                            parsed.data?.nombre || parsed.data?.name || parsed.data?.razonSocial || '';
                } catch (e) {
                    // Si no es JSON, puede ser el nombre directamente
                    nombre = data;
                }
            } else if (data.nombre) {
                nombre = data.nombre;
            } else if (data.name) {
                nombre = data.name;
            } else if (data.razonSocial) {
                nombre = data.razonSocial;
            } else if (data.results) {
                nombre = data.results.nombre || data.results.name || data.results.razonSocial || '';
            } else if (data.data) {
                nombre = data.data.nombre || data.data.name || data.data.razonSocial || '';
            } else if (Array.isArray(data) && data.length > 0) {
                // Si es un array, tomar el primer elemento
                const firstItem = data[0];
                nombre = firstItem.nombre || firstItem.name || firstItem.razonSocial || '';
            }
        }
        
        if (nombre && nombre.trim()) {
            // La API de Hacienda ya devuelve el nombre en el formato correcto (nombre primero)
            // No es necesario invertir
            this.fillOwnerDataFromAPI(nombre.trim(), cedula, formType);
            // Notificación eliminada según solicitud del usuario
        } else {
            this.showSearchNotification('No se encontró información para esta cédula', 'warning');
        }
    }

    // Invertir nombre de "APELLIDOS NOMBRE" a "NOMBRE APELLIDOS"
    invertirNombre(nombreCompleto) {
        if (!nombreCompleto) return nombreCompleto;
        
        const nombreOriginal = nombreCompleto.trim();
        const partes = nombreOriginal.split(/\s+/).filter(p => p.length > 0);
        
        if (partes.length <= 1) return nombreOriginal;
        
        // Si tiene 2 partes: invertir directamente
        if (partes.length === 2) {
            return `${partes[1]} ${partes[0]}`;
        }
        
        // Para 3 o más partes: últimos 2 son nombres, resto son apellidos
        // Ejemplo: "MORAGA JARQUIN ALBA LUZ" -> "ALBA LUZ MORAGA JARQUIN"
        if (partes.length >= 3) {
            const nombres = partes.slice(-2).join(' ');
            const apellidos = partes.slice(0, -2).join(' ');
            return `${nombres} ${apellidos}`;
        }
        
        return nombreOriginal;
    }

    // Rellenar datos del propietario desde la API
    fillOwnerDataFromAPI(nombre, cedula, formType = 'consulta') {
        const fieldMappings = {
            consulta: {
                nombre: 'nombre',
                cedula: 'cedula'
            },
            quirofano: {
                nombre: 'quirofanoNombre',
                cedula: 'quirofanoCedula'
            },
            laboratorio: {
                nombre: 'labNombre',
                cedula: 'labCedula'
            }
        };

        const fields = fieldMappings[formType] || fieldMappings.consulta;

        // Rellenar nombre (siempre, incluso si ya tiene valor, para actualizar)
        const nombreInput = document.getElementById(fields.nombre);
        if (nombreInput) {
            // Si el campo está vacío o solo tiene espacios, rellenarlo
            if (!nombreInput.value || nombreInput.value.trim() === '') {
                nombreInput.value = nombre;
                nombreInput.style.background = '#e8f5e9'; // Verde claro para indicar autocompletado
                
                // Quitar el fondo después de 2 segundos
                setTimeout(() => {
                    nombreInput.style.background = '';
                }, 2000);
            }
        }

        // Enfocar en el siguiente campo (mascota) si el nombre se rellenó
        if (nombreInput && nombreInput.value === nombre) {
            const nextField = formType === 'consulta' ? 
                document.getElementById('mascota') : 
                formType === 'quirofano' ?
                document.getElementById('quirofanoMascota') :
                document.getElementById('labMascota');
            
            if (nextField) {
                setTimeout(() => nextField.focus(), 100);
            }
        }
    }

    // Buscar tickets existentes por cédula
    searchTicketsByCedula(cedula) {
        if (!cedula || cedula.length < 5) {
            this.showSearchNotification('Por favor ingrese un número de cédula válido', 'warning');
            return;
        }

        // Buscar en tickets de consulta
        const consultaTickets = window.tickets ? 
            window.tickets.filter(t => t.cedula && t.cedula.includes(cedula)) : [];

        // Buscar en tickets de quirófano
        const quirofanoTickets = window.quirofanoTickets ? 
            window.quirofanoTickets.filter(t => t.cedula && t.cedula.includes(cedula)) : [];

        // Mostrar resultados
        this.displayTicketSearchResults(cedula, consultaTickets, quirofanoTickets);
    }

    // Mostrar resultados de búsqueda de tickets
    displayTicketSearchResults(cedula, consultaTickets, quirofanoTickets) {
        // Eliminar modal anterior si existe
        const existingModal = document.getElementById('cedulaTicketsModal');
        if (existingModal) existingModal.remove();

        const totalTickets = consultaTickets.length + quirofanoTickets.length;

        if (totalTickets === 0) {
            this.showSearchNotification(`No se encontraron tickets para la cédula: ${cedula}`, 'info');
            return;
        }

        // Crear modal
        const modal = document.createElement('div');
        modal.id = 'cedulaTicketsModal';
        modal.className = 'cedula-tickets-modal';
        modal.innerHTML = `
            <div class="cedula-tickets-modal-content">
                <div class="cedula-tickets-modal-header">
                    <h3><i class="fas fa-search"></i> Tickets Encontrados</h3>
                    <button class="cedula-tickets-modal-close" onclick="document.getElementById('cedulaTicketsModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="cedula-tickets-modal-body">
                    <div class="cedula-info">
                        <i class="fas fa-id-card"></i>
                        <strong>Cédula:</strong> ${cedula}
                        <span class="ticket-count">${totalTickets} ticket(s) encontrado(s)</span>
                    </div>

                    ${consultaTickets.length > 0 ? `
                        <div class="tickets-section">
                            <h4><i class="fas fa-stethoscope"></i> Consultas (${consultaTickets.length})</h4>
                            <div class="tickets-list">
                                ${consultaTickets.map(ticket => this.createTicketCard(ticket, 'consulta')).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${quirofanoTickets.length > 0 ? `
                        <div class="tickets-section">
                            <h4><i class="fas fa-cut"></i> Quirófano (${quirofanoTickets.length})</h4>
                            <div class="tickets-list">
                                ${quirofanoTickets.map(ticket => this.createTicketCard(ticket, 'quirofano')).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Cerrar al hacer clic fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Cerrar con ESC
        const closeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', closeHandler);
            }
        };
        document.addEventListener('keydown', closeHandler);
    }

    // Crear tarjeta de ticket
    createTicketCard(ticket, type) {
        const fecha = ticket.fechaConsulta || ticket.fechaProgramada || 
                     (ticket.fecha ? new Date(ticket.fecha).toLocaleDateString('es-ES') : 'Sin fecha');
        const mascota = ticket.mascota || ticket.nombreMascota || 'Sin nombre';
        const nombre = ticket.nombre || ticket.nombrePropietario || 'Sin nombre';
        const estado = ticket.estado || 'Sin estado';
        const id = ticket.id || ticket.numero || '?';
        
        const estadoClass = estado.toLowerCase().replace(/\s+/g, '-');
        
        return `
            <div class="ticket-card-mini">
                <div class="ticket-card-header">
                    <span class="ticket-id">#${id}</span>
                    <span class="ticket-fecha">${fecha}</span>
                </div>
                <div class="ticket-card-body">
                    <div class="ticket-info-row">
                        <i class="fas fa-user"></i>
                        <strong>Propietario:</strong> ${nombre}
                    </div>
                    <div class="ticket-info-row">
                        <i class="fas fa-paw"></i>
                        <strong>Mascota:</strong> ${mascota}
                    </div>
                    ${ticket.tipoMascota || ticket.tipoMascota ? `
                        <div class="ticket-info-row">
                            <i class="fas fa-tag"></i>
                            <strong>Tipo:</strong> ${ticket.tipoMascota || ticket.tipoMascota}
                        </div>
                    ` : ''}
                    ${ticket.motivo || ticket.procedimiento ? `
                        <div class="ticket-info-row">
                            <i class="fas fa-notes-medical"></i>
                            <strong>Motivo:</strong> ${ticket.motivo || ticket.procedimiento}
                        </div>
                    ` : ''}
                    <div class="ticket-card-footer">
                        <span class="ticket-estado estado-${estadoClass}">${estado}</span>
                        ${ticket.tipoServicio ? `<span class="ticket-servicio">${ticket.tipoServicio}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // Mostrar/ocultar indicador de carga
    showLoadingIndicator(show) {
        const indicators = document.querySelectorAll('.api-search-btn');
        indicators.forEach(btn => {
            if (show) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            } else {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-search"></i>';
            }
        });
    }

    // Mostrar notificación de búsqueda
    showSearchNotification(message, type) {
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
}

// Inicializar cuando el documento esté listo
let cedulaSearchIntegration;

function initCedulaSearchIntegration() {
    if (!cedulaSearchIntegration) {
        cedulaSearchIntegration = new CedulaSearchIntegration();
        window.cedulaSearchIntegration = cedulaSearchIntegration;
    }
}

// Auto-inicialización
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initCedulaSearchIntegration, 1500);
    });
} else {
    setTimeout(initCedulaSearchIntegration, 1500);
}

window.initCedulaSearchIntegration = initCedulaSearchIntegration;

