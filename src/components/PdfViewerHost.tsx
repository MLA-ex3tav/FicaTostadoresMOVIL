import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { closePdfViewer, subscribePdfViewer } from "../ui/pdf-viewer";
import type { CotizacionPdf } from "../services/cotizacion-pdf";

GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

export function PdfViewerHost() {
  const [pdf, setPdf] = useState<CotizacionPdf | null>(null);
  const [doc, setDoc] = useState<Awaited<ReturnType<typeof getDocument>["promise"]> | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const taskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    return subscribePdfViewer((next) => {
      setPdf(next);
      if (!next) {
        taskRef.current?.destroy();
        taskRef.current = null;
        setDoc(null);
        setNumPages(0);
        setPageNumber(1);
        setZoom(1);
        setError(null);
      }
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    taskRef.current?.destroy();
    setDoc(null);

    const task = getDocument({ url: pdf.url });
    taskRef.current = task;
    task.promise
      .then((loaded) => {
        if (cancelled) return;
        setDoc(loaded);
        setNumPages(loaded.numPages);
        setPageNumber(1);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo cargar el documento.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [pdf]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!doc || !canvas || containerW <= 0) return;

    setLoading(true);
    doc
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return undefined;
        const baseScale = Math.max((containerW - 24) / page.getViewport({ scale: 1 }).width, 0.2);
        const viewport = page.getViewport({ scale: baseScale * zoom });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const context = canvas.getContext("2d");
        if (!context) return undefined;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        return page.render({ canvas, viewport }).promise;
      })
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo mostrar la página.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, zoom, containerW]);

  if (!pdf) return null;

  const download = () => {
    const anchor = document.createElement("a");
    anchor.href = pdf.url;
    anchor.download = pdf.fileName;
    anchor.click();
  };

  return (
    <div className="pdf-viewer" role="dialog" aria-modal="true" aria-label="Vista previa del PDF">
      <header className="pdf-viewer__topbar">
        <div className="pdf-viewer__info">
          <span className="pdf-viewer__icon" aria-hidden="true">
            <FileText size={18} />
          </span>
          <span className="pdf-viewer__title">{pdf.fileName}</span>
        </div>
        <div className="pdf-viewer__actions">
          <button type="button" className="btn btn--secondary btn--sm" onClick={download}>
            <Download size={14} /> PDF
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={closePdfViewer}>
            <X size={14} /> Cerrar
          </button>
        </div>
      </header>

      <div className="pdf-viewer__stage" ref={scrollRef}>
        {loading ? (
          <div className="pdf-viewer__status">Cargando documento…</div>
        ) : error ? (
          <div className="pdf-viewer__status pdf-viewer__status--error">{error}</div>
        ) : doc ? (
          <canvas ref={canvasRef} className="pdf-viewer__canvas" />
        ) : null}
      </div>

      <footer className="pdf-viewer__bottombar">
        <button
          type="button"
          className="icon-btn"
          aria-label="Página anterior"
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="pdf-viewer__page-label">
          Página {pageNumber} de {numPages}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Página siguiente"
          disabled={pageNumber >= numPages}
          onClick={() => setPageNumber((page) => Math.min(numPages, page + 1))}
        >
          <ChevronRight size={20} />
        </button>
        <span className="pdf-viewer__divider" aria-hidden="true" />
        <button
          type="button"
          className="icon-btn"
          aria-label="Alejar"
          disabled={zoom <= ZOOM_MIN}
          onClick={() => setZoom((value) => Math.max(ZOOM_MIN, value - ZOOM_STEP))}
        >
          <Minus size={18} />
        </button>
        <span className="pdf-viewer__zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Acercar"
          disabled={zoom >= ZOOM_MAX}
          onClick={() => setZoom((value) => Math.min(ZOOM_MAX, value + ZOOM_STEP))}
        >
          <Plus size={18} />
        </button>
      </footer>
    </div>
  );
}
