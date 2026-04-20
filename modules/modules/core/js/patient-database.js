// Módulo de Base de Datos Relacional para Pacientes/Clientes
// Almacena información de clientes y sus mascotas de forma relacional

class PatientDatabase {
    constructor() {
        this.patientsRef = null;
        this.patients = new Map(); // Cache local de pacientes
        this.initialized = false;
        this.currentFormType = 'consulta'; // Tipo de formulario activo
        this.init();
    }

    init() {
        if (!window.database) {
            // Esperar a que Firebase esté listo
            setTimeout(() => this.init(), 500);
            return;
        }

        this.patientsRef = window.database.ref('pacientes');
        this.setupListeners();
        this.initialized = true;
        console.log('✅ Base de datos de pacientes inicializada');
    }

    setupListeners() {
        if (!this.patientsRef) return;
        // Listener para cargar todos los pacientes
        this.patientsRef.on('value', (snapshot) => {

            if (snapshot.exists()) {
                const data = snapshot.val();
                this.patients.clear();
                
                Object.entries(data).forEach(([cedula, patientData]) => {
                    this.patients.set(cedula, patientData);
                });
                
                console.log(`📊 Cargados ${this.patients.size} pacientes en cache`);
            }
        });
    }

    // Buscar paciente por cédula
    findPatientByCedula(cedula) {
        if (!cedula || !this.initialized) return null;
        
        const normalizedCedula = cedula.trim();
        return this.patients.get(normalizedCedula) || null;
    }

    // Buscar todas las mascotas de un paciente (sin duplicados)
    getPatientPets(cedula) {
        const patient = this.findPatientByCedula(cedula);
        if (!patient || !patient.mascotas) return [];
        
        // Filtrar duplicados: si hay múltiples mascotas con el mismo idPaciente, mantener solo una
        const mascotasArray = Object.values(patient.mascotas);
        const seenIds = new Set();
        const uniquePets = [];
        
        for (const mascota of mascotasArray) {
            if (mascota.idPaciente && mascota.idPaciente.trim()) {
                // Si tiene idPaciente, verificar que no esté duplicado
                if (!seenIds.has(mascota.idPaciente)) {
                    seenIds.add(mascota.idPaciente);
                    uniquePets.push(mascota);
                }
            } else {
                // Si no tiene idPaciente, verificar que no haya otra mascota con el mismo nombre e idPaciente
                const hasDuplicate = mascotasArray.some(m => 
                    m.idPaciente && m.idPaciente.trim() && 
                    m.nombre === mascota.nombre
                );
                if (!hasDuplicate) {
                    uniquePets.push(mascota);
                }
            }
        }
        
        return uniquePets;
    }

