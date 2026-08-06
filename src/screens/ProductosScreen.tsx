import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CloudUpload, Package, RefreshCw, Search } from "lucide-react";
import {
  getPrecioLocal,
  loadCatalogo,
  setPrecioLocal,
  subscribeCatalogo,
  syncAllPreciosToServer,
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

function formatPrecioChileno(valor: number): string {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(valor);
}

function parsePrecioChileno(texto: string): number {
  const digits = texto.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export function ProductosScreen() {
  const [productos, setProductos] = useState<ProductoCatalogo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ProductoCatalogo | null>(null);
  const [precioEdit, setPrecioEdit] = useState("");
  const [syncing, setSyncing] = useState(false);

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
    const unsubscribe = subscribeCatalogo((docs) => {
      setProductos(docs);
      setLoading(false);
      setError(null);
    });
    return unsubscribe;
  }, []);

  const subirPrecios = async () => {
    setSyncing(true);
    try {
      const result = await syncAllPreciosToServer();
      if (result.ok) {
        showToast({
          title: "Precios sincronizados",
          message: `${result.total} precio(s) subidos a Firebase. Cualquier instalación los tendrá.`,
          tone: "success",
        });
      } else {
        showToast({
          title: "Sincronización parcial",
          message: `${result.total - result.failed.length} de ${result.total} subidos. Error de ejemplo: ${result.failed[0]?.reason ?? "desconocido"}.`,
          tone: "warning",
        });
      }
    } catch (err) {
      showToast({
        title: "No se pudieron subir los precios",
        message: err instanceof Error ? err.message : String(err),
        tone: "error",
      });
    } finally {
      setSyncing(false);
    }
  };

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
    const precio = getPrecioLocal(product);
    setPrecioEdit(precio > 0 ? formatPrecioChileno(precio) : "");
  };

  const cambiarPrecio = (texto: string) => {
    const digits = texto.replace(/\D/g, "");
    setPrecioEdit(digits ? formatPrecioChileno(Number(digits)) : "");
  };

  const guardarPrecio = () => {
    if (!selected) return;
    const price = parsePrecioChileno(precioEdit);
    setPrecioLocal(selected.id, price);
    setSelected(null);
    showToast({
      title: "Precio actualizado",
      message: `Precio de ${selected.name ?? selected.modelo ?? "producto"} guardado y sincronizado (${formatPrecio(price)}).`,
      tone: "success",
    });
  };

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <div className="view__eyebrow">Catálogo</div>
          <h1 className="view__title">Productos</h1>
          <p className="view__subtitle">Catálogo de tostadoras y accesorios</p>
        </div>
        <div className="view__header__actions">
          <button
            className="btn btn--secondary btn--icon"
            type="button"
            onClick={() => void subirPrecios()}
            disabled={syncing}
            aria-label="Subir todos los precios a Firebase"
            title="Subir todos los precios a Firebase"
          >
            <CloudUpload size={16} className={syncing ? "spin" : ""} />
          </button>
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

      {selected ? createPortal(
        <div className="more-sheet" role="dialog" aria-modal="true" aria-label={`Editar precio de ${selected.name ?? selected.modelo ?? "producto"}`}>
          <div className="more-sheet__backdrop" onClick={() => setSelected(null)} />
          <div className="more-sheet__panel">
            <div className="modal-sheet__body">
              <div className="modal-sheet__title">Editar precio</div>
              <div>
                <div className="card-list__title">{String(selected.name ?? selected.modelo ?? "Sin nombre")}</div>
                <div className="modal__meta">
                  {selected.modelo ? String(selected.modelo) : "—"} ·{" "}
                  {String(selected.categoria ?? selected.category ?? "—")}
                </div>
              </div>
              <div className="modal__field">
                <label className="modal__label" htmlFor="precio-input">
                  Precio
                </label>
                <input
                  id="precio-input"
                  className="modal__input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={precioEdit}
                  onChange={(event) => cambiarPrecio(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") guardarPrecio();
                  }}
                />
                <span className="modal__hint">
                  {formatPrecio(parsePrecioChileno(precioEdit))} · Se sincroniza con
                  Firebase: quedará disponible para cualquier instalación.
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
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
