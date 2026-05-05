// ====================================================================
// MÓDULO DE INTERNAMIENTO - FUNCIONES EXTENDIDAS
// ====================================================================
// Extensiones y funcionalidades adicionales del módulo de internamiento
// ====================================================================

// ================================================================
// VISTA DE EVOLUCIÓN COMPLETA
// ================================================================

InternamientoModule.prototype.showEvolucionView = function() {
    if (!this.currentInternamientoId) {
        this.showAlert('No hay internamiento seleccionado', 'Error', 'error');
        return;
    }

    this.showInternamientoView('evolucion');
    this.loadEvolucionView();
};

InternamientoModule.prototype.loadEvolucionView = function() {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    const container = document.getElementById('internamiento-evolucion');
    if (!container) return;

    container.innerHTML = `
        <div class="section-header">
            <h2><i class="fas fa-chart-line"></i> Evolución Completa</h2>
            <button class="btn btn-secondary" onclick="window.internamientoModule.showPanelPrincipal('${this.currentInternamientoId}')">
                <i class="fas fa-arrow-left"></i> Volver al Panel
            </button>
        </div>

        <div style="background: white; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h3 style="color: var(--internamiento-primary); margin-bottom: 20px;"><i class="fas fa-chart-bar"></i> Resumen General</h3>
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                <div class="stats-card">
                    <div class="stats-icon"><i class="fas fa-calendar"></i></div>
                    <div class="stats-value">${internamiento.estadisticas?.totalDias || 0}</div>
                    <div class="stats-label">Días Internado</div>
                </div>
                <div class="stats-card">
                    <div class="stats-icon"><i class="fas fa-clipboard-check"></i></div>
                    <div class="stats-value">${internamiento.estadisticas?.totalTurnos || 0}</div>
                    <div class="stats-label">Turnos Registrados</div>
                </div>
                <div class="stats-card">
                    <div class="stats-icon"><i class="fas fa-pills"></i></div>
                    <div class="stats-value">${internamiento.estadisticas?.totalMedicaciones || 0}</div>
                    <div class="stats-label">Medicaciones</div>
                </div>
                <div class="stats-card">
                    <div class="stats-icon"><i class="fas fa-weight"></i></div>
                    <div class="stats-value">${internamiento.datosIngreso?.pesoIngreso || '--'} kg</div>
                    <div class="stats-label">Peso Ingreso</div>
                </div>
            </div>
        </div>

        <div class="tabs-container">
            <button class="tab-btn active" onclick="window.internamientoModule.showTab('turnos')">
                <i class="fas fa-clipboard-list"></i> Turnos
            </button>
            <button class="tab-btn" onclick="window.internamientoModule.showTab('medicaciones')">
                <i class="fas fa-pills"></i> Medicaciones
            </button>
            <button class="tab-btn" onclick="window.internamientoModule.showTab('notas')">
                <i class="fas fa-notes-medical"></i> Notas Médicas
            </button>
            <button class="tab-btn" onclick="window.internamientoModule.showTab('llamadas')">
                <i class="fas fa-phone"></i> Llamadas
            </button>
        </div>

        <div id="tab-turnos" class="tab-content active">
            ${this.renderTodosLosTurnos(internamiento)}
        </div>

        <div id="tab-medicaciones" class="tab-content">
            ${this.renderHistorialMedicaciones(internamiento)}
        </div>

        <div id="tab-notas" class="tab-content">
            ${this.renderNotasMedicas(internamiento)}
        </div>

        <div id="tab-llamadas" class="tab-content">
            ${typeof this.renderLlamadasEnEvolucion === 'function' ? this.renderLlamadasEnEvolucion(internamiento) : '<div class="empty-state"><i class="fas fa-phone"></i><p>Módulo de llamadas no disponible</p></div>'}
        </div>
    `;
};

