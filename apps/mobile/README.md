# StopBet Mobile

App móvil React Native CLI para Android (MVP) e iOS.

## Requisitos previos

- Node.js >= 20
- JDK 17 (para Android)
- Android Studio con SDK configurado
- Variables de entorno: `ANDROID_HOME`, `JAVA_HOME`

## Inicialización (primera vez)

Este directorio debe inicializarse con React Native CLI. Ejecutar desde la raíz del monorepo:

```bash
cd apps
npx @react-native-community/cli@latest init mobile --template react-native-template-typescript
```

Luego mover el contenido generado a `apps/mobile/` y actualizar el `package.json` con el nombre `@stopbet/mobile`.

## Scripts

```bash
# Android
npm run android

# iOS
npm run ios

# Metro bundler
npm run start
```

## Estructura prevista

```
apps/mobile/
├── android/          # Código nativo Android (VPNService para filtrado DNS)
├── ios/              # Código nativo iOS
└── src/
    ├── screens/      # Pantallas de la app
    ├── components/   # Componentes reutilizables
    ├── navigation/   # React Navigation
    ├── services/     # API calls, FCM, VPN
    ├── store/        # Estado global (Zustand)
    └── types/        # Tipos TypeScript locales
```

## Notas de arquitectura

- **VPNService de Android**: el filtrado DNS on-device se implementa en el módulo nativo `android/`. Requiere permiso `BIND_VPN_SERVICE`.
- **FCM**: integrar `@react-native-firebase/messaging` para notificaciones JITAI.
- **MVP prioriza Android** (77.16% de market share en Chile, Statcounter marzo 2026).
