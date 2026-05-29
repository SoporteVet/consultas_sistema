// fix-lab-search.js - Parche para corregir la búsqueda de laboratorio

// Función para diagnosticar y corregir problemas de búsqueda en laboratorio
function fixLaboratorySearchIssue() {
    console.log('Aplicando corrección para búsqueda de laboratorio...');
    
    // 1. Verificar si los datos de clientes están vacíos
    if (typeof clientesData !== 'undefined' && clientesData.length === 0) {
        console.log('Datos de clientes vacíos, intentando recargar...');
        
        // Forzar recarga de datos
        if (window.database) {
            const ticketsRef = window.database.ref('tickets');
            
            ticketsRef.once('value')
                .then((snapshot) => {
                    console.log('Recargando datos de clientes...');
                    const ticketsData = snapshot.val() || {};
                    
                    // Extraer información única de clientes de los tickets
                    const clientesMap = new Map();
                    
                    Object.values(ticketsData).forEach(ticket => {
                        if (ticket.nombre && (ticket.cedula || ticket.idPaciente)) {
                            const clienteId = ticket.cedula || ticket.idPaciente;
                            
                            if (!clientesMap.has(clienteId)) {
                                clientesMap.set(clienteId, {
                                    Id: ticket.idPaciente || clienteId,
                                    Nombre: ticket.nombre,
                                    Identificacion: ticket.cedula || '',
                                    'nombre mascota': ticket.mascota || '',
                                    Especie: ticket.tipoMascota === 'perro' ? 'Canino' : 
                                            ticket.tipoMascota === 'gato' ? 'Felino' : 
                                            ticket.tipoMascota === 'conejo' ? 'Conejo' : 'Otro',
                                    ultimaActualizacion: new Date().getTime()
                                });
                            }
                        }
                    });
                    
                    // Actualizar datos globales
                    if (typeof clientesData !== 'undefined') {
                        clientesData.length = 0; // Limpiar array existente
                        clientesData.push(...Array.from(clientesMap.values()));
                        console.log(`Datos de clientes actualizados: ${clientesData.length} clientes`);
                        
                        // Notificar actualización
                        const event = new CustomEvent('clientesDataUpdated', {
                            detail: {
                                count: clientesData.length,
                                timestamp: new Date().getTime()
                            }
                        });
                        document.dispatchEvent(event);
                    }
                })
                .catch((error) => {
                    console.error('Error recargando datos de clientes:', error);
                });
        }
    }
}

// Función mejorada para manejar la búsqueda cuando no hay datos
function enhanceSearchFunction() {
    // Solo aplicar si la función de búsqueda original existe
    if (typeof searchClientes === 'function') {
        const originalSearchClientes = searchClientes;
        
        // Reemplazar con versión mejorada
        window.searchClientes = function(query) {
            console.log('Búsqueda mejorada llamada con:', query);
            
            // Si no hay datos, intentar cargarlos primero
            if (typeof clientesData !== 'undefined' && clientesData.length === 0) {
                console.log('No hay datos disponibles, aplicando corrección...');
                fixLaboratorySearchIssue();
                
                // Mostrar mensaje de carga
                const resultsContainer = document.getElementById('labClienteResults');
                if (resultsContainer) {
                    resultsContainer.innerHTML = `
                        <div class="no-results" style="text-align: center; padding: 20px; color: #666;">
                            <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 10px;"></i>
                            <p>Cargando datos de clientes...</p>
                            <small>Esto puede tomar unos segundos</small>
                        </div>
                    `;
                    resultsContainer.style.display = 'block';
                }
                
                // Reintentar después de 3 segundos
                setTimeout(() => {
                    if (typeof clientesData !== 'undefined' && clientesData.length > 0) {
                        console.log('Datos cargados, reintentando búsqueda...');
                        originalSearchClientes(query);
                    } else {
                        // Si aún no hay datos, mostrar error
                        if (resultsContainer) {
                            resultsContainer.innerHTML = `
                                <div class="no-results" style="text-align: center; padding: 20px; color: #e74c3c;">
                                    <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 10px;"></i>
                                    <p>No se pudieron cargar los datos de clientes</p>
                                    <button onclick="fixLaboratorySearchIssue()" style="background: var(--primary-color); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                                        Reintentar
                                    </button>
                                </div>
                            `;
                        }
                    }
                }, 3000);
                
                return;
            }
            
            // Si hay datos, usar la función original
            originalSearchClientes(query);
        };
        
        console.log('Función de búsqueda mejorada aplicada');
    }
}

// Aplicar correcciones automáticamente cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    console.log('Aplicando correcciones de laboratorio...');
    
    // Esperar a que se inicialice el sistema
    setTimeout(() => {
        fixLaboratorySearchIssue();
        enhanceSearchFunction();
    }, 2000);
});

// Exponer funciones globalmente
window.fixLaboratorySearchIssue = fixLaboratorySearchIssue;
window.enhanceSearchFunction = enhanceSearchFunction;

console.log('Corrección de búsqueda de laboratorio cargada');