InternamientoModule.prototype.showTab = function(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('#internamiento-evolucion .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('#internamiento-evolucion .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar el tab seleccionado
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Activar botón
    event.target.classList.add('active');
};

InternamientoModule.prototype.renderTodosLosTurnos = function(internamiento) {
    const turnos = Object.values(internamiento.turnos || {})
        .sort((a, b) => b.fecha - a.fecha);

    if (turnos.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-clipboard"></i>
                <p>No hay turnos registrados</p>
            </div>
        `;
    }

    return `
        <div class="timeline">
            ${turnos.map(turno => this.renderTurnoDetallado(turno)).join('')}
        </div>
    `;
};

InternamientoModule.prototype.renderTurnoDetallado = function(turno) {
    const fecha = new Date(turno.fecha).toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const hora = new Date(turno.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    return `
        <div class="timeline-item">
            <div class="timeline-item-header">
                <div>
                    <strong style="color: var(--internamiento-secondary); font-size: 1.1rem;">${turno.turno || 'Sin turno'}</strong>
                    <div style="color: #6c757d; font-size: 0.85rem; margin-top: 4px;">${fecha} - ${hora}</div>
                    <div style="color: #6c757d; font-size: 0.85rem;">Por: ${turno.responsableNombre || 'N/A'}</div>
                    ${turno.editado ? `<span class="chip" style="background: #fff3cd; color: #856404; margin-top: 5px;"><i class="fas fa-edit"></i> Editado</span>` : ''}
                </div>
                <div>
                    <button class="btn btn-sm btn-info" onclick="window.internamientoModule.verTurnoDetalle('${turno.turnoId}')">
                        <i class="fas fa-eye"></i> Ver detalle (solo lectura)
                    </button>
                </div>
            </div>
            <div class="timeline-item-content">
                <div class="parametros-vitales-grid">
                    <div class="parametro-item">
                        <span class="parametro-label">Temperatura</span>
                        <span class="parametro-valor ${this.esParametroAlerta('temperatura', turno.parametrosVitales?.temperatura) ? 'alerta' : ''}">
                            ${turno.parametrosVitales?.temperatura || '--'}<span class="parametro-unidad">°C</span>
                        </span>
                    </div>
                    <div class="parametro-item">
                        <span class="parametro-label">FC</span>
                        <span class="parametro-valor">${turno.parametrosVitales?.fc || '--'}<span class="parametro-unidad">lpm</span></span>
                    </div>
                    <div class="parametro-item">
                        <span class="parametro-label">FR</span>
                        <span class="parametro-valor">${turno.parametrosVitales?.fr || '--'}<span class="parametro-unidad">rpm</span></span>
                    </div>
                    <div class="parametro-item">
                        <span class="parametro-label">Peso</span>
                        <span class="parametro-valor">${turno.parametrosVitales?.peso || '--'}<span class="parametro-unidad">kg</span></span>
                    </div>
                    ${turno.parametrosVitales?.presionArterial ? `
                    <div class="parametro-item">
                        <span class="parametro-label">PA</span>
                        <span class="parametro-valor">${turno.parametrosVitales.presionArterial}<span class="parametro-unidad">mmHg</span></span>
                    </div>
                    ` : ''}
                    ${turno.parametrosVitales?.po2 ? `
                    <div class="parametro-item">
                        <span class="parametro-label">PO2</span>
                        <span class="parametro-valor">${turno.parametrosVitales.po2}<span class="parametro-unidad">mmHg</span></span>
                    </div>
                    ` : ''}
                </div>
                ${turno.observaciones ? `
                    <div style="margin-top: 15px; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid var(--internamiento-info);">
                        <strong style="color: var(--internamiento-primary);"><i class="fas fa-comment"></i> Observaciones:</strong>
                        <p style="margin: 8px 0 0 0; color: #555;">${turno.observaciones}</p>
                    </div>
                ` : ''}
                ${turno.alertasAutomaticas && turno.alertasAutomaticas.length > 0 ? `
                    <div style="margin-top: 10px;">
                        ${turno.alertasAutomaticas.map(alerta => `
                            <span class="chip" style="background: #fee; color: #c00;">
                                <i class="fas fa-exclamation-triangle"></i> ${this.traducirAlerta(alerta)}
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
};

InternamientoModule.prototype.esParametroAlerta = function(tipo, valor) {
    if (!valor) return false;
    
    const rangos = {
        temperatura: { min: 37, max: 39.5 }
    };
    
    const rango = rangos[tipo];
    if (!rango) return false;
    
    return valor < rango.min || valor > rango.max;
};

InternamientoModule.prototype.traducirAlerta = function(alerta) {
    const traducciones = {
        'temperatura_baja': 'Temperatura Baja',
        'temperatura_elevada': 'Temperatura Elevada',
        'fc_baja': 'FC Baja',
        'fc_elevada': 'FC Elevada',
        'fr_baja': 'FR Baja',
        'fr_elevada': 'FR Elevada',
        'deshidratacion_severa': 'Deshidratación Severa',
        'mucosas_anormales': 'Mucosas Anormales',
        'presion_arterial_baja': 'Presión Arterial Baja',
        'presion_arterial_alta': 'Presión Arterial Alta',
        'hipoxemia': 'Hipoxemia (PO2 Bajo)',
        'sin_ingesta_agua': 'Sin Ingesta de Agua',
        'sin_apetito': 'Sin Apetito',
        'vomitos': 'Vómitos',
        // Defecación - Escala Bristol
        'estrenimiento_severo': 'Estreñimiento Severo (Bristol Tipo 1)',
        'diarrea_moderada': 'Diarrea Moderada (Bristol Tipo 6)',
        'diarrea_severa': 'Diarrea Severa (Bristol Tipo 7)',
        // Micción
        'hematuria': 'Hematuria (Sangre en Orina)',
        'orina_oscura': 'Orina Oscura',
        'oliguria': 'Oliguria (Orina Disminuida)',
        'anuria': 'Anuria (Sin Orina)',
        // Micción
        'hematuria': 'Sangre en Orina (Hematuria)',
        'anuria': 'No Orina (Anuria) - EMERGENCIA',
        'oliguria': 'Orina Disminuida (Oliguria)'
    };
    
    return traducciones[alerta] || alerta;
};

InternamientoModule.prototype.renderHistorialMedicaciones = function(internamiento) {
    const medicamentos = Object.values(internamiento.planTerapeutico?.medicamentos || {});
    
    if (medicamentos.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-pills"></i>
                <p>No hay medicamentos registrados</p>
            </div>
        `;
    }

    return `
        <div style="background: white; padding: 20px; border-radius: 12px;">
            ${medicamentos.map(med => `
                <div style="margin-bottom: 25px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${med.estadoMedicamento === 'activo' ? '#ffc107' : '#95a5a6'};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <div>
                            <h4 style="margin: 0; color: var(--internamiento-primary);">${med.nombreComercial || 'Sin nombre'}</h4>
                            ${med.principioActivo ? `<p style="margin: 4px 0; color: #6c757d; font-size: 0.9rem;">${med.principioActivo}</p>` : ''}
                        </div>
                        <span class="badge-estado-${med.estadoMedicamento === 'activo' ? 'activo' : 'egresado'}">
                            ${med.estadoMedicamento === 'activo' ? 'Activo' : med.estadoMedicamento}
                        </span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 15px;">
                        <div>
                            <strong style="color: #6c757d; font-size: 0.85rem;">Dosis:</strong>
                            <div>${med.dosisCalculada || med.dosis}</div>
                        </div>
                        <div>
                            <strong style="color: #6c757d; font-size: 0.85rem;">Vía:</strong>
                            <div>${med.viaAdministracion}</div>
                        </div>
                        <div>
                            <strong style="color: #6c757d; font-size: 0.85rem;">Frecuencia:</strong>
                            <div>Cada ${med.frecuenciaHoras}h</div>
                        </div>
                        <div>
                            <strong style="color: #6c757d; font-size: 0.85rem;">Prescrito por:</strong>
                            <div>${med.prescritoNombre || 'N/A'}</div>
                        </div>
                    </div>
                    ${Object.keys(med.administraciones || {}).length > 0 ? `
                        <div>
                            <strong style="color: var(--internamiento-primary);">Administraciones (${Object.keys(med.administraciones).length}):</strong>
                            <div class="progress-bar" style="margin: 10px 0;">
                                <div class="progress-fill" style="width: ${this.calcularPorcentajeAdministraciones(med)}%"></div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
};

InternamientoModule.prototype.calcularPorcentajeAdministraciones = function(medicamento) {
    const administraciones = Object.values(medicamento.administraciones || {});
    const administradas = administraciones.filter(a => a.estado === 'administrado').length;
    return administraciones.length > 0 ? Math.round((administradas / administraciones.length) * 100) : 0;
};

InternamientoModule.prototype.renderNotasMedicas = function(internamiento) {
    const notas = Object.values(internamiento.notasEvolucion || {})
        .sort((a, b) => b.fecha - a.fecha);

    return `
        <div style="background: white; padding: 20px; border-radius: 12px;">
            <div style="margin-bottom: 20px;">
                <button class="btn btn-primary" onclick="window.internamientoModule.agregarNotaEvolucion()">
                    <i class="fas fa-plus"></i> Agregar Nota Médica
                </button>
            </div>
            
            ${notas.length === 0 ? `
                <div class="empty-state">
                    <i class="fas fa-notes-medical"></i>
                    <p>No hay notas de evolución registradas</p>
                </div>
            ` : `
                ${notas.map(nota => `
                    <div class="sticky-note" style="margin-bottom: 20px;">
                        <div style="margin-bottom: 10px;">
                            <strong style="color: var(--internamiento-primary);">${nota.medicoNombre || 'Médico'}</strong>
                            <div style="font-size: 0.85rem; color: #6c757d;">
                                ${new Date(nota.fecha).toLocaleString('es-ES')}
                            </div>
                        </div>
                        <div style="white-space: pre-wrap; line-height: 1.6;">${nota.contenido}</div>
                        ${nota.importante ? '<span class="priority-tag priority-alta">Importante</span>' : ''}
                    </div>
                `).join('')}
            `}
        </div>
    `;
};

// ================================================================
// CAMBIO DE ESTADOS
// ================================================================

InternamientoModule.prototype.cambiarEstado = async function(nuevoEstado) {
    if (!this.currentInternamientoId) {
        this.showAlert('No hay internamiento seleccionado', 'Error', 'error');
        return;
    }

    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    const estadoActual = internamiento.estado?.actual;

    // Validaciones
    if (estadoActual === 'egresado') {
        this.showAlert('No se puede cambiar el estado de un internamiento egresado', 'Acción Bloqueada', 'error');
        return;
    }

    // Confirmar cambio
    let confirmMessage = '';
    let confirmTitle = '';
    let requiereRazon = false;
    let icon = 'fa-exchange-alt';
    let iconColor = '#3498db';

    switch(nuevoEstado) {
        case 'critico':
            confirmMessage = '¿Marcar este paciente como CRÍTICO?\n\nEsto activará alertas especiales y monitoreo intensivo.';
            confirmTitle = 'Cambiar a CRÍTICO';
            requiereRazon = true;
            icon = 'fa-exclamation-triangle';
            iconColor = '#e74c3c';
            break;
        case 'activo':
            confirmMessage = '¿Cambiar estado a ACTIVO (estable)?\n\nSe desactivarán las alertas de estado crítico.';
            confirmTitle = 'Cambiar a ACTIVO';
            requiereRazon = true;
            icon = 'fa-heartbeat';
            iconColor = '#27ae60';
            break;
        case 'alta':
            confirmMessage = '¿Autorizar ALTA MÉDICA para este paciente?\n\nSe bloquearán turnos y medicación.';
            confirmTitle = 'Autorizar Alta';
            requiereRazon = false;
            icon = 'fa-check-circle';
            iconColor = '#f39c12';
            break;
    }

    const confirmar = await this.showConfirm(confirmMessage, confirmTitle, { 
        confirmText: 'Confirmar', 
        cancelText: 'Cancelar',
        icon: icon,
        iconColor: iconColor
    });
    
    if (!confirmar) return;

    let razon = '';
    if (requiereRazon) {
        razon = await this.showPrompt('Razón del cambio de estado:', 'Motivo del Cambio', '', true);
        if (!razon) {
            this.showNotification('Debe proporcionar una razón para el cambio de estado', 'warning');
            return;
        }
    }

    this.actualizarEstadoInternamiento(this.currentInternamientoId, nuevoEstado, razon);
};

InternamientoModule.prototype.actualizarEstadoInternamiento = async function(internamientoId, nuevoEstado, razon) {
    const userId = sessionStorage.getItem('userId');
    const userName = sessionStorage.getItem('userName');

    const updates = {};
    updates['estado/actual'] = nuevoEstado;
    updates['estado/fechaCambio'] = Date.now();
    updates['estado/cambiadoPor'] = userId;
    updates['estado/razonCambio'] = razon || `Cambio a ${nuevoEstado}`;
    updates['metadata/fechaUltimaActualizacion'] = Date.now();

    try {
        const internamientoRef = this.internamientosRef.child(internamientoId);
        await internamientoRef.update(updates);

        // Agregar a historial de estados
        await internamientoRef.child('estado/historialEstados').push({
            estado: nuevoEstado,
            fecha: Date.now(),
            usuario: userId,
            usuarioNombre: userName,
            razon: razon || `Cambio a ${nuevoEstado}`
        });

        // Agregar a auditoría
        await internamientoRef.child('auditoria/historialCambios').push({
            timestamp: Date.now(),
            userId: userId,
            usuarioNombre: userName,
            accion: 'cambiar_estado',
            detalles: {
                estadoAnterior: this.internamientos.get(internamientoId)?.estado?.actual,
                estadoNuevo: nuevoEstado,
                razon: razon
            }
        });

        this.showNotification(`Estado cambiado a: ${nuevoEstado.toUpperCase()}`, 'success');
        this.loadPanelPrincipal(internamientoId);
    } catch (error) {
        console.error('Error cambiando estado:', error);
        this.showAlert('Error al cambiar estado: ' + error.message, 'Error', 'error');
    }
};

// ================================================================
// VER DETALLE DE TURNO
// ================================================================

InternamientoModule.prototype.verTurnoDetalle = function(turnoId) {
    const internamiento = this.internamientos.get(this.currentInternamientoId);
    if (!internamiento) return;

    const turno = internamiento.turnos?.[turnoId];
    if (!turno) {
        this.showAlert('Turno no encontrado', 'Error', 'error');
        return;
    }

    const modalContent = this.renderTurnoDetalleModal(turno);
    const modal = this.createModal('Detalle del Turno (solo lectura)', modalContent);
    document.body.appendChild(modal);
};

InternamientoModule.prototype.renderTurnoDetalleModal = function(turno) {
    const fecha = new Date(turno.fecha).toLocaleString('es-ES');
    const pv = turno.parametrosVitales || {};
    const eg = turno.estadoGeneral || {};
    const flu = turno.fluidoterapia || {};
    const v = (val) => (val !== undefined && val !== null && val !== '') ? val : '—';
    const vb = (val) => (val === true || val === 'true') ? 'Sí' : (val === false || val === 'false') ? 'No' : v(val);

    const parametrosVitalesKeys = ['peso', 'fc', 'fr', 'temperatura', 'tllc', 'deshidratacion', 'mucosas', 'via', 'tiempoVia', 'sonda', 'tiempoSonda', 'parametrosPulmonares', 'presionArterial', 'po2'];
    const estadoGeneralKeys = ['estadoMental', 'nivelDolor', 'glasgowPuntaje', 'ingestaAgua', 'cantidadAgua', 'apetito', 'alimentoCantidad', 'alimentoTipo', 'defecacion', 'defecacionNotas', 'miccion', 'miccionColor', 'miccionFrecuencia', 'miccionVolumen', 'miccionNotas', 'vomitos', 'descripcionVomitos'];

    const parametrosHTML = parametrosVitalesKeys.map(key => {
        const val = pv[key];
        const display = key === 'mucosas' ? (this.formatearMucosas(val) || '—') : (key === 'via' ? (this.formatearVia(val) || '—') : (key === 'sonda' ? (this.formatearSonda(val) || '—') : v(val)));
        return `<div class="parametro-item"><span class="parametro-label">${this.traducirParametro(key)}</span><span class="parametro-valor">${display}</span></div>`;
    }).join('');

    const estadoGeneralHTML = estadoGeneralKeys.map(key => {
        const val = eg[key];
        const display = key === 'defecacion' ? (this.formatearDefecacion(val) || '—') : (key === 'miccionColor' ? (this.formatearMiccionColor(val) || '—') : (key === 'miccionFrecuencia' ? (this.formatearMiccionFrecuencia(val) || '—') : (key === 'nivelDolor' ? (this.formatearNivelDolor(val) || '—') : (key === 'estadoMental' ? (this.formatearEstadoMental(val) || '—') : vb(val)))));
        return `<div class="turno-detalle-fila"><span class="label">${this.traducirCampo(key)}</span><span class="value">${display}</span></div>`;
    }).join('');

    return `
        <div class="turno-detalle-modal">
            <div class="turno-detalle-header">
                <div class="turno-detalle-header-icon"><i class="fas fa-clipboard-list"></i></div>
                <div class="turno-detalle-header-info">
                    <h3>${turno.turno || 'Sin turno'}</h3>
                    <div class="meta"><i class="fas fa-calendar-alt" style="margin-right:6px;"></i>${fecha}</div>
                    <div class="meta"><i class="fas fa-user-nurse" style="margin-right:6px;"></i>${turno.responsableNombre || 'N/A'}</div>
                </div>
                <span class="turno-detalle-header-badge"><i class="fas fa-eye"></i> Solo lectura</span>
            </div>

            <div class="turno-detalle-section turno-vitales">
                <h4 class="turno-detalle-section-title"><i class="fas fa-heartbeat"></i> Parámetros vitales</h4>
                <div class="parametros-vitales-grid">
                    ${parametrosHTML}
                </div>
            </div>

            <div class="turno-detalle-section">
                <h4 class="turno-detalle-section-title"><i class="fas fa-stethoscope"></i> Estado general</h4>
                <div class="turno-detalle-estado-grid">${estadoGeneralHTML}</div>
            </div>

            <div class="turno-detalle-section turno-detalle-fluidoterapia">
                <h4 class="turno-detalle-section-title"><i class="fas fa-tint"></i> Fluidoterapia</h4>
                <div class="turno-detalle-fila"><span class="label">¿Administrada?</span><span class="value">${flu.administrada ? 'Sí' : 'No'}</span></div>
                ${flu.administrada ? `
                <div class="turno-detalle-fila"><span class="label">Tipo</span><span class="value">${v(this.formatearFluidoTipo(flu.tipo))}</span></div>
                <div class="turno-detalle-fila"><span class="label">Frecuencia / Velocidad</span><span class="value">${v(flu.frecuencia)}</span></div>
                ` : ''}
            </div>

            ${turno.alertasAutomaticas && turno.alertasAutomaticas.length > 0 ? `
            <div class="turno-detalle-section turno-detalle-alertas">
                <h4 class="turno-detalle-section-title"><i class="fas fa-exclamation-triangle"></i> Alertas automáticas</h4>
                ${turno.alertasAutomaticas.map(a => `<span class="chip"><i class="fas fa-exclamation-triangle"></i> ${this.traducirAlerta(a)}</span>`).join('')}
            </div>
            ` : ''}

            <div class="turno-detalle-section">
                <h4 class="turno-detalle-section-title"><i class="fas fa-comment-dots"></i> Observaciones</h4>
                <div class="turno-detalle-observaciones">
                    ${turno.observaciones ? turno.observaciones.replace(/</g, '&lt;') : '—'}
                </div>
            </div>
        </div>
    `;
};

InternamientoModule.prototype.formatearMucosas = function(val) {
    if (val === undefined || val === null || val === '') return '';
    const map = { rosadas: 'Rosadas (Normal)', palidas: 'Pálidas', ictericas: 'Ictéricas', cianoticas: 'Cianóticas', congestivas: 'Congestivas' };
    return map[val] || val;
};
InternamientoModule.prototype.formatearVia = function(val) {
    if (val === undefined || val === null || val === '') return '';
    const map = { no_tiene_via: 'No tiene vía', ev_periferica: 'EV periférica', ev_yugular: 'EV yugular', ev_cefalica: 'EV cefálica', sin_cambios: 'Sin cambios', nueva: 'Nueva' };
    return map[val] || val;
};
InternamientoModule.prototype.formatearSonda = function(val) {
    if (val === undefined || val === null || val === '') return '';
    const map = { no_tiene_sonda: 'No tiene sonda', sonda_vesical: 'Sonda vesical', sonda_esofagica: 'Sonda esofágica', sin_cambios: 'Sin cambios', nueva: 'Nueva' };
    return map[val] || val;
};
InternamientoModule.prototype.formatearDefecacion = function(val) {
    if (val === undefined || val === null || val === '') return '';
    const map = { bristol_1: 'Tipo 1 (Bolas duras)', bristol_2: 'Tipo 2', bristol_3: 'Tipo 3', bristol_4: 'Tipo 4 (Normal)', bristol_5: 'Tipo 5', bristol_6: 'Tipo 6', bristol_7: 'Tipo 7 (Acuosa)', no_defeco: 'No defecó' };
    return map[val] || val;
};
InternamientoModule.prototype.formatearMiccionColor = function(val) {
    if (val === undefined || val === null || val === '') return '';
    const map = { amarillo_claro: 'Amarillo claro', amarillo: 'Amarillo', amarillo_oscuro: 'Amarillo oscuro', marron: 'Marrón', rojo: 'Rojo (hematuria)' };
    return map[val] || val;
};
InternamientoModule.prototype.formatearMiccionFrecuencia = function(val) {
    if (val === undefined || val === null || val === '') return '';
    const map = { normal: 'Normal', aumentada: 'Aumentada (poliuria)', disminuida: 'Disminuida' };
    return map[val] || val;
};
InternamientoModule.prototype.formatearNivelDolor = function(val) {
    if (val === undefined || val === null || val === '') return '';
    const map = { sin_dolor: 'Sin dolor', leve: 'Leve', moderado: 'Moderado', severo: 'Severo' };
    return map[val] || val;
};
InternamientoModule.prototype.formatearEstadoMental = function(val) {
    if (val === undefined || val === null || val === '') return '';
    const map = { alerta: 'Alerta', tranquilo: 'Tranquilo', deprimido: 'Deprimido', excitado: 'Excitado', agresivo: 'Agresivo' };
    return map[val] || val;
};
InternamientoModule.prototype.formatearFluidoTipo = function(val) {
    if (val === undefined || val === null || val === '') return '';
    const map = { ringer_lactato: 'Ringer Lactato', solucion_salina: 'Solución Salina', dextrosa_5: 'Dextrosa 5%', otro: 'Otro' };
    return map[val] || val;
};

InternamientoModule.prototype.traducirParametro = function(key) {
    const traducciones = {
        'peso': 'Peso (kg)',
        'fc': 'FC (lpm)',
        'fr': 'FR (rpm)',
        'temperatura': 'Temperatura (°C)',
        'tllc': 'TLLC (seg)',
        'deshidratacion': 'Deshidratación (%)',
        'mucosas': 'Mucosas',
        'via': 'Vía',
        'tiempoVia': 'Tiempo de vía',
        'sonda': 'Sonda',
        'tiempoSonda': 'Tiempo de sonda',
        'parametrosPulmonares': 'Parámetros pulmonares',
        'presionArterial': 'Presión Arterial (mmHg)',
        'po2': 'PO2 (mmHg)'
    };
    return traducciones[key] || key;
};

InternamientoModule.prototype.traducirCampo = function(key) {
    const traducciones = {
        'estadoMental': 'Estado Mental',
        'nivelDolor': 'Nivel de Dolor',
        'glasgowPuntaje': 'Glasgow (puntaje)',
        'ingestaAgua': 'Ingesta de Agua',
        'cantidadAgua': 'Cantidad de Agua (ml)',
        'apetito': 'Apetito',
        'alimentoCantidad': 'Cantidad de Alimento',
        'alimentoTipo': 'Tipo de Alimento',
        'defecacion': 'Defecación (Bristol)',
        'defecacionNotas': 'Notas defecación',
        'miccion': 'Micción',
        'miccionColor': 'Color orina',
        'miccionFrecuencia': 'Frecuencia micción',
        'miccionVolumen': 'Volumen orina (ml)',
        'miccionNotas': 'Notas micción',
        'vomitos': 'Vómitos',
        'descripcionVomitos': 'Descripción vómitos',
        'diarreas': 'Diarreas',
        'descripcionDiarreas': 'Descripción Diarreas'
    };
    return traducciones[key] || key;
};

InternamientoModule.prototype.formatearValor = function(value) {
    if (typeof value === 'boolean') {
        return value ? 'Sí' : 'No';
    }
    return value || 'No especificado';
};

// ================================================================
// AGREGAR NOTA DE EVOLUCIÓN
// ================================================================

InternamientoModule.prototype.agregarNotaEvolucion = async function() {
    const contenido = await this.showPrompt('Ingrese la nota de evolución:', 'Nueva Nota Médica', '', true);
    if (!contenido || contenido.trim() === '') return;

    const importante = await this.showConfirm(
        '¿Marcar esta nota como importante?',
        'Nota Importante',
        { confirmText: 'Sí, marcar', cancelText: 'No', icon: 'fa-star', iconColor: '#f39c12' }
    );

    this.guardarNotaEvolucion(contenido.trim(), importante);
};

InternamientoModule.prototype.guardarNotaEvolucion = async function(contenido, importante) {
    const userId = sessionStorage.getItem('userId');
    const userName = sessionStorage.getItem('userName');

    const notaId = 'nota_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const notaData = {
        notaId: notaId,
        fecha: Date.now(),
        medico: userId,
        medicoNombre: userName,
        contenido: contenido,
        importante: importante
    };

    try {
        const internamientoRef = this.internamientosRef.child(this.currentInternamientoId);
        await internamientoRef.child(`notasEvolucion/${notaId}`).set(notaData);
        
        this.showNotification('Nota de evolución guardada', 'success');
        this.loadEvolucionView(); // Recargar vista
    } catch (error) {
        console.error('Error guardando nota:', error);
        this.showAlert('Error al guardar nota: ' + error.message, 'Error', 'error');
    }
};

console.log('Funciones extendidas de internamiento cargadas');

