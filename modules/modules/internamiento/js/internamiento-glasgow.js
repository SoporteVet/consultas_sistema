// ====================================================================
// ESCALA DE GLASGOW MODIFICADA PARA VETERINARIA
// ====================================================================
// Sistema de evaluación del dolor en perros y gatos

// ================================================================
// MOSTRAR CALCULADORA DE GLASGOW
// ================================================================

InternamientoModule.prototype.showGlasgowCalculator = function() {
    const tipoMascota = this.getTipoMascotaActual();
    const modalContent = this.getGlasgowFormHTML(tipoMascota);
    const modal = this.createModal('Escala de Glasgow - Evaluación de Dolor', modalContent, 'fa-paw');
    document.body.appendChild(modal);

    setTimeout(() => {
        this.setupGlasgowCalculator(tipoMascota);
    }, 100);
};

InternamientoModule.prototype.getTipoMascotaActual = function() {
    if (!this.currentInternamientoId) return 'perro';
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    return internamiento?.referencias?.tipoMascota || 'perro';
};

// ================================================================
// HTML DEL FORMULARIO
// ================================================================

InternamientoModule.prototype.getGlasgowFormHTML = function(tipoMascota) {
    const esPerro = tipoMascota === 'perro';
    
    return `
        <div style="max-height: 80vh; overflow-y: auto; padding: 15px;">
            <!-- Selector de especie -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                <label style="font-size: 1.1rem; font-weight: 600; display: block; margin-bottom: 10px;">
                    Selecciona la especie del paciente:
                </label>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button type="button" onclick="window.internamientoModule.cambiarEspecieGlasgow('perro')" 
                            class="btn ${esPerro ? 'btn-light' : 'btn-secondary'}" 
                            id="glasgowBtnPerro"
                            style="padding: 12px 30px; font-size: 1rem;">
                        <i class="fas fa-dog"></i> Perro
                    </button>
                    <button type="button" onclick="window.internamientoModule.cambiarEspecieGlasgow('gato')" 
                            class="btn ${!esPerro ? 'btn-light' : 'btn-secondary'}" 
                            id="glasgowBtnGato"
                            style="padding: 12px 30px; font-size: 1rem;">
                        <i class="fas fa-cat"></i> Gato
                    </button>
                </div>
            </div>

            <input type="hidden" id="glasgowTipoMascota" value="${tipoMascota}">

            <!-- Resultado -->
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center; border: 2px solid #dee2e6;">
                <div style="font-size: 0.9rem; color: #6c757d; margin-bottom: 5px; font-weight: 600;">PUNTAJE GLASGOW</div>
                <div id="glasgowPuntajeTotal" style="font-size: 3rem; font-weight: bold; color: #2c3e50; margin: 10px 0;">
                    0
                </div>
                <div id="glasgowNivelDolor" style="font-size: 1.2rem; font-weight: 600; padding: 10px 20px; border-radius: 20px; display: inline-block;">
                    Sin dolor
                </div>
                <div style="margin-top: 15px; font-size: 0.85rem; color: #6c757d;">
                    <span id="glasgowRangoTexto">Rango óptimo</span>
                </div>
            </div>

            <!-- Formulario de evaluación -->
            <form id="formGlasgow">
                ${esPerro ? this.getGlasgowPerroHTML() : this.getGlasgowGatoHTML()}

                <!-- Observaciones -->
                <div class="form-section" style="margin-top: 25px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 10px;">
                        <i class="fas fa-notes-medical"></i> Observaciones Adicionales
                    </label>
                    <textarea id="glasgowObservaciones" rows="3" placeholder="Notas sobre la evaluación del dolor..." 
                              style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ddd;"></textarea>
                </div>

                <!-- Botones -->
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px; padding-top: 20px; border-top: 2px solid #e0e0e0;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="button" onclick="window.internamientoModule.aplicarGlasgowATurno()" class="btn btn-primary">
                        <i class="fas fa-check"></i> Aplicar a Turno Actual
                    </button>
                </div>
            </form>
        </div>
    `;
};

