/**
 * Compresión de PDF e imágenes antes de subir a Firebase Storage.
 * PDF: rasteriza páginas a JPEG (reduce tamaño de escaneos y PDFs pesados).
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    maxWidth: 1100,
    jpegQuality: 0.52,
    maxPages: 40
  };

  function formatBytes(bytes) {
    if (!bytes || bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function ensurePdfJs() {
    const lib = global.pdfjsLib;
    if (!lib) throw new Error('PDF.js no está cargado.');
    if (!lib.GlobalWorkerOptions.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    return lib;
  }

  function ensureJsPdf() {
    if (!global.jspdf || !global.jspdf.jsPDF) {
      throw new Error('jsPDF no está cargado.');
    }
    return global.jspdf.jsPDF;
  }

  async function compressImageFile(file, opts) {
    const maxWidth = opts.maxWidth || DEFAULTS.maxWidth;
    const quality = opts.jpegQuality || DEFAULTS.jpegQuality;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen'))),
        'image/jpeg',
        quality
      );
    });

    const baseName = (file.name || 'imagen').replace(/\.[^.]+$/, '');
    return {
      blob,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      fileName: baseName + '_cmp.jpg'
    };
  }

  async function compressPdfFile(file, opts) {
    const pdfjsLib = ensurePdfJs();
    const jsPDF = ensureJsPdf();
    const maxWidth = opts.maxWidth || DEFAULTS.maxWidth;
    const quality = opts.jpegQuality || DEFAULTS.jpegQuality;
    const maxPages = opts.maxPages || DEFAULTS.maxPages;

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = Math.min(pdfDoc.numPages, maxPages);

    if (pdfDoc.numPages > maxPages) {
      console.warn(
        `PDF con ${pdfDoc.numPages} páginas; se comprimirán las primeras ${maxPages}.`
      );
    }

    let outPdf = null;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(1, maxWidth / viewport.width);
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

      const imgData = canvas.toDataURL('image/jpeg', quality);
      const pageW = outPdf ? outPdf.internal.pageSize.getWidth() : 595.28;
      const pageH = outPdf ? outPdf.internal.pageSize.getHeight() : 841.89;
      const imgH = (scaledViewport.height * pageW) / scaledViewport.width;

      if (!outPdf) {
        outPdf = new jsPDF({
          orientation: imgH > pageW ? 'p' : 'p',
          unit: 'pt',
          format: 'a4'
        });
      } else {
        outPdf.addPage();
      }

      outPdf.addImage(imgData, 'JPEG', 0, 0, pageW, imgH);
    }

    const blob = outPdf.output('blob');
    const baseName = (file.name || 'documento').replace(/\.[^.]+$/, '');
    return {
      blob,
      mimeType: 'application/pdf',
      extension: 'pdf',
      fileName: baseName + '_cmp.pdf'
    };
  }

  async function compressDocumentFile(file, options) {
    if (!file) throw new Error('No hay archivo seleccionado.');
    const opts = { ...DEFAULTS, ...options };
    const originalSize = file.size;
    const type = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();

    let result;
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      result = await compressPdfFile(file, opts);
    } else if (
      type.startsWith('image/') ||
      /\.(jpe?g|png|webp|gif|bmp)$/i.test(name)
    ) {
      result = await compressImageFile(file, opts);
    } else {
      throw new Error('Formato no permitido. Use PDF o imagen (JPG, PNG, WEBP).');
    }

    const compressedSize = result.blob.size;
    return {
      ...result,
      originalSize,
      compressedSize,
      reductionPercent:
        originalSize > 0
          ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
          : 0
    };
  }

  global.InternamientoDocumentoCompress = {
    compressDocumentFile,
    formatBytes,
    DEFAULTS
  };
})(typeof window !== 'undefined' ? window : global);
