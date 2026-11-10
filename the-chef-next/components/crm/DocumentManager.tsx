"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import {
  documentCategories,
  label,
  type EventDocument,
} from "@/lib/crm/domain";
import { formatEtDateTime } from "@/lib/crm/time";

export function DocumentManager({
  eventId,
  clientId,
  documents,
}: {
  eventId: string;
  clientId: string;
  documents: EventDocument[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(form: FormData) {
    setBusy(true);
    setMessage("");
    const file = form.get("file");
    const category = String(form.get("category"));
    const replace = form.get("replace") === "on";
    if (!(file instanceof File) || !file.size) {
      setMessage("Choose a PDF, JPEG, or PNG file.");
      setBusy(false);
      return;
    }
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
      file.size > 10485760
    ) {
      setMessage("Use a PDF, JPEG, or PNG no larger than 10 MB.");
      setBusy(false);
      return;
    }
    const db = browserClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      setMessage("Your session expired. Sign in again.");
      setBusy(false);
      return;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const path = `${eventId}/${category}/${crypto.randomUUID()}-${safeName}`;
    const current = replace
      ? documents.find(
          (document) =>
            document.category === category && document.state === "active",
        )
      : undefined;
    const { error: uploadError } = await db.storage
      .from("crm-documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setMessage("Upload failed. Check the file and try again.");
      setBusy(false);
      return;
    }
    const { error: recordError } = await db.from("event_documents").insert({
      event_id: eventId,
      client_id: clientId,
      category,
      storage_path: path,
      original_filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
      document_group_id: current?.document_group_id ?? crypto.randomUUID(),
      version: current ? current.version + 1 : 1,
      replaces_document_id: current?.id ?? null,
      notes: String(form.get("notes") ?? ""),
    });
    if (recordError) {
      await db.storage.from("crm-documents").remove([path]);
      setMessage("The file was not registered. Please try again.");
      setBusy(false);
      return;
    }
    formRef.current?.reset();
    setMessage("Private document uploaded.");
    setBusy(false);
    router.refresh();
  }

  async function download(document: EventDocument) {
    setMessage("");
    const { data, error } = await browserClient().storage
      .from(document.bucket_id)
      .download(document.storage_path);
    if (error || !data) {
      setMessage("Document could not be downloaded.");
      return;
    }
    const url = URL.createObjectURL(data);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = document.original_filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function archive(id: string) {
    setBusy(true);
    const { error } = await browserClient()
      .from("event_documents")
      .update({ state: "archived" })
      .eq("id", id);
    setMessage(error ? "Document could not be archived." : "Document archived.");
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="crm-panel" id="documents">
      <h2>Private event documents</h2>
      <p className="crm-muted">
        Files use authenticated Storage access. They never receive a public URL.
      </p>
      <form ref={formRef} action={upload}>
        <div className="crm-form-grid">
          <label>
            Category
            <select name="category">
              {documentCategories.map((category) => (
                <option value={category} key={category}>
                  {label(category)}
                </option>
              ))}
            </select>
          </label>
          <label>
            PDF, JPEG or PNG
            <input
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              required
            />
          </label>
        </div>
        <label className="crm-inline-check">
          <input name="replace" type="checkbox" />
          Replace the current active document in this category
        </label>
        <label>
          Document notes
          <textarea name="notes" maxLength={4000} />
        </label>
        <button disabled={busy}>Upload privately</button>
      </form>
      {message && (
        <p className="crm-notice" role="status">
          {message}
        </p>
      )}
      <div className="crm-document-list">
        {documents.map((document) => (
          <article className="crm-record-row" key={document.id}>
            <div>
              <strong>{document.original_filename}</strong>
              <small>
                {label(document.category)} · Version {document.version} ·{" "}
                {label(document.state)} ·{" "}
                {formatEtDateTime(document.created_at)}
              </small>
            </div>
            <div className="crm-row-actions">
              <button
                type="button"
                className="crm-secondary"
                onClick={() => download(document)}
                disabled={busy}
              >
                Download
              </button>
              {document.state === "active" && (
                <button
                  type="button"
                  className="crm-secondary"
                  onClick={() => archive(document.id)}
                  disabled={busy}
                >
                  Archive
                </button>
              )}
            </div>
          </article>
        ))}
        {!documents.length && <p>No documents uploaded.</p>}
      </div>
    </section>
  );
}
