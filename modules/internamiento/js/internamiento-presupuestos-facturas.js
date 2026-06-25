// ====================================================================
// PRESUPUESTOS Y FACTURAS — Firebase Storage + compresión + vista previa
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
  Object.values(nuevos).forEach((d) => {
    if (d && d.docId) docs.push({ ...d, _legacy: false });
  });

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

InternamientoModule.prototype.loadPresupuestosFacturasView = function () {
  const container = document.getElementById('internamiento-presupuestos_facturas');
  if (!container) return;

  const internamiento = this.internamientos.get(this.currentInternamientoId);
  if (!internamiento) return;

  const bloqueado = internamiento.estado?.actual === 'egresado';
  const mascota = internamiento.referencias?.nombreMascota || 'Paciente';
  const docs = this._getDocumentosFinancierosLista(internamiento);

  const presupuestos = docs.filter((d) => d.tipo === 'presupuesto');
  const facturas = docs.filter((d) => d.tipo === 'factura');

  const countPendiente = docs.filter(
    (d) => d.estado === 'pendiente' || d.estado === 'aprobado'
  ).length;
  const countPagado = docs.filter((d) => d.estado === 'pagado').length;

  const filtro = this._pfFiltroActivo || 'todos';

  const filtroBtn = (key, label) => {
    const active = filtro === key;
    return `<button type="button" class="pf-filtro-btn${active ? ' active' : ''}"
      onclick="window.internamientoModule._pfSetFiltro('${key}')">${label}</button>`;
  };

  const aplicarFiltroEstado = (lista) => {
    if (filtro === 'pendiente') {
      return lista.filter((d) => d.estado === 'pendiente' || d.estado === 'aprobado');
    }
    if (filtro === 'pagado') {
      return lista.filter((d) => d.estado === 'pagado');
    }
    return lista;
  };

  const presupuestosFiltrados = aplicarFiltroEstado(presupuestos);
  const facturasFiltradas = aplicarFiltroEstado(facturas);

  const seccionDocumentos = (titulo, icono, tipo, lista) => {
    if (filtro === 'presupuesto' && tipo !== 'presupuesto') return '';
    if (filtro === 'factura' && tipo !== 'factura') return '';
    const vacio =
      lista.length === 0
        ? `<div class="pf-seccion-empty"><i class="fas ${icono}"></i><p>No hay ${titulo.toLowerCase()} registrados</p></div>`
        : `<div class="pf-docs-table-wrap">
            <table class="pf-docs-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Archivo</th>
                  ${!bloqueado ? '<th>Acciones</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${lista.map((d, i) => this._renderDocumentoFinancieroRow(d, i, bloqueado, false)).join('')}
              </tbody>
            </table>
          </div>`;

    return `
      <section class="pf-seccion-documentos pf-seccion-${tipo}">
        <div class="pf-seccion-header">
          <h3><i class="fas ${icono}"></i> ${titulo}</h3>
          <span class="pf-seccion-count">${lista.length} documento${lista.length === 1 ? '' : 's'}</span>
        </div>
        ${vacio}
      </section>`;
  };

  const seccionesHtml =
    seccionDocumentos('Presupuestos', 'fa-file-alt', 'presupuesto', presupuestosFiltrados) +
    seccionDocumentos('Facturas', 'fa-file-invoice-dollar', 'factura', facturasFiltradas);

  const sinResultados =
    (filtro === 'presupuesto' && presupuestosFiltrados.length === 0) ||
    (filtro === 'factura' && facturasFiltradas.length === 0) ||
    (filtro !== 'presupuesto' && filtro !== 'factura' && presupuestosFiltrados.length === 0 && facturasFiltradas.length === 0);

  container.innerHTML = `
    <div class="section-header">
      <h2><i class="fas fa-file-invoice-dollar"></i> Presupuestos y Facturas — ${mascota}</h2>
      <div>
        ${!bloqueado ? `
          <button class="btn btn-primary" style="margin-right:8px;"
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

    ${sinResultados && filtro !== 'todos'
      ? `<div class="empty-state"><i class="fas fa-file-invoice"></i><p>No hay documentos en este filtro</p></div>`
      : seccionesHtml}
  `;
};

InternamientoModule.prototype._pfSetFiltro = function (key) {
  this._pfFiltroActivo = key;
  this.loadPresupuestosFacturasView();
};

InternamientoModule.prototype._renderDocumentoFinancieroRow = function (d, index, bloqueado, showTipoColumn) {
  const fecha = d.fechaCreacion ? this.formatFechaHora12(d.fechaCreacion) : '—';
  const estado = d.estado || 'pendiente';
  const estadoColors = {
    pagado: { bg: '#e8f5e9', color: '#2e7d32' },
    anulado: { bg: '#ffebee', color: '#c62828' },
    aprobado: { bg: '#e3f2fd', color: '#1565c0' },
    pendiente: { bg: '#fff3e0', color: '#e65100' }
  };
  const ec = estadoColors[estado] || estadoColors.pendiente;
  const tipoLabel = d.tipo === 'presupuesto' ? 'Presupuesto' : 'Factura';
  const tipoBg = d.tipo === 'presupuesto' ? '#0d9488' : '#1565c0';
  const docId = String(d.docId || '').replace(/'/g, "\\'");
  const desc = (d.descripcion || '').replace(/</g, '&lt;');
  const ref = (d.numeroReferencia || '').replace(/</g, '&lt;');
  const obs = (d.observaciones || '').replace(/</g, '&lt;');
  const tieneArchivo = d.archivo && (d.archivo.downloadUrl || d.archivo.storagePath);
  const legacy = d._legacy;

  let archivoCell = '<span style="color:#94a3b8;font-size:0.85rem;">Sin archivo</span>';
  if (tieneArchivo) {
    archivoCell = `
      <button type="button" class="btn btn-sm pf-btn-preview" title="Vista previa"
        onclick="window.internamientoModule.previewDocumentoFinanciero('${docId}')">
        <i class="fas fa-eye"></i>
      </button>
      <button type="button" class="btn btn-sm pf-btn-download" title="Descargar"
        onclick="window.internamientoModule.downloadDocumentoFinanciero('${docId}')">
        <i class="fas fa-download"></i>
      </button>`;
  }

  let acciones = '';
  if (!bloqueado && !legacy) {
    acciones = `<td class="pf-actions-cell">
      ${estado === 'pendiente' && d.tipo === 'presupuesto'
        ? `<button class="btn btn-sm btn-success" onclick="window.internamientoModule.marcarDocumentoAprobado('${docId}')"><i class="fas fa-check"></i></button>`
        : ''}
      ${estado === 'pendiente' || estado === 'aprobado'
        ? `<button class="btn btn-sm btn-success" onclick="window.internamientoModule.marcarDocumentoPagado('${docId}')"><i class="fas fa-dollar-sign"></i></button>`
        : ''}
      ${estado !== 'anulado'
        ? `<button class="btn btn-sm" style="background:#c62828;color:white;" onclick="window.internamientoModule.anularDocumentoFinanciero('${docId}')"><i class="fas fa-ban"></i></button>`
        : ''}
    </td>`;
  } else if (!bloqueado && legacy) {
    acciones = `<td class="pf-actions-cell">
      ${d.estado === 'pendiente'
        ? `<button class="btn btn-sm btn-success" onclick="window.internamientoModule.marcarFacturaPagada('${docId}')"><i class="fas fa-check"></i></button>`
        : ''}
      ${d.estado !== 'anulado'
        ? `<button class="btn btn-sm" style="background:#c62828;color:white;" onclick="window.internamientoModule.anularFactura('${docId}')"><i class="fas fa-ban"></i></button>`
        : ''}
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

InternamientoModule.prototype._pfTieneDocumentoConArchivo = function (internamiento, tipo) {
  const docs = Object.values(internamiento.documentos_financieros || {});
  return docs.some(
    (d) => d.tipo === tipo && d.archivo?.downloadUrl && d.estado !== 'anulado'
  );
};

InternamientoModule.prototype._pfInitPendingUploads = function () {
  this._pfPendingUploads = { presupuesto: null, factura: null };
  this._pfPreviewUrls = { presupuesto: null, factura: null };
};

InternamientoModule.prototype._pfRevokePreviewUrls = function () {
  if (!this._pfPreviewUrls) return;
  Object.values(this._pfPreviewUrls).forEach((url) => {
    if (url) URL.revokeObjectURL(url);
  });
  this._pfPreviewUrls = { presupuesto: null, factura: null };
};

InternamientoModule.prototype._pfSyncArchivoLayout = function () {
  const wrapPres = document.getElementById('pfArchivoWrapPresupuesto');
  const wrapFact = document.getElementById('pfArchivoWrapFactura');
  if (!wrapPres || !wrapFact) return;

  const hasPres = this._pfPendingUploads?.presupuesto?.blob;
  const hasFact = this._pfPendingUploads?.factura?.blob;
  const presInput = document.getElementById('pfArchivoPresupuesto');
  const factInput = document.getElementById('pfArchivoFactura');
  const presPending = hasPres || (presInput && presInput.files && presInput.files.length > 0);
  const factPending = hasFact || (factInput && factInput.files && factInput.files.length > 0);

  wrapPres.classList.toggle('hidden', !this._pfShowPresupuesto);
  wrapFact.classList.toggle('hidden', !this._pfShowFactura);

  if (this._pfShowPresupuesto && this._pfShowFactura) {
    if (presPending && !factPending) {
      wrapFact.classList.add('hidden');
      wrapPres.classList.add('pf-archivo-slot-full');
    } else if (factPending && !presPending) {
      wrapPres.classList.add('hidden');
      wrapFact.classList.add('pf-archivo-slot-full');
    } else {
      wrapPres.classList.remove('pf-archivo-slot-full');
      wrapFact.classList.remove('pf-archivo-slot-full');
    }
  } else {
    wrapPres.classList.add('pf-archivo-slot-full');
    wrapFact.classList.add('pf-archivo-slot-full');
  }
};

InternamientoModule.prototype._pfUpdateSubmitState = function (submitBtn) {
  if (!submitBtn) return;
  const hasReady =
    this._pfPendingUploads?.presupuesto?.blob || this._pfPendingUploads?.factura?.blob;
  const desc = document.getElementById('pfDescripcion');
  submitBtn.disabled = !hasReady || !desc || !desc.value.trim();
};

InternamientoModule.prototype.abrirModalDocumentoFinanciero = async function () {
  if (!this.currentInternamientoId) return;

  const internamiento = this.internamientos.get(this.currentInternamientoId);
  if (!internamiento) return;

  this._pfShowPresupuesto = !this._pfTieneDocumentoConArchivo(internamiento, 'presupuesto');
  this._pfShowFactura = !this._pfTieneDocumentoConArchivo(internamiento, 'factura');
  this._pfInitPendingUploads();
  this._pfModalCodigo = null;

  if (!this._pfShowPresupuesto && !this._pfShowFactura) {
    this.showNotification(
      'Este expediente ya tiene presupuesto y factura con archivo. Anule uno si necesita reemplazarlo.',
      'info'
    );
    return;
  }

  const archivoPresHtml = this._pfShowPresupuesto
    ? `
      <div class="pf-archivo-slot pf-archivo-slot-presupuesto" id="pfArchivoWrapPresupuesto">
        <label for="pfArchivoPresupuesto">Presupuesto</label>
        <input type="file" id="pfArchivoPresupuesto" accept=".pdf,image/jpeg,image/png,image/webp" class="pf-input pf-file-input">
        <div id="pfStatusPresupuesto" class="pf-archivo-status hidden"></div>
        <div id="pfPreviewWrapPresupuesto" class="pf-preview-wrap pf-preview-wrap-sm hidden">
          <div class="pf-preview-header"><span><i class="fas fa-eye"></i> Vista previa</span></div>
          <div id="pfPreviewContentPresupuesto" class="pf-preview-content"></div>
        </div>
      </div>`
    : '';

  const archivoFactHtml = this._pfShowFactura
    ? `
      <div class="pf-archivo-slot pf-archivo-slot-factura" id="pfArchivoWrapFactura">
        <label for="pfArchivoFactura">Factura</label>
        <input type="file" id="pfArchivoFactura" accept=".pdf,image/jpeg,image/png,image/webp" class="pf-input pf-file-input">
        <div id="pfStatusFactura" class="pf-archivo-status hidden"></div>
        <div id="pfPreviewWrapFactura" class="pf-preview-wrap pf-preview-wrap-sm hidden">
          <div class="pf-preview-header"><span><i class="fas fa-eye"></i> Vista previa</span></div>
          <div id="pfPreviewContentFactura" class="pf-preview-content"></div>
        </div>
      </div>`
    : '';

  const duoClass =
    this._pfShowPresupuesto && this._pfShowFactura ? 'pf-archivo-duo' : 'pf-archivo-duo pf-archivo-duo-single';

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
        <small class="pf-hint">Seleccione presupuesto, factura o ambos. Si solo adjunta uno, se guardará únicamente ese documento.</small>
      </div>
      <div class="pf-form-actions">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
        <button type="submit" id="pfSubmitBtn" class="btn btn-primary" disabled>
          <i class="fas fa-cloud-upload-alt"></i> Guardar
        </button>
      </div>
    </form>`;

  const modal = this.createModal('Agregar documento', html, 'fa-file-invoice-dollar');
  document.body.appendChild(modal);

  const submitBtn = document.getElementById('pfSubmitBtn');
  const descInput = document.getElementById('pfDescripcion');

  const bindFile = (inputId, tipo) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('change', () => {
      this._pfHandleArchivoSeleccionadoTipo(input.files[0], tipo, submitBtn);
    });
  };

  bindFile('pfArchivoPresupuesto', 'presupuesto');
  bindFile('pfArchivoFactura', 'factura');

  if (descInput) {
    descInput.addEventListener('input', () => this._pfUpdateSubmitState(submitBtn));
  }

  this._pfSyncArchivoLayout();

  document.getElementById('formDocumentoFinanciero').onsubmit = (e) => {
    e.preventDefault();
    this.guardarDocumentoFinanciero(submitBtn);
  };
};

InternamientoModule.prototype._pfHandleArchivoSeleccionadoTipo = async function (file, tipo, submitBtn) {
  const statusId = tipo === 'presupuesto' ? 'pfStatusPresupuesto' : 'pfStatusFactura';
  const previewWrapId = tipo === 'presupuesto' ? 'pfPreviewWrapPresupuesto' : 'pfPreviewWrapFactura';
  const previewContentId =
    tipo === 'presupuesto' ? 'pfPreviewContentPresupuesto' : 'pfPreviewContentFactura';

  const statusEl = document.getElementById(statusId);
  const previewWrap = document.getElementById(previewWrapId);
  const previewContent = document.getElementById(previewContentId);

  if (!this._pfPendingUploads) this._pfInitPendingUploads();

  if (!file) {
    this._pfPendingUploads[tipo] = null;
    if (this._pfPreviewUrls?.[tipo]) {
      URL.revokeObjectURL(this._pfPreviewUrls[tipo]);
      this._pfPreviewUrls[tipo] = null;
    }
    if (previewWrap) previewWrap.classList.add('hidden');
    if (statusEl) statusEl.classList.add('hidden');
    this._pfSyncArchivoLayout();
    this._pfUpdateSubmitState(submitBtn);
    return;
  }

  if (!window.InternamientoDocumentoCompress) {
    this.showAlert('Módulo de compresión no cargado. Recargue la página.', 'Error', 'error');
    return;
  }

  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando…';
  }

  try {
    const result = await window.InternamientoDocumentoCompress.compressDocumentFile(file);
    this._pfPendingUploads[tipo] = {
      blob: result.blob,
      fileName: result.fileName,
      mimeType: result.mimeType,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize
    };

    if (statusEl) {
      statusEl.innerHTML = '<i class="fas fa-check-circle" style="color:#2e7d32;"></i> Listo';
    }

    if (previewWrap && previewContent) {
      previewWrap.classList.remove('hidden');
      if (this._pfPreviewUrls[tipo]) URL.revokeObjectURL(this._pfPreviewUrls[tipo]);
      const previewUrl = URL.createObjectURL(result.blob);
      this._pfPreviewUrls[tipo] = previewUrl;

      if (result.mimeType === 'application/pdf') {
        previewContent.innerHTML = `<iframe src="${previewUrl}" title="Vista previa PDF"></iframe>`;
      } else {
        previewContent.innerHTML = `<img src="${previewUrl}" alt="Vista previa" />`;
      }
    }

    this._pfSyncArchivoLayout();
    this._pfUpdateSubmitState(submitBtn);
  } catch (err) {
    console.error('Error preparando archivo:', err);
    this._pfPendingUploads[tipo] = null;
    if (statusEl) {
      statusEl.innerHTML = `<i class="fas fa-exclamation-circle" style="color:#c62828;"></i> ${err.message || err}`;
    }
    if (previewWrap) previewWrap.classList.add('hidden');
    this._pfSyncArchivoLayout();
    this._pfUpdateSubmitState(submitBtn);
  }
};

InternamientoModule.prototype._getStorageRef = function () {
  if (!firebase.storage) {
    throw new Error('Firebase Storage no está disponible. Recargue la página.');
  }
  return firebase.storage();
};

InternamientoModule.prototype.guardarDocumentoFinanciero = async function (submitBtn) {
  const pendientes = [];
  if (this._pfPendingUploads?.presupuesto?.blob) pendientes.push('presupuesto');
  if (this._pfPendingUploads?.factura?.blob) pendientes.push('factura');

  if (pendientes.length === 0) {
    this.showNotification('Seleccione al menos un archivo y espere a que esté listo.', 'warning');
    return;
  }

  const accion =
    pendientes.includes('factura') ? 'crear_factura_archivo' : 'crear_presupuesto';

  if (!this._pfModalCodigo) {
    const resultadoCodigo = await this.verificarCodigoAsistente(accion);
    if (!resultadoCodigo.valido || resultadoCodigo.cancelado) {
      this.showNotification('Operación cancelada', 'info');
      return;
    }
    this._pfModalCodigo = resultadoCodigo;
  }

  const codigo = this._pfModalCodigo;
  const descripcion = document.getElementById('pfDescripcion').value.trim();
  const referencia = document.getElementById('pfReferencia').value.trim();
  const observaciones = document.getElementById('pfObservaciones').value.trim();

  if (!descripcion) return;

  const internamientoId = this.currentInternamientoId;
  const originalHtml = submitBtn ? submitBtn.innerHTML : '';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo…';
  }

  try {
    const guardados = [];

    for (const tipo of pendientes) {
      const meta = this._pfPendingUploads[tipo];
      const docId = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const safeName = meta.fileName.replace(/[/\\?%*:|"<>]/g, '_');
      const storageFolder = tipo === 'presupuesto' ? 'presupuestos' : 'facturas';
      const storagePath = `internamientos/${internamientoId}/${storageFolder}/${docId}/${safeName}`;

      const storageRef = this._getStorageRef().ref(storagePath);
      await storageRef.put(meta.blob, {
        contentType: meta.mimeType,
        customMetadata: {
          tipo,
          descripcion: descripcion.substring(0, 200),
          internamientoId
        }
      });

      const downloadUrl = await storageRef.getDownloadURL();

      const registro = {
        docId,
        tipo,
        descripcion,
        estado: 'pendiente',
        numeroReferencia: referencia || null,
        observaciones: observaciones || null,
        fechaCreacion: Date.now(),
        creadoPor: codigo?.assistantId || null,
        creadoNombre: codigo?.nombre || '',
        archivo: {
          storagePath,
          downloadUrl,
          fileName: safeName,
          mimeType: meta.mimeType,
          sizeBytes: meta.compressedSize,
          originalSizeBytes: meta.originalSize,
          uploadedAt: Date.now()
        }
      };

      await this.internamientosRef
        .child(internamientoId)
        .child(`documentos_financieros/${docId}`)
        .set(registro);

      const internamiento = this.internamientos.get(internamientoId);
      if (internamiento) {
        internamiento.documentos_financieros = internamiento.documentos_financieros || {};
        internamiento.documentos_financieros[docId] = registro;
      }

      guardados.push(tipo === 'presupuesto' ? 'Presupuesto' : 'Factura');
    }

    this._pfRevokePreviewUrls();
    document.querySelector('.modal-overlay')?.remove();
    this.showNotification(
      guardados.join(' y ') + ' guardado(s) por ' + codigo?.nombre,
      'success'
    );
    this.loadPresupuestosFacturasView();
  } catch (err) {
    console.error('Error guardando documento:', err);
    this.showAlert('Error al guardar: ' + (err.message || err), 'Error', 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  }
};

InternamientoModule.prototype._getDocumentoFinancieroById = function (docId) {
  const internamiento = this.internamientos.get(this.currentInternamientoId);
  if (!internamiento) return null;
  const doc = internamiento.documentos_financieros?.[docId];
  if (doc) return doc;
  const legacy = internamiento.facturas?.[docId];
  if (legacy) {
    return {
      docId: legacy.facturaId,
      tipo: 'factura',
      descripcion: legacy.descripcion,
      archivo: null,
      _legacy: true
    };
  }
  return null;
};

InternamientoModule.prototype.previewDocumentoFinanciero = async function (docId) {
  const doc = this._getDocumentoFinancieroById(docId);
  if (!doc) {
    this.showNotification('Documento no encontrado', 'error');
    return;
  }
  if (!doc.archivo?.downloadUrl) {
    this.showNotification('Este registro no tiene archivo adjunto', 'warning');
    return;
  }

  let url = doc.archivo.downloadUrl;
  try {
    const storageRef = this._getStorageRef().ref(doc.archivo.storagePath);
    url = await storageRef.getDownloadURL();
  } catch (_) {
    /* usar URL guardada */
  }

  const mime = doc.archivo.mimeType || 'application/pdf';
  const titulo = (doc.tipo === 'presupuesto' ? 'Presupuesto' : 'Factura') + ' — ' + (doc.descripcion || '');
  let previewHtml = '';

  if (mime === 'application/pdf') {
    previewHtml = `<iframe src="${url}" title="Vista previa" class="pf-preview-iframe-full"></iframe>`;
  } else {
    previewHtml = `<img src="${url}" alt="Vista previa" class="pf-preview-img-full" />`;
  }

  const html = `
    <div class="pf-preview-modal-body">
      ${previewHtml}
      <div class="pf-preview-modal-actions">
        <button type="button" class="btn btn-primary"
          onclick="window.internamientoModule.downloadDocumentoFinanciero('${String(docId).replace(/'/g, "\\'")}')">
          <i class="fas fa-download"></i> Descargar
        </button>
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
          Cerrar
        </button>
      </div>
    </div>`;

  const modal = this.createModal(titulo, html, 'fa-eye');
  document.body.appendChild(modal);
};

InternamientoModule.prototype.downloadDocumentoFinanciero = async function (docId) {
  const doc = this._getDocumentoFinancieroById(docId);
  if (!doc?.archivo?.downloadUrl) {
    this.showNotification('Sin archivo para descargar', 'warning');
    return;
  }

  let url = doc.archivo.downloadUrl;
  try {
    const storageRef = this._getStorageRef().ref(doc.archivo.storagePath);
    url = await storageRef.getDownloadURL();
  } catch (_) {}

  const fileName = doc.archivo.fileName || 'documento.pdf';

  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
  } catch (err) {
    window.open(url, '_blank', 'noopener');
  }
};

InternamientoModule.prototype.marcarDocumentoPagado = async function (docId) {
  const ok = await this.showConfirm('¿Marcar como pagado?', 'Confirmar pago', {
    confirmText: 'Sí, pagado',
    cancelText: 'Cancelar',
    icon: 'fa-check-circle',
    iconColor: '#2e7d32'
  });
  if (!ok) return;
  const resultadoCodigo = await this.verificarCodigoAsistente('factura_pago');
  if (!resultadoCodigo.valido || resultadoCodigo.cancelado) return;
  try {
    await this.internamientosRef
      .child(this.currentInternamientoId)
      .child(`documentos_financieros/${docId}`)
      .update({
        estado: 'pagado',
        fechaPago: Date.now(),
        pagadoPorNombre: resultadoCodigo.nombre
      });
    const int = this.internamientos.get(this.currentInternamientoId);
    if (int?.documentos_financieros?.[docId]) {
      int.documentos_financieros[docId].estado = 'pagado';
    }
    this.showNotification('Marcado como pagado', 'success');
    this.loadPresupuestosFacturasView();
  } catch (e) {
    this.showAlert('Error: ' + e.message, 'Error', 'error');
  }
};

InternamientoModule.prototype.marcarDocumentoAprobado = async function (docId) {
  const resultadoCodigo = await this.verificarCodigoAsistente('aprobar_presupuesto');
  if (!resultadoCodigo.valido || resultadoCodigo.cancelado) return;
  try {
    await this.internamientosRef
      .child(this.currentInternamientoId)
      .child(`documentos_financieros/${docId}`)
      .update({
        estado: 'aprobado',
        fechaAprobacion: Date.now(),
        aprobadoPorNombre: resultadoCodigo.nombre
      });
    const int = this.internamientos.get(this.currentInternamientoId);
    if (int?.documentos_financieros?.[docId]) {
      int.documentos_financieros[docId].estado = 'aprobado';
    }
    this.showNotification('Presupuesto aprobado', 'success');
    this.loadPresupuestosFacturasView();
  } catch (e) {
    this.showAlert('Error: ' + e.message, 'Error', 'error');
  }
};

InternamientoModule.prototype.anularDocumentoFinanciero = async function (docId) {
  const ok = await this.showConfirm('¿Anular este documento?', 'Anular', {
    confirmText: 'Anular',
    cancelText: 'Cancelar',
    icon: 'fa-ban',
    iconColor: '#c62828'
  });
  if (!ok) return;
  const resultadoCodigo = await this.verificarCodigoAsistente('anular_factura');
  if (!resultadoCodigo.valido || resultadoCodigo.cancelado) return;
  try {
    await this.internamientosRef
      .child(this.currentInternamientoId)
      .child(`documentos_financieros/${docId}`)
      .update({
        estado: 'anulado',
        fechaAnulacion: Date.now(),
        anuladoPorNombre: resultadoCodigo.nombre
      });
    const int = this.internamientos.get(this.currentInternamientoId);
    if (int?.documentos_financieros?.[docId]) {
      int.documentos_financieros[docId].estado = 'anulado';
    }
    this.showNotification('Documento anulado', 'success');
    this.loadPresupuestosFacturasView();
  } catch (e) {
    this.showAlert('Error: ' + e.message, 'Error', 'error');
  }
};
