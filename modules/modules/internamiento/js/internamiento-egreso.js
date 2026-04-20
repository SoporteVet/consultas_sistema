// ====================================================================
// MÓDULO DE INTERNAMIENTO - PROCESO DE EGRESO
// ====================================================================

// ================================================================
// PROCESO DE EGRESO COMPLETO
// ================================================================

InternamientoModule.prototype.showEgresoForm = function() {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    if (internamiento.estado?.actual !== 'alta') {
        this.showAlert('Solo se puede egresar pacientes con alta médica autorizada', 'Acción Bloqueada', 'warning');
        return;
    }

    this.showInternamientoView('egreso');
    this.loadEgresoForm(internamiento);
};

InternamientoModule.prototype.loadEgresoForm = function(internamiento) {
    const container = document.getElementById('internamiento-egreso');
    if (!container) return;

    container.innerHTML = `
        <div class="section-header">
            <h2><i class="fas fa-home"></i> Proceso de Egreso</h2>
            <button class="btn btn-secondary" onclick="window.internamientoModule.showPanelPrincipal('${this.currentInternamientoId}')">
                <i class="fas fa-arrow-left"></i> Volver
            </button>
        </div>

        <div class="alert-box warning">
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>Alta Médica Autorizada</strong><br>
                Complete los siguientes pasos para el egreso del paciente
            </div>
        </div>

        <form id="formEgreso">
            <!-- Paso 1: Checklist Pre-Egreso -->
            <div class="form-section">
                <h3><i class="fas fa-tasks"></i> Checklist Pre-Egreso</h3>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; cursor: pointer;">
                        <input type="checkbox" id="check1" required>
                        <span>✅ Alta médica autorizada</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; cursor: pointer;">
                        <input type="checkbox" id="check2" required>
                        <span>✅ Consentimiento de egreso explicado al propietario</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; cursor: pointer;">
                        <input type="checkbox" id="check3" required>
                        <span>✅ Pendientes clínicos resueltos</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="check4">
                        <span>Próxima cita agendada (opcional)</span>
                    </label>
                </div>
            </div>

            <!-- Paso 2: Resumen de Servicios -->
            <div class="form-section">
                <h3><i class="fas fa-file-invoice"></i> Resumen de Servicios</h3>
                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px;">
                    ${this.renderResumenServicios(internamiento)}
                </div>
            </div>

            <!-- Paso 3: Diagnóstico Final e Indicaciones -->
            <div class="form-section">
                <h3><i class="fas fa-file-medical"></i> Información de Egreso</h3>
                <div class="form-row">
                    <div class="form-group" style="grid-column: span 2;">
                        <label for="diagnosticoFinal">Diagnóstico Final *</label>
                        <input type="text" id="diagnosticoFinal" required placeholder="Diagnóstico definitivo al egreso">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="grid-column: span 2;">
                        <label for="tratamientoAmbulatorio">Tratamiento Ambulatorio *</label>
                        <textarea id="tratamientoAmbulatorio" rows="3" required placeholder="Indicaciones para continuar en casa..."></textarea>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="grid-column: span 2;">
                        <label for="recomendacionesCuidado">Recomendaciones de Cuidado *</label>
                        <textarea id="recomendacionesCuidado" rows="3" required placeholder="Cuidados especiales, alimentación, ejercicio..."></textarea>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="grid-column: span 2;">
                        <label for="senalesAlerta">Señales de Alerta *</label>
                        <textarea id="senalesAlerta" rows="2" required placeholder="Síntomas que requieren atención inmediata..."></textarea>
                    </div>
                </div>
            </div>

            <!-- Paso 4: Próxima Cita -->
            <div class="form-section">
                <h3><i class="fas fa-calendar-check"></i> Próxima Cita (Opcional)</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label for="proximaCitaFecha">Fecha</label>
                        <input type="date" id="proximaCitaFecha">
                    </div>
                    <div class="form-group">
                        <label for="proximaCitaHora">Hora</label>
                        <input type="time" id="proximaCitaHora">
                    </div>
                    <div class="form-group">
                        <label for="proximaCitaMotivo">Motivo</label>
                        <input type="text" id="proximaCitaMotivo" placeholder="Ej: Control post-internamiento">
                    </div>
                </div>
            </div>

            <!-- Paso 5: Datos de Quien Recoge -->
            <div class="form-section">
                <h3><i class="fas fa-user-check"></i> Datos de Quien Recoge al Paciente</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label for="nombreQuienRecoge">Nombre Completo *</label>
                        <input type="text" id="nombreQuienRecoge" required>
                    </div>
                    <div class="form-group">
                        <label for="cedulaQuienRecoge">Cédula *</label>
                        <input type="text" id="cedulaQuienRecoge" required>
                    </div>
                    <div class="form-group">
                        <label for="relacionQuienRecoge">Relación con Propietario</label>
                        <input type="text" id="relacionQuienRecoge" placeholder="Ej: Propietario, Familiar, etc.">
                    </div>
                </div>
            </div>

            <div style="text-align: right; margin-top: 30px; padding-top: 20px; border-top: 3px solid var(--internamiento-light);">
                <button type="button" class="btn btn-secondary" onclick="window.internamientoModule.showPanelPrincipal('${this.currentInternamientoId}')">
                    Cancelar
                </button>
                <button type="submit" class="btn btn-success" style="margin-left: 10px;">
                    <i class="fas fa-check-circle"></i> Completar Egreso
                </button>
            </div>
        </form>
    `;

    // Setup submit
    const formEgreso = document.getElementById('formEgreso');
    if (formEgreso) {
        formEgreso.onsubmit = (e) => this.handleEgresoSubmit(e);
    }
};

