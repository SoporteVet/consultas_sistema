/**
 * Fix de visibilidad para la sección de gráficas de estadísticas.
 * Ya no inyecta datos de ejemplo — solo asegura que la sección sea visible
 * y dispara una actualización real al entrar.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.wait-time-statistics')) return;

    const fixWaitTimeSection = () => {
        const waitTimeSection = document.querySelector('.wait-time-statistics');
        if (!waitTimeSection) return;
        waitTimeSection.style.display = 'block';
        waitTimeSection.style.visibility = 'visible';
        waitTimeSection.style.opacity = '1';
        waitTimeSection.classList.remove('hidden');
    };

    fixWaitTimeSection();

    const estadisticasBtn = document.getElementById('estadisticasBtn');
    if (estadisticasBtn) {
        estadisticasBtn.addEventListener('click', () => {
            setTimeout(fixWaitTimeSection, 100);
            setTimeout(() => {
                if (typeof updateStatsGlobal === 'function') {
                    updateStatsGlobal();
                }
            }, 200);
        });
    }
});
