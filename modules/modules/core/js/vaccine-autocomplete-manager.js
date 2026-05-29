// ====================================================================
// MÓDULO DE AUTOCOMPLETADO Y REGISTRO AUTOMÁTICO DE VACUNAS
// ====================================================================
// Este módulo detecta vacunas escritas en el campo "por cobrar" y permite:
// - Autocompletado mientras se escribe
// - Detección de múltiples vacunas y cantidades
// - Descuento automático del inventario
// - Registro automático en el módulo de vacunas
// ====================================================================

class VaccineAutocompleteManager {
    constructor() {
        this.database = null;
        this.currentTicket = null;
        this.autocompleteContainer = null;
        this.detectedVaccines = [];
        
        // Diccionario de vacunas con sinónimos y variaciones
        this.vaccinesDictionary = {
            'Mult': {
                patterns: [
                    /\b(mult|múlt|multiple|vacuna\s+mult|vac\s+mult|v\s+mult)\b/gi,
                    /\b(vacuna\s+multiple|vacuna\s+múltiple)\b/gi
                ],
                name: 'Mult',
                category: 'anual'
            },
            'Puppy': {
                patterns: [
                    /\b(puppy|pupy|papi|vacuna\s+puppy|vac\s+puppy|v\s+puppy)\b/gi,
                    /\b(vacuna\s+cachorro)\b/gi
                ],
                name: 'Puppy',
                category: 'anual'
            },
            'Rab': {
                patterns: [
                    /\b(rab|rabia|rabies|vacuna\s+rab|vac\s+rab|v\s+rab)\b/gi,
                    /\b(vacuna\s+rabia|vacuna\s+antirrábica|antirrábica)\b/gi
                ],
                name: 'Rab',
                category: 'anual'
            },
            'Tos': {
                patterns: [
                    /\b(tos|kennel|vacuna\s+tos|vac\s+tos|v\s+tos)\b/gi,
                    /\b(vacuna\s+kennel|traqueobronquitis)\b/gi
                ],
                name: 'Tos',
                category: 'anual'
            },
            'Giardia': {
                patterns: [
                    /\b(giardia|giardias|vacuna\s+giardia|vac\s+giardia|v\s+giardia)\b/gi
                ],
                name: 'Giardia',
                category: 'anual'
            },
            'C4': {
                patterns: [
                    /\b(c4|c\-4|vacuna\s+c4|vac\s+c4|v\s+c4)\b/gi
                ],
                name: 'C4',
                category: 'anual'
            },
            'C6': {
                patterns: [
                    /\b(c6|c\-6|vacuna\s+c6|vac\s+c6|v\s+c6)\b/gi
                ],
                name: 'C6',
                category: 'anual'
            },
            'Vacuna Anual': {
                patterns: [
                    /\b(vacuna\s+anual|vac\s+anual|v\s+anual|anual)\b/gi
                ],
                name: 'Vacuna Anual',
                category: 'anual'
            },
            'Trip/Leu': {
                patterns: [
                    /\b(trip\/leu|triple\s+leu|trip\s+leu|vacuna\s+trip\/leu)\b/gi,
                    /\b(triple\s+leucemia|triplefelina\s+leucemia)\b/gi
                ],
                name: 'Trip/Leu',
                category: 'trimestral'
            },
            'Trip/Rab': {
                patterns: [
                    /\b(trip\/rab|triple\s+rab|trip\s+rab|vacuna\s+trip\/rab)\b/gi,
                    /\b(triple\s+rabia|triplefelina\s+rabia)\b/gi
                ],
                name: 'Trip/Rab',
                category: 'trimestral'
            },
            'Leu': {
                patterns: [
                    /\b(leu|leucemia|vacuna\s+leu|vac\s+leu|v\s+leu)\b/gi,
                    /\b(vacuna\s+leucemia)\b/gi
                ],
                name: 'Leu',
                category: 'trimestral'
            },
            'Triple Felina': {
                patterns: [
                    /\b(triple\s+felina|triplefelina|trip\s+fel|vacuna\s+triple\s+felina)\b/gi,
                    /\b(vac\s+triple\s+felina|v\s+triple\s+felina)\b/gi
                ],
                name: 'Triple Felina',
                category: 'trimestral'
            }
        };
        
        // Lista plana para autocompletado rápido
        this.vaccinesList = Object.values(this.vaccinesDictionary).map(v => v.name);
    }
    
    initialize(firebaseDatabase) {
        this.database = firebaseDatabase;
        this.createAutocompleteUI();
        console.log('VaccineAutocompleteManager inicializado');
    }
    
