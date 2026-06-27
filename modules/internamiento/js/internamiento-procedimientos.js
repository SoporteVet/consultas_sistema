// ====================================================================
// MÓDULO DE INTERNAMIENTO - GESTIÓN DE PROCEDIMIENTOS Y TAREAS
// ====================================================================

// ================================================================
// VISTA DE PROCEDIMIENTOS
// ================================================================

InternamientoModule.prototype.isPendientesAgregarBloqueado = function(internamiento) {
    const estado = internamiento?.estado?.actual;
    return ['egresado', 'defuncion', 'alta'].includes(estado);
};

InternamientoModule.prototype.getPendientesAgregarBloqueado = function() {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    return internamiento ? this.isPendientesAgregarBloqueado(internamiento) : false;
};

InternamientoModule.prototype.getMensajePendientesSoloLectura = function(internamiento) {
    const estado = internamiento?.estado?.actual;
    if (estado === 'defuncion') {
        return 'El paciente falleció: no se pueden agregar pendientes, pero sí puede marcar los existentes como completados.';
    }
    if (estado === 'egresado') {
        return 'El internamiento está egresado: no se pueden agregar pendientes, pero sí puede marcar los existentes como completados.';
    }
    if (estado === 'alta') {
        return 'El paciente tiene alta médica: no se pueden agregar pendientes, pero sí puede marcar los existentes como completados.';
    }
    return 'No se pueden agregar pendientes en este estado.';
};

// ================================================================
// RECORDATORIOS DE PENDIENTES (día + hora)
// ================================================================

InternamientoModule.prototype.getHtmlCampoRecordatorioPendiente = function(valores = {}, idPrefix = 'proc') {
    const activo = !!(valores.recordatorioActivo && valores.recordatorioFecha);
    const fecha = valores.recordatorioFecha || '';
    const hora = valores.recordatorioHora || '';
    return `
        <div class="form-group pendiente-recordatorio-grupo">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;">
                <input type="checkbox" id="${idPrefix}RecordatorioActivo" ${activo ? 'checked' : ''}
                    onchange="window.internamientoModule._toggleCamposRecordatorioPendiente('${idPrefix}')">
                <i class="fas fa-bell" style="color:#e65100;"></i> Programar recordatorio
            </label>
            <div id="${idPrefix}RecordatorioCampos" style="display:${activo ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
                <div>
                    <label style="font-size:0.85rem;font-weight:600;">Día</label>
                    <input type="date" id="${idPrefix}RecordatorioFecha" value="${fecha}"
                        style="width:100%;padding:10px;border-radius:6px;border:1px solid #cbd5e1;">
                </div>
                <div>
                    <label style="font-size:0.85rem;font-weight:600;">Hora</label>
                    <input type="time" id="${idPrefix}RecordatorioHora" value="${hora}"
                        style="width:100%;padding:10px;border-radius:6px;border:1px solid #cbd5e1;">
                </div>
            </div>
            <small style="color:#64748b;display:block;margin-top:6px;">Recibirá una alerta en la fecha y hora indicadas.</small>
        </div>`;
};

InternamientoModule.prototype._toggleCamposRecordatorioPendiente = function(prefix) {
    const chk = document.getElementById(`${prefix}RecordatorioActivo`);
    const campos = document.getElementById(`${prefix}RecordatorioCampos`);
    if (campos) campos.style.display = chk?.checked ? 'grid' : 'none';
};

InternamientoModule.prototype.leerRecordatorioPendienteForm = function(prefix, requeridoSiActivo = true) {
    const activo = document.getElementById(`${prefix}RecordatorioActivo`)?.checked;
    if (!activo) {
        return {
            recordatorioActivo: false,
            recordatorioFecha: null,
            recordatorioHora: null,
            recordatorioMs: null,
            recordatorioNotificadoEn: null
        };
    }
    const fecha = document.getElementById(`${prefix}RecordatorioFecha`)?.value?.trim() || '';
    const hora = document.getElementById(`${prefix}RecordatorioHora`)?.value?.trim() || '';
    if (!fecha || !hora) {
        return requeridoSiActivo ? null : {
            recordatorioActivo: false,
            recordatorioFecha: null,
            recordatorioHora: null,
            recordatorioMs: null,
            recordatorioNotificadoEn: null
        };
    }
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const [horas, minutos] = hora.split(':').map(Number);
    const ms = new Date(anio, mes - 1, dia, horas, minutos, 0, 0).getTime();
    if (isNaN(ms)) return null;
    return {
        recordatorioActivo: true,
        recordatorioFecha: fecha,
        recordatorioHora: hora,
        recordatorioMs: ms,
        recordatorioNotificadoEn: null
    };
};

InternamientoModule.prototype.aplicarRecordatorioAProcedimientoData = function(destino, recordatorio) {
    if (!destino || !recordatorio) return destino;
    Object.assign(destino, recordatorio);
    return destino;
};

InternamientoModule.prototype.formatearRecordatorioPendiente = function(proc) {
    if (!proc?.recordatorioActivo || !proc.recordatorioMs) return '';
    return new Date(proc.recordatorioMs).toLocaleString('es-PE', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

InternamientoModule.prototype.renderBadgeRecordatorioPendiente = function(proc) {
    if (!proc?.recordatorioActivo || !proc.recordatorioMs) return '';
    const texto = this.formatearRecordatorioPendiente(proc);
    const vencido = proc.estado === 'pendiente' && proc.recordatorioMs <= Date.now();
    const clase = vencido ? 'pendiente-recordatorio-badge pendiente-recordatorio-badge--vencido' : 'pendiente-recordatorio-badge';
    return `<span class="${clase}"><i class="fas fa-bell"></i> Recordatorio: ${texto}</span>`;
};

InternamientoModule.prototype._ordenarProcedimientosConRecordatorio = function(lista) {
    return [...lista].sort((a, b) => {
        if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
        if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
        const ra = a.estado === 'pendiente' && a.recordatorioActivo && a.recordatorioMs ? a.recordatorioMs : Infinity;
        const rb = b.estado === 'pendiente' && b.recordatorioActivo && b.recordatorioMs ? b.recordatorioMs : Infinity;
        if (ra !== rb) return ra - rb;
        return (b.fechaCreacion || 0) - (a.fechaCreacion || 0);
    });
};

InternamientoModule.prototype._iniciarRecordatoriosPendientes = function() {
    if (this._recordatoriosPendientesInterval) return;
    this._recordatoriosPendientesMostrados = this._recordatoriosPendientesMostrados || new Set();
    this._verificarRecordatoriosPendientes();
    this._recordatoriosPendientesInterval = setInterval(
        () => this._verificarRecordatoriosPendientes(),
        60000
    );
};

InternamientoModule.prototype._verificarRecordatoriosPendientes = function() {
    if (!this.internamientos || typeof this.internamientos.forEach !== 'function') return;
    const ahora = Date.now();
    this._recordatoriosPendientesMostrados = this._recordatoriosPendientesMostrados || new Set();

    this.internamientos.forEach((internamiento, mapKey) => {
        if (!this.esRegistroInternamientoReal(mapKey)) return;
        if (['egresado', 'defuncion'].includes(internamiento.estado?.actual)) return;
        const nombreMascota = internamiento.referencias?.nombreMascota || 'Paciente';
        const procs = Object.values(internamiento.procedimientos || {});
        procs.forEach((proc) => {
            if (proc.estado !== 'pendiente' || !proc.recordatorioActivo || !proc.recordatorioMs) return;
            if (proc.recordatorioMs > ahora) return;
            const key = `${mapKey}:${proc.procedimientoId}:${proc.recordatorioMs}`;
            if (this._recordatoriosPendientesMostrados.has(key)) return;
            this._recordatoriosPendientesMostrados.add(key);
            const desc = (proc.descripcion || 'Pendiente').substring(0, 80);
            this.showNotification(
                `<strong>Recordatorio de pendiente</strong><br>${nombreMascota}: ${desc.replace(/</g, '&lt;')}`,
                'warning',
                8000
            );
            if (this.internamientosRef) {
                this.internamientosRef.child(mapKey)
                    .child(`procedimientos/${proc.procedimientoId}/recordatorioNotificadoEn`)
                    .set(Date.now())
                    .catch(() => {});
            }
        });
    });
};

InternamientoModule.prototype.asignarRecordatorioPendiente = function(procedimientoId) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    const proc = internamiento?.procedimientos?.[procedimientoId];
    if (!proc || proc.estado === 'completado') {
        this.showAlert('No se puede programar recordatorio en este pendiente.', 'Acción no disponible', 'warning');
        return;
    }

    const modalContent = `
        <form id="formRecordatorioPendiente">
            ${this.getHtmlCampoRecordatorioPendiente(proc, 'recProc')}
            <div style="text-align:right;margin-top:20px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
                ${proc.recordatorioActivo ? `
                <button type="button" class="btn btn-secondary" style="margin-right:auto;color:#c62828;border-color:#ef9a9a;"
                    onclick="window.internamientoModule.quitarRecordatorioPendiente('${procedimientoId}')">
                    <i class="fas fa-bell-slash"></i> Quitar recordatorio
                </button>` : ''}
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-bell"></i> Guardar recordatorio</button>
            </div>
        </form>`;

    const modal = this.createModal('Recordatorio de pendiente', modalContent, 'fa-bell');
    document.body.appendChild(modal);
    document.getElementById('formRecordatorioPendiente')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const recordatorio = this.leerRecordatorioPendienteForm('recProc', true);
        if (recordatorio === null) {
            this.showAlert('Indique el día y la hora del recordatorio.', 'Campo requerido', 'warning');
            return;
        }
        await this.guardarRecordatorioPendiente(procedimientoId, recordatorio);
    });
};

