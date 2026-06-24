// Etiquetas unificadas de especie/tipo de mascota en todo el sistema
(function () {
    function normalizeTipoMascotaKey(tipo) {
        if (tipo == null || tipo === '') return '';
        return String(tipo)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function getTipoMascotaLabel(tipo) {
        const t = normalizeTipoMascotaKey(tipo);
        const tipos = {
            perro: 'Canino',
            canino: 'Canino',
            can: 'Canino',
            gato: 'Felino',
            felino: 'Felino',
            conejo: 'Lagomorfo',
            lagomorfo: 'Lagomorfo',
            otro: 'Otro',
            por_definir: 'Por definir',
            ave: 'Ave',
            reptil: 'Reptil',
            cuilo: 'Cuilo'
        };
        if (tipos[t]) return tipos[t];
        return tipo ? String(tipo) : '';
    }

    window.normalizeTipoMascotaKey = normalizeTipoMascotaKey;
    window.getTipoMascotaLabel = getTipoMascotaLabel;
})();