InternamientoModule.prototype.renderResumenServicios = function(internamiento) {
    const dias = this.calcularDiasInternado(internamiento.datosIngreso?.fechaIngreso);
    const horas = Math.floor((Date.now() - internamiento.datosIngreso?.fechaIngreso) / (1000 * 60 * 60));
    
    return `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div><strong>Días de internamiento:</strong> ${dias}</div>
            <div><strong>Horas totales:</strong> ${horas}h</div>
            <div><strong>Turnos registrados:</strong> ${internamiento.estadisticas?.totalTurnos || 0}</div>
            <div><strong>Medicaciones administradas:</strong> ${internamiento.estadisticas?.totalMedicaciones || 0}</div>
            <div style="grid-column: span 2;">
                <strong>Medicamentos utilizados:</strong>
                <div style="margin-top: 8px;">
                    ${Object.values(internamiento.planTerapeutico?.medicamentos || {})
                        .map(med => `<span class="chip">${med.nombreComercial}</span>`)
                        .join('')}
                </div>
            </div>
        </div>
    `;
};

InternamientoModule.prototype.handleEgresoSubmit = async function(e) {
    e.preventDefault();

    // Validar checklist
    if (!document.getElementById('check1').checked || 
        !document.getElementById('check2').checked || 
        !document.getElementById('check3').checked) {
        this.showAlert('Debe completar todo el checklist obligatorio', 'Checklist Incompleto', 'warning');
        return;
    }

    const egresoData = {
        diagnosticoFinal: document.getElementById('diagnosticoFinal')?.value.trim() || '',
        tratamientoAmbulatorio: document.getElementById('tratamientoAmbulatorio')?.value.trim() || '',
        recomendacionesCuidado: document.getElementById('recomendacionesCuidado')?.value.trim() || '',
        senalesAlerta: document.getElementById('senalesAlerta')?.value.trim() || '',
        proximaCita: {
            fecha: document.getElementById('proximaCitaFecha')?.value || null,
            hora: document.getElementById('proximaCitaHora')?.value || null,
            motivo: document.getElementById('proximaCitaMotivo')?.value.trim() || ''
        },
        quienRecoge: {
            nombre: document.getElementById('nombreQuienRecoge')?.value.trim() || '',
            cedula: document.getElementById('cedulaQuienRecoge')?.value.trim() || '',
            relacion: document.getElementById('relacionQuienRecoge')?.value.trim() || 'Propietario'
        }
    };

    const confirmar = await this.showConfirm(
        '¿Confirmar egreso del paciente?\n\nEsto marcará el internamiento como FINALIZADO y no podrá modificarse.',
        '🏠 Confirmar Egreso',
        { danger: true, confirmText: 'Completar Egreso', cancelText: 'Cancelar', icon: 'fa-home', iconColor: '#27ae60' }
    );
    
    if (!confirmar) return;

    try {
        await this.procesarEgreso(egresoData);
        this.showNotification('Egreso completado exitosamente', 'success', 5000);
        this.showInternamientosSection();
    } catch (error) {
        console.error('Error procesando egreso:', error);
        this.showAlert('Error al procesar egreso: ' + error.message, 'Error', 'error');
    }
};

