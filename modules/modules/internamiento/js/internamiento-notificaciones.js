// ====================================================================
// MÓDULO DE INTERNAMIENTO - SISTEMA DE NOTIFICACIONES Y MODALES
// ====================================================================

// ================================================================
// NOTIFICACIONES
// ================================================================

InternamientoModule.prototype.showNotification = function(message, type = 'info', duration = 4000) {
    const container = document.getElementById('notificationContainer') || document.body;
    
    const notification = document.createElement('div');
    notification.className = 'internamiento-notification';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        min-width: 300px;
        max-width: 400px;
        padding: 18px 24px;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 15px;
        animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 0.95rem;
        backdrop-filter: blur(10px);
    `;

    // Estilos según tipo
    const styles = {
        success: {
            background: 'linear-gradient(135deg, #27ae60, #229954)',
            icon: 'fa-check-circle',
            color: 'white'
        },
        error: {
            background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
            icon: 'fa-exclamation-circle',
            color: 'white'
        },
        warning: {
            background: 'linear-gradient(135deg, #f39c12, #e67e22)',
            icon: 'fa-exclamation-triangle',
            color: 'white'
        },
        info: {
            background: 'linear-gradient(135deg, #3498db, #2980b9)',
            icon: 'fa-info-circle',
            color: 'white'
        }
    };

    const style = styles[type] || styles.info;

    notification.style.background = style.background;
    notification.style.color = style.color;

    notification.innerHTML = `
        <i class="fas ${style.icon}" style="font-size: 1.5rem; flex-shrink: 0;"></i>
        <div style="flex: 1;">${message}</div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem; padding: 0; opacity: 0.8; transition: opacity 0.2s;">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(notification);

    // Auto-cerrar
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.4s ease';
        setTimeout(() => {
            notification.remove();
        }, 400);
    }, duration);
};

// ================================================================
// MODAL DE CONFIRMACIÓN (Reemplaza confirm())
// ================================================================

InternamientoModule.prototype.showConfirm = function(message, title = '¿Confirmar?', options = {}) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10002;
            backdrop-filter: blur(5px);
            animation: fadeIn 0.3s ease;
        `;

        const icon = options.icon || 'fa-question-circle';
        const iconColor = options.iconColor || '#3498db';
        const confirmText = options.confirmText || 'Aceptar';
        const cancelText = options.cancelText || 'Cancelar';
        const confirmColor = options.confirmColor || '#27ae60';
        const danger = options.danger || false;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 30px;
                border-radius: 16px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                animation: modalSlideUp 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                text-align: center;
            ">
                <div style="margin-bottom: 20px;">
                    <i class="fas ${icon}" style="font-size: 4rem; color: ${danger ? '#e74c3c' : iconColor};"></i>
                </div>
                <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 1.5rem;">${title}</h3>
                <p style="margin: 0 0 30px 0; color: #555; font-size: 1rem; line-height: 1.6; white-space: pre-line;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button class="btn-modal-cancel" style="
                        padding: 12px 30px;
                        border: 2px solid #95a5a6;
                        background: white;
                        color: #555;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 0.95rem;
                        transition: all 0.3s ease;
                    ">
                        <i class="fas fa-times"></i> ${cancelText}
                    </button>
                    <button class="btn-modal-confirm" style="
                        padding: 12px 30px;
                        border: none;
                        background: ${danger ? 'linear-gradient(135deg, #e74c3c, #c0392b)' : `linear-gradient(135deg, ${confirmColor}, ${this.darkenColor(confirmColor)})`};
                        color: white;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 0.95rem;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    ">
                        <i class="fas fa-check"></i> ${confirmText}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        modal.querySelector('.btn-modal-cancel').addEventListener('click', () => {
            modal.remove();
            resolve(false);
        });

        modal.querySelector('.btn-modal-confirm').addEventListener('click', () => {
            modal.remove();
            resolve(true);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(false);
            }
        });

        // Hover effects
        const btnConfirm = modal.querySelector('.btn-modal-confirm');
        btnConfirm.addEventListener('mouseenter', () => {
            btnConfirm.style.transform = 'translateY(-2px)';
            btnConfirm.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
        });
        btnConfirm.addEventListener('mouseleave', () => {
            btnConfirm.style.transform = 'translateY(0)';
            btnConfirm.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        });
    });
};

// ================================================================
// MODAL DE PROMPT (Reemplaza prompt())
// ================================================================

InternamientoModule.prototype.showPrompt = function(message, title = 'Ingrese información', defaultValue = '', required = true) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10002;
            backdrop-filter: blur(5px);
            animation: fadeIn 0.3s ease;
        `;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 30px;
                border-radius: 16px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                animation: modalSlideUp 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            ">
                <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 1.3rem;">
                    <i class="fas fa-edit" style="color: #3498db; margin-right: 10px;"></i>${title}
                </h3>
                <p style="margin: 0 0 20px 0; color: #555; font-size: 0.95rem; white-space: pre-line;">${message}</p>
                <input type="text" id="promptInput" value="${defaultValue}" ${required ? 'required' : ''} 
                       style="
                           width: 100%;
                           padding: 12px;
                           border: 2px solid #e0e0e0;
                           border-radius: 8px;
                           font-size: 0.95rem;
                           transition: all 0.3s ease;
                           margin-bottom: 20px;
                       ">
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-modal-cancel" style="
                        padding: 10px 24px;
                        border: 2px solid #95a5a6;
                        background: white;
                        color: #555;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 0.95rem;
                        transition: all 0.3s ease;
                    ">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button class="btn-modal-ok" style="
                        padding: 10px 24px;
                        border: none;
                        background: linear-gradient(135deg, #3498db, #2980b9);
                        color: white;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 0.95rem;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
                    ">
                        <i class="fas fa-check"></i> Aceptar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const input = modal.querySelector('#promptInput');
        input.focus();
        input.select();

        // Focus effect
        input.addEventListener('focus', () => {
            input.style.borderColor = '#3498db';
            input.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)';
        });

        input.addEventListener('blur', () => {
            input.style.borderColor = '#e0e0e0';
            input.style.boxShadow = 'none';
        });

        const handleOk = () => {
            const value = input.value.trim();
            if (required && value === '') {
                input.style.borderColor = '#e74c3c';
                input.style.animation = 'shake 0.5s';
                return;
            }
            modal.remove();
            resolve(value || null);
        };

        const handleCancel = () => {
            modal.remove();
            resolve(null);
        };

        // Event listeners
        modal.querySelector('.btn-modal-cancel').addEventListener('click', handleCancel);
        modal.querySelector('.btn-modal-ok').addEventListener('click', handleOk);
        
        // Enter para aceptar
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleOk();
            }
        });

        // ESC para cancelar
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                handleCancel();
                document.removeEventListener('keydown', escHandler);
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        });
    });
};