InternamientoModule.prototype.getGlasgowPerroHTML = function() {
    return `
        <!-- PERROS: Puntaje 0-20 -->
        <div class="form-section">
            <h4 style="color: #667eea; margin-bottom: 15px;">
                <i class="fas fa-dog"></i> Evaluación para Perros (Máximo 20 puntos)
            </h4>
            <small style="display: block; margin-bottom: 20px; color: #6c757d;">
                <strong>Interpretación:</strong> 0-4 = Sin dolor | 5-8 = Dolor leve | 9-14 = Dolor moderado | 15-20 = Dolor severo
            </small>

            <!-- 1. Estado Mental -->
            <div class="form-group" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 10px;">
                    1. Estado Mental (0-4 puntos)
                </label>
                <select id="glasgowEstadoMental" class="glasgow-select" style="width: 100%; padding: 10px; border-radius: 6px;">
                    <option value="0">0 - Alerta y responsivo</option>
                    <option value="1">1 - Tranquilo</option>
                    <option value="2">2 - Levemente deprimido</option>
                    <option value="3">3 - Deprimido</option>
                    <option value="4">4 - Estuporoso o comatoso</option>
                </select>
            </div>

            <!-- 2. Actividad Motora -->
            <div class="form-group" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 10px;">
                    2. Actividad Motora (0-4 puntos)
                </label>
                <select id="glasgowActividadMotora" class="glasgow-select" style="width: 100%; padding: 10px; border-radius: 6px;">
                    <option value="0">0 - Normal, se mueve libremente</option>
                    <option value="1">1 - Actividad reducida</option>
                    <option value="2">2 - Renuente a moverse</option>
                    <option value="3">3 - Rígido, se mueve con dificultad</option>
                    <option value="4">4 - Inmóvil o recumbente</option>
                </select>
            </div>

            <!-- 3. Vocalización -->
            <div class="form-group" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 10px;">
                    3. Vocalización (0-4 puntos)
                </label>
                <select id="glasgowVocalizacion" class="glasgow-select" style="width: 100%; padding: 10px; border-radius: 6px;">
                    <option value="0">0 - No vocaliza</option>
                    <option value="1">1 - Vocalización ocasional</option>
                    <option value="2">2 - Vocalización frecuente</option>
                    <option value="3">3 - Vocalización constante o gemidos</option>
                    <option value="4">4 - Llanto o aullidos constantes</option>
                </select>
            </div>

            <!-- 4. Postura -->
            <div class="form-group" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 10px;">
                    4. Postura (0-4 puntos)
                </label>
                <select id="glasgowPostura" class="glasgow-select" style="width: 100%; padding: 10px; border-radius: 6px;">
                    <option value="0">0 - Postura normal</option>
                    <option value="1">1 - Postura ligeramente alterada</option>
                    <option value="2">2 - Postura claramente alterada (encorvado)</option>
                    <option value="3">3 - Postura rígida o tenso</option>
                    <option value="4">4 - Postura extremadamente anormal (recostado, rígido)</option>
                </select>
            </div>

            <!-- 5. Respuesta a Palpación -->
            <div class="form-group" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 10px;">
                    5. Respuesta a Palpación del Área Dolorosa (0-4 puntos)
                </label>
                <select id="glasgowRespuestaPalpacion" class="glasgow-select" style="width: 100%; padding: 10px; border-radius: 6px;">
                    <option value="0">0 - Sin respuesta anormal</option>
                    <option value="1">1 - Sensible al tacto</option>
                    <option value="2">2 - Protege el área (retira, tensa)</option>
                    <option value="3">3 - Reacción agresiva o vocaliza</option>
                    <option value="4">4 - No permite ser tocado, muy agresivo</option>
                </select>
            </div>
        </div>
    `;
};