InternamientoModule.prototype.procesarEgreso = async function(egresoData) {
    const userId = sessionStorage.getItem('userId');
    const userName = sessionStorage.getItem('userName');

    const updates = {};
    updates['altaEgreso/egresoCompletado'] = true;
    updates['altaEgreso/fechaEgreso'] = Date.now();
    updates['altaEgreso/horaEgreso'] = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    updates['altaEgreso/diagnosticoFinal'] = egresoData.diagnosticoFinal;
    updates['altaEgreso/tratamientoAmbulatorio'] = egresoData.tratamientoAmbulatorio;
    updates['altaEgreso/recomendacionesCuidado'] = egresoData.recomendacionesCuidado;
    updates['altaEgreso/senalesAlerta'] = egresoData.senalesAlerta;
    updates['altaEgreso/proximaCita'] = egresoData.proximaCita;
    updates['altaEgreso/quienRecoge'] = egresoData.quienRecoge;
    updates['altaEgreso/responsableEgreso'] = userId;
    updates['altaEgreso/responsableNombre'] = userName;
    updates['estado/actual'] = 'egresado';
    updates['estado/fechaCambio'] = Date.now();
    updates['estado/cambiadoPor'] = userId;
    updates['metadata/fechaUltimaActualizacion'] = Date.now();

    const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
    await internamientoRef.update(updates);

    // Agregar a historial de estados
    await internamientoRef.child('estado/historialEstados').push({
        estado: 'egresado',
        fecha: Date.now(),
        usuario: userId,
        usuarioNombre: userName,
        razon: 'Egreso completado'
    });

    // Auditoría
    await internamientoRef.child('auditoria/historialCambios').push({
        timestamp: Date.now(),
        userId: userId,
        usuarioNombre: userName,
        accion: 'completar_egreso',
        detalles: {
            diagnosticoFinal: egresoData.diagnosticoFinal,
            quienRecoge: egresoData.quienRecoge.nombre
        }
    });
};

InternamientoModule.prototype.cancelarAlta = async function() {
    const userRole = sessionStorage.getItem('userRole');
    if (!['admin', 'consulta_externa'].includes(userRole)) {
        this.showAlert('Solo médicos pueden cancelar altas', 'Acceso Denegado', 'error');
        return;
    }

    const razon = await this.showPrompt('Razón para cancelar el alta:', 'Cancelar Alta Médica', '', true);
    if (!razon) return;

    try {
        await this.actualizarEstadoInternamiento(this.currentInternamientoId, 'activo', `Alta cancelada: ${razon}`);
        this.showNotification('Alta cancelada. Paciente regresado a estado ACTIVO', 'success');
        this.loadPanelPrincipal(this.currentInternamientoId);
    } catch (error) {
        console.error('Error cancelando alta:', error);
        this.showAlert('Error al cancelar alta: ' + error.message, 'Error', 'error');
    }
};

// ================================================================
// EDICIÓN DE TURNOS
// ================================================================

InternamientoModule.prototype.editarTurno = function(turnoId) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    const turno = internamiento.turnos?.[turnoId];
    if (!turno) {
        alert('❌ Turno no encontrado');
        return;
    }

    // Verificar si puede editar (solo dentro de las 24 horas)
    const horasPasadas = (Date.now() - turno.fecha) / (1000 * 60 * 60);
    if (horasPasadas > 24) {
        this.showAlert('Solo se pueden editar turnos de las últimas 24 horas', 'Edición No Permitida', 'warning');
        return;
    }

    // Mostrar formulario de edición en modal
    const modalContent = this.renderFormEdicionTurno(turno, turnoId);
    const modal = this.createModal('Editar Turno', modalContent);
    document.body.appendChild(modal);
};

