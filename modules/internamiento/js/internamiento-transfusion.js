// ====================================================================
// MÓDULO DE TRANSFUSIÓN SANGUÍNEA - SISTEMA VETERINARIO
// ====================================================================
// Extensión del módulo de internamiento para manejar transfusiones

// ================================================================
// MOSTRAR FORMULARIO DE REGISTRO DE TRANSFUSIÓN (modal)
// ================================================================

InternamientoModule.prototype.showRegistroTransfusionForm = function() {
    if (!this.currentInternamientoId) {
        this.showAlert('No hay internamiento seleccionado', 'Error', 'error');
        return;
    }

    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    // Verificar si está en egreso
    if (internamiento.estado?.actual === 'egresado') {
        this.showAlert('No se pueden registrar transfusiones en un internamiento egresado', 'Acción Bloqueada', 'warning');
        return;
    }

    const modalContent = this.getTransfusionFormHTML(internamiento);
    const modal = this.createModal('Registro de Transfusión Sanguínea', modalContent, 'fa-tint');
    document.body.appendChild(modal);

    // Setup form submit y calculadora
    setTimeout(() => {
        this.setupTransfusionCalculator();
        const form = document.getElementById('formTransfusion');
        if (form) {
            form.onsubmit = (e) => this.handleTransfusionSubmit(e);
        }
    }, 100);
};

// ================================================================
// HTML DEL FORMULARIO
// ================================================================

