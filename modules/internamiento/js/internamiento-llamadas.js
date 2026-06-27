// ====================================================================
// MÓDULO DE BITÁCORA DE REPORTES AL CLIENTE (LLAMADA / MENSAJE)
// ====================================================================

InternamientoModule.prototype.getTipoComunicacionReporte = function(registro) {
    const tipo = registro?.tipoComunicacion || registro?.comunicacion?.tipo;
    return tipo === 'mensaje' ? 'mensaje' : 'llamada';
};

InternamientoModule.prototype._configLabelsTipoComunicacion = function(tipo) {
    if (tipo === 'mensaje') {
        return {
            tituloFecha: 'Fecha y hora del mensaje',
            quienRealizo: 'Quién envió el mensaje',
            quienAtendio: 'Quién recibió / respondió',
            tituloMotivo: 'Motivo del mensaje',
            tituloResumen: 'Resumen del mensaje',
            resumenPlaceholder: 'Describe el contenido del mensaje enviado (WhatsApp, SMS, etc.)...',
            programarSiguiente: '¿Programar siguiente contacto?',
            btnGuardar: 'Guardar mensaje',
            modalTitulo: 'Registrar mensaje al cliente',
            modalIcon: 'fa-comment-dots',
            notifOk: 'Mensaje registrado exitosamente',
            notifCancel: 'Registro de mensaje cancelado',
            cardBorder: '#25d366',
            tipoLabel: 'Mensaje',
            tipoIcon: 'fa-comment-dots',
            quienRealizoCard: 'Envió',
            quienAtendioCard: 'Recibió / respondió'
        };
    }
    return {
        tituloFecha: 'Fecha y hora de la llamada',
        quienRealizo: 'Quién realizó la llamada',
        quienAtendio: 'Persona que atendió',
        tituloMotivo: 'Motivo de la llamada',
        tituloResumen: 'Resumen de la conversación',
        resumenPlaceholder: 'Describe brevemente de qué se habló en la llamada...',
        programarSiguiente: '¿Programar siguiente llamada?',
        btnGuardar: 'Guardar llamada',
        modalTitulo: 'Registrar llamada al cliente',
        modalIcon: 'fa-phone',
        notifOk: 'Llamada registrada exitosamente',
        notifCancel: 'Registro de llamada cancelado',
        cardBorder: '#667eea',
        tipoLabel: 'Llamada',
        tipoIcon: 'fa-phone-alt',
        quienRealizoCard: 'Llamó',
        quienAtendioCard: 'Atendió'
    };
};

InternamientoModule.prototype._aplicarLabelsTipoComunicacionForm = function(tipo) {
    const cfg = this._configLabelsTipoComunicacion(tipo);
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    setText('llamadaSeccionFechaTitulo', cfg.tituloFecha);
    setText('llamadaLabelQuienRealizo', cfg.quienRealizo);
    setText('llamadaLabelQuienAtendio', cfg.quienAtendio);
    setText('llamadaSeccionMotivoTitulo', cfg.tituloMotivo);
    setText('llamadaSeccionResumenTitulo', cfg.tituloResumen);
    setText('llamadaLabelProgramarSiguiente', cfg.programarSiguiente);
    const resumen = document.getElementById('llamadaResumen');
    if (resumen) resumen.placeholder = cfg.resumenPlaceholder;
    const btn = document.getElementById('llamadaBtnGuardar');
    if (btn) btn.innerHTML = `<i class="fas fa-save"></i> ${cfg.btnGuardar}`;
    document.querySelectorAll('.reporte-tipo-opcion').forEach((btn) => {
        btn.classList.toggle('reporte-tipo-opcion--activo', btn.dataset.tipo === tipo);
    });
    const seccionReaccion = document.getElementById('llamadaSeccionReaccion');
    const selectReaccion = document.getElementById('llamadaReaccion');
    if (seccionReaccion) {
        seccionReaccion.style.display = tipo === 'mensaje' ? 'none' : '';
    }
    if (selectReaccion && tipo === 'mensaje') {
        selectReaccion.value = '';
    }
};

