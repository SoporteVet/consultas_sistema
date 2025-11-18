(function() {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function injectPatientId() {
    const params = new URLSearchParams(window.location.search);
    const patientId = (params.get('idPaciente') || '').trim();
    const headers = document.querySelectorAll('.container .header');

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

  ready(injectPatientId);
})();
