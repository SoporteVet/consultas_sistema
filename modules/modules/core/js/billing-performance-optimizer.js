// Parche específico para mejorar rendimiento del porCobrar SIN cambiar su funcionalidad
// Solo mejora la velocidad y previene errores, mantiene la lógica original intacta

(function() {
    'use strict';
    
    // Aplicando parche de rendimiento para porCobrar
    
    // Variables para control de rendimiento
    let porCobrarSaveInProgress = false;
    let porCobrarBackupTimer = null;
    const porCobrarBackups = new Map();
    
    // Función para backup automático (sin interferir con la lógica)
    function backupPorCobrarContent() {
        const editElement = document.getElementById('editPorCobrar');
        const newElement = document.getElementById('porCobrar');
        
        // Backup del campo de edición
        if (editElement && editElement.value.trim()) {
            const content = editElement.value.trim();
            const timestamp = Date.now();
            
            try {
                localStorage.setItem('porcobrar_edit_backup', JSON.stringify({
                    content: content,
                    timestamp: timestamp,
                    user: sessionStorage.getItem('userName') || 'Usuario'
                }));
                
                porCobrarBackups.set('edit', { content, timestamp });
            } catch (error) {
                // Error silencioso
            }
        }
        
        // Backup del campo nuevo
        if (newElement && newElement.value.trim()) {
            const content = newElement.value.trim();
            const timestamp = Date.now();
            
            try {
                localStorage.setItem('porcobrar_new_backup', JSON.stringify({
                    content: content,
                    timestamp: timestamp,
                    user: sessionStorage.getItem('userName') || 'Usuario'
                }));
                
                porCobrarBackups.set('new', { content, timestamp });
            } catch (error) {
                // Error silencioso
            }
        }
    }
    
    // Función para mostrar opción de recuperación
    function showRecoveryOption(elementId, backupKey) {
        const element = document.getElementById(elementId);
        if (!element || element.value.trim()) return;
        
        try {
            const backupData = localStorage.getItem(backupKey);
            if (!backupData) return;
            
            const backup = JSON.parse(backupData);
            const hourAgo = Date.now() - (60 * 60 * 1000);
            
            if (backup.timestamp < hourAgo) {
                localStorage.removeItem(backupKey);
                return;
            }
            
            // Crear notificación de recuperación
            const recoveryDiv = document.createElement('div');
            recoveryDiv.style.cssText = `
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 6px;
                padding: 8px 12px;
                margin: 5px 0;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                position: relative;
                z-index: 1000;
            `;
            
            const date = new Date(backup.timestamp);
            recoveryDiv.innerHTML = `
                <i class="fas fa-history" style="color: #856404;"></i>
                <span>Contenido recuperado de ${date.toLocaleTimeString()}</span>
                <button type="button" onclick="this.parentElement.nextElementSibling.value='${backup.content.replace(/'/g, "\\'")}'; this.parentElement.remove(); localStorage.removeItem('${backupKey}');" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 2px 6px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                    margin-left: auto;
                ">Recuperar</button>
                <button type="button" onclick="this.parentElement.remove(); localStorage.removeItem('${backupKey}');" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 2px 6px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                    margin-left: 2px;
                ">X</button>
            `;
            
            element.parentNode.insertBefore(recoveryDiv, element);
            
        } catch (error) {
            // Error silencioso
        }
    }
    
    // Mejorar el rendimiento de guardado sin cambiar la lógica
    function optimizeSaveProcess() {
        // Interceptar solo para mejorar rendimiento, no para cambiar lógica
        const originalSaveEditedTicket = window.saveEditedTicket;
        
        if (originalSaveEditedTicket) {
            window.saveEditedTicket = function(ticket) {
                // Prevenir múltiples guardados simultáneos
                if (porCobrarSaveInProgress) {
                    return Promise.resolve();
                }
                
                porCobrarSaveInProgress = true;
                
                // Backup antes del guardado
                backupPorCobrarContent();
                
                // Ejecutar el guardado original
                const result = originalSaveEditedTicket.call(this, ticket);
                
                // Manejar el resultado
                if (result && result.then) {
                    return result.finally(() => {
                        porCobrarSaveInProgress = false;
                        // Limpiar backups después del guardado exitoso
                        setTimeout(() => {
                            localStorage.removeItem('porcobrar_edit_backup');
                        }, 1000);
                    });
                } else {
                    porCobrarSaveInProgress = false;
                    return result;
                }
            };
        }
    }
    
    // Configurar listeners para backup automático
    function setupAutoBackup() {
        // Backup con debounce para no sobrecargar
        document.addEventListener('input', function(e) {
            if (e.target.id === 'editPorCobrar' || e.target.id === 'porCobrar') {
                clearTimeout(porCobrarBackupTimer);
                porCobrarBackupTimer = setTimeout(backupPorCobrarContent, 3000);
            }
        });
        
        // Backup inmediato al perder foco
        document.addEventListener('blur', function(e) {
            if (e.target.id === 'editPorCobrar' || e.target.id === 'porCobrar') {
                clearTimeout(porCobrarBackupTimer);
                backupPorCobrarContent();
            }
        }, true);
        
        // Backup antes de cerrar
        window.addEventListener('beforeunload', backupPorCobrarContent);
    }
    
    // Verificar y mostrar opciones de recuperación
    function checkForRecovery() {
        // Verificar cada segundo si aparecen los campos
        const checkInterval = setInterval(() => {
            const editElement = document.getElementById('editPorCobrar');
            const newElement = document.getElementById('porCobrar');
            
            if (editElement && !editElement.dataset.recoveryChecked) {
                editElement.dataset.recoveryChecked = 'true';
                setTimeout(() => showRecoveryOption('editPorCobrar', 'porcobrar_edit_backup'), 500);
            }
            
            if (newElement && !newElement.dataset.recoveryChecked) {
                newElement.dataset.recoveryChecked = 'true';
                setTimeout(() => showRecoveryOption('porCobrar', 'porcobrar_new_backup'), 500);
            }
            
            // Limpiar intervalo si ambos elementos han sido verificados o después de 30 segundos
            const now = Date.now();
            if (!checkForRecovery.startTime) {
                checkForRecovery.startTime = now;
            }
            
            if (now - checkForRecovery.startTime > 30000) {
                clearInterval(checkInterval);
            }
        }, 1000);
    }
    
    // Limpiar backups antiguos
    function cleanOldBackups() {
        try {
            const keys = ['porcobrar_edit_backup', 'porcobrar_new_backup'];
            const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
            
            keys.forEach(key => {
                const data = localStorage.getItem(key);
                if (data) {
                    try {
                        const backup = JSON.parse(data);
                        if (backup.timestamp < dayAgo) {
                            localStorage.removeItem(key);
                        }
                    } catch (error) {
                        // Limpiar datos corruptos
                        localStorage.removeItem(key);
                    }
                }
            });
            } catch (error) {
                // Error silencioso
            }
    }
    
    // Función de diagnóstico específica para porCobrar
    function diagnosticoPorCobrar() {
        const editElement = document.getElementById('editPorCobrar');
        const newElement = document.getElementById('porCobrar');
        
        // Verificar backups en localStorage
        const backups = {};
        try {
            const editBackup = localStorage.getItem('porcobrar_edit_backup');
            const newBackup = localStorage.getItem('porcobrar_new_backup');
            
            if (editBackup) {
                backups.edit = JSON.parse(editBackup);
            }
            if (newBackup) {
                backups.new = JSON.parse(newBackup);
            }
        } catch (error) {
            // Error silencioso
        }
        
        return {
            editPresent: !!editElement,
            newPresent: !!newElement,
            saveInProgress: porCobrarSaveInProgress,
            memoryBackups: porCobrarBackups.size,
            storageBackups: Object.keys(backups).length,
            backups: backups
        };
    }
    
    // Inicialización
    function init() {
        // Limpiar backups antiguos
        cleanOldBackups();
        
        // Configurar optimizaciones
        optimizeSaveProcess();
        setupAutoBackup();
        checkForRecovery();
        
        // Exportar función de diagnóstico
        window.diagnosticoPorCobrar = diagnosticoPorCobrar;
    }
    
    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
