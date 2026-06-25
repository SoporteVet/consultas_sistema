// ====================================================================
// CONTROL DE MEDICACIÓN — VISTA TIPO HOJA (tabla por días y horarios)
// ====================================================================

InternamientoModule.prototype.setMedicacionVista = function(vista) {
    this._medicacionVista = vista === 'tarjetas' ? 'tarjetas' : 'tabla';
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (internamiento) this.renderMedicamentosList(internamiento);
};

InternamientoModule.prototype.getMedicacionVista = function() {
    return this._medicacionVista === 'tarjetas' ? 'tarjetas' : 'tabla';
};

InternamientoModule.prototype.getMedControlExtraDias = function() {
    const id = this.currentInternamientoId;
    if (!id) return { antes: 0, despues: 0 };
    if (!this._medControlExtraPorInternamiento) this._medControlExtraPorInternamiento = {};
    if (!this._medControlExtraPorInternamiento[id]) {
        this._medControlExtraPorInternamiento[id] = { antes: 0, despues: 0 };
    }
    return this._medControlExtraPorInternamiento[id];
};

InternamientoModule.prototype.agregarColumnaDiaAnteriorMedicacion = function() {
    const extra = this.getMedControlExtraDias();
    extra.antes = (extra.antes || 0) + 1;
    this.loadMedicacionView();
};

InternamientoModule.prototype.agregarColumnaDiaPosteriorMedicacion = function() {
    const extra = this.getMedControlExtraDias();
    extra.despues = (extra.despues || 0) + 1;
    this.loadMedicacionView();
};

InternamientoModule.prototype.quitarColumnaDiaAnteriorMedicacion = function() {
    const extra = this.getMedControlExtraDias();
    if ((extra.antes || 0) > 0) {
        extra.antes -= 1;
        this.loadMedicacionView();
    }
};

InternamientoModule.prototype.quitarColumnaDiaPosteriorMedicacion = function() {
    const extra = this.getMedControlExtraDias();
    if ((extra.despues || 0) > 0) {
        extra.despues -= 1;
        this.loadMedicacionView();
    }
};

InternamientoModule.prototype._obtenerRangoBaseControlMedicacion = function(internamiento) {
    const ingresoTs = internamiento.datosIngreso?.fechaIngreso
        || internamiento.metadata?.fechaCreacion
        || Date.now();
    const inicio = new Date(ingresoTs);
    inicio.setHours(0, 0, 0, 0);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return { inicio, hoy };
};

InternamientoModule.prototype._formatDiaKey = function(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

InternamientoModule.prototype.obtenerHorariosMedicamento = function(medicamento) {
    let horarios = (medicamento.horariosExactos && medicamento.horariosExactos.length > 0)
        ? medicamento.horariosExactos
        : (medicamento.horariosCalculados && medicamento.horariosCalculados.length > 0)
            ? medicamento.horariosCalculados
            : [];
    if (horarios.length === 0 && medicamento.frecuenciaHoras) {
        horarios = this.calcularHorarios(medicamento.frecuenciaHoras);
    }
    return horarios
        .map(h => {
            const m = String(h).trim().match(/^(\d{1,2}):(\d{2})$/);
            if (!m) return null;
            return `${String(parseInt(m[1], 10) % 24).padStart(2, '0')}:${String(parseInt(m[2], 10) % 60).padStart(2, '0')}`;
        })
        .filter(Boolean)
        .sort((a, b) => {
            const toMin = s => { const p = s.split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); };
            return toMin(a) - toMin(b);
        });
};

InternamientoModule.prototype.obtenerHorariosPorBloque = function(horarios) {
    const bloques = [
        { label: '12am-6am', min: 0, max: 5 },
        { label: '6am-12pm', min: 6, max: 11 },
        { label: '12pm-6pm', min: 12, max: 17 },
        { label: '6pm-12am', min: 18, max: 23 }
    ];
    return bloques.map(b => {
        const horas = horarios.filter(h => {
            const hr = parseInt(h.split(':')[0], 10);
            return hr >= b.min && hr <= b.max;
        });
        return { ...b, horas };
    });
};