InternamientoModule.prototype.getTransfusionFormHTML = function(internamiento) {
    const tipoMascota = internamiento.referencias?.tipoMascota || 'perro';
    const pesoActual = this.obtenerPesoMasReciente(internamiento);

    return `
        <div style="max-height: 80vh; overflow-y: auto; padding: 10px;">
            <!-- Imagen de referencia -->
            <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                <img src="/img/transfusion.jpg" alt="Fórmula de Transfusión" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p style="margin: 10px 0 0 0; color: #2c3e50; font-size: 0.9rem; font-style: italic;">
                    <i class="fas fa-info-circle"></i> Fórmula: Volumen (ml) = [Peso (kg) × N] × (Ht deseado - Ht receptor) / Ht donante
                </p>
            </div>

            <form id="formTransfusion">
                <!-- Datos Básicos -->
                <div class="form-section" style="margin-bottom: 20px;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-clipboard-list"></i> Datos del Receptor
                    </h4>
                    
                    <div class="form-group">
                        <label>Tipo de Mascota *</label>
                        <select id="transfusionTipoMascota" required style="width: 100%; padding: 10px; border-radius: 6px; color: #1e293b; background: #f8fafc;">
                            <option value="perro" ${tipoMascota === 'perro' ? 'selected' : ''}>Canino (N = 90)</option>
                            <option value="gato" ${tipoMascota === 'gato' ? 'selected' : ''}>Felino (N = 70)</option>
                        </select>
                        <small style="color: #6c757d; display: block; margin-top: 5px;">
                            N es el factor de conversión según la especie
                        </small>
                    </div>

                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label>Peso del Receptor (kg) *</label>
                            <input type="number" id="transfusionPesoReceptor" step="0.1" min="0.1" required 
                                   value="${pesoActual || ''}" placeholder="Ej: 12.5"
                                   style="width: 100%; padding: 10px; border-radius: 6px; color: #1e293b; background: #f8fafc;">
                        </div>
                        <div class="form-group">
                            <label>Tipo de Sangre Receptor</label>
                            <input type="text" id="transfusionTipoSangreReceptor" placeholder="Ej: DEA 1.1 +"
                                   style="width: 100%; padding: 10px; border-radius: 6px; color: #1e293b; background: #f8fafc;">
                        </div>
                    </div>
                </div>

                <!-- Tipo de Transfusión -->
                <div class="form-section" style="margin-bottom: 20px;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-info-circle"></i> Tipo de Transfusión
                    </h4>
                    <div class="form-group">
                        <label>Tipo de Transfusión *</label>
                        <select id="transfusionTipo" required style="width: 100%; padding: 10px; border-radius: 6px; color: #1e293b; background: #f8fafc; font-size: 1rem;">
                            <option value="">Seleccione el tipo...</option>
                            <option value="sangre">🩸 Sangre Completa</option>
                            <option value="plasma">💧 Plasma</option>
                        </select>
                        <small style="color: #6c757d; display: block; margin-top: 5px;">
                            Seleccione si se transfunde sangre completa o plasma
                        </small>
                    </div>
                </div>

                <!-- Albúmina (solo para Plasma) -->
                <div id="transfusionSeccionPlasma" class="form-section" style="margin-bottom: 20px; display: none;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-flask"></i> Laboratorio
                    </h4>
                    <div class="form-group">
                        <label>Última albúmina (último examen de laboratorio) *</label>
                        <input type="number" id="transfusionAlbumina" step="0.1" min="0" placeholder="Ej: 2.1 (g/dL)"
                               style="width: 100%; padding: 10px; border-radius: 6px; color: #1e293b; background: #f8fafc;">
                        <small style="color: #6c757d; display: block; margin-top: 5px;">
                            Registre el valor de albúmina del último perfil bioquímico del paciente
                        </small>
                    </div>
                </div>

                <!-- Datos de Hematocrito (solo para Sangre Completa) -->
                <div id="transfusionSeccionHematocrito" class="form-section" style="margin-bottom: 20px; display: none;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-vial"></i> Valores de Hematocrito (Ht)
                    </h4>

                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label>Ht Receptor Actual (%) *</label>
                            <input type="number" id="transfusionHtReceptor" step="0.1" min="0" max="100" 
                                   placeholder="Ej: 15"
                                   style="width: 100%; padding: 10px; border-radius: 6px; color: #1e293b; background: #f8fafc;">
                            <small style="color: #e74c3c; display: block; margin-top: 3px;">
                                Valor actual del paciente
                            </small>
                        </div>
                        <div class="form-group">
                            <label>Ht Deseado (%) *</label>
                            <input type="number" id="transfusionHtDeseado" step="0.1" min="0" max="100" 
                                   placeholder="Ej: 25"
                                   style="width: 100%; padding: 10px; border-radius: 6px; color: #1e293b; background: #f8fafc;">
                            <small style="color: #27ae60; display: block; margin-top: 3px;">
                                Meta post-transfusión
                            </small>
                        </div>
                        <div class="form-group">
                            <label>Ht Donante (%) *</label>
                            <input type="number" id="transfusionHtDonante" step="0.1" min="0" max="100" 
                                   placeholder="Ej: 45"
                                   style="width: 100%; padding: 10px; border-radius: 6px; color: #1e293b; background: #f8fafc;">
                            <small style="color: #3498db; display: block; margin-top: 3px;">
                                Valor del donante
                            </small>
                        </div>
                    </div>

                    <!-- Resultado del cálculo -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-top: 20px; text-align: center;">
                        <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">VOLUMEN NECESARIO</div>
                        <div id="volumenCalculado" style="font-size: 2.5rem; font-weight: bold; letter-spacing: 2px;">
                            -- ml
                        </div>
                        <button type="button" onclick="window.internamientoModule.calcularVolumenTransfusion()" 
                                class="btn btn-light" style="margin-top: 15px; background: white; color: #667eea;">
                            <i class="fas fa-calculator"></i> Calcular Volumen
                        </button>
                    </div>
                </div>

                <!-- Datos del Donante -->
                <div class="form-section" style="margin-bottom: 20px;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-dog"></i> Datos del Donante
                    </h4>

                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label>Nombre del Donante</label>
                            <input type="text" id="transfusionNombreDonante" placeholder="Nombre del perro/gato donante"
                                   style="width: 100%; padding: 10px; border-radius: 6px; color: #1e293b; background: #f8fafc;">
                        </div>
                        <div class="form-group">
                            <label>Tipo de Sangre Donante</label>
                            <input type="text" id="transfusionTipoSangreDonante" placeholder="Ej: DEA 1.1 -"
                                   style="width: 100%; padding: 10px; border-radius: 6px; color: #1e293b; background: #f8fafc;">
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="transfusionPruebaCruzada">
                            ¿Se realizó prueba cruzada?
                        </label>
                        <textarea id="transfusionResultadoPrueba" rows="2" placeholder="Resultado de la prueba cruzada (si aplica)" 
                                  style="margin-top: 8px; width: 100%; padding: 8px; border-radius: 6px; color: #1e293b; background: #f8fafc;"></textarea>
                    </div>
                </div>

                <!-- Observaciones -->
                <div class="form-section" style="margin-bottom: 20px;">
                    <h4 style="color: var(--internamiento-primary); margin-bottom: 15px;">
                        <i class="fas fa-notes-medical"></i> Observaciones
                    </h4>
                    <textarea id="transfusionObservaciones" rows="3" placeholder="Observaciones generales del procedimiento..."
                              style="width: 100%; padding: 10px; border-radius: 6px; color: #1e293b; background: #f8fafc;"></textarea>
                </div>

                <!-- Botones -->
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px; padding-top: 20px; border-top: 2px solid #e0e0e0;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="submit" class="btn btn-danger">
                        <i class="fas fa-save"></i> Registrar Transfusión
                    </button>
                </div>
            </form>
        </div>
    `;
};

