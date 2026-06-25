// ====================================================================
// PRESUPUESTOS Y FACTURAS — Firebase Realtime Database (base64)
// ====================================================================

InternamientoModule.prototype.showPresupuestosFacturasView = function () {
  if (!this.currentInternamientoId) return;
  this.showInternamientoView('presupuestos_facturas');
  setTimeout(() => this.loadPresupuestosFacturasView(), 80);
};

/** Compatibilidad con botón "Facturas" del panel */
InternamientoModule.prototype.showFacturasView = function () {
  this.showPresupuestosFacturasView();
};

InternamientoModule.prototype._getDocumentosFinancierosLista = function (internamiento) {
  const docs = [];
  const nuevos = internamiento.documentos_financieros || {};
  Object.entries(nuevos).forEach(([key, d]) => {
    if (!d) return;
    docs.push({ ...d, docId: d.docId || key, _legacy: false });
  });

  // Facturas legadas (sin archivo)
  const legacy = internamiento.facturas || {};
  Object.values(legacy).forEach((f) => {
    if (!f || !f.facturaId) return;
    docs.push({
      docId: f.facturaId,
      tipo: 'factura',
      descripcion: f.descripcion || 'Factura',
      monto: f.monto,
      estado: f.estado || 'pendiente',
      observaciones: f.observaciones || '',
      fechaCreacion: f.fechaCreacion,
      creadoNombre: f.creadoNombre || '',
      archivo: null,
      _legacy: true
    });
  });

  return docs.sort((a, b) => (b.fechaCreacion || 0) - (a.fechaCreacion || 0));
};

// ----------------------------------------------------------------
// Carga la vista — renderiza con datos en caché y refresca luego
// ----------------------------------------------------------------
InternamientoModule.prototype.loadPresupuestosFacturasView = function () {
  const container = document.getElementById('internamiento-presupuestos_facturas');
  if (!container) return;

  // Render inmediato con lo que hay en caché
  this._renderPresupuestosFacturasView(container);

  // Luego refresca desde RTDB sin bloquear
  if (this.currentInternamientoId && this.internamientosRef) {
    this.internamientosRef
      .child(this.currentInternamientoId)
      .child('documentos_financieros')
      .once('value')
      .then((snap) => {
        const int = this.internamientos.get(this.currentInternamientoId);
        if (!int) return;
        int.documentos_financieros = snap.exists() ? (snap.val() || {}) : {};
        this.internamientos.set(this.currentInternamientoId, int);
        this._renderPresupuestosFacturasView(container);
      })
      .catch((err) => console.warn('Refresh docs financieros:', err));
  }
};