InternamientoModule.prototype._getTipoComunicacionForm = function() {
    const sel = document.querySelector('input[name="llamadaTipoComunicacion"]:checked');
    return sel?.value === 'mensaje' ? 'mensaje' : 'llamada';
};

// ================================================================
// MOSTRAR FORMULARIO DE REPORTE
// ================================================================

InternamientoModule.prototype.showRegistroLlamadaForm = async function(tipoPreseleccionado) {
    if (!this.currentInternamientoId) {
        this.showAlert('No hay internamiento seleccionado', 'Error', 'error');
        return;
    }

    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    const resultadoCodigo = await this.verificarCodigoAsistente('registrar_llamada');
    if (!resultadoCodigo || !resultadoCodigo.valido || resultadoCodigo.cancelado) {
        const cfg = this._configLabelsTipoComunicacion(tipoPreseleccionado === 'mensaje' ? 'mensaje' : 'llamada');
        this.showNotification(cfg.notifCancel, 'info');
        return;
    }
    this._llamadaQuienLlamoVerificado = resultadoCodigo.nombre || '';
    this._llamadaTipoPreseleccionado = tipoPreseleccionado === 'mensaje' ? 'mensaje' : 'llamada';

    const modalContent = this.getLlamadaFormHTML(internamiento, null, this._llamadaTipoPreseleccionado);
    const cfgModal = this._configLabelsTipoComunicacion(this._llamadaTipoPreseleccionado);
    const modal = this.createModal(cfgModal.modalTitulo, modalContent, cfgModal.modalIcon);
    document.body.appendChild(modal);

    setTimeout(() => {
        this.setupLlamadaForm(internamiento);
    }, 100);
};

// ================================================================
// HTML DEL FORMULARIO
// ================================================================

