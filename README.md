# Fica Tostadores Móvil

Aplicación móvil de administración de Fica Tostadores construida con **React + Vite**, publicable como **PWA** instalable y empaquetable como app nativa con **Capacitor** (Android/iOS).

Basada en la lógica de `FicaTostadoresAPPv2` (Tauri): se reutilizan `src/lib` y `src/services` sin cambios, y la UI se reescribió en componentes React mobile-first.

## Requisitos

- Node.js >= 20
- npm

## Instalación

```bash
npm install
```

## Configuración

Copia `.env.example` a `.env` y completa los valores (los mismos que usa `FicaTostadoresAPPv2`):

```bash
copy .env.example .env
```

## Desarrollo

```bash
npm run dev
```

## Build (PWA)

```bash
npm run build
npm run preview
```

El build genera una PWA instalable (`dist/`). En Android puedes instalarla desde Chrome; en iOS desde Safari con "Añadir a pantalla de inicio".

## App nativa con Capacitor

```bash
npm run build
npx cap add android        # primera vez
npm run cap:sync
npx cap open android
```

## Variables de entorno

| Variable                        | Descripción                                        |
| ------------------------------- | -------------------------------------------------- |
| `VITE_WEB_API_URL`              | URL base de la web (heartbeat, solicitudes).       |
| `VITE_COTIZACIONES_APP_SECRET`  | Secreto compartido (Bearer) con la web.            |
| `VITE_FIREBASE_*`               | Config pública de Firebase (catálogo, lecturas).   |

## Estructura

```
src/
  lib/       Lógica copiada de FicaTostadoresAPPv2 (config, firebase, web-api, connections)
  services/  Lógica copiada de FicaTostadoresAPPv2 (catalog, solicitudes, heartbeat, cotizacion-pdf)
  ui/        Adaptadores de UI compatibles con los servicios (toast, pdf-viewer, icons, theme)
  components/ App shell, navegación inferior y pantallas en React
  main.tsx   Punto de entrada
```
