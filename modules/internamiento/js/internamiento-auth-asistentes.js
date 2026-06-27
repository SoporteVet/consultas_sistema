// ====================================================================
// SISTEMA DE CÓDIGOS DE PERSONAL MÉDICO
// ====================================================================
// Gestión de códigos para asistentes, técnicos y doctores (internamiento, etc.)

function normalizeDoctorProfileInternamiento(value) {
    if (value == null) return null;
    if (typeof value === 'string') return { name: value, pin: '' };
    if (typeof value === 'object') {
        return {
            name: value.name || value.nombre || '',
            pin: value.pin || ''
        };
    }
    return null;
}

function getDoctorNameInternamiento(value) {
    const profile = normalizeDoctorProfileInternamiento(value);
    return profile ? profile.name : '';
}

// ================================================================
// SESIÓN TEMPORAL DE CÓDIGO (evita pedir código en cada acción)
// ================================================================

const INTERNAMIENTO_SESIONES_CODIGO_KEY = 'internamiento_codigo_sesiones';
const INTERNAMIENTO_SESION_CODIGO_DEFAULT_MIN = 20;
const INTERNAMIENTO_ACCIONES_SIEMPRE_CODIGO = ['defuncion', 'activar_protocolo'];

InternamientoModule.prototype._leerSesionesCodigoMap = function() {
    try {
        const raw = sessionStorage.getItem(INTERNAMIENTO_SESIONES_CODIGO_KEY);
        if (!raw) return {};
        const map = JSON.parse(raw);
        return map && typeof map === 'object' ? map : {};
    } catch (e) {
        return {};
    }
};

InternamientoModule.prototype._guardarSesionesCodigoMap = function(map) {
    sessionStorage.setItem(INTERNAMIENTO_SESIONES_CODIGO_KEY, JSON.stringify(map || {}));
};

InternamientoModule.prototype._getInternamientoIdSesionCodigo = function(internamientoId) {
    return internamientoId || this.currentInternamientoId || null;
};

InternamientoModule.prototype._getConfigSesionCodigo = function() {
    const cfg = this._configSesionCodigoCache;
    if (cfg) return cfg;
    return {
        habilitada: true,
        duracionMinutos: INTERNAMIENTO_SESION_CODIGO_DEFAULT_MIN,
        accionesSiempreCodigo: INTERNAMIENTO_ACCIONES_SIEMPRE_CODIGO.slice()
    };
};

InternamientoModule.prototype.cargarConfigSesionCodigo = async function() {
    try {
        const snap = await window.database.ref('internamiento_config/sesion_codigo').once('value');
        const data = snap.val();
        this._configSesionCodigoCache = {
            habilitada: data?.habilitada !== false,
            duracionMinutos: Math.max(1, Math.min(480, Number(data?.duracionMinutos) || INTERNAMIENTO_SESION_CODIGO_DEFAULT_MIN)),
            accionesSiempreCodigo: Array.isArray(data?.accionesSiempreCodigo) && data.accionesSiempreCodigo.length
                ? data.accionesSiempreCodigo
                : INTERNAMIENTO_ACCIONES_SIEMPRE_CODIGO.slice()
        };
    } catch (e) {
        console.warn('Config sesión código: usando valores por defecto', e);
        this._configSesionCodigoCache = this._getConfigSesionCodigo();
    }
    return this._configSesionCodigoCache;
};

InternamientoModule.prototype.guardarConfigSesionCodigo = async function(habilitada, duracionMinutos) {
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'admin') {
        this.showAlert('Solo administradores pueden cambiar esta configuración', 'Acceso Denegado', 'error');
        return;
    }
    const payload = {
        habilitada: !!habilitada,
        duracionMinutos: Math.max(1, Math.min(480, Number(duracionMinutos) || INTERNAMIENTO_SESION_CODIGO_DEFAULT_MIN)),
        accionesSiempreCodigo: INTERNAMIENTO_ACCIONES_SIEMPRE_CODIGO.slice(),
        actualizadoEn: Date.now()
    };
    await window.database.ref('internamiento_config/sesion_codigo').set(payload);
    this._configSesionCodigoCache = payload;
    this.showNotification('Configuración de sesión de código guardada', 'success');
};

InternamientoModule.prototype.getSesionCodigoActiva = function(internamientoId) {
    const id = this._getInternamientoIdSesionCodigo(internamientoId);
    if (!id) return null;
    try {
        const map = this._leerSesionesCodigoMap();
        const sesion = map[id];
        if (!sesion || !sesion.valido || !sesion.expiresAt) return null;
        if (Date.now() >= sesion.expiresAt) {
            delete map[id];
            this._guardarSesionesCodigoMap(map);
            return null;
        }
        return sesion;
    } catch (e) {
        const map = this._leerSesionesCodigoMap();
        delete map[id];
        this._guardarSesionesCodigoMap(map);
        return null;
    }
};

InternamientoModule.prototype.crearSesionCodigo = function(resultado, accion, internamientoId) {
    const cfg = this._getConfigSesionCodigo();
    const id = this._getInternamientoIdSesionCodigo(internamientoId);
    if (!cfg.habilitada || !resultado?.valido || !id) return;
    const duracionMs = (cfg.duracionMinutos || INTERNAMIENTO_SESION_CODIGO_DEFAULT_MIN) * 60 * 1000;
    const sesion = {
        valido: true,
        internamientoId: id,
        assistantId: resultado.assistantId || null,
        doctorId: resultado.doctorId || null,
        tipoPersonal: resultado.tipoPersonal || null,
        nombre: resultado.nombre || '',
        codigo: resultado.codigo || '',
        expiresAt: Date.now() + duracionMs,
        iniciadaEn: Date.now(),
        ultimaAccion: accion || 'acceso',
        desdeSesion: false
    };
    const map = this._leerSesionesCodigoMap();
    map[id] = sesion;
    this._guardarSesionesCodigoMap(map);
    this.actualizarBannerSesionCodigo();
};

InternamientoModule.prototype.limpiarSesionCodigo = function(silencioso, internamientoId) {
    const id = this._getInternamientoIdSesionCodigo(internamientoId);
    if (id) {
        const map = this._leerSesionesCodigoMap();
        delete map[id];
        this._guardarSesionesCodigoMap(map);
    }
    this.actualizarBannerSesionCodigo();
    if (!silencioso) {
        this.showNotification('Sesión de código cerrada para este paciente', 'info');
    }
};

InternamientoModule.prototype.requiereCodigoFresco = function(accion) {
    const cfg = this._getConfigSesionCodigo();
    if (!cfg.habilitada) return true;
    const lista = cfg.accionesSiempreCodigo || INTERNAMIENTO_ACCIONES_SIEMPRE_CODIGO;
    return lista.includes(accion);
};

InternamientoModule.prototype.getMinutosRestantesSesionCodigo = function() {
    const sesion = this.getSesionCodigoActiva();
    if (!sesion) return 0;
    return Math.max(0, Math.ceil((sesion.expiresAt - Date.now()) / 60000));
};

