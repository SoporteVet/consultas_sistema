// ====================================================================
// MODULO DE INTERNAMIENTO - DISPONIBILIDAD DE CAMPOS (JAULAS)
// ====================================================================
// Submódulo bajo Internamientos: semáforo de disponibilidad de jaulas,
// asignación de ubicación por paciente y panel de configuración (admin).
// Depende de InternamientoModule (internamiento-module.js).
// ====================================================================

(function () {
    if (typeof InternamientoModule === 'undefined') {
        console.warn('Disponibilidad de campos: InternamientoModule no disponible');
        return;
    }

    const P = InternamientoModule.prototype;

    // Estados de internamiento que ocupan físicamente una jaula.
    const ESTADOS_OCUPAN_JAULA = ['activo', 'critico', 'alta'];

    // Etiquetas legibles de tamaño de jaula.
    const TAMANO_LABEL = { pequena: 'Pequeña', grande: 'Grande', estandar: 'Estándar' };
    const TAMANO_ABBR = { pequena: 'P', grande: 'G', estandar: 'E' };

    // ================================================================
    // CATÁLOGO (internamientoConfig/campos) + DEFAULTS
    // ================================================================

    P._getDefaultCamposCatalog = function () {
        const buildJaulas = (specs) => {
            const jaulas = {};
            specs.forEach(({ numero, tamano }) => {
                jaulas['j' + numero] = { id: 'j' + numero, numero, tamano, activa: true };
            });
            return jaulas;
        };
        const rango = (desde, hasta, tamano) => {
            const out = [];
            for (let n = desde; n <= hasta; n++) out.push({ numero: n, tamano });
            return out;
        };
        return {
            areas: {
                criticos: {
                    label: 'Críticos',
                    orden: 1,
                    soloObservacion: false,
                    jaulas: buildJaulas([...rango(1, 7, 'pequena'), ...rango(8, 9, 'grande')])
                },
                infecciosos: {
                    label: 'Infecciosos',
                    orden: 2,
                    soloObservacion: false,
                    jaulas: buildJaulas(rango(1, 4, 'pequena'))
                },
                estables: {
                    label: 'Estables',
                    orden: 3,
                    soloObservacion: true,
                    jaulas: buildJaulas(rango(1, 4, 'pequena'))
                },
                gatos: {
                    label: 'Gatos',
                    orden: 4,
                    soloObservacion: false,
                    jaulas: buildJaulas(rango(1, 4, 'estandar'))
                }
            },
            metadata: { creadoEn: Date.now(), actualizadoEn: Date.now() },
            anotacion: { texto: '', actualizadoEn: null, actualizadoPor: null, actualizadoPorNombre: null }
        };
    };

    /** Conecta el listener del catálogo y crea defaults si no existe. Idempotente. */
    P.ensureCamposCatalogLoaded = async function () {
        if (this._camposCatalogReady && this.camposCatalog) return true;
        if (!window.database) return false;

        if (!this.camposConfigRef) {
            this.camposConfigRef = window.database.ref('internamientoConfig/campos');
        }

        try {
            const snapshot = await this.camposConfigRef.once('value');
            if (!snapshot.exists()) {
                const defaults = this._getDefaultCamposCatalog();
                await this.camposConfigRef.set(defaults);
                this.camposCatalog = defaults;
            } else {
                this.camposCatalog = snapshot.val();
            }
        } catch (err) {
            console.error('Error cargando catálogo de campos:', err);
            // Fallback en memoria para no bloquear la vista.
            this.camposCatalog = this.camposCatalog || this._getDefaultCamposCatalog();
        }

        this._setupCamposCatalogListener();
        this._camposCatalogReady = true;
        return true;
    };

    P._setupCamposCatalogListener = function () {
        if (this._camposCatalogListenerSet || !this.camposConfigRef) return;
        this.camposConfigRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.camposCatalog = snapshot.val();
            }
            this.refreshDisponibilidadCamposIfVisible();
            this._refrescarPanelConfigCampos();
        });
        this._camposCatalogListenerSet = true;
    };

    /** Áreas ordenadas: [{ key, label, soloObservacion, jaulas: [...] }] */
    P.getAreasCampos = function () {
        const areas = (this.camposCatalog && this.camposCatalog.areas) || {};
        return Object.keys(areas)
            .map((key) => {
                const a = areas[key] || {};
                const jaulas = Object.values(a.jaulas || {})
                    .filter((j) => j && j.activa !== false)
                    .sort((x, y) => (x.numero || 0) - (y.numero || 0));
                return {
                    key,
                    label: a.label || key,
                    orden: a.orden || 99,
                    soloObservacion: !!a.soloObservacion,
                    jaulas
                };
            })
            .sort((x, y) => x.orden - y.orden);
    };

    /** Incluye jaulas inactivas (para el panel de configuración). */
    P.getJaulasAreaConfig = function (areaKey) {
        const a = (this.camposCatalog && this.camposCatalog.areas && this.camposCatalog.areas[areaKey]) || {};
        return Object.values(a.jaulas || {}).sort((x, y) => (x.numero || 0) - (y.numero || 0));
    };

    // ================================================================
    // OCUPACIÓN Y SEMÁFORO
    // ================================================================

    P._estadoOcupaJaula = function (estado) {
        return ESTADOS_OCUPAN_JAULA.includes(estado || 'activo');
    };

    /** Map "area#numero" -> { internamientoId, internamiento } para pacientes activos con jaula. */
    P.getOcupacionCampos = function () {
        const ocupacion = new Map();
        this.internamientos.forEach((internamiento, mapKey) => {
            const estado = internamiento?.estado?.actual || 'activo';
            if (!this._estadoOcupaJaula(estado)) return;
            const u = internamiento?.ubicacion;
            if (!u || !u.area || u.jaulaNumero == null) return;
            ocupacion.set(`${u.area}#${u.jaulaNumero}`, { internamientoId: mapKey, internamiento });
        });
        return ocupacion;
    };

    P._jaulaOcupadaPor = function (areaKey, numero, ocupacion) {
        const oc = ocupacion || this.getOcupacionCampos();
        return oc.get(`${areaKey}#${numero}`) || null;
    };

    /**
     * Calcula el semáforo global.
     * - rojo: 0 jaulas libres en total
     * - verde: todas las áreas tienen disponibilidad por cada tamaño presente
     * - amarillo: hay al menos 1 libre pero no cumple verde
     */
    P.calcularSemaforoCampos = function () {
        const ocupacion = this.getOcupacionCampos();
        const areas = this.getAreasCampos();
        let totalLibres = 0;
        let totalActivas = 0;
        const detalleAreas = [];
        let todasOk = true;

        areas.forEach((area) => {
            // Agrupar por tamaño: { tamano: { total, libres } }
            const grupos = {};
            area.jaulas.forEach((j) => {
                const t = j.tamano || 'estandar';
                if (!grupos[t]) grupos[t] = { total: 0, libres: 0 };
                grupos[t].total += 1;
                totalActivas += 1;
                const ocupada = ocupacion.has(`${area.key}#${j.numero}`);
                if (!ocupada) {
                    grupos[t].libres += 1;
                    totalLibres += 1;
                }
            });

            // El área "tiene disponibilidad" si cada tamaño presente tiene >=1 libre.
            const tamanos = Object.keys(grupos);
            const areaOk = tamanos.length > 0 && tamanos.every((t) => grupos[t].libres >= 1);
            if (tamanos.length === 0) {
                // Área sin jaulas activas: no bloquea el verde.
            } else if (!areaOk) {
                todasOk = false;
            }

            const resumenTamanos = tamanos
                .map((t) => `${grupos[t].libres} ${TAMANO_LABEL[t] || t}`)
                .join(' · ');
            detalleAreas.push({
                key: area.key,
                label: area.label,
                soloObservacion: area.soloObservacion,
                grupos,
                resumen: resumenTamanos || 'sin jaulas'
            });
        });

        let color;
        if (totalLibres === 0) color = 'rojo';
        else if (todasOk) color = 'verde';
        else color = 'amarillo';

        return { color, totalLibres, totalActivas, ocupadas: totalActivas - totalLibres, areas: detalleAreas };
    };

    // ================================================================
    // PERMISOS
    // ================================================================

    P._rolNormalizadoCampos = function () {
        const role = sessionStorage.getItem('userRole') || '';
        return String(role).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    P.canAccessDisponibilidadCampos = function () {
        // Reutiliza el guard del módulo (excluye 'visitas' y roles sin acceso).
        return this.canAccessModule();
    };

    P.canEditarUbicacionCampo = function () {
        return ['admin', 'internos'].includes(this._rolNormalizadoCampos());
    };

    /** Admin e internos: semáforo con desglose por área y tamaños. */
    P.canVerSemaforoDetalleCampos = function () {
        return ['admin', 'internos'].includes(this._rolNormalizadoCampos());
    };

    /** Admin e internos: grilla de jaulas con pacientes (mapa completo). */
    P.canVerGrillaDetalleCampos = function () {
        return ['admin', 'internos'].includes(this._rolNormalizadoCampos());
    };

    P.canConfigurarCatalogoCampos = function () {
        return this._rolNormalizadoCampos() === 'admin';
    };

    P.canEditarAnotacionCampos = function () {
        return ['admin', 'internos'].includes(this._rolNormalizadoCampos());
    };

    P.getAnotacionCampos = function () {
        const a = this.camposCatalog?.anotacion;
        return {
            texto: (a?.texto || '').trim(),
            actualizadoEn: a?.actualizadoEn || null,
            actualizadoPorNombre: a?.actualizadoPorNombre || null
        };
    };

    P._renderAnotacionCampos = function () {
        const puedeEditar = this.canEditarAnotacionCampos();
        const { texto, actualizadoPorNombre, actualizadoEn } = this.getAnotacionCampos();
        const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

        if (puedeEditar) {
            const meta = actualizadoEn && actualizadoPorNombre
                ? `<div class="disp-anotacion-meta">Actualizado por ${esc(actualizadoPorNombre)} · ${new Date(actualizadoEn).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</div>`
                : '';
            return `
                <div class="disp-anotacion disp-anotacion--edit">
                    <label for="dispAnotacionTexto"><i class="fas fa-sticky-note"></i> Anotaciones</label>
                    <textarea id="dispAnotacionTexto" rows="2" maxlength="500"
                        placeholder="Ej: Jaula 5 en mantenimiento, esperando ingreso de gato crítico…">${esc(texto)}</textarea>
                    <div class="disp-anotacion-actions">
                        <button type="button" class="btn btn-sm btn-primary" onclick="window.internamientoModule.guardarAnotacionCampos()">
                            <i class="fas fa-save"></i> Guardar anotación
                        </button>
                        ${meta}
                    </div>
                </div>`;
        }

        if (!texto) return '';

        const meta = actualizadoPorNombre
            ? `<div class="disp-anotacion-meta">${esc(actualizadoPorNombre)}${actualizadoEn ? ` · ${new Date(actualizadoEn).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</div>`
            : '';

        return `
            <div class="disp-anotacion disp-anotacion--readonly">
                <div class="disp-anotacion-label"><i class="fas fa-sticky-note"></i> Anotaciones</div>
                <div class="disp-anotacion-texto">${esc(texto).replace(/\n/g, '<br>')}</div>
                ${meta}
            </div>`;
    };

    P.guardarAnotacionCampos = async function () {
        if (!this.canEditarAnotacionCampos()) {
            this.showAlert('No tienes permisos para editar las anotaciones.', 'Acceso Denegado', 'error');
            return;
        }
        if (!this.camposConfigRef) {
            await this.ensureCamposCatalogLoaded();
        }
        const textarea = document.getElementById('dispAnotacionTexto');
        const texto = (textarea?.value || '').trim();
        const payload = {
            texto,
            actualizadoEn: Date.now(),
            actualizadoPor: sessionStorage.getItem('userId') || null,
            actualizadoPorNombre: sessionStorage.getItem('userName') || null
        };
        try {
            await this.camposConfigRef.child('anotacion').set(payload);
            if (this.camposCatalog) this.camposCatalog.anotacion = payload;
            this.showNotification('Anotación guardada', 'success');
        } catch (err) {
            console.error('Error guardando anotación:', err);
            this.showAlert('Error al guardar la anotación: ' + (err.message || err), 'Error', 'error');
        }
    };

    // ================================================================
    // VISTA PRINCIPAL
    // ================================================================

    P.showDisponibilidadCamposView = async function () {
        if (!this.canAccessDisponibilidadCampos()) {
            this.showAlert('No tienes permisos para ver la disponibilidad de campos.', 'Acceso Denegado', 'error');
            return;
        }

        const sections = document.querySelectorAll('.content section');
        sections.forEach((section) => {
            section.classList.add('hidden');
            section.classList.remove('active');
        });

        const internamientosSection = document.getElementById('internamientosSection');
        if (!internamientosSection) {
            console.error('No se encontró la sección internamientosSection');
            return;
        }
        internamientosSection.classList.remove('hidden');
        setTimeout(() => internamientosSection.classList.add('active'), 50);

        this.showInternamientoView('disponibilidad_campos');
        const container = document.getElementById('internamiento-disponibilidad_campos');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Cargando disponibilidad de campos...</p>
                </div>`;
        }

        if (typeof setActiveSubmenuButtonHTML === 'function') {
            setActiveSubmenuButtonHTML('disponibilidadCamposBtn');
        }

        const listo = await this.onModuleEnter();
        if (!listo) return;
        await this.ensureCamposCatalogLoaded();
        this.loadDisponibilidadCamposView();
    };

    P.refreshDisponibilidadCamposIfVisible = function () {
        const container = document.getElementById('internamiento-disponibilidad_campos');
        if (!container || container.classList.contains('hidden')) return;
        const textarea = document.getElementById('dispAnotacionTexto');
        if (textarea && document.activeElement === textarea) return;
        clearTimeout(this._dispCamposRefreshTimer);
        this._dispCamposRefreshTimer = setTimeout(() => this.loadDisponibilidadCamposView(), 120);
    };

    P.loadDisponibilidadCamposView = function () {
        const container = document.getElementById('internamiento-disponibilidad_campos');
        if (!container) return;

        const semaforo = this.calcularSemaforoCampos();
        const ocupacion = this.getOcupacionCampos();
        const puedeEditar = this.canEditarUbicacionCampo();
        const puedeConfigurar = this.canConfigurarCatalogoCampos();
        const verSemaforoDetalle = this.canVerSemaforoDetalleCampos();
        const verGrillaDetalle = this.canVerGrillaDetalleCampos();

        const areasHTML = verGrillaDetalle
            ? this.getAreasCampos()
                .map((area) => this._renderAreaBloqueCampos(area, ocupacion, puedeEditar))
                .join('')
            : '';

        const notaVista = verGrillaDetalle && !puedeEditar
            ? `
            <div class="disp-readonly-note">
                <i class="fas fa-eye"></i> Vista de solo lectura. La asignación de jaulas la realizan internos o administración.
            </div>`
            : '';

        container.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-map-marked-alt"></i> Disponibilidad de campos</h2>
                <div>
                    ${puedeConfigurar ? `
                    <button class="btn btn-secondary" onclick="window.internamientoModule._abrirPanelConfigCampos()" style="margin-right:10px;">
                        <i class="fas fa-cog"></i> Configurar campos
                    </button>` : ''}
                    <button class="btn btn-secondary" onclick="window.internamientoModule.loadDisponibilidadCamposView()" style="margin-right:10px;">
                        <i class="fas fa-sync"></i> Actualizar
                    </button>
                    <button class="btn btn-secondary" onclick="window.internamientoModule.showInternamientosSection()">
                        <i class="fas fa-arrow-left"></i> Volver
                    </button>
                </div>
            </div>

            ${this._renderSemaforoCampos(semaforo, verSemaforoDetalle)}

            ${this._renderAnotacionCampos()}

            ${notaVista}

            ${verGrillaDetalle ? `
            <div class="disp-areas-grid">
                ${areasHTML}
            </div>` : ''}
        `;
    };

    P._renderSemaforoCampos = function (semaforo, conDetalle = true) {
        const cfg = {
            verde: { icon: 'fa-circle-check', titulo: 'Disponibilidad amplia', desc: 'Hay jaulas libres en todas las áreas.' },
            amarillo: { icon: 'fa-triangle-exclamation', titulo: 'Disponibilidad limitada', desc: 'Quedan jaulas libres, pero alguna área o tamaño está completo.' },
            rojo: { icon: 'fa-circle-xmark', titulo: 'Sin disponibilidad', desc: 'No hay jaulas libres en ninguna área.' }
        }[semaforo.color];

        const tituloResumido = semaforo.color === 'verde'
            ? 'Hay jaulas disponibles'
            : semaforo.color === 'amarillo'
                ? 'Disponibilidad limitada'
                : 'Sin jaulas libres';

        const detalle = semaforo.areas
            .map((a) => `<span class="disp-resumen-area"><strong>${a.label}:</strong> ${a.resumen} libres</span>`)
            .join('');

        return `
            <div class="disp-semaforo disp-semaforo--${semaforo.color}">
                <div class="disp-semaforo-luz"><i class="fas ${cfg.icon}"></i></div>
                <div class="disp-semaforo-info">
                    <div class="disp-semaforo-titulo">${conDetalle ? cfg.titulo : tituloResumido}</div>
                    ${conDetalle ? `<div class="disp-semaforo-desc">${cfg.desc}</div>` : ''}
                    <div class="disp-semaforo-nums">
                        ${conDetalle ? `
                        <span><strong>${semaforo.totalLibres}</strong> libres</span>
                        <span><strong>${semaforo.ocupadas}</strong> ocupadas</span>
                        ` : ''}
                        <span><strong>${semaforo.totalActivas}</strong> totales</span>
                    </div>
                    ${conDetalle ? `<div class="disp-resumen-areas">${detalle}</div>` : ''}
                </div>
            </div>`;
    };

    P._renderAreaBloqueCampos = function (area, ocupacion, puedeEditar) {
        const jaulasHTML = area.jaulas.length
            ? area.jaulas.map((j) => this._renderJaulaCampo(area, j, ocupacion, puedeEditar)).join('')
            : '<div class="disp-area-vacia">Sin jaulas activas</div>';

        return `
            <div class="disp-area-bloque">
                <header class="disp-area-header">
                    <h3>${area.label}</h3>
                    ${area.soloObservacion ? '<span class="disp-area-tag">Solo observación</span>' : ''}
                </header>
                <div class="disp-jaulas-grid">
                    ${jaulasHTML}
                </div>
            </div>`;
    };

    P._renderJaulaCampo = function (area, jaula, ocupacion, puedeEditar) {
        const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const ocupante = ocupacion.get(`${area.key}#${jaula.numero}`);
        const abbr = TAMANO_ABBR[jaula.tamano] || '';
        const claseEstado = ocupante ? 'disp-jaula--ocupada' : 'disp-jaula--libre';
        const clickable = puedeEditar ? 'disp-jaula--click' : '';
        const onclick = puedeEditar
            ? `onclick="window.internamientoModule.onClickJaulaCampo('${area.key}', ${jaula.numero})"`
            : '';

        let cuerpo;
        if (ocupante) {
            const nombre = esc(ocupante.internamiento?.referencias?.nombreMascota || 'Paciente');
            const exp = esc(ocupante.internamiento?.metadata?.expedienteNumero || '');
            cuerpo = `
                <div class="disp-jaula-paciente"><i class="fas fa-paw"></i> ${nombre}</div>
                ${exp ? `<div class="disp-jaula-exp">Exp. ${exp}</div>` : ''}`;
        } else {
            cuerpo = '<div class="disp-jaula-libre-txt"><i class="fas fa-check"></i> Libre</div>';
        }

        return `
            <div class="disp-jaula ${claseEstado} ${clickable}" ${onclick}>
                <div class="disp-jaula-top">
                    <span class="disp-jaula-num">Jaula ${jaula.numero}</span>
                    ${abbr ? `<span class="disp-jaula-tamano" title="${TAMANO_LABEL[jaula.tamano] || ''}">${abbr}</span>` : ''}
                </div>
                ${cuerpo}
            </div>`;
    };

    // ================================================================
    // ASIGNACIÓN / MOVIMIENTO / LIBERACIÓN
    // ================================================================

    P._pacientesSinJaulaCampos = function () {
        const lista = [];
        this.internamientos.forEach((internamiento, mapKey) => {
            const estado = internamiento?.estado?.actual || 'activo';
            if (!this._estadoOcupaJaula(estado)) return;
            if (internamiento?.ubicacion && internamiento.ubicacion.area) return;
            if (typeof this.esRegistroInternamientoReal === 'function'
                && !this.esRegistroInternamientoReal(internamiento?.metadata?.internamientoId || mapKey)) return;
            lista.push({ internamientoId: mapKey, internamiento });
        });
        lista.sort((a, b) =>
            (a.internamiento?.referencias?.nombreMascota || '').localeCompare(b.internamiento?.referencias?.nombreMascota || ''));
        return lista;
    };

    P.onClickJaulaCampo = function (areaKey, numero) {
        if (!this.canEditarUbicacionCampo()) return;
        const ocupacion = this.getOcupacionCampos();
        const ocupante = ocupacion.get(`${areaKey}#${numero}`);
        if (ocupante) {
            this._abrirModalJaulaOcupada(areaKey, numero, ocupante.internamientoId);
        } else {
            this._abrirModalAsignarJaula(areaKey, numero);
        }
    };

    P._areaLabelCampos = function (areaKey) {
        const a = this.camposCatalog?.areas?.[areaKey];
        return (a && a.label) || areaKey;
    };

    P._abrirModalAsignarJaula = function (areaKey, numero) {
        const area = this.getAreasCampos().find((a) => a.key === areaKey);
        const pacientes = this._pacientesSinJaulaCampos();
        const esc = (s) => String(s ?? '').replace(/</g, '&lt;').replace(/"/g, '&quot;');

        const opciones = pacientes.length
            ? pacientes.map((p) => {
                const nombre = esc(p.internamiento?.referencias?.nombreMascota || 'Paciente');
                const exp = esc(p.internamiento?.metadata?.expedienteNumero || '');
                const idAttr = esc(p.internamientoId);
                return `<option value="${idAttr}">${nombre}${exp ? ` · Exp. ${exp}` : ''}</option>`;
            }).join('')
            : '';

        const avisoObs = (area && area.soloObservacion)
            ? `<div class="disp-modal-aviso"><i class="fas fa-info-circle"></i> Área de solo observación: usar solo para pacientes en vigilancia.</div>`
            : '';

        const contenido = `
            <div style="max-width: 460px;">
                <p style="margin:0 0 14px 0; color:#94a3b8;">Asignar <strong>${this._areaLabelCampos(areaKey)} · Jaula ${numero}</strong> a un paciente sin jaula.</p>
                ${avisoObs}
                ${pacientes.length ? `
                <div class="form-group">
                    <label for="dispSelectPaciente" style="display:block; margin-bottom:8px; color:#94a3b8;">Paciente</label>
                    <select id="dispSelectPaciente" class="int-card-select" style="width:100%; padding:10px 12px;">
                        ${opciones}
                    </select>
                </div>
                <div style="margin-top:20px; display:flex; gap:12px; justify-content:flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="button" class="btn btn-primary" style="background:#22c55e; border-color:#22c55e;"
                        onclick="window.internamientoModule.confirmarAsignarJaula('${areaKey}', ${numero})">
                        <i class="fas fa-check"></i> Asignar
                    </button>
                </div>` : `
                <div class="disp-modal-aviso"><i class="fas fa-info-circle"></i> No hay pacientes activos sin jaula asignada.</div>
                <div style="margin-top:20px; display:flex; justify-content:flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                </div>`}
            </div>`;

        const modal = this.createModal(`Asignar jaula`, contenido, 'fa-map-pin');
        document.body.appendChild(modal);
    };

    P.confirmarAsignarJaula = function (areaKey, numero) {
        const select = document.getElementById('dispSelectPaciente');
        if (!select || !select.value) {
            this.showAlert('Seleccione un paciente.', 'Dato requerido', 'warning');
            return;
        }
        const internamientoId = select.value;
        document.querySelector('.modal-overlay')?.remove();
        this.asignarUbicacionCampo(internamientoId, areaKey, numero);
    };

    P._abrirModalJaulaOcupada = function (areaKey, numero, internamientoId) {
        const internamiento = this.internamientos.get(internamientoId);
        const esc = (s) => String(s ?? '').replace(/</g, '&lt;');
        const nombre = esc(internamiento?.referencias?.nombreMascota || 'Paciente');
        const exp = esc(internamiento?.metadata?.expedienteNumero || '');
        const idAttr = String(internamientoId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const contenido = `
            <div style="max-width: 440px;">
                <p style="margin:0 0 8px 0; color:#94a3b8;"><strong>${this._areaLabelCampos(areaKey)} · Jaula ${numero}</strong></p>
                <div class="disp-modal-ocupante">
                    <i class="fas fa-paw"></i> ${nombre}${exp ? ` · Exp. ${exp}` : ''}
                </div>
                <div style="margin-top:20px; display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button type="button" class="btn btn-primary"
                        onclick="this.closest('.modal-overlay').remove(); window.internamientoModule._abrirModalMoverJaula('${idAttr}')">
                        <i class="fas fa-arrows-up-down-left-right"></i> Mover de jaula
                    </button>
                    <button type="button" class="btn btn-primary" style="background:#ef4444; border-color:#ef4444;"
                        onclick="this.closest('.modal-overlay').remove(); window.internamientoModule.liberarJaulaCampo('${idAttr}')">
                        <i class="fas fa-door-open"></i> Liberar jaula
                    </button>
                </div>
            </div>`;

        const modal = this.createModal('Jaula ocupada', contenido, 'fa-bed');
        document.body.appendChild(modal);
    };

    P._abrirModalMoverJaula = function (internamientoId) {
        const internamiento = this.internamientos.get(internamientoId);
        if (!internamiento) return;
        const ocupacion = this.getOcupacionCampos();
        const idAttr = String(internamientoId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const bloques = this.getAreasCampos().map((area) => {
            const libres = area.jaulas.filter((j) => !ocupacion.has(`${area.key}#${j.numero}`));
            if (!libres.length) return '';
            const botones = libres.map((j) => {
                const abbr = TAMANO_ABBR[j.tamano] || '';
                return `<button type="button" class="disp-mover-jaula-btn"
                    onclick="this.closest('.modal-overlay').remove(); window.internamientoModule.asignarUbicacionCampo('${idAttr}', '${area.key}', ${j.numero})">
                    Jaula ${j.numero}${abbr ? ` <span class="disp-jaula-tamano">${abbr}</span>` : ''}
                </button>`;
            }).join('');
            return `
                <div class="disp-mover-area">
                    <div class="disp-mover-area-label">${area.label}</div>
                    <div class="disp-mover-area-jaulas">${botones}</div>
                </div>`;
        }).filter(Boolean).join('');

        const contenido = `
            <div style="max-width: 520px;">
                <p style="margin:0 0 14px 0; color:#94a3b8;">Seleccione la jaula libre de destino.</p>
                ${bloques || '<div class="disp-modal-aviso"><i class="fas fa-info-circle"></i> No hay jaulas libres disponibles.</div>'}
                <div style="margin-top:20px; display:flex; justify-content:flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                </div>
            </div>`;

        const modal = this.createModal('Mover de jaula', contenido, 'fa-arrows-up-down-left-right');
        document.body.appendChild(modal);
    };

    /** Busca la jaula del catálogo para conocer su tamaño actual. */
    P._buscarJaulaCatalogo = function (areaKey, numero) {
        const a = this.camposCatalog?.areas?.[areaKey];
        if (!a || !a.jaulas) return null;
        return Object.values(a.jaulas).find((j) => Number(j.numero) === Number(numero) && j.activa !== false) || null;
    };

    P.asignarUbicacionCampo = async function (internamientoId, areaKey, numero) {
        if (!this.canEditarUbicacionCampo()) {
            this.showAlert('No tienes permisos para asignar jaulas.', 'Acceso Denegado', 'error');
            return;
        }
        const internamiento = this.internamientos.get(internamientoId);
        if (!internamiento) {
            this.showAlert('Paciente no encontrado.', 'Error', 'error');
            return;
        }

        // Validar que no haya otro paciente activo en esa jaula.
        const ocupante = this._jaulaOcupadaPor(areaKey, numero);
        if (ocupante && ocupante.internamientoId !== internamientoId) {
            this.showAlert('Esa jaula ya está ocupada por otro paciente.', 'Jaula ocupada', 'warning');
            return;
        }

        const jaula = this._buscarJaulaCatalogo(areaKey, numero);
        if (!jaula) {
            this.showAlert('La jaula seleccionada ya no está disponible en el catálogo.', 'Jaula no disponible', 'warning');
            return;
        }

        const ubicacion = {
            area: areaKey,
            jaulaNumero: numero,
            jaulaTamano: jaula.tamano,
            asignadoEn: Date.now(),
            asignadoPor: sessionStorage.getItem('userId') || null,
            asignadoPorNombre: sessionStorage.getItem('userName') || null
        };

        try {
            await this.internamientosRef.child(internamientoId).update({
                ubicacion,
                'metadata/fechaUltimaActualizacion': Date.now()
            });
            this.internamientos.set(internamientoId, { ...internamiento, ubicacion });
            this.showNotification(`Asignado a ${this._areaLabelCampos(areaKey)} · Jaula ${numero}`, 'success');
            this.loadDisponibilidadCamposView();
            this.refreshInternamientosList();
        } catch (err) {
            console.error('Error asignando jaula:', err);
            this.showAlert('Error al asignar la jaula: ' + (err.message || err), 'Error', 'error');
        }
    };

    P.liberarJaulaCampo = async function (internamientoId) {
        if (!this.canEditarUbicacionCampo()) {
            this.showAlert('No tienes permisos para liberar jaulas.', 'Acceso Denegado', 'error');
            return;
        }
        const internamiento = this.internamientos.get(internamientoId);
        if (!internamiento) return;
        try {
            await this.internamientosRef.child(internamientoId).update({
                ubicacion: null,
                'metadata/fechaUltimaActualizacion': Date.now()
            });
            const copia = { ...internamiento };
            delete copia.ubicacion;
            this.internamientos.set(internamientoId, copia);
            this.showNotification('Jaula liberada.', 'success');
            this.loadDisponibilidadCamposView();
            this.refreshInternamientosList();
        } catch (err) {
            console.error('Error liberando jaula:', err);
            this.showAlert('Error al liberar la jaula: ' + (err.message || err), 'Error', 'error');
        }
    };

    /** Chip de ubicación para la tarjeta de Ver Internamientos. */
    P.renderChipUbicacionCampo = function (internamiento, estado) {
        if (!this._estadoOcupaJaula(estado)) return '';
        const u = internamiento?.ubicacion;
        if (u && u.area && u.jaulaNumero != null) {
            const abbr = TAMANO_ABBR[u.jaulaTamano] || '';
            const label = this._areaLabelCampos(u.area);
            return `<span class="int-card-chip int-card-chip--ubicacion"><i class="fas fa-map-pin"></i> ${label} · Jaula ${u.jaulaNumero}${abbr ? ` (${abbr})` : ''}</span>`;
        }
        return `<span class="int-card-chip int-card-chip--sin-jaula"><i class="fas fa-map-pin"></i> Sin jaula</span>`;
    };

    // ================================================================
    // PANEL DE CONFIGURACIÓN DEL CATÁLOGO (SOLO ADMIN)
    // ================================================================

    P._abrirPanelConfigCampos = function () {
        if (!this.canConfigurarCatalogoCampos()) {
            this.showAlert('Solo administración puede configurar los campos.', 'Acceso Denegado', 'error');
            return;
        }
        const contenido = `
            <div style="max-width: 640px;">
                <p style="margin:0 0 14px 0; color:#94a3b8;">Cambie el tamaño de las jaulas, agregue jaulas nuevas o desactive jaulas libres por área.</p>
                <div id="configCamposBody">${this._renderPanelConfigCamposBody()}</div>
                <div style="margin-top:20px; display:flex; justify-content:flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                </div>
            </div>`;
        const modal = this.createModal('Configurar campos', contenido, 'fa-cog');
        modal.setAttribute('data-disp-config', 'true');
        document.body.appendChild(modal);
    };

    P._refrescarPanelConfigCampos = function () {
        const body = document.getElementById('configCamposBody');
        if (body) body.innerHTML = this._renderPanelConfigCamposBody();
    };

    P._renderPanelConfigCamposBody = function () {
        const ocupacion = this.getOcupacionCampos();
        const areas = (this.camposCatalog && this.camposCatalog.areas) || {};
        return Object.keys(areas)
            .map((key) => ({ key, orden: areas[key].orden || 99 }))
            .sort((a, b) => a.orden - b.orden)
            .map((a) => this._renderConfigAreaCampos(a.key, ocupacion))
            .join('');
    };

    P._renderConfigAreaCampos = function (areaKey, ocupacion) {
        const area = this.camposCatalog?.areas?.[areaKey] || {};
        const jaulas = this.getJaulasAreaConfig(areaKey);
        const opcionesTamano = (sel) => ['pequena', 'grande', 'estandar']
            .map((t) => `<option value="${t}" ${t === sel ? 'selected' : ''}>${TAMANO_LABEL[t]}</option>`).join('');

        const filas = jaulas.map((j) => {
            const ocupada = ocupacion.has(`${areaKey}#${j.numero}`);
            const inactiva = j.activa === false;
            return `
                <div class="disp-config-fila ${inactiva ? 'disp-config-fila--inactiva' : ''}">
                    <span class="disp-config-num">Jaula ${j.numero}</span>
                    <select class="disp-config-tamano" ${ocupada ? 'disabled' : ''}
                        onchange="window.internamientoModule.cambiarTamanoJaulaConfig('${areaKey}', '${j.id}', this.value)">
                        ${opcionesTamano(j.tamano)}
                    </select>
                    <span class="disp-config-estado">
                        ${inactiva ? '<span class="disp-config-badge disp-config-badge--off">Inactiva</span>'
                            : ocupada ? '<span class="disp-config-badge disp-config-badge--ocupada">Ocupada</span>'
                            : '<span class="disp-config-badge disp-config-badge--libre">Libre</span>'}
                    </span>
                    ${inactiva
                        ? `<button type="button" class="btn btn-sm btn-secondary" onclick="window.internamientoModule.reactivarJaulaConfig('${areaKey}', '${j.id}')">Reactivar</button>`
                        : `<button type="button" class="btn btn-sm btn-secondary" ${ocupada ? 'disabled title="No se puede desactivar una jaula ocupada"' : ''}
                            onclick="window.internamientoModule.desactivarJaulaConfig('${areaKey}', '${j.id}')">Desactivar</button>`}
                </div>`;
        }).join('');

        return `
            <div class="disp-config-area">
                <div class="disp-config-area-head">
                    <strong>${area.label || areaKey}</strong>
                    ${area.soloObservacion ? '<span class="disp-area-tag">Solo observación</span>' : ''}
                </div>
                <div class="disp-config-filas">${filas || '<div class="disp-area-vacia">Sin jaulas</div>'}</div>
                <div class="disp-config-add">
                    <select id="dispAddTamano_${areaKey}" class="disp-config-tamano">
                        ${opcionesTamano(areaKey === 'gatos' ? 'estandar' : 'pequena')}
                    </select>
                    <button type="button" class="btn btn-sm btn-primary" style="background:#22c55e; border-color:#22c55e;"
                        onclick="window.internamientoModule.agregarJaulaConfig('${areaKey}')">
                        <i class="fas fa-plus"></i> Agregar jaula
                    </button>
                </div>
            </div>`;
    };

    P.cambiarTamanoJaulaConfig = async function (areaKey, jaulaId, nuevoTamano) {
        if (!this.canConfigurarCatalogoCampos()) return;
        const area = this.camposCatalog?.areas?.[areaKey];
        const jaula = area?.jaulas?.[jaulaId];
        if (!jaula) return;

        const ocupante = this._jaulaOcupadaPor(areaKey, jaula.numero);
        if (ocupante) {
            // Jaula ocupada: el <select> está deshabilitado, pero por seguridad se valida.
            this.showAlert('No se puede cambiar el tamaño de una jaula ocupada.', 'Jaula ocupada', 'warning');
            this._refrescarPanelConfigCampos();
            return;
        }

        try {
            await this.camposConfigRef.child(`areas/${areaKey}/jaulas/${jaulaId}/tamano`).set(nuevoTamano);
            await this.camposConfigRef.child('metadata/actualizadoEn').set(Date.now());
            this.showNotification(`Jaula ${jaula.numero} ahora es ${TAMANO_LABEL[nuevoTamano]}.`, 'success');
        } catch (err) {
            console.error('Error cambiando tamaño de jaula:', err);
            this.showAlert('Error al cambiar el tamaño: ' + (err.message || err), 'Error', 'error');
        }
    };

    P.agregarJaulaConfig = async function (areaKey) {
        if (!this.canConfigurarCatalogoCampos()) return;
        const area = this.camposCatalog?.areas?.[areaKey];
        if (!area) return;
        const select = document.getElementById(`dispAddTamano_${areaKey}`);
        const tamano = (select && select.value) || (areaKey === 'gatos' ? 'estandar' : 'pequena');

        const numeros = Object.values(area.jaulas || {}).map((j) => Number(j.numero) || 0);
        const nuevoNumero = (numeros.length ? Math.max(...numeros) : 0) + 1;
        const nuevoId = 'j' + nuevoNumero;

        try {
            await this.camposConfigRef.child(`areas/${areaKey}/jaulas/${nuevoId}`).set({
                id: nuevoId, numero: nuevoNumero, tamano, activa: true
            });
            await this.camposConfigRef.child('metadata/actualizadoEn').set(Date.now());
            this.showNotification(`Jaula ${nuevoNumero} agregada a ${area.label || areaKey}.`, 'success');
        } catch (err) {
            console.error('Error agregando jaula:', err);
            this.showAlert('Error al agregar la jaula: ' + (err.message || err), 'Error', 'error');
        }
    };

    P.desactivarJaulaConfig = async function (areaKey, jaulaId) {
        if (!this.canConfigurarCatalogoCampos()) return;
        const area = this.camposCatalog?.areas?.[areaKey];
        const jaula = area?.jaulas?.[jaulaId];
        if (!jaula) return;

        if (this._jaulaOcupadaPor(areaKey, jaula.numero)) {
            this.showAlert('No se puede desactivar una jaula ocupada. Primero libere o mueva al paciente.', 'Jaula ocupada', 'warning');
            return;
        }

        const ok = await this.showConfirm(
            `¿Desactivar la jaula ${jaula.numero} de ${area.label || areaKey}? Dejará de contar en la disponibilidad.`,
            'Desactivar jaula',
            { confirmText: 'Desactivar', cancelText: 'Cancelar', danger: true, icon: 'fa-ban' }
        );
        if (!ok) return;

        try {
            await this.camposConfigRef.child(`areas/${areaKey}/jaulas/${jaulaId}/activa`).set(false);
            await this.camposConfigRef.child('metadata/actualizadoEn').set(Date.now());
            this.showNotification(`Jaula ${jaula.numero} desactivada.`, 'success');
        } catch (err) {
            console.error('Error desactivando jaula:', err);
            this.showAlert('Error al desactivar la jaula: ' + (err.message || err), 'Error', 'error');
        }
    };

    P.reactivarJaulaConfig = async function (areaKey, jaulaId) {
        if (!this.canConfigurarCatalogoCampos()) return;
        const area = this.camposCatalog?.areas?.[areaKey];
        const jaula = area?.jaulas?.[jaulaId];
        if (!jaula) return;
        try {
            await this.camposConfigRef.child(`areas/${areaKey}/jaulas/${jaulaId}/activa`).set(true);
            await this.camposConfigRef.child('metadata/actualizadoEn').set(Date.now());
            this.showNotification(`Jaula ${jaula.numero} reactivada.`, 'success');
        } catch (err) {
            console.error('Error reactivando jaula:', err);
            this.showAlert('Error al reactivar la jaula: ' + (err.message || err), 'Error', 'error');
        }
    };
})();