InternamientoModule.prototype.obtenerDiasControlMedicacion = function(internamiento) {
    const { inicio, hoy } = this._obtenerRangoBaseControlMedicacion(internamiento);
    const extra = this.getMedControlExtraDias ? this.getMedControlExtraDias() : { antes: 0, despues: 0 };
    const extraAntes = extra.antes || 0;
    const extraDespues = extra.despues || 0;

    const cursorInicio = new Date(inicio);
    cursorInicio.setDate(cursorInicio.getDate() - extraAntes);
    const cursorFin = new Date(hoy);
    cursorFin.setDate(cursorFin.getDate() + extraDespues);

    const dias = [];
    const cursor = new Date(cursorInicio);
    while (cursor <= cursorFin) {
        const ts = cursor.getTime();
        let tipo = 'internamiento';
        if (ts < inicio.getTime()) tipo = 'anterior';
        else if (ts > hoy.getTime()) tipo = 'posterior';
        dias.push({
            key: this._formatDiaKey(cursor),
            dia: cursor.getDate(),
            mes: cursor.getMonth(),
            anio: cursor.getFullYear(),
            ts,
            tipo
        });
        cursor.setDate(cursor.getDate() + 1);
    }
    if (dias.length === 0) {
        dias.push({
            key: this._formatDiaKey(hoy),
            dia: hoy.getDate(),
            mes: hoy.getMonth(),
            anio: hoy.getFullYear(),
            ts: hoy.getTime(),
            tipo: 'internamiento'
        });
    }
    return dias;
};

InternamientoModule.prototype._slotAdminKey = function(diaKey, horaSlot) {
    return `${diaKey}_${horaSlot}`;
};

InternamientoModule.prototype._adminSlotId = function(diaKey, horaSlot) {
    return `slot_${diaKey.replace(/-/g, '')}_${horaSlot.replace(':', '')}`;
};

InternamientoModule.prototype._horaAMinutos = function(horaStr) {
    const m = String(horaStr || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return (parseInt(m[1], 10) % 24) * 60 + (parseInt(m[2], 10) % 60);
};

InternamientoModule.prototype._horarioMasCercano = function(horaStr, horarios) {
    const min = this._horaAMinutos(horaStr);
    if (min == null || !horarios.length) return horaStr;
    let mejor = horarios[0];
    let diffMin = Infinity;
    horarios.forEach(h => {
        const hm = this._horaAMinutos(h);
        if (hm == null) return;
        const diff = Math.abs(hm - min);
        if (diff < diffMin) { diffMin = diff; mejor = h; }
    });
    return mejor;
};

InternamientoModule.prototype.indexarAdministracionesPorSlot = function(medicamento) {
    const horarios = this.obtenerHorariosMedicamento(medicamento);
    const map = new Map();
    Object.entries(medicamento.administraciones || {}).forEach(([id, a]) => {
        if (a.slotDia && a.slotHora) {
            map.set(this._slotAdminKey(a.slotDia, a.slotHora), { id, ...a });
            return;
        }
        const ts = this._administracionToTs(a);
        if (!ts) return;
        const d = new Date(ts);
        const diaKey = this._formatDiaKey(d);
        const horaReal = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const slotHora = horarios.length ? this._horarioMasCercano(horaReal, horarios) : horaReal;
        const key = this._slotAdminKey(diaKey, slotHora);
        if (!map.has(key)) map.set(key, { id, ...a });
    });
    return map;
};

InternamientoModule.prototype.obtenerEstadoCeldaMedicacion = function(medicamento, diaKey, horaSlot) {
    const map = this.indexarAdministracionesPorSlot(medicamento);
    const admin = map.get(this._slotAdminKey(diaKey, horaSlot));
    if (!admin) return null;
    if (admin.estado === 'omitido' || admin.estado === 'no_administrado') return 'omitido';
    if (admin.estado === 'administrado') return 'administrado';
    return null;
};

InternamientoModule.prototype.obtenerAdminCeldaMedicacion = function(medicamento, diaKey, horaSlot) {
    return this.indexarAdministracionesPorSlot(medicamento).get(this._slotAdminKey(diaKey, horaSlot)) || null;
};

InternamientoModule.prototype.renderMedicacionViewToggle = function() {
    const vista = this.getMedicacionVista();
    return `
        <div class="med-vista-toggle">
            <button type="button" class="med-vista-btn ${vista === 'tabla' ? 'active' : ''}" onclick="window.internamientoModule.setMedicacionVista('tabla')">
                <i class="fas fa-table"></i> Control (tabla)
            </button>
            <button type="button" class="med-vista-btn ${vista === 'tarjetas' ? 'active' : ''}" onclick="window.internamientoModule.setMedicacionVista('tarjetas')">
                <i class="fas fa-th-large"></i> Tarjetas
            </button>
        </div>
    `;
};

InternamientoModule.prototype._hora24a12 = function(horaStr) {
    if (!horaStr) return horaStr;
    const m = String(horaStr).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) {
        const h24 = parseInt(horaStr, 10);
        if (!isNaN(h24)) {
            const ampm = h24 >= 12 ? ' PM' : ' AM';
            const h12 = h24 % 12 || 12;
            return `${h12}${ampm}`;
        }
        return horaStr;
    }
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm = h >= 12 ? ' PM' : ' AM';
    h = h % 12 || 12;
    return min === '00' ? `${h}${ampm}` : `${h}:${min}${ampm}`;
};

