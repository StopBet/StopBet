# Sprint 0 — Planificación MVP StopBet

**Fecha:** 29-05-2026
**Equipo:** GPI-2026-1 | Grupo 04 | Campus Casa Central

---

## Equipo

| Nombre | Rol | GitHub |
|--------|-----|--------|
| Alex Domínguez Montiel | Product Owner | — |
| José Meza Pontigo | Scrum Master | @holyusm |
| Matías Lara Plaza | Tech Leader | — |
| Catalina Yáñez Ardissoni | UI/UX | — |
| Eduardo Pacheco Brito | Testing | — |
| Matías Barraza Huerta | Marketing | — |

---

## Historias de Usuario del MVP

El MVP cubre las HdU 01, 03, 04 y 05 (13 SP totales). La HdU 02 está documentada pero se implementa en sprint futuro.

| HdU | Nombre | SP | Categoría | Estado |
|-----|--------|----|-----------|--------|
| HdU01 | Botón de Pánico | 3 (de 5) | Importante | Sprint 0 |
| HdU02 | Asistente Virtual IA | 5 (de 13) | Esencial | Sprint 0 — pendiente de planificación interna |
| HdU03 | Tracker de Logros y Gamificación | 2 (de 3) | Deseable | Sprint 0 |
| HdU04 | Dashboard Clínico para Psicólogos | 3 (de 5) | Importante | Sprint 0 |
| HdU05 | Comunidad y Red de Apoyo | 5 (de 8) | Esencial | Sprint 0 |

**Capacidad total Sprint 0:** 13 SP (1 SP = 6 hrs)

---

## Distribución de Trabajo

| Persona | HdU | Capa | Rama |
|---------|-----|------|------|
| Matías Lara Plaza | HdU01 + HdU05 | Backend (NestJS) | `feature/HU-01-HU-05-backend-matias-lara` |
| Catalina Yáñez Ardissoni | HdU01 | Mobile (React Native) | `feature/HU-01-mobile-catalina-yanez` |
| Catalina Yáñez Ardissoni | HdU03 | Mobile (React Native) | `feature/HU-03-mobile-catalina-yanez` |
| Alex Domínguez Montiel | HdU03 | Backend (NestJS) | `feature/HU-03-backend-alex-dominguez` |
| José Meza Pontigo | HdU04 | Backend (NestJS) | `feature/HU-04-backend-jose-meza` |
| Eduardo Pacheco Brito | HdU04 | Web Dashboard (React) | `feature/HU-04-web-eduardo-pacheco` |
| Matías Barraza Huerta | HdU05 | Mobile (React Native) | `feature/HU-05-mobile-matias-barraza` |

---

## Instrucciones para cada integrante

### 1. Clonar el repositorio (si no lo tienen)
```bash
git clone https://github.com/StopBet/StopBet.git
cd StopBet
```

### 2. Hacer checkout a tu rama asignada
```bash
git fetch origin
git checkout feature/HU-XX-nombre-correspondiente
```

### 3. Instalar dependencias
```bash
pnpm install
```

### 4. Trabajar en tu tarea y hacer commits siguiendo la convención
```bash
git add <archivos>
git commit -m "feat(HU-XX): descripción en imperativo"
git push origin feature/HU-XX-nombre-correspondiente
```

### 5. Cuando termines, abrir un Pull Request a `main` en GitHub

---

## Issues en GitHub

Los issues épicos de cada HdU están en:
**https://github.com/StopBet/StopBet/issues**

| Issue | HdU | Criterios de Aceptación |
|-------|-----|------------------------|
| #1 | HdU01 — Botón de Pánico | 4 CA |
| #2 | HdU02 — Asistente Virtual IA | 3 CA (sprint futuro) |
| #3 | HdU03 — Tracker de Logros | 4 CA |
| #4 | HdU04 — Dashboard Clínico | 3 CA |
| #5 | HdU05 — Comunidad y Red de Apoyo | 4 CA |

---

## Convención de commits

```
<tipo>(HU-XX): <descripción en imperativo, español, máx 72 chars>
```

**Tipos:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`

**Ejemplos válidos:**
```bash
feat(HU-01): agregar endpoint POST /panic con notificacion FCM
feat(HU-04): implementar vista de lista de pacientes en dashboard
fix(HU-03): corregir calculo de dias en contador de abstinencia
test(HU-04): agregar tests unitarios para componente PatientList
```