InternamientoModule.prototype.getGlasgowGatoHTML = function() {
    return `
        <!-- GATOS: Puntaje 0-20 -->
        <div class="form-section">
            <h4 style="color: #667eea; margin-bottom: 15px;">
                <i class="fas fa-cat"></i> Evaluación para Gatos (Máximo 20 puntos)
            </h4>
            <small style="display: block; margin-bottom: 20px; color: #6c757d;">
                <strong>Interpretación:</strong> 0-3 = Sin dolor | 4-7 = Dolor leve | 8-13 = Dolor moderado | 14-20 = Dolor severo
            </small>

            <!-- 1. Estado Mental -->
            <div class="form-group" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 10px;">
                    1. Estado Mental (0-4 puntos)
                </label>
                <select id="glasgowEstadoMental" class="glasgow-select" style="width: 100%; padding: 10px; border-radius: 6px;">
                    <option value="0">0 - Alerta, interactúa normalmente</option>
                    <option value="1">1 - Quieto pero alerta</option>
                    <option value="2">2 - Deprimido, poco responsivo</option>
                    <option value="3">3 - Muy deprimido o escondido</option>
                    <option value="4">4 - Estuporoso, no responde</option>
                </select>
            </div>

            <!-- 2. Posición -->
            <div class="form-group" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 10px;">
                    2. Posición del Cuerpo (0-4 puntos)
                </label>
                <select id="glasgowActividadMotora" class="glasgow-select" style="width: 100%; padding: 10px; border-radius: 6px;">
                    <option value="0">0 - Posición normal, relajado</option>
                    <option value="1">1 - Encorvado, incómodo</option>
                    <option value="2">2 - Acurrucado, tenso</option>
                    <option value="3">3 - Rígido, postura anormal</option>
                    <option value="4">4 - Decúbito, inmóvil</option>
                </select>
            </div>

            <!-- 3. Vocalización -->
            <div class="form-group" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 10px;">
                    3. Vocalización (0-4 puntos)
                </label>
                <select id="glasgowVocalizacion" class="glasgow-select" style="width: 100%; padding: 10px; border-radius: 6px;">
                    <option value="0">0 - Silencioso, ronroneo normal</option>
                    <option value="1">1 - Maullido ocasional</option>
                    <option value="2">2 - Maullar frecuente o gruñido</option>
                    <option value="3">3 - Maullidos constantes o quejidos</option>
                    <option value="4">4 - Gritos o maullidos de angustia</option>
                </select>
            </div>

            <!-- 4. Expresión Facial -->
            <div class="form-group" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 10px;">
                    4. Expresión Facial (0-4 puntos)
                </label>
                <select id="glasgowPostura" class="glasgow-select" style="width: 100%; padding: 10px; border-radius: 6px;">
                    <option value="0">0 - Normal, relajado</option>
                    <option value="1">1 - Ojos entrecerrados</option>
                    <option value="2">2 - Ojos muy cerrados, orejas hacia atrás</option>
                    <option value="3">3 - Mueca de dolor, bigotes hacia atrás</option>
                    <option value="4">4 - Expresión de angustia severa</option>
                </select>
            </div>

            <!-- 5. Respuesta a Manipulación -->
            <div class="form-group" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 10px;">
                    5. Respuesta a Manipulación (0-4 puntos)
                </label>
                <select id="glasgowRespuestaPalpacion" class="glasgow-select" style="width: 100%; padding: 10px; border-radius: 6px;">
                    <option value="0">0 - Permite manipulación sin reacción</option>
                    <option value="1">1 - Sensible, reacciona levemente</option>
                    <option value="2">2 - Retira el área, tensa</option>
                    <option value="3">3 - Bufido, intento de morder/arañar</option>
                    <option value="4">4 - Agresivo, no permite contacto</option>
                </select>
            </div>
        </div>
    `;
};

// ================================================================
// CALCULADORA Y LÓGICA
// ================================================================

InternamientoModule.prototype.setupGlasgowCalculator = function(tipoMascota) {
    const selects = document.querySelectorAll('.glasgow-select');
    selects.forEach(select => {
        select.addEventListener('change', () => this.calcularGlasgow(tipoMascota));
    });

    // Calcular inicial
    this.calcularGlasgow(tipoMascota);
};