InternamientoModule.prototype.actualizarBannerSesionCodigo = function() {
    const section = document.getElementById('internamientosSection');
    if (!section) return;

    let banner = document.getElementById('internamientoSesionCodigoBanner');
    const sesion = this.getSesionCodigoActiva();
    const cfg = this._getConfigSesionCodigo();

    if (!sesion || !cfg.habilitada) {
        if (banner) banner.remove();
        if (this._sesionCodigoInterval) {
            clearInterval(this._sesionCodigoInterval);
            this._sesionCodigoInterval = null;
        }
        return;
    }

    const minRestantes = this.getMinutosRestantesSesionCodigo();
    const nombreEsc = (sesion.nombre || 'Personal').replace(/</g, '&lt;');
    const internamiento = this.internamientos?.get?.(this.currentInternamientoId);
    const mascotaEsc = (internamiento?.referencias?.nombreMascota || 'Paciente actual').replace(/</g, '&lt;');

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'internamientoSesionCodigoBanner';
        banner.style.cssText = 'margin-bottom:16px;padding:12px 16px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;background:linear-gradient(135deg,#e8f5e9 0%,#c8e6c9 100%);border:1px solid #81c784;color:#1b5e20;';
        const container = section.querySelector('.int-container') || section;
        container.insertBefore(banner, container.firstChild);
    }

    banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <i class="fas fa-user-shield" style="font-size:1.2rem;"></i>
            <span><strong>${nombreEsc}</strong> autenticado en <strong>${mascotaEsc}</strong> · sin código por <strong id="internamientoSesionMinRestantes">${minRestantes}</strong> min</span>
            <span style="font-size:0.85rem;opacity:0.85;">(sesión por paciente — al cambiar de internamiento se pedirá código)</span>
        </div>
        <button type="button" class="btn btn-sm btn-secondary" id="btnCerrarSesionCodigoInternamiento" style="white-space:nowrap;">
            <i class="fas fa-sign-out-alt"></i> Cerrar sesión
        </button>
    `;

    const btnCerrar = document.getElementById('btnCerrarSesionCodigoInternamiento');
    if (btnCerrar) {
        btnCerrar.onclick = () => this.limpiarSesionCodigo(false);
    }

    if (!this._sesionCodigoInterval) {
        this._sesionCodigoInterval = setInterval(() => {
            const activa = this.getSesionCodigoActiva();
            if (!activa) {
                this.actualizarBannerSesionCodigo();
                return;
            }
            const el = document.getElementById('internamientoSesionMinRestantes');
            if (el) el.textContent = String(this.getMinutosRestantesSesionCodigo());
        }, 30000);
    }
};

/** Nombre legible: primero doctors/{id}, luego assistants/{id}. */
InternamientoModule.prototype.resolverNombrePersonalMedico = function(personId, assistants, doctors) {
    if (!personId) return '';

    const doctorRaw = doctors && doctors[personId];
    if (doctorRaw != null) {
        const doctorName = getDoctorNameInternamiento(doctorRaw);
        if (doctorName && String(doctorName).trim()) return String(doctorName).trim();
    }

    const assistantData = assistants && assistants[personId];
    if (assistantData == null) return '';
    if (typeof assistantData === 'string') return String(assistantData).trim();
    return String(assistantData.nombre || assistantData.name || '').trim();
};

// ================================================================
// VERIFICAR CÓDIGO DE ASISTENTE / DOCTOR
// ================================================================

InternamientoModule.prototype._resolveInternamientoIdParaCodigo = function(accion) {
    if (this.currentInternamientoId) return this.currentInternamientoId;
    if (this.edicionIngresoConsultaId) return this.edicionIngresoConsultaId;
    if (this._edicionMedicamentoInternamientoId) return this._edicionMedicamentoInternamientoId;
    return null;
};

InternamientoModule.prototype._accionesCodigoSinPacienteInternado = function() {
    return new Set(['acceso', 'admision']);
};

InternamientoModule.prototype.verificarCodigoAsistente = async function(accion = 'acceso') {
    if (!this._configSesionCodigoCache) {
        await this.cargarConfigSesionCodigo();
    }

    const internamientoId = this._resolveInternamientoIdParaCodigo(accion);
    if (!internamientoId && !this._accionesCodigoSinPacienteInternado().has(accion)) {
        const mensajesPorAccion = {
            edicion_ingreso_consulta_externa: 'Seleccione un paciente en el desplegable «Paciente a editar (últimas 24 h)» antes de verificar el código.',
            editar_pendiente_consulta_externa: 'Seleccione primero el paciente a editar en el desplegable de las últimas 24 horas.',
            editar_procedimiento_consulta_externa: 'Seleccione primero el paciente a editar en el desplegable de las últimas 24 horas.'
        };
        const mensaje = mensajesPorAccion[accion]
            || 'Abra el panel de un paciente internado o selecciónelo en el formulario de admisión antes de continuar.';
        this.showAlert(mensaje, 'Paciente requerido', 'warning');
        return { valido: false, cancelado: true };
    }

    const cfg = this._getConfigSesionCodigo();
    if (cfg.habilitada && internamientoId && !this.requiereCodigoFresco(accion)) {
        const sesion = this.getSesionCodigoActiva(internamientoId);
        if (sesion) {
            sesion.ultimaAccion = accion;
            const map = this._leerSesionesCodigoMap();
            map[internamientoId] = sesion;
            this._guardarSesionesCodigoMap(map);
            this.actualizarBannerSesionCodigo();
            return {
                valido: true,
                assistantId: sesion.assistantId,
                doctorId: sesion.doctorId,
                tipoPersonal: sesion.tipoPersonal,
                nombre: sesion.nombre,
                codigo: sesion.codigo,
                desdeSesion: true
            };
        }
    }

    return new Promise((resolve, reject) => {
        const modalContent = this.getCodigoAsistenteFormHTML(accion);
        const modal = this.createModal('Código de Personal Médico Requerido', modalContent, 'fa-lock');
        document.body.appendChild(modal);

        // Setup form
        setTimeout(() => {
            const form = document.getElementById('formCodigoAsistente');
            const inputCodigo = document.getElementById('codigoAsistenteInput');
            
            if (form && inputCodigo) {
                // Focus en el input
                inputCodigo.focus();

                form.onsubmit = async (e) => {
                    e.preventDefault();
                    const codigo = inputCodigo.value.trim();
                    
                    if (!codigo) {
                        this.showAlert('Por favor ingresa tu código', 'Código Requerido', 'warning');
                        return;
                    }

                    const btnSubmit = form.querySelector('button[type="submit"]');
                    const originalBtnText = btnSubmit ? btnSubmit.innerHTML : '';
                    if (btnSubmit) {
                        btnSubmit.disabled = true;
                        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
                    }

                    try {
                        const resultado = await this.validarCodigoAsistente(codigo);
                        
                        if (resultado.valido) {
                            this.crearSesionCodigo(resultado, accion);
                            const cfgSesion = this._getConfigSesionCodigo();
                            const msgSesion = cfgSesion.habilitada && !this.requiereCodigoFresco(accion)
                                ? ` · Sesión activa ${cfgSesion.duracionMinutos} min`
                                : '';
                            this.showNotification(`Bienvenido(a), ${resultado.nombre}${msgSesion}`, 'success');
                            modal.remove();
                            resolve(resultado);
                        } else {
                            inputCodigo.value = '';
                            inputCodigo.focus();
                            this.showAlert('Código incorrecto. Verifica con el administrador.', 'Código Inválido', 'error');
                            if (btnSubmit) {
                                btnSubmit.disabled = false;
                                btnSubmit.innerHTML = originalBtnText;
                            }
                        }
                    } catch (error) {
                        console.error('Error validando código:', error);
                        this.showAlert('Error al validar código: ' + error.message, 'Error', 'error');
                        if (btnSubmit) {
                            btnSubmit.disabled = false;
                            btnSubmit.innerHTML = originalBtnText;
                        }
                    }
                };

                // Botón cancelar
                const btnCancelar = modal.querySelector('.btn-cancelar-codigo');
                if (btnCancelar) {
                    btnCancelar.onclick = () => {
                        modal.remove();
                        resolve({ valido: false, cancelado: true });
                    };
                }
            }
        }, 100);
    });
};

InternamientoModule.prototype.getCodigoAsistenteFormHTML = function(accion) {
    const textoAccion = {
        'acceso': 'acceder al módulo de internamiento',
        'medicacion': 'administrar medicación',
        'procedimiento': 'realizar este procedimiento',
        'turno': 'registrar el turno',
        'admision': 'registrar este internamiento',
        'activar_protocolo': 'activar el Protocolo de Internamiento',
        'defuncion': 'registrar una defunción',
        'suspender_medicamento': 'suspender este medicamento',
        'editar_medicamento': 'editar este medicamento',
        'agregar_medicamento': 'agregar este medicamento al plan',
        'agregar_tarea': 'agregar esta tarea o procedimiento',
        'completar_procedimiento': 'marcar este procedimiento como completado',
        'registro_transfusion': 'registrar esta transfusión',
        'parametros_transfusion': 'agregar parámetros de transfusión',
        'agregar_bolo': 'agregar este bolo',
        'reticulocitos_transfusion': 'registrar reticulocitos y dar fe de que leyó o fue informado del resultado de laboratorio',
        'agregar_cirugia': 'agregar esta cirugía',
        'editar_cirugia': 'editar esta cirugía',
        'registrar_llamada': 'registrar este reporte al cliente',
        'agregar_dia_rer': 'agregar este día de RER',
        'editar_dia_rer': 'editar este día de RER',
        'agregar_dia_alimentacion_asistida': 'agregar este día de Alimentación asistida',
        'agregar_toma_rer': 'registrar esta toma de RER',
        'editar_toma_rer': 'registrar lo aplicado en esta toma de RER',
        'agregar_toma_alimentacion_asistida': 'registrar esta toma de Alimentación asistida',
        'agregar_hidratacion': 'registrar esta hidratación',
        'guardar_glucosa': 'guardar esta medición de glucosa',
        'configurar_horarios_glucosa': 'configurar los horarios de toma de glucosa',
        'imagenologia': 'registrar este estudio de imagenología',
        'crear_presupuesto': 'registrar este presupuesto con archivo',
        'crear_factura_archivo': 'registrar esta factura con archivo',
        'aprobar_presupuesto': 'aprobar este presupuesto',
        'agregar_factura': 'registrar esta factura',
        'factura_pago': 'marcar este cobro como pagado',
        'anular_factura': 'anular esta factura o documento',
        'edicion_ingreso_consulta_externa': 'guardar los cambios de ingreso (consulta externa)',
        'editar_turno': 'editar este turno',
        'medicacion_lote': 'administrar varios medicamentos seleccionados'
    };

    return `
        <div style="padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
                <div style="font-size: 4rem; margin-bottom: 15px;"><i class="fas fa-lock"></i></div>
                <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 10px;">
                    Autenticación de Personal Médico
                </div>
                <div style="font-size: 0.95rem; opacity: 0.9;">
                    Para ${textoAccion[accion] || 'continuar'}, ingresa tu código personal
                </div>
            </div>

            <form id="formCodigoAsistente">
                <div class="form-group">
                    <label style="font-weight: 600; display: block; margin-bottom: 10px; color: #2c3e50;">
                        <i class="fas fa-key"></i> Código de Personal Médico
                    </label>
                    <input type="password" 
                           id="codigoAsistenteInput" 
                           placeholder="Ingresa tu código de 4-6 dígitos"
                           required
                           maxlength="6"
                           pattern="[0-9]{4,6}"
                           style="width: 100%; padding: 15px; border-radius: 8px; border: 2px solid #ddd; font-size: 1.1rem; text-align: center; letter-spacing: 5px; font-weight: bold;">
                    <small style="color: #6c757d; display: block; margin-top: 8px;">
                        <i class="fas fa-info-circle"></i> Si no tienes un código, solicítalo al administrador
                    </small>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 25px;">
                    <button type="button" class="btn btn-secondary btn-cancelar-codigo" style="flex: 1;">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary" style="flex: 1;">
                        <i class="fas fa-check"></i> Verificar
                    </button>
                </div>
            </form>

            <div style="margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 6px; border-left: 4px solid #4caf50;">
                <div style="font-size: 0.85rem; color: #2e7d32;">
                    <strong><i class="fas fa-clock"></i> Sesión temporal:</strong> Tras verificar, podrás realizar acciones en <strong>este paciente</strong> sin volver a ingresar el código durante el tiempo configurado. Al entrar a otro internamiento se pedirá código de nuevo (excepto defunción y protocolo).
                </div>
            </div>

            <div style="margin-top: 12px; padding: 15px; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
                <div style="font-size: 0.85rem; color: #856404;">
                    <strong><i class="fas fa-shield-alt"></i> Seguridad:</strong> Tu código es personal e intransferible. 
                    No lo compartas con nadie. Cada uso queda registrado en el sistema.
                </div>
            </div>
        </div>
    `;
};

// ================================================================
// VALIDAR CÓDIGO EN FIREBASE
// assistants_codigos, doctors_codigos y PIN de doctor (recetas).
// ================================================================

InternamientoModule.prototype._codigoCoincide = function(codigoNormalizado, codigoGuardado) {
    if (codigoGuardado == null || codigoGuardado === '') return false;
    return codigoNormalizado === String(codigoGuardado).trim();
};

InternamientoModule.prototype.validarCodigoAsistente = async function(codigoIngresado) {
    try {
        const codigoNormalizado = String(codigoIngresado).trim();
        if (!codigoNormalizado) {
            return { valido: false, mensaje: 'Código requerido' };
        }

        const [assistantsSnapshot, codigosSnapshot, doctorsSnapshot, doctorsCodigosSnapshot] = await Promise.all([
            window.database.ref('assistants').once('value'),
            window.database.ref('assistants_codigos').once('value'),
            window.database.ref('doctors').once('value'),
            window.database.ref('doctors_codigos').once('value')
        ]);

        const assistants = assistantsSnapshot.val() || {};
        const codigos = codigosSnapshot.val() || {};
        const doctors = doctorsSnapshot.val() || {};
        const doctorsCodigos = doctorsCodigosSnapshot.val() || {};

        // Doctores primero (código en doctors_codigos)
        for (const [doctorId, codigoData] of Object.entries(doctorsCodigos)) {
            if (!codigoData || codigoData.codigo == null || codigoData.codigo === '') continue;
            if (!this._codigoCoincide(codigoNormalizado, codigoData.codigo)) continue;

            const doctorName = this.resolverNombrePersonalMedico(doctorId, assistants, doctors);
            if (!doctorName) {
                return { valido: false, mensaje: 'Doctor no encontrado en el sistema' };
            }

            await this.registrarUsoCodigoAsistente(doctorId, doctorName, 'validacion_exitosa', 'doctor');

            return {
                valido: true,
                assistantId: doctorId,
                doctorId: doctorId,
                tipoPersonal: 'doctor',
                nombre: doctorName,
                codigo: codigoNormalizado
            };
        }

        // Doctores: PIN del perfil (recetas / firma)
        for (const [doctorId, doctorRaw] of Object.entries(doctors)) {
            const profile = normalizeDoctorProfileInternamiento(doctorRaw);
            const pin = profile && profile.pin ? String(profile.pin).trim() : '';
            if (!pin || !this._codigoCoincide(codigoNormalizado, pin)) continue;

            const doctorName = this.resolverNombrePersonalMedico(doctorId, assistants, doctors);
            if (!doctorName) {
                return { valido: false, mensaje: 'Doctor no encontrado en el sistema' };
            }

            await this.registrarUsoCodigoAsistente(doctorId, doctorName, 'validacion_exitosa', 'doctor');

            return {
                valido: true,
                assistantId: doctorId,
                doctorId: doctorId,
                tipoPersonal: 'doctor',
                nombre: doctorName,
                codigo: codigoNormalizado
            };
        }

        // Asistentes / técnicos (assistants_codigos)
        for (const [assistantId, codigoData] of Object.entries(codigos)) {
            if (!codigoData || codigoData.codigo == null || codigoData.codigo === '') continue;
            if (!this._codigoCoincide(codigoNormalizado, codigoData.codigo)) continue;

            const assistantName = this.resolverNombrePersonalMedico(assistantId, assistants, doctors);
            if (!assistantName) {
                return { valido: false, mensaje: 'Personal no encontrado en el sistema' };
            }

            await this.registrarUsoCodigoAsistente(assistantId, assistantName, 'validacion_exitosa', 'assistant');

            return {
                valido: true,
                assistantId: assistantId,
                tipoPersonal: 'assistant',
                nombre: assistantName,
                codigo: codigoNormalizado
            };
        }

        // Estudiantes con código temporal
        for (const [studentId, studentData] of Object.entries(students)) {
            if (!studentData || !studentData.codigo) continue;
            if (!this._codigoCoincide(codigoNormalizado, studentData.codigo)) continue;
            // Verificar vencimiento
            if (studentData.vencimiento && Date.now() > studentData.vencimiento) {
                return { valido: false, mensaje: `Código de estudiante vencido (${new Date(studentData.vencimiento).toLocaleDateString('es-PE', { hour12: true })})` };
            }
            const nombre = (studentData.nombre || 'Estudiante') + ' (Estudiante)';
            await this.registrarUsoCodigoAsistente(studentId, nombre, 'validacion_exitosa', 'estudiante');
            return {
                valido: true,
                assistantId: studentId,
                tipoPersonal: 'estudiante',
                nombre: nombre,
                codigo: codigoNormalizado
            };
        }

        await this.registrarUsoCodigoAsistente(null, null, 'validacion_fallida');
        return { valido: false, mensaje: 'Código incorrecto' };
    } catch (error) {
        console.error('Error validando código:', error);
        throw error;
    }
};

InternamientoModule.prototype.registrarUsoCodigoAsistente = async function(assistantId, assistantName, resultado, tipoPersonal) {
    try {
        const registro = {
            timestamp: Date.now(),
            fecha: new Date().toISOString(),
            assistantId: assistantId || null,
            assistantName: assistantName || null,
            tipoPersonal: tipoPersonal || null,
            resultado: resultado,
            internamientoId: this.currentInternamientoId || null,
            userAgent: navigator.userAgent
        };

        await window.database.ref(`auditoria_codigos_asistentes`).push(registro);
    } catch (error) {
        console.error('Error registrando uso de código:', error);
    }
};

// ================================================================
// VALIDAR CÓDIGO Y OBTENER NOMBRE (sin exigir usuario actual)
// Usado por el botón "Verificar código" junto al protocolo de internamiento
// ================================================================

InternamientoModule.prototype.validarCodigoYObtenerNombre = async function(codigoIngresado) {
    try {
        const resultado = await this.validarCodigoAsistente(codigoIngresado);
        if (!resultado.valido) {
            return { valido: false, mensaje: resultado.mensaje || 'Código no válido o no asignado' };
        }
        return {
            valido: true,
            nombre: resultado.nombre || 'Sin nombre',
            assistantId: resultado.assistantId,
            doctorId: resultado.doctorId || null,
            tipoPersonal: resultado.tipoPersonal || null
        };
    } catch (error) {
        console.error('Error validando código:', error);
        throw error;
    }
};

InternamientoModule.prototype.mostrarModalVerificarCodigoYMostrarNombre = function() {
    const modalContent = `
        <div style="padding: 20px;">
            <div style="background: linear-gradient(135deg, #5c6bc0 0%, #3949ab 100%); color: white; padding: 25px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 15px;"><i class="fas fa-user-check"></i></div>
                <div style="font-size: 1.1rem; font-weight: 600;">Verificar Código de Personal Médico</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Ingresa el código para ver a quién pertenece</div>
            </div>
            <div id="verificarCodigoFormContainer">
                <form id="formVerificarCodigo">
                    <div class="form-group">
                        <label style="font-weight: 600; display: block; margin-bottom: 10px; color: #2c3e50;">
                            <i class="fas fa-key"></i> Código
                        </label>
                        <input type="password" 
                               id="verificarCodigoInput" 
                               placeholder="Código de 4-6 dígitos"
                               required
                               maxlength="6"
                               pattern="[0-9]{4,6}"
                               style="width: 100%; padding: 15px; border-radius: 8px; border: 2px solid #ddd; font-size: 1.1rem; text-align: center; letter-spacing: 5px; font-weight: bold;">
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 25px;">
                        <button type="button" class="btn btn-secondary btn-cerrar-verificar-codigo" style="flex: 1;">
                            <i class="fas fa-times"></i> Cerrar
                        </button>
                        <button type="submit" class="btn btn-primary" style="flex: 1;">
                            <i class="fas fa-search"></i> Verificar
                        </button>
                    </div>
                </form>
            </div>
            <div id="verificarCodigoResultado" style="display: none; margin-top: 20px; padding: 20px; border-radius: 8px;"></div>
        </div>
    `;
    const modal = this.createModal('Verificar Código de Personal', modalContent, 'fa-user-check');
    document.body.appendChild(modal);

    setTimeout(() => {
        const form = document.getElementById('formVerificarCodigo');
        const input = document.getElementById('verificarCodigoInput');
        const formContainer = document.getElementById('verificarCodigoFormContainer');
        const resultDiv = document.getElementById('verificarCodigoResultado');

        if (form && input) {
            input.focus();
            form.onsubmit = async (e) => {
                e.preventDefault();
                const codigo = input.value.trim();
                if (!codigo) {
                    this.showAlert('Ingresa el código', 'Código requerido', 'warning');
                    return;
                }
                const btnSubmit = form.querySelector('button[type="submit"]');
                const originalBtnText = btnSubmit ? btnSubmit.innerHTML : '';
                if (btnSubmit) {
                    btnSubmit.disabled = true;
                    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
                }
                try {
                    const resultado = await this.validarCodigoYObtenerNombre(codigo);
                    if (resultado.valido) {
                        resultDiv.style.display = 'block';
                        resultDiv.style.background = '#e8f5e9';
                        resultDiv.style.border = '1px solid #a5d6a7';
                        resultDiv.style.color = '#1b5e20';
                        resultDiv.innerHTML = `
                            <div style="font-weight: 600; margin-bottom: 8px;"><i class="fas fa-check-circle"></i> Código válido</div>
                            <div style="font-size: 1.1rem;">Personal: <strong>${(resultado.nombre || '').replace(/</g, '&lt;')}</strong></div>
                        `;
                        formContainer.style.display = 'none';
                        this.showNotification('Código válido: ' + resultado.nombre, 'success');
                    } else {
                        this.showAlert(resultado.mensaje || 'Código no válido', 'Código inválido', 'error');
                        if (btnSubmit) {
                            btnSubmit.disabled = false;
                            btnSubmit.innerHTML = originalBtnText;
                        }
                    }
                } catch (err) {
                    this.showAlert('Error al verificar: ' + (err.message || 'Error desconocido'), 'Error', 'error');
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = originalBtnText;
                    }
                }
            };
        }
        const btnCerrar = modal.querySelector('.btn-cerrar-verificar-codigo');
        if (btnCerrar) {
            btnCerrar.onclick = () => modal.remove();
        }
    }, 100);
};

// ================================================================
// PANEL DE ADMINISTRACIÓN DE CÓDIGOS (SOLO ADMIN)
// ================================================================

InternamientoModule.prototype.mostrarGestionCodigos = async function() {
    const userRole = sessionStorage.getItem('userRole');
    
    if (userRole !== 'admin') {
        this.showAlert('Solo administradores pueden gestionar códigos de personal médico', 'Acceso Denegado', 'error');
        return;
    }

    const listo = await this.onModuleEnter();
    if (!listo) return;

    const modalContent = this.getGestionCodigosHTML();
    const modal = this.createModal('Gestión de Códigos de Personal Médico', modalContent, 'fa-cog');
    document.body.appendChild(modal);

    setTimeout(async () => {
        await this.cargarConfigSesionCodigo();
        const cfg = this._getConfigSesionCodigo();
        const chk = document.getElementById('cfgSesionCodigoHabilitada');
        const minInput = document.getElementById('cfgSesionCodigoMinutos');
        const btnGuardar = document.getElementById('btnGuardarConfigSesionCodigo');
        if (chk) chk.checked = cfg.habilitada !== false;
        if (minInput) minInput.value = String(cfg.duracionMinutos || INTERNAMIENTO_SESION_CODIGO_DEFAULT_MIN);
        if (btnGuardar) {
            btnGuardar.onclick = async () => {
                try {
                    await this.guardarConfigSesionCodigo(
                        document.getElementById('cfgSesionCodigoHabilitada')?.checked,
                        document.getElementById('cfgSesionCodigoMinutos')?.value
                    );
                } catch (err) {
                    this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
                }
            };
        }
        this.cargarListaUsuariosConCodigos();
    }, 100);
};

InternamientoModule.prototype.getGestionCodigosHTML = function() {
    return `
        <div style="padding: 15px; max-height: 75vh; overflow-y: auto;">
            <!-- Configuración sesión temporal -->
            <div id="configSesionCodigoPanel" style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
                <div style="font-weight: 600; color: #2e7d32; margin-bottom: 10px;">
                    <i class="fas fa-clock"></i> Sesión temporal de código
                </div>
                <div style="font-size: 0.9rem; color: #33691e; margin-bottom: 12px;">
                    Tras ingresar el código una vez, el personal puede trabajar en <strong>ese paciente</strong> sin repetirlo hasta que expire el tiempo.
                    Al cambiar de internamiento se pedirá código de nuevo. Defunción y activación de protocolo siempre piden código nuevo.
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input type="checkbox" id="cfgSesionCodigoHabilitada" checked>
                        Sesión habilitada
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;">
                        Duración (minutos):
                        <input type="number" id="cfgSesionCodigoMinutos" min="1" max="480" value="20" style="width:80px;padding:6px;border-radius:4px;border:1px solid #ccc;">
                    </label>
                    <button type="button" class="btn btn-sm btn-primary" id="btnGuardarConfigSesionCodigo">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                </div>
            </div>

            <!-- Información -->
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2196f3;">
                <div style="font-weight: 600; color: #1565c0; margin-bottom: 8px;">
                    <i class="fas fa-info-circle"></i> Sistema de Códigos de Personal Médico
                </div>
                <div style="font-size: 0.9rem; color: #1976d2;">
                    Asigna códigos personales a asistentes, técnicos y doctores. Estos códigos son requeridos para:
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>Ingresar un internamiento (admisión)</li>
                        <li>Administrar medicamentos</li>
                        <li>Registrar turnos de internamiento</li>
                        <li>Acceder a módulos sensibles</li>
                    </ul>
                    <div style="margin-top: 8px; font-size: 0.85rem;">
                        Los doctores con PIN en su perfil (recetas) también pueden usar ese mismo PIN al verificar en admisión.
                    </div>
                </div>
            </div>

            <!-- Acceso rápido a estudiantes -->
            <div style="margin-bottom: 16px; padding: 12px 16px; background: #e8f5e9; border-radius: 8px; border: 1px solid #a5d6a7; display:flex; align-items:center; justify-content:space-between;">
                <div style="font-size:0.9rem;color:#2e7d32;"><i class="fas fa-user-graduate"></i> <strong>Estudiantes:</strong> Códigos temporales con fecha de vencimiento.</div>
                <button class="btn btn-sm btn-success" onclick="window.internamientoModule.mostrarGestionEstudiantes()">
                    <i class="fas fa-user-graduate"></i> Gestionar Estudiantes
                </button>
            </div>

            <!-- Información sobre la lista -->
            <div style="margin-bottom: 20px; padding: 12px; background: #f0f0f0; border-radius: 6px; font-size: 0.9rem; color: #666;">
                <i class="fas fa-info-circle"></i> La lista muestra el personal médico registrado en el sistema. 
                Selecciona un usuario y haz clic en "Asignar" o "Cambiar" para gestionar su código.
            </div>

            <!-- Lista de usuarios con códigos -->
            <div id="listaUsuariosCodigos">
                <div style="text-align: center; padding: 40px; color: #999;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>Cargando usuarios...</p>
                </div>
            </div>

            <!-- Botón cerrar -->
            <div style="margin-top: 25px; text-align: right; border-top: 2px solid #e0e0e0; padding-top: 20px;">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i> Cerrar
                </button>
            </div>
        </div>
    `;
};

InternamientoModule.prototype.cargarListaUsuariosConCodigos = async function() {
    const container = document.getElementById('listaUsuariosCodigos');
    if (!container) return;

    try {
        const [assistantsSnapshot, codigosSnapshot, doctorsSnapshot, doctorsCodigosSnapshot] = await Promise.all([
            window.database.ref('assistants').once('value'),
            window.database.ref('assistants_codigos').once('value'),
            window.database.ref('doctors').once('value'),
            window.database.ref('doctors_codigos').once('value')
        ]);

        const assistants = assistantsSnapshot.val() || {};
        const codigos = codigosSnapshot.val() || {};
        const doctors = doctorsSnapshot.val() || {};
        const doctorsCodigos = doctorsCodigosSnapshot.val() || {};

        const lista = [];

        Object.entries(assistants).forEach(([id, data]) => {
            const nombre = typeof data === 'string' ? data : (data.nombre || data.name || data);
            const codigoData = codigos[id] || {};
            lista.push({
                id,
                nombre: nombre || 'Sin nombre',
                tipo: 'assistant',
                codigoAsistente: codigoData.codigo || null,
                codigoOrigen: codigoData.codigo ? 'internamiento' : null
            });
        });

        Object.entries(doctors).forEach(([id, data]) => {
            const profile = normalizeDoctorProfileInternamiento(data);
            const nombre = profile ? profile.name : '';
            const codigoInternamiento = doctorsCodigos[id] && doctorsCodigos[id].codigo
                ? doctorsCodigos[id].codigo
                : null;
            const pinPerfil = profile && profile.pin ? String(profile.pin).trim() : '';
            const codigoEfectivo = codigoInternamiento || pinPerfil || null;
            let codigoOrigen = null;
            if (codigoInternamiento) codigoOrigen = 'internamiento';
            else if (pinPerfil) codigoOrigen = 'pin_recetas';

            lista.push({
                id,
                nombre: nombre || 'Sin nombre',
                tipo: 'doctor',
                codigoAsistente: codigoEfectivo,
                codigoOrigen,
                tienePinSolo: !codigoInternamiento && !!pinPerfil
            });
        });

        lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

        if (lista.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-friends"></i>
                    <p>No hay personal médico ni doctores registrados en el sistema</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Personal</th>
                        <th>Rol</th>
                        <th>Código</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${lista.map(persona => this.renderFilaUsuarioCodigo(persona)).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error cargando personal médico:', error);
        container.innerHTML = `
            <div class="alert-box danger">
                <i class="fas fa-exclamation-triangle"></i>
                <div>Error al cargar personal médico: ${error.message}</div>
            </div>
        `;
    }
};

InternamientoModule.prototype.renderFilaUsuarioCodigo = function(asistente) {
    const tieneCodigo = asistente.codigoAsistente && asistente.codigoAsistente !== '';
    const codigoMasked = tieneCodigo ? '****' + String(asistente.codigoAsistente).slice(-2) : 'Sin código';
    const esDoctor = asistente.tipo === 'doctor';
    const rolLabel = esDoctor
        ? '<span style="color:#1565c0;"><i class="fas fa-user-md"></i> Doctor</span>'
        : '<span style="color:#6a1b9a;"><i class="fas fa-user-nurse"></i> Asistente / técnico</span>';
    const origenHint = asistente.codigoOrigen === 'pin_recetas'
        ? '<div style="font-size:0.75rem;color:#856404;margin-top:4px;">PIN de recetas (perfil)</div>'
        : '';
    const nombreSafe = (asistente.nombre || '').replace(/'/g, "\\'");
    const tipoSafe = asistente.tipo || 'assistant';
    const puedeEliminar = tieneCodigo && asistente.codigoOrigen === 'internamiento';

    return `
        <tr>
            <td>
                <div style="font-weight: 600;">${asistente.nombre || 'Sin nombre'}</div>
                <div style="font-size: 0.85rem; color: #6c757d;">ID: ${asistente.id}</div>
            </td>
            <td>${rolLabel}</td>
            <td>
                <span style="font-family: monospace; font-weight: 600; color: ${tieneCodigo ? '#27ae60' : '#95a5a6'};">
                    ${codigoMasked}
                </span>
                ${origenHint}
            </td>
            <td>
                ${tieneCodigo 
                    ? '<span style="color: #27ae60;"><i class="fas fa-check-circle"></i> Activo</span>' 
                    : '<span style="color: #e74c3c;"><i class="fas fa-times-circle"></i> Sin código</span>'}
            </td>
            <td>
                <button class="btn btn-sm btn-primary" 
                        onclick="window.internamientoModule.editarCodigoUsuario('${asistente.id}', '${nombreSafe}', '${tipoSafe}')"
                        title="${tieneCodigo ? 'Cambiar código' : 'Asignar código'}">
                    <i class="fas fa-${tieneCodigo ? 'edit' : 'plus'}"></i> ${tieneCodigo ? 'Cambiar' : 'Asignar'}
                </button>
                ${puedeEliminar ? `
                    <button class="btn btn-sm btn-danger" 
                            onclick="window.internamientoModule.eliminarCodigoUsuario('${asistente.id}', '${nombreSafe}', '${tipoSafe}')"
                            title="Eliminar código de internamiento"
                            style="margin-left: 5px;">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `;
};

