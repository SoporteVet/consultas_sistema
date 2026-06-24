// ====================================================================
// VISITAS: salida programada (tipo de alta) + edición | MEDICACIÓN: suspensión por días
// ====================================================================

InternamientoModule.prototype._fechaLocalYmd = function(date) {
    const d = date instanceof Date ? date : new Date(date || Date.now());
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// --- Medicación suspendida por rango de fechas ---

InternamientoModule.prototype.estaMedicamentoSuspendido = function(medicamento, fechaYmd) {
    if (!medicamento || medicamento.estadoMedicamento !== 'suspendido') return false;
    const hoy = fechaYmd || this._fechaLocalYmd();
    const desde = medicamento.suspensionDesde || null;
    const hasta = medicamento.suspensionHasta || null;
    if (desde && hoy < desde) return false;
    if (hasta && hoy > hasta) return false;
    return true;
};

InternamientoModule.prototype.esMedicamentoVisibleParaAdmin = function(medicamento) {
    if (!medicamento) return false;
    if (medicamento.estadoMedicamento === 'activo') return true;
    if (medicamento.estadoMedicamento === 'suspendido') {
        return !this.estaMedicamentoSuspendido(medicamento);
    }
    return false;
};

InternamientoModule.prototype.verificarSuspensionesVencidas = async function(internamientoId) {
    if (!internamientoId || !this.internamientosRef) return;
    const internamiento = this.internamientos.get(internamientoId);
    if (!internamiento) return;

    const hoy = this._fechaLocalYmd();
    const meds = internamiento.planTerapeutico?.medicamentos || {};
    const updates = {};
    let cambios = 0;

    Object.entries(meds).forEach(([medId, med]) => {
        if (med.estadoMedicamento !== 'suspendido') return;
        if (!med.suspensionHasta || hoy <= med.suspensionHasta) return;
        updates[`planTerapeutico/medicamentos/${medId}/estadoMedicamento`] = 'activo';
        updates[`planTerapeutico/medicamentos/${medId}/fechaReactivacionAutomatica`] = Date.now();
        cambios++;
    });

    if (!cambios) return;

    updates['metadata/fechaUltimaActualizacion'] = Date.now();
    await this.internamientosRef.child(internamientoId).update(updates);

    Object.entries(meds).forEach(([medId, med]) => {
        if (updates[`planTerapeutico/medicamentos/${medId}/estadoMedicamento`] === 'activo') {
            med.estadoMedicamento = 'activo';
            med.fechaReactivacionAutomatica = Date.now();
        }
    });
};

InternamientoModule.prototype.showModalSuspenderMedicamento = async function(medicamentoId) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    const medicamento = internamiento?.planTerapeutico?.medicamentos?.[medicamentoId];
    if (!internamiento || !medicamento) {
        this.showAlert('Medicamento no encontrado', 'Error', 'error');
        return;
    }

    const hoy = this._fechaLocalYmd();
    const esc = (s) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const nombreMed = esc(medicamento.nombreComercial || 'Medicamento');

    const html = `
        <form id="formSuspenderMedicamento" style="padding: 8px;">
            <p style="margin: 0 0 16px 0; color: #555;">Suspender <strong>${nombreMed}</strong> por un rango de días. No aparecerá en administración mientras esté suspendido.</p>
            <div class="form-group" style="margin-bottom: 14px;">
                <label>Motivo de suspensión *</label>
                <textarea id="suspMedMotivo" rows="2" required placeholder="Indique el motivo..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;"></textarea>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                <div class="form-group">
                    <label>Desde *</label>
                    <input type="date" id="suspMedDesde" required value="${hoy}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
                </div>
                <div class="form-group">
                    <label>Hasta *</label>
                    <input type="date" id="suspMedHasta" required value="${hoy}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
                </div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button type="submit" class="btn btn-warning" style="background:#f59e0b;border-color:#f59e0b;color:#fff;"><i class="fas fa-pause-circle"></i> Suspender</button>
            </div>
        </form>`;

    const modal = this.createModal('Suspender medicamento por días', html, 'fa-pause-circle');
    document.body.appendChild(modal);

    document.getElementById('formSuspenderMedicamento').onsubmit = async (e) => {
        e.preventDefault();
        const motivo = document.getElementById('suspMedMotivo')?.value?.trim() || '';
        const desde = document.getElementById('suspMedDesde')?.value?.trim() || '';
        const hasta = document.getElementById('suspMedHasta')?.value?.trim() || '';

        if (!motivo) {
            this.showNotification('Debe indicar el motivo de suspensión', 'warning');
            return;
        }
        if (!desde || !hasta) {
            this.showNotification('Indique las fechas de suspensión', 'warning');
            return;
        }
        if (hasta < desde) {
            this.showNotification('La fecha "Hasta" no puede ser anterior a "Desde"', 'warning');
            return;
        }

        const resultadoCodigo = await this.verificarCodigoAsistente('suspender_medicamento');
        if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.showNotification('Suspensión cancelada', 'info');
            return;
        }

        const confirmar = await this.showConfirm(
            `¿Suspender "${medicamento.nombreComercial || 'este medicamento'}" del ${desde} al ${hasta}?\n\nMotivo: ${motivo}\nPor: ${resultadoCodigo.nombre}`,
            'Confirmar suspensión',
            { confirmText: 'Suspender', cancelText: 'Cancelar', icon: 'fa-pause-circle', iconColor: '#f39c12' }
        );
        if (!confirmar) return;

        try {
            const updates = {};
            updates[`planTerapeutico/medicamentos/${medicamentoId}/estadoMedicamento`] = 'suspendido';
            updates[`planTerapeutico/medicamentos/${medicamentoId}/motivoSuspension`] = motivo;
            updates[`planTerapeutico/medicamentos/${medicamentoId}/suspensionDesde`] = desde;
            updates[`planTerapeutico/medicamentos/${medicamentoId}/suspensionHasta`] = hasta;
            updates[`planTerapeutico/medicamentos/${medicamentoId}/fechaFin`] = Date.now();
            updates[`planTerapeutico/medicamentos/${medicamentoId}/suspendidoPor`] = resultadoCodigo.assistantId || null;
            updates[`planTerapeutico/medicamentos/${medicamentoId}/suspendidoNombre`] = resultadoCodigo.nombre;
            updates[`planTerapeutico/medicamentos/${medicamentoId}/suspendidoCodigoVerificado`] = true;
            updates['metadata/fechaUltimaActualizacion'] = Date.now();

            const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
            await internamientoRef.update(updates);

            Object.assign(medicamento, {
                estadoMedicamento: 'suspendido',
                motivoSuspension: motivo,
                suspensionDesde: desde,
                suspensionHasta: hasta,
                suspendidoNombre: resultadoCodigo.nombre
            });

            modal.remove();
            this.showNotification(`Medicamento suspendido hasta ${hasta} — ${resultadoCodigo.nombre}`, 'success');
            this.loadMedicacionView();
        } catch (error) {
            this.showAlert('Error al suspender: ' + error.message, 'Error', 'error');
        }
    };
};

