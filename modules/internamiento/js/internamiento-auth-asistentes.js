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

InternamientoModule.prototype.verificarCodigoAsistente = async function(accion = 'acceso') {
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
                            this.showNotification(`Bienvenido(a), ${resultado.nombre}`, 'success');
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
        'registrar_llamada': 'registrar esta llamada',
        'agregar_dia_rer': 'agregar este día de RER',
        'agregar_dia_alimentacion_asistida': 'agregar este día de Alimentación asistida',
        'agregar_toma_rer': 'registrar esta toma de RER',
        'agregar_toma_alimentacion_asistida': 'registrar esta toma de Alimentación asistida',
        'agregar_hidratacion': 'registrar esta hidratación',
        'guardar_glucosa': 'guardar esta medición de glucosa',
        'imagenologia': 'registrar este estudio de imagenología',
        'edicion_ingreso_consulta_externa': 'guardar los cambios de ingreso (consulta externa)'
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

            <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
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

    setTimeout(() => {
        this.cargarListaUsuariosConCodigos();
    }, 100);
};

InternamientoModule.prototype.getGestionCodigosHTML = function() {
    return `
        <div style="padding: 15px; max-height: 75vh; overflow-y: auto;">
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

InternamientoModule.prototype.administrarMedicamentoConCodigo = async function(medicamentoId) {
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

    // SOLICITAR CÓDIGO DE ASISTENTE
    const resultadoCodigo = await this.verificarCodigoAsistente('medicacion');
    
    if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
        this.showNotification('Administración cancelada', 'info');
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
        await this.registrarAdministracionConCodigo(medicamentoId, medicamento, resultadoCodigo);
        this.showNotification('Medicación administrada por ' + resultadoCodigo.nombre, 'success');
        this.loadMedicacionView();
    } catch (error) {
        console.error('Error registrando administración:', error);
        this.showAlert('Error al registrar administración: ' + error.message, 'Error', 'error');
    }
};

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

console.log('Sistema de Códigos de Personal Médico cargado');
