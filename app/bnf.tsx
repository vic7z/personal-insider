"use client";
/* eslint-disable @next/next/no-img-element -- Temporary PDF page images stay in browser memory and must not use a server image optimizer. */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Upload,
  RefreshCw,
  Search,
  ExternalLink,
  CalendarDays,
  Check,
} from "lucide-react";
import { api } from "./auth-panel";
import {
  bnfSchema,
  maxPdfBytes,
  pageText,
  scheduleDates,
  type BnfDraft,
  type BnfSchedule,
  type PdfText,
} from "@/lib/bnf";
import { displayDate, resortToday, type User } from "@/lib/domain";
import "./bnf.css";

const blank: BnfDraft = {
  title: "",
  start_date: "",
  end_date: "",
  details: "",
  notes: "",
};
export default function Bnf({ user }: { user: User }) {
  const [schedules, setSchedules] = useState<BnfSchedule[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<BnfDraft>(blank);
  const [preview, setPreview] = useState("");
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [zoomed, setZoomed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const canEdit = ["Admin", "Guest Relations"].includes(user.role);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/bnf");
      setSchedules(data.schedules);
      setSelected((old) =>
        data.schedules.some((s: BnfSchedule) => s.id === old)
          ? old
          : (
              data.schedules.find(
                (s: BnfSchedule) =>
                  s.start_date <= resortToday() && s.end_date >= resortToday(),
              ) || data.schedules[0]
            )?.id || "",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const visible = schedules.filter((s) =>
    `${s.title} ${s.details} ${s.notes}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const current = visible.find((s) => s.id === selected) || visible[0];
  async function inspect(pdf: File) {
    setError("");
    setNotice("");
    setConfirmed(false);
    setDraft(blank);
    setFile(null);
    setPreview("");
    setPageImages([]);
    setZoomed(false);
    if (
      pdf.size > maxPdfBytes ||
      !pdf.size ||
      !pdf.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Choose a PDF of 3 MB or smaller.");
      return;
    }
    setBusy(true);
    setUploading(true);
    setFile(pdf);
    setPreview(URL.createObjectURL(pdf));
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const bytes = new Uint8Array(await pdf.arrayBuffer());
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
        throw new Error("This file is not a valid PDF.");
      const task = pdfjs.getDocument({ data: bytes });
      try {
        const doc = await task.promise;
        if (doc.numPages > 20)
          throw new Error("Use a schedule PDF with 20 pages or fewer.");
        const pages: string[] = [];
        const images: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const text = await page.getTextContent();
          pages.push(
            pageText(
              text.items.filter(
                (item): item is typeof item & PdfText => "str" in item,
              ),
            ),
          );
          const canvas = document.createElement("canvas");
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: Math.min(1.5, 1200 / base.width),
          });
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, viewport }).promise;
          images.push(canvas.toDataURL("image/png"));
        }
        const details = pages.join("\n\n");
        setDraft({
          ...blank,
          title: pdf.name.replace(/\.pdf$/i, ""),
          ...scheduleDates(details),
          details,
        });
        setPageImages(images);
        setNotice(
          details.trim()
            ? "Text extracted. Compare it with every page of the original: image text, merged cells, prices and times may need corrections."
            : "No readable text found. Enter the schedule details manually while reviewing the original PDF.",
        );
      } finally {
        await task.destroy();
      }
    } catch (e) {
      setDraft({ ...blank, title: pdf.name.replace(/\.pdf$/i, "") });
      setNotice(
        `Automatic extraction unavailable: ${(e as Error).message} You can still enter details manually and review the original.`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !confirmed) return;
    setError("");
    setBusy(true);
    try {
      const checked = bnfSchema.parse(draft);
      const result = await api("/api/bnf", {
        ...checked,
        filename: file.name.slice(0, 240),
      });
      setSelected(result.id);
      setUploading(false);
      setFile(null);
      setPreview("");
      setPageImages([]);
      setDraft(blank);
      setQuery("");
      setMessage(
        "Reviewed schedule details saved for the team. The PDF was not stored.",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function field(key: keyof BnfDraft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setConfirmed(false);
  }
  return (
    <section className="bnf" aria-label="BNF schedules">
      <div className="bnf-toolbar">
        <div className="bnf-intro">
          <span className="bnf-icon">
            <FileText size={24} />
          </span>
          <div>
            <h2>Weekly dining & entertainment</h2>
            <p>
              Extract a PDF, review the details, save the week. PDFs stay on
              your device.
            </p>
          </div>
        </div>
        <div className="bnf-actions">
          <button
            className="secondary"
            onClick={refresh}
            disabled={busy || loading}
            aria-label="Refresh schedules"
          >
            <RefreshCw size={17} />
          </button>
          {canEdit && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={17} />
              Upload PDF
            </button>
          )}
        </div>
      </div>
      <input
        ref={fileInput}
        aria-label="Schedule PDF"
        className="bnf-file"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          const pdf = e.target.files?.[0];
          if (pdf) void inspect(pdf);
          e.target.value = "";
        }}
      />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <p className="bnf-notice" role="status">
          <Check size={16} />
          {message}
        </p>
      )}
      {uploading ? (
        <form onSubmit={save} className="bnf-review">
          <div className="bnf-review-heading">
            <div>
              <p className="eyebrow">REVIEW BEFORE SAVING</p>
              <h2>{file?.name}</h2>
            </div>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setUploading(false);
                setFile(null);
                setPreview("");
                setPageImages([]);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
          <p className="bnf-notice" role="status">
            {busy ? "Processing schedule…" : notice}
          </p>
          <div className="bnf-review-grid">
            <div>
              <label>
                Schedule title
                <input
                  required
                  maxLength={160}
                  value={draft.title}
                  onChange={(e) => field("title", e.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="bnf-dates">
                <label>
                  From
                  <input
                    type="date"
                    required
                    value={draft.start_date}
                    onChange={(e) => field("start_date", e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  Through
                  <input
                    type="date"
                    required
                    min={draft.start_date}
                    value={draft.end_date}
                    onChange={(e) => field("end_date", e.target.value)}
                    disabled={busy}
                  />
                </label>
              </div>
              <label>
                Full schedule details
                <textarea
                  required
                  rows={20}
                  maxLength={80000}
                  value={draft.details}
                  onChange={(e) => field("details", e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                Review notes
                <textarea
                  rows={3}
                  maxLength={6000}
                  placeholder="Corrections, booking notes or other context for the team"
                  value={draft.notes}
                  onChange={(e) => field("notes", e.target.value)}
                  disabled={busy}
                />
              </label>
            </div>
            <div className="bnf-source">
              <a
                href={preview}
                target="_blank"
                rel="noreferrer"
                className="text-button"
              >
                Open original PDF <ExternalLink size={15} />
              </a>
              {pageImages.length ? (
                <><button type="button" className="text-button" aria-pressed={zoomed} onClick={()=>setZoomed(!zoomed)}>{zoomed?'Fit pages':'Zoom pages to read details'}</button><div className={'bnf-pdf-pages'+(zoomed?' zoomed':'')}>
                  {pageImages.map((src, i) => (
                    <figure key={i}>
                      <img src={src} alt={`Original schedule, page ${i + 1}`} />
                      <figcaption>
                        Page {i + 1} of {pageImages.length}
                      </figcaption>
                    </figure>
                  ))}
                </div></>
              ) : (
                preview && (
                  <iframe src={preview} title="Original PDF for review" />
                )
              )}
            </div>
          </div>
          <label className="bnf-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={busy}
            />
            I reviewed all pages, dates, prices and times against the original
            PDF.
          </label>
          <button className="primary" disabled={busy || !confirmed}>
            {busy ? "Please wait…" : "Save reviewed schedule"}
          </button>
        </form>
      ) : (
        <>
          <div className="bnf-filter">
            <div className="search-box">
              <Search size={18} />
              <input
                aria-label="Search schedules"
                placeholder="Search outlets, experiences or weeks…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <span className="muted">{schedules.length} schedules</span>
          </div>
          {loading ? (
            <div className="empty-state" role="status">
              Loading BNF schedules…
            </div>
          ) : !visible.length ? (
            <div className="empty-state">
              <FileText />
              <h3>
                {query
                  ? "No matching schedules"
                  : error
                    ? "Schedules unavailable"
                    : "Your weekly schedule starts here."}
              </h3>
              <p>
                {query
                  ? "Try another outlet, experience or date."
                  : error
                    ? "Retry after the connection is restored."
                    : "Upload a PDF, review its details and save them for the team. PDFs are not stored."}
              </p>
              {error && (
                <button className="secondary" onClick={refresh}>
                  Retry
                </button>
              )}
            </div>
          ) : (
            <div className="bnf-layout">
              <nav aria-label="Schedule weeks" className="bnf-weeks">
                {visible.map((s) => (
                  <button
                    key={s.id}
                    aria-pressed={current?.id === s.id}
                    onClick={() => setSelected(s.id)}
                    className={current?.id === s.id ? "selected" : ""}
                  >
                    <CalendarDays size={18} />
                    <span>
                      <strong>
                        {displayDate(s.start_date)} – {displayDate(s.end_date)}{" "}
                        {s.end_date.slice(0, 4)}
                      </strong>
                      <small>{s.title}</small>
                      {s.start_date <= resortToday() &&
                        s.end_date >= resortToday() && <em>THIS WEEK</em>}
                    </span>
                  </button>
                ))}
              </nav>
              {current && (
                <article className="bnf-schedule">
                  <header>
                    <div>
                      <p className="eyebrow">B&F SCHEDULE</p>
                      <h2>{current.title}</h2>
                      <p>
                        {displayDate(current.start_date)} –{" "}
                        {displayDate(current.end_date)}{" "}
                        {current.end_date.slice(0, 4)} · Maldives time
                      </p>
                    </div>
                    <span className="badge">Reviewed details</span>
                  </header>
                  <div className="bnf-details">
                    <h3>Full schedule & details</h3>
                    <p className="bnf-detail-text">{current.details}</p>
                  </div>
                  {current.notes && (
                    <aside className="bnf-notes">
                      <h3>Review notes</h3>
                      <p>{current.notes}</p>
                    </aside>
                  )}
                  <footer>
                    {current.filename} · Source filename only · PDF not stored
                  </footer>
                </article>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
