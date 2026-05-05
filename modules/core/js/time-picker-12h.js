/**
 * Time picker en formato 12 horas (AM/PM) para todo el sistema.
 * Reemplaza inputs type="time" por selects Hora (1-12), Minutos, AM/PM.
 * El valor se guarda en formato 24h "HH:mm" en el input oculto para compatibilidad.
 */
(function() {
    'use strict';

    function hour12To24(hour12, ampm) {
        var h = parseInt(hour12, 10);
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h;
    }

    function hour24To12(hour24) {
        var h = parseInt(hour24, 10);
        if (h === 0) return { hour12: 12, ampm: 'AM' };
        if (h === 12) return { hour12: 12, ampm: 'PM' };
        if (h > 12) return { hour12: h - 12, ampm: 'PM' };
        return { hour12: h, ampm: 'AM' };
    }

    function updateHiddenFromSelects(id) {
        var hEl = document.getElementById(id + '_h');
        var mEl = document.getElementById(id + '_m');
        var aEl = document.getElementById(id + '_ampm');
        var hidden = document.getElementById(id);
        if (!hidden || !hEl || !mEl || !aEl) return;
        var hour12 = hEl.value;
        var min = mEl.value;
        var ampm = aEl.value;
        if (!hour12 || !ampm) return;
        var h24 = hour12To24(hour12, ampm);
        hidden.value = String(h24).padStart(2, '0') + ':' + String(min || '0').padStart(2, '0');
    }

    /**
     * Genera el HTML de un time picker AM/PM (hidden + 3 selects).
     * @param {string} id - ID del input oculto que guardará "HH:mm"
     * @param {boolean} required - Si el campo es obligatorio
     * @returns {string} HTML
     */
    window.createTimePicker12HTML = function(id, required) {
        var req = required ? 'required' : '';
        var opts = [];
        for (var i = 1; i <= 12; i++) opts.push('<option value="' + i + '">' + i + '</option>');
        var minOpts = [];
        for (var j = 0; j < 60; j++) minOpts.push('<option value="' + String(j).padStart(2, '0') + '">' + String(j).padStart(2, '0') + '</option>');
        return '<input type="hidden" id="' + id + '" ' + req + '>' +
            '<div class="time-picker-12h-inner" style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;">' +
            '<select id="' + id + '_h" class="time-picker-12h-select" style="min-width: 60px;" aria-label="Hora">' + opts.join('') + '</select>' +
            '<span style="color: #64748b;">:</span>' +
            '<select id="' + id + '_m" class="time-picker-12h-select" style="min-width: 60px;" aria-label="Minutos">' + minOpts.join('') + '</select>' +
            '<select id="' + id + '_ampm" class="time-picker-12h-select" style="min-width: 70px;" aria-label="AM/PM">' +
            '<option value="AM">AM</option><option value="PM">PM</option>' +
            '</select>' +
            '</div>';
    };

    /**
     * Inicializa los listeners de un time picker (para los que se agregan por JS).
     */
    window.initOneTimePicker12 = function(id) {
        var hidden = document.getElementById(id);
        if (!hidden) return;
        var hEl = document.getElementById(id + '_h');
        var mEl = document.getElementById(id + '_m');
        var aEl = document.getElementById(id + '_ampm');
        if (!hEl || !mEl || !aEl) return;
        function sync() { updateHiddenFromSelects(id); }
        hEl.removeEventListener('change', sync);
        mEl.removeEventListener('change', sync);
        aEl.removeEventListener('change', sync);
        hEl.addEventListener('change', sync);
        mEl.addEventListener('change', sync);
        aEl.addEventListener('change', sync);
        if (hidden.value && /^\d{1,2}:\d{2}$/.test(hidden.value)) {
            var parts = hidden.value.split(':');
            var h24 = parseInt(parts[0], 10);
            var m = parts[1] || '00';
            var o = hour24To12(h24);
            hEl.value = String(o.hour12);
            mEl.value = m;
            aEl.value = o.ampm;
        } else {
            updateHiddenFromSelects(id);
        }
    };

    /**
     * Asigna valor a un time picker (formato "HH:mm" 24h).
     */
    window.setTimePicker12Value = function(id, value) {
        var hidden = document.getElementById(id);
        if (!hidden) return;
        var hEl = document.getElementById(id + '_h');
        var mEl = document.getElementById(id + '_m');
        var aEl = document.getElementById(id + '_ampm');
        if (!value || !/^\d{1,2}:\d{2}$/.test(value)) {
            hidden.value = value || '';
            if (hEl && mEl && aEl) {
                hEl.value = '12';
                mEl.value = '00';
                aEl.value = 'AM';
            }
            return;
        }
        var parts = value.split(':');
        var h24 = parseInt(parts[0], 10);
        var m = parts[1] || '00';
        var o = hour24To12(h24);
        hidden.value = value;
        if (hEl) hEl.value = String(o.hour12);
        if (mEl) mEl.value = m;
        if (aEl) aEl.value = o.ampm;
    };

    /**
     * Reemplaza todos los input[type=time] del documento (o del contenedor) por el picker AM/PM.
     */
    window.initTimePickers12 = function(container) {
        var root = container || document;
        var inputs = root.querySelectorAll ? root.querySelectorAll('input[type=time]') : [];
        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            var id = input.id;
            if (!id) continue;
            var currentVal = input.value;
            var required = input.hasAttribute('required');
            var wrapper = document.createElement('div');
            wrapper.className = 'time-picker-12h';
            wrapper.setAttribute('data-time-picker-for', id);
            wrapper.innerHTML = window.createTimePicker12HTML(id, required);
            input.parentNode.replaceChild(wrapper, input);
            window.initOneTimePicker12(id);
            if (currentVal) window.setTimePicker12Value(id, currentVal);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { window.initTimePickers12(); });
    } else {
        window.initTimePickers12();
    }
})();