// ================================================================
// ASIGNAR/EDITAR CÓDIGO
// ================================================================

InternamientoModule.prototype.asignarCodigoNuevo = function() {
    this.showAlert('Selecciona un usuario de la lista y haz clic en "Asignar" o "Cambiar"', 'Asignar Código', 'info');
};

InternamientoModule.prototype.editarCodigoUsuario = async function(personId, personName, tipo) {
    const esDoctor = tipo === 'doctor';
    const codigo = await this.showPrompt(
        `Ingresa el código de internamiento para ${personName}${esDoctor ? ' (doctor)' : ''}:`,
        'Asignar/Cambiar Código',
        '',
        true
    );

    if (!codigo || codigo.trim() === '') {
        return;
    }

    if (!/^\d{4,6}$/.test(codigo.trim())) {
        this.showAlert('El código debe tener entre 4 y 6 dígitos numéricos', 'Formato Inválido', 'warning');
        return;
    }

    try {
        const refPath = esDoctor
            ? `doctors_codigos/${personId}/codigo`
            : `assistants_codigos/${personId}/codigo`;
        await window.database.ref(refPath).set(codigo.trim());
        this.showNotification(`Código asignado exitosamente a ${personName}`, 'success');
        this.cargarListaUsuariosConCodigos();
    } catch (error) {
        console.error('Error asignando código:', error);
        this.showAlert('Error al asignar código: ' + error.message, 'Error', 'error');
    }
};

