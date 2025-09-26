// Herramienta de diagnóstico para problemas de tiempo real
// Ejecutar en consola: diagnosticarSistema()

function diagnosticarSistema() {
    console.log('🔍 DIAGNÓSTICO DEL SISTEMA DE TIEMPO REAL');
    console.log('==========================================\n');
    
    const diagnostico = {
        timestamp: new Date().toISOString(),
        firebase: diagnosticarFirebase(),
        optimizaciones: diagnosticarOptimizaciones(),
        rendimiento: diagnosticarRendimiento(),
        datos: diagnosticarDatos(),
        recomendaciones: []
    };
    
    // Generar recomendaciones
    diagnostico.recomendaciones = generarRecomendaciones(diagnostico);
    
    // Mostrar resultados
    mostrarDiagnostico(diagnostico);
    
    // Guardar en localStorage para referencia
    try {
        localStorage.setItem('ultimo_diagnostico', JSON.stringify(diagnostico));
    } catch (error) {
        console.warn('No se pudo guardar el diagnóstico:', error);
    }
    
    return diagnostico;
}

function diagnosticarFirebase() {
    const firebase = {
        configurado: !!window.firebase,
        database: !!window.database,
        ticketsRef: !!window.ticketsRef,
        conectado: window.firebaseConnected,
        listeners: 0,
        errores: []
    };
    
    // Contar listeners activos
    if (window.firebaseOptimizer) {
        const stats = window.firebaseOptimizer.getSyncStats();
        firebase.listeners = stats.activeListeners;
        firebase.conexion = stats.connectionStatus;
        firebase.colaPendiente = stats.queuedUpdates;
        firebase.procesando = stats.processingUpdates;
    }
    
    // Verificar configuración
    if (!firebase.configurado) {
        firebase.errores.push('Firebase no está configurado');
    }
    
    if (!firebase.database) {
        firebase.errores.push('Database de Firebase no está disponible');
    }
    
    if (!firebase.ticketsRef) {
        firebase.errores.push('Referencia de tickets no está configurada');
    }
    
    return firebase;
}

function diagnosticarOptimizaciones() {
    const optimizaciones = {
        optimizador: !!window.firebaseOptimizer,
        porCobrarManager: !!window.porCobrarManager,
        performanceManager: !!window.realtimePerformanceManager,
        estadisticas: null,
        errores: []
    };
    
    // Obtener estadísticas de optimizaciones
    if (window.realtimePerformanceManager) {
        try {
            optimizaciones.estadisticas = window.realtimePerformanceManager.getStats();
        } catch (error) {
            optimizaciones.errores.push('Error obteniendo estadísticas: ' + error.message);
        }
    }
    
    // Verificar módulos críticos
    if (!optimizaciones.optimizador) {
        optimizaciones.errores.push('Optimizador de Firebase no está cargado');
    }
    
    if (!optimizaciones.porCobrarManager) {
        optimizaciones.errores.push('Manager de porCobrar no está cargado');
    }
    
    return optimizaciones;
}

function diagnosticarRendimiento() {
    const rendimiento = {
        memoria: null,
        listeners: contarListeners(),
        timers: contarTimers(),
        cache: verificarCache(),
        errores: []
    };
    
    // Información de memoria si está disponible
    if (performance.memory) {
        rendimiento.memoria = {
            usado: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limite: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        };
    }
    
    // Verificar si hay memory leaks potenciales
    if (rendimiento.listeners > 20) {
        rendimiento.errores.push('Demasiados listeners activos (posible memory leak)');
    }
    
    if (rendimiento.memoria && rendimiento.memoria.usado > 100) {
        rendimiento.errores.push('Alto uso de memoria detectado');
    }
    
    return rendimiento;
}

