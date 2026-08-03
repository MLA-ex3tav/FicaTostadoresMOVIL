/**
 * Configuración central de la aplicación.
 * Única fuente de verdad para la versión y el repo de actualizaciones.
 */

/** Versión de la app (sincronízala con la `version` del package.json al publicar). */
export const APP_VERSION = "0.1.0";

/**
 * Repositorio GitHub donde se publican las releases del APK (formato "usuario/repo").
 * TODO: cambiar cuando crees el repo en GitHub (ej: "MiUsuario/FicaTostadoresMOVIL").
 * Debe ser un repo real y con permiso para publicar releases.
 */
export const GITHUB_REPO = "FicaTostadores/FicaTostadoresMOVIL";

/** Asset que se descargará en Android (el APK firmado). */
export const APK_ASSET_SUFFIX = ".apk";