InternamientoModule.prototype.eliminarCodigoUsuario = async function(personId, personName, tipo) {
    const esDoctor = tipo === 'doctor';
    const confirmar = await this.showConfirm(
        esDoctor
            ? `¿Eliminar el código de internamiento de ${personName}?\n\nSi tiene PIN de recetas en su perfil, seguirá pudiendo usar ese PIN.`
            : `¿Eliminar el código de ${personName}?\n\nEsto revocará su acceso a funciones que requieren código.`,
        'Eliminar Código',
        { danger: true, confirmText: 'Eliminar', cancelText: 'Cancelar', icon: 'fa-trash', iconColor: '#e74c3c' }
    );

    if (!confirmar) return;

    try {
        const refPath = esDoctor
            ? `doctors_codigos/${personId}/codigo`
            : `assistants_codigos/${personId}/codigo`;
        await window.database.ref(refPath).remove();
        this.showNotification(`Código eliminado de ${personName}`, 'success');
        this.cargarListaUsuariosConCodigos();
    } catch (error) {
        console.error('Error eliminando código:', error);
        this.showAlert('Error al eliminar código: ' + error.message, 'Error', 'error');
    }
};

// ================================================================
// INTEGRACIÓN CON ADMINISTRACIÓN DE MEDICAMENTOS
// ================================================================

