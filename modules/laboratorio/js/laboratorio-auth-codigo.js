// Acceso al módulo de laboratorio para recepción mediante código de Paola López
(function () {
    const LAB_RECEPCION_SESION_KEY = 'lab_recepcion_codigo_sesion';

    function normalizePersonName(name) {
        return String(name || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function isLabRecepcionRole() {
        return sessionStorage.getItem('userRole') === 'recepcion';
    }

    function requiresLabCodigoRecepcion() {
        return isLabRecepcionRole();
    }

    function isPaolaLopezNombre(nombre) {
        const n = normalizePersonName(nombre);
        return n.includes('paola') && n.includes('lopez');
    }

    function getLabRecepcionSesionActiva() {
        try {
            const raw = sessionStorage.getItem(LAB_RECEPCION_SESION_KEY);
            if (!raw) return null;
            const sesion = JSON.parse(raw);
            return sesion && sesion.valido ? sesion : null;
        } catch (e) {
            return null;
        }
    }

    function crearLabRecepcionSesion(resultado) {
        const sesion = {
            valido: true,
            assistantId: resultado.assistantId || null,
            nombre: resultado.nombre || '',
            codigo: resultado.codigo || '',
            iniciadaEn: Date.now()
        };
        sessionStorage.setItem(LAB_RECEPCION_SESION_KEY, JSON.stringify(sesion));
        actualizarBannerLabRecepcionSesion();
    }

    function limpiarLabRecepcionSesion(silencioso) {
        sessionStorage.removeItem(LAB_RECEPCION_SESION_KEY);
        actualizarBannerLabRecepcionSesion();
        if (!silencioso && typeof showNotification === 'function') {
            showNotification('Sesión de laboratorio cerrada', 'info');
        }
    }

    async function validarCodigoLabRecepcion(codigoIngresado) {
        const codigo = String(codigoIngresado || '').trim();
        if (!codigo) {
            return { valido: false, mensaje: 'Código requerido' };
        }
        if (!window.database) {
            return { valido: false, mensaje: 'Base de datos no disponible' };
        }

        const [assistantsSnap, codigosSnap] = await Promise.all([
            window.database.ref('assistants').once('value'),
            window.database.ref('assistants_codigos').once('value')
        ]);

        const assistants = assistantsSnap.val() || {};
        const codigos = codigosSnap.val() || {};

        for (const [assistantId, codigoData] of Object.entries(codigos)) {
            if (!codigoData || codigoData.codigo == null || codigoData.codigo === '') continue;
            if (String(codigoData.codigo).trim() !== codigo) continue;

            const assistantRaw = assistants[assistantId];
            const nombre = typeof assistantRaw === 'string'
                ? assistantRaw.trim()
                : String(assistantRaw?.nombre || assistantRaw?.name || '').trim();

            if (!isPaolaLopezNombre(nombre)) {
                return {
                    valido: false,
                    mensaje: 'Solo el código de Paola López está autorizado para recepción en laboratorio'
                };
            }

            return {
                valido: true,
                assistantId,
                nombre,
                codigo
            };
        }

        return { valido: false, mensaje: 'Código incorrecto' };
    }

    function getCodigoLabRecepcionModalHTML() {
        return `
            <div style="padding: 20px;">
                <div style="background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%); color: white; padding: 25px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
                    <div style="font-size: 3.5rem; margin-bottom: 15px;"><i class="fas fa-flask"></i></div>
                    <div style="font-size: 1.15rem; font-weight: 600; margin-bottom: 10px;">
                        Acceso a Laboratorio — Recepción
                    </div>
                    <div style="font-size: 0.95rem; opacity: 0.92;">
                        Ingrese el código de <strong>Paola López</strong> para usar el módulo de laboratorio
                    </div>
                </div>
                <form id="formCodigoLabRecepcion">
                    <div class="form-group">
                        <label style="font-weight: 600; display: block; margin-bottom: 10px; color: #2c3e50;">
                            <i class="fas fa-key"></i> Código personal
                        </label>
                        <input type="password"
                               id="codigoLabRecepcionInput"
                               placeholder="Código de 4-6 dígitos"
                               required
                               maxlength="6"
                               pattern="[0-9]{4,6}"
                               style="width: 100%; padding: 15px; border-radius: 8px; border: 2px solid #ddd; font-size: 1.1rem; text-align: center; letter-spacing: 5px; font-weight: bold;">
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 25px;">
                        <button type="button" class="btn btn-secondary btn-cancelar-lab-codigo" style="flex: 1;">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="submit" class="btn btn-primary" style="flex: 1;">
                            <i class="fas fa-check"></i> Verificar
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    function crearModalLabCodigo() {
        const overlay = document.createElement('div');
        overlay.className = 'edit-modal';
        overlay.id = 'labRecepcionCodigoModal';
        overlay.innerHTML = `
            <div class="edit-modal-content" style="max-width: 480px; margin: 8vh auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.25);">
                <div style="padding: 16px 20px; background: #f5f7fa; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-lock" style="color: #1565c0;"></i>
                    <strong style="flex: 1;">Código de Laboratorio</strong>
                </div>
                ${getCodigoLabRecepcionModalHTML()}
            </div>
        `;
        return overlay;
    }

    function solicitarCodigoLabRecepcion() {
        return new Promise((resolve) => {
            const modal = crearModalLabCodigo();
            document.body.appendChild(modal);

            const cleanup = (resultado) => {
                modal.remove();
                resolve(resultado);
            };

            setTimeout(() => {
                const form = document.getElementById('formCodigoLabRecepcion');
                const input = document.getElementById('codigoLabRecepcionInput');
                const btnCancelar = modal.querySelector('.btn-cancelar-lab-codigo');

                if (input) input.focus();

                if (btnCancelar) {
                    btnCancelar.onclick = () => cleanup({ valido: false, cancelado: true });
                }

                if (form) {
                    form.onsubmit = async (e) => {
                        e.preventDefault();
                        const codigo = input ? input.value.trim() : '';
                        const btnSubmit = form.querySelector('button[type="submit"]');
                        const originalHtml = btnSubmit ? btnSubmit.innerHTML : '';

                        if (btnSubmit) {
                            btnSubmit.disabled = true;
                            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
                        }

                        try {
                            const resultado = await validarCodigoLabRecepcion(codigo);
                            if (resultado.valido) {
                                crearLabRecepcionSesion(resultado);
                                if (typeof showNotification === 'function') {
                                    showNotification(`Laboratorio habilitado — ${resultado.nombre}`, 'success');
                                }
                                cleanup(resultado);
                            } else {
                                if (input) {
                                    input.value = '';
                                    input.focus();
                                }
                                if (typeof showNotification === 'function') {
                                    showNotification(resultado.mensaje || 'Código incorrecto', 'error');
                                }
                                if (btnSubmit) {
                                    btnSubmit.disabled = false;
                                    btnSubmit.innerHTML = originalHtml;
                                }
                            }
                        } catch (err) {
                            console.error('Error validando código lab recepción:', err);
                            if (typeof showNotification === 'function') {
                                showNotification('Error al validar el código', 'error');
                            }
                            if (btnSubmit) {
                                btnSubmit.disabled = false;
                                btnSubmit.innerHTML = originalHtml;
                            }
                        }
                    };
                }
            }, 50);
        });
    }

    async function ensureLabRecepcionCodigoAccess() {
        if (!requiresLabCodigoRecepcion()) return true;
        if (getLabRecepcionSesionActiva()) return true;
        const resultado = await solicitarCodigoLabRecepcion();
        return !!(resultado && resultado.valido);
    }

    function actualizarBannerLabRecepcionSesion() {
        const sesion = getLabRecepcionSesionActiva();
        const labSections = [
            'crearLabSection',
            'verLabSection',
            'reportesLabSection',
            'pendientesReportarSection',
            'inyectablesSection'
        ];

        labSections.forEach((sectionId) => {
            const section = document.getElementById(sectionId);
            if (!section) return;

            let banner = section.querySelector('.lab-recepcion-sesion-banner');
            if (!requiresLabCodigoRecepcion() || !sesion) {
                if (banner) banner.remove();
                return;
            }

            const nombreEsc = (sesion.nombre || 'Paola López').replace(/</g, '&lt;');
            if (!banner) {
                banner = document.createElement('div');
                banner.className = 'lab-recepcion-sesion-banner';
                banner.style.cssText = 'margin-bottom:16px;padding:12px 16px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;background:linear-gradient(135deg,#e3f2fd 0%,#bbdefb 100%);border:1px solid #64b5f6;color:#0d47a1;';
                section.insertBefore(banner, section.firstChild);
            }

            banner.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <i class="fas fa-user-shield"></i>
                    <span>Laboratorio autorizado por <strong>${nombreEsc}</strong> (recepción)</span>
                </div>
                <button type="button" class="btn btn-sm btn-secondary" id="btnCerrarSesionLabRecepcion" style="white-space:nowrap;">
                    <i class="fas fa-sign-out-alt"></i> Cerrar sesión
                </button>
            `;

            const btnCerrar = banner.querySelector('#btnCerrarSesionLabRecepcion');
            if (btnCerrar) {
                btnCerrar.onclick = () => {
                    limpiarLabRecepcionSesion(false);
                    document.querySelectorAll('.content section').forEach((s) => {
                        s.classList.add('hidden');
                        s.classList.remove('active');
                    });
                    const crearSection = document.getElementById('crearTicketSection');
                    if (crearSection && typeof showSection === 'function') {
                        showSection(crearSection);
                    }
                };
            }
        });
    }

    window.isLabRecepcionRole = isLabRecepcionRole;
    window.requiresLabCodigoRecepcion = requiresLabCodigoRecepcion;
    window.getLabRecepcionSesionActiva = getLabRecepcionSesionActiva;
    window.limpiarLabRecepcionSesion = limpiarLabRecepcionSesion;
    window.validarCodigoLabRecepcion = validarCodigoLabRecepcion;
    window.solicitarCodigoLabRecepcion = solicitarCodigoLabRecepcion;
    window.ensureLabRecepcionCodigoAccess = ensureLabRecepcionCodigoAccess;
    window.actualizarBannerLabRecepcionSesion = actualizarBannerLabRecepcionSesion;
})();