    // Crear la interfaz de autocompletado
    createAutocompleteUI() {
        // Crear contenedor de autocompletado si no existe
        if (!document.getElementById('vaccineAutocompleteContainer')) {
            const container = document.createElement('div');
            container.id = 'vaccineAutocompleteContainer';
            container.className = 'vaccine-autocomplete-container';
            container.style.display = 'none';
            document.body.appendChild(container);
            this.autocompleteContainer = container;
        }
    }
    
    // Activar autocompletado en un campo de texto
    attachToField(fieldElement, ticketData) {
        if (!fieldElement) return;
        
        this.currentTicket = ticketData;
        
        // Remover listeners previos si existen
        const newField = fieldElement.cloneNode(true);
        fieldElement.parentNode.replaceChild(newField, fieldElement);
        
        // Agregar eventos
        newField.addEventListener('input', (e) => this.handleInput(e, newField));
        newField.addEventListener('keydown', (e) => this.handleKeydown(e));
        newField.addEventListener('blur', () => {
            // Delay para permitir clicks en el autocompletado
            setTimeout(() => this.hideAutocomplete(), 200);
        });
        
        console.log('Autocompletado de vacunas activado en campo');
        
        return newField;
    }
    
    // Manejar input del usuario
    handleInput(event, field) {
        const value = field.value;
        const cursorPosition = field.selectionStart;
        
        // Obtener la palabra actual bajo el cursor
        const textBeforeCursor = value.substring(0, cursorPosition);
        const textAfterCursor = value.substring(cursorPosition);
        
        // Buscar la última palabra escrita
        const words = textBeforeCursor.split(/\s+/);
        const currentWord = words[words.length - 1].toLowerCase();
        
        if (currentWord.length < 2) {
            this.hideAutocomplete();
            return;
        }
        
        // Buscar coincidencias
        const matches = this.findMatches(currentWord);
        
        if (matches.length > 0) {
            this.showAutocomplete(matches, field, currentWord);
        } else {
            this.hideAutocomplete();
        }
    }
    
    // Buscar vacunas que coincidan con el texto
    findMatches(searchText) {
        const matches = [];
        
        for (const [key, vaccine] of Object.entries(this.vaccinesDictionary)) {
            const nameLower = vaccine.name.toLowerCase();
            if (nameLower.includes(searchText)) {
                matches.push({
                    name: vaccine.name,
                    category: vaccine.category,
                    highlight: this.highlightMatch(vaccine.name, searchText)
                });
            }
        }
        
        return matches;
    }
    
