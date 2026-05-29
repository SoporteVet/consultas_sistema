/**
 * Módulo de Recetas Digitales
 * --------------------------------------------------------------
 * - Carga bajo demanda (ver recetas-loader.js). Solo el ticket activo.
 * - Autollenado desde formulario de edición + ticket (sin cargar toda la base de pacientes).
 * - Modal "Receta" con historial acumulativo tipo "Por Cobrar".
 * - Guardado independiente en Firebase (campo `receta` + `recetaPeso` del ticket).
 * - Llamada a `RecetasPDF.generar(...)` para el PDF final.
 */

(function () {
  'use strict';

  // ============================================================
  // Helpers de formateo
  // ============================================================

  /**
   * Formatea el historial de receta para el modal (sin línea separadora arriba de cada entrada).
   */
  function formatRecetaDisplay(recetaText) {
    if (!recetaText) return '';
    const lines = String(recetaText).split('\n');
    const entries = [];
    let buffer = '';
    let meta = '';

    const flush = () => {
      const text = buffer.trim();
      if (text || meta) {
        entries.push({ meta, text });
      }
      buffer = '';
      meta = '';
    };

    for (const line of lines) {
      if (/^---\s.*\s---$/.test(line)) {
        flush();
        meta = line.replace(/^---\s*/, '').replace(/\s*---$/, '').replace(/\s*\[sin guardar\]\s*/gi, '').trim();
      } else {
        buffer += (buffer ? '\n' : '') + line;
      }
    }
    flush();

    if (entries.length === 0) {
      return `<div class="receta-hist-text">${escapeHtml(recetaText)}</div>`;
    }

    return entries.map((entry, i) => {
      const metaHtml = entry.meta
        ? `<div class="receta-hist-meta">${escapeHtml(entry.meta)}</div>`
        : '';
      const textHtml = entry.text
        ? `<div class="receta-hist-text">${escapeHtml(entry.text)}</div>`
        : '';
      return `<div class="receta-hist-entry${i > 0 ? ' receta-hist-entry--sep' : ''}">${metaHtml}${textHtml}</div>`;
    }).join('');
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateDDMMYYYY(dateString) {
    if (!dateString) return '';
    // Acepta YYYY-MM-DD o ISO
    const datePart = String(dateString).split('T')[0];
    const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return datePart;
  }

  function formatPesoLabel(peso) {
    if (peso === '' || peso == null) return '';
    const str = String(peso).trim();
    if (!str) return '';
    // Si ya viene con unidades, dejar tal cual
    if (/(kg|kgs|lb|libras?)/i.test(str)) return str;
    // Numérico → añadir kg
    if (/^[\d.,]+$/.test(str)) return `${str} kg`;
    return str;
  }

  // Extrae el apellido principal del nombre del cliente (último token; pega
  // partículas tipo "de", "del", "de la" al apellido siguiente).
  function extractApellidoCliente(fullName) {
    if (!fullName) return 'Cliente';
    const tokens = String(fullName).trim().split(/\s+/);
    if (tokens.length === 0) return 'Cliente';
    if (tokens.length === 1) return tokens[0];
    const particles = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
    let i = tokens.length - 1;
    while (i > 0 && particles.has(tokens[i - 1].toLowerCase())) {
      i--;
    }
    return tokens.slice(i).join(' ');
  }

  // Identifica si una entrada del campo `medicoAtiende` es un doctor (vs asistente).
  function extractDoctorFromMedicoAtiende(medicoAtiende) {
    if (!medicoAtiende) return '';
    const parts = String(medicoAtiende).split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (/^dr\.|^dra\./i.test(part)) return part;
    }
    return parts[0] || '';
  }

  // ============================================================
  // Autollenado de datos del paciente
  // ============================================================

  /**
   * Datos inmediatos desde formulario de edición + ticket (sin esperar Firebase).
   */
  function buildRecetaPatientDataSync(ticket) {
    const editForm = readEditFormSnapshot();
    return {
      nombre: editForm.nombre || ticket.nombre || '',
      mascota: editForm.mascota || ticket.mascota || '',
      cedula: editForm.cedula || ticket.cedula || '',
      idPaciente: editForm.idPaciente || ticket.idPaciente || '',
      fechaConsulta: editForm.fechaConsulta || ticket.fechaConsulta || '',
      doctor: editForm.doctor || extractDoctorFromMedicoAtiende(ticket.medicoAtiende),
      peso: ticket.recetaPeso || ticket.peso || '',
      raza: '',
      edad: '',
      sexo: '',
      tipoMascota: ticket.tipoMascota || ''
    };
  }

  /** Solo lectura Firebase de `receta` y `recetaPeso` de este ticket. */
  async function refreshTicketRecetaFieldsFromFirebase(ticket) {
    if (!ticket?.firebaseKey || typeof firebase === 'undefined') return;
    try {
      const snap = await Promise.race([
        firebase.database().ref(`tickets/${ticket.firebaseKey}`).once('value'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      const val = snap.val();
      if (!val) return;
      if (val.receta != null) ticket.receta = val.receta;
      if (val.recetaPeso != null) ticket.recetaPeso = val.recetaPeso;
      const live = (window.tickets || []).find((t) => t.firebaseKey === ticket.firebaseKey);
      if (live && live !== ticket) {
        if (val.receta != null) live.receta = val.receta;
        if (val.recetaPeso != null) live.recetaPeso = val.recetaPeso;
      }
    } catch (err) {
      console.warn('Receta: usando datos en memoria del ticket:', err.message || err);
    }
  }

  function normalizeDoctorProfile(value) {
    if (value == null) return null;
    if (typeof value === 'string') return { name: value, cmv: '', firma: '', pin: '' };
    if (typeof value === 'object') {
      return { name: value.name || '', cmv: value.cmv || '', firma: value.firma || '', pin: value.pin || '' };
    }
    return null;
  }

  function invalidateRecetaDoctorsCache() {
    recetaDoctorsIndex = null;
    recetaDoctorsLoadPromise = null;
  }

  function promptDoctorPinModal(doctorName) {
    return new Promise((resolve) => {
      const existing = document.getElementById('recetaPinModal');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'recetaPinModal';
      overlay.className = 'edit-modal';
      overlay.style.zIndex = '2100';
      overlay.innerHTML = `
        <div class="modal-content animate-scale" style="max-width:400px;">
          <span class="close-modal" id="recetaPinClose">&times;</span>
          <h3><i class="fas fa-lock"></i> PIN del médico</h3>
          <p style="color:#666;font-size:13px;margin-bottom:14px;">
            Ingrese el PIN de <strong>${escapeHtml(doctorName)}</strong> para autorizar la receta.
          </p>
          <div class="form-group">
            <input type="password" id="recetaPinInput" inputmode="numeric" pattern="[0-9]*" maxlength="6"
              autocomplete="off" placeholder="••••"
              style="width:100%;padding:12px;border:1px solid #ddd;border-radius:5px;font-size:18px;letter-spacing:0.25em;text-align:center;">
          </div>
          <div class="modal-actions" style="justify-content:flex-end;gap:10px;">
            <button type="button" class="btn-cancel" id="recetaPinCancel">Cancelar</button>
            <button type="button" class="btn-save" id="recetaPinConfirm"><i class="fas fa-check"></i> Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = document.getElementById('recetaPinInput');
      const finish = (value) => {
        overlay.remove();
        resolve(value);
      };

      overlay.querySelector('#recetaPinClose').addEventListener('click', () => finish(null));
      overlay.querySelector('#recetaPinCancel').addEventListener('click', () => finish(null));
      overlay.querySelector('#recetaPinConfirm').addEventListener('click', () => {
        finish(input ? input.value.trim() : '');
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish(null);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(input.value.trim());
        }
        if (e.key === 'Escape') finish(null);
      });
      setTimeout(() => input && input.focus(), 50);
    });
  }

  async function requireDoctorPinAuthorization(doctorName) {
    if (!doctorName) {
      alert('Seleccione el doctor que atiende antes de continuar.');
      return false;
    }
    invalidateRecetaDoctorsCache();
    const doctorProfile = await findDoctorProfileForReceta(doctorName);
    if (!doctorProfile) {
      alert('No se encontró el perfil del doctor seleccionado.');
      return false;
    }
    const storedPin = String(doctorProfile.pin || '').trim();
    if (!storedPin) {
      alert(
        'El doctor no tiene PIN configurado.\n' +
        'Un administrador debe configurarlo en: Administración → Doctores → "Firma / CMV".'
      );
      return false;
    }
    const enteredPin = await promptDoctorPinModal(doctorProfile.name || doctorName);
    if (enteredPin === null) return false;
    if (enteredPin !== storedPin) {
      alert('PIN incorrecto. La receta no fue autorizada.');
      return false;
    }
    return true;
  }

  let recetaDoctorsIndex = null;
  let recetaDoctorsLoadPromise = null;

  async function loadDoctorsIndexForReceta() {
    if (recetaDoctorsIndex) return recetaDoctorsIndex;
    if (!recetaDoctorsLoadPromise) {
      recetaDoctorsLoadPromise = firebase.database()
        .ref('doctors')
        .once('value')
        .then((snap) => {
          recetaDoctorsIndex = snap.val() || {};
          return recetaDoctorsIndex;
        });
    }
    return recetaDoctorsLoadPromise;
  }

  async function findDoctorProfileForReceta(doctorName) {
    if (!doctorName) return null;
    const index = await loadDoctorsIndexForReceta();
    for (const id of Object.keys(index)) {
      const profile = normalizeDoctorProfile(index[id]);
      if (profile && profile.name === doctorName) {
        return { id, ...profile };
      }
    }
    return null;
  }

  function readEditFormSnapshot() {
    const byId = (id) => {
      const el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    };
    let doctor = byId('editDoctorAtiende');
    // Si el select de doctores aún no cargó, usar texto visible seleccionado
    if (!doctor) {
      const sel = document.getElementById('editDoctorAtiende');
      if (sel && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) {
        doctor = String(sel.options[sel.selectedIndex].text || '').trim();
      }
    }
    return {
      nombre: byId('editNombre'),
      mascota: byId('editMascota'),
      cedula: byId('editCedula'),
      idPaciente: byId('editIdPaciente'),
      fechaConsulta: byId('editFecha'),
      doctor
    };
  }

  // ============================================================
  // Modal "Receta"
  // ============================================================

  /**
   * Abre el modal de receta para un ticket. Se invoca desde el botón
   * "Receta" del modal de edición de consulta.
   */
  async function openRecetaModal(randomId) {
    const tickets = window.tickets || [];
    const ticket = tickets.find(t => t.randomId === randomId);
    if (!ticket) {
      alert('No se encontró el ticket.');
      return;
    }

    await refreshTicketRecetaFieldsFromFirebase(ticket);

    closeRecetaModal();

    const overlay = document.createElement('div');
    overlay.id = 'recetaModal';
    overlay.className = 'edit-modal';
    overlay.style.zIndex = '2050';
    overlay.innerHTML = `
      <div class="modal-content animate-scale" style="max-width:720px;">
        <span class="close-modal" onclick="closeRecetaModal()">&times;</span>
        <h3><i class="fas fa-prescription"></i> Receta Digital</h3>

        <div id="recetaHeaderInfo" style="background:#f5f7ff;border:1px solid #d6deff;border-radius:6px;padding:12px;margin-bottom:14px;font-size:13px;"></div>

        <div class="form-group">
          <label><strong>Peso del paciente</strong></label>
          <input type="text" id="recetaPesoInput" placeholder="Ej: 12.5 (kg)" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:5px;">
          <small style="color:#888;">Se guarda con la receta. Si no se indica unidad, se asume kg.</small>
        </div>

        <div id="recetaHistorialWrap" style="display:none;margin-bottom:12px;">
          <label style="font-weight:600;color:#1a237e;">Historial de receta</label>
          <div id="recetaHistorialBody" class="receta-historial-panel"></div>
        </div>

        <div class="form-group">
          <label for="recetaNuevaEntrada"><strong>Nueva indicación / medicación</strong></label>
          <textarea id="recetaNuevaEntrada" rows="6" placeholder="Escriba aquí la medicación, dosis e instrucciones para esta consulta…" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:5px;font-size:14px;line-height:1.5;white-space:pre-wrap;"></textarea>
          <small style="color:#888;">Cada vez que guarde, este texto se añadirá al historial con fecha, hora y usuario.</small>
        </div>

        <div class="modal-actions" style="justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <button type="button" id="recetaPdfBtn" class="btn-save" style="background:#3f51b5;">
            <i class="fas fa-file-pdf"></i> Generar PDF
          </button>
          <div style="display:flex;gap:10px;">
            <button type="button" class="btn-cancel" onclick="closeRecetaModal()">Cerrar</button>
            <button type="button" id="recetaSaveBtn" class="btn-save">
              <i class="fas fa-save"></i> Guardar receta
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Cargar historial previo (solo lectura)
    if (ticket.receta) {
      const histWrap = document.getElementById('recetaHistorialWrap');
      const histBody = document.getElementById('recetaHistorialBody');
      if (histWrap && histBody) {
        histWrap.style.display = 'block';
        histBody.innerHTML = formatRecetaDisplay(ticket.receta);
      }
    }

    // Mostrar datos del ticket/formulario de inmediato (no bloquear en Firebase)
    const syncData = buildRecetaPatientDataSync(ticket);
    renderRecetaHeader(syncData);
    const pesoInput = document.getElementById('recetaPesoInput');
    if (pesoInput) pesoInput.value = syncData.peso || '';

    overlay.dataset.recetaTicketId = String(ticket.randomId);

    // Listeners de acciones
    const saveBtn = document.getElementById('recetaSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveReceta(ticket));
    }
    const pdfBtn = document.getElementById('recetaPdfBtn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => generateRecetaPDF(ticket));
    }
  }

  function renderRecetaHeader(patientData) {
    const container = document.getElementById('recetaHeaderInfo');
    if (!container) return;
    const fields = [
      ['Fecha', formatDateDDMMYYYY(patientData.fechaConsulta) || '—'],
      ['Paciente', patientData.mascota || '—'],
      ['Dueño', patientData.nombre || '—'],
      ['Cédula', patientData.cedula || '—'],
      ['Doctor', patientData.doctor || '—']
    ];
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px 18px;">
        ${fields.map(([label, value]) => `
          <div>
            <span style="color:#666;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;">${label}</span><br>
            <strong style="font-size:14px;">${escapeHtml(value)}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  function closeRecetaModal() {
    const modal = document.getElementById('recetaModal');
    if (modal) modal.remove();
  }

  // ============================================================
  // Guardado en Firebase
  // ============================================================

  async function saveReceta(ticket) {
    if (!ticket || !ticket.firebaseKey) {
      alert('Ticket inválido.');
      return;
    }
    const textarea = document.getElementById('recetaNuevaEntrada');
    const pesoInput = document.getElementById('recetaPesoInput');
    const nuevo = textarea ? textarea.value.trim() : '';
    const peso = pesoInput ? pesoInput.value.trim() : '';

    if (!nuevo && !peso && !ticket.receta) {
      alert('No hay nada que guardar. Escriba una indicación o un peso.');
      return;
    }

    const patientData = buildRecetaPatientDataSync(ticket);
    if (!(await requireDoctorPinAuthorization(patientData.doctor))) {
      return;
    }

    // Refrescar el ticket en memoria por si "Por cobrar" u otro proceso
    // actualizó la receta concurrentemente.
    const live = (window.tickets || []).find(t => t.firebaseKey === ticket.firebaseKey) || ticket;
    let updatedReceta = live.receta || '';
    if (nuevo) {
      const timestamp = new Date().toLocaleString('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      const userName = sessionStorage.getItem('userName') || 'Usuario';
      const separator = updatedReceta ? '\n\n' : '';
      updatedReceta = `${updatedReceta}${separator}--- ${timestamp} (${userName}) ---\n${nuevo}`;
    }

    const updates = { receta: updatedReceta };
    if (peso) updates.recetaPeso = peso;

    try {
      const saveBtn = document.getElementById('recetaSaveBtn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…'; }

      await firebase.database().ref(`tickets/${ticket.firebaseKey}`).update(updates);

      // Reflejar cambios en memoria local
      Object.assign(ticket, updates);
      const liveTicket = (window.tickets || []).find(t => t.firebaseKey === ticket.firebaseKey);
      if (liveTicket) Object.assign(liveTicket, updates);

      if (typeof window.showNotification === 'function') {
        window.showNotification('Receta guardada correctamente', 'success');
      }

      // Refrescar UI del modal: historial y limpiar textarea
      const histWrap = document.getElementById('recetaHistorialWrap');
      const histBody = document.getElementById('recetaHistorialBody');
      if (histWrap && histBody) {
        histWrap.style.display = 'block';
        histBody.innerHTML = formatRecetaDisplay(updatedReceta);
      }
      if (textarea) textarea.value = '';

      // Actualizar tarjeta en sala de espera si está visible
      if (typeof window.updateRecetaBadgeInTicket === 'function') {
        window.updateRecetaBadgeInTicket(ticket);
      }
    } catch (err) {
      console.error('Error guardando receta:', err);
      alert('Error al guardar la receta: ' + err.message);
    } finally {
      const saveBtn = document.getElementById('recetaSaveBtn');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar receta'; }
    }
  }

  // ============================================================
  // Generación de PDF
  // ============================================================

  async function generateRecetaPDF(ticket) {
    const pdfBtn = document.getElementById('recetaPdfBtn');
    const pdfBtnHtml = pdfBtn ? pdfBtn.innerHTML : '';
    try {
      if (pdfBtn) {
        pdfBtn.disabled = true;
        pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF…';
      }

      const live = (window.tickets || []).find((t) => t.randomId === ticket.randomId) || ticket;
      const patientData = buildRecetaPatientDataSync(live);
      const pesoInput = document.getElementById('recetaPesoInput');
      if (pesoInput && pesoInput.value.trim()) {
        patientData.peso = pesoInput.value.trim();
      }

      if (!patientData.doctor) {
        alert('Seleccione el doctor que atiende antes de generar la receta.');
        return;
      }
      if (!(await requireDoctorPinAuthorization(patientData.doctor))) {
        return;
      }
      if (!live.receta && !document.getElementById('recetaNuevaEntrada')?.value.trim()) {
        alert('La receta está vacía. Escriba al menos una indicación antes de generar el PDF.');
        return;
      }

      const doctorProfile = await findDoctorProfileForReceta(patientData.doctor);
      if (!doctorProfile || !doctorProfile.firma) {
        alert(
          'El doctor seleccionado no tiene firma registrada.\n' +
          'Regístrela en: Administración → Doctores → "Firma / CMV".'
        );
        return;
      }

      const ticketParaPDF = { ...live };
      const nuevaEntrada = (document.getElementById('recetaNuevaEntrada')?.value || '').trim();
      if (nuevaEntrada) {
        const timestamp = new Date().toLocaleString('es-ES', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
        const userName = sessionStorage.getItem('userName') || 'Usuario';
        const sep = ticketParaPDF.receta ? '\n\n' : '';
        ticketParaPDF.receta = `${ticketParaPDF.receta || ''}${sep}--- ${timestamp} (${userName}) ---\n${nuevaEntrada}`;
      }

      if (!window.RecetasPDF || typeof window.RecetasPDF.generar !== 'function') {
        alert('El módulo de PDF no está disponible. Cierre y vuelva a abrir Receta.');
        return;
      }

      await window.RecetasPDF.generar({
        ticket: ticketParaPDF,
        doctorProfile,
        recetaPatientData: patientData
      });
    } catch (err) {
      console.error('Error generando PDF de receta:', err);
      alert('Error al generar el PDF: ' + (err.message || err));
    } finally {
      if (pdfBtn) {
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = pdfBtnHtml || '<i class="fas fa-file-pdf"></i> Generar PDF';
      }
    }
  }

  // ============================================================
  // Exposición pública
  // ============================================================

  window.formatRecetaDisplay = formatRecetaDisplay;
  window.extractApellidoCliente = extractApellidoCliente;
  window.openRecetaModal = openRecetaModal;
  window.closeRecetaModal = closeRecetaModal;
  window.saveReceta = saveReceta;
  window.generateRecetaPDF = generateRecetaPDF;

  // Utilidad expuesta para que `index.js` actualice el badge de la tarjeta.
  // Se sobreescribe desde index.js si éste registra una versión más rica.
  if (typeof window.updateRecetaBadgeInTicket !== 'function') {
    window.updateRecetaBadgeInTicket = function (ticket) {
      const el = document.querySelector(`[data-ticket-id="${ticket.randomId}"]`);
      if (!el) return;
      let badge = el.querySelector('.receta-badge');
      if (ticket.receta) {
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'receta-badge';
          badge.style.cssText = 'margin-top:6px;font-size:12px;color:#3f51b5;font-weight:600;';
          badge.innerHTML = '<i class="fas fa-prescription"></i> Receta registrada';
          const info = el.querySelector('.ticket-info');
          (info || el).appendChild(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    };
  }
})();
