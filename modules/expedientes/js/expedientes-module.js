// Módulo Expedientes Médicos
// Permite ver y buscar el historial SOAP completo de cualquier mascota

class ExpedientesModule {
    constructor() {
        this.container  = null;
        this.currentCedula    = '';
        this.currentMascotaKey = '';
        this.currentMascotaNom = '';
        this.patientRef = null;
        this._expedienteListener = null;
        window.expedientesModule = this;
    }

    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        this._renderShell();
        console.log('✅ Módulo Expedientes inicializado');
    }

    // ── Shell HTML ────────────────────────────────────────────────────────────
    _renderShell() {
        this.container.innerHTML = `
        <div class="exp-module">
            <div class="exp-header">
                <div class="exp-header-left">
                    <i class="fas fa-book-medical exp-header-icon"></i>
                    <div>
                        <h2 class="exp-title">Expedientes Médicos</h2>
                        <p class="exp-subtitle">Historial SOAP por paciente y mascota</p>
                    </div>
                </div>
            </div>

            <!-- Búsqueda -->
            <div class="exp-search-bar">
                <div class="exp-search-input-wrap">
                    <i class="fas fa-search"></i>
                    <input id="expSearchInput" type="text" placeholder="Buscar por cédula del propietario…" autocomplete="off">
                </div>
                <button class="exp-search-btn" id="expSearchBtn">
                    <i class="fas fa-search"></i> Buscar
                </button>
            </div>

            <!-- Área principal -->
            <div class="exp-main" id="expMain">
                <div class="exp-empty-state">
                    <i class="fas fa-file-medical-alt"></i>
                    <p>Ingrese una cédula para buscar el expediente del paciente,<br>o haga clic en <strong>"Ver expediente"</strong> desde un ticket.</p>
                </div>
            </div>
        </div>`;

        // Eventos
        const btn   = document.getElementById('expSearchBtn');
        const input = document.getElementById('expSearchInput');
        if (btn)   btn.addEventListener('click', () => this._doSearch());
        if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') this._doSearch(); });
    }

    // ── Apertura desde ticket ─────────────────────────────────────────────────
    open(cedula, mascotaKey, mascotaNom) {
        this.currentCedula     = cedula;
        this.currentMascotaKey = mascotaKey;
        this.currentMascotaNom = mascotaNom;

        const input = document.getElementById('expSearchInput');
        if (input && cedula) input.value = cedula;

        if (cedula) {
            this._loadPatient(cedula, mascotaKey);
        }
    }

    // ── Búsqueda manual ───────────────────────────────────────────────────────
    _doSearch() {
        const cedula = (document.getElementById('expSearchInput')?.value || '').trim();
        if (!cedula) return;
        this._loadPatient(cedula, '');
    }

    // ── Cargar datos del paciente desde Firebase ──────────────────────────────
    _loadPatient(cedula, defaultMascotaKey) {
        const main = document.getElementById('expMain');
        if (!main) return;
        main.innerHTML = `<div class="exp-loading"><i class="fas fa-spinner fa-spin"></i> Cargando expediente…</div>`;

        const db = window.database || (typeof firebase !== 'undefined' ? firebase.database() : null);
        if (!db) {
            main.innerHTML = `<div class="exp-error"><i class="fas fa-exclamation-triangle"></i> Firebase no disponible.</div>`;
            return;
        }

        db.ref(`pacientes/${cedula}`).once('value').then(snap => {
            if (!snap.exists()) {
                // Buscar en tickets cargados para al menos mostrar el nombre
                const fromTicket = (window.tickets || []).find(t => t.cedula === cedula);
                if (fromTicket) {
                    this._renderPatient({ nombre: fromTicket.nombre, cedula, telefono: fromTicket.telefono || '' }, {}, defaultMascotaKey);
                } else {
                    main.innerHTML = `<div class="exp-empty-state"><i class="fas fa-user-slash"></i><p>No se encontró ningún paciente con la cédula <strong>${cedula}</strong>.<br>Cuando se edite un ticket con SOAP, el expediente se guardará aquí.</p></div>`;
                }
                return;
            }
            const patient = snap.val();
            this._renderPatient(patient, patient.mascotas || {}, defaultMascotaKey);
        }).catch(err => {
            console.error('Error cargando expediente:', err);
            main.innerHTML = `<div class="exp-error"><i class="fas fa-exclamation-triangle"></i> Error al cargar el expediente.</div>`;
        });
    }

    // ── Renderizar vista de paciente + lista de mascotas ──────────────────────
    _renderPatient(patient, mascotas, defaultMascotaKey) {
        const main = document.getElementById('expMain');
        if (!main) return;

        const mascotasList = Object.entries(mascotas);

        let mascotasHTML = '';
        if (mascotasList.length === 0) {
            mascotasHTML = `<p class="exp-no-mascotas"><i class="fas fa-paw"></i> Sin mascotas registradas.</p>`;
        } else {
            mascotasHTML = mascotasList.map(([key, m]) => {
                const icon  = m.tipoMascota === 'perro' ? 'fa-dog' : m.tipoMascota === 'gato' ? 'fa-cat' : 'fa-paw';
                const hasExp = m.expediente && Object.keys(m.expediente).length > 0;
                return `
                <div class="exp-mascota-card ${defaultMascotaKey === key ? 'exp-mascota-active' : ''}"
                     data-key="${key}" data-cedula="${patient.cedula || ''}" data-nom="${m.nombre || ''}"
                     onclick="window.expedientesModule._openMascota('${patient.cedula || ''}', '${key}', '${(m.nombre||'').replace(/'/g,"\\'")}')">
                    <div class="exp-mascota-icon"><i class="fas ${icon}"></i></div>
                    <div class="exp-mascota-info">
                        <div class="exp-mascota-name">${m.nombre || key}</div>
                        <div class="exp-mascota-meta">
                            ${m.tipoMascota || '—'} · ${m.raza || 'Sin raza'} · ${m.sexo || '—'}
                            ${m.idPaciente ? ` · ID: ${m.idPaciente}` : ''}
                        </div>
                        ${hasExp
                            ? `<span class="exp-has-history"><i class="fas fa-file-medical"></i> Con historial SOAP</span>`
                            : `<span class="exp-no-history"><i class="fas fa-file"></i> Sin entradas aún</span>`}
                    </div>
                    <i class="fas fa-chevron-right exp-mascota-arrow"></i>
                </div>`;
            }).join('');
        }

        main.innerHTML = `
        <div class="exp-patient-header">
            <div class="exp-patient-avatar"><i class="fas fa-user-circle"></i></div>
            <div class="exp-patient-data">
                <div class="exp-patient-name">${patient.nombre || 'Sin nombre'}</div>
                <div class="exp-patient-meta">
                    <span><i class="fas fa-id-card"></i> ${patient.cedula || '—'}</span>
                    ${patient.telefono ? `<span><i class="fas fa-phone"></i> ${patient.telefono}</span>` : ''}
                </div>
            </div>
        </div>

        <h3 class="exp-section-title"><i class="fas fa-paw"></i> Mascotas</h3>
        <div class="exp-mascotas-grid">${mascotasHTML}</div>

        <div id="expHistorialPanel" class="exp-historial-panel"></div>`;

        // Si venía con una mascota seleccionada, abrirla
        if (defaultMascotaKey && mascotas[defaultMascotaKey]) {
            this._openMascota(patient.cedula || '', defaultMascotaKey, mascotas[defaultMascotaKey].nombre || '');
        } else if (defaultMascotaKey && mascotasList.length > 0) {
            // Buscar por nombre si no hay clave exacta
            const found = mascotasList.find(([k, m]) => k === defaultMascotaKey || m.nombre === this.currentMascotaNom);
            if (found) this._openMascota(patient.cedula || '', found[0], found[1].nombre || '');
        }
    }

    // ── Mostrar historial de una mascota ──────────────────────────────────────
    _openMascota(cedula, mascotaKey, mascotaNom) {
        const panel = document.getElementById('expHistorialPanel');
        if (!panel) return;

        // Resaltar tarjeta activa
        document.querySelectorAll('.exp-mascota-card').forEach(c => c.classList.remove('exp-mascota-active'));
        const activeCard = document.querySelector(`.exp-mascota-card[data-key="${mascotaKey}"]`);
        if (activeCard) activeCard.classList.add('exp-mascota-active');

        panel.innerHTML = `<div class="exp-loading"><i class="fas fa-spinner fa-spin"></i> Cargando historial de ${mascotaNom || mascotaKey}…</div>`;

        const db = window.database || (typeof firebase !== 'undefined' ? firebase.database() : null);
        if (!db) return;

        db.ref(`pacientes/${cedula}/mascotas/${mascotaKey}/expediente`).once('value').then(snap => {
            if (!snap.exists()) {
                panel.innerHTML = `
                <div class="exp-historial-header">
                    <h3><i class="fas fa-book-medical"></i> Expediente de ${mascotaNom || mascotaKey}</h3>
                </div>
                <div class="exp-empty-state" style="margin-top:16px;">
                    <i class="fas fa-file-medical-alt"></i>
                    <p>Este paciente no tiene entradas en el expediente aún.<br>
                    Edita un ticket y completa el formulario SOAP para agregar la primera entrada.</p>
                </div>`;
                return;
            }

            const entries = [];
            snap.forEach(child => entries.push({ _key: child.key, ...child.val() }));
            entries.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

            panel.innerHTML = `
            <div class="exp-historial-header">
                <h3><i class="fas fa-book-medical"></i> Expediente de <span class="exp-mascota-highlight">${mascotaNom || mascotaKey}</span></h3>
                <span class="exp-entry-count">${entries.length} entrada${entries.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="exp-entries-list">
                ${entries.map(e => this._renderEntry(e)).join('')}
            </div>`;
        }).catch(err => {
            console.error('Error cargando historial:', err);
            panel.innerHTML = `<div class="exp-error"><i class="fas fa-exclamation-triangle"></i> Error al cargar el historial.</div>`;
        });
    }

    // ── Renderizar una entrada SOAP ───────────────────────────────────────────
    _renderEntry(entry) {
        const fecha  = entry.fecha ? new Date(entry.fecha).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
        const campos = [
            { k: 'S', label: 'Subjetivo (Anamnesis)', icon: 'fa-comment-medical', v: entry.subjetivo },
            { k: 'O', label: 'Objetivo (Exploración)', icon: 'fa-heartbeat',       v: entry.objetivo  },
            { k: 'A', label: 'Análisis / Diagnóstico', icon: 'fa-diagnoses',       v: entry.analisis  },
            { k: 'P', label: 'Plan / Tratamiento',     icon: 'fa-pills',           v: entry.plan      },
            { k: 'N', label: 'Notas adicionales',      icon: 'fa-sticky-note',     v: entry.notas     }
        ].filter(c => c.v && c.v.trim());

        return `
        <div class="exp-entry">
            <div class="exp-entry-header">
                <div class="exp-entry-date"><i class="fas fa-calendar-alt"></i> ${fecha}</div>
                <div class="exp-entry-badges">
                    ${entry.doctor   ? `<span class="exp-badge exp-badge-doc"><i class="fas fa-user-md"></i> ${entry.doctor}</span>` : ''}
                    ${entry.asistente? `<span class="exp-badge exp-badge-ast"><i class="fas fa-user-nurse"></i> ${entry.asistente}</span>` : ''}
                    ${entry.randomId ? `<span class="exp-badge exp-badge-ticket"><i class="fas fa-ticket-alt"></i> #${entry.randomId}</span>` : ''}
                </div>
            </div>
            ${entry.motivo ? `<div class="exp-entry-motivo"><i class="fas fa-stethoscope"></i> <strong>Motivo:</strong> ${entry.motivo}</div>` : ''}
            <div class="exp-soap-grid">
                ${campos.map(c => `
                <div class="exp-soap-block">
                    <div class="exp-soap-label"><i class="fas ${c.icon}"></i> ${c.label}</div>
                    <div class="exp-soap-value">${c.v.replace(/\n/g, '<br>')}</div>
                </div>`).join('')}
            </div>
        </div>`;
    }
}

// Auto-inicializar cuando el DOM esté listo
(function () {
    const tryInit = () => {
        const container = document.getElementById('expedientesSection');
        if (container) {
            const mod = new ExpedientesModule();
            mod.init('expedientesSection');
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        setTimeout(tryInit, 600);
    }
})();