    // Resaltar coincidencias en el texto
    highlightMatch(text, search) {
        const regex = new RegExp(`(${search})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    }
    
    // Mostrar lista de autocompletado
    showAutocomplete(matches, field, searchText) {
        if (!this.autocompleteContainer) return;
        
        // Calcular posición
        const rect = field.getBoundingClientRect();
        this.autocompleteContainer.style.top = `${rect.bottom + window.scrollY}px`;
        this.autocompleteContainer.style.left = `${rect.left + window.scrollX}px`;
        this.autocompleteContainer.style.width = `${rect.width}px`;
        
        // Crear items
        this.autocompleteContainer.innerHTML = matches.map(match => `
            <div class="vaccine-autocomplete-item" data-vaccine="${match.name}">
                <i class="fas fa-syringe"></i>
                <span>${match.highlight}</span>
                <span class="vaccine-category">${match.category === 'anual' ? 'Anual' : 'Trimestral'}</span>
            </div>
        `).join('');
        
        // Agregar eventos de click
        this.autocompleteContainer.querySelectorAll('.vaccine-autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const vaccineName = item.dataset.vaccine;
                this.insertVaccine(field, searchText, vaccineName);
                this.hideAutocomplete();
            });
        });
        
        this.autocompleteContainer.style.display = 'block';
    }
    
    // Ocultar autocompletado
    hideAutocomplete() {
        if (this.autocompleteContainer) {
            this.autocompleteContainer.style.display = 'none';
        }
    }
    
    // Insertar vacuna seleccionada en el campo
    insertVaccine(field, searchText, vaccineName) {
        const value = field.value;
        const cursorPosition = field.selectionStart;
        
        // Reemplazar la palabra actual con el nombre de la vacuna
        const textBeforeCursor = value.substring(0, cursorPosition);
        const textAfterCursor = value.substring(cursorPosition);
        
        const words = textBeforeCursor.split(/\s+/);
        words[words.length - 1] = vaccineName;
        
        const newValue = words.join(' ') + textAfterCursor;
        field.value = newValue;
        
        // Posicionar cursor después de la vacuna
        const newCursorPos = words.join(' ').length;
        field.setSelectionRange(newCursorPos, newCursorPos);
        field.focus();
    }
    
    // Manejar teclas especiales
    handleKeydown(event) {
        if (!this.autocompleteContainer || this.autocompleteContainer.style.display === 'none') {
            return;
        }
        
        const items = this.autocompleteContainer.querySelectorAll('.vaccine-autocomplete-item');
        if (items.length === 0) return;
        
        // Encontrar item seleccionado actual
        let selectedIndex = -1;
        items.forEach((item, index) => {
            if (item.classList.contains('selected')) {
                selectedIndex = index;
            }
        });
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                this.selectAutocompleteItem(items, selectedIndex);
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                this.selectAutocompleteItem(items, selectedIndex);
                break;
                
            case 'Enter':
                if (selectedIndex >= 0) {
                    event.preventDefault();
                    items[selectedIndex].click();
                }
                break;
                
            case 'Escape':
                this.hideAutocomplete();
                break;
        }
    }
    
    // Seleccionar item en la lista
    selectAutocompleteItem(items, index) {
        items.forEach((item, i) => {
            if (i === index) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    // Detectar vacunas en el texto cuando se guarda
    async detectVaccinesInText(text, ticketData) {
        this.detectedVaccines = [];
        
        if (!text || text.trim().length === 0) {
            return [];
        }
        
        // Detectar cantidades con vacunas (ej: "2 vacunas puppy", "3 mult")
        const quantityPattern = /(\d+)\s*(vacunas?|vac|v)?\s*([a-záéíóúñ\/\-\s]+)/gi;
        let match;
        
        while ((match = quantityPattern.exec(text)) !== null) {
            const quantity = parseInt(match[1]);
            const vaccineName = match[3].trim();
            
            // Buscar la vacuna en el diccionario
            const vaccine = this.findVaccineByText(vaccineName);
            if (vaccine) {
                this.detectedVaccines.push({
                    name: vaccine.name,
                    category: vaccine.category,
                    quantity: quantity,
                    match: match[0]
                });
            }
        }
        
        // Detectar vacunas individuales sin cantidad explícita
        for (const [key, vaccine] of Object.entries(this.vaccinesDictionary)) {
            for (const pattern of vaccine.patterns) {
                const matches = text.matchAll(pattern);
                for (const match of matches) {
                    // Verificar que no esté ya detectada con cantidad
                    const alreadyDetected = this.detectedVaccines.some(v => 
                        v.name === vaccine.name && 
                        match.index >= v.match.index - 10 && 
                        match.index <= v.match.index + v.match.length + 10
                    );
                    
                    if (!alreadyDetected) {
                        this.detectedVaccines.push({
                            name: vaccine.name,
                            category: vaccine.category,
                            quantity: 1,
                            match: match[0]
                        });
                    }
                }
            }
        }
        
        // Eliminar duplicados
        const uniqueVaccines = [];
        const seen = new Set();
        
        for (const vaccine of this.detectedVaccines) {
            const key = `${vaccine.name}_${vaccine.quantity}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueVaccines.push(vaccine);
            }
        }
        
        this.detectedVaccines = uniqueVaccines;
        
        // Si se detectaron vacunas, obtener inventario disponible
        if (this.detectedVaccines.length > 0) {
            await this.enrichWithInventoryData();
        }
        