InternamientoModule.prototype.renderFormEdicionTurno = function(turno, turnoId) {
    return `
        <form id="formEditarTurno" style="max-height: 70vh; overflow-y: auto;">
            <div class="alert-box warning">
                <i class="fas fa-exclamation-triangle"></i>
                <div>Los cambios quedarán registrados en la auditoría</div>
            </div>

            <div class="form-group">
                <label>Temperatura (°C) *</label>
                <input type="number" id="editTemp" step="0.1" value="${turno.parametrosVitales?.temperatura || ''}" required>
            </div>

            <div class="form-group">
                <label>FC (lpm) *</label>
                <input type="number" id="editFC" value="${turno.parametrosVitales?.fc || ''}" required>
            </div>

            <div class="form-group">
                <label>FR (rpm)</label>
                <input type="number" id="editFR" value="${turno.parametrosVitales?.fr || ''}">
            </div>

            <div class="form-group">
                <label>Peso (kg)</label>
                <input type="number" id="editPeso" step="0.1" value="${turno.parametrosVitales?.peso || ''}">
            </div>

            <div class="form-group">
                <label>Estado Mental *</label>
                <select id="editEstadoMental" required>
                    <option value="alerta" ${turno.estadoGeneral?.estadoMental === 'alerta' ? 'selected' : ''}>Alerta</option>
                    <option value="tranquilo" ${turno.estadoGeneral?.estadoMental === 'tranquilo' ? 'selected' : ''}>Tranquilo</option>
                    <option value="deprimido" ${turno.estadoGeneral?.estadoMental === 'deprimido' ? 'selected' : ''}>Deprimido</option>
                    <option value="excitado" ${turno.estadoGeneral?.estadoMental === 'excitado' ? 'selected' : ''}>Excitado</option>
                    <option value="agresivo" ${turno.estadoGeneral?.estadoMental === 'agresivo' ? 'selected' : ''}>Agresivo</option>
                </select>
            </div>

            <div class="form-group">
                <label>Observaciones</label>
                <textarea id="editObservaciones" rows="3">${turno.observaciones || ''}</textarea>
            </div>

            <div class="form-group">
                <label>Razón de la edición *</label>
                <input type="text" id="razonEdicion" required placeholder="Ej: Corrección de error de transcripción">
            </div>

            <div style="text-align: right; margin-top: 20px;">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                    Cancelar
                </button>
                <button type="button" class="btn btn-primary" onclick="window.internamientoModule.guardarEdicionTurno('${turnoId}')" style="margin-left: 10px;">
                    <i class="fas fa-save"></i> Guardar Cambios
                </button>
            </div>
        </form>
    `;
};

InternamientoModule.prototype.guardarEdicionTurno = async function(turnoId) {
    const razonEdicion = document.getElementById('razonEdicion')?.value.trim();
    if (!razonEdicion) {
        this.showAlert('Debe proporcionar una razón para la edición', 'Campo Requerido', 'warning');
        return;
    }

    const userId = sessionStorage.getItem('userId');
    const userName = sessionStorage.getItem('userName');

    const updates = {};
    updates[`turnos/${turnoId}/parametrosVitales/temperatura`] = parseFloat(document.getElementById('editTemp')?.value) || null;
    updates[`turnos/${turnoId}/parametrosVitales/fc`] = parseInt(document.getElementById('editFC')?.value) || null;
    updates[`turnos/${turnoId}/parametrosVitales/fr`] = parseInt(document.getElementById('editFR')?.value) || null;
    updates[`turnos/${turnoId}/parametrosVitales/peso`] = parseFloat(document.getElementById('editPeso')?.value) || null;
    updates[`turnos/${turnoId}/estadoGeneral/estadoMental`] = document.getElementById('editEstadoMental')?.value || '';
    updates[`turnos/${turnoId}/observaciones`] = document.getElementById('editObservaciones')?.value.trim() || '';
    updates[`turnos/${turnoId}/editado`] = true;
    updates[`turnos/${turnoId}/editadoPor`] = userId;
    updates[`turnos/${turnoId}/editadoNombre`] = userName;
    updates[`turnos/${turnoId}/fechaEdicion`] = Date.now();
    updates[`turnos/${turnoId}/razonEdicion`] = razonEdicion;

    try {
        const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
        await internamientoRef.update(updates);

        // Auditoría
        await internamientoRef.child('auditoria/historialCambios').push({
            timestamp: Date.now(),
            userId: userId,
            usuarioNombre: userName,
            accion: 'editar_turno',
            detalles: {
                turnoId: turnoId,
                razon: razonEdicion
            }
        });

        this.showNotification('Turno actualizado exitosamente', 'success');
        document.querySelector('.modal-overlay')?.remove();
        
        // Recargar vista si está en evolución
        if (document.getElementById('internamiento-evolucion') && !document.getElementById('internamiento-evolucion').classList.contains('hidden')) {
            this.loadEvolucionView();
        }
    } catch (error) {
        console.error('Error editando turno:', error);
        this.showAlert('Error al editar turno: ' + error.message, 'Error', 'error');
    }
};

// ================================================================
// BOTÓN DE EDITAR EN TURNOS
// ================================================================

InternamientoModule.prototype.addEditarButtonToTurno = function(turnoId) {
    return `
        <button class="btn btn-sm" style="background: #17a2b8; color: white; margin-left: 8px;" 
                onclick="window.internamientoModule.editarTurno('${turnoId}')" title="Editar">
            <i class="fas fa-edit"></i>
        </button>
    `;
};

console.log('📦 Módulo de egreso y edición cargado');