InternamientoModule.prototype.getLlamadaFormHTML = function(internamiento, llamadaExistente = null, tipoPreseleccionado = 'llamada') {
    const clienteNombre = this.getNombrePropietario(internamiento);
    const clienteTelefono = this.getTelefonoCliente(internamiento);
    const tipoInicial = llamadaExistente
        ? this.getTipoComunicacionReporte(llamadaExistente)
        : (tipoPreseleccionado === 'mensaje' ? 'mensaje' : 'llamada');

    const now = new Date();
    const fechaActual = llamadaExistente?.fechaFormato || now.toISOString().split('T')[0];
    const horaActual = llamadaExistente?.horaFormato || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return `
        <div style="max-height: 80vh; overflow-y: auto; padding: 15px;">
            <!-- Info del cliente -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <i class="fas fa-user-circle" style="font-size: 3rem;"></i>
                    <div>
                        <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 5px;">${clienteNombre}</div>
                        <div style="font-size: 0.95rem; opacity: 0.9;">
                            <i class="fas fa-phone"></i> ${clienteTelefono || 'Teléfono no registrado'}
                        </div>
                    </div>
                </div>
                <div style="font-size: 0.9rem; opacity: 0.9; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 12px;">
                    <i class="fas fa-paw"></i> Paciente: <strong>${internamiento.referencias?.nombreMascota || 'N/A'}</strong>
                </div>
            </div>

            <form id="formLlamada">
                <!-- Tipo de reporte -->
                <div class="form-section" style="margin-bottom: 20px;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 12px;">
                        <i class="fas fa-exchange-alt"></i> Tipo de reporte
                    </h4>
                    <div class="reporte-tipo-toggle">
                        <label class="reporte-tipo-opcion ${tipoInicial === 'llamada' ? 'reporte-tipo-opcion--activo' : ''}" data-tipo="llamada">
                            <input type="radio" name="llamadaTipoComunicacion" value="llamada" ${tipoInicial === 'llamada' ? 'checked' : ''} style="display:none;">
                            <i class="fas fa-phone-alt"></i> Llamada
                        </label>
                        <label class="reporte-tipo-opcion ${tipoInicial === 'mensaje' ? 'reporte-tipo-opcion--activo' : ''}" data-tipo="mensaje">
                            <input type="radio" name="llamadaTipoComunicacion" value="mensaje" ${tipoInicial === 'mensaje' ? 'checked' : ''} style="display:none;">
                            <i class="fas fa-comment-dots"></i> Mensaje
                        </label>
                    </div>
                </div>

                <!-- Fecha y Hora -->
                <div class="form-section" style="margin-bottom: 20px;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-clock"></i> <span id="llamadaSeccionFechaTitulo">Fecha y hora de la llamada</span>
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label>Fecha *</label>
                            <input type="date" id="llamadaFecha" value="${fechaActual}" required 
                                   style="width: 100%; padding: 10px; border-radius: 6px;">
                        </div>
                        <div class="form-group">
                            <label>Hora *</label>
                            <input type="time" id="llamadaHora" value="${horaActual}" required 
                                   style="width: 100%; padding: 10px; border-radius: 6px;">
                        </div>
                    </div>
                </div>

                <!-- Quién realizó la llamada -->
                <div class="form-section" style="margin-bottom: 20px;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-user-md"></i> Datos de la Comunicación
                    </h4>
                    <div class="form-group">
                        <label id="llamadaLabelQuienRealizo">Quién realizó la llamada *</label>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="text" id="llamadaQuienLlamo" required readonly placeholder="Se mostrará al verificar el código" 
                                   style="width: 100%; padding: 10px; border-radius: 6px; background: #e9ecef; cursor: default;">
                        </div>
                        <small style="color: #6c757d; display: block; margin-top: 5px;">
                            <i class="fas fa-lock"></i> El nombre se asigna al ingresar tu código de personal médico
                        </small>
                    </div>
                    <div class="form-group" style="margin-top: 15px;">
                        <label id="llamadaLabelQuienAtendio">Persona que atendió *</label>
                        <input type="text" id="llamadaQuienAtendio" required placeholder="Nombre del propietario o familiar" 
                               style="width: 100%; padding: 10px; border-radius: 6px;">
                        <small style="color: #6c757d; display: block; margin-top: 5px;">
                            Ejemplo: Juan Pérez (propietario), María Gómez (esposa), etc.
                        </small>
                    </div>
                </div>

                <!-- Motivo -->
                <div class="form-section" style="margin-bottom: 20px;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-bullseye"></i> <span id="llamadaSeccionMotivoTitulo">Motivo de la llamada</span>
                    </h4>
                    <div class="form-group">
                        <select id="llamadaMotivo" required style="width: 100%; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                            <option value="">Seleccionar motivo...</option>
                            <option value="actualizacion">Actualización de estado del paciente</option>
                            <option value="emergencia">Comunicar emergencia o complicación</option>
                            <option value="consulta_cliente">Consulta del cliente</option>
                            <option value="autorizacion">Solicitud de autorización</option>
                            <option value="alta">Comunicar alta médica</option>
                            <option value="seguimiento">Seguimiento rutinario</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>
                </div>

                <!-- Resumen -->
                <div class="form-section" style="margin-bottom: 20px;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-comments"></i> <span id="llamadaSeccionResumenTitulo">Resumen de la conversación</span>
                    </h4>
                    <div class="form-group">
                        <textarea id="llamadaResumen" rows="5" required 
                                  placeholder="Describe brevemente de qué se habló en la llamada..."
                                  style="width: 100%; padding: 12px; border-radius: 6px; border: 1px solid #ddd; font-size: 0.95rem; line-height: 1.6;"></textarea>
                        <small style="color: #6c757d; display: block; margin-top: 5px;">
                            <i class="fas fa-lightbulb"></i> Incluye: Estado del paciente comunicado, dudas del cliente, decisiones tomadas, etc.
                        </small>
                    </div>
                </div>

                <!-- Reacción del cliente (solo llamadas) -->
                <div class="form-section" id="llamadaSeccionReaccion" style="margin-bottom: 20px;${tipoInicial === 'mensaje' ? ' display:none;' : ''}">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-smile"></i> Reacción del Cliente
                    </h4>
                    <div class="form-group">
                        <select id="llamadaReaccion" style="width: 100%; padding: 10px; border-radius: 6px;">
                            <option value="">Seleccionar...</option>
                            <option value="satisfecho">Satisfecho</option>
                            <option value="preocupado">Preocupado</option>
                            <option value="tranquilo">Tranquilo</option>
                            <option value="ansioso">Ansioso</option>
                            <option value="molesto">Molesto</option>
                            <option value="agradecido">Agradecido</option>
                        </select>
                    </div>
                </div>

                <!-- Próxima llamada programada -->
                <div class="form-section" style="margin-bottom: 20px;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-calendar-check"></i> Programar Próxima Llamada
                    </h4>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
                            <input type="checkbox" id="llamadaProgramarSiguiente" style="width: 18px; height: 18px;">
                            <span id="llamadaLabelProgramarSiguiente" style="font-weight: 600;">¿Programar siguiente llamada?</span>
                        </label>
                        <div id="siguienteLlamadaInputs" style="display: none;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px;">
                                <div class="form-group">
                                    <label>Fecha programada</label>
                                    <input type="date" id="llamadaSiguienteFecha" 
                                           style="width: 100%; padding: 10px; border-radius: 6px;">
                                </div>
                                <div class="form-group">
                                    <label>Hora aproximada</label>
                                    <input type="time" id="llamadaSiguienteHora" 
                                           style="width: 100%; padding: 10px; border-radius: 6px;">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Motivo de la siguiente llamada</label>
                                <input type="text" id="llamadaSiguienteMotivo" placeholder="Ej: Actualizar sobre resultados de exámenes"
                                       style="width: 100%; padding: 10px; border-radius: 6px;">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Botones -->
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px; padding-top: 20px; border-top: 2px solid #e0e0e0;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary" id="llamadaBtnGuardar">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                </div>
            </form>
        </div>
    `;
};