InternamientoModule.prototype.guardarRecordatorioPendiente = async function(procedimientoId, recordatorio) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento?.procedimientos?.[procedimientoId]) return;

    const updates = {
        [`procedimientos/${procedimientoId}/recordatorioActivo`]: !!recordatorio.recordatorioActivo,
        [`procedimientos/${procedimientoId}/recordatorioFecha`]: recordatorio.recordatorioFecha,
        [`procedimientos/${procedimientoId}/recordatorioHora`]: recordatorio.recordatorioHora,
        [`procedimientos/${procedimientoId}/recordatorioMs`]: recordatorio.recordatorioMs,
        [`procedimientos/${procedimientoId}/recordatorioNotificadoEn`]: null,
        'metadata/fechaUltimaActualizacion': Date.now()
    };

    try {
        await this.internamientosRef.child(this.currentInternamientoId).update(updates);
        Object.assign(internamiento.procedimientos[procedimientoId], recordatorio, { recordatorioNotificadoEn: null });
        document.querySelector('.modal-overlay')?.remove();
        this.showNotification('Recordatorio guardado', 'success');
        this.loadProcedimientosView(this.getPendientesAgregarBloqueado());
    } catch (err) {
        this.showAlert('Error al guardar recordatorio: ' + (err.message || err), 'Error', 'error');
    }
};

InternamientoModule.prototype.quitarRecordatorioPendiente = async function(procedimientoId) {
    await this.guardarRecordatorioPendiente(procedimientoId, {
        recordatorioActivo: false,
        recordatorioFecha: null,
        recordatorioHora: null,
        recordatorioMs: null,
        recordatorioNotificadoEn: null
    });
};

InternamientoModule.prototype.loadProcedimientosView = function(bloqueado = false) {
    const container = document.getElementById('internamiento-procedimientos');
    if (!container) {
        console.error('No se encontró el contenedor internamiento-procedimientos');
        return;
    }

    if (!this.currentInternamientoId) {
        console.error('No hay internamiento seleccionado');
        container.innerHTML = '<div class="alert-box danger"><i class="fas fa-exclamation-triangle"></i><div>Error: No hay internamiento seleccionado</div></div>';
        return;
    }

    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) {
        console.error('No se encontró el internamiento');
        container.innerHTML = '<div class="alert-box danger"><i class="fas fa-exclamation-triangle"></i><div>Error: No se encontró el internamiento</div></div>';
        return;
    }

    const procedimientos = Object.values(internamiento.procedimientos || {});
    const pendientes = procedimientos.filter(p => p.estado === 'pendiente');
    const completados = procedimientos.filter(p => p.estado === 'completado');
    const pendientesCobro = pendientes.filter(p => p.tipoPendiente === 'cobro');
    const pendientesProcedimiento = pendientes.filter(p => p.tipoPendiente !== 'cobro');
    const totalProcedimientos = procedimientos.length;
    const porcentajeCompletado = totalProcedimientos > 0 ? Math.round((completados.length / totalProcedimientos) * 100) : 0;

    container.innerHTML = `
        <div class="section-header">
            <h2><i class="fas fa-clipboard-list"></i> Pendientes</h2>
            <div>
                ${!bloqueado ? `
                    <button class="btn btn-primary" onclick="window.internamientoModule.agregarProcedimiento()">
                        <i class="fas fa-plus"></i> Nuevo Pendiente
                    </button>
                ` : ''}
                <button class="btn btn-secondary" onclick="window.internamientoModule.showPanelPrincipal('${this.currentInternamientoId}')" style="margin-left: 10px;">
                    <i class="fas fa-arrow-left"></i> Volver al Panel
                </button>
            </div>
        </div>

        ${bloqueado ? `
            <div class="alert-box warning">
                <i class="fas fa-info-circle"></i>
                <div><strong>Agregar pendientes deshabilitado</strong> - ${this.getMensajePendientesSoloLectura(internamiento)}</div>
            </div>
        ` : ''}

        <!-- Resumen rápido por tipo -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
            <div style="background:#fff3e0;border:1px solid #ffcc80;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:1.8rem;font-weight:700;color:#e65100;">${pendientesCobro.length}</div>
                <div style="font-size:0.9rem;color:#bf360c;"><i class="fas fa-dollar-sign"></i> Pendientes de cobro</div>
            </div>
            <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:1.8rem;font-weight:700;color:#1565c0;">${pendientesProcedimiento.length}</div>
                <div style="font-size:0.9rem;color:#0d47a1;"><i class="fas fa-tasks"></i> Pendientes de procedimiento</div>
            </div>
            <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:1.8rem;font-weight:700;color:#2e7d32;">${completados.length}</div>
                <div style="font-size:0.9rem;color:#1b5e20;"><i class="fas fa-check-circle"></i> Completados</div>
            </div>
        </div>

        <!-- Barra de progreso general -->
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; color: var(--internamiento-primary); font-size:1rem;">
                    <i class="fas fa-chart-line"></i> Progreso General
                </h3>
                <span style="font-size: 1.4rem; font-weight: 700; color: var(--internamiento-secondary);">
                    ${porcentajeCompletado}%
                </span>
            </div>
            ${this.renderBarraProgresoConGato(porcentajeCompletado, {
                height: 16,
                fillInner: porcentajeCompletado > 10 ? `${completados.length} / ${totalProcedimientos}` : ''
            })}
        </div>

        <!-- Tabs: Pendientes / Completados / Todos -->
        <div class="tabs-container">
            <button class="tab-btn active" onclick="window.internamientoModule.filtrarProcedimientos('pendientes')">
                <i class="fas fa-clock"></i> Pendientes (${pendientes.length})
            </button>
            <button class="tab-btn" onclick="window.internamientoModule.filtrarProcedimientos('completados')">
                <i class="fas fa-check-circle"></i> Completados (${completados.length})
            </button>
            <button class="tab-btn" onclick="window.internamientoModule.filtrarProcedimientos('todos')">
                <i class="fas fa-list"></i> Todos (${totalProcedimientos})
            </button>
        </div>

        <!-- Lista de pendientes -->
        <div id="listaProcedimientos">
            ${this.renderListaProcedimientos(pendientes, 'pendientes', bloqueado)}
        </div>
    `;
};

