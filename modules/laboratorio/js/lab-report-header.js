(function() {
  const DOCTORS_API = 'https://consulta-7ece8-default-rtdb.firebaseio.com/doctors.json';
  const MEDICO_DATALIST_IDS = ['medicos', 'medicos2', 'medicos3'];

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function getDoctorNameFromRaw(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.name) return value.name;
    return '';
  }

  async function loadDoctorsIntoLabDatalists() {
    const hasDatalist = MEDICO_DATALIST_IDS.some((id) => document.getElementById(id));
    if (!hasDatalist) return;

    try {
      const response = await fetch(DOCTORS_API);
      if (!response.ok) return;
      const doctors = await response.json();
      if (!doctors) return;

      const names = Object.values(doctors)
        .map(getDoctorNameFromRaw)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      MEDICO_DATALIST_IDS.forEach((datalistId) => {
        const datalist = document.getElementById(datalistId);
        if (!datalist) return;

        datalist.innerHTML = '';
        const naOption = document.createElement('option');
        naOption.value = 'N.A';
        datalist.appendChild(naOption);

        names.forEach((name) => {
          const option = document.createElement('option');
          option.value = name;
          datalist.appendChild(option);
        });
      });
    } catch (error) {
      console.warn('No se pudieron cargar médicos desde Firebase en plantilla de lab:', error);
    }
  }

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

  ready(function() {
    injectPatientId();
    loadDoctorsIntoLabDatalists();
  });
})();