InternamientoModule.prototype._renderPresupuestosFacturasView = function (container) {
  const internamiento = this.internamientos.get(this.currentInternamientoId);
  if (!internamiento) return;

  const bloqueado = internamiento.estado?.actual === 'egresado';
  const mascota = internamiento.referencias?.nombreMascota || 'Paciente';
  const docs = this._getDocumentosFinancierosLista(internamiento);

  const presupuestos = docs.filter((d) => d.tipo === 'presupuesto');
  const facturas    = docs.filter((d) => d.tipo === 'factura');
  const sinTipo     = docs.filter((d) => !d.tipo);

  const countPendiente = docs.filter((d) => d.estado === 'pendiente' || d.estado === 'aprobado').length;
  const countPagado    = docs.filter((d) => d.estado === 'pagado').length;

  const filtro = this._pfFiltroActivo || 'todos';

  const filtroBtn = (key, label) => {
    const active = filtro === key;
    return `<button type="button" class="pf-filtro-btn${active ? ' active' : ''}"
      onclick="window.internamientoModule._pfSetFiltro('${key}')">${label}</button>`;
  };

  const aplicarFiltroEstado = (lista) => {
    if (filtro === 'pendiente') return lista.filter((d) => d.estado === 'pendiente' || d.estado === 'aprobado');
    if (filtro === 'pagado')    return lista.filter((d) => d.estado === 'pagado');
    return lista;
  };

  const presupuestosFiltrados = aplicarFiltroEstado(presupuestos);
  const facturasFiltradas     = aplicarFiltroEstado(facturas);

  const renderTabla = (lista) => {
    if (lista.length === 0) return '';
    let filas = '';
    lista.forEach((d, i) => {
      try { filas += this._renderDocumentoFinancieroRow(d, i, bloqueado, false); }
      catch (e) { filas += `<tr><td colspan="6" style="color:#c62828;padding:10px;">Error: ${(e.message||e).replace(/</g,'&lt;')}</td></tr>`; }
    });
    return `<div class="pf-docs-table-wrap">
      <table class="pf-docs-table">
        <thead><tr>
          <th>Descripción</th><th>Estado</th><th>Fecha</th><th>Archivo</th>
          ${!bloqueado ? '<th>Acciones</th>' : ''}
        </tr></thead>
        <tbody>${filas}</tbody>
      </table></div>`;
  };

  const seccionHtml = (titulo, icono, tipo, lista) => {
    if (filtro === 'presupuesto' && tipo !== 'presupuesto') return '';
    if (filtro === 'factura'     && tipo !== 'factura')     return '';
    const contenido = lista.length === 0
      ? `<div class="pf-seccion-empty"><i class="fas ${icono}"></i><p>No hay ${titulo.toLowerCase()} registrados</p></div>`
      : renderTabla(lista);
    return `<section class="pf-seccion-documentos pf-seccion-${tipo}">
      <div class="pf-seccion-header">
        <h3><i class="fas ${icono}"></i> ${titulo}</h3>
        <span class="pf-seccion-count">${lista.length} documento${lista.length === 1 ? '' : 's'}</span>
      </div>
      ${contenido}
    </section>`;
  };

  // ── Tabla unificada de todos los docs (siempre visible cuando hay datos) ──
  const todosHtml = (filtro === 'todos' && docs.length > 0)
    ? this._renderTablaUnificadaDocumentos(docs, bloqueado)
    : (seccionHtml('Presupuestos', 'fa-file-alt', 'presupuesto', presupuestosFiltrados)
     + seccionHtml('Facturas', 'fa-file-invoice-dollar', 'factura', facturasFiltradas));

  const vacio = docs.length === 0 && filtro === 'todos'
    || (filtro !== 'todos' && presupuestosFiltrados.length === 0 && facturasFiltradas.length === 0);

  container.innerHTML = `
    <div class="section-header">
      <h2><i class="fas fa-file-invoice-dollar"></i> Presupuestos y Facturas — ${mascota}</h2>
      <div>
        ${!bloqueado ? `<button class="btn btn-primary" style="margin-right:8px;"
          onclick="window.internamientoModule.abrirModalDocumentoFinanciero()">
          <i class="fas fa-plus"></i> Agregar documento
        </button>` : ''}
        <button class="btn btn-secondary"
          onclick="window.internamientoModule.showPanelPrincipal('${this.currentInternamientoId}')">
          <i class="fas fa-arrow-left"></i> Volver al Panel
        </button>
      </div>
    </div>

    <div class="pf-summary-grid">
      <div class="pf-summary-card pf-summary-pending">
        <div class="pf-summary-value">${countPendiente}</div>
        <div class="pf-summary-label"><i class="fas fa-clock"></i> Pendientes</div>
      </div>
      <div class="pf-summary-card pf-summary-paid">
        <div class="pf-summary-value">${countPagado}</div>
        <div class="pf-summary-label"><i class="fas fa-check-circle"></i> Pagados</div>
      </div>
      <div class="pf-summary-card pf-summary-total">
        <div class="pf-summary-value">${presupuestos.length + facturas.length}</div>
        <div class="pf-summary-label"><i class="fas fa-file-alt"></i> Presup. + Fact.</div>
      </div>
      <div class="pf-summary-card pf-summary-docs">
        <div class="pf-summary-value">${docs.length}</div>
        <div class="pf-summary-label"><i class="fas fa-folder-open"></i> Documentos</div>
      </div>
    </div>

    <div class="pf-filtros">
      ${filtroBtn('todos', 'Todos')}
      ${filtroBtn('presupuesto', 'Presupuestos')}
      ${filtroBtn('factura', 'Facturas')}
      ${filtroBtn('pendiente', 'Pendientes')}
      ${filtroBtn('pagado', 'Pagados')}
    </div>

    ${vacio
      ? `<div class="empty-state"><i class="fas fa-file-invoice"></i><p>No hay documentos registrados</p></div>`
      : todosHtml}
  `;
};

InternamientoModule.prototype._pfSetFiltro = function (key) {
  this._pfFiltroActivo = key;
  this.loadPresupuestosFacturasView();
};

