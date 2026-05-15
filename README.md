# StopBet

Plataforma clínica digital para el tratamiento de la ludopatía, desarrollada en colaboración con AJUTER. Combina intervenciones terapéuticas estructuradas, un asistente IA con límites clínicos validados, y un motor JITAI (Just-In-Time Adaptive Interventions) para contención proactiva en momentos de crisis.

## Estructura del monorepo

```
StopBet/
├── apps/
│   ├── web/        → Dashboard web del terapeuta (React + Vite + Tailwind)
│   ├── backend/    → API REST clínica (NestJS + PostgreSQL + LangChain.js)
│   └── mobile/     → App del paciente Android/iOS (React Native CLI)
└── packages/
    └── shared-types/ → Tipos TypeScript compartidos
```

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend Mobile | React Native CLI |
| Backend | Node.js + NestJS + LangChain.js |
| Base de datos | PostgreSQL con JSONB |
| IA | Gemini Flash / GPT-4o mini + LangChain.js |
| Notificaciones Push | Firebase Cloud Messaging (FCM) |
| Dashboard Web | React + Vite + TypeScript + Tailwind CSS + Recharts |
| Infraestructura | Railway + Vercel + Cloudflare R2 |

## Despliegue

| Servicio | Plataforma | URL |
|---------|-----------|-----|
| Dashboard web | Vercel | (configurar en Vercel) |
| Backend API | Railway | (configurar en Railway) |
| Base de datos | Railway (PostgreSQL) | (automático con backend) |
| Archivos | Cloudflare R2 | (configurar bucket) |

## Levantamiento local

### Requisitos

- Node.js >= 20
- npm >= 10
- PostgreSQL (local o Docker)

### Instalación

```bash
# Instalar dependencias de todos los workspaces
npm install

# Copiar variables de entorno
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
```

### Desarrollo

```bash
# Dashboard web (http://localhost:5173)
npm run web

# Backend API (http://localhost:3000)
npm run backend

# Documentación Swagger (cuando el backend esté corriendo)
# http://localhost:3000/api/docs
```

### Mobile

Ver instrucciones en [apps/mobile/README.md](apps/mobile/README.md).

## Flujo de trabajo

- Sprints gestionados en **Jira** (vincular historias de usuario antes de cada sprint)
- Ramas: `feature/HU-XXX-descripcion`, `fix/HU-XXX-descripcion`
- Pull Requests requieren revisión de al menos 1 compañero
- Main branch siempre debe estar desplegable

## Roles del sistema

| Rol | Descripción |
|-----|-----------|
| `patient` | Paciente en tratamiento |
| `psychologist` | Terapeuta / psicólogo tratante |
| `sponsor` | Padrino de apoyo |
| `family` | Familiar del paciente |
