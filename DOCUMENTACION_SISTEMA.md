# Documentación Completa del Sistema de Gestión Veterinaria

## 📋 Índice

1. [Descripción General](#descripción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Módulos Principales](#módulos-principales)
4. [Objetos y Clases del Sistema](#objetos-y-clases-del-sistema)
5. [Funciones Principales](#funciones-principales)
6. [Sistema de Autenticación y Permisos](#sistema-de-autenticación-y-permisos)
7. [Base de Datos y Almacenamiento](#base-de-datos-y-almacenamiento)
8. [Flujos de Trabajo](#flujos-de-trabajo)
9. [Estructura de Archivos](#estructura-de-archivos)

---

## Descripción General

Sistema de gestión veterinaria desarrollado para la Veterinaria San Martín de Porres. Es una app web que utiliza Firebase como backend, proporcionando gestión completa de consultas, laboratorio, quirófano, internamientos y consentimientos informados.

### Características Principales:
- ✅ Gestión de consultas y tickets
- ✅ Control de laboratorio y análisis
- ✅ Gestión de quirófano y cirugías
- ✅ Sistema de internamientos
- ✅ Consentimientos informados
- ✅ Control de vacunas e inyectables
- ✅ Base de datos relacional de pacientes
- ✅ Sistema de roles y permisos
- ✅ Estadísticas y reportes
- ✅ Notificaciones en tiempo real

---

## Arquitectura del Sistema

### Tecnologías Utilizadas:
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase Realtime Database
- **Autenticación**: Firebase Authentication
- **Librerías**: Font Awesome, Chart.js, html2pdf.js, XLSX

### Estructura de la Aplicación:
```
sistema_ticket_f/
├── index.html                    # Página principal de la aplicación
├── home.html                     # Página de login
├── modules/                      # Módulos del sistema
│   ├── auth/                     # Autenticación
│   ├── core/                     # Funcionalidades centrales
│   ├── consentimientos/          # Consentimientos informados
│   ├── laboratorio/              # Módulo de laboratorio
│   ├── quirofano/                # Módulo de quirófano
│   └── internamiento/            # Módulo de internamientos
└── img/                          # Imágenes y recursos
```

---

## Módulos Principales

### 1. Módulo de Autenticación (`modules/auth/`)

**Propósito**: Gestiona el acceso de usuarios al sistema mediante Firebase Authentication.

**Archivos Clave**:
- `auth.js`: Sistema de permisos y roles
- `login.js`: Lógica de inicio de sesión

**Funcionalidades**:
- Autenticación con email y contraseña
- Gestión de roles de usuario
- Control de permisos por rol
- Sesiones por pestaña (Persistence.NONE)

---

### 2. Módulo Core (`modules/core/`)

**Propósito**: Funcionalidades centrales compartidas por todos los módulos.

**Archivos Principales**:

#### `index.js` (8132 líneas)
**Funcionalidades principales**:
- Gestión de tickets de consulta
- Carga y renderizado de tickets
- Sistema de filtros (espera, en atención, finalizado, etc.)
- Notificaciones de consultorio con síntesis de voz
- Estadísticas globales
- Exportación de datos
- Gestión de horarios

**Funciones Clave**:
- `loadTickets()`: Carga tickets desde Firebase
- `renderTickets(filter)`: Renderiza tickets según filtro
- `createTicket(ticketData)`: Crea nuevo ticket
- `updateTicketStatus(ticketId, newStatus)`: Actualiza estado
- `announceConsultorio(ticket, nuevoEstado)`: Anuncia consultorio con voz
- `updateStatsGlobal()`: Actualiza estadísticas

#### `patient-database.js`
**Clase**: `PatientDatabase`

**Propósito**: Base de datos relacional para pacientes y sus mascotas.

**Métodos Principales**:
- `init()`: Inicializa la conexión con Firebase
- `findPatientByCedula(cedula)`: Busca paciente por cédula
- `getPatientPets(cedula)`: Obtiene todas las mascotas de un paciente
- `savePatientFromTicket(ticketData)`: Guarda/actualiza paciente desde ticket
- `fillFormFromPatient(cedula, formType)`: Rellena formulario con datos del paciente
- `showPetSelector(cedula, formType)`: Muestra selector de mascotas
- `setupCedulaListener(cedulaFieldId, formType)`: Configura búsqueda automática

**Estructura de Datos**:
```javascript
pacientes/
  {cedula}/
    nombre: string
    cedula: string
    telefono: string
    correo: string
    direccion: string
    mascotas/
      {idPaciente o nombre}/
        nombre: string
        tipoMascota: string
        idPaciente: string
        raza: string
        edad: string
        peso: string
        sexo: string
        color: string
```

#### `services-data.js`
**Propósito**: Base de datos de servicios de laboratorio.

**Estructura**:
```javascript
SERVICIOS_LABORATORIO = {
  perfiles: { servicios: [...] },
  paneles: { servicios: [...] },
  transfusiones: { servicios: [...] },
  tests: { servicios: [...] },
  vcheck: { servicios: [...] },
  liquidos: { servicios: [...] },
  coagulacion: { servicios: [...] },
  hemograma: { servicios: [...] },
  quimica: { servicios: [...] },
  plasma: { servicios: [...] },
  heces: { servicios: [...] },
  orina: { servicios: [...] },
  dermatologia: { servicios: [...] },
  laboratorio_externo: { servicios: [...] }
}
```

**Funciones**:
- `getAllServices()`: Obtiene todos los servicios
- `searchServices(term)`: Busca servicios por término
- `getServiceById(serviceId)`: Obtiene servicio por ID
- `formatPrice(price)`: Formatea precio en colones

#### `firebase-config.js`
**Propósito**: Configuración e inicialización de Firebase.

**Funcionalidades**:
- Inicialización de Firebase App
- Configuración de referencias de base de datos
- Monitoreo de conexión
- Manejo de errores de conexión

#### `vaccine-autocomplete-manager.js`
**Propósito**: Gestión de autocompletado para vacunas.

#### `admin-users.js`
**Propósito**: Gestión de usuarios (solo administradores).

#### `cedula-search-integration.js`
**Propósito**: Integración con API externa para búsqueda de cédulas.

---

### 3. Módulo de Consultas

**Ubicación**: Funcionalidad principal en `index.js`

**Funcionalidades**:
- Crear tickets de consulta
- Ver y filtrar tickets
- Actualizar estado de tickets
- Gestión de horarios
- Estadísticas
- Control de vacunas

**Estados de Ticket**:
- `espera`: En espera de atención
- `consultorio X`: En consultorio específico
- `finalizado`: Consulta completada
- `cancelado`: Consulta cancelada

**Campos del Ticket**:
```javascript
{
  id: number,
  randomId: string,
  nombre: string,
  cedula: string,
  mascota: string,
  tipoMascota: string,
  idPaciente: string,
  fecha: string,
  horaAtencion: string,
  estado: string,
  medicoAtiende: string,
  asistenteAtiende: string,
  motivoLlegada: string,
  tipoServicio: string,
  empresa: string,
  // ... más campos
}
```

---

### 4. Módulo de Laboratorio (`modules/laboratorio/`)

**Propósito**: Gestión de tickets y análisis de laboratorio.

**Archivos Principales**:
- `laboratorio.js`: Funcionalidad principal
- `laboratory-ticket-manager.js`: Gestión de tickets
- `reportes-lab-module.js`: Generación de reportes
- `lab-report-header.js`: Encabezados de reportes

**Funcionalidades**:
- Crear tickets de laboratorio
- Selección de servicios de laboratorio
- Generación de reportes
- Control de inyectables
- Búsqueda y filtrado de tickets

**Estructura de Ticket de Laboratorio**:
```javascript
{
  randomId: string,
  numero: number,
  nombre: string,
  cedula: string,
  mascota: string,
  servicios: Array<{id, nombre, precio}>,
  fechaCreacion: string,
  estado: string,
  empresa: string
}
```

---

### 5. Módulo de Quirófano (`modules/quirofano/`)

**Propósito**: Gestión de cirugías y procedimientos quirúrgicos.

**Archivo Principal**: `quirofano-module.js`

**Clase/Funciones Principales**:
- `initQuirofanoModule()`: Inicializa el módulo
- `loadQuirofanoTickets()`: Carga tickets de quirófano
- `handleQuirofanoFormSubmit()`: Procesa formulario de creación
- `saveQuirofanoTicket()`: Guarda ticket en Firebase
- `renderQuirofanoTicketsWithDateFilter()`: Renderiza tickets con filtros

**Estados de Ticket de Quirófano**:
- `en-preparacion`: En preparación
- `en-cirugia`: En cirugía
- `recuperacion`: En recuperación
- `finalizado`: Finalizado
- `cancelado`: Cancelado

**Estructura de Ticket de Quirófano**:
```javascript
{
  randomId: string,
  numero: number,
  nombreMascota: string,
  nombrePropietario: string,
  cedula: string,
  procedimiento: string,
  tipoUrgencia: string,
  fechaProgramada: string,
  horaProgramada: string,
  estado: string,
  examenesPrequirurgicos: boolean,
  via: boolean,
  medicoAtiende: string,
  empresa: string
}
```

---

### 6. Módulo de Internamiento (`modules/internamiento/`)

**Propósito**: Gestión de pacientes internados.

**Archivo Principal**: `internamiento-module.js`

**Clase**: `InternamientoModule`

**Métodos Principales**:
- `init()`: Inicializa el módulo
- `showAdmisionForm()`: Muestra formulario de admisión
- `handleAdmisionSubmit()`: Procesa admisión
- `showInternamientosSection()`: Muestra lista de internamientos
- `filterInternamientos(filter)`: Filtra internamientos
- `buscarInternamientos(query)`: Busca internamientos

**Estados de Internamiento**:
- `activo`: Paciente internado activamente
- `critico`: Paciente en estado crítico
- `alta`: Paciente dado de alta

**Estructura de Internamiento**:
```javascript
{
  expedienteNumero: string,
  referencias: {
    nombreMascota: string,
    nombrePropietario: string,
    cedula: string,
    // ...
  },
  estado: {
    actual: string,
    fechaAdmision: string,
    fechaAlta: string
  },
  diagnostico: string,
  tratamiento: string,
  // ...
}
```

**Archivos Adicionales**:
- `internamiento-transfusion.js`: Gestión de transfusiones
- `internamiento-procedimientos.js`: Gestión de procedimientos
- `internamiento-glasgow.js`: Escala de Glasgow
- `internamiento-llamadas.js`: Sistema de llamadas
- `internamiento-egreso.js`: Proceso de egreso
- `internamiento-notificaciones.js`: Sistema de notificaciones
- `internamiento-auth-asistentes.js`: Autenticación de asistentes

---

### 7. Módulo de Consentimientos (`modules/consentimientos/`)

**Propósito**: Gestión de consentimientos informados.

**Archivo Principal**: `consentimientos-module.js`

**Funcionalidades**:
- Búsqueda de clientes desde tickets
- Selección de plantillas de consentimiento
- Generación de consentimientos con datos prellenados
- Impresión de consentimientos

**Plantillas Disponibles**:
- `anestesia`: Autorización para Anestesia
- `cirugia`: Consentimiento Cirugía
- `emergencias`: Emergencias
- `transfusion`: Transfusión
- `cesarea`: Consentimiento Cesárea
- `eutanasia`: Consentimiento Eutanasia
- `alta_voluntaria`: Alta Voluntaria
- `control_anestesico`: Control Anestésico
- `internamiento`: Consentimiento Informado para Internamiento

**Orígenes de Datos**:
- `consulta`: Desde tickets de consulta
- `quirofano`: Desde tickets de quirófano
- `internos`: Desde internamientos

**Funciones Principales**:
- `initConsentimientos()`: Inicializa el módulo
- `searchClients()`: Busca clientes
- `selectTemplate(templateKey)`: Selecciona plantilla
- `openConsentForm(templateKey)`: Abre formulario de consentimiento
- `filterClientsFromConsultaTickets()`: Filtra desde consultas
- `filterClientsFromQuirofanoTickets()`: Filtra desde quirófano

---

## Objetos y Clases del Sistema

### 1. PatientDatabase

**Ubicación**: `modules/core/js/patient-database.js`

**Propósito**: Gestión de base de datos relacional de pacientes.

**Propiedades**:
- `patientsRef`: Referencia a Firebase
- `patients`: Map con cache local de pacientes
- `initialized`: Flag de inicialización
- `currentFormType`: Tipo de formulario activo

**Métodos**:
```javascript
class PatientDatabase {
  constructor()
  init()
  setupListeners()
  findPatientByCedula(cedula)
  getPatientPets(cedula)
  savePatientFromTicket(ticketData)
  fillFormFromPatient(cedula, formType)
  getPetsForSelector(cedula)
  showPetSelector(cedula, formType)
  selectPet(mascota, fieldIds)
  setupCedulaListener(cedulaFieldId, formType)
}
```

---

### 2. InternamientoModule

**Ubicación**: `modules/internamiento/js/internamiento-module.js`

**Propósito**: Gestión completa de internamientos.

**Propiedades**:
- `internamientosRef`: Referencia a Firebase
- `internamientos`: Map con internamientos activos
- `currentInternamientoId`: ID del internamiento actual
- `initialized`: Flag de inicialización
- `betaEnabled`: Flag de funcionalidad beta

**Métodos Principales**:
```javascript
class InternamientoModule {
  constructor()
  async init()
  canAccessModule()
  setupFirebaseListeners()
  setupUI()
  showAdmisionForm()
  handleAdmisionSubmit(e)
  showInternamientosSection()
  filterInternamientos(filter)
  buscarInternamientos(query)
  // ... más métodos
}
```

---

## Funciones Principales

### Sistema de Tickets (index.js)

#### `loadTickets()`
**Propósito**: Carga tickets desde Firebase con optimización de carga diferida.

**Funcionamiento**:
- Carga últimos 15 días por defecto
- Carga completa si se selecciona filtro "todos"
- Usa listeners de Firebase para actualizaciones en tiempo real
- Optimiza carga según rango de fechas

#### `renderTickets(filter)`
**Propósito**: Renderiza tickets según el filtro seleccionado.

**Filtros Disponibles**:
- `todos`: Todos los tickets
- `espera`: Tickets en espera
- `en-atencion`: Tickets en atención
- `finalizado`: Tickets finalizados
- `cancelado`: Tickets cancelados

#### `createTicket(ticketData)`
**Propósito**: Crea un nuevo ticket de consulta.

**Proceso**:
1. Valida datos del formulario
2. Genera ID único (randomId)
3. Asigna número de ticket secuencial
4. Guarda en Firebase
5. Actualiza base de datos de pacientes
6. Muestra notificación de éxito

#### `updateTicketStatus(ticketId, newStatus)`
**Propósito**: Actualiza el estado de un ticket.

**Estados Especiales**:
- Si cambia a `consultorio X`: Reproduce anuncio de voz
- Actualiza hora de atención si corresponde
- Actualiza estadísticas globales

#### `announceConsultorio(ticket, nuevoEstado)`
**Propósito**: Anuncia con síntesis de voz cuando un paciente pasa a consultorio.

**Características**:
- Solo para usuarios con rol `visitas`
- Repite el mensaje 2 veces
- Muestra notificación visual
- Selecciona voz en español preferentemente

---

### Sistema de Búsqueda de Pacientes

#### `setupCedulaListener(cedulaFieldId, formType)`
**Propósito**: Configura búsqueda automática al escribir cédula.

**Funcionamiento**:
- Debounce de 500ms
- Busca en firebase primero
- Si no encuentra, busca en API externa
- Muestra selector de mascotas si encuentra paciente

#### `showPetSelector(cedula, formType)`
**Propósito**: Muestra dropdown con mascotas del paciente.

**Características**:
- Lista todas las mascotas del paciente
- Opción para crear nueva mascota
- Rellena automáticamente campos del formulario
- Cierra al hacer clic fuera

---

### Sistema de Laboratorio

#### `initLaboratorioSystem()`
**Propósito**: Inicializa el sistema de laboratorio.

**Funcionalidades**:
- Carga servicios disponibles
- Configura formularios
- Inicializa búsqueda
- Configura listeners

#### `createLabTicket(ticketData)`
**Propósito**: Crea ticket de laboratorio.

**Proceso**:
1. Valida datos
2. Calcula total de servicios
3. Genera ID único
4. Guarda en Firebase
5. Actualiza contador de tickets

---

### Sistema de Quirófano

#### `initQuirofanoModule()`
**Propósito**: Inicializa módulo de quirófano.

**Funcionalidades**:
- Carga tickets existentes
- Configura listeners de Firebase
- Configura formularios
- Establece fecha por defecto

#### `handleQuirofanoFormSubmit(e)`
**Propósito**: Procesa envío de formulario de quirófano.

**Validaciones**:
- Campos obligatorios: nombre mascota, propietario, procedimiento
- Verifica que campos críticos no estén vacíos
- Valida formato de datos

---

## Sistema de Autenticación y Permisos

### Roles de Usuario

#### 1. `admin`
**Permisos Completos**:
- Ver, crear, editar, eliminar tickets
- Ver estadísticas
- Gestionar backup
- Exportar datos
- Ver horarios
- Gestionar usuarios
- Acceso a todos los módulos

#### 2. `recepcion`
**Permisos**:
- Ver, crear, editar tickets
- Ver consentimientos
- No puede eliminar tickets
- No puede ver estadísticas
- No puede exportar datos

#### 3. `consulta_externa`
**Permisos**:
- Ver, crear, editar tickets
- Ver consentimientos
- Ver vacunas (solo lectura)
- Acceso a internamientos

#### 4. `laboratorio`
**Permisos**:
- Ver, crear, editar tickets de laboratorio
- Ver consentimientos
- No puede ver estadísticas

#### 5. `quirofano`
**Permisos**:
- Ver, crear, editar tickets de quirófano
- Ver consentimientos
- No puede ver estadísticas

#### 6. `internos`
**Permisos**:
- Ver, crear, editar tickets
- Ver consentimientos
- Acceso a internamientos

#### 7. `visitas`
**Permisos Limitados**:
- Solo ver tickets en espera
- No puede crear ni editar
- No puede ver información completa
- Recibe notificaciones de consultorio

### Funciones de Autenticación

#### `checkAuth()`
**Propósito**: Verifica si el usuario está autenticado.

**Retorna**: Promise con datos del usuario o null

**Proceso**:
1. Verifica sessionStorage primero (respuesta rápida)
2. Verifica Firebase Auth en background
3. Obtiene rol del usuario desde Firebase Database
4. Almacena en sessionStorage para acceso rápido

#### `hasPermission(permission)`
**Propósito**: Verifica si el usuario tiene un permiso específico.

**Uso**:
```javascript
if (hasPermission('canViewStats')) {
  // Mostrar estadísticas
}
```

#### `signOut()`
**Propósito**: Cierra sesión del usuario.

**Proceso**:
1. Limpia sessionStorage
2. Cierra sesión en Firebase
3. Redirige a home.html

---

## Base de Datos y Almacenamiento

### Estructura de Firebase Realtime Database

```
firebase-database/
├── tickets/                    # Tickets de consulta
│   └── {randomId}/
│       ├── id: number
│       ├── randomId: string
│       ├── nombre: string
│       ├── cedula: string
│       ├── mascota: string
│       ├── estado: string
│       ├── fecha: string
│       ├── empresa: string
│       └── ...
│
├── quirofano-tickets/          # Tickets de quirófano
│   └── {randomId}/
│       ├── randomId: string
│       ├── numero: number
│       ├── nombreMascota: string
│       ├── nombrePropietario: string
│       ├── procedimiento: string
│       ├── estado: string
│       ├── empresa: string
│       └── ...
│
├── laboratorio-tickets/         # Tickets de laboratorio
│   └── {randomId}/
│       ├── randomId: string
│       ├── numero: number
│       ├── servicios: Array
│       ├── estado: string
│       ├── empresa: string
│       └── ...
│
├── internamientos/             # Internamientos
│   └── {internamientoId}/
│       ├── expedienteNumero: string
│       ├── referencias: Object
│       ├── estado: Object
│       ├── diagnostico: string
│       ├── empresa: string
│       └── ...
│
├── pacientes/                  # Base de datos relacional
│   └── {cedula}/
│       ├── nombre: string
│       ├── cedula: string
│       ├── telefono: string
│       ├── correo: string
│       ├── direccion: string
│       └── mascotas/
│           └── {idPaciente}/
│               ├── nombre: string
│               ├── tipoMascota: string
│               ├── idPaciente: string
│               └── ...
│
├── users/                      # Usuarios del sistema
│   └── {uid}/
│       ├── email: string
│       ├── role: string
│       ├── name: string
│       └── empresa: string
│
├── settings/                    # Configuraciones
│   ├── horarios: Object
│   └── ...
│
└── vacunas/                    # Control de vacunas
    └── {cedula}/
        └── {idPaciente}/
            └── vacunas: Array
```

### Multi-empresas

El sistema soporta múltiples empresas mediante el campo `empresa` en todos los registros:
- `veterinaria_smp`: Veterinaria San Martín de Porres
- `instituto_smp`: Instituto Veterinario San Martín de Porres

Los usuarios solo ven datos de su empresa asignada (excepto administradores que pueden cambiar de empresa).

---

## Flujos de Trabajo

### 1. Flujo de Creación de Consulta

```
1. Usuario selecciona "Crear Consulta"
2. Sistema muestra formulario
3. Usuario ingresa cédula
   → Sistema busca en BD de pacientes
   → Si encuentra: muestra selector de mascotas
   → Si no encuentra: permite crear nuevo
4. Usuario completa datos del formulario
5. Usuario hace clic en "Crear Ticket"
6. Sistema valida datos
7. Sistema guarda en Firebase
8. Sistema actualiza BD de pacientes
9. Sistema muestra notificación de éxito
10. Sistema actualiza lista de tickets
```

### 2. Flujo de Atención de Consulta

```
1. Ticket está en estado "espera"
2. Usuario cambia estado a "consultorio X"
3. Sistema actualiza estado en Firebase
4. Sistema reproduce anuncio de voz (si es usuario visitas)
5. Sistema muestra notificación visual
6. Sistema actualiza hora de atención
7. Usuario atiende al paciente
8. Usuario cambia estado a "finalizado"
9. Sistema actualiza hora de finalización
10. Sistema actualiza estadísticas
```

### 3. Flujo de Creación de Consentimiento

```
1. Usuario selecciona "Crear Consentimiento"
2. Usuario selecciona origen (consulta/quirofano/internos)
3. Usuario busca cliente por nombre/cédula/mascota
4. Sistema filtra tickets según fecha seleccionada
5. Sistema muestra resultados de búsqueda
6. Usuario selecciona cliente
7. Usuario selecciona plantilla de consentimiento
8. Sistema abre formulario con datos prellenados
9. Usuario revisa y completa datos
10. Usuario imprime consentimiento
```

### 4. Flujo de Internamiento

```
1. Usuario selecciona "Nuevo Internamiento"
2. Sistema muestra formulario de admisión
3. Usuario ingresa cédula
   → Sistema busca en BD de pacientes
   → Muestra selector de mascotas
4. Usuario completa datos de admisión
5. Sistema genera número de expediente
6. Sistema guarda internamiento en Firebase
7. Sistema muestra internamiento en lista activa
8. Usuario puede agregar turnos, medicamentos, procedimientos
9. Usuario puede actualizar estado (activo/crítico)
10. Usuario procesa egreso cuando corresponde
```

---

## Estructura de Archivos

### Archivos Principales

#### `index.html`
- Página principal de la aplicación
- Contiene toda la estructura HTML
- Incluye formularios de todos los módulos
- 2818 líneas

#### `home.html`
- Página de login
- Formulario de autenticación
- Creación automática de usuarios de prueba

### Módulos

#### `modules/auth/`
- `js/auth.js`: Sistema de permisos
- `js/login.js`: Lógica de login
- `css/login.css`: Estilos de login

#### `modules/core/`
- `js/index.js`: Funcionalidad principal (8132 líneas)
- `js/patient-database.js`: BD relacional de pacientes
- `js/services-data.js`: Servicios de laboratorio
- `js/firebase-config.js`: Configuración Firebase
- `js/vaccine-autocomplete-manager.js`: Autocompletado vacunas
- `js/admin-users.js`: Gestión de usuarios
- `js/cedula-search-integration.js`: Búsqueda de cédulas
- `css/index.css`: Estilos principales

#### `modules/laboratorio/`
- `js/laboratorio.js`: Funcionalidad principal
- `js/laboratory-ticket-manager.js`: Gestión de tickets
- `js/reportes-lab-module.js`: Reportes
- `js/lab-report-header.js`: Encabezados
- `css/laboratorio.css`: Estilos

#### `modules/quirofano/`
- `js/quirofano-module.js`: Funcionalidad principal
- `css/quirofano.css`: Estilos

#### `modules/internamiento/`
- `js/internamiento-module.js`: Módulo principal
- `js/internamiento-transfusion.js`: Transfusiones
- `js/internamiento-procedimientos.js`: Procedimientos
- `js/internamiento-glasgow.js`: Escala Glasgow
- `js/internamiento-llamadas.js`: Llamadas
- `js/internamiento-egreso.js`: Egreso
- `js/internamiento-notificaciones.js`: Notificaciones
- `js/internamiento-auth-asistentes.js`: Auth asistentes
- `css/internamiento.css`: Estilos

#### `modules/consentimientos/`
- `js/consentimientos-module.js`: Funcionalidad principal
- `css/consentimientos.css`: Estilos
- `pages/`: Plantillas HTML de consentimientos

---

## Notas Técnicas

### Optimizaciones de Rendimiento

1. Los módulos se cargan con `defer` para no bloquear el render
2. Librerías pesadas (Chart.js, html2pdf) se cargan solo cuando se necesitan
3. Tickets se cargan por rangos de fechas

### Manejo de Errores

- Validación de campos antes de guardar
- Manejo de errores de conexión Firebase
- Notificaciones de error amigables al usuario
- Logs en consola para debugging

### Seguridad

- Autenticación requerida para todas las operaciones
- Validación de permisos antes de acciones críticas
- Separación de datos por empresa
- Validación de datos en cliente y servidor (Firebase Rules)

---

## Conclusión

Este sistema es una solución completa de gestión veterinaria que integra múltiples módulos especializados. Utiliza Firebase como backend, proporcionando sincronización en tiempo real y escalabilidad. La arquitectura modular permite fácil mantenimiento y extensión de funcionalidades.

**Fecha**: 2025