InternamientoModule.prototype.filtrarProcedimientos = function(tipo) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    const procedimientos = Object.values(internamiento.procedimientos || {});
    let filtrados = procedimientos;

    switch(tipo) {
        case 'pendientes':
            filtrados = procedimientos.filter(p => p.estado === 'pendiente');
            break;
        case 'completados':
            filtrados = procedimientos.filter(p => p.estado === 'completado');
            break;
        case 'todos':
            // Todos
            break;
    }

    // Actualizar UI de tabs
    document.querySelectorAll('#internamiento-procedimientos .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Renderizar lista filtrada
    const container = document.getElementById('listaProcedimientos');
    if (container) {
        const bloqueado = this.isPendientesAgregarBloqueado(internamiento);
        container.innerHTML = this.renderListaProcedimientos(filtrados, tipo, bloqueado);
    }
};

InternamientoModule.prototype.renderListaProcedimientos = function(procedimientos, tipo, bloqueado) {
    if (procedimientos.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <p>No hay pendientes ${tipo !== 'todos' ? tipo : 'registrados'}</p>
            </div>
        `;
    }

    // Ordenar: pendientes primero, luego por fecha
    const ordenados = this._ordenarProcedimientosConRecordatorio(procedimientos);

    return `
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <ul class="procedimientos-list" style="list-style: none; padding: 0; margin: 0;">
                ${ordenados.map(proc => this.renderProcedimientoItem(proc, bloqueado)).join('')}
            </ul>
        </div>
    `;
};

InternamientoModule.prototype.renderProcedimientoItem = function(proc, bloqueado) {
    const completado = proc.estado === 'completado';
    const urgente = proc.prioridad === 'alta';
    const paraFernanda = !!proc.paraFernanda;
    const tipoPendiente = this.traducirTipoPendiente(proc.tipoPendiente || 'procedimiento');
    const fechaCreacion = new Date(proc.fechaCreacion).toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
    const bgStyle = paraFernanda ? 'background: #fce4ec; border-left: 4px solid #ec407a;'
        : (proc.tipoPendiente === 'cobro' ? 'border-left: 4px solid #e65100;' : 'border-left: 4px solid #1565c0;');
    const badgeRecordatorio = this.renderBadgeRecordatorioPendiente(proc);

    return `
        <li class="procedimiento-item ${completado ? 'completado' : ''} ${paraFernanda ? 'procedimiento-para-fernanda' : ''}" style="padding: 18px; border-bottom: 1px solid #e0e0e0; transition: all 0.3s ease; ${bgStyle}">
            <div style="display: flex; align-items: start; gap: 15px;">
                <!-- Checkboxes -->
                <div style="flex-shrink: 0; display: flex; align-items: center; gap: 6px; padding-top: 2px;">
                    <input type="checkbox" 
                           class="procedimiento-checkbox"
                           ${completado ? 'checked' : ''} 
                           ${completado ? 'disabled' : ''}
                           onchange="window.internamientoModule.toggleProcedimiento('${proc.procedimientoId}')"
                           title="${completado ? 'Completado (no se puede desmarcar)' : 'Marcar como completado'}"
                           style="width: 20px; height: 20px; cursor: ${completado ? 'not-allowed' : 'pointer'};">
                    <label style="font-size: 0.75rem; color: #6c757d; white-space: nowrap;">Completado</label>
                </div>

                <!-- Contenido -->
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;">
                        <span style="font-size: 1.05rem; font-weight: 600; color: ${completado ? '#95a5a6' : 'var(--internamiento-primary)'}; ${completado ? 'text-decoration: line-through;' : ''}">
                            ${(proc.descripcion || '').replace(/</g, '&lt;')}
                        </span>
                        <span style="background:${tipoPendiente.bg};color:${tipoPendiente.color};font-size:0.78rem;font-weight:600;padding:2px 8px;border-radius:20px;border:1px solid ${tipoPendiente.color}30;">
                            <i class="fas ${tipoPendiente.icon}"></i> ${tipoPendiente.label}
                        </span>
                        ${this.renderChipOrigenItem(proc)}
                        ${paraFernanda ? `<span class="chip" style="background: #f8bbd0; color: #c2185b; font-size: 0.8rem;"><i class="fas fa-user-check"></i> FERNANDA</span>` : ''}
                        ${urgente && !completado ? `<span class="priority-tag priority-alta"><i class="fas fa-exclamation-circle"></i> Urgente</span>` : ''}
                        ${proc.tipo ? `<span class="chip" style="background: #f3e5f5; color: #6a1b9a; font-size: 0.8rem;">${this.traducirTipoProcedimiento(proc.tipo)}</span>` : ''}
                    </div>
                    
                    ${proc.asignadoANombre ? `
                    <div style="font-size:0.85rem;color:#1565c0;margin-bottom:8px;background:#e3f2fd;padding:4px 10px;border-radius:6px;display:inline-block;">
                        <i class="fas fa-user-nurse"></i> Asignado a: <strong>${(proc.asignadoANombre || '').replace(/</g, '&lt;')}</strong>
                    </div>
                    ` : ''}

                    ${badgeRecordatorio ? `
                    <div style="margin-bottom:8px;">${badgeRecordatorio}</div>
                    ` : ''}

                    <div style="font-size: 0.85rem; color: #6c757d; margin-bottom: 8px;">
                        <i class="fas fa-calendar"></i> Creado: ${fechaCreacion}
                        ${proc.creadoNombre ? ` por <strong>${(proc.creadoNombre || '').replace(/</g, '&lt;')}</strong>` : ''}
                    </div>

                    ${completado ? `
                        <div style="font-size: 0.85rem; color: #27ae60; margin-bottom: 8px;">
                            <i class="fas fa-check-circle"></i> Completado: ${new Date(proc.fechaCompletado).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            ${proc.completadoNombre ? ` por <strong>${(proc.completadoNombre || '').replace(/</g, '&lt;')}</strong>` : ''}
                        </div>
                    ` : ''}

                    ${proc.observaciones ? `
                        <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-left: 3px solid var(--internamiento-info); border-radius: 4px; font-size: 0.9rem; color: #555;">
                            <i class="fas fa-comment"></i> ${proc.observaciones}
                        </div>
                    ` : ''}

                    ${proc.resultadoId ? `
                        <div style="margin-top: 10px;">
                            <button class="btn btn-sm btn-info" onclick="alert('Ver resultado de laboratorio (integración futura)')">
                                <i class="fas fa-vial"></i> Ver Resultado
                            </button>
                        </div>
                    ` : ''}
                </div>

                <!-- Acciones -->
                <div style="flex-shrink: 0; display: flex; gap: 8px; align-items: center;">
                    <button class="btn btn-sm" style="background: #6c757d; color: white;" 
                            onclick="window.internamientoModule.mostrarHistorialCambiosProcedimiento('${proc.procedimientoId}')" title="Historial de cambios">
                        <i class="fas fa-history"></i>
                    </button>
                    ${!bloqueado && !completado ? `
                        <button class="btn btn-sm" style="background: #e65100; color: white;"
                                onclick="window.internamientoModule.asignarRecordatorioPendiente('${proc.procedimientoId}')" title="Programar recordatorio">
                            <i class="fas fa-bell"></i>
                        </button>
                        <button class="btn btn-sm" style="background: #17a2b8; color: white;" 
                                onclick="window.internamientoModule.editarProcedimiento('${proc.procedimientoId}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        </li>
    `;
};

InternamientoModule.prototype.mostrarHistorialCambiosProcedimiento = function(procedimientoId) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;
    const proc = internamiento.procedimientos?.[procedimientoId];
    if (!proc) return;
    const historial = proc.historialCambios || [];
    const descEsc = (proc.descripcion || '').replace(/</g, '&lt;');
    let filas = '';
    if (historial.length > 0) {
        historial.forEach((entry) => {
            const fechaStr = entry.fecha ? new Date(entry.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
            const nombre = (entry.editadoNombre || '—').replace(/</g, '&lt;');
            const motivo = (entry.motivo || '—').replace(/</g, '&lt;');
            let datosAnt = '—';
            if (entry.datosAnteriores) {
                const d = entry.datosAnteriores;
                const parts = [];
                if (d.descripcion) parts.push('Descripción: ' + String(d.descripcion).replace(/</g, '&lt;'));
                if (d.prioridad) parts.push('Prioridad: ' + d.prioridad);
                if (d.observaciones) parts.push('Obs: ' + String(d.observaciones).replace(/</g, '&lt;'));
                if (d.paraFernanda) parts.push('Para Fernanda: sí');
                datosAnt = parts.length ? parts.join(' · ') : '—';
            }
            filas += `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${fechaStr}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${nombre}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${motivo}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 0.85rem; color: #555;">${datosAnt}</td>
                </tr>`;
        });
    }
    const html = `
        <div style="padding: 20px;">
            <div style="margin-bottom: 16px;">
                <h3 style="margin: 0 0 8px 0; color: #333;"><i class="fas fa-history" style="color: #5c6bc0;"></i> Historial de cambios</h3>
                <p style="margin: 0; color: #666; font-size: 0.95rem;"><strong>${descEsc}</strong></p>
            </div>
            ${filas ? `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 10px; text-align: left;">Fecha / Hora</th>
                            <th style="padding: 10px; text-align: left;">Editado por</th>
                            <th style="padding: 10px; text-align: left;">Motivo</th>
                            <th style="padding: 10px; text-align: left;">Lo que estaba en ese momento</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
            ` : `
            <p style="color: #888;"><i class="fas fa-info-circle"></i> No hay cambios registrados para este procedimiento.</p>
            `}
            <div style="margin-top: 20px; text-align: right;">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i> Cerrar</button>
            </div>
        </div>
    `;
    const modal = this.createModal('Historial de cambios', html, 'fa-history');
    document.body.appendChild(modal);
};

InternamientoModule.prototype.traducirTipoProcedimiento = function(tipo) {
    const tipos = {
        'examen': 'Examen',
        'curacion': 'Curación',
        'imagen': 'Imagen',
        'cirugia': 'Cirugía',
        'terapia': 'Terapia',
        'otro': 'Otro',
        'cobro': 'Pendiente cobro',
        'procedimiento': 'Pendiente procedimiento'
    };
    return tipos[tipo] || tipo;
};

InternamientoModule.prototype.traducirTipoPendiente = function(tipoPendiente) {
    if (tipoPendiente === 'cobro') return { label: 'Pendiente cobro', color: '#e65100', bg: '#fff3e0', icon: 'fa-dollar-sign' };
    return { label: 'Pendiente procedimiento', color: '#1565c0', bg: '#e3f2fd', icon: 'fa-tasks' };
};

/** Personal permitido en «Asignar a» del módulo de pendientes (internamiento). */
InternamientoModule.prototype.PENDIENTES_ASIGNABLES = [
    'Alejandra Cardona',
    'Dra. Nicole Sibaja',
    'Tec. Maria Fernanda',
    'Tec. Daniela Fonseca',
    'Tec. Axel Coleman',
    'Tec. Delmarck Palmer',
    'Tec. Nicole Gamboa',
    'Tec. Andrés Santana',
    'Tec. Yovanel Valle',
    'Tec. Yancy Picado',
    'Tec. Camila Castro'
];

InternamientoModule.prototype._normalizarNombreAsignable = function(nombre) {
    return String(nombre || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^(tec\.|dra\.|dr\.)\s*/gi, '')
        .trim()
        .toLowerCase();
};

InternamientoModule.prototype.buildOpcionesAsignadosPendientes = async function() {
    let opciones = '<option value="">— Sin asignar —</option>';
    const whitelist = this.PENDIENTES_ASIGNABLES || [];
    const personas = [];

    try {
        const [snapAss, snapDoc] = await Promise.all([
            window.database.ref('assistants').once('value'),
            window.database.ref('doctors').once('value')
        ]);
        const asistentes = snapAss.val() || {};
        const doctores = snapDoc.val() || {};

        Object.entries(asistentes).forEach(([id, data]) => {
            const nombre = typeof data === 'string' ? data : (data.nombre || data.name || id);
            const rol = typeof data === 'object' && data ? (data.role || data.rol || data.userRole || '') : '';
            if (String(rol).toLowerCase() === 'consulta_externa') return;
            personas.push({ id, nombre: String(nombre || id).trim() });
        });
        Object.entries(doctores).forEach(([id, data]) => {
            const nombre = typeof data === 'string' ? data : (data.name || data.nombre || id);
            if (nombre) personas.push({ id, nombre: String(nombre).trim() });
        });
    } catch (e) {
        /* continuar con lista fija si falla Firebase */
    }

    whitelist.forEach((label) => {
        const key = this._normalizarNombreAsignable(label);
        const match = personas.find((p) => this._normalizarNombreAsignable(p.nombre) === key);
        const id = match ? match.id : key.replace(/\s+/g, '_');
        const labelEsc = label.replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const idEsc = String(id).replace(/"/g, '&quot;');
        opciones += `<option value="${idEsc}|${labelEsc}">${labelEsc}</option>`;
    });

    return opciones;
};

// ================================================================
// AGREGAR PROCEDIMIENTO
// ================================================================

InternamientoModule.prototype.agregarProcedimiento = async function() {
    // Solo mostrar "Es para FERNANDA" cuando se agrega desde un internamiento ya creado, no en Nuevo internamiento
    const mostrarOpcionFernanda = !!this.currentInternamientoId;

    const opcionesAsistentes = await this.buildOpcionesAsignadosPendientes();

    const modalContent = `
        <form id="formAgregarProcedimiento">
            <!-- Tipo de pendiente (nuevo campo principal) -->
            <div class="form-group">
                <label style="font-weight:700;"><i class="fas fa-tag"></i> Tipo de Pendiente *</label>
                <div style="display:flex;gap:12px;margin-top:6px;">
                    <label style="flex:1;display:flex;align-items:center;gap:8px;padding:12px;border:2px solid #90caf9;border-radius:8px;cursor:pointer;background:#e3f2fd;" id="lblTipoProcedimiento">
                        <input type="radio" name="procTipoPendiente" id="tipoProcedimiento" value="procedimiento" checked onchange="document.getElementById('lblTipoProcedimiento').style.borderColor='#1565c0';document.getElementById('lblTipoCobro').style.borderColor='#90caf9';">
                        <i class="fas fa-tasks" style="color:#1565c0;"></i>
                        <strong style="color:#1565c0;">Pendiente procedimiento</strong>
                    </label>
                    <label style="flex:1;display:flex;align-items:center;gap:8px;padding:12px;border:2px solid #ffcc80;border-radius:8px;cursor:pointer;background:#fff3e0;" id="lblTipoCobro">
                        <input type="radio" name="procTipoPendiente" id="tipoCobro" value="cobro" onchange="document.getElementById('lblTipoCobro').style.borderColor='#e65100';document.getElementById('lblTipoProcedimiento').style.borderColor='#90caf9';">
                        <i class="fas fa-dollar-sign" style="color:#e65100;"></i>
                        <strong style="color:#e65100;">Pendiente cobro</strong>
                    </label>
                </div>
            </div>

            <div class="form-group">
                <label>Categoría del procedimiento</label>
                <select id="procTipo">
                    <option value="">Seleccionar...</option>
                    <option value="examen">Examen de Laboratorio</option>
                    <option value="imagen">Estudio de Imagen (Rx, Eco, etc.)</option>
                    <option value="curacion">Curación / Tratamiento de Heridas</option>
                    <option value="terapia">Terapia / Tratamiento Especial</option>
                    <option value="cirugia">Procedimiento Quirúrgico</option>
                    <option value="otro">Otro</option>
                </select>
            </div>

            <div class="form-group">
                <label>Descripción *</label>
                <input type="text" id="procDescripcion" required placeholder="Ej: Hemograma completo">
            </div>

            <div class="form-group">
                <label><i class="fas fa-user-nurse"></i> Asignar a</label>
                <select id="procAsignadoA">
                    ${opcionesAsistentes}
                </select>
            </div>

            <div class="form-group">
                <label>Prioridad</label>
                <select id="procPrioridad">
                    <option value="normal">Normal</option>
                    <option value="alta">Alta - Urgente</option>
                </select>
            </div>

            <div class="form-group">
                <label>Observaciones</label>
                <textarea id="procObservaciones" rows="2" placeholder="Detalles adicionales, indicaciones especiales..."></textarea>
            </div>

            ${this.getHtmlCampoRecordatorioPendiente({}, 'proc')}

            ${!this.currentInternamientoId || this.edicionIngresoConsultaId ? this.getOrigenAdmisionFormHTML() : ''}

            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="procMarcarCompletado">
                    Marcar como completado inmediatamente
                </label>
            </div>

            ${mostrarOpcionFernanda ? `
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="procParaFernanda" style="width: 18px; height: 18px;">
                    <i class="fas fa-user-check" style="color: #ec407a;"></i>
                    Es para FERNANDA
                </label>
            </div>
            ` : ''}

            <div style="text-align: right; margin-top: 20px;">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                    Cancelar
                </button>
                <button type="submit" class="btn btn-primary" style="margin-left: 10px;">
                    <i class="fas fa-plus"></i> Agregar Pendiente
                </button>
            </div>
        </form>
    `;

    const modal = this.createModal('Nuevo Pendiente', modalContent, 'fa-clipboard-list');
    document.body.appendChild(modal);

    // Setup form submit
    const form = document.getElementById('formAgregarProcedimiento');
    if (form) {
        form.onsubmit = (e) => this.handleAgregarProcedimiento(e);
    }
};

InternamientoModule.prototype.handleAgregarProcedimiento = async function(e) {
    e.preventDefault();

    // Evitar doble envío (ej. doble clic en Agregar)
    if (this._agregandoProcedimientoAdmision) return;
    const esAdmisionListaLocal = !this.currentInternamientoId || !!this.edicionIngresoConsultaId;
    if (esAdmisionListaLocal) this._agregandoProcedimientoAdmision = true;
    const origenFlags = esAdmisionListaLocal
        ? this.getOrigenAdmisionFlagsDesdeForm()
        : { puestoPorConsultaExterna: false, puestoPorInternos: false };

    const asignadoRaw = document.getElementById('procAsignadoA')?.value || '';
    const [asignadoAId, asignadoANombre] = asignadoRaw.includes('|') ? asignadoRaw.split('|') : [asignadoRaw, ''];
    const procData = {
        tipoPendiente: document.querySelector('input[name="procTipoPendiente"]:checked')?.value || 'procedimiento',
        tipo: document.getElementById('procTipo')?.value || '',
        descripcion: document.getElementById('procDescripcion')?.value.trim() || '',
        prioridad: document.getElementById('procPrioridad')?.value || 'normal',
        observaciones: document.getElementById('procObservaciones')?.value.trim() || '',
        marcarCompletado: document.getElementById('procMarcarCompletado')?.checked || false,
        paraFernanda: document.getElementById('procParaFernanda')?.checked || false,
        asignadoAId: asignadoAId || null,
        asignadoANombre: asignadoANombre || null,
        puestoPorConsultaExterna: !!origenFlags.puestoPorConsultaExterna,
        puestoPorInternos: !!origenFlags.puestoPorInternos
    };

    const recordatorio = this.leerRecordatorioPendienteForm('proc', true);
    if (recordatorio === null) {
        if (esAdmisionListaLocal) this._agregandoProcedimientoAdmision = false;
        this.showAlert('Si activa el recordatorio, indique día y hora.', 'Campo requerido', 'warning');
        return;
    }
    this.aplicarRecordatorioAProcedimientoData(procData, recordatorio);

    // Nuevo internamiento o edición desde admisión: lista local, sin código aún.
    if (esAdmisionListaLocal) {
        this.pendientesAdmision = this.pendientesAdmision || [];
        this.pendientesAdmision.push(procData);
        this._agregandoProcedimientoAdmision = false;
        const msg = this.edicionIngresoConsultaId
            ? 'Tarea agregada. Se guardará al guardar los cambios de ingreso.'
            : 'Tarea agregada. Se guardará al crear el internamiento.';
        this.showNotification(msg, 'success');
        document.querySelector('.modal-overlay')?.remove();
        this.renderListaPendientesAdmision();
        return;
    }

    // Solo en internamiento ya creado: pedir código para registrar quién agrega la tarea
    const resultadoCodigo = await this.verificarCodigoAsistente('agregar_tarea');
    if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
        this.showNotification('No se agregó la tarea', 'info');
        return;
    }

    try {
        await this.guardarProcedimiento(procData, resultadoCodigo);
        this.showNotification('Tarea agregada por ' + resultadoCodigo.nombre, 'success');
        document.querySelector('.modal-overlay')?.remove();
        this.loadProcedimientosView(this.getPendientesAgregarBloqueado());
    } catch (error) {
        console.error('Error agregando procedimiento:', error);
        this.showAlert('Error al agregar procedimiento: ' + error.message, 'Error', 'error');
    }
};

InternamientoModule.prototype.guardarProcedimiento = async function(data, codigoResult) {
    const userId = codigoResult?.assistantId || sessionStorage.getItem('userId');
    const userName = codigoResult?.nombre || sessionStorage.getItem('userName');

    const procedimientoId = 'proc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const procedimientoData = {
        procedimientoId: procedimientoId,
        tipoPendiente: data.tipoPendiente || 'procedimiento',
        tipo: data.tipo,
        descripcion: data.descripcion,
        prioridad: data.prioridad,
        observaciones: data.observaciones,
        paraFernanda: !!data.paraFernanda,
        asignadoAId: data.asignadoAId || null,
        asignadoANombre: data.asignadoANombre || null,
        puestoPorConsultaExterna: false,
        estado: data.marcarCompletado ? 'completado' : 'pendiente',
        fechaCreacion: Date.now(),
        creadoPor: userId,
        creadoNombre: userName,
        creadoCodigoVerificado: !!codigoResult,
        fechaCompletado: data.marcarCompletado ? Date.now() : null,
        completadoPor: data.marcarCompletado ? userId : null,
        completadoNombre: data.marcarCompletado ? userName : null,
        reportado: false,
        reportadoA: null,
        fechaReportado: null,
        reportadoPor: null,
        reportadoNombre: null,
        observacionesReporte: '',
        resultadoId: null,
        documentosAdjuntos: [],
        recordatorioActivo: !!data.recordatorioActivo,
        recordatorioFecha: data.recordatorioFecha || null,
        recordatorioHora: data.recordatorioHora || null,
        recordatorioMs: data.recordatorioMs || null,
        recordatorioNotificadoEn: null
    };

    const updates = {};
    updates[`procedimientos/${procedimientoId}`] = procedimientoData;
    updates['metadata/fechaUltimaActualizacion'] = Date.now();
    
    if (data.marcarCompletado) {
        updates['estadisticas/totalProcedimientos'] = (this.internamientos.get(this.currentInternamientoId)?.estadisticas?.totalProcedimientos || 0) + 1;
    }

    const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
    await internamientoRef.update(updates);

    // Auditoría (quien creó la tarea = quien ingresó el código)
    await internamientoRef.child('auditoria/historialCambios').push({
        timestamp: Date.now(),
        userId: userId,
        usuarioNombre: userName,
        accion: 'agregar_procedimiento',
        codigoVerificado: !!codigoResult,
        detalles: {
            procedimientoId: procedimientoId,
            tipo: data.tipo,
            descripcion: data.descripcion,
            estado: procedimientoData.estado
        }
    });
};

// ================================================================
// TOGGLE PROCEDIMIENTO (Marcar/Desmarcar)
// ================================================================

InternamientoModule.prototype._refreshVistaProcedimientos = function() {
    if (this.currentInternamientoView === 'pendientes_global') {
        if (typeof this.loadPendientesGlobalView === 'function') {
            this.loadPendientesGlobalView();
        }
        return;
    }
    this.loadProcedimientosView(this.getPendientesAgregarBloqueado());
};

InternamientoModule.prototype.toggleProcedimiento = async function(procedimientoId, internamientoIdOverride) {
    const prevInternamientoId = this.currentInternamientoId;
    if (internamientoIdOverride) {
        this.currentInternamientoId = internamientoIdOverride;
    }
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) {
        if (internamientoIdOverride) this.currentInternamientoId = prevInternamientoId;
        return;
    }

    const procedimiento = internamiento.procedimientos?.[procedimientoId];
    if (!procedimiento) {
        if (internamientoIdOverride) this.currentInternamientoId = prevInternamientoId;
        return;
    }

    if (procedimiento.estado === 'completado') {
        if (internamientoIdOverride) this.currentInternamientoId = prevInternamientoId;
        return;
    }

    const nuevoEstado = 'completado';
    const confirmar = await this.showConfirm(
        '¿Estás seguro de marcar esta acción como completado? Una vez marcado ya no se podrá cambiar su estado.',
        'Confirmar completado',
        { confirmText: 'Sí, marcar completado', cancelText: 'Cancelar', icon: 'fa-check-circle', iconColor: '#27ae60' }
    );
    if (!confirmar) {
        if (internamientoIdOverride) this.currentInternamientoId = prevInternamientoId;
        this._refreshVistaProcedimientos();
        return;
    }

    let completadoPorId = null;
    let completadoPorNombre = null;

    {
        const resultadoCodigo = await this.verificarCodigoAsistente('completar_procedimiento');
        if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
            if (internamientoIdOverride) this.currentInternamientoId = prevInternamientoId;
            this._refreshVistaProcedimientos();
            return;
        }
        completadoPorId = resultadoCodigo.assistantId;
        completadoPorNombre = resultadoCodigo.nombre;
    }

    const userId = sessionStorage.getItem('userId');
    const userName = sessionStorage.getItem('userName');

    try {
        const updates = {};
        updates[`procedimientos/${procedimientoId}/estado`] = nuevoEstado;
        
        if (nuevoEstado === 'completado') {
            updates[`procedimientos/${procedimientoId}/fechaCompletado`] = Date.now();
            updates[`procedimientos/${procedimientoId}/completadoPor`] = completadoPorId;
            updates[`procedimientos/${procedimientoId}/completadoNombre`] = completadoPorNombre;
            updates['estadisticas/totalProcedimientos'] = (internamiento.estadisticas?.totalProcedimientos || 0) + 1;
        } else {
            updates[`procedimientos/${procedimientoId}/fechaCompletado`] = null;
            updates[`procedimientos/${procedimientoId}/completadoPor`] = null;
            updates[`procedimientos/${procedimientoId}/completadoNombre`] = null;
            updates['estadisticas/totalProcedimientos'] = Math.max(0, (internamiento.estadisticas?.totalProcedimientos || 1) - 1);
        }

        updates['metadata/fechaUltimaActualizacion'] = Date.now();

        const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
        await internamientoRef.update(updates);

        const procLocal = internamiento.procedimientos?.[procedimientoId];
        if (procLocal) {
            procLocal.estado = nuevoEstado;
            if (nuevoEstado === 'completado') {
                procLocal.fechaCompletado = updates[`procedimientos/${procedimientoId}/fechaCompletado`];
                procLocal.completadoPor = completadoPorId;
                procLocal.completadoNombre = completadoPorNombre;
            } else {
                procLocal.fechaCompletado = null;
                procLocal.completadoPor = null;
                procLocal.completadoNombre = null;
            }
            if (updates['estadisticas/totalProcedimientos'] != null) {
                internamiento.estadisticas = internamiento.estadisticas || {};
                internamiento.estadisticas.totalProcedimientos = updates['estadisticas/totalProcedimientos'];
            }
            this.internamientos.set(this.currentInternamientoId, { ...internamiento });
        }

        const nombreAuditoria = nuevoEstado === 'completado' ? completadoPorNombre : userName;
        const idAuditoria = nuevoEstado === 'completado' ? completadoPorId : userId;
        await internamientoRef.child('auditoria/historialCambios').push({
            timestamp: Date.now(),
            userId: idAuditoria,
            usuarioNombre: nombreAuditoria,
            accion: nuevoEstado === 'completado' ? 'completar_procedimiento' : 'desmarcar_procedimiento',
            codigoVerificado: nuevoEstado === 'completado',
            detalles: {
                procedimientoId: procedimientoId,
                descripcion: procedimiento.descripcion
            }
        });

        const idCompletado = this.currentInternamientoId;
        if (internamientoIdOverride) this.currentInternamientoId = prevInternamientoId;
        this._refreshVistaProcedimientos();
        if (typeof this.renderProcedimientosRecientes === 'function') {
            const intActualizado = this.internamientos.get(idCompletado);
            if (intActualizado) this.renderProcedimientosRecientes(intActualizado);
        }
        if (nuevoEstado === 'completado') this.showNotification('Completado por ' + completadoPorNombre, 'success');
    } catch (error) {
        console.error('Error actualizando procedimiento:', error);
        alert('Error: ' + error.message);
        if (internamientoIdOverride) this.currentInternamientoId = prevInternamientoId;
    }
};

