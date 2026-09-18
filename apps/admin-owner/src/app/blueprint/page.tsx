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

  return (
    <main>
      <h1>Blueprint</h1>
      <p style={{ color: "var(--muted)" }}>
        Submit source material, generate a draft, then review and edit it here before publishing.
      </p>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {notice && <p style={{ color: "var(--accent)" }}>{notice}</p>}

      <section style={sectionStyle}>
        <h2 style={h2Style}>1. Input: submit sources</h2>
        <form onSubmit={handleSubmitUrl} style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <input
            placeholder="https://your-clinic-website.com"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            style={{ flex: 1, minWidth: 240, padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <button type="submit" disabled={!!busy} style={buttonStyle}>
            Submit URL
          </button>
        </form>
        <label style={{ display: "inline-block" }}>
          <span style={{ display: "block", marginBottom: 6, fontSize: 14, color: "var(--muted)" }}>
            Or upload a document (.txt/.md)
          </span>
          <input ref={fileInputRef} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={handleUploadFile} disabled={!!busy} />
        </label>

        {sources.length > 0 && (
          <table style={{ marginTop: 16 }}>
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
                  <td>{source.type === "url" ? source.url : source.fileName}</td>
                  <td>
                    {source.status}
                    {source.status === "failed" && source.errorMessage ? ` — ${source.errorMessage}` : ""}
                  </td>
                  <td>{new Date(source.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>2. Auto-draft</h2>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Generates services/hours/FAQs from every successfully-processed source above, overwriting the
          current draft below.
        </p>
        <button
          type="button"
          onClick={handleGenerateDraft}
          disabled={!!busy || sources.every((s) => s.status !== "processed")}
          style={buttonStyle}
        >
          Generate draft from sources
        </button>

        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 16 }}>
          Or start from a pre-built template for your vertical (Phase 2: Healthcare) —
          generic placeholder content you edit rather than write from scratch.
        </p>
        <button type="button" onClick={handleLoadClinicTemplate} disabled={!!busy} style={buttonStyle}>
          Load GP clinic template
        </button>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>3. Review &amp; edit</h2>
        {blueprint && (
          <p style={{ fontSize: 14, color: "var(--muted)" }}>
            Status: <strong>{blueprint.status}</strong>
            {blueprint.generatedByLlm ? " (LLM-generated, not yet hand-reviewed)" : ""}
            {blueprint.publishedAt ? ` — published ${new Date(blueprint.publishedAt).toLocaleString()}` : ""}
          </p>
        )}

        <h3 style={h3Style}>Services</h3>
        {services.map((service, i) => (
          <div key={i} style={rowStyle}>
            <input
              placeholder="Name"
              value={service.name}
              onChange={(e) => updateAt(setServices, i, { ...service, name: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Description"
              value={service.description ?? ""}
              onChange={(e) => updateAt(setServices, i, { ...service, description: e.target.value })}
              style={{ ...inputStyle, flex: 2 }}
            />
            <input
              type="number"
              placeholder="Minutes"
              value={service.durationMinutes ?? ""}
              onChange={(e) =>
                updateAt(setServices, i, {
                  ...service,
                  durationMinutes: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              style={{ ...inputStyle, width: 100 }}
            />
            <button type="button" onClick={() => removeAt(setServices, i)} style={removeButtonStyle}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setServices((s) => [...s, { name: "" }])} style={addButtonStyle}>
          + Add service
        </button>

        <h3 style={h3Style}>Hours</h3>
        {hours.map((h, i) => (
          <div key={h.day} style={rowStyle}>
            <span style={{ width: 100, textTransform: "capitalize" }}>{h.day}</span>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={!h.closed}
                onChange={(e) => updateAt(setHours, i, { ...h, closed: !e.target.checked })}
              />
              Open
            </label>
            {!h.closed && (
              <>
                <input
                  type="time"
                  value={h.opens ?? ""}
                  onChange={(e) => updateAt(setHours, i, { ...h, opens: e.target.value })}
                  style={inputStyle}
                />
                <span>to</span>
                <input
                  type="time"
                  value={h.closes ?? ""}
                  onChange={(e) => updateAt(setHours, i, { ...h, closes: e.target.value })}
                  style={inputStyle}
                />
              </>
            )}
          </div>
        ))}

        <h3 style={h3Style}>FAQs</h3>
        {faqs.map((faq, i) => (
          <div key={i} style={rowStyle}>
            <input
              placeholder="Question"
              value={faq.question}
              onChange={(e) => updateAt(setFaqs, i, { ...faq, question: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Answer"
              value={faq.answer}
              onChange={(e) => updateAt(setFaqs, i, { ...faq, answer: e.target.value })}
              style={{ ...inputStyle, flex: 2 }}
            />
            <button type="button" onClick={() => removeAt(setFaqs, i)} style={removeButtonStyle}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFaqs((f) => [...f, { question: "", answer: "" }])}
          style={addButtonStyle}
        >
          + Add FAQ
        </button>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button type="button" onClick={handleSaveDraft} disabled={!!busy} style={buttonStyle}>
            Save draft
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!!busy || !blueprint}
            style={{ ...buttonStyle, background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            Publish (go live)
          </button>
        </div>
      </section>
    </main>
  );
}

function updateAt<T>(setter: (fn: (list: T[]) => T[]) => void, index: number, value: T) {
  setter((list) => list.map((item, i) => (i === index ? value : item)));
}

function removeAt<T>(setter: (fn: (list: T[]) => T[]) => void, index: number) {
  setter((list) => list.filter((_, i) => i !== index));
}

const sectionStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
  marginBottom: 24,
};
const h2Style: React.CSSProperties = { fontSize: 18, marginTop: 0 };
const h3Style: React.CSSProperties = { fontSize: 15, marginTop: 20, marginBottom: 8 };
const rowStyle: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", marginBottom: 8 };
const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: 8,
  border: "1px solid var(--border)",
  borderRadius: 6,
};
const buttonStyle: React.CSSProperties = {
  padding: "10px 18px",
  background: "var(--surface)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  cursor: "pointer",
};
const addButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: "6px 12px",
  fontSize: 13,
};
const removeButtonStyle: React.CSSProperties = {
  padding: "6px 10px",
  background: "none",
  color: "var(--danger)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  cursor: "pointer",
};
