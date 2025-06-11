// debug-lab-search.js - Herramienta de diagnóstico para búsqueda en laboratorio

// Función para diagnosticar el problema de búsqueda de clientes en laboratorio
function diagnoseLaboratorySearch() {
    console.log('=== DIAGNÓSTICO DE BÚSQUEDA DE LABORATORIO ===');
    
    // 1. Verificar estado de la base de datos
    console.log('1. Estado de la base de datos:');
    console.log('   - window.database:', !!window.database);
    console.log('   - Conexión autenticada:', !!window.database?.auth?.currentUser);
    
    // 2. Verificar datos de clientes
    console.log('2. Datos de clientes:');
    console.log('   - clientesData definido:', typeof clientesData !== 'undefined');
    if (typeof clientesData !== 'undefined') {
        console.log('   - clientesData.length:', clientesData.length);
        console.log('   - Primeros 3 clientes:', clientesData.slice(0, 3));
    }
    
    // 3. Verificar tickets principales
    console.log('3. Tickets principales:');
    console.log('   - window.tickets definido:', typeof window.tickets !== 'undefined');
    if (typeof window.tickets !== 'undefined') {
        console.log('   - window.tickets.length:', window.tickets.length);
        console.log('   - Primeros 3 tickets:', window.tickets.slice(0, 3));
    }
    
    // 4. Verificar listeners de Firebase
    console.log('4. Referencias de Firebase:');
    console.log('   - labTicketsRef:', !!labTicketsRef);
    console.log('   - ticketsRef configurado:', !!window.database?.ref('tickets'));
    
    // 5. Probar búsqueda manual
    console.log('5. Prueba de búsqueda manual:');
    if (typeof searchClientes === 'function' && typeof clientesData !== 'undefined') {
        console.log('   - Función searchClientes disponible');
        console.log('   - Intentando búsqueda de prueba...');
        
        // Simular búsqueda
        const testQuery = 'test';
        try {
            searchClientes(testQuery);
            console.log('   - Búsqueda ejecutada sin errores');
        } catch (error) {
            console.error('   - Error en búsqueda:', error);
        }
    } else {
        console.log('   - Función searchClientes no disponible');
    }
    
    // 6. Verificar elementos DOM
    console.log('6. Elementos DOM:');
    const searchInput = document.getElementById('labClienteSearch');
    const resultsContainer = document.getElementById('labClienteResults');
    console.log('   - Campo de búsqueda:', !!searchInput);
    console.log('   - Contenedor de resultados:', !!resultsContainer);
    
    // 7. Verificar estado del sistema de laboratorio
    console.log('7. Sistema de laboratorio:');
    console.log('   - laboratorioInitialized:', window.laboratorioInitialized);
    console.log('   - hasLabAccess:', typeof hasLabAccess === 'function' ? hasLabAccess() : 'función no disponible');
    
    console.log('=== FIN DEL DIAGNÓSTICO ===');
}

// Función para forzar recarga de datos de clientes
function forceReloadClientesData() {
    console.log('Forzando recarga de datos de clientes...');
    
    if (!window.database) {
        console.error('Base de datos no disponible');
        return;
    }
    
    const ticketsRef = window.database.ref('tickets');
    
    ticketsRef.once('value')
        .then((snapshot) => {
            console.log('Datos obtenidos de Firebase');
            const data = snapshot.val() || {};
            console.log('Total de tickets encontrados:', Object.keys(data).length);
            
            if (typeof updateClientesDataFromSnapshot === 'function') {
                updateClientesDataFromSnapshot(snapshot);
                console.log('Datos de clientes actualizados');
                console.log('Nuevos clientes disponibles:', clientesData.length);
            } else {
                console.error('Función updateClientesDataFromSnapshot no disponible');
            }
        })
        .catch((error) => {
            console.error('Error obteniendo datos:', error);
        });
}

// Función para probar búsqueda con datos conocidos
function testSearchWithKnownData() {
    console.log('Probando búsqueda con datos conocidos...');
    
    if (typeof clientesData === 'undefined' || clientesData.length === 0) {
        console.log('No hay datos de clientes disponibles');
        return;
    }
    
    // Tomar el primer cliente como ejemplo
    const firstClient = clientesData[0];
    if (firstClient && firstClient.Nombre) {
        const testName = firstClient.Nombre.split(' ')[0]; // Primera palabra del nombre
        console.log('Probando búsqueda con:', testName);
        
        if (typeof searchClientes === 'function') {
            searchClientes(testName);
        } else {
            console.error('Función searchClientes no disponible');
        }
    }
}

// Exponer funciones globalmente para uso en consola
window.diagnoseLaboratorySearch = diagnoseLaboratorySearch;
window.forceReloadClientesData = forceReloadClientesData;
window.testSearchWithKnownData = testSearchWithKnownData;

console.log('Herramientas de diagnóstico de laboratorio cargadas.');
console.log('Usa las siguientes funciones en la consola:');
console.log('- diagnoseLaboratorySearch() - Diagnóstico completo');
console.log('- forceReloadClientesData() - Forzar recarga de datos');
console.log('- testSearchWithKnownData() - Probar búsqueda con datos conocidos');