        return this.detectedVaccines;
    }
    
    // Buscar vacuna por texto usando el diccionario
    findVaccineByText(text) {
        const textLower = text.toLowerCase().trim();
        
        for (const [key, vaccine] of Object.entries(this.vaccinesDictionary)) {
            for (const pattern of vaccine.patterns) {
                if (pattern.test(text)) {
                    return vaccine;
                }
            }
        }
        
        return null;
    }
    
    // Enriquecer datos con inventario disponible
    async enrichWithInventoryData() {
        try {
            // Obtener turno actual
            const currentShift = await this.getCurrentShift();
            
            if (!currentShift) {
                console.log('No hay turno de vacunas abierto');
                return;
            }
            
            // Obtener inventario del turno
            const inventoryRef = this.database.ref(`inventarioTurnos/${currentShift.key}/inventario`);
            const snapshot = await inventoryRef.once('value');
            const inventory = snapshot.val() || {};
            
            // Agregar información de inventario a cada vacuna detectada
            for (const vaccine of this.detectedVaccines) {
                const sanitizedKey = this.sanitizeFirebaseKey(vaccine.name);
                vaccine.available = inventory[sanitizedKey] || 0;
                vaccine.hasStock = vaccine.available >= vaccine.quantity;
                vaccine.shift = currentShift;
            }
            
        } catch (error) {
            console.error('Error al obtener inventario:', error);
        }
    }
    
    // Obtener turno actual de vacunas
    async getCurrentShift() {
        try {
            const today = this.getLocalDateString();
            const currentHour = new Date().getHours();
            const shift = currentHour < 14 ? 'mañana' : 'tarde';
            
            const shiftKey = `${today}_${shift}`;
            const shiftRef = this.database.ref(`inventarioTurnos/${shiftKey}`);
            const snapshot = await shiftRef.once('value');
            
            if (snapshot.exists()) {
                return {
                    key: shiftKey,
                    fecha: today,
                    turno: shift,
                    data: snapshot.val()
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error al obtener turno actual:', error);
            return null;
        }
    }
    
    // Mostrar modal de confirmación
    async showConfirmationModal(ticketData) {
        if (this.detectedVaccines.length === 0) {
            return { confirmed: false };
        }
        
        return new Promise((resolve) => {
            this.createConfirmationModal(ticketData, resolve);
        });
    }
    
    // Crear modal de confirmación
    createConfirmationModal(ticketData, resolveCallback) {
        // Remover modal existente si hay
        const existingModal = document.getElementById('vaccineConfirmationModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Crear modal
        const modal = document.createElement('div');
        modal.id = 'vaccineConfirmationModal';
        modal.className = 'vaccine-modal-overlay';
        
        // Construir lista de vacunas
        const vaccinesList = this.detectedVaccines.map((vaccine, index) => `
            <div class="vaccine-detected-item ${!vaccine.hasStock ? 'no-stock' : ''}">
                <div class="vaccine-checkbox">
                    <input type="checkbox" 
                           id="vaccine_${index}" 
                           ${vaccine.hasStock ? 'checked' : 'disabled'}
                           data-index="${index}">
                </div>
                <div class="vaccine-info">
                    <div class="vaccine-name">
                        <i class="fas fa-syringe"></i>
                        ${vaccine.name} ${vaccine.quantity > 1 ? `x${vaccine.quantity}` : ''}
                    </div>
                    <div class="vaccine-stock ${!vaccine.hasStock ? 'low-stock' : ''}">
                        <i class="fas ${vaccine.hasStock ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                        Disponible: ${vaccine.available} unidades
                        ${!vaccine.hasStock ? ' - <strong>Stock insuficiente</strong>' : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        const shiftInfo = this.detectedVaccines[0]?.shift;
        const shiftText = shiftInfo ? 
            `Turno: ${shiftInfo.turno} del ${this.formatDate(shiftInfo.fecha)}` : 
            'No hay turno de vacunas abierto';
        
        modal.innerHTML = `
            <div class="vaccine-modal-content">
                <div class="vaccine-modal-header">
                    <h3>
                        <i class="fas fa-syringe"></i>
                        Vacunas Detectadas
                    </h3>
                    <button class="vaccine-modal-close" onclick="this.closest('.vaccine-modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="vaccine-modal-body">
                    <div class="vaccine-shift-info">
                        <i class="fas fa-clock"></i>
                        ${shiftText}
                    </div>
                    
                    <p class="vaccine-modal-description">
                        Se detectaron las siguientes vacunas en el campo "Por Cobrar". 
                        Seleccione las que desea descontar del inventario y registrar automáticamente:
                    </p>
                    
                    <div class="vaccine-detected-list">
                        ${vaccinesList}
                    </div>
                    
                    <div class="vaccine-patient-info">
                        <h4><i class="fas fa-paw"></i> Datos del Registro</h4>
                        <div class="patient-info-grid">
                            <div><strong>Paciente:</strong> ${ticketData.mascota || 'N/A'}</div>
                            <div><strong>Cliente:</strong> ${ticketData.nombre || 'N/A'}</div>
                            <div><strong>ID:</strong> ${ticketData.idPaciente || 'N/A'}</div>
                            <div><strong>Factura:</strong> ${ticketData.numFactura || 'No especificada'}</div>
                        </div>
                    </div>
                    
                    ${!shiftInfo ? `
                        <div class="vaccine-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            <strong>Advertencia:</strong> No hay un turno de vacunas abierto. 
                            No se podrá descontar del inventario ni registrar las vacunas automáticamente.
                        </div>
                    ` : ''}
                </div>
                
                <div class="vaccine-modal-footer">
                    <button class="vaccine-btn vaccine-btn-cancel" id="cancelVaccineBtn">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                    <button class="vaccine-btn vaccine-btn-skip" id="skipVaccineBtn">
                        <i class="fas fa-forward"></i>
                        Solo Guardar Por Cobrar
                    </button>
                    <button class="vaccine-btn vaccine-btn-confirm" id="confirmVaccineBtn" ${!shiftInfo ? 'disabled' : ''}>
                        <i class="fas fa-check"></i>
                        Confirmar y Registrar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners para botones
        document.getElementById('cancelVaccineBtn').addEventListener('click', () => {
            modal.remove();
            resolveCallback({ confirmed: false, cancelled: true });
        });
        
        document.getElementById('skipVaccineBtn').addEventListener('click', () => {
            modal.remove();
            resolveCallback({ confirmed: false, skipped: true });
        });
        
        document.getElementById('confirmVaccineBtn').addEventListener('click', () => {
            // Obtener vacunas seleccionadas
            const selected = [];
            this.detectedVaccines.forEach((vaccine, index) => {
                const checkbox = document.getElementById(`vaccine_${index}`);
                if (checkbox && checkbox.checked) {
                    selected.push(vaccine);
                }
            });
            
            modal.remove();
            resolveCallback({ 
                confirmed: true, 
                vaccines: selected,
                shift: shiftInfo
            });
        });
    }
    
    // Procesar vacunas confirmadas
    async processConfirmedVaccines(confirmation, ticketData) {
        if (!confirmation.confirmed || !confirmation.vaccines || confirmation.vaccines.length === 0) {
            return { success: false, message: 'No se confirmaron vacunas' };
        }
        
        const results = {
            success: true,
            processed: 0,
            failed: 0,
            errors: []
        };
        
        for (const vaccine of confirmation.vaccines) {
            try {
                // 1. Descontar del inventario
                await this.decreaseInventory(vaccine, confirmation.shift);
                
                // 2. Registrar en módulo de vacunas
                await this.registerVaccine(vaccine, ticketData, confirmation.shift);
                
                results.processed++;
                
            } catch (error) {
                console.error(`Error al procesar vacuna ${vaccine.name}:`, error);
                results.failed++;
                results.errors.push(`${vaccine.name}: ${error.message}`);
                results.success = false;
            }
        }
        
        return results;
    }
    
    // Descontar del inventario
    async decreaseInventory(vaccine, shift) {
        if (!vaccine.hasStock) {
            throw new Error('Stock insuficiente');
        }
        
        const sanitizedKey = this.sanitizeFirebaseKey(vaccine.name);
        const inventoryRef = this.database.ref(`inventarioTurnos/${shift.key}/inventario/${sanitizedKey}`);
        
        // Usar transacción para evitar condiciones de carrera
        return inventoryRef.transaction((currentValue) => {
            const current = currentValue || 0;
            const newValue = current - vaccine.quantity;
            
            if (newValue < 0) {
                return; // Abortar transacción
            }
            
            return newValue;
        }).then((result) => {
            if (!result.committed) {
                throw new Error('No se pudo descontar del inventario (stock insuficiente)');
            }
            console.log(`Descontado ${vaccine.quantity}x ${vaccine.name} del inventario`);
        });
    }
    
    // Registrar vacuna en el módulo
    async registerVaccine(vaccine, ticketData, shift) {
        const userName = sessionStorage.getItem('userName') || 'Usuario';
        const currentTime = new Date();
        
        // Crear registro para cada unidad si la cantidad es mayor a 1
        const registrations = [];
        
        for (let i = 0; i < vaccine.quantity; i++) {
            const vaccineData = {
                nombrePaciente: ticketData.mascota || '',
                apellidoCliente: ticketData.nombre || '',
                idPaciente: ticketData.idPaciente || '',
                medico: ticketData.medicoAtiende || userName,
                fecha: shift.fecha,
                turno: shift.turno,
                hora: currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                vacunaColocada: vaccine.name,
                factura: ticketData.numFactura || '',
                registradoPor: userName,
                registradoDesde: 'porCobrar',
                ticketId: ticketData.id || '',
                fechaRegistro: currentTime.toISOString(),
                automatico: true
            };
            
            registrations.push(vaccineData);
        }
        
        // Guardar todos los registros
        const vacunasRef = this.database.ref('vacunas');
        
        for (const registration of registrations) {
            await vacunasRef.push(registration);
        }
        
        console.log(`Registradas ${vaccine.quantity}x ${vaccine.name} en el módulo de vacunas`);
    }
    
    // Utilidades
    sanitizeFirebaseKey(key) {
        return key.replace(/[.#$[\]\/]/g, '').replace(/\s+/g, '');
    }
    
    getLocalDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    formatDate(dateString) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }
}

// Instancia global
window.vaccineAutocompleteManager = new VaccineAutocompleteManager();