// ================================================================
// EDITAR PROCEDIMIENTO
// ================================================================

InternamientoModule.prototype.editarProcedimiento = function(procedimientoId) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    const proc = internamiento.procedimientos?.[procedimientoId];
    if (!proc) {
        this.showAlert('Procedimiento no encontrado', 'Error', 'error');
        return;
    }

    const origenEtiqueta = this.getEtiquetaOrigenItem(proc);
    const modalContent = `
        <form id="formEditarProcedimiento">
            <div class="form-group">
                <label>Descripción *</label>
                <input type="text" id="editProcDescripcion" value="${proc.descripcion}" required>
            </div>

            <div class="form-group">
                <label>Prioridad</label>
                <select id="editProcPrioridad">
                    <option value="normal" ${proc.prioridad === 'normal' ? 'selected' : ''}>Normal</option>
                    <option value="alta" ${proc.prioridad === 'alta' ? 'selected' : ''}>Alta - Urgente</option>
                </select>
            </div>

            <div class="form-group">
                <label>Observaciones</label>
                <textarea id="editProcObservaciones" rows="2">${proc.observaciones || ''}</textarea>
            </div>

            ${this.getHtmlCampoRecordatorioPendiente(proc, 'editProc')}

            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="editProcParaFernanda" ${proc.paraFernanda ? 'checked' : ''} style="width: 18px; height: 18px;">
                    <i class="fas fa-user-check" style="color: #ec407a;"></i>
                    Es para FERNANDA
                </label>
            </div>

            ${origenEtiqueta ? `
            <div class="form-group" style="padding: 10px 12px; border-radius: 8px; ${origenEtiqueta.estilo}">
                <span style="font-weight: 500;"><i class="fas ${origenEtiqueta.icono}" style="margin-right: 6px;"></i>${origenEtiqueta.etiqueta}</span>
            </div>
            ` : ''}
            ${proc.puestoPorConsultaExterna ? `
            <div class="form-group">
                <label>Motivo del cambio *</label>
                <textarea id="editProcMotivoCambio" rows="2" required placeholder="Indique por qué se modifica esta tarea"></textarea>
            </div>
            ` : ''}

            <div style="text-align: right; margin-top: 20px;">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                    Cancelar
                </button>
                <button type="button" class="btn btn-primary" onclick="window.internamientoModule.guardarEdicionProcedimiento('${procedimientoId}')" style="margin-left: 10px;">
                    <i class="fas fa-save"></i> Guardar
                </button>
            </div>
        </form>
    `;

    const modal = this.createModal('Editar Procedimiento', modalContent);
    document.body.appendChild(modal);
};