// --- Visitas: salida programada (tipo de alta) + edición ---

InternamientoModule.TIPOS_SALIDA_VISITA = [
    { value: '', label: 'Ninguna (solo visita)' },
    { value: 'carta_liberacion', label: 'Carta de liberación' },
    { value: 'carta_condicionada_24h', label: 'Carta condicionada 24h' },
    { value: 'carta_condicionada_48h', label: 'Carta condicionada 48h' },
    { value: 'salida', label: 'Salida' }
];

InternamientoModule.prototype.getTipoSalidaVisitaLabel = function(tipo) {
    const found = InternamientoModule.TIPOS_SALIDA_VISITA.find(t => t.value === tipo);
    return found ? found.label : (tipo || '');
};

InternamientoModule.prototype.resolveTipoSalidaVisita = function(visitaOrDatos) {
    if (!visitaOrDatos) return '';
    if (visitaOrDatos.tipoSalida) return visitaOrDatos.tipoSalida;
    if (visitaOrDatos.tieneSalida && visitaOrDatos.razonSalida) {
        const r = String(visitaOrDatos.razonSalida).toLowerCase();
        if (r.includes('liberación') || r.includes('liberacion')) return 'carta_liberacion';
        if (r.includes('24')) return 'carta_condicionada_24h';
        if (r.includes('48')) return 'carta_condicionada_48h';
        return 'salida';
    }
    return visitaOrDatos.tieneSalida ? 'salida' : '';
};

InternamientoModule.prototype._getVisitaSalidaFieldsHTML = function(datos) {
    const esc = (s) => this._escapeVisitaHtml(s);
    const tipoActual = this.resolveTipoSalidaVisita(datos);
    const opciones = InternamientoModule.TIPOS_SALIDA_VISITA.map(t =>
        `<option value="${esc(t.value)}" ${tipoActual === t.value ? 'selected' : ''}>${esc(t.label)}</option>`
    ).join('');
    return `
        <div class="form-group" style="margin-bottom: 16px;">
            <label>Salida programada / tipo de alta</label>
            <select id="visitaTipoSalida" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                ${opciones}
            </select>
            <small style="color: #64748b; display: block; margin-top: 6px;">
                Indique si la visita es para agendar el dado de alta del paciente.
            </small>
        </div>`;
};

InternamientoModule.prototype._bindVisitaSalidaToggle = function() {
    /* Ya no aplica: el tipo de salida es un solo selector */
};

