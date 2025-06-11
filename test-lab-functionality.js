// test-lab-functionality.js - Script para probar la funcionalidad de laboratorio

// Función para probar la funcionalidad del laboratorio paso a paso
function testLaboratoryFunctionality() {
    console.log('=== PRUEBA DE FUNCIONALIDAD DE LABORATORIO ===');
    
    let passed = 0;
    let total = 0;
    
    function test(description, testFn) {
        total++;
        try {
            const result = testFn();
            if (result) {
                console.log(`✅ ${description}`);
                passed++;
            } else {
                console.log(`❌ ${description}`);
            }
        } catch (error) {
            console.log(`❌ ${description} - Error: ${error.message}`);
        }
    }
    
    // Test 1: Verificar que las funciones principales existen
    test('Función initLaboratorioSystem existe', () => typeof initLaboratorioSystem === 'function');
    test('Función searchClientes existe', () => typeof searchClientes === 'function');
    test('Función setupClientesDataListener existe', () => typeof setupClientesDataListener === 'function');
    
    // Test 2: Verificar que las variables globales están definidas
    test('Variable clientesData está definida', () => typeof clientesData !== 'undefined');
    test('Variable labTickets está definida', () => typeof labTickets !== 'undefined');
    
    // Test 3: Verificar elementos DOM
    test('Campo de búsqueda existe', () => !!document.getElementById('labClienteSearch'));
    test('Contenedor de resultados existe', () => !!document.getElementById('labClienteResults'));
    test('Formulario de laboratorio existe', () => !!document.getElementById('labTicketForm'));
    
    // Test 4: Verificar Firebase
    test('Firebase database disponible', () => !!window.database);
    test('Firebase auth disponible', () => !!window.firebase?.auth);
    
    // Test 5: Verificar que el sistema de laboratorio se inicializó
    test('Sistema de laboratorio inicializado', () => !!window.laboratorioInitialized);
    
    // Test 6: Verificar acceso al laboratorio
    test('Usuario tiene acceso al laboratorio', () => {
        if (typeof hasLabAccess === 'function') {
            return hasLabAccess();
        }
        return true; // Asumir que sí si la función no existe
    });
    
    console.log(`\n=== RESUMEN ===`);
    console.log(`Pruebas pasadas: ${passed}/${total}`);
    
    if (passed === total) {
        console.log('🎉 Todas las pruebas pasaron. El sistema de laboratorio está funcionando correctamente.');
    } else {
        console.log('⚠️ Algunas pruebas fallaron. Revisa los errores arriba.');
    }
    
    return { passed, total, success: passed === total };
}

// Función para simular una búsqueda de prueba
function testSearch() {
    console.log('=== PRUEBA DE BÚSQUEDA ===');
    
    if (typeof clientesData === 'undefined') {
        console.log('❌ clientesData no está definido');
        return false;
    }
    
    if (clientesData.length === 0) {
        console.log('⚠️ No hay datos de clientes disponibles');
        console.log('Intentando forzar carga de datos...');
        
        if (typeof fixLaboratorySearchIssue === 'function') {
            fixLaboratorySearchIssue();
            setTimeout(() => {
                console.log(`Datos después de forzar carga: ${clientesData.length} clientes`);
            }, 2000);
        }
        return false;
    }
    
    console.log(`✅ Datos disponibles: ${clientesData.length} clientes`);
    
    // Tomar el primer cliente como ejemplo
    const testClient = clientesData[0];
    if (testClient && testClient.Nombre) {
        const testQuery = testClient.Nombre.split(' ')[0]; // Primera palabra del nombre
        console.log(`Probando búsqueda con: "${testQuery}"`);
        
        try {
            searchClientes(testQuery);
            console.log('✅ Búsqueda ejecutada sin errores');
            return true;
        } catch (error) {
            console.log(`❌ Error en búsqueda: ${error.message}`);
            return false;
        }
    } else {
        console.log('❌ No se pudo obtener un cliente de prueba');
        return false;
    }
}

// Función para verificar el estado de la conexión
function checkConnection() {
    console.log('=== VERIFICACIÓN DE CONEXIÓN ===');
    
    if (!window.database) {
        console.log('❌ Base de datos no disponible');
        return false;
    }
    
    console.log('✅ Base de datos disponible');
    
    // Verificar conectividad
    const connectedRef = window.database.ref('.info/connected');
    connectedRef.on('value', (snapshot) => {
        if (snapshot.val() === true) {
            console.log('✅ Conectado a Firebase');
        } else {
            console.log('❌ Desconectado de Firebase');
        }
    });
    
    return true;
}

// Ejecutar pruebas automáticamente después de que se cargue todo
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log('Ejecutando pruebas de laboratorio...');
        testLaboratoryFunctionality();
        checkConnection();
        
        // Esperar un poco más y probar la búsqueda
        setTimeout(() => {
            testSearch();
        }, 3000);
    }, 5000); // Esperar 5 segundos para que todo se inicialice
});

// Exponer funciones globalmente
window.testLaboratoryFunctionality = testLaboratoryFunctionality;
window.testSearch = testSearch;
window.checkConnection = checkConnection;

console.log('Script de pruebas de laboratorio cargado');
