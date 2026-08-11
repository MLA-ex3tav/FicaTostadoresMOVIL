# Reglas de Diseño — Fica Tostadores MOVIL

Estas reglas definen cómo debe verse y comportarse la app. Antes de tocar UI, léelas; cualquier pieza nueva debe seguir estos principios y tokens para que la app se sienta como una sola.

---

## 1. Principios

- **Mobile-first.** La app se usa con una mano, en el celular. Todo debe ser alcanzable y legible en pantallas chicas.
- **El naranja es la marca.** `#e85d04` es el único acento. Nunca inventar colores decorativos.
- **Consistencia sobre creatividad.** Siempre usar los tokens de este documento; no valores sueltos.
- **Cada gesto debe sentirse natural.** Pull-to-refresh, cerrar sheets deslizando, buscador plegable: son parte del sistema.
- **Rendimiento.** Animar solo `opacity` y `transform`, nunca layout. Nada de animaciones largas.
- **Siempre temas claro y oscuro.** Un componente nuevo debe verse bien en ambos.

---

## 2. Tokens de diseño

### 2.1 Color

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--primary` | `#e85d04` | `#e85d04` | Acento, botones primarios, estados activos |
| `--accent-hover` | `#ff6b0a` | `#ff6b0a` | Hover de acento |
| `--primary-dark` | `#c44c00` | `#c44c00` | Variante oscura del acento |
| `--success` | `#3ecf8e` | `#3ecf8e` | Operaciones OK |
| `--warning` | `#f5a623` | `#f5a623` | Avisos, pendientes |
| `--danger` | `#e5484d` | `#e5484d` | Errores, eliminar |
| `--info` | `#4da3ff` | `#4da3ff` | Informativo |
| `--bg` | `#12151a` | `#f4f1ec` | Fondo de pantalla |
| `--surface` | `#1c2027` | `#ffffff` | Tarjetas, campos, paneles |
| `--surface-raised` | `#242933` | `#faf6f0` | Elementos elevados |
| `--text` | `#eef0f3` | `#2c2620` | Texto principal |
| `--text-soft` | `#bcc2c9` | `#5c463c` | Texto secundario |
| `--muted` | `#9aa2ab` | `#8a7368` | Texto desvanecido, iconos inactivos |
| `--border-soft` | `rgba(238,240,243,.12)` | `rgba(44,24,16,.1)` | Bordes suaves |
| `--header-bg` | `rgba(18,21,26,.9)` | `rgba(255,255,255,.92)` | Cabeceras con blur |
| `--nav-bg` | `#1a1e26` | `#ffffff` | Barra inferior |
| `--shadow` | `0 8px 24px rgba(0,0,0,.45)` | `0 8px 24px rgba(0,0,0,.12)` | Sombras de elevación |

**Reglas de color:**
- El naranja se usa con intención: botones primarios, FAB, badges, acentos en campos con foco, pill de estado activo.
- Los colores semánticos (`success`, `warning`, `danger`, `info`) **solo** para significado, nunca decoración.
- Texto en naranja solo en enlaces, badges activos o énfasis de marca.
- Gradientes: únicamente en elementos de marca (botón primario, FAB, badge de versión).
- Fondo oscuro por defecto; claro disponible. Ambos deben probarse.

### 2.2 Tipografía

- **Sans:** `Inter` (cuerpo, inputs, listas).
- **Display:** `Oswald` (títulos de pantalla y encabezados de marca, en mayúsculas con `letter-spacing`).
- Escala usada en la app:

| Tamaño | Uso |
|---|---|
| 11px | Eyebrows / micro-labels |
| 12–13px | Metadatos, subtítulos, hints, badges |
| 14–15px | Cuerpo de listas, botones |
| 16–17px | Títulos de cards, inputs |
| 24px | Título principal de pantalla (`view__title`) |

**Reglas:**
- Títulos de pantalla con Oswald, mayúsculas, `letter-spacing: 0.06em`.
- `view__eyebrow` (micro-label arriba del título) en mayúsculas, espaciado amplio.
- `view__subtitle` siempre en `muted`.
- Los montos van siempre con formato `es-CL` (`Intl.NumberFormat`, sin decimales).
- Nunca más de una línea en títulos; truncar con `text-overflow: ellipsis`.

### 2.3 Radios

Escala permitida (las más usadas hoy): **8 · 10 · 12 · 14 · 18 · 20 · 999**

| Valor | Uso |
|---|---|
| 8px | Botones de icono pequeños, chips |
| 10px | Elementos compactos |
| 12px | Botones, items de sheet, tarjetas pequeñas |
| 14px | FAB, botones destacados |
| 18px | Campos de búsqueda, inputs, modales |
| 20px | Sheets (`more-sheet__panel`), esquinas superiores |
| 999px | Pills, badges, indicadores |

### 2.4 Alturas e interacción

- Área táctil mínima: **44 × 44px** (iconos, botones, FAB, lupa del buscador).
- Campo de búsqueda: **56px** de alto.
- Barra de navegación inferior con FAB central (40px) alineado a la barra.
- Padding de contenido: `16px` laterales, `calc(20px + safe-area)` superior, `calc(92px + safe-area)` inferior.
- Contenido centrado con `max-width: 640px`.
- Respetar siempre `env(safe-area-inset-*)`.