// ================================================================
// MODAL DE ALERTA (Reemplaza alert())
// ================================================================

InternamientoModule.prototype.showAlert = function(message, title = 'Información', type = 'info') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10002;
            backdrop-filter: blur(5px);
            animation: fadeIn 0.3s ease;
        `;

        const icons = {
            success: { icon: 'fa-check-circle', color: '#27ae60' },
            error: { icon: 'fa-times-circle', color: '#e74c3c' },
            warning: { icon: 'fa-exclamation-triangle', color: '#f39c12' },
            info: { icon: 'fa-info-circle', color: '#3498db' }
        };

        const iconData = icons[type] || icons.info;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 30px;
                border-radius: 16px;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                animation: modalSlideUp 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                text-align: center;
            ">
                <div style="margin-bottom: 20px;">
                    <i class="fas ${iconData.icon}" style="font-size: 4rem; color: ${iconData.color};"></i>
                </div>
                <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 1.4rem;">${title}</h3>
                <p style="margin: 0 0 25px 0; color: #555; font-size: 1rem; line-height: 1.6; white-space: pre-line;">${message}</p>
                <button class="btn-modal-ok" style="
                    padding: 12px 40px;
                    border: none;
                    background: linear-gradient(135deg, ${iconData.color}, ${this.darkenColor(iconData.color)});
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 1rem;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                ">
                    <i class="fas fa-check"></i> Entendido
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        const handleClose = () => {
            modal.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                modal.remove();
                resolve(true);
            }, 300);
        };

        modal.querySelector('.btn-modal-ok').addEventListener('click', handleClose);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleClose();
            }
        });

        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape' || e.key === 'Enter') {
                handleClose();
                document.removeEventListener('keydown', escHandler);
            }
        });

        // Hover effect
        const btn = modal.querySelector('.btn-modal-ok');
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        });
    });
};

// ================================================================
// CSS ANIMATIONS
// ================================================================

const styleElement = document.createElement('style');
styleElement.innerHTML = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }

    @keyframes modalSlideUp {
        from {
            transform: translateY(100px) scale(0.9);
            opacity: 0;
        }
        to {
            transform: translateY(0) scale(1);
            opacity: 1;
        }
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }

    .internamiento-notification {
        animation-fill-mode: forwards;
    }
`;

if (!document.getElementById('internamiento-animations')) {
    styleElement.id = 'internamiento-animations';
    document.head.appendChild(styleElement);
}

console.log('📦 Sistema de notificaciones del internamiento cargado');


