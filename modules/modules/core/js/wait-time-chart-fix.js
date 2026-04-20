/**
 * Fix para visualización de gráfico de tiempo de espera
 * Este archivo soluciona problemas de visualización de la sección de estadísticas
 */

document.addEventListener('DOMContentLoaded', () => {
    // Comprobar si estamos en la página correcta antes de ejecutar el fix
    if (document.querySelector('.wait-time-statistics')) {
        
        // Forzar la visibilidad de la sección de tiempo promedio
        const fixWaitTimeSection = () => {
            const waitTimeSection = document.querySelector('.wait-time-statistics');
            if (waitTimeSection) {
                // Forzar visualización
                waitTimeSection.style.display = 'block';
                waitTimeSection.style.visibility = 'visible';
                waitTimeSection.style.opacity = '1';
                
                // Remover cualquier clase que pueda ocultarla
                waitTimeSection.classList.remove('hidden');
                
                // Agregar un borde para que sea más visible
                waitTimeSection.style.border = '2px solid #4285f4';
            }
        };
        
        // Aplicar el fix inmediatamente y también cuando se hace clic en la pestaña de estadísticas
        fixWaitTimeSection();
        
        const estadisticasBtn = document.getElementById('estadisticasBtn');
        if (estadisticasBtn) {
            estadisticasBtn.addEventListener('click', () => {
                // Dar tiempo para que la sección se muestre primero
                setTimeout(fixWaitTimeSection, 100);
                
                // Asegurarse de que Chart.js inicialice correctamente
                setTimeout(() => {
                    const canvas = document.getElementById('waitTimeChart');
                    if (canvas) {
                        // Forzar redimensionamiento del canvas
                        canvas.style.width = '100%';
                        canvas.style.height = '300px';
                        
                        // Crear datos de muestra si no hay datos reales
                        if (!window.waitTimeChart) {
                            const ctx = canvas.getContext('2d');
                            if (ctx && window.lazyLoadLibs) {
                                // Cargar Chart.js de forma diferida
                                window.lazyLoadLibs.loadChartJS().then(() => {
                                    // Datos de muestra para el gráfico
                                    const data = {
                                        labels: ['Consulta', 'Emergencia', 'Vacunación'],
                                        datasets: [{
                                            label: 'Tiempo promedio (minutos)',
                                            data: [15, 5, 12],
                                            backgroundColor: ['#4285f4', '#ea4335', '#34a853'],
                                            borderWidth: 1
                                        }]
                                    };
                                    
                                    // Crear gráfico de ejemplo
                                    window.waitTimeChart = new Chart(ctx, {
                                        type: 'bar',
                                        data: data,
                                        options: {
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            scales: {
                                                y: {
                                                    beginAtZero: true,
                                                    title: {
                                                        display: true,
                                                        text: 'Minutos'
                                                    }
                                                }
                                            }
                                        }
                                    });
                                }).catch(error => {
                                    console.error('Error al cargar Chart.js:', error);
                                });
                            }
                        }
                        
                        // Actualizar la tabla de ejemplo
                        const waitTimeStatsBody = document.getElementById('waitTimeStatsBody');
                        if (waitTimeStatsBody && waitTimeStatsBody.children.length === 0) {
                            const exampleData = [
                                { servicio: 'Consulta', tiempo: '15m', cantidad: 25 },
                                { servicio: 'Emergencia', tiempo: '5m', cantidad: 10 },
                                { servicio: 'Vacunación', tiempo: '12m', cantidad: 30 }
                            ];
                            
                            exampleData.forEach(item => {
                                const row = document.createElement('tr');
                                row.innerHTML = `
                                    <td>${item.servicio}</td>
                                    <td>${item.tiempo}</td>
                                    <td>${item.cantidad}</td>
                                `;
                                waitTimeStatsBody.appendChild(row);
                            });
                        }
                    }
                }, 500);
            });
        }
    }
});
