"use client";

import type {
  Blueprint,
  BlueprintFaq,
  BlueprintHours,
  BlueprintService,
  OnboardingSource,
  Weekday,
} from "@gracesoft/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  fetchBlueprint,
  fetchOnboardingSources,
  fetchVerticalTemplate,
  generateBlueprintDraft,
  publishBlueprint,
  submitDocumentSource,
  submitUrlSource,
  updateBlueprint,
} from "@/lib/api";
import { clearDevSession } from "@/lib/session";
import { useRequireSession } from "@/lib/useRequireSession";

const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const emptyHours = (): BlueprintHours[] => WEEKDAYS.map((day) => ({ day, closed: true }));

/**
 * Phase 1 onboarding wizard (01-milestones.md): input step (submit a URL or upload a
 * doc) -> auto-draft (LLM extraction, falls back to a heuristic extractor without
 * ANTHROPIC_API_KEY — see apps/api's modules/onboarding/llmProvider.ts) -> this page's
 * form is the human-in-the-loop review/edit step before "Publish" goes live.
 */
export default function BlueprintPage() {
  const actor = useRequireSession();
  const router = useRouter();

  const [sources, setSources] = useState<OnboardingSource[]>([]);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [services, setServices] = useState<BlueprintService[]>([]);
  const [hours, setHours] = useState<BlueprintHours[]>(emptyHours());
  const [faqs, setFaqs] = useState<BlueprintFaq[]>([]);

  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        clearDevSession();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router],
  );

  const loadSources = useCallback(async () => {
    if (!actor) return;
    try {
      const { sources: fetched } = await fetchOnboardingSources(actor);
      setSources(fetched);
    } catch (err) {
      if (!handleAuthError(err)) setError(err instanceof Error ? err.message : "Failed to load sources");
    }
  }, [actor, handleAuthError]);

  const loadBlueprint = useCallback(async () => {
    if (!actor) return;
    try {
      const { blueprint: fetched } = await fetchBlueprint(actor);
      setBlueprint(fetched);
      if (fetched) {
        setServices(fetched.services);
        setHours(fetched.hours.length > 0 ? fetched.hours : emptyHours());
        setFaqs(fetched.faqs);
      }
    } catch (err) {
      if (!handleAuthError(err)) setError(err instanceof Error ? err.message : "Failed to load blueprint");
    }
  }, [actor, handleAuthError]);

  useEffect(() => {
    loadSources();
    loadBlueprint();
  }, [loadSources, loadBlueprint]);

  async function handleSubmitUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!actor || !urlInput.trim()) return;
    setBusy("submitting URL");
    setError(null);
    try {
      await submitUrlSource(actor, urlInput.trim());
      setUrlInput("");
      await loadSources();
    } catch (err) {
      if (!handleAuthError(err)) setError(err instanceof Error ? err.message : "Failed to submit URL");
    } finally {
      setBusy(null);
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!actor || !file) return;
    setBusy("uploading document");
    setError(null);
    try {
      await submitDocumentSource(actor, file);
      await loadSources();
    } catch (err) {
      if (!handleAuthError(err)) setError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleGenerateDraft() {
    if (!actor) return;
    setBusy("generating draft");
    setError(null);
    setNotice(null);
    try {
      const { blueprint: generated } = await generateBlueprintDraft(actor);
      setBlueprint(generated);
      setServices(generated.services);
      setHours(generated.hours.length > 0 ? generated.hours : emptyHours());
      setFaqs(generated.faqs);
      setNotice("Draft generated — review and edit below before publishing.");
    } catch (err) {
      if (!handleAuthError(err)) setError(err instanceof Error ? err.message : "Failed to generate draft");
    } finally {
      setBusy(null);
    }
  }

  async function handleLoadClinicTemplate() {
    if (!actor) return;
    setBusy("loading template");
    setError(null);
    setNotice(null);
    try {
      const { template } = await fetchVerticalTemplate(actor, "clinic");
      setServices(template.services);
      setHours(template.hours.length > 0 ? template.hours : emptyHours());
      setFaqs(template.faqs);
      setNotice(
        "Clinic template loaded — this is generic placeholder content. Edit the fees, hours, and policies below before saving.",
      );
    } catch (err) {
      if (!handleAuthError(err)) setError(err instanceof Error ? err.message : "Failed to load template");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveDraft() {
    if (!actor) return;
    setBusy("saving");
    setError(null);
    setNotice(null);
    try {
      const { blueprint: saved } = await updateBlueprint(actor, { services, hours, faqs });
      setBlueprint(saved);
      setNotice("Draft saved.");
    } catch (err) {
      if (!handleAuthError(err)) setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setBusy(null);
    }
  }

  async function handlePublish() {
    if (!actor) return;
    setBusy("publishing");
    setError(null);
    setNotice(null);
    try {
      const { blueprint: published } = await publishBlueprint(actor);
      setBlueprint(published);
      setNotice("Published — this content is now live.");
    } catch (err) {
      if (!handleAuthError(err)) setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setBusy(null);
    }
  }

  if (!actor) return null;

  const hasProcessedSource = sources.some((s) => s.status === "processed");

  return (
    <main>
      <header className="page-header">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="page-title">Blueprint</h1>
          <p className="page-subtitle">
            Everything your concierge knows about your business. Add sources, generate a draft, then
            review it before it goes live.
          </p>
        </div>
        {blueprint && (
          <span className={`badge ${blueprint.status === "published" ? "badge-success" : "badge-warning"}`}>
            {blueprint.status}
          </span>
        )}
      </header>

      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}
      {notice && <div className="alert alert-info">{notice}</div>}

      <section className="card">
        <div className="card-header">
          <div style={{ display: "flex" }}>
            <span className="step-number">1</span>
            <div>
              <h2 className="card-title">Add sources</h2>
              <p className="card-description">Your website or a document describing your services.</p>
            </div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmitUrl} className="form-row">
            <label className="field" style={{ flex: 1, minWidth: 240 }}>
              <span className="label">Website URL</span>
              <input
                className="input"
                placeholder="https://your-clinic-website.com"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
            </label>
            <button type="submit" disabled={!!busy || !urlInput.trim()} className="btn btn-primary">
              Submit URL
            </button>
          </form>
          <div className="divider-text">or</div>
          <label className="dropzone">
            <UploadIcon />
            <span>
              <strong style={{ color: "var(--text)" }}>
                {busy === "uploading document" ? "Uploading…" : "Upload a document"}
              </strong>
              <span className="hint" style={{ display: "block" }}>
                Plain text or Markdown (.txt, .md)
              </span>
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={handleUploadFile}
              disabled={!!busy}
              style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
            />
          </label>
        </div>
        {sources.length > 0 && (
          <div className="table-wrap" style={{ borderTop: "1px solid var(--border)" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id}>
                    <td className="wrap">{source.type === "url" ? source.url : source.fileName}</td>
                    <td className="wrap">
                      <span className={`badge ${SOURCE_BADGE[source.status]}`}>{source.status}</span>
                      {source.status === "failed" && source.errorMessage && (
                        <div className="hint" style={{ color: "var(--danger)", marginTop: 4 }}>
                          {source.errorMessage}
                        </div>
                      )}
                    </td>
                    <td>{new Date(source.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div style={{ display: "flex" }}>
            <span className="step-number">2</span>
            <div>
              <h2 className="card-title">Create a draft</h2>
              <p className="card-description">Either option replaces the current draft below.</p>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="option-grid">
            <div className="option">
              <strong>Generate from sources</strong>
              <p>Extracts services, hours, and FAQs from every successfully processed source above.</p>
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={!!busy || !hasProcessedSource}
                className="btn btn-primary"
              >
                {busy === "generating draft" ? "Generating…" : "Generate draft"}
              </button>
            </div>
            <div className="option">
              <strong>Start from a template</strong>
              <p>
                A generic GP clinic template (Phase 2: Healthcare) — placeholder content you edit rather
                than write from scratch.
              </p>
              <button type="button" onClick={handleLoadClinicTemplate} disabled={!!busy} className="btn">
                Load GP clinic template
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div style={{ display: "flex" }}>
            <span className="step-number">3</span>
            <div>
              <h2 className="card-title">Review &amp; publish</h2>
              <p className="card-description">
                {blueprint
                  ? [
                      blueprint.generatedByLlm ? "LLM-generated, not yet hand-reviewed" : "Hand-edited",
                      blueprint.publishedAt
                        ? `last published ${new Date(blueprint.publishedAt).toLocaleString()}`
                        : "never published",
                    ].join(" · ")
                  : "Nothing saved yet."}
              </p>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="editor-section">
            <div className="editor-section-header">
              <h3 className="editor-section-title">Services</h3>
              <button
                type="button"
                onClick={() => setServices((s) => [...s, { name: "" }])}
                className="btn btn-sm"
              >
                + Add service
              </button>
            </div>
            {services.length === 0 && <p className="hint">No services yet.</p>}
            <div className="editor-rows">
              {services.map((service, i) => (
                <div key={i} className="editor-row">
                  <input
                    className="input"
                    placeholder="Name"
                    aria-label="Service name"
                    value={service.name}
                    onChange={(e) => updateAt(setServices, i, { ...service, name: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <input
                    className="input"
                    placeholder="Description"
                    aria-label="Service description"
                    value={service.description ?? ""}
                    onChange={(e) => updateAt(setServices, i, { ...service, description: e.target.value })}
                    style={{ flex: 2 }}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Min"
                    aria-label="Duration in minutes"
                    value={service.durationMinutes ?? ""}
                    onChange={(e) =>
                      updateAt(setServices, i, {
                        ...service,
                        durationMinutes: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    style={{ width: 90 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeAt(setServices, i)}
                    className="btn btn-sm btn-danger-ghost"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="editor-section">
            <div className="editor-section-header">
              <h3 className="editor-section-title">Opening hours</h3>
            </div>
            <div className="hours-grid">
              {hours.map((h, i) => (
                <div key={h.day} className="hours-row">
                  <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{h.day}</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!h.closed}
                      onChange={(e) => updateAt(setHours, i, { ...h, closed: !e.target.checked })}
                    />
                    {h.closed ? "Closed" : "Open"}
                  </label>
                  {!h.closed && (
                    <div className="hours-times">
                      <input
                        className="input"
                        type="time"
                        aria-label={`${h.day} opens`}
                        value={h.opens ?? ""}
                        onChange={(e) => updateAt(setHours, i, { ...h, opens: e.target.value })}
                      />
                      <span>to</span>
                      <input
                        className="input"
                        type="time"
                        aria-label={`${h.day} closes`}
                        value={h.closes ?? ""}
                        onChange={(e) => updateAt(setHours, i, { ...h, closes: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="editor-section">
            <div className="editor-section-header">
              <h3 className="editor-section-title">FAQs</h3>
              <button
                type="button"
                onClick={() => setFaqs((f) => [...f, { question: "", answer: "" }])}
                className="btn btn-sm"
              >
                + Add FAQ
              </button>
            </div>
            {faqs.length === 0 && <p className="hint">No FAQs yet.</p>}
            <div className="editor-rows">
              {faqs.map((faq, i) => (
                <div key={i} className="editor-row">
                  <input
                    className="input"
                    placeholder="Question"
                    aria-label="Question"
                    value={faq.question}
                    onChange={(e) => updateAt(setFaqs, i, { ...faq, question: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <input
                    className="input"
                    placeholder="Answer"
                    aria-label="Answer"
                    value={faq.answer}
                    onChange={(e) => updateAt(setFaqs, i, { ...faq, answer: e.target.value })}
                    style={{ flex: 2 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeAt(setFaqs, i)}
                    className="btn btn-sm btn-danger-ghost"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card-footer">
          <button type="button" onClick={handleSaveDraft} disabled={!!busy} className="btn">
            {busy === "saving" ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!!busy || !blueprint}
            className="btn btn-primary"
          >
            {busy === "publishing" ? "Publishing…" : "Publish (go live)"}
          </button>
        </div>
      </section>
    </main>
  );
}

const SOURCE_BADGE: Record<OnboardingSource["status"], string> = {
  pending: "badge-warning",
  processed: "badge-success",
  failed: "badge-danger",
};

function updateAt<T>(setter: (fn: (list: T[]) => T[]) => void, index: number, value: T) {
  setter((list) => list.map((item, i) => (i === index ? value : item)));
}

function removeAt<T>(setter: (fn: (list: T[]) => T[]) => void, index: number) {
  setter((list) => list.filter((_, i) => i !== index));
}

function UploadIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}