function diagnosticarDatos() {
    const datos = {
        tickets: window.tickets ? window.tickets.length : 0,
        ticketsConProblemas: 0,
        porCobrarVacios: 0,
        backups: contarBackups(),
        inconsistencias: [],
        errores: []
    };
    
    // Analizar tickets para problemas
    if (window.tickets) {
        window.tickets.forEach((ticket, index) => {
            // Verificar estructura básica
            if (!ticket.firebaseKey) {
                datos.inconsistencias.push(`Ticket ${index}: Sin firebaseKey`);
            }
            
            if (!ticket.mascota) {
                datos.inconsistencias.push(`Ticket ${index}: Sin nombre de mascota`);
            }
            
            if (ticket.id == null) {
                datos.inconsistencias.push(`Ticket ${index}: Sin ID`);
            }
            
            // Verificar porCobrar
            if (ticket.porCobrar === '') {
                datos.porCobrarVacios++;
            }
            
            // Verificar duplicados
            const duplicados = window.tickets.filter(t => 
                t.firebaseKey === ticket.firebaseKey && t !== ticket
            );
            if (duplicados.length > 0) {
                datos.inconsistencias.push(`Ticket ${index}: Duplicado (${duplicados.length})`);
            }
        });
        
        datos.ticketsConProblemas = datos.inconsistencias.length;
    }
    
    return datos;
}

function contarListeners() {
    // Intentar contar listeners DOM y Firebase
    let count = 0;
    
    // Listeners del optimizador
    if (window.firebaseOptimizer && window.firebaseOptimizer.listeners) {
        count += window.firebaseOptimizer.listeners.size;
    }
    
    return count;
}

function contarTimers() {
    // Esto es aproximado ya que no hay una forma directa de contar todos los timers
    let count = 0;
    
    if (window.firebaseOptimizer && window.firebaseOptimizer.debounceTimers) {
        count += window.firebaseOptimizer.debounceTimers.size;
    }
    
    return count;
}

function verificarCache() {
    const cache = {
        tamaño: 0,
        hitRate: 0,
        activo: false
    };
    
    if (window.realtimePerformanceManager) {
        const stats = window.realtimePerformanceManager.getStats();
        if (stats.cache) {
            cache.tamaño = stats.cache.size;
            cache.hitRate = stats.cache.hitRate || 0;
            cache.activo = true;
        }
    }
    
    return cache;
}

function contarBackups() {
    let count = 0;
    
    try {
        const keys = Object.keys(localStorage);
        count = keys.filter(key => key.startsWith('porcobrar_backup_')).length;
    } catch (error) {
        // Ignorar errores de localStorage
    }
    
    return count;
}

function generarRecomendaciones(diagnostico) {
    const recomendaciones = [];
    
    // Recomendaciones de Firebase
    if (diagnostico.firebase.errores.length > 0) {
        recomendaciones.push({
            tipo: 'crítico',
            mensaje: 'Problemas de configuración de Firebase detectados',
            acciones: ['Verificar firebase-config.js', 'Revisar conexión a internet']
        });
    }
    
    if (!diagnostico.firebase.conectado) {
        recomendaciones.push({
            tipo: 'crítico',
            mensaje: 'Firebase no está conectado',
            acciones: ['Verificar conexión a internet', 'Revisar configuración de Firebase']
        });
    }
    
    // Recomendaciones de optimización
    if (!diagnostico.optimizaciones.optimizador) {
        recomendaciones.push({
            tipo: 'importante',
            mensaje: 'Optimizador de tiempo real no está activo',
            acciones: ['Verificar que firebase-realtime-optimizer.js esté cargado']
        });
    }
    
    if (!diagnostico.optimizaciones.porCobrarManager) {
        recomendaciones.push({
            tipo: 'importante',
            mensaje: 'Protección de porCobrar no está activa',
            acciones: ['Verificar que porcobrar-fix.js esté cargado']
        });
    }
    
    // Recomendaciones de rendimiento
    if (diagnostico.rendimiento.listeners > 15) {
        recomendaciones.push({
            tipo: 'advertencia',
            mensaje: 'Alto número de listeners detectado',
            acciones: ['Considerar reiniciar la página', 'Verificar memory leaks']
        });
    }
    
    if (diagnostico.rendimiento.memoria && diagnostico.rendimiento.memoria.usado > 150) {
        recomendaciones.push({
            tipo: 'advertencia',
            mensaje: 'Alto uso de memoria',
            acciones: ['Reiniciar la página', 'Cerrar pestañas innecesarias']
        });
    }
    
    // Recomendaciones de datos
    if (diagnostico.datos.inconsistencias.length > 0) {
        recomendaciones.push({
            tipo: 'advertencia',
            mensaje: `${diagnostico.datos.inconsistencias.length} inconsistencias en datos`,
            acciones: ['Revisar tickets con problemas', 'Considerar limpieza de datos']
        });
    }
    
    if (diagnostico.datos.porCobrarVacios > diagnostico.datos.tickets * 0.1) {
        recomendaciones.push({
            tipo: 'info',
            mensaje: 'Muchos tickets con porCobrar vacío',
            acciones: ['Verificar si es normal para el flujo de trabajo']
        });
    }
    
    return recomendaciones;
}