// ================================================================
// SETUP DEL FORMULARIO
// ================================================================

InternamientoModule.prototype.setupLlamadaForm = function(internamiento, llamadaExistente) {
    const quienLlamoInput = document.getElementById('llamadaQuienLlamo');
    if (quienLlamoInput) {
        if (!quienLlamoInput.value.trim()) {
            quienLlamoInput.value = this._llamadaQuienLlamoVerificado || '';
        }
        quienLlamoInput.readOnly = true;
    }

    const quienAtendioInput = document.getElementById('llamadaQuienAtendio');
    if (quienAtendioInput && !llamadaExistente) {
        const propietario = this.getNombrePropietario(internamiento);
        if (propietario !== 'No especificado') {
            quienAtendioInput.value = `${propietario} (propietario)`;
        }
    }

    const tipoInicial = llamadaExistente
        ? this.getTipoComunicacionReporte(llamadaExistente)
        : (this._llamadaTipoPreseleccionado || 'llamada');
    this._aplicarLabelsTipoComunicacionForm(tipoInicial);

    document.querySelectorAll('input[name="llamadaTipoComunicacion"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            this._aplicarLabelsTipoComunicacionForm(this._getTipoComunicacionForm());
        });
    });

    const checkboxProgramar = document.getElementById('llamadaProgramarSiguiente');
    const inputsSiguiente = document.getElementById('siguienteLlamadaInputs');
    
    if (checkboxProgramar && inputsSiguiente) {
        checkboxProgramar.addEventListener('change', function() {
            inputsSiguiente.style.display = this.checked ? 'block' : 'none';
        });
    }

    const form = document.getElementById('formLlamada');
    if (form) {
        form.onsubmit = (e) => this.handleLlamadaSubmit(e);
    }
};

