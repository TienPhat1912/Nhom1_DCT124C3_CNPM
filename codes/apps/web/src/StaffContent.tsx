import { useState } from "react";
import { dateText, displayName, type Draft } from "@hospital/shared";
import {
  Button,
  Feedback,
  Field,
  Form,
  Notice,
  ResourceState,
  SectionTitle,
  Status,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";
export function DoctorContent({ visitId }: { visitId: string }) {
  const { t, locale } = useRuntime();
  const r = useResource<Draft[]>(`/api/visits/${visitId}/drafts`);
  const [selected, setSelected] = useState<string | null>(null);
  const [copy, setCopy] = useState<Draft | undefined>();
  const [editorKey, setEditorKey] = useState(0);
  const draft = r.data?.find((d) => d.id === selected);
  const published = r.data?.find((d) => d.status === "Published");
  return (
    <>
      <div className="panel">
        <SectionTitle title={t("doctorContent")}>
          <Button
            variant="secondary"
            onClick={() => {
              setSelected(null);
              setCopy(published);
              setEditorKey((k) => k + 1);
            }}
          >
            {t("newCorrection")}
          </Button>
        </SectionTitle>
        <ResourceState resource={r} />
        {r.data && (
          <>
            <div className="version-list">
              {r.data.map((d) => (
                <button
                  key={d.id}
                  className={`version-chip ${d.id === selected ? "selected" : ""}`}
                  onClick={() => {
                    setSelected(d.id);
                    setCopy(undefined);
                  }}
                >
                  <span>
                    {t("revision")} {d.revision}
                  </span>
                  <Status value={d.status} />
                </button>
              ))}
            </div>
            {draft && draft.status !== "Draft" ? (
              <>
                <div className="content-meta">
                  <span>{draft.authorName}</span>
                  <span>{dateText(draft.publishedAt, locale)}</span>
                </div>
                <h4>{t("diagnosis")}</h4>
                <p className="preserve-text">{draft.diagnosis}</p>
                <p className="preserve-text">{draft.explanation}</p>
                <h4>{t("instructions")}</h4>
                <p className="preserve-text">{draft.instructions}</p>
                {draft.status === "Published" && (
                  <TranslationForm
                    key={draft.id}
                    draft={draft}
                    onChange={r.refresh}
                  />
                )}
              </>
            ) : (
              <DraftForm
                key={`${draft?.id ?? "new"}:${draft?.version}:${editorKey}`}
                visitId={visitId}
                draft={draft}
                copy={copy}
                onChange={(id) => {
                  setSelected(id);
                  r.refresh();
                }}
              />
            )}
          </>
        )}
      </div>
      <div className="panel">
        <FollowUpForm visitId={visitId} />
      </div>
    </>
  );
}
function DraftForm({
  visitId,
  draft,
  copy,
  onChange,
}: {
  visitId: string;
  draft?: Draft;
  copy?: Draft;
  onChange: (id: string) => void;
}) {
  const { t, locale } = useRuntime();
  const source = draft ?? copy;
  const [diagnosis, setDiagnosis] = useState(source?.diagnosis ?? "");
  const [explanation, setExplanation] = useState(source?.explanation ?? "");
  const [instructions, setInstructions] = useState(source?.instructions ?? "");
  const [documentReference, setDocument] = useState(
    source?.documentReference ?? "",
  );
  const [language, setLanguage] = useState(source?.language ?? locale);
  const [reviewed, setReviewed] = useState(false);
  const mutation = useMutation();
  const unchanged =
    !!draft &&
    diagnosis === draft.diagnosis &&
    explanation === draft.explanation &&
    instructions === draft.instructions &&
    language === draft.language &&
    documentReference === draft.documentReference;
  return (
    <>
      <Notice>{t("Draft")}</Notice>
      <Form
        busy={mutation.busy}
        onSubmit={async () => {
          const r = await mutation.run<{ id: string }>(
            `/api/visits/${visitId}/drafts`,
            {
              diagnosis,
              explanation,
              instructions,
              language,
              documentReference,
              draftId: draft?.id ?? null,
              version: draft?.version ?? 0,
            },
          );
          if (r) onChange(r.id);
        }}
      >
        <Field label={t("actualLanguage")}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label={t("diagnosis")}>
          <textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            maxLength={4000}
            rows={3}
          />
        </Field>
        <Field label={t("explanation")}>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            maxLength={4000}
            rows={3}
          />
        </Field>
        <Field label={t("instructions")}>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={6000}
            rows={4}
          />
        </Field>
        <Field label={t("documentReference")}>
          <input
            value={documentReference}
            onChange={(e) => setDocument(e.target.value)}
            maxLength={500}
          />
        </Field>
        <Button type="submit" busy={mutation.busy}>
          {t("saveDraft")}
        </Button>
      </Form>
      {draft && (
        <div className="publication-review">
          <h4>{t("review")}</h4>
          <p>
            {t("revision")} {draft.revision} · {t("actualLanguage")}:{" "}
            {draft.language}
          </p>
          <label className="check-field">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {t("reviewed")}
          </label>
          <Button
            disabled={
              !reviewed || !unchanged || !draft.diagnosis || !draft.instructions
            }
            busy={mutation.busy}
            onClick={async () => {
              const r = await mutation.run<{ id: string }>(
                `/api/visits/${visitId}/drafts/${draft.id}/publish`,
                { version: draft.version, reviewed },
              );
              if (r) onChange(r.id);
            }}
          >
            {t("publish")}
          </Button>
          {!unchanged && <small>{t("saveDraft")}</small>}
        </div>
      )}
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
    </>
  );
}
function TranslationForm({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: () => void;
}) {
  const { t, locale } = useRuntime();
  const [language, setLanguage] = useState(
    draft.language === "vi" ? "en" : "vi",
  );
  const [diagnosis, setDiagnosis] = useState("");
  const [explanation, setExplanation] = useState("");
  const [instructions, setInstructions] = useState("");
  const [approved, setApproved] = useState(false);
  const mutation = useMutation();
  return (
    <details className="sub-panel">
      <summary>{t("translation")}</summary>
      {draft.translations.map((tr) => (
        <div className="message-box" key={tr.id}>
          <strong>{tr.language}</strong>
          <p>{tr.diagnosis}</p>
          <p>{tr.instructions}</p>
        </div>
      ))}
      <Form
        busy={mutation.busy}
        onSubmit={async () => {
          if (
            await mutation.run(
              `/api/visits/${draft.visitId}/summaries/${draft.id}/translations`,
              {
                language,
                diagnosis,
                explanation,
                instructions,
                approved,
                sourceRevision: draft.revision,
              },
            )
          )
            onChange();
        }}
      >
        <Field label={t("language")}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label={t("diagnosis")}>
          <textarea
            value={diagnosis}
            required
            maxLength={4000}
            onChange={(e) => setDiagnosis(e.target.value)}
          />
        </Field>
        <Field label={t("explanation")}>
          <textarea
            value={explanation}
            maxLength={4000}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </Field>
        <Field label={t("instructions")}>
          <textarea
            value={instructions}
            required
            maxLength={6000}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </Field>
        <label className="check-field">
          <input
            type="checkbox"
            checked={approved}
            required
            onChange={(e) => setApproved(e.target.checked)}
          />
          {t("reviewed")}
        </label>
        <Button type="submit" busy={mutation.busy}>
          {t("approveTranslation")}
        </Button>
      </Form>
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
    </details>
  );
}
function FollowUpForm({ visitId }: { visitId: string }) {
  const { t, locale, config } = useRuntime();
  const [department, setDepartment] = useState(config.departments[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const mutation = useMutation();
  return (
    <>
      <h3>{t("followUp")}</h3>
      <p>{t("followUpHint")}</p>
      <Form
        busy={mutation.busy}
        onSubmit={async () => {
          await mutation.run(`/api/visits/${visitId}/follow-ups`, {
            departmentId: department,
            recommendedAt: new Date(date + "T09:00:00+07:00").toISOString(),
            text,
            language: locale,
            reviewed,
          });
        }}
      >
        <div className="form-grid">
          <Field label={t("department")}>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {config.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {displayName(d, locale)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("recommendedDate")}>
            <input
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t("text")}>
          <textarea
            value={text}
            required
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <label className="check-field">
          <input
            type="checkbox"
            required
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          {t("reviewed")}
        </label>
        <Button type="submit" busy={mutation.busy}>
          {t("publishFollowUp")}
        </Button>
      </Form>
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
    </>
  );
}
