/**
 * Módulo de generación de Expediente Clínico en PDF
 * Genera un PDF diseñado con todas las secciones del internamiento.
 * Utiliza html2canvas + jsPDF (carga lazy).
 *
 * Uso: InternamientoExpedientePDF.generar(internamientoObj)
 */

window.InternamientoExpedientePDF = (() => {

    // ─────────────────────────────────────────────
    // HELPERS DE FORMATO
    // ─────────────────────────────────────────────

    function fts(ts) {
        if (!ts) return '—';
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function fdate(ts) {
        if (!ts) return '—';
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function esc(str) {
        if (str === null || str === undefined) return '—';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function bool(v) { return v ? 'Sí' : 'No'; }

    function toList(obj) {
        if (!obj || typeof obj !== 'object') return [];
        return Array.isArray(obj) ? obj : Object.values(obj);
    }

    // ─────────────────────────────────────────────
    // CSS INLINE GLOBAL
    // ─────────────────────────────────────────────

    function buildCSS() {
        return `
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #333; background: #fff; line-height: 1.35; }
            .page { page-break-before: always; padding: 14px 16px 12px 16px; width: 720px; max-width: 720px; box-sizing: border-box; }
            .page-first { page-break-before: avoid !important; padding: 14px 16px 12px 16px; width: 720px; max-width: 720px; box-sizing: border-box; }

            /* PORTADA */
            .portada { display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%); color: #fff; border-radius: 6px; padding: 24px 18px; margin-bottom: 16px; }
            .portada .logo-circle { width: 56px; height: 56px; max-width: 56px; max-height: 56px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.8); object-fit: cover; margin-bottom: 8px; flex-shrink: 0; display: block; }
            .portada h1 { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px; text-align: center; }
            .portada h2 { font-size: 11px; font-weight: 400; opacity: 0.88; margin-bottom: 12px; text-align: center; }
            .portada-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-top: 10px; width: 100%; max-width: 480px; }
            .portada-grid .item { background: rgba(255,255,255,0.15); border-radius: 4px; padding: 6px 10px; }
            .portada-grid .item .label { font-size: 8px; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.5px; }
            .portada-grid .item .value { font-size: 10px; font-weight: 600; margin-top: 2px; }
            .portada-badge { display: inline-block; margin-top: 10px; padding: 4px 14px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.5); }

            /* SECTION HEADER */
            .sec-header { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 4px; margin-bottom: 10px; color: #fff; }
            .sec-header .sec-title { font-size: 11px; font-weight: 700; letter-spacing: 0.3px; }
            .sec-header .sec-count { font-size: 9px; opacity: 0.85; margin-left: auto; background: rgba(255,255,255,0.2); border-radius: 12px; padding: 2px 7px; }

            /* TABLES */
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9.5px; }
            thead tr { background: linear-gradient(90deg, #3f51b5, #5c6bc0); color: #fff; }
            thead.green tr { background: linear-gradient(90deg, #388e3c, #4caf50); }
            thead.indigo tr { background: linear-gradient(90deg, #4527a0, #673ab7); }
            thead.brown tr { background: linear-gradient(90deg, #4e342e, #795548); }
            thead.blue tr { background: linear-gradient(90deg, #0d47a1, #2196f3); }
            thead.teal tr { background: linear-gradient(90deg, #00695c, #26a69a); }
            thead.orange tr { background: linear-gradient(90deg, #e65100, #ff9800); }
            thead.red tr { background: linear-gradient(90deg, #b71c1c, #ef5350); }
            thead.purple tr { background: linear-gradient(90deg, #6a1b9a, #9c27b0); }
            thead.bluegreen tr { background: linear-gradient(90deg, #1565c0, #42a5f5); }
            thead.bluegrey tr { background: linear-gradient(90deg, #37474f, #607d8b); }
            th { padding: 5px 7px; text-align: left; font-size: 9px; font-weight: 600; letter-spacing: 0.3px; }
            td { padding: 4px 7px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
            tr:nth-child(even) td { background: #f5f5f5; }
            tr:last-child td { border-bottom: none; }

            /* FIELD GRID */
            .field-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 12px; margin-bottom: 8px; align-items: start; }
            .field-grid.cols3 { grid-template-columns: repeat(3, 1fr); }
            .field-grid.cols1 { grid-template-columns: 1fr; }
            .field { background: #f8f9fa; border-radius: 4px; padding: 5px 8px; border-left: 2px solid #e0e0e0; align-self: start; height: auto; min-height: 0; }
            .field .f-label { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.4px; }
            .field .f-value { font-size: 10px; color: #222; font-weight: 500; margin-top: 2px; word-break: break-word; line-height: 1.35; }

            /* BADGES */
            .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9.5px; font-weight: 600; }
            .badge-green { background: #e8f5e9; color: #2e7d32; }
            .badge-red { background: #ffebee; color: #c62828; }
            .badge-orange { background: #fff3e0; color: #e65100; }
            .badge-grey { background: #f5f5f5; color: #616161; }
            .badge-blue { background: #e3f2fd; color: #1565c0; }
            .badge-purple { background: #f3e5f5; color: #6a1b9a; }
            .badge-brown { background: #efebe9; color: #4e342e; }
            .badge-bluegrey { background: #eceff1; color: #37474f; }
            .badge-important { background: #fff3e0; color: #e65100; border: 1px solid #ffcc02; }

            /* Evitar cortes solo en bloques pequeños */
            .llamada-block, .nota-block, .defuncion-block {
                page-break-inside: avoid;
                break-inside: avoid;
            }

            /* TURNO CARD */
            .turno-block { border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 8px; overflow: hidden; page-break-inside: auto; break-inside: auto; }
            .turno-block-header { background: linear-gradient(90deg, #5c6bc0, #7986cb); color: #fff; padding: 5px 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .turno-block-header .t-name { font-weight: 700; font-size: 10px; }
            .turno-block-header .t-fecha { font-size: 9px; opacity: 0.88; margin-left: auto; }
            .turno-block-header .t-resp { font-size: 9px; opacity: 0.88; }
            .turno-block-body { padding: 8px 10px; }

            /* CIRUGIA CARD */
            .cirugia-block { border: 1px solid #d7ccc8; border-radius: 4px; margin-bottom: 8px; overflow: hidden; page-break-inside: auto; break-inside: auto; }
            .cirugia-block-header { background: linear-gradient(90deg, #795548, #a1887f); color: #fff; padding: 5px 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .cirugia-block-header .c-name { font-weight: 700; font-size: 10px; }
            .cirugia-block-header .c-fecha { font-size: 9px; opacity: 0.88; margin-left: auto; }
            .cirugia-block-body { padding: 8px 10px; }

            /* LLAMADA CARD */
            .llamada-block { border-left: 3px solid #66bb6a; background: #f9fbe7; border-radius: 0 4px 4px 0; padding: 7px 10px; margin-bottom: 7px; }

            /* NOTA CARD */
            .nota-block { border-left: 3px solid #42a5f5; background: #e3f2fd22; border-radius: 0 4px 4px 0; padding: 7px 10px; margin-bottom: 7px; }

            /* DEFUNCION CARD */
            .defuncion-block { border-left: 3px solid #607d8b; background: #eceff1; border-radius: 0 4px 4px 0; padding: 7px 10px; margin-bottom: 7px; }

            /* INFORMACIÓN DE ALTA (dado de alta) */
            .info-alta-card { background: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 6px; padding: 0; margin-bottom: 12px; overflow: hidden; }
            .info-alta-card .info-alta-header { color: #1b5e20; font-size: 12px; font-weight: 700; padding: 8px 12px; display: flex; align-items: center; gap: 6px; }
            .info-alta-card .info-alta-body { padding: 10px 12px 12px 12px; }
            .info-alta-card .info-alta-row { margin-bottom: 7px; font-size: 10px; }
            .info-alta-card .info-alta-row:last-child { margin-bottom: 0; }
            .info-alta-card .info-alta-label { color: #333; }
            .info-alta-card .info-alta-value { font-weight: 700; color: #1b5e20; margin-top: 2px; }
            .info-alta-card .info-alta-sep { height: 1px; background: #c8e6c9; margin: 8px 0 7px 0; }
            .info-alta-card .info-alta-obs-label { color: #333; font-size: 10px; margin-bottom: 3px; }
            .info-alta-card .info-alta-obs-value { font-size: 10px; color: #333; line-height: 1.35; }

            /* TRANSFUSION CARD */
            .transfusion-block { border: 1px solid #ffcdd2; border-radius: 4px; margin-bottom: 8px; overflow: hidden; page-break-inside: auto; break-inside: auto; }
            .transfusion-block-header { background: linear-gradient(90deg, #ef5350, #e57373); color: #fff; padding: 5px 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .transfusion-block-body { padding: 8px 10px; }

            /* RER / AA / HID / GLUCOSA BLOCK */
            .dia-block { border: 1px solid #ffe0b2; border-radius: 4px; margin-bottom: 8px; overflow: hidden; page-break-inside: auto; break-inside: auto; }
            .dia-block-header { background: linear-gradient(90deg, #e65100, #ff9800); color: #fff; padding: 5px 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .dia-block.aa .dia-block-header { background: linear-gradient(90deg, #00695c, #26a69a); }
            .dia-block-body { padding: 8px 10px; }

            /* SECTION SUBHEADER */
            .subheader { font-size: 9.5px; font-weight: 600; color: #3f51b5; border-bottom: 1px solid #c5cae9; padding-bottom: 3px; margin: 8px 0 6px 0; }

            /* EMPTY STATE */
            .empty-state { color: #9e9e9e; font-style: italic; font-size: 10.5px; padding: 10px 0; }

            /* WATERMARK FOOTER */
            .pdf-footer { margin-top: 14px; border-top: 1px solid #e0e0e0; padding-top: 6px; display: flex; justify-content: space-between; font-size: 9px; color: #bbb; }

            /* CONTROLES RAPIDOS */
            .control-check { display: inline-flex; align-items: center; gap: 4px; margin: 3px 6px 3px 0; font-size: 10.5px; }
            .check-icon { width: 14px; height: 14px; border-radius: 3px; display: inline-block; text-align: center; line-height: 14px; font-size: 9px; color: #fff; }
            .check-yes { background: #4caf50; }
            .check-no { background: #e0e0e0; color: #999; }
        </style>`;
    }

    // ─────────────────────────────────────────────
    // PORTADA
    // ─────────────────────────────────────────────

    function buildPortada(int) {
        const nombre = esc(int.referencias?.nombreMascota || 'Paciente');
        const expNum = esc(int.metadata?.expedienteNumero || int.metadata?.internamientoId || 'N/A');
        const especie = esc(typeof getTipoMascotaLabel === 'function' ? getTipoMascotaLabel(int.referencias?.tipoMascota) : (int.referencias?.tipoMascota || '—'));
        const cedula = esc(int.referencias?.cedulaCliente || '—');
        const medico = esc(int.datosIngreso?.medicoNombre || '—');
        const ingreso = fts(int.datosIngreso?.fechaIngreso);
        const estadoActual = int.estado?.actual || 'activo';
        const estadoLabel = { activo: 'Activo', critico: 'Crítico', alta: 'De alta', egresado: 'Egresado', defuncion: 'Defunción' }[estadoActual] || estadoActual;
        const fechaAlta = fts(int.estado?.fechaAlta || int.altaEgreso?.fechaEgreso);
        const respNombre = esc(int.consentimientos?.personaResponsable?.nombre || '—');
        const respTel = esc(int.consentimientos?.personaResponsable?.telefono || '—');
        const genFecha = fts(Date.now());

        return `
        <div class="page-first" style="padding-top:0;">
            <div class="portada">
                <img src="img/empresa.jpg" class="logo-circle" onerror="this.style.display='none'" />
                <h1>Veterinaria San Martin de Porres</h1>
                <h2>Expediente Clínico de Internamiento</h2>
                <div style="font-size:18px; font-weight:800; letter-spacing:0.5px; background:rgba(255,255,255,0.2); border-radius:6px; padding:8px 20px; margin-bottom:4px;">
                    ${nombre}
                </div>
                <div style="font-size:12px; opacity:0.85;">No. Expediente: <strong>${expNum}</strong></div>
                <div class="portada-grid">
                    <div class="item"><div class="label">Especie / Tipo</div><div class="value">${especie}</div></div>
                    <div class="item"><div class="label">Cédula propietario</div><div class="value">${cedula}</div></div>
                    <div class="item"><div class="label">Propietario</div><div class="value">${respNombre}</div></div>
                    <div class="item"><div class="label">Teléfono</div><div class="value">${respTel}</div></div>
                    <div class="item"><div class="label">Médico responsable</div><div class="value">${medico}</div></div>
                    <div class="item"><div class="label">Fecha de ingreso</div><div class="value">${ingreso}</div></div>
                    <div class="item"><div class="label">Fecha de alta / egreso</div><div class="value">${fechaAlta}</div></div>
                    <div class="item"><div class="label">Estado final</div><div class="value">${estadoLabel}</div></div>
                </div>
                <div class="portada-badge">${estadoLabel.toUpperCase()}</div>
            </div>
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Expediente ${expNum}</span>
                <span>Generado: ${genFecha}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // DATOS DE INGRESO + CONSENTIMIENTOS
    // ─────────────────────────────────────────────

    function buildIngreso(int) {
        const d = int.datosIngreso || {};
        const c = int.consentimientos || {};
        const cr = d.controlesRapidos || {};
        const resp = c.personaResponsable || {};

        const edicionExt = d.ultimaEdicionPorConsultaExterna
            ? `<div class="subheader" style="background:#fef3c7;color:#92400e;border:1px solid #f59e0b;border-radius:6px;padding:10px 14px;margin-bottom:12px;">
                <strong>Cambios realizados por consulta externa</strong><br/>
                <span style="font-weight:normal;">Quién hizo los cambios: ${esc(d.edicionConsultaExternaPorNombre || '—')}</span><br/>
                <span style="font-weight:normal;">Fecha de edición: ${d.fechaEdicionConsultaExterna ? fts(d.fechaEdicionConsultaExterna) : '—'}</span>
            </div>`
            : '';

        const checks = [
            { label: 'Tomaron muestras', val: cr.tomaronMuestras },
            { label: 'Ultrasonido', val: cr.ultrasonido },
            { label: 'Rayos X', val: cr.rayosX },
            { label: 'Castrado', val: cr.castrado },
            { label: 'Vacuna/Despa al día', val: cr.vacunaDespaAlDia }
        ].map(ch => `<span class="control-check"><span class="check-icon ${ch.val ? 'check-yes' : 'check-no'}">${ch.val ? '✓' : '✗'}</span>${esc(ch.label)}</span>`).join('');

        const tipoMuestra = cr.tipoMuestra ? `<br><em style="font-size:9.5px;color:#555;">Tipo de muestra: ${esc(cr.tipoMuestra)}</em>` : '';
        const reticulocitos = cr.reticulocitosTieneExamen ? `<br><em style="font-size:9.5px;color:#555;">Reticulocitos: Sí${cr.reticulocitosRegenerativa === 'regenerativa' ? ' · Regenerativa' : cr.reticulocitosRegenerativa === 'no_regenerativa' ? ' · No regenerativa' : cr.reticulocitosRegenerativa === 'resultados_pendientes' ? ' · Resultados pendientes' : ''}</em>` : '';

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #3f51b5, #5c6bc0);">
                <span class="sec-title">📋 DATOS DE INGRESO Y CONSENTIMIENTOS</span>
            </div>
            <div class="subheader">Información general del ingreso</div>
            ${edicionExt}
            <div class="field-grid cols3">
                <div class="field"><div class="f-label">Fecha de ingreso</div><div class="f-value">${fts(d.fechaIngreso)}</div></div>
                <div class="field"><div class="f-label">Hora de ingreso</div><div class="f-value">${esc(d.horaIngreso)}</div></div>
                <div class="field"><div class="f-label">Médico responsable</div><div class="f-value">${esc(d.medicoNombre)}</div></div>
                <div class="field"><div class="f-label">Peso al ingreso</div><div class="f-value">${d.pesoIngreso != null ? esc(d.pesoIngreso) + ' kg' : '—'}</div></div>
                <div class="field"><div class="f-label">Temperatura al ingreso</div><div class="f-value">${d.temperaturaIngreso != null ? esc(d.temperaturaIngreso) + ' °C' : '—'}</div></div>
                <div class="field"><div class="f-label">Especie</div><div class="f-value">${esc(typeof getTipoMascotaLabel === 'function' ? getTipoMascotaLabel(int.referencias?.tipoMascota) : int.referencias?.tipoMascota)}</div></div>
            </div>
            <div class="field-grid cols1">
                <div class="field"><div class="f-label">Historia clínica / Motivo de internamiento</div><div class="f-value">${esc(d.historiaClinica)}</div></div>
                <div class="field"><div class="f-label">Diagnóstico presuntivo</div><div class="f-value">${esc(d.diagnosticoPresuntivo)}</div></div>
                <div class="field"><div class="f-label">Padecimientos previos</div><div class="f-value">${esc(d.padecimientosPrevios)}</div></div>
                <div class="field"><div class="f-label">Necesidades especiales / Observaciones</div><div class="f-value">${esc(d.necesidadesEspeciales)}</div></div>
            </div>
            <div class="subheader">Controles rápidos al ingreso</div>
            <div style="margin-bottom:10px;">${checks}${tipoMuestra}${reticulocitos}</div>
            <div class="subheader">Consentimientos — Persona responsable</div>
            <div class="field-grid cols3">
                <div class="field"><div class="f-label">Nombre</div><div class="f-value">${esc(resp.nombre)}</div></div>
                <div class="field"><div class="f-label">Teléfono</div><div class="f-value">${esc(resp.telefono)}</div></div>
                <div class="field"><div class="f-label">Relación</div><div class="f-value">${esc(resp.relacion)}</div></div>
            </div>
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Datos de Ingreso</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // PLAN TERAPÉUTICO (MEDICACIÓN)
    // ─────────────────────────────────────────────

    function buildMedicacion(int) {
        const pt = int.planTerapeutico || {};
        const meds = pt.medicamentos || {};
        const lista = Object.values(meds);
        if (lista.length === 0) return '';

        const estadoBadge = (e) => {
            const map = { activo: 'badge-green', suspendido: 'badge-red', egresado: 'badge-grey' };
            return `<span class="badge ${map[e] || 'badge-grey'}">${esc(e || '—')}</span>`;
        };

        const rows = lista.map((m, i) => {
            const horarios = [...(m.horariosExactos || []), ...(m.horariosCalculados || [])].filter(Boolean);
            const horariosStr = horarios.length ? horarios.join(', ') : '—';
            const admins = Object.values(m.administraciones || {});
            const adminCount = admins.length;
            const lastAdmin = admins.sort((a, b) => (b.fechaHoraReal || 0) - (a.fechaHoraReal || 0))[0];
            return `<tr>
                <td style="font-weight:600;">${esc(m.nombreComercial)}</td>
                <td>${esc(m.dosis)} ${esc(m.unidadMedida)}</td>
                <td>${esc(m.viaAdministracion)}</td>
                <td>${m.frecuenciaHoras ? 'Cada ' + esc(m.frecuenciaHoras) + 'h' : '—'}</td>
                <td>${esc(horariosStr)}</td>
                <td>${estadoBadge(m.estadoMedicamento)}</td>
                <td>${esc(m.prescritoNombre)}</td>
                <td>${adminCount} adm.${lastAdmin ? '<br><span style="font-size:9px;color:#777;">' + fts(lastAdmin.fechaHoraReal) + '</span>' : ''}</td>
            </tr>`;
        }).join('');

        // Suspendidos con motivo
        const suspendidos = lista.filter(m => m.estadoMedicamento === 'suspendido' && m.motivoSuspension);
        const suspRows = suspendidos.map(m => `<tr>
            <td style="font-weight:600;">${esc(m.nombreComercial)}</td>
            <td>${esc(m.suspendidoNombre)}</td>
            <td>${fts(m.fechaFin)}</td>
            <td>${esc(m.motivoSuspension)}</td>
        </tr>`).join('');

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #388e3c, #4caf50);">
                <span class="sec-title">💊 PLAN TERAPÉUTICO — MEDICACIÓN</span>
                <span class="sec-count">${lista.length} medicamento(s)</span>
            </div>
            <table>
                <thead class="green"><tr>
                    <th>Medicamento</th><th>Dosis</th><th>Vía</th><th>Frecuencia</th>
                    <th>Horarios</th><th>Estado</th><th>Prescrito por</th><th>Administraciones</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            ${suspendidos.length ? `
            <div class="subheader" style="color:#c62828;">Medicamentos suspendidos — detalle</div>
            <table>
                <thead class="red"><tr><th>Medicamento</th><th>Suspendido por</th><th>Fecha suspensión</th><th>Motivo</th></tr></thead>
                <tbody>${suspRows}</tbody>
            </table>` : ''}
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Plan Terapéutico</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // TURNOS
    // ─────────────────────────────────────────────

    const TURNO_LABELS = {
        turnoNombre: { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche', Mañana: 'Mañana', Tarde: 'Tarde', Noche: 'Noche' },
        estadoMental: { alerta: 'Alerta', tranquilo: 'Tranquilo', deprimido: 'Deprimido', excitado: 'Excitado', agresivo: 'Agresivo' },
        nivelDolor: { sin_dolor: 'Sin dolor', leve: 'Leve', moderado: 'Moderado', severo: 'Severo' },
        mucosas: { rosadas: 'Rosadas', palidas: 'Pálidas', ictericas: 'Ictéricas', cianoticas: 'Cianóticas', congestivas: 'Congestivas' }
    };

    function buildTurnoBlock(t) {
        const pv = t.parametrosVitales || {};
        const eg = t.estadoGeneral || {};
        const fl = t.fluidoterapia || {};
        const nombre = TURNO_LABELS.turnoNombre[t.turno] || esc(t.turno) || '—';

        const vitales = [
            ['Peso', pv.peso != null ? pv.peso + ' kg' : '—'],
            ['FC', pv.fc != null ? pv.fc + ' lpm' : '—'],
            ['FR', pv.fr != null ? pv.fr + ' rpm' : '—'],
            ['Temperatura', pv.temperatura != null ? pv.temperatura + ' °C' : '—'],
            ['TLLC', pv.tllc != null ? pv.tllc + ' seg' : '—'],
            ['Deshidratación', pv.deshidratacion != null ? pv.deshidratacion + '%' : '—'],
            ['Mucosas', (window.internamientoModule && typeof window.internamientoModule.formatearMucosas === 'function'
                ? window.internamientoModule.formatearMucosas(pv.mucosas)
                : (TURNO_LABELS.mucosas[pv.mucosas] || esc(pv.mucosas))) || '—'],
            ['Presión arterial', esc(pv.presionArterial) || '—'],
            ['PO₂', pv.po2 != null ? pv.po2 + ' mmHg' : '—'],
            ['Vía', esc(pv.via) || '—'],
            ['Sonda esofágica', esc(pv.sondaEsofagica || pv.sonda) || '—'],
            ['Tiempo sonda esofágica', esc(pv.tiempoSondaEsofagica || pv.tiempoSonda) || '—'],
            ['Sonda urinaria', esc(pv.sondaUrinaria) || '—'],
            ['Tiempo sonda urinaria', esc(pv.tiempoSondaUrinaria) || '—'],
            ['Pulmonares', esc(pv.parametrosPulmonares) || '—']
        ];

        const vitalesRows = vitales.map(([label, val]) =>
            `<tr><td style="font-weight:600;width:35%;">${label}</td><td>${esc(val)}</td></tr>`
        ).join('');

        const generalRows = [
            ['Estado mental', TURNO_LABELS.estadoMental[eg.estadoMental] || esc(eg.estadoMental) || '—'],
            ['Nivel de dolor', TURNO_LABELS.nivelDolor[eg.nivelDolor] || esc(eg.nivelDolor) || '—'],
            ['Glasgow', eg.glasgowPuntaje != null ? eg.glasgowPuntaje : '—'],
            ['Ingesta de agua', eg.ingestaAgua ? `Sí — ${eg.cantidadAgua != null ? eg.cantidadAgua + ' ml' : ''}` : 'No'],
            ['Apetito', eg.apetito ? `Sí — ${esc(eg.alimentoCantidad)} ${esc(eg.alimentoTipo)}` : 'No'],
            ['Defecación', esc(eg.defecacion) || 'No defecó'],
            ['Micción', eg.miccion ? `Sí — ${esc(eg.miccionColor)} / ${esc(eg.miccionFrecuencia)}${eg.miccionVolumen ? ' / ' + eg.miccionVolumen + ' ml' : ''}` : 'No'],
            ['Vómitos', eg.vomitos ? `Sí — ${esc(eg.descripcionVomitos)}` : 'No']
        ].map(([label, val]) =>
            `<tr><td style="font-weight:600;width:35%;">${label}</td><td>${esc(String(val))}</td></tr>`
        ).join('');

        const fluidoStr = fl.administrada
            ? `Sí — Tipo: ${esc(fl.tipo)} / Velocidad: ${esc(fl.frecuencia)}`
            : 'No se administró fluidoterapia';

        const alertas = (t.alertasAutomaticas || []).map(a => `<span class="badge badge-orange" style="margin:2px 4px 2px 0;">${esc(a)}</span>`).join('');

        return `
            <div class="turno-block">
                <div class="turno-block-header">
                    <span class="t-name">${nombre}</span>
                    <span class="t-resp">👤 ${esc(t.responsableNombre)}</span>
                    <span class="t-fecha">${fts(t.fecha)}</span>
                    ${t.editado ? `<span class="badge" style="background:rgba(255,255,255,0.3);font-size:9px;margin-left:6px;">Editado</span>` : ''}
                </div>
                <div class="turno-block-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px;">
                        <div>
                            <div class="subheader">Parámetros vitales</div>
                            <table style="margin-bottom:8px;"><tbody>${vitalesRows}</tbody></table>
                        </div>
                        <div>
                            <div class="subheader">Estado general</div>
                            <table style="margin-bottom:8px;"><tbody>${generalRows}</tbody></table>
                        </div>
                    </div>
                    <div class="field" style="margin-bottom:8px;"><div class="f-label">Fluidoterapia</div><div class="f-value">${fluidoStr}</div></div>
                    ${t.observaciones ? `<div class="field" style="margin-bottom:8px;"><div class="f-label">Observaciones</div><div class="f-value">${esc(t.observaciones)}</div></div>` : ''}
                    ${alertas ? `<div style="margin-top:6px;">${alertas}</div>` : ''}
                </div>
            </div>`;
    }

    function buildTurnos(int) {
        const turnos = toList(int.turnos || {}).sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
        if (turnos.length === 0) return '';

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #5c6bc0, #7986cb);">
                <span class="sec-title">🩺 TURNOS</span>
                <span class="sec-count">${turnos.length} turno(s)</span>
            </div>
            ${turnos.map((t, idx) => `
                ${idx > 0 ? `<div class="subheader">Turno ${idx + 1} de ${turnos.length}</div>` : ''}
                ${buildTurnoBlock(t)}
            `).join('')}
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Turnos</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // PROCEDIMIENTOS (completados primero; incluye pendientes de admisión marcados como completados)
    // ─────────────────────────────────────────────

    function buildProcedimientos(int) {
        const lista = toList(int.procedimientos || {});
        if (lista.length === 0) return '';

        const prioridadBadge = p => p === 'alta' ? '<span class="badge badge-red">Alta</span>' : '<span class="badge badge-grey">Normal</span>';
        const tipoMap = { examen: 'Examen', curacion: 'Curación', imagen: 'Imagen', cirugia: 'Cirugía', terapia: 'Terapia', otro: 'Otro' };

        const sorted = lista.sort((a, b) => (a.fechaCreacion || 0) - (b.fechaCreacion || 0));
        const completados = sorted.filter(p => p.estado === 'completado');
        const pendientes = sorted.filter(p => p.estado !== 'completado');

        const origenBadge = (item) => {
            if (item?.puestoPorInternos) {
                return ' <span style="background:#ede9fe;color:#5b21b6;font-size:9px;padding:2px 6px;border-radius:4px;">Puesto por internos</span>';
            }
            if (item?.puestoPorConsultaExterna) {
                return ' <span style="background:#ecfdf5;color:#0f766e;font-size:9px;padding:2px 6px;border-radius:4px;">Puesto por consulta externa</span>';
            }
            return '';
        };
        const row = (p) => `<tr>
            <td>${esc(tipoMap[p.tipo] || p.tipo)}</td>
            <td style="font-weight:600;">${esc(p.descripcion)}${origenBadge(p)}</td>
            <td>${prioridadBadge(p.prioridad)}</td>
            <td>${esc(p.creadoNombre)}<br><span style="font-size:9px;color:#777;">${fts(p.fechaCreacion)}</span></td>
            <td>${p.completadoNombre ? esc(p.completadoNombre) + '<br><span style="font-size:9px;color:#777;">' + fts(p.fechaCompletado) + '</span>' : '—'}</td>
            <td>${esc(p.observaciones)}</td>
        </tr>`;

        const tablaCompletados = completados.length > 0 ? `
            <div class="subheader" style="margin-top:14px;">✅ Procedimientos completados</div>
            <table>
                <thead class="green"><tr>
                    <th>Tipo</th><th>Descripción</th><th>Prioridad</th>
                    <th>Creado por</th><th>Completado por</th><th>Observaciones</th>
                </tr></thead>
                <tbody>${completados.map(row).join('')}</tbody>
            </table>` : '';

        const tablaPendientes = pendientes.length > 0 ? `
            <div class="subheader" style="margin-top:14px;">⏳ Procedimientos pendientes</div>
            <table>
                <thead class="orange"><tr>
                    <th>Tipo</th><th>Descripción</th><th>Prioridad</th>
                    <th>Creado por</th><th>Completado por</th><th>Observaciones</th>
                </tr></thead>
                <tbody>${pendientes.map(row).join('')}</tbody>
            </table>` : '';

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #4527a0, #673ab7);">
                <span class="sec-title">⚙️ PROCEDIMIENTOS</span>
                <span class="sec-count">${lista.length} procedimiento(s) · ${completados.length} completados</span>
            </div>
            ${tablaCompletados}
            ${tablaPendientes}
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Procedimientos</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // CIRUGÍAS
    // ─────────────────────────────────────────────

    function buildCirugiaBlock(c) {
        const historial = (c.historialEdiciones || []).map(h => `
            <tr>
                <td>${fts(h.fecha || h.timestamp)}</td>
                <td>${esc(h.editadoNombre || h.usuarioNombre)}</td>
                <td>${esc(h.motivoCambio)}</td>
            </tr>`).join('');

        return `
            <div class="cirugia-block">
                <div class="cirugia-block-header">
                    <span class="c-name">${esc(c.nombreProcedimiento)}</span>
                    <span style="font-size:10px;opacity:0.85;">Dr. ${esc(c.doctor)}</span>
                    <span class="c-fecha">${fts(c.fechaHoraTs || (c.fechaHora ? new Date(c.fechaHora).getTime() : null))}</span>
                    ${c.cirugiaAgendadaConDoctor ? `<span class="badge" style="background:rgba(255,255,255,0.3);font-size:9px;">Agendada</span>` : ''}
                </div>
                <div class="cirugia-block-body">
                    <div class="field-grid cols3">
                        <div class="field"><div class="f-label">Motivo</div><div class="f-value">${esc(c.motivo) || '—'}</div></div>
                        <div class="field"><div class="f-label">Registrado por</div><div class="f-value">${esc(c.creadoNombre)}</div></div>
                        <div class="field"><div class="f-label">Hora de salida</div><div class="f-value">${esc(c.horaSalida) || '—'}</div></div>
                    </div>
                    ${c.recomendacionesSalida ? `<div class="field" style="margin-bottom:8px;"><div class="f-label">Recomendaciones al salir</div><div class="f-value">${esc(c.recomendacionesSalida)}</div></div>` : ''}
                    ${c.editadoNombre ? `<div class="field" style="margin-bottom:8px;"><div class="f-label">Última edición por</div><div class="f-value">${esc(c.editadoNombre)} — ${esc(c.motivoUltimoCambio)}</div></div>` : ''}
                    ${historial ? `
                    <div class="subheader">Historial de ediciones</div>
                    <table><thead class="brown"><tr><th>Fecha</th><th>Editado por</th><th>Motivo</th></tr></thead>
                    <tbody>${historial}</tbody></table>` : ''}
                </div>
            </div>`;
    }

    function buildCirugias(int) {
        const cirugiasRaw = int.cirugias;
        if (!cirugiasRaw) return '';
        const lista = (Array.isArray(cirugiasRaw) ? cirugiasRaw : Object.values(cirugiasRaw))
            .sort((a, b) => (a.fechaHoraTs || 0) - (b.fechaHoraTs || 0));
        if (lista.length === 0) return '';

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #4e342e, #795548);">
                <span class="sec-title">🔪 CIRUGÍAS</span>
                <span class="sec-count">${lista.length} cirugía(s)</span>
            </div>
            ${lista.map((c, idx) => `
                ${idx > 0 ? `<div class="subheader">Cirugía ${idx + 1} de ${lista.length}</div>` : ''}
                ${buildCirugiaBlock(c)}
            `).join('')}
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Cirugías</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // NOTAS DE EVOLUCIÓN
    // ─────────────────────────────────────────────

    function buildEvolucion(int) {
        const notas = toList(int.notasEvolucion || int.evolucion || {});
        if (notas.length === 0) return '';

        const cards = notas.sort((a, b) => (a.fecha || 0) - (b.fecha || 0)).map(n => `
        <div class="nota-block">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="font-weight:600;font-size:11px;">${esc(n.medicoNombre)}</span>
                <span style="color:#777;font-size:10px;">${fts(n.fecha)}</span>
                ${n.importante ? `<span class="badge badge-important">⭐ Importante</span>` : ''}
            </div>
            <div style="font-size:11px;color:#333;line-height:1.5;">${esc(n.contenido)}</div>
        </div>`).join('');

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #0d47a1, #42a5f5);">
                <span class="sec-title">📝 NOTAS DE EVOLUCIÓN</span>
                <span class="sec-count">${notas.length} nota(s)</span>
            </div>
            ${cards}
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Notas de Evolución</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // LLAMADAS AL CLIENTE
    // ─────────────────────────────────────────────

    function buildLlamadas(int) {
        const lista = toList(int.llamadasCliente || {}).sort((a, b) => (a.fechaHora || 0) - (b.fechaHora || 0));
        if (lista.length === 0) return '';

        const motivoLabel = { actualizacion: 'Actualización', emergencia: 'Emergencia', consulta_cliente: 'Consulta del cliente', autorizacion: 'Autorización', alta: 'Alta', seguimiento: 'Seguimiento', otro: 'Otro' };
        const reaccionLabel = { satisfecho: 'Satisfecho', preocupado: 'Preocupado', tranquilo: 'Tranquilo', ansioso: 'Ansioso', molesto: 'Molesto', agradecido: 'Agradecido' };
        const reaccionColor = { satisfecho: 'badge-green', preocupado: 'badge-orange', tranquilo: 'badge-blue', ansioso: 'badge-orange', molesto: 'badge-red', agradecido: 'badge-green' };

        const cards = lista.map(l => {
            const com = l.comunicacion || {};
            const sig = l.siguienteLlamada || {};
            return `
            <div class="llamada-block">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                    <span style="font-weight:600;">${fts(l.fechaHora)}</span>
                    <span class="badge badge-blue">${esc(motivoLabel[com.motivo] || com.motivo)}</span>
                    ${com.reaccionCliente ? `<span class="badge ${reaccionColor[com.reaccionCliente] || 'badge-grey'}">${esc(reaccionLabel[com.reaccionCliente] || com.reaccionCliente)}</span>` : ''}
                </div>
                <div class="field-grid cols3" style="margin-bottom:6px;">
                    <div class="field"><div class="f-label">Quién llamó</div><div class="f-value">${esc(com.quienLlamo)}</div></div>
                    <div class="field"><div class="f-label">Quién atendió</div><div class="f-value">${esc(com.quienAtendio)}</div></div>
                    <div class="field"><div class="f-label">Registrado por</div><div class="f-value">${esc(l.registradoNombre)}</div></div>
                </div>
                <div class="field" style="margin-bottom:6px;"><div class="f-label">Resumen de la llamada</div><div class="f-value">${esc(l.resumen)}</div></div>
                ${sig.programada ? `<div class="field" style="border-left-color:#66bb6a;"><div class="f-label">Próxima llamada programada</div><div class="f-value">${esc(sig.fecha)} ${esc(sig.hora)} — ${esc(sig.motivo)}</div></div>` : ''}
            </div>`;
        }).join('');

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #2e7d32, #66bb6a);">
                <span class="sec-title">📞 LLAMADAS AL CLIENTE</span>
                <span class="sec-count">${lista.length} llamada(s)</span>
            </div>
            ${cards}
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Llamadas al Cliente</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // DEFUNCIONES
    // ─────────────────────────────────────────────

    function buildDefunciones(int) {
        const lista = toList(int.defunciones || {});
        if (lista.length === 0) return '';

        const destinoLabel = { entierro: 'Entierro', cremacion: 'Cremación', entrega_directa: 'Entrega directa' };
        const turnoLabel = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };

        const cards = lista.map(d => `
        <div class="defuncion-block">
            <div style="font-weight:700;font-size:12px;color:#37474f;margin-bottom:8px;">Registro de Defunción — ${fts(d.fechaHoraTs || (d.fechaHora ? new Date(d.fechaHora).getTime() : null))}</div>
            <div class="field-grid cols3">
                <div class="field"><div class="f-label">Turno</div><div class="f-value">${esc(turnoLabel[d.turnoId] || d.turno) || '—'}</div></div>
                <div class="field"><div class="f-label">Responsable del turno</div><div class="f-value">${esc(d.responsableTurno) || '—'}</div></div>
                <div class="field"><div class="f-label">Destino del cuerpo</div><div class="f-value">${esc(destinoLabel[d.destinoCuerpo] || d.destinoCuerpoLabel || d.destinoCuerpo) || '—'}</div></div>
            </div>
            <div class="field" style="margin-bottom:6px;"><div class="f-label">Causa / Motivo de fallecimiento</div><div class="f-value">${esc(d.motivoFallecimiento || d.causa)}</div></div>
            ${d.observaciones ? `<div class="field"><div class="f-label">Observaciones</div><div class="f-value">${esc(d.observaciones)}</div></div>` : ''}
            <div style="margin-top:6px;font-size:9.5px;color:#777;">Registrado por: ${esc(d.registradoNombre)} — ${fts(d.fechaRegistro)}</div>
        </div>`).join('');

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #37474f, #607d8b);">
                <span class="sec-title">🕊️ DEFUNCIÓN</span>
            </div>
            ${cards}
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Defunción</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // TRANSFUSIONES
    // ─────────────────────────────────────────────

    function buildTransfusionBlock(t, index) {
        const rec = t.receptor || {};
        const don = t.donante || {};
        const calc = t.calculo || {};
        const proc = t.procedimiento || {};
        return `
            <div class="transfusion-block">
                <div class="transfusion-block-header">
                    <span style="font-weight:700;">#${index + 1} — ${esc(t.tipoTransfusion === 'plasma' ? 'Plasma' : 'Sangre completa')}</span>
                    <span style="font-size:10px;opacity:0.88;margin-left:auto;">${fts(t.fechaHoraInicio)} → ${fts(t.fechaHoraFin)}</span>
                </div>
                <div class="transfusion-block-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px;">
                        <div>
                            <div class="subheader">Receptor</div>
                            <div class="field-grid cols1">
                                <div class="field"><div class="f-label">Tipo de mascota</div><div class="f-value">${esc(typeof getTipoMascotaLabel === 'function' ? getTipoMascotaLabel(rec.tipoMascota) : rec.tipoMascota)}</div></div>
                                <div class="field"><div class="f-label">Peso</div><div class="f-value">${rec.peso != null ? rec.peso + ' kg' : '—'}</div></div>
                                <div class="field"><div class="f-label">Tipo de sangre</div><div class="f-value">${esc(rec.tipoSangre)}</div></div>
                                <div class="field"><div class="f-label">Hematocrito actual / deseado</div><div class="f-value">${rec.htActual != null ? rec.htActual + '%' : '—'} / ${rec.htDeseado != null ? rec.htDeseado + '%' : '—'}</div></div>
                            </div>
                        </div>
                        <div>
                            <div class="subheader">Donante</div>
                            <div class="field-grid cols1">
                                <div class="field"><div class="f-label">Nombre</div><div class="f-value">${esc(don.nombre)}</div></div>
                                <div class="field"><div class="f-label">Tipo de sangre</div><div class="f-value">${esc(don.tipoSangre)}</div></div>
                                <div class="field"><div class="f-label">Hematocrito</div><div class="f-value">${don.ht != null ? don.ht + '%' : '—'}</div></div>
                            </div>
                        </div>
                    </div>
                    <div class="subheader">Cálculo y procedimiento</div>
                    <div class="field-grid cols3">
                        <div class="field"><div class="f-label">Volumen calculado</div><div class="f-value">${calc.volumenCalculado != null ? calc.volumenCalculado + ' ml' : '—'}</div></div>
                        <div class="field"><div class="f-label">Prueba cruzada</div><div class="f-value">${bool(proc.pruebaCruzada)} ${proc.resultadoPrueba ? '— ' + esc(proc.resultadoPrueba) : ''}</div></div>
                        <div class="field"><div class="f-label">Velocidad de infusión</div><div class="f-value">${proc.velocidadInfusion != null ? proc.velocidadInfusion : '—'}</div></div>
                        <div class="field"><div class="f-label">Reacción adversa</div><div class="f-value">${proc.reaccionAdversa ? `Sí — ${esc(proc.descripcionReaccion)}` : 'No'}</div></div>
                        <div class="field"><div class="f-label">Responsable</div><div class="f-value">${esc(t.responsableNombre)}</div></div>
                    </div>
                    ${t.observaciones ? `<div class="field"><div class="f-label">Observaciones</div><div class="f-value">${esc(t.observaciones)}</div></div>` : ''}
                </div>
            </div>`;
    }

    function buildTransfusiones(int) {
        const lista = toList(int.transfusiones || {}).sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
        if (lista.length === 0) return '';

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #b71c1c, #ef5350);">
                <span class="sec-title">🩸 TRANSFUSIONES</span>
                <span class="sec-count">${lista.length} transfusión(es)</span>
            </div>
            ${lista.map((t, idx) => `
                ${idx > 0 ? `<div class="subheader">Transfusión ${idx + 1} de ${lista.length}</div>` : ''}
                ${buildTransfusionBlock(t, idx)}
            `).join('')}
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Transfusiones</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // RER
    // ─────────────────────────────────────────────

    function buildRerDiaBlock(dia, horaLabel) {
        const tomas = toList(dia.tomas || {}).sort((a, b) => {
            const order = ['8am', '12md', '4pm', '8pm', '12mn'];
            return order.indexOf(a.hora) - order.indexOf(b.hora);
        });
        const tomasRows = tomas.map(t => `<tr>
            <td>${esc(horaLabel[t.hora] || t.hora)}</td>
            <td>${t.cantidadPorToma != null ? t.cantidadPorToma + ' ml' : '—'}</td>
            <td>${t.cantidadAgua != null ? t.cantidadAgua + ' ml' : '—'}</td>
            <td>${esc(t.registradoPorNombre)}</td>
            <td>${fts(t.fechaRegistro)}</td>
        </tr>`).join('');

        return `
            <div class="dia-block">
                <div class="dia-block-header">
                    <span style="font-weight:700;">Día ${dia.numero}</span>
                    <span style="font-size:10px;opacity:0.88;">${fts(dia.fechaHora || dia.fechaRegistro)}</span>
                    <span style="font-size:10px;opacity:0.88;margin-left:auto;">Peso: ${dia.peso != null ? dia.peso + ' kg' : '—'}</span>
                </div>
                <div class="dia-block-body">
                    <div style="font-size:9.5px;color:#777;margin-bottom:6px;">Prescrito por: ${esc(dia.preescritoPor)}</div>
                    ${dia.observaciones ? `<div class="field" style="margin-bottom:8px;"><div class="f-label">Observaciones</div><div class="f-value">${esc(dia.observaciones)}</div></div>` : ''}
                    ${tomas.length ? `
                    <table><thead class="orange"><tr><th>Hora</th><th>Cantidad</th><th>Agua</th><th>Registrado por</th><th>Fecha registro</th></tr></thead>
                    <tbody>${tomasRows}</tbody></table>` : '<span class="empty-state">Sin tomas registradas</span>'}
                </div>
            </div>`;
    }

    function buildRer(int) {
        const rer = int.rer;
        if (!rer) return '';
        const dias = toList(rer.dias || {}).sort((a, b) => (a.numero || 0) - (b.numero || 0));
        if (dias.length === 0) return '';

        const horaLabel = { '8am': '8:00 am', '12md': '12:00 md', '4pm': '4:00 pm', '8pm': '8:00 pm', '12mn': '12:00 mn' };
        const pesoFormula = rer.pesoParaFormula != null
            ? `<div class="field" style="margin-bottom:12px;max-width:200px;"><div class="f-label">Peso para fórmula</div><div class="f-value">${rer.pesoParaFormula} kg</div></div>`
            : '';
        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #e65100, #ff9800);">
                <span class="sec-title">🍽️ RER — REQUERIMIENTO ENERGÉTICO EN REPOSO</span>
                <span class="sec-count">${dias.length} día(s)</span>
            </div>
            ${pesoFormula}
            ${dias.map((dia, idx) => `
                ${idx > 0 ? `<div class="subheader">RER — Día ${idx + 1} de ${dias.length}</div>` : ''}
                ${buildRerDiaBlock(dia, horaLabel)}
            `).join('')}
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — RER</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // ALIMENTACIÓN ASISTIDA
    // ─────────────────────────────────────────────

    function buildAaDiaBlock(dia) {
        const tomas = toList(dia.tomas || {}).sort((a, b) => (a.horaRegistro || a.fechaRegistro || 0) - (b.horaRegistro || b.fechaRegistro || 0));
        const tomasRows = tomas.map(t => `<tr>
            <td>${fts(t.horaRegistro || t.fechaRegistro)}</td>
            <td>${t.cantidadPorToma != null ? t.cantidadPorToma : '—'}</td>
            <td>${t.cantidadAgua != null ? t.cantidadAgua + ' ml' : '—'}</td>
            <td>${esc(t.registradoPorNombre)}</td>
        </tr>`).join('');

        return `
            <div class="dia-block aa">
                <div class="dia-block-header">
                    <span style="font-weight:700;">Día ${dia.numero}</span>
                    <span style="font-size:10px;opacity:0.88;">${fts(dia.fechaHora || dia.fechaRegistro)}</span>
                    <span style="font-size:10px;opacity:0.88;margin-left:auto;">Dosis: ${esc(dia.dosis) || '—'}</span>
                </div>
                <div class="dia-block-body">
                    <div class="field-grid cols3" style="margin-bottom:8px;">
                        <div class="field"><div class="f-label">Frecuencia</div><div class="f-value">${dia.frecuenciaValor != null ? dia.frecuenciaValor + ' ' + esc(dia.frecuenciaTipo) : '—'}</div></div>
                        <div class="field"><div class="f-label">Prescrito por</div><div class="f-value">${esc(dia.preescritoPor)}</div></div>
                    </div>
                    ${dia.observaciones ? `<div class="field" style="margin-bottom:8px;"><div class="f-label">Observaciones</div><div class="f-value">${esc(dia.observaciones)}</div></div>` : ''}
                    ${tomas.length ? `
                    <table><thead class="teal"><tr><th>Hora registro</th><th>Cantidad</th><th>Agua (ml)</th><th>Registrado por</th></tr></thead>
                    <tbody>${tomasRows}</tbody></table>` : '<span class="empty-state">Sin tomas registradas</span>'}
                </div>
            </div>`;
    }

    function buildAlimentacionAsistida(int) {
        const aa = int.alimentacionAsistida;
        if (!aa) return '';
        const dias = toList(aa.dias || {}).sort((a, b) => (a.numero || 0) - (b.numero || 0));
        if (dias.length === 0) return '';

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #00695c, #26a69a);">
                <span class="sec-title">🥣 ALIMENTACIÓN ASISTIDA</span>
                <span class="sec-count">${dias.length} día(s)</span>
            </div>
            ${dias.map((dia, idx) => `
                ${idx > 0 ? `<div class="subheader">Alimentación asistida — Día ${idx + 1} de ${dias.length}</div>` : ''}
                ${buildAaDiaBlock(dia)}
            `).join('')}
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Alimentación Asistida</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // HIDRATACIÓN
    // ─────────────────────────────────────────────

    function buildHidratacion(int) {
        const hid = int.hidratacion;
        if (!hid) return '';
        const registros = toList(hid.registros || {}).sort((a, b) => {
            const ta = a.fechaHora ? new Date(a.fechaHora).getTime() : 0;
            const tb = b.fechaHora ? new Date(b.fechaHora).getTime() : 0;
            return ta - tb;
        });
        if (registros.length === 0) return '';

        const rows = registros.map(r => `<tr>
            <td>${esc(r.fechaHora ? new Date(r.fechaHora).toLocaleString('es-ES') : '—')}</td>
            <td style="font-weight:600;">${esc(r.tipo)}</td>
            <td>${r.volumen != null ? r.volumen + ' ml' : '—'}</td>
            <td>${esc(r.observaciones) || '—'}</td>
            <td>${esc(r.registradoPorNombre)}</td>
        </tr>`).join('');

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #0d47a1, #2196f3);">
                <span class="sec-title">💧 HIDRATACIÓN</span>
                <span class="sec-count">${registros.length} registro(s)</span>
            </div>
            <table>
                <thead class="blue"><tr>
                    <th>Fecha / Hora</th><th>Tipo de suero</th><th>Volumen</th><th>Observaciones</th><th>Registrado por</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Hidratación</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // CURVA DE GLUCOSA
    // ─────────────────────────────────────────────

    function buildCurvaGlucosa(int) {
        const cg = int.curvaGlucosa;
        if (!cg) return '';
        const mediciones = toList(cg.mediciones || {}).sort((a, b) => {
            const ta = a.fechaHora ? new Date(a.fechaHora).getTime() : 0;
            const tb = b.fechaHora ? new Date(b.fechaHora).getTime() : 0;
            return ta - tb;
        });
        if (mediciones.length === 0) return '';

        const tipoLabel = { R: 'Insulina R', N: 'Insulina N', RN: 'Insulina R+N' };
        const rows = mediciones.map(m => {
            const glucStyle = m.valor < 60 ? 'color:#c62828;font-weight:700;' : m.valor > 300 ? 'color:#e65100;font-weight:700;' : 'font-weight:600;';
            return `<tr>
                <td>${esc(m.fechaHora ? new Date(m.fechaHora).toLocaleString('es-ES') : '—')}</td>
                <td style="${glucStyle}">${m.valor != null ? m.valor + ' mg/dL' : '—'}</td>
                <td>${m.insulinaAplicada ? `Sí — ${m.cantidadInsulina != null ? m.cantidadInsulina + ' UI' : ''} ${esc(tipoLabel[m.tipoInsulina] || m.tipoInsulina)}` : 'No'}</td>
                <td>${esc(m.observaciones) || '—'}</td>
                <td>${esc(m.registradoPorNombre)}</td>
            </tr>`;
        }).join('');

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #6a1b9a, #9c27b0);">
                <span class="sec-title">📊 CURVA DE GLUCOSA</span>
                <span class="sec-count">${mediciones.length} medición(es)</span>
            </div>
            <table>
                <thead class="purple"><tr>
                    <th>Fecha / Hora</th><th>Glucosa</th><th>Insulina aplicada</th><th>Observaciones</th><th>Registrado por</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Curva de Glucosa</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // EGRESO / ALTA
    // ─────────────────────────────────────────────

    function buildEgreso(int) {
        const est = int.estado || {};
        const egr = int.altaEgreso || {};
        const tipoAltaLabel = {
            carta_liberacion: 'Carta de liberación',
            carta_condicionada_24h: 'Carta condicionada 24h',
            carta_condicionada_48h: 'Carta condicionada 48h',
            referencia: 'Referencia'
        };

        const esEgresado = est.actual === 'egresado';
        const tieneFechaAlta = est.fechaAlta || egr.fechaEgreso;
        if (!esEgresado && !tieneFechaAlta) return '';

        const tipoAltaTexto = esc(tipoAltaLabel[est.tipoAlta] || est.tipoAlta) || '—';
        const fechaAltaTexto = fts(est.fechaAlta || egr.fechaEgreso);
        const observacionesTexto = esc(est.observacionesAlta) || '—';

        const prox = egr.proximaCita || {};
        const quienRecoge = egr.quienRecoge || {};

        return `
        <div class="page">
            <div class="sec-header" style="background: linear-gradient(90deg, #1b5e20, #4caf50);">
                <span class="sec-title">✅ ALTA / EGRESO</span>
            </div>

            <div class="info-alta-card">
                <div class="info-alta-header">
                    <span style="font-size:16px;">🏠</span>
                    <span>Información de alta</span>
                </div>
                <div class="info-alta-body">
                    <div class="info-alta-row">
                        <div class="info-alta-label">Tipo de alta:</div>
                        <div class="info-alta-value">${tipoAltaTexto}</div>
                    </div>
                    <div class="info-alta-row">
                        <div class="info-alta-label">Fecha de alta:</div>
                        <div class="info-alta-value">${fechaAltaTexto}</div>
                    </div>
                    <div class="info-alta-sep"></div>
                    <div class="info-alta-obs-label">Observaciones:</div>
                    <div class="info-alta-obs-value">${observacionesTexto}</div>
                </div>
            </div>

            <div class="subheader">Responsable y datos adicionales</div>
            <div class="field-grid cols3">
                <div class="field"><div class="f-label">Responsable de alta</div><div class="f-value">${esc(egr.responsableNombre) || '—'}</div></div>
            </div>

            ${egr.diagnosticoFinal ? `
            <div class="subheader">Información médica de egreso</div>
            <div class="field-grid cols1">
                <div class="field"><div class="f-label">Diagnóstico final</div><div class="f-value">${esc(egr.diagnosticoFinal)}</div></div>
                ${egr.tratamientoAmbulatorio ? `<div class="field"><div class="f-label">Tratamiento ambulatorio</div><div class="f-value">${esc(egr.tratamientoAmbulatorio)}</div></div>` : ''}
                ${egr.recomendacionesCuidado ? `<div class="field"><div class="f-label">Recomendaciones de cuidado</div><div class="f-value">${esc(egr.recomendacionesCuidado)}</div></div>` : ''}
                ${egr.senalesAlerta ? `<div class="field"><div class="f-label">Señales de alerta</div><div class="f-value">${esc(egr.senalesAlerta)}</div></div>` : ''}
            </div>` : ''}

            ${prox.fecha ? `
            <div class="subheader">Próxima cita</div>
            <div class="field-grid cols3">
                <div class="field"><div class="f-label">Fecha</div><div class="f-value">${esc(prox.fecha)}</div></div>
                <div class="field"><div class="f-label">Hora</div><div class="f-value">${esc(prox.hora)}</div></div>
                <div class="field"><div class="f-label">Motivo</div><div class="f-value">${esc(prox.motivo)}</div></div>
            </div>` : ''}

            ${quienRecoge.nombre ? `
            <div class="subheader">Quién recoge al paciente</div>
            <div class="field-grid cols3">
                <div class="field"><div class="f-label">Nombre</div><div class="f-value">${esc(quienRecoge.nombre)}</div></div>
                <div class="field"><div class="f-label">Cédula</div><div class="f-value">${esc(quienRecoge.cedula)}</div></div>
                <div class="field"><div class="f-label">Relación</div><div class="f-value">${esc(quienRecoge.relacion)}</div></div>
            </div>` : ''}

            <div class="pdf-footer">
                <span>Veterinaria San Martin de Porres — Alta / Egreso</span>
                <span>${fdate(Date.now())}</span>
            </div>
        </div>`;
    }

    // ─────────────────────────────────────────────
    // FUNCIÓN PRINCIPAL
    // ─────────────────────────────────────────────

    let html2canvasLoadPromise = null;
    let jspdfLoadPromise = null;
    let cachedLogoDataUrl = null;
    const PDF_PAGE_WIDTH_PX = 720;

    function loadExternalScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error('No se pudo cargar: ' + src));
            document.head.appendChild(script);
        });
    }

    function getHtml2Canvas() {
        return window.html2canvas;
    }

    async function ensurePdfRenderLibs() {
        if (!getJsPDF()) {
            if (window.lazyLoadLibs && typeof window.lazyLoadLibs.loadHtml2Pdf === 'function') {
                await window.lazyLoadLibs.loadHtml2Pdf();
            }
            if (!getJsPDF()) {
                if (!jspdfLoadPromise) {
                    jspdfLoadPromise = loadExternalScript(
                        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
                    ).finally(() => { jspdfLoadPromise = null; });
                }
                await jspdfLoadPromise;
            }
        }

        if (typeof getHtml2Canvas() !== 'function') {
            if (!html2canvasLoadPromise) {
                html2canvasLoadPromise = loadExternalScript(
                    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
                ).finally(() => { html2canvasLoadPromise = null; });
            }
            await html2canvasLoadPromise;
        }

        if (typeof getHtml2Canvas() !== 'function') {
            throw new Error('html2canvas no disponible');
        }
        if (!getJsPDF()) {
            throw new Error('jsPDF no disponible');
        }
    }

    function getJsPDF() {
        return window.jspdf?.jsPDF || window.jsPDF;
    }

    function mountExpedienteDom(html) {
        const host = document.createElement('div');
        host.id = 'expediente-pdf-mount';
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = `position:fixed;left:-15000px;top:0;width:${PDF_PAGE_WIDTH_PX}px;background:#fff;overflow:visible;`;

        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const styleEl = parsed.querySelector('style');
        if (styleEl) {
            host.appendChild(styleEl.cloneNode(true));
        }
        while (parsed.body.firstChild) {
            host.appendChild(parsed.body.firstChild);
        }
        document.body.appendChild(host);
        return host;
    }

    async function captureElementCanvas(el) {
        const html2canvasFn = getHtml2Canvas();
        return html2canvasFn(el, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            scrollY: 0,
            scrollX: 0
        });
    }

    async function saveExpedientePdf(pageElements, fileName) {
        const JsPDF = getJsPDF();
        const html2canvasFn = getHtml2Canvas();
        if (!JsPDF) throw new Error('jsPDF no disponible');
        if (typeof html2canvasFn !== 'function') throw new Error('html2canvas no disponible');

        const pdf = new JsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const marginMm = 8;
        const pageWmm = pdf.internal.pageSize.getWidth();
        const pageHmm = pdf.internal.pageSize.getHeight();
        const contentWmm = pageWmm - marginMm * 2;
        const contentHmm = pageHmm - marginMm * 2;

        let pdfPageIndex = 0;

        for (let i = 0; i < pageElements.length; i++) {
            const el = pageElements[i];
            el.style.width = PDF_PAGE_WIDTH_PX + 'px';
            el.style.maxWidth = PDF_PAGE_WIDTH_PX + 'px';
            el.style.overflow = 'visible';

            const canvas = await captureElementCanvas(el);
            const sliceHeightPx = Math.max(1, Math.floor((canvas.width * contentHmm) / contentWmm));
            let srcY = 0;

            while (srcY < canvas.height) {
                const sliceH = Math.min(sliceHeightPx, canvas.height - srcY);
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = sliceH;
                const ctx = sliceCanvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

                const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
                const imgHmm = (sliceH * contentWmm) / canvas.width;

                if (pdfPageIndex > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', marginMm, marginMm, contentWmm, imgHmm);
                pdfPageIndex++;
                srcY += sliceH;
            }
        }

        pdf.save(fileName);
    }

    async function preloadLogo() {
        if (cachedLogoDataUrl) return cachedLogoDataUrl;
        const candidates = ['img/empresa.jpg', 'img/logo-vete-horizontal.png'];
        for (const relativePath of candidates) {
            try {
                const url = new URL(relativePath, window.location.href).href;
                const response = await fetch(url);
                if (!response.ok) continue;
                const blob = await response.blob();
                cachedLogoDataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                return cachedLogoDataUrl;
            } catch (_) { /* intentar siguiente ruta */ }
        }
        return '';
    }

    function injectLogo(html, logoDataUrl) {
        if (!logoDataUrl) return html;
        return html.replace(/src="img\/empresa\.jpg"/g, `src="${logoDataUrl}"`);
    }

    async function generar(internamiento) {
        await ensurePdfRenderLibs();
        const logoDataUrl = await preloadLogo();

        const sections = [
            buildPortada(internamiento),
            buildIngreso(internamiento),
            buildMedicacion(internamiento),
            buildTurnos(internamiento),
            buildProcedimientos(internamiento),
            buildCirugias(internamiento),
            buildEvolucion(internamiento),
            buildLlamadas(internamiento),
            buildDefunciones(internamiento),
            buildTransfusiones(internamiento),
            buildRer(internamiento),
            buildAlimentacionAsistida(internamiento),
            buildHidratacion(internamiento),
            buildCurvaGlucosa(internamiento),
            buildEgreso(internamiento)
        ].filter(Boolean).join('');

        let html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8">${buildCSS()}</head>
<body>${sections}</body>
</html>`;
        html = injectLogo(html, logoDataUrl);

        const nombreMascota = (internamiento.referencias?.nombreMascota || 'Paciente').replace(/\s+/g, '_');
        const expNum = internamiento.metadata?.expedienteNumero || internamiento.metadata?.internamientoId || 'SN';
        const fileName = `Expediente_${nombreMascota}_${expNum}.pdf`;

        const host = mountExpedienteDom(html);
        try {
            await new Promise((resolve) => setTimeout(resolve, 450));
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }
            const imgs = host.querySelectorAll('img');
            await Promise.all(Array.from(imgs).map((img) => {
                if (img.complete) return Promise.resolve();
                return new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            }));
            const pageEls = host.querySelectorAll('.page-first, .page');
            if (!pageEls.length) {
                throw new Error('El expediente no tiene páginas para exportar.');
            }
            await saveExpedientePdf(Array.from(pageEls), fileName);
        } finally {
            host.remove();
        }

        return fileName;
    }

    return { generar, preloadLogo };

})();