    // Guardar o actualizar información de paciente desde un ticket
    async savePatientFromTicket(ticketData) {
        if (!this.patientsRef || !ticketData.cedula) {
            return;
        }

        try {
            const cedula = ticketData.cedula.trim();
            const patientRef = this.patientsRef.child(cedula);
            
            // Obtener datos actuales del paciente
            const snapshot = await patientRef.once('value');
            const existingPatient = snapshot.exists() ? snapshot.val() : null;

            // Preparar datos del cliente
            const clienteData = {
                nombre: ticketData.nombre || existingPatient?.nombre || '',
                cedula: cedula,
                telefono: ticketData.telefono || existingPatient?.telefono || '',
                correo: ticketData.correo || existingPatient?.correo || '',
                direccion: ticketData.direccion || existingPatient?.direccion || '',
                ultimaActualizacion: Date.now(),
                fechaCreacion: existingPatient?.fechaCreacion || Date.now()
            };

            // Preparar datos de la mascota
            const mascotaNombre = (ticketData.mascota || '').trim();
            if (!mascotaNombre) return; // No guardar si no hay nombre de mascota

            const idPaciente = (ticketData.idPaciente || '').trim();
            
            // Determinar la clave única para la mascota
            // Prioridad: 1) idPaciente si existe, 2) buscar mascota existente con mismo idPaciente, 3) nombre como fallback
            let mascotaKey = null;
            let existingMascotaData = null;

            if (existingPatient && existingPatient.mascotas) {
                // Buscar si ya existe una mascota con el mismo idPaciente
                if (idPaciente) {
                    for (const [key, mascota] of Object.entries(existingPatient.mascotas)) {
                        if (mascota.idPaciente === idPaciente) {
                            mascotaKey = key;
                            existingMascotaData = mascota;
                            break;
                        }
                    }
                }
                
                // Si no se encontró por idPaciente, buscar por nombre (solo si no hay idPaciente)
                if (!mascotaKey && !idPaciente && existingPatient.mascotas[mascotaNombre]) {
                    mascotaKey = mascotaNombre;
                    existingMascotaData = existingPatient.mascotas[mascotaNombre];
                }
            }

            // Si no se encontró una mascota existente, usar idPaciente como clave si está disponible
            if (!mascotaKey) {
                mascotaKey = idPaciente || mascotaNombre;
            }

            // Preparar datos de la mascota, preservando información existente
            const mascotaData = {
                nombre: mascotaNombre,
                tipoMascota: ticketData.tipoMascota || existingMascotaData?.tipoMascota || 'otro',
                idPaciente: idPaciente || existingMascotaData?.idPaciente || '',
                raza: ticketData.raza || existingMascotaData?.raza || '',
                edad: ticketData.edad || existingMascotaData?.edad || '',
                peso: ticketData.peso || existingMascotaData?.peso || '',
                sexo: ticketData.sexo || existingMascotaData?.sexo || '',
                color: ticketData.color || existingMascotaData?.color || '',
                ultimaConsulta: Date.now(),
                fechaCreacion: existingMascotaData?.fechaCreacion || Date.now()
            };

            // Actualizar estructura relacional
            const updates = {};
            updates[`${cedula}/nombre`] = clienteData.nombre;
            updates[`${cedula}/cedula`] = clienteData.cedula;
            updates[`${cedula}/telefono`] = clienteData.telefono;
            updates[`${cedula}/correo`] = clienteData.correo;
            updates[`${cedula}/direccion`] = clienteData.direccion;
            updates[`${cedula}/ultimaActualizacion`] = clienteData.ultimaActualizacion;
            updates[`${cedula}/fechaCreacion`] = clienteData.fechaCreacion;
            updates[`${cedula}/mascotas/${mascotaKey}`] = mascotaData;

            // Si la clave cambió (de nombre a idPaciente), eliminar la entrada antigua por nombre
            if (idPaciente && mascotaKey === idPaciente && mascotaNombre !== idPaciente && existingPatient?.mascotas?.[mascotaNombre]) {
                updates[`${cedula}/mascotas/${mascotaNombre}`] = null;
            }

            // Guardar en Firebase
            await this.patientsRef.update(updates);
            
            // Actualizar cache local
            if (!this.patients.has(cedula)) {
                this.patients.set(cedula, {
                    ...clienteData,
                    mascotas: {}
                });
            }
            const patient = this.patients.get(cedula);
            if (!patient.mascotas) patient.mascotas = {};
            
            // Actualizar en cache usando la clave correcta
            patient.mascotas[mascotaKey] = mascotaData;
            
            // Eliminar entrada antigua si la clave cambió
            if (idPaciente && mascotaKey === idPaciente && mascotaNombre !== idPaciente && patient.mascotas[mascotaNombre]) {
                delete patient.mascotas[mascotaNombre];
            }
            
            patient.nombre = clienteData.nombre;
            patient.telefono = clienteData.telefono;
            patient.correo = clienteData.correo;
            patient.direccion = clienteData.direccion;
            patient.ultimaActualizacion = clienteData.ultimaActualizacion;

            console.log(`💾 Paciente ${cedula} actualizado con mascota ${mascotaNombre} (clave: ${mascotaKey})`);
        } catch (error) {
            console.error('Error guardando paciente:', error);
        }
    }

    // Buscar paciente y rellenar formulario automáticamente
    fillFormFromPatient(cedula, formType = 'consulta') {
        const patient = this.findPatientByCedula(cedula);
        if (!patient) return null;

        // Rellenar datos del cliente según el tipo de formulario
        const fieldMappings = {
            consulta: {
                nombre: 'nombre',
                telefono: 'telefono',
                correo: 'correo'
            },
            laboratorio: {
                nombre: 'labNombre',
                telefono: 'labTelefono',
                correo: 'labCorreo'
            },
            quirofano: {
                nombre: 'quirofanoNombre',
                telefono: 'quirofanoTelefono',
                correo: 'quirofanoCorreo'
            }
        };

        const fields = fieldMappings[formType] || fieldMappings.consulta;

        // Rellenar campos del propietario
        if (fields.nombre) {
            const nombreInput = document.getElementById(fields.nombre);
            if (nombreInput && patient.nombre) {
                nombreInput.value = patient.nombre;
            }
        }
        
        if (fields.telefono) {
            const telefonoInput = document.getElementById(fields.telefono);
            if (telefonoInput && patient.telefono) {
                telefonoInput.value = patient.telefono;
            }
        }
        
        if (fields.correo) {
            const correoInput = document.getElementById(fields.correo);
            if (correoInput && patient.correo) {
                correoInput.value = patient.correo;
            }
        }

        // Retornar información de mascotas para que el usuario seleccione (sin duplicados)
        const mascotas = patient.mascotas ? this.getPatientPets(cedula) : [];
        
        return {
            cliente: {
                nombre: patient.nombre || '',
                telefono: patient.telefono || '',
                correo: patient.correo || '',
                direccion: patient.direccion || ''
            },
            mascotas: mascotas
        };
    }

