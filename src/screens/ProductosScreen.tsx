import { useEffect, useMemo, useState } from "react";
import { Package, RefreshCw, Search, X } from "lucide-react";
import {
  getPrecioLocal,
  loadCatalogo,
  setPrecioLocal,
  type ProductoCatalogo,
} from "../services/catalog";
import { showToast } from "../ui/toast";
import { EmptyState } from "../components/EmptyState";

function formatPrecio(valor: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function ProductosScreen() {
  const [productos, setProductos] = useState<ProductoCatalogo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ProductoCatalogo | null>(null);
  const [precioEdit, setPrecioEdit] = useState("");

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      setProductos(await loadCatalogo());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProductos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const filtered = useMemo(() => {
    const list = productos ?? [];
    const term = query.trim().toLowerCase();
    if (!term) return list;
    return list.filter((product) =>
      `${product.name ?? ""} ${product.modelo ?? ""} ${product.categoria ?? product.category ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [productos, query]);

  const abrirProducto = (product: ProductoCatalogo) => {
    setSelected(product);
    setPrecioEdit(String(getPrecioLocal(product)));
  };

  const guardarPrecio = () => {
    if (!selected) return;
    const price = Math.max(0, Number(precioEdit) || 0);
    setPrecioLocal(selected.id, price);
    setSelected(null);
    showToast({
      title: "Precio actualizado",
      message: `Precio local de ${selected.name ?? selected.modelo ?? "producto"} guardado (${formatPrecio(price)}).`,
      tone: "success",
    });
  };

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <h1 className="view__title">Productos</h1>
          <p className="view__subtitle">Catálogo de tostadoras y accesorios</p>
        </div>
        <button
          className="btn btn--secondary btn--icon"
          type="button"
          onClick={() => void cargar()}
          disabled={loading}
          aria-label="Actualizar catálogo"
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
      </div>

      <div className="search-field">
        <span className="search-field__icon" aria-hidden="true">
          <Search size={16} />
        </span>
        <input
          className="search-input"
          type="search"
          placeholder="Buscar por nombre, modelo o categoría…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="panel">
        {error ? (
          <EmptyState title="No se pudo sincronizar el catálogo" text={error} />
        ) : loading && productos === null ? (
          <EmptyState title="Cargando catálogo…" text="Consultando Firestore." />
        ) : productos && productos.length === 0 ? (
          <EmptyState
            title="Catálogo vacío"
            text="No se encontraron productos en Firestore. Sincroniza el catálogo desde la web."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            text={`No se encontraron productos para "${query}".`}
          />
        ) : (
          <>
            <ul className="card-list">
              {filtered.map((product) => {
                const nombre = product.name ?? product.modelo ?? "Sin nombre";
                const precio = getPrecioLocal(product);
                return (
                  <li key={product.id} className="card-list__item card-list__item--tap">
                    <button
                      type="button"
                      className="card-list__btn"
                      onClick={() => abrirProducto(product)}
                    >
                      <div className="card-list__top">
                        <div className="card-list__title">{String(nombre)}</div>
                        <span className="card-list__icon" aria-hidden="true">
                          <Package size={16} />
                        </span>
                      </div>
                      <div className="card-list__meta">
                        {product.modelo ? String(product.modelo) : "—"} ·{" "}
                        {String(product.categoria ?? product.category ?? "—")}
                      </div>
                      <div className="card-list__meta card-list__price">
                        {formatPrecio(precio)}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {selected ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label={`Editar precio de ${selected.name ?? selected.modelo ?? "producto"}`}>
          <div className="modal__backdrop" onClick={() => setSelected(null)} />
          <div className="modal__panel">
            <header className="modal__header">
              <span className="modal__title">Editar precio</span>
              <button
                type="button"
                className="modal__close"
                aria-label="Cerrar"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="modal__body">
              <div>
                <div className="card-list__title">{String(selected.name ?? selected.modelo ?? "Sin nombre")}</div>
                <div className="modal__meta">
                  {selected.modelo ? String(selected.modelo) : "—"} ·{" "}
                  {String(selected.categoria ?? selected.category ?? "—")}
                </div>
              </div>
              <div className="modal__field">
                <label className="modal__label" htmlFor="precio-input">
                  Precio local
                </label>
                <input
                  id="precio-input"
                  className="modal__input"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={precioEdit}
                  onChange={(event) => setPrecioEdit(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") guardarPrecio();
                  }}
                />
                <span className="modal__hint">
                  {formatPrecio(Math.max(0, Number(precioEdit) || 0))} · Precio local de esta app,
                  no modifica la web.
                </span>
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn--secondary" onClick={() => setSelected(null)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn--primary" onClick={guardarPrecio}>
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