InternamientoModule.prototype.guardarEdicionProcedimiento = async function(procedimientoId) {
    const descripcion = document.getElementById('editProcDescripcion')?.value.trim();
    if (!descripcion) {
        this.showAlert('La descripción es obligatoria', 'Campo Requerido', 'warning');
        return;
    }

    const internamiento = this.internamientos.get(this.currentInternamientoId);
    const proc = internamiento?.procedimientos?.[procedimientoId];
    const esConsultaExterna = !!proc?.puestoPorConsultaExterna;
    let motivoCambio = '';
    if (esConsultaExterna) {
        motivoCambio = document.getElementById('editProcMotivoCambio')?.value?.trim() || '';
        if (!motivoCambio) {
            this.showAlert('El motivo del cambio es obligatorio para tareas de consulta externa.', 'Campo Requerido', 'warning');
            return;
        }
    }

    const resultadoCodigo = esConsultaExterna ? await this.verificarCodigoAsistente('editar_procedimiento_consulta_externa') : null;
    if (esConsultaExterna && (!resultadoCodigo?.valido || resultadoCodigo?.cancelado)) {
        this.showNotification('Edición cancelada', 'info');
        return;
    }

    const recordatorio = this.leerRecordatorioPendienteForm('editProc', true);
    if (recordatorio === null) {
        this.showAlert('Si activa el recordatorio, indique día y hora.', 'Campo requerido', 'warning');
        return;
    }

    const updates = {};
    updates[`procedimientos/${procedimientoId}/descripcion`] = descripcion;
    updates[`procedimientos/${procedimientoId}/prioridad`] = document.getElementById('editProcPrioridad')?.value || 'normal';
    updates[`procedimientos/${procedimientoId}/observaciones`] = document.getElementById('editProcObservaciones')?.value.trim() || '';
    updates[`procedimientos/${procedimientoId}/paraFernanda`] = document.getElementById('editProcParaFernanda')?.checked || false;
    updates[`procedimientos/${procedimientoId}/recordatorioActivo`] = !!recordatorio.recordatorioActivo;
    updates[`procedimientos/${procedimientoId}/recordatorioFecha`] = recordatorio.recordatorioFecha;
    updates[`procedimientos/${procedimientoId}/recordatorioHora`] = recordatorio.recordatorioHora;
    updates[`procedimientos/${procedimientoId}/recordatorioMs`] = recordatorio.recordatorioMs;
    updates[`procedimientos/${procedimientoId}/recordatorioNotificadoEn`] = null;
    updates['metadata/fechaUltimaActualizacion'] = Date.now();

    if (esConsultaExterna && proc) {
        const datosAnteriores = {
            descripcion: proc.descripcion || '',
            prioridad: proc.prioridad || 'normal',
            observaciones: proc.observaciones || '',
            paraFernanda: !!proc.paraFernanda
        };
        const historialEntry = {
            fecha: Date.now(),
            editadoPor: resultadoCodigo?.assistantId || null,
            editadoNombre: resultadoCodigo?.nombre || '',
            motivo: motivoCambio,
            datosAnteriores
        };
        const historialPrev = proc.historialCambios || [];
        updates[`procedimientos/${procedimientoId}/historialCambios`] = [...historialPrev, historialEntry];
    }

    try {
        const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
        await internamientoRef.update(updates);

        this.showNotification('Procedimiento actualizado', 'success');
        document.querySelector('.modal-overlay')?.remove();
        this.loadProcedimientosView(this.getPendientesAgregarBloqueado());
    } catch (error) {
        console.error('Error editando procedimiento:', error);
        this.showAlert('Error al editar procedimiento: ' + error.message, 'Error', 'error');
    }
};