    // Obtener todas las mascotas de un paciente para mostrar en selector (sin duplicados)
    getPetsForSelector(cedula) {
        const patient = this.findPatientByCedula(cedula);
        if (!patient || !patient.mascotas) return [];

        // Usar getPatientPets para evitar duplicados
        return this.getPatientPets(cedula).map(mascota => ({
            nombre: mascota.nombre,
            tipoMascota: mascota.tipoMascota,
            idPaciente: mascota.idPaciente,
            raza: mascota.raza,
            edad: mascota.edad,
            peso: mascota.peso,
            sexo: mascota.sexo,
            color: mascota.color
        }));
    }

    // Mostrar UI de selección de mascota
    showPetSelector(cedula, formType = 'consulta') {
        const patientData = this.fillFormFromPatient(cedula, formType);
        if (!patientData || !patientData.mascotas || patientData.mascotas.length === 0) {
            return;
        }

        // Determinar qué contenedor usar según el tipo de formulario
        let containerSelector;
        let mascotaFieldId;
        let tipoMascotaFieldId;
        let idPacienteFieldId;
        let razaFieldId;
        let edadFieldId;
        let pesoFieldId;
        let sexoFieldId;

        if (formType === 'laboratorio') {
            containerSelector = '#labCedula';
            mascotaFieldId = 'labMascota';
            tipoMascotaFieldId = 'labTipoMascota';
            idPacienteFieldId = 'labIdPaciente';
            razaFieldId = 'labRaza';
            edadFieldId = 'labEdad';
            pesoFieldId = 'labPeso';
            sexoFieldId = 'labSexo';
        } else if (formType === 'quirofano') {
            containerSelector = '#quirofanoCedula';
            mascotaFieldId = 'quirofanoMascota';
            tipoMascotaFieldId = 'quirofanoTipoMascota';
            idPacienteFieldId = 'quirofanoIdPaciente';
            razaFieldId = 'quirofanoRaza';
            edadFieldId = 'quirofanoEdad';
            pesoFieldId = 'quirofanoPeso';
            sexoFieldId = 'quirofanoSexo';
        } else {
            containerSelector = '#cedula';
            mascotaFieldId = 'mascota';
            tipoMascotaFieldId = 'tipoMascota';
            idPacienteFieldId = 'idPaciente';
            razaFieldId = 'raza';
            edadFieldId = 'edad';
            pesoFieldId = 'peso';
            sexoFieldId = 'sexo';
        }

        // Buscar el campo de cédula
        const cedulaField = document.querySelector(containerSelector);
        if (!cedulaField) return;

        // Eliminar selector anterior si existe
        const existingSelector = document.getElementById('petSelectorDropdown');
        if (existingSelector) {
            existingSelector.remove();
        }

        // Crear dropdown de mascotas
        const dropdown = document.createElement('div');
        dropdown.id = 'petSelectorDropdown';
        dropdown.className = 'pet-selector-dropdown';
        
        const header = document.createElement('div');
        header.className = 'pet-selector-header';
        header.innerHTML = `
            <i class="fas fa-paw"></i>
            <strong>Cliente encontrado:</strong> ${patientData.cliente.nombre}
            <br>
            <small>Seleccione una mascota o cree una nueva:</small>
        `;
        dropdown.appendChild(header);

        // Agregar opciones de mascotas existentes
        patientData.mascotas.forEach((mascota, index) => {
            const petOption = document.createElement('div');
            petOption.className = 'pet-option';
            
            const iconClass = mascota.tipoMascota === 'perro' ? 'fa-dog' : 
                            mascota.tipoMascota === 'gato' ? 'fa-cat' : 'fa-paw';
            
            petOption.innerHTML = `
                <div class="pet-icon">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="pet-info">
                    <div class="pet-name">${mascota.nombre}</div>
                    <div class="pet-details">
                        ${mascota.raza || 'Sin raza'} • 
                        ${mascota.edad || 'Sin edad'} • 
                        ${mascota.sexo || 'Sin sexo'}
                        ${mascota.idPaciente ? ` • ID: ${mascota.idPaciente}` : ''}
                    </div>
                </div>
            `;
            
            petOption.addEventListener('click', () => {
                this.selectPet(mascota, {
                    mascota: mascotaFieldId,
                    tipoMascota: tipoMascotaFieldId,
                    idPaciente: idPacienteFieldId,
                    raza: razaFieldId,
                    edad: edadFieldId,
                    peso: pesoFieldId,
                    sexo: sexoFieldId
                });
                dropdown.remove();
            });
            
            dropdown.appendChild(petOption);
        });

        // Opción para crear nueva mascota
        const newPetOption = document.createElement('div');
        newPetOption.className = 'pet-option new-pet-option';
        newPetOption.innerHTML = `
            <div class="pet-icon">
                <i class="fas fa-plus-circle"></i>
            </div>
            <div class="pet-info">
                <div class="pet-name">Nueva Mascota</div>
                <div class="pet-details">Registrar una nueva mascota para este cliente</div>
            </div>
        `;
        
        newPetOption.addEventListener('click', () => {
            dropdown.remove();
            // Limpiar campos de mascota para permitir nuevo registro
            const mascotaInput = document.getElementById(mascotaFieldId);
            if (mascotaInput) mascotaInput.focus();
        });
        
        dropdown.appendChild(newPetOption);

        // Insertar dropdown después del campo de cédula
        cedulaField.parentNode.style.position = 'relative';
        cedulaField.parentNode.appendChild(dropdown);

        // Cerrar dropdown al hacer clic fuera
        setTimeout(() => {
            document.addEventListener('click', function closeDropdown(e) {
                if (!dropdown.contains(e.target) && e.target !== cedulaField) {
                    dropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }, 100);
    }

    // Seleccionar mascota y rellenar campos
    selectPet(mascota, fieldIds) {
        const mascotaInput = document.getElementById(fieldIds.mascota);
        if (mascotaInput) mascotaInput.value = mascota.nombre || '';

        const tipoMascotaInput = document.getElementById(fieldIds.tipoMascota);
        if (tipoMascotaInput) tipoMascotaInput.value = mascota.tipoMascota || 'otro';

        const idPacienteInput = document.getElementById(fieldIds.idPaciente);
        if (idPacienteInput) idPacienteInput.value = mascota.idPaciente || '';

        const razaInput = document.getElementById(fieldIds.raza);
        if (razaInput) razaInput.value = mascota.raza || '';

        const edadInput = document.getElementById(fieldIds.edad);
        if (edadInput) edadInput.value = mascota.edad || '';

        const pesoInput = document.getElementById(fieldIds.peso);
        if (pesoInput) pesoInput.value = mascota.peso || '';

        const sexoInput = document.getElementById(fieldIds.sexo);
        if (sexoInput) sexoInput.value = mascota.sexo || '';

        // Mostrar notificación de éxito
        if (typeof showNotification === 'function') {
            showNotification(`Mascota "${mascota.nombre}" seleccionada correctamente`, 'success');
        }
    }

    // Setup de listeners para campo de cédula
    setupCedulaListener(cedulaFieldId, formType = 'consulta') {
        const cedulaField = document.getElementById(cedulaFieldId);
        if (!cedulaField) return;

        // Debounce para evitar múltiples búsquedas
        let searchTimeout;
        
        cedulaField.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const cedula = e.target.value.trim();
                if (cedula.length >= 5) { // Buscar cuando tenga al menos 5 caracteres
                    const patient = this.findPatientByCedula(cedula);
                    if (patient) {
                        this.showPetSelector(cedula, formType);
                    } else {
                        // Si no se encuentra en BD local, buscar en API externa si está disponible
                        if (window.cedulaSearchIntegration && cedula.length >= 5) {
                            window.cedulaSearchIntegration.searchCedulaInAPI(cedula, formType, true);
                        }
                    }
                }
            }, 500); // Esperar 500ms después de que el usuario deje de escribir
        });

