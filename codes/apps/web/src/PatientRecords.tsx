import { localizeText } from "@hospital/shared";
import { languages, normalizeLocale } from "@hospital/shared";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileText,
  ShieldCheck,
} from "lucide-react";
import {
  dateText,
  displayName,
  type Assistance,
  type Content,
  type Notification,
  type Profile,
  type Session,
  type VisitSummary,
} from "@hospital/shared";
import {
  Button,
  Empty,
  Feedback,
  Field,
  Form,
  Notice,
  ResourceState,
  SectionTitle,
  SpeechControls,
  Status,
  useSpeech,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";

export function Overview({
  visits,
  onSelect,
  onPrepare,
}: {
  visits: VisitSummary[] | null;
  onSelect: (id: string) => void;
  onPrepare: () => void;
}) {
  const { t, session, locale } = useRuntime();
  const active = visits?.find((v) => v.journeyStatus !== "Completed");
  return (
    <>
      <SectionTitle
        eyebrow={t("hospital")}
        title={`${t("hello")}, ${session.name || localizeText("bạn", locale)}`}
      />
      <p className="page-intro">{t("overviewIntro")}</p>
      <div className="overview-hero">
        <div>
          <span className="eyebrow">
            {active ? t("yourJourney") : t("prepare")}
          </span>
          <h2>{active ? active.ticketNumber : t("welcome")}</h2>
          <p>
            {active
              ? `${t("visitStatus")}: ${t(active.status)} · ${t("journeyStatus")}: ${t(active.journeyStatus)}`
              : t("prepareIntro")}
          </p>
          <Button onClick={() => (active ? onSelect(active.id) : onPrepare())}>
            {t(active ? "journey" : "prepare")}
            <ArrowRight size={18} />
          </Button>
        </div>
        <div className="hero-route" aria-hidden="true">
          <span>
            <ClipboardCheck />
          </span>
          <i />
          <span>
            <FileText />
          </span>
          <i />
          <span>
            <ShieldCheck />
          </span>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <Clock3 />
          <strong>
            {visits?.filter((v) => v.journeyStatus !== "Completed").length ??
              "—"}
          </strong>
          <span>{t("Active")}</span>
        </div>
        <div className="stat">
          <ClipboardCheck />
          <strong>
            {visits?.filter((v) => v.journeyStatus === "Completed").length ??
              "—"}
          </strong>
          <span>{t("Completed")}</span>
        </div>
        <div className="stat">
          <CalendarDays />
          <strong>{visits?.length ?? "—"}</strong>
          <span>{t("history")}</span>
        </div>
      </div>
      <div className="panel">
        <SectionTitle title={t("history")} />
        {!visits?.length ? (
          <Empty text={t("noVisits")} />
        ) : (
          visits
            .slice(0, 5)
            .map((v) => (
              <VisitRow key={v.id} visit={v} onClick={() => onSelect(v.id)} />
            ))
        )}
      </div>
    </>
  );
}
export function VisitRow({
  visit,
  onClick,
}: {
  visit: VisitSummary;
  onClick: () => void;
}) {
  const { t, locale } = useRuntime();
  return (
    <button className="record-row" onClick={onClick}>
      <FileText size={21} />
      <span>
        <strong>{visit.ticketNumber}</strong>
        <small>
          {dateText(visit.createdAt, locale)} · {visit.patientName}
        </small>
      </span>
      <div className="row-status">
        <Status value={visit.status} />
        <small>{t(visit.journeyStatus)}</small>
      </div>
      <ArrowRight size={18} />
    </button>
  );
}
export function ResultsPanel({ id }: { id: string | null }) {
  const { t, locale, config } = useRuntime();
  const r = useResource<Content>(
    id ? `/api/visits/${id}/content?language=${locale}` : null,
    true,
  );
  const summary = r.data?.summary;
  const speech = useSpeech(`${id}:${summary?.revision}:${summary?.language}`);
  return (
    <>
      <SectionTitle eyebrow="03 / RESULTS & CARE" title={t("results")} />
      <p className="page-intro">{t("recordHint")}</p>
      <ResourceState resource={r} empty={t("selectVisit")} />
      {r.data && (
        <>
          {summary ? (
            <>
              <div className="content-meta">
                <span>
                  {t("author")}: <strong>{summary.authorName}</strong>
                </span>
                <span>
                  {t("publishedAt")}: {dateText(summary.publishedAt, locale)}
                </span>
                <span>
                  {t("revision")} {summary.revision}
                </span>
                <span>
                  {t("actualLanguage")}: {summary.language}
                </span>
              </div>
              {!summary.fallback && summary.language !== "vi" && (
                <Notice>{t("machineTranslation")}</Notice>
              )}
              {summary.fallback && (
                <Notice>
                  {t("fallback")}: {summary.language}
                </Notice>
              )}
              <div className="content-grid">
                <section className="panel">
                  <span className="eyebrow">01</span>
                  <h3>{t("diagnosis")}</h3>
                  <p className="preserve-text">{summary.diagnosis}</p>
                  {summary.explanation && (
                    <>
                      <h4>{t("explanation")}</h4>
                      <p className="preserve-text">{summary.explanation}</p>
                    </>
                  )}
                  <SpeechControls
                    speech={speech}
                    onPlay={() =>
                      void speech.play(`/api/visits/${id}/narration`, {
                        kind: "Summary",
                        section: "Diagnosis",
                        sourceRevision: summary.revision,
                        contentKey: summary.contentKey,
                        language: locale,
                      })
                    }
                  />
                </section>
                <section className="panel">
                  <span className="eyebrow">02</span>
                  <h3>{t("instructions")}</h3>
                  <p className="preserve-text">{summary.instructions}</p>
                  <SpeechControls
                    speech={speech}
                    onPlay={() =>
                      void speech.play(`/api/visits/${id}/narration`, {
                        kind: "Summary",
                        section: "Instructions",
                        sourceRevision: summary.revision,
                        contentKey: summary.contentKey,
                        language: locale,
                      })
                    }
                  />
                </section>
              </div>
              {summary.documentReference && (
                <p>
                  {t("documentReference")}: {summary.documentReference}
                </p>
              )}
              <details className="panel">
                <summary>
                  {t("original")} · {summary.original.language}
                </summary>
                <h4>{t("diagnosis")}</h4>
                <p className="preserve-text">{summary.original.diagnosis}</p>
                <p className="preserve-text">{summary.original.explanation}</p>
                <h4>{t("instructions")}</h4>
                <p className="preserve-text">{summary.original.instructions}</p>
              </details>
            </>
          ) : (
            <div className="panel">
              <Empty text={t("noPublished")} />
            </div>
          )}
          <section className="panel">
            <SectionTitle title={t("followUp")} />
            <p>{t("followUpHint")}</p>
            {r.data.followUps.length === 0 && (
              <p className="muted">{t("noFollowUp")}</p>
            )}
            {r.data.followUps.map((f) => (
              <div className="follow-up" key={f.id}>
                <CalendarDays />
                <div>
                  <strong>
                    {config.departments.find((d) => d.id === f.departmentId)
                      ? displayName(
                          config.departments.find(
                            (d) => d.id === f.departmentId,
                          )!,
                          locale,
                        )
                      : t("department")}
                  </strong>
                  <p>{dateText(f.recommendedAt, locale)}</p>
                  <p className="preserve-text">{f.text}</p>
                  <small>
                    {t("actualLanguage")}: {f.language}
                    {f.language !== locale ? ` · ${t("fallback")}` : ""}
                  </small>
                </div>
              </div>
            ))}
            {r.data.followUps.length > 0 &&
              (r.data.bookingUrl && /^https:\/\//.test(r.data.bookingUrl) ? (
                <a
                  className="button secondary"
                  href={r.data.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("bookFollowUp")}
                </a>
              ) : (
                <Notice>{t("bookingUnavailable")}</Notice>
              ))}
          </section>
        </>
      )}
    </>
  );
}
export function HelpPanel({
  visitId = null,
  requestId = null,
  stepId,
}: {
  visitId?: string | null;
  requestId?: string | null;
  stepId?: string;
}) {
  const { t, locale, config } = useRuntime();
  const list = useResource<Assistance[]>("/api/assistance", true);
  const mutation = useMutation();
  const [category, setCategory] = useState("Navigation");
  const [description, setDescription] = useState("");
  return (
    <>
      <p className="muted">{config.emergency ?? config.emergencyVi}</p>
      <Form
        busy={mutation.busy}
        onSubmit={async () => {
          if (
            await mutation.run("/api/assistance", {
              category,
              description,
              visitId,
              requestId,
              stepId: stepId ?? null,
            })
          ) {
            setDescription("");
            list.refresh();
          }
        }}
      >
        <Field label={t("category")}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["Navigation", "Language", "Reception", "Queue", "Other"].map(
              (c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ),
            )}
          </select>
        </Field>
        <Field label={t("helpDescription")}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
          />
        </Field>
        <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
        <Button type="submit" busy={mutation.busy}>
          {t("sendHelp")}
        </Button>
      </Form>
      <ResourceState resource={list} />
      {list.data?.length === 0 && <Empty text={t("noHelp")} />}
      {list.data?.map((a) => (
        <div className="help-record" key={a.id}>
          <div className="actions">
            <strong>{t(a.category)}</strong>
            <Status value={a.status} />
          </div>
          <p>{a.description}</p>
          {a.resolution && (
            <p>
              {t("resolution")}: {a.resolution}
            </p>
          )}
          <small>{dateText(a.createdAt, locale)}</small>
        </div>
      ))}
    </>
  );
}
export function NotificationsPanel({
  onVisit,
}: {
  onVisit: (id: string) => void;
}) {
  const { t, locale } = useRuntime();
  const r = useResource<Notification[]>("/api/notifications", true);
  const mutation = useMutation();
  return (
    <>
      <SectionTitle title={t("notifications")} />
      <ResourceState resource={r} />
      {r.data?.length === 0 && <Empty text={t("noNotifications")} />}
      {r.data?.map((n) => (
        <div className={`notification ${n.read ? "read" : ""}`} key={n.id}>
          <Bell size={20} />
          <div>
            <strong>{t(n.key)}</strong>
            <small>{dateText(n.createdAt, locale)}</small>
            <div className="actions">
              {n.visitId && (
                <Button variant="quiet" onClick={() => onVisit(n.visitId!)}>
                  {t("details")}
                </Button>
              )}
              {!n.read && (
                <Button
                  variant="quiet"
                  busy={mutation.busy}
                  onClick={async () => {
                    if (await mutation.run(`/api/notifications/${n.id}/read`))
                      r.refresh();
                  }}
                >
                  {t("readNotification")}
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
      <Feedback error={mutation.error} locale={locale} />
    </>
  );
}
export function ProfilePanel({ onLink }: { onLink: () => void }) {
  const { t } = useRuntime();
  const r = useResource<Profile>("/api/auth/profile");
  return (
    <>
      <SectionTitle title={t("profile")} />
      <ResourceState resource={r} />
      {r.data && (
        <ProfileForm
          key={r.data.version}
          profile={r.data}
          onSaved={r.refresh}
          onLink={onLink}
        />
      )}
    </>
  );
}
function ProfileForm({
  profile,
  onSaved,
  onLink,
}: {
  profile: Profile;
  onSaved: () => void;
  onLink: () => void;
}) {
  const { t, locale, setLocale, session, setSession } = useRuntime();
  const mutation = useMutation();
  const [name, setName] = useState(profile.name);
  const [contact, setContact] = useState(profile.contact);
  return (
    <div className="panel narrow">
      <Form
        busy={mutation.busy}
        onSubmit={async () => {
          if (
            await mutation.run(
              "/api/auth/profile",
              { name, contact, language: locale, version: profile.version },
              "PUT",
            )
          ) {
            setSession({ ...session, name, language: locale });
            onSaved();
          }
        }}
      >
        <Field label={t("name")}>
          <input
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t("contact")}>
          <input
            required
            minLength={5}
            maxLength={80}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </Field>
        <Field label={t("language")}>
          <select
            value={locale}
            onChange={(e) => setLocale(normalizeLocale(e.target.value))}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
        <Button busy={mutation.busy} type="submit">
          {t("save")}
        </Button>
      </Form>
      {session.isGuest && (
        <div className="account-invitation">
          <h3>{t("optionalAccount")}</h3>
          <p>{t("optionalAccountHint")}</p>
          <Button variant="secondary" onClick={onLink}>
            {t("linkAccount")}
          </Button>
        </div>
      )}
    </div>
  );
}
export function LinkAccount({
  visitId,
  onDone,
  onCancel,
}: {
  visitId: string | null;
  onDone: (s: Session, visitId: string | null) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useRuntime();
  const mutation = useMutation();
  const [register, setRegister] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <>
      <p>{t("optionalAccountHint")}</p>
      <div className="segmented">
        <button
          className={register ? "selected" : ""}
          onClick={() => setRegister(true)}
        >
          {t("newAccount")}
        </button>
        <button
          className={!register ? "selected" : ""}
          onClick={() => setRegister(false)}
        >
          {t("existingAccount")}
        </button>
      </div>
      <Form
        busy={mutation.busy}
        onSubmit={async () => {
          const claim = await mutation.run<{ claim: string }>(
            "/api/auth/link-claim",
            { returnVisitId: visitId },
          );
          if (!claim) return;
          const result = await mutation.run<{
            session: Session;
            returnVisitId: string | null;
          }>("/api/auth/convert", {
            claim: claim.claim,
            email,
            password,
            register,
          });
          if (result) onDone(result.session, result.returnVisitId);
        }}
      >
        <Field label={t("email")}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </Field>
        <Field
          label={t("password")}
          hint={register ? t("passwordHint") : undefined}
        >
          <input
            type="password"
            minLength={register ? 12 : 1}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={register ? "new-password" : "current-password"}
          />
        </Field>
        <Feedback error={mutation.error} locale={locale} />
        <div className="actions">
          <Button type="submit" busy={mutation.busy}>
            {t("linkAccount")}
          </Button>
          <Button variant="quiet" type="button" onClick={onCancel}>
            {t("cancel")}
          </Button>
        </div>
      </Form>
    </>
  );
}