InternamientoModule.prototype.renderHorasMedicamentoHTML = function(horarios, medicamento) {
    if (!horarios.length) {
        if (medicamento?.dosisUnica) return '<span class="med-sin-horario">Dosis única</span>';
        if (medicamento?.frecuenciaHoras) return `<span class="med-sin-horario">c/${medicamento.frecuenciaHoras}h</span>`;
        return '<span class="med-sin-horario">Sin horario</span>';
    }

    // Si hay demasiadas horas (≥8), mostrar de forma compacta en lugar de la grilla completa
    if (horarios.length >= 8) {
        const frec = medicamento?.frecuenciaHoras;
        const texto = frec ? `c/${frec}h` : `${horarios.length}x/día`;
        const primera = this._hora24a12(horarios[0]);
        const ultima = this._hora24a12(horarios[horarios.length - 1]);
        return `
            <div style="font-size:0.82rem;color:#2e7d32;background:#e8f5e9;border-radius:6px;padding:6px 10px;text-align:center;">
                <div style="font-weight:700;font-size:0.95rem;">${texto}</div>
                <div style="font-size:0.75rem;opacity:0.8;">${primera} – ${ultima}</div>
            </div>`;
    }

    const bloques = this.obtenerHorariosPorBloque(horarios);
    return `
        <div class="med-horas-grid">
            ${bloques.map(b => `
                <div class="med-horas-bloque">
                    <span class="med-horas-bloque-label">${b.label}</span>
                    <span class="med-horas-bloque-valores">${b.horas.length ? b.horas.map(h => this._hora24a12(h)).join(', ') : '—'}</span>
                </div>
            `).join('')}
        </div>
    `;
};

InternamientoModule.prototype.renderEtiquetaEstadoAplicadoCE = function(admin) {
    const administrado = admin
        && admin.estado !== 'omitido'
        && admin.estado !== 'no_administrado';
    if (administrado) {
        return '<span class="med-estado-aplicado-vista"><i class="fas fa-check"></i> Aplicado</span>';
    }
    return '<span class="med-estado-pendiente-vista">pendiente</span>';
};