function mostrarDiagnostico(diagnostico) {
    console.log('📊 RESULTADOS DEL DIAGNÓSTICO');
    console.log('============================');
    
    // Firebase
    console.log('\n🔥 FIREBASE:');
    console.log('Configurado:', diagnostico.firebase.configurado ? '✅' : '❌');
    console.log('Database:', diagnostico.firebase.database ? '✅' : '❌');
    console.log('Tickets Ref:', diagnostico.firebase.ticketsRef ? '✅' : '❌');
    console.log('Conectado:', diagnostico.firebase.conectado ? '✅' : '❌');
    console.log('Listeners activos:', diagnostico.firebase.listeners);
    
    if (diagnostico.firebase.errores.length > 0) {
        console.log('❌ Errores:', diagnostico.firebase.errores);
    }
    
    // Optimizaciones
    console.log('\n⚡ OPTIMIZACIONES:');
    console.log('Optimizador:', diagnostico.optimizaciones.optimizador ? '✅' : '❌');
    console.log('PorCobrar Manager:', diagnostico.optimizaciones.porCobrarManager ? '✅' : '❌');
    console.log('Performance Manager:', diagnostico.optimizaciones.performanceManager ? '✅' : '❌');
    
    if (diagnostico.optimizaciones.estadisticas) {
        console.log('Estadísticas:', diagnostico.optimizaciones.estadisticas);
    }
    
    // Rendimiento
    console.log('\n🚀 RENDIMIENTO:');
    console.log('Listeners:', diagnostico.rendimiento.listeners);
    console.log('Timers:', diagnostico.rendimiento.timers);
    console.log('Cache:', diagnostico.rendimiento.cache);
    
    if (diagnostico.rendimiento.memoria) {
        console.log('Memoria:', diagnostico.rendimiento.memoria);
    }
    
    // Datos
    console.log('\n📋 DATOS:');
    console.log('Total tickets:', diagnostico.datos.tickets);
    console.log('Tickets con problemas:', diagnostico.datos.ticketsConProblemas);
    console.log('PorCobrar vacíos:', diagnostico.datos.porCobrarVacios);
    console.log('Backups guardados:', diagnostico.datos.backups);
    
    if (diagnostico.datos.inconsistencias.length > 0) {
        console.log('⚠️ Inconsistencias:', diagnostico.datos.inconsistencias.slice(0, 5));
        if (diagnostico.datos.inconsistencias.length > 5) {
            console.log(`... y ${diagnostico.datos.inconsistencias.length - 5} más`);
        }
    }
    
    // Recomendaciones
    if (diagnostico.recomendaciones.length > 0) {
        console.log('\n💡 RECOMENDACIONES:');
        diagnostico.recomendaciones.forEach((rec, index) => {
            const icon = rec.tipo === 'crítico' ? '🔴' : 
                        rec.tipo === 'importante' ? '🟠' : 
                        rec.tipo === 'advertencia' ? '🟡' : '🔵';
            
            console.log(`${icon} ${rec.mensaje}`);
            rec.acciones.forEach(accion => {
                console.log(`   • ${accion}`);
            });
        });
    } else {
        console.log('\n✅ No hay recomendaciones - El sistema está funcionando correctamente');
    }
    
    console.log('\n📈 RESUMEN:');
    const criticos = diagnostico.recomendaciones.filter(r => r.tipo === 'crítico').length;
    const importantes = diagnostico.recomendaciones.filter(r => r.tipo === 'importante').length;
    const advertencias = diagnostico.recomendaciones.filter(r => r.tipo === 'advertencia').length;
    
    if (criticos > 0) {
        console.log(`🔴 ${criticos} problema(s) crítico(s) - Requiere atención inmediata`);
    }
    if (importantes > 0) {
        console.log(`🟠 ${importantes} problema(s) importante(s) - Debe resolverse pronto`);
    }
    if (advertencias > 0) {
        console.log(`🟡 ${advertencias} advertencia(s) - Revisar cuando sea posible`);
    }
    
    if (criticos === 0 && importantes === 0 && advertencias === 0) {
        console.log('✅ Sistema funcionando correctamente');
    }
    
    console.log('\n🔧 COMANDOS ÚTILES:');
    console.log('• diagnosticarSistema() - Ejecutar diagnóstico completo');
    console.log('• repararSistema() - Intentar reparaciones automáticas');
    console.log('• limpiarSistema() - Limpiar datos temporales');
    console.log('• window.getRealtimeStats() - Ver estadísticas en tiempo real');
    console.log('• window.restartOptimizations() - Reiniciar optimizaciones');
}

