import type { ProductoColorResumen } from "../screens/shared";

interface ProductColorSwatchesProps {
  colors: ProductoColorResumen[];
  limit?: number;
}

/**
 * Muestra los colores seleccionados de los productos de una cotización
 * como una fila de círculos de color (con la etiqueta del primero).
 */
export function ProductColorSwatches({ colors, limit = 3 }: ProductColorSwatchesProps) {
  if (!colors || colors.length === 0) return null;

  const visible = colors.slice(0, limit);
  const extra = colors.length - visible.length;

  return (
    <span className="product-color-swatches" aria-label={`Colores: ${colors.map((c) => c.color ?? c.colorId ?? "").join(", ")}`}>
      {visible.map((color, index) => (
        <span
          key={`${color.colorId ?? color.color}-${index}`}
          className="product-color-swatches__dot"
          style={{
            backgroundColor: color.hex ?? undefined,
            ...(color.hex ? {} : { backgroundImage: "none", borderColor: "var(--border-soft)" }),
          }}
          title={color.color ?? color.colorId ?? ""}
          aria-hidden="true"
        />
      ))}
      {extra > 0 ? <span className="product-color-swatches__more">+{extra}</span> : null}
    </span>
  );
}