InternamientoModule.prototype.calcularGlasgow = function(tipoMascota) {
    const estadoMental = parseInt(document.getElementById('glasgowEstadoMental')?.value) || 0;
    const actividadMotora = parseInt(document.getElementById('glasgowActividadMotora')?.value) || 0;
    const vocalizacion = parseInt(document.getElementById('glasgowVocalizacion')?.value) || 0;
    const postura = parseInt(document.getElementById('glasgowPostura')?.value) || 0;
    const respuestaPalpacion = parseInt(document.getElementById('glasgowRespuestaPalpacion')?.value) || 0;

    const puntajeTotal = estadoMental + actividadMotora + vocalizacion + postura + respuestaPalpacion;

    // Actualizar display
    document.getElementById('glasgowPuntajeTotal').textContent = puntajeTotal;

    // Determinar nivel de dolor según especie
    let nivelDolor, colorFondo, rangoTexto;

    if (tipoMascota === 'gato') {
        if (puntajeTotal <= 3) {
            nivelDolor = 'Sin dolor';
            colorFondo = '#d4edda';
            rangoTexto = '0-3 puntos: Rango óptimo';
        } else if (puntajeTotal <= 7) {
            nivelDolor = 'Dolor Leve';
            colorFondo = '#fff3cd';
            rangoTexto = '4-7 puntos: Monitorear';
        } else if (puntajeTotal <= 13) {
            nivelDolor = 'Dolor Moderado';
            colorFondo = '#ffe5b4';
            rangoTexto = '8-13 puntos: Intervención necesaria';
        } else {
            nivelDolor = 'Dolor Severo';
            colorFondo = '#f8d7da';
            rangoTexto = '14-20 puntos: Analgesia urgente';
        }
    } else { // perro
        if (puntajeTotal <= 4) {
            nivelDolor = 'Sin dolor';
            colorFondo = '#d4edda';
            rangoTexto = '0-4 puntos: Rango óptimo';
        } else if (puntajeTotal <= 8) {
            nivelDolor = 'Dolor Leve';
            colorFondo = '#fff3cd';
            rangoTexto = '5-8 puntos: Monitorear';
        } else if (puntajeTotal <= 14) {
            nivelDolor = 'Dolor Moderado';
            colorFondo = '#ffe5b4';
            rangoTexto = '9-14 puntos: Intervención necesaria';
        } else {
            nivelDolor = 'Dolor Severo';
            colorFondo = '#f8d7da';
            rangoTexto = '15-20 puntos: Analgesia urgente';
        }
    }

    const nivelDolorElement = document.getElementById('glasgowNivelDolor');
    if (nivelDolorElement) {
        nivelDolorElement.textContent = nivelDolor;
        nivelDolorElement.style.background = colorFondo;
        nivelDolorElement.style.color = '#2c3e50';
    }

    document.getElementById('glasgowRangoTexto').textContent = rangoTexto;

    return { puntajeTotal, nivelDolor };
};

InternamientoModule.prototype.cambiarEspecieGlasgow = function(tipoMascota) {
    document.getElementById('glasgowTipoMascota').value = tipoMascota;
    
    // Cerrar modal actual
    document.querySelector('.modal-overlay')?.remove();
    
    // Reabrir con nueva especie
    setTimeout(() => {
        this.showGlasgowCalculator();
    }, 100);
};

InternamientoModule.prototype.aplicarGlasgowATurno = function() {
    const tipoMascota = document.getElementById('glasgowTipoMascota')?.value || 'perro';
    const resultado = this.calcularGlasgow(tipoMascota);
    const observaciones = document.getElementById('glasgowObservaciones')?.value.trim() || '';

    // Aplicar al formulario de turno
    const glasgowPuntajeInput = document.getElementById('glasgowPuntaje');
    if (glasgowPuntajeInput) {
        glasgowPuntajeInput.value = resultado.puntajeTotal;
    }

    // Actualizar nivel de dolor
    const nivelDolorSelect = document.getElementById('turnoNivelDolor');
    if (nivelDolorSelect) {
        // Mapear nivel de dolor a las opciones del select
        const mapa = {
            'Sin dolor': 'sin_dolor',
            'Dolor Leve': 'leve',
            'Dolor Moderado': 'moderado',
            'Dolor Severo': 'fuerte'
        };
        nivelDolorSelect.value = mapa[resultado.nivelDolor] || 'sin_dolor';
    }

    // Si hay observaciones, agregarlas al campo de observaciones del turno
    if (observaciones) {
        const observacionesTurno = document.getElementById('turnoObservaciones');
        if (observacionesTurno) {
            const textoActual = observacionesTurno.value;
            const nuevoTexto = textoActual 
                ? `${textoActual}\n\n[Glasgow ${resultado.puntajeTotal} pts - ${resultado.nivelDolor}]: ${observaciones}`
                : `[Glasgow ${resultado.puntajeTotal} pts - ${resultado.nivelDolor}]: ${observaciones}`;
            observacionesTurno.value = nuevoTexto;
        }
    }

    this.showNotification(`Glasgow aplicado: ${resultado.puntajeTotal} pts - ${resultado.nivelDolor}`, 'success');
    document.querySelector('.modal-overlay')?.remove();
};

console.log('Escala de Glasgow cargada');
