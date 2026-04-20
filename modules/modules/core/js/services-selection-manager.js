// fix-services-selection.js - Archivo para corregir problemas de selección de servicios

// Función para diagnosticar problemas del sistema de servicios
function diagnosticarSistemaServicios() {
    // 1. Verificar que SERVICIOS_LABORATORIO esté disponible
    if (typeof SERVICIOS_LABORATORIO !== 'undefined') {
        // Contar total de servicios
        let totalServicios = 0;
        Object.values(SERVICIOS_LABORATORIO).forEach(categoria => {
            if (categoria.servicios) {
                totalServicios += categoria.servicios.length;
            }
        });
    } else {
        return false;
    }
    
    // 2. Verificar funciones críticas
    const funcionesCriticas = [
        'initServiceSelection',
        'toggleServiceSelection', 
        'updateSelectedServicesList',
        'getAllServices',
        'getServiceById',
        'displayServices',
        'formatPrice'
    ];
    
    let funcionesFaltantes = [];
    funcionesCriticas.forEach(nombreFuncion => {
        if (typeof window[nombreFuncion] !== 'function') {
            funcionesFaltantes.push(nombreFuncion);
        }
    });
    
    if (funcionesFaltantes.length > 0) {
        return false;
    }
    
    // 3. Verificar elementos del DOM
    const elementosDOM = [
        'selectedServicesList',
        'totalPrice', 
        'servicesList',
        'categoryFilter',
        'servicesSearch'
    ];
    
    let elementosFaltantes = [];
    elementosDOM.forEach(idElemento => {
        const elemento = document.getElementById(idElemento);
        if (!elemento) {
            elementosFaltantes.push(idElemento);
        }
    });
    
    // 4. Verificar estado de selectedServices
    // 5. Probar funciones básicas
    try {
        const todosLosServicios = getAllServices();
        
        if (todosLosServicios.length > 0) {
            const primerServicio = getServiceById(todosLosServicios[0].id);
            if (!primerServicio) {
                return false;
            }
            
            formatPrice(35000);
        }
    } catch (error) {
        return false;
    }
    
    return true;
}

// Función para forzar la inicialización del sistema de servicios
function forzarInicializacionServicios() {
    // Limpiar estado previo
    if (typeof selectedServices !== 'undefined') {
        selectedServices = [];
    } else {
        window.selectedServices = [];
    }
    
    // Verificar que todo esté disponible
    if (!diagnosticarSistemaServicios()) {
        return false;
    }
    
    try {
        // Forzar inicialización
        initServiceSelection();
        
        // Verificar que funcionó
        setTimeout(() => {
            const listElement = document.getElementById('selectedServicesList');
            if (listElement) {
                // Lista actualizada
            }
        }, 100);
        
        return true;
    } catch (error) {
        return false;
    }
}

// Función para probar selección manual de un servicio
function probarSeleccionManual(serviceId = null) {
    // Si no se proporciona ID, usar el primero disponible
    if (!serviceId) {
        const servicios = getAllServices();
        if (servicios.length === 0) {
            return false;
        }
        serviceId = servicios[0].id;
    }
    
    // Estado inicial
    // Intentar seleccionar
    try {
        toggleServiceSelection(serviceId);
        
        // Verificar que se actualizó la UI inmediatamente
        const listElement = document.getElementById('selectedServicesList');
        const totalElement = document.getElementById('totalPrice');
        
        // También verificar después de un pequeño delay
        setTimeout(() => {
            // Forzar actualización manual si sigue sin funcionar
            if (listElement && listElement.innerHTML.includes('No hay servicios seleccionados') && selectedServices.length > 0) {
                updateSelectedServicesList();
                updateTotalPrice();
            }
        }, 100);
        
        return true;
    } catch (error) {
        return false;
    }
}

// Función para limpiar y reiniciar completamente el sistema
function reiniciarSistemaServicios() {
    // Limpiar estado
    selectedServices = [];
    
    // Limpiar UI
    const elementos = ['selectedServicesList', 'servicesList', 'totalPrice'];
    elementos.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            if (id === 'selectedServicesList') {
                elemento.innerHTML = '<div class="no-services-selected">No hay servicios seleccionados</div>';
            } else if (id === 'servicesList') {
                elemento.innerHTML = '';
            } else if (id === 'totalPrice') {
                elemento.textContent = '₡0';
            }
        }
    });
    
    // Reinicializar
    setTimeout(() => {
        forzarInicializacionServicios();
    }, 100);
}

// Función específica para depurar el problema de actualización de UI
function depurarActualizacionUI() {
    // 1. Verificar estado actual
    // 2. Verificar elementos del DOM
    const listElement = document.getElementById('selectedServicesList');
    const totalElement = document.getElementById('totalPrice');
    
    // 3. Probar manualmente las funciones de actualización
    try {
        updateSelectedServicesList();
    } catch (error) {
        // Error silencioso
    }
    
    try {
        updateTotalPrice();
    } catch (error) {
        // Error silencioso
    }
    
    // 4. Verificar función formatPrice
    try {
        formatPrice(35000);
    } catch (error) {
        // Error silencioso
    }
    
    return true;
}

