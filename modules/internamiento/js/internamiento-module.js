// ====================================================================
// MÓDULO DE INTERNAMIENTO - SISTEMA VETERINARIO
// ====================================================================
// Versión: 1.0.0 BETA
// Este módulo es completamente independiente y no modifica otros módulos
// ====================================================================

class InternamientoModule {
    constructor() {
        this.internamientosRef = null;
        this.internamientos = new Map();
        this.currentInternamientoId = null;
        this.initialized = false;
        this.listeners = [];
        
        // Flag de beta (puede desactivarse sin afectar el sistema)
        this.betaEnabled = true;
        
        console.log('🏥 Módulo de Internamiento inicializando...');
    }

    // ================================================================
    // INICIALIZACIÓN
    // ================================================================
    
    async init() {
        if (!window.database) {
            console.log('⏳ Esperando Firebase...');
            setTimeout(() => this.init(), 500);
            return;
        }

        // Verificar permisos
        if (!this.canAccessModule()) {
            console.log('❌ Usuario sin permisos para internamiento');
            return;
        }

        // Inicializar referencias de Firebase
        this.internamientosRef = window.database.ref('internamientos');
        
        // Setup listeners
        this.setupFirebaseListeners();
        
        // Setup UI
        this.setupUI();
        
        this.initialized = true;
        console.log('✅ Módulo de Internamiento inicializado');
    }

    canAccessModule() {
        const userRole = sessionStorage.getItem('userRole');
        const allowedRoles = ['admin', 'consulta_externa', 'internos'];
        return this.betaEnabled && allowedRoles.includes(userRole);
    }

    setupFirebaseListeners() {
        if (!this.internamientosRef) return;

        // Listener para internamientos activos
        const activeListener = this.internamientosRef
            .orderByChild('estado/actual')
            .on('value', (snapshot) => {
                this.internamientos.clear();
                
                if (snapshot.exists()) {
                    snapshot.forEach((childSnapshot) => {
                        const data = childSnapshot.val();
                        this.internamientos.set(childSnapshot.key, data);
                    });
                    
                    console.log(`📊 Cargados ${this.internamientos.size} internamientos`);
                    this.refreshInternamientosList();
                }
            });

        this.listeners.push(activeListener);
    }

    // ================================================================
    // UI SETUP
    // ================================================================
    
    setupUI() {
        // Agregar botón inmediatamente si el DOM está listo
        this.addMenuButton();
        this.setupEventListeners();
        
        // Si no se pudo agregar, reintentar después de un momento
        if (!document.getElementById('internamientosCategory')) {
            setTimeout(() => {
                this.addMenuButton();
            }, 500);
        }
    }

    addMenuButton() {
        // Verificar permisos primero
        if (!this.canAccessModule()) {
            return;
        }

        // Verificar si ya existe
        if (document.getElementById('internamientosCategory')) {
            return;
        }

        // Buscar el nav dentro del sidebar
        const nav = document.querySelector('.sidebar nav');
        if (!nav) {
            return;
        }

        // Buscar la categoría de Quirófano para insertar después
        const quirofanoCategory = document.getElementById('quirofanoBtn')?.closest('.nav-category');
        if (!quirofanoCategory) {
            return;
        }

        // Crear categoría de Internamientos siguiendo el mismo patrón
        const internamientosCategory = document.createElement('div');
        internamientosCategory.id = 'internamientosCategory';
        internamientosCategory.className = 'nav-category';

        internamientosCategory.innerHTML = `
          <button id="internamientosBtn" class="nav-category-btn" onclick="toggleSubmenuHTML('internamientosBtn', 'internamientosSubmenu');">
            <i class="fas fa-bed"></i> Internamientos
            <span class="beta-badge" style="background: #f39c12; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 5px;">BETA</span>
            <i class="fas fa-chevron-down category-arrow"></i>
          </button>
          <div id="internamientosSubmenu" class="nav-submenu">
            <button id="verInternamientosBtn" class="submenu-btn" onclick="if(window.internamientoModule) { window.internamientoModule.showInternamientosSection(); }">
              <i class="fas fa-list-alt"></i> Ver Internamientos
            </button>
            <button id="crearInternamientoBtn" class="submenu-btn" onclick="if(window.internamientoModule) { window.internamientoModule.showAdmisionForm(); }">
              <i class="fas fa-plus-circle"></i> Nuevo Internamiento
            </button>
          </div>
        `;

        // Insertar después de Quirófano
        quirofanoCategory.parentNode.insertBefore(internamientosCategory, quirofanoCategory.nextSibling);
    }

    setupEventListeners() {
        // Botón nuevo internamiento
        const btnNuevo = document.getElementById('btnNuevoInternamiento');
        if (btnNuevo) {
            btnNuevo.addEventListener('click', () => this.showAdmisionForm());
        }

        // Botón volver desde admisión
        const btnVolverAdmision = document.getElementById('btnVolverAdmision');
        if (btnVolverAdmision) {
            btnVolverAdmision.addEventListener('click', () => this.showInternamientosSection());
        }

        // Formulario de admisión
        const formAdmision = document.getElementById('formAdmisionInternamiento');
        if (formAdmision) {
            formAdmision.addEventListener('submit', (e) => this.handleAdmisionSubmit(e));
        }

        // Búsqueda de cliente en admisión
        const cedulaAdmision = document.getElementById('internamientoCedulaAdmision');
        if (cedulaAdmision) {
            cedulaAdmision.addEventListener('blur', (e) => this.buscarClienteAdmision(e.target.value));
        }

        // Filtros de internamientos
        this.setupFiltrosEventListeners();
    }