// ================================================================
// CALCULADORA DE VOLUMEN
// ================================================================

InternamientoModule.prototype.setupTransfusionCalculator = function() {
    const seccionHt = document.getElementById('transfusionSeccionHematocrito');
    const seccionPlasma = document.getElementById('transfusionSeccionPlasma');
    const selectTipo = document.getElementById('transfusionTipo');
    const htReceptor = document.getElementById('transfusionHtReceptor');
    const htDeseado = document.getElementById('transfusionHtDeseado');
    const htDonante = document.getElementById('transfusionHtDonante');
    const albuminaInput = document.getElementById('transfusionAlbumina');

    function toggleSeccionHematocrito() {
        const esSangreCompleta = selectTipo && selectTipo.value === 'sangre';
        const esPlasma = selectTipo && selectTipo.value === 'plasma';
        if (seccionHt) seccionHt.style.display = esSangreCompleta ? 'block' : 'none';
        [htReceptor, htDeseado, htDonante].forEach(input => {
            if (input) {
                if (esSangreCompleta) input.setAttribute('required', 'required');
                else {
                    input.removeAttribute('required');
                    input.value = '';
                }
            }
        });
        if (seccionPlasma) seccionPlasma.style.display = esPlasma ? 'block' : 'none';
        if (albuminaInput) {
            if (esPlasma) albuminaInput.setAttribute('required', 'required');
            else {
                albuminaInput.removeAttribute('required');
                albuminaInput.value = '';
            }
        }
        const volEl = document.getElementById('volumenCalculado');
        if (volEl) volEl.textContent = '-- ml';
        if (typeof this.calcularVolumenTransfusion === 'function') this.calcularVolumenTransfusion();
    }

    if (selectTipo) {
        selectTipo.addEventListener('change', () => toggleSeccionHematocrito.call(this));
        toggleSeccionHematocrito.call(this);
    }

    const campos = ['transfusionTipoMascota', 'transfusionPesoReceptor', 'transfusionHtReceptor', 'transfusionHtDeseado', 'transfusionHtDonante'];
    campos.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) {
            campo.addEventListener('input', () => this.calcularVolumenTransfusion());
            campo.addEventListener('change', () => this.calcularVolumenTransfusion());
        }
    });
};

InternamientoModule.prototype.calcularVolumenTransfusion = function() {
    const tipoTransfusion = document.getElementById('transfusionTipo')?.value;
    if (tipoTransfusion !== 'sangre') {
        const resultado = document.getElementById('volumenCalculado');
        if (resultado) resultado.textContent = '-- ml';
        return null;
    }
    const tipoMascota = document.getElementById('transfusionTipoMascota')?.value;
    const peso = parseFloat(document.getElementById('transfusionPesoReceptor')?.value);
    const htReceptor = parseFloat(document.getElementById('transfusionHtReceptor')?.value);
    const htDeseado = parseFloat(document.getElementById('transfusionHtDeseado')?.value);
    const htDonante = parseFloat(document.getElementById('transfusionHtDonante')?.value);

    if (!peso || !htReceptor || !htDeseado || !htDonante || htDonante === 0) {
        document.getElementById('volumenCalculado').textContent = '-- ml';
        return null;
    }

    // Determinar N según la especie
    const N = tipoMascota === 'gato' ? 70 : 90;

    // Calcular volumen
    // Fórmula: Volumen (ml) = [Peso (kg) × N] × (Ht deseado - Ht receptor) / Ht donante
    const volumen = (peso * N) * (htDeseado - htReceptor) / htDonante;

    // Mostrar resultado
    const resultado = document.getElementById('volumenCalculado');
    if (resultado) {
        if (volumen > 0) {
            resultado.textContent = `${Math.round(volumen)} ml`;
            resultado.style.color = 'white';
        } else {
            resultado.textContent = 'Valores inválidos';
            resultado.style.color = '#ffcccc';
        }
    }

    return volumen;
};

