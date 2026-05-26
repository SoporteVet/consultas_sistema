/**
 * Módulo de generación de Recetas Digitales en PDF.
 * Usa html2pdf().from(htmlString).save() — mismo patrón que internamiento-expediente-pdf.js
 *
 * API:  RecetasPDF.generar({ ticket, doctorProfile, recetaPatientData })
 */

window.RecetasPDF = (function () {
  'use strict';

  const NAVY = '#1a237e';

  /* ── helpers ─────────────────────────────────────────────── */

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function assetUrl(rel) {
    try { return new URL(rel, window.location.href).href; } catch (e) { return rel; }
  }

  function formatDDMMYYYY(ds) {
    if (!ds) return '';
    const p = String(ds).split('T')[0];
    const m = p.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : p;
  }

  function formatFilename(ds) {
    if (!ds) {
      const d = new Date(), pad = n => String(n).padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()}`;
    }
    const p = String(ds).split('T')[0];
    const m = p.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : p;
  }

  function safeName(v) {
    return String(v || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  }

  function pesoLabel(p) {
    if (p === '' || p == null) return '';
    const s = String(p).trim();
    if (!s) return '';
    if (/(kg|kgs|lb|libras?)/i.test(s)) return s;
    if (/^[\d.,]+$/.test(s)) return `${s} kg`;
    return s;
  }

  /* ── receta body (sin separadores de fecha) ──────────────── */

  function buildRecetaBody(text) {
    if (!text) return '';
    const blocks = [];
    let cur = '';
    for (const line of String(text).split('\n')) {
      if (/^---\s.*\s---$/.test(line)) {
        const t = cur.trim(); if (t) blocks.push(t); cur = '';
      } else {
        cur += (cur ? '\n' : '') + line;
      }
    }
    const t = cur.trim(); if (t) blocks.push(t);
    const joined = blocks.join('\n\n');
    return joined ? esc(joined).replace(/\n/g, '<br>') : '';
  }

  /* ── CSS (todo inline en <style> para que html2pdf lo procese) ── */

  function buildCSS() {
    return `<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: ${NAVY}; background: #fff; }
.page {
  width: 100%;
  max-width: 720px;
  padding: 14px 20px 28px 20px;
  background: #fff;
  overflow: visible;
}
.sheet-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.sheet-table td { vertical-align: top; }
/* ── encabezado (logo | doctor | paciente) ── */
.hdr { width: 100%; border-collapse: collapse; }
.hdr td { vertical-align: middle; }
.col-logo {
  width: 30%;
  padding-right: 12px;
  border-right: 2px solid ${NAVY};
  background: #fff;
  vertical-align: middle;
}
.col-logo img {
  width: auto;
  max-width: 195px;
  max-height: 58px;
  height: auto;
  display: block;
  background: #fff;
  object-fit: contain;
}
.col-doctor { width: 35%; padding: 0 12px; vertical-align: top; }
.col-patient { width: 35%; padding-left: 4px; vertical-align: top; }
.fg { width: 100%; border-collapse: collapse; }
.fg td { padding: 6px 0; font-size: 12px; vertical-align: bottom; }
.fg .lbl {
  font-weight: 700;
  white-space: nowrap;
  padding-right: 8px;
  color: ${NAVY};
  width: 1%;
}
.fg .val {
  border-bottom: 1px solid ${NAVY};
  color: #111;
  padding: 0 6px 4px 4px;
  width: 99%;
  min-height: 18px;
}
.fg .val-firma { min-height: 40px; vertical-align: bottom; }
.firma-img { max-height: 34px; max-width: 150px; vertical-align: bottom; display: block; }
/* Línea gruesa bajo el encabezado (como plantilla impresa) */
.header-rule {
  width: 100%;
  height: 0;
  border: none;
  border-top: 3px solid ${NAVY};
  margin: 10px 0 12px 0;
}
/* ── cuerpo receta ── */
.rx-label {
  font-size: 14px;
  font-weight: 700;
  font-style: italic;
  color: ${NAVY};
  margin: 0 0 10px 0;
}
.rx-text {
  font-size: 12.5px;
  line-height: 1.65;
  color: ${NAVY};
  min-height: 180px;
  padding-bottom: 12px;
}
/* ── pie (banner receta-footer-smp.png) ── */
.footer-cell {
  padding-top: 28px;
  padding-bottom: 8px;
  vertical-align: top;
  overflow: visible;
}
.footer-note {
  text-align: left;
  font-weight: 700;
  font-size: 13px;
  color: ${NAVY};
  margin: 0 0 6px 0;
  padding-left: 0;
}
.footer-img-wrap {
  width: 100%;
  line-height: 0;
  overflow: visible;
}
.footer-img {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  max-height: none !important;
  display: block !important;
  border: 0;
  visibility: visible !important;
  opacity: 1 !important;
  object-fit: contain;
}
.footer-safe-spacer {
  display: block;
  width: 100%;
  height: 40px;
  clear: both;
}
</style>`;
  }

  const LOGO_ASSET = 'img/LOGO VETE HORIZONTAL.png';
  const FOOTER_ASSET = 'img/receta-footer-smp.png';

  /* ── HTML completo del documento ─────────────────────────── */

  function buildDocument({ patient, doctor, recetaBodyHTML, logoDataUrl, footerDataUrl, footerSize }) {
    const fecha = formatDDMMYYYY(patient.fechaConsulta) || formatDDMMYYYY(new Date().toISOString());
    const peso  = pesoLabel(patient.peso);
    const logo = logoDataUrl || assetUrl(LOGO_ASSET);
    if (!footerDataUrl || !String(footerDataUrl).startsWith('data:')) {
      throw new Error('No se cargó la imagen del pie de página (receta-footer-smp.png).');
    }
    const firmaHtml = doctor.firma
      ? `<img src="${doctor.firma}" class="firma-img" alt="" />`
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8">${buildCSS()}</head>
<body>
<div class="page">
  <table class="sheet-table" role="presentation">
    <tr>
      <td colspan="3">
        <table class="hdr" role="presentation">
          <tr>
            <td class="col-logo">
              <img src="${logo}" alt="Veterinaria San Martín de Porres" />
            </td>
            <td class="col-doctor">
              <table class="fg" role="presentation">
                <tr><td class="lbl">Dr./Dra.</td><td class="val">${esc(doctor.name || '')}</td></tr>
                <tr><td class="lbl">CMV:</td><td class="val">${esc(doctor.cmv || '')}</td></tr>
                <tr><td class="lbl">Firma:</td><td class="val val-firma">${firmaHtml}</td></tr>
              </table>
            </td>
            <td class="col-patient">
              <table class="fg" role="presentation">
                <tr><td class="lbl">FECHA:</td><td class="val">${esc(fecha)}</td></tr>
                <tr><td class="lbl">PACIENTE:</td><td class="val">${esc(patient.mascota || '')}</td></tr>
                <tr><td class="lbl">PESO:</td><td class="val">${esc(peso)}</td></tr>
                <tr><td class="lbl">DUEÑO:</td><td class="val">${esc(patient.nombre || '')}</td></tr>
              </table>
            </td>
          </tr>
        </table>
        <hr class="header-rule" />
      </td>
    </tr>
    <tr>
      <td colspan="3">
        <div class="rx-label">RECETA:</div>
        <div class="rx-text">${recetaBodyHTML || '&nbsp;'}</div>
      </td>
    </tr>
    <tr>
      <td colspan="3" class="footer-cell">
        <div class="footer-note">Revaloraciones antes de las 7:30 p.m.</div>
        <div class="footer-img-wrap">
          <img src="${footerDataUrl}" class="footer-img" alt="Contacto Veterinaria San Martín de Porres" />
        </div>
        <div class="footer-safe-spacer" aria-hidden="true"></div>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`;
  }

  /* ── carga de html2pdf ───────────────────────────────────── */

  let html2pdfPromise = null;

  function ensureHtml2Pdf() {
    if (typeof html2pdf === 'function') return Promise.resolve();
    if (html2pdfPromise) return html2pdfPromise;
    html2pdfPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
      s.onload = () => { html2pdfPromise = null; resolve(); };
      s.onerror = () => reject(new Error('No se pudo cargar html2pdf.js'));
      document.head.appendChild(s);
    });
    return html2pdfPromise;
  }

  /* ── precarga de imágenes como data-URL ─────────────────── */

  let cachedAssets = null;

  /** Quita fondo negro del logo (píxeles casi negros → blanco). */
  function stripBlackBackground(ctx, canvas) {
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 18 && d[i + 1] < 18 && d[i + 2] < 18) {
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function imageToDataUrl(img, stripBlack) {
    const w = img.naturalWidth || img.width || 1;
    const h = img.naturalHeight || img.height || 1;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (stripBlack) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    if (stripBlack) stripBlackBackground(ctx, canvas);
    return { dataUrl: canvas.toDataURL('image/png'), width: w, height: h };
  }

  function loadImageAsset(relativePath, stripBlack) {
    const absolute = assetUrl(relativePath);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          resolve(imageToDataUrl(img, stripBlack));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        fetch(absolute)
          .then((r) => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.blob();
          })
          .then((blob) => blobToDataUrl(blob))
          .then((dataUrl) => resolve({ dataUrl, width: 700, height: stripBlack ? 58 : 45 }))
          .catch(() => reject(new Error('No se pudo cargar: ' + relativePath)));
      };
      img.src = absolute;
    });
  }

  async function preloadAssets() {
    if (cachedAssets) return cachedAssets;
    let logoPack;
    try {
      logoPack = await loadImageAsset(LOGO_ASSET, true);
    } catch (e1) {
      logoPack = await loadImageAsset('img/logo-vete-horizontal.png', true);
    }
    const footerPack = await loadImageAsset(FOOTER_ASSET, false);
    if (!footerPack || !footerPack.dataUrl || !footerPack.dataUrl.startsWith('data:')) {
      throw new Error(
        'No se pudo cargar img/receta-footer-smp.png. Coloque el archivo en la carpeta img/ y recargue (F5).'
      );
    }
    if ((footerPack.width || 0) < 20 || (footerPack.height || 0) < 8) {
      throw new Error('La imagen receta-footer-smp.png parece dañada o vacía.');
    }
    cachedAssets = {
      logo: logoPack.dataUrl,
      footer: footerPack.dataUrl,
      footerSize: { width: footerPack.width, height: footerPack.height }
    };
    return cachedAssets;
  }

  /* ── API pública ─────────────────────────────────────────── */

  async function generar({ ticket, doctorProfile, recetaPatientData }) {
    if (!ticket)           throw new Error('Ticket requerido.');
    if (!recetaPatientData) throw new Error('Datos del paciente requeridos.');
    if (!doctorProfile)    throw new Error('Perfil del doctor requerido.');

    await ensureHtml2Pdf();
    clearAssetCache();
    const assets = await preloadAssets();

    const mascota  = safeName(recetaPatientData.mascota || ticket.mascota || 'Mascota');
    const nombre   = recetaPatientData.nombre || ticket.nombre || '';
    const apellido = typeof window.extractApellidoCliente === 'function'
      ? window.extractApellidoCliente(nombre)
      : nombre.trim().split(/\s+/).pop() || 'Cliente';
    const fileName = `Receta_${mascota}_${safeName(apellido)}_${safeName(formatFilename(recetaPatientData.fechaConsulta))}.pdf`;

    const html = buildDocument({
      patient: recetaPatientData,
      doctor: doctorProfile,
      recetaBodyHTML: buildRecetaBody(ticket.receta),
      logoDataUrl: assets.logo,
      footerDataUrl: assets.footer,
      footerSize: assets.footerSize
    });

    const opt = {
      margin:     [8, 8, 18, 8],
      filename:   fileName,
      image:      { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollY: 0,
        scrollX: 0,
        windowHeight: 1200,
        onclone: (clonedDoc) => {
          clonedDoc.body.style.overflow = 'visible';
          clonedDoc.body.style.height = 'auto';
          const pageEl = clonedDoc.querySelector('.page');
          if (pageEl) {
            pageEl.style.overflow = 'visible';
            const h = pageEl.scrollHeight || pageEl.offsetHeight;
            clonedDoc.body.style.minHeight = h + 48 + 'px';
          }
          const footImg = clonedDoc.querySelector('.footer-img');
          if (footImg) {
            footImg.style.setProperty('display', 'block', 'important');
            footImg.style.setProperty('width', '100%', 'important');
            footImg.style.setProperty('height', 'auto', 'important');
            footImg.style.setProperty('max-height', 'none', 'important');
            footImg.style.setProperty('visibility', 'visible', 'important');
            footImg.style.setProperty('opacity', '1', 'important');
          }
        }
      },
      jsPDF:      { unit: 'mm', format: 'letter', orientation: 'portrait' },
      pagebreak:  { mode: ['css', 'legacy'] }
    };

    await new Promise((r) => setTimeout(r, 400));
    await html2pdf().set(opt).from(html).save();
    return fileName;
  }

  /** Limpia caché de imágenes (útil tras cambiar archivos en img/). */
  function clearAssetCache() {
    cachedAssets = null;
  }

  return { generar, preloadAssets, clearAssetCache };
})();