// ================================================================
// GUARDAR LLAMADA
// ================================================================

InternamientoModule.prototype.handleLlamadaSubmit = async function(e) {
    e.preventDefault();

    const quienLlamo = document.getElementById('llamadaQuienLlamo')?.value.trim() || '';
    if (!quienLlamo) {
        this.showAlert('Debe verificar su código de personal médico antes de registrar el reporte. Cierre el formulario y pulse de nuevo el botón de agregar.', 'Verificación requerida', 'warning');
        return;
    }

    const tipoComunicacion = this._getTipoComunicacionForm();
    const cfg = this._configLabelsTipoComunicacion(tipoComunicacion);

    const llamadaData = {
        tipoComunicacion,
        fecha: document.getElementById('llamadaFecha')?.value,
        hora: document.getElementById('llamadaHora')?.value,
        quienLlamo: quienLlamo,
        quienAtendio: document.getElementById('llamadaQuienAtendio')?.value.trim() || '',
        motivo: document.getElementById('llamadaMotivo')?.value,
        resumen: document.getElementById('llamadaResumen')?.value.trim() || '',
        reaccion: tipoComunicacion === 'mensaje' ? '' : (document.getElementById('llamadaReaccion')?.value || ''),
        programarSiguiente: document.getElementById('llamadaProgramarSiguiente')?.checked || false,
        siguienteFecha: document.getElementById('llamadaSiguienteFecha')?.value || '',
        siguienteHora: document.getElementById('llamadaSiguienteHora')?.value || '',
        siguienteMotivo: document.getElementById('llamadaSiguienteMotivo')?.value.trim() || ''
    };

    try {
        await this.guardarLlamada(llamadaData);
        this.showNotification(cfg.notifOk, 'success');
        document.querySelector('.modal-overlay')?.remove();
        this.showInternamientoView('llamadas');
        if (typeof this.loadLlamadasView === 'function') this.loadLlamadasView();

        // Recargar vista de evolución si está abierta
        const evolucionView = document.getElementById('internamiento-evolucion');
        if (evolucionView && !evolucionView.classList.contains('hidden')) {
            this.loadEvolucionView();
        }
    } catch (error) {
        console.error('Error guardando llamada:', error);
        this.showAlert('Error al guardar llamada: ' + error.message, 'Error', 'error');
    }
};

InternamientoModule.prototype.guardarLlamada = async function(data) {
    const userId = sessionStorage.getItem('userId');
    const userName = sessionStorage.getItem('userName');

    const llamadaId = 'llamada_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Combinar fecha y hora en timestamp
    const fechaHoraLlamada = data.fecha && data.hora 
        ? new Date(`${data.fecha}T${data.hora}`).getTime() 
        : Date.now();

    const llamadaData = {
        llamadaId: llamadaId,
        tipoComunicacion: data.tipoComunicacion === 'mensaje' ? 'mensaje' : 'llamada',
        fechaHora: fechaHoraLlamada,
        fechaFormato: data.fecha,
        horaFormato: data.hora,
        comunicacion: {
            tipo: data.tipoComunicacion === 'mensaje' ? 'mensaje' : 'llamada',
            quienLlamo: data.quienLlamo,
            quienAtendio: data.quienAtendio,
            motivo: data.motivo,
            reaccionCliente: data.tipoComunicacion === 'mensaje' ? '' : data.reaccion
        },
        resumen: data.resumen,
        siguienteLlamada: data.programarSiguiente ? {
            programada: true,
            fecha: data.siguienteFecha,
            hora: data.siguienteHora,
            motivo: data.siguienteMotivo,
            fechaHora: data.siguienteFecha && data.siguienteHora 
                ? new Date(`${data.siguienteFecha}T${data.siguienteHora}`).getTime() 
                : null
        } : {
            programada: false
        },
        registradoPor: userId,
        registradoNombre: data.quienLlamo || userName,
        fechaRegistro: Date.now()
    };

    // Guardar en Firebase
    const updates = {};
    updates[`llamadasCliente/${llamadaId}`] = llamadaData;
    updates['metadata/fechaUltimaActualizacion'] = Date.now();

    const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
    await internamientoRef.update(updates);

    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (internamiento) {
        const llamadasPrev = internamiento.llamadasCliente && typeof internamiento.llamadasCliente === 'object' && !Array.isArray(internamiento.llamadasCliente)
            ? internamiento.llamadasCliente
            : {};
        const llamadas = { ...llamadasPrev, [llamadaId]: llamadaData };
        this.internamientos.set(this.currentInternamientoId, { ...internamiento, llamadasCliente: llamadas });
    }

    // Auditoría
    await internamientoRef.child('auditoria/historialCambios').push({
        timestamp: Date.now(),
        userId: userId,
        usuarioNombre: userName,
        accion: 'registrar_llamada',
        detalles: {
            llamadaId: llamadaId,
            tipoComunicacion: data.tipoComunicacion === 'mensaje' ? 'mensaje' : 'llamada',
            motivo: data.motivo,
            quienAtendio: data.quienAtendio
        }
    });
    this._refreshTarjetasInternamientoLista();
};