// ================================================================
// GUARDAR TRANSFUSIÓN
// ================================================================

InternamientoModule.prototype.handleTransfusionSubmit = async function(e) {
    e.preventDefault();

    const tipoTransfusion = document.getElementById('transfusionTipo')?.value || '';
    const esSangreCompleta = tipoTransfusion === 'sangre';
    const esPlasma = tipoTransfusion === 'plasma';
    let volumenCalculado = null;
    if (esSangreCompleta) {
        volumenCalculado = this.calcularVolumenTransfusion();
        if (!volumenCalculado || volumenCalculado <= 0) {
            this.showAlert('Por favor completa los valores de hematocrito y calcula el volumen de transfusión antes de continuar', 'Volumen Requerido', 'warning');
            return;
        }
    }
    if (esPlasma) {
        const albuminaVal = document.getElementById('transfusionAlbumina')?.value?.trim();
        if (!albuminaVal || isNaN(parseFloat(albuminaVal))) {
            this.showAlert('Para transfusión de plasma debe registrar el último valor de albúmina del examen de laboratorio del paciente.', 'Albúmina requerida', 'warning');
            return;
        }
    }

    const transfusionData = {
        tipoMascota: document.getElementById('transfusionTipoMascota')?.value,
        pesoReceptor: parseFloat(document.getElementById('transfusionPesoReceptor')?.value),
        tipoSangreReceptor: document.getElementById('transfusionTipoSangreReceptor')?.value.trim() || '',
        tipoTransfusion: tipoTransfusion,
        htReceptor: esSangreCompleta ? parseFloat(document.getElementById('transfusionHtReceptor')?.value) : null,
        htDeseado: esSangreCompleta ? parseFloat(document.getElementById('transfusionHtDeseado')?.value) : null,
        htDonante: esSangreCompleta ? parseFloat(document.getElementById('transfusionHtDonante')?.value) : null,
        volumenCalculado: esSangreCompleta ? Math.round(volumenCalculado) : null,
        ultimaAlbumina: esPlasma ? parseFloat(document.getElementById('transfusionAlbumina')?.value) : null,
        nombreDonante: document.getElementById('transfusionNombreDonante')?.value.trim() || '',
        tipoSangreDonante: document.getElementById('transfusionTipoSangreDonante')?.value.trim() || '',
        pruebaCruzada: document.getElementById('transfusionPruebaCruzada')?.checked || false,
        resultadoPrueba: document.getElementById('transfusionResultadoPrueba')?.value.trim() || '',
        horaInicio: '',
        horaFin: '',
        velocidadInfusion: null,
        reaccionAdversa: false,
        descripcionReaccion: '',
        observaciones: document.getElementById('transfusionObservaciones')?.value.trim() || ''
    };

    const resultadoCodigo = await this.verificarCodigoAsistente('registro_transfusion');
    if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
        this.showNotification('No se registró la transfusión', 'info');
        return;
    }

    try {
        await this.guardarTransfusion(transfusionData, resultadoCodigo);
        this.showNotification('Transfusión registrada por ' + resultadoCodigo.nombre, 'success');
        document.querySelector('.modal-overlay')?.remove();
        this.showInternamientoView('transfusiones');
        if (typeof this.loadTransfusionesView === 'function') this.loadTransfusionesView();
    } catch (error) {
        console.error('Error guardando transfusión:', error);
        this.showAlert('Error al guardar transfusión: ' + error.message, 'Error', 'error');
    }
};

