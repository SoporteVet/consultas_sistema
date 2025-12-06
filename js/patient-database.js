// Módulo de Base de Datos Relacional para Pacientes/Clientes
// Almacena información de clientes y sus mascotas de forma relacional

class PatientDatabase {
    constructor() {
        this.patientsRef = null;
        this.patients = new Map(); // Cache local de pacientes
        this.initialized = false;
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

    // Buscar todas las mascotas de un paciente
    getPatientPets(cedula) {
        const patient = this.findPatientByCedula(cedula);
        if (!patient || !patient.mascotas) return [];
        
        return Object.values(patient.mascotas);
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
                ultimaActualizacion: Date.now(),
                fechaCreacion: existingPatient?.fechaCreacion || Date.now()
            };

            // Preparar datos de la mascota
            const mascotaNombre = (ticketData.mascota || '').trim();
            if (!mascotaNombre) return; // No guardar si no hay nombre de mascota

            const mascotaData = {
                nombre: mascotaNombre,
                tipoMascota: ticketData.tipoMascota || existingPatient?.mascotas?.[mascotaNombre]?.tipoMascota || 'otro',
                idPaciente: ticketData.idPaciente || existingPatient?.mascotas?.[mascotaNombre]?.idPaciente || '',
                raza: ticketData.raza || existingPatient?.mascotas?.[mascotaNombre]?.raza || '',
                edad: ticketData.edad || existingPatient?.mascotas?.[mascotaNombre]?.edad || '',
                peso: ticketData.peso || existingPatient?.mascotas?.[mascotaNombre]?.peso || '',
                sexo: ticketData.sexo || existingPatient?.mascotas?.[mascotaNombre]?.sexo || '',
                ultimaConsulta: Date.now(),
                fechaCreacion: existingPatient?.mascotas?.[mascotaNombre]?.fechaCreacion || Date.now()
            };

            // Actualizar estructura relacional
            const updates = {};
            updates[`${cedula}/nombre`] = clienteData.nombre;
            updates[`${cedula}/cedula`] = clienteData.cedula;
            updates[`${cedula}/telefono`] = clienteData.telefono;
            updates[`${cedula}/correo`] = clienteData.correo;
            updates[`${cedula}/ultimaActualizacion`] = clienteData.ultimaActualizacion;
            updates[`${cedula}/fechaCreacion`] = clienteData.fechaCreacion;
            updates[`${cedula}/mascotas/${mascotaNombre}`] = mascotaData;

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
            patient.mascotas[mascotaNombre] = mascotaData;
            patient.nombre = clienteData.nombre;
            patient.telefono = clienteData.telefono;
            patient.correo = clienteData.correo;
            patient.ultimaActualizacion = clienteData.ultimaActualizacion;

            console.log(`💾 Paciente ${cedula} actualizado con mascota ${mascotaNombre}`);
        } catch (error) {
            console.error('Error guardando paciente:', error);
        }
    }

    // Buscar paciente y rellenar formulario automáticamente
    fillFormFromPatient(cedula, formType = 'consulta') {
        const patient = this.findPatientByCedula(cedula);
        if (!patient) return null;

        // Rellenar datos del cliente
        if (formType === 'consulta') {
            const nombreInput = document.getElementById('nombre');
            if (nombreInput) nombreInput.value = patient.nombre || '';
        } else if (formType === 'laboratorio') {
            const labNombreInput = document.getElementById('labNombre');
            if (labNombreInput) labNombreInput.value = patient.nombre || '';
        } else if (formType === 'quirofano') {
            const quirofanoNombreInput = document.getElementById('quirofanoNombre');
            if (quirofanoNombreInput) quirofanoNombreInput.value = patient.nombre || '';
        }

        // Retornar información de mascotas para que el usuario seleccione
        return {
            cliente: {
                nombre: patient.nombre || '',
                telefono: patient.telefono || '',
                correo: patient.correo || ''
            },
            mascotas: patient.mascotas ? Object.values(patient.mascotas) : []
        };
    }

    // Obtener todas las mascotas de un paciente para mostrar en selector
    getPetsForSelector(cedula) {
        const patient = this.findPatientByCedula(cedula);
        if (!patient || !patient.mascotas) return [];

        return Object.values(patient.mascotas).map(mascota => ({
            nombre: mascota.nombre,
            tipoMascota: mascota.tipoMascota,
            idPaciente: mascota.idPaciente,
            raza: mascota.raza,
            edad: mascota.edad,
            peso: mascota.peso,
            sexo: mascota.sexo
        }));
    }
}

// Inicializar instancia global
let patientDatabase;

function initPatientDatabase() {
    if (!patientDatabase && window.database) {
        patientDatabase = new PatientDatabase();
        window.patientDatabase = patientDatabase;
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