InternamientoModule.prototype.registrarAdministracionConCodigo = async function(medicamentoId, medicamento, codigoData) {
    const assistantId = codigoData.assistantId || null;
    const assistantName = codigoData.nombre || sessionStorage.getItem('userName');

    const adminId = 'adm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const administracionData = {
        fechaHoraProgramada: null,
        fechaHoraReal: Date.now(),
        estado: 'administrado',
        administradoPor: assistantId,
        administradoNombre: assistantName,
        // Código de personal médico registrado
        codigoAsistente: codigoData.codigo ? '****' + codigoData.codigo.slice(-2) : null,
        codigoVerificado: true,
        observaciones: ''
    };

    // Guardar en Firebase
    const updates = {};
    updates[`planTerapeutico/medicamentos/${medicamentoId}/administraciones/${adminId}`] = administracionData;
    updates['metadata/fechaUltimaActualizacion'] = Date.now();
    updates['estadisticas/totalMedicaciones'] = (this.internamientos.get(this.currentInternamientoId)?.estadisticas?.totalMedicaciones || 0) + 1;

    const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
    await internamientoRef.update(updates);

    // Auditoría con código
    const auditEntry = {
        timestamp: Date.now(),
        assistantId: assistantId,
        assistantName: assistantName,
        accion: 'administrar_medicacion_con_codigo',
        detalles: {
            medicamentoId: medicamentoId,
            nombre: medicamento.nombreComercial,
            dosis: medicamento.dosis,
            codigoVerificado: true
        }
    };
    await internamientoRef.child('auditoria/historialCambios').push(auditEntry);
};

