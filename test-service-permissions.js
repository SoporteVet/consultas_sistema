// Test script para verificar permisos de servicios de laboratorio

// Función de prueba para simular diferentes roles de usuario
function testServicePermissions() {
    console.log('=== Probando permisos de servicios de laboratorio ===');
    
    // Mock data para pruebas
    const mockTicket = {
        randomId: 'test-123',
        serviciosSeleccionados: [
            { nombre: 'Hemograma', realizado: false },
            { nombre: 'Bioquímica', realizado: true }
        ]
    };
    
    // Simular ticket en la lista global
    if (typeof window !== 'undefined' && window.labTickets) {
        window.labTickets.push(mockTicket);
    }
    
    // Probar con rol de laboratorio
    console.log('1. Probando con rol "laboratorio"...');
    sessionStorage.setItem('userRole', 'laboratorio');
    
    const labDisplay = getServicesDisplayForTicket(mockTicket);
    console.log('HTML generado para laboratorio:', labDisplay);
    
    // Verificar que contiene checkboxes
    const hasCheckboxes = labDisplay.includes('input type="checkbox"');
    console.log('¿Contiene checkboxes?', hasCheckboxes);
      // Probar con rol de admin
    console.log('2. Probando con rol "admin"...');
    sessionStorage.setItem('userRole', 'admin');
    
    const adminDisplay = getServicesDisplayForTicket(mockTicket);
    console.log('HTML generado para admin:', adminDisplay);
    
    // Verificar que SÍ contiene checkboxes (admin también puede editar)
    const adminHasCheckboxes = adminDisplay.includes('input type="checkbox"');
    console.log('¿Contiene checkboxes (admin)?', adminHasCheckboxes);
    
    // Probar con rol de recepcion
    console.log('3. Probando con rol "recepcion"...');
    sessionStorage.setItem('userRole', 'recepcion');
    
    const recepcionDisplay = getServicesDisplayForTicket(mockTicket);
    console.log('HTML generado para recepción:', recepcionDisplay);
    
    // Verificar que contiene elementos readonly
    const hasReadonly = recepcionDisplay.includes('readonly');
    console.log('¿Contiene elementos readonly?', hasReadonly);
    
    console.log('=== Fin de pruebas ===');
    
    // Limpiar sessionStorage
    sessionStorage.removeItem('userRole');
}

// Ejecutar pruebas cuando se carga el script
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        // Esperar un poco para que se carguen otros scripts
        setTimeout(testServicePermissions, 1000);
    });
}

console.log('Script de prueba de permisos de servicios cargado');