// Función de reparación automática
function repararSistema() {
    console.log('🔧 INICIANDO REPARACIONES AUTOMÁTICAS...');
    
    let reparaciones = 0;
    
    // Limpiar listeners huérfanos
    if (window.firebaseOptimizer) {
        try {
            window.firebaseOptimizer.cleanup();
            console.log('✅ Listeners limpiados');
            reparaciones++;
        } catch (error) {
            console.log('❌ Error limpiando listeners:', error);
        }
    }
    
    // Limpiar backups antiguos
    if (window.porCobrarManager) {
        try {
            window.porCobrarManager.cleanOldBackups();
            console.log('✅ Backups antiguos limpiados');
            reparaciones++;
        } catch (error) {
            console.log('❌ Error limpiando backups:', error);
        }
    }
    
    // Reiniciar optimizaciones si hay problemas
    if (window.restartOptimizations) {
        try {
            window.restartOptimizations();
            console.log('✅ Optimizaciones reiniciadas');
            reparaciones++;
        } catch (error) {
            console.log('❌ Error reiniciando optimizaciones:', error);
        }
    }
    
    console.log(`🎯 Reparaciones completadas: ${reparaciones}`);
    
    if (reparaciones > 0) {
        console.log('💡 Recomendación: Ejecutar diagnosticarSistema() nuevamente para verificar mejoras');
    }
}

// Función de limpieza
function limpiarSistema() {
    console.log('🧹 LIMPIANDO SISTEMA...');
    
    let limpiados = 0;
    
    // Limpiar localStorage
    try {
        const keys = Object.keys(localStorage);
        const backupKeys = keys.filter(key => key.startsWith('porcobrar_backup_'));
        const oldKeys = backupKeys.filter(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
                return data.timestamp < dayAgo;
            } catch {
                return true; // Limpiar datos corruptos
            }
        });
        
        oldKeys.forEach(key => {
            localStorage.removeItem(key);
            limpiados++;
        });
        
        console.log(`✅ ${limpiados} backups antiguos eliminados`);
    } catch (error) {
        console.log('❌ Error limpiando localStorage:', error);
    }
    
    // Limpiar métricas antiguas
    try {
        const metricsKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('performance_metrics')
        );
        
        metricsKeys.forEach(key => {
            localStorage.removeItem(key);
            limpiados++;
        });
        
        if (metricsKeys.length > 0) {
            console.log(`✅ Métricas antiguas limpiadas`);
        }
    } catch (error) {
        console.log('❌ Error limpiando métricas:', error);
    }
    
    console.log(`🎯 Elementos limpiados: ${limpiados}`);
}

// Exportar funciones globalmente
window.diagnosticarSistema = diagnosticarSistema;
window.repararSistema = repararSistema;
window.limpiarSistema = limpiarSistema;

console.log('🔍 Herramientas de diagnóstico cargadas. Ejecuta diagnosticarSistema() para comenzar.');