InternamientoModule.prototype._collectVisitaFormData = function(modal) {
    const nombrePaciente = modal.querySelector('#visitaNombrePaciente')?.value?.trim() || '';
    let internamientoId = modal.querySelector('#visitaPacienteId')?.value?.trim() || '';
    if (!internamientoId) {
        internamientoId = this.buscarInternamientoIdPorNombreMascota(nombrePaciente);
    }
    const tipoSalida = modal.querySelector('#visitaTipoSalida')?.value?.trim() || '';
    const fechaVisita = modal.querySelector('#visitaFecha')?.value?.trim() || '';
    const horaVisita = modal.querySelector('#visitaHora')?.value?.trim() || '';

    return {
        internamientoId: internamientoId || null,
        nombrePaciente,
        nombreVisitante: modal.querySelector('#visitaNombrePersona')?.value?.trim() || '',
        parentesco: modal.querySelector('#visitaParentesco')?.value?.trim() || '',
        motivo: modal.querySelector('#visitaMotivo')?.value?.trim() || '',
        tipoSalida,
        tieneSalida: !!tipoSalida,
        razonSalida: tipoSalida ? this.getTipoSalidaVisitaLabel(tipoSalida) : '',
        fechaVisita,
        horaVisita
    };
};

InternamientoModule.prototype._validarVisitaFormData = function(datos) {
    if (!datos.nombrePaciente) {
        this.showAlert('Escriba el nombre del paciente (mascota).', 'Campo requerido', 'warning');
        return false;
    }
    if (!datos.nombreVisitante) {
        this.showAlert('Indique el nombre de la persona que visita.', 'Campo requerido', 'warning');
        return false;
    }
    if (!datos.parentesco) {
        this.showAlert('Indique el parentesco con el paciente.', 'Campo requerido', 'warning');
        return false;
    }
    if (!datos.motivo) {
        this.showAlert('Seleccione el motivo de la visita.', 'Campo requerido', 'warning');
        return false;
    }
    if (!datos.fechaVisita || !datos.horaVisita) {
        this.showAlert('Indique la fecha y hora de la visita.', 'Campo requerido', 'warning');
        return false;
    }
    const [anio, mes, dia] = datos.fechaVisita.split('-').map(Number);
    const [horas, minutos] = datos.horaVisita.split(':').map(Number);
    const fechaHoraVisita = new Date(anio, mes - 1, dia, horas, minutos, 0, 0);
    if (isNaN(fechaHoraVisita.getTime())) {
        this.showAlert('La fecha u hora de la visita no es válida.', 'Campo requerido', 'warning');
        return false;
    }
    datos.fechaHoraMs = fechaHoraVisita.getTime();
    return true;
};

