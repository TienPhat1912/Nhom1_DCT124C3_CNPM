import { useState } from "react";
import { CheckCircle2, QrCode } from "lucide-react";
import {
  dateText,
  displayName,
  type ReceptionRequest,
  type ReceptionResources,
  type RequestSummary,
} from "@hospital/shared";
import {
  Button,
  Empty,
  Feedback,
  Field,
  Form,
  Notice,
  ResourceState,
  Scanner,
  SectionTitle,
  Status,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";
import { TicketPanel } from "./PatientJourney";
export default function StaffReception() {
  const { t, locale } = useRuntime();
  const list = useResource<RequestSummary[]>("/api/requests", true);
  const [id, setId] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const mutation = useMutation();
  return (
    <>
      <SectionTitle eyebrow={t("staffWorkspace")} title={t("Reception")}>
        <Button variant="secondary" onClick={() => setScan((s) => !s)}>
          <QrCode size={18} />
          {t("scan")}
        </Button>
      </SectionTitle>
      {scan && (
        <div className="panel">
          <Scanner
            purpose="reception"
            onCode={async (code) => {
              const r = await mutation.run<{ id: string }>(
                "/api/reception/scan",
                { code },
              );
              if (r) {
                setId(r.id);
                setScan(false);
              }
            }}
          />
          <Feedback error={mutation.error} locale={locale} />
        </div>
      )}
      <div className="split-layout">
        <aside className="panel">
          <h3>{t("requestList")}</h3>
          <ResourceState resource={list} />
          {list.data?.length === 0 && <Empty text={t("noRequests")} />}
          {list.data?.map((r) => (
            <button
              className={`record-row ${r.id === id ? "selected" : ""}`}
              key={r.id}
              onClick={() => setId(r.id)}
            >
              <span>
                <strong>{r.name}</strong>
                <small>{dateText(r.createdAt, locale)}</small>
              </span>
              <Status value={r.status} />
            </button>
          ))}
        </aside>
        <div>
          {id ? (
            <ReceptionReview key={id} id={id} onChange={list.refresh} />
          ) : (
            <div className="panel">
              <Empty text={t("noSelection")} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function ReceptionReview({
  id,
  onChange,
}: {
  id: string;
  onChange: () => void;
}) {
  const r = useResource<ReceptionRequest>(`/api/requests/${id}`, true);
  const resources = useResource<ReceptionResources>("/api/reception/resources");
  return (
    <>
      <ResourceState resource={r} />
      <ResourceState resource={resources} />
      {r.data && resources.data && (
        <ReviewForm
          key={r.data.version}
          request={r.data}
          resources={resources.data}
          onChange={() => {
            r.refresh();
            onChange();
          }}
        />
      )}
      {r.data?.visitId && (
        <div className="panel">
          <TicketPanel id={r.data.visitId} />
          <RecoveryActions id={r.data.visitId} />
        </div>
      )}
    </>
  );
}
function ReviewForm({
  request: r,
  resources,
  onChange,
}: {
  request: ReceptionRequest;
  resources: ReceptionResources;
  onChange: () => void;
}) {
  const { t, locale, config } = useRuntime();
  const mutation = useMutation();
  const [department, setDepartment] = useState(r.departmentId);
  const [location, setLocation] = useState(
    config.locations.find(
      (l) => l.departmentId === r.departmentId && l.room !== "R01",
    )?.id ?? "",
  );
  const [doctor, setDoctor] = useState(
    resources.doctors.find((d) => d.departments.includes(r.departmentId))?.id ??
      "",
  );
  const [verified, setVerified] = useState(false);
  const [note, setNote] = useState("");
  const [template, setTemplate] = useState(
    resources.templates.find((t) => t.language === locale)?.id ??
      resources.templates[0]?.id ??
      "",
  );
  const [booking, setBooking] = useState("");
  return (
    <div className="panel">
      <SectionTitle title={r.name}>
        <Status value={r.status} />
      </SectionTitle>
      <dl className="detail-grid">
        <dt>{t("contact")}</dt>
        <dd>{r.contact}</dd>
        <dt>{t("description")}</dt>
        <dd>{r.description || "—"}</dd>
        <dt>{t("requests")}</dt>
        <dd>{r.requests || "—"}</dd>
        <dt>{t("appointment")}</dt>
        <dd>{r.appointmentId ? <CheckCircle2 size={18} /> : "—"}</dd>
      </dl>
      {r.messages.map((m) => (
        <div className="message-box" key={m.id}>
          <p>{m.text}</p>
          <blockquote>{m.response || t("Waiting")}</blockquote>
        </div>
      ))}
      {r.status !== "Confirmed" && r.status !== "Withdrawn" && (
        <>
          <div className="sub-panel">
            <Field label={t("approvedTemplate")}>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                {resources.templates.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.language} · {x.text}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              variant="secondary"
              busy={mutation.busy}
              onClick={async () => {
                if (
                  await mutation.run(`/api/requests/${r.id}/message`, {
                    templateId: template,
                    version: r.version,
                  })
                )
                  onChange();
              }}
            >
              {t("sendMessage")}
            </Button>
          </div>
          <Form
            busy={mutation.busy}
            onSubmit={async () => {
              if (
                await mutation.run(`/api/requests/${r.id}/confirm`, {
                  version: r.version,
                  departmentId: department,
                  locationId: location,
                  doctorId: doctor,
                  attendeeVerified: verified,
                  verificationNote: note,
                })
              )
                onChange();
            }}
          >
            <div className="form-grid">
              <Field label={t("department")}>
                <select
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setLocation(
                      config.locations.find(
                        (l) => l.departmentId === e.target.value,
                      )?.id ?? "",
                    );
                    setDoctor(
                      resources.doctors.find((d) =>
                        d.departments.includes(e.target.value),
                      )?.id ?? "",
                    );
                  }}
                >
                  {config.departments
                    .filter((d) =>
                      resources.doctors.some((doc) =>
                        doc.departments.includes(d.id),
                      ),
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {displayName(d, locale)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label={t("location")}>
                <select
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  {config.locations
                    .filter((l) => l.departmentId === department)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {displayName(l, locale)} · {l.room}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <Field label={t("doctor")}>
              <select
                required
                value={doctor}
                onChange={(e) => setDoctor(e.target.value)}
              >
                {resources.doctors
                  .filter((d) => d.departments.includes(department))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t("verificationNote")}>
              <input
                required
                minLength={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={verified}
                required
                onChange={(e) => setVerified(e.target.checked)}
              />
              {t("attendeeVerified")}
            </label>
            <Button
              type="submit"
              busy={mutation.busy}
              disabled={r.status !== "Submitted"}
            >
              {t("confirmReception")}
            </Button>
          </Form>
          <details className="sub-panel">
            <summary>{t("verifyBooking")}</summary>
            <Field label={t("bookingReference")}>
              <input
                value={booking}
                onChange={(e) => setBooking(e.target.value)}
              />
            </Field>
            <Button
              variant="secondary"
              disabled={!verified || note.length < 3 || !booking}
              busy={mutation.busy}
              onClick={async () => {
                if (
                  await mutation.run(`/api/requests/${r.id}/verify-booking`, {
                    reference: booking,
                    attendeeVerified: verified,
                    verificationNote: note,
                  })
                )
                  onChange();
              }}
            >
              {t("verifyBooking")}
            </Button>
            <small>{t("attendeeVerified")}</small>
          </details>
        </>
      )}
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
    </div>
  );
}
function RecoveryActions({ id }: { id: string }) {
  const { t, locale } = useRuntime();
  const [verified, setVerified] = useState(false);
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState(false);
  const mutation = useMutation();
  return (
    <details className="sub-panel">
      <summary>{t("recover")}</summary>
      <Field label={t("verificationNote")}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          minLength={3}
          maxLength={500}
        />
      </Field>
      <label className="check-field">
        <input
          type="checkbox"
          checked={verified}
          onChange={(e) => setVerified(e.target.checked)}
        />
        {t("attendeeVerified")}
      </label>
      <div className="actions">
        <Button
          variant="secondary"
          disabled={!verified || note.length < 3}
          busy={mutation.busy}
          onClick={async () => {
            if (
              await mutation.run(`/api/visits/${id}/reissue`, {
                attendeeVerified: verified,
                verificationNote: note,
              })
            )
              setIssued(true);
          }}
        >
          {t("reissue")}
        </Button>
        <Button
          variant="secondary"
          disabled={!verified || note.length < 3}
          busy={mutation.busy}
          onClick={async () => {
            const r = await mutation.run<{ recoveryCode: string }>(
              `/api/visits/${id}/recovery`,
              { attendeeVerified: verified, verificationNote: note },
            );
            if (r) setCode(r.recoveryCode);
          }}
        >
          {t("issueRecovery")}
        </Button>
      </div>
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
      {issued && <TicketPanel key="reissued" id={id} />}
      {code && (
        <Notice>
          <strong>{t("recoveryCode")}</strong>
          <code className="code-wrap">{code}</code>
        </Notice>
      )}
    </details>
  );
}