InternamientoModule.prototype.renderCeldaMedicacionHTML = function(medicamento, diaKey, horaSlot, admin, soloLectura = false) {
    const medId = (medicamento.medicamentoId || '').replace(/'/g, "\\'");
    const fueraProgramacion = false;
    if (fueraProgramacion) {
        soloLectura = true;
    }
    const estado = admin
        ? (admin.estado === 'omitido' || admin.estado === 'no_administrado' ? 'omitido' : 'administrado')
        : null;
    const titleParts = [`${medicamento.nombreComercial || 'Medicamento'}`, `Día ${diaKey.split('-')[2]}`, this._hora24a12(horaSlot)];
    if (admin?.observaciones) titleParts.push(admin.observaciones);
    if (admin?.administradoNombre) titleParts.push(`Por: ${admin.administradoNombre}`);
    if (admin?.fechaHoraReal) {
        const d = new Date(this._administracionToTs(admin));
        if (!isNaN(d.getTime())) titleParts.push(`Hora real: ${d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true })}`);
    }
    if (fueraProgramacion) titleParts.push('Fuera del periodo programado');
    const title = titleParts.join(' · ');
    let contenido = '';
    if (estado === 'administrado') {
        contenido = '<span class="med-celda-x">X</span>';
    } else if (estado === 'omitido') {
        contenido = '<span class="med-celda-omitido" aria-label="No administrado"></span>';
    } else {
        contenido = '<span class="med-celda-vacia">·</span>';
    }
    if (soloLectura) {
        return `
            <div class="med-celda-vista ${estado || 'pendiente'}${fueraProgramacion ? ' med-celda-fuera-programacion' : ''}" title="${title.replace(/"/g, '&quot;')}">
                ${fueraProgramacion ? '<span class="med-celda-na">—</span>' : contenido}
            </div>`;
    }
    return `
        <button type="button" class="med-celda-btn ${estado || 'pendiente'}"
            title="${title.replace(/"/g, '&quot;')}"
            onclick="window.internamientoModule.abrirModalCeldaMedicacion('${medId}', '${diaKey}', '${horaSlot}')">
            ${contenido}
        </button>
    `;
};

InternamientoModule.prototype.renderTablaControlMedicacion = function(internamiento, medicamentos) {
    const esc = (s) => (s == null ? '' : String(s)).replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const dias = this.obtenerDiasControlMedicacion(internamiento);
    const extra = this.getMedControlExtraDias();
    const viaCorto = { IV: 'IV', IM: 'IM', SC: 'SC', VO: 'PO', Topica: 'Tópica', Otra: 'Otra' };
    const mesesCortos = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const mostrarMesEnHeader = dias.length > 7 || new Set(dias.map(d => `${d.mes}-${d.anio}`)).size > 1;

    const filas = medicamentos.map(med => {
        const horarios = this.obtenerHorariosMedicamento(med);
        const celdasDias = dias.map(d => {
            if (!horarios.length) {
                return `<td class="med-dia-celda med-dia-sin-horario med-dia-${d.tipo || 'internamiento'}" colspan="1"><span class="med-sin-horario">—</span></td>`;
            }
            const slots = horarios.map(h => {
                const admin = this.obtenerAdminCeldaMedicacion(med, d.key, h);
                const esConsultaExt = !!med.puestoPorConsultaExterna;
                const etiquetaCE = esConsultaExt ? this.renderEtiquetaEstadoAplicadoCE(admin) : '';
                // soloLectura siempre false: todas las celdas son clickeables
                return `<div class="med-slot-wrap">${etiquetaCE}<span class="med-slot-hora">${this._hora24a12(h)}</span>${this.renderCeldaMedicacionHTML(med, d.key, h, admin, false)}</div>`;
            }).join('');
            return `<td class="med-dia-celda med-dia-${d.tipo || 'internamiento'}"><div class="med-dia-slots">${slots}</div></td>`;
        }).join('');

        return `
            <tr class="med-control-row">
                <td class="med-col-fija med-col-med">
                    <strong>${esc(med.nombreComercial || 'Sin nombre')}</strong>
                    ${this.renderChipOrigenItem(med)}
                    ${(() => {
                        const prog = typeof this.formatProgramacionMedicamento === 'function' ? this.formatProgramacionMedicamento(med) : '';
                        return prog ? `<div class="med-row-prog"><i class="fas fa-calendar-alt"></i> ${esc(prog)}</div>` : '';
                    })()}
                    ${med.observaciones ? `<div class="med-row-obs"><i class="fas fa-comment"></i> ${esc(med.observaciones)}</div>` : ''}
                </td>
                <td class="med-col-fija med-col-dosis">${esc(this.formatDosisUnidad(med))}</td>
                <td class="med-col-fija med-col-via">${esc(viaCorto[med.viaAdministracion] || med.viaAdministracion || '—')}</td>
                <td class="med-col-fija med-col-horas">${this.renderHorasMedicamentoHTML(horarios, med)}</td>
                ${celdasDias}
            </tr>
        `;
    }).join('');

    const headerDias = dias.map(d => {
        const mesLabel = mostrarMesEnHeader ? ` ${mesesCortos[d.mes]}` : '';
        const tipoLabel = d.tipo === 'anterior' ? ' · ant.' : (d.tipo === 'posterior' ? ' · sig.' : '');
        return `<th class="med-dia-header med-dia-header-${d.tipo || 'internamiento'}" title="${d.tipo === 'anterior' ? 'Día anterior al internamiento' : (d.tipo === 'posterior' ? 'Día posterior a hoy' : 'Día de internamiento')}">DÍA: ${d.dia}${mesLabel}${tipoLabel}</th>`;
    }).join('');

    const primerDia = dias[0];
    const ultimoDia = dias[dias.length - 1];
    const rangoTexto = primerDia && ultimoDia
        ? `${primerDia.dia} ${mesesCortos[primerDia.mes]} – ${ultimoDia.dia} ${mesesCortos[ultimoDia.mes]} (${dias.length} días)`
        : '';

    return `
        <div class="med-control-wrapper">
            <div class="med-control-dias-toolbar">
                <div class="med-control-dias-toolbar-grupo">
                    <button type="button" class="btn btn-sm btn-secondary med-control-dia-btn" onclick="window.internamientoModule.agregarColumnaDiaAnteriorMedicacion()" title="Agregar una columna con el día anterior">
                        <i class="fas fa-chevron-left"></i> Día anterior
                    </button>
                    ${extra.antes > 0 ? `
                    <button type="button" class="btn btn-sm med-control-dia-btn-quitar" onclick="window.internamientoModule.quitarColumnaDiaAnteriorMedicacion()" title="Quitar la columna más antigua">
                        <i class="fas fa-minus"></i>
                    </button>` : ''}
                </div>
                <span class="med-control-rango">${rangoTexto}</span>
                <div class="med-control-dias-toolbar-grupo">
                    ${extra.despues > 0 ? `
                    <button type="button" class="btn btn-sm med-control-dia-btn-quitar" onclick="window.internamientoModule.quitarColumnaDiaPosteriorMedicacion()" title="Quitar la columna más futura">
                        <i class="fas fa-minus"></i>
                    </button>` : ''}
                    <button type="button" class="btn btn-sm btn-secondary med-control-dia-btn" onclick="window.internamientoModule.agregarColumnaDiaPosteriorMedicacion()" title="Agregar una columna con el día siguiente">
                        Día posterior <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
            <div class="med-control-leyenda">
                <span><span class="med-celda-x med-leyenda-icon">X</span> Administrado</span>
                <span><span class="med-celda-omitido med-leyenda-icon"></span> No administrado</span>
                <span><span class="med-celda-vacia med-leyenda-icon">·</span> Pendiente — clic para registrar</span>
            </div>
            <div class="med-control-scroll">
                <table class="med-control-table">
                    <thead>
                        <tr>
                            <th class="med-col-fija med-col-med">MEDICAMENTO</th>
                            <th class="med-col-fija med-col-dosis">DOSIS</th>
                            <th class="med-col-fija med-col-via">VÍA ADM</th>
                            <th class="med-col-fija med-col-horas">HORAS</th>
                            ${headerDias}
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </div>
    `;
};

InternamientoModule.prototype.abrirModalCeldaMedicacion = function(medicamentoId, diaKey, horaSlot) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;
    if (['alta', 'egresado'].includes(internamiento.estado?.actual)) {
        this.showAlert('No se puede modificar medicación: el paciente está en alta o egresado.', 'Acción bloqueada', 'warning');
        return;
    }
    const med = internamiento.planTerapeutico?.medicamentos?.[medicamentoId];
    if (!med) return;

    const admin = this.obtenerAdminCeldaMedicacion(med, diaKey, horaSlot);
    const estadoActual = admin
        ? (admin.estado === 'omitido' || admin.estado === 'no_administrado' ? 'omitido' : 'administrado')
        : 'pendiente';
    const obsActual = admin?.observaciones || '';
    let horaRealDefault = horaSlot;
    if (admin?.fechaHoraReal) {
        const d = new Date(this._administracionToTs(admin));
        if (!isNaN(d.getTime())) {
            horaRealDefault = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
    }
    const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const diaNum = diaKey.split('-')[2];

    const html = `
        <form id="formCeldaMedicacion">
            <div style="margin-bottom: 14px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                <strong>${esc(med.nombreComercial)}</strong>
                <div style="font-size: 0.9rem; color: #666; margin-top: 4px;">
                    Día ${diaNum} · Horario ${this._hora24a12(horaSlot)} · ${this.formatDosisUnidad(med)}
                </div>
            </div>
            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-weight: 600; display: block; margin-bottom: 8px;">Estado *</label>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="celdaEstado" value="administrado" ${estadoActual === 'administrado' ? 'checked' : ''}>
                        <span class="med-celda-x" style="width:20px;height:20px;font-size:0.75rem;">X</span> Administrado
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="celdaEstado" value="omitido" ${estadoActual === 'omitido' ? 'checked' : ''}>
                        <span class="med-celda-omitido" style="width:20px;height:20px;"></span> No administrado
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="celdaEstado" value="pendiente" ${estadoActual === 'pendiente' ? 'checked' : ''}>
                        <span class="med-celda-vacia">·</span> Pendiente (sin registro)
                    </label>
                </div>
            </div>
            <div class="form-group" style="margin-bottom: 14px;">
                <label for="celdaHoraReal" style="font-weight: 600;">Hora de aplicación</label>
                <input type="time" id="celdaHoraReal" value="${horaRealDefault}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
                <small style="color: #64748b;">Hora en que se aplicó o debía aplicarse la dosis.</small>
            </div>
            <div class="form-group" style="margin-bottom: 14px;">
                <label for="celdaObservaciones" style="font-weight: 600;">Observaciones</label>
                <textarea id="celdaObservaciones" rows="3" placeholder="Notas sobre esta dosis..." style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; resize: vertical;">${esc(obsActual)}</textarea>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Guardar</button>
            </div>
        </form>
    `;

    const modal = this.createModal('Registro de dosis', html, 'fa-pills');
    document.body.appendChild(modal);

    const form = document.getElementById('formCeldaMedicacion');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const estado = form.querySelector('input[name="celdaEstado"]:checked')?.value || 'pendiente';
            const horaReal = document.getElementById('celdaHoraReal')?.value || horaSlot;
            const observaciones = document.getElementById('celdaObservaciones')?.value?.trim() || '';
            await this.guardarCeldaMedicacion(medicamentoId, diaKey, horaSlot, estado, horaReal, observaciones);
        });
    }
};