InternamientoModule.prototype.showModalEditarVisita = function(internamientoId, visitaId) {
    const int = this.internamientos.get(internamientoId);
    const visita = int?.visitas?.[visitaId];
    if (!visita) {
        this.showAlert('Visita no encontrada', 'Error', 'error');
        return;
    }

    const lista = this.getPacientesParaVisitas();
    const esc = (s) => this._escapeVisitaHtml(s);
    const fechaObj = visita.fechaHora ? new Date(visita.fechaHora) : new Date(visita.timestamp || Date.now());
    const fechaVal = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}-${String(fechaObj.getDate()).padStart(2, '0')}`;
    const horaVal = `${String(fechaObj.getHours()).padStart(2, '0')}:${String(fechaObj.getMinutes()).padStart(2, '0')}`;

    const opcionesDatalist = lista.map(item => {
        const nombreMascota = item.referencias?.nombreMascota || '';
        if (!nombreMascota) return '';
        const propietario = this.getNombrePropietario(item) || '';
        const label = propietario ? `${nombreMascota} — ${propietario}` : nombreMascota;
        return `<option value="${esc(nombreMascota)}">${esc(label)}</option>`;
    }).join('');

    const contenido = `
        <div style="max-height: 70vh; overflow-y: auto; padding: 8px;">
            <form id="formEditarVisita">
                <input type="hidden" id="visitaEditInternamientoId" value="${esc(internamientoId)}">
                <input type="hidden" id="visitaEditVisitaId" value="${esc(visitaId)}">
                <div class="form-group visita-paciente-form-group" style="margin-bottom: 16px;">
                    <label>Nombre del paciente (mascota) *</label>
                    <input type="hidden" id="visitaPacienteId" value="${esc(internamientoId !== '_visitas_sin_vincular' ? internamientoId : '')}">
                    <input type="text" id="visitaNombrePaciente" required list="visitaPacientesDatalist"
                        value="${esc(visita.nombrePaciente || visita.nombreMascota || '')}"
                        style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                    <datalist id="visitaPacientesDatalist">${opcionesDatalist}</datalist>
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label>Nombre del visitante *</label>
                    <input type="text" id="visitaNombrePersona" required value="${esc(visita.nombreVisitante)}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label>Parentesco *</label>
                    <select id="visitaParentesco" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                        <option value="">Seleccione</option>
                        <option value="Propietario" ${visita.parentesco === 'Propietario' ? 'selected' : ''}>Propietario</option>
                        <option value="Familiar" ${visita.parentesco === 'Familiar' ? 'selected' : ''}>Familiar</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label>Motivo *</label>
                    <select id="visitaMotivo" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                        <option value="">Seleccione</option>
                        <option value="Paciente Activo" ${visita.motivo === 'Paciente Activo' ? 'selected' : ''}>Paciente Activo</option>
                        <option value="Visita de Emergencia (Paciente Crítico)" ${visita.motivo === 'Visita de Emergencia (Paciente Crítico)' ? 'selected' : ''}>Visita de Emergencia (Paciente Crítico)</option>
                        <option value="Fallecimiento" ${visita.motivo === 'Fallecimiento' ? 'selected' : ''}>Fallecimiento</option>
                        <option value="Recolección de cuerpo" ${visita.motivo === 'Recolección de cuerpo' ? 'selected' : ''}>Recolección de cuerpo</option>
                    </select>
                </div>
                ${this._getVisitaSalidaFieldsHTML(visita)}
                <div class="form-group" style="margin-bottom: 16px;">
                    <label>Fecha y hora de la visita *</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <input type="date" id="visitaFecha" required value="${fechaVal}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                        <input type="time" id="visitaHora" required value="${horaVal}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Guardar cambios</button>
                </div>
            </form>
        </div>`;

    const modal = this.createModal('Editar visita', contenido, 'fa-edit');
    document.body.appendChild(modal);
    this.initVisitaNombrePacienteInput(modal, lista);
    this._bindVisitaSalidaToggle(modal);

    document.getElementById('formEditarVisita').addEventListener('submit', async (e) => {
        e.preventDefault();
        const datos = this._collectVisitaFormData(modal);
        if (!this._validarVisitaFormData(datos)) return;
        await this.actualizarVisita(internamientoId, visitaId, datos);
    });
};

InternamientoModule.prototype.actualizarVisita = async function(internamientoIdOriginal, visitaId, datos) {
    const nuevoInternamientoId = datos.internamientoId || '_visitas_sin_vincular';
    const payload = {
        nombrePaciente: datos.nombrePaciente || '',
        nombreVisitante: datos.nombreVisitante || '',
        parentesco: datos.parentesco || '',
        motivo: datos.motivo || '',
        tipoSalida: datos.tipoSalida || '',
        tieneSalida: !!datos.tipoSalida,
        razonSalida: datos.tipoSalida ? this.getTipoSalidaVisitaLabel(datos.tipoSalida) : '',
        fechaHora: new Date(datos.fechaHoraMs).toISOString(),
        timestamp: datos.fechaHoraMs,
        editadoEn: Date.now(),
        editadoNombre: sessionStorage.getItem('userName') || ''
    };

    try {
        if (nuevoInternamientoId !== internamientoIdOriginal) {
            const refOrigen = this.internamientosRef.child(internamientoIdOriginal).child('visitas').child(visitaId);
            const snap = await refOrigen.once('value');
            const existente = snap.val() || {};
            await refOrigen.remove();
            const intOrigen = this.internamientos.get(internamientoIdOriginal);
            if (intOrigen?.visitas) delete intOrigen.visitas[visitaId];

            const nuevaVisita = { ...existente, ...payload, visitaId };
            await this.internamientosRef.child(nuevoInternamientoId).child('visitas').child(visitaId).set(nuevaVisita);
            let intDest = this.internamientos.get(nuevoInternamientoId);
            if (!intDest) {
                intDest = { visitas: {} };
                this.internamientos.set(nuevoInternamientoId, intDest);
            }
            intDest.visitas = intDest.visitas || {};
            intDest.visitas[visitaId] = nuevaVisita;
        } else {
            await this.internamientosRef.child(internamientoIdOriginal).child('visitas').child(visitaId).update(payload);
            const int = this.internamientos.get(internamientoIdOriginal);
            if (int?.visitas?.[visitaId]) {
                Object.assign(int.visitas[visitaId], payload);
            }
        }

        if (nuevoInternamientoId !== '_visitas_sin_vincular') {
            await this.internamientosRef.child(nuevoInternamientoId).child('metadata/fechaUltimaActualizacion').set(Date.now());
        }

        document.querySelector('.modal-overlay')?.remove();
        this.showNotification('Visita actualizada correctamente', 'success');
        if (this.visitasListMode) this.refreshVisitasIfVisible();
    } catch (err) {
        this.showAlert('Error al actualizar visita: ' + (err.message || err), 'Error', 'error');
    }
};