// ================================================================
// ELIMINAR PROCEDIMIENTO
// ================================================================

InternamientoModule.prototype.eliminarProcedimiento = async function(procedimientoId) {
    const confirmar = await this.showConfirm(
        '¿Está seguro de eliminar este procedimiento?',
        'Eliminar Procedimiento',
        { danger: true, confirmText: 'Eliminar', cancelText: 'Cancelar', icon: 'fa-trash-alt', iconColor: '#e74c3c' }
    );
    
    if (!confirmar) return;

    try {
        const updates = {};
        updates[`procedimientos/${procedimientoId}`] = null;
        updates['metadata/fechaUltimaActualizacion'] = Date.now();

        const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
        await internamientoRef.update(updates);

        this.showNotification('Procedimiento eliminado', 'success');
        this.loadProcedimientosView(this.getPendientesAgregarBloqueado());
    } catch (error) {
        console.error('Error eliminando procedimiento:', error);
        this.showAlert('Error al eliminar procedimiento: ' + error.message, 'Error', 'error');
    }
};

// ================================================================
// PENDIENTES GLOBALES (TODOS LOS PACIENTES)
// ================================================================

InternamientoModule.prototype.showPendientesGlobalView = function() {
    this.showInternamientoView('pendientes_global');
    setTimeout(() => this.loadPendientesGlobalView(), 100);
};

