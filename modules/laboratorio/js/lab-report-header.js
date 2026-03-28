(function() {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  // ── Inyectar badge de ID de paciente ──────────────────────────────────────
  function injectPatientId() {
    const params = new URLSearchParams(window.location.search);
    const patientId = (params.get('idPaciente') || '').trim();
    const headers = document.querySelectorAll('.container .header, #datosBasicos .header');

    headers.forEach((header, index) => {
      if (!header) return;
      const title = header.querySelector('h1');
      if (!title) return;
      title.classList.add('header-title');

      let badge = header.querySelector('.patient-id-badge');
      let input = badge?.querySelector('.patient-id-input');

      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'patient-id-badge';
        const label = document.createElement('span');
        label.textContent = 'ID:';
        badge.appendChild(label);
        input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'ID del paciente';
        input.className = 'patient-id-input';
        badge.appendChild(input);
        header.appendChild(badge);
      }

      if (input) {
        input.value = patientId;
        if (!input.id) input.id = `patientIdHeader-${index}`;
      }

      const logo = header.querySelector('img');
      if (logo && header.firstElementChild !== logo) {
        header.insertBefore(logo, header.firstElementChild);
      }
    });
  }

  // ── Autollenado dinámico desde URL ────────────────────────────────────────

  /**
   * Convierte una cadena de edad (ej. "3 años", "5 meses", "2 semanas") a meses.
   * Devuelve NaN si no se puede parsear.
   */
  function ageToMonths(ageStr) {
    if (!ageStr) return NaN;
    const s = String(ageStr).toLowerCase().trim();
    const yM = s.match(/(\d+(?:[.,]\d+)?)\s*a[ñn]os?/);
    const mM = s.match(/(\d+(?:[.,]\d+)?)\s*mes(?:es)?/);
    const wM = s.match(/(\d+(?:[.,]\d+)?)\s*semanas?/);
    const dM = s.match(/(\d+(?:[.,]\d+)?)\s*d[ií]as?/);
    if (yM) return parseFloat(yM[1].replace(',', '.')) * 12;
    if (mM) return parseFloat(mM[1].replace(',', '.'));
    if (wM) return parseFloat(wM[1].replace(',', '.')) / 4.33;
    if (dM) return parseFloat(dM[1].replace(',', '.')) / 30;
    return NaN;
  }

  /**
   * Dado el valor en meses y el <select> de edadSelector, devuelve el value
   * de la opción que mejor corresponde al rango de edad. Funciona con
   * cualquier variante de opciones que usen las plantillas del laboratorio.
   */
  function inferEdadOption(months, selectEl) {
    if (isNaN(months) || !selectEl) return null;
    const options = Array.from(selectEl.options).filter(
      o => o.value && o.value !== 'Seleccionar'
    );

    for (const opt of options) {
      const t = (opt.value + ' ' + opt.text).toLowerCase();
      // ≥ 12 meses → rango de años (el más alto)
      if (months >= 12 && t.includes('año') && /1\s*año/.test(t)) return opt.value;
      // 6 – 11.9 meses
      if (months >= 6 && months < 12 && /6\s*meses/.test(t) && /1\s*año/.test(t)) return opt.value;
      // 3 – 5.9 meses  (opción "3 meses a 6 meses")
      if (months >= 3 && months < 6 && /3\s*meses/.test(t) && /6\s*meses/.test(t)) return opt.value;
      // 1.5 – 5.9 meses (opción "mes y medio a 5 meses")
      if (months >= 1.5 && months < 6 && /mes y medio/.test(t) && !/menor/.test(t)) return opt.value;
      // < 1.5 meses (opción "menor de mes y medio" o "0 mes a 1,5 meses" o "0 meses a mes y medio")
      if (months < 1.5 && (/menor/.test(t) || /0\s*mes/.test(t))) return opt.value;
    }

    // Fallback: "Todas las edades"
    const todas = options.find(o => /todas/.test(o.value.toLowerCase()));
    return todas ? todas.value : null;
  }

  /**
   * Autollenado principal: se ejecuta después de que los listeners
   * DOMContentLoaded de la plantilla hayan corrido (setTimeout 0).
   */
  function autoFillFromUrl() {
    try {
      const p = new URLSearchParams(window.location.search);
      const get = k => (p.get(k) || '').trim();

      const setField = (id, val) => {
        if (!val) return;
        const el = document.getElementById(id);
        if (el) el.value = val;
      };

      // Campos de texto básicos (mascotaRaza se aplica al final: ver nota abajo)
      setField('mascotaNombre',     get('mascotaNombre'));
      setField('mascotaEdad',       get('mascotaEdad'));
      setField('mascotaPeso',       get('mascotaPeso'));
      setField('propietarioNombre', get('propietarioNombre'));
      setField('propietarioCedula', get('propietarioCedula'));
      setField('propietarioTelefono', get('propietarioTelefono'));
      setField('propietarioEmail',  get('propietarioEmail'));
      setField('nombreMedico',      get('nombreMedico'));
      setField('propietarioFecha',  get('propietarioFecha'));

      // Disparar verificarMedico si existe
      const medico = get('nombreMedico');
      if (medico && typeof window.verificarMedico === 'function') {
        setTimeout(() => window.verificarMedico(), 50);
      }

      // ── Selector de especie ──
      // Mapear el tipoMascota del ticket ("perro", "gato"…) al valor del <select>
      const ESPECIE_MAP = {
        perro: 'Canino', canino: 'Canino',
        gato: 'Felino', felino: 'Felino',
        conejo: 'Lagomorfo', lagomorfo: 'Lagomorfo',
        cuilo: 'Cuilo'
      };
      const especieVal = get('especie');
      const especieSelector = document.getElementById('especieSelector');
      if (especieSelector && especieVal) {
        const mapped = ESPECIE_MAP[especieVal.toLowerCase()]
          || (especieVal.charAt(0).toUpperCase() + especieVal.slice(1).toLowerCase());
        especieSelector.value = mapped;
        especieSelector.dispatchEvent(new Event('change'));
      }

      // ── Selector de sexo ──
      const sexoVal = get('mascotaSexo');
      const sexoSelector = document.getElementById('sexoSelector');
      if (sexoSelector && sexoVal) {
        const cap = sexoVal.charAt(0).toUpperCase() + sexoVal.slice(1).toLowerCase();
        sexoSelector.value = cap;
        sexoSelector.dispatchEvent(new Event('change'));
      }

      // ── Selector de rango de edad (inferido automáticamente) ──
      const edadStr = get('mascotaEdad');
      const edadSelector = document.getElementById('edadSelector');
      if (edadSelector && edadStr) {
        const months = ageToMonths(edadStr);
        const bestOption = inferEdadOption(months, edadSelector);
        if (bestOption) {
          edadSelector.value = bestOption;
          edadSelector.dispatchEvent(new Event('change'));
        }
      }

      // Raza al final: actualizarRazasPorEspecie() en las plantillas vacía mascotaRaza
      // al dispararse el change de especie; si rellenamos raza antes, se pierde.
      setField('mascotaRaza', get('mascotaRaza'));
    } catch (e) {
      console.warn('[lab-report-header] autoFillFromUrl error:', e);
    }
  }

  ready(function() {
    injectPatientId();
    // Pequeño retardo para que los DOMContentLoaded de la plantilla registren
    // sus funciones (actualizarValoresReferencia, etc.) antes de disparar eventos
    setTimeout(autoFillFromUrl, 80);
  });
})();
