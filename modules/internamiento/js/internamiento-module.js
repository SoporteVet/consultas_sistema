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
        
        // Flags para prevenir doble submit
        this.submittingAdmision = false;
        this.submittingTurno = false;
        this.submittingMedicamento = false;

        // Pendientes agregados desde el formulario de admisión (se guardan en procedimientos al crear)
        this.pendientesAdmision = [];
        // Medicamentos agregados desde el formulario de admisión (se guardan en planTerapeutico.medicamentos al crear)
        this.medicamentosAdmision = [];
        // Edición de ingreso desde consulta externa (desplegable en formulario de admisión)
        this.edicionIngresoConsultaId = null;
        this.edicionConsultaVerificado = null; // Quién hizo los cambios (solo al editar desde el desplegable)
        // Contador en "Ahora" hasta que se registre una nueva toma (no se reinicia al cambiar paciente ni refrescar)
        this._rerCountdownVencidoPorId = {};
        this._insulinaNCountdownVencidoPorId = {};
        this._aaCountdownVencidoPorId = {};
        this._loadCountdownVencidoFromStorage();

        console.log('Módulo de Internamiento inicializando...');
    }

    // ================================================================
    // INICIALIZACIÓN
    // ================================================================
    
    async init() {
        if (!window.database) {
            console.log('Esperando Firebase...');
            setTimeout(() => this.init(), 500);
            return;
        }

        // Verificar permisos
        if (!this.canAccessModule()) {
            console.log('Usuario sin permisos para internamiento');
            return;
        }

        // Inicializar referencias de Firebase
        this.internamientosRef = window.database.ref('internamientos');
        
        // Setup listeners
        this.setupFirebaseListeners();
        
        // Setup UI
        this.setupUI();
        
        this.initialized = true;
        console.log('Módulo de Internamiento inicializado');
    }

    canAccessModule() {
        const userRole = sessionStorage.getItem('userRole');
        const allowedRoles = ['admin', 'consulta_externa', 'internos', 'recepción', 'recepcion', 'quirofano', 'veterinario'];
        return this.betaEnabled && allowedRoles.includes(userRole);
    }

    setupFirebaseListeners() {
        if (!this.internamientosRef) return;

        // Listener de todos los internamientos (sin orderByChild para no excluir nodos sin estado/actual)
        const activeListener = this.internamientosRef.on('value', (snapshot) => {
            this.internamientos.clear();

            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const data = childSnapshot.val();
                    this.internamientos.set(childSnapshot.key, data);
                });

                console.log(`Cargados ${this.internamientos.size} internamientos`);
                this.refreshInternamientosList();
                this.refreshAdmisionEdicionSelect();
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
            <i class="fas fa-chevron-down category-arrow"></i>
          </button>
          <div id="internamientosSubmenu" class="nav-submenu">
            <button id="verInternamientosBtn" class="submenu-btn" onclick="if(window.internamientoModule) { window.internamientoModule.showInternamientosSection(); }">
              <i class="fas fa-list-alt"></i> Ver Internamientos
            </button>
            <button id="crearInternamientoBtn" class="submenu-btn" onclick="if(window.internamientoModule) { window.internamientoModule.showAdmisionForm(); }">
              <i class="fas fa-plus-circle"></i> Nuevo Internamiento
            </button>
            <button id="visitasBtn" class="submenu-btn" onclick="if(window.internamientoModule) { window.internamientoModule.showVisitasView(); }">
              <i class="fas fa-user-friends"></i> Agregar visitas
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

        // Formulario de admisión (usar onsubmit para no duplicar listeners si setupEventListeners se llama más de una vez)
        const formAdmision = document.getElementById('formAdmisionInternamiento');
        if (formAdmision) {
            formAdmision.onsubmit = (e) => this.handleAdmisionSubmit(e);
        }

        // Habilitar "Tipo de muestra" solo si está marcado "Toma de muestras"
        const chkMuestras = document.getElementById('internamientoMuestras');
        const containerTipoMuestra = document.getElementById('internamientoTipoMuestraContainer');
        const inputTipoMuestra = document.getElementById('internamientoTipoMuestra');
        if (chkMuestras && containerTipoMuestra && inputTipoMuestra) {
            chkMuestras.addEventListener('change', function() {
                const mostrar = this.checked;
                containerTipoMuestra.style.display = mostrar ? 'block' : 'none';
                inputTipoMuestra.disabled = !mostrar;
                if (!mostrar) inputTipoMuestra.value = '';
            });
        }

        // Sección Imagenología: se muestra solo si está marcado "Rayos X" o "Ultrasonido"
        const sectionImagenologia = document.getElementById('internamientoImagenologiaSection');
        const actualizarSeccionImagenologia = () => {
            if (sectionImagenologia) {
                const rx = document.getElementById('internamientoRayosX');
                const ultra = document.getElementById('internamientoUltrasonido');
                const algunoMarcado = (rx && rx.checked) || (ultra && ultra.checked);
                sectionImagenologia.style.display = algunoMarcado ? 'block' : 'none';
            }
        };
        const chkRayosX = document.getElementById('internamientoRayosX');
        const containerReporteRayosX = document.getElementById('internamientoReporteRayosXContainer');
        const containerDoctorRayosX = document.getElementById('internamientoDoctorRayosXContainer');
        const inputReporteRayosX = document.getElementById('internamientoReporteRayosXInput');
        if (chkRayosX && containerReporteRayosX && containerDoctorRayosX) {
            chkRayosX.addEventListener('change', function() {
                const mostrar = this.checked;
                containerReporteRayosX.style.display = mostrar ? 'block' : 'none';
                containerDoctorRayosX.style.display = mostrar ? 'block' : 'none';
                if (inputReporteRayosX) { inputReporteRayosX.disabled = !mostrar; if (!mostrar) inputReporteRayosX.value = ''; }
                actualizarSeccionImagenologia();
            });
        }

        const chkUltrasonido = document.getElementById('internamientoUltrasonido');
        const containerReporteUltrasonido = document.getElementById('internamientoReporteUltrasonidoContainer');
        const containerDoctorUltrasonido = document.getElementById('internamientoDoctorUltrasonidoContainer');
        const inputReporteUltrasonido = document.getElementById('internamientoReporteUltrasonidoInput');
        if (chkUltrasonido && containerReporteUltrasonido && containerDoctorUltrasonido) {
            chkUltrasonido.addEventListener('change', function() {
                const mostrar = this.checked;
                containerReporteUltrasonido.style.display = mostrar ? 'block' : 'none';
                containerDoctorUltrasonido.style.display = mostrar ? 'block' : 'none';
                if (inputReporteUltrasonido) { inputReporteUltrasonido.disabled = !mostrar; if (!mostrar) inputReporteUltrasonido.value = ''; }
                actualizarSeccionImagenologia();
            });
        }

        // Reticulocitos: sección completa visible solo si el checklist de Controles Rápidos está marcado
        const chkReticTiene = document.getElementById('internamientoReticulocitosTieneExamen');
        const wrapReticClasif = document.getElementById('internamientoReticulocitosClasificacionWrap');
        const chkReticChecklist = document.getElementById('internamientoReticulocitosChecklist');
        const sectionRetic = document.getElementById('internamientoReticulocitosSection');
        const mostrarSeccionRetic = (mostrar) => {
            if (sectionRetic) sectionRetic.style.display = mostrar ? 'block' : 'none';
            if (wrapReticClasif) wrapReticClasif.style.display = mostrar ? 'block' : 'none';
        };
        if (chkReticTiene && wrapReticClasif) {
            chkReticTiene.addEventListener('change', function() {
                mostrarSeccionRetic(this.checked);
                if (chkReticChecklist) chkReticChecklist.checked = this.checked;
            });
        }
        if (chkReticChecklist && chkReticTiene && wrapReticClasif) {
            chkReticChecklist.addEventListener('change', function() {
                chkReticTiene.checked = this.checked;
                mostrarSeccionRetic(this.checked);
            });
        }
        // Reticulocitos: los 3 son radios (selección única), sin lógica extra

        // Búsqueda de cliente en admisión
        const cedulaAdmision = document.getElementById('internamientoCedulaAdmision');
        if (cedulaAdmision) {
            cedulaAdmision.addEventListener('blur', (e) => this.buscarClienteAdmision(e.target.value));
        }

        // Desplegable editar ingreso (pacientes últimas 24h)
        const selectEditarPaciente = document.getElementById('admisionEditarPacienteSelect');
        if (selectEditarPaciente) {
            selectEditarPaciente.addEventListener('change', (e) => this.onAdmisionEditarPacienteChange(e));
        }
        const btnGuardarEdicionIngreso = document.getElementById('btnGuardarEdicionIngreso');
        if (btnGuardarEdicionIngreso) {
            btnGuardarEdicionIngreso.addEventListener('click', (e) => this.handleGuardarEdicionIngresoConsultaExterna(e));
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

        const estadoActual = (int) => int.estado?.actual || 'activo';
        let filtered = Array.from(this.internamientos.values());

        // Aplicar filtro (si falta estado.actual se considera activo)
        switch(filter) {
            case 'activos':
                filtered = filtered.filter(int => estadoActual(int) === 'activo');
                break;
            case 'criticos':
                filtered = filtered.filter(int => estadoActual(int) === 'critico');
                break;
            case 'alta':
                filtered = filtered.filter(int => estadoActual(int) === 'alta');
                break;
            case 'dados_alta':
                filtered = filtered.filter(int => estadoActual(int) === 'egresado');
                break;
            case 'defuncion':
                filtered = filtered.filter(int => estadoActual(int) === 'defuncion');
                break;
            case 'todos':
                filtered = filtered.filter(int => ['activo', 'critico', 'alta'].includes(estadoActual(int)));
                break;
            default:
                filtered = filtered.filter(int => ['activo', 'critico', 'alta'].includes(estadoActual(int)));
        }

        // Ordenar: más recientes arriba
        filtered.sort((a, b) => (b.metadata?.fechaCreacion || b.datosIngreso?.fechaIngreso || 0) - (a.metadata?.fechaCreacion || a.datosIngreso?.fechaIngreso || 0));

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
        
        let filtered = Array.from(this.internamientos.values()).filter(int => {
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

        // Más recientes arriba
        filtered.sort((a, b) => (b.metadata?.fechaCreacion || b.datosIngreso?.fechaIngreso || 0) - (a.metadata?.fechaCreacion || a.datosIngreso?.fechaIngreso || 0));
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
            console.error('No se encontró la sección internamientosSection');
        }
    }

    showVisitasView() {
        // Ocultar todas las secciones principales
        const sections = document.querySelectorAll('.content section');
        sections.forEach(section => {
            section.classList.add('hidden');
            section.classList.remove('active');
        });

        // Mostrar sección de internamientos
        const internamientosSection = document.getElementById('internamientosSection');
        if (!internamientosSection) {
            console.error('No se encontró la sección internamientosSection');
            return;
        }
        internamientosSection.classList.remove('hidden');
        setTimeout(() => {
            internamientosSection.classList.add('active');
        }, 50);
        
        // Mostrar directamente la vista de visitas (no la lista)
        this.showInternamientoView('visitas');
        setTimeout(() => this.loadVisitasView(), 100);
        
        // Establecer botón activo en sidebar
        if (typeof setActiveSubmenuButtonHTML === 'function') {
            setActiveSubmenuButtonHTML('visitasBtn');
        }
    }

    loadVisitasView() {
        const container = document.getElementById('internamiento-visitas');
        if (!container) return;
        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-user-friends"></i> Agregar visitas</h2>
                <div style="display: flex; gap: 10px;">
                    <button type="button" class="btn btn-primary" onclick="window.internamientoModule.showModalAgregarVisita()" style="background: #5c6bc0; border-color: #5c6bc0;">
                        <i class="fas fa-user-plus"></i> Agregar visitas
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="window.internamientoModule.loadVisitasListView()">
                        <i class="fas fa-list"></i> Ver visitas
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="window.internamientoModule.showInternamientosSection()">
                        <i class="fas fa-arrow-left"></i> Volver a lista
                    </button>
                </div>
            </div>
            <div style="background: linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%); border: 1px solid #7986cb; border-radius: 12px; padding: 24px; margin-top: 20px;">
                <p style="margin: 0 0 12px 0; color: #3949ab; font-weight: 600;"><i class="fas fa-info-circle"></i> Vista de visitas</p>
                <p style="margin: 0; color: #334155; font-size: 0.95rem; line-height: 1.5;">Aquí podrá gestionar las visitas a los pacientes internados.</p>
            </div>
            <div class="empty-state" style="background: white; padding: 40px; margin-top: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; color: #64748b;">
                <i class="fas fa-user-friends" style="font-size: 2.5rem; color: #5c6bc0; margin-bottom: 16px; opacity: 0.8;"></i>
                <p style="margin: 0; font-size: 1rem;">Agregar visitas</p>
                <p style="margin: 0; font-size: 0.9rem;">Use el botón «Agregar visitas» para registrar una visita.</p>
            </div>
        `;
    }

    loadVisitasListView(filtroEstado = null, fechaFiltro = null) {
        const container = document.getElementById('internamiento-visitas');
        if (!container) return;
        
        // Si no hay fecha filtro, usar la fecha de hoy por defecto
        if (!fechaFiltro) {
            const hoy = new Date();
            fechaFiltro = hoy.getFullYear() + '-' + 
                         String(hoy.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(hoy.getDate()).padStart(2, '0');
        }
        
        // Recopilar todas las visitas
        const todasLasVisitas = [];
        this.internamientos.forEach((int, internamientoId) => {
            const visitas = int.visitas && typeof int.visitas === 'object' ? int.visitas : {};
            const nombreMascota = int.referencias?.nombreMascota || 'Sin nombre';
            const propietario = this.getNombrePropietario(int) || '';
            const pacienteLabel = propietario ? `${nombreMascota} — ${propietario}` : nombreMascota;
            Object.entries(visitas).forEach(([visitaId, v]) => {
                todasLasVisitas.push({
                    visitaId,
                    internamientoId,
                    pacienteLabel,
                    nombreVisitante: v.nombreVisitante || '',
                    parentesco: v.parentesco || '',
                    motivo: v.motivo || '',
                    estado: v.estado || 'En espera',
                    fechaHora: v.fechaHora || '',
                    timestamp: v.timestamp || 0,
                    horaEnEspera: v.horaEnEspera || null,
                    horaEnCurso: v.horaEnCurso || null,
                    horaFinalizada: v.horaFinalizada || null
                });
            });
        });
        
        // Filtrar por fecha si se proporciona
        let visitasFiltradas = todasLasVisitas;
        if (fechaFiltro) {
            visitasFiltradas = visitasFiltradas.filter(visita => {
                if (!visita.fechaHora) return false;
                const fechaVisita = new Date(visita.fechaHora);
                const fechaFiltroObj = new Date(fechaFiltro);
                return fechaVisita.toISOString().split('T')[0] === fechaFiltroObj.toISOString().split('T')[0];
            });
        }
        
        // Filtrar por estado si se proporciona
        if (filtroEstado) {
            visitasFiltradas = visitasFiltradas.filter(v => v.estado === filtroEstado);
        }
        
        // Ordenar por timestamp descendente (más recientes primero)
        visitasFiltradas.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        // Agrupar por día
        const visitasPorDia = {};
        visitasFiltradas.forEach(visita => {
            const fecha = visita.fechaHora ? new Date(visita.fechaHora) : new Date();
            const diaKey = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
            if (!visitasPorDia[diaKey]) {
                visitasPorDia[diaKey] = [];
            }
            visitasPorDia[diaKey].push(visita);
        });
        
        // Ordenar días (más recientes primero)
        const diasOrdenados = Object.keys(visitasPorDia).sort((a, b) => b.localeCompare(a));
        
        const v = (s) => (s == null || s === '') ? '—' : String(s).replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const estados = ['En espera', 'En curso', 'Finalizada'];
        
        // Generar HTML de las tarjetas agrupadas por día
        const visitasHTML = diasOrdenados.map(diaKey => {
            const visitasDelDia = visitasPorDia[diaKey];
            const fecha = new Date(diaKey);
            const hoy = new Date();
            const ayer = new Date(hoy);
            ayer.setDate(hoy.getDate() - 1);
            
            let tituloFecha;
            if (diaKey === hoy.toISOString().split('T')[0]) {
                tituloFecha = 'Hoy';
            } else if (diaKey === ayer.toISOString().split('T')[0]) {
                tituloFecha = 'Ayer';
            } else {
                tituloFecha = fecha.toLocaleDateString('es-PE', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            }
            
            const tarjetasDelDia = visitasDelDia.map(visita => {
                const fechaObj = visita.fechaHora ? new Date(visita.fechaHora) : new Date();
                const horaStr = fechaObj.toLocaleTimeString('es-PE', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                // Obtener hora según el estado actual
                let horaEstadoInfo = '';
                if (visita.estado === 'En espera' && visita.horaEnEspera) {
                    const horaEspera = new Date(visita.horaEnEspera);
                    const horaStr = horaEspera.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                    horaEstadoInfo = `<div style="margin-top: 8px; padding: 8px 12px; background: #fff3e0; border-left: 3px solid #ff9800; border-radius: 6px; font-size: 0.85rem; color: #e65100;"><i class="fas fa-clock" style="margin-right: 6px;"></i><strong>En espera desde:</strong> ${horaStr}</div>`;
                } else if (visita.estado === 'En curso' && visita.horaEnCurso) {
                    const horaCurso = new Date(visita.horaEnCurso);
                    const horaStr = horaCurso.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                    horaEstadoInfo = `<div style="margin-top: 8px; padding: 8px 12px; background: #e3f2fd; border-left: 3px solid #2196f3; border-radius: 6px; font-size: 0.85rem; color: #1565c0;"><i class="fas fa-user-check" style="margin-right: 6px;"></i><strong>En curso desde:</strong> ${horaStr}</div>`;
                } else if (visita.estado === 'Finalizada' && visita.horaFinalizada) {
                    const horaFin = new Date(visita.horaFinalizada);
                    const horaStr = horaFin.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                    horaEstadoInfo = `<div style="margin-top: 8px; padding: 8px 12px; background: #e8f5e9; border-left: 3px solid #4caf50; border-radius: 6px; font-size: 0.85rem; color: #2e7d32;"><i class="fas fa-check-circle" style="margin-right: 6px;"></i><strong>Finalizada a las:</strong> ${horaStr}</div>`;
                }
                
                const estadoClass = visita.estado.toLowerCase().replace(' ', '-');
                const estadoIcono = visita.estado === 'En espera' ? 'clock' 
                    : visita.estado === 'En curso' ? 'user-check' 
                    : 'check-circle';
                
                return `
                    <div class="visita-card" data-estado="${v(visita.estado)}">
                        <div class="visita-card-header">
                            <div class="visita-card-time">
                                <i class="fas fa-clock"></i>
                                <span>${horaStr}</span>
                            </div>
                            <span class="visita-estado-badge ${estadoClass}">
                                <i class="fas fa-${estadoIcono}"></i>
                                ${v(visita.estado)}
                            </span>
                        </div>
                        
                        ${horaEstadoInfo}
                        
                        <div class="visita-card-body">
                            <div class="visita-card-info-item">
                                <div class="visita-card-info-label">
                                    <i class="fas fa-user"></i>
                                    Visitante
                                </div>
                                <div class="visita-card-info-value">${v(visita.nombreVisitante)}</div>
                            </div>
                            
                            <div class="visita-card-info-item">
                                <div class="visita-card-info-label">
                                    <i class="fas fa-users"></i>
                                    Parentesco
                                </div>
                                <div class="visita-card-info-value">${v(visita.parentesco)}</div>
                            </div>
                        </div>
                        
                        <div class="visita-card-motivo">
                            <div class="visita-card-motivo-label">
                                <i class="fas fa-comment-dots"></i>
                                Motivo de visita
                            </div>
                            <div class="visita-card-motivo-text">${v(visita.motivo)}</div>
                        </div>
                        
                        <div class="visita-card-footer">
                            <div class="visita-card-patient">
                                <i class="fas fa-paw"></i>
                                <span>Paciente: <strong>${v(visita.pacienteLabel)}</strong></span>
                            </div>
                            <select class="visita-estado-select-card" data-internamiento-id="${v(visita.internamientoId)}" data-visita-id="${v(visita.visitaId)}">
                                ${estados.map(e => `<option value="${v(e)}" ${visita.estado === e ? 'selected' : ''}>${v(e)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="visitas-day-group">
                    <div class="visitas-day-header">
                        <i class="fas fa-calendar-day"></i>
                        <h3>${tituloFecha}</h3>
                        <span class="visitas-count">${visitasDelDia.length} visita${visitasDelDia.length !== 1 ? 's' : ''}</span>
                    </div>
                    ${tarjetasDelDia}
                </div>
            `;
        }).join('');
        
        // Generar HTML principal
        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-list"></i> Visitas registradas</h2>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-secondary" onclick="window.internamientoModule.loadVisitasView()">
                        <i class="fas fa-arrow-left"></i> Volver a Agregar visitas
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="window.internamientoModule.showInternamientosSection()">
                        <i class="fas fa-arrow-left"></i> Volver a lista
                    </button>
                </div>
            </div>
            
            ${todasLasVisitas.length === 0 ? `
                <div class="visitas-empty-state">
                    <i class="fas fa-user-friends"></i>
                    <h3>No hay visitas registradas</h3>
                    <p>Utilice el botón "Agregar visitas" para registrar una nueva visita.</p>
                    <button type="button" class="btn btn-primary" style="margin-top: 20px;" onclick="window.internamientoModule.loadVisitasView()">
                        <i class="fas fa-user-plus"></i> Ir a Agregar visitas
                    </button>
                </div>
            ` : `
                <!-- Filtro de fecha -->
                <div class="visitas-date-filter" style="margin-bottom: 20px;">
                    <label for="visitasFilterDate" style="display: flex; align-items: center; gap: 8px; color: #334155; font-weight: 500; margin-bottom: 8px;">
                        <i class="fas fa-calendar-alt" style="color: #5c6bc0;"></i>
                        Seleccionar fecha:
                    </label>
                    <input type="date" id="visitasFilterDate" 
                           value="${fechaFiltro}" 
                           style="padding: 10px 15px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem; font-family: inherit; width: 100%; max-width: 250px; transition: all 0.3s ease;"
                           onchange="const fecha = this.value; const estadoBtn = document.querySelector('.visita-filter-btn.active'); const estado = estadoBtn ? estadoBtn.getAttribute('data-estado') : null; window.internamientoModule.loadVisitasListView(estado, fecha);">
                </div>
                
                <!-- Filtros de estado -->
                <div class="visitas-filters-container">
                    <button class="visita-filter-btn ${filtroEstado === 'En espera' ? 'active' : ''}" 
                            data-estado="En espera"
                            onclick="const fecha = document.getElementById('visitasFilterDate')?.value || null; window.internamientoModule.loadVisitasListView('En espera', fecha);">
                        <i class="fas fa-clock"></i>
                        En espera
                    </button>
                    <button class="visita-filter-btn ${filtroEstado === 'En curso' ? 'active' : ''}" 
                            data-estado="En curso"
                            onclick="const fecha = document.getElementById('visitasFilterDate')?.value || null; window.internamientoModule.loadVisitasListView('En curso', fecha);">
                        <i class="fas fa-user-check"></i>
                        En curso
                    </button>
                    <button class="visita-filter-btn ${filtroEstado === 'Finalizada' ? 'active' : ''}" 
                            data-estado="Finalizada"
                            onclick="const fecha = document.getElementById('visitasFilterDate')?.value || null; window.internamientoModule.loadVisitasListView('Finalizada', fecha);">
                        <i class="fas fa-check-circle"></i>
                        Finalizadas
                    </button>
                </div>
                
                <!-- Contador de resultados -->
                ${(filtroEstado || fechaFiltro) ? `
                    <div class="visitas-results-count">
                        <i class="fas fa-filter"></i>
                        <span>Mostrando <strong>${visitasFiltradas.length}</strong> de <strong>${todasLasVisitas.length}</strong> visitas</span>
                    </div>
                ` : ''}
                
                <!-- Visitas agrupadas por día -->
                ${visitasFiltradas.length === 0 ? `
                    <div class="visitas-empty-state">
                        <i class="fas fa-filter"></i>
                        <h3>No hay visitas con este estado</h3>
                        <p>Intente con otro filtro para ver más resultados.</p>
                    </div>
                ` : visitasHTML}
            `}
        `;
        
        // Agregar event listeners para los selects de estado
        container.querySelectorAll('.visita-estado-select-card').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const internamientoId = e.target.getAttribute('data-internamiento-id');
                const visitaId = e.target.getAttribute('data-visita-id');
                const nuevoEstado = e.target.value;
                if (internamientoId && visitaId) {
                    await this.actualizarEstadoVisita(internamientoId, visitaId, nuevoEstado);
                    // Recargar la vista con los filtros actuales
                    const fechaInput = document.getElementById('visitasFilterDate');
                    const fechaFiltro = fechaInput ? fechaInput.value : null;
                    this.loadVisitasListView(filtroEstado, fechaFiltro);
                }
            });
        });
    }

    async actualizarEstadoVisita(internamientoId, visitaId, nuevoEstado) {
        const ref = this.internamientosRef.child(internamientoId).child('visitas').child(visitaId);
        try {
            // Obtener el estado actual antes de cambiarlo
            const visitaActual = await ref.once('value');
            const estadoActual = visitaActual.val()?.estado || 'En espera';
            
            // Actualizar el estado
            await ref.child('estado').set(nuevoEstado);
            
            // Registrar timestamp automáticamente según el nuevo estado
            const ahora = Date.now();
            if (nuevoEstado === 'En espera' && estadoActual !== 'En espera') {
                await ref.child('horaEnEspera').set(ahora);
            } else if (nuevoEstado === 'En curso' && estadoActual !== 'En curso') {
                await ref.child('horaEnCurso').set(ahora);
            } else if (nuevoEstado === 'Finalizada' && estadoActual !== 'Finalizada') {
                await ref.child('horaFinalizada').set(ahora);
            }
            
            await this.internamientosRef.child(internamientoId).child('metadata/fechaUltimaActualizacion').set(Date.now());
            
            // Actualizar en memoria
            const int = this.internamientos.get(internamientoId);
            if (int && int.visitas && int.visitas[visitaId]) {
                int.visitas[visitaId].estado = nuevoEstado;
                if (nuevoEstado === 'En espera') {
                    int.visitas[visitaId].horaEnEspera = ahora;
                } else if (nuevoEstado === 'En curso') {
                    int.visitas[visitaId].horaEnCurso = ahora;
                } else if (nuevoEstado === 'Finalizada') {
                    int.visitas[visitaId].horaFinalizada = ahora;
                }
            }
            
            this.showNotification('Estado actualizado correctamente', 'success');
        } catch (err) {
            this.showAlert('Error al actualizar: ' + (err.message || err), 'Error', 'error');
        }
    }

    showModalAgregarVisita() {
        const hace48h = 48 * 60 * 60 * 1000;
        const ahora = Date.now();
        const lista = Array.from(this.internamientos.values())
            .filter(int => {
                const estado = int.estado?.actual;
                if (['activo', 'critico', 'alta'].includes(estado)) return true;
                if (estado === 'egresado' || estado === 'defuncion') {
                    const fechaCambio = int.estado?.fechaCambio || 0;
                    return (ahora - fechaCambio) <= hace48h;
                }
                return false;
            })
            .sort((a, b) => (b.metadata?.fechaCreacion || b.datosIngreso?.fechaIngreso || 0) - (a.metadata?.fechaCreacion || a.datosIngreso?.fechaIngreso || 0));
        const opcionesPaciente = lista.map(int => {
            const nombreMascota = (int.referencias?.nombreMascota || 'Sin nombre').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            const propietario = (this.getNombrePropietario(int) || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            const id = (int.metadata?.internamientoId || '').replace(/"/g, '&quot;');
            const label = propietario ? `${nombreMascota} — ${propietario}` : nombreMascota;
            return `<option value="${id}">${label}</option>`;
        }).join('');
        const contenido = `
            <div style="max-height: 70vh; overflow-y: auto; padding: 8px;">
                <form id="formAgregarVisita">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label>Nombre del paciente *</label>
                        <select id="visitaPacienteId" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                            <option value="">Seleccione el paciente</option>
                            ${opcionesPaciente}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label>Nombre de la persona que viene a ver al paciente *</label>
                        <input type="text" id="visitaNombrePersona" required placeholder="Nombre completo del visitante" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label>Parentesco con el paciente *</label>
                        <select id="visitaParentesco" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                            <option value="">Seleccione el parentesco</option>
                            <option value="Propietario">Propietario</option>
                            <option value="Familiar">Familiar</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label>Motivo *</label>
                        <select id="visitaMotivo" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                            <option value="">Seleccione el motivo</option>
                            <option value="Paciente Activo">Paciente Activo</option>
                            <option value="Visita de Emergencia (Paciente Crítico)">Visita de Emergencia (Paciente Crítico)</option>
                            <option value="Fallecimiento">Fallecimiento</option>
                            <option value="Recolección de cuerpo">Recolección de cuerpo</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Agregar</button>
                    </div>
                </form>
            </div>
        `;
        const modal = this.createModal('Agregar visita', contenido, 'fa-user-plus');
        document.body.appendChild(modal);
        const form = document.getElementById('formAgregarVisita');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const internamientoId = document.getElementById('visitaPacienteId')?.value?.trim() || '';
                const nombrePersona = document.getElementById('visitaNombrePersona')?.value?.trim() || '';
                const parentesco = document.getElementById('visitaParentesco')?.value?.trim() || '';
                const motivo = document.getElementById('visitaMotivo')?.value?.trim() || '';
                if (!internamientoId) {
                    this.showAlert('Seleccione el paciente.', 'Campo requerido', 'warning');
                    return;
                }
                if (!nombrePersona) {
                    this.showAlert('Indique el nombre de la persona que visita.', 'Campo requerido', 'warning');
                    return;
                }
                if (!parentesco) {
                    this.showAlert('Indique el parentesco con el paciente.', 'Campo requerido', 'warning');
                    return;
                }
                if (!motivo) {
                    this.showAlert('Seleccione el motivo de la visita.', 'Campo requerido', 'warning');
                    return;
                }
                this.guardarVisita(internamientoId, { nombreVisitante: nombrePersona, parentesco, motivo });
            });
        }
    }

    async guardarVisita(internamientoId, datos) {
        const ref = this.internamientosRef.child(internamientoId);
        const visitasRef = ref.child('visitas');
        const visitaId = 'visita_' + Date.now();
        const ahora = Date.now();
        const visita = {
            visitaId,
            nombreVisitante: datos.nombreVisitante || '',
            parentesco: datos.parentesco || '',
            motivo: datos.motivo || '',
            estado: 'En espera',
            fechaHora: new Date().toISOString(),
            timestamp: ahora,
            horaEnEspera: ahora // Registrar automáticamente la hora cuando se crea en estado "En espera"
        };
        try {
            await visitasRef.child(visitaId).set(visita);
            await ref.child('metadata/fechaUltimaActualizacion').set(Date.now());
            const internamiento = this.internamientos.get(internamientoId);
            if (internamiento) {
                const v = internamiento.visitas || {};
                v[visitaId] = visita;
                internamiento.visitas = v;
            }
            document.querySelector('.modal-overlay')?.remove();
            this.showNotification('Visita registrada correctamente', 'success');
        } catch (err) {
            this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
        }
    }

    showInternamientoView(viewName) {
        // Ocultar todas las vistas de internamiento
        const views = ['lista', 'admision', 'panel', 'turnos', 'turno', 'medicacion', 'procedimientos', 'evolucion', 'cirugias', 'llamadas', 'defunciones', 'transfusiones', 'controles_adicionales', 'imagenologia', 'rer', 'alimentacion_asistida', 'hidratacion', 'curva_glucosa', 'egreso', 'visitas'];
        views.forEach(view => {
            const element = document.getElementById(`internamiento-${view}`);
            if (element) {
                element.classList.add('hidden');
                element.style.display = 'none'; // Asegurar que esté oculto
            }
        });

        // Mostrar vista solicitada
        const targetView = document.getElementById(`internamiento-${viewName}`);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.style.display = ''; // Restaurar display
        } else {
            console.warn(`No se encontró la vista: internamiento-${viewName}`);
        }
    }

    // ================================================================
    // LISTA DE INTERNAMIENTOS
    // ================================================================
    
    refreshInternamientosList() {
        const container = document.getElementById('internamientosActivosContainer');
        if (!container) return;

        // Filtrar internamientos activos (si falta estado.actual se considera activo para no ocultar registros)
        const estadoActual = (int) => int.estado?.actual || 'activo';
        const activos = Array.from(this.internamientos.values())
            .filter(int => ['activo', 'critico', 'alta'].includes(estadoActual(int)));

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

        // Más recientes arriba
        activos.sort((a, b) => (b.metadata?.fechaCreacion || b.datosIngreso?.fechaIngreso || 0) - (a.metadata?.fechaCreacion || a.datosIngreso?.fechaIngreso || 0));
        container.innerHTML = activos.map(int => this.renderInternamientoCard(int)).join('');
    }

    /**
     * Indica si el internamiento tiene al menos una cirugía programada (agendada con el doctor, fecha futura).
     */
    hasCirugiaProgramada(internamiento) {
        return this.getDejarDeComerCirugia(internamiento) !== null;
    }

    renderInternamientoCard(internamiento, soloLectura = false) {
        const estado = internamiento.estado?.actual || 'activo';
        const estadoConfig = {
            'activo': { icon: 'fa-heartbeat', label: 'ACTIVO' },
            'critico': { icon: 'fa-exclamation-triangle', label: 'CRÍTICO' },
            'alta': { icon: 'fa-check-circle', label: 'ALTA MÉDICA' },
            'egresado': { icon: 'fa-home', label: 'DADO DE ALTA' },
            'defuncion': { icon: 'fa-cross', label: 'DEFUNCIÓN' }
        };

        const config = estadoConfig[estado] || estadoConfig.activo;
        const nombreMascota = internamiento.referencias?.nombreMascota || 'Sin nombre';
        const expediente = internamiento.metadata?.expedienteNumero || 'N/A';
        const diasInternado = this.calcularDiasInternado(internamiento.datosIngreso?.fechaIngreso);
        const tipoMascota = internamiento.referencias?.tipoMascota || 'perro';
        const iconMascota = tipoMascota === 'gato' ? 'fa-cat' : tipoMascota === 'ave' ? 'fa-dove' : 'fa-dog';
        const diagnostico = internamiento.datosIngreso?.diagnosticoPresuntivo || '';
        const tieneCirugiaProgramada = this.hasCirugiaProgramada(internamiento);
        const idRaw = internamiento.metadata?.internamientoId || '';
        const idInt = idRaw.replace(/"/g, '&quot;');
        const idForClick = idRaw.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const cardAttrs = soloLectura
            ? `data-id="${idInt}" data-estado="${estado}" style="cursor: default; pointer-events: none;"`
            : `data-id="${idInt}" data-estado="${estado}" onclick="window.internamientoModule.showPanelPrincipal('${idForClick}')"`;

        return `
            <div class="internamiento-card fade-in-up" ${cardAttrs}>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap;">
                            <div style="width: 46px; height: 46px; background: linear-gradient(135deg, #e8eaf6, #c5cae9); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                                <i class="fas ${iconMascota}" style="font-size: 1.3rem; color: #3f51b5;"></i>
                            </div>
                            <div>
                                <h3 style="margin-bottom: 3px;">${nombreMascota}</h3>
                                <span style="font-size: 0.85rem; color: #666;">Exp. ${expediente}</span>
                            </div>
                            <span class="badge-estado-${estado}">
                                <i class="fas ${config.icon}"></i> ${config.label}
                            </span>
                            ${internamiento.cambioVia?.activo && internamiento.cambioVia?.fechaVencimiento && Date.now() >= internamiento.cambioVia.fechaVencimiento ? `
                            <span style="background: #c62828; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">
                                <i class="fas fa-exclamation-triangle"></i> Cambio de vía
                            </span>
                            ` : ''}
                            ${internamiento.cambioSonda?.activo && internamiento.cambioSonda?.fechaVencimiento && Date.now() >= internamiento.cambioSonda.fechaVencimiento ? `
                            <span style="background: #e65100; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">
                                <i class="fas fa-exclamation-triangle"></i> Cambio de sonda
                            </span>
                            ` : ''}
                            ${tieneCirugiaProgramada ? `
                            <span style="background: #3949ab; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">
                                <i class="fas fa-procedures"></i> Cirugía programada
                            </span>
                            ` : ''}
                        </div>
                        <div class="card-info" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                            <div>
                                <i class="fas fa-calendar-day" style="color: #5c6bc0; margin-right: 6px;"></i>
                                <strong>${diasInternado}</strong>
                            </div>
                            <div>
                                <i class="fas fa-user" style="color: #26a69a; margin-right: 6px;"></i>
                                ${this.getNombrePropietario(internamiento)}
                            </div>
                            ${diagnostico ? `
                            <div style="grid-column: 1 / -1; margin-top: 8px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                                <i class="fas fa-stethoscope" style="color: #7e57c2; margin-right: 6px;"></i>
                                <span style="font-style: italic; color: #666;">${diagnostico.substring(0, 50)}${diagnostico.length > 50 ? '...' : ''}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ${soloLectura ? '' : `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 10px;">
                        ${estado === 'egresado' ? `
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center;" onclick="event.stopPropagation();">
                            <select class="estado-seguimiento-select" onchange="window.internamientoModule.aplicarColorEstadoSeguimientoSelect(this); window.internamientoModule.actualizarEstadoSeguimientoAlta('${idForClick}', this.value);" style="min-width: 140px; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; border-left-width: 4px; border-left-style: solid; border-left-color: ${(function(){ var c = this.getColorEstadoSeguimiento(internamiento.metadata?.estadoSeguimientoAlta); return (c && c !== '#ffffff') ? c : '#cbd5e1'; }.call(this))}; font-size: 0.8rem; background: ${(function(){ var c = this.getColorEstadoSeguimiento(internamiento.metadata?.estadoSeguimientoAlta); return (c && c !== '#ffffff') ? c + '22' : 'white'; }.call(this))};">
                                ${this.getEstadoSeguimientoAltaOpciones().map(o => `<option value="${o.value}" ${(internamiento.metadata?.estadoSeguimientoAlta || 'no_se_ha_llamado') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                            </select>
                            <button type="button" class="btn btn-primary" onclick="event.stopPropagation(); window.internamientoModule.generarExpediente('${idForClick}');" style="background: #0d47a1; border-color: #0d47a1; white-space: nowrap; font-size: 0.85rem; padding: 8px 14px;">
                                <i class="fas fa-file-alt"></i> Generar expediente
                            </button>
                        </div>
                        ` : ''}
                        ${estado === 'defuncion' ? `
                        <button type="button" class="btn btn-primary" onclick="event.stopPropagation(); window.internamientoModule.generarExpediente('${idForClick}');" style="background: #0d47a1; border-color: #0d47a1; white-space: nowrap; font-size: 0.85rem; padding: 8px 14px;">
                            <i class="fas fa-file-alt"></i> Generar expediente
                        </button>
                        ` : ''}
                        <i class="fas fa-chevron-right" style="color: #bdbdbd; font-size: 1.1rem;"></i>
                    </div>`}
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
        const datos = this.getDatosPropietario(internamiento);
        return datos.nombre;
    }

    getDatosPropietario(internamiento) {
        const ref = internamiento.referencias || {};
        const vacio = { nombre: 'No especificado', telefono: '', correo: '' };
        if (ref.nombrePropietario != null && ref.nombrePropietario !== '' || ref.telefonoPropietario != null || ref.correoPropietario != null) {
            return {
                nombre: (ref.nombrePropietario || '').trim() || 'No especificado',
                telefono: (ref.telefonoPropietario || '').trim(),
                correo: (ref.correoPropietario || '').trim()
            };
        }
        const cedula = ref.cedulaCliente;
        if (!cedula) return vacio;
        if (window.patientDatabase) {
            const patient = window.patientDatabase.findPatientByCedula(cedula);
            if (patient) {
                return {
                    nombre: (patient.nombre || '').trim() || 'No especificado',
                    telefono: (patient.telefono || '').trim(),
                    correo: (patient.correo || '').trim()
                };
            }
        }
        return vacio;
    }

    // ================================================================
    // ADMISIÓN - FORMULARIO
    // ================================================================
    
    showAdmisionForm(ticketData = null) {
        // Nuevo internamiento: no hay ID; así en Pendientes no se pide código de verificación
        this.currentInternamientoId = null;
        // Ocultar todas las secciones principales
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
            
            // Mostrar directamente la vista de admisión (no la lista)
            this.showInternamientoView('admision');
            this.pendientesAdmision = [];
            this.medicamentosAdmision = [];
            this.renderListaPendientesAdmision();
            this.renderListaMedicamentosAdmision();
            
            // Establecer botón activo en sidebar
            if (typeof setActiveSubmenuButtonHTML === 'function') {
                setActiveSubmenuButtonHTML('crearInternamientoBtn');
            }
        } else {
            console.error('No se encontró la sección internamientosSection');
        }

        // Limpiar autenticación de admisión
        this.codigoAdmisionVerificado = null;
        const inputNombreAuth = document.getElementById('admisionNombreAutenticado');
        if (inputNombreAuth) {
            inputNombreAuth.value = '';
            inputNombreAuth.placeholder = 'Se mostrará al verificar el código';
        }

        // Si viene de un ticket, pre-llenar datos; si no, no resetear el formulario para que lo escrito no se borre al cambiar de vista
        if (ticketData) {
            this.preLlenarAdmision(ticketData);
        }

        // Sincronizar visibilidad y habilitación de campos según checkboxes de Controles Rápidos
        const chkMuestras = document.getElementById('internamientoMuestras');
        const containerTipoMuestra = document.getElementById('internamientoTipoMuestraContainer');
        const inputTipoMuestra = document.getElementById('internamientoTipoMuestra');
        if (chkMuestras && containerTipoMuestra && inputTipoMuestra) {
            const verMuestras = chkMuestras.checked;
            containerTipoMuestra.style.display = verMuestras ? 'block' : 'none';
            inputTipoMuestra.disabled = !verMuestras;
        }
        const chkRayosX = document.getElementById('internamientoRayosX');
        const containerReporteRayosX = document.getElementById('internamientoReporteRayosXContainer');
        const containerDoctorRayosX = document.getElementById('internamientoDoctorRayosXContainer');
        const inputReporteRayosX = document.getElementById('internamientoReporteRayosXInput');
        if (chkRayosX && containerReporteRayosX && containerDoctorRayosX) {
            const verRayosX = chkRayosX.checked;
            containerReporteRayosX.style.display = verRayosX ? 'block' : 'none';
            containerDoctorRayosX.style.display = verRayosX ? 'block' : 'none';
            if (inputReporteRayosX) inputReporteRayosX.disabled = !verRayosX;
        }
        const chkUltrasonido = document.getElementById('internamientoUltrasonido');
        const containerReporteUltrasonido = document.getElementById('internamientoReporteUltrasonidoContainer');
        const containerDoctorUltrasonido = document.getElementById('internamientoDoctorUltrasonidoContainer');
        const inputReporteUltrasonido = document.getElementById('internamientoReporteUltrasonidoInput');
        if (chkUltrasonido && containerReporteUltrasonido && containerDoctorUltrasonido) {
            const verUltrasonido = chkUltrasonido.checked;
            containerReporteUltrasonido.style.display = verUltrasonido ? 'block' : 'none';
            containerDoctorUltrasonido.style.display = verUltrasonido ? 'block' : 'none';
            if (inputReporteUltrasonido) inputReporteUltrasonido.disabled = !verUltrasonido;
        }
        const sectionImagenologia = document.getElementById('internamientoImagenologiaSection');
        if (sectionImagenologia && chkRayosX && chkUltrasonido) {
            sectionImagenologia.style.display = (chkRayosX.checked || chkUltrasonido.checked) ? 'block' : 'none';
        }
        const chkReticTieneExamen = document.getElementById('internamientoReticulocitosTieneExamen');
        const wrapReticClasifInit = document.getElementById('internamientoReticulocitosClasificacionWrap');
        const chkReticChecklistInit = document.getElementById('internamientoReticulocitosChecklist');
        const sectionReticInit = document.getElementById('internamientoReticulocitosSection');
        const mostrarRetic = chkReticTieneExamen ? !!chkReticTieneExamen.checked : false;
        if (sectionReticInit) sectionReticInit.style.display = mostrarRetic ? 'block' : 'none';
        if (chkReticTieneExamen && wrapReticClasifInit) {
            wrapReticClasifInit.style.display = mostrarRetic ? 'block' : 'none';
        }
        if (chkReticChecklistInit) chkReticChecklistInit.checked = mostrarRetic;

        // Desplegable de edición: pacientes últimas 24h y estado de botones
        this.refreshAdmisionEdicionSelect();
        this.actualizarEstadoBotonesAdmision();
    }

    async solicitarCodigoAdmision() {
        const resultado = await this.verificarCodigoAsistente('admision');
        if (resultado.valido && resultado.nombre) {
            this.codigoAdmisionVerificado = resultado;
            const input = document.getElementById('admisionNombreAutenticado');
            if (input) {
                input.value = resultado.nombre;
                input.placeholder = '';
                input.style.borderColor = '#28a745';
            }
            this.showNotification('Código verificado correctamente', 'success');
        } else if (!resultado.cancelado) {
            this.codigoAdmisionVerificado = null;
            const input = document.getElementById('admisionNombreAutenticado');
            if (input) {
                input.value = '';
                input.style.borderColor = '';
            }
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

    /** Llena el desplegable con internamientos de las últimas 24 h (para edición por consulta externa). */
    refreshAdmisionEdicionSelect() {
        const select = document.getElementById('admisionEditarPacienteSelect');
        if (!select) return;
        const hace24h = Date.now() - 24 * 60 * 60 * 1000;
        const list = Array.from(this.internamientos.entries())
            .filter(([, int]) => {
                const raw = int.metadata?.fechaCreacion ?? int.datosIngreso?.fechaIngreso;
                const ts = raw != null ? Number(raw) : NaN;
                if (Number.isNaN(ts)) return false;
                return ts >= hace24h;
            })
            .sort(([, a], [, b]) => {
                const ta = Number(a.metadata?.fechaCreacion || a.datosIngreso?.fechaIngreso || 0);
                const tb = Number(b.metadata?.fechaCreacion || b.datosIngreso?.fechaIngreso || 0);
                return tb - ta;
            });
        const firstOpt = select.querySelector('option[value=""]') || document.createElement('option');
        if (!firstOpt.value) {
            firstOpt.value = '';
            firstOpt.textContent = '— Seleccione un paciente para editar datos de ingreso —';
        }
        select.innerHTML = '';
        select.appendChild(firstOpt);
        list.forEach(([id, int]) => {
            const ref = int.referencias || {};
            const nombreMascota = ref.nombreMascota || 'Sin nombre';
            const expediente = int.metadata?.expedienteNumero || id;
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${nombreMascota} — #${expediente}`;
            select.appendChild(opt);
        });
    }

    /** Muestra/oculta Iniciar Internamiento vs Guardar cambios, sección Autenticación y sección "Registrar quién hace los cambios" según modo edición. */
    actualizarEstadoBotonesAdmision() {
        const btnIniciar = document.getElementById('btnIniciarInternamiento');
        const containerGuardar = document.getElementById('admisionEdicionGuardarContainer');
        const btnGuardar = document.getElementById('btnGuardarEdicionIngreso');
        const seccionAuth = document.getElementById('admisionSeccionAutenticacion');
        const seccionAuthEdicion = document.getElementById('admisionSeccionAuthEdicion');
        const enEdicion = !!this.edicionIngresoConsultaId;
        if (btnIniciar) {
            btnIniciar.disabled = enEdicion;
            btnIniciar.style.display = enEdicion ? 'none' : '';
        }
        if (containerGuardar) {
            containerGuardar.style.display = enEdicion ? 'inline-block' : 'none';
        }
        if (btnGuardar) {
            btnGuardar.disabled = enEdicion && !(this.edicionConsultaVerificado && this.edicionConsultaVerificado.valido);
        }
        if (seccionAuth) {
            seccionAuth.style.display = enEdicion ? 'none' : '';
        }
        if (seccionAuthEdicion) {
            seccionAuthEdicion.style.display = enEdicion ? '' : 'none';
        }
    }

    /** Al cambiar el desplegable de paciente a editar: cargar datos en el formulario o salir de modo edición. */
    onAdmisionEditarPacienteChange(e) {
        const id = (e.target.value || '').trim();
        this.edicionIngresoConsultaId = id || null;
        if (!id) {
            this.edicionConsultaVerificado = null;
            const inputEdicion = document.getElementById('admisionNombreEdicionConsulta');
            if (inputEdicion) {
                inputEdicion.value = '';
                inputEdicion.placeholder = 'Se mostrará al verificar el código';
            }
            this.limpiarFormularioAdmision();
        } else {
            this.loadInternamientoEnFormularioAdmision(id).catch(err => {
                console.error(err);
                this.showAlert('No se pudo cargar el internamiento. Verifique la conexión.', 'Error', 'error');
            });
        }
        this.actualizarEstadoBotonesAdmision();
    }

    /** Limpia todos los campos del formulario de admisión (cuando no hay paciente seleccionado para editar). */
    limpiarFormularioAdmision() {
        const set = (id, value) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.type === 'checkbox') {
                el.checked = !!value;
            } else if (el.tagName === 'SELECT') {
                el.value = value != null ? value : '';
            } else {
                el.value = value != null ? value : '';
            }
        };
        const uncheckRadio = (name) => {
            const r = document.querySelector(`input[name="${name}"]:checked`);
            if (r) r.checked = false;
        };

        set('internamientoCedulaAdmision', '');
        set('internamientoNombreAdmision', '');
        set('internamientoTelefonoAdmision', '');
        set('internamientoCorreoAdmision', '');
        set('internamientoMascotaAdmision', '');
        set('internamientoIdPacienteAdmision', '');
        set('internamientoTipoMascotaAdmision', 'otro');
        set('internamientoHistoriaClinica', '');
        set('internamientoDiagnostico', '');
        set('internamientoPadecimientos', '');
        set('internamientoPesoIngreso', '');
        set('internamientoTempIngreso', '');
        set('internamientoNecesidades', '');
        set('internamientoMuestras', false);
        set('internamientoTipoMuestra', '');
        set('internamientoUltrasonido', false);
        set('internamientoDoctorUltrasonido', '');
        set('internamientoRayosX', false);
        set('internamientoDoctorRayosX', '');
        set('internamientoCastrado', false);
        set('internamientoVacunas', false);
        set('internamientoReporteRayosXInput', '');
        set('internamientoReporteUltrasonidoInput', '');
        set('internamientoReticulocitosTieneExamen', false);
        set('internamientoReticulocitosChecklist', false);
        uncheckRadio('internamientoReticulocitosTipo');
        set('internamientoPersonaResponsable', '');
        set('internamientoTelefonoResponsable', '');
        set('internamientoDoctorAdmision', '');

        const sectionRetic = document.getElementById('internamientoReticulocitosSection');
        const wrapRetic = document.getElementById('internamientoReticulocitosClasificacionWrap');
        if (sectionRetic) sectionRetic.style.display = 'none';
        if (wrapRetic) wrapRetic.style.display = 'none';

        const containerTipoMuestra = document.getElementById('internamientoTipoMuestraContainer');
        const containerReporteRayosX = document.getElementById('internamientoReporteRayosXContainer');
        const containerDoctorRayosX = document.getElementById('internamientoDoctorRayosXContainer');
        const containerReporteUltrasonido = document.getElementById('internamientoReporteUltrasonidoContainer');
        const containerDoctorUltrasonido = document.getElementById('internamientoDoctorUltrasonidoContainer');
        const sectionImagenologia = document.getElementById('internamientoImagenologiaSection');
        if (containerTipoMuestra) containerTipoMuestra.style.display = 'none';
        if (containerReporteRayosX) containerReporteRayosX.style.display = 'none';
        if (containerDoctorRayosX) containerDoctorRayosX.style.display = 'none';
        if (containerReporteUltrasonido) containerReporteUltrasonido.style.display = 'none';
        if (containerDoctorUltrasonido) containerDoctorUltrasonido.style.display = 'none';
        if (sectionImagenologia) sectionImagenologia.style.display = 'none';

        this.pendientesAdmision = [];
        this.medicamentosAdmision = [];
        this.renderListaPendientesAdmision();
        this.renderListaMedicamentosAdmision();
    }

    /** Pide el código solo para registrar quién hace los cambios (aparece en Revisar datos de ingreso). Solo en modo edición. */
    async solicitarCodigoEdicionConsulta() {
        const resultado = await this.verificarCodigoAsistente('edicion_ingreso_consulta_externa');
        if (resultado && resultado.valido && resultado.nombre) {
            this.edicionConsultaVerificado = resultado;
            const input = document.getElementById('admisionNombreEdicionConsulta');
            if (input) {
                input.value = resultado.nombre;
                input.placeholder = '';
                input.style.borderColor = '#16a34a';
            }
            this.showNotification('Código verificado. Ya puede guardar los cambios.', 'success');
            this.actualizarEstadoBotonesAdmision();
        } else if (resultado && !resultado.cancelado) {
            this.edicionConsultaVerificado = null;
            const input = document.getElementById('admisionNombreEdicionConsulta');
            if (input) {
                input.value = '';
                input.style.borderColor = '';
            }
        }
    }

    /** Carga en el formulario de admisión los datos guardados del internamiento (misma interfaz que nuevo). */
    async loadInternamientoEnFormularioAdmision(internamientoId) {
        let int = this.internamientos.get(internamientoId);
        if (!int && this.internamientosRef) {
            const snapshot = await this.internamientosRef.child(internamientoId).once('value');
            if (snapshot.exists()) {
                int = snapshot.val();
                this.internamientos.set(internamientoId, int);
            }
        }
        if (!int) return;
        const ref = int.referencias || {};
        const datosIngreso = int.datosIngreso || {};
        const controles = datosIngreso.controlesRapidos || {};
        const datosProp = this.getDatosPropietario(int);
        const consentimientos = int.consentimientos || {};
        const personaResp = consentimientos.personaResponsable || {};

        const set = (id, value) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = !!value;
            else el.value = value != null ? value : '';
        };
        set('internamientoCedulaAdmision', ref.cedulaCliente);
        set('internamientoNombreAdmision', datosProp.nombre);
        set('internamientoTelefonoAdmision', datosProp.telefono);
        set('internamientoCorreoAdmision', datosProp.correo);
        set('internamientoMascotaAdmision', ref.nombreMascota);
        set('internamientoTipoMascotaAdmision', ref.tipoMascota || 'otro');
        set('internamientoIdPacienteAdmision', ref.idPaciente);
        set('internamientoHistoriaClinica', datosIngreso.historiaClinica);
        set('internamientoDiagnostico', datosIngreso.diagnosticoPresuntivo);
        set('internamientoPadecimientos', datosIngreso.padecimientosPrevios);
        set('internamientoPesoIngreso', datosIngreso.pesoIngreso);
        set('internamientoTempIngreso', datosIngreso.temperaturaIngreso);
        set('internamientoNecesidades', datosIngreso.necesidadesEspeciales);
        set('internamientoMuestras', controles.tomaronMuestras);
        set('internamientoTipoMuestra', controles.tipoMuestra);
        set('internamientoUltrasonido', controles.ultrasonido);
        set('internamientoDoctorUltrasonido', controles.doctorUltrasonido);
        set('internamientoRayosX', controles.rayosX);
        set('internamientoDoctorRayosX', controles.doctorRayosX);
        set('internamientoCastrado', controles.castrado);
        set('internamientoVacunas', controles.vacunaDespaAlDia);
        set('internamientoReporteRayosXInput', controles.reporteRayosX);
        set('internamientoReporteUltrasonidoInput', controles.reporteUltrasonido);
        const chkRetic = document.getElementById('internamientoReticulocitosTieneExamen');
        if (chkRetic) chkRetic.checked = !!controles.reticulocitosTieneExamen;
        const chkReticList = document.getElementById('internamientoReticulocitosChecklist');
        if (chkReticList) chkReticList.checked = !!controles.reticulocitosTieneExamen;
        const wrapRetic = document.getElementById('internamientoReticulocitosClasificacionWrap');
        const sectionReticLoad = document.getElementById('internamientoReticulocitosSection');
        const mostrarReticLoad = !!(chkRetic && chkRetic.checked);
        if (sectionReticLoad) sectionReticLoad.style.display = mostrarReticLoad ? 'block' : 'none';
        if (wrapRetic) wrapRetic.style.display = mostrarReticLoad ? 'block' : 'none';
        const retRadioReg = document.getElementById('internamientoReticulocitosRegenerativa');
        const retRadioNoReg = document.getElementById('internamientoReticulocitosNoRegenerativa');
        const retRadioPend = document.getElementById('internamientoReticulocitosResultadosPendientes');
        if (retRadioReg) retRadioReg.checked = controles.reticulocitosRegenerativa === 'regenerativa';
        if (retRadioNoReg) retRadioNoReg.checked = controles.reticulocitosRegenerativa === 'no_regenerativa';
        if (retRadioPend) retRadioPend.checked = controles.reticulocitosRegenerativa === 'resultados_pendientes';
        set('internamientoPersonaResponsable', personaResp.nombre);
        set('internamientoTelefonoResponsable', personaResp.telefono);
        set('internamientoDoctorAdmision', datosIngreso.medicoNombre || '');

        const chkMuestras = document.getElementById('internamientoMuestras');
        const containerTipoMuestra = document.getElementById('internamientoTipoMuestraContainer');
        const inputTipoMuestraEl = document.getElementById('internamientoTipoMuestra');
        if (chkMuestras && containerTipoMuestra && inputTipoMuestraEl) {
            const verM = chkMuestras.checked;
            containerTipoMuestra.style.display = verM ? 'block' : 'none';
            inputTipoMuestraEl.disabled = !verM;
        }
        const chkRayosX = document.getElementById('internamientoRayosX');
        const containerReporteRayosX = document.getElementById('internamientoReporteRayosXContainer');
        const containerDoctorRayosX = document.getElementById('internamientoDoctorRayosXContainer');
        const inputReporteRayosXEl = document.getElementById('internamientoReporteRayosXInput');
        if (chkRayosX && containerReporteRayosX && containerDoctorRayosX) {
            const verRx = chkRayosX.checked;
            containerReporteRayosX.style.display = verRx ? 'block' : 'none';
            containerDoctorRayosX.style.display = verRx ? 'block' : 'none';
            if (inputReporteRayosXEl) inputReporteRayosXEl.disabled = !verRx;
        }
        const chkUltrasonido = document.getElementById('internamientoUltrasonido');
        const containerReporteUltrasonido = document.getElementById('internamientoReporteUltrasonidoContainer');
        const containerDoctorUltrasonido = document.getElementById('internamientoDoctorUltrasonidoContainer');
        const inputReporteUltrasonidoEl = document.getElementById('internamientoReporteUltrasonidoInput');
        if (chkUltrasonido && containerReporteUltrasonido && containerDoctorUltrasonido) {
            const verU = chkUltrasonido.checked;
            containerReporteUltrasonido.style.display = verU ? 'block' : 'none';
            containerDoctorUltrasonido.style.display = verU ? 'block' : 'none';
            if (inputReporteUltrasonidoEl) inputReporteUltrasonidoEl.disabled = !verU;
        }
        const sectionImagenologiaLoad = document.getElementById('internamientoImagenologiaSection');
        if (sectionImagenologiaLoad && chkRayosX && chkUltrasonido) {
            sectionImagenologiaLoad.style.display = (chkRayosX.checked || chkUltrasonido.checked) ? 'block' : 'none';
        }

        this.pendientesAdmision = [];
        this.medicamentosAdmision = [];
        const procs = int.procedimientos || {};
        Object.entries(procs).forEach(([procId, proc]) => {
            if (proc && proc.puestoPorConsultaExterna) {
                this.pendientesAdmision.push({
                    procedimientoId: procId,
                    tipo: proc.tipo || '',
                    descripcion: proc.descripcion || '',
                    prioridad: proc.prioridad || 'normal',
                    observaciones: proc.observaciones || '',
                    paraFernanda: !!proc.paraFernanda,
                    marcarCompletado: proc.estado === 'completado',
                    puestoPorConsultaExterna: true
                });
            }
        });
        const meds = int.planTerapeutico?.medicamentos || {};
        Object.entries(meds).forEach(([medId, med]) => {
            if (med && med.puestoPorConsultaExterna) {
                this.medicamentosAdmision.push({
                    medicamentoId: medId,
                    nombreComercial: med.nombreComercial,
                    dosis: med.dosis,
                    unidadMedida: med.unidadMedida || '',
                    viaAdministracion: med.viaAdministracion,
                    frecuenciaHoras: med.frecuenciaHoras || null,
                    horariosExactos: med.horariosExactos || [],
                    horariosCalculados: med.horariosCalculados || [],
                    observaciones: med.observaciones || '',
                    puestoPorConsultaExterna: true,
                    pedidoPermisoEmergencia: med.pedidoPermisoEmergencia || false,
                    encargadaContactada: med.encargadaContactada || null
                });
            }
        });
        this.renderListaPendientesAdmision();
        this.renderListaMedicamentosAdmision();
    }

    /** Guarda los cambios del formulario de admisión sobre el internamiento seleccionado (consulta externa). */
    async handleGuardarEdicionIngresoConsultaExterna(e) {
        e.preventDefault();
        const id = (this.edicionIngresoConsultaId || '').trim();
        if (!id) return;
        let int = this.internamientos.get(id);
        if (!int && this.internamientosRef) {
            try {
                const snapshot = await this.internamientosRef.child(id).once('value');
                if (snapshot.exists()) {
                    int = snapshot.val();
                    this.internamientos.set(id, int);
                }
            } catch (err) {
                console.error(err);
            }
        }
        if (!int) {
            this.showAlert('Internamiento no encontrado. Puede que ya no exista o la conexión falló.', 'Error', 'error');
            return;
        }

        // En modo edición se usa la verificación "Registrar quién hace los cambios" (solo para el nombre en Revisar datos de ingreso).
        if (!this.edicionConsultaVerificado || !this.edicionConsultaVerificado.valido) {
            this.showAlert('Debe verificar su código en «Registrar quién hace los cambios» para que quede registrado quién realizó los cambios. Debe completar eso antes de guardar.', 'Verificación requerida', 'warning');
            const btnVerificar = document.getElementById('btnVerificarCodigoEdicionConsulta');
            if (btnVerificar) btnVerificar.focus();
            return;
        }
        const nombreQuienEdita = (this.edicionConsultaVerificado.nombre || '').trim() || '';

        const data = this.getAdmisionFormData();
        if (!data.doctorResponsable && int.datosIngreso?.medicoNombre) data.doctorResponsable = int.datosIngreso.medicoNombre;
        if (!this.validateAdmisionData(data)) return;

        const ref = this.internamientosRef.child(id);
        const updates = {};
        updates['referencias/cedulaCliente'] = data.cedula;
        updates['referencias/nombrePropietario'] = (data.nombre || '').trim();
        updates['referencias/telefonoPropietario'] = (data.telefono || '').trim();
        updates['referencias/correoPropietario'] = (data.correo || '').trim();
        updates['referencias/nombreMascota'] = data.mascota;
        updates['referencias/tipoMascota'] = data.tipoMascota;
        updates['referencias/idPaciente'] = data.idPaciente || data.mascota;
        updates['datosIngreso/historiaClinica'] = data.historiaClinica;
        updates['datosIngreso/diagnosticoPresuntivo'] = data.diagnosticoPresuntivo;
        updates['datosIngreso/padecimientosPrevios'] = data.padecimientosPrevios;
        updates['datosIngreso/pesoIngreso'] = data.pesoIngreso;
        updates['datosIngreso/temperaturaIngreso'] = data.temperaturaIngreso;
        updates['datosIngreso/necesidadesEspeciales'] = data.necesidadesEspeciales;
        updates['datosIngreso/medicoNombre'] = data.doctorResponsable || '';
        updates['datosIngreso/controlesRapidos/tomaronMuestras'] = !!data.tomaronMuestras;
        updates['datosIngreso/controlesRapidos/tipoMuestra'] = (data.tipoMuestra || '').trim();
        updates['datosIngreso/controlesRapidos/ultrasonido'] = !!data.ultrasonido;
        updates['datosIngreso/controlesRapidos/doctorUltrasonido'] = (data.doctorUltrasonido || '').trim();
        updates['datosIngreso/controlesRapidos/rayosX'] = !!data.rayosX;
        updates['datosIngreso/controlesRapidos/doctorRayosX'] = (data.doctorRayosX || '').trim();
        updates['datosIngreso/controlesRapidos/castrado'] = !!data.castrado;
        updates['datosIngreso/controlesRapidos/vacunaDespaAlDia'] = !!data.vacunaDespaAlDia;
        updates['datosIngreso/controlesRapidos/reporteRayosX'] = (data.reporteRayosX || '').trim();
        updates['datosIngreso/controlesRapidos/reporteUltrasonido'] = (data.reporteUltrasonido || '').trim();
        updates['datosIngreso/controlesRapidos/reticulocitosTieneExamen'] = !!data.reticulocitosTieneExamen;
        updates['datosIngreso/controlesRapidos/reticulocitosRegenerativa'] = (data.reticulocitosRegenerativa || '').trim() || null;
        updates['datosIngreso/controlesRapidos/reticulocitosRegistradoEnIngreso'] = !!data.reticulocitosTieneExamen;
        updates['consentimientos/personaResponsable/nombre'] = data.personaResponsable || data.nombre;
        updates['consentimientos/personaResponsable/telefono'] = data.telefonoResponsable || data.telefono;

        // Agregar medicamentos y pendientes nuevos capturados desde el formulario de admisión (modo edición)
        const ahora = Date.now();
        const creadorId = this.edicionConsultaVerificado.assistantId || sessionStorage.getItem('userId') || '';
        const creadorNombre = nombreQuienEdita || this.edicionConsultaVerificado.nombre || sessionStorage.getItem('userName') || '';

        const medsAdmision = this.medicamentosAdmision || [];
        if (medsAdmision.length > 0) {
            const existentes = (int.planTerapeutico && int.planTerapeutico.medicamentos) || {};
            medsAdmision.forEach((m, idx) => {
                let medId = m.medicamentoId || ('med_' + ahora + '_' + idx + '_' + Math.random().toString(36).substr(2, 9));
                if (existentes && existentes[medId]) {
                    medId = 'med_' + ahora + '_' + idx + '_' + Math.random().toString(36).substr(2, 9);
                }
                const medData = {
                    medicamentoId: medId,
                    nombreComercial: m.nombreComercial,
                    dosis: m.dosis,
                    unidadMedida: m.unidadMedida || '',
                    viaAdministracion: m.viaAdministracion,
                    frecuenciaHoras: m.frecuenciaHoras || null,
                    horariosExactos: m.horariosExactos || [],
                    horariosCalculados: m.horariosCalculados || [],
                    fechaInicio: ahora,
                    fechaFin: null,
                    estadoMedicamento: 'activo',
                    prescritoPor: creadorId,
                    prescritoNombre: creadorNombre,
                    observaciones: m.observaciones || '',
                    puestoPorConsultaExterna: m.puestoPorConsultaExterna || false,
                    pedidoPermisoEmergencia: m.pedidoPermisoEmergencia || false,
                    encargadaContactada: m.encargadaContactada || null,
                    administraciones: {}
                };
                updates[`planTerapeutico/medicamentos/${medId}`] = medData;
            });
        }

        const pendientesAdmision = this.pendientesAdmision || [];
        const procedimientosExistentes = int.procedimientos || {};
        if (pendientesAdmision.length > 0) {
            pendientesAdmision.forEach((p, idx) => {
                const procedimientoIdExistente = (p.procedimientoId && procedimientosExistentes[p.procedimientoId]) ? p.procedimientoId : null;
                const procedimientoId = procedimientoIdExistente || ('proc_' + ahora + '_' + idx + '_' + Math.random().toString(36).substr(2, 9));
                const procExistente = procedimientoIdExistente ? procedimientosExistentes[procedimientoIdExistente] : null;
                const marcarCompletado = !!p.marcarCompletado;
                const procData = {
                    procedimientoId,
                    tipo: p.tipo || '',
                    descripcion: p.descripcion || '',
                    prioridad: p.prioridad || 'normal',
                    observaciones: p.observaciones || '',
                    paraFernanda: !!p.paraFernanda,
                    puestoPorConsultaExterna: !!p.puestoPorConsultaExterna,
                    estado: marcarCompletado ? 'completado' : 'pendiente',
                    fechaCreacion: procExistente?.fechaCreacion ?? ahora,
                    creadoPor: procExistente?.creadoPor ?? creadorId,
                    creadoNombre: procExistente?.creadoNombre ?? creadorNombre,
                    creadoCodigoVerificado: procExistente?.creadoCodigoVerificado ?? true,
                    fechaCompletado: marcarCompletado ? ahora : null,
                    completadoPor: marcarCompletado ? creadorId : null,
                    completadoNombre: marcarCompletado ? creadorNombre : null,
                    reportado: procExistente?.reportado ?? false,
                    reportadoA: procExistente?.reportadoA ?? null,
                    fechaReportado: procExistente?.fechaReportado ?? null,
                    reportadoPor: procExistente?.reportadoPor ?? null,
                    reportadoNombre: procExistente?.reportadoNombre ?? null,
                    observacionesReporte: procExistente?.observacionesReporte ?? '',
                    resultadoId: procExistente?.resultadoId ?? null,
                    documentosAdjuntos: procExistente?.documentosAdjuntos ?? []
                };
                updates[`procedimientos/${procedimientoId}`] = procData;
            });
        }

        updates['metadata/fechaUltimaActualizacion'] = ahora;
        updates['datosIngreso/ultimaEdicionPorConsultaExterna'] = true;
        updates['datosIngreso/fechaEdicionConsultaExterna'] = ahora;
        updates['datosIngreso/edicionConsultaExternaPorNombre'] = nombreQuienEdita;
        updates['datosIngreso/edicionConsultaExternaPorId'] = this.edicionConsultaVerificado.assistantId || sessionStorage.getItem('userId') || '';

        try {
            await ref.update(updates);
            const flat = this.flattenUpdates(updates);
            const merged = this.deepMerge({}, int, flat);
            this.internamientos.set(id, merged);

            // Limpiar listas temporales de admisión (para que no se repitan en futuras ediciones/ingresos)
            this.medicamentosAdmision = [];
            this.pendientesAdmision = [];
            this.renderListaMedicamentosAdmision();
            this.renderListaPendientesAdmision();

            this.showNotification('Datos de ingreso actualizados. Se registró como cambios por consulta externa.', 'success');
            this.edicionIngresoConsultaId = null;
            this.edicionConsultaVerificado = null;
            const select = document.getElementById('admisionEditarPacienteSelect');
            if (select) select.value = '';
            const inputEdicion = document.getElementById('admisionNombreEdicionConsulta');
            if (inputEdicion) {
                inputEdicion.value = '';
                inputEdicion.placeholder = 'Se mostrará al verificar el código';
            }
            this.actualizarEstadoBotonesAdmision();
        } catch (err) {
            console.error(err);
            this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
        }
    }

    /** Convierte rutas 'a/b/c' en objeto anidado para actualizar Map en memoria. */
    flattenUpdates(updates) {
        const out = {};
        for (const [path, value] of Object.entries(updates)) {
            const parts = path.split('/');
            let cur = out;
            for (let i = 0; i < parts.length - 1; i++) {
                const p = parts[i];
                if (!cur[p]) cur[p] = {};
                cur = cur[p];
            }
            cur[parts[parts.length - 1]] = value;
        }
        return out;
    }

    /** Merge profundo: copia de base con override aplicado (objetos anidados se fusionan). */
    deepMerge(target, base, override) {
        const t = JSON.parse(JSON.stringify(base || {}));
        function apply(obj, over) {
            if (!over || typeof over !== 'object' || Array.isArray(over)) return;
            for (const key of Object.keys(over)) {
                const v = over[key];
                if (v != null && typeof v === 'object' && !Array.isArray(v) && obj[key] && typeof obj[key] === 'object') {
                    apply(obj[key], v);
                } else {
                    obj[key] = v;
                }
            }
        }
        apply(t, override);
        return t;
    }

    async buscarClienteAdmision(cedula) {
        if (!cedula || cedula.length < 5) return;

        const nombreInput = document.getElementById('internamientoNombreAdmision');
        const telefonoInput = document.getElementById('internamientoTelefonoAdmision');
        const correoInput = document.getElementById('internamientoCorreoAdmision');

        // Buscar en base de datos de pacientes
        if (window.patientDatabase) {
            const patient = window.patientDatabase.findPatientByCedula(cedula);
            if (patient) {
                if (nombreInput) nombreInput.value = patient.nombre || '';
                if (telefonoInput) telefonoInput.value = patient.telefono || '';
                if (correoInput) correoInput.value = patient.correo || '';

                // Mostrar selector de mascotas usando el sistema estándar
                if (patient.mascotas && Object.keys(patient.mascotas).length > 0) {
                    window.patientDatabase.showPetSelector(cedula, 'internamiento');
                }

                return;
            }
        }

        // Si no se encuentra, dejar campos vacíos para nuevo registro
        console.log('Cliente no encontrado, registrar nuevo');
    }

    renderListaPendientesAdmision() {
        const container = document.getElementById('listaPendientesAdmision');
        if (!container) return;

        const lista = this.pendientesAdmision || [];
        if (lista.length === 0) {
            container.innerHTML = '';
            return;
        }

        const tiposLabel = { examen: 'Examen', imagen: 'Imagen', curacion: 'Curación', terapia: 'Terapia', cirugia: 'Cirugía', otro: 'Otro' };
        const responsableTexto = this.codigoAdmisionVerificado?.nombre
            ? `Responsable: ${this.codigoAdmisionVerificado.nombre}`
            : 'Responsable: se asignará al crear el internamiento (quien verifique el código)';
        const enEdicionDropdown = !!this.edicionIngresoConsultaId;
        container.innerHTML = `
            <div class="form-group" style="grid-column: span 2;">
                <label style="font-size: 0.9rem; color: #6c757d;">Tareas agregadas (${lista.length}) · ${responsableTexto}</label>
                <ul style="list-style: none; padding: 0; margin: 8px 0 0 0; border: 1px solid #e0e0e0; border-radius: 8px; background: #f8f9fa;">
                    ${lista.map((p, i) => `
                        <li style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; justify-content: space-between; gap: 10px; ${p.paraFernanda ? 'background: #fce4ec; border-left: 4px solid #ec407a;' : ''}">
                            <span style="font-size: 0.9rem;">
                                <strong>${(p.descripcion || '').replace(/</g, '&lt;')}</strong>
                                <span style="background: #ecfdf5; color: #0f766e; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; margin-left: 4px;"><i class="fas fa-stethoscope"></i> Consulta externa</span>
                                ${p.paraFernanda ? ' <span style="background: #f8bbd0; color: #c2185b; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">FERNANDA</span>' : ''}
                                ${p.tipo ? ` <span style="color: #6c757d; font-size: 0.8rem;">(${tiposLabel[p.tipo] || p.tipo})</span>` : ''}
                                ${p.prioridad === 'alta' ? ' <span style="color: #d32f2f; font-size: 0.75rem;">Urgente</span>' : ''}
                            </span>
                            <div style="display: flex; gap: 6px;">
                                ${enEdicionDropdown && p.procedimientoId ? `<button type="button" class="btn btn-sm" style="background: #17a2b8; color: white; padding: 4px 8px;" onclick="window.internamientoModule.editarPendienteConsultaExterna('${p.procedimientoId}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    quitarPendienteAdmision(index) {
        this.pendientesAdmision = this.pendientesAdmision || [];
        this.pendientesAdmision.splice(index, 1);
        this.renderListaPendientesAdmision();
    }

    renderListaMedicamentosAdmision() {
        const container = document.getElementById('listaMedicamentosAdmision');
        if (!container) return;

        const lista = this.medicamentosAdmision || [];
        if (lista.length === 0) {
            container.innerHTML = '';
            return;
        }

        const viaLabel = { IV: 'IV', IM: 'IM', SC: 'SC', VO: 'VO', Topica: 'Tópica', Otra: 'Otra' };
        const enEdicionDropdown = !!this.edicionIngresoConsultaId;
        container.innerHTML = `
            <div class="form-group" style="grid-column: span 2;">
                <label style="font-size: 0.9rem; color: #6c757d;">Medicamentos agregados (${lista.length})</label>
                <ul style="list-style: none; padding: 0; margin: 8px 0 0 0; border: 1px solid #e0e0e0; border-radius: 8px; background: #f8f9fa;">
                    ${lista.map((m, i) => `
                        <li style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                            <span style="font-size: 0.9rem;">
                                <strong>${(m.nombreComercial || '').replace(/</g, '&lt;')}</strong>
                                <span style="background: #ecfdf5; color: #0f766e; font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; margin-left: 6px;"><i class="fas fa-stethoscope"></i> Consulta externa</span>
                                <span style="color: #6c757d; font-size: 0.8rem;"> ${this.formatDosisUnidad(m)} · ${viaLabel[m.viaAdministracion] || m.viaAdministracion || ''}</span>
                                ${(m.horariosCalculados && m.horariosCalculados.length) ? ` <span style="color: #0ea5e9; font-size: 0.8rem;">${(m.horariosCalculados || []).join(', ')}</span>` : (m.frecuenciaHoras ? ` <span style="font-size: 0.8rem;">Cada ${m.frecuenciaHoras}h</span>` : '')}
                            </span>
                            <div style="display: flex; gap: 6px;">
                                ${enEdicionDropdown && m.medicamentoId ? `<button type="button" class="btn btn-sm" style="background: #17a2b8; color: white; padding: 4px 8px;" onclick="window.internamientoModule.showEditarMedicamentoFormDesdeConsultaExterna('${m.medicamentoId}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    quitarMedicamentoAdmision(index) {
        this.medicamentosAdmision = this.medicamentosAdmision || [];
        this.medicamentosAdmision.splice(index, 1);
        this.renderListaMedicamentosAdmision();
    }

    /** Editar un pendiente (procedimiento) de consulta externa desde el formulario de admisión (desplegable). Pide motivo y guarda historial. */
    async editarPendienteConsultaExterna(procedimientoId) {
        if (!this.edicionIngresoConsultaId) return;
        const internamiento = this.internamientos.get(this.edicionIngresoConsultaId);
        if (!internamiento) {
            this.showAlert('No se encontró el internamiento a editar.', 'Error', 'error');
            return;
        }
        const proc = (internamiento.procedimientos || {})[procedimientoId];
        if (!proc) {
            this.showAlert('Procedimiento no encontrado.', 'Error', 'error');
            return;
        }
        const descEsc = (proc.descripcion || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const obsEsc = (proc.observaciones || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const tiposLabel = { examen: 'Examen', imagen: 'Imagen', curacion: 'Curación', terapia: 'Terapia', cirugia: 'Cirugía', otro: 'Otro' };
        const tipoTexto = proc.tipo ? (tiposLabel[proc.tipo] || proc.tipo) : '';
        const nombreProcedimiento = (tipoTexto ? tipoTexto + ': ' : '') + (proc.descripcion || 'Sin nombre');
        const nombreProcedimientoEsc = nombreProcedimiento.replace(/</g, '&lt;');
        const modalContent = `
            <form id="formEditarPendienteConsultaExterna">
                <div class="form-group" style="padding: 12px 14px; background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 8px; margin-bottom: 16px;">
                    <label style="font-size: 0.75rem; color: #4f46e5; text-transform: uppercase; margin-bottom: 4px;">Nombre del procedimiento (solo lectura)</label>
                    <div style="font-size: 0.95rem; font-weight: 600; color: #1e293b;">${nombreProcedimientoEsc}</div>
                </div>
                <div class="form-group">
                    <label>Descripción *</label>
                    <input type="text" id="editPendDescripcion" value="${descEsc}" required>
                </div>
                <div class="form-group">
                    <label>Prioridad</label>
                    <select id="editPendPrioridad">
                        <option value="normal" ${proc.prioridad === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="alta" ${proc.prioridad === 'alta' ? 'selected' : ''}>Alta - Urgente</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Observaciones</label>
                    <textarea id="editPendObservaciones" rows="2">${obsEsc}</textarea>
                </div>
                <div class="form-group">
                    <label>Motivo del cambio *</label>
                    <textarea id="editPendMotivo" rows="2" required placeholder="Indique por qué se modifica esta tarea"></textarea>
                </div>
                <div style="text-align: right; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="window.internamientoModule.guardarEdicionPendienteConsultaExterna('${procedimientoId.replace(/'/g, "\\'")}')" style="margin-left: 10px;"><i class="fas fa-save"></i> Guardar</button>
                </div>
            </form>
        `;
        const modal = this.createModal('Editar tarea (consulta externa)', modalContent, 'fa-edit');
        document.body.appendChild(modal);
    }

    async guardarEdicionPendienteConsultaExterna(procedimientoId) {
        const motivo = document.getElementById('editPendMotivo')?.value?.trim();
        if (!motivo) {
            this.showAlert('El motivo del cambio es obligatorio.', 'Campo requerido', 'warning');
            return;
        }
        const resultadoCodigo = await this.verificarCodigoAsistente('editar_pendiente_consulta_externa');
        if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Edición cancelada', 'info');
            return;
        }
        const internamiento = this.internamientos.get(this.edicionIngresoConsultaId);
        if (!internamiento) return;
        const proc = (internamiento.procedimientos || {})[procedimientoId];
        if (!proc) return;
        const descripcion = document.getElementById('editPendDescripcion')?.value?.trim();
        if (!descripcion) {
            this.showAlert('La descripción es obligatoria.', 'Campo requerido', 'warning');
            return;
        }
        const datosAnteriores = {
            descripcion: proc.descripcion || '',
            prioridad: proc.prioridad || 'normal',
            observaciones: proc.observaciones || '',
            paraFernanda: !!proc.paraFernanda
        };
        const historialEntry = {
            fecha: Date.now(),
            editadoPor: resultadoCodigo.assistantId || null,
            editadoNombre: resultadoCodigo.nombre || '',
            motivo: motivo,
            datosAnteriores
        };
        const historialPrev = (proc.historialCambios || []);
        const updates = {};
        updates[`procedimientos/${procedimientoId}/descripcion`] = descripcion;
        updates[`procedimientos/${procedimientoId}/prioridad`] = document.getElementById('editPendPrioridad')?.value || 'normal';
        updates[`procedimientos/${procedimientoId}/observaciones`] = document.getElementById('editPendObservaciones')?.value?.trim() || '';
        // paraFernanda no se edita desde Nuevo internamiento; se mantiene el valor actual
        updates[`procedimientos/${procedimientoId}/historialCambios`] = [...historialPrev, historialEntry];
        updates['metadata/fechaUltimaActualizacion'] = Date.now();
        try {
            await this.internamientosRef.child(this.edicionIngresoConsultaId).update(updates);
            this.showNotification('Tarea actualizada', 'success');
            document.querySelector('.modal-overlay')?.remove();
            this.pendientesAdmision = (this.pendientesAdmision || []).map(p => {
                if (p.procedimientoId === procedimientoId) {
                    return { ...p, descripcion, prioridad: updates[`procedimientos/${procedimientoId}/prioridad`], observaciones: updates[`procedimientos/${procedimientoId}/observaciones`] };
                }
                return p;
            });
            this.renderListaPendientesAdmision();
        } catch (err) {
            console.error(err);
            this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
        }
    }

    /** Abre el flujo de edición de medicamento en contexto de edición desde desplegable (usa edicionIngresoConsultaId). */
    async showEditarMedicamentoFormDesdeConsultaExterna(medicamentoId) {
        if (!this.edicionIngresoConsultaId) return;
        this._edicionMedicamentoInternamientoId = this.edicionIngresoConsultaId;
        await this.showEditarMedicamentoForm(medicamentoId, this.edicionIngresoConsultaId);
    }

    async handleAdmisionSubmit(e) {
        e.preventDefault();

        // PREVENIR DOBLE SUBMIT (lo primero: evitar que dos envíos lean las mismas listas)
        if (this.submittingAdmision) return;
        this.submittingAdmision = true;

        // Si está en modo edición (consulta externa), no crear nuevo internamiento
        if (this.edicionIngresoConsultaId) {
            this.submittingAdmision = false;
            return;
        }
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        }

        try {
            // Validar permisos
            if (!this.canAccessModule()) {
                this.submittingAdmision = false;
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnContent || '<i class="fas fa-save"></i> Crear Internamiento'; }
                this.showAlert('No tienes permisos para crear internamientos', 'Acceso Denegado', 'error');
                return;
            }

            // Recoger datos del formulario
            const formData = this.getAdmisionFormData();

            // Validar datos obligatorios
            if (!this.validateAdmisionData(formData)) {
                this.submittingAdmision = false;
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnContent || '<i class="fas fa-save"></i> Crear Internamiento'; }
                return;
            }

            // Verificación de código obligatoria: no se permite crear internamiento sin verificar el código.
            if (!this.codigoAdmisionVerificado || !this.codigoAdmisionVerificado.valido) {
                this.submittingAdmision = false;
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnContent || '<i class="fas fa-save"></i> Crear Internamiento'; }
                this.showAlert('Debe verificar su código de personal médico en la sección Autenticación antes de crear el internamiento.', 'Verificación requerida', 'warning');
                const btnVerificar = document.getElementById('btnVerificarCodigoAdmision');
                if (btnVerificar) btnVerificar.focus();
                return;
            }

            // Crear internamiento
            const internamientoId = await this.crearInternamiento(formData);
            
            if (internamientoId) {
                this.pendientesAdmision = [];
                this.medicamentosAdmision = [];
                this.renderListaPendientesAdmision();
                this.renderListaMedicamentosAdmision();
                this.showNotification('Internamiento creado exitosamente', 'success');
                this.showPanelPrincipal(internamientoId);
            }
        } catch (error) {
            console.error('Error creando internamiento:', error);
            this.showAlert('Error al crear internamiento: ' + error.message, 'Error', 'error');
        } finally {
            // RESTAURAR BOTÓN
            this.submittingAdmision = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnContent || '<i class="fas fa-save"></i> Crear Internamiento';
            }
        }
    }

    getAdmisionFormData() {
        return {
            // Referencias (índices)
            cedula: document.getElementById('internamientoCedulaAdmision')?.value.trim() || '',
            nombre: document.getElementById('internamientoNombreAdmision')?.value.trim() || '',
            telefono: document.getElementById('internamientoTelefonoAdmision')?.value.trim() || '',
            correo: document.getElementById('internamientoCorreoAdmision')?.value.trim() || '',
            mascota: document.getElementById('internamientoMascotaAdmision')?.value.trim() || '',
            idPaciente: document.getElementById('internamientoIdPacienteAdmision')?.value.trim() || '',
            tipoMascota: document.getElementById('internamientoTipoMascotaAdmision')?.value || 'otro',

            // Datos de ingreso
            historiaClinica: document.getElementById('internamientoHistoriaClinica')?.value.trim() || '',
            diagnosticoPresuntivo: document.getElementById('internamientoDiagnostico')?.value.trim() || '',
            padecimientosPrevios: document.getElementById('internamientoPadecimientos')?.value.trim() || '',
            pesoIngreso: document.getElementById('internamientoPesoIngreso')?.value ? parseFloat(document.getElementById('internamientoPesoIngreso').value) : null,
            temperaturaIngreso: document.getElementById('internamientoTempIngreso')?.value ? parseFloat(document.getElementById('internamientoTempIngreso').value) : null,
            necesidadesEspeciales: document.getElementById('internamientoNecesidades')?.value.trim() || '',

            // Controles rápidos
            tomaronMuestras: document.getElementById('internamientoMuestras')?.checked || false,
            tipoMuestra: document.getElementById('internamientoTipoMuestra')?.value.trim() || '',
            ultrasonido: document.getElementById('internamientoUltrasonido')?.checked || false,
            doctorUltrasonido: document.getElementById('internamientoDoctorUltrasonido')?.value.trim() || '',
            rayosX: document.getElementById('internamientoRayosX')?.checked || false,
            doctorRayosX: document.getElementById('internamientoDoctorRayosX')?.value.trim() || '',
            castrado: document.getElementById('internamientoCastrado')?.checked || false,
            vacunaDespaAlDia: document.getElementById('internamientoVacunas')?.checked || false,
            reporteRayosX: document.getElementById('internamientoReporteRayosXInput')?.value.trim() || '',
            reporteUltrasonido: document.getElementById('internamientoReporteUltrasonidoInput')?.value.trim() || '',
            reticulocitosTieneExamen: document.getElementById('internamientoReticulocitosTieneExamen')?.checked || false,
            reticulocitosRegenerativa: (() => {
                if (!document.getElementById('internamientoReticulocitosTieneExamen')?.checked) return null;
                const r = document.querySelector('input[name="internamientoReticulocitosTipo"]:checked');
                return r ? r.value : null;
            })(),

            // Persona responsable (contacto de respaldo)
            personaResponsable: document.getElementById('internamientoPersonaResponsable')?.value.trim() || '',
            telefonoResponsable: document.getElementById('internamientoTelefonoResponsable')?.value.trim() || '',

            // Doctor responsable (desplegable en Autenticación)
            doctorResponsable: document.getElementById('internamientoDoctorAdmision')?.value.trim() || ''
        };
    }

    validateAdmisionData(data) {
        // CAMPOS OBLIGATORIOS MÍNIMOS
        if (!data.cedula) {
            this.showAlert('La cédula del propietario es obligatoria', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.nombre) {
            this.showAlert('El nombre del propietario es obligatorio', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.correo) {
            this.showAlert('El correo del propietario es obligatorio', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.mascota) {
            this.showAlert('El nombre de la mascota es obligatorio', 'Campo Requerido', 'warning');
            return false;
        }

        if (!data.doctorResponsable) {
            this.showAlert('Debe seleccionar el doctor responsable (médico de consulta externa) para poder iniciar el internamiento.', 'Campo Requerido', 'warning');
            const sel = document.getElementById('internamientoDoctorAdmision');
            if (sel) sel.focus();
            return false;
        }

        // Si marcó Toma de muestras pero no especificó qué muestras, no puede agregar el internamiento
        if (data.tomaronMuestras && !(data.tipoMuestra && data.tipoMuestra.trim())) {
            this.showAlert(
                'No puede agregar el internamiento: marcó "Toma de muestras" pero no indicó en el espacio correspondiente qué muestras se realizaron. Por favor especifique el tipo de muestra (ej.: sangre, orina, heces) para continuar.',
                'Complete el tipo de muestra',
                'warning'
            );
            return false;
        }

        // Validaciones dependientes de Rayos X / Ultrasonido
        // Si se marcan ambos, ambos reportes son obligatorios
        if (data.rayosX && data.ultrasonido && (!data.reporteRayosX || !data.reporteUltrasonido)) {
            this.showAlert('Si marca que se tomaron Rayos X y se realizó un ultrasonido, debe completar ambos reportes (Rayos X y Ultrasonido).', 'Campo Requerido', 'warning');
            return false;
        }

        // Si solo se marca Rayos X, el reporte de Rayos X es obligatorio
        if (data.rayosX && !data.ultrasonido && !data.reporteRayosX) {
            this.showAlert('Si marca que se tomaron Rayos X, debe completar el reporte de Rayos X.', 'Campo Requerido', 'warning');
            return false;
        }

        // Si solo se marca Ultrasonido, el reporte de Ultrasonido es obligatorio
        if (data.ultrasonido && !data.rayosX && !data.reporteUltrasonido) {
            this.showAlert('Si marca que se realizó un ultrasonido, debe completar el reporte de Ultrasonido.', 'Campo Requerido', 'warning');
            return false;
        }

        // NOTA: Todos los campos de "Información Clínica de Ingreso" son OPCIONALES
        // Se pueden completar después en "Ver Expedientes":
        // - historiaClinica
        // - diagnosticoPresuntivo
        // - pesoIngreso
        // - temperaturaIngreso
        // - padecimientosPrevios
        // - necesidadesEspeciales
        // - personaResponsable
        // - telefonoResponsable

        return true;
    }

    async crearInternamiento(data) {
        const userId = sessionStorage.getItem('userId');
        const userName = sessionStorage.getItem('userName');
        const empresa = sessionStorage.getItem('userEmpresa') || 'veterinaria_smp';

        // Quien ingresó/atendió: la persona que verificó su código en admisión (o usuario logueado como fallback)
        const ingresoPorId = this.codigoAdmisionVerificado?.assistantId ?? userId;
        const ingresoPorNombre = this.codigoAdmisionVerificado?.nombre ?? userName;

        // Copia única de listas de admisión para evitar duplicados si este método se invocara más de una vez
        const snapshotMedicamentos = [...(this.medicamentosAdmision || [])];
        const snapshotPendientes = [...(this.pendientesAdmision || [])];
        this.medicamentosAdmision = [];
        this.pendientesAdmision = [];

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
                version: '1.0.0-beta',
                protocoloInternamientoActivado: false
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
                medicoResponsable: ingresoPorId,
                medicoNombre: (data.doctorResponsable && data.doctorResponsable.trim()) ? data.doctorResponsable.trim() : '',
                historiaClinica: data.historiaClinica,
                diagnosticoPresuntivo: data.diagnosticoPresuntivo,
                padecimientosPrevios: data.padecimientosPrevios,
                pesoIngreso: data.pesoIngreso,
                temperaturaIngreso: data.temperaturaIngreso,
                necesidadesEspeciales: data.necesidadesEspeciales,
                controlesRapidos: {
                    tomaronMuestras: !!data.tomaronMuestras,
                    tipoMuestra: (data.tipoMuestra || '').trim(),
                    ultrasonido: !!data.ultrasonido,
                    doctorUltrasonido: (data.doctorUltrasonido || '').trim(),
                    rayosX: !!data.rayosX,
                    doctorRayosX: (data.doctorRayosX || '').trim(),
                    castrado: !!data.castrado,
                    vacunaDespaAlDia: !!data.vacunaDespaAlDia,
                    reporteRayosX: (data.reporteRayosX || '').trim(),
                    reporteUltrasonido: (data.reporteUltrasonido || '').trim(),
                    reticulocitosTieneExamen: !!data.reticulocitosTieneExamen,
                    reticulocitosRegenerativa: (data.reticulocitosRegenerativa || '').trim() || null,
                    reticulocitosRegistradoEnIngreso: !!data.reticulocitosTieneExamen
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

            planTerapeutico: (() => {
                const meds = {};
                const lista = snapshotMedicamentos;
                lista.forEach((m) => {
                    // Si es puesto por consulta externa, prescrito = persona asociada al código verificado (igual que en pendientes)
                    const prescritoPor = (m.puestoPorConsultaExterna && ingresoPorId) ? ingresoPorId : userId;
                    const prescritoNombre = (m.puestoPorConsultaExterna && ingresoPorNombre) ? ingresoPorNombre : userName;
                    meds[m.medicamentoId] = {
                        medicamentoId: m.medicamentoId,
                        nombreComercial: m.nombreComercial,
                        dosis: m.dosis,
                        unidadMedida: m.unidadMedida || '',
                        viaAdministracion: m.viaAdministracion,
                        frecuenciaHoras: m.frecuenciaHoras || null,
                        horariosExactos: m.horariosExactos || [],
                        horariosCalculados: m.horariosCalculados || [],
                        fechaInicio: Date.now(),
                        fechaFin: null,
                        estadoMedicamento: 'activo',
                        prescritoPor: prescritoPor,
                        prescritoNombre: prescritoNombre,
                        observaciones: m.observaciones || '',
                        puestoPorConsultaExterna: m.puestoPorConsultaExterna || false,
                        pedidoPermisoEmergencia: m.pedidoPermisoEmergencia || false,
                        encargadaContactada: m.encargadaContactada || null,
                        administraciones: {}
                    };
                });
                return {
                    medicamentos: meds,
                    terapiaFluidos: { activa: false },
                    ultimaActualizacion: Date.now()
                };
            })(),

            turnos: {},
            procedimientos: (() => {
                const procs = {};
                const pendientes = snapshotPendientes;
                // Responsable de los pendientes = persona que registra el internamiento (código verificado en Autenticación)
                const creadorProcedimientosId = ingresoPorId;
                const creadorProcedimientosNombre = ingresoPorNombre;
                pendientes.forEach((p, idx) => {
                    const procedimientoId = 'proc_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 9);
                    const marcarCompletado = !!p.marcarCompletado;
                    // Pendiente no marcado → aparece como pendiente normal en expediente; marcado → en completados
                    procs[procedimientoId] = {
                        procedimientoId,
                        tipo: p.tipo || '',
                        descripcion: p.descripcion || '',
                        prioridad: p.prioridad || 'normal',
                        observaciones: p.observaciones || '',
                        paraFernanda: !!p.paraFernanda,
                        puestoPorConsultaExterna: true,
                        estado: marcarCompletado ? 'completado' : 'pendiente',
                        fechaCreacion: Date.now(),
                        creadoPor: creadorProcedimientosId,
                        creadoNombre: creadorProcedimientosNombre,
                        creadoCodigoVerificado: true,
                        fechaCompletado: marcarCompletado ? Date.now() : null,
                        completadoPor: marcarCompletado ? creadorProcedimientosId : null,
                        completadoNombre: marcarCompletado ? creadorProcedimientosNombre : null,
                        reportado: false,
                        reportadoA: null,
                        fechaReportado: null,
                        reportadoPor: null,
                        reportadoNombre: null,
                        observacionesReporte: '',
                        resultadoId: null,
                        documentosAdjuntos: []
                    };
                });
                return procs;
            })(),
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
                totalProcedimientos: snapshotPendientes.filter(p => !!p.marcarCompletado).length,
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
                correo: data.correo || '',
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
        // Cargar datos actualizados desde Firebase para tener cirugías y todo al día al ingresar al paciente
        if (this.internamientosRef) {
            try {
                const snapshot = await this.internamientosRef.child(internamientoId).once('value');
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    this.internamientos.set(internamientoId, data);
                }
            } catch (e) {
                console.warn('No se pudo refrescar internamiento desde Firebase:', e);
            }
        }

        const internamiento = this.internamientos.get(internamientoId);
        if (!internamiento) {
            alert('Internamiento no encontrado');
            this.showInternamientosSection();
            return;
        }

        // Renderizar header
        this.renderPanelHeader(internamiento);

        // Si el contador de cambio de vía está en 0, mostrar advertencia
        if (internamiento.cambioVia?.activo) {
            const restante = this.getCambioViaRestante(internamiento.cambioVia);
            if (restante?.vencido) {
                this.showAlert(
                    'Este paciente ya le toca cambio de vía. Pasaron más de 72 horas desde el último registro de vía nueva. Por favor realice el cambio y registre un nuevo turno indicando el tipo de vía.',
                    'Cambio de vía pendiente',
                    'warning'
                );
            }
        }

        // Si el contador de cambio de sonda está en 0, mostrar advertencia
        if (internamiento.cambioSonda?.activo) {
            const restanteSonda = this.getCambioSondaRestante(internamiento.cambioSonda);
            if (restanteSonda?.vencido) {
                this.showAlert(
                    'Este paciente ya le toca cambio de sonda. Pasaron más de 72 horas desde el último registro de sonda nueva. Por favor realice el cambio y registre un nuevo turno indicando el tipo de sonda.',
                    'Cambio de sonda pendiente',
                    'warning'
                );
            }
        }

        // Renderizar información extracurricular
        this.renderInformacionExtracurricular(internamiento);
        // Renderizar secciones
        this.renderUltimosTurnos(internamiento);
        this.renderMedicacionesActivas(internamiento);
        this.renderProcedimientosRecientes(internamiento);
    }

    renderInformacionExtracurricular(internamiento) {
        const container = document.getElementById('panelInformacionExtracurricular');
        if (!container) return;
        const texto = internamiento.metadata?.informacionExtracurricular || '';
        container.innerHTML = `
            <div class="panel-informacion-extracurricular-box" style="margin: 20px 0; padding: 16px 20px; background: #f0f4ff; border: 1px solid #5c6bc0; border-radius: 12px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <i class="fas fa-info-circle" style="color: #3949ab; font-size: 1.2rem;"></i>
                    <h3 style="margin: 0; font-size: 1rem; color: #283593; font-weight: 600;">Información extracurricular importante</h3>
                </div>
                <textarea id="inputInformacionExtracurricular" readonly rows="3" placeholder="Ej: Propietario no quiere reporte vía telefónica, enviar reportes por WS" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #9fa8da; font-size: 0.95rem; resize: vertical; min-height: 70px; background: #e8eaf6;"></textarea>
                <div id="extracurricularBtnEditar" style="margin-top: 10px;">
                    <button type="button" class="btn btn-secondary" onclick="window.internamientoModule.activarEdicionInformacionExtracurricular()" style="padding: 8px 16px;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </div>
                <div id="extracurricularBtnGuardarCancelar" style="margin-top: 10px; display: none;">
                    <button type="button" class="btn btn-primary" onclick="window.internamientoModule.guardarInformacionExtracurricular()" style="padding: 8px 16px;">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="window.internamientoModule.cancelarEdicionInformacionExtracurricular()" style="padding: 8px 16px; margin-left: 8px;">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
            </div>
        `;
        const ta = document.getElementById('inputInformacionExtracurricular');
        if (ta) ta.value = texto;
    }

    activarEdicionInformacionExtracurricular() {
        const ta = document.getElementById('inputInformacionExtracurricular');
        const btnEditar = document.getElementById('extracurricularBtnEditar');
        const btnGuardarCancelar = document.getElementById('extracurricularBtnGuardarCancelar');
        if (!ta || !btnEditar || !btnGuardarCancelar) return;
        this._extracurricularValorAntesEdicion = ta.value;
        ta.readOnly = false;
        ta.style.background = '#fff';
        btnEditar.style.display = 'none';
        btnGuardarCancelar.style.display = 'block';
    }

    cancelarEdicionInformacionExtracurricular() {
        const ta = document.getElementById('inputInformacionExtracurricular');
        const btnEditar = document.getElementById('extracurricularBtnEditar');
        const btnGuardarCancelar = document.getElementById('extracurricularBtnGuardarCancelar');
        if (!ta || !btnEditar || !btnGuardarCancelar) return;
        ta.value = this._extracurricularValorAntesEdicion != null ? this._extracurricularValorAntesEdicion : '';
        ta.readOnly = true;
        ta.style.background = '#e8eaf6';
        btnEditar.style.display = 'block';
        btnGuardarCancelar.style.display = 'none';
    }

    async guardarInformacionExtracurricular() {
        const id = this.currentInternamientoId;
        if (!id) return;
        const textarea = document.getElementById('inputInformacionExtracurricular');
        const texto = textarea ? textarea.value.trim() : '';
        try {
            const updates = { 'metadata/informacionExtracurricular': texto || null, 'metadata/fechaUltimaActualizacion': Date.now() };
            await this.internamientosRef.child(id).update(updates);
            const internamiento = this.internamientos.get(id);
            if (internamiento) {
                const meta = { ...(internamiento.metadata || {}), informacionExtracurricular: texto || '' };
                this.internamientos.set(id, { ...internamiento, metadata: meta });
            }
            this.showNotification('Información extracurricular guardada', 'success');
            // Volver a modo solo lectura
            textarea.readOnly = true;
            textarea.style.background = '#e8eaf6';
            document.getElementById('extracurricularBtnEditar').style.display = 'block';
            document.getElementById('extracurricularBtnGuardarCancelar').style.display = 'none';
        } catch (e) {
            console.error('Error guardando información extracurricular:', e);
            this.showAlert('Error al guardar: ' + (e.message || e), 'Error', 'error');
        }
    }

    getPesoHoyDisplay(internamiento) {
        const hoy = new Date();
        const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        const pesoHoy = internamiento?.metadata?.pesoHoy;
        if (pesoHoy && pesoHoy.fecha === fechaHoy && pesoHoy.valor != null && pesoHoy.valor !== '') {
            return `${pesoHoy.valor} kg`;
        }
        return '--';
    }

    showModalActualizarPesoHoy() {
        if (!this.currentInternamientoId) return;
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        const valorActual = this.getPesoHoyDisplay(internamiento);
        const valorNum = (internamiento?.metadata?.pesoHoy?.valor != null) ? String(internamiento.metadata.pesoHoy.valor) : '';
        const contenido = `
            <div style="max-width: 360px; padding: 10px;">
                <p style="margin: 0 0 16px 0; color: #64748b; font-size: 0.9rem;">Registre el peso del paciente para hoy. Actual: <strong>${valorActual}</strong></p>
                <form id="formPesoHoy" style="width: 100%;">
                    <div class="form-group" style="margin-bottom: 18px;">
                        <label for="inputPesoHoy">Peso (kg) *</label>
                        <input type="number" id="inputPesoHoy" step="0.1" min="0" required placeholder="Ej: 12.5" value="${valorNum.replace(/</g, '&lt;')}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="background: var(--internamiento-primary); border-color: var(--internamiento-primary);"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </form>
            </div>
        `;
        const modal = this.createModal('Peso de hoy', contenido, 'fa-weight-hanging');
        document.body.appendChild(modal);
        const form = document.getElementById('formPesoHoy');
        if (form) form.onsubmit = (e) => { e.preventDefault(); this.handleGuardarPesoHoy(); };
    }

    async handleGuardarPesoHoy() {
        const id = this.currentInternamientoId;
        if (!id) return;
        const input = document.getElementById('inputPesoHoy');
        const valor = input ? parseFloat(input.value) : NaN;
        if (isNaN(valor) || valor <= 0) {
            this.showAlert('Ingrese un peso válido (número mayor a 0)', 'Dato inválido', 'warning');
            return;
        }
        const hoy = new Date();
        const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        const pesoHoy = { valor, fecha: fechaHoy };
        try {
            await this.internamientosRef.child(id).update({
                'metadata/pesoHoy': pesoHoy,
                'metadata/fechaUltimaActualizacion': Date.now()
            });
            const internamiento = this.internamientos.get(id);
            if (internamiento) {
                const meta = { ...(internamiento.metadata || {}), pesoHoy };
                this.internamientos.set(id, { ...internamiento, metadata: meta });
            }
            document.querySelector('.modal-overlay')?.remove();
            this.renderPanelHeader(this.internamientos.get(id));
            this.showNotification('Peso de hoy guardado', 'success');
        } catch (e) {
            console.error('Error guardando peso de hoy:', e);
            this.showAlert('Error al guardar: ' + (e.message || e), 'Error', 'error');
        }
    }

    showFormularioAutorizarAlta() {
        if (!this.currentInternamientoId) {
            this.showAlert('No hay internamiento seleccionado', 'Error', 'error');
            return;
        }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (!internamiento) return;
        if (internamiento.estado?.actual === 'egresado') {
            this.showAlert('Este paciente ya fue dado de alta.', 'Acción no disponible', 'info');
            return;
        }
        const contenido = `
            <div style="max-width: 420px; display: flex; flex-direction: column; align-items: flex-start;">
                <p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 0.95rem; text-align: left;">Seleccione el tipo de alta y luego confirme.</p>
                <form id="formAutorizarAlta" style="width: 100%; display: flex; flex-direction: column; align-items: flex-start;">
                    <div style="display: flex; flex-direction: column; gap: 12px; text-align: left; width: 100%; min-width: 220px;">
                        <label style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: rgba(255,255,255,0.06); border-radius: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); width: 100%; box-sizing: border-box;">
                            <input type="radio" name="tipoAlta" value="carta_liberacion" required style="width: 18px; height: 18px; margin: 0; flex-shrink: 0;">
                            <span style="flex: 1; text-align: left;">Carta de liberación</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: rgba(255,255,255,0.06); border-radius: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); width: 100%; box-sizing: border-box;">
                            <input type="radio" name="tipoAlta" value="carta_condicionada_24h" style="width: 18px; height: 18px; margin: 0; flex-shrink: 0;">
                            <span style="flex: 1; text-align: left;">Carta condicionada 24h</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: rgba(255,255,255,0.06); border-radius: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); width: 100%; box-sizing: border-box;">
                            <input type="radio" name="tipoAlta" value="carta_condicionada_48h" style="width: 18px; height: 18px; margin: 0; flex-shrink: 0;">
                            <span style="flex: 1; text-align: left;">Carta condicionada 48h</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: rgba(255,255,255,0.06); border-radius: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); width: 100%; box-sizing: border-box;">
                            <input type="radio" name="tipoAlta" value="referencia" style="width: 18px; height: 18px; margin: 0; flex-shrink: 0;">
                            <span style="flex: 1; text-align: left;">Referencia</span>
                        </label>
                    </div>
                    <div style="margin-top: 16px; width: 100%; text-align: left;">
                        <label for="observacionesAlta" style="display: block; margin-bottom: 8px; font-size: 0.9rem; color: #94a3b8;">Observaciones adicionales</label>
                        <textarea id="observacionesAlta" name="observacionesAlta" rows="3" placeholder="Ej: Se realiza referencia a tal lugar por X razón" style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); color: #f1f5f9; font-size: 0.95rem; resize: vertical; box-sizing: border-box;"></textarea>
                    </div>
                    <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end; width: 100%;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="background:#22c55e; border-color:#22c55e;"><i class="fas fa-check-circle"></i> Dar de alta</button>
                    </div>
                </form>
            </div>
        `;
        const modal = this.createModal('Autorizar alta / Dar de alta', contenido, 'fa-check-circle');
        document.body.appendChild(modal);
        const form = document.getElementById('formAutorizarAlta');
        if (form) form.onsubmit = (e) => { e.preventDefault(); this.darAltaPaciente(); };
    }

    async darAltaPaciente() {
        const id = this.currentInternamientoId;
        if (!id) return;
        const radio = document.querySelector('input[name="tipoAlta"]:checked');
        const tipo = radio ? radio.value : null;
        if (!tipo) {
            this.showAlert('Seleccione un tipo de alta.', 'Dato requerido', 'warning');
            return;
        }
        const observaciones = (document.getElementById('observacionesAlta') && document.getElementById('observacionesAlta').value) ? document.getElementById('observacionesAlta').value.trim() : '';
        const userId = sessionStorage.getItem('userId');
        const userName = sessionStorage.getItem('userName');
        const internamiento = this.internamientos.get(id);
        if (!internamiento) return;
        const tipoLabel = tipo === 'carta_liberacion' ? 'Carta de liberación' : tipo === 'carta_condicionada_24h' ? 'Carta condicionada 24h' : tipo === 'carta_condicionada_48h' ? 'Carta condicionada 48h' : 'Referencia';
        const updates = {
            'estado/actual': 'egresado',
            'estado/fechaCambio': Date.now(),
            'estado/cambiadoPor': userId,
            'estado/tipoAlta': tipo,
            'estado/fechaAlta': Date.now(),
            'estado/observacionesAlta': observaciones || null,
            'metadata/fechaUltimaActualizacion': Date.now()
        };
        try {
            await this.internamientosRef.child(id).update(updates);
            await this.internamientosRef.child(id).child('estado/historialEstados').push({
                estado: 'egresado',
                fecha: Date.now(),
                usuario: userId,
                usuarioNombre: userName,
                razon: `Alta: ${tipoLabel}${observaciones ? '. ' + observaciones : ''}`
            });
            const nuevoEstado = { ...(internamiento.estado || {}), actual: 'egresado', tipoAlta: tipo, observacionesAlta: observaciones || '', fechaAlta: Date.now(), fechaCambio: Date.now(), cambiadoPor: userId };
            this.internamientos.set(id, { ...internamiento, estado: nuevoEstado });
            document.querySelector('.modal-overlay')?.remove();
            this.showNotification('Paciente dado de alta correctamente', 'success');
            this.showInternamientosSection();
            this.refreshInternamientosList();
        } catch (e) {
            console.error('Error al dar de alta:', e);
            this.showAlert('Error al dar de alta: ' + (e.message || e), 'Error', 'error');
        }
    }

    /** Opciones del desplegable de estado de seguimiento para pacientes dados de alta. */
    getEstadoSeguimientoAltaOpciones() {
        return [
            { value: 'no_se_ha_llamado', label: 'No se ha llamado aún', color: '#ffffff' },
            { value: 'estable', label: 'Estable', color: '#22c55e' },
            { value: 'seguimiento', label: 'Seguimiento', color: '#eab308' },
            { value: 'inestable', label: 'Inestable', color: '#dc2626' },
            { value: 'no_contesta', label: 'No contesta', color: '#7c3aed' }
        ];
    }

    /** Devuelve el color asociado a un valor de estado de seguimiento. */
    getColorEstadoSeguimiento(valor) {
        const v = valor || 'no_se_ha_llamado';
        const op = this.getEstadoSeguimientoAltaOpciones().find(o => o.value === v);
        return op ? op.color : '#ffffff';
    }

    /** Aplica al select el color correspondiente a la opción seleccionada (borde y fondo suave). */
    aplicarColorEstadoSeguimientoSelect(selectEl) {
        if (!selectEl || !selectEl.classList || !selectEl.classList.contains('estado-seguimiento-select')) return;
        const color = this.getColorEstadoSeguimiento(selectEl.value);
        selectEl.style.borderLeftWidth = '4px';
        selectEl.style.borderLeftColor = (color && color !== '#ffffff') ? color : '#cbd5e1';
        selectEl.style.borderLeftStyle = 'solid';
        selectEl.style.backgroundColor = (color && color !== '#ffffff') ? (color + '22') : 'white';
    }

    /** Actualiza el estado de seguimiento para un paciente dado de alta. Valor por defecto "no_se_ha_llamado" se guarda como null. */
    async actualizarEstadoSeguimientoAlta(internamientoId, valor) {
        if (!internamientoId) return;
        const valorGuardar = (valor && valor !== 'no_se_ha_llamado') ? valor : null;
        try {
            await this.internamientosRef.child(internamientoId).update({
                'metadata/estadoSeguimientoAlta': valorGuardar,
                'metadata/fechaUltimaActualizacion': Date.now()
            });
            const internamiento = this.internamientos.get(internamientoId);
            if (internamiento) {
                const meta = { ...(internamiento.metadata || {}), estadoSeguimientoAlta: valorGuardar };
                this.internamientos.set(internamientoId, { ...internamiento, metadata: meta });
            }
            this.showNotification('Estado de seguimiento actualizado', 'success');
            if (this.currentInternamientoId === internamientoId) {
                this.renderPanelHeader(this.internamientos.get(internamientoId));
            }
            // Reaplicar el filtro actual para mantener la vista (p. ej. "Dados de alta") y que el desplegable conserve su valor
            this.filterInternamientos(this.currentFilter || 'activos');
        } catch (e) {
            console.error('Error actualizando estado seguimiento:', e);
            this.showAlert('Error al guardar: ' + (e.message || e), 'Error', 'error');
        }
    }

    /** Genera el expediente clínico completo en PDF con diseño por secciones. Requiere InternamientoExpedientePDF (internamiento-expediente-pdf.js). */
    async generarExpediente(internamientoIdFromCard) {
        const id = internamientoIdFromCard || this.currentInternamientoId;
        if (!id) return;
        let internamiento = this.internamientos.get(id);
        // Refrescar desde Firebase para que el expediente incluya los últimos datos de ingreso (p. ej. edición consulta externa)
        if (this.internamientosRef) {
            try {
                const snapshot = await this.internamientosRef.child(id).once('value');
                if (snapshot.exists()) {
                    internamiento = snapshot.val();
                    this.internamientos.set(id, internamiento);
                }
            } catch (err) {
                console.error('Error al refrescar para expediente:', err);
            }
        }
        if (!internamiento) return;
        const estado = internamiento?.estado?.actual || '';
        if (estado !== 'egresado' && estado !== 'defuncion') return;

        if (typeof window.InternamientoExpedientePDF === 'undefined') {
            this.showNotification('Módulo PDF no disponible. Recargue la página.', 'error');
            return;
        }

        this.showNotification('Generando expediente PDF, por favor espere…', 'info');

        window.InternamientoExpedientePDF.generar(internamiento)
            .then(fileName => {
                this.showNotification('Expediente generado: ' + fileName, 'success');
            })
            .catch(err => {
                console.error('Error generando expediente PDF:', err);
                this.showNotification('Error al generar el expediente: ' + (err.message || err), 'error');
            });
    }

    /**
     * Obtiene la próxima cirugía programada (solo las marcadas "agendada con el doctor") y la hora límite para dejar de comer (8h antes).
     * @returns {{ horaDejarComer: string, fechaDejarComer: string, cirugiaHora: string, nombreProcedimiento: string } | null}
     */
    getDejarDeComerCirugia(internamiento) {
        const cirugiasRaw = internamiento?.cirugias;
        let cirugiasList = [];
        if (cirugiasRaw && typeof cirugiasRaw === 'object') {
            cirugiasList = Array.isArray(cirugiasRaw)
                ? cirugiasRaw.filter(c => c && typeof c === 'object')
                : Object.values(cirugiasRaw);
        }
        const agendadaOk = c => c && c.fechaHora && (c.cirugiaAgendadaConDoctor === true || c.cirugiaAgendadaConDoctor === 'true' || !!c.cirugiaAgendadaConDoctor);
        const conTs = cirugiasList.filter(agendadaOk).map(c => {
            const ts = c.fechaHoraTs != null ? c.fechaHoraTs : new Date(c.fechaHora).getTime();
            return { ...c, ts: isNaN(ts) ? 0 : ts };
        }).filter(c => c.ts > 0);
        if (conTs.length === 0) return null;
        conTs.sort((a, b) => a.ts - b.ts);
        const proxima = conTs[0];
        const ahora = Date.now();
        if (proxima.ts < ahora) return null;
        const fechaCirugia = new Date(proxima.fechaHora);
        if (isNaN(fechaCirugia.getTime())) return null;
        const dejarComerDate = new Date(fechaCirugia.getTime() - 8 * 60 * 60 * 1000);
        const horaDejarComer = dejarComerDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
        const fechaDejarComer = dejarComerDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const cirugiaHora = fechaCirugia.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
        return {
            horaDejarComer,
            fechaDejarComer,
            cirugiaHora,
            nombreProcedimiento: proxima.nombreProcedimiento || 'Cirugía'
        };
    }

    renderPanelHeader(internamiento) {
        const container = document.getElementById('panelHeaderContainer');
        if (!container) return;

        if (this._rerCountdownInterval) {
            clearInterval(this._rerCountdownInterval);
            this._rerCountdownInterval = null;
        }

        const estado = internamiento.estado?.actual || 'activo';
        const estadoConfig = {
            'activo': { icon: 'fa-heartbeat', label: 'ACTIVO' },
            'critico': { icon: 'fa-exclamation-triangle', label: 'CRÍTICO' },
            'alta': { icon: 'fa-check-circle', label: 'ALTA MÉDICA' },
            'egresado': { icon: 'fa-home', label: 'EGRESADO' },
            'defuncion': { icon: 'fa-cross', label: 'DEFUNCIÓN' }
        };

        const config = estadoConfig[estado] || estadoConfig.activo;
        const nombreMascota = internamiento.referencias?.nombreMascota || 'Sin nombre';
        const expediente = internamiento.metadata?.expedienteNumero || 'N/A';
        const fechaIngresoTs = internamiento.datosIngreso?.fechaIngreso;
        const fechaIngresoStr = fechaIngresoTs ? (() => { const d = new Date(fechaIngresoTs); return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }); })() : '—';
        const tipoMascota = internamiento.referencias?.tipoMascota || 'perro';
        const iconMascota = tipoMascota === 'gato' ? 'fa-cat' : tipoMascota === 'ave' ? 'fa-dove' : 'fa-dog';

        const dejarComer = this.getDejarDeComerCirugia(internamiento);
        const dejarComerHTML = dejarComer ? `
                <div style="margin-top: 16px; padding: 16px 20px; background: #e8eaf6; border: 2px solid #3949ab; border-radius: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <span style="background: #3949ab; color: white; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 0.95rem;">
                            <i class="fas fa-utensils" style="margin-right: 8px;"></i>DEBE DEJAR DE COMER
                        </span>
                        <span style="color: #283593; font-weight: 600;">Debe dejar de comer a las <strong>${dejarComer.horaDejarComer}</strong> del ${dejarComer.fechaDejarComer} (8 h antes de cirugía: ${(dejarComer.nombreProcedimiento || '').replace(/</g, '&lt;')} a las ${dejarComer.cirugiaHora})</span>
                    </div>
                </div>` : '';

        const tipoAltaLabels = { carta_liberacion: 'Carta de liberación', carta_condicionada_24h: 'Carta condicionada 24h', carta_condicionada_48h: 'Carta condicionada 48h', referencia: 'Referencia' };
        const tipoAlta = internamiento.estado?.tipoAlta || '';
        const observacionesAlta = (internamiento.estado?.observacionesAlta || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
        const fechaAltaTs = internamiento.estado?.fechaAlta;
        const fechaAltaStr = fechaAltaTs ? (() => { const d = new Date(fechaAltaTs); return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }); })() : '—';
        const infoAltaHTML = (estado === 'egresado' && (tipoAlta || observacionesAlta || fechaAltaTs)) ? `
                <div style="margin-top: 16px; padding: 16px 20px; background: #e8f5e9; border: 1px solid #81c784; border-radius: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <i class="fas fa-home" style="color: #2e7d32; font-size: 1.2rem;"></i>
                        <strong style="color: #1b5e20; font-size: 1rem;">Información de alta</strong>
                    </div>
                    ${tipoAlta ? `<div style="margin-bottom: 6px;"><span style="color: #555;">Tipo de alta:</span> <strong>${(tipoAltaLabels[tipoAlta] || tipoAlta).replace(/</g, '&lt;')}</strong></div>` : ''}
                    ${fechaAltaTs ? `<div style="margin-bottom: 6px;"><span style="color: #555;">Fecha de alta:</span> ${fechaAltaStr}</div>` : ''}
                    ${observacionesAlta ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #a5d6a7;"><span style="color: #555;">Observaciones:</span><div style="margin-top: 4px; color: #333; white-space: pre-wrap;">${observacionesAlta}</div></div>` : ''}
                </div>` : '';

        // Información de defunción (similar a información de alta)
        const defuncionesRaw = internamiento?.defunciones;
        const defuncionesObj = defuncionesRaw && typeof defuncionesRaw === 'object' && !Array.isArray(defuncionesRaw) ? defuncionesRaw : {};
        const defuncionesList = Object.values(defuncionesObj).sort((a, b) => (b.fechaHoraTs || 0) - (a.fechaHoraTs || 0));
        const ultimaDefuncion = defuncionesList.length > 0 ? defuncionesList[0] : null;
        const destinoCuerpoLabels = { entierro: 'Entierro', cremacion: 'Cremación', entrega_directa: 'Entrega directa del cuerpo' };
        const fechaDefuncionStr = ultimaDefuncion?.fechaHoraTs ? (() => { const d = new Date(ultimaDefuncion.fechaHoraTs); return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }); })() : '—';
        const motivoDefuncion = (ultimaDefuncion?.motivoFallecimiento || ultimaDefuncion?.causa || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
        const observacionesDefuncion = (ultimaDefuncion?.observaciones || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
        const turnoDefuncion = ultimaDefuncion?.turno || '';
        const destinoCuerpoLabel = ultimaDefuncion?.destinoCuerpo ? (destinoCuerpoLabels[ultimaDefuncion.destinoCuerpo] || ultimaDefuncion.destinoCuerpo) : '';
        const registradoPorDefuncion = ultimaDefuncion?.registradoNombre || '';
        const infoDefuncionHTML = (estado === 'defuncion' && ultimaDefuncion) ? `
                <div style="margin-top: 16px; padding: 16px 20px; background: #f5f5f5; border: 1px solid #9e9e9e; border-radius: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <i class="fas fa-cross" style="color: #5c5c5c; font-size: 1.2rem;"></i>
                        <strong style="color: #424242; font-size: 1rem;">Registro de defunción</strong>
                    </div>
                    ${fechaDefuncionStr !== '—' ? `<div style="margin-bottom: 6px;"><span style="color: #555;">Hora de muerte:</span> <strong>${fechaDefuncionStr}</strong></div>` : ''}
                    ${turnoDefuncion ? `<div style="margin-bottom: 6px;"><span style="color: #555;">Turno:</span> <strong>${turnoDefuncion.replace(/</g, '&lt;')}</strong></div>` : ''}
                    ${motivoDefuncion ? `<div style="margin-bottom: 6px;"><span style="color: #555;">Motivo de fallecimiento:</span><div style="margin-top: 4px; color: #333; white-space: pre-wrap;">${motivoDefuncion}</div></div>` : ''}
                    ${destinoCuerpoLabel ? `<div style="margin-bottom: 6px;"><span style="color: #555;">Destino del cuerpo:</span> <strong>${destinoCuerpoLabel.replace(/</g, '&lt;')}</strong></div>` : ''}
                    ${observacionesDefuncion ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #bdbdbd;"><span style="color: #555;">Observaciones:</span><div style="margin-top: 4px; color: #333; white-space: pre-wrap;">${observacionesDefuncion}</div></div>` : ''}
                    ${registradoPorDefuncion ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #bdbdbd; font-size: 0.9rem; color: #757575;">Registrado por: ${registradoPorDefuncion.replace(/</g, '&lt;')}</div>` : ''}
                </div>` : '';

        container.innerHTML = `
            <!-- Header del Paciente -->
            <div class="panel-header-main">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px;">
                    <div style="flex: 1;">
                        <h2>
                            <i class="fas ${iconMascota}"></i> ${nombreMascota}
                        </h2>
                        <div class="patient-info">
                            <div class="patient-info-item">
                                <i class="fas fa-file-medical"></i>
                                <span>Expediente: <strong>${expediente}</strong></span>
                            </div>
                            <div class="patient-info-item">
                                <i class="fas fa-calendar-day"></i>
                                <span>Ingreso: <strong>${fechaIngresoStr}</strong></span>
                            </div>
                            <div class="patient-info-item">
                                <i class="fas fa-user-md"></i>
                                <span>Médico consulta externa: <strong>${(internamiento.datosIngreso?.medicoNombre || '—').replace(/</g, '&lt;')}</strong></span>
                            </div>
                            <div class="patient-info-item">
                                <i class="fas fa-user"></i>
                                <span>Propietario: <strong>${(this.getDatosPropietario(internamiento).nombre || '').replace(/</g, '&lt;')}</strong>${(() => {
                                    const d = this.getDatosPropietario(internamiento);
                                    const tel = (d.telefono || '').replace(/</g, '&lt;');
                                    const mail = (d.correo || '').replace(/</g, '&lt;');
                                    const parts = [];
                                    if (tel) parts.push('<i class="fas fa-phone" style="margin-left: 10px; color: #64748b;"></i> ' + tel);
                                    if (mail) parts.push('<i class="fas fa-envelope" style="margin-left: 10px; color: #64748b;"></i> ' + mail);
                                    return parts.length ? ' <span style="font-weight: normal; color: #475569; font-size: 0.95rem;">' + parts.join(' ') + '</span>' : '';
                                })()}</span>
                            </div>
                            <div class="patient-info-item">
                                <i class="fas fa-weight"></i>
                                <span>Peso ingreso: <strong>${internamiento.datosIngreso?.pesoIngreso || '--'} kg</strong></span>
                            </div>
                            <div class="patient-info-item" style="margin-top: 8px;">
                                <span class="peso-hoy-tab" onclick="window.internamientoModule.showModalActualizarPesoHoy()" style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; background: #f0f4ff; border: 1px solid #5c6bc0; border-radius: 8px; font-size: 0.85rem; cursor: pointer; color: #334155;">
                                    <i class="fas fa-weight-hanging"></i>
                                    <span>Peso de hoy: <strong>${this.getPesoHoyDisplay(internamiento)}</strong></span>
                                    <span style="color: #5c6bc0; font-weight: 600;">Actualizar</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <span class="badge-estado-header badge-estado-${estado}">
                            <i class="fas ${config.icon}"></i> ${config.label}
                        </span>
                    </div>
                </div>

                <!-- Protocolo de Internamiento Activado -->
                <div class="form-group" style="margin-top: 16px; padding: 14px 18px; background: ${internamiento.metadata?.protocoloInternamientoActivado ? '#e8f5e9' : '#fff8e1'}; border: 1px solid ${internamiento.metadata?.protocoloInternamientoActivado ? '#a5d6a7' : '#ffecb3'}; border-radius: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <i class="fas fa-clipboard-check" style="color: ${internamiento.metadata?.protocoloInternamientoActivado ? '#2e7d32' : '#f9a825'}; font-size: 1.2rem;"></i>
                        <span style="font-weight: 600; font-size: 0.95rem;">Protocolo de Internamiento Activado</span>
                        ${internamiento.metadata?.protocoloInternamientoActivado
                            ? `<span style="font-size: 0.85rem; color: #1b5e20;">Activado por <strong>${(internamiento.metadata?.protocoloActivadoPorNombre || 'N/A').replace(/</g, '&lt;')}</strong></span>`
                            : `<button type="button" class="btn btn-primary" onclick="window.internamientoModule.solicitarCodigoYActivarProtocolo()" style="padding: 8px 16px;">
                                <i class="fas fa-lock"></i> Activar (código requerido)
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="window.internamientoModule.mostrarModalVerificarCodigoYMostrarNombre()" style="padding: 8px 16px;">
                                <i class="fas fa-user-check"></i> Verificar código
                            </button>`}
                    </div>
                </div>

                ${estado !== 'egresado' && (() => {
                    const id = this.currentInternamientoId;
                    let rerVencido = id && this._rerCountdownVencidoPorId[id];
                    const rerCountdown = rerVencido ? null : this.getProximaTomaRerRestante(internamiento);
                    if (rerCountdown && id && rerCountdown.target && rerCountdown.target.getTime() <= Date.now()) {
                        this._rerCountdownVencidoPorId[id] = true;
                        this._saveCountdownVencidoStorage();
                        rerVencido = true;
                    }
                    if (!rerCountdown && !rerVencido) return '';
                    const rerLabel = rerVencido ? 'Ahora' : (rerCountdown?.label || '');
                    const rerTexto = rerVencido ? 'Ahora' : (rerCountdown?.texto || '');
                    const rerTargetTs = rerVencido ? 0 : (rerCountdown?.target?.getTime() || 0);
                    return `
                <div id="rer-countdown-box" data-rer-target-ts="${rerTargetTs}" data-rer-label="${(rerLabel || '').replace(/"/g, '&quot;')}" style="margin-top: 16px; padding: 12px 18px; background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); border: 1px solid #f59e0b; border-radius: 10px;">
                    <span style="font-weight: 600; color: #b45309;"><i class="fas fa-syringe" style="margin-right: 8px;"></i>Próxima toma RER:</span>
                    <span style="color: #92400e; font-weight: 700; margin-left: 6px;">${rerLabel}</span>
                    <span style="font-size: 0.9rem; color: #78350f; margin-left: 8px;">— <span id="rer-countdown-text">${rerTexto}</span></span>
                </div>`;
                })()}
                ${estado !== 'egresado' && (() => {
                    const id = this.currentInternamientoId;
                    let insNVencido = id && this._insulinaNCountdownVencidoPorId[id];
                    const insN = insNVencido ? null : this.getProximaInsulinaNRestante(internamiento);
                    if (insN && id && insN.target && insN.target.getTime() <= Date.now() && !insNVencido) {
                        this._insulinaNCountdownVencidoPorId[id] = true;
                        this._saveCountdownVencidoStorage();
                        insNVencido = true;
                    }
                    if (!insN && !insNVencido) return '';
                    const insNTexto = insNVencido ? 'Ahora' : (insN?.texto || '');
                    const insNTargetTs = insNVencido ? 0 : (insN?.target?.getTime() || 0);
                    return `
                <div id="insulina-n-countdown-box" data-insulina-n-target-ts="${insNTargetTs}" style="margin-top: 16px; padding: 12px 18px; background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); border: 1px solid #7b1fa2; border-radius: 10px;">
                    <span style="font-weight: 600; color: #6a1b9a;"><i class="fas fa-syringe" style="margin-right: 8px;"></i>Se debe aplicar insulina N en 12 h:</span>
                    <span style="color: #4a148c; font-weight: 700; margin-left: 6px;"><span id="insulina-n-countdown-text">${insNTexto}</span></span>
                </div>`;
                })()}
                ${estado !== 'egresado' && (() => {
                    const id = this.currentInternamientoId;
                    let aaVencido = id && this._aaCountdownVencidoPorId[id];
                    const aa = aaVencido ? null : this.getProximaTomaAlimentacionAsistidaRestante(internamiento);
                    if (aa && id && aa.target && aa.target.getTime() <= Date.now() && !aaVencido) {
                        this._aaCountdownVencidoPorId[id] = true;
                        this._saveCountdownVencidoStorage();
                        aaVencido = true;
                    }
                    if (!aa && !aaVencido) return '';
                    const aaTexto = aaVencido ? 'Ahora' : (aa?.texto || '');
                    const aaTargetTs = aaVencido ? 0 : (aa?.target?.getTime() || 0);
                    return `
                <div id="aa-countdown-box" data-aa-target-ts="${aaTargetTs}" style="margin-top: 16px; padding: 12px 18px; background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border: 1px solid #2e7d32; border-radius: 10px;">
                    <span style="font-weight: 600; color: #1b5e20;"><i class="fas fa-utensils" style="margin-right: 8px;"></i>Próxima toma Alimentación asistida:</span>
                    <span style="color: #1b5e20; font-weight: 700; margin-left: 6px;"><span id="aa-countdown-text">${aaTexto}</span></span>
                </div>`;
                })()}
                ${internamiento.cambioVia?.activo ? (() => {
                    const restante = this.getCambioViaRestante(internamiento.cambioVia);
                    if (!restante) return '';
                    if (restante.vencido) {
                        return `
                <div class="cambio-via-vencido" style="margin-top: 16px; padding: 16px 20px; background: #ffebee; border: 2px solid #e53935; border-radius: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <span style="background: #c62828; color: white; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 0.95rem;">
                            <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>CAMBIO DE VÍA PENDIENTE
                        </span>
                        <span style="color: #b71c1c; font-weight: 600;">El paciente ya le toca cambio de vía (pasaron 72h desde el último registro).</span>
                    </div>
                </div>`;
                    }
                    return `
                <div style="margin-top: 16px; padding: 12px 18px; background: #e3f2fd; border: 1px solid #2196f3; border-radius: 10px;">
                    <span style="font-weight: 600; color: #1565c0;"><i class="fas fa-clock" style="margin-right: 8px;"></i>Cambio de vía:</span>
                    <span style="color: #0d47a1; font-weight: 700; margin-left: 6px;">${restante.texto} restantes</span>
                    <span style="font-size: 0.85rem; color: #666; margin-left: 8px;">(72h desde último registro de vía nueva)</span>
                </div>`;
                })() : ''}

                ${internamiento.cambioSonda?.activo ? (() => {
                    const restanteSonda = this.getCambioSondaRestante(internamiento.cambioSonda);
                    if (!restanteSonda) return '';
                    if (restanteSonda.vencido) {
                        return `
                <div class="cambio-sonda-vencido" style="margin-top: 16px; padding: 16px 20px; background: #fff3e0; border: 2px solid #ff9800; border-radius: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <span style="background: #e65100; color: white; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 0.95rem;">
                            <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>CAMBIO DE SONDA PENDIENTE
                        </span>
                        <span style="color: #bf360c; font-weight: 600;">El paciente ya le toca cambio de sonda (pasaron 72h desde el último registro).</span>
                    </div>
                </div>`;
                    }
                    return `
                <div style="margin-top: 16px; padding: 12px 18px; background: #fff8e1; border: 1px solid #ffc107; border-radius: 10px;">
                    <span style="font-weight: 600; color: #f57f17;"><i class="fas fa-clock" style="margin-right: 8px;"></i>Cambio de sonda:</span>
                    <span style="color: #e65100; font-weight: 700; margin-left: 6px;">${restanteSonda.texto} restantes</span>
                    <span style="font-size: 0.85rem; color: #666; margin-left: 8px;">(72h desde último registro de sonda nueva)</span>
                </div>`;
                })() : ''}

                ${dejarComerHTML}

                ${infoAltaHTML}

                ${infoDefuncionHTML}

                <!-- Acciones Principales -->
                <div style="margin-top: 25px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
                        <i class="fas fa-bolt" style="color: #5c6bc0;"></i>
                        <span style="font-weight: 600; font-size: 0.9rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Acciones Rápidas</span>
                    </div>
                    <div class="panel-actions-grid">
                        <button class="btn btn-turno" onclick="window.internamientoModule.showTurnosView()" id="btnTurnos">
                            <i class="fas fa-clipboard-list"></i> Turnos
                        </button>
                        <button class="btn btn-medicacion" onclick="window.internamientoModule.showMedicacionView()">
                            <i class="fas fa-pills"></i> Medicación
                        </button>
                        <button class="btn btn-procedimientos" onclick="window.internamientoModule.showProcedimientosView()">
                            <i class="fas fa-tasks"></i> Procedimientos
                        </button>
                        <button class="btn btn-transfusion" onclick="window.internamientoModule.showTransfusionesView()">
                            <i class="fas fa-tint"></i> Transfusión
                        </button>
                        <button class="btn btn-evolucion" onclick="window.internamientoModule.showEvolucionView()">
                            <i class="fas fa-chart-line"></i> Evolución
                        </button>
                        <button class="btn btn-cirugias" onclick="window.internamientoModule.showCirugiasView()">
                            <i class="fas fa-procedures"></i> Cirugías
                        </button>
                    <button class="btn btn-llamada" onclick="window.internamientoModule.showLlamadasView()">
                        <i class="fas fa-phone-alt"></i> Llamadas
                    </button>
                    ${estado !== 'defuncion' ? `
                    <button class="btn btn-secondary" onclick="window.internamientoModule.agregarDefuncion()" style="background:#5c5c5c;color:white;">
                        <i class="fas fa-cross"></i> Defunción
                    </button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showControlesAdicionalesView()">
                        <i class="fas fa-clipboard-check"></i> Controles adicionales
                    </button>
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showRevisarDatosIngreso()">
                        <i class="fas fa-file-alt"></i> Revisar datos de ingreso
                    </button>
                </div>
            </div>

                <!-- Acciones de Estado -->
                <div class="panel-actions-special">
                    ${estado === 'activo' ? `
                        <button class="btn btn-critico" onclick="window.internamientoModule.cambiarEstado('critico')">
                            <i class="fas fa-exclamation-triangle"></i> Marcar Crítico
                        </button>
                        <button class="btn btn-alta" onclick="window.internamientoModule.showFormularioAutorizarAlta()">
                            <i class="fas fa-check-circle"></i> Autorizar Alta
                        </button>
                    ` : ''}
                    ${estado === 'critico' ? `
                        <button class="btn btn-success" onclick="window.internamientoModule.cambiarEstado('activo')">
                            <i class="fas fa-heartbeat"></i> Cambiar a Activo
                        </button>
                        <button class="btn btn-alta" onclick="window.internamientoModule.showFormularioAutorizarAlta()">
                            <i class="fas fa-check-circle"></i> Autorizar Alta
                        </button>
                    ` : ''}
                    ${estado === 'alta' ? `
                        <button class="btn btn-egreso" onclick="window.internamientoModule.showEgresoForm()">
                            <i class="fas fa-home"></i> Proceso de Egreso
                        </button>
                        <button class="btn btn-danger" onclick="window.internamientoModule.cancelarAlta()">
                            <i class="fas fa-times-circle"></i> Cancelar Alta
                        </button>
                    ` : ''}
                    ${estado === 'egresado' ? `
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <select class="estado-seguimiento-select" onchange="window.internamientoModule.aplicarColorEstadoSeguimientoSelect(this); window.internamientoModule.actualizarEstadoSeguimientoAlta('${this.currentInternamientoId || ''}', this.value);" style="min-width: 160px; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; border-left-width: 4px; border-left-style: solid; border-left-color: ${(function(){ var c = this.getColorEstadoSeguimiento(internamiento.metadata?.estadoSeguimientoAlta); return (c && c !== '#ffffff') ? c : '#cbd5e1'; }.call(this))}; font-size: 0.9rem; background: ${(function(){ var c = this.getColorEstadoSeguimiento(internamiento.metadata?.estadoSeguimientoAlta); return (c && c !== '#ffffff') ? c + '22' : 'white'; }.call(this))};">
                                ${this.getEstadoSeguimientoAltaOpciones().map(o => `<option value="${o.value}" ${(internamiento.metadata?.estadoSeguimientoAlta || 'no_se_ha_llamado') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                            </select>
                            <button class="btn btn-primary" onclick="window.internamientoModule.generarExpediente()" style="background: #0d47a1; border-color: #0d47a1;">
                                <i class="fas fa-file-alt"></i> Generar expediente
                            </button>
                        </div>
                    ` : ''}
                    ${estado === 'defuncion' ? `
                        <button class="btn btn-primary" onclick="window.internamientoModule.generarExpediente()" style="background: #0d47a1; border-color: #0d47a1;">
                            <i class="fas fa-file-alt"></i> Generar expediente
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showInternamientosSection()">
                        <i class="fas fa-arrow-left"></i> Volver a Lista
                    </button>
                    ${this.esAdmin() ? `
                        <button class="btn btn-danger" style="margin-left: auto;" onclick="window.internamientoModule.eliminarExpediente('${internamiento.metadata?.internamientoId}')">
                            <i class="fas fa-trash-alt"></i> Eliminar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        const rerBox = document.getElementById('rer-countdown-box');
        const insulinaNBox = document.getElementById('insulina-n-countdown-box');
        const aaBox = document.getElementById('aa-countdown-box');
        const now = Date.now();
        const rerTarget = rerBox ? parseInt(rerBox.getAttribute('data-rer-target-ts'), 10) : NaN;
        const insulinaNTarget = insulinaNBox ? parseInt(insulinaNBox.getAttribute('data-insulina-n-target-ts'), 10) : NaN;
        const hasFutureRer = !isNaN(rerTarget) && rerTarget > now;
        const hasFutureInsulinaN = !isNaN(insulinaNTarget) && insulinaNTarget > 0 && insulinaNTarget > now;
        const aaTarget = aaBox ? parseInt(aaBox.getAttribute('data-aa-target-ts'), 10) : NaN;
        const hasFutureAA = !isNaN(aaTarget) && aaTarget > 0 && aaTarget > now;
        if (hasFutureRer || hasFutureInsulinaN || hasFutureAA) {
            const self = this;
            this._rerCountdownInterval = setInterval(function updateCountdowns() {
                let refresh = false;
                let rerVencido = false;
                let insulinaNVencido = false;
                let aaVencido = false;
                const rerEl = document.getElementById('rer-countdown-text');
                const rerBoxEl = document.getElementById('rer-countdown-box');
                if (rerEl && rerBoxEl) {
                    const targetTs = parseInt(rerBoxEl.getAttribute('data-rer-target-ts'), 10);
                    if (!isNaN(targetTs) && targetTs > 0) {
                        const restante = targetTs - Date.now();
                        if (restante <= 0) {
                            rerEl.textContent = 'Ahora';
                            refresh = true;
                            rerVencido = true;
                        } else {
                            const horas = Math.floor(restante / (1000 * 60 * 60));
                            const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
                            rerEl.textContent = `${horas}h ${minutos}m`;
                        }
                    }
                }
                const insulinaNEl = document.getElementById('insulina-n-countdown-text');
                const insulinaNBoxEl = document.getElementById('insulina-n-countdown-box');
                if (insulinaNEl && insulinaNBoxEl) {
                    const targetTs = parseInt(insulinaNBoxEl.getAttribute('data-insulina-n-target-ts'), 10);
                    if (!isNaN(targetTs) && targetTs > 0) {
                        const restante = targetTs - Date.now();
                        if (restante <= 0) {
                            insulinaNEl.textContent = 'Ahora';
                            refresh = true;
                            insulinaNVencido = true;
                        } else {
                            const horas = Math.floor(restante / (1000 * 60 * 60));
                            const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
                            insulinaNEl.textContent = `${horas}h ${minutos}m`;
                        }
                    }
                }
                const aaEl = document.getElementById('aa-countdown-text');
                const aaBoxEl = document.getElementById('aa-countdown-box');
                if (aaEl && aaBoxEl) {
                    const targetTs = parseInt(aaBoxEl.getAttribute('data-aa-target-ts'), 10);
                    if (!isNaN(targetTs) && targetTs > 0) {
                        const restante = targetTs - Date.now();
                        if (restante <= 0) {
                            aaEl.textContent = 'Ahora';
                            refresh = true;
                            aaVencido = true;
                        } else {
                            const horas = Math.floor(restante / (1000 * 60 * 60));
                            const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
                            aaEl.textContent = `${horas}h ${minutos}m`;
                        }
                    }
                }
                if (refresh) {
                    const id = self.currentInternamientoId;
                    if (id && rerVencido) {
                        self._rerCountdownVencidoPorId[id] = true;
                        self.showNotification('¡Hora límite! Es momento de la próxima toma RER.', 'warning');
                    }
                    if (id && insulinaNVencido) {
                        self._insulinaNCountdownVencidoPorId[id] = true;
                        self.showNotification('Es momento de aplicar insulina N (12 h desde la última aplicación).', 'warning');
                    }
                    if (id && aaVencido) {
                        self._aaCountdownVencidoPorId[id] = true;
                        self.showNotification('Es momento de la próxima toma de Alimentación asistida.', 'warning');
                    }
                    if (id && (rerVencido || insulinaNVencido || aaVencido)) self._saveCountdownVencidoStorage();
                    if (self._rerCountdownInterval) {
                        clearInterval(self._rerCountdownInterval);
                        self._rerCountdownInterval = null;
                    }
                }
            }, 60000);
        }
    }

    esAdmin() {
        const userRole = sessionStorage.getItem('userRole');
        return userRole === 'admin';
    }

    async solicitarCodigoYActivarProtocolo() {
        if (!this.currentInternamientoId) return;
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.metadata?.protocoloInternamientoActivado) {
            return;
        }
        const resultadoCodigo = await this.verificarCodigoAsistente('activar_protocolo');
        if (!resultadoCodigo || resultadoCodigo.cancelado || !resultadoCodigo.valido) {
            return;
        }
        await this.activarProtocoloInternamiento(resultadoCodigo);
    }

    async activarProtocoloInternamiento(codigoResult) {
        if (!this.currentInternamientoId) return;
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.metadata?.protocoloInternamientoActivado) {
            return;
        }
        const nombreActivador = codigoResult?.nombre || sessionStorage.getItem('userName') || 'Usuario';
        const idActivador = codigoResult?.assistantId || sessionStorage.getItem('userId') || null;
        try {
            const updates = {};
            updates['metadata/protocoloInternamientoActivado'] = true;
            updates['metadata/protocoloActivadoPorNombre'] = nombreActivador;
            updates['metadata/protocoloActivadoPorId'] = idActivador;
            updates['metadata/protocoloActivadoFecha'] = Date.now();
            updates['metadata/fechaUltimaActualizacion'] = Date.now();
            await this.internamientosRef.child(this.currentInternamientoId).update(updates);
            this.internamientos.set(this.currentInternamientoId, {
                ...internamiento,
                metadata: {
                    ...internamiento.metadata,
                    protocoloInternamientoActivado: true,
                    protocoloActivadoPorNombre: nombreActivador,
                    protocoloActivadoPorId: idActivador,
                    protocoloActivadoFecha: Date.now()
                }
            });
            this.showNotification('Protocolo de Internamiento activado por ' + nombreActivador + '. No se puede desactivar.', 'success');
            this.loadPanelPrincipal(this.currentInternamientoId);
        } catch (error) {
            console.error('Error activando protocolo:', error);
            this.showAlert('Error al activar el protocolo: ' + (error.message || 'Error desconocido'), 'Error', 'error');
        }
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
                <h3><i class="fas fa-clipboard-list"></i> Últimos Turnos</h3>
                <div class="empty-state" style="padding: 40px 20px;">
                    <i class="fas fa-clipboard" style="font-size: 48px;"></i>
                    <p style="font-size: 0.95rem;">No hay turnos registrados</p>
                    <button class="btn btn-primary btn-sm" onclick="window.internamientoModule.showTurnosView()">
                        <i class="fas fa-plus"></i> Ir a Turnos
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <h3><i class="fas fa-clipboard-list"></i> Últimos Turnos</h3>
            <div style="padding: 20px;">
                ${turnos.map(turno => this.renderTurnoCard(turno)).join('')}
                <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 10px;" onclick="window.internamientoModule.showTurnosView()">
                    <i class="fas fa-plus"></i> Ir a Turnos
                </button>
            </div>
        `;
    }

    renderTurnoCard(turno) {
        const fecha = new Date(turno.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const hora = new Date(turno.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const temp = turno.parametrosVitales?.temperatura;
        const tempAlerta = temp && (temp < 37 || temp > 39.5);
        const fc = turno.parametrosVitales?.fc;
        const fcAlerta = fc && (fc < 60 || fc > 160);

        return `
            <div style="background: #f8f9fa; border: 1px solid #e8e8e8; border-left: 4px solid #5c6bc0; padding: 14px; border-radius: 8px; margin-bottom: 10px; transition: all 0.3s ease;" onmouseenter="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" onmouseleave="this.style.boxShadow='none'">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="background: linear-gradient(135deg, #5c6bc0, #3f51b5); padding: 5px 12px; border-radius: 15px; font-size: 0.8rem; font-weight: 600; color: white;">
                            ${turno.turno || 'Turno'}
                        </div>
                        ${turno.responsableNombre ? `<span style="font-size: 0.85rem; color: #666;"><i class="fas fa-user-nurse" style="margin-right: 4px; color: #5c6bc0;"></i>${turno.responsableNombre}</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="btn btn-sm btn-info" onclick="window.internamientoModule.verTurnoDetalle('${turno.turnoId || ''}')" title="Ver todo el registro (solo lectura)" style="padding: 6px 12px; font-size: 0.8rem;">
                            <i class="fas fa-eye"></i> Ver detalle
                        </button>
                        <span style="font-size: 0.8rem; color: #888; background: white; padding: 4px 10px; border-radius: 10px; border: 1px solid #e0e0e0;">
                            <i class="fas fa-clock" style="margin-right: 4px;"></i>${fecha} ${hora}
                        </span>
                    </div>
                </div>
                <div class="parametros-grid" style="grid-template-columns: repeat(3, 1fr); gap: 8px;">
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 8px; border: 1px solid ${tempAlerta ? '#f44336' : '#e0e0e0'};">
                        <i class="fas fa-thermometer-half" style="color: ${tempAlerta ? '#f44336' : '#ff9800'}; margin-right: 4px;"></i>
                        <span style="font-weight: 700; color: ${tempAlerta ? '#f44336' : '#333'};">${temp || '--'}°C</span>
                    </div>
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 8px; border: 1px solid ${fcAlerta ? '#f44336' : '#e0e0e0'};">
                        <i class="fas fa-heartbeat" style="color: ${fcAlerta ? '#f44336' : '#e53935'}; margin-right: 4px;"></i>
                        <span style="font-weight: 700; color: ${fcAlerta ? '#f44336' : '#333'};">${fc || '--'}</span>
                        <span style="font-size: 0.7rem; color: #888;"> lpm</span>
                    </div>
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 8px; border: 1px solid #e0e0e0;">
                        <i class="fas fa-lungs" style="color: #2196f3; margin-right: 4px;"></i>
                        <span style="font-weight: 700; color: #333;">${turno.parametrosVitales?.fr || '--'}</span>
                        <span style="font-size: 0.7rem; color: #888;"> rpm</span>
                    </div>
                </div>
                ${turno.observaciones ? `
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e8e8e8;">
                    <p style="font-size: 0.85rem; color: #666; font-style: italic; margin: 0; line-height: 1.5;">
                        <i class="fas fa-comment" style="margin-right: 6px; color: #5c6bc0;"></i>${turno.observaciones.substring(0, 100)}${turno.observaciones.length > 100 ? '...' : ''}
                    </p>
                </div>
                ` : ''}
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
                <h3><i class="fas fa-pills"></i> Plan de Medicación</h3>
                <div class="empty-state" style="padding: 40px 20px;">
                    <i class="fas fa-pills" style="font-size: 48px;"></i>
                    <p style="font-size: 0.95rem;">No hay medicamentos activos</p>
                    <button class="btn btn-primary btn-sm" onclick="window.internamientoModule.showMedicacionView()">
                        <i class="fas fa-plus"></i> Agregar Medicamento
                    </button>
                </div>
            `;
            return;
        }

        const viaIcons = {
            'IV': { icon: 'fa-syringe', color: '#f44336', label: 'Intravenosa' },
            'IM': { icon: 'fa-syringe', color: '#ff9800', label: 'Intramuscular' },
            'SC': { icon: 'fa-syringe', color: '#4caf50', label: 'Subcutánea' },
            'VO': { icon: 'fa-capsules', color: '#5c6bc0', label: 'Vía Oral' },
            'Topica': { icon: 'fa-hand-holding-medical', color: '#7e57c2', label: 'Tópica' },
            'Otra': { icon: 'fa-prescription-bottle', color: '#757575', label: 'Otra' }
        };

        container.innerHTML = `
            <h3><i class="fas fa-pills"></i> Plan de Medicación</h3>
            <div style="padding: 15px;">
                ${medicamentos.map(med => {
                    const via = viaIcons[med.viaAdministracion] || viaIcons.Otra;
                    const proximaDosis = this.calcularProximaDosis(med);
                    const horariosTexto = (med.horariosExactos && med.horariosExactos.length) ? med.horariosExactos.join(', ') : (med.horariosCalculados && med.horariosCalculados.length) ? med.horariosCalculados.join(', ') : (med.frecuenciaHoras ? 'c/' + med.frecuenciaHoras + 'h' : '--');
                    return `
                        <div style="background: #e8f5e9; border: 1px solid #c8e6c9; border-left: 4px solid #4caf50; padding: 14px; border-radius: 8px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 34px; height: 34px; background: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid #c8e6c9;">
                                        <i class="fas ${via.icon}" style="color: ${via.color};"></i>
                                    </div>
                                    <div>
                                        <strong style="color: #333; font-size: 0.95rem;">${med.nombreComercial || 'Sin nombre'}</strong>
                                        <div style="font-size: 0.8rem; color: #666; margin-top: 2px;">${via.label} · Dosis: ${this.formatDosisUnidad(med)}</div>
                                    </div>
                                </div>
                                <span style="background: #4caf50; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                                    ${horariosTexto}
                                </span>
                            </div>
                            ${med.observaciones ? `<div style="font-size: 0.8rem; color: #555; margin-bottom: 8px;"><i class="fas fa-comment" style="margin-right: 4px;"></i>${med.observaciones}</div>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #c8e6c9;">
                                <span style="font-size: 0.85rem; color: #555;">
                                    <i class="fas fa-prescription" style="margin-right: 4px; color: #4caf50;"></i>
                                    Dosis: <strong style="color: #333;">${this.formatDosisUnidad(med)}</strong>
                                </span>
                                <span style="font-size: 0.8rem; color: ${proximaDosis.includes('AHORA') ? '#f44336' : '#666'}; font-weight: ${proximaDosis.includes('AHORA') ? '700' : '400'};">
                                    <i class="fas fa-clock" style="margin-right: 4px;"></i>
                                    ${proximaDosis}
                                </span>
                            </div>
                        </div>
                    `;
                }).join('')}
                <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 10px;" onclick="window.internamientoModule.showMedicacionView()">
                    <i class="fas fa-list"></i> Ver Todo
                </button>
            </div>
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
                <h3><i class="fas fa-tasks"></i> Procedimientos</h3>
                <div class="empty-state" style="padding: 40px 20px;">
                    <i class="fas fa-clipboard-list" style="font-size: 48px;"></i>
                    <p style="font-size: 0.95rem;">No hay tareas registradas</p>
                    <button class="btn btn-primary btn-sm" onclick="window.internamientoModule.showProcedimientosView()">
                        <i class="fas fa-plus"></i> Agregar Tarea
                    </button>
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
            <h3><i class="fas fa-tasks"></i> Procedimientos</h3>
            <div style="padding: 20px;">
                <!-- Barra de progreso -->
                <div style="margin-bottom: 18px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.85rem; color: #666;">
                            <i class="fas fa-check-circle" style="color: #4caf50; margin-right: 4px;"></i>
                            ${completados.length} de ${total} completados
                        </span>
                        <span style="font-weight: 700; font-size: 1rem; color: #7e57c2;">${porcentaje}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${porcentaje}%; background: linear-gradient(90deg, #7e57c2, #9c27b0);"></div>
                    </div>
                </div>

                <!-- Lista de procedimientos -->
                <div style="max-height: 280px; overflow-y: auto;">
                    ${mostrar.map(proc => {
                        const completado = proc.estado === 'completado';
                        const prioridadConfig = {
                            'alta': { bg: '#ffebee', border: '#ffcdd2', icon: 'fa-exclamation', color: '#f44336' },
                            'media': { bg: '#fff3e0', border: '#ffe0b2', icon: 'fa-minus', color: '#ff9800' },
                            'baja': { bg: '#e8f5e9', border: '#c8e6c9', icon: 'fa-arrow-down', color: '#4caf50' }
                        };
                        const prioridad = prioridadConfig[proc.prioridad] || prioridadConfig.media;
                        
                        return `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: ${completado ? '#f5f5f5' : prioridad.bg}; border: 1px solid ${completado ? '#e0e0e0' : prioridad.border}; border-radius: 8px; margin-bottom: 8px; transition: all 0.3s ease; ${completado ? 'opacity: 0.6;' : ''}">
                                <input type="checkbox" 
                                       ${completado ? 'checked' : ''} 
                                       ${bloqueado ? 'disabled' : ''}
                                       onchange="window.internamientoModule.toggleProcedimiento('${proc.procedimientoId}')"
                                       class="procedimiento-checkbox"
                                       style="cursor: ${bloqueado ? 'not-allowed' : 'pointer'};">
                                <div style="flex: 1;">
                                    <div style="font-size: 0.9rem; font-weight: 500; color: ${completado ? '#999' : '#333'}; ${completado ? 'text-decoration: line-through;' : ''}">
                                        ${proc.descripcion}
                                    </div>
                                    ${!completado && proc.prioridad === 'alta' ? `
                                        <span class="priority-tag priority-alta" style="margin-top: 6px;">
                                            <i class="fas fa-fire"></i> URGENTE
                                        </span>
                                    ` : ''}
                                </div>
                                ${!completado ? `
                                    <i class="fas ${prioridad.icon}" style="color: ${prioridad.color}; font-size: 0.8rem;"></i>
                                ` : `
                                    <i class="fas fa-check" style="color: #4caf50;"></i>
                                `}
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 15px;" onclick="window.internamientoModule.showProcedimientosView()">
                    <i class="fas fa-list"></i> Ver Todos (${total})
                </button>
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
        
        if (typeof window.setTimePicker12Value === 'function') {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            window.setTimePicker12Value('turnoHora', `${h}:${m}`);
        } else if (horaInput) {
            const now = new Date();
            horaInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }

        // Responsable se asigna solo al ingresar el código (campo readonly)
        if (responsableInput) {
            responsableInput.value = '';
        }
        this._codigoTurnoResult = null;

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
        let turno = '6am-2pm'; // Default

        // NUEVOS HORARIOS DE 8 HORAS
        // Turno Mañana: 6am - 2pm
        // Turno Tarde-Noche: 2pm - 10pm
        // Turno Noche: 10pm - 6am

        if (hora >= 6 && hora < 14) {
            turno = '6am-2pm'; // 6:00 AM - 2:00 PM (Mañana)
        } else if (hora >= 14 && hora < 22) {
            turno = '2pm-10pm'; // 2:00 PM - 10:00 PM (Tarde-Noche)
        } else {
            turno = '10pm-6am'; // 10:00 PM - 6:00 AM (Noche)
        }

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
            const codigoResult = this._codigoTurnoResult || null;
            if (codigoResult) this._codigoTurnoResult = null;
            await this.guardarTurno(turnoData, codigoResult);
            this.showNotification('Turno registrado exitosamente', 'success');
            this.showTurnosView();
            this.loadTurnosView();
        } catch (error) {
            console.error('Error guardando turno:', error);
            this.showAlert('Error al guardar turno: ' + error.message, 'Error', 'error');
        }
    }

    /** Abre el modal de código; al validar, asigna el nombre al campo Responsable. */
    async asignarResponsableConCodigo() {
        const resultado = await this.verificarCodigoAsistente('turno');
        if (!resultado.valido || resultado.cancelado) return;
        const input = document.getElementById('turnoResponsable');
        if (input) {
            input.value = resultado.nombre;
        }
        this._codigoTurnoResult = resultado;
        this.showNotification('Responsable asignado: ' + resultado.nombre, 'success');
    }

    /** Guardar turno tras pedir código de personal médico; se guarda el nombre de quien autenticó. */
    async guardarTurnoConCodigo() {
        if (!this.currentInternamientoId) {
            this.showAlert('No hay internamiento seleccionado', 'Error', 'error');
            return;
        }

        const resultadoCodigo = await this.verificarCodigoAsistente('turno');
        if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Registro de turno cancelado', 'info');
            return;
        }

        const inputResponsable = document.getElementById('turnoResponsable');
        if (inputResponsable) inputResponsable.value = resultadoCodigo.nombre;

        const turnoData = this.getTurnoFormData();
        turnoData.responsable = resultadoCodigo.nombre;
        if (!this.validateTurnoData(turnoData)) {
            return;
        }

        try {
            await this.guardarTurno(turnoData, resultadoCodigo);
            this.showNotification('Turno registrado por ' + resultadoCodigo.nombre, 'success');
            this.showTurnosView();
            this.loadTurnosView();
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
            via: document.getElementById('turnoVia')?.value || '',
            tiempoVia: document.getElementById('turnoTiempoVia')?.value || '',
            sonda: document.getElementById('turnoSonda')?.value || '',
            tiempoSonda: document.getElementById('turnoTiempoSonda')?.value || '',
            parametrosPulmonares: document.getElementById('turnoParametrosPulmonares')?.value?.trim() || '',
            presionArterial: document.getElementById('turnoPresionArterial')?.value.trim() || '',
            po2: parseInt(document.getElementById('turnoPO2')?.value) || null,

            // Estado general
            estadoMental: document.getElementById('turnoEstadoMental')?.value || 'alerta',
            nivelDolor: document.getElementById('turnoNivelDolor')?.value || 'sin_dolor',
            glasgowPuntaje: parseInt(document.getElementById('glasgowPuntaje')?.value) || 0,
            ingestaAgua: document.getElementById('turnoIngestaAgua')?.checked || false,
            cantidadAgua: parseInt(document.getElementById('turnoCantidadAgua')?.value) || 0,
            apetito: document.getElementById('turnoApetito')?.checked || false,
            alimentoCantidad: document.getElementById('turnoAlimentoCantidad')?.value?.trim() || '',
            alimentoTipo: document.getElementById('turnoAlimentoTipo')?.value?.trim() || '',
            
            // Defecación (Escala de Bristol)
            defecacion: document.getElementById('turnoDefecacion')?.value || '',
            defecacionNotas: document.getElementById('turnoDefecacionNotas')?.value?.trim() || '',
            
            // Micción
            miccion: document.getElementById('turnoMiccion')?.checked || false,
            miccionColor: document.getElementById('turnoMiccionColor')?.value || '',
            miccionFrecuencia: document.getElementById('turnoMiccionFrecuencia')?.value || '',
            miccionVolumen: parseInt(document.getElementById('turnoMiccionVolumen')?.value) || 0,
            miccionNotas: document.getElementById('turnoMiccionNotas')?.value?.trim() || '',
            
            vomitos: document.getElementById('turnoVomitos')?.checked || false,
            descripcionVomitos: document.getElementById('turnoDescripcionVomitos')?.value?.trim() || '',

            // Fluidoterapia
            fluidoterapiaAdministrada: document.getElementById('turnoFluidoterapia')?.checked || false,
            fluidoTipo: document.getElementById('turnoFluidoTipo')?.value || '',
            fluidoFrecuencia: document.getElementById('turnoFluidoFrecuencia')?.value?.trim() || '',

            // Observaciones
            observaciones: document.getElementById('turnoObservaciones')?.value.trim() || ''
        };
    }

    validateTurnoData(data) {
        if (!data.responsable || !data.responsable.trim()) {
            this.showAlert('Debe ingresar su código de personal médico en "Ingresar código" para asignar al responsable.', 'Responsable Requerido', 'warning');
            return false;
        }
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

    async guardarTurno(data, codigoResult) {
        const userId = sessionStorage.getItem('userId');
        const userName = sessionStorage.getItem('userName');

        // Si se autenticó con código de personal médico, usar nombre e id del autenticado
        const responsableNombre = codigoResult?.nombre
            ? codigoResult.nombre
            : (data.responsable || userName || 'Usuario desconocido');
        const responsableId = codigoResult?.assistantId || userId;

        // Combinar fecha y hora para timestamp
        const fechaHora = new Date(`${data.fecha}T${data.hora}`).getTime();

        // Generar ID de turno
        const turnoId = 'turno_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Estructura del turno
        const turnoData = {
            turnoId: turnoId,
            fecha: fechaHora,
            fechaFormato: data.fecha,
            turno: data.turno,
            responsable: responsableId,
            responsableNombre: responsableNombre,
            codigoVerificado: !!codigoResult,

            parametrosVitales: {
                peso: data.peso,
                fc: data.fc,
                fr: data.fr,
                temperatura: data.temperatura,
                tllc: data.tllc,
                deshidratacion: data.deshidratacion,
                mucosas: data.mucosas,
                via: data.via || '',
                tiempoVia: data.tiempoVia || '',
                sonda: data.sonda || '',
                tiempoSonda: data.tiempoSonda || '',
                parametrosPulmonares: data.parametrosPulmonares || '',
                presionArterial: data.presionArterial,
                po2: data.po2
            },

            estadoGeneral: {
                estadoMental: data.estadoMental,
                nivelDolor: data.nivelDolor,
                glasgowPuntaje: data.glasgowPuntaje,
                ingestaAgua: data.ingestaAgua,
                cantidadAgua: data.cantidadAgua,
                apetito: data.apetito,
                alimentoCantidad: data.alimentoCantidad,
                alimentoTipo: data.alimentoTipo,
                // Defecación (Escala de Bristol)
                defecacion: data.defecacion,
                defecacionNotas: data.defecacionNotas,
                // Micción
                miccion: data.miccion,
                miccionColor: data.miccionColor,
                miccionFrecuencia: data.miccionFrecuencia,
                miccionVolumen: data.miccionVolumen,
                miccionNotas: data.miccionNotas,
                // Vómitos
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

        // Si "Vía" es "No tiene vía", eliminar el contador de cambio de vía
        if (data.via === 'no_tiene_via') {
            updates['cambioVia'] = null;
        }
        // Si "Tiempo de vía" es una opción "Nueva" (no "Sin cambios"), iniciar o reiniciar contador de 72h
        else if (data.tiempoVia && data.tiempoVia !== 'sin_cambios') {
            const ahora = Date.now();
            const vencimiento = ahora + (72 * 60 * 60 * 1000);
            updates['cambioVia'] = {
                activo: true,
                fechaInicio: ahora,
                fechaVencimiento: vencimiento,
                turnoIdOrigen: turnoId
            };
            const venceEn = new Date(vencimiento);
            console.log('[Cambio de vía] Contador de 72h iniciado. Vence:', venceEn.toLocaleString('es-ES'));
        }

        // Si "Sonda" es "No tiene sonda", eliminar el contador de cambio de sonda
        if (data.sonda === 'no_tiene_sonda') {
            updates['cambioSonda'] = null;
        }
        // Si "Tiempo de sonda" es una opción "Nueva" (no "Sin cambios"), iniciar o reiniciar contador de 72h
        else if (data.tiempoSonda && data.tiempoSonda !== 'sin_cambios') {
            const ahoraSonda = Date.now();
            const vencimientoSonda = ahoraSonda + (72 * 60 * 60 * 1000);
            updates['cambioSonda'] = {
                activo: true,
                fechaInicio: ahoraSonda,
                fechaVencimiento: vencimientoSonda,
                turnoIdOrigen: turnoId
            };
            console.log('[Cambio de sonda] Contador de 72h iniciado. Vence:', new Date(vencimientoSonda).toLocaleString('es-ES'));
        }

        // Agregar a auditoría (nombre de quien registró: con código o sesión)
        const auditEntry = {
            timestamp: Date.now(),
            userId: codigoResult?.assistantId || userId,
            usuarioNombre: responsableNombre,
            accion: 'registrar_turno',
            codigoVerificado: !!codigoResult,
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

        // Actualizar mapa local con cambioVia y cambioSonda para que el panel lo muestre de inmediato
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento) {
            if (data.via === 'no_tiene_via') {
                delete internamiento.cambioVia;
            } else if (data.tiempoVia && data.tiempoVia !== 'sin_cambios' && updates['cambioVia']) {
                internamiento.cambioVia = updates['cambioVia'];
            }
            if (data.sonda === 'no_tiene_sonda') {
                delete internamiento.cambioSonda;
            } else if (data.tiempoSonda && data.tiempoSonda !== 'sin_cambios' && updates['cambioSonda']) {
                internamiento.cambioSonda = updates['cambioSonda'];
            }
            this.internamientos.set(this.currentInternamientoId, internamiento);
        }
        
        // Agregar a auditoría (push para agregar al array)
        await internamientoRef.child('auditoria/historialCambios').push(auditEntry);
    }

    getCambioViaRestante(cambioVia) {
        if (!cambioVia?.activo || !cambioVia.fechaVencimiento) return null;
        const restante = cambioVia.fechaVencimiento - Date.now();
        if (restante <= 0) return { vencido: true, texto: 'Vencido', horas: 0, minutos: 0 };
        const horas = Math.floor(restante / (1000 * 60 * 60));
        const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
        return { vencido: false, texto: `${horas}h ${minutos}m`, horas, minutos };
    }

    getCambioSondaRestante(cambioSonda) {
        if (!cambioSonda?.activo || !cambioSonda.fechaVencimiento) return null;
        const restante = cambioSonda.fechaVencimiento - Date.now();
        if (restante <= 0) return { vencido: true, texto: 'Vencido', horas: 0, minutos: 0 };
        const horas = Math.floor(restante / (1000 * 60 * 60));
        const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
        return { vencido: false, texto: `${horas}h ${minutos}m`, horas, minutos };
    }

    _loadCountdownVencidoFromStorage() {
        try {
            const rer = sessionStorage.getItem('internamiento_rerCountdownVencidoPorId');
            if (rer) this._rerCountdownVencidoPorId = JSON.parse(rer);
            const insN = sessionStorage.getItem('internamiento_insulinaNCountdownVencidoPorId');
            if (insN) this._insulinaNCountdownVencidoPorId = JSON.parse(insN);
            const aa = sessionStorage.getItem('internamiento_aaCountdownVencidoPorId');
            if (aa) this._aaCountdownVencidoPorId = JSON.parse(aa);
        } catch (e) {
            this._rerCountdownVencidoPorId = {};
            this._insulinaNCountdownVencidoPorId = {};
            this._aaCountdownVencidoPorId = {};
        }
    }

    _saveCountdownVencidoStorage() {
        try {
            sessionStorage.setItem('internamiento_rerCountdownVencidoPorId', JSON.stringify(this._rerCountdownVencidoPorId));
            sessionStorage.setItem('internamiento_insulinaNCountdownVencidoPorId', JSON.stringify(this._insulinaNCountdownVencidoPorId));
            sessionStorage.setItem('internamiento_aaCountdownVencidoPorId', JSON.stringify(this._aaCountdownVencidoPorId));
        } catch (e) {}
    }

    getProximaInsulinaNRestante(internamiento) {
        const curva = internamiento?.curvaGlucosa && typeof internamiento.curvaGlucosa === 'object' ? internamiento.curvaGlucosa : {};
        const medicionesObj = curva.mediciones && typeof curva.mediciones === 'object' ? curva.mediciones : {};
        const conInsulinaN = Object.entries(medicionesObj)
            .map(([k, v]) => ({ ...v, id: v.id || k }))
            .filter(m => (m.tipoInsulina === 'N' || m.tipoInsulina === 'RN') && m.insulinaAplicada && m.fechaHora);
        if (conInsulinaN.length === 0) return null;
        const ultima = conInsulinaN.sort((a, b) => {
            const ta = a.fechaHora ? new Date(a.fechaHora).getTime() : 0;
            const tb = b.fechaHora ? new Date(b.fechaHora).getTime() : 0;
            return tb - ta;
        })[0];
        const aplicadaAt = new Date(ultima.fechaHora).getTime();
        if (isNaN(aplicadaAt)) return null;
        const doceHorasMs = 12 * 60 * 60 * 1000;
        const target = aplicadaAt + doceHorasMs;
        const now = Date.now();
        if (target <= now) {
            return { target: new Date(target), texto: 'Ahora', vencido: true };
        }
        const restanteMs = target - now;
        const horas = Math.floor(restanteMs / (1000 * 60 * 60));
        const minutos = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60));
        return { target: new Date(target), texto: `${horas}h ${minutos}m`, vencido: false, restanteMs };
    }

    getProximaTomaAlimentacionAsistidaRestante(internamiento) {
        const aa = internamiento?.alimentacionAsistida && typeof internamiento.alimentacionAsistida === 'object' ? internamiento.alimentacionAsistida : {};
        const dias = aa.dias && typeof aa.dias === 'object' ? aa.dias : {};
        const diasList = Object.entries(dias).sort((a, b) => (a[1].numero || 0) - (b[1].numero || 0));
        if (diasList.length === 0) return null;
        const lastDay = diasList[diasList.length - 1];
        const diaData = lastDay[1] || {};
        const freqTipo = diaData.frecuenciaTipo;
        const freqVal = diaData.frecuenciaValor;
        if (!freqTipo || (freqTipo !== 'minutos' && freqTipo !== 'horas') || !freqVal) return null;
        const freqNum = parseInt(freqVal, 10);
        if (!freqNum || isNaN(freqNum) || freqNum < 1) return null;
        const tomas = diaData.tomas && typeof diaData.tomas === 'object' ? diaData.tomas : {};
        const tomasList = Object.values(tomas).sort((a, b) => (a.horaRegistro || 0) - (b.horaRegistro || 0));
        if (tomasList.length === 0) return null;
        const ultimaToma = tomasList[tomasList.length - 1];
        const ultimaHora = ultimaToma.horaRegistro || 0;
        if (!ultimaHora) return null;
        const freqMs = freqTipo === 'horas'
            ? freqNum * 60 * 60 * 1000
            : freqNum * 60 * 1000;
        const target = ultimaHora + freqMs;
        const now = Date.now();
        if (target <= now) {
            return { target: new Date(target), texto: 'Ahora', vencido: true };
        }
        const restanteMs = target - now;
        const horas = Math.floor(restanteMs / (1000 * 60 * 60));
        const minutos = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60));
        return { target: new Date(target), texto: `${horas}h ${minutos}m`, vencido: false, restanteMs };
    }

    getProximaTomaRerRestante(internamiento) {
        const rer = internamiento?.rer && typeof internamiento.rer === 'object' ? internamiento.rer : {};
        const dias = rer.dias && typeof rer.dias === 'object' ? rer.dias : {};
        const diasList = Object.entries(dias).sort((a, b) => (a[1].numero || 0) - (b[1].numero || 0));
        if (diasList.length === 0) return null;
        const lastDay = diasList[diasList.length - 1];
        const tomas = lastDay[1].tomas && typeof lastDay[1].tomas === 'object' ? lastDay[1].tomas : {};
        const horasUsadas = new Set(Object.values(tomas).map(t => t.hora).filter(Boolean));
        const slots = [
            { hora: '8am', h: 8, label: '8:00 AM' },
            { hora: '12md', h: 12, label: '12:00 MD' },
            { hora: '4pm', h: 16, label: '4:00 PM' },
            { hora: '8pm', h: 20, label: '8:00 PM' },
            { hora: '12mn', h: 24, label: '12:00 MN' }
        ];
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        for (const slot of slots) {
            if (horasUsadas.has(slot.hora)) continue;
            let target = new Date(todayStart);
            if (slot.h === 24) {
                target.setDate(target.getDate() + 1);
                target.setHours(0, 0, 0, 0);
            } else {
                target.setHours(slot.h, 0, 0, 0);
            }
            if (target.getTime() <= now.getTime()) continue;
            const restanteMs = target.getTime() - now.getTime();
            const horas = Math.floor(restanteMs / (1000 * 60 * 60));
            const minutos = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60));
            return { label: slot.label, target, restanteMs, texto: `${horas}h ${minutos}m`, horas, minutos };
        }
        const primeraHoraManana = new Date(todayStart);
        primeraHoraManana.setDate(primeraHoraManana.getDate() + 1);
        primeraHoraManana.setHours(8, 0, 0, 0);
        const restanteMs = primeraHoraManana.getTime() - now.getTime();
        const horas = Math.floor(restanteMs / (1000 * 60 * 60));
        const minutos = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60));
        return { label: '8:00 AM (mañana)', target: primeraHoraManana, restanteMs, texto: `${horas}h ${minutos}m`, horas, minutos };
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

        // PRESIÓN ARTERIAL
        if (data.presionArterial) {
            const match = data.presionArterial.match(/(\d+)\/(\d+)/);
            if (match) {
                const sistolica = parseInt(match[1]);
                const diastolica = parseInt(match[2]);
                
                if (sistolica < 90 || diastolica < 50) {
                    alertas.push('presion_arterial_baja');
                } else if (sistolica > 180 || diastolica > 120) {
                    alertas.push('presion_arterial_alta');
                }
            }
        }

        // PO2 (Presión de Oxígeno)
        if (data.po2) {
            if (data.po2 < 80) {
                alertas.push('hipoxemia'); // Bajo nivel de oxígeno
            }
        }

        // Sin ingesta de agua
        if (!data.ingestaAgua) {
            alertas.push('sin_ingesta_agua');
        }

        // Sin apetito
        if (!data.apetito) {
            alertas.push('sin_apetito');
        }

        // DEFECACIÓN - Escala de Bristol
        if (data.defeco && data.bristolEscala) {
            if (data.bristolEscala === 1) {
                alertas.push('estrenimiento_severo');
            } else if (data.bristolEscala === 6) {
                alertas.push('diarrea_moderada');
            } else if (data.bristolEscala === 7) {
                alertas.push('diarrea_severa');
            }
        }

        // DEFECACIÓN - Escala de Bristol
        if (data.defecacion) {
            if (data.defecacion === 'tipo1') {
                alertas.push('estrenimiento_severo'); // Heces muy duras
            } else if (data.defecacion === 'tipo6') {
                alertas.push('diarrea_moderada'); // Líquidas con fragmentos
            } else if (data.defecacion === 'tipo7') {
                alertas.push('diarrea_severa'); // Completamente líquidas
            }
        }

        // MICCIÓN
        if (data.miccion) {
            // Alerta si hay sangre u orina oscura
            if (data.miccionColor === 'con_sangre') {
                alertas.push('hematuria');
            } else if (data.miccionColor === 'oscuro') {
                alertas.push('orina_oscura');
            }
            // Alerta si la frecuencia es anormal
            if (data.miccionFrecuencia === 'ausente') {
                alertas.push('anuria'); // No orina - emergencia
            } else if (data.miccionFrecuencia === 'disminuida') {
                alertas.push('oliguria'); // Orina poco
            }
        }

        // Vómitos
        if (data.vomitos) {
            alertas.push('vomitos');
        }

        return alertas;
    }

    // ================================================================
    // PLAN DE MEDICACIÓN
    // ================================================================
    
    showMedicacionView() {
        if (!this.currentInternamientoId) {
            alert('Error: No hay internamiento seleccionado');
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
        const suspendidos = medicamentos.filter(m => m.estadoMedicamento === 'suspendido');

        if (activos.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 60px 30px;">
                    <i class="fas fa-pills" style="font-size: 64px;"></i>
                    <p style="font-size: 1.1rem;">No hay medicamentos activos</p>
                    <button class="btn btn-primary" onclick="window.internamientoModule.showAgregarMedicamentoForm()">
                        <i class="fas fa-plus"></i> Agregar Medicamento
                    </button>
                </div>
            `;
            return;
        }

        const viaIcons = {
            'IV': { icon: 'fa-syringe', color: '#f44336', label: 'Intravenosa' },
            'IM': { icon: 'fa-syringe', color: '#ff9800', label: 'Intramuscular' },
            'SC': { icon: 'fa-syringe', color: '#4caf50', label: 'Subcutánea' },
            'VO': { icon: 'fa-capsules', color: '#5c6bc0', label: 'Vía Oral' },
            'Topica': { icon: 'fa-hand-holding-medical', color: '#7e57c2', label: 'Tópica' },
            'Otra': { icon: 'fa-prescription-bottle', color: '#757575', label: 'Otra' }
        };

        container.innerHTML = `
            <div style="margin-bottom: 30px;">
                <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px;">
                    <div style="width: 46px; height: 46px; background: linear-gradient(135deg, #26a69a, #00897b); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-pills" style="color: white; font-size: 1.2rem;"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0; color: #333; font-size: 1.2rem;">Medicamentos Activos</h3>
                        <p style="margin: 4px 0 0 0; color: #666; font-size: 0.9rem;">${activos.length} medicamento${activos.length !== 1 ? 's' : ''} en tratamiento</p>
                    </div>
                </div>
                
                <!-- Grid de medicamentos -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 18px;">
                    ${activos.map(med => {
                        const via = viaIcons[med.viaAdministracion] || viaIcons.Otra;
                        const proximaDosis = this.calcularProximaDosis(med);
                        const esAhora = proximaDosis.includes('AHORA');
                        const puedeAdministrar = this.puedeAdministrarAhora(med);
                        const admins = Object.values(med.administraciones || {});
                        const ultimaAdmin = admins.filter(a => a.estado === 'administrado').sort((a, b) => (b.fechaHoraReal || 0) - (a.fechaHoraReal || 0))[0];
                        const ultimaAdminNombre = ultimaAdmin ? (ultimaAdmin.administradoNombre || '—') : null;
                        const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
                        
                        return `
                            <div style="background: white; border: 1px solid ${esAhora ? '#f44336' : '#e0e0e0'}; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.3s ease; ${esAhora ? 'animation: pulse-critico 2s ease-in-out infinite;' : ''}" onmouseenter="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)';" onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)';">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <div style="width: 44px; height: 44px; background: ${via.color}15; border: 1px solid ${via.color}30; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                                            <i class="fas ${via.icon}" style="color: ${via.color}; font-size: 1.1rem;"></i>
                                        </div>
                                        <div>
                                            <h4 style="margin: 0; color: #333; font-size: 1rem; font-weight: 600;">${med.nombreComercial || 'Sin nombre'}</h4>
                                            <span style="font-size: 0.85rem; color: ${via.color};">${via.label}</span>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 6px;">
                                        <button class="btn btn-sm" style="background: #6c757d; color: white; padding: 8px 12px;" onclick="window.internamientoModule.mostrarHistorialMedicamentoPanel('${med.medicamentoId}')" title="Historial de cambios">
                                            <i class="fas fa-history"></i>
                                        </button>
                                        <button class="btn btn-sm" style="background: #0ea5e9; color: white; padding: 8px 12px;" onclick="window.internamientoModule.showEditarMedicamentoForm('${med.medicamentoId}')" title="Editar">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        ${med.puestoPorConsultaExterna
                                            ? `<button class="btn btn-sm" disabled title="No se puede administrar dosis: medicamento puesto por consulta externa" style="padding: 8px 12px; background: #9ca3af; color: #fff; cursor: not-allowed; opacity: 0.8;"><i class="fas fa-syringe"></i></button>`
                                            : puedeAdministrar
                                                ? `<button class="btn btn-sm btn-success" onclick="window.internamientoModule.administrarMedicamento('${med.medicamentoId}')" title="Administrar dosis" style="padding: 8px 12px;"><i class="fas fa-syringe"></i></button>`
                                                : `<button class="btn btn-sm" disabled title="Solo se puede administrar cuando el contador llegue a cero (próxima dosis correspondiente)" style="padding: 8px 12px; background: #9ca3af; color: #fff; cursor: not-allowed; opacity: 0.8;"><i class="fas fa-syringe"></i></button>`
                                        }
                                        <button class="btn btn-sm btn-warning" onclick="window.internamientoModule.suspenderMedicamento('${med.medicamentoId}')" title="Suspender" style="padding: 8px 12px;">
                                            <i class="fas fa-pause"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 14px;">
                                    <div style="background: #f8f9fa; border-radius: 8px; padding: 12px;">
                                        <span style="display: block; font-size: 0.75rem; color: #888; text-transform: uppercase; margin-bottom: 3px;">Dosis</span>
                                        <span style="font-size: 0.95rem; font-weight: 600; color: #333;">${this.formatDosisUnidad(med)}</span>
                                    </div>
                                    <div style="background: #f8f9fa; border-radius: 8px; padding: 12px;">
                                        <span style="display: block; font-size: 0.75rem; color: #888; text-transform: uppercase; margin-bottom: 3px;">Vía</span>
                                        <span style="font-size: 0.95rem; font-weight: 600; color: #333;">${via.label}</span>
                                    </div>
                                    <div style="background: #f8f9fa; border-radius: 8px; padding: 12px;">
                                        <span style="display: block; font-size: 0.75rem; color: #888; text-transform: uppercase; margin-bottom: 3px;">Frecuencia</span>
                                        <span style="font-size: 0.95rem; font-weight: 600; color: #333;">${med.frecuenciaHoras ? 'Cada ' + med.frecuenciaHoras + 'h' : '--'}</span>
                                    </div>
                                    <div style="background: #f8f9fa; border-radius: 8px; padding: 12px;">
                                        <span style="display: block; font-size: 0.75rem; color: #888; text-transform: uppercase; margin-bottom: 3px;">Horas exactas</span>
                                        <span style="font-size: 0.9rem; font-weight: 600; color: #333;">${(med.horariosExactos && med.horariosExactos.length) ? med.horariosExactos.join(', ') : (med.horariosCalculados && med.horariosCalculados.length) ? med.horariosCalculados.join(', ') : '--'}</span>
                                    </div>
                                </div>
                                ${med.observaciones ? `
                                <div style="background: #f0f9ff; border-left: 3px solid #0ea5e9; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px;">
                                    <span style="display: block; font-size: 0.75rem; color: #0c4a6e; text-transform: uppercase; margin-bottom: 4px;">Observaciones</span>
                                    <span style="font-size: 0.9rem; color: #334155;">${med.observaciones}</span>
                                </div>
                                ` : ''}
                                ${med.puestoPorConsultaExterna ? `
                                <div style="background: #ecfdf5; border-left: 3px solid #0d9488; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px;">
                                    <span style="font-size: 0.8rem; color: #0f766e; font-weight: 600;">
                                        <i class="fas fa-stethoscope" style="margin-right: 6px;"></i>Puesto por consulta externa
                                    </span>
                                </div>
                                ` : ''}
                                ${med.pedidoPermisoEmergencia && med.encargadaContactada ? `
                                <div style="background: #fef3c7; border-left: 3px solid #d97706; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px;">
                                    <span style="font-size: 0.8rem; color: #92400e; font-weight: 600;">
                                        <i class="fas fa-phone-alt" style="margin-right: 6px;"></i>Permiso de emergencia — Contactada: ${esc(med.encargadaContactada)}
                                    </span>
                                </div>
                                ` : ''}
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding-top: 14px; border-top: 1px solid #e8e8e8;">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <span style="font-size: 0.85rem; color: #666;">
                                            <i class="fas fa-user-md" style="margin-right: 6px; color: #5c6bc0;"></i>
                                            Prescrito: ${esc(med.prescritoNombre) || 'N/A'}
                                        </span>
                                        ${ultimaAdminNombre ? `
                                        <span style="font-size: 0.85rem; color: #2e7d32; font-weight: 600;">
                                            <i class="fas fa-user-nurse" style="margin-right: 6px; color: #2e7d32;"></i>
                                            Última dosis por: ${esc(ultimaAdminNombre)}
                                        </span>
                                        ` : ''}
                                        ${med.editadoNombre ? `
                                        <span style="font-size: 0.8rem; color: #5c6bc0;">
                                            <i class="fas fa-edit" style="margin-right: 4px;"></i>
                                            Última edición: ${esc(med.editadoNombre)}${med.motivoUltimoCambio ? ' — ' + esc(med.motivoUltimoCambio) : ''}
                                        </span>
                                        ` : ''}
                                        <button type="button" class="btn btn-sm" style="margin-top: 8px; font-size: 0.8rem; background: transparent; color: #0ea5e9; border: 1px solid #0ea5e9; padding: 4px 10px;" onclick="window.internamientoModule.mostrarHistorialAdministracionesMedicamento('${med.medicamentoId}')" title="Ver todas las administraciones">
                                            <i class="fas fa-history" style="margin-right: 4px;"></i>Ver administraciones
                                        </button>
                                    </div>
                                    <span style="font-size: 0.85rem; font-weight: 600; color: ${esAhora ? '#f44336' : '#4caf50'}; background: ${esAhora ? '#ffebee' : '#e8f5e9'}; padding: 5px 12px; border-radius: 15px;">
                                        <i class="fas fa-clock" style="margin-right: 4px;"></i>
                                        ${proximaDosis}
                                    </span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            ${suspendidos.length > 0 ? `
                <div style="margin-top: 36px; padding: 24px; background: #fafafa; border: 1px solid #e8e8e8; border-radius: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 18px;">
                        <div style="width: 44px; height: 44px; background: #fff3e0; border: 1px solid #ffcc80; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-pause-circle" style="color: #e65100; font-size: 1.2rem;"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; color: #5d4037; font-size: 1.1rem;">Medicamentos suspendidos</h3>
                            <p style="margin: 4px 0 0 0; color: #8d6e63; font-size: 0.9rem;">${suspendidos.length} medicamento${suspendidos.length !== 1 ? 's' : ''} suspendido${suspendidos.length !== 1 ? 's' : ''} (solo consulta, no editable)</p>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
                        ${suspendidos.map(med => {
                            const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
                            const fechaFinStr = med.fechaFin ? (() => { const d = new Date(med.fechaFin); return isNaN(d.getTime()) ? '' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }); })() : '';
                            return `
                            <div style="background: white; border: 1px solid #e0e0e0; border-radius: 10px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                                <div style="font-weight: 600; color: #424242; font-size: 1rem; margin-bottom: 10px;">${esc(med.nombreComercial || 'Sin nombre')}</div>
                                <div style="display: flex; flex-direction: column; gap: 6px;">
                                    ${med.suspendidoNombre ? `<div style="font-size: 0.9rem; color: #555;"><i class="fas fa-user-nurse" style="margin-right: 6px; color: #78909c;"></i><strong>Suspendido por:</strong> ${esc(med.suspendidoNombre)}</div>` : ''}
                                    ${med.motivoSuspension ? `<div style="font-size: 0.9rem; color: #555;"><i class="fas fa-comment-alt" style="margin-right: 6px; color: #f39c12;"></i><strong>Motivo:</strong> ${esc(med.motivoSuspension)}</div>` : ''}
                                    ${fechaFinStr ? `<div style="font-size: 0.85rem; color: #888;"><i class="fas fa-calendar-times" style="margin-right: 6px;"></i>${fechaFinStr}</div>` : ''}
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    renderMedicamentoRow(medicamento) {
        // Este método ya no se usa directamente, pero lo mantenemos por compatibilidad
        const proximaDosis = this.calcularProximaDosis(medicamento);
        const puedeAdministrar = this.puedeAdministrarAhora(medicamento);
        const viaLabels = {
            'IV': 'Intravenosa',
            'IM': 'Intramuscular',
            'SC': 'Subcutánea',
            'VO': 'Vía Oral',
            'Topica': 'Tópica',
            'Otra': 'Otra'
        };

        const horariosStr = (medicamento.horariosExactos && medicamento.horariosExactos.length) ? medicamento.horariosExactos.join(', ') : (medicamento.horariosCalculados && medicamento.horariosCalculados.length) ? medicamento.horariosCalculados.join(', ') : (medicamento.frecuenciaHoras ? 'Cada ' + medicamento.frecuenciaHoras + 'h' : '--');
        return `
            <tr>
                <td>
                    <strong>${medicamento.nombreComercial || 'Sin nombre'}</strong>
                    ${medicamento.observaciones ? `<div style="font-size: 0.8rem; color: #666; margin-top: 2px;"><i class="fas fa-comment"></i> ${medicamento.observaciones}</div>` : ''}
                </td>
                <td>${this.formatDosisUnidad(medicamento)}</td>
                <td>${viaLabels[medicamento.viaAdministracion] || medicamento.viaAdministracion}</td>
                <td>${horariosStr}</td>
                <td>${proximaDosis}</td>
                <td>
                    ${medicamento.puestoPorConsultaExterna
                        ? `<button class="btn btn-sm" disabled title="No se puede administrar: puesto por consulta externa" style="background: #9ca3af; color: #fff; cursor: not-allowed;"><i class="fas fa-syringe"></i></button>`
                        : puedeAdministrar
                            ? `<button class="btn btn-sm btn-success" onclick="window.internamientoModule.administrarMedicamento('${medicamento.medicamentoId}')" title="Administrar"><i class="fas fa-syringe"></i></button>`
                            : `<button class="btn btn-sm" disabled title="Solo cuando el contador llegue a cero" style="background: #9ca3af; color: #fff; cursor: not-allowed;"><i class="fas fa-syringe"></i></button>`
                    }
                    <button class="btn btn-sm btn-warning" onclick="window.internamientoModule.suspenderMedicamento('${medicamento.medicamentoId}')" title="Suspender">
                        <i class="fas fa-pause"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    /** Formato cantidad + unidad de medida para mostrar en listas y tarjetas. */
    formatDosisUnidad(med) {
        const cant = med && (med.dosisCalculada || med.dosis);
        const unidad = med && med.unidadMedida ? String(med.unidadMedida).trim() : '';
        if (!cant && !unidad) return '--';
        return unidad ? `${cant || '--'} ${unidad}` : (cant || '--');
    }

    /**
     * Obtiene la próxima hora de dosis según horarios (HH:mm) o frecuencia, para hoy/mañana.
     * Usado cuando no hay administraciones (ej. consulta externa) para mostrar el contador.
     */
    obtenerProximaHoraDesdeFrecuencia(medicamento) {
        const ahora = new Date();
        const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        let horarios = (medicamento.horariosExactos && medicamento.horariosExactos.length > 0)
            ? medicamento.horariosExactos
            : (medicamento.horariosCalculados && medicamento.horariosCalculados.length > 0)
                ? medicamento.horariosCalculados
                : [];
        if (horarios.length === 0 && medicamento.frecuenciaHoras) {
            horarios = this.calcularHorarios(medicamento.frecuenciaHoras);
        }
        if (horarios.length === 0) return null;

        const candidatos = [];
        for (let dia = 0; dia <= 1; dia++) {
            const base = new Date(hoy);
            base.setDate(base.getDate() + dia);
            for (const slot of horarios) {
                const part = String(slot).trim().match(/^(\d{1,2}):(\d{2})$/);
                if (!part) continue;
                const h = parseInt(part[1], 10);
                const m = parseInt(part[2], 10);
                const d = new Date(base);
                d.setHours(h, m, 0, 0);
                candidatos.push(d.getTime());
            }
        }
        const ahoraMs = ahora.getTime();
        const proxima = candidatos.filter(t => t >= ahoraMs).sort((a, b) => a - b)[0]
            || candidatos.sort((a, b) => a - b)[0]; // si todos pasaron, siguiente día
        return proxima != null ? new Date(proxima) : null;
    }

    calcularProximaDosis(medicamento) {
        const administraciones = Object.values(medicamento.administraciones || {});
        const ahora = new Date();

        if (administraciones.length === 0) {
            // Consulta externa: mostrar contador según frecuencia/horarios, sin "primera dosis pendiente"
            if (medicamento.puestoPorConsultaExterna) {
                const proximaHora = this.obtenerProximaHoraDesdeFrecuencia(medicamento);
                if (!proximaHora) return 'Según consulta externa';
                if (proximaHora <= ahora) {
                    return `<span style="color: #e74c3c; font-weight: bold;">AHORA</span>`;
                }
                const diff = proximaHora - ahora;
                const horas = Math.floor(diff / (1000 * 60 * 60));
                const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                return `En ${horas}h ${minutos}m`;
            }
            return 'Pendiente primera dosis';
        }

        const ultima = administraciones
            .filter(a => a.estado === 'administrado')
            .sort((a, b) => b.fechaHoraReal - a.fechaHoraReal)[0];

        if (!ultima) {
            if (medicamento.puestoPorConsultaExterna) {
                const proximaHora = this.obtenerProximaHoraDesdeFrecuencia(medicamento);
                if (!proximaHora) return 'Según consulta externa';
                if (proximaHora <= ahora) return `<span style="color: #e74c3c; font-weight: bold;">AHORA</span>`;
                const diff = proximaHora - ahora;
                const horas = Math.floor(diff / (1000 * 60 * 60));
                const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                return `En ${horas}h ${minutos}m`;
            }
            return 'Pendiente primera dosis';
        }

        const frecuenciaMs = medicamento.frecuenciaHoras * 60 * 60 * 1000;
        const proximaHora = new Date(ultima.fechaHoraReal + frecuenciaMs);

        if (proximaHora <= ahora) {
            return `<span style="color: #e74c3c; font-weight: bold;">AHORA</span>`;
        }

        const diff = proximaHora - ahora;
        const horas = Math.floor(diff / (1000 * 60 * 60));
        const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return `En ${horas}h ${minutos}m`;
    }

    /** Indica si se puede administrar una dosis ahora (contador en cero o primera dosis pendiente). */
    puedeAdministrarAhora(medicamento) {
        if (!medicamento) return false;
        const texto = this.calcularProximaDosis(medicamento);
        return texto.includes('AHORA') || texto.includes('Pendiente primera dosis');
    }

    showAgregarMedicamentoForm(desdeAdmision = false) {
        this.agregarMedicamentoContexto = desdeAdmision ? 'admision' : 'internamiento';
        const modal = this.createModal('Agregar Medicamento', this.getAgregarMedicamentoFormHTML(), 'fa-pills');
        document.body.appendChild(modal);
        const form = document.getElementById('formAgregarMedicamento');
        if (form) {
            form.onsubmit = (e) => this.handleAgregarMedicamento(e);
        }
        const freqInput = document.getElementById('medFrecuencia');
        if (freqInput) freqInput.addEventListener('input', () => this.actualizarAdvertenciaCoherenciaHorariosForm());
    }

    agregarHoraExactaAlForm() {
        const selH = document.getElementById('medHoraExactaH');
        const selM = document.getElementById('medHoraExactaM');
        const selAmpm = document.getElementById('medHoraExactaAmpm');
        const hidden = document.getElementById('medHorasExactas');
        const lista = document.getElementById('medHorasExactasLista');
        if (!selH || !selM || !selAmpm || !hidden || !lista) return;
        let h24 = parseInt(selH.value, 10) || 1;
        const ampm = selAmpm.value || 'AM';
        if (ampm === 'PM' && h24 !== 12) h24 += 12;
        if (ampm === 'AM' && h24 === 12) h24 = 0;
        const m = String(selM.value || '00').padStart(2, '0');
        const hora = String(h24).padStart(2, '0') + ':' + m;
        const actuales = (hidden.value || '').split(',').map(x => x.trim()).filter(Boolean);
        if (actuales.includes(hora)) return;
        actuales.push(hora);
        actuales.sort();
        hidden.value = actuales.join(',');
        const displayHora = (typeof window.formatTime12Hour === 'function') ? window.formatTime12Hour(hora) : hora;
        const span = document.createElement('span');
        span.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; background: #0ea5e9; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.9rem;';
        span.innerHTML = `${displayHora} <button type="button" onclick="window.internamientoModule.quitarHoraExactaDelForm('${hora}')" style="background: transparent; border: none; color: white; cursor: pointer; padding: 0 2px;">&times;</button>`;
        lista.appendChild(span);
        selH.value = '1';
        selM.value = '00';
        selAmpm.value = 'AM';
        this.actualizarAdvertenciaCoherenciaHorariosForm();
    }

    quitarHoraExactaDelForm(hora) {
        const hidden = document.getElementById('medHorasExactas');
        const lista = document.getElementById('medHorasExactasLista');
        if (!hidden || !lista) return;
        const actuales = (hidden.value || '').split(',').map(h => h.trim()).filter(Boolean).filter(h => h !== hora);
        hidden.value = actuales.join(',');
        lista.innerHTML = '';
        actuales.forEach(h => {
            const span = document.createElement('span');
            span.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; background: #0ea5e9; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.9rem;';
            span.innerHTML = `${h} <button type="button" onclick="window.internamientoModule.quitarHoraExactaDelForm('${h}')" style="background: transparent; border: none; color: white; cursor: pointer; padding: 0 2px;">&times;</button>`;
            lista.appendChild(span);
        });
        this.actualizarAdvertenciaCoherenciaHorariosForm();
    }

    /** Muestra u oculta la advertencia de coherencia entre frecuencia y horas exactas en el formulario de medicamento. */
    actualizarAdvertenciaCoherenciaHorariosForm() {
        const box = document.getElementById('medAdvertenciaCoherenciaHorarios');
        const texto = document.getElementById('medAdvertenciaCoherenciaTexto');
        if (!box || !texto) return;
        const frecuenciaVal = parseInt(document.getElementById('medFrecuencia')?.value, 10) || 0;
        const rawHoras = document.getElementById('medHorasExactas')?.value?.trim() || '';
        const horariosExactos = this.parsearHorasExactas(rawHoras);
        if (!frecuenciaVal || horariosExactos.length === 0) {
            box.style.display = 'none';
            return;
        }
        const coherencia = this.validarCoherenciaFrecuenciaYHorasExactas(frecuenciaVal, horariosExactos);
        if (coherencia.valido) {
            box.style.display = 'none';
            return;
        }
        texto.textContent = coherencia.mensaje || 'Las horas exactas deben estar separadas según la frecuencia indicada.';
        box.style.display = 'block';
    }

    getAgregarMedicamentoFormHTML(medParaEditar = null) {
        const esEdicion = !!medParaEditar;
        const v = (x) => (x != null && x !== undefined ? String(x).replace(/"/g, '&quot;').replace(/</g, '&lt;') : '');
        const horasInicial = esEdicion && ((medParaEditar.horariosExactos && medParaEditar.horariosExactos.length) || (medParaEditar.horariosCalculados && medParaEditar.horariosCalculados.length))
            ? ((medParaEditar.horariosExactos && medParaEditar.horariosExactos.length) ? medParaEditar.horariosExactos : medParaEditar.horariosCalculados || []).join(',')
            : '';
        return `
            <form id="formAgregarMedicamento">
                ${esEdicion ? `<input type="hidden" id="medEditId" value="${v(medParaEditar.medicamentoId)}">` : ''}
                <div class="form-group">
                    <label><i class="fas fa-pills" style="color: #14b8a6; margin-right: 6px;"></i>Nombre del Medicamento *</label>
                    <input type="text" id="medNombreComercial" required placeholder="Ej: Convenia, Meloxicam, etc." value="${esEdicion ? v(medParaEditar.nombreComercial) : ''}">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label><i class="fas fa-prescription" style="color: #8b5cf6; margin-right: 6px;"></i>Cantidad (dosis) *</label>
                        <input type="text" id="medDosis" required placeholder="Ej: 100" value="${esEdicion ? v(medParaEditar.dosis) : ''}">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-weight" style="color: #8b5cf6; margin-right: 6px;"></i>Unidad de medida</label>
                        <select id="medUnidadMedida" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid #ddd;">
                            <option value="">—</option>
                            <option value="mg" ${esEdicion && medParaEditar.unidadMedida === 'mg' ? 'selected' : ''}>mg</option>
                            <option value="ml" ${esEdicion && medParaEditar.unidadMedida === 'ml' ? 'selected' : ''}>ml</option>
                            <option value="g" ${esEdicion && medParaEditar.unidadMedida === 'g' ? 'selected' : ''}>g</option>
                            <option value="UI" ${esEdicion && medParaEditar.unidadMedida === 'UI' ? 'selected' : ''}>UI</option>
                            <option value="mcg" ${esEdicion && medParaEditar.unidadMedida === 'mcg' ? 'selected' : ''}>mcg</option>
                            <option value="mg/kg" ${esEdicion && medParaEditar.unidadMedida === 'mg/kg' ? 'selected' : ''}>mg/kg</option>
                            <option value="ml/kg" ${esEdicion && medParaEditar.unidadMedida === 'ml/kg' ? 'selected' : ''}>ml/kg</option>
                            <option value="gotas" ${esEdicion && medParaEditar.unidadMedida === 'gotas' ? 'selected' : ''}>gotas</option>
                            <option value="%" ${esEdicion && medParaEditar.unidadMedida === '%' ? 'selected' : ''}>%</option>
                            <option value="L" ${esEdicion && medParaEditar.unidadMedida === 'L' ? 'selected' : ''}>L</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-clock" style="color: #f59e0b; margin-right: 6px;"></i>Frecuencia (cada X horas)</label>
                    <input type="number" id="medFrecuencia" min="1" placeholder="Ej: 8" value="${esEdicion && medParaEditar.frecuenciaHoras != null ? medParaEditar.frecuenciaHoras : ''}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-list-ol" style="color: #0ea5e9; margin-right: 6px;"></i>Horas exactas (opcional)</label>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: nowrap;">
                        <span style="display: inline-flex; align-items: center; gap: 4px;">
                            <select id="medHoraExactaH" title="Hora (1-12)" style="min-width: 52px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                                ${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<option value="${n}">${n}</option>`).join('')}
                            </select>
                            <span style="font-weight: bold;">:</span>
                            <select id="medHoraExactaM" title="Minuto" style="min-width: 52px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                                ${Array.from({ length: 60 }, (_, i) => `<option value="${String(i).padStart(2, '0')}">${String(i).padStart(2, '0')}</option>`).join('')}
                            </select>
                            <select id="medHoraExactaAmpm" title="AM/PM" style="min-width: 58px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                            </select>
                        </span>
                        <button type="button" class="btn btn-secondary" onclick="window.internamientoModule.agregarHoraExactaAlForm()"><i class="fas fa-plus"></i> Agregar hora</button>
                    </div>
                    <input type="hidden" id="medHorasExactas" value="${esEdicion ? v(horasInicial) : ''}">
                    <div id="medHorasExactasLista" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; min-height: 24px;"></div>
                    <small style="color: #6c757d; font-size: 0.8rem;">Hora (AM/PM)</small>
                    <div id="medAdvertenciaCoherenciaHorarios" style="display: none; margin-top: 10px; padding: 10px 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #b91c1c; font-size: 0.9rem;">
                        <i class="fas fa-exclamation-triangle" style="margin-right: 6px;"></i><span id="medAdvertenciaCoherenciaTexto"></span>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-syringe" style="color: #ef4444; margin-right: 6px;"></i>Vía de Administración *</label>
                    <select id="medVia" required>
                        <option value="">Seleccionar vía...</option>
                        <option value="IV" ${esEdicion && medParaEditar.viaAdministracion === 'IV' ? 'selected' : ''}>💉 Intravenosa (IV)</option>
                        <option value="IM" ${esEdicion && medParaEditar.viaAdministracion === 'IM' ? 'selected' : ''}>💉 Intramuscular (IM)</option>
                        <option value="SC" ${esEdicion && medParaEditar.viaAdministracion === 'SC' ? 'selected' : ''}>💉 Subcutánea (SC)</option>
                        <option value="VO" ${esEdicion && medParaEditar.viaAdministracion === 'VO' ? 'selected' : ''}>💊 Vía Oral (VO)</option>
                        <option value="Topica" ${esEdicion && medParaEditar.viaAdministracion === 'Topica' ? 'selected' : ''}>🧴 Tópica</option>
                        <option value="Otra" ${esEdicion && medParaEditar.viaAdministracion === 'Otra' ? 'selected' : ''}>📋 Otra</option>
                    </select>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-comment-medical" style="color: #6366f1; margin-right: 6px;"></i>Observaciones</label>
                    <textarea id="medObservaciones" rows="2" placeholder="Ej: Administrar lentamente, con alimento, etc.">${esEdicion ? v(medParaEditar.observaciones || '') : ''}</textarea>
                </div>
                ${(!esEdicion && this.agregarMedicamentoContexto === 'admision') ? `
                <div class="form-group" style="margin-top: 12px; padding: 10px 12px; background: #ecfdf5; border-radius: 8px; border: 1px solid #0d9488;">
                    <input type="hidden" id="medPuestoPorConsultaExterna" value="true">
                    <span style="color: #0f766e; font-weight: 500;"><i class="fas fa-stethoscope" style="margin-right: 6px;"></i>Puesto por consulta externa</span>
                    <small style="display: block; color: #0f766e; font-size: 0.8rem; margin-top: 4px;">Siempre indicado por consulta externa. No editable.</small>
                </div>
                ` : (esEdicion && medParaEditar.puestoPorConsultaExterna) ? `
                <div class="form-group" style="margin-top: 12px; padding: 10px 12px; background: #ecfdf5; border-radius: 8px; border: 1px solid #0d9488;">
                    <input type="hidden" id="medPuestoPorConsultaExterna" value="true">
                    <span style="color: #0f766e; font-weight: 500;"><i class="fas fa-stethoscope" style="margin-right: 6px;"></i>Puesto por consulta externa</span>
                    <small style="display: block; color: #0f766e; font-size: 0.8rem; margin-top: 4px;">Este medicamento fue agregado en admisión por consulta externa y no puede modificarse esta opción.</small>
                </div>
                ` : ''}
                ${(!esEdicion && this.agregarMedicamentoContexto !== 'admision') ? `
                <div class="form-group" style="margin-top: 16px; padding: 14px; background: #fef3c7; border-radius: 8px; border: 1px solid #f59e0b;">
                    <div style="margin-bottom: 12px; padding: 10px 12px; background: #fff7ed; border-left: 4px solid #ea580c; border-radius: 6px;">
                        <p style="margin: 0; font-size: 0.9rem; color: #9a3412; line-height: 1.4;">
                            <i class="fas fa-exclamation-triangle" style="margin-right: 8px; color: #ea580c;"></i>
                            <strong>Advertencia:</strong> Solo los doctores pueden agregar medicamentos al plan de medicación. Si usted es técnico, da fé de que está ingresando este medicamento por motivo de emergencia y que contactó a Alejandra Cardona antes de administrarlo.
                        </p>
                    </div>
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 500;">
                        <input type="checkbox" id="medPedidoPermisoEmergencia" style="width: 18px; height: 18px;">
                        <i class="fas fa-phone-alt" style="color: #d97706;"></i>
                        Tuvo que pedir permiso vía llamada o mensaje para poner un medicamento de emergencia (contacté a Alejandra Cardona)
                    </label>
                </div>
                ` : ''}
                <div style="display: flex; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                    <button type="button" class="btn btn-secondary" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="submit" class="btn btn-success" style="flex: 2;" id="btnSubmitMedicamento">
                        <i class="fas fa-${esEdicion ? 'save' : 'plus'}"></i> ${esEdicion ? 'Guardar cambios' : 'Agregar Medicamento'}
                    </button>
                </div>
            </form>
        `;
    }

    /** Abre solo el historial de ediciones del medicamento (panel). No activa modo edición desde desplegable. */
    mostrarHistorialMedicamentoPanel(medicamentoId) {
        if (!this.currentInternamientoId) return;
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        const med = internamiento?.planTerapeutico?.medicamentos?.[medicamentoId];
        if (!med) {
            this.showAlert('Medicamento no encontrado', 'Error', 'error');
            return;
        }
        this._edicionMedicamentoInternamientoId = null;
        this.mostrarVistaHistorialEdicionesMedicamento(medicamentoId, med, this.currentInternamientoId);
    }

    async showEditarMedicamentoForm(medicamentoId, internamientoIdOverride) {
        const idInternamiento = internamientoIdOverride || this.currentInternamientoId;
        if (idInternamiento) this._edicionMedicamentoInternamientoId = internamientoIdOverride || null;
        const internamiento = this.internamientos.get(idInternamiento);
        if (!internamiento) {
            this._edicionMedicamentoInternamientoId = null;
            return;
        }
        const med = internamiento.planTerapeutico?.medicamentos?.[medicamentoId];
        if (!med) {
            this.showAlert('Medicamento no encontrado', 'Error', 'error');
            this._edicionMedicamentoInternamientoId = null;
            return;
        }
        if (med.estadoMedicamento === 'suspendido') {
            this.showAlert('No se puede editar un medicamento suspendido. Los suspendidos son solo de consulta.', 'Acción bloqueada', 'warning');
            this._edicionMedicamentoInternamientoId = null;
            return;
        }
        if (internamiento.estado?.actual === 'egresado' || internamiento.estado?.actual === 'alta') {
            this.showAlert('No se puede editar medicación en un internamiento egresado.', 'Acción bloqueada', 'warning');
            this._edicionMedicamentoInternamientoId = null;
            return;
        }
        this.mostrarVistaHistorialEdicionesMedicamento(medicamentoId, med, idInternamiento);
    }

    /** Vista aparte: historial de ediciones del medicamento. Desde aquí se puede iniciar una nueva edición. */
    mostrarVistaHistorialEdicionesMedicamento(medicamentoId, med, idInternamiento) {
        const historial = med.historialEdiciones || [];
        const filas = [];
        const showDatosAnteriores = historial.some(e => e.datosAnteriores);
        if (historial.length > 0) {
            historial.forEach((entry, idx) => {
                const fecha = entry.fecha || entry.timestamp;
                const fechaStr = fecha ? new Date(fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
                const nombre = (entry.editadoNombre || entry.usuarioNombre || '—').replace(/</g, '&lt;');
                const motivo = (entry.motivoCambio || '—').replace(/</g, '&lt;');
                let datosAnt = '—';
                if (entry.datosAnteriores) {
                    const d = entry.datosAnteriores;
                    const parts = [];
                    if (d.nombreComercial) parts.push('Nombre: ' + String(d.nombreComercial).replace(/</g, '&lt;'));
                    if (d.dosis != null) parts.push('Dosis: ' + String(d.dosis).replace(/</g, '&lt;'));
                    if (d.viaAdministracion) parts.push('Vía: ' + String(d.viaAdministracion).replace(/</g, '&lt;'));
                    if (d.frecuenciaHoras) parts.push('Cada ' + d.frecuenciaHoras + 'h');
                    datosAnt = parts.length ? parts.join(' · ') : '—';
                }
                filas.push(`
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${fechaStr}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${nombre}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${motivo}</td>
                        ${showDatosAnteriores ? `<td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 0.85rem; color: #555;">${datosAnt}</td>` : ''}
                    </tr>
                `);
            });
        } else if (med.editadoNombre || med.motivoUltimoCambio) {
            const fechaStr = med.fechaUltimaEdicion ? new Date(med.fechaUltimaEdicion).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
            filas.push(`
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${fechaStr}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${(med.editadoNombre || '—').replace(/</g, '&lt;')}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${(med.motivoUltimoCambio || '—').replace(/</g, '&lt;')}</td>
                </tr>
            `);
        }
        const nombreMed = (med.nombreComercial || 'Medicamento').replace(/</g, '&lt;');
        const thDatosAnt = showDatosAnteriores ? '<th style="padding: 10px; text-align: left;">Lo que estaba en ese momento</th>' : '';
        const html = `
            <div style="padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <h3 style="margin: 0 0 8px 0; color: #333;"><i class="fas fa-history" style="color: #5c6bc0;"></i> Historial de ediciones</h3>
                    <p style="margin: 0; color: #666; font-size: 0.95rem;"><strong>${nombreMed}</strong></p>
                </div>
                ${filas.length > 0 ? `
                <div style="overflow-x: auto; margin-bottom: 24px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: #f5f5f5;">
                                <th style="padding: 10px; text-align: left;">Fecha</th>
                                <th style="padding: 10px; text-align: left;">Editado por</th>
                                <th style="padding: 10px; text-align: left;">Motivo del cambio</th>
                                ${thDatosAnt}
                            </tr>
                        </thead>
                        <tbody>${filas.join('')}</tbody>
                    </table>
                </div>
                ` : `
                <p style="color: #888; margin-bottom: 24px;"><i class="fas fa-info-circle"></i> Aún no hay ediciones registradas para este medicamento.</p>
                `}
                <div style="display: flex; gap: 12px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #e0e0e0;">
                    <button type="button" class="btn btn-secondary" onclick="window.internamientoModule._cerrarModalHistorialMedicamento(); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                    <button type="button" class="btn btn-primary" data-medicamento-id="${(medicamentoId || '').replace(/"/g, '&quot;')}" onclick="window.internamientoModule.iniciarEdicionMedicamentoDesdeHistorial(this.getAttribute('data-medicamento-id'))">
                        <i class="fas fa-edit"></i> Realizar nueva edición
                    </button>
                </div>
            </div>
        `;
        const modal = this.createModal('Ediciones del medicamento', html, 'fa-history');
        document.body.appendChild(modal);
    }

    _cerrarModalHistorialMedicamento() {
        this._edicionMedicamentoInternamientoId = null;
    }

    /** Inicia el flujo de edición (motivo, código, formulario) tras cerrar la vista de historial. */
    async iniciarEdicionMedicamentoDesdeHistorial(medicamentoId) {
        document.querySelector('.modal-overlay')?.remove();
        const idInternamiento = this._edicionMedicamentoInternamientoId || this.currentInternamientoId;
        const internamiento = this.internamientos.get(idInternamiento);
        if (!internamiento) {
            this._edicionMedicamentoInternamientoId = null;
            return;
        }
        const med = internamiento.planTerapeutico?.medicamentos?.[medicamentoId];
        if (!med) {
            this.showAlert('Medicamento no encontrado', 'Error', 'error');
            return;
        }
        const motivoCambio = await this.showPrompt(
            'Indique el motivo del cambio de medicación (obligatorio):',
            'Motivo del cambio',
            '',
            true
        );
        if (!motivoCambio || !motivoCambio.trim()) {
            this.showNotification('Debe indicar el motivo del cambio', 'warning');
            return;
        }
        const resultadoCodigo = await this.verificarCodigoAsistente('editar_medicamento');
        if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Edición cancelada', 'info');
            return;
        }
        this._edicionMedicamentoPending = { medicamentoId, motivoCambio: motivoCambio.trim(), codigoResult: resultadoCodigo };
        const modal = this.createModal('Editar Medicamento', this.getAgregarMedicamentoFormHTML(med), 'fa-pills');
        document.body.appendChild(modal);
        setTimeout(() => {
            this.poblarListaHorasExactasDesdeHidden();
            const form = document.getElementById('formAgregarMedicamento');
            if (form) form.onsubmit = (e) => this.handleEditarMedicamento(e);
            const freqInput = document.getElementById('medFrecuencia');
            if (freqInput) freqInput.addEventListener('input', () => this.actualizarAdvertenciaCoherenciaHorariosForm());
            this.actualizarAdvertenciaCoherenciaHorariosForm();
        }, 50);
    }

    poblarListaHorasExactasDesdeHidden() {
        const hidden = document.getElementById('medHorasExactas');
        const lista = document.getElementById('medHorasExactasLista');
        if (!hidden || !lista) return;
        const horas = (hidden.value || '').split(',').map(h => h.trim()).filter(Boolean);
        lista.innerHTML = '';
        horas.forEach(hora => {
            const displayHora = (typeof window.formatTime12Hour === 'function') ? window.formatTime12Hour(hora) : hora;
            const span = document.createElement('span');
            span.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; background: #0ea5e9; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.9rem;';
            span.innerHTML = `${displayHora} <button type="button" onclick="window.internamientoModule.quitarHoraExactaDelForm('${hora}')" style="background: transparent; border: none; color: white; cursor: pointer; padding: 0 2px;">&times;</button>`;
            lista.appendChild(span);
        });
    }

    async handleAgregarMedicamento(e) {
        e.preventDefault();

        const esAdmision = this.agregarMedicamentoContexto === 'admision';
        // Evitar duplicados: un solo envío por acción (doble clic o múltiples submit)
        if (esAdmision && this._agregandoMedicamentoAdmision) return;
        if (esAdmision) this._agregandoMedicamentoAdmision = true;

        const form = document.getElementById('formAgregarMedicamento');
        const submitBtn = form?.querySelector('button[type="submit"]');
        if (esAdmision && submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Agregando...';
        }

        const rawHorasExactas = document.getElementById('medHorasExactas')?.value.trim() || '';
        const horariosExactos = this.parsearHorasExactas(rawHorasExactas);

        const pedidoPermisoEmergencia = document.getElementById('medPedidoPermisoEmergencia')?.checked || false;
        const elMedConsultaExterna = document.getElementById('medPuestoPorConsultaExterna');
        const puestoPorConsultaExternaLectura = elMedConsultaExterna
            ? (elMedConsultaExterna.type === 'checkbox' ? elMedConsultaExterna.checked : elMedConsultaExterna.value === 'true')
            : false;
        const medicamentoData = {
            nombreComercial: document.getElementById('medNombreComercial')?.value.trim() || '',
            dosis: document.getElementById('medDosis')?.value.trim() || '',
            unidadMedida: document.getElementById('medUnidadMedida')?.value?.trim() || '',
            viaAdministracion: document.getElementById('medVia')?.value || '',
            frecuenciaHoras: parseInt(document.getElementById('medFrecuencia')?.value) || 0,
            horariosExactos: horariosExactos,
            observaciones: document.getElementById('medObservaciones')?.value.trim() || '',
            puestoPorConsultaExterna: this.agregarMedicamentoContexto === 'admision' ? puestoPorConsultaExternaLectura : false,
            pedidoPermisoEmergencia: pedidoPermisoEmergencia,
            encargadaContactada: pedidoPermisoEmergencia ? 'Alejandra Cardona' : null
        };

        if (!medicamentoData.frecuenciaHoras && horariosExactos.length === 0) {
            this.showAlert('Indique la frecuencia (cada X horas) o las horas exactas de administración.', 'Datos requeridos', 'warning');
            if (esAdmision) { this._agregandoMedicamentoAdmision = false; if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Medicamento'; } }
            return;
        }
        if (medicamentoData.frecuenciaHoras && horariosExactos.length > 0) {
            const coherencia = this.validarCoherenciaFrecuenciaYHorasExactas(medicamentoData.frecuenciaHoras, horariosExactos);
            if (!coherencia.valido) {
                this.showAlert(coherencia.mensaje, 'Frecuencia y horarios', 'warning');
                if (esAdmision) { this._agregandoMedicamentoAdmision = false; if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Medicamento'; } }
                return;
            }
        }
        // Desde formulario de Nuevo internamiento: guardar en lista local (sin código)
        if (esAdmision) {
            const horariosCalculados = (medicamentoData.horariosExactos && medicamentoData.horariosExactos.length > 0)
                ? medicamentoData.horariosExactos
                : this.calcularHorarios(medicamentoData.frecuenciaHoras || 0);
            const medId = 'med_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            this.medicamentosAdmision = this.medicamentosAdmision || [];
            this.medicamentosAdmision.push({
                medicamentoId: medId,
                nombreComercial: medicamentoData.nombreComercial,
                dosis: medicamentoData.dosis,
                unidadMedida: medicamentoData.unidadMedida || '',
                viaAdministracion: medicamentoData.viaAdministracion,
                frecuenciaHoras: medicamentoData.frecuenciaHoras || null,
                horariosExactos: medicamentoData.horariosExactos || [],
                horariosCalculados: horariosCalculados,
                observaciones: medicamentoData.observaciones,
                puestoPorConsultaExterna: medicamentoData.puestoPorConsultaExterna || false,
                pedidoPermisoEmergencia: medicamentoData.pedidoPermisoEmergencia || false,
                encargadaContactada: medicamentoData.encargadaContactada || null
            });
            this._agregandoMedicamentoAdmision = false;
            this.renderListaMedicamentosAdmision();
            this.showNotification('Medicamento agregado al plan', 'success');
            document.querySelector('.modal-overlay')?.remove();
            return;
        }

        const resultadoCodigo = await this.verificarCodigoAsistente('agregar_medicamento');
        if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('No se agregó el medicamento', 'info');
            return;
        }

        try {
            await this.agregarMedicamento(medicamentoData, resultadoCodigo);
            this.showNotification('Medicamento agregado por ' + resultadoCodigo.nombre, 'success');
            document.querySelector('.modal-overlay')?.remove();
            this.loadMedicacionView();
        } catch (error) {
            console.error('Error agregando medicamento:', error);
            this.showAlert('Error al agregar medicamento: ' + error.message, 'Error', 'error');
        }
    }

    async agregarMedicamento(data, codigoResult) {
        // Verificar si está en alta o egresado
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento && ['alta', 'egresado'].includes(internamiento.estado?.actual)) {
            this.showAlert('No se puede agregar medicación\n\nEl paciente está en proceso de egreso o egresado.', 'Acción Bloqueada', 'warning');
            return;
        }

        const userId = codigoResult?.assistantId || sessionStorage.getItem('userId');
        const userName = codigoResult?.nombre || sessionStorage.getItem('userName');

        const medicamentoId = 'med_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        const horariosCalculados = (data.horariosExactos && data.horariosExactos.length > 0)
            ? data.horariosExactos
            : this.calcularHorarios(data.frecuenciaHoras || 0);

        const medicamentoData = {
            medicamentoId: medicamentoId,
            nombreComercial: data.nombreComercial,
            dosis: data.dosis,
            unidadMedida: data.unidadMedida || '',
            viaAdministracion: data.viaAdministracion,
            frecuenciaHoras: data.frecuenciaHoras || null,
            horariosExactos: data.horariosExactos || [],
            horariosCalculados: horariosCalculados,
            fechaInicio: Date.now(),
            fechaFin: null,
            estadoMedicamento: 'activo',
            prescritoPor: userId,
            prescritoNombre: userName,
            prescritoCodigoVerificado: !!codigoResult,
            observaciones: data.observaciones,
            // Medicamentos agregados desde este flujo (panel de internamiento) nunca son de consulta externa
            puestoPorConsultaExterna: false,
            pedidoPermisoEmergencia: data.pedidoPermisoEmergencia || false,
            encargadaContactada: data.encargadaContactada || null,
            administraciones: {}
        };

        // Guardar en Firebase
        const updates = {};
        updates[`planTerapeutico/medicamentos/${medicamentoId}`] = medicamentoData;
        updates['planTerapeutico/ultimaActualizacion'] = Date.now();
        updates['metadata/fechaUltimaActualizacion'] = Date.now();

        const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
        await internamientoRef.update(updates);

        // Auditoría (prescrito por = quien ingresó el código)
        const auditEntry = {
            timestamp: Date.now(),
            userId: userId,
            usuarioNombre: userName,
            accion: 'agregar_medicamento',
            codigoVerificado: !!codigoResult,
            detalles: {
                medicamentoId: medicamentoId,
                nombre: data.nombreComercial,
                via: data.viaAdministracion,
                frecuencia: data.frecuenciaHoras
            }
        };
        await internamientoRef.child('auditoria/historialCambios').push(auditEntry);
    }

    async handleEditarMedicamento(e) {
        e.preventDefault();
        const medicamentoId = document.getElementById('medEditId')?.value?.trim();
        if (!medicamentoId) {
            this.showAlert('No se pudo identificar el medicamento a editar.', 'Error', 'error');
            return;
        }
        const pending = this._edicionMedicamentoPending;
        if (!pending || pending.medicamentoId !== medicamentoId) {
            this.showAlert('Debe usar el botón Editar del medicamento e ingresar código y motivo antes de guardar.', 'Verificación requerida', 'warning');
            return;
        }
        const rawHorasExactas = document.getElementById('medHorasExactas')?.value.trim() || '';
        const horariosExactos = this.parsearHorasExactas(rawHorasExactas);
        const elConsultaExterna = document.getElementById('medPuestoPorConsultaExterna');
        const puestoPorConsultaExterna = elConsultaExterna
            ? (elConsultaExterna.type === 'checkbox' ? elConsultaExterna.checked : elConsultaExterna.value === 'true')
            : false;
        const data = {
            nombreComercial: document.getElementById('medNombreComercial')?.value.trim() || '',
            dosis: document.getElementById('medDosis')?.value.trim() || '',
            unidadMedida: document.getElementById('medUnidadMedida')?.value?.trim() || '',
            viaAdministracion: document.getElementById('medVia')?.value || '',
            frecuenciaHoras: parseInt(document.getElementById('medFrecuencia')?.value) || 0,
            horariosExactos: horariosExactos,
            observaciones: document.getElementById('medObservaciones')?.value.trim() || '',
            puestoPorConsultaExterna: puestoPorConsultaExterna
        };
        if (!data.frecuenciaHoras && horariosExactos.length === 0) {
            this.showAlert('Indique la frecuencia (cada X horas) o las horas exactas de administración.', 'Datos requeridos', 'warning');
            return;
        }
        if (data.frecuenciaHoras && horariosExactos.length > 0) {
            const coherencia = this.validarCoherenciaFrecuenciaYHorasExactas(data.frecuenciaHoras, horariosExactos);
            if (!coherencia.valido) {
                this.showAlert(coherencia.mensaje, 'Frecuencia y horarios', 'warning');
                return;
            }
        }
        try {
            await this.actualizarMedicamento(medicamentoId, data, { motivoCambio: pending.motivoCambio, codigoResult: pending.codigoResult });
            this._edicionMedicamentoPending = null;
            this.showNotification('Medicamento actualizado por ' + pending.codigoResult.nombre, 'success');
            document.querySelector('.modal-overlay')?.remove();
            this.loadMedicacionView();
        } catch (error) {
            console.error('Error editando medicamento:', error);
            this.showAlert('Error al actualizar medicamento: ' + error.message, 'Error', 'error');
        }
    }

    async actualizarMedicamento(medicamentoId, data, edicionInfo) {
        const idInternamiento = this._edicionMedicamentoInternamientoId || this.currentInternamientoId;
        const internamiento = this.internamientos.get(idInternamiento);
        if (!internamiento) throw new Error('Internamiento no encontrado');
        if (['alta', 'egresado'].includes(internamiento.estado?.actual)) {
            this.showAlert('No se puede editar medicación en un internamiento egresado.', 'Acción bloqueada', 'warning');
            return;
        }
        const horariosCalculados = (data.horariosExactos && data.horariosExactos.length > 0)
            ? data.horariosExactos
            : this.calcularHorarios(data.frecuenciaHoras || 0);
        const updates = {};
        updates[`planTerapeutico/medicamentos/${medicamentoId}/nombreComercial`] = data.nombreComercial;
        updates[`planTerapeutico/medicamentos/${medicamentoId}/dosis`] = data.dosis;
        updates[`planTerapeutico/medicamentos/${medicamentoId}/unidadMedida`] = data.unidadMedida || '';
        updates[`planTerapeutico/medicamentos/${medicamentoId}/viaAdministracion`] = data.viaAdministracion;
        updates[`planTerapeutico/medicamentos/${medicamentoId}/frecuenciaHoras`] = data.frecuenciaHoras || null;
        updates[`planTerapeutico/medicamentos/${medicamentoId}/horariosExactos`] = data.horariosExactos || [];
        updates[`planTerapeutico/medicamentos/${medicamentoId}/horariosCalculados`] = horariosCalculados;
        updates[`planTerapeutico/medicamentos/${medicamentoId}/observaciones`] = data.observaciones;
        updates[`planTerapeutico/medicamentos/${medicamentoId}/puestoPorConsultaExterna`] = data.puestoPorConsultaExterna || false;
        if (edicionInfo && edicionInfo.codigoResult) {
            const cr = edicionInfo.codigoResult;
            const ahora = Date.now();
            const medActual = internamiento.planTerapeutico?.medicamentos?.[medicamentoId] || {};
            const historialPrev = medActual.historialEdiciones || [];
            const datosAnteriores = {
                nombreComercial: medActual.nombreComercial,
                dosis: medActual.dosis,
                unidadMedida: medActual.unidadMedida,
                viaAdministracion: medActual.viaAdministracion,
                frecuenciaHoras: medActual.frecuenciaHoras,
                horariosCalculados: medActual.horariosCalculados,
                observaciones: medActual.observaciones
            };
            updates[`planTerapeutico/medicamentos/${medicamentoId}/editadoPor`] = cr.assistantId || null;
            updates[`planTerapeutico/medicamentos/${medicamentoId}/editadoNombre`] = cr.nombre;
            updates[`planTerapeutico/medicamentos/${medicamentoId}/motivoUltimoCambio`] = edicionInfo.motivoCambio || '';
            updates[`planTerapeutico/medicamentos/${medicamentoId}/editadoCodigoVerificado`] = true;
            updates[`planTerapeutico/medicamentos/${medicamentoId}/fechaUltimaEdicion`] = ahora;
            const nuevaEntrada = {
                fecha: ahora,
                timestamp: ahora,
                editadoPor: cr.assistantId || null,
                editadoNombre: cr.nombre,
                usuarioNombre: cr.nombre,
                motivoCambio: edicionInfo.motivoCambio || '',
                datosAnteriores
            };
            updates[`planTerapeutico/medicamentos/${medicamentoId}/historialEdiciones`] = [...historialPrev, nuevaEntrada];
        }
        updates['planTerapeutico/ultimaActualizacion'] = Date.now();
        updates['metadata/fechaUltimaActualizacion'] = Date.now();
        const internamientoRef = this.internamientosRef.child(idInternamiento);
        await internamientoRef.update(updates);
        if (this._edicionMedicamentoInternamientoId) this._edicionMedicamentoInternamientoId = null;
        if (internamiento.planTerapeutico?.medicamentos?.[medicamentoId]) {
            const m = internamiento.planTerapeutico.medicamentos[medicamentoId];
            if (updates[`planTerapeutico/medicamentos/${medicamentoId}/editadoNombre`] !== undefined) m.editadoNombre = updates[`planTerapeutico/medicamentos/${medicamentoId}/editadoNombre`];
            if (updates[`planTerapeutico/medicamentos/${medicamentoId}/motivoUltimoCambio`] !== undefined) m.motivoUltimoCambio = updates[`planTerapeutico/medicamentos/${medicamentoId}/motivoUltimoCambio`];
            if (updates[`planTerapeutico/medicamentos/${medicamentoId}/fechaUltimaEdicion`] !== undefined) m.fechaUltimaEdicion = updates[`planTerapeutico/medicamentos/${medicamentoId}/fechaUltimaEdicion`];
            if (updates[`planTerapeutico/medicamentos/${medicamentoId}/historialEdiciones`] !== undefined) m.historialEdiciones = updates[`planTerapeutico/medicamentos/${medicamentoId}/historialEdiciones`];
        }
        const userId = edicionInfo?.codigoResult?.assistantId || sessionStorage.getItem('userId');
        const userName = edicionInfo?.codigoResult?.nombre || sessionStorage.getItem('userName');
        const auditEntry = {
            timestamp: Date.now(),
            userId: userId,
            usuarioNombre: userName,
            accion: 'editar_medicamento',
            codigoVerificado: !!(edicionInfo && edicionInfo.codigoResult),
            detalles: {
                medicamentoId,
                nombre: data.nombreComercial,
                via: data.viaAdministracion,
                motivoCambio: edicionInfo?.motivoCambio || null
            }
        };
        await internamientoRef.child('auditoria/historialCambios').push(auditEntry);
    }

    parsearHorasExactas(texto) {
        if (!texto || !texto.trim()) return [];
        const partes = texto.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
        const resultado = [];
        for (const p of partes) {
            const match = p.match(/^(\d{1,2}):(\d{2})$/);
            if (match) {
                const h = String(parseInt(match[1], 10) % 24).padStart(2, '0');
                const m = String(parseInt(match[2], 10) % 60).padStart(2, '0');
                resultado.push(`${h}:${m}`);
            }
        }
        return [...new Set(resultado)].sort();
    }

    calcularHorarios(frecuenciaHoras) {
        if (!frecuenciaHoras || frecuenciaHoras < 1) return [];
        const horarios = [];
        const horasDelDia = 24;
        const numDosis = Math.floor(horasDelDia / frecuenciaHoras);

        for (let i = 0; i < numDosis; i++) {
            const hora = (i * frecuenciaHoras) % 24;
            horarios.push(`${String(hora).padStart(2, '0')}:00`);
        }

        return horarios;
    }

    /**
     * Valida que las horas exactas estén separadas exactamente por frecuenciaHoras (en un ciclo de 24h).
     * Si solo se indica frecuencia o solo horas exactas, no hay conflicto (válido).
     */
    validarCoherenciaFrecuenciaYHorasExactas(frecuenciaHoras, horariosExactos) {
        if (!frecuenciaHoras || frecuenciaHoras < 1 || !horariosExactos || horariosExactos.length === 0) {
            return { valido: true };
        }
        const minutosPorHora = 60;
        const totalMinutos = 24 * minutosPorHora;
        const intervaloEsperadoMin = frecuenciaHoras * minutosPorHora;
        const numDosisEsperado = Math.floor(24 / frecuenciaHoras);

        if (24 % frecuenciaHoras !== 0) {
            return { valido: false, mensaje: 'La frecuencia debe dividir 24 (ej: 1, 2, 3, 4, 6, 8, 12, 24 horas).' };
        }

        const aMinutos = (horaStr) => {
            const m = (horaStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
            if (!m) return null;
            const h = parseInt(m[1], 10) % 24;
            const min = parseInt(m[2], 10) % 60;
            return h * 60 + min;
        };

        const minutos = horariosExactos.map(aMinutos).filter((n) => n != null);
        if (minutos.length !== horariosExactos.length) {
            return { valido: false, mensaje: 'Algunas horas exactas no tienen formato válido (use HH:MM, ej: 08:00).' };
        }
        minutos.sort((a, b) => a - b);

        if (minutos.length !== numDosisEsperado) {
            return {
                valido: false,
                mensaje: `Para "cada ${frecuenciaHoras}h" deben ser exactamente ${numDosisEsperado} horarios en el día (ej: ${this.calcularHorarios(frecuenciaHoras).join(', ')}). Tiene ${minutos.length}.`
            };
        }

        for (let i = 0; i < minutos.length; i++) {
            const siguiente = minutos[(i + 1) % minutos.length];
            const gap = (siguiente - minutos[i] + totalMinutos) % totalMinutos;
            if (gap !== intervaloEsperadoMin) {
                return {
                    valido: false,
                    mensaje: `Las horas exactas deben estar separadas exactamente ${frecuenciaHoras} horas. Revise los horarios (ej: ${this.calcularHorarios(frecuenciaHoras).join(', ')}).`
                };
            }
        }
        return { valido: true };
    }

    async administrarMedicamento(medicamentoId) {
        // REDIRIGIR A FUNCIÓN CON CÓDIGO DE ASISTENTE
        if (typeof this.administrarMedicamentoConCodigo === 'function') {
            return this.administrarMedicamentoConCodigo(medicamentoId);
        }
        
        // Fallback si el módulo de autenticación no está cargado
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
        if (medicamento.puestoPorConsultaExterna) {
            this.showAlert('No se puede administrar dosis en medicamentos puestos por consulta externa.', 'Acción bloqueada', 'warning');
            return;
        }
        if (!this.puedeAdministrarAhora(medicamento)) {
            this.showAlert('Solo se puede administrar cuando corresponda la próxima dosis (contador en cero). Espere a que el tiempo indicado llegue a cero.', 'Próxima dosis no correspondiente', 'warning');
            return;
        }

        // Confirmar administración
        const confirmar = await this.showConfirm(
            `${medicamento.nombreComercial}\nDosis: ${this.formatDosisUnidad(medicamento)}\nVía: ${medicamento.viaAdministracion}`,
            'Confirmar Administración',
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
                dosis: medicamento.dosis
            }
        };
        await internamientoRef.child('auditoria/historialCambios').push(auditEntry);
    }

    /** Muestra en un modal todas las administraciones del medicamento: fecha/hora y quién lo administró (según código verificado). */
    mostrarHistorialAdministracionesMedicamento(medicamentoId) {
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (!internamiento) return;
        const med = internamiento.planTerapeutico?.medicamentos?.[medicamentoId];
        if (!med) {
            this.showAlert('Medicamento no encontrado', 'Error', 'error');
            return;
        }
        const toTs = (a) => {
            const v = a.fechaHoraReal;
            if (v == null) return 0;
            return typeof v === 'number' ? v : (new Date(v).getTime() || 0);
        };
        const administraciones = Object.entries(med.administraciones || {})
            .filter(([, a]) => a.estado === 'administrado')
            .map(([id, a]) => ({ id, ...a }))
            .sort((a, b) => {
                const bTs = toTs(b);
                const aTs = toTs(a);
                if (bTs !== aTs) return bTs - aTs;
                return (b.id || '').localeCompare(a.id || '');
            });
        const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const nombreMed = esc(med.nombreComercial || 'Sin nombre');
        let tableBody = '';
        if (administraciones.length === 0) {
            tableBody = '<tr><td colspan="2" style="padding: 24px; text-align: center; color: #888;">Aún no hay administraciones registradas para este medicamento.</td></tr>';
        } else {
            tableBody = administraciones.map(a => {
                const fechaStr = a.fechaHoraReal ? (() => { const d = new Date(a.fechaHoraReal); return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }); })() : '—';
                const quien = esc(a.administradoNombre || '—');
                const codigoOk = a.codigoVerificado ? ' <span style="color: #2e7d32; font-size: 0.75rem;" title="Código verificado"><i class="fas fa-check-circle"></i></span>' : '';
                return `<tr><td style="padding: 10px; border-bottom: 1px solid #eee;">${fechaStr}</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${quien}${codigoOk}</td></tr>`;
            }).join('');
        }
        const html = `
            <div style="margin-bottom: 16px; font-size: 0.95rem; color: #555;">
                <strong>${nombreMed}</strong> · Dosis: ${this.formatDosisUnidad(med)}
            </div>
            <p style="font-size: 0.8rem; color: #888; margin-bottom: 10px;"><i class="fas fa-sort-amount-down" style="margin-right: 4px;"></i>Orden: más reciente primero</p>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e0e0e0;">Fecha y hora</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e0e0e0;">Administrado por</th>
                    </tr>
                </thead>
                <tbody>${tableBody}</tbody>
            </table>
        `;
        const modal = this.createModal('Historial de administraciones', html, 'fa-syringe');
        document.body.appendChild(modal);
    }

    async suspenderMedicamento(medicamentoId) {
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        const medicamento = internamiento?.planTerapeutico?.medicamentos?.[medicamentoId];
        if (!internamiento || !medicamento) {
            this.showAlert('Medicamento no encontrado', 'Error', 'error');
            return;
        }

        const motivo = await this.showPrompt(
            'Indique el motivo de la suspensión (obligatorio):',
            'Motivo de suspensión',
            '',
            true
        );
        if (!motivo || !motivo.trim()) {
            this.showNotification('Debe indicar el motivo de suspensión', 'warning');
            return;
        }

        const resultadoCodigo = await this.verificarCodigoAsistente('suspender_medicamento');
        if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Suspensión cancelada', 'info');
            return;
        }

        const confirmar = await this.showConfirm(
            `¿Confirmar suspensión de "${medicamento.nombreComercial || 'este medicamento'}"?\n\nMotivo: ${motivo.trim()}\nSuspendido por: ${resultadoCodigo.nombre}`,
            'Suspender Medicamento',
            { confirmText: 'Suspender', cancelText: 'Cancelar', icon: 'fa-pause-circle', iconColor: '#f39c12' }
        );
        if (!confirmar) return;

        try {
            const updates = {};
            updates[`planTerapeutico/medicamentos/${medicamentoId}/estadoMedicamento`] = 'suspendido';
            updates[`planTerapeutico/medicamentos/${medicamentoId}/fechaFin`] = Date.now();
            updates[`planTerapeutico/medicamentos/${medicamentoId}/motivoSuspension`] = motivo.trim();
            updates[`planTerapeutico/medicamentos/${medicamentoId}/suspendidoPor`] = resultadoCodigo.assistantId || null;
            updates[`planTerapeutico/medicamentos/${medicamentoId}/suspendidoNombre`] = resultadoCodigo.nombre;
            updates[`planTerapeutico/medicamentos/${medicamentoId}/suspendidoCodigoVerificado`] = true;
            updates['metadata/fechaUltimaActualizacion'] = Date.now();

            const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
            await internamientoRef.update(updates);

            const auditEntry = {
                timestamp: Date.now(),
                userId: resultadoCodigo.assistantId,
                usuarioNombre: resultadoCodigo.nombre,
                accion: 'suspender_medicamento',
                codigoVerificado: true,
                detalles: {
                    medicamentoId: medicamentoId,
                    nombre: medicamento.nombreComercial,
                    motivoSuspension: motivo.trim()
                }
            };
            await internamientoRef.child('auditoria/historialCambios').push(auditEntry);

            this.showNotification('Medicamento suspendido por ' + resultadoCodigo.nombre, 'success');
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
        alert('Vista de evolución en desarrollo\n\nEsta funcionalidad estará disponible en la próxima actualización.');
    }

    showCirugiasView() {
        if (!this.currentInternamientoId) {
            alert('Error: No hay internamiento seleccionado');
            return;
        }
        this.showInternamientoView('cirugias');
        setTimeout(() => this.loadCirugiasView(), 100);
    }

    showLlamadasView() {
        if (!this.currentInternamientoId) {
            alert('Error: No hay internamiento seleccionado');
            return;
        }
        this.showInternamientoView('llamadas');
        setTimeout(() => this.loadLlamadasView(), 100);
    }

    showDefuncionesView() {
        if (!this.currentInternamientoId) {
            alert('Error: No hay internamiento seleccionado');
            return;
        }
        this.showInternamientoView('defunciones');
        setTimeout(() => this.loadDefuncionesView(), 100);
    }

    showTurnosView() {
        if (!this.currentInternamientoId) {
            alert('Error: No hay internamiento seleccionado');
            return;
        }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento && ['alta', 'egresado'].includes(internamiento.estado?.actual)) {
            this.showAlert('No se pueden registrar turnos. El paciente ya tiene alta médica autorizada o está egresado.', 'Acción Bloqueada', 'warning');
            return;
        }
        this.showInternamientoView('turnos');
        setTimeout(() => this.loadTurnosView(), 100);
    }

    loadTurnosView() {
        const container = document.getElementById('internamiento-turnos');
        if (!container) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        if (!internamiento) return;
        const turnosRaw = internamiento?.turnos && typeof internamiento.turnos === 'object' ? internamiento.turnos : {};
        const turnosList = Object.values(turnosRaw).sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

        const listHTML = turnosList.length > 0
            ? `
            <div style="background: white; padding: 20px; border-radius: 12px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 1rem;"><i class="fas fa-list"></i> Turnos registrados (${turnosList.length})</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${turnosList.map(t => this.renderTurnoCard(t)).join('')}
                </div>
            </div>
            `
            : `
            <div style="background: white; padding: 40px; border-radius: 12px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; color: #6c757d;">
                <i class="fas fa-clipboard-list" style="font-size: 3rem; color: #5c6bc0; margin-bottom: 16px; opacity: 0.8;"></i>
                <p style="margin: 0; font-size: 1rem;">No hay turnos registrados. Use "Agregar turno" para registrar uno.</p>
            </div>
            `;

        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-clipboard-list"></i> Turnos</h2>
                <div>
                    <button class="btn btn-primary" onclick="window.internamientoModule.showRegistroTurnoForm()">
                        <i class="fas fa-plus"></i> Agregar turno
                    </button>
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showPanelPrincipal('${id}')" style="margin-left: 10px;">
                        <i class="fas fa-arrow-left"></i> Volver al Panel
                    </button>
                </div>
            </div>
            ${listHTML}
        `;
    }

    showTransfusionesView() {
        if (!this.currentInternamientoId) {
            alert('Error: No hay internamiento seleccionado');
            return;
        }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.estado?.actual === 'egresado') {
            this.showAlert('No se pueden registrar transfusiones en un internamiento egresado', 'Acción Bloqueada', 'warning');
            return;
        }
        this.showInternamientoView('transfusiones');
        setTimeout(() => this.loadTransfusionesView(), 100);
    }

    showControlesAdicionalesView() {
        if (!this.currentInternamientoId) {
            alert('Error: No hay internamiento seleccionado');
            return;
        }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.estado?.actual === 'egresado') {
            this.showAlert('No se puede acceder a controles adicionales en un internamiento egresado', 'Acción Bloqueada', 'warning');
            return;
        }
        this.showInternamientoView('controles_adicionales');
        setTimeout(() => this.loadControlesAdicionalesView(), 100);
    }

    loadControlesAdicionalesView() {
        const container = document.getElementById('internamiento-controles_adicionales');
        if (!container) return;
        const id = this.currentInternamientoId;
        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-clipboard-check"></i> Controles adicionales</h2>
                <div>
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showPanelPrincipal('${id}')">
                        <i class="fas fa-arrow-left"></i> Volver al Panel
                    </button>
                </div>
            </div>
            <div class="controles-adicionales-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; margin-top: 24px;">
                <button class="btn-controle-adicional" onclick="window.internamientoModule.showImagenologiaView()" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 20px; background: white; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <i class="fas fa-x-ray" style="font-size: 2rem; color: #0d9488; margin-bottom: 12px;"></i>
                    <span style="font-weight: 600; color: #334155;">Imagenología</span>
                </button>
                <button class="btn-controle-adicional" onclick="window.internamientoModule.showRerView()" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 20px; background: white; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <i class="fas fa-file-medical-alt" style="font-size: 2rem; color: #5c6bc0; margin-bottom: 12px;"></i>
                    <span style="font-weight: 600; color: #334155;">RER</span>
                </button>
                <button class="btn-controle-adicional" onclick="window.internamientoModule.showAlimentacionAsistidaView()" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 20px; background: white; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <i class="fas fa-utensils" style="font-size: 2rem; color: #2e7d32; margin-bottom: 12px;"></i>
                    <span style="font-weight: 600; color: #334155;">Alimentación asistida</span>
                </button>
                <button class="btn-controle-adicional" onclick="window.internamientoModule.showHidratacionView()" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 20px; background: white; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <i class="fas fa-tint" style="font-size: 2rem; color: #0288d1; margin-bottom: 12px;"></i>
                    <span style="font-weight: 600; color: #334155;">Hidratación</span>
                </button>
                <button class="btn-controle-adicional" onclick="window.internamientoModule.showCurvaGlucosaView()" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 20px; background: white; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <i class="fas fa-chart-line" style="font-size: 2rem; color: #7b1fa2; margin-bottom: 12px;"></i>
                    <span style="font-weight: 600; color: #334155;">Curva de glucosa</span>
                </button>
            </div>
        `;
        // Hover para botones de control
        container.querySelectorAll('.btn-controle-adicional').forEach(btn => {
            btn.addEventListener('mouseenter', function() { this.style.borderColor = '#5c6bc0'; this.style.boxShadow = '0 4px 12px rgba(92,107,192,0.2)'; });
            btn.addEventListener('mouseleave', function() { this.style.borderColor = '#e2e8f0'; this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; });
        });
    }

    showImagenologiaView() {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.estado?.actual === 'egresado') {
            this.showAlert('No se puede acceder a Imagenología en un internamiento egresado', 'Acción Bloqueada', 'warning');
            return;
        }
        this.showInternamientoView('imagenologia');
        setTimeout(() => this.loadImagenologiaView(), 100);
    }

    loadImagenologiaView() {
        const container = document.getElementById('internamiento-imagenologia');
        if (!container) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        const controles = internamiento?.datosIngreso?.controlesRapidos || {};
        const imagenologiaRegistros = internamiento?.imagenologia && typeof internamiento.imagenologia === 'object' ? internamiento.imagenologia : {};
        const listaRegistros = Object.entries(imagenologiaRegistros).sort((a, b) => (b[1].fechaRegistro || 0) - (a[1].fechaRegistro || 0));
        const esc = (s) => (s != null && s !== '' ? String(s) : '—').replace(/</g, '&lt;').replace(/\n/g, '<br>');
        const rayosX = !!controles.rayosX;
        const ultrasonido = !!controles.ultrasonido;
        const doctorRayosX = esc(controles.doctorRayosX);
        const doctorUltrasonido = esc(controles.doctorUltrasonido);
        const reporteRayosX = esc(controles.reporteRayosX);
        const reporteUltrasonido = esc(controles.reporteUltrasonido);
        const htmlRegistros = listaRegistros.length > 0 ? listaRegistros.map(([regId, reg]) => {
            const tipoLabel = reg.tipo === 'rayosx' ? 'Rayos X' : 'Ultrasonido';
            const fechaStr = reg.fechaRegistro ? (() => { const d = new Date(reg.fechaRegistro); return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }); })() : '—';
            return `
                <div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; padding: 16px 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <span style="display: inline-block; background: ${reg.tipo === 'rayosx' ? '#f0fdfa' : '#f0f9ff'}; color: ${reg.tipo === 'rayosx' ? '#0f766e' : '#0284c7'}; padding: 4px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px;">${tipoLabel}</span>
                            <div style="font-weight: 600; color: #334155;">Quién lo realizó: ${esc(reg.quienLoHizo)}</div>
                            ${reg.queVio ? `<div style="margin-top: 8px; color: #64748b; font-size: 0.95rem;">Qué vio: ${esc(reg.queVio)}</div>` : ''}
                            <div style="margin-top: 8px; font-size: 0.85rem; color: #94a3b8;">Registrado por: ${esc(reg.registradoNombre)} · ${fechaStr}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('') : '';
        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-x-ray"></i> Imagenología</h2>
                <div>
                    <button class="btn btn-primary" onclick="window.internamientoModule.showModalAgregarImagenologia()" style="margin-right: 10px;">
                        <i class="fas fa-plus"></i> Agregar estudio
                    </button>
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showControlesAdicionalesView()">
                        <i class="fas fa-arrow-left"></i> Volver a Controles adicionales
                    </button>
                </div>
            </div>
            <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 24px;">
                <div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; overflow: hidden;">
                    <div style="padding: 16px 20px; background: #f0fdfa; border-bottom: 1px solid #e2e8f0;">
                        <h3 style="margin: 0; font-size: 1.1rem; color: #0f766e;"><i class="fas fa-x-ray" style="margin-right: 8px;"></i> Rayos X (ingreso)</h3>
                    </div>
                    <div style="padding: 20px;">
                        <div style="display: grid; gap: 12px;">
                            <div><span style="color: #64748b;">Realizado:</span> <strong>${rayosX ? 'Sí' : 'No'}</strong></div>
                            ${rayosX ? `<div><span style="color: #64748b;">Doctor/Técnico:</span> <strong>${doctorRayosX}</strong></div>` : ''}
                            ${rayosX && reporteRayosX !== '—' ? `<div><span style="color: #64748b;">Reporte:</span> ${reporteRayosX}</div>` : ''}
                        </div>
                    </div>
                </div>
                <div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; overflow: hidden;">
                    <div style="padding: 16px 20px; background: #f0f9ff; border-bottom: 1px solid #e2e8f0;">
                        <h3 style="margin: 0; font-size: 1.1rem; color: #0284c7;"><i class="fas fa-wave-square" style="margin-right: 8px;"></i> Ultrasonido (ingreso)</h3>
                    </div>
                    <div style="padding: 20px;">
                        <div style="display: grid; gap: 12px;">
                            <div><span style="color: #64748b;">Realizado:</span> <strong>${ultrasonido ? 'Sí' : 'No'}</strong></div>
                            ${ultrasonido ? `<div><span style="color: #64748b;">Doctor:</span> <strong>${doctorUltrasonido}</strong></div>` : ''}
                            ${ultrasonido && reporteUltrasonido !== '—' ? `<div><span style="color: #64748b;">Reporte:</span> ${reporteUltrasonido}</div>` : ''}
                        </div>
                    </div>
                </div>
                <div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; overflow: hidden;">
                    <div style="padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 1.1rem; color: #475569;"><i class="fas fa-list" style="margin-right: 8px;"></i> Estudios agregados</h3>
                        ${listaRegistros.length > 0 ? `<span style="font-size: 0.9rem; color: #64748b;">${listaRegistros.length} estudio(s)</span>` : ''}
                    </div>
                    <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
                        ${htmlRegistros || '<p style="color: #64748b; margin: 0;">No hay estudios agregados. Use «Agregar estudio» para registrar Rayos X o Ultrasonido.</p>'}
                    </div>
                </div>
                ${!rayosX && !ultrasonido && listaRegistros.length === 0 ? `
                <div style="padding: 32px; text-align: center; background: #f8fafc; border-radius: 12px; color: #64748b;">
                    <i class="fas fa-x-ray" style="font-size: 2.5rem; opacity: 0.5;"></i>
                    <p style="margin: 12px 0 0 0;">No hay estudios de imagenología registrados en el ingreso. Puede agregar estudios con el botón «Agregar estudio» o editar los datos de ingreso desde «Revisar datos de ingreso» en el panel.</p>
                </div>
                ` : ''}
            </div>
        `;
    }

    async showModalAgregarImagenologia() {
        const modalContent = `
            <style>
                #formAgregarImagenologia .imagenologia-tipo-option:hover { background: #f1f5f9 !important; border-color: #cbd5e1 !important; }
                #formAgregarImagenologia .imagenologia-tipo-option:has(input:checked) { border-color: var(--internamiento-primary, #3f51b5) !important; background: #eef2ff !important; box-shadow: 0 0 0 1px var(--internamiento-primary, #3f51b5); }
            </style>
            <form id="formAgregarImagenologia" class="modal-imagenologia-form" style="padding: 0; max-width: 100%;">
                <div style="padding: 24px 20px 20px 20px;">
                    <div class="form-group" style="margin-bottom: 26px;">
                        <label style="font-weight: 600; font-size: 0.95rem; color: #334155; margin-bottom: 12px; display: block;">Tipo de estudio</label>
                        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                            <label class="imagenologia-tipo-option" style="flex: 1; min-width: 140px; display: flex; align-items: center; gap: 12px; padding: 14px 18px; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; background: #f8fafc; transition: all 0.2s ease;">
                                <input type="radio" name="imagenologiaTipo" value="rayosx" id="imagenologiaTipoRayosX" checked style="width: 18px; height: 18px; accent-color: #0d9488;">
                                <i class="fas fa-x-ray" style="color: #0d9488; font-size: 1.25rem;"></i>
                                <span style="font-weight: 500; color: #334155;">Rayos X</span>
                            </label>
                            <label class="imagenologia-tipo-option" style="flex: 1; min-width: 140px; display: flex; align-items: center; gap: 12px; padding: 14px 18px; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; background: #f8fafc; transition: all 0.2s ease;">
                                <input type="radio" name="imagenologiaTipo" value="ultrasonido" id="imagenologiaTipoUltrasonido" style="width: 18px; height: 18px; accent-color: #0284c7;">
                                <i class="fas fa-wave-square" style="color: #0284c7; font-size: 1.25rem;"></i>
                                <span style="font-weight: 500; color: #334155;">Ultrasonido</span>
                            </label>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom: 26px;">
                        <label for="imagenologiaQuienRealizo" style="font-weight: 600; font-size: 0.95rem; color: #334155; margin-bottom: 10px; display: block;">Quién lo realizó</label>
                        <select id="imagenologiaQuienRealizo" required style="width: 100%; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; font-size: 0.95rem; color: #334155;">
                            <option value="">Cargando...</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="imagenologiaQueVio" style="font-weight: 600; font-size: 0.95rem; color: #334155; margin-bottom: 10px; display: block;">Qué vio / Reporte</label>
                        <textarea id="imagenologiaQueVio" rows="4" placeholder="Describa lo que se observó en el estudio..." style="width: 100%; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.95rem; resize: vertical; min-height: 100px;"></textarea>
                    </div>
                </div>
                <div style="padding: 20px 20px 16px; border-top: 1px solid #e2e8f0; margin-top: 4px; display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap; background: #fafafa; border-radius: 0 0 12px 12px;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px; border-radius: 10px;">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="padding: 10px 20px; border-radius: 10px;"><i class="fas fa-save" style="margin-right: 8px;"></i>Registrar (pedirá código)</button>
                </div>
            </form>
        `;
        const modal = this.createModal('Agregar estudio de imagenología', modalContent, 'fa-x-ray');
        document.body.appendChild(modal);
        const self = this;
        await this.populateImagenologiaQuienSelect('rayosx');
        const radioRayos = document.getElementById('imagenologiaTipoRayosX');
        const radioUltra = document.getElementById('imagenologiaTipoUltrasonido');
        if (radioRayos) radioRayos.addEventListener('change', function() { if (this.checked) self.populateImagenologiaQuienSelect('rayosx'); });
        if (radioUltra) radioUltra.addEventListener('change', function() { if (this.checked) self.populateImagenologiaQuienSelect('ultrasonido'); });
        document.getElementById('formAgregarImagenologia').addEventListener('submit', function(e) {
            e.preventDefault();
            self.handleSubmitAgregarImagenologia();
        });
    }

    async populateImagenologiaQuienSelect(tipo) {
        const select = document.getElementById('imagenologiaQuienRealizo');
        if (!select) return;
        select.innerHTML = '<option value="">Cargando...</option>';
        try {
            const db = window.database;
            if (!db) { select.innerHTML = '<option value="">Error: base de datos no disponible</option>'; return; }
            const doctorsSnap = await db.ref('doctors').once('value');
            const doctors = doctorsSnap.val() || {};
            const doctorsArray = Object.values(doctors);
            let combined = [...doctorsArray];
            if (tipo === 'rayosx') {
                const assistantsSnap = await db.ref('assistants').once('value');
                const assistants = assistantsSnap.val() || {};
                const assistantsArray = Object.values(assistants);
                combined = [...new Set([...doctorsArray, ...assistantsArray])].sort();
            }
            const placeholder = tipo === 'rayosx' ? 'Seleccione doctor o técnico' : 'Seleccione un doctor';
            select.innerHTML = '<option value="">' + placeholder + '</option>';
            combined.forEach(function(name) {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                select.appendChild(opt);
            });
        } catch (err) {
            console.error(err);
            select.innerHTML = '<option value="">Error al cargar lista</option>';
        }
    }

    async handleSubmitAgregarImagenologia() {
        const tipoEl = document.querySelector('input[name="imagenologiaTipo"]:checked');
        const quienEl = document.getElementById('imagenologiaQuienRealizo');
        const queVioEl = document.getElementById('imagenologiaQueVio');
        const tipo = tipoEl ? tipoEl.value : '';
        const quienLoHizo = quienEl ? quienEl.value.trim() : '';
        const queVio = queVioEl ? queVioEl.value.trim() : '';
        if (!tipo || !quienLoHizo) {
            this.showAlert('Seleccione el tipo de estudio y quién lo realizó.', 'Datos requeridos', 'warning');
            return;
        }
        const resultadoCodigo = await this.verificarCodigoAsistente('imagenologia');
        if (!resultadoCodigo || !resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Registro cancelado', 'info');
            return;
        }
        const id = this.currentInternamientoId;
        if (!id) return;
        const registroId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const datos = {
            tipo: tipo,
            quienLoHizo: quienLoHizo,
            queVio: queVio || '',
            registradoPor: resultadoCodigo.assistantId || '',
            registradoNombre: resultadoCodigo.nombre || '',
            fechaRegistro: Date.now()
        };
        const updates = {};
        updates['imagenologia/' + registroId] = datos;
        updates['metadata/fechaUltimaActualizacion'] = Date.now();
        try {
            await this.internamientosRef.child(id).update(updates);
            const internamiento = this.internamientos.get(id);
            if (internamiento) {
                internamiento.imagenologia = internamiento.imagenologia || {};
                internamiento.imagenologia[registroId] = datos;
            }
            document.querySelector('.modal-overlay')?.remove();
            this.showNotification('Estudio de imagenología registrado', 'success');
            this.loadImagenologiaView();
        } catch (err) {
            console.error(err);
            this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
        }
    }

    showRerView() {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.estado?.actual === 'egresado') {
            this.showAlert('No se puede acceder a RER en un internamiento egresado', 'Acción Bloqueada', 'warning');
            return;
        }
        this.showInternamientoView('rer');
        setTimeout(() => this.loadRerView(), 100);
    }

    loadRerView() {
        const container = document.getElementById('internamiento-rer');
        if (!container) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        const rer = internamiento?.rer && typeof internamiento.rer === 'object' ? internamiento.rer : {};
        const hoy = new Date();
        const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        const pesoHoy = internamiento?.metadata?.pesoHoy;
        const pesoActualNum = (rer.pesoParaFormula != null && rer.pesoParaFormula !== '')
            ? parseFloat(rer.pesoParaFormula)
            : (pesoHoy && pesoHoy.fecha === fechaHoy && pesoHoy.valor != null && pesoHoy.valor !== '')
                ? parseFloat(pesoHoy.valor)
                : (internamiento?.datosIngreso?.pesoIngreso != null ? parseFloat(internamiento.datosIngreso.pesoIngreso) : null);
        const rerDosisResultado = (pesoActualNum != null && !isNaN(pesoActualNum)) ? (30 * pesoActualNum) + 70 : null;
        const fase1Resultado = (rerDosisResultado != null) ? rerDosisResultado * 0.25 : null;
        const fase2Resultado = (fase1Resultado != null) ? fase1Resultado * 2 : null;
        const fase3Resultado = (fase1Resultado != null) ? fase1Resultado * 3 : null;
        const fase4Resultado = (fase1Resultado != null) ? fase1Resultado * 4 : null;
        const round1 = (v) => (v != null && !isNaN(v)) ? Math.round(v * 10) / 10 : '--';
        const ml = (v) => { const r = round1(v); return r === '--' ? '--' : r + ' ml'; };
        const rerPorToma = rerDosisResultado != null ? rerDosisResultado / 5 : null;
        const fase1PorToma = fase1Resultado != null ? fase1Resultado / 5 : null;
        const fase2PorToma = fase2Resultado != null ? fase2Resultado / 5 : null;
        const fase3PorToma = fase3Resultado != null ? fase3Resultado / 5 : null;
        const fase4PorToma = fase4Resultado != null ? fase4Resultado / 5 : null;
        const dias = rer.dias && typeof rer.dias === 'object' ? rer.dias : {};
        const diasList = Object.entries(dias).sort((a, b) => (a[1].numero || 0) - (b[1].numero || 0));
        const hasDias = diasList.length > 0;
        const MIN_TOMAS_POR_DIA = 5;
        const lastDay = hasDias ? diasList[diasList.length - 1] : null;
        const lastDayTomas = lastDay ? Object.keys(lastDay[1].tomas || {}).length : 0;
        const lastDayComplete = lastDayTomas >= MIN_TOMAS_POR_DIA;
        const canAddNewDay = !hasDias || lastDayComplete;

        const tabsHTML = hasDias
            ? `
            <div class="tabs-container rer-tabs-vertical" style="margin-top: 20px;">
                ${diasList.map(([diaKey, data], idx) => {
                    const numTomas = Object.keys(data.tomas || {}).length;
                    const completo = numTomas >= MIN_TOMAS_POR_DIA;
                    const label = `Día ${data.numero != null ? data.numero : idx + 1} (${numTomas}/${MIN_TOMAS_POR_DIA})`;
                    return `
                    <button class="tab-btn rer-tab ${idx === 0 ? 'active' : ''}" data-rer-dia="${diaKey}" onclick="window.internamientoModule.showTabRer('${diaKey}')" title="${completo ? 'Día completo' : `Faltan ${MIN_TOMAS_POR_DIA - numTomas} tomas`}">
                        ${label}${completo ? ' ✓' : ''}
                    </button>
                `;
                }).join('')}
            </div>
            `
            : '';

        const horaOrder = { '8am': 1, '12md': 2, '4pm': 3, '8pm': 4, '12mn': 5 };
        const tabContentsHTML = hasDias
            ? diasList.map(([diaKey, data], idx) => {
                const tomas = data.tomas && typeof data.tomas === 'object' ? data.tomas : {};
                const tomasList = Object.values(tomas).sort((a, b) => {
                    const oa = horaOrder[a.hora] ?? 99;
                    const ob = horaOrder[b.hora] ?? 99;
                    return oa !== ob ? oa - ob : (a.fechaRegistro || 0) - (b.fechaRegistro || 0);
                });
                const isActive = idx === 0;
                const fechaHoraStr = data.fechaHora ? (function(ts) { const d = new Date(ts); return isNaN(d.getTime()) ? '' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }); })(data.fechaHora) : '';
                const obsStr = (data.observaciones || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
                const preescritoPorStr = (data.preescritoPor || '').replace(/</g, '&lt;');
                const infoDiaHTML = (fechaHoraStr || obsStr || preescritoPorStr) ? `
                        <div style="padding: 16px 20px; background: #f0f4ff; border-bottom: 1px solid #e2e8f0;">
                            ${fechaHoraStr ? `<div style="font-size: 0.9rem; color: #475569; margin-bottom: 6px;"><i class="fas fa-calendar-alt"></i> ${fechaHoraStr}</div>` : ''}
                            ${obsStr ? `<div style="font-size: 0.9rem; color: #475569; margin-top: 6px;"><strong>Observaciones:</strong> ${obsStr}</div>` : ''}
                            ${preescritoPorStr ? `<div style="font-size: 0.9rem; color: #475569; margin-top: 6px;"><strong>Preescrito por:</strong> ${preescritoPorStr}</div>` : ''}
                        </div>
                ` : '';
                return `
                <div id="rer-tab-${diaKey}" class="tab-content ${isActive ? 'active' : ''}" data-rer-dia="${diaKey}">
                    <div style="background: white; border-radius: 12px; margin-top: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden;">
                        ${infoDiaHTML}
                        <div style="padding: 20px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; border-bottom: 1px solid #e2e8f0;">
                            <button class="btn btn-primary" onclick="window.internamientoModule.agregarTomasDiaRer('${diaKey}')" style="background: var(--internamiento-primary); border-color: var(--internamiento-primary);">
                                <i class="fas fa-plus"></i> Agregar tomas del día
                            </button>
                            <button class="btn btn-secondary" onclick="window.internamientoModule.eliminarDiaRer('${diaKey}')" style="color: #b91c1c; border-color: #b91c1c;">
                                <i class="fas fa-trash-alt"></i> Eliminar día
                            </button>
                        </div>
                        <div style="padding: 20px;">
                            ${tomasList.length > 0
                                ? `<div style="display: flex; flex-direction: column; gap: 10px;">${tomasList.map(t => {
                                    const horaLabels = { '8am': '8:00 AM', '12md': '12:00 MD', '4pm': '4:00 PM', '8pm': '8:00 PM', '12mn': '12:00 MN' };
                                    const hora = (t.hora ? (horaLabels[t.hora] || t.hora) : '—').replace(/</g, '&lt;');
                                    const cant = t.cantidadPorToma != null && t.cantidadPorToma !== '' ? t.cantidadPorToma : '—';
                                    const agua = t.cantidadAgua != null && t.cantidadAgua !== '' ? t.cantidadAgua + ' ml' : '—';
                                    const registradoPor = (t.registradoPorNombre || '').replace(/</g, '&lt;');
                                    return `
                                    <div style="border: 1px solid #e2e8f0; border-left: 4px solid var(--internamiento-primary); border-radius: 8px; padding: 12px; background: #f8fafc;">
                                        <div style="font-weight: 600; color: #334155; margin-bottom: 4px;"><i class="fas fa-clock"></i> ${hora}</div>
                                        <div style="font-size: 0.9rem; color: #64748b;">Cantidad por toma: ${cant} · Agua: ${agua}</div>
                                        ${registradoPor ? `<div style="font-size: 0.85rem; color: #94a3b8; margin-top: 4px;"><i class="fas fa-user"></i> Registrado por: ${registradoPor}</div>` : ''}
                                    </div>
                                    `;
                                }).join('')}</div>`
                                : `
                                <div style="padding: 32px 20px; text-align: center; color: #6c757d;">
                                    <i class="fas fa-list-ol" style="font-size: 2rem; color: #5c6bc0; opacity: 0.8;"></i>
                                    <p style="margin: 12px 0 0 0; font-size: 0.95rem;">No hay tomas en este día. Use «Agregar tomas del día» para registrar.</p>
                                </div>
                                `}
                        </div>
                    </div>
                </div>
                `;
            }).join('')
            : `
            <div id="rer-dias-container" style="margin-top: 24px;">
                <div class="empty-state" style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; color: #6c757d;">
                    <i class="fas fa-file-medical-alt" style="font-size: 2.5rem; color: #5c6bc0; margin-bottom: 16px; opacity: 0.8;"></i>
                    <p style="margin: 0 0 8px 0; font-size: 1rem;">Sin días agregados</p>
                    <p style="margin: 0; font-size: 0.9rem;">Use «Agregar día» para registrar un nuevo día de RER.</p>
                </div>
            </div>
            `;

        const agregarDiaBtnDisabled = !canAddNewDay;
        const agregarDiaTitle = canAddNewDay ? 'Agregar un nuevo día' : 'Complete el día actual con al menos 5 tomas para poder agregar un nuevo día';
        const agregarDiaBtnHTML = agregarDiaBtnDisabled
            ? `<button class="btn btn-primary" disabled title="${agregarDiaTitle}" style="background: var(--internamiento-primary); border-color: var(--internamiento-primary); opacity: 0.6; cursor: not-allowed;">
                <i class="fas fa-plus"></i> Agregar día
                ${hasDias && !lastDayComplete ? ` <span style="font-size: 0.85rem; opacity: 0.9;">(mín. 5 tomas en Día ${lastDay[1].numero})</span>` : ''}
            </button>`
            : `<button class="btn btn-primary" onclick="window.internamientoModule.agregarDiaRer()" title="${agregarDiaTitle}" style="background: var(--internamiento-primary); border-color: var(--internamiento-primary);">
                <i class="fas fa-plus"></i> Agregar día
            </button>`;

        let ultimaTomaCantidad = null;
        if (hasDias && diasList.length > 0) {
            const todasTomas = [];
            diasList.forEach(([, data]) => {
                const tomas = data.tomas && typeof data.tomas === 'object' ? data.tomas : {};
                Object.values(tomas).forEach(t => {
                    todasTomas.push({ fechaRegistro: t.fechaRegistro || 0, cantidadPorToma: t.cantidadPorToma });
                });
            });
            if (todasTomas.length > 0) {
                const ultima = todasTomas.sort((a, b) => b.fechaRegistro - a.fechaRegistro)[0];
                const parsed = parseFloat(ultima.cantidadPorToma);
                ultimaTomaCantidad = !isNaN(parsed) ? parsed : null;
            }
        }
        const faseActual = (() => {
            if (!hasDias || fase1PorToma == null) return 1;
            if (ultimaTomaCantidad == null) return 1;
            if (ultimaTomaCantidad < fase1PorToma) return 1;
            if (fase2PorToma != null && ultimaTomaCantidad < fase2PorToma) return 2;
            if (fase3PorToma != null && ultimaTomaCantidad < fase3PorToma) return 3;
            return 4;
        })();
        const fasesConfig = [
            { num: 1, label: 'Fase 1', bg: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
            { num: 2, label: 'Fase 2', bg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' },
            { num: 3, label: 'Fase 3', bg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' },
            { num: 4, label: 'Fase 4', bg: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }
        ];
        const faseMostrar = hasDias ? fasesConfig[faseActual - 1] : null;
        const anunciosHTML = faseMostrar ? `<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px;"><div style="background: ${faseMostrar.bg}; color: #fff; font-weight: 700; font-size: 1rem; padding: 12px 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">${faseMostrar.label}</div></div>` : '';

        const rerDosisSectionHTML = `
            <div id="rer-dosis-section" style="margin-top: 20px; margin-bottom: 24px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; padding: 16px 20px; box-shadow: 0 4px 14px rgba(217,119,6,0.4); border: none;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2);"><i class="fas fa-syringe"></i> RER dosis</h3>
                ${hasDias ? `<p style="margin: 10px 0 0 0; font-size: 1.25rem; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">(30 × peso actual) + 70 = <strong>${ml(rerDosisResultado)}</strong></p><p style="margin: 8px 0 0 0; font-size: 1.1rem; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">Fase 1 (25%): <strong>${ml(fase1Resultado)}</strong> · Dosis por toma: <strong>${ml(fase1PorToma)}</strong></p><p style="margin: 8px 0 0 0; font-size: 1.1rem; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">Fase 2 (50%): <strong>${ml(fase2Resultado)}</strong> · Dosis por toma: <strong>${ml(fase2PorToma)}</strong></p><p style="margin: 8px 0 0 0; font-size: 1.1rem; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">Fase 3 (75%): <strong>${ml(fase3Resultado)}</strong> · Dosis por toma: <strong>${ml(fase3PorToma)}</strong></p><p style="margin: 8px 0 0 0; font-size: 1.1rem; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">Fase 4 (100%): <strong>${ml(fase4Resultado)}</strong> · Dosis por toma: <strong>${ml(fase4PorToma)}</strong></p>${anunciosHTML}` : '<p style="margin: 10px 0 0 0; font-size: 1rem; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">Sin días agregados</p>'}
            </div>
        `;

        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-file-medical-alt"></i> RER</h2>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    ${agregarDiaBtnHTML}
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showControlesAdicionalesView()">
                        <i class="fas fa-arrow-left"></i> Volver
                    </button>
                </div>
            </div>
            ${rerDosisSectionHTML}
            ${tabsHTML}
            ${tabContentsHTML}
        `;
    }

    showTabRer(diaKey) {
        const container = document.getElementById('internamiento-rer');
        if (!container) return;
        container.querySelectorAll('.rer-tab').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-rer-dia') === diaKey);
        });
        container.querySelectorAll('[id^="rer-tab-"]').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-rer-dia') === diaKey);
        });
    }

    async agregarDiaRer() {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        const resultadoCodigo = await this.verificarCodigoAsistente('agregar_dia_rer');
        if (!resultadoCodigo || !resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Agregar día RER cancelado', 'info');
            return;
        }
        this._agregarDiaRerPreescritoPor = resultadoCodigo.nombre || '';

        const internamiento = this.internamientos.get(this.currentInternamientoId);
        const rer = internamiento?.rer && typeof internamiento.rer === 'object' ? { ...internamiento.rer } : {};
        const dias = rer.dias && typeof rer.dias === 'object' ? { ...rer.dias } : {};
        const diasList = Object.entries(dias).sort((a, b) => (a[1].numero || 0) - (b[1].numero || 0));
        const MIN_TOMAS_POR_DIA = 5;

        if (diasList.length > 0) {
            const lastDay = diasList[diasList.length - 1];
            const lastDayTomas = Object.keys(lastDay[1].tomas || {}).length;
            if (lastDayTomas < MIN_TOMAS_POR_DIA) {
                this.showAlert(
                    `El día actual (Día ${lastDay[1].numero}) debe tener al menos ${MIN_TOMAS_POR_DIA} tomas para poder agregar un nuevo día. Actualmente tiene ${lastDayTomas}.`,
                    'Día incompleto',
                    'warning'
                );
                return;
            }
        }

        const esPrimerDia = diasList.length === 0;
        const modalContent = this.getAgregarDiaRerFormHTML(esPrimerDia);
        const modal = this.createModal('Agregar día RER', modalContent, 'fa-plus');
        document.body.appendChild(modal);
        this.setupAgregarDiaRerFormDefaults();
        const form = document.getElementById('formAgregarDiaRer');
        if (form) form.onsubmit = (e) => { e.preventDefault(); this.handleAgregarDiaRerSubmit(esPrimerDia); };
    }

    getAgregarDiaRerFormHTML(esPrimerDia) {
        const caloriasFieldHTML = esPrimerDia ? `
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>Cantidad de calorías totales *</label>
                    <input type="number" id="agregarDiaRerDosis" required min="0" step="1" placeholder="Ej: 1500" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                    <small style="color: #64748b; display: block; margin-top: 4px;">Solo se registra una vez. Los días siguientes usarán este mismo valor.</small>
                </div>` : '';
        return `
        <div style="max-height: 75vh; overflow-y: auto; padding: 10px;">
            <form id="formAgregarDiaRer">
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>Fecha y hora *</label>
                    <input type="datetime-local" id="agregarDiaRerFechaHora" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                    <small style="color: #64748b; display: block; margin-top: 4px;">Se toma la fecha y hora actual del equipo. Puede modificarla si lo desea.</small>
                </div>
                ${caloriasFieldHTML}
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>Observaciones adicionales</label>
                    <textarea id="agregarDiaRerObservaciones" rows="3" placeholder="Observaciones del día..." style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b; resize: vertical;"></textarea>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="background: var(--internamiento-primary); border-color: var(--internamiento-primary);"><i class="fas fa-save"></i> Crear día</button>
                </div>
            </form>
        </div>
        `;
    }

    setupAgregarDiaRerFormDefaults() {
        const input = document.getElementById('agregarDiaRerFechaHora');
        if (input) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const h = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            input.value = `${y}-${m}-${d}T${h}:${min}`;
        }
    }

    async handleAgregarDiaRerSubmit(esPrimerDia) {
        const fechaHoraVal = document.getElementById('agregarDiaRerFechaHora')?.value;
        const observaciones = document.getElementById('agregarDiaRerObservaciones')?.value?.trim() || '';
        if (!fechaHoraVal) {
            this.showAlert('Complete fecha y hora', 'Datos incompletos', 'warning');
            return;
        }
        if (esPrimerDia) {
            const dosis = document.getElementById('agregarDiaRerDosis')?.value?.trim();
            if (!dosis) {
                this.showAlert('Complete la cantidad de calorías totales', 'Datos incompletos', 'warning');
                return;
            }
        }
        const fechaHoraTs = new Date(fechaHoraVal).getTime();
        if (isNaN(fechaHoraTs)) {
            this.showAlert('Fecha y hora no válidas', 'Error', 'error');
            return;
        }

        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        const rer = internamiento?.rer && typeof internamiento.rer === 'object' ? { ...internamiento.rer } : {};
        const dias = rer.dias && typeof rer.dias === 'object' ? { ...rer.dias } : {};
        const caloriasTotales = esPrimerDia
            ? document.getElementById('agregarDiaRerDosis')?.value?.trim()
            : (rer.caloriasTotales != null && rer.caloriasTotales !== '' ? String(rer.caloriasTotales) : '');
        const dosisParaDia = esPrimerDia ? (document.getElementById('agregarDiaRerDosis')?.value?.trim() || '') : (rer.caloriasTotales != null ? String(rer.caloriasTotales) : '');

        if (esPrimerDia && !caloriasTotales) {
            this.showAlert('Complete la cantidad de calorías totales', 'Datos incompletos', 'warning');
            return;
        }

        const nextNum = Object.values(dias).reduce((max, d) => Math.max(max, d.numero || 0), 0) + 1;
        const diaKey = 'dia_' + nextNum;
        dias[diaKey] = {
            numero: nextNum,
            fechaRegistro: Date.now(),
            fechaHora: fechaHoraTs,
            dosis: dosisParaDia,
            observaciones: observaciones,
            preescritoPor: this._agregarDiaRerPreescritoPor || '',
            tomas: {}
        };
        rer.dias = dias;

        if (esPrimerDia) {
            rer.caloriasTotales = caloriasTotales;
            const hoy = new Date();
            const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
            const pesoHoy = internamiento?.metadata?.pesoHoy;
            const pesoParaFormula = (pesoHoy && pesoHoy.fecha === fechaHoy && pesoHoy.valor != null && pesoHoy.valor !== '')
                ? String(pesoHoy.valor)
                : (internamiento?.datosIngreso?.pesoIngreso != null ? String(internamiento.datosIngreso.pesoIngreso) : null);
            rer.pesoParaFormula = pesoParaFormula;
        }

        const updates = {};
        updates['rer/dias/' + diaKey] = dias[diaKey];
        updates['metadata/fechaUltimaActualizacion'] = Date.now();
        if (esPrimerDia) {
            updates['rer/caloriasTotales'] = rer.caloriasTotales;
            if (rer.pesoParaFormula != null) updates['rer/pesoParaFormula'] = rer.pesoParaFormula;
        }
        try {
            if (window.database && this.internamientosRef) {
                await this.internamientosRef.child(id).update(updates);
            }
            this.internamientos.set(id, { ...internamiento, rer });
            document.querySelector('.modal-overlay')?.remove();
            this.loadRerView();
            this.showNotification('Día agregado', 'success');
        } catch (err) {
            console.error('Error agregando día RER:', err);
            this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
        }
    }

    async eliminarDiaRer(diaKey) {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        if (!confirm('¿Eliminar este día de RER? Se borrarán también todas las tomas del día. Esta acción no se puede deshacer.')) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        const rer = internamiento?.rer && typeof internamiento.rer === 'object' ? { ...internamiento.rer } : {};
        const dias = rer.dias && typeof rer.dias === 'object' ? { ...rer.dias } : {};
        if (!dias[diaKey]) { this.showAlert('Día no encontrado', 'Error', 'error'); return; }
        delete dias[diaKey];
        rer.dias = dias;
        const updates = { 'metadata/fechaUltimaActualizacion': Date.now() };
        updates['rer/dias/' + diaKey] = null;
        try {
            if (window.database && this.internamientosRef) {
                await this.internamientosRef.child(id).update(updates);
            }
            this.internamientos.set(id, { ...internamiento, rer });
            this.loadRerView();
            this.showNotification('Día eliminado', 'success');
        } catch (err) {
            console.error('Error eliminando día RER:', err);
            this.showAlert('Error al eliminar: ' + (err.message || err), 'Error', 'error');
        }
    }

    async agregarTomasDiaRer(diaKey) {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        const resultadoCodigo = await this.verificarCodigoAsistente('agregar_toma_rer');
        if (!resultadoCodigo || !resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Registro de toma RER cancelado', 'info');
            return;
        }
        this._tomaRerRegistradoPor = resultadoCodigo.nombre || '';

        const internamiento = this.internamientos.get(this.currentInternamientoId);
        const diaData = internamiento?.rer?.dias?.[diaKey];
        const tomasDelDia = diaData?.tomas && typeof diaData.tomas === 'object' ? diaData.tomas : {};
        const horasUsadas = Object.values(tomasDelDia).map(t => t.hora).filter(Boolean);
        const modalContent = this.getTomaRerFormHTML(horasUsadas);
        const modal = this.createModal('Agregar toma del día', modalContent, 'fa-file-medical-alt');
        document.body.appendChild(modal);
        const form = document.getElementById('formTomaRer');
        if (form) form.onsubmit = (e) => { e.preventDefault(); this.handleTomaRerSubmit(diaKey); };
    }

    getTomaRerFormHTML(horasUsadas = []) {
        const horas = [
            { value: '8am', label: '8:00 AM' },
            { value: '12md', label: '12:00 MD' },
            { value: '4pm', label: '4:00 PM' },
            { value: '8pm', label: '8:00 PM' },
            { value: '12mn', label: '12:00 MN' }
        ];
        const horasDisponibles = horas.filter(h => !horasUsadas.includes(h.value));
        const sinHorasDisponibles = horasDisponibles.length === 0;
        const optionsHTML = sinHorasDisponibles
            ? '<option value="">No hay más horarios disponibles en este día</option>'
            : '<option value="">Seleccione la hora</option>' + horasDisponibles.map(h => `<option value="${h.value}">${h.label}</option>`).join('');
        return `
        <div style="max-height: 75vh; overflow-y: auto; padding: 10px;">
            <form id="formTomaRer">
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>Cantidad por toma *</label>
                    <input type="number" id="tomaRerCantidadPorToma" min="0" step="0.01" required placeholder="Ej: 50" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                </div>
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>Hora *</label>
                    <select id="tomaRerHora" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;" ${sinHorasDisponibles ? 'disabled' : ''}>
                        ${optionsHTML}
                    </select>
                    ${sinHorasDisponibles ? '<small style="color: #94a3b8; display: block; margin-top: 4px;">Ya se registraron tomas en todos los horarios de este día (8am, 12md, 4pm, 8pm, 12mn).</small>' : ''}
                </div>
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>Cantidad de agua (ml) *</label>
                    <input type="number" id="tomaRerCantidadAgua" min="0" step="1" required placeholder="Ej: 100" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="background: var(--internamiento-primary); border-color: var(--internamiento-primary);" ${sinHorasDisponibles ? 'disabled' : ''}><i class="fas fa-save"></i> Guardar toma</button>
                </div>
            </form>
        </div>
        `;
    }

    async handleTomaRerSubmit(diaKey) {
        const cantidadPorToma = document.getElementById('tomaRerCantidadPorToma')?.value;
        const hora = document.getElementById('tomaRerHora')?.value;
        const cantidadAgua = document.getElementById('tomaRerCantidadAgua')?.value;
        if (cantidadPorToma === '' || !hora || cantidadAgua === '') {
            this.showAlert('Complete todos los campos obligatorios', 'Datos incompletos', 'warning');
            return;
        }
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        if (!internamiento) { this.showAlert('No se encontró el internamiento', 'Error', 'error'); return; }
        const rer = internamiento.rer && typeof internamiento.rer === 'object' ? { ...internamiento.rer } : {};
        const dias = rer.dias && typeof rer.dias === 'object' ? { ...rer.dias } : {};
        const diaData = dias[diaKey];
        if (!diaData) { this.showAlert('No se encontró el día', 'Error', 'error'); return; }
        const tomas = diaData.tomas && typeof diaData.tomas === 'object' ? { ...diaData.tomas } : {};
        const tomaId = 'toma_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const record = {
            cantidadPorToma: cantidadPorToma,
            hora: hora,
            cantidadAgua: cantidadAgua,
            fechaRegistro: Date.now(),
            registradoPorNombre: this._tomaRerRegistradoPor || ''
        };
        tomas[tomaId] = record;
        const updatedDia = { ...diaData, tomas };
        dias[diaKey] = updatedDia;
        rer.dias = dias;

        const updates = {};
        updates['rer/dias/' + diaKey] = updatedDia;
        updates['metadata/fechaUltimaActualizacion'] = Date.now();
        try {
            if (window.database && this.internamientosRef) {
                await this.internamientosRef.child(id).update(updates);
            }
            this.internamientos.set(id, { ...internamiento, rer });
            delete this._rerCountdownVencidoPorId[id];
            this._saveCountdownVencidoStorage();
            document.querySelector('.modal-overlay')?.remove();
            this.loadRerView();
            this.showNotification('Toma registrada', 'success');
        } catch (err) {
            console.error('Error guardando toma RER:', err);
            this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
        }
    }

    showAlimentacionAsistidaView() {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.estado?.actual === 'egresado') {
            this.showAlert('No se puede acceder a Alimentación asistida en un internamiento egresado', 'Acción Bloqueada', 'warning');
            return;
        }
        this.showInternamientoView('alimentacion_asistida');
        setTimeout(() => this.loadAlimentacionAsistidaView(), 100);
    }

    loadAlimentacionAsistidaView() {
        const container = document.getElementById('internamiento-alimentacion_asistida');
        if (!container) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        const aa = internamiento?.alimentacionAsistida && typeof internamiento.alimentacionAsistida === 'object' ? internamiento.alimentacionAsistida : {};
        const dias = aa.dias && typeof aa.dias === 'object' ? aa.dias : {};
        const diasList = Object.entries(dias).sort((a, b) => (a[1].numero || 0) - (b[1].numero || 0));
        const hasDias = diasList.length > 0;
        const MIN_TOMAS_POR_DIA = 5;
        const lastDay = hasDias ? diasList[diasList.length - 1] : null;
        const lastDayTomas = lastDay ? Object.keys(lastDay[1].tomas || {}).length : 0;
        const lastDayComplete = lastDayTomas >= MIN_TOMAS_POR_DIA;
        const canAddNewDay = !hasDias || lastDayComplete;

        const tabsHTML = hasDias
            ? `
            <div class="tabs-container rer-tabs-vertical" style="margin-top: 20px;">
                ${diasList.map(([diaKey, data], idx) => {
                    const numTomas = Object.keys(data.tomas || {}).length;
                    const completo = numTomas >= MIN_TOMAS_POR_DIA;
                    const label = `Día ${data.numero != null ? data.numero : idx + 1} (${numTomas}/${MIN_TOMAS_POR_DIA})`;
                    return `
                    <button class="tab-btn aa-tab ${idx === 0 ? 'active' : ''}" data-aa-dia="${diaKey}" onclick="window.internamientoModule.showTabAlimentacionAsistida('${diaKey}')" title="${completo ? 'Día completo' : `Faltan ${MIN_TOMAS_POR_DIA - numTomas} tomas`}">
                        ${label}${completo ? ' ✓' : ''}
                    </button>
                `;
                }).join('')}
            </div>
            `
            : '';

        const tabContentsHTML = hasDias
            ? diasList.map(([diaKey, data], idx) => {
                const tomas = data.tomas && typeof data.tomas === 'object' ? data.tomas : {};
                const tomasList = Object.values(tomas).sort((a, b) => (a.horaRegistro || 0) - (b.horaRegistro || 0));
                const isActive = idx === 0;
                const fechaHoraStr = data.fechaHora ? (function(ts) { const d = new Date(ts); return isNaN(d.getTime()) ? '' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }); })(data.fechaHora) : '';
                const dosisStr = (data.dosis || '').replace(/</g, '&lt;');
                const obsStr = (data.observaciones || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
                const freqTipo = data.frecuenciaTipo === 'minutos' ? 'minutos' : (data.frecuenciaTipo === 'horas' ? 'horas' : '');
                const freqVal = data.frecuenciaValor != null && data.frecuenciaValor !== '' ? data.frecuenciaValor : '';
                const frecuenciaStr = (freqTipo && freqVal) ? `Cada ${freqVal} ${freqTipo}` : '';
                const preescritoPorStr = (data.preescritoPor || '').replace(/</g, '&lt;');
                const infoDiaHTML = (fechaHoraStr || dosisStr || obsStr || frecuenciaStr || preescritoPorStr) ? `
                        <div style="padding: 16px 20px; background: #f0f9f0; border-bottom: 1px solid #e2e8f0;">
                            ${fechaHoraStr ? `<div style="font-size: 0.9rem; color: #475569; margin-bottom: 6px;"><i class="fas fa-calendar-alt"></i> ${fechaHoraStr}</div>` : ''}
                            ${frecuenciaStr ? `<div style="font-size: 0.9rem; color: #334155;"><strong>Frecuencia:</strong> ${frecuenciaStr.replace(/</g, '&lt;')}</div>` : ''}
                            ${dosisStr ? `<div style="font-size: 0.9rem; color: #334155;"><strong>Dosis:</strong> ${dosisStr}</div>` : ''}
                            ${obsStr ? `<div style="font-size: 0.9rem; color: #475569; margin-top: 6px;"><strong>Observaciones:</strong> ${obsStr}</div>` : ''}
                            ${preescritoPorStr ? `<div style="font-size: 0.9rem; color: #475569; margin-top: 6px;"><strong>Preescrito por:</strong> ${preescritoPorStr}</div>` : ''}
                        </div>
                ` : '';
                return `
                <div id="aa-tab-${diaKey}" class="tab-content ${isActive ? 'active' : ''}" data-aa-dia="${diaKey}">
                    <div style="background: white; border-radius: 12px; margin-top: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden;">
                        ${infoDiaHTML}
                        <div style="padding: 20px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; border-bottom: 1px solid #e2e8f0;">
                            <button class="btn btn-primary" onclick="window.internamientoModule.agregarTomasDiaAlimentacionAsistida('${diaKey}')" style="background: #2e7d32; border-color: #2e7d32;">
                                <i class="fas fa-plus"></i> Agregar tomas del día
                            </button>
                            <button class="btn btn-secondary" onclick="window.internamientoModule.eliminarDiaAlimentacionAsistida('${diaKey}')" style="color: #b91c1c; border-color: #b91c1c;">
                                <i class="fas fa-trash-alt"></i> Eliminar día
                            </button>
                        </div>
                        <div style="padding: 20px;">
                            ${tomasList.length > 0
                                ? `<div style="display: flex; flex-direction: column; gap: 10px;">${tomasList.map(t => {
                                    const horaReg = t.horaRegistro ? (function(ts) { const d = new Date(ts); return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { timeStyle: 'short' }); })(t.horaRegistro) : '—';
                                    const cant = t.cantidadPorToma != null && t.cantidadPorToma !== '' ? t.cantidadPorToma : '—';
                                    const agua = t.cantidadAgua != null && t.cantidadAgua !== '' ? t.cantidadAgua + ' ml' : '—';
                                    const registradoPor = (t.registradoPorNombre || '').replace(/</g, '&lt;');
                                    return `
                                    <div style="border: 1px solid #e2e8f0; border-left: 4px solid #2e7d32; border-radius: 8px; padding: 12px; background: #f8fafc;">
                                        <div style="font-weight: 600; color: #334155; margin-bottom: 4px;"><i class="fas fa-clock"></i> ${horaReg.replace(/</g, '&lt;')}</div>
                                        <div style="font-size: 0.9rem; color: #64748b;">Cantidad por toma: ${cant} · Agua: ${agua}</div>
                                        ${registradoPor ? `<div style="font-size: 0.85rem; color: #94a3b8; margin-top: 4px;"><i class="fas fa-user"></i> Registrado por: ${registradoPor}</div>` : ''}
                                    </div>
                                    `;
                                }).join('')}</div>`
                                : `
                                <div style="padding: 32px 20px; text-align: center; color: #6c757d;">
                                    <i class="fas fa-utensils" style="font-size: 2rem; color: #2e7d32; opacity: 0.8;"></i>
                                    <p style="margin: 12px 0 0 0; font-size: 0.95rem;">No hay tomas en este día. Use «Agregar tomas del día» para registrar (se guardará la hora de la computadora).</p>
                                </div>
                                `}
                        </div>
                    </div>
                </div>
                `;
            }).join('')
            : `
            <div style="margin-top: 24px;">
                <div class="empty-state" style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; color: #6c757d;">
                    <i class="fas fa-utensils" style="font-size: 2.5rem; color: #2e7d32; margin-bottom: 16px; opacity: 0.8;"></i>
                    <p style="margin: 0 0 8px 0; font-size: 1rem;">No hay días registrados</p>
                    <p style="margin: 0; font-size: 0.9rem;">Use «Agregar día» para registrar un nuevo día de Alimentación asistida.</p>
                </div>
            </div>
            `;

        const agregarDiaBtnDisabled = !canAddNewDay;
        const agregarDiaTitle = canAddNewDay ? 'Agregar un nuevo día' : 'Complete el día actual con al menos 5 tomas para poder agregar un nuevo día';
        const agregarDiaBtnHTML = agregarDiaBtnDisabled
            ? `<button class="btn btn-primary" disabled title="${agregarDiaTitle}" style="background: #2e7d32; border-color: #2e7d32; opacity: 0.6; cursor: not-allowed;">
                <i class="fas fa-plus"></i> Agregar día
                ${hasDias && !lastDayComplete ? ` <span style="font-size: 0.85rem; opacity: 0.9;">(mín. 5 tomas en Día ${lastDay[1].numero})</span>` : ''}
            </button>`
            : `<button class="btn btn-primary" onclick="window.internamientoModule.agregarDiaAlimentacionAsistida()" title="${agregarDiaTitle}" style="background: #2e7d32; border-color: #2e7d32;">
                <i class="fas fa-plus"></i> Agregar día
            </button>`;

        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-utensils"></i> Alimentación asistida</h2>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    ${agregarDiaBtnHTML}
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showControlesAdicionalesView()">
                        <i class="fas fa-arrow-left"></i> Volver
                    </button>
                </div>
            </div>
            ${tabsHTML}
            ${tabContentsHTML}
        `;
    }

    showTabAlimentacionAsistida(diaKey) {
        const container = document.getElementById('internamiento-alimentacion_asistida');
        if (!container) return;
        container.querySelectorAll('.aa-tab').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-aa-dia') === diaKey);
        });
        container.querySelectorAll('[id^="aa-tab-"]').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-aa-dia') === diaKey);
        });
    }

    async agregarDiaAlimentacionAsistida() {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        const resultadoCodigo = await this.verificarCodigoAsistente('agregar_dia_alimentacion_asistida');
        if (!resultadoCodigo || !resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Agregar día Alimentación asistida cancelado', 'info');
            return;
        }
        this._agregarDiaAAPreescritoPor = resultadoCodigo.nombre || '';

        const internamiento = this.internamientos.get(this.currentInternamientoId);
        const aa = internamiento?.alimentacionAsistida && typeof internamiento.alimentacionAsistida === 'object' ? internamiento.alimentacionAsistida : {};
        const dias = aa.dias && typeof aa.dias === 'object' ? aa.dias : {};
        const diasList = Object.entries(dias).sort((a, b) => (a[1].numero || 0) - (b[1].numero || 0));
        const MIN_TOMAS_POR_DIA = 5;
        if (diasList.length > 0) {
            const lastDay = diasList[diasList.length - 1];
            const lastDayTomas = Object.keys(lastDay[1].tomas || {}).length;
            if (lastDayTomas < MIN_TOMAS_POR_DIA) {
                this.showAlert(`El día actual (Día ${lastDay[1].numero}) debe tener al menos ${MIN_TOMAS_POR_DIA} tomas para poder agregar un nuevo día. Actualmente tiene ${lastDayTomas}.`, 'Día incompleto', 'warning');
                return;
            }
        }
        const modalContent = this.getAgregarDiaAlimentacionAsistidaFormHTML();
        const modal = this.createModal('Agregar día - Alimentación asistida', modalContent, 'fa-plus');
        document.body.appendChild(modal);
        this.setupAgregarDiaAlimentacionAsistidaFormDefaults();
        const form = document.getElementById('formAgregarDiaAlimentacionAsistida');
        if (form) form.onsubmit = (e) => { e.preventDefault(); this.handleAgregarDiaAlimentacionAsistidaSubmit(); };
    }

    getAgregarDiaAlimentacionAsistidaFormHTML() {
        return `
        <div style="max-height: 75vh; overflow-y: auto; padding: 10px;">
            <form id="formAgregarDiaAlimentacionAsistida">
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>Fecha y hora *</label>
                    <input type="datetime-local" id="aaDiaFechaHora" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                    <small style="color: #64748b; display: block; margin-top: 4px;">Se toma la fecha y hora actual del equipo. Puede modificarla si lo desea.</small>
                </div>
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>¿Se va a dar la comida cada cuánto? *</label>
                    <div style="display: flex; gap: 24px; margin-bottom: 12px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="radio" name="aaDiaFrecuenciaTipo" value="minutos" id="aaDiaFrecuenciaMinutos">
                            En minutos
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="radio" name="aaDiaFrecuenciaTipo" value="horas" id="aaDiaFrecuenciaHoras">
                            En horas
                        </label>
                    </div>
                    <div class="form-group" style="margin-top: 8px;">
                        <label>Frecuencia *</label>
                        <input type="number" id="aaDiaFrecuenciaValor" min="1" step="1" required placeholder="Ej: 30 (minutos) o 4 (horas)" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>Dosis *</label>
                    <input type="text" id="aaDiaDosis" required placeholder="Ej: 10 mg/kg" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                </div>
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>Observaciones adicionales</label>
                    <textarea id="aaDiaObservaciones" rows="3" placeholder="Observaciones del día..." style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b; resize: vertical;"></textarea>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="background: #2e7d32; border-color: #2e7d32;"><i class="fas fa-save"></i> Crear día</button>
                </div>
            </form>
        </div>
        `;
    }

    setupAgregarDiaAlimentacionAsistidaFormDefaults() {
        const input = document.getElementById('aaDiaFechaHora');
        if (input) {
            const now = new Date();
            const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
            const h = String(now.getHours()).padStart(2, '0'), min = String(now.getMinutes()).padStart(2, '0');
            input.value = `${y}-${m}-${d}T${h}:${min}`;
        }
        const radioHoras = document.getElementById('aaDiaFrecuenciaHoras');
        if (radioHoras) radioHoras.checked = true;
        const freqVal = document.getElementById('aaDiaFrecuenciaValor');
        if (freqVal) freqVal.value = '4';
    }

    async handleAgregarDiaAlimentacionAsistidaSubmit() {
        const fechaHoraVal = document.getElementById('aaDiaFechaHora')?.value;
        const dosis = document.getElementById('aaDiaDosis')?.value?.trim();
        const observaciones = document.getElementById('aaDiaObservaciones')?.value?.trim() || '';
        const frecuenciaTipo = document.querySelector('input[name="aaDiaFrecuenciaTipo"]:checked')?.value;
        const frecuenciaValor = document.getElementById('aaDiaFrecuenciaValor')?.value;
        if (!fechaHoraVal || !dosis) { this.showAlert('Complete fecha/hora y dosis', 'Datos incompletos', 'warning'); return; }
        if (!frecuenciaTipo || frecuenciaTipo !== 'minutos' && frecuenciaTipo !== 'horas') { this.showAlert('Elija si la frecuencia es en minutos o en horas', 'Datos incompletos', 'warning'); return; }
        const freqNum = parseInt(frecuenciaValor, 10);
        if (!frecuenciaValor || isNaN(freqNum) || freqNum < 1) { this.showAlert('Ingrese una frecuencia válida (número mayor a 0)', 'Datos incompletos', 'warning'); return; }
        const fechaHoraTs = new Date(fechaHoraVal).getTime();
        if (isNaN(fechaHoraTs)) { this.showAlert('Fecha y hora no válidas', 'Error', 'error'); return; }
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        const aa = internamiento?.alimentacionAsistida && typeof internamiento.alimentacionAsistida === 'object' ? { ...internamiento.alimentacionAsistida } : {};
        const dias = aa.dias && typeof aa.dias === 'object' ? { ...aa.dias } : {};
        const nextNum = Object.values(dias).reduce((max, d) => Math.max(max, d.numero || 0), 0) + 1;
        const diaKey = 'dia_' + nextNum;
        dias[diaKey] = { numero: nextNum, fechaRegistro: Date.now(), fechaHora: fechaHoraTs, dosis: dosis, observaciones: observaciones, frecuenciaTipo: frecuenciaTipo, frecuenciaValor: freqNum, preescritoPor: this._agregarDiaAAPreescritoPor || '', tomas: {} };
        aa.dias = dias;
        const updates = {};
        updates['alimentacionAsistida/dias/' + diaKey] = dias[diaKey];
        updates['metadata/fechaUltimaActualizacion'] = Date.now();
        try {
            if (window.database && this.internamientosRef) { await this.internamientosRef.child(id).update(updates); }
            this.internamientos.set(id, { ...internamiento, alimentacionAsistida: aa });
            document.querySelector('.modal-overlay')?.remove();
            this.loadAlimentacionAsistidaView();
            this.showNotification('Día agregado', 'success');
        } catch (err) {
            console.error('Error agregando día Alimentación asistida:', err);
            this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
        }
    }

    async eliminarDiaAlimentacionAsistida(diaKey) {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        if (!confirm('¿Eliminar este día de Alimentación asistida? Se borrarán también todas las tomas del día. Esta acción no se puede deshacer.')) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        const aa = internamiento?.alimentacionAsistida && typeof internamiento.alimentacionAsistida === 'object' ? { ...internamiento.alimentacionAsistida } : {};
        const dias = aa.dias && typeof aa.dias === 'object' ? { ...aa.dias } : {};
        if (!dias[diaKey]) { this.showAlert('Día no encontrado', 'Error', 'error'); return; }
        delete dias[diaKey];
        aa.dias = dias;
        const updates = { 'metadata/fechaUltimaActualizacion': Date.now() };
        updates['alimentacionAsistida/dias/' + diaKey] = null;
        try {
            if (window.database && this.internamientosRef) {
                await this.internamientosRef.child(id).update(updates);
            }
            this.internamientos.set(id, { ...internamiento, alimentacionAsistida: aa });
            this.loadAlimentacionAsistidaView();
            this.showNotification('Día eliminado', 'success');
        } catch (err) {
            console.error('Error eliminando día Alimentación asistida:', err);
            this.showAlert('Error al eliminar: ' + (err.message || err), 'Error', 'error');
        }
    }

    async agregarTomasDiaAlimentacionAsistida(diaKey) {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        const resultadoCodigo = await this.verificarCodigoAsistente('agregar_toma_alimentacion_asistida');
        if (!resultadoCodigo || !resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Registro de toma Alimentación asistida cancelado', 'info');
            return;
        }
        this._tomaAARegistradoPor = resultadoCodigo.nombre || '';

        const modalContent = this.getTomaAlimentacionAsistidaFormHTML();
        const modal = this.createModal('Agregar toma del día', modalContent, 'fa-utensils');
        document.body.appendChild(modal);
        const form = document.getElementById('formTomaAlimentacionAsistida');
        if (form) form.onsubmit = (e) => { e.preventDefault(); this.handleTomaAlimentacionAsistidaSubmit(diaKey); };
    }

    getTomaAlimentacionAsistidaFormHTML() {
        return `
        <div style="max-height: 75vh; overflow-y: auto; padding: 10px;">
            <form id="formTomaAlimentacionAsistida">
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>Cantidad por toma *</label>
                    <input type="number" id="tomaAACantidadPorToma" min="0" step="0.01" required placeholder="Ej: 50" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                </div>
                <div class="form-group" style="margin-bottom: 18px;">
                    <label>Cantidad de agua (ml) *</label>
                    <input type="number" id="tomaAACantidadAgua" min="0" step="1" required placeholder="Ej: 100" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                </div>
                <small style="color: #64748b; display: block; margin-bottom: 12px;"><i class="fas fa-info-circle"></i> Al guardar se registrará la hora actual de la computadora.</small>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="background: #2e7d32; border-color: #2e7d32;"><i class="fas fa-save"></i> Guardar toma</button>
                </div>
            </form>
        </div>
        `;
    }

    async handleTomaAlimentacionAsistidaSubmit(diaKey) {
        const cantidadPorToma = document.getElementById('tomaAACantidadPorToma')?.value;
        const cantidadAgua = document.getElementById('tomaAACantidadAgua')?.value;
        if (cantidadPorToma === '' || cantidadAgua === '') {
            this.showAlert('Complete todos los campos obligatorios', 'Datos incompletos', 'warning');
            return;
        }
        const horaRegistro = Date.now();
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        if (!internamiento) { this.showAlert('No se encontró el internamiento', 'Error', 'error'); return; }
        const aa = internamiento.alimentacionAsistida && typeof internamiento.alimentacionAsistida === 'object' ? { ...internamiento.alimentacionAsistida } : {};
        const dias = aa.dias && typeof aa.dias === 'object' ? { ...aa.dias } : {};
        const diaData = dias[diaKey];
        if (!diaData) { this.showAlert('No se encontró el día', 'Error', 'error'); return; }
        const tomas = diaData.tomas && typeof diaData.tomas === 'object' ? { ...diaData.tomas } : {};
        const tomaId = 'toma_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        tomas[tomaId] = { cantidadPorToma, cantidadAgua, horaRegistro, fechaRegistro: horaRegistro, registradoPorNombre: this._tomaAARegistradoPor || '' };
        const updatedDia = { ...diaData, tomas };
        dias[diaKey] = updatedDia;
        aa.dias = dias;
        const updates = {};
        updates['alimentacionAsistida/dias/' + diaKey] = updatedDia;
        updates['metadata/fechaUltimaActualizacion'] = Date.now();
        try {
            if (window.database && this.internamientosRef) { await this.internamientosRef.child(id).update(updates); }
            this.internamientos.set(id, { ...internamiento, alimentacionAsistida: aa });
            document.querySelector('.modal-overlay')?.remove();
            // Reiniciar contador de Alimentación asistida al registrar una nueva toma
            if (id) {
                delete this._aaCountdownVencidoPorId[id];
                this._saveCountdownVencidoStorage();
                this.renderPanelHeader(this.internamientos.get(id));
            }
            this.loadAlimentacionAsistidaView();
            this.showNotification('Toma registrada (hora guardada)', 'success');
        } catch (err) {
            console.error('Error guardando toma Alimentación asistida:', err);
            this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
        }
    }

    showHidratacionView() {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.estado?.actual === 'egresado') {
            this.showAlert('No se puede acceder a Hidratación en un internamiento egresado', 'Acción Bloqueada', 'warning');
            return;
        }
        this.showInternamientoView('hidratacion');
        setTimeout(() => this.loadHidratacionView(), 100);
    }

    loadHidratacionView() {
        const container = document.getElementById('internamiento-hidratacion');
        if (!container) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        const hidratacion = internamiento?.hidratacion && typeof internamiento.hidratacion === 'object' ? internamiento.hidratacion : {};
        const registrosObj = hidratacion.registros && typeof hidratacion.registros === 'object' ? hidratacion.registros : {};
        const registros = Object.entries(registrosObj).map(([k, v]) => ({ ...v, id: v.id || k })).sort((a, b) => {
            const ta = a.fechaHora ? new Date(a.fechaHora).getTime() : 0;
            const tb = b.fechaHora ? new Date(b.fechaHora).getTime() : 0;
            return ta - tb;
        });
        const hasRegistros = registros.length > 0;

        const registrosHTML = hasRegistros
            ? `
            <div style="background: white; border-radius: 12px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden;">
                <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #334155;">
                    <i class="fas fa-list"></i> Registros de hidratación (${registros.length})
                </div>
                <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
                    ${registros.map((r, idx) => {
                        const fechaHora = r.fechaHora ? (function(ts) { const d = new Date(ts); return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }); })(r.fechaHora) : '—';
                        const tipo = (r.tipo || '—').replace(/</g, '&lt;');
                        const volumen = r.volumen != null && r.volumen !== '' ? r.volumen + ' ml' : '—';
                        const obs = (r.observaciones || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
                        const registradoPor = (r.registradoPorNombre || '').replace(/</g, '&lt;');
                        return `
                        <div style="border: 1px solid #e2e8f0; border-left: 4px solid #0288d1; border-radius: 8px; padding: 12px; background: #f8fafc;">
                            <div style="font-weight: 600; color: #334155;"><i class="fas fa-tint"></i> ${fechaHora} · ${tipo} · ${volumen}</div>
                            ${obs ? `<div style="font-size: 0.9rem; color: #64748b; margin-top: 6px;">${obs}</div>` : ''}
                            ${registradoPor ? `<div style="font-size: 0.85rem; color: #94a3b8; margin-top: 4px;"><i class="fas fa-user"></i> Registrado por: ${registradoPor}</div>` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            `
            : '';

        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-tint"></i> Hidratación</h2>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="window.internamientoModule.agregarRegistroHidratacion()" style="background: #0288d1; border-color: #0288d1;">
                        <i class="fas fa-plus"></i> Registrar hidratación
                    </button>
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showControlesAdicionalesView()">
                        <i class="fas fa-arrow-left"></i> Volver
                    </button>
                </div>
            </div>
            <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border: 1px solid #90caf9; border-radius: 12px; padding: 24px; margin-top: 20px;">
                <p style="margin: 0 0 12px 0; color: #1565c0; font-weight: 600;"><i class="fas fa-info-circle"></i> Fluidoterapia e hidratación</p>
                <p style="margin: 0; color: #334155; font-size: 0.95rem; line-height: 1.5;">Registre aquí los aportes de fluidos (sueros, volumen y tipo) para el paciente durante el internamiento.</p>
            </div>
            ${hasRegistros ? registrosHTML : `
            <div class="empty-state" style="background: white; padding: 40px; margin-top: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; color: #64748b;">
                <i class="fas fa-tint" style="font-size: 2.5rem; color: #0288d1; margin-bottom: 16px; opacity: 0.8;"></i>
                <p style="margin: 0 0 8px 0; font-size: 1rem;">No hay registros de hidratación</p>
                <p style="margin: 0; font-size: 0.9rem;">Use «Registrar hidratación» para agregar fluidoterapia o aportes de líquidos.</p>
            </div>
            `}
        `;
    }

    async agregarRegistroHidratacion() {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.estado?.actual === 'egresado') {
            this.showAlert('No se puede registrar hidratación en un internamiento egresado', 'Acción Bloqueada', 'warning');
            return;
        }
        const resultadoCodigo = await this.verificarCodigoAsistente('agregar_hidratacion');
        if (!resultadoCodigo || !resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Registro de hidratación cancelado', 'info');
            return;
        }
        this._hidratacionRegistradoPor = resultadoCodigo.nombre || '';

        const modalContent = `
            <form id="formHidratacion" style="max-height: 70vh; overflow-y: auto;">
                <p style="margin: 0 0 16px 0; padding: 10px 12px; background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 8px; font-size: 0.9rem; color: #0c4a6e;">
                    <i class="fas fa-clock"></i> La fecha y hora se registran automáticamente según la computadora.
                </p>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label>Tipo</label>
                    <select id="hidratacionTipo" class="form-control" style="width:100%;padding:10px;border-radius:6px;color:#1e293b;background:#f8fafc;border:1px solid #cbd5e1;">
                        <option value="">Seleccione...</option>
                        <option value="Cloruro">Cloruro</option>
                        <option value="Ringer">Ringer</option>
                        <option value="Dextrosa">Dextrosa</option>
                        <option value="Suero mixto">Suero mixto</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label>Volumen (ml)</label>
                    <input type="number" id="hidratacionVolumen" class="form-control" min="1" placeholder="Ej. 500" style="width:100%;padding:10px;border-radius:6px;color:#1e293b;background:#f8fafc;border:1px solid #cbd5e1;">
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                    <label>Observaciones</label>
                    <textarea id="hidratacionObservaciones" class="form-control" rows="2" placeholder="Opcional" style="width:100%;padding:10px;border-radius:6px;color:#1e293b;background:#f8fafc;border:1px solid #cbd5e1;"></textarea>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="background:#0288d1;border-color:#0288d1;"><i class="fas fa-save"></i> Guardar</button>
                </div>
            </form>
        `;
        const modal = this.createModal('Registrar hidratación', modalContent, 'fa-tint');
        document.body.appendChild(modal);
        const form = document.getElementById('formHidratacion');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const tipo = document.getElementById('hidratacionTipo')?.value?.trim() || '';
                const volumen = document.getElementById('hidratacionVolumen')?.value?.trim() || '';
                const observaciones = document.getElementById('hidratacionObservaciones')?.value?.trim() || '';
                if (!tipo && !volumen) {
                    this.showAlert('Indique al menos tipo o volumen.', 'Datos requeridos', 'warning');
                    return;
                }
                const registroId = 'hid_' + Date.now();
                const nuevo = {
                    id: registroId,
                    fechaHora: new Date().toISOString(),
                    tipo: tipo || '—',
                    volumen: volumen ? parseInt(volumen, 10) : null,
                    observaciones: observaciones || '',
                    registradoPorNombre: this._hidratacionRegistradoPor || ''
                };
                const updates = {};
                updates[`hidratacion/registros/${registroId}`] = nuevo;
                updates['metadata/fechaUltimaActualizacion'] = Date.now();
                const ref = this.internamientosRef.child(this.currentInternamientoId);
                ref.update(updates).then(() => {
                    const intern = this.internamientos.get(this.currentInternamientoId);
                    if (intern) {
                        const h = intern.hidratacion || {};
                        const regs = h.registros || {};
                        regs[registroId] = nuevo;
                        intern.hidratacion = { ...h, registros: regs };
                    }
                    this.showNotification('Hidratación registrada', 'success');
                    document.querySelector('.modal-overlay')?.remove();
                    this.loadHidratacionView();
                }).catch(err => {
                    this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
                });
            });
        }
    }

    showCurvaGlucosaView() {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.estado?.actual === 'egresado') {
            this.showAlert('No se puede acceder a Curva de glucosa en un internamiento egresado', 'Acción Bloqueada', 'warning');
            return;
        }
        this.showInternamientoView('curva_glucosa');
        setTimeout(() => this.loadCurvaGlucosaView(), 100);
    }

    loadCurvaGlucosaView() {
        const container = document.getElementById('internamiento-curva_glucosa');
        if (!container) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        const curva = internamiento?.curvaGlucosa && typeof internamiento.curvaGlucosa === 'object' ? internamiento.curvaGlucosa : {};
        const medicionesObj = curva.mediciones && typeof curva.mediciones === 'object' ? curva.mediciones : {};
        const mediciones = Object.entries(medicionesObj).map(([k, v]) => ({ ...v, id: v.id || k })).sort((a, b) => {
            const ta = a.fechaHora ? new Date(a.fechaHora).getTime() : 0;
            const tb = b.fechaHora ? new Date(b.fechaHora).getTime() : 0;
            return ta - tb;
        });
        const hasMediciones = mediciones.length > 0;

        const medicionesHTML = hasMediciones
            ? `
            <div style="background: white; border-radius: 12px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden;">
                <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #334155;">
                    <i class="fas fa-list"></i> Mediciones (${mediciones.length})
                </div>
                <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
                    ${mediciones.map((r) => {
                        const fechaHora = r.fechaHora ? (function(ts) { const d = new Date(ts); return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }); })(r.fechaHora) : '—';
                        const valor = r.valor != null && r.valor !== '' ? r.valor + ' mg/dL' : '—';
                        const obs = (r.observaciones || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
                        const insulina = r.insulinaAplicada && (r.cantidadInsulina != null || r.tipoInsulina) ? (r.cantidadInsulina != null ? r.cantidadInsulina + ' UI' : '') + (r.tipoInsulina ? (r.cantidadInsulina != null ? ' ' : '') + (r.tipoInsulina || '').replace(/</g, '&lt;') : '') : '';
                        const registradoPor = (r.registradoPorNombre || '').replace(/</g, '&lt;');
                        return `
                        <div style="border: 1px solid #e2e8f0; border-left: 4px solid #7b1fa2; border-radius: 8px; padding: 12px; background: #f8fafc;">
                            <div style="font-weight: 600; color: #334155;"><i class="fas fa-chart-line"></i> ${fechaHora} · Glucosa: ${valor}</div>
                            ${insulina ? `<div style="font-size: 0.9rem; color: #6a1b9a; margin-top: 4px;"><i class="fas fa-syringe"></i> Insulina: ${insulina}</div>` : ''}
                            ${obs ? `<div style="font-size: 0.9rem; color: #64748b; margin-top: 6px;">${obs}</div>` : ''}
                            ${registradoPor ? `<div style="font-size: 0.85rem; color: #94a3b8; margin-top: 4px;"><i class="fas fa-user"></i> Registrado por: ${registradoPor}</div>` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            `
            : '';

        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-chart-line"></i> Curva de glucosa</h2>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="window.internamientoModule.agregarMedicionCurvaGlucosa()" style="background: #7b1fa2; border-color: #7b1fa2;">
                        <i class="fas fa-plus"></i> Registrar medición
                    </button>
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showControlesAdicionalesView()">
                        <i class="fas fa-arrow-left"></i> Volver
                    </button>
                </div>
            </div>
            <div style="background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); border: 1px solid #ce93d8; border-radius: 12px; padding: 24px; margin-top: 20px;">
                <p style="margin: 0 0 12px 0; color: #6a1b9a; font-weight: 600;"><i class="fas fa-info-circle"></i> Curva de glucosa</p>
                <p style="margin: 0; color: #334155; font-size: 0.95rem; line-height: 1.5;">Registre aquí las mediciones de glucosa en sangre (mg/dL) del paciente. La fecha y hora se toman automáticamente de la computadora.</p>
            </div>
            ${hasMediciones ? medicionesHTML : `
            <div class="empty-state" style="background: white; padding: 40px; margin-top: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; color: #64748b;">
                <i class="fas fa-chart-line" style="font-size: 2.5rem; color: #7b1fa2; margin-bottom: 16px; opacity: 0.8;"></i>
                <p style="margin: 0 0 8px 0; font-size: 1rem;">No hay mediciones registradas</p>
                <p style="margin: 0; font-size: 0.9rem;">Use «Registrar medición» para agregar puntos de la curva de glucosa.</p>
            </div>
            `}
        `;
    }

    async agregarMedicionCurvaGlucosa() {
        if (!this.currentInternamientoId) { this.showAlert('No hay internamiento seleccionado', 'Error', 'error'); return; }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.estado?.actual === 'egresado') {
            this.showAlert('No se puede registrar en un internamiento egresado', 'Acción Bloqueada', 'warning');
            return;
        }
        const resultadoCodigo = await this.verificarCodigoAsistente('guardar_glucosa');
        if (!resultadoCodigo || !resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Registro de medición de glucosa cancelado', 'info');
            return;
        }
        this._glucosaRegistradoPor = resultadoCodigo.nombre || '';

        const modalContent = `
            <form id="formCurvaGlucosa" style="max-height: 70vh; overflow-y: auto;">
                <p style="margin: 0 0 16px 0; padding: 10px 12px; background: #f3e5f5; border: 1px solid #ce93d8; border-radius: 8px; font-size: 0.9rem; color: #4a148c;">
                    <i class="fas fa-clock"></i> La fecha y hora se registran automáticamente según la computadora.
                </p>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label>Glucosa (mg/dL)</label>
                    <input type="number" id="curvaGlucosaValor" class="form-control" min="0" step="0.1" placeholder="Ej. 120" style="width:100%;padding:10px;border-radius:6px;color:#1e293b;background:#f8fafc;border:1px solid #cbd5e1;">
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label>¿Se aplicó insulina?</label>
                    <select id="curvaGlucosaInsulinaAplicada" class="form-control" style="width:100%;padding:10px;border-radius:6px;color:#1e293b;background:#f8fafc;border:1px solid #cbd5e1;">
                        <option value="no">No</option>
                        <option value="si">Sí</option>
                    </select>
                </div>
                <div id="curvaGlucosaInsulinaCampos" style="display: none; margin-bottom: 16px;">
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label>Cantidad (unidades)</label>
                        <input type="number" id="curvaGlucosaCantidadInsulina" class="form-control" min="0" step="0.1" placeholder="Ej. 2" style="width:100%;padding:10px;border-radius:6px;color:#1e293b;background:#f8fafc;border:1px solid #cbd5e1;">
                    </div>
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label>Tipo de insulina</label>
                        <select id="curvaGlucosaTipoInsulina" class="form-control" style="width:100%;padding:10px;border-radius:6px;color:#1e293b;background:#f8fafc;border:1px solid #cbd5e1;">
                            <option value="">Seleccione...</option>
                            <option value="R">R</option>
                            <option value="N">N</option>
                            <option value="RN">R y N</option>
                        </select>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                    <label>Observaciones</label>
                    <textarea id="curvaGlucosaObservaciones" class="form-control" rows="2" placeholder="Opcional" style="width:100%;padding:10px;border-radius:6px;color:#1e293b;background:#f8fafc;border:1px solid #cbd5e1;"></textarea>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="background:#7b1fa2;border-color:#7b1fa2;"><i class="fas fa-save"></i> Guardar</button>
                </div>
            </form>
        `;
        const modal = this.createModal('Registrar medición de glucosa', modalContent, 'fa-chart-line');
        document.body.appendChild(modal);
        const insulinaSelect = document.getElementById('curvaGlucosaInsulinaAplicada');
        const insulinaCampos = document.getElementById('curvaGlucosaInsulinaCampos');
        if (insulinaSelect && insulinaCampos) {
            insulinaSelect.addEventListener('change', function() {
                insulinaCampos.style.display = this.value === 'si' ? 'block' : 'none';
            });
        }
        const form = document.getElementById('formCurvaGlucosa');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const valor = document.getElementById('curvaGlucosaValor')?.value?.trim() || '';
                const observaciones = document.getElementById('curvaGlucosaObservaciones')?.value?.trim() || '';
                const insulinaAplicada = document.getElementById('curvaGlucosaInsulinaAplicada')?.value === 'si';
                const cantidadInsulina = document.getElementById('curvaGlucosaCantidadInsulina')?.value?.trim() || '';
                const tipoInsulina = document.getElementById('curvaGlucosaTipoInsulina')?.value?.trim() || '';
                if (!valor) {
                    this.showAlert('Indique el valor de glucosa (mg/dL).', 'Datos requeridos', 'warning');
                    return;
                }
                const valorNum = parseFloat(valor.replace(',', '.'));
                if (isNaN(valorNum)) {
                    this.showAlert('El valor de glucosa debe ser un número.', 'Datos inválidos', 'warning');
                    return;
                }
                if (insulinaAplicada) {
                    if (!cantidadInsulina) {
                        this.showAlert('Indique la cantidad de insulina (unidades).', 'Datos requeridos', 'warning');
                        return;
                    }
                    const cantNum = parseFloat(cantidadInsulina.replace(',', '.'));
                    if (isNaN(cantNum) || cantNum < 0) {
                        this.showAlert('La cantidad de insulina debe ser un número válido.', 'Datos inválidos', 'warning');
                        return;
                    }
                    if (!tipoInsulina) {
                        this.showAlert('Indique el tipo de insulina aplicada.', 'Datos requeridos', 'warning');
                        return;
                    }
                }
                const registroId = 'glu_' + Date.now();
                const nuevo = {
                    id: registroId,
                    fechaHora: new Date().toISOString(),
                    valor: valorNum,
                    observaciones: observaciones || '',
                    insulinaAplicada: insulinaAplicada,
                    cantidadInsulina: insulinaAplicada ? parseFloat(cantidadInsulina.replace(',', '.')) : null,
                    tipoInsulina: insulinaAplicada ? tipoInsulina : '',
                    registradoPorNombre: this._glucosaRegistradoPor || ''
                };
                const updates = {};
                updates[`curvaGlucosa/mediciones/${registroId}`] = nuevo;
                updates['metadata/fechaUltimaActualizacion'] = Date.now();
                const ref = this.internamientosRef.child(this.currentInternamientoId);
                ref.update(updates).then(() => {
                    const intern = this.internamientos.get(this.currentInternamientoId);
                    if (intern) {
                        const c = intern.curvaGlucosa || {};
                        const med = c.mediciones || {};
                        med[registroId] = nuevo;
                        intern.curvaGlucosa = { ...c, mediciones: med };
                    }
                    if (tipoInsulina === 'N' || tipoInsulina === 'RN') {
                        const id = this.currentInternamientoId;
                        delete this._insulinaNCountdownVencidoPorId[id];
                        this._saveCountdownVencidoStorage();
                        this.renderPanelHeader(this.internamientos.get(id));
                    }
                    this.showNotification('Medición registrada', 'success');
                    document.querySelector('.modal-overlay')?.remove();
                    this.loadCurvaGlucosaView();
                }).catch(err => {
                    this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
                });
            });
        }
    }

    showAgregarBolo() {
        if (!this.currentInternamientoId) {
            this.showAlert('No hay internamiento seleccionado', 'Error', 'error');
            return;
        }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.estado?.actual === 'egresado') {
            this.showAlert('No se puede agregar bolo en un internamiento egresado', 'Acción Bloqueada', 'warning');
            return;
        }
        const modalContent = this.getBoloFormHTML();
        const modal = this.createModal('Agregar bolo', modalContent, 'fa-syringe');
        document.body.appendChild(modal);
        const form = document.getElementById('formBolo');
        if (form) form.onsubmit = (e) => { e.preventDefault(); this.handleBoloSubmit(); };
        this.setupBoloFormDefaults();
    }

    getBoloFormHTML() {
        return `
        <div style="max-height: 75vh; overflow-y: auto; padding: 10px;">
            <form id="formBolo">
                <div class="form-section" style="margin-bottom: 20px;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-syringe"></i> Administración
                    </h4>
                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label>Hora de Inicio *</label>
                            <input type="datetime-local" id="boloHoraInicio" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                        </div>
                        <div class="form-group">
                            <label>Hora de Fin</label>
                            <input type="datetime-local" id="boloHoraFin" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Velocidad de Infusión (ml/hora) *</label>
                        <input type="number" id="boloVelocidad" step="0.1" min="0.1" required placeholder="Ej: 20" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                        <small style="color: #94a3b8; display: block; margin-top: 5px;">Velocidad recomendada: 5-10 ml/kg/hora (inicialmente lento, luego aumentar)</small>
                    </div>
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="boloReaccionAdversa">
                            ¿Hubo reacción adversa?
                        </label>
                        <textarea id="boloDescripcionReaccion" rows="3" placeholder="Descripción de la reacción adversa (si hubo)" style="margin-top: 8px; width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;"></textarea>
                    </div>
                </div>
                <div class="form-group">
                    <label>Observaciones</label>
                    <textarea id="boloObservaciones" rows="2" placeholder="Observaciones del bolo..." style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;"></textarea>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="background:#722f37; border-color:#722f37;"><i class="fas fa-save"></i> Guardar bolo</button>
                </div>
            </form>
        </div>
        `;
    }

    setupBoloFormDefaults() {
        const horaInicio = document.getElementById('boloHoraInicio');
        if (horaInicio) {
            const now = new Date();
            const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
            const h = String(now.getHours()).padStart(2, '0'), min = String(now.getMinutes()).padStart(2, '0');
            horaInicio.value = `${y}-${m}-${d}T${h}:${min}`;
        }
    }

    async handleBoloSubmit() {
        const horaInicio = document.getElementById('boloHoraInicio')?.value;
        if (!horaInicio) {
            this.showAlert('Hora de inicio es obligatoria.', 'Dato requerido', 'warning');
            return;
        }
        const data = {
            horaInicio,
            horaFin: document.getElementById('boloHoraFin')?.value || '',
            velocidad: document.getElementById('boloVelocidad')?.value ? parseFloat(document.getElementById('boloVelocidad').value) : null,
            reaccionAdversa: document.getElementById('boloReaccionAdversa')?.checked || false,
            descripcionReaccion: document.getElementById('boloDescripcionReaccion')?.value?.trim() || '',
            observaciones: document.getElementById('boloObservaciones')?.value?.trim() || ''
        };
        const resultadoCodigo = await this.verificarCodigoAsistente('agregar_bolo');
        if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('No se registró el bolo', 'info');
            return;
        }
        try {
            await this.guardarBolo(data, resultadoCodigo);
            this.showNotification('Bolo registrado por ' + resultadoCodigo.nombre, 'success');
            document.querySelector('.modal-overlay')?.remove();
            this.showInternamientoView('transfusiones');
            if (typeof this.loadTransfusionesView === 'function') this.loadTransfusionesView();
        } catch (e) {
            console.error('Error guardando bolo:', e);
            this.showAlert('Error al guardar: ' + (e.message || e), 'Error', 'error');
        }
    }

    async guardarBolo(data, codigoResult) {
        const userId = codigoResult?.assistantId || sessionStorage.getItem('userId');
        const userName = codigoResult?.nombre || sessionStorage.getItem('userName');
        const boloId = 'bolo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const record = {
            boloId,
            fechaHoraInicio: data.horaInicio ? new Date(data.horaInicio).getTime() : Date.now(),
            fechaHoraFin: data.horaFin ? new Date(data.horaFin).getTime() : null,
            velocidadInfusion: data.velocidad,
            reaccionAdversa: data.reaccionAdversa,
            descripcionReaccion: data.descripcionReaccion || '',
            observaciones: data.observaciones || '',
            responsable: userId,
            responsableNombre: userName,
            registradoPor: userId,
            registradoNombre: userName,
            registradoCodigoVerificado: !!codigoResult,
            fechaRegistro: Date.now()
        };
        const updates = {};
        updates[`bolos/${boloId}`] = record;
        updates['metadata/fechaUltimaActualizacion'] = Date.now();
        const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
        await internamientoRef.update(updates);
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento) {
            const prev = internamiento.bolos && typeof internamiento.bolos === 'object' && !Array.isArray(internamiento.bolos) ? internamiento.bolos : {};
            this.internamientos.set(this.currentInternamientoId, { ...internamiento, bolos: { ...prev, [boloId]: record } });
        }
    }

    showParametrosTransfusion() {
        if (!this.currentInternamientoId) {
            this.showAlert('No hay internamiento seleccionado', 'Error', 'error');
            return;
        }
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento?.estado?.actual === 'egresado') {
            this.showAlert('No se pueden registrar parámetros en un internamiento egresado', 'Acción Bloqueada', 'warning');
            return;
        }
        const hoy = new Date().toISOString().slice(0, 10);
        const ahora = new Date().toTimeString().slice(0, 5);
        const modalContent = this.getParametrosTransfusionFormHTML(hoy, ahora);
        const modal = this.createModal('Toma de parámetros de transfusión', modalContent, 'fa-sliders-h');
        document.body.appendChild(modal);
        const form = document.getElementById('formParametrosTransfusion');
        if (form) form.onsubmit = (e) => this.handleParametrosTransfusionSubmit(e);
    }

    getParametrosTransfusionFormHTML(diaDefault = '', horaDefault = '') {
        return `
        <div style="max-height: 75vh; overflow-y: auto;">
            <form id="formParametrosTransfusion">
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group">
                        <label>Día *</label>
                        <input type="date" id="paramTransfusionDia" required value="${diaDefault}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                    </div>
                    <div class="form-group">
                        <label>Hora *</label>
                        <input type="time" id="paramTransfusionHora" required value="${horaDefault}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                    </div>
                </div>
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group">
                        <label>Temp (°C)</label>
                        <input type="number" id="paramTransfusionTemp" step="0.1" min="30" max="45" placeholder="Ej: 38.5" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                    </div>
                    <div class="form-group">
                        <label>FC (lat/min)</label>
                        <input type="number" id="paramTransfusionFc" min="0" placeholder="Frecuencia cardíaca" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                    </div>
                </div>
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group">
                        <label>FR (resp/min)</label>
                        <input type="number" id="paramTransfusionFr" min="0" placeholder="Frecuencia respiratoria" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                    </div>
                    <div class="form-group">
                        <label>SPO2 (%)</label>
                        <input type="number" id="paramTransfusionSpo2" min="0" max="100" placeholder="Saturación" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                    </div>
                </div>
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group">
                        <label>PAM (mmHg)</label>
                        <input type="number" id="paramTransfusionPam" min="0" placeholder="Presión arterial media" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                    </div>
                    <div class="form-group" style="display: flex; align-items: flex-end; padding-bottom: 8px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="paramTransfusionAnafilaxis" style="width: 20px; height: 20px;">
                            <span>Anafilaxis</span>
                        </label>
                    </div>
                </div>
                <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="background:#c2185b; border-color:#c2185b;"><i class="fas fa-save"></i> Guardar</button>
                </div>
            </form>
        </div>
        `;
    }

    async handleParametrosTransfusionSubmit(e) {
        e.preventDefault();
        const dia = document.getElementById('paramTransfusionDia')?.value;
        const hora = document.getElementById('paramTransfusionHora')?.value;
        if (!dia || !hora) {
            this.showAlert('Día y hora son obligatorios', 'Datos requeridos', 'warning');
            return;
        }
        const data = {
            dia,
            hora,
            temp: document.getElementById('paramTransfusionTemp')?.value ? parseFloat(document.getElementById('paramTransfusionTemp').value) : null,
            fc: document.getElementById('paramTransfusionFc')?.value ? parseInt(document.getElementById('paramTransfusionFc').value, 10) : null,
            fr: document.getElementById('paramTransfusionFr')?.value ? parseInt(document.getElementById('paramTransfusionFr').value, 10) : null,
            spo2: document.getElementById('paramTransfusionSpo2')?.value ? parseInt(document.getElementById('paramTransfusionSpo2').value, 10) : null,
            pam: document.getElementById('paramTransfusionPam')?.value ? parseInt(document.getElementById('paramTransfusionPam').value, 10) : null,
            anafilaxis: document.getElementById('paramTransfusionAnafilaxis')?.checked || false
        };
        const resultadoCodigo = await this.verificarCodigoAsistente('parametros_transfusion');
        if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('No se registraron los parámetros de transfusión', 'info');
            return;
        }
        try {
            await this.guardarParametrosTransfusion(data, resultadoCodigo);
            this.showNotification('Parámetros de transfusión guardados por ' + resultadoCodigo.nombre, 'success');
            document.querySelector('.modal-overlay')?.remove();
            this.showInternamientoView('transfusiones');
            if (typeof this.loadTransfusionesView === 'function') this.loadTransfusionesView();
        } catch (err) {
            console.error('Error guardando parámetros de transfusión:', err);
            this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
        }
    }

    async guardarParametrosTransfusion(data, codigoResult) {
        const userId = codigoResult?.assistantId || sessionStorage.getItem('userId');
        const userName = codigoResult?.nombre || sessionStorage.getItem('userName');
        const registroId = 'param_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const fechaHora = data.dia && data.hora ? new Date(`${data.dia}T${data.hora}`).getTime() : Date.now();
        const record = {
            parametrosTransfusionId: registroId,
            fechaHora,
            dia: data.dia,
            hora: data.hora,
            temp: data.temp,
            fc: data.fc,
            fr: data.fr,
            spo2: data.spo2,
            pam: data.pam,
            anafilaxis: data.anafilaxis,
            registradoPor: userId,
            registradoNombre: userName,
            registradoCodigoVerificado: !!codigoResult,
            fechaRegistro: Date.now()
        };
        const updates = {};
        updates[`parametrosTransfusion/${registroId}`] = record;
        updates['metadata/fechaUltimaActualizacion'] = Date.now();
        const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
        await internamientoRef.update(updates);
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (internamiento) {
            const prev = internamiento.parametrosTransfusion && typeof internamiento.parametrosTransfusion === 'object' && !Array.isArray(internamiento.parametrosTransfusion) ? internamiento.parametrosTransfusion : {};
            this.internamientos.set(this.currentInternamientoId, { ...internamiento, parametrosTransfusion: { ...prev, [registroId]: record } });
        }
    }

    loadTransfusionesView() {
        const container = document.getElementById('internamiento-transfusiones');
        if (!container) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        if (!internamiento) return;
        const transfusionesRaw = internamiento?.transfusiones && typeof internamiento.transfusiones === 'object' ? internamiento.transfusiones : {};
        const transfusionesList = Object.values(transfusionesRaw).sort((a, b) => (b.fecha || b.fechaRegistro || 0) - (a.fecha || a.fechaRegistro || 0));
        const parametrosRaw = internamiento?.parametrosTransfusion && typeof internamiento.parametrosTransfusion === 'object' ? internamiento.parametrosTransfusion : {};
        const parametrosList = Object.values(parametrosRaw).sort((a, b) => (b.fechaHora || b.fechaRegistro || 0) - (a.fechaHora || a.fechaRegistro || 0));
        const bolosRaw = internamiento?.bolos && typeof internamiento.bolos === 'object' ? internamiento.bolos : {};
        const bolosList = Object.values(bolosRaw).sort((a, b) => (b.fechaHoraInicio || b.fechaRegistro || 0) - (a.fechaHoraInicio || a.fechaRegistro || 0));

        if (this._reticulocitosTransfusionId !== id) {
            this._reticulocitosTransfusionId = id;
        }
        const reticulocitosDesbloqueado = true;

        const controles = internamiento?.datosIngreso?.controlesRapidos || {};
        const reticulocitosTiene = !!controles.reticulocitosTieneExamen;
        const reticulocitosValor = controles.reticulocitosRegenerativa || null;
        const reticulocitosDesdeIngreso = controles.reticulocitosRegistradoEnIngreso !== false;
        const reticulocitosRegistradoPor = (controles.reticulocitosRegistradoPorNombre || '').trim();
        const reticulocitosTexto = reticulocitosTiene && reticulocitosValor
            ? (reticulocitosValor === 'regenerativa' ? 'Regenerativa' : reticulocitosValor === 'no_regenerativa' ? 'No regenerativa' : reticulocitosValor === 'resultados_pendientes' ? 'Resultados pendientes' : reticulocitosValor)
            : (reticulocitosTiene ? 'Sin clasificación' : 'Sin datos en ingreso');
        const esResultadosPendientes = reticulocitosValor === 'resultados_pendientes';
        const reticulocitosSectionHTML = `
            <div style="background: white; border-radius: 12px; margin-top: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden;">
                <div style="background: #5c6bc0; color: white; padding: 12px 20px; font-weight: 600; font-size: 1rem;">
                    <i class="fas fa-microscope"></i> Reticulocitos (datos de ingreso)
                </div>
                <div style="padding: 20px;">
                    <div style="font-size: 1rem; color: #334155;">
                        <strong>Clasificación registrada:</strong> ${(reticulocitosTexto || '—').replace(/</g, '&lt;')}
                    </div>
                    ${!reticulocitosDesdeIngreso && reticulocitosTiene ? `
                    <div style="margin-top: 12px; padding: 12px 14px; background: #f1f5f9; border: 1px solid #94a3b8; border-left: 4px solid #64748b; border-radius: 8px; color: #475569; font-size: 0.9rem;">
                        <i class="fas fa-info-circle"></i> En el ingreso no se realizó este examen. Dato registrado desde el módulo de Transfusión.
                        ${reticulocitosRegistradoPor ? `<div style="margin-top: 6px;"><strong>Registrado por (da fe de haber leído/informado resultado de laboratorio):</strong> ${(reticulocitosRegistradoPor || '').replace(/</g, '&lt;')}</div>` : ''}
                    </div>
                    ` : ''}
                    ${esResultadosPendientes ? `
                    <div style="margin-top: 16px; padding: 14px 16px; background: #fef3c7; border: 1px solid #f59e0b; border-left: 4px solid #d97706; border-radius: 8px; color: #92400e;">
                        <strong><i class="fas fa-exclamation-triangle"></i> Advertencia</strong>
                        <p style="margin: 8px 0 0 0; font-size: 0.95rem;">Los resultados se registraron desde consulta externa como pendientes. Recuerde ingresar los resultados tan pronto sean reportados por laboratorio.</p>
                    </div>
                    ` : ''}
                    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                        <div style="font-weight: 600; color: #334155; margin-bottom: 10px; font-size: 0.95rem;">Registrar o actualizar clasificación desde aquí (si no se realizó en ingreso):</div>
                        <div style="padding: 8px 12px; background: #ecfdf5; border: 1px solid #10b981; border-radius: 6px; margin-bottom: 12px; font-size: 0.9rem; color: #065f46;">
                            <i class="fas fa-info-circle"></i> Puede seleccionar la clasificación y guardarla directamente.
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: center;">
                            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.95rem;">
                                <input type="radio" name="transfusionReticulocitosTipo" value="regenerativa" ${reticulocitosValor === 'regenerativa' ? 'checked' : ''}>
                                Regenerativa
                            </label>
                            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.95rem;">
                                <input type="radio" name="transfusionReticulocitosTipo" value="no_regenerativa" ${reticulocitosValor === 'no_regenerativa' ? 'checked' : ''}>
                                No regenerativa
                            </label>
                            <button type="button" class="btn btn-primary" onclick="window.internamientoModule.guardarReticulocitosDesdeTransfusion()" style="background: #5c6bc0; border-color: #5c6bc0;">
                                <i class="fas fa-save"></i> ${reticulocitosTiene ? 'Actualizar' : 'Registrar'}
                            </button>
                        </div>
                        <p style="margin: 8px 0 0 0; font-size: 0.8rem; color: #64748b;">Si guarda desde aquí, se mantendrá el mensaje de que en el ingreso no se realizó el examen.</p>
                    </div>
                </div>
            </div>
        `;

        const formatFechaHora = (ts) => {
            if (ts == null) return '—';
            const d = new Date(ts);
            return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
        };
        const fmt = (v) => (v != null && v !== '') ? v : '—';

        // Panel 1 (anclado): solo Registro de transfusiones
        const registroHTML = transfusionesList.length > 0
            ? `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${transfusionesList.map(t => {
                    const tipoTransfusion = t.tipoTransfusion || '';
                    const tipoIcono = tipoTransfusion === 'plasma' ? '💧' : tipoTransfusion === 'sangre' ? '🩸' : '';
                    const tipoTexto = tipoTransfusion === 'plasma' ? 'Plasma' : tipoTransfusion === 'sangre' ? 'Sangre Completa' : '';
                    return `
                    <div style="border: 1px solid #e2e8f0; border-left: 4px solid #c62828; border-radius: 10px; padding: 14px; background: #fff5f5;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-clock"></i> ${formatFechaHora(t.fechaHoraInicio || t.fecha)}
                            ${tipoIcono && tipoTexto ? `<span style="margin-left: auto; font-size: 0.9rem; color: #c62828; font-weight: 500;">${tipoIcono} ${tipoTexto}</span>` : ''}
                        </div>
                        ${t.receptor ? `<div style="font-size: 0.9rem; color: #555;">Receptor: ${t.receptor.peso || '—'} kg, HT ${t.receptor.htActual || '—'} → ${t.receptor.htDeseado || '—'}%</div>` : ''}
                        ${t.calculo?.volumenCalculado != null ? `<div style="font-size: 0.9rem; color: #c62828;"><strong>Volumen:</strong> ${t.calculo.volumenCalculado} ml</div>` : ''}
                        <div style="margin-top: 6px; font-size: 0.85rem; color: #94a3b8;">Registrado por: ${(t.registradoNombre || t.responsableNombre || '—').replace(/</g, '&lt;')}</div>
                    </div>
                `;
                }).join('')}
            </div>
            `
            : `
            <div style="padding: 32px 20px; text-align: center; color: #6c757d;">
                <i class="fas fa-tint" style="font-size: 2rem; color: #c62828; opacity: 0.8;"></i>
                <p style="margin: 12px 0 0 0; font-size: 0.95rem;">No hay transfusiones registradas. Use "Registro de transfusión" para registrar una.</p>
            </div>
            `;

        // Panel 2 (debajo): Tomas de parámetros
        const parametrosHTML = parametrosList.length > 0
            ? `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${parametrosList.map(p => `
                    <div style="border: 1px solid #e2e8f0; border-left: 4px solid #c2185b; border-radius: 10px; padding: 14px; background: #fdf2f8;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 6px;"><i class="fas fa-calendar-day"></i> ${(p.dia || '—').replace(/</g, '&lt;')} · ${(p.hora || '—').replace(/</g, '&lt;')}</div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; font-size: 0.9rem; color: #555;">
                            <span><strong>Temp:</strong> ${fmt(p.temp)} °C</span>
                            <span><strong>FC:</strong> ${fmt(p.fc)}</span>
                            <span><strong>FR:</strong> ${fmt(p.fr)}</span>
                            <span><strong>SPO2:</strong> ${fmt(p.spo2)}%</span>
                            <span><strong>PAM:</strong> ${fmt(p.pam)}</span>
                            ${p.anafilaxis ? '<span style="color:#c2185b;"><strong>Anafilaxis: Sí</strong></span>' : ''}
                        </div>
                        <div style="margin-top: 6px; font-size: 0.85rem; color: #94a3b8;">Registrado por: ${(p.registradoNombre || '—').replace(/</g, '&lt;')}</div>
                    </div>
                `).join('')}
            </div>
            `
            : `
            <div style="padding: 32px 20px; text-align: center; color: #6c757d;">
                <i class="fas fa-sliders-h" style="font-size: 2rem; color: #c2185b; opacity: 0.8;"></i>
                <p style="margin: 12px 0 0 0; font-size: 0.95rem;">No hay tomas de parámetros. Use "Parámetros de transfusión" para registrar.</p>
            </div>
            `;

        // Panel 3: Registros de bolos
        const bolosHTML = bolosList.length > 0
            ? `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${bolosList.map(b => `
                    <div style="border: 1px solid #e2e8f0; border-left: 4px solid #722f37; border-radius: 10px; padding: 14px; background: #fdf8f8;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 6px;"><i class="fas fa-clock"></i> ${formatFechaHora(b.fechaHoraInicio)}${b.fechaHoraFin ? ' → ' + formatFechaHora(b.fechaHoraFin) : ''}</div>
                        ${b.velocidadInfusion != null ? `<div style="font-size: 0.9rem; color: #555;"><strong>Velocidad:</strong> ${b.velocidadInfusion} ml/h</div>` : ''}
                        ${b.reaccionAdversa ? `<div style="font-size: 0.9rem; color: #c62828;"><strong>Reacción adversa:</strong> ${(b.descripcionReaccion || 'Sí').replace(/</g, '&lt;')}</div>` : ''}
                        ${b.observaciones ? `<div style="font-size: 0.9rem; color: #555; margin-top: 4px;">${(b.observaciones || '').replace(/</g, '&lt;')}</div>` : ''}
                        <div style="margin-top: 6px; font-size: 0.85rem; color: #94a3b8;">Responsable: ${(b.responsableNombre || '—').replace(/</g, '&lt;')}</div>
                    </div>
                `).join('')}
            </div>
            `
            : `
            <div style="padding: 32px 20px; text-align: center; color: #6c757d;">
                <i class="fas fa-syringe" style="font-size: 2rem; color: #722f37; opacity: 0.8;"></i>
                <p style="margin: 12px 0 0 0; font-size: 0.95rem;">No hay registros de bolos. Use "Agregar bolo" para registrar.</p>
            </div>
            `;

        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-tint"></i> Transfusión</h2>
            </div>
            <div style="margin-top: 20px; padding: 16px 0; border-top: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
                <button class="btn btn-primary" onclick="window.internamientoModule.showRegistroTransfusionForm()" style="background:#c62828; border-color:#c62828;">
                    <i class="fas fa-plus"></i> Registro de transfusión
                </button>
                <button class="btn btn-primary" onclick="window.internamientoModule.showParametrosTransfusion()" style="background:#c2185b; border-color:#c2185b;">
                    <i class="fas fa-sliders-h"></i> Parámetros de transfusión
                </button>
                <button class="btn btn-primary" onclick="window.internamientoModule.showAgregarBolo()" style="background:#722f37; border-color:#722f37;">
                    <i class="fas fa-syringe"></i> Agregar bolo
                </button>
                <button class="btn btn-secondary" onclick="window.internamientoModule.showPanelPrincipal('${id}')">
                    <i class="fas fa-arrow-left"></i> Volver al Panel
                </button>
            </div>

            ${reticulocitosSectionHTML}

            <!-- Ventana 1: Registro (anclada arriba) -->
            <div style="background: white; border-radius: 12px; margin-top: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden;">
                <div style="background: #c62828; color: white; padding: 12px 20px; font-weight: 600; font-size: 1rem;">
                    <i class="fas fa-clipboard-list"></i> Registro de transfusiones
                    ${transfusionesList.length > 0 ? ` <span style="opacity: 0.9; font-weight: 500;">(${transfusionesList.length})</span>` : ''}
                </div>
                <div style="padding: 20px;">
                    ${registroHTML}
                </div>
            </div>

            <!-- Ventana 2: Tomas de parámetros (debajo) -->
            <div style="background: white; border-radius: 12px; margin-top: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden;">
                <div style="background: #c2185b; color: white; padding: 12px 20px; font-weight: 600; font-size: 1rem;">
                    <i class="fas fa-sliders-h"></i> Tomas de parámetros de transfusión
                    ${parametrosList.length > 0 ? ` <span style="opacity: 0.9; font-weight: 500;">(${parametrosList.length})</span>` : ''}
                </div>
                <div style="padding: 20px;">
                    ${parametrosHTML}
                </div>
            </div>

            <!-- Ventana 3: Registros de bolos -->
            <div style="background: white; border-radius: 12px; margin-top: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden;">
                <div style="background: #722f37; color: white; padding: 12px 20px; font-weight: 600; font-size: 1rem;">
                    <i class="fas fa-syringe"></i> Registros de bolos
                    ${bolosList.length > 0 ? ` <span style="opacity: 0.9; font-weight: 500;">(${bolosList.length})</span>` : ''}
                </div>
                <div style="padding: 20px;">
                    ${bolosHTML}
                </div>
            </div>
        `;
    }

    /** Verifica el código de personal médico para habilitar la sección de reticulocitos en Transfusión (cambiar opción y guardar). */
    async verificarCodigoReticulocitosTransfusion() {
        const resultado = await this.verificarCodigoAsistente('reticulocitos_transfusion');
        if (resultado && resultado.valido && resultado.nombre) {
            this._reticulocitosTransfusionVerificado = true;
            this.loadTransfusionesView();
            this.showNotification('Código verificado. Puede cambiar la clasificación y guardar.', 'success');
        }
    }

    /** Guarda la clasificación de reticulocitos desde la vista Transfusión. Pide código para dar fe de que leyó/fue informado del resultado de laboratorio. */
    async guardarReticulocitosDesdeTransfusion() {
        const id = this.currentInternamientoId;
        if (!id || !this.internamientosRef) return;
        const radio = document.querySelector('input[name="transfusionReticulocitosTipo"]:checked');
        const valor = radio ? radio.value : null;
        if (!valor) {
            this.showAlert('Seleccione una clasificación (Regenerativa o No regenerativa) antes de guardar.', 'Dato requerido', 'warning');
            return;
        }
        const ahora = Date.now();
        const registradoPorId = sessionStorage.getItem('userId') || '';
        const registradoPorNombre = (sessionStorage.getItem('userName') || '').trim();
        const updates = {
            'datosIngreso/controlesRapidos/reticulocitosTieneExamen': true,
            'datosIngreso/controlesRapidos/reticulocitosRegenerativa': valor,
            'datosIngreso/controlesRapidos/reticulocitosRegistradoEnIngreso': false,
        'datosIngreso/controlesRapidos/reticulocitosRegistradoPorId': registradoPorId,
        'datosIngreso/controlesRapidos/reticulocitosRegistradoPorNombre': registradoPorNombre,
            'datosIngreso/controlesRapidos/reticulocitosFechaRegistroTransfusion': ahora
        };
        try {
            await this.internamientosRef.child(id).update(updates);
            const int = this.internamientos.get(id);
            if (int) {
                const cr = int.datosIngreso?.controlesRapidos || {};
                const controlesRapidos = {
                    ...cr,
                    reticulocitosTieneExamen: true,
                    reticulocitosRegenerativa: valor,
                    reticulocitosRegistradoEnIngreso: false,
                    reticulocitosRegistradoPorId: updates['datosIngreso/controlesRapidos/reticulocitosRegistradoPorId'],
                    reticulocitosRegistradoPorNombre: updates['datosIngreso/controlesRapidos/reticulocitosRegistradoPorNombre'],
                    reticulocitosFechaRegistroTransfusion: ahora
                };
                this.internamientos.set(id, {
                    ...int,
                    datosIngreso: { ...(int.datosIngreso || {}), controlesRapidos }
                });
            }
            this.showNotification('Reticulocitos registrados desde la vista de Transfusión.', 'success');
            this.loadTransfusionesView();
        } catch (err) {
            console.error(err);
            this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
        }
    }

    loadDefuncionesView() {
        const container = document.getElementById('internamiento-defunciones');
        if (!container) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        if (!internamiento) return;
        const defuncionesRaw = internamiento?.defunciones;
        const defuncionesObj = defuncionesRaw && typeof defuncionesRaw === 'object' && !Array.isArray(defuncionesRaw) ? defuncionesRaw : {};
        const defuncionesList = Object.values(defuncionesObj).sort((a, b) => (b.fechaHoraTs || 0) - (a.fechaHoraTs || 0));

        const formatFechaHora = (val) => {
            if (val == null) return '—';
            const d = new Date(typeof val === 'number' ? val : val);
            return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
        };

        const listHTML = defuncionesList.length > 0
            ? `
            <div style="background: white; padding: 20px; border-radius: 12px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 1rem;"><i class="fas fa-list"></i> Registros de defunción (${defuncionesList.length})</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${defuncionesList.map(d => `
                        <div style="border: 1px solid #e2e8f0; border-left: 4px solid #5c5c5c; border-radius: 10px; padding: 14px; background: #f8fafc;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 6px;"><i class="fas fa-clock"></i> Hora de muerte: ${formatFechaHora(d.fechaHoraTs || d.fechaHora)}</div>
                            ${d.turno ? `<div style="color: #475569; font-size: 0.9rem; margin-bottom: 4px;"><strong>Turno:</strong> ${(d.turno || '').replace(/</g, '&lt;')}${d.responsableTurno ? ' — ' + (d.responsableTurno || '').replace(/</g, '&lt;') : ''}</div>` : ''}
                            ${(d.motivoFallecimiento || d.causa) ? `<div style="color: #334155; font-size: 0.95rem; margin-bottom: 4px; white-space: pre-wrap;"><strong>Motivo de fallecimiento:</strong><br>${(d.motivoFallecimiento || d.causa || '').replace(/</g, '&lt;')}</div>` : ''}
                            ${d.observaciones ? `<div style="color: #64748b; font-size: 0.9rem; white-space: pre-wrap;">${(d.observaciones || '').replace(/</g, '&lt;')}</div>` : ''}
                            <div style="margin-top: 8px; font-size: 0.85rem; color: #94a3b8;">Registrado por: ${(d.registradoNombre || '—').replace(/</g, '&lt;')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            `
            : `
            <div style="background: white; padding: 40px; border-radius: 12px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; color: #6c757d;">
                <i class="fas fa-cross" style="font-size: 3rem; color: #5c5c5c; margin-bottom: 16px; opacity: 0.8;"></i>
                <p style="margin: 0; font-size: 1rem;">No hay registros de defunción. Use "Agregar defunción" para registrar uno.</p>
            </div>
            `;

        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-cross"></i> Defunción</h2>
                <div>
                    <button class="btn btn-primary" onclick="window.internamientoModule.agregarDefuncion()" style="background:#5c5c5c;border-color:#5c5c5c;">
                        <i class="fas fa-plus"></i> Agregar defunción
                    </button>
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showPanelPrincipal('${id}')" style="margin-left: 10px;">
                        <i class="fas fa-arrow-left"></i> Volver al Panel
                    </button>
                </div>
            </div>
            ${listHTML}
        `;
    }

    async agregarDefuncion() {
        if (!this.currentInternamientoId) return;
        const resultadoCodigo = await this.verificarCodigoAsistente('defuncion');
        if (!resultadoCodigo || !resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Registro de defunción cancelado', 'info');
            return;
        }
        this._defuncionResponsableVerificado = resultadoCodigo.nombre || '';
        this._defuncionResponsableId = resultadoCodigo.assistantId || null;

        const now = new Date();
        const fechaActual = now.toISOString().split('T')[0];
        const horaActual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const responsableVal = (this._defuncionResponsableVerificado || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

        const modalContent = `
            <form id="formAgregarDefuncion">
                <div class="form-group" style="margin-bottom: 20px;">
                    <label><i class="fas fa-user-shield"></i> Responsable *</label>
                    <input type="text" id="defuncionResponsable" readonly value="${responsableVal}" placeholder="Se mostrará al verificar el código"
                           style="width:100%;padding:10px;border-radius:6px;border:1px solid #ddd;background:#e9ecef;cursor:default;">
                    <small style="color:#6c757d;display:block;margin-top:5px;"><i class="fas fa-lock"></i> El responsable se asigna al ingresar tu código de personal médico</small>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-clock"></i> Hora de muerte *</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <input type="date" id="defuncionFecha" required value="${fechaActual}" style="width:100%;padding:10px;border-radius:6px;border:1px solid #ddd;">
                        <input type="time" id="defuncionHora" required value="${horaActual}" style="width:100%;padding:10px;border-radius:6px;border:1px solid #ddd;">
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-file-medical-alt"></i> Motivo de fallecimiento *</label>
                    <textarea id="defuncionMotivo" rows="5" required placeholder="Explique qué fue lo que pasó: causa del fallecimiento, circunstancias, hallazgos..." style="width:100%;padding:10px;border-radius:6px;border:1px solid #ddd;"></textarea>
                    <small style="color:#6c757d;">Describa de forma clara la causa y circunstancias del fallecimiento.</small>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-clipboard-list"></i> Turno en el que murió *</label>
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px; text-align: left; width: 100%; min-width: 200px;">
                        <label style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box; cursor: pointer;">
                            <input type="radio" name="defuncionTurnoFranja" value="manana" required style="width: 18px; height: 18px; margin: 0; flex-shrink: 0;">
                            <span style="flex: 1; text-align: left;">Mañana</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box; cursor: pointer;">
                            <input type="radio" name="defuncionTurnoFranja" value="tarde" style="width: 18px; height: 18px; margin: 0; flex-shrink: 0;">
                            <span style="flex: 1; text-align: left;">Tarde</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box; cursor: pointer;">
                            <input type="radio" name="defuncionTurnoFranja" value="noche" style="width: 18px; height: 18px; margin: 0; flex-shrink: 0;">
                            <span style="flex: 1; text-align: left;">Noche</span>
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-archive"></i> ¿Qué se hizo con el cuerpo? *</label>
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px; text-align: left; width: 100%; min-width: 200px;">
                        <label style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box; cursor: pointer;">
                            <input type="radio" name="defuncionDestinoCuerpo" value="entierro" required style="width: 18px; height: 18px; margin: 0; flex-shrink: 0;">
                            <span style="flex: 1; text-align: left;">Entierro</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box; cursor: pointer;">
                            <input type="radio" name="defuncionDestinoCuerpo" value="cremacion" style="width: 18px; height: 18px; margin: 0; flex-shrink: 0;">
                            <span style="flex: 1; text-align: left;">Cremación</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box; cursor: pointer;">
                            <input type="radio" name="defuncionDestinoCuerpo" value="entrega_directa" style="width: 18px; height: 18px; margin: 0; flex-shrink: 0;">
                            <span style="flex: 1; text-align: left;">Entrega directa del cuerpo</span>
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-comment-alt"></i> Información u observaciones adicionales</label>
                    <textarea id="defuncionObservaciones" rows="3" placeholder="Cualquier información o observación adicional sobre la defunción o el proceso..." style="width:100%;padding:10px;border-radius:6px;border:1px solid #ddd; margin-top: 8px;"></textarea>
                </div>
                <div style="text-align: right; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="margin-left: 10px; background:#5c5c5c; border-color:#5c5c5c;"><i class="fas fa-save"></i> Guardar</button>
                </div>
            </form>
        `;
        const modal = this.createModal('Registrar defunción', modalContent, 'fa-cross');
        document.body.appendChild(modal);
        const form = document.getElementById('formAgregarDefuncion');
        if (form) form.onsubmit = (e) => this.handleAgregarDefuncion(e);
    }

    async handleAgregarDefuncion(e) {
        e.preventDefault();
        const responsableNombre = document.getElementById('defuncionResponsable')?.value?.trim() || '';
        if (!responsableNombre) {
            this.showAlert('Debe verificar su código de personal médico antes de registrar la defunción. Cierre el formulario y pulse de nuevo "Agregar defunción".', 'Verificación requerida', 'warning');
            return;
        }
        const fechaVal = document.getElementById('defuncionFecha')?.value || '';
        const horaVal = document.getElementById('defuncionHora')?.value || '';
        const motivo = document.getElementById('defuncionMotivo')?.value?.trim() || '';
        const turnoFranjaRadio = document.querySelector('input[name="defuncionTurnoFranja"]:checked');
        const turnoId = turnoFranjaRadio ? turnoFranjaRadio.value : '';
        const turnoFranjaLabels = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };
        const turnoLabel = turnoId ? (turnoFranjaLabels[turnoId] || turnoId) : '';
        const responsableTurno = '';
        if (!fechaVal || !motivo) {
            this.showAlert('Indique hora de muerte y motivo de fallecimiento.', 'Datos requeridos', 'warning');
            return;
        }
        if (!turnoId) {
            this.showAlert('Seleccione el turno en el que ocurrió el fallecimiento (Mañana, Tarde o Noche).', 'Datos requeridos', 'warning');
            return;
        }
        const destinoCuerpoRadio = document.querySelector('input[name="defuncionDestinoCuerpo"]:checked');
        const destinoCuerpo = destinoCuerpoRadio ? destinoCuerpoRadio.value : '';
        if (!destinoCuerpo) {
            this.showAlert('Seleccione qué se hizo con el cuerpo.', 'Datos requeridos', 'warning');
            return;
        }
        const fechaHoraVal = fechaVal && horaVal ? `${fechaVal}T${horaVal}:00` : `${fechaVal}T00:00:00`;
        const fechaHoraTs = new Date(fechaHoraVal).getTime();
        const defuncionId = 'defuncion_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const userId = this._defuncionResponsableId || sessionStorage.getItem('userId') || '';
        const observaciones = document.getElementById('defuncionObservaciones')?.value?.trim() || '';
        const destinoCuerpoLabels = { entierro: 'Entierro', cremacion: 'Cremación', entrega_directa: 'Entrega directa del cuerpo' };
        const defuncionData = {
            defuncionId,
            fechaHora: fechaHoraVal,
            fechaHoraTs,
            motivoFallecimiento: motivo,
            turnoId,
            turno: turnoLabel,
            responsableTurno: responsableTurno || '',
            destinoCuerpo,
            destinoCuerpoLabel: destinoCuerpoLabels[destinoCuerpo] || destinoCuerpo,
            observaciones: observaciones || '',
            registradoPor: userId,
            registradoNombre: responsableNombre,
            fechaRegistro: Date.now()
        };
        try {
            const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
            const updates = {
                [`defunciones/${defuncionId}`]: defuncionData,
                'estado/actual': 'defuncion',
                'estado/fechaCambio': Date.now(),
                'metadata/fechaUltimaActualizacion': Date.now()
            };
            await internamientoRef.update(updates);
            const auditEntry = {
                timestamp: Date.now(),
                userId: userId,
                usuarioNombre: responsableNombre,
                accion: 'registrar_defuncion',
                codigoVerificado: true,
                detalles: { defuncionId, registradoNombre: responsableNombre }
            };
            await internamientoRef.child('auditoria/historialCambios').push(auditEntry);
            const internamiento = this.internamientos.get(this.currentInternamientoId);
            if (internamiento) {
                const defuncionesPrev = internamiento.defunciones && typeof internamiento.defunciones === 'object' && !Array.isArray(internamiento.defunciones)
                    ? internamiento.defunciones
                    : {};
                const defunciones = { ...defuncionesPrev, [defuncionId]: defuncionData };
                const nuevoEstado = { ...(internamiento.estado || {}), actual: 'defuncion', fechaCambio: Date.now() };
                this.internamientos.set(this.currentInternamientoId, { ...internamiento, defunciones, estado: nuevoEstado });
            }
            this.showNotification('Defunción registrada', 'success');
            document.querySelector('.modal-overlay')?.remove();
            this.showPanelPrincipal(this.currentInternamientoId);
        } catch (err) {
            console.error('Error al guardar defunción:', err);
            this.showAlert('No se pudo guardar: ' + (err.message || err), 'Error', 'error');
        }
    }

    loadLlamadasView() {
        const container = document.getElementById('internamiento-llamadas');
        if (!container) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        if (!internamiento) return;
        const llamadasRaw = internamiento?.llamadasCliente;
        const llamadasObj = llamadasRaw && typeof llamadasRaw === 'object' && !Array.isArray(llamadasRaw) ? llamadasRaw : {};
        const llamadasList = Object.values(llamadasObj).sort((a, b) => (b.fechaHora || 0) - (a.fechaHora || 0));

        const listHTML = llamadasList.length > 0
            ? `
            <div style="background: white; padding: 20px; border-radius: 12px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 1rem;"><i class="fas fa-list"></i> Llamadas registradas (${llamadasList.length})</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${typeof this.renderLlamadaCard === 'function' ? llamadasList.map(ll => this.renderLlamadaCard(ll)).join('') : llamadasList.map(ll => `<div style="padding:12px;background:#f8fafc;border-radius:8px;">${ll.resumen || 'Llamada'}</div>`).join('')}
                </div>
            </div>
            `
            : `
            <div style="background: white; padding: 40px; border-radius: 12px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; color: #6c757d;">
                <i class="fas fa-phone" style="font-size: 3rem; color: #667eea; margin-bottom: 16px; opacity: 0.8;"></i>
                <p style="margin: 0; font-size: 1rem;">No hay llamadas registradas. Use "Agregar llamada" para registrar una.</p>
            </div>
            `;

        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-phone-alt"></i> Llamadas</h2>
                <div>
                    <button class="btn btn-primary" onclick="if(window.internamientoModule.showRegistroLlamadaForm) { window.internamientoModule.showRegistroLlamadaForm(); }">
                        <i class="fas fa-plus"></i> Agregar llamada
                    </button>
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showPanelPrincipal('${id}')" style="margin-left: 10px;">
                        <i class="fas fa-arrow-left"></i> Volver al Panel
                    </button>
                </div>
            </div>
            ${listHTML}
        `;
    }

    loadCirugiasView() {
        const container = document.getElementById('internamiento-cirugias');
        if (!container) return;
        const id = this.currentInternamientoId;
        const internamiento = this.internamientos.get(id);
        const cirugiasRaw = internamiento?.cirugias;
        const cirugiasObj = cirugiasRaw && typeof cirugiasRaw === 'object' && !Array.isArray(cirugiasRaw) ? cirugiasRaw : {};
        const cirugiasList = Object.values(cirugiasObj).sort((a, b) => (a.fechaHoraTs || 0) - (b.fechaHoraTs || 0));

        const formatFechaHora = (val) => {
            if (!val) return '—';
            const d = new Date(val);
            return isNaN(d.getTime()) ? val : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
        };
        const formatHora12 = (hhmm) => {
            if (!hhmm || !hhmm.match(/^\d{1,2}:\d{2}$/)) return hhmm || '—';
            if (typeof window.formatTime12Hour === 'function') return window.formatTime12Hour(hhmm);
            return hhmm;
        };

        const listHTML = cirugiasList.length > 0 ? `
            <div style="background: white; padding: 20px; border-radius: 12px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 1rem;"><i class="fas fa-list"></i> Cirugías programadas (${cirugiasList.length})</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${cirugiasList.map(c => `
                        <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; background: #f8fafc;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                                <div>
                                    ${c.nombreProcedimiento ? `<div style="font-weight: 600; color: #333; font-size: 1rem; margin-bottom: 4px;">${(c.nombreProcedimiento || '').replace(/</g, '&lt;')}</div>` : ''}
                                    <strong style="color: #795548;"><i class="fas fa-clock"></i> ${formatFechaHora(c.fechaHora)}</strong>
                                    ${c.horaSalida ? `<div style="margin-top: 4px; color: #64748b; font-size: 0.85rem;"><i class="fas fa-sign-out-alt"></i> Salida: ${formatHora12(c.horaSalida)}</div>` : '<div style="margin-top: 4px; color: #b45309; font-size: 0.85rem;"><i class="fas fa-exclamation-triangle"></i> Aún no se ha registrado la salida</div>'}
                                    ${c.recomendacionesSalida ? `<div style="margin-top: 6px; color: #475569; font-size: 0.9rem;"><strong>Recomendaciones al salir:</strong> ${(c.recomendacionesSalida || '').replace(/</g, '&lt;')}</div>` : ''}
                                    <div style="margin-top: 6px; color: #475569; font-size: 0.9rem;">${(c.motivo || '—').replace(/</g, '&lt;')}</div>
                                    <div style="margin-top: 4px; color: #64748b; font-size: 0.85rem;"><i class="fas fa-user-md"></i> ${(c.doctor || '—').replace(/</g, '&lt;')}</div>
                                    ${c.creadoNombre ? `<div style="margin-top: 4px; color: #64748b; font-size: 0.85rem;"><i class="fas fa-user-edit"></i> Registrado por: ${(c.creadoNombre || '').replace(/</g, '&lt;')}</div>` : ''}
                                    ${c.cirugiaAgendadaConDoctor ? '<div style="margin-top: 6px;"><span style="display: inline-flex; align-items: center; gap: 4px; background: #e8f5e9; color: #2e7d32; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem;"><i class="fas fa-calendar-check"></i> Agendada con el doctor</span></div>' : ''}
                                </div>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <button type="button" class="btn btn-secondary btn-sm" data-cirugia-id="${(c.cirugiaId || '').replace(/"/g, '&quot;')}" onclick="window.internamientoModule.editarCirugia(this.getAttribute('data-cirugia-id'))" title="Editar cirugía"><i class="fas fa-edit"></i> Editar</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : `
            <div style="background: white; padding: 40px; border-radius: 12px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; color: #6c757d;">
                <i class="fas fa-procedures" style="font-size: 3rem; color: #795548; margin-bottom: 16px; opacity: 0.8;"></i>
                <p style="margin: 0; font-size: 1rem;">No hay cirugías programadas. Use "Agregar cirugía" para programar una.</p>
            </div>
        `;

        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-procedures"></i> Cirugías</h2>
                <div>
                    <button class="btn btn-primary" onclick="window.internamientoModule.agregarCirugia()">
                        <i class="fas fa-plus"></i> Agregar cirugía
                    </button>
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showPanelPrincipal('${id}')" style="margin-left: 10px;">
                        <i class="fas fa-arrow-left"></i> Volver al Panel
                    </button>
                </div>
            </div>
            ${listHTML}
        `;
    }

    agregarCirugia() {
        const today = new Date().toISOString().split('T')[0];
        const modalContent = `
            <form id="formAgregarCirugia">
                <div class="form-group">
                    <label>Fecha de la cirugía *</label>
                    <input type="date" id="cirugiaFecha" required value="${today}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-clock" style="color: #795548; margin-right: 6px;"></i>Hora de la cirugía *</label>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <select id="cirugiaHoraH" title="Hora (1-12)" required style="min-width: 52px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                            ${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<option value="${n}">${n}</option>`).join('')}
                        </select>
                        <span style="font-weight: bold;">:</span>
                        <select id="cirugiaHoraM" title="Minuto" required style="min-width: 52px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                            ${Array.from({ length: 60 }, (_, i) => `<option value="${String(i).padStart(2, '0')}">${String(i).padStart(2, '0')}</option>`).join('')}
                        </select>
                        <select id="cirugiaHoraAmpm" title="AM/PM" required style="min-width: 58px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-procedures" style="color: #795548; margin-right: 6px;"></i>Nombre del procedimiento *</label>
                    <input type="text" id="cirugiaNombreProcedimiento" required placeholder="Ej: Ovariohisterectomía, Castración, etc.">
                </div>
                <div class="form-group">
                    <label>Motivo de la cirugía</label>
                    <textarea id="cirugiaMotivo" rows="3" placeholder="Indique el motivo o detalles del procedimiento (opcional)"></textarea>
                </div>
                <div class="form-group">
                    <label>Doctor que la va a realizar *</label>
                    <select id="cirugiaDoctor" required>
                        <option value="">Seleccionar...</option>
                        <option value="Dr. Azofeifa">Dr. Azofeifa</option>
                        <option value="Dr. Coto">Dr. Coto</option>
                    </select>
                </div>
                <div class="form-group" style="margin-top: 12px;">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 500;">
                        <input type="checkbox" id="cirugiaAgendadaConDoctor" style="width: 18px; height: 18px;">
                        <i class="fas fa-calendar-check" style="color: #795548;"></i>
                        Cirugía ya agendada con el doctor
                    </label>
                </div>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                    <h4 style="margin: 0 0 12px 0; color: #795548; font-size: 1rem;"><i class="fas fa-sign-out-alt"></i> Salida de cirugía</h4>
                    <div class="form-group">
                        <label>Hora de salida</label>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <select id="cirugiaSalidaH" title="Hora (1-12) o en blanco" style="min-width: 52px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                                <option value="">—</option>
                                ${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<option value="${n}">${n}</option>`).join('')}
                            </select>
                            <span style="font-weight: bold;">:</span>
                            <select id="cirugiaSalidaM" title="Minuto" style="min-width: 52px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                                ${Array.from({ length: 60 }, (_, i) => `<option value="${String(i).padStart(2, '0')}">${String(i).padStart(2, '0')}</option>`).join('')}
                            </select>
                            <select id="cirugiaSalidaAmpm" title="AM/PM" style="min-width: 58px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                            </select>
                        </div>
                        <small style="color: #6c757d; font-size: 0.8rem;">Opcional</small>
                    </div>
                    <div class="form-group">
                        <label>Recomendaciones del doctor al salir de cirugía</label>
                        <textarea id="cirugiaRecomendacionesSalida" rows="3" placeholder="Indique las recomendaciones que dio el doctor al salir de cirugía (opcional)"></textarea>
                    </div>
                </div>
                <div style="text-align: right; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="margin-left: 10px;"><i class="fas fa-plus"></i> Agregar</button>
                </div>
            </form>
        `;
        const modal = this.createModal('Nueva cirugía', modalContent, 'fa-procedures');
        document.body.appendChild(modal);
        const form = document.getElementById('formAgregarCirugia');
        if (form) form.onsubmit = (e) => this.handleAgregarCirugia(e);
    }

    async handleAgregarCirugia(e) {
        e.preventDefault();
        const resultadoCodigo = await this.verificarCodigoAsistente('agregar_cirugia');
        if (!resultadoCodigo || !resultadoCodigo.valido || resultadoCodigo.cancelado) return;
        const nombreRegistradoPor = resultadoCodigo.nombre || '';

        const fechaEl = document.getElementById('cirugiaFecha');
        const selH = document.getElementById('cirugiaHoraH');
        const selM = document.getElementById('cirugiaHoraM');
        const selAmpm = document.getElementById('cirugiaHoraAmpm');
        let h24 = parseInt(selH?.value, 10) || 12;
        const ampm = selAmpm?.value || 'AM';
        if (ampm === 'PM' && h24 !== 12) h24 += 12;
        if (ampm === 'AM' && h24 === 12) h24 = 0;
        const m = String(selM?.value || '00').padStart(2, '0');
        const horaVal = `${String(h24).padStart(2, '0')}:${m}`;
        const selSalidaH = document.getElementById('cirugiaSalidaH');
        const selSalidaM = document.getElementById('cirugiaSalidaM');
        const selSalidaAmpm = document.getElementById('cirugiaSalidaAmpm');
        let horaSalidaVal = '';
        if (selSalidaH?.value) {
            let h24Salida = parseInt(selSalidaH.value, 10) || 12;
            const ampmSalida = selSalidaAmpm?.value || 'AM';
            if (ampmSalida === 'PM' && h24Salida !== 12) h24Salida += 12;
            if (ampmSalida === 'AM' && h24Salida === 12) h24Salida = 0;
            const mSalida = String(selSalidaM?.value || '00').padStart(2, '0');
            horaSalidaVal = `${String(h24Salida).padStart(2, '0')}:${mSalida}`;
        }
        const nombreProcedimiento = document.getElementById('cirugiaNombreProcedimiento')?.value?.trim() || '';
        const motivo = document.getElementById('cirugiaMotivo')?.value?.trim() || '';
        const doctor = document.getElementById('cirugiaDoctor')?.value?.trim() || '';
        const cirugiaAgendadaConDoctor = document.getElementById('cirugiaAgendadaConDoctor')?.checked || false;
        const recomendacionesSalida = document.getElementById('cirugiaRecomendacionesSalida')?.value?.trim() || '';
        const fechaVal = fechaEl?.value || '';
        const fechaHoraVal = fechaVal && horaVal ? `${fechaVal}T${horaVal}:00` : '';
        if (!fechaVal) {
            this.showAlert('Indique la fecha de la cirugía.', 'Datos requeridos', 'warning');
            return;
        }
        const cirugiaId = 'cirugia_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const userId = sessionStorage.getItem('userId') || '';

        const cirugiaData = {
            cirugiaId,
            fechaHora: fechaHoraVal,
            fechaHoraTs: new Date(fechaHoraVal).getTime(),
            ...(horaSalidaVal ? { horaSalida: horaSalidaVal } : {}),
            recomendacionesSalida: recomendacionesSalida || '',
            nombreProcedimiento,
            motivo,
            doctor,
            cirugiaAgendadaConDoctor: !!cirugiaAgendadaConDoctor,
            fechaCreacion: Date.now(),
            creadoPor: userId,
            creadoNombre: nombreRegistradoPor
        };

        try {
            const updates = {
                [`cirugias/${cirugiaId}`]: cirugiaData,
                'metadata/fechaUltimaActualizacion': Date.now()
            };
            await this.internamientosRef.child(this.currentInternamientoId).update(updates);
            const internamiento = this.internamientos.get(this.currentInternamientoId);
            if (internamiento) {
                const cirugiasPrev = internamiento.cirugias && typeof internamiento.cirugias === 'object' && !Array.isArray(internamiento.cirugias)
                    ? internamiento.cirugias
                    : {};
                const cirugias = { ...cirugiasPrev, [cirugiaId]: cirugiaData };
                this.internamientos.set(this.currentInternamientoId, { ...internamiento, cirugias });
            }
            this.showNotification(nombreRegistradoPor ? `Cirugía programada correctamente. Registrado por: ${nombreRegistradoPor}` : 'Cirugía programada correctamente', 'success');
            document.querySelector('.modal-overlay')?.remove();
            this.showInternamientoView('cirugias');
            this.loadCirugiasView();
        } catch (err) {
            console.error('Error al guardar cirugía:', err);
            this.showAlert('No se pudo guardar la cirugía: ' + (err.message || err), 'Error', 'error');
        }
    }

    /**
     * Convierte "HH:mm" (24h) a { h, m, ampm } para selects 12h.
     */
    _parseHora12(hhmm) {
        if (!hhmm || !String(hhmm).match(/^\d{1,2}:\d{2}$/)) return { h: 12, m: '00', ampm: 'AM' };
        const [hh, mm] = String(hhmm).split(':').map(n => parseInt(n, 10));
        const h24 = isNaN(hh) ? 0 : hh;
        const m = isNaN(mm) ? 0 : mm;
        let h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
        const ampm = h24 < 12 ? 'AM' : 'PM';
        return { h: h12, m: String(m).padStart(2, '0'), ampm };
    }

    editarCirugia(cirugiaId) {
        if (!this.currentInternamientoId || !cirugiaId) return;
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        const cirugias = internamiento?.cirugias && typeof internamiento.cirugias === 'object' && !Array.isArray(internamiento.cirugias)
            ? internamiento.cirugias
            : {};
        const c = cirugias[cirugiaId];
        if (!c) {
            this.showAlert('No se encontró la cirugía para editar.', 'Error', 'error');
            return;
        }
        this.mostrarVistaHistorialEdicionesCirugia(cirugiaId, c);
    }

    /** Vista de historial de ediciones de la cirugía. Desde aquí se inicia una nueva edición (código + motivo + formulario). */
    mostrarVistaHistorialEdicionesCirugia(cirugiaId, c) {
        const historial = c.historialEdiciones || [];
        const filas = [];
        if (historial.length > 0) {
            historial.forEach((entry) => {
                const fecha = entry.fecha || entry.timestamp;
                const fechaStr = fecha ? new Date(fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
                const nombre = (entry.editadoNombre || entry.usuarioNombre || '—').replace(/</g, '&lt;');
                const motivo = (entry.motivoCambio || '—').replace(/</g, '&lt;');
                filas.push(`
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${fechaStr}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${nombre}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${motivo}</td>
                    </tr>
                `);
            });
        } else if (c.editadoNombre || c.motivoUltimoCambio) {
            const fechaStr = c.fechaUltimaEdicion ? new Date(c.fechaUltimaEdicion).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
            filas.push(`
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${fechaStr}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${(c.editadoNombre || '—').replace(/</g, '&lt;')}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${(c.motivoUltimoCambio || '—').replace(/</g, '&lt;')}</td>
                </tr>
            `);
        }
        const nombreProc = (c.nombreProcedimiento || 'Cirugía').replace(/</g, '&lt;');
        const html = `
            <div style="padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <h3 style="margin: 0 0 8px 0; color: #333;"><i class="fas fa-history" style="color: #795548;"></i> Historial de ediciones</h3>
                    <p style="margin: 0; color: #666; font-size: 0.95rem;"><strong>${nombreProc}</strong></p>
                </div>
                ${filas.length > 0 ? `
                <div style="overflow-x: auto; margin-bottom: 24px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: #f5f5f5;">
                                <th style="padding: 10px; text-align: left;">Fecha</th>
                                <th style="padding: 10px; text-align: left;">Editado por</th>
                                <th style="padding: 10px; text-align: left;">Motivo del cambio</th>
                            </tr>
                        </thead>
                        <tbody>${filas.join('')}</tbody>
                    </table>
                </div>
                ` : `
                <p style="color: #888; margin-bottom: 24px;"><i class="fas fa-info-circle"></i> Aún no hay ediciones registradas para esta cirugía.</p>
                `}
                <div style="display: flex; gap: 12px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #e0e0e0;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                    <button type="button" class="btn btn-primary" data-cirugia-id="${(cirugiaId || '').replace(/"/g, '&quot;')}" onclick="window.internamientoModule.iniciarEdicionCirugiaDesdeHistorial(this.getAttribute('data-cirugia-id'))">
                        <i class="fas fa-edit"></i> Realizar nueva edición
                    </button>
                </div>
            </div>
        `;
        const modal = this.createModal('Editar cirugía - Historial', html, 'fa-history');
        document.body.appendChild(modal);
    }

    /** Solicita motivo de edición, verifica código y abre el formulario de edición. */
    async iniciarEdicionCirugiaDesdeHistorial(cirugiaId) {
        document.querySelector('.modal-overlay')?.remove();
        const motivoEdicion = await this.showPrompt(
            'Indique el motivo de la edición (ej: Cirujano atrasa la cirugía):',
            'Motivo de edición',
            '',
            true
        );
        if (!motivoEdicion || !motivoEdicion.trim()) {
            this.showNotification('Debe indicar el motivo de la edición', 'warning');
            return;
        }
        const resultadoCodigo = await this.verificarCodigoAsistente('editar_cirugia');
        if (!resultadoCodigo || !resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Edición cancelada', 'info');
            return;
        }
        this._edicionCirugiaPending = { cirugiaId, motivoEdicion: motivoEdicion.trim(), codigoResult: resultadoCodigo };
        this.abrirFormularioEditarCirugia(cirugiaId);
    }

    /** Abre el modal con el formulario de edición de cirugía (tras verificar código y motivo). */
    abrirFormularioEditarCirugia(cirugiaId) {
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        const cirugias = internamiento?.cirugias && typeof internamiento.cirugias === 'object' && !Array.isArray(internamiento.cirugias)
            ? internamiento.cirugias
            : {};
        const c = cirugias[cirugiaId] || {};
        const fechaHora = c.fechaHora || '';
        const fechaVal = fechaHora.split('T')[0] || new Date().toISOString().split('T')[0];
        const horaPart = fechaHora.includes('T') ? fechaHora.split('T')[1].substring(0, 5) : '08:00';
        const hora12 = this._parseHora12(horaPart);
        const salida12 = this._parseHora12(c.horaSalida || '');

        const modalContent = `
            <form id="formEditarCirugia" data-cirugia-id="${(cirugiaId || '').replace(/"/g, '&quot;')}">
                <div class="form-group">
                    <label>Fecha de la cirugía *</label>
                    <input type="date" id="cirugiaFecha" required value="${fechaVal}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-clock" style="color: #795548; margin-right: 6px;"></i>Hora de la cirugía *</label>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <select id="cirugiaHoraH" title="Hora (1-12)" required style="min-width: 52px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                            ${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === hora12.h ? 'selected' : ''}>${n}</option>`).join('')}
                        </select>
                        <span style="font-weight: bold;">:</span>
                        <select id="cirugiaHoraM" title="Minuto" required style="min-width: 52px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                            ${Array.from({ length: 60 }, (_, i) => { const m = String(i).padStart(2, '0'); return `<option value="${m}" ${m === hora12.m ? 'selected' : ''}>${m}</option>`; }).join('')}
                        </select>
                        <select id="cirugiaHoraAmpm" title="AM/PM" required style="min-width: 58px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                            <option value="AM" ${hora12.ampm === 'AM' ? 'selected' : ''}>AM</option>
                            <option value="PM" ${hora12.ampm === 'PM' ? 'selected' : ''}>PM</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-procedures" style="color: #795548; margin-right: 6px;"></i>Nombre del procedimiento *</label>
                    <input type="text" id="cirugiaNombreProcedimiento" required placeholder="Ej: Ovariohisterectomía, Castración, etc." value="${(c.nombreProcedimiento || '').replace(/"/g, '&quot;').replace(/</g, '&lt;')}">
                </div>
                <div class="form-group">
                    <label>Motivo de la cirugía</label>
                    <textarea id="cirugiaMotivo" rows="3" placeholder="Indique el motivo o detalles del procedimiento (opcional)">${(c.motivo || '').replace(/</g, '&lt;')}</textarea>
                </div>
                <div class="form-group">
                    <label>Doctor que la va a realizar *</label>
                    <select id="cirugiaDoctor" required>
                        <option value="">Seleccionar...</option>
                        <option value="Dr. Azofeifa" ${c.doctor === 'Dr. Azofeifa' ? 'selected' : ''}>Dr. Azofeifa</option>
                        <option value="Dr. Coto" ${c.doctor === 'Dr. Coto' ? 'selected' : ''}>Dr. Coto</option>
                    </select>
                </div>
                <div class="form-group" style="margin-top: 12px;">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 500;">
                        <input type="checkbox" id="cirugiaAgendadaConDoctor" style="width: 18px; height: 18px;" ${c.cirugiaAgendadaConDoctor ? 'checked' : ''}>
                        <i class="fas fa-calendar-check" style="color: #795548;"></i>
                        Cirugía ya agendada con el doctor
                    </label>
                </div>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                    <h4 style="margin: 0 0 12px 0; color: #795548; font-size: 1rem;"><i class="fas fa-sign-out-alt"></i> Salida de cirugía</h4>
                    <div class="form-group">
                        <label>Hora de salida</label>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <select id="cirugiaSalidaH" title="Hora (1-12) o en blanco" style="min-width: 52px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                                <option value="" ${!c.horaSalida ? 'selected' : ''}>—</option>
                                ${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<option value="${n}" ${c.horaSalida && n === salida12.h ? 'selected' : ''}>${n}</option>`).join('')}
                            </select>
                            <span style="font-weight: bold;">:</span>
                            <select id="cirugiaSalidaM" title="Minuto" style="min-width: 52px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                                ${Array.from({ length: 60 }, (_, i) => { const m = String(i).padStart(2, '0'); return `<option value="${m}" ${c.horaSalida && m === salida12.m ? 'selected' : ''}>${m}</option>`; }).join('')}
                            </select>
                            <select id="cirugiaSalidaAmpm" title="AM/PM" style="min-width: 58px; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;">
                                <option value="AM" ${!c.horaSalida || salida12.ampm === 'AM' ? 'selected' : ''}>AM</option>
                                <option value="PM" ${c.horaSalida && salida12.ampm === 'PM' ? 'selected' : ''}>PM</option>
                            </select>
                        </div>
                        <small style="color: #6c757d; font-size: 0.8rem;">Opcional</small>
                    </div>
                    <div class="form-group">
                        <label>Recomendaciones del doctor al salir de cirugía</label>
                        <textarea id="cirugiaRecomendacionesSalida" rows="3" placeholder="Indique las recomendaciones que dio el doctor al salir de cirugía (opcional)">${(c.recomendacionesSalida || '').replace(/</g, '&lt;')}</textarea>
                    </div>
                </div>
                <div style="text-align: right; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="margin-left: 10px;"><i class="fas fa-save"></i> Guardar cambios</button>
                </div>
            </form>
        `;
        const modal = this.createModal('Editar cirugía', modalContent, 'fa-edit');
        document.body.appendChild(modal);
        const form = document.getElementById('formEditarCirugia');
        if (form) form.onsubmit = (e) => this.handleEditarCirugia(e);
    }

    async handleEditarCirugia(e) {
        e.preventDefault();
        const pending = this._edicionCirugiaPending;
        if (!pending || pending.cirugiaId === undefined) {
            this.showAlert('Debe verificar su código e indicar el motivo de edición antes de guardar. Cierre y pulse de nuevo "Editar" → "Realizar nueva edición".', 'Verificación requerida', 'warning');
            return;
        }
        const cirugiaId = pending.cirugiaId;
        const motivoEdicion = pending.motivoEdicion || '';
        const codigoResult = pending.codigoResult || {};
        const form = document.getElementById('formEditarCirugia');
        if (!form || (form.getAttribute('data-cirugia-id') || '') !== cirugiaId) {
            this.showAlert('No se pudo identificar la cirugía.', 'Error', 'error');
            return;
        }

        const fechaEl = document.getElementById('cirugiaFecha');
        const selH = document.getElementById('cirugiaHoraH');
        const selM = document.getElementById('cirugiaHoraM');
        const selAmpm = document.getElementById('cirugiaHoraAmpm');
        let h24 = parseInt(selH?.value, 10) || 12;
        const ampm = selAmpm?.value || 'AM';
        if (ampm === 'PM' && h24 !== 12) h24 += 12;
        if (ampm === 'AM' && h24 === 12) h24 = 0;
        const m = String(selM?.value || '00').padStart(2, '0');
        const horaVal = `${String(h24).padStart(2, '0')}:${m}`;
        const selSalidaH = document.getElementById('cirugiaSalidaH');
        const selSalidaM = document.getElementById('cirugiaSalidaM');
        const selSalidaAmpm = document.getElementById('cirugiaSalidaAmpm');
        let horaSalidaVal = '';
        if (selSalidaH?.value) {
            let h24Salida = parseInt(selSalidaH.value, 10) || 12;
            const ampmSalida = selSalidaAmpm?.value || 'AM';
            if (ampmSalida === 'PM' && h24Salida !== 12) h24Salida += 12;
            if (ampmSalida === 'AM' && h24Salida === 12) h24Salida = 0;
            const mSalida = String(selSalidaM?.value || '00').padStart(2, '0');
            horaSalidaVal = `${String(h24Salida).padStart(2, '0')}:${mSalida}`;
        }
        const nombreProcedimiento = document.getElementById('cirugiaNombreProcedimiento')?.value?.trim() || '';
        const motivo = document.getElementById('cirugiaMotivo')?.value?.trim() || '';
        const doctor = document.getElementById('cirugiaDoctor')?.value?.trim() || '';
        const cirugiaAgendadaConDoctor = document.getElementById('cirugiaAgendadaConDoctor')?.checked || false;
        const recomendacionesSalida = document.getElementById('cirugiaRecomendacionesSalida')?.value?.trim() || '';
        const fechaVal = fechaEl?.value || '';
        const fechaHoraVal = fechaVal && horaVal ? `${fechaVal}T${horaVal}:00` : '';
        if (!fechaVal) {
            this.showAlert('Indique la fecha de la cirugía.', 'Datos requeridos', 'warning');
            return;
        }

        const internamiento = this.internamientos.get(this.currentInternamientoId);
        const cirugiasPrev = internamiento?.cirugias && typeof internamiento.cirugias === 'object' && !Array.isArray(internamiento.cirugias)
            ? internamiento.cirugias
            : {};
        const cPrev = cirugiasPrev[cirugiaId] || {};
        const historialPrev = cPrev.historialEdiciones || [];
        const ahora = Date.now();
        const nuevaEntradaHistorial = {
            fecha: ahora,
            timestamp: ahora,
            editadoPor: codigoResult.assistantId || null,
            editadoNombre: codigoResult.nombre || '',
            usuarioNombre: codigoResult.nombre || '',
            motivoCambio: motivoEdicion
        };
        const historialEdiciones = [...historialPrev, nuevaEntradaHistorial];

        const cirugiaData = {
            cirugiaId,
            fechaHora: fechaHoraVal,
            fechaHoraTs: new Date(fechaHoraVal).getTime(),
            ...(horaSalidaVal ? { horaSalida: horaSalidaVal } : {}),
            recomendacionesSalida: recomendacionesSalida || '',
            nombreProcedimiento,
            motivo,
            doctor,
            cirugiaAgendadaConDoctor: !!cirugiaAgendadaConDoctor,
            fechaCreacion: cPrev.fechaCreacion || Date.now(),
            creadoPor: cPrev.creadoPor || '',
            creadoNombre: cPrev.creadoNombre || '',
            historialEdiciones,
            editadoPor: codigoResult.assistantId || null,
            editadoNombre: codigoResult.nombre || '',
            motivoUltimoCambio: motivoEdicion,
            fechaUltimaEdicion: ahora
        };

        try {
            const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
            const updates = {
                [`cirugias/${cirugiaId}`]: cirugiaData,
                'metadata/fechaUltimaActualizacion': Date.now()
            };
            await internamientoRef.update(updates);
            const auditEntry = {
                timestamp: Date.now(),
                userId: codigoResult.assistantId || sessionStorage.getItem('userId'),
                usuarioNombre: codigoResult.nombre || sessionStorage.getItem('userName'),
                accion: 'editar_cirugia',
                codigoVerificado: true,
                detalles: { cirugiaId, nombreProcedimiento, motivoCambio: motivoEdicion }
            };
            await internamientoRef.child('auditoria/historialCambios').push(auditEntry);
            if (internamiento) {
                const cirugias = { ...cirugiasPrev, [cirugiaId]: cirugiaData };
                this.internamientos.set(this.currentInternamientoId, { ...internamiento, cirugias });
            }
            this._edicionCirugiaPending = null;
            this.showNotification('Cirugía actualizada correctamente. Editado por: ' + (codigoResult.nombre || ''), 'success');
            document.querySelector('.modal-overlay')?.remove();
            this.showInternamientoView('cirugias');
            this.loadCirugiasView();
        } catch (err) {
            console.error('Error al actualizar cirugía:', err);
            this.showAlert('No se pudo guardar los cambios: ' + (err.message || err), 'Error', 'error');
        }
    }

    async eliminarCirugia(cirugiaId) {
        if (!this.currentInternamientoId || !cirugiaId) return;
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        const cirugias = internamiento?.cirugias && typeof internamiento.cirugias === 'object' && !Array.isArray(internamiento.cirugias)
            ? internamiento.cirugias
            : {};
        const c = cirugias[cirugiaId];
        const nombreProc = c?.nombreProcedimiento || 'esta cirugía';
        if (!confirm(`¿Eliminar la cirugía "${nombreProc}"? Esta acción no se puede deshacer.`)) return;
        try {
            const updates = {
                [`cirugias/${cirugiaId}`]: null,
                'metadata/fechaUltimaActualizacion': Date.now()
            };
            await this.internamientosRef.child(this.currentInternamientoId).update(updates);
            const { [cirugiaId]: _, ...cirugiasResto } = cirugias;
            this.internamientos.set(this.currentInternamientoId, { ...internamiento, cirugias: cirugiasResto });
            this.showNotification('Cirugía eliminada', 'success');
            this.showInternamientoView('cirugias');
            this.loadCirugiasView();
        } catch (err) {
            console.error('Error al eliminar cirugía:', err);
            this.showAlert('No se pudo eliminar la cirugía: ' + (err.message || err), 'Error', 'error');
        }
    }

    // ================================================================
    // UTILIDAD: MODAL
    // ================================================================
    
    createModal(title, content, icon = 'fa-window-maximize') {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        modal.innerHTML = `
            <div class="modal-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin: 0; display: flex; align-items: center; gap: 12px; color: #f1f5f9; font-size: 1.3rem;">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas ${icon}" style="color: white; font-size: 1rem;"></i>
                        </div>
                        ${title}
                    </h3>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); width: 36px; height: 36px; border-radius: 10px; font-size: 18px; cursor: pointer; color: #94a3b8; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;" onmouseenter="this.style.background='rgba(239, 68, 68, 0.2)'; this.style.borderColor='rgba(239, 68, 68, 0.5)'; this.style.color='#ef4444';" onmouseleave="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='rgba(255,255,255,0.1)'; this.style.color='#94a3b8';">
                        <i class="fas fa-times"></i>
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

        // Cerrar con Escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        return modal;
    }

    // ================================================================
    // REVISAR / EDITAR INFORMACIÓN DE INGRESO
    // ================================================================

    async showRevisarDatosIngreso() {
        const id = this.currentInternamientoId;
        if (!id) {
            this.showAlert('Internamiento no encontrado', 'Error', 'error');
            return;
        }
        // Refrescar desde Firebase para que los cambios (p. ej. consulta externa) se reflejen
        let internamiento = this.internamientos.get(id);
        if (this.internamientosRef) {
            try {
                const snapshot = await this.internamientosRef.child(id).once('value');
                if (snapshot.exists()) {
                    internamiento = snapshot.val();
                    this.internamientos.set(id, internamiento);
                }
            } catch (err) {
                console.error('Error al refrescar datos de ingreso:', err);
            }
        }
        if (!internamiento) {
            this.showAlert('Internamiento no encontrado', 'Error', 'error');
            return;
        }
        const v = (s) => (s == null || s === '') ? '—' : String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const ref = internamiento.referencias || {};
        const datosIngreso = internamiento.datosIngreso || {};
        const controles = datosIngreso.controlesRapidos || {};
        const consentimientos = internamiento.consentimientos || {};
        const personaResp = consentimientos.personaResponsable || {};
        const plan = internamiento.planTerapeutico || {};
        const medicamentos = plan.medicamentos && typeof plan.medicamentos === 'object' ? Object.values(plan.medicamentos) : [];
        const procedimientos = internamiento.procedimientos && typeof internamiento.procedimientos === 'object' ? Object.values(internamiento.procedimientos) : [];
        const datosProp = this.getDatosPropietario(internamiento);
        const fechaIngresoTs = datosIngreso.fechaIngreso;
        const fechaIngresoStr = fechaIngresoTs ? (() => { const d = new Date(fechaIngresoTs); return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }); })() : '—';

        const htmlProp = `
            <div class="ingreso-detalle-section">
                <h4 class="ingreso-detalle-section-title"><i class="fas fa-user"></i> Datos del propietario</h4>
                <div class="ingreso-detalle-fila"><span class="label">Cédula</span><span class="value">${v(ref.cedulaCliente)}</span></div>
                <div class="ingreso-detalle-fila"><span class="label">Nombre</span><span class="value">${v(datosProp.nombre)}</span></div>
                <div class="ingreso-detalle-fila"><span class="label">Teléfono</span><span class="value">${v(datosProp.telefono)}</span></div>
                <div class="ingreso-detalle-fila"><span class="label">Correo</span><span class="value">${v(datosProp.correo)}</span></div>
            </div>`;
        const htmlPaciente = `
            <div class="ingreso-detalle-section">
                <h4 class="ingreso-detalle-section-title"><i class="fas fa-paw"></i> Datos del paciente</h4>
                <div class="ingreso-detalle-fila"><span class="label">Nombre de mascota</span><span class="value">${v(ref.nombreMascota)}</span></div>
                <div class="ingreso-detalle-fila"><span class="label">Especie</span><span class="value">${v(ref.tipoMascota)}</span></div>
                <div class="ingreso-detalle-fila"><span class="label">ID Paciente</span><span class="value">${v(ref.idPaciente)}</span></div>
            </div>`;
        const edicionConsultaExterna = !!datosIngreso.ultimaEdicionPorConsultaExterna;
        const fechaEdicionExt = datosIngreso.fechaEdicionConsultaExterna ? (() => { const d = new Date(datosIngreso.fechaEdicionConsultaExterna); return isNaN(d.getTime()) ? '' : d.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }); })() : '';
        const quienEdito = (datosIngreso.edicionConsultaExternaPorNombre || '').trim() || '—';
        const htmlConsultaExterna = edicionConsultaExterna ? `
            <div class="ingreso-detalle-section" style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <h4 class="ingreso-detalle-section-title" style="color: #92400e;"><i class="fas fa-external-link-alt"></i> Cambios realizados por consulta externa</h4>
                <div class="ingreso-detalle-fila"><span class="label">Quién hizo los cambios</span><span class="value">${v(quienEdito)}</span></div>
                ${fechaEdicionExt ? `<div class="ingreso-detalle-fila"><span class="label">Fecha de edición</span><span class="value">${fechaEdicionExt}</span></div>` : ''}
            </div>` : '';
        const htmlIngreso = `
            <div class="ingreso-detalle-section">
                <h4 class="ingreso-detalle-section-title"><i class="fas fa-calendar-check"></i> Ingreso</h4>
                <div class="ingreso-detalle-fila"><span class="label">Fecha y hora</span><span class="value">${fechaIngresoStr}</span></div>
                <div class="ingreso-detalle-fila"><span class="label">Médico responsable</span><span class="value">${v(datosIngreso.medicoNombre)}</span></div>
            </div>`;
        const htmlClinica = `
            <div class="ingreso-detalle-section">
                <h4 class="ingreso-detalle-section-title"><i class="fas fa-notes-medical"></i> Información clínica de ingreso</h4>
                <div style="font-size: 0.85rem; color: var(--internamiento-text-secondary); margin-bottom: 6px;">Historia clínica / Motivo</div>
                <div class="ingreso-detalle-texto">${v(datosIngreso.historiaClinica)}</div>
                <div class="ingreso-detalle-fila" style="margin-top: 14px;"><span class="label">Diagnóstico presuntivo</span><span class="value">${v(datosIngreso.diagnosticoPresuntivo)}</span></div>
                <div style="font-size: 0.85rem; color: var(--internamiento-text-secondary); margin: 14px 0 6px 0;">Padecimientos previos</div>
                <div class="ingreso-detalle-texto">${v(datosIngreso.padecimientosPrevios)}</div>
                <div class="ingreso-detalle-fila" style="margin-top: 14px;"><span class="label">Peso de ingreso</span><span class="value">${datosIngreso.pesoIngreso != null ? datosIngreso.pesoIngreso + ' kg' : '—'}</span></div>
                <div class="ingreso-detalle-fila"><span class="label">Temperatura de ingreso</span><span class="value">${datosIngreso.temperaturaIngreso != null ? datosIngreso.temperaturaIngreso + ' °C' : '—'}</span></div>
                <div style="font-size: 0.85rem; color: var(--internamiento-text-secondary); margin: 14px 0 6px 0;">Necesidades especiales</div>
                <div class="ingreso-detalle-texto">${v(datosIngreso.necesidadesEspeciales)}</div>
            </div>`;
        const htmlControles = `
            <div class="ingreso-detalle-section">
                <h4 class="ingreso-detalle-section-title"><i class="fas fa-clipboard-list"></i> Controles rápidos</h4>
                <div class="ingreso-detalle-controles">
                    <div class="item"><span>Toma de muestras</span><strong>${controles.tomaronMuestras ? 'Sí' : 'No'}${controles.tipoMuestra ? ' — ' + v(controles.tipoMuestra) : ''}</strong></div>
                    <div class="item"><span>Ultrasonido</span><strong>${controles.ultrasonido ? 'Sí' : 'No'}</strong></div>
                    <div class="item"><span>Rayos X</span><strong>${controles.rayosX ? 'Sí' : 'No'}</strong></div>
                    <div class="item"><span>Castrado</span><strong>${controles.castrado ? 'Sí' : 'No'}</strong></div>
                    <div class="item"><span>Vacunas/desparasitación al día</span><strong>${controles.vacunaDespaAlDia ? 'Sí' : 'No'}</strong></div>
                    ${controles.reticulocitosTieneExamen ? `<div class="item"><span>Reticulocitos</span><strong>Sí${controles.reticulocitosRegenerativa === 'regenerativa' ? ' · Regenerativa' : controles.reticulocitosRegenerativa === 'no_regenerativa' ? ' · No regenerativa' : controles.reticulocitosRegenerativa === 'resultados_pendientes' ? ' · Resultados pendientes' : ''}</strong></div>` : ''}
                </div>
            </div>`;
        const htmlPersonaResp = (personaResp.nombre || personaResp.telefono) ? `
            <div class="ingreso-detalle-section">
                <h4 class="ingreso-detalle-section-title"><i class="fas fa-phone-alt"></i> Persona de respaldo (comunicación)</h4>
                <div class="ingreso-detalle-fila"><span class="label">Nombre</span><span class="value">${v(personaResp.nombre)}</span></div>
                <div class="ingreso-detalle-fila"><span class="label">Teléfono</span><span class="value">${v(personaResp.telefono)}</span></div>
            </div>` : '';
        const htmlMeds = medicamentos.length > 0 ? `
            <div class="ingreso-detalle-section">
                <h4 class="ingreso-detalle-section-title"><i class="fas fa-pills"></i> Plan de medicación (ingreso)</h4>
                <div>
                    ${medicamentos.map(m => `
                        <div class="ingreso-detalle-med-item">
                            <strong>${v(m.nombreComercial)}</strong> — ${v(this.formatDosisUnidad(m))} · ${v(m.viaAdministracion)}${m.frecuenciaHoras ? ' cada ' + m.frecuenciaHoras + ' h' : ''}${(m.horariosExactos && m.horariosExactos.length) ? ' · Horarios: ' + (m.horariosExactos || []).join(', ') : ''}
                            ${m.observaciones ? '<div style="margin-top: 6px; color: #64748b; font-size: 0.85rem;">' + v(m.observaciones) + '</div>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>` : '';
        const htmlProcs = procedimientos.length > 0 ? `
            <div class="ingreso-detalle-section">
                <h4 class="ingreso-detalle-section-title"><i class="fas fa-tasks"></i> Procedimientos (ingreso)</h4>
                <div>
                    ${procedimientos.map(p => `
                        <div class="ingreso-detalle-proc-item">
                            <strong>${v(p.tipo)}</strong> — ${v(p.descripcion)}${p.prioridad ? ' · Prioridad: ' + v(p.prioridad) : ''} · Estado: ${v(p.estado)}
                            ${p.observaciones ? '<div style="margin-top: 6px; color: #64748b; font-size: 0.85rem;">' + v(p.observaciones) + '</div>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>` : '';

        const nombreMascota = v(ref.nombreMascota) !== '—' ? v(ref.nombreMascota) : 'Paciente';
        const contenido = `
            <div class="ingreso-detalle-modal">
                <div class="ingreso-detalle-header">
                    <div class="ingreso-detalle-header-icon"><i class="fas fa-file-medical-alt"></i></div>
                    <div class="ingreso-detalle-header-info">
                        <h3>Datos de ingreso</h3>
                        <div class="meta"><i class="fas fa-paw" style="margin-right:6px;"></i>${nombreMascota}</div>
                        <div class="meta"><i class="fas fa-calendar-alt" style="margin-right:6px;"></i>${fechaIngresoStr}</div>
                    </div>
                </div>
                ${htmlConsultaExterna}
                ${htmlProp}
                ${htmlPaciente}
                ${htmlIngreso}
                ${htmlClinica}
                ${htmlControles}
                ${htmlPersonaResp}
                ${htmlMeds}
                ${htmlProcs}
                <div class="ingreso-detalle-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i> Cerrar</button>
                    <button type="button" class="btn btn-primary" onclick="this.closest('.modal-overlay').remove(); window.internamientoModule.showEditarInformacionIngreso();"><i class="fas fa-edit"></i> Editar información de ingreso</button>
                </div>
            </div>`;
        const modal = this.createModal('Revisar datos de ingreso', contenido, 'fa-file-alt');
        document.body.appendChild(modal);
    }

    showEditarInformacionIngreso() {
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        if (!internamiento) {
            this.showAlert('Internamiento no encontrado', 'Error', 'error');
            return;
        }

        const datosIngreso = internamiento.datosIngreso || {};
        const controles = datosIngreso.controlesRapidos || {};
        const ref = internamiento.referencias || {};
        const datosProp = this.getDatosPropietario(internamiento);
        const consentimientos = internamiento.consentimientos || {};
        const personaResp = consentimientos.personaResponsable || {};

        const formHTML = `
            <form id="formEditarIngreso" style="max-height: 70vh; overflow-y: auto;">
                <div class="form-section">
                    <h3><i class="fas fa-user"></i> Datos del Propietario</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editPropCedula">Cédula</label>
                            <input type="text" id="editPropCedula" value="${(ref.cedulaCliente || '').replace(/"/g, '&quot;')}" readonly style="background:#e5e7eb; cursor:not-allowed;">
                        </div>
                        <div class="form-group">
                            <label for="editPropNombre">Nombre completo</label>
                            <input type="text" id="editPropNombre" value="${(datosProp.nombre || '').replace(/"/g, '&quot;')}" placeholder="Nombre del propietario">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editPropTelefono">Teléfono</label>
                            <input type="tel" id="editPropTelefono" value="${(datosProp.telefono || '').replace(/"/g, '&quot;')}" placeholder="Teléfono de contacto">
                        </div>
                        <div class="form-group">
                            <label for="editPropCorreo">Correo</label>
                            <input type="email" id="editPropCorreo" value="${(datosProp.correo || '').replace(/"/g, '&quot;')}" placeholder="ejemplo@correo.com">
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3><i class="fas fa-paw"></i> Datos del Paciente</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editMascotaNombre">Nombre de mascota</label>
                            <input type="text" id="editMascotaNombre" value="${(ref.nombreMascota || '').replace(/"/g, '&quot;')}" placeholder="Nombre de la mascota">
                        </div>
                        <div class="form-group">
                            <label for="editTipoMascota">Especie</label>
                            <select id="editTipoMascota">
                                <option value="perro" ${ref.tipoMascota === 'perro' ? 'selected' : ''}>Perro</option>
                                <option value="gato" ${ref.tipoMascota === 'gato' ? 'selected' : ''}>Gato</option>
                                <option value="otro" ${!ref.tipoMascota || (ref.tipoMascota !== 'perro' && ref.tipoMascota !== 'gato') ? 'selected' : ''}>Otro</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3><i class="fas fa-notes-medical"></i> Información Clínica de Ingreso</h3>
                    <div class="form-row">
                        <div class="form-group" style="grid-column: span 2;">
                            <label for="editHistoriaClinica">Historia Clínica / Motivo de Internamiento</label>
                            <textarea id="editHistoriaClinica" rows="4" placeholder="Descripción detallada del caso...">${datosIngreso.historiaClinica || ''}</textarea>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="grid-column: span 2;">
                            <label for="editDiagnostico">Diagnóstico Presuntivo</label>
                            <input type="text" id="editDiagnostico" placeholder="Ej: Gastroenteritis aguda" value="${datosIngreso.diagnosticoPresuntivo || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="grid-column: span 2;">
                            <label for="editPadecimientos">Padecimientos o Enfermedades Previas</label>
                            <textarea id="editPadecimientos" rows="2" placeholder="Historial médico relevante">${datosIngreso.padecimientosPrevios || ''}</textarea>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editPesoIngreso">Peso de Ingreso (kg)</label>
                            <input type="number" id="editPesoIngreso" step="0.1" min="0" placeholder="Ej: 12.5" value="${datosIngreso.pesoIngreso || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editTempIngreso">Temperatura de Ingreso (°C)</label>
                            <input type="number" id="editTempIngreso" step="0.1" min="30" max="45" placeholder="Ej: 38.5" value="${datosIngreso.temperaturaIngreso || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="grid-column: span 2;">
                            <label for="editNecesidades">Necesidades Especiales / Observaciones</label>
                            <textarea id="editNecesidades" rows="2" placeholder="Ej: Agresivo, manejar con precaución">${datosIngreso.necesidadesEspeciales || ''}</textarea>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3><i class="fas fa-clipboard-list"></i> Controles rápidos</h3>
                    <div class="form-row">
                        <div class="form-group" style="grid-column: span 2;">
                            <label>
                                <input type="checkbox" id="editTomaronMuestras" ${controles.tomaronMuestras ? 'checked' : ''}>
                                Se tomaron muestras
                            </label>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="grid-column: span 2;">
                            <label for="editTipoMuestra">Tipo de muestra</label>
                            <input type="text" id="editTipoMuestra" placeholder="Ej: sangre, orina, heces" value="${(controles.tipoMuestra || '').replace(/"/g, '&quot;')}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="editUltrasonido" ${controles.ultrasonido ? 'checked' : ''}>
                                Se realizó ultrasonido
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="editRayosX" ${controles.rayosX ? 'checked' : ''}>
                                Se tomaron Rayos X
                            </label>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="editCastrado" ${controles.castrado ? 'checked' : ''}>
                                Paciente castrado
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="editVacunasAlDia" ${controles.vacunaDespaAlDia ? 'checked' : ''}>
                                Vacunas y desparasitación al día
                            </label>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="grid-column: span 2;">
                            <label style="display: flex; align-items: center; gap: 8px; font-weight: normal; cursor: pointer; margin-bottom: 10px;">
                                <input type="checkbox" id="editReticulocitosTieneExamen" ${controles.reticulocitosTieneExamen ? 'checked' : ''}>
                                Tiene examen de reticulocitos
                            </label>
                            <div id="editReticulocitosClasificacionWrap" style="margin-left: 26px; margin-top: 8px; display: ${controles.reticulocitosTieneExamen ? 'block' : 'none'};">
                                <div style="display: flex; flex-wrap: wrap; gap: 16px;">
                                    <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: normal; cursor: pointer;">
                                        <input type="radio" name="editReticulocitosTipo" value="regenerativa" ${controles.reticulocitosRegenerativa === 'regenerativa' ? 'checked' : ''}>
                                        Regenerativa
                                    </label>
                                    <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: normal; cursor: pointer;">
                                        <input type="radio" name="editReticulocitosTipo" value="no_regenerativa" ${controles.reticulocitosRegenerativa === 'no_regenerativa' ? 'checked' : ''}>
                                        No regenerativa
                                    </label>
                                </div>
                                    <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: normal; cursor: pointer; margin-top: 8px;">
                                        <input type="radio" name="editReticulocitosTipo" value="resultados_pendientes" id="editReticulocitosResultadosPendientes" ${controles.reticulocitosRegenerativa === 'resultados_pendientes' ? 'checked' : ''}>
                                        Resultados pendientes
                                    </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3><i class="fas fa-phone"></i> Persona de respaldo para comunicación</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editPersonaRespNombre">Nombre del contacto</label>
                            <input type="text" id="editPersonaRespNombre" value="${(personaResp.nombre || '').replace(/"/g, '&quot;')}" placeholder="Ej. familiar o amigo">
                        </div>
                        <div class="form-group">
                            <label for="editPersonaRespTelefono">Teléfono del contacto</label>
                            <input type="tel" id="editPersonaRespTelefono" value="${(personaResp.telefono || '').replace(/"/g, '&quot;')}" placeholder="Para notificaciones">
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Guardar Cambios</button>
                </div>
            </form>
        `;

        const modal = this.createModal('Editar Información de Ingreso', formHTML, 'fa-edit');
        document.body.appendChild(modal);

        // Manejar submit
        const form = document.getElementById('formEditarIngreso');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarInformacionIngreso();
        });

        // Reticulocitos: mostrar opciones solo si "Tiene examen" está marcado
        const editChkRetic = document.getElementById('editReticulocitosTieneExamen');
        const editWrapRetic = document.getElementById('editReticulocitosClasificacionWrap');
        if (editChkRetic && editWrapRetic) {
            editChkRetic.addEventListener('change', function() {
                editWrapRetic.style.display = this.checked ? 'block' : 'none';
            });
        }
    }

    async guardarInformacionIngreso() {
        const userId = sessionStorage.getItem('userId');
        const userName = sessionStorage.getItem('userName');

        const updates = {};
        const internamiento = this.internamientos.get(this.currentInternamientoId);
        const ref = internamiento?.referencias || {};

        // Datos propietario
        const propNombre = document.getElementById('editPropNombre')?.value.trim() || '';
        const propTelefono = document.getElementById('editPropTelefono')?.value.trim() || '';
        const propCorreo = document.getElementById('editPropCorreo')?.value.trim() || '';

        // Datos paciente
        const mascotaNombre = document.getElementById('editMascotaNombre')?.value.trim() || '';
        const tipoMascota = document.getElementById('editTipoMascota')?.value || 'otro';

        // Información clínica
        updates['datosIngreso/historiaClinica'] = document.getElementById('editHistoriaClinica')?.value.trim() || '';
        updates['datosIngreso/diagnosticoPresuntivo'] = document.getElementById('editDiagnostico')?.value.trim() || '';
        updates['datosIngreso/padecimientosPrevios'] = document.getElementById('editPadecimientos')?.value.trim() || '';
        const pesoValue = document.getElementById('editPesoIngreso')?.value;
        updates['datosIngreso/pesoIngreso'] = pesoValue ? parseFloat(pesoValue) : null;
        const tempValue = document.getElementById('editTempIngreso')?.value;
        updates['datosIngreso/temperaturaIngreso'] = tempValue ? parseFloat(tempValue) : null;
        updates['datosIngreso/necesidadesEspeciales'] = document.getElementById('editNecesidades')?.value.trim() || '';

        // Controles rápidos (preservar doctorRayosX, reporteRayosX, reporteUltrasonido si no se editan)
        const controlesPrev = internamiento.datosIngreso?.controlesRapidos || {};
        const tomaronMuestras = !!document.getElementById('editTomaronMuestras')?.checked;
        const tipoMuestra = document.getElementById('editTipoMuestra')?.value.trim() || '';
        const ultrasonido = !!document.getElementById('editUltrasonido')?.checked;
        const rayosX = !!document.getElementById('editRayosX')?.checked;
        const castrado = !!document.getElementById('editCastrado')?.checked;
        const vacunasAlDia = !!document.getElementById('editVacunasAlDia')?.checked;
        const reticulocitosTieneExamen = !!document.getElementById('editReticulocitosTieneExamen')?.checked;
        const editRadioRetic = document.querySelector('input[name="editReticulocitosTipo"]:checked');
        const reticulocitosRegenerativa = reticulocitosTieneExamen && editRadioRetic ? editRadioRetic.value : null;
        updates['datosIngreso/controlesRapidos'] = {
            ...controlesPrev,
            tomaronMuestras,
            tipoMuestra,
            ultrasonido,
            rayosX,
            castrado,
            vacunaDespaAlDia: vacunasAlDia,
            reticulocitosTieneExamen,
            reticulocitosRegenerativa,
            reticulocitosRegistradoEnIngreso: reticulocitosTieneExamen
        };

        // Persona de respaldo
        const personaRespNombre = document.getElementById('editPersonaRespNombre')?.value.trim() || '';
        const personaRespTelefono = document.getElementById('editPersonaRespTelefono')?.value.trim() || '';
        updates['consentimientos/personaResponsable'] = {
            nombre: personaRespNombre || propNombre,
            telefono: personaRespTelefono || propTelefono,
            relacion: 'Propietario',
            esContactoPrincipal: true
        };

        // Referencias del paciente y del propietario
        if (mascotaNombre) updates['referencias/nombreMascota'] = mascotaNombre;
        updates['referencias/tipoMascota'] = tipoMascota || 'otro';
        // Guardar también los datos del propietario para que se reflejen en el panel y en Revisar datos de ingreso
        updates['referencias/nombrePropietario'] = propNombre || ref.nombrePropietario || '';
        updates['referencias/telefonoPropietario'] = propTelefono || ref.telefonoPropietario || '';
        updates['referencias/correoPropietario'] = propCorreo || ref.correoPropietario || '';

        updates['metadata/fechaUltimaActualizacion'] = Date.now();

        try {
            const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
            await internamientoRef.update(updates);

            // Actualizar datos en memoria
            if (internamiento) {
                const actualizado = { ...internamiento };
                actualizado.datosIngreso = actualizado.datosIngreso || {};
                actualizado.datosIngreso.historiaClinica = updates['datosIngreso/historiaClinica'];
                actualizado.datosIngreso.diagnosticoPresuntivo = updates['datosIngreso/diagnosticoPresuntivo'];
                actualizado.datosIngreso.padecimientosPrevios = updates['datosIngreso/padecimientosPrevios'];
                actualizado.datosIngreso.pesoIngreso = updates['datosIngreso/pesoIngreso'];
                actualizado.datosIngreso.temperaturaIngreso = updates['datosIngreso/temperaturaIngreso'];
                actualizado.datosIngreso.necesidadesEspeciales = updates['datosIngreso/necesidadesEspeciales'];
                actualizado.datosIngreso.controlesRapidos = updates['datosIngreso/controlesRapidos'];
                actualizado.consentimientos = actualizado.consentimientos || {};
                actualizado.consentimientos.personaResponsable = updates['consentimientos/personaResponsable'];
                actualizado.referencias = actualizado.referencias || {};
                if (mascotaNombre) actualizado.referencias.nombreMascota = mascotaNombre;
                actualizado.referencias.tipoMascota = tipoMascota || 'otro';
                actualizado.referencias.nombrePropietario = updates['referencias/nombrePropietario'];
                actualizado.referencias.telefonoPropietario = updates['referencias/telefonoPropietario'];
                actualizado.referencias.correoPropietario = updates['referencias/correoPropietario'];
                this.internamientos.set(this.currentInternamientoId, actualizado);
            }

            // Actualizar datos del propietario en base de pacientes
            const cedula = ref.cedulaCliente;
            if (cedula && window.patientDatabase) {
                await window.patientDatabase.savePatientFromTicket({
                    cedula,
                    nombre: propNombre || (internamiento?.datosIngreso?.medicoNombre || ''),
                    telefono: propTelefono,
                    correo: propCorreo,
                    mascota: mascotaNombre || ref.nombreMascota || '',
                    idPaciente: ref.idPaciente || '',
                    tipoMascota: tipoMascota || ref.tipoMascota || 'otro'
                });
            }

            // Auditoría
            await internamientoRef.child('auditoria/historialCambios').push({
                timestamp: Date.now(),
                userId: userId,
                usuarioNombre: userName,
                accion: 'editar_informacion_ingreso',
                detalles: 'Información de ingreso actualizada'
            });

            // Cerrar modal
            document.querySelector('.modal-overlay')?.remove();
            
            // Recargar panel
            this.loadPanelPrincipal(this.currentInternamientoId);
            
            this.showNotification('Información de ingreso actualizada correctamente', 'success');
        } catch (error) {
            console.error('Error guardando información de ingreso:', error);
            this.showAlert('Error al guardar: ' + error.message, 'Error', 'error');
        }
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
                'ADVERTENCIA',
                { danger: true, confirmText: 'Sí, eliminar', cancelText: 'Cancelar' }
            );
            if (!confirmarActivo) return;
        }

        // Confirmación principal
        const confirmacion1 = await this.showConfirm(
            `Paciente: ${nombreMascota}\nExpediente: ${expediente}\nEstado: ${estado}\n\n¿Está seguro de eliminar este expediente?\n\nEsta acción es IRREVERSIBLE.`,
            'ELIMINAR EXPEDIENTE',
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

        console.log(`Expediente ${internamientoId} eliminado. Backup guardado en internamientos_eliminados.`);
    }

    // ================================================================
    // PROCEDIMIENTOS (Placeholder - se extiende en internamiento-procedimientos.js)
    // ================================================================
    
    showProcedimientosView() {
        console.log('Mostrando vista de procedimientos...');
        console.log('Current ID:', this.currentInternamientoId);
        console.log('loadProcedimientosView existe:', typeof this.loadProcedimientosView);
        
        if (!this.currentInternamientoId) {
            alert('Error: No hay internamiento seleccionado');
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
            alert('Módulo de procedimientos no cargado correctamente.\n\nRecargue la página.');
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
        console.log('Módulo de Internamiento destruido');
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

