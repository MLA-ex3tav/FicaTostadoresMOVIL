import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { getInstanceId } from "../lib/config";
import { eliminarTokenFCM, enviarTokenFCM } from "../lib/web-api";
import { refreshSolicitudes } from "./solicitudes";

/**
 * Notificaciones push reales (FCM vía @capacitor/push-notifications).
 *
 * Complementa las notificaciones locales de `notifications.ts`: con FCM el
 * staff recibe el aviso aunque la app esté cerrada (el SO muestra la
 * notificación). En primer plano, al recibir un push se refrescan los datos
 * silenciosamente (las locales ya cubren el aviso visible).
 *
 * Requisito Android: google-services.json de Firebase en `android/app/`
 * (consulta el README) y proyecto FCM habilitado en Firebase Console.
 */

let registered = false;
let unlisten: PluginListenerHandle[] = [];

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function initPush(): void {
  if (!isNative() || registered) return;
  registered = true;

  void (async () => {
    try {
      const permission = await PushNotifications.requestPermissions();

      if (permission.receive !== "granted") {
        return;
      }

      await PushNotifications.register();

      unlisten.push(
        await PushNotifications.addListener("registration", (event) => {
          void enviarTokenFCM(event.value, Capacitor.getPlatform()).then(
            (result) => {
              if (!result.ok) {
                console.warn(
                  "[push] No se pudo registrar el token FCM en la web:",
                  result.error,
                );
              }
            },
          );
        }),
      );

      unlisten.push(
        await PushNotifications.addListener("registrationError", (error) => {
          console.warn(
            "[push] Error al registrar FCM (¿falta google-services.json?):",
            error,
          );
        }),
      );

      // En primer plano: refrescar datos al llegar una notificación push.
      unlisten.push(
        await PushNotifications.addListener("pushNotificationReceived", () => {
          void refreshSolicitudes();
        }),
      );
    } catch (error) {
      console.warn("[push] No se pudo inicializar notificaciones push:", error);
    }
  })();
}

/** Da de baja el token al salir (opcional; se re-registra en cada arranque). */
export async function unregisterPush(): Promise<void> {
  if (!isNative()) return;
  try {
    await eliminarTokenFCM();
  } catch {
    /* sin conexión: el token se re-registrará en el próximo arranque */
  }
  unlisten.forEach((handle) => {
    void handle.remove().catch(() => {
      /* listener ya removido */
    });
  });
  unlisten = [];
  registered = false;
}

/** Útil para debug en pantalla de Conexiones. */
export function getFCMDeviceId(): string {
  return getInstanceId();
}