InternamientoModule.prototype.administrarMedicamentoConCodigo = async function(medicamentoId) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    if (['alta', 'egresado'].includes(internamiento.estado?.actual)) {
        this.showAlert('No se puede administrar medicación\n\nEl paciente está en proceso de egreso o egresado.', 'Acción Bloqueada', 'warning');
        return;
    }

    const medicamento = internamiento.planTerapeutico?.medicamentos?.[medicamentoId];
    if (!medicamento) {
        this.showAlert('Medicamento no encontrado', 'Error', 'error');
        return;
    }
    if (!this.puedeAdministrarAhora(medicamento)) {
        let msg = 'Solo se puede administrar cuando corresponda la próxima dosis (contador en cero). Espere a que el tiempo indicado llegue a cero.';
        if (typeof this.estaMedicamentoFinalizadoProgramacion === 'function' && this.estaMedicamentoFinalizadoProgramacion(medicamento)) {
            msg = 'Este medicamento ya cumplió su fecha fin programada y no puede administrarse.';
        } else if (typeof this.estaMedicamentoPendienteInicioProgramacion === 'function' && this.estaMedicamentoPendienteInicioProgramacion(medicamento)) {
            msg = 'Este medicamento aún no ha iniciado según su programación.';
        }
        this.showAlert(msg, 'Administración no permitida', 'warning');
        return;
    }

    const resultadoCodigo = await this.verificarCodigoAsistente('medicacion');
    if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
        this.showNotification('Administración cancelada', 'info');
        return;
    }

    const confirmar = await this.showConfirm(
        `${medicamento.nombreComercial}\nDosis: ${this.formatDosisUnidad(medicamento)}\nVía: ${medicamento.viaAdministracion}`,
        'Confirmar Administración',
        { confirmText: 'Administrar', cancelText: 'Cancelar', icon: 'fa-syringe', iconColor: '#27ae60' }
    );
    if (!confirmar) return;

    try {
        await this.registrarAdministracionConCodigo(medicamentoId, medicamento, resultadoCodigo);
        this.showNotification('Medicación administrada por ' + resultadoCodigo.nombre, 'success');
        this.loadMedicacionView();
    } catch (error) {
        console.error('Error registrando administración:', error);
        this.showAlert('Error al registrar administración: ' + error.message, 'Error', 'error');
    }
};

