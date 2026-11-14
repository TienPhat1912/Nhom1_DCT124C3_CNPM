import { localizeText } from "@hospital/shared";
import { useState } from "react";
import { CheckCircle2, QrCode } from "lucide-react";
import {
  dateText,
  compatibleDoctors,
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
import { StaffReceptionV2 } from "./StaffReceptionV2";
import { RecoveryActions } from "./RecoveryActions";
import { GuestRecoveryLookup } from "./GuestRecoveryLookup";
export default function StaffReception() {
  const { config, t } = useRuntime();
  const [legacy, setLegacy] = useState(false);
  if (!config.prdV2Enabled)
    return (
      <>
        <GuestRecoveryLookup />
        <LegacyStaffReception />
      </>
    );
  return (
    <>
      <GuestRecoveryLookup />
      <Button variant="quiet" onClick={() => setLegacy((value) => !value)}>
        {legacy ? t("Reception") : t("legacyRecords")}
      </Button>
      {legacy ? <LegacyStaffReception /> : <StaffReceptionV2 />}
    </>
  );
}
function LegacyStaffReception() {
  const { t, locale } = useRuntime();
  const [offset, setOffset] = useState(0);
  const list = useResource<(RequestSummary & { sourceLanguage?: string | null })[]>(
    `/api/requests?offset=${offset}`,
    true,
  );
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
          {list.data?.filter((r) => !r.sourceLanguage).map((r) => (
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
          <div className="actions">
            <Button
              variant="quiet"
              disabled={offset === 0 || list.loading}
              onClick={() => {
                setId(null);
                setOffset(Math.max(0, offset - 100));
              }}
            >
              {t("previousPage")}
            </Button>
            <Button
              variant="quiet"
              disabled={list.data?.length !== 100 || list.loading}
              onClick={() => {
                setId(null);
                setOffset(offset + 100);
              }}
            >
              {t("nextPage")}
            </Button>
          </div>
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
  const [ticketRevision, setTicketRevision] = useState(0);
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
          <TicketPanel
            key={`${r.data.visitId}:${ticketRevision}`}
            id={r.data.visitId}
          />
          <RecoveryActions
            id={r.data.visitId}
            onReissued={() => setTicketRevision((revision) => revision + 1)}
          />
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
  const [specialty, setSpecialty] = useState("");
  const clinicSpecialty = (id: string) =>
    resources.clinics?.find((c) => c.id === id)?.specialty;
  const availableLocations = config.locations.filter(
    (l) =>
      l.departmentId === department &&
      (!specialty || clinicSpecialty(l.id) === specialty),
  );
  const departmentSpecialties = [
    ...new Set(
      config.locations
        .filter((l) => l.departmentId === department)
        .map((l) => clinicSpecialty(l.id))
        .filter((s): s is string => !!s),
    ),
  ];
  const availableDoctors = compatibleDoctors(
    resources.doctors,
    department,
    location,
  );
  const selectedLocation = config.locations.find((l) => l.id === location);
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
                    setSpecialty("");
                    setLocation(
                      config.locations.find(
                        (l) =>
                          l.departmentId === e.target.value && l.room !== "R01",
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
              <Field
                label={localizeText("Chuyên khoa / nhóm phòng khám", locale)}
              >
                <select
                  value={specialty}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSpecialty(next);
                    setLocation(
                      config.locations.find(
                        (l) =>
                          l.departmentId === department &&
                          l.room !== "R01" &&
                          (!next || clinicSpecialty(l.id) === next),
                      )?.id ?? "",
                    );
                  }}
                >
                  <option value="">
                    {localizeText("Tất cả chuyên khoa", locale)}
                  </option>
                  {departmentSpecialties.map((s) => (
                    <option key={s} value={s}>
                      {s}
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
                  {availableLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {displayName(l, locale)} ·{" "}
                      {l.room === "?"
                        ? localizeText("Chưa có số phòng", locale)
                        : l.room}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {selectedLocation &&
              (selectedLocation.building === "?" ||
                selectedLocation.floor === "?") && (
                <Notice>
                  {localizeText(
                    "Excel chưa có tòa/tầng của phòng khám này. Cần xác nhận vị trí trước khi hướng dẫn đường đi.",
                    locale,
                  )}
                </Notice>
              )}
            {!availableDoctors.length && (
              <Notice>
                {localizeText(
                  "Chưa có bác sĩ phù hợp với phòng khám đã chọn.",
                  locale,
                )}
              </Notice>
            )}
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
              disabled={
                r.status !== "Submitted" ||
                !location ||
                !availableDoctors.length
              }
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
