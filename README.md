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


## Estructura

```
src/
  lib/       Lógica copiada de FicaTostadoresAPPv2 (config, firebase, web-api, connections, network)
  services/  Lógica copiada de FicaTostadoresAPPv2 (catalog, solicitudes, heartbeat, cotizacion-pdf)
  ui/        Adaptadores de UI compatibles con los servicios (toast, pdf-viewer, icons, theme)
  components/ App shell, navegación inferior y pantallas en React
  main.tsx   Punto de entrada
```

## Sistema de seguridad (resiliencia offline)

Portado de `FicaTostadoresAPPv2`:

- **Máquina de conectividad** (`src/lib/network.ts`): estados `online` /
  `degraded` / `offline`, sondas con backoff y **reintento inmediato al volver
  la red**. El heartbeat y el polling respetan el estado y no martillan la API
  cuando no hay conexión.
- **Sincronización al reconectar**: al recuperar la red se reenvían las
  cotizaciones locales, los estados de OT pendientes y los precios editados, y
  se recarga la lista de solicitudes.
- **Persistencia offline de Firestore** (`src/lib/firebase.ts`): el catálogo
  funciona sin internet.
- **Banner de conectividad** (`src/components/ConnectionBanner.tsx`): indica
  "Sin conexión" y el nº de cambios guardados localmente por sincronizar.
- Check de **Red local** en vivo en la pantalla Conexiones.

## Notificaciones push (FCM)

Además de las notificaciones locales (`notifications.ts`, solo con la app
abierta/en segundo plano), la app usa **push reales** vía
`@capacitor/push-notifications`, así el staff recibe el aviso **aunque la app
esté cerrada** (el servidor web envía FCM al crearse una cotización o una
solicitud de soporte).

Configuración Android:

1. En Firebase Console → Project settings → Your apps → añade una app Android
   con el package id `com.fica.tostadores.movil` y descarga **google-services.json**.
2. Copia `google-services.json` a `android/app/`.
3. En Firebase Console → Project settings → **Cloud Messaging**, activa Firebase
   Cloud Messaging (Android) si no está activo.
4. Regenera el proyecto:

```bash
npm run build
npm run cap:sync
npx cap open android
```

Al abrir la app, se pedirá permiso de notificaciones, se registrará el token en
la web (`POST /api/electron/fcm-token`) y desde entonces el servidor enviará
push al crearse solicitudes nuevas.

En navegador (PWA) no se registra FCM; las notificaciones locales siguen
cubriendo el aviso mientras la app esté abierta.

## Bloqueo por PIN / biometría

La app puede exigir un **PIN de 4 dígitos** al abrir (y al volver de segundo
plano) para proteger los datos de clientes:

- En **Configuración → Datos de la empresa → Seguridad** puedes activar,
  cambiar o desactivar el PIN, y usar **"Bloquear ahora"**.
- Si el dispositivo lo soporta, se puede habilitar el desbloqueo con
  **huella/rostro** (`@aparajita/capacitor-biometric-auth`) además del PIN.
- El PIN se guarda solo como hash SHA-256 (nunca en claro).

Requisito nativo: tras instalar/actualizar el plugin, regenere con
`npm run cap:sync` y `npx cap open android`.