        cedulaField.addEventListener('blur', (e) => {
            const cedula = e.target.value.trim();
            if (cedula && cedula.length >= 5) {
                const patient = this.findPatientByCedula(cedula);
                if (patient) {
                    this.fillFormFromPatient(cedula, formType);
                } else {
                    // Si no se encuentra en BD local, buscar en API externa
                    if (window.cedulaSearchIntegration) {
                        window.cedulaSearchIntegration.searchCedulaInAPI(cedula, formType, true);
                    }
                }
            }
        });
    }
}

// Inicializar instancia global
let patientDatabase;

function initPatientDatabase() {
    if (!patientDatabase && window.database) {
        patientDatabase = new PatientDatabase();
        window.patientDatabase = patientDatabase;
        
        // Setup listeners automáticos para formularios después de inicializar
        setTimeout(() => {
            // Formulario de consultas
            if (document.getElementById('cedula')) {
                patientDatabase.setupCedulaListener('cedula', 'consulta');
            }
            
            // Formulario de quirófano
            if (document.getElementById('quirofanoCedula')) {
                patientDatabase.setupCedulaListener('quirofanoCedula', 'quirofano');
            }
        }, 1500);
    }
}

// Auto-inicialización
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initPatientDatabase, 1000);
    });
} else {
    setTimeout(initPatientDatabase, 1000);
}

// Exportar para uso manual
window.initPatientDatabase = initPatientDatabase;