---

## 3. Componentes

### Botones
- **`btn--primary`**: fondo naranja (gradiente de marca), texto blanco. Una acción principal por pantalla.
- **`btn--secondary`**: borde suave, fondo transparente. Acciones secundarias.
- **`btn--icon`**: botón cuadrado solo con icono + `aria-label`.
- **`btn--block`**: ancho completo, para pasos finales.
- **`btn--whatsapp`** y **`btn--stage`**: variantes puntuales (WhatsApp, estados).
- `:disabled` siempre visible (opacidad) y sin hover.

### Cards / listas
- `card-list__item` con título, metadatos y `StatusPill`.
- Items con acción usan `card-list__item--tap` (feedback de presión).
- `EmptyState` obligatorio para listas vacías o en carga: icono + título + texto.

### Panels
- `panel` como contenedor de listas y resúmenes; fondo `surface`, borde suave.

### Bottom sheets (`more-sheet`)
- Entran con `slide-up` (0.32s) y salen deslizando hacia abajo (0.26s) + fade del backdrop.
- **Se cierran deslizando hacia abajo** (drag-to-dismiss): resistencia 0.5, umbral 96px, backdrop se atenúa mientras se arrastra.
- Backdrop `rgba(0,0,0,.5)`, tapa todo, cierra al tocar.
- Durante `busy`/procesando, el cierre por gesto/backdrop se deshabilita.
- Usar el hook `useSheetDrag` para cualquier sheet nuevo.

### Picker
- Sheet con buscador interno y lista scrollable. El drag hacia abajo cierra solo si la lista está arriba del todo; si está desplazada, primero hace scroll.

### Buscador plegable (`CollapsibleSearch`)
- Estado normal: **lupa compacta** (círculo 44px).
- Al presionar: se expande a campo completo con **foco automático** y el texto entra con fade retardado (0.25s).
- Se pliega al perder el foco **solo si está vacío**.
- Usar este componente en todas las secciones con buscador (Clientes, Productos, Soporte, Historial).

### Pull-to-refresh
- Implementado en `PullToRefresh` (indicador superior con chevron que rota → spinner).
- Gestos con listeners nativos no-pasivos + `preventDefault`, y `overscroll-behavior-y: none` en `html/body`.
- Umbral 48px, recorrido máximo 56px, resistencia 0.45.

### Toast y badges
- Toasts cortos (1 línea), colores semánticos (`--toast-color`).
- Badges de navegación: naranja, `99+` como tope.

---

## 4. Movimiento

| Tipo | Duración | Easing | Cuándo |
|---|---|---|---|
| Micro (tap, hover) | 150ms | `ease` | Presionar botones, estados activos |
| Estándar | 200ms | `ease` | Cambios de color, hover, focus |
| Mediano | 250ms | `cubic-bezier(.22,1,.36,1)` | Entrada de contenido, fades |
| Sheets / grandes | 280–320ms | `cubic-bezier(.22,1,.36,1)` | Apertura/cierre de sheets y búsqueda plegable |

**Reglas de movimiento:**
- Animar solo `opacity` y `transform`. Nunca `width/height/margin` de elementos pesados.
- Entrar con suavidad (`cubic-bezier(.22,1,.36,1)`), salir con `ease-in` suave.
- `spin` solo para indicar carga real (botones de sync, generación PDF).
- Nunca animar un sheet completo con `width`; usar `transform: translateY`.
- Respetar `prefers-reduced-motion`: desactivar/recortar animaciones.

---

## 5. Gestos táctiles

| Gesto | Comportamiento |
|---|---|
| Deslizar hacia abajo en una sección (arriba del todo) | Refresh |
| Deslizar hacia abajo en un sheet | Cerrar (con umbral y fade del backdrop) |
| Tocar la lupa | Expandir buscador + focus |
| Deslizar en una lista de sheet (no al inicio) | Scroll, no cierra |

---

## 6. Navegación

- Barra inferior: grupos izquierda/derecha + **FAB central** (nueva cotización) + botón **Más**.
- **Más** abre un sheet con las secciones secundarias.
- Pantallas con encabezado estándar: `eyebrow` + `title` (Oswald) + `subtitle` (muted), acciones a la derecha en `view__header__actions`.
- Acciones de cierre (como la X de Nueva Cotización) sin recuadro, solo icono en `muted` (estilo `more-sheet__close`).

---

## 7. Accesibilidad

- `aria-label` obligatorio en todo botón de solo icono.
- Contraste: texto principal vs fondo debe cumplir AA (tokens ya calibrados; no oscurecer `muted` a mano).
- Enfoque visible (`:focus-visible`) con outline naranja.
- Área táctil mínima 44px.
- Textos siempre en español, con acentos correctos.

---

## 8. Checklist antes de terminar un cambio de UI

- [ ] Usa tokens, no colores/tamaños sueltos.
- [ ] Se ve bien en tema oscuro y claro.
- [ ] Respeta 44px de área táctil y safe-areas.
- [ ] Animaciones ≤ 320ms, solo opacity/transform.
- [ ] Sheets usan `useSheetDrag`; buscadores usan `CollapsibleSearch`.
- [ ] `npm run build` (tsc + vite) pasa sin errores.