InternamientoModule.prototype.guardarCeldaMedicacion = async function(medicamentoId, diaKey, horaSlot, estado, horaReal, observaciones) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    const med = internamiento?.planTerapeutico?.medicamentos?.[medicamentoId];
    if (!internamiento || !med) return;

    const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);

    try {
        let codigoData = null;
        if (estado === 'administrado' && typeof this.verificarCodigoAsistente === 'function') {
            codigoData = await this.verificarCodigoAsistente('medicacion');
            if (!codigoData || !codigoData.valido || codigoData.cancelado) {
                this.showNotification('Registro cancelado', 'info');
                return;
            }
        }

        await this._persistirCeldaMedicacion(medicamentoId, diaKey, horaSlot, estado, horaReal, observaciones, codigoData);
        await internamientoRef.child('metadata/fechaUltimaActualizacion').set(Date.now());
        document.querySelector('.modal-overlay')?.remove();
        this.showNotification('Registro guardado', 'success');
        this.loadMedicacionView();
    } catch (err) {
        console.error('Error guardando celda medicación:', err);
        this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
    }
};

InternamientoModule.prototype.marcarMedicamentoAplicadoDia = async function(medicamentoId, diaKey) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;
    if (['alta', 'egresado'].includes(internamiento.estado?.actual)) {
        this.showAlert('No se puede modificar medicación: el paciente está en alta o egresado.', 'Acción bloqueada', 'warning');
        return;
    }
    const med = internamiento.planTerapeutico?.medicamentos?.[medicamentoId];
    if (!med) return;

    const horarios = this.obtenerHorariosMedicamento(med);
    if (!horarios.length) {
        this.showAlert('Este medicamento no tiene horarios definidos.', 'Sin horarios', 'warning');
        return;
    }

    const pendientes = horarios.filter(h => this.obtenerEstadoCeldaMedicacion(med, diaKey, h) !== 'administrado');
    if (pendientes.length === 0) {
        this.showNotification('Todas las dosis de este día ya están registradas', 'info');
        return;
    }

    const diaNum = diaKey.split('-')[2];
    const confirmar = await this.showConfirm(
        `¿Registrar como aplicado el medicamento "${med.nombreComercial || 'Sin nombre'}" para el día ${diaNum}?\n\nSe marcarán ${pendientes.length} dosis pendiente(s).`,
        'Confirmar aplicación del día',
        { confirmText: 'Marcar aplicado', cancelText: 'Cancelar', icon: 'fa-check', iconColor: '#27ae60' }
    );
    if (!confirmar) return;

    let codigoData = null;
    if (typeof this.verificarCodigoAsistente === 'function') {
        codigoData = await this.verificarCodigoAsistente('medicacion');
        if (!codigoData || !codigoData.valido || codigoData.cancelado) {
            this.showNotification('Registro cancelado', 'info');
            return;
        }
    }

    try {
        for (const horaSlot of pendientes) {
            await this._persistirCeldaMedicacion(medicamentoId, diaKey, horaSlot, 'administrado', horaSlot, '', codigoData);
        }
        await this.internamientosRef.child(this.currentInternamientoId).child('metadata/fechaUltimaActualizacion').set(Date.now());
        this.showNotification('Medicamento registrado como aplicado en el día', 'success');
        this.loadMedicacionView();
    } catch (err) {
        console.error('Error marcando aplicación del día:', err);
        this.showAlert('Error al registrar: ' + (err.message || err), 'Error', 'error');
    }
};

