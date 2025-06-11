// Script de depuración para navegación categorizada
console.log('🔍 INICIANDO DEPURACIÓN DE NAVEGACIÓN...');

// Función para depurar elementos del DOM
function debugNavigation() {
    console.log('=== DEPURACIÓN DE NAVEGACIÓN ===');
    
    // Verificar elementos principales
    const consultasBtn = document.getElementById('consultasBtn');
    const laboratorioBtn = document.getElementById('laboratorioBtn');
    const administrativoBtn = document.getElementById('administrativoBtn');
    
    const consultasSubmenu = document.getElementById('consultasSubmenu');
    const laboratorioSubmenu = document.getElementById('laboratorioSubmenu');
    const administrativoSubmenu = document.getElementById('administrativoSubmenu');
    
    console.log('📋 Estado de elementos principales:', {
        consultasBtn: {
            exists: !!consultasBtn,
            visible: consultasBtn ? consultasBtn.offsetParent !== null : false,
            clickable: consultasBtn ? !consultasBtn.disabled : false,
            style: consultasBtn ? window.getComputedStyle(consultasBtn).display : 'N/A'
        },
        laboratorioBtn: {
            exists: !!laboratorioBtn,
            visible: laboratorioBtn ? laboratorioBtn.offsetParent !== null : false,
            clickable: laboratorioBtn ? !laboratorioBtn.disabled : false,
            style: laboratorioBtn ? window.getComputedStyle(laboratorioBtn).display : 'N/A'
        },
        administrativoBtn: {
            exists: !!administrativoBtn,
            visible: administrativoBtn ? administrativoBtn.offsetParent !== null : false,
            clickable: administrativoBtn ? !administrativoBtn.disabled : false,
            style: administrativoBtn ? window.getComputedStyle(administrativoBtn).display : 'N/A'
        }
    });
    
    console.log('📋 Estado de submenús:', {
        consultasSubmenu: {
            exists: !!consultasSubmenu,
            visible: consultasSubmenu ? consultasSubmenu.offsetParent !== null : false,
            style: consultasSubmenu ? window.getComputedStyle(consultasSubmenu).display : 'N/A'
        },
        laboratorioSubmenu: {
            exists: !!laboratorioSubmenu,
            visible: laboratorioSubmenu ? laboratorioSubmenu.offsetParent !== null : false,
            style: laboratorioSubmenu ? window.getComputedStyle(laboratorioSubmenu).display : 'N/A'
        },
        administrativoSubmenu: {
            exists: !!administrativoSubmenu,
            visible: administrativoSubmenu ? administrativoSubmenu.offsetParent !== null : false,
            style: administrativoSubmenu ? window.getComputedStyle(administrativoSubmenu).display : 'N/A'
        }
    });
    
    // Verificar botones de submenú
    const crearTicketBtn = document.getElementById('crearTicketBtn');
    const verTicketsBtn = document.getElementById('verTicketsBtn');
    const crearLabBtn = document.getElementById('crearLabBtn');
    const verLabBtn = document.getElementById('verLabBtn');
    const horarioBtn = document.getElementById('horarioBtn');
    const estadisticasBtn = document.getElementById('estadisticasBtn');
    
    console.log('📋 Estado de botones de submenú:', {
        crearTicketBtn: !!crearTicketBtn,
        verTicketsBtn: !!verTicketsBtn,
        crearLabBtn: !!crearLabBtn,
        verLabBtn: !!verLabBtn,
        horarioBtn: !!horarioBtn,
        estadisticasBtn: !!estadisticasBtn
    });
    
    // Verificar event listeners
    if (consultasBtn) {
        console.log('🔗 ConsultasBtn onclick:', typeof consultasBtn.onclick);
        console.log('🔗 ConsultasBtn event listeners:', getEventListeners ? getEventListeners(consultasBtn) : 'getEventListeners no disponible');
    }
    
    // Intentar hacer click programáticamente
    if (consultasBtn) {
        console.log('🖱️ Intentando click programático en consultasBtn...');
        consultasBtn.click();
    }
}

// Ejecutar después de que el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', debugNavigation);
} else {
    debugNavigation();
}

// También ejecutar después de un delay para asegurar que todo esté cargado
setTimeout(debugNavigation, 1000);