    setupFiltrosEventListeners() {
        const filterBtns = document.querySelectorAll('#internamientosSection .filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remover active de todos
                filterBtns.forEach(b => b.classList.remove('active'));
                // Agregar active al clickeado
                btn.classList.add('active');
                
                // Obtener filtro
                const filter = btn.getAttribute('data-filter');
                this.currentFilter = filter;
                this.filterInternamientos(filter);
            });
        });

        // Búsqueda
        const buscarInput = document.getElementById('buscarInternamiento');
        if (buscarInput) {
            let searchTimeout;
            buscarInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.buscarInternamientos(e.target.value);
                }, 300);
            });

            // Efecto focus
            buscarInput.addEventListener('focus', () => {
                buscarInput.style.borderColor = 'var(--internamiento-secondary)';
                buscarInput.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)';
            });

            buscarInput.addEventListener('blur', () => {
                buscarInput.style.borderColor = '#e0e0e0';
                buscarInput.style.boxShadow = 'none';
            });
        }
    }

    filterInternamientos(filter) {
        const container = document.getElementById('internamientosActivosContainer');
        if (!container) return;

        let filtered = Array.from(this.internamientos.values());

        // Aplicar filtro
        switch(filter) {
            case 'activos':
                filtered = filtered.filter(int => int.estado?.actual === 'activo');
                break;
            case 'criticos':
                filtered = filtered.filter(int => int.estado?.actual === 'critico');
                break;
            case 'alta':
                filtered = filtered.filter(int => int.estado?.actual === 'alta');
                break;
            case 'todos':
                // Mostrar todos (activos, críticos y alta)
                filtered = filtered.filter(int => ['activo', 'critico', 'alta'].includes(int.estado?.actual));
                break;
            default:
                filtered = filtered.filter(int => ['activo', 'critico', 'alta'].includes(int.estado?.actual));
        }

        // Renderizar
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bed"></i>
                    <p>No hay internamientos en este estado</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(int => this.renderInternamientoCard(int)).join('');
    }

    buscarInternamientos(query) {
        if (!query || query.trim() === '') {
            this.filterInternamientos(this.currentFilter || 'activos');
            return;
        }

        const container = document.getElementById('internamientosActivosContainer');
        if (!container) return;

        const queryLower = query.toLowerCase().trim();
        
        const filtered = Array.from(this.internamientos.values()).filter(int => {
            const nombreMascota = (int.referencias?.nombreMascota || '').toLowerCase();
            const expediente = (int.metadata?.expedienteNumero || '').toLowerCase();
            const propietario = this.getNombrePropietario(int).toLowerCase();
            
            return nombreMascota.includes(queryLower) || 
                   expediente.includes(queryLower) || 
                   propietario.includes(queryLower);
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>No se encontraron internamientos que coincidan con: <strong>"${query}"</strong></p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(int => this.renderInternamientoCard(int)).join('');
    }

    // ================================================================
    // NAVEGACIÓN Y VISTAS
    // ================================================================
    
    showInternamientosSection() {
        // Cerrar sidebar en móviles
        if (window.innerWidth <= 980 && typeof closeSidebar === 'function') {
            closeSidebar();
        }

        // Ocultar todas las secciones del contenido principal
        const sections = document.querySelectorAll('.content section');
        sections.forEach(section => {
            section.classList.add('hidden');
            section.classList.remove('active');
        });

        // Mostrar sección de internamientos
        const internamientosSection = document.getElementById('internamientosSection');
        if (internamientosSection) {
            internamientosSection.classList.remove('hidden');
            setTimeout(() => {
                internamientosSection.classList.add('active');
            }, 50);
            
            // Mostrar lista, ocultar otras vistas
            this.showInternamientoView('lista');
            
            // Refresh lista
            this.refreshInternamientosList();
            
            // Establecer botón activo en sidebar
            if (typeof setActiveSubmenuButtonHTML === 'function') {
                setActiveSubmenuButtonHTML('verInternamientosBtn');
            }
        } else {
            console.error('❌ No se encontró la sección internamientosSection');
        }
    }

    showInternamientoView(viewName) {
        // Ocultar todas las vistas de internamiento
        const views = ['lista', 'admision', 'panel', 'turno', 'medicacion', 'procedimientos', 'evolucion', 'egreso'];
        views.forEach(view => {
            const element = document.getElementById(`internamiento-${view}`);
            if (element) {
                element.classList.add('hidden');
            }
        });

        // Mostrar vista solicitada
        const targetView = document.getElementById(`internamiento-${viewName}`);
        if (targetView) {
            targetView.classList.remove('hidden');
        }
    }

    // ================================================================
    // LISTA DE INTERNAMIENTOS
    // ================================================================
    
    refreshInternamientosList() {
        const container = document.getElementById('internamientosActivosContainer');
        if (!container) return;

        // Filtrar internamientos activos
        const activos = Array.from(this.internamientos.values())
            .filter(int => ['activo', 'critico', 'alta'].includes(int.estado?.actual));

        if (activos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bed"></i>
                    <p>No hay pacientes internados actualmente</p>
                    <button class="btn btn-primary" onclick="window.internamientoModule.showAdmisionForm()">
                        <i class="fas fa-plus"></i> Nuevo Internamiento
                    </button>
                </div>
            `;
            return;
        }

        // Renderizar lista
        container.innerHTML = activos.map(int => this.renderInternamientoCard(int)).join('');
    }

    renderInternamientoCard(internamiento) {
        const estado = internamiento.estado?.actual || 'activo';
        const estadoConfig = {
            'activo': { color: '#27ae60', icon: 'fa-heartbeat', label: 'ACTIVO' },
            'critico': { color: '#e74c3c', icon: 'fa-exclamation-triangle', label: 'CRÍTICO' },
            'alta': { color: '#f39c12', icon: 'fa-check-circle', label: 'ALTA MÉDICA' }
        };

        const config = estadoConfig[estado] || estadoConfig.activo;
        const nombreMascota = internamiento.referencias?.nombreMascota || 'Sin nombre';
        const expediente = internamiento.metadata?.expedienteNumero || 'N/A';
        const diasInternado = this.calcularDiasInternado(internamiento.datosIngreso?.fechaIngreso);

        return `
            <div class="internamiento-card" 
                 data-id="${internamiento.metadata?.internamientoId}"
                 data-estado="${estado}"
                 onclick="window.internamientoModule.showPanelPrincipal('${internamiento.metadata?.internamientoId}')">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
                            <i class="fas ${config.icon}" style="color: ${config.color}; font-size: 24px;"></i>
                            <h3>${nombreMascota}</h3>
                            <span class="badge-estado-${estado}">
                                ${config.label}
                            </span>
                        </div>
                        <div class="card-info">
                            <div><strong>Expediente:</strong> ${expediente}</div>
                            <div><strong>Días internado:</strong> ${diasInternado}</div>
                            <div><strong>Propietario:</strong> ${this.getNombrePropietario(internamiento)}</div>
                        </div>
                    </div>
                    <div style="text-align: right; padding-left: 15px;">
                        <i class="fas fa-chevron-right" style="color: #bdc3c7; font-size: 20px;"></i>
                    </div>
                </div>
            </div>
        `;
    }

    calcularDiasInternado(fechaIngreso) {
        if (!fechaIngreso) return '0';
        const diff = Date.now() - fechaIngreso;
        const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
        return dias === 0 ? 'Hoy' : `${dias} ${dias === 1 ? 'día' : 'días'}`;
    }

    getNombrePropietario(internamiento) {
        const cedula = internamiento.referencias?.cedulaCliente;
        if (!cedula) return 'No especificado';

        // Intentar obtener de base de datos de pacientes
        if (window.patientDatabase) {
            const patient = window.patientDatabase.findPatientByCedula(cedula);
            if (patient && patient.nombre) {
                return patient.nombre;
            }
        }

        return 'No especificado';
    }

    // ================================================================
    // ADMISIÓN - FORMULARIO
    // ================================================================
    
    showAdmisionForm(ticketData = null) {
        // Primero mostrar la sección principal de internamientos
        this.showInternamientosSection();
        
        // Luego mostrar la vista de admisión
        setTimeout(() => {
            this.showInternamientoView('admision');
        }, 100);

        // Si viene de un ticket, pre-llenar datos
        if (ticketData) {
            this.preLlenarAdmision(ticketData);
        } else {
            // Limpiar formulario
            const form = document.getElementById('formAdmisionInternamiento');
            if (form) form.reset();
        }
    }

    preLlenarAdmision(ticketData) {
        // Pre-llenar desde ticket
        if (ticketData.cedula) {
            const input = document.getElementById('internamientoCedulaAdmision');
            if (input) input.value = ticketData.cedula;
            this.buscarClienteAdmision(ticketData.cedula);
        }

        if (ticketData.mascota) {
            const input = document.getElementById('internamientoMascotaAdmision');
            if (input) input.value = ticketData.mascota;
        }

        if (ticketData.idPaciente) {
            const input = document.getElementById('internamientoIdPacienteAdmision');
            if (input) input.value = ticketData.idPaciente;
        }

        if (ticketData.motivo) {
            const textarea = document.getElementById('internamientoHistoriaClinica');
            if (textarea) textarea.value = ticketData.motivo;
        }
    }

    async buscarClienteAdmision(cedula) {
        if (!cedula || cedula.length < 5) return;

        const nombreInput = document.getElementById('internamientoNombreAdmision');
        const telefonoInput = document.getElementById('internamientoTelefonoAdmision');

        // Buscar en base de datos de pacientes
        if (window.patientDatabase) {
            const patient = window.patientDatabase.findPatientByCedula(cedula);
            if (patient) {
                if (nombreInput) nombreInput.value = patient.nombre || '';
                if (telefonoInput) telefonoInput.value = patient.telefono || '';

                // Mostrar selector de mascotas si tiene
                if (patient.mascotas && Object.keys(patient.mascotas).length > 0) {
                    this.showMascotaSelector(patient);
                }

                return;
            }
        }

        // Si no se encuentra, dejar campos vacíos para nuevo registro
        console.log('Cliente no encontrado, registrar nuevo');
    }

    showMascotaSelector(patient) {
        // Simplificado: solo pre-llenamos si hay una mascota
        const mascotas = Object.values(patient.mascotas || {});
        if (mascotas.length === 1) {
            const mascota = mascotas[0];
            const inputMascota = document.getElementById('internamientoMascotaAdmision');
            const inputIdPaciente = document.getElementById('internamientoIdPacienteAdmision');
            
            if (inputMascota) inputMascota.value = mascota.nombre || '';
            if (inputIdPaciente) inputIdPaciente.value = mascota.idPaciente || '';
        }
        // TODO: En v1.0 agregar selector visual de múltiples mascotas
    }

    async handleAdmisionSubmit(e) {
        e.preventDefault();

        // Validar permisos
        if (!this.canAccessModule()) {
            this.showAlert('No tienes permisos para crear internamientos', 'Acceso Denegado', 'error');
            return;
        }

        // Recoger datos del formulario
        const formData = this.getAdmisionFormData();

        // Validar datos obligatorios
        if (!this.validateAdmisionData(formData)) {
            return;
        }

        // Crear internamiento
        try {
            const internamientoId = await this.crearInternamiento(formData);
            
            if (internamientoId) {
                this.showNotification('Internamiento creado exitosamente', 'success');
                this.showPanelPrincipal(internamientoId);
            }
        } catch (error) {
            console.error('Error creando internamiento:', error);
            this.showAlert('Error al crear internamiento: ' + error.message, 'Error', 'error');
        }
    }

    getAdmisionFormData() {
        return {
            // Referencias (índices)
            cedula: document.getElementById('internamientoCedulaAdmision')?.value.trim() || '',
            nombre: document.getElementById('internamientoNombreAdmision')?.value.trim() || '',
            telefono: document.getElementById('internamientoTelefonoAdmision')?.value.trim() || '',
            mascota: document.getElementById('internamientoMascotaAdmision')?.value.trim() || '',
            idPaciente: document.getElementById('internamientoIdPacienteAdmision')?.value.trim() || '',
            tipoMascota: document.getElementById('internamientoTipoMascotaAdmision')?.value || 'otro',

            // Datos de ingreso
            historiaClinica: document.getElementById('internamientoHistoriaClinica')?.value.trim() || '',
            diagnosticoPresuntivo: document.getElementById('internamientoDiagnostico')?.value.trim() || '',
            padecimientosPrevios: document.getElementById('internamientoPadecimientos')?.value.trim() || '',
            pesoIngreso: parseFloat(document.getElementById('internamientoPesoIngreso')?.value) || 0,
            temperaturaIngreso: parseFloat(document.getElementById('internamientoTempIngreso')?.value) || 0,
            necesidadesEspeciales: document.getElementById('internamientoNecesidades')?.value.trim() || '',

            // Controles rápidos
            tomaronMuestras: document.getElementById('internamientoMuestras')?.checked || false,
            tieneExamenes: document.getElementById('internamientoExamenes')?.checked || false,
            ultrasonido: document.getElementById('internamientoUltrasonido')?.checked || false,
            castrado: document.getElementById('internamientoCastrado')?.checked || false,
            vacunaDespaAlDia: document.getElementById('internamientoVacunas')?.checked || false,

            // Persona responsable
            personaResponsable: document.getElementById('internamientoPersonaResponsable')?.value.trim() || '',
            telefonoResponsable: document.getElementById('internamientoTelefonoResponsable')?.value.trim() || ''
        };
    }

    validateAdmisionData(data) {
        if (!data.cedula) {
            this.showAlert('La cédula del propietario es obligatoria', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.nombre) {
            this.showAlert('El nombre del propietario es obligatorio', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.mascota) {
            this.showAlert('El nombre de la mascota es obligatorio', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.historiaClinica) {
            this.showAlert('La historia clínica es obligatoria', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.diagnosticoPresuntivo) {
            this.showAlert('El diagnóstico presuntivo es obligatorio', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.pesoIngreso || data.pesoIngreso <= 0) {
            this.showAlert('El peso de ingreso es obligatorio y debe ser mayor a 0', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.temperaturaIngreso || data.temperaturaIngreso < 30 || data.temperaturaIngreso > 45) {
            this.showAlert('La temperatura de ingreso es obligatoria y debe estar entre 30-45°C', 'Valor Inválido', 'warning');
            return false;
        }

        return true;
    }

    async crearInternamiento(data) {
        const userId = sessionStorage.getItem('userId');
        const userName = sessionStorage.getItem('userName');
        const empresa = sessionStorage.getItem('userEmpresa') || 'veterinaria_smp';

        // Generar IDs
        const internamientoId = 'int_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const expedienteNumero = this.generarExpedienteNumero();

        // Estructura de datos (siguiendo el diseño conceptual)
        const internamientoData = {
            metadata: {
                internamientoId: internamientoId,
                expedienteNumero: expedienteNumero,
                fechaCreacion: Date.now(),
                fechaUltimaActualizacion: Date.now(),
                creadoPor: userId,
                empresa: empresa,
                version: '1.0.0-beta'
            },

            referencias: {
                ticketId: null, // null por ahora, en futuro vincular con ticket
                cedulaCliente: data.cedula,
                idPaciente: data.idPaciente || data.mascota, // Fallback a nombre si no hay ID
                nombreMascota: data.mascota,
                tipoMascota: data.tipoMascota
            },

            datosIngreso: {
                fechaIngreso: Date.now(),
                horaIngreso: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                medicoResponsable: userId,
                medicoNombre: userName,
                historiaClinica: data.historiaClinica,
                diagnosticoPresuntivo: data.diagnosticoPresuntivo,
                padecimientosPrevios: data.padecimientosPrevios,
                pesoIngreso: data.pesoIngreso,
                temperaturaIngreso: data.temperaturaIngreso,
                necesidadesEspeciales: data.necesidadesEspeciales,
                controlesRapidos: {
                    tomaronMuestras: data.tomaronMuestras,
                    tieneExamenes: data.tieneExamenes,
                    ultrasonido: data.ultrasonido,
                    castrado: data.castrado,
                    vacunaDespaAlDia: data.vacunaDespaAlDia
                }
            },

            consentimientos: {
                personaResponsable: {
                    nombre: data.personaResponsable || data.nombre,
                    telefono: data.telefonoResponsable || data.telefono,
                    relacion: 'Propietario',
                    esContactoPrincipal: true
                },
                consentimientoFirmado: true, // Asumimos aceptado en beta
                fechaFirma: Date.now()
            },

            estado: {
                actual: 'activo',
                fechaCambio: Date.now(),
                cambiadoPor: userId,
                razonCambio: 'Ingreso inicial',
                historialEstados: [
                    {
                        estado: 'activo',
                        fecha: Date.now(),
                        usuario: userId,
                        usuarioNombre: userName
                    }
                ]
            },

            planTerapeutico: {
                medicamentos: {},
                terapiaFluidos: {
                    activa: false
                },
                ultimaActualizacion: Date.now()
            },

            turnos: {},
            procedimientos: {},
            notasEvolucion: {},

            serviciosRealizados: {
                consulta: { tipo: 'emergencia' },
                laboratorio: [],
                radiologia: { cantidad: 0 },
                ultrasonido: false,
                horasHospitalizacion: 0,
                medicacionDurante: [],
                alimentacionSuministrada: false,
                cirugias: [],
                anestesia: false,
                pruebasRapidas: [],
                otros: []
            },

            estadisticas: {
                totalDias: 0,
                totalHoras: 0,
                totalTurnos: 0,
                totalMedicaciones: 0,
                totalProcedimientos: 0,
                diasCritico: 0,
                diasEstable: 0,
                pesoIngreso: data.pesoIngreso,
                pesoEgreso: null
            },

            auditoria: {
                creadoEn: Date.now(),
                creadoPor: userId,
                ultimaModificacion: Date.now(),
                modificadoPor: userId,
                historialCambios: [
                    {
                        timestamp: Date.now(),
                        userId: userId,
                        usuarioNombre: userName,
                        accion: 'crear',
                        detalles: 'Internamiento creado'
                    }
                ]
            }
        };

        // Guardar en Firebase
        await this.internamientosRef.child(internamientoId).set(internamientoData);

        // Actualizar estadísticas iniciales
        await this.actualizarEstadisticasInternamiento(internamientoId);

        // Guardar/actualizar datos del cliente en base de datos de pacientes (sin modificar tickets)
        if (window.patientDatabase) {
            await window.patientDatabase.savePatientFromTicket({
                cedula: data.cedula,
                nombre: data.nombre,
                telefono: data.telefono,
                mascota: data.mascota,
                idPaciente: data.idPaciente,
                tipoMascota: data.tipoMascota
            });
        }

        return internamientoId;
    }

    generarExpedienteNumero() {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 9000) + 1000;
        return `${year}-${random}`;
    }

    // ================================================================
    // PANEL PRINCIPAL
    // ================================================================
    
    showPanelPrincipal(internamientoId) {
        // Primero mostrar la sección principal de internamientos
        this.showInternamientosSection();
        
        this.currentInternamientoId = internamientoId;
        
        // Luego mostrar la vista del panel
        setTimeout(() => {
            this.showInternamientoView('panel');
            // Cargar datos del internamiento
            this.loadPanelPrincipal(internamientoId);
        }, 100);
    }

    async loadPanelPrincipal(internamientoId) {
        const internamiento = this.internamientos.get(internamientoId);
        if (!internamiento) {
            alert('❌ Internamiento no encontrado');
            this.showInternamientosSection();
            return;
        }

        // Renderizar header
        this.renderPanelHeader(internamiento);

        // Renderizar secciones
        this.renderUltimosTurnos(internamiento);
        this.renderMedicacionesActivas(internamiento);
        this.renderProcedimientosRecientes(internamiento);
    }

    renderPanelHeader(internamiento) {
        const container = document.getElementById('panelHeaderContainer');
        if (!container) return;

        const estado = internamiento.estado?.actual || 'activo';
        const estadoConfig = {
            'activo': { color: '#27ae60', label: 'ACTIVO' },
            'critico': { color: '#e74c3c', label: 'CRÍTICO' },
            'alta': { color: '#f39c12', label: 'ALTA MÉDICA' },
            'egresado': { color: '#95a5a6', label: 'EGRESADO' }
        };

        const config = estadoConfig[estado] || estadoConfig.activo;
        const nombreMascota = internamiento.referencias?.nombreMascota || 'Sin nombre';
        const expediente = internamiento.metadata?.expedienteNumero || 'N/A';
        const diasInternado = this.calcularDiasInternado(internamiento.datosIngreso?.fechaIngreso);

        container.innerHTML = `
            <div class="panel-header-main" style="background: linear-gradient(135deg, ${config.color} 0%, ${this.darkenColor(config.color)} 100%); color: white;">
                <div style="display: flex; justify-content: space-between; align-items: start; position: relative; z-index: 1;">
                    <div>
                        <h2 style="margin: 0 0 15px 0; color: white;">
                            <i class="fas fa-paw" style="color: white;"></i> ${nombreMascota}
                        </h2>
                        <div class="patient-info" style="color: white;">
                            <div class="patient-info-item" style="color: white;">
                                <i class="fas fa-file-medical" style="color: white;"></i>
                                <span style="color: white;">Exp. <strong style="color: white;">${expediente}</strong></span>
                            </div>
                            <div class="patient-info-item" style="color: white;">
                                <i class="fas fa-calendar-day" style="color: white;"></i>
                                <span style="color: white;"><strong style="color: white;">${diasInternado}</strong> internado</span>
                            </div>
                            <div class="patient-info-item" style="color: white;">
                                <i class="fas fa-user" style="color: white;"></i>
                                <span style="color: white;"><strong style="color: white;">${this.getNombrePropietario(internamiento)}</strong></span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <span class="badge-estado-header badge-estado-${estado}" style="padding: 12px 24px; border-radius: 30px; font-weight: 700; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: inline-block;">
                            <i class="fas ${config.icon}" style="margin-right: 8px;"></i>${config.label}
                        </span>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 20px;">
                <button class="btn btn-primary" onclick="window.internamientoModule.showRegistroTurnoForm()" id="btnRegistrarTurno">
                    <i class="fas fa-clipboard-check"></i> Registrar Turno
                </button>
                <button class="btn btn-info" onclick="window.internamientoModule.showMedicacionView()">
                    <i class="fas fa-pills"></i> Medicación
                </button>
                <button class="btn" style="background: #9b59b6; color: white;" onclick="window.internamientoModule.showProcedimientosView()">
                    <i class="fas fa-tasks"></i> Procedimientos
                </button>
                <button class="btn btn-secondary" onclick="window.internamientoModule.showEvolucionView()">
                    <i class="fas fa-chart-line"></i> Evolución
                </button>
                ${estado === 'activo' ? `
                <button class="btn" style="background: var(--internamiento-danger); color: white;" onclick="window.internamientoModule.cambiarEstado('critico')">
                    <i class="fas fa-exclamation-triangle"></i> Marcar Crítico
                </button>
                <button class="btn" style="background: var(--internamiento-warning); color: white;" onclick="window.internamientoModule.cambiarEstado('alta')">
                    <i class="fas fa-check-circle"></i> Autorizar Alta
                </button>
                ` : ''}
                ${estado === 'critico' ? `
                <button class="btn" style="background: var(--internamiento-success); color: white;" onclick="window.internamientoModule.cambiarEstado('activo')">
                    <i class="fas fa-heartbeat"></i> Cambiar a Activo
                </button>
                <button class="btn" style="background: var(--internamiento-warning); color: white;" onclick="window.internamientoModule.cambiarEstado('alta')">
                    <i class="fas fa-check-circle"></i> Autorizar Alta
                </button>
                ` : ''}
                ${estado === 'alta' ? `
                <button class="btn btn-success" onclick="window.internamientoModule.showEgresoForm()" style="font-weight: 600; animation: pulse-beta 2s ease-in-out infinite;">
                    <i class="fas fa-home"></i> Proceso de Egreso
                </button>
                <button class="btn" style="background: #e74c3c; color: white;" onclick="window.internamientoModule.cancelarAlta()">
                    <i class="fas fa-times-circle"></i> Cancelar Alta
                </button>
                ` : ''}
                <button class="btn btn-warning" onclick="window.internamientoModule.showInternamientosSection()">
                    <i class="fas fa-arrow-left"></i> Volver
                </button>
                ${this.esAdmin() ? `
                <button class="btn" style="background: #95a5a6; color: white;" onclick="window.internamientoModule.eliminarExpediente('${internamiento.metadata?.internamientoId}')">
                    <i class="fas fa-trash-alt"></i> Eliminar Expediente
                </button>
                ` : ''}
            </div>
        `;
    }

    esAdmin() {
        const userRole = sessionStorage.getItem('userRole');
        return userRole === 'admin';
    }

    darkenColor(hex) {
        // Oscurecer un color hex para gradiente
        const num = parseInt(hex.slice(1), 16);
        const r = Math.max(0, (num >> 16) - 20);
        const g = Math.max(0, ((num >> 8) & 0x00FF) - 20);
        const b = Math.max(0, (num & 0x0000FF) - 20);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    renderUltimosTurnos(internamiento) {
        const container = document.getElementById('panelUltimosTurnos');
        if (!container) return;

        const turnos = Object.values(internamiento.turnos || {})
            .sort((a, b) => b.fecha - a.fecha)
            .slice(0, 3);

        if (turnos.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #95a5a6;">
                    <i class="fas fa-clipboard"></i>
                    <p>No hay turnos registrados aún</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <h3>📋 Últimos Turnos</h3>
            ${turnos.map(turno => this.renderTurnoCard(turno)).join('')}
        `;
    }

    renderTurnoCard(turno) {
        const fecha = new Date(turno.fecha).toLocaleDateString('es-ES');
        const hora = new Date(turno.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        return `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong>${turno.turno || 'Sin turno'}</strong>
                    <span style="color: #7f8c8d; font-size: 0.85rem;">${fecha} ${hora}</span>
                </div>
                <div class="parametros-grid">
                    <div>🌡️ ${turno.parametrosVitales?.temperatura || '--'}°C</div>
                    <div>💓 ${turno.parametrosVitales?.fc || '--'} lpm</div>
                    <div>🫁 ${turno.parametrosVitales?.fr || '--'} rpm</div>
                </div>
                ${turno.responsableNombre ? `<div style="margin-top: 8px; font-size: 0.85rem; color: #6c757d;"><i class="fas fa-user"></i> Por: ${turno.responsableNombre}</div>` : ''}
                ${turno.observaciones ? `<div style="margin-top: 10px; font-size: 0.85rem; color: #555; font-style: italic;">💬 ${turno.observaciones}</div>` : ''}
            </div>
        `;
    }

    renderMedicacionesActivas(internamiento) {
        const container = document.getElementById('panelMedicaciones');
        if (!container) return;

        const medicamentos = Object.values(internamiento.planTerapeutico?.medicamentos || {})
            .filter(med => med.estadoMedicamento === 'activo');

        if (medicamentos.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <i class="fas fa-pills"></i>
                    <p>No hay medicamentos activos</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <h3>💊 Plan de Medicación Activo</h3>
            ${medicamentos.map(med => `
                <div>
                    <strong>${med.nombreComercial || 'Sin nombre'}</strong>
                    <div style="font-size: 0.9rem; color: #555; margin-top: 8px;">
                        Dosis: ${med.dosisCalculada || med.dosis} - Vía: ${med.viaAdministracion} - Cada ${med.frecuenciaHoras}h
                    </div>
                </div>
            `).join('')}
        `;
    }

    renderProcedimientosRecientes(internamiento) {
        const container = document.getElementById('panelProcedimientos');
        if (!container) return;

        const procedimientos = Object.values(internamiento.procedimientos || {});
        const pendientes = procedimientos.filter(p => p.estado === 'pendiente');
        const completados = procedimientos.filter(p => p.estado === 'completado');
        const total = procedimientos.length;
        const porcentaje = total > 0 ? Math.round((completados.length / total) * 100) : 0;

        const bloqueado = ['egresado'].includes(internamiento.estado?.actual);

        if (procedimientos.length === 0) {
            container.innerHTML = `
                <h3>
                    <i class="fas fa-tasks"></i> Procedimientos
                    <button class="btn btn-sm btn-primary" onclick="window.internamientoModule.showProcedimientosView()" style="margin-left: 10px; font-size: 0.8rem;">
                        <i class="fas fa-plus"></i> Agregar
                    </button>
                </h3>
                <div class="empty-state" style="padding: 30px 20px;">
                    <i class="fas fa-clipboard-list"></i>
                    <p style="font-size: 0.9rem;">No hay tareas registradas</p>
                </div>
            `;
            return;
        }

        // Mostrar solo los 5 más recientes/pendientes
        const mostrar = procedimientos
            .sort((a, b) => {
                if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
                if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
                return b.fechaCreacion - a.fechaCreacion;
            })
            .slice(0, 5);

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0;">
                    <i class="fas fa-tasks"></i> Procedimientos
                </h3>
                <button class="btn btn-sm btn-info" onclick="window.internamientoModule.showProcedimientosView()" style="font-size: 0.8rem;">
                    <i class="fas fa-list"></i> Ver Todos
                </button>
            </div>

            <!-- Barra de progreso compacta -->
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.8rem; color: #6c757d;">
                    <span>${completados.length} de ${total} completados</span>
                    <span style="font-weight: 600; color: var(--internamiento-secondary);">${porcentaje}%</span>
                </div>
                <div class="progress-bar" style="height: 8px;">
                    <div class="progress-fill" style="width: ${porcentaje}%;"></div>
                </div>
            </div>

            <!-- Lista compacta de procedimientos -->
            <div style="max-height: 300px; overflow-y: auto;">
                ${mostrar.map(proc => {
                    const completado = proc.estado === 'completado';
                    return `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #e0e0e0; transition: background 0.2s;">
                            <input type="checkbox" 
                                   ${completado ? 'checked' : ''} 
                                   ${bloqueado ? 'disabled' : ''}
                                   onchange="window.internamientoModule.toggleProcedimiento('${proc.procedimientoId}')"
                                   style="width: 18px; height: 18px; cursor: ${bloqueado ? 'not-allowed' : 'pointer'};">
                            <div style="flex: 1;">
                                <div style="font-size: 0.9rem; font-weight: 500; color: ${completado ? '#95a5a6' : 'var(--internamiento-primary)'}; ${completado ? 'text-decoration: line-through;' : ''}">
                                    ${proc.descripcion}
                                </div>
                                ${proc.prioridad === 'alta' && !completado ? `<span class="priority-tag priority-alta" style="font-size: 0.7rem; padding: 2px 6px;">URGENTE</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // ================================================================
    // REGISTRO DE TURNO
    // ================================================================
    
    showRegistroTurnoForm() {
        if (!this.currentInternamientoId) {
            this.showAlert('No hay internamiento seleccionado', 'Error', 'error');
            return;
        }

        // Verificar si está en alta o egresado
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento && ['alta', 'egresado'].includes(internamiento.estado?.actual)) {
            this.showAlert('No se pueden registrar turnos\n\nEl paciente ya tiene alta médica autorizada o está egresado.', 'Acción Bloqueada', 'warning');
            return;
        }

        this.showInternamientoView('turno');
        
        // Limpiar formulario
        const form = document.getElementById('formRegistroTurno');
        if (form) form.reset();

        // Pre-llenar fecha y hora actual
        const fechaInput = document.getElementById('turnoFecha');
        const horaInput = document.getElementById('turnoHora');
        const responsableInput = document.getElementById('turnoResponsable');
        
        if (fechaInput) {
            fechaInput.value = new Date().toISOString().split('T')[0];
        }
        
        if (horaInput) {
            const now = new Date();
            horaInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }

        // Pre-llenar responsable con el usuario actual
        if (responsableInput) {
            const userName = sessionStorage.getItem('userName');
            if (userName && !responsableInput.value) {
                responsableInput.value = userName;
            }
        }

        // Pre-seleccionar turno actual
        this.preseleccionarTurno();

        // Setup event listener del formulario
        const formElement = document.getElementById('formRegistroTurno');
        if (formElement) {
            formElement.onsubmit = (e) => this.handleTurnoSubmit(e);
        }
    }

    preseleccionarTurno() {
        const hora = new Date().getHours();
        let turno = '6am-12pm'; // Default

        if (hora >= 0 && hora < 6) turno = '12am-6am';
        else if (hora >= 6 && hora < 12) turno = '6am-12pm';
        else if (hora >= 12 && hora < 18) turno = '12pm-6pm';
        else turno = '6pm-12am';

        const turnoSelect = document.getElementById('turnoFranja');
        if (turnoSelect) turnoSelect.value = turno;
    }

    async handleTurnoSubmit(e) {
        e.preventDefault();

        if (!this.currentInternamientoId) {
            this.showAlert('No hay internamiento seleccionado', 'Error', 'error');
            return;
        }

        // Recoger datos
        const turnoData = this.getTurnoFormData();

        // Validar
        if (!this.validateTurnoData(turnoData)) {
            return;
        }

        try {
            await this.guardarTurno(turnoData);
            this.showNotification('Turno registrado exitosamente', 'success');
            this.showPanelPrincipal(this.currentInternamientoId);
        } catch (error) {
            console.error('Error guardando turno:', error);
            this.showAlert('Error al guardar turno: ' + error.message, 'Error', 'error');
        }
    }

    getTurnoFormData() {
        return {
            fecha: document.getElementById('turnoFecha')?.value || '',
            hora: document.getElementById('turnoHora')?.value || '',
            turno: document.getElementById('turnoFranja')?.value || '',
            responsable: document.getElementById('turnoResponsable')?.value.trim() || '',
            
            // Parámetros vitales
            peso: parseFloat(document.getElementById('turnoPeso')?.value) || null,
            fc: parseInt(document.getElementById('turnoFC')?.value) || null,
            fr: parseInt(document.getElementById('turnoFR')?.value) || null,
            temperatura: parseFloat(document.getElementById('turnoTemperatura')?.value) || null,
            tllc: parseFloat(document.getElementById('turnoTLLC')?.value) || null,
            deshidratacion: parseInt(document.getElementById('turnoDeshidratacion')?.value) || 0,
            mucosas: document.getElementById('turnoMucosas')?.value || 'rosadas',

            // Estado general
            estadoMental: document.getElementById('turnoEstadoMental')?.value || 'alerta',
            nivelDolor: document.getElementById('turnoNivelDolor')?.value || 'sin_dolor',
            ingestaAgua: document.getElementById('turnoIngestaAgua')?.checked || false,
            cantidadAgua: parseInt(document.getElementById('turnoCantidadAgua')?.value) || 0,
            apetito: document.getElementById('turnoApetito')?.checked || false,
            alimentoCantidad: document.getElementById('turnoAlimentoCantidad')?.value || '',
            alimentoTipo: document.getElementById('turnoAlimentoTipo')?.value || '',
            diarreas: document.getElementById('turnoDiarreas')?.checked || false,
            descripcionDiarreas: document.getElementById('turnoDescripcionDiarreas')?.value || '',
            vomitos: document.getElementById('turnoVomitos')?.checked || false,
            descripcionVomitos: document.getElementById('turnoDescripcionVomitos')?.value || '',

            // Fluidoterapia
            fluidoterapiaAdministrada: document.getElementById('turnoFluidoterapia')?.checked || false,
            fluidoTipo: document.getElementById('turnoFluidoTipo')?.value || '',
            fluidoFrecuencia: document.getElementById('turnoFluidoFrecuencia')?.value || '',

            // Observaciones
            observaciones: document.getElementById('turnoObservaciones')?.value.trim() || ''
        };
    }

    validateTurnoData(data) {
        if (!data.temperatura) {
            this.showAlert('La temperatura es obligatoria', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.fc) {
            this.showAlert('La frecuencia cardíaca es obligatoria', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.estadoMental) {
            this.showAlert('El estado mental es obligatorio', 'Campo Requerido', 'warning');
            return false;
        }

        return true;
    }

    async guardarTurno(data) {
        const userId = sessionStorage.getItem('userId');
        const userName = sessionStorage.getItem('userName');

        // Combinar fecha y hora para timestamp
        const fechaHora = new Date(`${data.fecha}T${data.hora}`).getTime();

        // Generar ID de turno
        const turnoId = 'turno_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Usar responsable del formulario, o el usuario actual como fallback
        const responsableNombre = data.responsable || userName || 'Usuario desconocido';

        // Estructura del turno
        const turnoData = {
            turnoId: turnoId,
            fecha: fechaHora,
            fechaFormato: data.fecha,
            turno: data.turno,
            responsable: userId, // ID del usuario que guarda
            responsableNombre: responsableNombre, // Nombre del responsable que registra

            parametrosVitales: {
                peso: data.peso,
                fc: data.fc,
                fr: data.fr,
                temperatura: data.temperatura,
                tllc: data.tllc,
                deshidratacion: data.deshidratacion,
                mucosas: data.mucosas
            },

            estadoGeneral: {
                estadoMental: data.estadoMental,
                nivelDolor: data.nivelDolor,
                ingestaAgua: data.ingestaAgua,
                cantidadAgua: data.cantidadAgua,
                apetito: data.apetito,
                alimentoCantidad: data.alimentoCantidad,
                alimentoTipo: data.alimentoTipo,
                diarreas: data.diarreas,
                descripcionDiarreas: data.descripcionDiarreas,
                vomitos: data.vomitos,
                descripcionVomitos: data.descripcionVomitos
            },

            fluidoterapia: {
                administrada: data.fluidoterapiaAdministrada,
                tipo: data.fluidoTipo,
                frecuencia: data.fluidoFrecuencia
            },

            observaciones: data.observaciones,
            alertasAutomaticas: this.generarAlertasAutomaticas(data),
            fechaRegistro: Date.now()
        };

        // Guardar en Firebase
        const updates = {};
        updates[`turnos/${turnoId}`] = turnoData;
        updates['metadata/fechaUltimaActualizacion'] = Date.now();
        updates['estadisticas/totalTurnos'] = (this.internamientos.get(this.currentInternamientoId)?.estadisticas?.totalTurnos || 0) + 1;

        // Agregar a auditoría
        const auditEntry = {
            timestamp: Date.now(),
            userId: userId,
            usuarioNombre: userName,
            accion: 'registrar_turno',
            detalles: {
                turnoId: turnoId,
                turno: data.turno,
                parametrosClave: {
                    temperatura: data.temperatura,
                    fc: data.fc,
                    estadoMental: data.estadoMental
                }
            }
        };
        
        const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
        await internamientoRef.update(updates);
        
        // Agregar a auditoría (push para agregar al array)
        await internamientoRef.child('auditoria/historialCambios').push(auditEntry);
    }

    generarAlertasAutomaticas(data) {
        const alertas = [];

        // Temperatura
        if (data.temperatura < 37) {
            alertas.push('temperatura_baja');
        } else if (data.temperatura > 39.5) {
            alertas.push('temperatura_elevada');
        }

        // Frecuencia cardíaca (aproximado para perros medianos)
        if (data.fc < 60) {
            alertas.push('fc_baja');
        } else if (data.fc > 160) {
            alertas.push('fc_elevada');
        }

        // Frecuencia respiratoria
        if (data.fr && data.fr < 10) {
            alertas.push('fr_baja');
        } else if (data.fr && data.fr > 40) {
            alertas.push('fr_elevada');
        }

        // Deshidratación
        if (data.deshidratacion >= 8) {
            alertas.push('deshidratacion_severa');
        }

        // Mucosas
        if (['palidas', 'cianoticas', 'ictericas'].includes(data.mucosas)) {
            alertas.push('mucosas_anormales');
        }

        // Sin ingesta de agua
        if (!data.ingestaAgua) {
            alertas.push('sin_ingesta_agua');
        }

        // Sin apetito
        if (!data.apetito) {
            alertas.push('sin_apetito');
        }

        // Vómitos o diarreas
        if (data.vomitos) {
            alertas.push('vomitos');
        }
        if (data.diarreas) {
            alertas.push('diarreas');
        }

        return alertas;
    }

    // ================================================================
    // PLAN DE MEDICACIÓN
    // ================================================================
    
    showMedicacionView() {
        if (!this.currentInternamientoId) {
            alert('❌ Error: No hay internamiento seleccionado');
            return;
        }

        this.showInternamientoView('medicacion');
        this.loadMedicacionView();
    }

    loadMedicacionView() {
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (!internamiento) return;

        // Renderizar lista de medicamentos
        this.renderMedicamentosList(internamiento);
        
        // Setup event listeners
        const btnAgregarMed = document.getElementById('btnAgregarMedicamento');
        if (btnAgregarMed) {
            btnAgregarMed.onclick = () => this.showAgregarMedicamentoForm();
        }
    }

    renderMedicamentosList(internamiento) {
        const container = document.getElementById('medicamentosListContainer');
        if (!container) return;

        const medicamentos = Object.values(internamiento.planTerapeutico?.medicamentos || {});
        const activos = medicamentos.filter(m => m.estadoMedicamento === 'activo');

        if (activos.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #95a5a6;">
                    <i class="fas fa-pills" style="font-size: 48px; margin-bottom: 15px;"></i>
                    <p>No hay medicamentos activos</p>
                    <button class="btn btn-primary" onclick="window.internamientoModule.showAgregarMedicamentoForm()">
                        <i class="fas fa-plus"></i> Agregar Medicamento
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <h3>💊 Medicamentos Activos</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Medicamento</th>
                        <th>Dosis</th>
                        <th>Vía</th>
                        <th>Frecuencia</th>
                        <th>Próxima Dosis</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${activos.map(med => this.renderMedicamentoRow(med)).join('')}
                </tbody>
            </table>
        `;
    }

    renderMedicamentoRow(medicamento) {
        const proximaDosis = this.calcularProximaDosis(medicamento);
        const viaLabels = {
            'IV': 'Intravenosa',
            'IM': 'Intramuscular',
            'SC': 'Subcutánea',
            'VO': 'Vía Oral',
            'Topica': 'Tópica',
            'Otra': 'Otra'
        };

        return `
            <tr>
                <td>
                    <strong>${medicamento.nombreComercial || 'Sin nombre'}</strong>
                    ${medicamento.principioActivo ? `<br><small style="color: #7f8c8d;">${medicamento.principioActivo}</small>` : ''}
                </td>
                <td>${medicamento.dosisCalculada || medicamento.dosis || '--'}</td>
                <td>${viaLabels[medicamento.viaAdministracion] || medicamento.viaAdministracion}</td>
                <td>Cada ${medicamento.frecuenciaHoras || '--'}h</td>
                <td>${proximaDosis}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="window.internamientoModule.administrarMedicamento('${medicamento.medicamentoId}')" title="Administrar">
                        <i class="fas fa-syringe"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="window.internamientoModule.suspenderMedicamento('${medicamento.medicamentoId}')" title="Suspender">
                        <i class="fas fa-pause"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    calcularProximaDosis(medicamento) {
        // Obtener última administración
        const administraciones = Object.values(medicamento.administraciones || {});
        if (administraciones.length === 0) {
            return 'Pendiente primera dosis';
        }

        const ultima = administraciones
            .filter(a => a.estado === 'administrado')
            .sort((a, b) => b.fechaHoraReal - a.fechaHoraReal)[0];

        if (!ultima) {
            return 'Pendiente primera dosis';
        }

        const frecuenciaMs = medicamento.frecuenciaHoras * 60 * 60 * 1000;
        const proximaHora = new Date(ultima.fechaHoraReal + frecuenciaMs);
        const ahora = new Date();

        if (proximaHora <= ahora) {
            return `<span style="color: #e74c3c; font-weight: bold;">AHORA</span>`;
        }

        const diff = proximaHora - ahora;
        const horas = Math.floor(diff / (1000 * 60 * 60));
        const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return `En ${horas}h ${minutos}m`;
    }

    showAgregarMedicamentoForm() {
        // Mostrar formulario en modal
        const modal = this.createModal('Agregar Medicamento', this.getAgregarMedicamentoFormHTML());
        document.body.appendChild(modal);
        
        // Setup form submit
        const form = document.getElementById('formAgregarMedicamento');
        if (form) {
            form.onsubmit = (e) => this.handleAgregarMedicamento(e);
        }
    }

    getAgregarMedicamentoFormHTML() {
        return `
            <form id="formAgregarMedicamento">
                <div class="form-group">
                    <label>Nombre Comercial *</label>
                    <input type="text" id="medNombreComercial" required placeholder="Ej: Convenia">
                </div>
                <div class="form-group">
                    <label>Principio Activo</label>
                    <input type="text" id="medPrincipioActivo" placeholder="Ej: Cefovecina">
                </div>
                <div class="form-group">
                    <label>Dosis *</label>
                    <input type="text" id="medDosis" required placeholder="Ej: 8 mg/kg">
                </div>
                <div class="form-group">
                    <label>Dosis Calculada</label>
                    <input type="text" id="medDosisCalculada" placeholder="Ej: 100 mg">
                </div>
                <div class="form-group">
                    <label>Vía de Administración *</label>
                    <select id="medVia" required>
                        <option value="">Seleccionar...</option>
                        <option value="IV">Intravenosa (IV)</option>
                        <option value="IM">Intramuscular (IM)</option>
                        <option value="SC">Subcutánea (SC)</option>
                        <option value="VO">Vía Oral (VO)</option>
                        <option value="Topica">Tópica</option>
                        <option value="Otra">Otra</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Frecuencia (cada X horas) *</label>
                    <input type="number" id="medFrecuencia" min="1" required placeholder="Ej: 8">
                </div>
                <div class="form-group">
                    <label>Observaciones</label>
                    <textarea id="medObservaciones" rows="2" placeholder="Ej: Administrar lentamente"></textarea>
                </div>
                <div style="text-align: right; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary" style="margin-left: 10px;">
                        <i class="fas fa-plus"></i> Agregar
                    </button>
                </div>
            </form>
        `;
    }

    async handleAgregarMedicamento(e) {
        e.preventDefault();

        const medicamentoData = {
            nombreComercial: document.getElementById('medNombreComercial')?.value.trim() || '',
            principioActivo: document.getElementById('medPrincipioActivo')?.value.trim() || '',
            dosis: document.getElementById('medDosis')?.value.trim() || '',
            dosisCalculada: document.getElementById('medDosisCalculada')?.value.trim() || '',
            viaAdministracion: document.getElementById('medVia')?.value || '',
            frecuenciaHoras: parseInt(document.getElementById('medFrecuencia')?.value) || 0,
            observaciones: document.getElementById('medObservaciones')?.value.trim() || ''
        };

        try {
            await this.agregarMedicamento(medicamentoData);
            this.showNotification('Medicamento agregado exitosamente', 'success');
            
            // Cerrar modal
            document.querySelector('.modal-overlay')?.remove();
            
            // Recargar vista
            this.loadMedicacionView();
        } catch (error) {
            console.error('Error agregando medicamento:', error);
            this.showAlert('Error al agregar medicamento: ' + error.message, 'Error', 'error');
        }
    }

    async agregarMedicamento(data) {
        // Verificar si está en alta o egresado
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento && ['alta', 'egresado'].includes(internamiento.estado?.actual)) {
            this.showAlert('No se puede agregar medicación\n\nEl paciente está en proceso de egreso o egresado.', 'Acción Bloqueada', 'warning');
            return;
        }

        const userId = sessionStorage.getItem('userId');
        const userName = sessionStorage.getItem('userName');

        const medicamentoId = 'med_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        const medicamentoData = {
            medicamentoId: medicamentoId,
            nombreComercial: data.nombreComercial,
            principioActivo: data.principioActivo,
            dosis: data.dosis,
            dosisCalculada: data.dosisCalculada,
            viaAdministracion: data.viaAdministracion,
            frecuenciaHoras: data.frecuenciaHoras,
            horariosCalculados: this.calcularHorarios(data.frecuenciaHoras),
            fechaInicio: Date.now(),
            fechaFin: null,
            estadoMedicamento: 'activo',
            prescritoPor: userId,
            prescritoNombre: userName,
            observaciones: data.observaciones,
            administraciones: {}
        };

        // Guardar en Firebase
        const updates = {};
        updates[`planTerapeutico/medicamentos/${medicamentoId}`] = medicamentoData;
        updates['planTerapeutico/ultimaActualizacion'] = Date.now();
        updates['metadata/fechaUltimaActualizacion'] = Date.now();

        const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
        await internamientoRef.update(updates);

        // Auditoría
        const auditEntry = {
            timestamp: Date.now(),
            userId: userId,
            usuarioNombre: userName,
            accion: 'agregar_medicamento',
            detalles: {
                medicamentoId: medicamentoId,
                nombre: data.nombreComercial,
                via: data.viaAdministracion,
                frecuencia: data.frecuenciaHoras
            }
        };
        await internamientoRef.child('auditoria/historialCambios').push(auditEntry);
    }

    calcularHorarios(frecuenciaHoras) {
        const horarios = [];
        const horasDelDia = 24;
        const numDosis = Math.floor(horasDelDia / frecuenciaHoras);

        for (let i = 0; i < numDosis; i++) {
            const hora = (i * frecuenciaHoras) % 24;
            horarios.push(`${String(hora).padStart(2, '0')}:00`);
        }

        return horarios;
    }

    async administrarMedicamento(medicamentoId) {
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (!internamiento) return;

        // Verificar si está en alta o egresado
        if (['alta', 'egresado'].includes(internamiento.estado?.actual)) {
            this.showAlert('No se puede administrar medicación\n\nEl paciente está en proceso de egreso o egresado.', 'Acción Bloqueada', 'warning');
            return;
        }

        const medicamento = internamiento.planTerapeutico?.medicamentos?.[medicamentoId];
        if (!medicamento) {
            this.showAlert('Medicamento no encontrado', 'Error', 'error');
            return;
        }

        // Confirmar administración
        const confirmar = await this.showConfirm(
            `${medicamento.nombreComercial}\nDosis: ${medicamento.dosisCalculada || medicamento.dosis}\nVía: ${medicamento.viaAdministracion}`,
            '💉 Confirmar Administración',
            { confirmText: 'Administrar', cancelText: 'Cancelar', icon: 'fa-syringe', iconColor: '#27ae60' }
        );
        
        if (!confirmar) return;

        try {
            await this.registrarAdministracion(medicamentoId, medicamento);
            this.showNotification('Medicación administrada y registrada', 'success');
            this.loadMedicacionView();
        } catch (error) {
            console.error('Error registrando administración:', error);
            this.showAlert('Error al registrar administración: ' + error.message, 'Error', 'error');
        }
    }

    async registrarAdministracion(medicamentoId, medicamento) {
        const userId = sessionStorage.getItem('userId');
        const userName = sessionStorage.getItem('userName');

        const adminId = 'adm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        const administracionData = {
            fechaHoraProgramada: null, // En beta, sin programación automática
            fechaHoraReal: Date.now(),
            estado: 'administrado',
            administradoPor: userId,
            administradoNombre: userName,
            observaciones: ''
        };

        // Guardar en Firebase
        const updates = {};
        updates[`planTerapeutico/medicamentos/${medicamentoId}/administraciones/${adminId}`] = administracionData;
        updates['metadata/fechaUltimaActualizacion'] = Date.now();
        updates['estadisticas/totalMedicaciones'] = (this.internamientos.get(this.currentInternamientoId)?.estadisticas?.totalMedicaciones || 0) + 1;

        const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
        await internamientoRef.update(updates);

        // Auditoría
        const auditEntry = {
            timestamp: Date.now(),
            userId: userId,
            usuarioNombre: userName,
            accion: 'administrar_medicacion',
            detalles: {
                medicamentoId: medicamentoId,
                nombre: medicamento.nombreComercial,
                dosis: medicamento.dosisCalculada || medicamento.dosis
            }
        };
        await internamientoRef.child('auditoria/historialCambios').push(auditEntry);
    }

    async suspenderMedicamento(medicamentoId) {
        const confirmar = await this.showConfirm(
            '¿Estás seguro de suspender este medicamento?',
            'Suspender Medicamento',
            { confirmText: 'Suspender', cancelText: 'Cancelar', icon: 'fa-pause-circle', iconColor: '#f39c12' }
        );
        if (!confirmar) return;

        try {
            const userId = sessionStorage.getItem('userId');
            const updates = {};
            updates[`planTerapeutico/medicamentos/${medicamentoId}/estadoMedicamento`] = 'suspendido';
            updates[`planTerapeutico/medicamentos/${medicamentoId}/fechaFin`] = Date.now();
            updates['metadata/fechaUltimaActualizacion'] = Date.now();

            const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
            await internamientoRef.update(updates);

            this.showNotification('Medicamento suspendido', 'success');
            this.loadMedicacionView();
        } catch (error) {
            console.error('Error suspendiendo medicamento:', error);
            this.showAlert('Error al suspender medicamento: ' + error.message, 'Error', 'error');
        }
    }

    // ================================================================
    // EVOLUCIÓN (PLACEHOLDER)
    // ================================================================
    
    showEvolucionView() {
        alert('🚧 Vista de evolución en desarrollo\n\nEsta funcionalidad estará disponible en la próxima actualización.');
    }

    // ================================================================
    // UTILIDAD: MODAL
    // ================================================================
    
    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div class="modal-content" style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;">${title}</h3>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #95a5a6;">
                        ×
                    </button>
                </div>
                ${content}
            </div>
        `;

        // Cerrar al hacer click fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        return modal;
    }

    // ================================================================
    // ELIMINAR EXPEDIENTE (Solo Admin)
    // ================================================================
    
    async eliminarExpediente(internamientoId) {
        // Verificar que sea admin
        if (!this.esAdmin()) {
            this.showAlert('Solo administradores pueden eliminar expedientes', 'Acceso Denegado', 'error');
            return;
        }

        const internamiento = this.internamientos.get(internamientoId);
        if (!internamiento) {
            this.showAlert('Expediente no encontrado', 'Error', 'error');
            return;
        }

        const nombreMascota = internamiento.referencias?.nombreMascota || 'Sin nombre';
        const expediente = internamiento.metadata?.expedienteNumero || 'N/A';
        const estado = internamiento.estado?.actual || 'activo';

        // Advertencia especial si está activo o crítico
        if (['activo', 'critico'].includes(estado)) {
            const confirmarActivo = await this.showConfirm(
                `Este paciente está en estado ${estado.toUpperCase()}\n\n¿Está SEGURO de eliminar este expediente activo?\n\nEsto es irreversible y puede afectar la atención del paciente.`,
                '⚠️ ADVERTENCIA',
                { danger: true, confirmText: 'Sí, eliminar', cancelText: 'Cancelar' }
            );
            if (!confirmarActivo) return;
        }

        // Confirmación principal
        const confirmacion1 = await this.showConfirm(
            `Paciente: ${nombreMascota}\nExpediente: ${expediente}\nEstado: ${estado}\n\n¿Está seguro de eliminar este expediente?\n\nEsta acción es IRREVERSIBLE.`,
            '🗑️ ELIMINAR EXPEDIENTE',
            { danger: true, confirmText: 'Eliminar', cancelText: 'Cancelar', icon: 'fa-trash-alt', iconColor: '#e74c3c' }
        );
        if (!confirmacion1) return;

        // Segunda confirmación con texto exacto
        const confirmacion2 = await this.showPrompt(
            `Para confirmar, escriba: ELIMINAR\n\n(Expediente: ${expediente})`,
            'Confirmación Final',
            '',
            true
        );
        if (confirmacion2 !== 'ELIMINAR') {
            this.showNotification('Eliminación cancelada. El texto no coincide.', 'warning');
            return;
        }

        // Solicitar razón
        const razon = await this.showPrompt('Razón de la eliminación (obligatorio):', 'Razón de Eliminación', '', true);
        if (!razon || razon.trim() === '') {
            this.showAlert('Debe proporcionar una razón para eliminar el expediente', 'Campo Requerido', 'warning');
            return;
        }

        try {
            await this.ejecutarEliminacionExpediente(internamientoId, razon.trim());
            this.showNotification(`Expediente ${expediente} eliminado exitosamente`, 'success', 5000);
            this.showInternamientosSection();
        } catch (error) {
            console.error('Error eliminando expediente:', error);
            this.showAlert('Error al eliminar expediente: ' + error.message, 'Error', 'error');
        }
    }

    async ejecutarEliminacionExpediente(internamientoId, razon) {
        const userId = sessionStorage.getItem('userId');
        const userName = sessionStorage.getItem('userName');
        const internamiento = this.internamientos.get(internamientoId);

        // Guardar registro de eliminación en una colección de auditoría
        const eliminacionData = {
            internamientoId: internamientoId,
            expedienteNumero: internamiento.metadata?.expedienteNumero,
            nombreMascota: internamiento.referencias?.nombreMascota,
            cedulaCliente: internamiento.referencias?.cedulaCliente,
            estadoAlEliminar: internamiento.estado?.actual,
            fechaEliminacion: Date.now(),
            eliminadoPor: userId,
            eliminadoNombre: userName,
            razon: razon,
            datosCompletos: internamiento // Backup completo del expediente
        };

        // Guardar en colección de expedientes eliminados
        await window.database.ref('internamientos_eliminados').child(internamientoId).set(eliminacionData);

        // Eliminar el expediente original
        await this.internamientosRef.child(internamientoId).remove();

        // Limpiar cache local
        this.internamientos.delete(internamientoId);

        console.log(`🗑️ Expediente ${internamientoId} eliminado. Backup guardado en internamientos_eliminados.`);
    }

    // ================================================================
    // PROCEDIMIENTOS (Placeholder - se extiende en internamiento-procedimientos.js)
    // ================================================================
    
    showProcedimientosView() {
        console.log('📋 Mostrando vista de procedimientos...');
        console.log('Current ID:', this.currentInternamientoId);
        console.log('loadProcedimientosView existe:', typeof this.loadProcedimientosView);
        
        if (!this.currentInternamientoId) {
            alert('❌ Error: No hay internamiento seleccionado');
            return;
        }

        if (typeof this.loadProcedimientosView === 'function') {
            // Función extendida cargada
            const internamiento = this.internamientos.get(this.currentInternamientoId);
            const bloqueado = internamiento ? ['egresado'].includes(internamiento.estado?.actual) : false;
            
            this.showInternamientoView('procedimientos');
            
            setTimeout(() => {
                this.loadProcedimientosView(bloqueado);
            }, 100);
        } else {
            alert('🚧 Módulo de procedimientos no cargado correctamente.\n\nRecargue la página.');
        }
    }

    // ================================================================
    // ACTUALIZACIÓN DE ESTADÍSTICAS
    // ================================================================
    
    async actualizarEstadisticasInternamiento(internamientoId) {
        const internamiento = this.internamientos.get(internamientoId);
        if (!internamiento) return;

        const fechaIngreso = internamiento.datosIngreso?.fechaIngreso;
        const ahora = Date.now();
        
        const totalMs = ahora - fechaIngreso;
        const totalDias = Math.floor(totalMs / (1000 * 60 * 60 * 24));
        const totalHoras = Math.floor(totalMs / (1000 * 60 * 60));

        // Contar días en estado crítico
        const historialEstados = internamiento.estado?.historialEstados || [];
        let diasCritico = 0;
        let ultimoEstadoCritico = null;
        
        historialEstados.forEach(cambio => {
            if (cambio.estado === 'critico') {
                ultimoEstadoCritico = cambio.fecha;
            } else if (ultimoEstadoCritico) {
                const diff = cambio.fecha - ultimoEstadoCritico;
                diasCritico += Math.floor(diff / (1000 * 60 * 60 * 24));
                ultimoEstadoCritico = null;
            }
        });

        // Si aún está en crítico
        if (internamiento.estado?.actual === 'critico' && ultimoEstadoCritico) {
            const diff = ahora - ultimoEstadoCritico;
            diasCritico += Math.floor(diff / (1000 * 60 * 60 * 24));
        }

        const diasEstable = totalDias - diasCritico;

        const updates = {};
        updates['estadisticas/totalDias'] = totalDias;
        updates['estadisticas/totalHoras'] = totalHoras;
        updates['estadisticas/diasCritico'] = diasCritico;
        updates['estadisticas/diasEstable'] = Math.max(0, diasEstable);

        await this.internamientosRef.child(internamientoId).update(updates);
    }

    // ================================================================
    // UTILIDADES
    // ================================================================
    
    destroy() {
        // Limpiar listeners
        this.listeners.forEach(listener => {
            // Firebase off() para cada listener
            if (this.internamientosRef) {
                this.internamientosRef.off('value', listener);
            }
        });
        
        this.listeners = [];
        this.initialized = false;
        console.log('🏥 Módulo de Internamiento destruido');
    }
}

// ====================================================================
// INICIALIZACIÓN GLOBAL
// ====================================================================

// Crear instancia global
window.internamientoModule = null;

function initInternamientoModule() {
    if (window.internamientoModule) {
        return; // Ya está inicializado
    }
    
    // Crear instancia inmediatamente
    window.internamientoModule = new InternamientoModule();
    
    // Agregar botón al sidebar inmediatamente (no espera Firebase)
    window.internamientoModule.addMenuButton();
    window.internamientoModule.setupEventListeners();
    
    // Inicializar Firebase después (con delay si es necesario)
    const initFirebase = () => {
        if (window.database) {
            window.internamientoModule.init();
        } else {
            setTimeout(initFirebase, 200);
        }
    };
    
    // Esperar un momento para que otros módulos terminen de cargar
    setTimeout(initFirebase, 500);
}

// Auto-inicialización cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInternamientoModule);
} else {
    // DOM ya está listo, inicializar inmediatamente
    initInternamientoModule();
}