InternamientoModule.prototype._persistirCeldaMedicacion = async function(medicamentoId, diaKey, horaSlot, estado, horaReal, observaciones, codigoData) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    const med = internamiento?.planTerapeutico?.medicamentos?.[medicamentoId];
    if (!internamiento || !med) return;

    const adminId = this._adminSlotId(diaKey, horaSlot);
    const refPath = `planTerapeutico/medicamentos/${medicamentoId}/administraciones/${adminId}`;
    const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);

    if (estado === 'pendiente') {
        await internamientoRef.child(refPath).remove();
        if (med.administraciones) delete med.administraciones[adminId];
        return;
    }

    const [y, mo, d] = diaKey.split('-').map(Number);
    const [hh, mm] = (horaReal || horaSlot).split(':').map(Number);
    const fechaHoraReal = new Date(y, mo - 1, d, hh, mm, 0, 0).getTime();
    const [ph, pm] = horaSlot.split(':').map(Number);
    const fechaHoraProgramada = new Date(y, mo - 1, d, ph, pm, 0, 0).getTime();

    const userId = sessionStorage.getItem('userId') || '';
    const userName = sessionStorage.getItem('userName') || '';

    const administracionData = {
        fechaHoraProgramada,
        fechaHoraReal,
        estado: estado === 'omitido' ? 'omitido' : 'administrado',
        administradoPor: codigoData?.assistantId || userId,
        administradoNombre: codigoData?.nombre || userName,
        observaciones,
        slotDia: diaKey,
        slotHora: horaSlot,
        codigoVerificado: estado === 'administrado' && !!codigoData?.valido,
        codigoAsistente: codigoData?.codigo ? '****' + codigoData.codigo.slice(-2) : null
    };

    await internamientoRef.child(refPath).set(administracionData);
    if (!med.administraciones) med.administraciones = {};
    const eraAdministrado = med.administraciones[adminId]?.estado === 'administrado';
    med.administraciones[adminId] = administracionData;

    if (estado === 'administrado' && !eraAdministrado) {
        await internamientoRef.child('estadisticas/totalMedicaciones').transaction(current => (current || 0) + 1);
    }
};
