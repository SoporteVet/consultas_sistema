// Firebase Real-time Optimizer Module
// Optimiza la sincronización en tiempo real y previene pérdida de datos

class FirebaseRealtimeOptimizer {
    constructor() {
        this.listeners = new Map();
        this.updateQueue = new Map();
        this.processingUpdates = new Set();
        this.debounceTimers = new Map();
        this.connectionStatus = false;
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.retryDelay = 1000;
        
        this.init();
    }
    
    init() {
        this.setupConnectionMonitoring();
        this.setupGlobalErrorHandling();
        this.optimizeFirebaseListeners();
    }
    
    // Monitoreo de conexión mejorado
    setupConnectionMonitoring() {
        if (!window.database) return;
        
        const connectedRef = window.database.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            this.connectionStatus = snap.val() === true;
            
            if (this.connectionStatus) {
                this.onReconnected();
            } else {
                this.onDisconnected();
            }
        });
    }
    
    onReconnected() {
        console.log('🟢 Firebase reconectado - Procesando cola de actualizaciones');
        this.processUpdateQueue();
        this.hideConnectionError();
    }
    
    onDisconnected() {
        console.log('🔴 Firebase desconectado - Modo offline activado');
        this.showConnectionError();
    }
    
    showConnectionError() {
        const existingError = document.getElementById('firebase-realtime-error');
        if (existingError) return;
        
        const errorDiv = document.createElement('div');
        errorDiv.id = 'firebase-realtime-error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff5722;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            animation: slideIn 0.3s ease-out;
        `;
        errorDiv.innerHTML = `
            <i class="fas fa-wifi" style="animation: pulse 1s infinite;"></i>
            <span>Reconectando... Los datos se guardarán automáticamente</span>
        `;
        
        document.body.appendChild(errorDiv);
    }
    
    hideConnectionError() {
        const errorDiv = document.getElementById('firebase-realtime-error');
        if (errorDiv) {
            errorDiv.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => errorDiv.remove(), 300);
        }
    }
    
    // Manejo global de errores
    setupGlobalErrorHandling() {
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && event.reason.code && event.reason.code.startsWith('FIREBASE')) {
                console.error('Firebase Error:', event.reason);
                this.handleFirebaseError(event.reason);
                event.preventDefault();
            }
        });
    }
    
    handleFirebaseError(error) {
        const errorCode = error.code;
        let message = 'Error de conexión con Firebase';
        
        switch (errorCode) {
            case 'FIREBASE_NETWORK_ERROR':
                message = 'Error de red. Verificando conexión...';
                break;
            case 'FIREBASE_PERMISSION_DENIED':
                message = 'Permisos insuficientes. Contacte al administrador.';
                break;
            case 'FIREBASE_DISCONNECTED':
                message = 'Desconectado. Reconectando automáticamente...';
                break;
        }
        
        this.showNotification(message, 'warning');
    }
    
    // Optimización de listeners de Firebase
    optimizeFirebaseListeners() {
        this.optimizeTicketsListener();
        this.optimizeLabTicketsListener();
        this.optimizeQuirofanoListener();
    }
    
    optimizeTicketsListener() {
        if (!window.ticketsRef) return;
        
        // Limpiar listeners anteriores
        this.cleanupListener('tickets');
        
        // Listener optimizado para tickets principales
        const ticketsListener = {
            ref: window.ticketsRef,
            handlers: {
                value: this.debounce((snapshot) => {
                    this.handleTicketsSnapshot(snapshot);
                }, 300),
                
                child_added: this.debounce((snapshot) => {
                    this.handleTicketAdded(snapshot);
                }, 100),
                
                child_changed: this.debounce((snapshot) => {
                    this.handleTicketChanged(snapshot);
                }, 200),
                
                child_removed: (snapshot) => {
                    this.handleTicketRemoved(snapshot);
                }
            }
        };
        
        // Configurar listeners
        Object.entries(ticketsListener.handlers).forEach(([event, handler]) => {
            ticketsListener.ref.on(event, handler);
        });
        
        this.listeners.set('tickets', ticketsListener);
    }
    
    optimizeLabTicketsListener() {
        // Optimizar listeners de laboratorio si existen
        if (!window.labTicketsRef) {
            return;
        }
        
        // Limpiar listeners anteriores
        this.cleanupListener('lab');
        
        // Listener optimizado para tickets de laboratorio
        const labListener = {
            ref: window.labTicketsRef,
            handlers: {
                value: this.debounce((snapshot) => {
                    this.handleLabTicketsSnapshot(snapshot);
                }, 300),
                
                child_added: this.debounce((snapshot) => {
                    this.handleLabTicketAdded(snapshot);
                }, 100),
                
                child_changed: this.debounce((snapshot) => {
                    this.handleLabTicketChanged(snapshot);
                }, 200)
            }
        };
        
        // Configurar listeners
        Object.entries(labListener.handlers).forEach(([event, handler]) => {
            labListener.ref.on(event, handler);
        });
        
        this.listeners.set('lab', labListener);
    }
    
    optimizeQuirofanoListener() {
        // Optimizar listeners de quirófano si existen
        if (!window.quirofanoFirebaseRef) {
            return;
        }
        
        // Limpiar listeners anteriores
        this.cleanupListener('quirofano');
        
        // Listener optimizado para tickets de quirófano
        const quirofanoListener = {
            ref: window.quirofanoFirebaseRef,
            handlers: {
                value: this.debounce((snapshot) => {
                    this.handleQuirofanoSnapshot(snapshot);
                }, 300)
            }
        };
        
        // Configurar listeners
        Object.entries(quirofanoListener.handlers).forEach(([event, handler]) => {
            quirofanoListener.ref.on(event, handler);
        });
        
        this.listeners.set('quirofano', quirofanoListener);
    }
    
    handleTicketsSnapshot(snapshot) {
        if (!snapshot.exists()) return;
        
        const data = snapshot.val();
        const newTickets = [];
        let maxId = 0;
        
        Object.entries(data).forEach(([key, ticket]) => {
            if (ticket && ticket.id != null && ticket.mascota) {
                const ticketWithKey = { ...ticket, firebaseKey: key };
                newTickets.push(ticketWithKey);
                
                if (ticket.id > maxId) {
                    maxId = ticket.id;
                }
            }
        });
        
        // Actualizar de manera atómica
        window.tickets = newTickets;
        if (window.currentTicketId <= maxId) {
            window.currentTicketId = maxId + 1;
        }
        
        // Actualizar UI de manera eficiente
        this.updateUI('tickets');
    }
    
    handleTicketAdded(snapshot) {
        const ticket = snapshot.val();
        if (!ticket || !ticket.mascota || ticket.id == null) {
            // Limpiar ticket inválido
            snapshot.ref.remove();
            return;
        }
        
        const ticketWithKey = { ...ticket, firebaseKey: snapshot.key };
        
        // Evitar duplicados
        if (!window.tickets.some(t => t.firebaseKey === ticketWithKey.firebaseKey)) {
            window.tickets.push(ticketWithKey);
            this.updateUI('tickets', 'add', ticketWithKey);
        }
    }
    
    handleTicketChanged(snapshot) {
        const updatedTicket = { ...snapshot.val(), firebaseKey: snapshot.key };
        
        // Encontrar y actualizar ticket
        const index = window.tickets.findIndex(t => t.firebaseKey === updatedTicket.firebaseKey);
        if (index !== -1) {
            // Preservar datos importantes durante la actualización
            const existingTicket = window.tickets[index];
            const mergedTicket = this.mergeTicketData(existingTicket, updatedTicket);
            
            window.tickets[index] = mergedTicket;
            this.updateUI('tickets', 'change', mergedTicket);
        }
    }
    
    handleTicketRemoved(snapshot) {
        const firebaseKey = snapshot.key;
        const index = window.tickets.findIndex(t => t.firebaseKey === firebaseKey);
        
        if (index !== -1) {
            const removedTicket = window.tickets[index];
            window.tickets.splice(index, 1);
            this.updateUI('tickets', 'remove', removedTicket);
        }
    }
    
    // Merge inteligente de datos de tickets
    mergeTicketData(existing, updated) {
        // Campos que requieren preservación especial
        const preserveFields = ['porCobrarHistory', 'editHistory', 'createdBy', 'createdAt'];
        const merged = { ...updated };
        
        // Preservar campos importantes
        preserveFields.forEach(field => {
            if (existing[field] && !updated[field]) {
                merged[field] = existing[field];
            }
        });
        
        // NO INTERFERIR con porCobrar - El sistema original ya lo maneja correctamente
        // El campo porCobrar se acumula automáticamente con fecha/hora en el código original
        
        return merged;
    }
    
    // Handlers para laboratorio
    handleLabTicketsSnapshot(snapshot) {
        if (!snapshot.exists()) return;
        
        try {
            const data = snapshot.val();
            const newLabTickets = [];
            let maxId = 0;
            
            Object.entries(data).forEach(([key, ticket]) => {
                if (ticket && ticket.id != null) {
                    const ticketWithKey = { ...ticket, firebaseKey: key };
                    newLabTickets.push(ticketWithKey);
                    
                    if (ticket.id > maxId) {
                        maxId = ticket.id;
                    }
                }
            });
            
            // Actualizar arrays globales si existen
            if (window.labTickets !== undefined) {
                window.labTickets = newLabTickets;
            }
            
            if (window.currentLabTicketId !== undefined && window.currentLabTicketId <= maxId) {
                window.currentLabTicketId = maxId + 1;
            }
            
            this.updateUI('lab');
            
        } catch (error) {
            // Error silencioso
        }
    }
    
    handleLabTicketAdded(snapshot) {
        const ticket = snapshot.val();
        if (!ticket || ticket.id == null) return;
        
        const ticketWithKey = { ...ticket, firebaseKey: snapshot.key };
        
        if (window.labTickets && !window.labTickets.some(t => t.firebaseKey === ticketWithKey.firebaseKey)) {
            window.labTickets.push(ticketWithKey);
            this.updateUI('lab', 'add', ticketWithKey);
        }
    }
    
    handleLabTicketChanged(snapshot) {
        const updatedTicket = { ...snapshot.val(), firebaseKey: snapshot.key };
        
        if (window.labTickets) {
            const index = window.labTickets.findIndex(t => t.firebaseKey === updatedTicket.firebaseKey);
            if (index !== -1) {
                window.labTickets[index] = updatedTicket;
                this.updateUI('lab', 'change', updatedTicket);
            }
        }
    }
    
    // Handlers para quirófano
    handleQuirofanoSnapshot(snapshot) {
        if (!snapshot.exists()) return;
        
        try {
            const tickets = [];
            
            snapshot.forEach((childSnapshot) => {
                const ticket = {
                    firebaseKey: childSnapshot.key,
                    ...childSnapshot.val()
                };
                tickets.push(ticket);
            });
            
            // Actualizar array global si existe
            if (window.quirofanoTickets !== undefined) {
                window.quirofanoTickets = tickets;
            }
            
            this.updateUI('quirofano');
            
        } catch (error) {
            // Error silencioso
        }
    }
    
    // Actualización de UI optimizada
    updateUI(type, action = 'refresh', data = null) {
        // Debounce para evitar actualizaciones excesivas
        const updateKey = `${type}_${action}`;
        
        if (this.debounceTimers.has(updateKey)) {
            clearTimeout(this.debounceTimers.get(updateKey));
        }
        
        this.debounceTimers.set(updateKey, setTimeout(() => {
            this.performUIUpdate(type, action, data);
            this.debounceTimers.delete(updateKey);
        }, action === 'add' ? 50 : 200));
    }
    
    performUIUpdate(type, action, data) {
        try {
            switch (type) {
                case 'tickets':
                    this.updateTicketsUI(action, data);
                    break;
                case 'lab':
                    this.updateLabUI(action, data);
                    break;
                case 'quirofano':
                    this.updateQuirofanoUI(action, data);
                    break;
            }
        } catch (error) {
            // Error silencioso
        }
    }
    
    updateTicketsUI(action, data) {
        // Actualizar vista principal de tickets
        if (typeof window.renderTickets === 'function') {
            const currentFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'todos';
            window.renderTickets(currentFilter);
        }
        
        // Actualizar estadísticas
        if (typeof window.updateStatsGlobal === 'function') {
            window.updateStatsGlobal();
        }
        
        // Actualizar contador prequirúrgico
        if (typeof window.updatePrequirurgicoCounter === 'function') {
            window.updatePrequirurgicoCounter();
        }
        
        // Actualizar horario si está activo
        const horarioSection = document.getElementById('horarioSection');
        if (horarioSection && !horarioSection.classList.contains('hidden')) {
            if (typeof window.mostrarHorario === 'function') {
                window.mostrarHorario();
            }
        }
    }
    
    updateLabUI(action, data) {
        // Actualizar vista de laboratorio si está activa
        const labSection = document.getElementById('verLabSection');
        if (labSection && !labSection.classList.contains('hidden')) {
            if (typeof window.renderLabTickets === 'function') {
                window.renderLabTickets();
            } else if (typeof window.loadLabTickets === 'function') {
                window.loadLabTickets();
            }
        }
        
        // Actualizar estadísticas de laboratorio si existen
        if (typeof window.updateLabStats === 'function') {
            window.updateLabStats();
        }
    }
    
    updateQuirofanoUI(action, data) {
        // Actualizar vista de quirófano si está activa
        const quirofanoSection = document.getElementById('verQuirofanoSection');
        if (quirofanoSection && !quirofanoSection.classList.contains('hidden')) {
            if (typeof window.renderQuirofanoTickets === 'function') {
                window.renderQuirofanoTickets();
            } else if (typeof window.renderQuirofanoTicketsWithDateFilter === 'function') {
                window.renderQuirofanoTicketsWithDateFilter(window.currentQuirofanoFilter || '', '', '');
            }
        }
        
        // Actualizar contador prequirúrgico
        if (typeof window.updatePrequirurgicoCounter === 'function') {
            window.updatePrequirurgicoCounter();
        }
    }
    
    // Sistema de cola para actualizaciones offline
    queueUpdate(ref, data, operation = 'update') {
        const queueKey = `${ref.path}_${Date.now()}`;
        
        this.updateQueue.set(queueKey, {
            ref,
            data,
            operation,
            timestamp: Date.now(),
            attempts: 0
        });
        
        // Si estamos online, procesar inmediatamente
        if (this.connectionStatus) {
            this.processUpdateQueue();
        }
    }
    
    async processUpdateQueue() {
        if (this.updateQueue.size === 0) return;
        
        const updates = Array.from(this.updateQueue.entries());
        
        for (const [queueKey, updateInfo] of updates) {
            try {
                await this.executeQueuedUpdate(queueKey, updateInfo);
                this.updateQueue.delete(queueKey);
            } catch (error) {
                this.handleQueuedUpdateError(queueKey, updateInfo, error);
            }
        }
    }
    
    async executeQueuedUpdate(queueKey, updateInfo) {
        const { ref, data, operation } = updateInfo;
        
        switch (operation) {
            case 'update':
                await ref.update(data);
                break;
            case 'set':
                await ref.set(data);
                break;
            case 'push':
                await ref.push(data);
                break;
            case 'remove':
                await ref.remove();
                break;
        }
    }
    
    handleQueuedUpdateError(queueKey, updateInfo, error) {
        updateInfo.attempts++;
        
        if (updateInfo.attempts < this.maxRetries) {
            // Reintentar con delay exponencial
            setTimeout(() => {
                this.processUpdateQueue();
            }, this.retryDelay * Math.pow(2, updateInfo.attempts));
        } else {
            // Falló después de todos los intentos
            console.error('Failed to sync update after retries:', error);
            this.updateQueue.delete(queueKey);
            this.showNotification('Error al sincronizar datos. Algunos cambios pueden perderse.', 'error');
        }
    }
    
    // Función de debounce mejorada
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Limpieza de listeners
    cleanupListener(type) {
        if (this.listeners.has(type)) {
            const listener = this.listeners.get(type);
            Object.entries(listener.handlers).forEach(([event, handler]) => {
                listener.ref.off(event, handler);
            });
            this.listeners.delete(type);
        }
    }
    
    // MÉTODO ELIMINADO - No interferir con la lógica original del porCobrar
    // El sistema original ya maneja correctamente la acumulación de entradas con fecha/hora
    
    // Método para mostrar notificaciones
    showNotification(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    // Método de limpieza general
    cleanup() {
        // Limpiar todos los listeners
        for (const [type, listener] of this.listeners) {
            this.cleanupListener(type);
        }
        
        // Limpiar timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        
        // Limpiar colas
        this.updateQueue.clear();
        this.processingUpdates.clear();
    }
    
    // Método para obtener estadísticas de sincronización
    getSyncStats() {
        return {
            connectionStatus: this.connectionStatus,
            activeListeners: this.listeners.size,
            queuedUpdates: this.updateQueue.size,
            processingUpdates: this.processingUpdates.size,
            pendingDebounces: this.debounceTimers.size
        };
    }
}

// Inicializar el optimizador cuando Firebase esté listo
let firebaseOptimizer;

// Función de inicialización
function initFirebaseOptimizer() {
    if (window.database && !firebaseOptimizer) {
        firebaseOptimizer = new FirebaseRealtimeOptimizer();
        window.firebaseOptimizer = firebaseOptimizer;
        console.log('🚀 Firebase Real-time Optimizer iniciado');
    }
}

// Auto-inicialización
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initFirebaseOptimizer, 1000);
    });
} else {
    setTimeout(initFirebaseOptimizer, 1000);
}

// Exportar para uso manual
window.initFirebaseOptimizer = initFirebaseOptimizer;

// Agregar estilos CSS para animaciones
const styles = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
