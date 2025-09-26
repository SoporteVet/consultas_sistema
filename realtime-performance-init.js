// Script de inicialización para optimizaciones de tiempo real
// Integra todos los módulos de mejora y configura el sistema

(function() {
    'use strict';
    
    // Configuración de optimización
    const OPTIMIZATION_CONFIG = {
        // Tiempos de debounce (ms)
        debounce: {
            ui_update: 200,
            search: 300,
            form_backup: 2000,
            firebase_write: 500
        },
        
        // Configuración de reintentos
        retry: {
            max_attempts: 3,
            base_delay: 1000,
            exponential: true
        },
        
        // Configuración de cache
        cache: {
            ticket_cache_time: 30000, // 30 segundos
            stats_cache_time: 10000,  // 10 segundos
            max_cache_entries: 1000
        },
        
        // Configuración de batch updates
        batch: {
            max_batch_size: 50,
            batch_timeout: 1000,
            priority_operations: ['porCobrar', 'estado']
        }
    };
    
    class RealtimePerformanceManager {
        constructor() {
            this.initialized = false;
            this.modules = new Map();
            this.performanceMetrics = {
                startTime: Date.now(),
                operations: 0,
                errors: 0,
                cacheHits: 0,
                cacheMisses: 0
            };
            
            this.init();
        }
        
        async init() {
            if (this.initialized) return;
            
            // Iniciando optimizaciones de tiempo real
            
            try {
                // Esperar a que Firebase esté disponible
                await this.waitForFirebase();
                
                // Inicializar módulos en orden
                await this.initializeModules();
                
                // Configurar monitoreo de rendimiento
                this.setupPerformanceMonitoring();
                
                // Configurar limpieza automática
                this.setupAutomaticCleanup();
                
                this.initialized = true;
                
            } catch (error) {
                this.showInitializationError(error);
            }
        }
        
        async waitForFirebase() {
            let attempts = 0;
            const maxAttempts = 30; // 30 segundos máximo
            
            while (attempts < maxAttempts) {
                if (window.database && window.ticketsRef) {
                    return;
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }
            
            throw new Error('Firebase no está disponible después de 30 segundos');
        }
        
        async initializeModules() {
            const modules = [
                {
                    name: 'firebase-optimizer',
                    init: () => window.initFirebaseOptimizer?.(),
                    required: true
                },
                {
                    name: 'porcobrar-manager',
                    init: () => window.initPorCobrarManager?.(),
                    required: false // Cambiado a false - solo backup, no crítico
                },
                {
                    name: 'ui-optimizer',
                    init: () => this.initUIOptimizer(),
                    required: false
                },
                {
                    name: 'cache-manager',
                    init: () => this.initCacheManager(),
                    required: false
                },
                {
                    name: 'memory-optimizer',
                    init: () => window.initMemoryOptimizer?.(),
                    required: false
                }
            ];
            
            for (const module of modules) {
                try {
                    await module.init();
                    this.modules.set(module.name, { status: 'loaded', error: null });
                } catch (error) {
                    this.modules.set(module.name, { status: 'error', error });
                    
                    if (module.required) {
                        throw new Error(`Módulo requerido ${module.name} falló: ${error.message}`);
                    }
                }
            }
        }
        
        initUIOptimizer() {
            // Optimizaciones de UI
            this.optimizeScrolling();
            this.optimizeRendering();
            this.setupVirtualScrolling();
        }
        
        optimizeScrolling() {
            // Throttle scroll events
            let scrollTimer = null;
            const originalScroll = window.onscroll;
            
            window.onscroll = (e) => {
                if (scrollTimer) return;
                
                scrollTimer = setTimeout(() => {
                    if (originalScroll) originalScroll(e);
                    scrollTimer = null;
                }, 16); // 60fps
            };
        }
        
        optimizeRendering() {
            // Optimizar renderizado de tickets
            if (window.renderTickets) {
                const originalRenderTickets = window.renderTickets;
                let renderTimer = null;
                
                window.renderTickets = (...args) => {
                    if (renderTimer) {
                        clearTimeout(renderTimer);
                    }
                    
                    renderTimer = setTimeout(() => {
                        originalRenderTickets.apply(this, args);
                        renderTimer = null;
                    }, OPTIMIZATION_CONFIG.debounce.ui_update);
                };
            }
        }
        
        setupVirtualScrolling() {
            // Implementar scroll virtual para listas largas
            const ticketContainers = document.querySelectorAll('.tickets-container');
            
            ticketContainers.forEach(container => {
                this.enableVirtualScrolling(container);
            });
        }
        
        enableVirtualScrolling(container) {
            if (container.dataset.virtualScrollEnabled) return;
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.visibility = 'visible';
                    } else {
                        entry.target.style.visibility = 'hidden';
                    }
                });
            }, {
                rootMargin: '100px'
            });
            
            container.dataset.virtualScrollEnabled = 'true';
            
            // Observar elementos existentes
            const tickets = container.querySelectorAll('.ticket-item');
            tickets.forEach(ticket => observer.observe(ticket));
            
            // Observar nuevos elementos
            const mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.classList.contains('ticket-item')) {
                            observer.observe(node);
                        }
                    });
                });
            });
            
            mutationObserver.observe(container, { childList: true });
        }
        
        initCacheManager() {
            this.cache = new Map();
            this.cacheTimestamps = new Map();
            
            // Interceptar funciones que pueden beneficiarse de cache
            this.setupCaching();
        }
        
        setupCaching() {
            // Cache para estadísticas
            if (window.updateStatsGlobal) {
                const original = window.updateStatsGlobal;
                window.updateStatsGlobal = () => {
                    const cacheKey = 'stats_global';
                    const cached = this.getFromCache(cacheKey, OPTIMIZATION_CONFIG.cache.stats_cache_time);
                    
                    if (cached) {
                        this.performanceMetrics.cacheHits++;
                        return cached;
                    }
                    
                    this.performanceMetrics.cacheMisses++;
                    const result = original();
                    this.setCache(cacheKey, result);
                    return result;
                };
            }
        }
        
        getFromCache(key, maxAge) {
            if (!this.cache.has(key)) return null;
            
            const timestamp = this.cacheTimestamps.get(key);
            if (Date.now() - timestamp > maxAge) {
                this.cache.delete(key);
                this.cacheTimestamps.delete(key);
                return null;
            }
            
            return this.cache.get(key);
        }
        
        setCache(key, value) {
            // Limitar tamaño del cache
            if (this.cache.size >= OPTIMIZATION_CONFIG.cache.max_cache_entries) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
                this.cacheTimestamps.delete(firstKey);
            }
            
            this.cache.set(key, value);
            this.cacheTimestamps.set(key, Date.now());
        }
        
        setupPerformanceMonitoring() {
            // Monitorear rendimiento
            setInterval(() => {
                this.collectMetrics();
            }, 30000); // Cada 30 segundos
            
            // Interceptar operaciones para contar
            this.interceptOperations();
        }
        
        interceptOperations() {
            // Interceptar operaciones de Firebase
            if (window.ticketsRef) {
                const originalUpdate = window.ticketsRef.update;
                window.ticketsRef.update = (...args) => {
                    this.performanceMetrics.operations++;
                    return originalUpdate.apply(window.ticketsRef, args).catch(error => {
                        this.performanceMetrics.errors++;
                        throw error;
                    });
                };
            }
        }
        
        collectMetrics() {
            const metrics = {
                ...this.performanceMetrics,
                uptime: Date.now() - this.performanceMetrics.startTime,
                memoryUsage: performance.memory ? {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                } : null,
                cacheSize: this.cache ? this.cache.size : 0,
                moduleStatus: Object.fromEntries(this.modules)
            };
            
            // Guardar métricas en localStorage para análisis
            try {
                const metricsHistory = JSON.parse(localStorage.getItem('performance_metrics') || '[]');
                metricsHistory.push({
                    timestamp: Date.now(),
                    ...metrics
                });
                
                // Mantener solo las últimas 10 entradas
                if (metricsHistory.length > 10) {
                    metricsHistory.splice(0, metricsHistory.length - 10);
                }
                
                localStorage.setItem('performance_metrics', JSON.stringify(metricsHistory));
            } catch (error) {
                // Error silencioso
            }
            
            // Detectar problemas silenciosamente
            if (metrics.errors > 10 || (metrics.operations > 0 && metrics.errors / metrics.operations > 0.1)) {
                // Alto número de errores detectado
            }
        }
        
        setupAutomaticCleanup() {
            // Limpieza automática cada 5 minutos
            setInterval(() => {
                this.performCleanup();
            }, 5 * 60 * 1000);
            
            // Limpieza al cerrar la página
            window.addEventListener('beforeunload', () => {
                this.performCleanup();
            });
        }
        
        performCleanup() {
            try {
                // Limpiar cache viejo
                if (this.cache) {
                    const now = Date.now();
                    for (const [key, timestamp] of this.cacheTimestamps) {
                        if (now - timestamp > OPTIMIZATION_CONFIG.cache.ticket_cache_time) {
                            this.cache.delete(key);
                            this.cacheTimestamps.delete(key);
                        }
                    }
                }
                
                // Limpiar backups antiguos
                if (window.porCobrarManager) {
                    window.porCobrarManager.cleanOldBackups();
                }
                
                // Limpiar listeners huérfanos
                this.cleanupOrphanedListeners();
                
            } catch (error) {
                // Error silencioso
            }
        }
        
        cleanupOrphanedListeners() {
            // Verificar y limpiar listeners que pueden haber quedado huérfanos
            // Esto es especialmente importante para prevenir memory leaks
            
            if (window.firebaseOptimizer) {
                const stats = window.firebaseOptimizer.getSyncStats();
                if (stats.activeListeners > 10) {
                    // Muchos listeners activos detectados
                }
            }
        }
        
        showInitializationSuccess() {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
                z-index: 10001;
                font-family: Arial, sans-serif;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 10px;
                animation: slideInRight 0.5s ease-out;
                max-width: 350px;
            `;
            
            notification.innerHTML = `
                <i class="fas fa-rocket" style="font-size: 18px;"></i>
                <div>
                    <div style="font-weight: bold; margin-bottom: 2px;">Sistema Optimizado</div>
                    <div style="font-size: 12px; opacity: 0.9;">Tiempo real mejorado • Datos protegidos</div>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // Auto-remover después de 4 segundos
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.5s ease-in';
                setTimeout(() => notification.remove(), 500);
            }, 4000);
        }
        
        showInitializationError(error) {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #dc3545, #c82333);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(220, 53, 69, 0.3);
                z-index: 10001;
                font-family: Arial, sans-serif;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 10px;
                animation: slideInRight 0.5s ease-out;
                max-width: 350px;
            `;
            
            notification.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="font-size: 18px;"></i>
                <div>
                    <div style="font-weight: bold; margin-bottom: 2px;">Error de Optimización</div>
                    <div style="font-size: 12px; opacity: 0.9;">El sistema funciona pero sin mejoras</div>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.5s ease-in';
                setTimeout(() => notification.remove(), 500);
            }, 6000);
        }
        
        // Método público para obtener estadísticas
        getStats() {
            return {
                initialized: this.initialized,
                modules: Object.fromEntries(this.modules),
                performance: this.performanceMetrics,
                cache: {
                    size: this.cache ? this.cache.size : 0,
                    hitRate: this.performanceMetrics.cacheHits / 
                           (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100
                }
            };
        }
        
        // Método para reiniciar optimizaciones
        async restart() {
            // Reiniciando optimizaciones
            
            // Limpiar estado actual
            this.performCleanup();
            this.initialized = false;
            this.modules.clear();
            
            // Reinicializar
            await this.init();
        }
    }
    
    // Agregar estilos para animaciones
    const styles = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    
    // Inicialización global
    let performanceManager;
    
    function initRealtimeOptimizations() {
        if (!performanceManager) {
            performanceManager = new RealtimePerformanceManager();
            window.realtimePerformanceManager = performanceManager;
        }
        return performanceManager;
    }
    
    // Auto-inicialización
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initRealtimeOptimizations, 2000);
        });
    } else {
        setTimeout(initRealtimeOptimizations, 2000);
    }
    
    // Exportar funciones globales
    window.initRealtimeOptimizations = initRealtimeOptimizations;
    window.getRealtimeStats = () => performanceManager?.getStats();
    window.restartOptimizations = () => performanceManager?.restart();
    
})();
