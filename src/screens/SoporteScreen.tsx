import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Headphones, Check, Search, X, Wrench, MessageSquare, ChevronRight } from "lucide-react";
import type { SolicitudRemota } from "../lib/web-api";
import { actualizarEstadoSolicitud } from "../lib/web-api";
import {
  borrarSolicitud,
  getSolicitudDate,
  refreshSolicitudes,
  subscribeSolicitudes,
  type SolicitudesState,
} from "../services/solicitudes";
import { showToast } from "../ui/toast";
import { setNavBadge } from "../lib/badges";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { WhatsAppIcon } from "../components/WhatsAppIcon";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SoporteActionsSheet } from "../components/SoporteActionsSheet";
import { Picker } from "../components/Picker";
import {
  ESTADO_LABELS,
  estadoLabel,
  estadoPillVariant,
  formatCategoryLabel,
  formatFechaHora,
  getEstado,
} from "./shared";

type SoporteTab = "todas" | "abiertas" | "en_curso" | "resueltas";

const LONG_PRESS_MS = 500;

interface ItemState {
  acting: string | null;
}

export function SoporteScreen() {
  const [state, setState] = useState<SolicitudesState | null>(null);
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SoporteTab>("todas");
  const [selectedTicket, setSelectedTicket] = useState<SolicitudRemota | null>(null);
  const [actionsFor, setActionsFor] = useState<SolicitudRemota | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SolicitudRemota | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return subscribeSolicitudes(setState);
  }, []);

  const rawItems = useMemo(() => {
    return state ? state.soporte : [];
  }, [state]);

  const abiertas = useMemo(
    () => rawItems.filter((item) => ["abierta", "pendiente"].includes(getEstado(item, "abierta"))),
    [rawItems],
  );

  const enCurso = useMemo(
    () => rawItems.filter((item) => ["en_curso", "en_revision"].includes(getEstado(item, ""))),
    [rawItems],
  );

  const resueltas = useMemo(
    () => rawItems.filter((item) => ["resuelta", "cerrada", "completada"].includes(getEstado(item, ""))),
    [rawItems],
  );

  useEffect(() => {
    setNavBadge("soporte", abiertas.length);
  }, [abiertas.length]);

  const filteredItems = useMemo(() => {
    let result = rawItems;

    if (activeTab === "abiertas") {
      result = result.filter((item) => ["abierta", "pendiente"].includes(getEstado(item, "abierta")));
    } else if (activeTab === "en_curso") {
      result = result.filter((item) => ["en_curso", "en_revision"].includes(getEstado(item, "")));
    } else if (activeTab === "resueltas") {
      result = result.filter((item) => ["resuelta", "cerrada", "completada"].includes(getEstado(item, "")));
    }

    const term = query.trim().toLowerCase();
    if (!term) return result;

    return result.filter((item) => {
      const client = String(item.clientName ?? "").toLowerCase();
      const phone = String(item.clientPhone ?? "").toLowerCase();
      const email = String(item.clientEmail ?? "").toLowerCase();
      const model = String(item.equipmentModel ?? "").toLowerCase();
      const issue = String(item.issueCategory ?? "").toLowerCase();
      const message = String(item.message ?? "").toLowerCase();
      return (
        client.includes(term) ||
        phone.includes(term) ||
        email.includes(term) ||
        model.includes(term) ||
        issue.includes(term) ||
        message.includes(term)
      );
    });
  }, [rawItems, activeTab, query]);

  if (!state) return null;

  const actualizar = async (id: string, nextState: string) => {
    setItemState((prev) => ({ ...prev, [id]: { acting: nextState } }));
    const result = await actualizarEstadoSolicitud(id, nextState);
    if (result.ok) {
      await refreshSolicitudes();
      showToast({
        title: "Ticket de Soporte Actualizado",
        message: `Estado cambiado a: ${ESTADO_LABELS[nextState] ?? nextState}`,
        tone: "success",
      });
      if (selectedTicket && selectedTicket.id === id) {
        setSelectedTicket((prev) => (prev ? { ...prev, estado: nextState } : null));
      }
    } else {
      setItemState((prev) => ({ ...prev, [id]: { acting: null } }));
      showToast({
        title: "Error al actualizar ticket",
        message: result.error ?? "No se pudo actualizar la solicitud.",
        tone: "error",
      });
    }
  };

  const abrirWhatsapp = (phone: string, clientName?: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, "");
    if (!cleanPhone) {
      showToast({ title: "Sin teléfono", message: "Este ticket no registra teléfono de contacto.", tone: "warning" });
      return;
    }
    const msg = encodeURIComponent(`Hola ${clientName ?? ""}, te contactamos desde Empresas FICA referente a tu solicitud de soporte técnico.`);
    window.open(`https://wa.me/${cleanPhone.replace("+", "")}?text=${msg}`, "_blank");
  };

  const eliminar = async (item: SolicitudRemota) => {
    setDeleting(true);
    const result = await borrarSolicitud(item.id);
    setDeleting(false);
    if (!result.ok) {
      showToast({
        title: "Error al eliminar",
        message: result.error ?? "No se pudo eliminar el ticket.",
        tone: "error",
      });
      return;
    }
    setConfirmDelete(null);
    showToast({
      title: "Ticket Eliminado",
      message: "La solicitud de soporte fue eliminada.",
      tone: "success",
    });
  };

  return (
    <div className="screen">
      <div className="view__header">
        <div>
          <div className="view__eyebrow">Soporte</div>
          <h1 className="view__title">Soporte Técnico</h1>
          <p className="view__subtitle">Atención y seguimiento de servicio posventa</p>
        </div>
      </div>

      <div className="search-field" style={{ marginBottom: "10px" }}>
        <span className="search-field__icon" aria-hidden="true">
          <Search size={16} />
        </span>
        <input
          className="search-input"
          type="search"
          placeholder="Buscar por cliente, equipo o problema..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: "14px" }}>
        <Picker
          label="Categoría"
          value={activeTab}
          onChange={(value) => setActiveTab(value as SoporteTab)}
          searchable={false}
          options={[
            { value: "todas", label: `Todas (${rawItems.length})` },
            { value: "abiertas", label: `Abiertas (${abiertas.length})` },
            { value: "en_curso", label: `En curso (${enCurso.length})` },
            { value: "resueltas", label: `Resueltas (${resueltas.length})` },
          ]}
        />
      </div>

      <div className="panel">
        {filteredItems.length === 0 ? (
          <EmptyState
            title={
              state.error
                ? "Error al consultar la web"
                : state.loading
                  ? "Cargando tickets de soporte…"
                  : "Sin tickets de soporte"
            }
            text={
              state.error
                ? `${state.error} · Revisa la sección Conexiones.`
                : state.loading
                  ? "Sincronizando con el servidor."
                  : query
                    ? "No se encontraron solicitudes para la búsqueda actual."
                    : "Las solicitudes de servicio técnico desde la web aparecerán aquí."
            }
          />
        ) : (
          <ul className="card-list">
            {filteredItems.map((item) => {
              const estado = getEstado(item, "abierta");

              return (
                <li key={item.id} className="card-list__item cot-card">
                  <SoporteLongPressButton
                    item={item}
                    onTap={() => setActionsFor(item)}
                    onLongPress={() => setActionsFor(item)}
                  >
                    <div className="cot-card__top">
                      <div className="cot-card__client">
                        <span className="cot-card__name">
                          {String(item.clientName ?? "Sin nombre")}
                        </span>
                        <span className="cot-card__contact">
                          {String(item.clientPhone ?? item.clientEmail ?? "—")}
                        </span>
                      </div>
                      <StatusPill label={estadoLabel(estado)} variant={estadoPillVariant(estado)} />
                    </div>

                    <div className="cot-card__divider" aria-hidden="true" />

                    <div className="cot-card__row cot-card__row--products">
                      <span className="cot-card__row-icon" aria-hidden="true">
                        <Headphones size={15} strokeWidth={1.75} />
                      </span>
                      <span className="cot-card__products-text">
                        {String(item.equipmentModel ?? "Equipo FICA")} · {formatCategoryLabel(item.issueCategory)}
                      </span>
                    </div>

                    {item.message ? (
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12.5px",
                          color: "var(--text-soft)",
                          lineHeight: "1.35",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {String(item.message)}
                      </p>
                    ) : null}

                    <div className="cot-card__date" style={{ marginTop: "4px" }}>
                      <span>{formatFechaHora(getSolicitudDate(item))}</span>
                      <span className="cot-card__chevron" aria-hidden="true">
                        <ChevronRight size={16} />
                      </span>
                    </div>

                    <div className="ot-card__next-sub">
                      Toca o mantén presionado para opciones
                    </div>
                  </SoporteLongPressButton>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {actionsFor ? (
        <SoporteActionsSheet
          item={actionsFor}
          busy={deleting}
          acting={itemState[actionsFor.id]?.acting ?? null}
          onClose={() => setActionsFor(null)}
          onVerDetalle={() => {
            const target = actionsFor;
            setActionsFor(null);
            setSelectedTicket(target);
          }}
          onAtender={() => {
            const target = actionsFor;
            setActionsFor(null);
            void actualizar(target.id, "en_curso");
          }}
          onResolver={() => {
            const target = actionsFor;
            setActionsFor(null);
            void actualizar(target.id, "resuelta");
          }}
          onWhatsapp={() => {
            const target = actionsFor;
            setActionsFor(null);
            abrirWhatsapp(String(target.clientPhone ?? ""), String(target.clientName ?? ""));
          }}
          onEliminar={() => {
            const target = actionsFor;
            setActionsFor(null);
            setConfirmDelete(target);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar ticket de soporte"
        message={`¿Seguro que deseas eliminar la solicitud de ${confirmDelete ? String(confirmDelete.clientName ?? "este cliente") : ""}? Esta acción no se puede deshacer.`}
        busy={deleting}
        onConfirm={() => {
          if (confirmDelete) void eliminar(confirmDelete);
        }}
        onCancel={() => {
          if (!deleting) setConfirmDelete(null);
        }}
      />

      {/* Bottom Sheet de Detalle de Ticket */}
      {selectedTicket
        ? createPortal(
            <div className="more-sheet" role="dialog" aria-modal="true" aria-label="Detalle de soporte">
              <div className="more-sheet__backdrop" onClick={() => setSelectedTicket(null)} />
              <div
                className="more-sheet__panel"
                style={{
                  maxHeight: "85vh",
                  display: "flex",
                  flexDirection: "column",
                  padding: "8px 12px calc(14px + env(safe-area-inset-bottom))",
                }}
              >
                <header className="more-sheet__header">
                  <div className="cotizacion-sheet__info">
                    <span className="view__eyebrow" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--primary)", fontWeight: 700 }}>
                      Ticket #{selectedTicket.id.slice(0, 8)}
                    </span>
                    <span className="cotizacion-sheet__name" style={{ fontSize: "16px", fontWeight: 800 }}>
                      {String(selectedTicket.clientName ?? "Cliente sin nombre")}
                    </span>
                  </div>
                  <div className="cotizacion-sheet__pill">
                    <StatusPill
                      label={estadoLabel(getEstado(selectedTicket, "abierta"))}
                      variant={estadoPillVariant(getEstado(selectedTicket, "abierta"))}
                    />
                  </div>
                  <button
                    type="button"
                    className="more-sheet__close"
                    aria-label="Cerrar"
                    onClick={() => setSelectedTicket(null)}
                  >
                    <X size={18} />
                  </button>
                </header>

                <div className="cotizacion-sheet__divider" aria-hidden="true" style={{ margin: "2px 0 10px" }} />

                <div
                  className="more-sheet__list"
                  style={{
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                    padding: "4px 4px 12px",
                    gap: "14px",
                  }}
                >
                  {/* Recuadro único con toda la información */}
                  <div
                    style={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border-soft)",
                      borderRadius: "16px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--border-soft)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Wrench size={16} style={{ color: "var(--primary)" }} />
                        <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.04em" }}>
                          Información de Soporte
                        </span>
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>
                        {formatFechaHora(getSolicitudDate(selectedTicket))}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13.5px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--muted)", fontWeight: 500 }}>Modelo de Equipo:</span>
                        <strong style={{ color: "var(--text)", fontWeight: 700 }}>
                          {String(selectedTicket.equipmentModel ?? "No especificado")}
                        </strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--muted)", fontWeight: 500 }}>Categoría de Falla:</span>
                        <span className="category-pill">
                          {formatCategoryLabel(selectedTicket.issueCategory)}
                        </span>
                      </div>

                      {selectedTicket.clientPhone ? (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "var(--muted)", fontWeight: 500 }}>Teléfono:</span>
                          <a
                            href={`tel:${selectedTicket.clientPhone}`}
                            style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}
                          >
                            {String(selectedTicket.clientPhone)}
                          </a>
                        </div>
                      ) : null}

                      {selectedTicket.clientEmail ? (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "var(--muted)", fontWeight: 500 }}>E-mail:</span>
                          <a
                            href={`mailto:${selectedTicket.clientEmail}`}
                            style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}
                          >
                            {String(selectedTicket.clientEmail)}
                          </a>
                        </div>
                      ) : null}
                    </div>

                    {selectedTicket.message ? (
                      <div style={{ paddingTop: "10px", borderTop: "1px solid var(--border-soft)", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <MessageSquare size={14} style={{ color: "var(--muted)" }} />
                          <strong style={{ fontSize: "12px", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            Detalle del mensaje:
                          </strong>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13.5px",
                            lineHeight: "1.5",
                            whiteSpace: "pre-wrap",
                            color: "var(--text)",
                          }}
                        >
                          {String(selectedTicket.message)}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="modal__actions" style={{ marginTop: "6px" }}>
                    {selectedTicket.clientPhone ? (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => abrirWhatsapp(String(selectedTicket.clientPhone), String(selectedTicket.clientName ?? ""))}
                      >
                        <WhatsAppIcon size={16} /> WhatsApp
                      </button>
                    ) : null}

                    {["abierta", "pendiente"].includes(getEstado(selectedTicket, "abierta")) ? (
                      <button
                        type="button"
                        className="btn btn--info"
                        onClick={() => {
                          const targetId = selectedTicket.id;
                          setSelectedTicket(null);
                          void actualizar(targetId, "en_curso");
                        }}
                      >
                        <Headphones size={16} /> En Atender
                      </button>
                    ) : null}

                    {["abierta", "pendiente", "en_curso"].includes(getEstado(selectedTicket, "abierta")) ? (
                      <button
                        type="button"
                        className="btn btn--success"
                        onClick={() => {
                          const targetId = selectedTicket.id;
                          setSelectedTicket(null);
                          void actualizar(targetId, "resuelta");
                        }}
                      >
                        <Check size={16} /> Resolver Ticket
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function SoporteLongPressButton({
  item,
  onTap,
  onLongPress,
  children,
}: {
  item: SolicitudRemota;
  onTap: () => void;
  onLongPress: () => void;
  children: React.ReactNode;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const start = (event: React.PointerEvent) => {
    event.stopPropagation();
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const finish = (event: React.PointerEvent) => {
    event.stopPropagation();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!firedRef.current) {
      onTap();
    }
  };

  const cancel = (event: React.PointerEvent) => {
    event.stopPropagation();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <button
      type="button"
      className="cot-card__btn"
      onPointerDown={start}
      onPointerUp={finish}
      onPointerLeave={(e) => {
        e.stopPropagation();
        cancel(e);
      }}
      onPointerCancel={cancel}
      aria-label={`Opciones del soporte de ${String(item.clientName ?? "sin nombre")}`}
    >
      {children}
    </button>
  );
}