InternamientoModule.prototype.administrarMedicamentosSeleccionados = async function() {
    const ids = Array.from(this._medicamentosSeleccionados || []);
    if (ids.length === 0) {
        this.showAlert('Seleccione al menos un medicamento con el checkbox.', 'Sin selección', 'warning');
        return;
    }

    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    if (['alta', 'egresado'].includes(internamiento.estado?.actual)) {
        this.showAlert('No se puede administrar medicación\n\nEl paciente está en proceso de egreso o egresado.', 'Acción Bloqueada', 'warning');
        return;
    }

    const medicamentos = [];
    for (const id of ids) {
        const med = internamiento.planTerapeutico?.medicamentos?.[id];
        if (!med) continue;
        if (!this.puedeAdministrarAhora(med)) continue;
        medicamentos.push({ id, med });
    }

    if (medicamentos.length === 0) {
        this.showAlert('Ninguno de los medicamentos seleccionados puede administrarse ahora (verifique el contador de dosis).', 'Sin medicamentos válidos', 'warning');
        return;
    }

    const resultadoCodigo = await this.verificarCodigoAsistente('medicacion_lote');
    if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
        this.showNotification('Administración cancelada', 'info');
        return;
    }

    const listaTexto = medicamentos.map(({ med }) =>
        `• ${med.nombreComercial || 'Sin nombre'} — ${this.formatDosisUnidad(med)} (${med.viaAdministracion || '—'})`
    ).join('\n');

    const confirmar = await this.showConfirm(
        `Se administrarán ${medicamentos.length} medicamento(s):\n\n${listaTexto}\n\nResponsable: ${resultadoCodigo.nombre}`,
        'Confirmar administración múltiple',
        { confirmText: 'Administrar todos', cancelText: 'Cancelar', icon: 'fa-syringe', iconColor: '#27ae60' }
    );
    if (!confirmar) return;

    try {
        let ok = 0;
        for (const { id, med } of medicamentos) {
            await this.registrarAdministracionConCodigo(id, med, resultadoCodigo);
            ok++;
        }
        this._medicamentosSeleccionados = new Set();
        this.showNotification(`${ok} medicamento(s) administrados por ${resultadoCodigo.nombre}`, 'success');
        this.loadMedicacionView();
    } catch (error) {
        console.error('Error en administración múltiple:', error);
        this.showAlert('Error al registrar administraciones: ' + error.message, 'Error', 'error');
        this.loadMedicacionView();
    }
};

// ================================================================
// CÓDIGOS TEMPORALES PARA ESTUDIANTES
// ================================================================

InternamientoModule.prototype.mostrarGestionEstudiantes = async function() {
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'admin') {
        this.showAlert('Solo administradores pueden gestionar estudiantes', 'Acceso Denegado', 'error');
        return;
    }
    const html = `
        <div style="min-width: 560px; max-width: 700px;">
            <div style="background: #e8f5e9; padding: 14px; border-radius: 8px; margin-bottom: 18px; border-left: 4px solid #4caf50;">
                <div style="font-weight: 600; color: #2e7d32; margin-bottom: 6px;"><i class="fas fa-user-graduate"></i> Códigos Temporales para Estudiantes</div>
                <div style="font-size: 0.88rem; color: #388e3c;">Los estudiantes reciben un código temporal con fecha de vencimiento. No tienen acceso a crear internamientos pero pueden registrar turnos y administrar medicamentos bajo supervisión.</div>
            </div>

            <div style="display:flex;gap:12px;margin-bottom:20px;">
                <button class="btn btn-primary" onclick="window.internamientoModule.abrirFormularioEstudiante()">
                    <i class="fas fa-plus"></i> Nuevo Estudiante
                </button>
                <button class="btn btn-secondary" onclick="window.internamientoModule.cargarListaEstudiantes()">
                    <i class="fas fa-sync"></i> Actualizar
                </button>
            </div>

            <div id="listaEstudiantes">
                <div style="text-align:center;padding:30px;color:#999;"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>
            </div>

            <div style="margin-top: 20px; text-align: right; border-top: 1px solid #eee; padding-top: 16px;">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i> Cerrar</button>
            </div>
        </div>
    `;
    const modal = this.createModal('Gestión de Estudiantes', html, 'fa-user-graduate');
    document.body.appendChild(modal);
    await this.cargarListaEstudiantes();
};

