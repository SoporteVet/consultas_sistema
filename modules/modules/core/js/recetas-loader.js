/**
 * Carga bajo demanda del módulo de recetas (solo al pulsar "Receta" en un ticket).
 */
(function () {
  'use strict';

  let modulesPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-receta-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Error cargando ' + src)));
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.dataset.recetaSrc = src;
      s.onload = () => {
        s.dataset.loaded = '1';
        resolve();
      };
      s.onerror = () => reject(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  function loadRecetaModules() {
    if (window.openRecetaModal && window.RecetasPDF && window.closeRecetaModal) {
      return Promise.resolve();
    }
    if (!modulesPromise) {
      modulesPromise = Promise.all([
        loadScript('modules/core/js/recetas-module.js'),
        loadScript('modules/core/js/recetas-pdf.js')
      ]).then(() => {
        if (typeof window.openRecetaModal !== 'function') {
          throw new Error('Módulo de recetas no inicializó correctamente.');
        }
      });
    }
    return modulesPromise;
  }

  window.openRecetaForTicket = async function (randomId) {
    if (!randomId) return;
    try {
      await loadRecetaModules();
      await window.openRecetaModal(randomId);
    } catch (err) {
      console.error('openRecetaForTicket:', err);
      alert('No se pudo abrir la receta: ' + (err.message || err));
    }
  };
})();
