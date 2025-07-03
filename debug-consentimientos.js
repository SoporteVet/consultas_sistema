// debug-consentimientos.js - Script para depurar problemas con consentimientos

// Función para verificar el estado del sistema
function debugConsentimientos() {
    console.log('=== DEBUG CONSENTIMIENTOS ===');
    console.log('1. window.tickets disponible:', !!window.tickets);
    console.log('2. Tipo de window.tickets:', typeof window.tickets);
    console.log('3. Array.isArray(window.tickets):', Array.isArray(window.tickets));
    console.log('4. Cantidad de tickets:', window.tickets ? window.tickets.length : 'N/A');
    
    if (window.tickets && window.tickets.length > 0) {
        console.log('5. Primer ticket:', window.tickets[0]);
        console.log('6. Campos disponibles del primer ticket:', Object.keys(window.tickets[0]));
    }
    
    console.log('7. Variable tickets local:', typeof tickets !== 'undefined' ? tickets.length : 'No disponible');
    console.log('8. isDataLoaded:', typeof isDataLoaded !== 'undefined' ? isDataLoaded : 'No disponible');
    
    // Verificar elementos del DOM
    const searchInput = document.getElementById('consentClientSearch');
    const searchBtn = document.getElementById('searchClientBtn');
    const resultsContainer = document.getElementById('clientSearchResults');
    
    console.log('9. DOM Elements:');
    console.log('   - searchInput:', !!searchInput);
    console.log('   - searchBtn:', !!searchBtn);
    console.log('   - resultsContainer:', !!resultsContainer);
    
    console.log('=== FIN DEBUG ===');
}

// Función para simular datos de prueba
function simularDatosPrueba() {
    console.log('Simulando datos de prueba...');
    
    if (!window.tickets) {
        window.tickets = [];
    }
    
    const datosPrueba = [
        {
            randomId: 'test001',
            nombre: 'Juan Pérez',
            cedula: '123456789',
            mascota: 'Firulais',
            tipoMascota: 'perro',
            telefono: '88888888',
            fechaConsulta: '2025-01-01'
        },
        {
            randomId: 'test002',
            nombre: 'María González',
            cedula: '987654321',
            mascota: 'Whiskers',
            tipoMascota: 'gato',
            telefono: '77777777',
            fechaConsulta: '2025-01-02'
        },
        {
            randomId: 'test003',
            nombre: 'Pedro Ramírez',
            cedula: '456789123',
            mascota: 'Rex',
            tipoMascota: 'perro',
            telefono: '66666666',
            fechaConsulta: '2025-01-03'
        }
    ];
    
    window.tickets = [...window.tickets, ...datosPrueba];
    console.log('Datos de prueba agregados. Total tickets:', window.tickets.length);
}

// Función para probar la búsqueda
function probarBusqueda(termino = 'Juan') {
    console.log('Probando búsqueda con término:', termino);
    
    const searchInput = document.getElementById('consentClientSearch');
    if (searchInput) {
        searchInput.value = termino;
        searchClients();
    } else {
        console.error('Input de búsqueda no encontrado');
    }
}

// Exponer funciones globalmente para usar en la consola del navegador
window.debugConsentimientos = debugConsentimientos;
window.simularDatosPrueba = simularDatosPrueba;
window.probarBusqueda = probarBusqueda;

// Auto-ejecutar debug cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log('Auto-ejecutando debug de consentimientos...');
        debugConsentimientos();
        
        // Si no hay datos, simular algunos automáticamente
        if (!window.tickets || window.tickets.length === 0) {
            console.log('No se encontraron datos, simulando datos de prueba...');
            simularDatosPrueba();
        }
    }, 3000); // Aumentar tiempo de espera a 3 segundos
});

console.log('Debug de consentimientos cargado. Funciones disponibles:');
console.log('- debugConsentimientos()');
console.log('- simularDatosPrueba()');
console.log('- probarBusqueda(termino)');