InternamientoModule.prototype.cargarListaEstudiantes = async function() {
    const container = document.getElementById('listaEstudiantes');
    if (!container) return;
    try {
        const snap = await window.database.ref('students').once('value');
        const students = snap.val() || {};
        const lista = Object.entries(students);
        if (lista.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:30px;color:#999;"><i class="fas fa-user-graduate" style="font-size:2rem;margin-bottom:10px;"></i><p>No hay estudiantes registrados</p></div>';
            return;
        }
        const ahora = Date.now();
        const filas = lista.map(([id, data]) => {
            const nombre = (data.nombre || data.name || 'Sin nombre').replace(/</g, '&lt;');
            const codigo = data.codigo || '—';
            const vence = data.vencimiento ? new Date(data.vencimiento) : null;
            const expirado = vence && vence.getTime() < ahora;
            const venceStr = vence ? vence.toLocaleString('es-PE', { dateStyle: 'short', hour12: true }) : '—';
            return `
            <tr style="background:${expirado ? '#fafafa' : 'white'};">
                <td style="padding:10px;border-bottom:1px solid #eee;">${nombre}</td>
                <td style="padding:10px;border-bottom:1px solid #eee;font-family:monospace;letter-spacing:2px;">${codigo}</td>
                <td style="padding:10px;border-bottom:1px solid #eee;">
                    <span style="color:${expirado ? '#c62828' : '#2e7d32'};font-weight:600;">${venceStr}</span>
                    ${expirado ? '<span style="margin-left:6px;background:#ffebee;color:#c62828;font-size:0.75rem;padding:2px 6px;border-radius:8px;">Expirado</span>' : ''}
                </td>
                <td style="padding:10px;border-bottom:1px solid #eee;">
                    <button class="btn btn-sm btn-warning" onclick="window.internamientoModule.renovarCodigoEstudiante('${id}')" style="margin-right:4px;"><i class="fas fa-sync"></i> Renovar</button>
                    <button class="btn btn-sm" style="background:#c62828;color:white;" onclick="window.internamientoModule.eliminarEstudiante('${id}','${nombre.replace(/'/g,'\\\'')}')" ><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
        container.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                <thead><tr style="background:#f5f5f5;">
                    <th style="padding:10px;text-align:left;">Nombre</th>
                    <th style="padding:10px;text-align:left;">Código</th>
                    <th style="padding:10px;text-align:left;">Vence</th>
                    <th style="padding:10px;text-align:left;">Acciones</th>
                </tr></thead>
                <tbody>${filas}</tbody>
            </table>`;
    } catch(e) {
        container.innerHTML = `<div style="color:#c62828;">Error cargando estudiantes: ${e.message}</div>`;
    }
};

InternamientoModule.prototype.abrirFormularioEstudiante = function(idEditar = null) {
    const html = `
        <form id="formEstudiante" style="min-width:360px;">
            <div class="form-group">
                <label>Nombre del estudiante *</label>
                <input type="text" id="estNombre" required placeholder="Ej: Juan Pérez" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
            </div>
            <div class="form-group">
                <label>Código temporal * <small style="color:#666;">(mínimo 4 caracteres)</small></label>
                <div style="display:flex;gap:8px;align-items:center;">
                    <input type="text" id="estCodigo" required placeholder="Ej: EST2024" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:6px;font-family:monospace;letter-spacing:2px;">
                    <button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('estCodigo').value=Math.random().toString(36).toUpperCase().substr(2,6)">
                        <i class="fas fa-random"></i> Auto
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label>Vencimiento *</label>
                <input type="date" id="estVencimiento" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
            </div>
            <div class="form-group">
                <label>Observaciones</label>
                <input type="text" id="estObservaciones" placeholder="Ej: Rotación cardiología - 1er semestre" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
            </div>
            <div style="text-align:right;margin-top:18px;">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button type="submit" class="btn btn-success" style="margin-left:8px;"><i class="fas fa-save"></i> Guardar</button>
            </div>
        </form>`;
    const modal = this.createModal('Nuevo Estudiante', html, 'fa-user-graduate');
    document.body.appendChild(modal);
    // Default vencimiento = 30 días desde hoy
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + 30);
    const el = document.getElementById('estVencimiento');
    if (el) el.value = hoy.toISOString().split('T')[0];

    document.getElementById('formEstudiante').onsubmit = async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('estNombre').value.trim();
        const codigo = document.getElementById('estCodigo').value.trim().toUpperCase();
        const vencimientoStr = document.getElementById('estVencimiento').value;
        const obs = document.getElementById('estObservaciones').value.trim();
        if (!nombre || !codigo || !vencimientoStr) return;
        if (codigo.length < 4) { this.showAlert('El código debe tener al menos 4 caracteres', 'Código muy corto', 'warning'); return; }
        const vencimiento = new Date(vencimientoStr + 'T23:59:59').getTime();
        const studentId = 'student_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        try {
            await window.database.ref(`students/${studentId}`).set({
                studentId, nombre, codigo, vencimiento,
                observaciones: obs,
                creadoEn: Date.now(),
                creadoPor: sessionStorage.getItem('userId') || 'admin',
                tipo: 'estudiante'
            });
            this.showNotification(`Estudiante "${nombre}" registrado con código ${codigo}`, 'success');
            document.querySelector('.modal-overlay')?.remove();
            await this.cargarListaEstudiantes();
        } catch(err) {
            this.showAlert('Error guardando estudiante: ' + err.message, 'Error', 'error');
        }
    };
};

InternamientoModule.prototype.renovarCodigoEstudiante = async function(studentId) {
    const snap = await window.database.ref(`students/${studentId}`).once('value');
    const data = snap.val();
    if (!data) return;
    const html = `
        <div style="min-width:320px;">
            <p>Renovar código para: <strong>${(data.nombre || '').replace(/</g,'&lt;')}</strong></p>
            <div class="form-group">
                <label>Nuevo código</label>
                <div style="display:flex;gap:8px;">
                    <input type="text" id="nuevoCodigoEst" value="${data.codigo || ''}" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:6px;font-family:monospace;letter-spacing:2px;">
                    <button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('nuevoCodigoEst').value=Math.random().toString(36).toUpperCase().substr(2,6)"><i class="fas fa-random"></i></button>
                </div>
            </div>
            <div class="form-group">
                <label>Nueva fecha de vencimiento</label>
                <input type="date" id="nuevoVencEst" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
            </div>
            <div style="text-align:right;margin-top:16px;">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button class="btn btn-success" style="margin-left:8px;" onclick="window.internamientoModule._guardarRenovacionEstudiante('${studentId}')"><i class="fas fa-save"></i> Renovar</button>
            </div>
        </div>`;
    const modal = this.createModal('Renovar Código', html, 'fa-sync');
    document.body.appendChild(modal);
    const hoy = new Date(); hoy.setDate(hoy.getDate() + 30);
    const el = document.getElementById('nuevoVencEst');
    if (el) el.value = (data.vencimiento ? new Date(data.vencimiento) : hoy).toISOString().split('T')[0];
};

InternamientoModule.prototype._guardarRenovacionEstudiante = async function(studentId) {
    const nuevo = document.getElementById('nuevoCodigoEst')?.value.trim().toUpperCase();
    const vencStr = document.getElementById('nuevoVencEst')?.value;
    if (!nuevo || !vencStr) return;
    const vencimiento = new Date(vencStr + 'T23:59:59').getTime();
    await window.database.ref(`students/${studentId}`).update({ codigo: nuevo, vencimiento, renovadoEn: Date.now() });
    this.showNotification('Código renovado exitosamente', 'success');
    document.querySelector('.modal-overlay')?.remove();
    await this.cargarListaEstudiantes();
};

InternamientoModule.prototype.eliminarEstudiante = async function(studentId, nombre) {
    const ok = await this.showConfirm(`¿Eliminar al estudiante "${nombre}"? Su código quedará inactivo.`, 'Eliminar Estudiante', { confirmText: 'Eliminar', cancelText: 'Cancelar', icon: 'fa-trash', iconColor: '#c62828' });
    if (!ok) return;
    await window.database.ref(`students/${studentId}`).remove();
    this.showNotification('Estudiante eliminado', 'success');
    await this.cargarListaEstudiantes();
};

console.log('Sistema de Códigos de Personal Médico cargado');