InternamientoModule.prototype._resolverInternamientoMapKey = function(internamientoId) {
    if (!internamientoId) return null;
    if (this.internamientos.has(internamientoId)) return internamientoId;
    for (const [mapKey, int] of this.internamientos.entries()) {
        if (mapKey === internamientoId || int.metadata?.internamientoId === internamientoId) {
            return mapKey;
        }
    }
    return null;
};

InternamientoModule.prototype._irAPacientePendientes = function(internamientoId) {
    const id = this._resolverInternamientoMapKey(internamientoId);
    if (!id || !this.internamientos.has(id)) {
        this.showAlert('No se encontró el expediente del paciente.', 'Paciente no encontrado', 'warning');
        return;
    }
    clearInterval(this._pendientesGlobalRefreshTimer);
    this.currentInternamientoId = id;
    this.showProcedimientosView();
};

InternamientoModule.prototype._clasificarPendienteGlobal = function(proc) {
    const ahora = Date.now();
    if (proc.prioridad === 'alta') return 'urgentes';
    if (proc.recordatorioActivo && proc.recordatorioMs) {
        return proc.recordatorioMs <= ahora ? 'urgentes' : 'recordatorio';
    }
    return 'otros';
};

InternamientoModule.prototype._renderPendienteGlobalCard = function(item) {
    const { internamiento, internamientoId, proc } = item;
    const nombre = (internamiento.referencias?.nombreMascota || 'Paciente').replace(/</g, '&lt;');
    const expediente = (internamiento.metadata?.expedienteNumero || internamiento.referencias?.expediente || '').replace(/</g, '&lt;');
    const desc = (proc.descripcion || '').replace(/</g, '&lt;');
    const tipoPendiente = this.traducirTipoPendiente(proc.tipoPendiente || 'procedimiento');
    const idSafe = (internamientoId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const procIdSafe = (proc.procedimientoId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const clasificacion = this._clasificarPendienteGlobal(proc);
    const urgenciaClass = clasificacion === 'urgentes' ? 'vencido' : (clasificacion === 'recordatorio' ? 'proximo' : 'programado');
    const badgeRecordatorio = this.renderBadgeRecordatorioPendiente(proc);

    return `
        <div class="med-pendientes-card med-pendientes-card-${urgenciaClass}">
            ${proc.prioridad === 'alta' ? '<div class="med-pendientes-card-badge">Urgente</div>' : ''}
            <div class="med-pendientes-card-paciente">${nombre}</div>
            ${expediente ? `<div class="med-pendientes-card-exp">${expediente}</div>` : ''}
            <div class="med-pendientes-card-med">
                <i class="fas fa-clipboard-list"></i>
                <span>${desc}</span>
            </div>
            <div class="med-pendientes-card-dosis">
                <span style="background:${tipoPendiente.bg};color:${tipoPendiente.color};font-size:0.75rem;font-weight:600;padding:2px 8px;border-radius:20px;">
                    <i class="fas ${tipoPendiente.icon}"></i> ${tipoPendiente.label}
                </span>
                ${proc.asignadoANombre ? ` · Asignado: ${(proc.asignadoANombre || '').replace(/</g, '&lt;')}` : ''}
            </div>
            ${badgeRecordatorio ? `<div style="margin-top:4px;">${badgeRecordatorio}</div>` : ''}
            <div style="display:flex;gap:8px;align-items:center;margin-top:8px;">
                <input type="checkbox"
                       class="procedimiento-checkbox"
                       onchange="window.internamientoModule.toggleProcedimiento('${procIdSafe}', '${idSafe}')"
                       title="Marcar como completado"
                       style="width:18px;height:18px;cursor:pointer;">
                <span style="font-size:0.78rem;color:#64748b;">Completar</span>
            </div>
            <button type="button" class="btn btn-sm btn-success med-pendientes-card-btn" onclick="window.internamientoModule._irAPacientePendientes('${idSafe}')">
                <i class="fas fa-arrow-right"></i> Ver pendientes del paciente
            </button>
        </div>`;
};

InternamientoModule.prototype.loadPendientesGlobalView = function() {
    const container = document.getElementById('internamiento-pendientes_global');
    if (!container) return;

    const items = [];
    this.internamientos.forEach((internamiento, mapKey) => {
        if (['egresado', 'alta', 'defuncion'].includes(internamiento.estado?.actual)) return;
        const internamientoId = internamiento.metadata?.internamientoId || mapKey;
        if (typeof this.esRegistroInternamientoReal === 'function' && !this.esRegistroInternamientoReal(internamientoId)) return;

        Object.values(internamiento.procedimientos || {})
            .filter(p => p.estado === 'pendiente')
            .forEach(proc => {
                items.push({ internamiento, internamientoId: mapKey, proc });
            });
    });

    items.sort((a, b) => {
        const pa = a.proc;
        const pb = b.proc;
        const ra = pa.recordatorioActivo && pa.recordatorioMs ? pa.recordatorioMs : Infinity;
        const rb = pb.recordatorioActivo && pb.recordatorioMs ? pb.recordatorioMs : Infinity;
        if (pa.prioridad === 'alta' && pb.prioridad !== 'alta') return -1;
        if (pa.prioridad !== 'alta' && pb.prioridad === 'alta') return 1;
        if (ra !== rb) return ra - rb;
        return (pb.fechaCreacion || 0) - (pa.fechaCreacion || 0);
    });

    const urgentes = items.filter(i => this._clasificarPendienteGlobal(i.proc) === 'urgentes');
    const recordatorio = items.filter(i => this._clasificarPendienteGlobal(i.proc) === 'recordatorio');
    const otros = items.filter(i => this._clasificarPendienteGlobal(i.proc) === 'otros');

    const pendientesCobro = items.filter(i => i.proc.tipoPendiente === 'cobro').length;
    const pendientesProcedimiento = items.length - pendientesCobro;

    const renderColumna = (titulo, colItems, tipo, icono) => `
        <div class="med-pendientes-col med-pendientes-col-${tipo}">
            <div class="med-pendientes-col-header">
                <i class="fas ${icono}"></i>
                <span>${titulo}</span>
                <span class="med-pendientes-col-count">${colItems.length}</span>
            </div>
            <div class="med-pendientes-col-body">
                ${colItems.length === 0
                    ? `<div class="med-pendientes-col-empty"><i class="fas fa-check"></i> Sin registros</div>`
                    : colItems.map(i => this._renderPendienteGlobalCard(i)).join('')}
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="section-header">
            <h2><i class="fas fa-clipboard-list"></i> Lista de pendientes</h2>
            <div>
                <button class="btn btn-secondary" onclick="window.internamientoModule.loadPendientesGlobalView()" style="margin-right:10px;">
                    <i class="fas fa-sync"></i> Actualizar
                </button>
                <button class="btn btn-secondary" onclick="window.internamientoModule.showInternamientoView('lista')">
                    <i class="fas fa-arrow-left"></i> Volver
                </button>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px;">
            <div style="background:#f3e5f5;border:1px solid #ce93d8;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:1.8rem;font-weight:700;color:#7e57c2;">${items.length}</div>
                <div style="font-size:0.9rem;color:#6a1b9a;"><i class="fas fa-clipboard-list"></i> Total pendientes</div>
            </div>
            <div style="background:#fff3e0;border:1px solid #ffcc80;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:1.8rem;font-weight:700;color:#e65100;">${pendientesCobro}</div>
                <div style="font-size:0.9rem;color:#bf360c;"><i class="fas fa-dollar-sign"></i> Pendientes de cobro</div>
            </div>
            <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:1.8rem;font-weight:700;color:#1565c0;">${pendientesProcedimiento}</div>
                <div style="font-size:0.9rem;color:#0d47a1;"><i class="fas fa-tasks"></i> Pendientes de procedimiento</div>
            </div>
        </div>

        ${items.length === 0 ? `
            <div class="empty-state"><i class="fas fa-check-circle" style="color:#2e7d32;"></i><p>No hay pendientes activos en este momento</p></div>
        ` : `
            <div class="med-pendientes-columnas">
                ${renderColumna('Urgentes / vencidos', urgentes, 'vencidos', 'fa-exclamation-circle')}
                ${renderColumna('Con recordatorio', recordatorio, 'proximos', 'fa-bell')}
                ${renderColumna('Otros pendientes', otros, 'programados', 'fa-list')}
            </div>
        `}
    `;

    clearInterval(this._pendientesGlobalRefreshTimer);
    this._pendientesGlobalRefreshTimer = setInterval(() => {
        const c = document.getElementById('internamiento-pendientes_global');
        if (!c || c.classList.contains('hidden')) {
            clearInterval(this._pendientesGlobalRefreshTimer);
            return;
        }
        this.loadPendientesGlobalView();
    }, 60000);
};

console.log('Módulo de procedimientos cargado');