// Tabla robusta: muestra TODOS los documentos, nunca falla
InternamientoModule.prototype._renderTablaUnificadaDocumentos = function (docs, bloqueado) {
  const rows = docs.map((d, i) => {
    try {
      const _fmt = (ts) => {
        if (!ts) return '—';
        if (typeof this.formatFechaHora12 === 'function') return this.formatFechaHora12(ts);
        const dt = new Date(ts); return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('es-PE');
      };
      const ec = { pagado:{bg:'#e8f5e9',color:'#2e7d32'}, anulado:{bg:'#ffebee',color:'#c62828'}, aprobado:{bg:'#e3f2fd',color:'#1565c0'}, pendiente:{bg:'#fff3e0',color:'#e65100'} };
      const estado = d.estado || 'pendiente';
      const col    = ec[estado] || ec.pendiente;
      const docId  = String(d.docId || '').replace(/'/g, "\\'");
      const desc   = (d.descripcion || d.docId || 'Sin descripción').replace(/</g, '&lt;');
      const tipo   = d.tipo ? (d.tipo === 'presupuesto' ? 'Presupuesto' : 'Factura') : '—';
      const fecha  = _fmt(d.fechaCreacion);
      const tieneArch = d.archivo && (d.archivo.base64 || d.archivo.downloadUrl || d.archivo.storagePath);

      const archBtn = tieneArch
        ? `<button class="btn btn-sm pf-btn-preview" onclick="window.internamientoModule.previewDocumentoFinanciero('${docId}')"><i class="fas fa-eye"></i> Ver</button>`
        : '<span style="color:#94a3b8;font-size:0.82rem;">Sin archivo</span>';

      const borrarBtn = !bloqueado
        ? `<button class="btn btn-sm" style="background:#c62828;color:white;margin-left:4px;" title="Eliminar" onclick="window.internamientoModule.borrarDocumentoFinanciero('${docId}')"><i class="fas fa-trash"></i></button>`
        : '';

      const accionesBtn = !bloqueado && !d._legacy
        ? `${estado==='pendiente'&&d.tipo==='presupuesto'?`<button class="btn btn-sm btn-success" style="margin-right:3px;" onclick="window.internamientoModule.marcarDocumentoAprobado('${docId}')"><i class="fas fa-check"></i></button>`:''}
           ${(estado==='pendiente'||estado==='aprobado')?`<button class="btn btn-sm btn-success" style="margin-right:3px;" onclick="window.internamientoModule.marcarDocumentoPagado('${docId}')"><i class="fas fa-dollar-sign"></i></button>`:''}
           ${estado!=='anulado'?`<button class="btn btn-sm" style="background:#e65100;color:white;margin-right:3px;" onclick="window.internamientoModule.anularDocumentoFinanciero('${docId}')"><i class="fas fa-ban"></i></button>`:''}
           ${borrarBtn}`
        : borrarBtn;

      return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td style="padding:10px 14px"><strong>${desc}</strong><div style="font-size:0.78rem;color:#64748b;">${tipo}</div></td>
        <td style="padding:10px 14px"><span style="background:${col.bg};color:${col.color};padding:3px 10px;border-radius:12px;font-size:0.78rem;font-weight:600">${estado.toUpperCase()}</span></td>
        <td style="padding:10px 14px;font-size:0.85rem;color:#64748b">${fecha}</td>
        <td style="padding:10px 14px">${archBtn}</td>
        ${!bloqueado ? `<td style="padding:10px 14px;white-space:nowrap">${accionesBtn}</td>` : ''}
      </tr>`;
    } catch (e) {
      const docId = String(d?.docId || '').replace(/'/g, "\\'");
      return `<tr><td colspan="5" style="padding:10px;color:#c62828">
        Error al mostrar documento — 
        <button class="btn btn-sm" style="background:#c62828;color:white" onclick="window.internamientoModule.borrarDocumentoFinanciero('${docId}')">
          <i class="fas fa-trash"></i> Eliminar este
        </button>
      </td></tr>`;
    }
  }).join('');

  return `<div class="pf-docs-table-wrap">
    <table class="pf-docs-table" style="width:100%">
      <thead><tr>
        <th>Descripción / Tipo</th><th>Estado</th><th>Fecha</th><th>Archivo</th>
        ${!bloqueado ? '<th>Acciones</th>' : ''}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
};

// ----------------------------------------------------------------
// Renderizar fila de tabla
// ----------------------------------------------------------------
InternamientoModule.prototype._renderDocumentoFinancieroRow = function (d, index, bloqueado, showTipoColumn) {
  const _fmt = (ts) => {
    if (!ts) return '—';
    if (typeof this.formatFechaHora12 === 'function') return this.formatFechaHora12(ts);
    const dt = new Date(ts);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('es-PE') + ' ' + dt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const fecha    = _fmt(d.fechaCreacion);
  const estado   = d.estado || 'pendiente';
  const colors   = { pagado: { bg:'#e8f5e9', color:'#2e7d32' }, anulado: { bg:'#ffebee', color:'#c62828' }, aprobado: { bg:'#e3f2fd', color:'#1565c0' }, pendiente: { bg:'#fff3e0', color:'#e65100' } };
  const ec       = colors[estado] || colors.pendiente;
  const tipoLabel= d.tipo === 'presupuesto' ? 'Presupuesto' : 'Factura';
  const tipoBg   = d.tipo === 'presupuesto' ? '#0d9488' : '#1565c0';
  const docId    = String(d.docId || '').replace(/'/g, "\\'");
  const desc     = (d.descripcion || '').replace(/</g, '&lt;');
  const ref      = (d.numeroReferencia || '').replace(/</g, '&lt;');
  const obs      = (d.observaciones || '').replace(/</g, '&lt;');
  const legacy   = d._legacy;

  const tieneArchivo = d.archivo && (d.archivo.base64 || d.archivo.downloadUrl || d.archivo.storagePath);

  let archivoCell = '<span style="color:#94a3b8;font-size:0.85rem;">Sin archivo</span>';
  if (tieneArchivo) {
    archivoCell = `
      <button type="button" class="btn btn-sm pf-btn-preview" title="Ver documento"
        onclick="window.internamientoModule.previewDocumentoFinanciero('${docId}')">
        <i class="fas fa-eye"></i> Ver
      </button>
      <button type="button" class="btn btn-sm pf-btn-download" title="Descargar"
        onclick="window.internamientoModule.downloadDocumentoFinanciero('${docId}')">
        <i class="fas fa-download"></i>
      </button>`;
  }

  let acciones = '';
  if (!bloqueado && !legacy) {
    acciones = `<td class="pf-actions-cell">
      ${estado === 'pendiente' && d.tipo === 'presupuesto' ? `<button class="btn btn-sm btn-success" onclick="window.internamientoModule.marcarDocumentoAprobado('${docId}')"><i class="fas fa-check"></i></button>` : ''}
      ${estado === 'pendiente' || estado === 'aprobado' ? `<button class="btn btn-sm btn-success" onclick="window.internamientoModule.marcarDocumentoPagado('${docId}')"><i class="fas fa-dollar-sign"></i></button>` : ''}
      ${estado !== 'anulado' ? `<button class="btn btn-sm" style="background:#c62828;color:white;" onclick="window.internamientoModule.anularDocumentoFinanciero('${docId}')"><i class="fas fa-ban"></i></button>` : ''}
    </td>`;
  } else if (!bloqueado && legacy) {
    acciones = `<td class="pf-actions-cell">
      ${d.estado === 'pendiente' ? `<button class="btn btn-sm btn-success" onclick="window.internamientoModule.marcarFacturaPagada('${docId}')"><i class="fas fa-check"></i></button>` : ''}
      ${d.estado !== 'anulado' ? `<button class="btn btn-sm" style="background:#c62828;color:white;" onclick="window.internamientoModule.anularFactura('${docId}')"><i class="fas fa-ban"></i></button>` : ''}
    </td>`;
  } else if (!bloqueado) {
    acciones = '<td></td>';
  }

  return `<tr style="background:${index % 2 === 0 ? 'white' : '#f9fafb'};">
    ${showTipoColumn ? `<td><span class="pf-tipo-badge" style="background:${tipoBg}">${tipoLabel}</span></td>` : ''}
    <td>
      <strong>${desc}</strong>
      ${ref ? `<div class="pf-ref">Ref: ${ref}</div>` : ''}
      ${obs ? `<div class="pf-obs">${obs}</div>` : ''}
      ${legacy ? '<div class="pf-legacy-tag">Registro anterior (sin archivo)</div>' : ''}
    </td>
    <td><span class="pf-estado-badge" style="background:${ec.bg};color:${ec.color}">${estado.toUpperCase()}</span></td>
    <td class="pf-fecha">${fecha}</td>
    <td class="pf-archivo-cell">${archivoCell}</td>
    ${!bloqueado ? acciones : ''}
  </tr>`;
};

// Permite siempre agregar documentos (no bloquea por existentes)
InternamientoModule.prototype._pfTieneDocumentoConArchivo = function (_internamiento, _tipo) {
  return false;
};

// Eliminar documento directamente de RTDB
InternamientoModule.prototype.borrarDocumentoFinanciero = async function (docId) {
  if (!docId) return;
  const ok = await this.showConfirm(
    '¿Eliminar este documento permanentemente?\nEsta acción no se puede deshacer.',
    'Eliminar documento',
    { confirmText: 'Eliminar', cancelText: 'Cancelar', icon: 'fa-trash', iconColor: '#c62828' }
  );
  if (!ok) return;
  try {
    await this.internamientosRef
      .child(this.currentInternamientoId)
      .child(`documentos_financieros/${docId}`)
      .remove();
    const int = this.internamientos.get(this.currentInternamientoId);
    if (int?.documentos_financieros?.[docId]) {
      delete int.documentos_financieros[docId];
    }
    this.showNotification('Documento eliminado', 'success');
    this.loadPresupuestosFacturasView();
  } catch (e) {
    this.showAlert('Error al eliminar: ' + (e.message || e), 'Error', 'error');
  }
};

InternamientoModule.prototype._pfInitPendingUploads = function () {
  this._pfPendingUploads = { presupuesto: null, factura: null };
  this._pfPreviewUrls    = { presupuesto: null, factura: null };
};

InternamientoModule.prototype._pfRevokePreviewUrls = function () {
  if (!this._pfPreviewUrls) return;
  Object.values(this._pfPreviewUrls).forEach((url) => { if (url) URL.revokeObjectURL(url); });
  this._pfPreviewUrls = { presupuesto: null, factura: null };
};

InternamientoModule.prototype._pfUpdateSubmitState = function (submitBtn) {
  if (!submitBtn) return;
  const hasReady = this._pfPendingUploads?.presupuesto?.blob || this._pfPendingUploads?.factura?.blob;
  const desc     = document.getElementById('pfDescripcion');
  submitBtn.disabled = !hasReady || !desc || !desc.value.trim();
};

InternamientoModule.prototype._pfSyncArchivoLayout = function () {
  const wrapPres = document.getElementById('pfArchivoWrapPresupuesto');
  const wrapFact = document.getElementById('pfArchivoWrapFactura');
  if (!wrapPres || !wrapFact) return;
  const hasPres = !!this._pfPendingUploads?.presupuesto?.blob;
  const hasFact = !!this._pfPendingUploads?.factura?.blob;
  wrapPres.classList.toggle('hidden', !this._pfShowPresupuesto);
  wrapFact.classList.toggle('hidden', !this._pfShowFactura);
  if (this._pfShowPresupuesto && this._pfShowFactura) {
    if (hasPres && !hasFact) { wrapFact.classList.add('hidden'); wrapPres.classList.add('pf-archivo-slot-full'); }
    else if (hasFact && !hasPres) { wrapPres.classList.add('hidden'); wrapFact.classList.add('pf-archivo-slot-full'); }
    else { wrapPres.classList.remove('pf-archivo-slot-full'); wrapFact.classList.remove('pf-archivo-slot-full'); }
  } else {
    wrapPres.classList.add('pf-archivo-slot-full');
    wrapFact.classList.add('pf-archivo-slot-full');
  }
};

// ----------------------------------------------------------------
// Modal de agregar documento
// ----------------------------------------------------------------
InternamientoModule.prototype.abrirModalDocumentoFinanciero = async function () {
  if (!this.currentInternamientoId) return;
  const internamiento = this.internamientos.get(this.currentInternamientoId);
  if (!internamiento) return;

  this._pfShowPresupuesto = !this._pfTieneDocumentoConArchivo(internamiento, 'presupuesto');
  this._pfShowFactura     = !this._pfTieneDocumentoConArchivo(internamiento, 'factura');
  this._pfInitPendingUploads();
  this._pfModalCodigo = null;

  if (!this._pfShowPresupuesto && !this._pfShowFactura) {
    this.showNotification('Este expediente ya tiene presupuesto y factura. Anule uno para reemplazarlo.', 'info');
    return;
  }

  const archivoPresHtml = this._pfShowPresupuesto ? `
    <div class="pf-archivo-slot pf-archivo-slot-presupuesto" id="pfArchivoWrapPresupuesto">
      <label for="pfArchivoPresupuesto">Presupuesto (PDF o imagen)</label>
      <input type="file" id="pfArchivoPresupuesto" accept=".pdf,image/jpeg,image/png,image/webp" class="pf-input pf-file-input">
      <div id="pfStatusPresupuesto" class="pf-archivo-status hidden"></div>
      <div id="pfPreviewWrapPresupuesto" class="pf-preview-wrap pf-preview-wrap-sm hidden">
        <div class="pf-preview-header"><span><i class="fas fa-eye"></i> Vista previa</span></div>
        <div id="pfPreviewContentPresupuesto" class="pf-preview-content"></div>
      </div>
    </div>` : '';

  const archivoFactHtml = this._pfShowFactura ? `
    <div class="pf-archivo-slot pf-archivo-slot-factura" id="pfArchivoWrapFactura">
      <label for="pfArchivoFactura">Factura (PDF o imagen)</label>
      <input type="file" id="pfArchivoFactura" accept=".pdf,image/jpeg,image/png,image/webp" class="pf-input pf-file-input">
      <div id="pfStatusFactura" class="pf-archivo-status hidden"></div>
      <div id="pfPreviewWrapFactura" class="pf-preview-wrap pf-preview-wrap-sm hidden">
        <div class="pf-preview-header"><span><i class="fas fa-eye"></i> Vista previa</span></div>
        <div id="pfPreviewContentFactura" class="pf-preview-content"></div>
      </div>
    </div>` : '';

  const duoClass = this._pfShowPresupuesto && this._pfShowFactura ? 'pf-archivo-duo' : 'pf-archivo-duo pf-archivo-duo-single';

  const html = `
    <form id="formDocumentoFinanciero" class="pf-form-modal">
      <div class="form-group">
        <label>Descripción *</label>
        <input type="text" id="pfDescripcion" required placeholder="Ej: Internamiento día 3" class="pf-input">
      </div>
      <div class="form-group">
        <label>Nº referencia (opcional)</label>
        <input type="text" id="pfReferencia" placeholder="Número de factura / presupuesto" class="pf-input">
      </div>
      <div class="form-group">
        <label>Observaciones</label>
        <textarea id="pfObservaciones" rows="2" placeholder="Notas..." class="pf-input"></textarea>
      </div>
      <div class="form-group">
        <label>Archivos (PDF o imagen) *</label>
        <div class="${duoClass}" id="pfArchivoDuoGrid">
          ${archivoPresHtml}
          ${archivoFactHtml}
        </div>
        <small class="pf-hint">Se comprime automáticamente antes de guardar.</small>
      </div>
      <div class="pf-form-actions">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
        <button type="submit" id="pfSubmitBtn" class="btn btn-primary" disabled>
          <i class="fas fa-save"></i> Guardar
        </button>
      </div>
    </form>`;

  const modal = this.createModal('Agregar documento', html, 'fa-file-invoice-dollar');
  document.body.appendChild(modal);

  const submitBtn = document.getElementById('pfSubmitBtn');
  const descInput = document.getElementById('pfDescripcion');

  ['pfArchivoPresupuesto', 'pfArchivoFactura'].forEach((inputId) => {
    const tipo  = inputId.includes('Presupuesto') ? 'presupuesto' : 'factura';
    const input = document.getElementById(inputId);
    if (input) input.addEventListener('change', () => this._pfHandleArchivoSeleccionadoTipo(input.files[0], tipo, submitBtn));
  });

  if (descInput) descInput.addEventListener('input', () => this._pfUpdateSubmitState(submitBtn));

  this._pfSyncArchivoLayout();

  document.getElementById('formDocumentoFinanciero').onsubmit = (e) => {
    e.preventDefault();
    this.guardarDocumentoFinanciero(submitBtn);
  };
};

// ----------------------------------------------------------------
// Procesar archivo seleccionado (compresión + preview)
// ----------------------------------------------------------------
InternamientoModule.prototype._pfHandleArchivoSeleccionadoTipo = async function (file, tipo, submitBtn) {
  const statusId      = tipo === 'presupuesto' ? 'pfStatusPresupuesto'      : 'pfStatusFactura';
  const previewWrapId = tipo === 'presupuesto' ? 'pfPreviewWrapPresupuesto' : 'pfPreviewWrapFactura';
  const previewContId = tipo === 'presupuesto' ? 'pfPreviewContentPresupuesto' : 'pfPreviewContentFactura';

  const statusEl    = document.getElementById(statusId);
  const previewWrap = document.getElementById(previewWrapId);
  const previewCont = document.getElementById(previewContId);

  if (!this._pfPendingUploads) this._pfInitPendingUploads();

  if (!file) {
    this._pfPendingUploads[tipo] = null;
    if (this._pfPreviewUrls?.[tipo]) { URL.revokeObjectURL(this._pfPreviewUrls[tipo]); this._pfPreviewUrls[tipo] = null; }
    if (previewWrap) previewWrap.classList.add('hidden');
    if (statusEl)    statusEl.classList.add('hidden');
    this._pfSyncArchivoLayout();
    this._pfUpdateSubmitState(submitBtn);
    return;
  }

  if (!window.InternamientoDocumentoCompress) {
    this.showAlert('Módulo de compresión no cargado. Recargue la página.', 'Error', 'error');
    return;
  }

  if (statusEl) { statusEl.classList.remove('hidden'); statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Comprimiendo…'; }

  try {
    const result = await window.InternamientoDocumentoCompress.compressDocumentFile(file);

    // Verificar tamaño (Firebase RTDB límite ~9MB base64)
    const base64Size = Math.round(result.blob.size * 4 / 3);
    if (base64Size > 8 * 1024 * 1024) {
      throw new Error(`El archivo comprimido es demasiado grande (${(base64Size / 1024 / 1024).toFixed(1)} MB). Máximo 6 MB original.`);
    }

    this._pfPendingUploads[tipo] = {
      blob:           result.blob,
      fileName:       result.fileName,
      mimeType:       result.mimeType,
      originalSize:   result.originalSize,
      compressedSize: result.compressedSize
    };

    if (statusEl) {
      const fmt = window.InternamientoDocumentoCompress?.formatBytes;
      const sizeInfo = fmt ? ` (${fmt(result.compressedSize)})` : '';
      statusEl.innerHTML = `<i class="fas fa-check-circle" style="color:#2e7d32;"></i> Listo${sizeInfo}`;
    }

    if (previewWrap && previewCont) {
      previewWrap.classList.remove('hidden');
      if (this._pfPreviewUrls[tipo]) URL.revokeObjectURL(this._pfPreviewUrls[tipo]);
      const previewUrl = URL.createObjectURL(result.blob);
      this._pfPreviewUrls[tipo] = previewUrl;
      previewCont.innerHTML = result.mimeType === 'application/pdf'
        ? `<iframe src="${previewUrl}" title="Vista previa PDF"></iframe>`
        : `<img src="${previewUrl}" alt="Vista previa" />`;
    }

    this._pfSyncArchivoLayout();
    this._pfUpdateSubmitState(submitBtn);
  } catch (err) {
    console.error('Error preparando archivo:', err);
    this._pfPendingUploads[tipo] = null;
    if (statusEl) statusEl.innerHTML = `<i class="fas fa-exclamation-circle" style="color:#c62828;"></i> ${err.message || err}`;
    if (previewWrap) previewWrap.classList.add('hidden');
    this._pfSyncArchivoLayout();
    this._pfUpdateSubmitState(submitBtn);
  }
};

// ----------------------------------------------------------------
// Guardar en Firebase Realtime Database (base64)
// ----------------------------------------------------------------
InternamientoModule.prototype._blobToBase64 = function (blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result); // data:<mime>;base64,<data>
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(blob);
  });
};

InternamientoModule.prototype.guardarDocumentoFinanciero = async function (submitBtn) {
  const pendientes = [];
  if (this._pfPendingUploads?.presupuesto?.blob) pendientes.push('presupuesto');
  if (this._pfPendingUploads?.factura?.blob)     pendientes.push('factura');

  if (pendientes.length === 0) {
    this.showNotification('Seleccione al menos un archivo y espere a que esté listo.', 'warning');
    return;
  }

  const accion = pendientes.includes('factura') ? 'crear_factura_archivo' : 'crear_presupuesto';

  if (!this._pfModalCodigo) {
    const resultadoCodigo = await this.verificarCodigoAsistente(accion);
    if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
      this.showNotification('Operación cancelada', 'info');
      return;
    }
    this._pfModalCodigo = resultadoCodigo;
  }

  const codigo      = this._pfModalCodigo;
  const descripcion = document.getElementById('pfDescripcion')?.value.trim() || '';
  const referencia  = document.getElementById('pfReferencia')?.value.trim()  || '';
  const observaciones = document.getElementById('pfObservaciones')?.value.trim() || '';

  if (!descripcion) { this.showNotification('Ingrese una descripción', 'warning'); return; }

  const internamientoId = this.currentInternamientoId;
  const originalHtml = submitBtn?.innerHTML || '';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…'; }

  try {
    const guardados = [];

    for (const tipo of pendientes) {
      const meta  = this._pfPendingUploads[tipo];
      const docId = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

      // Convertir a base64
      const dataUrl = await this._blobToBase64(meta.blob);

      const registro = {
        docId,
        tipo,
        descripcion,
        estado:          'pendiente',
        numeroReferencia: referencia    || null,
        observaciones:   observaciones || null,
        fechaCreacion:   Date.now(),
        creadoPor:       codigo?.assistantId || null,
        creadoNombre:    codigo?.nombre || '',
        archivo: {
          base64:        dataUrl,
          fileName:      meta.fileName,
          mimeType:      meta.mimeType,
          sizeBytes:     meta.compressedSize,
          originalSizeBytes: meta.originalSize,
          guardadoEn:    'rtdb',
          uploadedAt:    Date.now()
        }
      };

      await this.internamientosRef
        .child(internamientoId)
        .child(`documentos_financieros/${docId}`)
        .set(registro);

      const int = this.internamientos.get(internamientoId);
      if (int) {
        int.documentos_financieros = int.documentos_financieros || {};
        int.documentos_financieros[docId] = registro;
      }

      guardados.push(tipo === 'presupuesto' ? 'Presupuesto' : 'Factura');
    }

    this._pfRevokePreviewUrls();
    document.querySelector('.modal-overlay')?.remove();
    this.showNotification(guardados.join(' y ') + ' guardado(s) por ' + codigo?.nombre, 'success');
    this.loadPresupuestosFacturasView();
  } catch (err) {
    console.error('Error guardando documento:', err);
    this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalHtml; }
  }
};

// ----------------------------------------------------------------
// Obtener documento por ID
// ----------------------------------------------------------------
InternamientoModule.prototype._getDocumentoFinancieroById = function (docId) {
  const int = this.internamientos.get(this.currentInternamientoId);
  if (!int) return null;
  const doc = int.documentos_financieros?.[docId];
  if (doc) return doc;
  const legacy = int.facturas?.[docId];
  if (legacy) return { docId: legacy.facturaId, tipo: 'factura', descripcion: legacy.descripcion, archivo: null, _legacy: true };
  return null;
};

// ----------------------------------------------------------------
// Obtener blob desde el documento (base64 o Storage)
// ----------------------------------------------------------------
InternamientoModule.prototype._obtenerBlobDocumento = async function (doc) {
  const archivo = doc?.archivo;
  if (!archivo) throw new Error('Este documento no tiene archivo adjunto.');

  // Prioridad 1: base64 guardado en RTDB
  if (archivo.base64) {
    const res  = await fetch(archivo.base64);
    const blob = await res.blob();
    return { blob, mimeType: archivo.mimeType || blob.type, fileName: archivo.fileName || 'documento' };
  }

  // Prioridad 2: URL de descarga (Storage legacy)
  const url = archivo.downloadUrl;
  if (!url) throw new Error('El archivo no está disponible.');
  const res  = await fetch(url);
  if (!res.ok) throw new Error('No se pudo descargar el archivo.');
  const blob = await res.blob();
  return { blob, mimeType: archivo.mimeType || blob.type, fileName: archivo.fileName || 'documento' };
};

// ----------------------------------------------------------------
// Vista previa
// ----------------------------------------------------------------
InternamientoModule.prototype.previewDocumentoFinanciero = async function (docId) {
  // Si hay datos en RTDB pero no en memoria, recargar primero
  let doc = this._getDocumentoFinancieroById(docId);
  if (doc && doc.archivo && !doc.archivo.base64 && !doc.archivo.downloadUrl) {
    // Intentar leer fresco de RTDB
    try {
      const snap = await this.internamientosRef
        .child(this.currentInternamientoId)
        .child(`documentos_financieros/${docId}`)
        .once('value');
      if (snap.exists()) {
        const int = this.internamientos.get(this.currentInternamientoId);
        if (int) {
          int.documentos_financieros = int.documentos_financieros || {};
          int.documentos_financieros[docId] = snap.val();
          doc = snap.val();
        }
      }
    } catch (_) {}
  }

  if (!doc) { this.showNotification('Documento no encontrado', 'error'); return; }
  if (!doc.archivo?.base64 && !doc.archivo?.downloadUrl) {
    this.showNotification('Este registro no tiene archivo adjunto', 'warning');
    return;
  }

  const titulo   = (doc.tipo === 'presupuesto' ? 'Presupuesto' : 'Factura') + ' — ' + (doc.descripcion || '');
  const docIdSafe= String(docId).replace(/'/g, "\\'");

  const loadingHtml = `<div class="pf-preview-modal-body">
    <div class="pf-preview-loading"><i class="fas fa-spinner fa-spin"></i> Cargando…</div></div>`;
  const modal = this.createModal(titulo, loadingHtml, 'fa-eye');
  document.body.appendChild(modal);
  const mc = modal.querySelector('.modal-content');
  if (mc) mc.style.maxWidth = '920px';

  try {
    const { blob, mimeType } = await this._obtenerBlobDocumento(doc);
    const blobUrl = URL.createObjectURL(blob);
    modal._pfBlobUrl = blobUrl;

    const previewHtml = (mimeType === 'application/pdf' || (doc.archivo?.fileName || '').toLowerCase().endsWith('.pdf'))
      ? `<embed src="${blobUrl}" type="application/pdf" class="pf-preview-iframe-full" />`
      : `<img src="${blobUrl}" alt="Vista previa" class="pf-preview-img-full" />`;

    const body = modal.querySelector('.pf-preview-modal-body');
    if (body) body.innerHTML = `
      ${previewHtml}
      <div class="pf-preview-modal-actions">
        <button type="button" class="btn btn-primary"
          onclick="window.internamientoModule.downloadDocumentoFinanciero('${docIdSafe}')">
          <i class="fas fa-download"></i> Descargar
        </button>
        <button type="button" class="btn btn-secondary"
          onclick="window.open('${blobUrl}','_blank','noopener')">
          <i class="fas fa-external-link-alt"></i> Abrir pestaña
        </button>
        <button type="button" class="btn btn-secondary"
          onclick="window.internamientoModule._cerrarPreviewDocumento(this)">Cerrar</button>
      </div>`;
  } catch (err) {
    const body = modal.querySelector('.pf-preview-modal-body');
    if (body) body.innerHTML = `
      <div class="pf-preview-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${(err.message || err).replace(/</g,'&lt;')}</p>
      </div>
      <div class="pf-preview-modal-actions">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
      </div>`;
  }
};

InternamientoModule.prototype._cerrarPreviewDocumento = function (btn) {
  const modal = btn?.closest?.('.modal-overlay');
  if (modal?._pfBlobUrl) URL.revokeObjectURL(modal._pfBlobUrl);
  modal?.remove();
};

// ----------------------------------------------------------------
// Descargar
// ----------------------------------------------------------------
InternamientoModule.prototype.downloadDocumentoFinanciero = async function (docId) {
  // Refrescar del RTDB si es necesario
  let doc = this._getDocumentoFinancieroById(docId);
  if (doc?.archivo && !doc.archivo.base64 && !doc.archivo.downloadUrl) {
    try {
      const snap = await this.internamientosRef.child(this.currentInternamientoId).child(`documentos_financieros/${docId}`).once('value');
      if (snap.exists()) {
        const int = this.internamientos.get(this.currentInternamientoId);
        if (int) { int.documentos_financieros = int.documentos_financieros || {}; int.documentos_financieros[docId] = snap.val(); doc = snap.val(); }
      }
    } catch (_) {}
  }

  if (!doc?.archivo) { this.showNotification('Sin archivo para descargar', 'warning'); return; }

  try {
    const { blob, fileName } = await this._obtenerBlobDocumento(doc);
    const blobUrl = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: blobUrl, download: fileName || 'documento', rel: 'noopener' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
  } catch (err) {
    this.showAlert('No se pudo descargar: ' + (err.message || err), 'Error', 'error');
  }
};

// ----------------------------------------------------------------
// Acciones de estado
// ----------------------------------------------------------------
InternamientoModule.prototype.marcarDocumentoPagado = async function (docId) {
  if (!await this.showConfirm('¿Marcar como pagado?', 'Confirmar pago', { confirmText:'Sí, pagado', cancelText:'Cancelar', icon:'fa-check-circle', iconColor:'#2e7d32' })) return;
  const r = await this.verificarCodigoAsistente('factura_pago');
  if (!r.valido || r.cancelado) return;
  try {
    await this.internamientosRef.child(this.currentInternamientoId).child(`documentos_financieros/${docId}`).update({ estado:'pagado', fechaPago:Date.now(), pagadoPorNombre:r.nombre });
    const int = this.internamientos.get(this.currentInternamientoId);
    if (int?.documentos_financieros?.[docId]) int.documentos_financieros[docId].estado = 'pagado';
    this.showNotification('Marcado como pagado', 'success');
    this.loadPresupuestosFacturasView();
  } catch (e) { this.showAlert('Error: ' + e.message, 'Error', 'error'); }
};

InternamientoModule.prototype.marcarDocumentoAprobado = async function (docId) {
  const r = await this.verificarCodigoAsistente('aprobar_presupuesto');
  if (!r.valido || r.cancelado) return;
  try {
    await this.internamientosRef.child(this.currentInternamientoId).child(`documentos_financieros/${docId}`).update({ estado:'aprobado', fechaAprobacion:Date.now(), aprobadoPorNombre:r.nombre });
    const int = this.internamientos.get(this.currentInternamientoId);
    if (int?.documentos_financieros?.[docId]) int.documentos_financieros[docId].estado = 'aprobado';
    this.showNotification('Presupuesto aprobado', 'success');
    this.loadPresupuestosFacturasView();
  } catch (e) { this.showAlert('Error: ' + e.message, 'Error', 'error'); }
};

InternamientoModule.prototype.anularDocumentoFinanciero = async function (docId) {
  if (!await this.showConfirm('¿Anular este documento?', 'Anular', { confirmText:'Anular', cancelText:'Cancelar', icon:'fa-ban', iconColor:'#c62828' })) return;
  const r = await this.verificarCodigoAsistente('anular_factura');
  if (!r.valido || r.cancelado) return;
  try {
    await this.internamientosRef.child(this.currentInternamientoId).child(`documentos_financieros/${docId}`).update({ estado:'anulado', fechaAnulacion:Date.now(), anuladoPorNombre:r.nombre });
    const int = this.internamientos.get(this.currentInternamientoId);
    if (int?.documentos_financieros?.[docId]) int.documentos_financieros[docId].estado = 'anulado';
    this.showNotification('Documento anulado', 'success');
    this.loadPresupuestosFacturasView();
  } catch (e) { this.showAlert('Error: ' + e.message, 'Error', 'error'); }
};