InternamientoModule.prototype.guardarTransfusion = async function(data, codigoResult) {
    const userId = codigoResult?.assistantId || sessionStorage.getItem('userId');
    const userName = codigoResult?.nombre || sessionStorage.getItem('userName');

    const transfusionId = 'transf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const transfusionData = {
        transfusionId: transfusionId,
        fecha: Date.now(),
        fechaHoraInicio: data.horaInicio ? new Date(data.horaInicio).getTime() : Date.now(),
        fechaHoraFin: data.horaFin ? new Date(data.horaFin).getTime() : null,
        
        receptor: {
            tipoMascota: data.tipoMascota,
            peso: data.pesoReceptor,
            tipoSangre: data.tipoSangreReceptor,
            htActual: data.htReceptor,
            htDeseado: data.htDeseado,
            ultimaAlbumina: data.ultimaAlbumina != null ? data.ultimaAlbumina : null
        },
        
        donante: {
            nombre: data.nombreDonante,
            tipoSangre: data.tipoSangreDonante,
            ht: data.htDonante
        },
        
        calculo: {
            factorN: data.tipoMascota === 'gato' ? 70 : 90,
            volumenCalculado: data.volumenCalculado,
            formula: data.tipoTransfusion === 'sangre' && data.volumenCalculado != null
                ? `[${data.pesoReceptor} kg × ${data.tipoMascota === 'gato' ? 70 : 90}] × (${data.htDeseado} - ${data.htReceptor}) / ${data.htDonante}`
                : (data.tipoTransfusion === 'plasma' ? 'N/A (plasma)' : '')
        },
        
        tipoTransfusion: data.tipoTransfusion || '',
        
        procedimiento: {
            pruebaCruzada: data.pruebaCruzada,
            resultadoPrueba: data.resultadoPrueba,
            velocidadInfusion: data.velocidadInfusion,
            reaccionAdversa: data.reaccionAdversa,
            descripcionReaccion: data.descripcionReaccion
        },
        
        observaciones: data.observaciones,
        responsable: userId,
        responsableNombre: userName,
        registradoCodigoVerificado: !!codigoResult,
        registradoPor: userId,
        registradoNombre: userName,
        fechaRegistro: Date.now()
    };

    // Guardar en Firebase
    const updates = {};
    updates[`transfusiones/${transfusionId}`] = transfusionData;
    updates['metadata/fechaUltimaActualizacion'] = Date.now();

    const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
    await internamientoRef.update(updates);

    // Actualizar Map local
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (internamiento) {
        const transfusionesPrev = internamiento.transfusiones && typeof internamiento.transfusiones === 'object' && !Array.isArray(internamiento.transfusiones)
            ? internamiento.transfusiones
            : {};
        const transfusiones = { ...transfusionesPrev, [transfusionId]: transfusionData };
        this.internamientos.set(this.currentInternamientoId, { ...internamiento, transfusiones });
    }

    // Auditoría (quien registró = quien ingresó el código)
    await internamientoRef.child('auditoria/historialCambios').push({
        timestamp: Date.now(),
        userId: userId,
        usuarioNombre: userName,
        accion: 'registrar_transfusion',
        codigoVerificado: !!codigoResult,
        detalles: {
            transfusionId: transfusionId,
            volumen: data.volumenCalculado,
            htReceptor: data.htReceptor,
            htDeseado: data.htDeseado
        }
    });
};

// ================================================================
// UTILIDADES
// ================================================================

InternamientoModule.prototype.obtenerPesoMasReciente = function(internamiento) {
    const turnos = Object.values(internamiento.turnos || {});
    if (turnos.length === 0) {
        return internamiento.datosIngreso?.pesoIngreso || null;
    }

    // Ordenar por fecha descendente
    turnos.sort((a, b) => b.fecha - a.fecha);

    // Buscar el primer turno con peso registrado
    for (const turno of turnos) {
        if (turno.parametrosVitales?.peso) {
            return turno.parametrosVitales.peso;
        }
    }

    // Si no hay peso en turnos, usar peso de ingreso
    return internamiento.datosIngreso?.pesoIngreso || null;
};

console.log('Módulo de Transfusión Sanguínea cargado');