InternamientoModule.prototype._fechaYmdLocal = function(date) {
    const d = date instanceof Date ? date : new Date(date || Date.now());
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

InternamientoModule.prototype._fechaYmdFromLlamada = function(llamada) {
    if (llamada?.fechaFormato) return llamada.fechaFormato;
    if (llamada?.fechaHora) return this._fechaYmdLocal(new Date(llamada.fechaHora));
    return '';
};

InternamientoModule.prototype.tieneReporteLlamadaHoy = function(internamiento) {
    if (!internamiento) return false;
    const hoy = this._fechaYmdLocal(new Date());
    const raw = internamiento.llamadasCliente;
    const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return Object.values(obj).some((ll) => this._fechaYmdFromLlamada(ll) === hoy);
};

InternamientoModule.prototype._refreshTarjetasInternamientoLista = function() {
    if (typeof this.refreshInternamientosList === 'function') {
        this.refreshInternamientosList();
    }
};

// ================================================================
// UTILIDADES
// ================================================================

InternamientoModule.prototype.getTelefonoCliente = function(internamiento) {
    const cedula = internamiento.referencias?.cedulaCliente;
    if (!cedula) return '';

    if (window.patientDatabase) {
        const patient = window.patientDatabase.findPatientByCedula(cedula);
        if (patient && patient.telefono) {
            return patient.telefono;
        }
    }

    return '';
};

// ================================================================
// RENDERIZAR LLAMADAS EN EVOLUCIÓN
// ================================================================

InternamientoModule.prototype.renderLlamadasEnEvolucion = function(internamiento) {
    const llamadas = Object.values(internamiento.llamadasCliente || {})
        .sort((a, b) => b.fechaHora - a.fechaHora);

    if (llamadas.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <p>No hay reportes registrados</p>
            </div>
        `;
    }

    return `
        <div style="background: white; padding: 20px; border-radius: 12px;">
            ${llamadas.map(llamada => this.renderLlamadaCard(llamada)).join('')}
        </div>
    `;
};

InternamientoModule.prototype.renderLlamadaCard = function(llamada) {
    const tipo = this.getTipoComunicacionReporte(llamada);
    const cfg = this._configLabelsTipoComunicacion(tipo);
    const fecha = new Date(llamada.fechaHora).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const hora = new Date(llamada.fechaHora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const motivoLabels = {
        'actualizacion': '<i class="fas fa-chart-bar"></i> Actualización de estado',
        'emergencia': '<i class="fas fa-exclamation-triangle"></i> Emergencia',
        'consulta_cliente': '<i class="fas fa-question-circle"></i> Consulta del cliente',
        'autorizacion': '<i class="fas fa-check-circle"></i> Autorización',
        'alta': '<i class="fas fa-home"></i> Alta médica',
        'seguimiento': '<i class="fas fa-search"></i> Seguimiento',
        'otro': `<i class="fas ${cfg.tipoIcon}"></i> Otro`
    };

    const reaccionIcons = {
        'satisfecho': '<i class="fas fa-smile" style="color: #27ae60;"></i>',
        'preocupado': '<i class="fas fa-frown" style="color: #f39c12;"></i>',
        'tranquilo': '<i class="fas fa-meh" style="color: #3498db;"></i>',
        'ansioso': '<i class="fas fa-grimace" style="color: #e67e22;"></i>',
        'molesto': '<i class="fas fa-angry" style="color: #e74c3c;"></i>',
        'agradecido': '<i class="fas fa-praying-hands" style="color: #9b59b6;"></i>'
    };

    return `
        <div style="border-left: 4px solid ${cfg.cardBorder}; background: #f8f9fa; padding: 20px; margin-bottom: 20px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                <div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                        <span class="reporte-tipo-badge reporte-tipo-badge--${tipo}">
                            <i class="fas ${cfg.tipoIcon}"></i> ${cfg.tipoLabel}
                        </span>
                    </div>
                    <div style="font-size: 1.1rem; font-weight: 600; color: var(--internamiento-primary); margin-bottom: 5px;">
                        ${motivoLabels[llamada.comunicacion?.motivo] || `<i class="fas ${cfg.tipoIcon}"></i> ${cfg.tipoLabel}`}
                    </div>
                    <div style="font-size: 0.85rem; color: #6c757d;">
                        ${fecha} - ${hora}
                    </div>
                </div>
                ${tipo === 'llamada' && llamada.comunicacion?.reaccionCliente ? `
                    <div style="font-size: 1.5rem;">
                        ${reaccionIcons[llamada.comunicacion.reaccionCliente] || ''}
                    </div>
                ` : ''}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; font-size: 0.9rem;">
                <div>
                    <strong style="color: #6c757d;">${cfg.quienRealizoCard}:</strong>
                    <div>${llamada.comunicacion?.quienLlamo || 'N/A'}</div>
                </div>
                <div>
                    <strong style="color: #6c757d;">${cfg.quienAtendioCard}:</strong>
                    <div>${llamada.comunicacion?.quienAtendio || 'N/A'}</div>
                </div>
            </div>

            <div style="background: white; padding: 15px; border-radius: 6px; border-left: 3px solid var(--internamiento-info); margin-bottom: 15px;">
                <strong style="color: var(--internamiento-primary); display: block; margin-bottom: 8px;">
                    <i class="fas fa-comment"></i> Resumen:
                </strong>
                <div style="line-height: 1.6; color: #555; white-space: pre-wrap;">
                    ${llamada.resumen}
                </div>
            </div>

            ${llamada.siguienteLlamada?.programada ? `
                <div style="background: #fff3cd; padding: 12px; border-radius: 6px; border-left: 3px solid #f39c12;">
                    <strong style="color: #856404;"><i class="fas fa-calendar-check"></i> Próximo contacto programado:</strong>
                    <div style="margin-top: 5px; color: #856404;">
                        ${llamada.siguienteLlamada.fecha ? new Date(llamada.siguienteLlamada.fecha).toLocaleDateString('es-ES') : ''} 
                        ${llamada.siguienteLlamada.hora || ''}
                        ${llamada.siguienteLlamada.motivo ? ` - ${llamada.siguienteLlamada.motivo}` : ''}
                    </div>
                </div>
            ` : ''}

            <div style="margin-top: 12px; font-size: 0.8rem; color: #999;">
                Registrado por: ${llamada.registradoNombre || 'Usuario'}
            </div>
        </div>
    `;
};

console.log('Módulo de Bitácora de Llamadas cargado');
