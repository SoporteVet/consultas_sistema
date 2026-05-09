# Veterinaria SaaS - Guía de Inicio Rápido

Sistema de Gestión Veterinaria Multi-tenant construido desde cero con Node.js, React y PostgreSQL.

## 📦 Estructura del Proyecto

```
sistema_ticket_f/
├── backend/              # API NestJS
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   └── README.md
├── frontend/             # React + TypeScript
│   ├── src/
│   ├── package.json
│   └── README.md
└── README.md            # Este archivo
```

## 🚀 Setup Inicial

### 1. Prerequisitos

- **Node.js** 20 LTS ([descargar](https://nodejs.org/))
- **PostgreSQL** 15+ ([descargar](https://www.postgresql.org/download/))
- **Git** ([descargar](https://git-scm.com/))
- **Cuenta Google Cloud** (opcional para producción)

### 2. Instalar PostgreSQL Local

**Windows:**
```powershell
# Descargar e instalar desde:
# https://www.postgresql.org/download/windows/

# O con Chocolatey:
choco install postgresql

# Crear base de datos
createdb veterinaria
```

### 3. Ejecutar Schema SQL

```powershell
# Navegar a la raíz del proyecto
cd d:\sistema_ticket_f

# Ejecutar schema principal
psql -U postgres -d veterinaria -f ../schema.sql

# Ejecutar schema de hospitalización y archivos
psql -U postgres -d veterinaria -f ../schema_extension_hospitalizacion_archivos.sql
```

### 4. Setup Backend

```powershell
cd backend

# Instalar dependencias
npm install

# Copiar .env
copy .env.example .env

# Editar .env (abrir con notepad)
notepad .env

# Actualizar DATABASE_URL:
# DATABASE_URL="postgresql://postgres:tu_password@localhost:5432/veterinaria?schema=public"

# Generar Prisma Client
npm run prisma:generate

# Iniciar servidor
npm run start:dev
```

El backend estará corriendo en: http://localhost:8080
Documentación API (Swagger): http://localhost:8080/api/docs

### 5. Setup Frontend

```powershell
# En otra terminal
cd frontend

# Instalar dependencias
npm install

# Copiar .env
copy .env.example .env

# Iniciar app
npm run dev
```

El frontend estará corriendo en: http://localhost:5173

## 📊 Crear Datos Iniciales

```sql
-- Conectar a PostgreSQL
psql -U postgres -d veterinaria

-- Crear empresa de prueba
INSERT INTO empresas (nombre, email, identificacion, ciudad, pais, plan_subscripcion)
VALUES ('Veterinaria San Martín de Porres', 'admin@vetsmp.com', '3-101-123456', 
        'San José', 'Costa Rica', 'professional');

-- Crear usuario administrador (password: admin123)
INSERT INTO usuarios (empresa_id, nombre_completo, email, password_hash, rol)
VALUES (1, 'Administrador', 'admin@vetsmp.com', 
        '$2b$10$YourHashedPasswordHere', 'admin');
```

## 🏃‍♂️ Desarrollo Diario

```powershell
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Prisma Studio (opcional - GUI para DB)
cd backend
npm run prisma:studio
```

## 🔧 Comandos Útiles

### Backend

```bash
# Generar módulo nuevo
nest g module modules/nombre
nest g controller modules/nombre
nest g service modules/nombre

# Migraciones Prisma
npm run prisma:migrate

# Ver base de datos
npm run prisma:studio

# Tests
npm run test
npm run test:watch
```

### Frontend

```bash
# Lint
npm run lint

# Build
npm run build
npm run preview
```

## 📁 Próximos Pasos

1. **Módulo de Autenticación** - Implementar login JWT
2. **Módulo de Consultas** - CRUD de tickets de consultas
3. **Módulo de Laboratorio** - Gestión de análisis
4. **Dashboard** - Métricas y estadísticas en tiempo real

## 📖 Documentación

- [Plan de Implementación Completo](../implementation_plan.md)
- [Esquema de Base de Datos](../schema.sql)
- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)

## 🐛 Troubleshooting

**Error: Cannot connect to database**
- Verificar que PostgreSQL esté corriendo
- Revisar DATABASE_URL en .env
- Verificar password y nombre de base de datos

**Error: Port already in use**
- Backend usa puerto 8080
- Frontend usa puerto 5173
- Cambiar puertos en .env si están ocupados

**Error: Prisma generate failed**
- Asegurarse de que DATABASE_URL esté correcto
- Ejecutar `npm run prisma:generate` manualmente

## 💡 Tips

- Usa Prisma Studio para inspeccionar la base de datos visualmente
- Swagger UI tiene ejemplos de todos los endpoints
- Hot reload está activo en desarrollo (frontend y backend)
- Usa ESLint y Prettier para mantener código limpio

## 📞 Soporte

Para dudas o problemas: contacto@vetsmp.com
