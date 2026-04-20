// Control de RX y Presupuestos - Módulo administrativo
(function () {
    'use strict';

    // Palabras clave para detectar RX / Rayos X
    const RX_KEYWORDS = [
        'rx', 'r.x', 'rayos x', 'rayos-x', 'radiografia', 'radiografía',
        'rx control', 'rx de control', 'control rx', 'rx torax', 'rx tórax',
        'rx columna', 'rx abdomen', 'rx pelvis', 'rx miembro', 'rx craneo',
        'rx cráneo', 'placa radiografica', 'placa radiográfica', 'placa rx',
        'toma de rx', 'toma de placa', 'placas rx', 'estudio rx',
        'radiologia', 'radiología'
    ];

    // Palabras clave para detectar Presupuestos
    const PRESUPUESTO_KEYWORDS = [
        'presupuesto', 'cotizacion', 'cotización', 'proforma', 'estimado',
        'propuesta economica', 'propuesta económica'
    ];

    // Detecta qué tipo de item es una línea de texto
    function detectarTipo(texto) {
        const lower = (texto || '').toLowerCase();
        const esRX = RX_KEYWORDS.some(k => lower.includes(k));
        const esPresupuesto = PRESUPUESTO_KEYWORDS.some(k => lower.includes(k));
        if (esRX && esPresupuesto) return 'ambos';
        if (esRX) return 'rx';
        if (esPresupuesto) return 'presupuesto';
        return null;
    }

    // Extrae líneas relevantes del campo porCobrar de un ticket
    function extraerItems(ticket) {
        if (!ticket || !ticket.porCobrar) return [];

        const lines = ticket.porCobrar.split('\n');
        const items = [];

        lines.forEach(function (line, idx) {
            const trimmed = line.trim();
            if (!trimmed) return;
            const tipo = detectarTipo(trimmed);
            if (tipo) {
                items.push({
                    lineIndex: idx,
                    texto: trimmed,
                    tipo: tipo,
                    firebaseKey: ticket.firebaseKey,
                    ticketId: ticket.id,
                    paciente: ticket.mascota || 'N/A',
                    cliente: ticket.nombre || 'N/A',
                    fechaConsulta: ticket.fechaConsulta || ''
                });
            }
        });

        // Si no se encontró ninguna línea específica pero el bloque completo coincide
        if (items.length === 0) {
            const tipo = detectarTipo(ticket.porCobrar);
            if (tipo) {
                items.push({
                    lineIndex: 0,
                    texto: ticket.porCobrar.trim().substring(0, 300),
                    tipo: tipo,
                    firebaseKey: ticket.firebaseKey,
                    ticketId: ticket.id,
                    paciente: ticket.mascota || 'N/A',
                    cliente: ticket.nombre || 'N/A',
                    fechaConsulta: ticket.fechaConsulta || ''
                });
            }
        }

        return items;
    }

    // Escapa HTML para evitar XSS
    function esc(text) {
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(text || ''));
        return d.innerHTML;
    }

    // Genera el badge visual según el tipo
    function tipoBadge(tipo) {
        if (tipo === 'rx') {
            return '<span class="rx-tipo-badge rx-tipo-rx"><i class="fas fa-radiation"></i> Rayos X</span>';
        }
        if (tipo === 'presupuesto') {
            return '<span class="rx-tipo-badge rx-tipo-presupuesto"><i class="fas fa-file-invoice-dollar"></i> Presupuesto</span>';
        }
        return '<span class="rx-tipo-badge rx-tipo-ambos"><i class="fas fa-layer-group"></i> RX + Presupuesto</span>';
    }

    // Actualiza los contadores del resumen
    function actualizarResumen() {
        const rows = document.querySelectorAll('#rxPresupuestosBody tr[data-check-key]');
        let checkedCount = 0;
        rows.forEach(function (row) {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) checkedCount++;
        });
        const total = rows.length;
        const pending = total - checkedCount;

        const elTotal = document.getElementById('rxTotalCount');
        const elChecked = document.getElementById('rxCheckedCount');
        const elPending = document.getElementById('rxPendingCount');
        const summaryBar = document.getElementById('rxSummaryBar');

        if (elTotal) elTotal.textContent = total;
        if (elChecked) elChecked.textContent = checkedCount;
        if (elPending) elPending.textContent = pending;
        if (summaryBar) summaryBar.style.display = total > 0 ? 'flex' : 'none';
    }

    // Carga y renderiza la lista de RX/Presupuestos para la fecha seleccionada
    async function cargarControl() {
        const fechaInput = document.getElementById('fechaRxPresupuestos');
        const fecha = fechaInput ? fechaInput.value : '';
        const tbody = document.getElementById('rxPresupuestosBody');
        const countBadge = document.getElementById('rxPresupuestosCount');

        if (!tbody) return;

        if (!fecha) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#e74c3c; font-weight:600;"><i class="fas fa-exclamation-circle"></i> Por favor seleccione una fecha</td></tr>';
            return;
        }

        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#666;"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem; margin-bottom:8px; display:block;"></i> Cargando datos...</td></tr>';
        if (countBadge) countBadge.style.display = 'none';
        const summaryBar = document.getElementById('rxSummaryBar');
        if (summaryBar) summaryBar.style.display = 'none';

        // Obtener tickets del día de window.tickets (ya cargados)
        const allTickets = window.tickets || [];
        const ticketsDia = allTickets.filter(function (t) {
            return t.fechaConsulta === fecha;
        });

        // Extraer todos los items relevantes
        const items = [];
        ticketsDia.forEach(function (ticket) {
            extraerItems(ticket).forEach(function (item) {
                items.push(item);
            });
        });

        // Actualizar badge de conteo
        if (countBadge) {
            countBadge.textContent = items.length + ' ' + (items.length === 1 ? 'item encontrado' : 'items encontrados');
            countBadge.style.display = items.length >= 0 ? 'inline-block' : 'none';
        }

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:#666;">' +
                '<i class="fas fa-check-circle" style="color:#27ae60; font-size:2.5rem; display:block; margin-bottom:12px;"></i>' +
                '<strong>Sin resultados</strong><br><span style="font-size:13px; color:#999;">No se encontraron RX ni Presupuestos en el campo "Por Cobrar" para el ' + formatFecha(fecha) + '</span>' +
                '</td></tr>';
            if (summaryBar) summaryBar.style.display = 'none';
            return;
        }

        // Cargar estados guardados en Firebase
        let savedChecks = {};
        try {
            const snap = await firebase.database().ref('rx_presupuestos_checks/' + fecha).once('value');
            savedChecks = snap.val() || {};
        } catch (e) {
            console.warn('[RxPresupuestos] No se pudieron cargar checks guardados:', e);
        }

        // Renderizar filas
        tbody.innerHTML = '';
        items.forEach(function (item) {
            const checkKey = (item.firebaseKey || 'nokey') + '_' + item.lineIndex;
            const checkData = savedChecks[checkKey] || {};
            const enSistema = !!checkData.enSistema;

            const tr = document.createElement('tr');
            tr.setAttribute('data-check-key', checkKey);
            if (enSistema) tr.classList.add('rx-row-checked');

            const horaStr = checkData.timestamp
                ? new Date(checkData.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                : '—';

            const statusIcon = enSistema
                ? '<i class="fas fa-check-circle" style="color:#27ae60;"></i> En sistema'
                : '<i class="fas fa-times-circle" style="color:#e74c3c;"></i> Pendiente';

            tr.innerHTML =
                '<td style="text-align:center; font-weight:700; color:#555;">' + esc(String(item.ticketId)) + '</td>' +
                '<td>' + esc(item.cliente) + '</td>' +
                '<td>' + esc(item.paciente) + '</td>' +
                '<td>' + tipoBadge(item.tipo) + '</td>' +
                '<td class="rx-desc-cell">' + esc(item.texto) + '</td>' +
                '<td style="text-align:center;">' +
                  '<label class="rx-check-container">' +
                    '<input type="checkbox" ' +
                      'data-check-key="' + esc(checkKey) + '" ' +
                      'data-fecha="' + esc(fecha) + '" ' +
                      (enSistema ? 'checked' : '') + ' ' +
                      'onchange="window.rxPresupuestosToggleCheck(this)">' +
                    '<span class="rx-check-status">' + statusIcon + '</span>' +
                  '</label>' +
                '</td>' +
                '<td style="text-align:center; font-size:12px; color:#888;">' + horaStr + '</td>';

            tbody.appendChild(tr);
        });

        actualizarResumen();
    }

    // Maneja el cambio de estado de un checkbox
    window.rxPresupuestosToggleCheck = function (checkbox) {
        const checkKey = checkbox.getAttribute('data-check-key');
        const fecha = checkbox.getAttribute('data-fecha');
        const enSistema = checkbox.checked;
        const tr = checkbox.closest('tr');
        const statusSpan = checkbox.parentElement.querySelector('.rx-check-status');

        if (enSistema) {
            if (tr) tr.classList.add('rx-row-checked');
            if (statusSpan) statusSpan.innerHTML = '<i class="fas fa-check-circle" style="color:#27ae60;"></i> En sistema';
        } else {
            if (tr) tr.classList.remove('rx-row-checked');
            if (statusSpan) statusSpan.innerHTML = '<i class="fas fa-times-circle" style="color:#e74c3c;"></i> Pendiente';
        }

        // Actualizar hora en la última columna
        const tds = tr ? tr.querySelectorAll('td') : [];
        const ahora = new Date();
        const horaStr = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        if (tds.length >= 7) tds[6].textContent = horaStr;

        // Persistir en Firebase
        firebase.database()
            .ref('rx_presupuestos_checks/' + fecha + '/' + checkKey)
            .set({
                enSistema: enSistema,
                timestamp: ahora.toISOString(),
                actualizadoPor: sessionStorage.getItem('userName') || 'Admin'
            })
            .catch(function (err) {
                console.error('[RxPresupuestos] Error guardando check:', err);
            });

        actualizarResumen();
    };

    // Formatea fecha YYYY-MM-DD a texto legible
    function formatFecha(fechaStr) {
        if (!fechaStr) return '—';
        const parts = fechaStr.split('-');
        if (parts.length !== 3) return fechaStr;
        return parts[2] + '/' + parts[1] + '/' + parts[0];
    }

    // Inicializa el módulo cuando la sección es mostrada
    function init() {
        const fechaInput = document.getElementById('fechaRxPresupuestos');
        if (fechaInput && !fechaInput.value) {
            // Fecha de hoy por defecto
            const hoy = (typeof getLocalDateString === 'function')
                ? getLocalDateString()
                : new Date().toISOString().split('T')[0];
            fechaInput.value = hoy;
        }

        const buscarBtn = document.getElementById('buscarRxPresupuestosBtn');
        if (buscarBtn && !buscarBtn._rxInitialized) {
            buscarBtn.addEventListener('click', cargarControl);
            buscarBtn._rxInitialized = true;
        }

        const fechaInputEl = document.getElementById('fechaRxPresupuestos');
        if (fechaInputEl && !fechaInputEl._rxInitialized) {
            fechaInputEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') cargarControl();
            });
            fechaInputEl._rxInitialized = true;
        }
    }

    // Exponer funciones globalmente
    window.initRxPresupuestosModule = init;
    window.cargarControlRxPresupuestos = cargarControl;

    // Auto-init cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