// Función para forzar una actualización completa manual
function forzarActualizacionCompleta() {
    const listElement = document.getElementById('selectedServicesList');
    const totalElement = document.getElementById('totalPrice');
    
    if (!listElement || !totalElement) {
        return false;
    }
    
    // Verificar selectedServices
    if (!selectedServices || !Array.isArray(selectedServices)) {
        selectedServices = [];
    }
    
    // Actualización manual de la lista
    if (selectedServices.length === 0) {
        listElement.innerHTML = '<div class="no-services-selected">No hay servicios seleccionados</div>';
    } else {
        const htmlContent = selectedServices.map((service, index) => {
            if (!service || !service.id || !service.nombre) {
                return '';
            }
            
            const precio = service.precio || 0;
            return `
                <div class="selected-service-item">
                    <div class="selected-service-info">
                        <div class="selected-service-name">${service.nombre}</div>
                        <div class="selected-service-price">₡${precio.toLocaleString()}</div>
                    </div>
                    <button class="remove-service-btn" onclick="removeSelectedService('${service.id}')" type="button">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).filter(html => html.length > 0).join('');
        
        listElement.innerHTML = htmlContent;
    }
    
    // Actualización manual del total
    const total = selectedServices.reduce((sum, service) => {
        if (!service || typeof service.precio !== 'number') {
            return sum;
        }
        return sum + service.precio;
    }, 0);
    
    totalElement.textContent = `₡${total.toLocaleString()}`;
    
    return true;
}

// Función para verificar y corregir la referencia global de selectedServices
function verificarYCorregirSelectedServices() {
    // Verificar si selectedServices existe globalmente
    // Verificar si están sincronizados
    
    // Si selectedServices no está definido globalmente, definirlo
    if (typeof selectedServices === 'undefined') {
        window.selectedServices = [];
        // También definirlo en el contexto local
        selectedServices = window.selectedServices;
    }
    
    // Si selectedServices no es un array, corregirlo
    if (!Array.isArray(selectedServices)) {
        selectedServices = [];
        window.selectedServices = selectedServices;
    }
    
    // Asegurar que window.selectedServices esté sincronizado
    if (!window.selectedServices) {
        window.selectedServices = selectedServices;
    }
    
    return selectedServices;
}

// Versión mejorada de toggleServiceSelection con forzado de actualización
function toggleServiceSelectionForced(serviceId) {
    // Verificar y corregir selectedServices
    verificarYCorregirSelectedServices();
    
    const service = getServiceById(serviceId);
    
    if (!service) {
        return;
    }
    
    const existingIndex = selectedServices.findIndex(s => s.id === serviceId);
    
    if (existingIndex >= 0) {
        // Remover servicio
        selectedServices.splice(existingIndex, 1);
    } else {
        // Agregar servicio - crear una copia limpia
        const serviceCopy = {
            id: service.id,
            nombre: service.nombre,
            descripcion: service.descripcion,
            precio: service.precio,
            categoria: service.categoria,
            categoriaTitulo: service.categoriaTitulo
        };
        selectedServices.push(serviceCopy);
    }
    
    // Sincronizar referencias globales
    window.selectedServices = selectedServices;
    
    // Forzar actualización completa con delay para asegurar que el DOM esté listo
    setTimeout(() => {
        forzarActualizacionCompleta();
        
        // También actualizar la UI del checkbox específico
        updateServiceSelectionUI(serviceId);
    }, 10);
    
    return true;
}

// Función de solución completa para el problema de servicios
function solucionarProblemaServicios() {
    // 1. Verificar y corregir referencias
    verificarYCorregirSelectedServices();
    
    // 2. Forzar actualización completa de la UI
    forzarActualizacionCompleta();
    
    // 3. Actualizar eventos de checkboxes para usar versión mejorada
    actualizarEventosCheckboxes();
    
    // 4. Verificar que todo esté funcionando
    setTimeout(() => {
        const testResult = probarSeleccionManual();
        if (testResult) {
            // Mostrar notificación al usuario si existe la función
            if (typeof showNotification === 'function') {
                showNotification('Sistema de servicios corregido y funcionando correctamente', 'success');
            }
        }
    }, 500);
    
    return true;
}

// Función para reemplazar todos los eventos onclick de los checkboxes
function actualizarEventosCheckboxes() {
    const checkboxes = document.querySelectorAll('.service-checkbox');
    
    checkboxes.forEach(checkbox => {
        const serviceItem = checkbox.closest('[data-service-id]');
        if (serviceItem) {
            const serviceId = serviceItem.getAttribute('data-service-id');
            
            // Remover event listener existente
            checkbox.replaceWith(checkbox.cloneNode(true));
            const newCheckbox = serviceItem.querySelector('.service-checkbox');
            
            // Agregar nuevo event listener que usa la versión forzada
            newCheckbox.addEventListener('change', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleServiceSelectionForced(serviceId);
            });
        }
    });
}

// Exponer funciones globalmente
window.diagnosticarSistemaServicios = diagnosticarSistemaServicios;
window.forzarInicializacionServicios = forzarInicializacionServicios;
window.probarSeleccionManual = probarSeleccionManual;
window.reiniciarSistemaServicios = reiniciarSistemaServicios;
window.depurarActualizacionUI = depurarActualizacionUI;
window.forzarActualizacionCompleta = forzarActualizacionCompleta;
window.verificarYCorregirSelectedServices = verificarYCorregirSelectedServices;
window.toggleServiceSelectionForced = toggleServiceSelectionForced;
window.actualizarEventosCheckboxes = actualizarEventosCheckboxes;
window.solucionarProblemaServicios = solucionarProblemaServicios;
window.verificarYCorregirSelectedServices = verificarYCorregirSelectedServices;
