// ====================================================================
// MÓDULO DE INTERNAMIENTO - GESTIÓN DE PROCEDIMIENTOS Y TAREAS
// ====================================================================

// ================================================================
// VISTA DE PROCEDIMIENTOS
// ================================================================

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
    const totalProcedimientos = procedimientos.length;
    const porcentajeCompletado = totalProcedimientos > 0 ? Math.round((completados.length / totalProcedimientos) * 100) : 0;

    container.innerHTML = `
        <div class="section-header">
            <h2><i class="fas fa-tasks"></i> Procedimientos y Tareas</h2>
            <div>
                ${!bloqueado ? `
                    <button class="btn btn-primary" onclick="window.internamientoModule.agregarProcedimiento()">
                        <i class="fas fa-plus"></i> Nueva Tarea
                    </button>
                ` : ''}
                <button class="btn btn-secondary" onclick="window.internamientoModule.showPanelPrincipal('${this.currentInternamientoId}')" style="margin-left: 10px;">
                    <i class="fas fa-arrow-left"></i> Volver al Panel
                </button>
            </div>
        </div>

        ${bloqueado ? `
            <div class="alert-box warning">
                <i class="fas fa-lock"></i>
                <div><strong>Solo Lectura</strong> - El internamiento está egresado, no se pueden agregar procedimientos.</div>
            </div>
        ` : ''}

        <!-- Barra de progreso general -->
        <div style="background: white; padding: 25px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: var(--internamiento-primary);">
                    <i class="fas fa-chart-line"></i> Progreso General
                </h3>
                <span style="font-size: 1.5rem; font-weight: 700; color: var(--internamiento-secondary);">
                    ${porcentajeCompletado}%
                </span>
            </div>
            <div class="progress-bar" style="height: 20px; margin-bottom: 10px;">
                <div class="progress-fill" style="width: ${porcentajeCompletado}%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.85rem; font-weight: 600;">
                    ${porcentajeCompletado > 10 ? `${completados.length} / ${totalProcedimientos}` : ''}
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #6c757d;">
                <span><i class="fas fa-check-circle" style="color: var(--internamiento-success);"></i> ${completados.length} completados</span>
                <span><i class="fas fa-clock" style="color: var(--internamiento-warning);"></i> ${pendientes.length} pendientes</span>
            </div>
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

        <!-- Lista de procedimientos -->
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
        const bloqueado = internamiento.estado?.actual === 'egresado';
        container.innerHTML = this.renderListaProcedimientos(filtrados, tipo, bloqueado);
    }
};

InternamientoModule.prototype.renderListaProcedimientos = function(procedimientos, tipo, bloqueado) {
    if (procedimientos.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-tasks"></i>
                <p>No hay procedimientos ${tipo !== 'todos' ? tipo : 'registrados'}</p>
            </div>
        `;
    }

    // Ordenar: pendientes primero, luego por fecha
    const ordenados = [...procedimientos].sort((a, b) => {
        if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
        if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
        return b.fechaCreacion - a.fechaCreacion;
    });

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
    const fechaCreacion = new Date(proc.fechaCreacion).toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
    const bgStyle = paraFernanda ? 'background: #fce4ec; border-left: 4px solid #ec407a;' : '';

    return `
        <li class="procedimiento-item ${completado ? 'completado' : ''} ${paraFernanda ? 'procedimiento-para-fernanda' : ''}" style="padding: 18px; border-bottom: 1px solid #e0e0e0; transition: all 0.3s ease; ${bgStyle}">
            <div style="display: flex; align-items: start; gap: 15px;">
                <!-- Checkboxes -->
                <div style="flex-shrink: 0; display: flex; align-items: center; gap: 6px; padding-top: 2px;">
                    <input type="checkbox" 
                           class="procedimiento-checkbox"
                           ${completado ? 'checked' : ''} 
                           ${bloqueado || completado ? 'disabled' : ''}
                           onchange="window.internamientoModule.toggleProcedimiento('${proc.procedimientoId}')"
                           title="${completado ? 'Completado (no se puede desmarcar)' : 'Marcar como completado'}"
                           style="width: 20px; height: 20px; cursor: ${bloqueado || completado ? 'not-allowed' : 'pointer'};">
                    <label style="font-size: 0.75rem; color: #6c757d; white-space: nowrap;">Completado</label>
                </div>

                <!-- Contenido -->
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;">
                        <span style="font-size: 1.05rem; font-weight: 600; color: ${completado ? '#95a5a6' : 'var(--internamiento-primary)'}; ${completado ? 'text-decoration: line-through;' : ''}">
                            ${proc.descripcion}
                        </span>
                        ${this.renderChipOrigenItem(proc)}
                        ${paraFernanda ? `<span class="chip" style="background: #f8bbd0; color: #c2185b; font-size: 0.8rem;"><i class="fas fa-user-check"></i> FERNANDA</span>` : ''}
                        ${urgente && !completado ? `<span class="priority-tag priority-alta"><i class="fas fa-exclamation-circle"></i> Urgente</span>` : ''}
                        ${proc.tipo ? `<span class="chip" style="background: #e3f2fd; color: #1976d2; font-size: 0.8rem;">${this.traducirTipoProcedimiento(proc.tipo)}</span>` : ''}
                    </div>
                    
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
        'otro': 'Otro'
    };
    return tipos[tipo] || tipo;
};

// ================================================================
// AGREGAR PROCEDIMIENTO
// ================================================================

InternamientoModule.prototype.agregarProcedimiento = function() {
    // Solo mostrar "Es para FERNANDA" cuando se agrega desde un internamiento ya creado (Procedimientos y tareas), no en Nuevo internamiento
    const mostrarOpcionFernanda = !!this.currentInternamientoId;

    const modalContent = `
        <form id="formAgregarProcedimiento">
            <div class="form-group">
                <label>Tipo de Procedimiento *</label>
                <select id="procTipo" required>
                    <option value="">Seleccionar...</option>
                    <option value="examen"><i class="fas fa-microscope"></i> Examen de Laboratorio</option>
                    <option value="imagen"><i class="fas fa-x-ray"></i> Estudio de Imagen (Rx, Eco, etc.)</option>
                    <option value="curacion"><i class="fas fa-band-aid"></i> Curación / Tratamiento de Heridas</option>
                    <option value="terapia"><i class="fas fa-tint"></i> Terapia / Tratamiento Especial</option>
                    <option value="cirugia"><i class="fas fa-cut"></i> Procedimiento Quirúrgico</option>
                    <option value="otro"><i class="fas fa-clipboard-list"></i> Otro</option>
                </select>
            </div>

            <div class="form-group">
                <label>Descripción del Procedimiento *</label>
                <input type="text" id="procDescripcion" required placeholder="Ej: Hemograma completo">
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
                    <i class="fas fa-plus"></i> Agregar
                </button>
            </div>
        </form>
    `;

    const modal = this.createModal('Nueva Tarea / Procedimiento', modalContent);
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

    const procData = {
        tipo: document.getElementById('procTipo')?.value || '',
        descripcion: document.getElementById('procDescripcion')?.value.trim() || '',
        prioridad: document.getElementById('procPrioridad')?.value || 'normal',
        observaciones: document.getElementById('procObservaciones')?.value.trim() || '',
        marcarCompletado: document.getElementById('procMarcarCompletado')?.checked || false,
        paraFernanda: document.getElementById('procParaFernanda')?.checked || false,
        puestoPorConsultaExterna: !!origenFlags.puestoPorConsultaExterna,
        puestoPorInternos: !!origenFlags.puestoPorInternos
    };

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
        this.loadProcedimientosView();
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
        tipo: data.tipo,
        descripcion: data.descripcion,
        prioridad: data.prioridad,
        observaciones: data.observaciones,
        paraFernanda: !!data.paraFernanda,
        // Procedimientos agregados desde este flujo (panel de internamiento) nunca son de consulta externa
        puestoPorConsultaExterna: false,
        estado: data.marcarCompletado ? 'completado' : 'pendiente',
        fechaCreacion: Date.now(),
        creadoPor: userId,
        creadoNombre: userName,
        creadoCodigoVerificado: !!codigoResult,
        fechaCompletado: data.marcarCompletado ? Date.now() : null,
        completadoPor: data.marcarCompletado ? userId : null,
        completadoNombre: data.marcarCompletado ? userName : null,
        // REPORTADO
        reportado: false,
        reportadoA: null,
        fechaReportado: null,
        reportadoPor: null,
        reportadoNombre: null,
        observacionesReporte: '',
        resultadoId: null,
        documentosAdjuntos: []
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

InternamientoModule.prototype.toggleProcedimiento = async function(procedimientoId) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    const procedimiento = internamiento.procedimientos?.[procedimientoId];
    if (!procedimiento) return;

    if (procedimiento.estado === 'completado') {
        return;
    }

    const nuevoEstado = 'completado';
    const confirmar = await this.showConfirm(
        '¿Estás seguro de marcar esta acción como completado? Una vez marcado ya no se podrá cambiar su estado.',
        'Confirmar completado',
        { confirmText: 'Sí, marcar completado', cancelText: 'Cancelar', icon: 'fa-check-circle', iconColor: '#27ae60' }
    );
    if (!confirmar) {
        this.loadProcedimientosView(internamiento.estado?.actual === 'egresado');
        return;
    }

    let completadoPorId = null;
    let completadoPorNombre = null;

    {
        const resultadoCodigo = await this.verificarCodigoAsistente('completar_procedimiento');
        if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
            this.loadProcedimientosView(internamiento.estado?.actual === 'egresado');
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

        this.loadProcedimientosView(internamiento.estado?.actual === 'egresado');
        if (nuevoEstado === 'completado') this.showNotification('Completado por ' + completadoPorNombre, 'success');
    } catch (error) {
        console.error('Error actualizando procedimiento:', error);
        alert('Error: ' + error.message);
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

    const updates = {};
    updates[`procedimientos/${procedimientoId}/descripcion`] = descripcion;
    updates[`procedimientos/${procedimientoId}/prioridad`] = document.getElementById('editProcPrioridad')?.value || 'normal';
    updates[`procedimientos/${procedimientoId}/observaciones`] = document.getElementById('editProcObservaciones')?.value.trim() || '';
    updates[`procedimientos/${procedimientoId}/paraFernanda`] = document.getElementById('editProcParaFernanda')?.checked || false;
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
        this.loadProcedimientosView();
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
        this.loadProcedimientosView();
    } catch (error) {
        console.error('Error eliminando procedimiento:', error);
        this.showAlert('Error al eliminar procedimiento: ' + error.message, 'Error', 'error');
    }
};

console.log('Módulo de procedimientos cargado');

