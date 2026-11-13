import { localizeText } from "@hospital/shared";
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  languages,
  type ApiProblemV2,
  type LocaleV2,
  type RegistrationRequestV2,
} from "@hospital/shared";
import { ArrowRight, CalendarDays, ClipboardList, QrCode } from "lucide-react";
import {
  dateText,
  type Booking,
  type Profile,
  type ReceptionRequest,
  type RequestSummary,
} from "@hospital/shared";
import {
  Button,
  Empty,
  Feedback,
  Field,
  Form,
  Notice,
  QrPanel,
  ResourceState,
  SectionTitle,
  SpeechControls,
  Status,
  useSpeech,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";

export function PatientReception({
  onVisit,
  onProfile,
}: {
  onVisit: (id: string) => void;
  onProfile?: () => void;
}) {
  const { config } = useRuntime();
  return config.prdV2Enabled ? (
    <ReceptionV2 onVisit={onVisit} onProfile={onProfile} />
  ) : (
    <LegacyReception onVisit={onVisit} />
  );
}

function ReceptionV2({
  onVisit,
  onProfile,
}: {
  onVisit: (id: string) => void;
  onProfile?: (() => void) | undefined;
}) {
  const { config, t, locale } = useRuntime();
  const profile = useResource<Profile>("/api/auth/profile");
  const [offset, setOffset] = useState(0);
  const rows = useResource<RegistrationRequestV2[]>(
    `/api/v2/requests?offset=${offset}`,
    true,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useResource<RegistrationRequestV2>(
    selected ? `/api/v2/requests/${selected}` : null,
    true,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [legacyId, setLegacyId] = useState<string | null>(null);
  const legacy = useResource<
    (RequestSummary & { sourceLanguage?: string | null })[]
  >(historyOpen ? `/api/requests?offset=${offset}` : null);
  const mutation = useMutation();
  const [contact, setContact] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<LocaleV2 | "">(
    locale === "vi" || locale === "en" || locale === "zh" || locale === "ja"
      ? locale
      : "",
  );
  const [preferredDepartmentId, setPreferredDepartmentId] = useState("");
  const openedVisit = useRef<string | null>(null);
  const confirmedVisitId = detail.data?.visitId;
  useEffect(() => {
    if (confirmedVisitId && openedVisit.current !== confirmedVisitId) {
      openedVisit.current = confirmedVisitId;
      onVisit(confirmedVisitId);
    }
  }, [confirmedVisitId, onVisit]);
  const problem =
    mutation.error instanceof ApiError
      ? (mutation.error.problem as ApiProblemV2)
      : null;
  const openExisting = () => {
    if (problem?.existingVisitId) onVisit(problem.existingVisitId);
    else if (problem?.existingRequestId) {
      if (problem.existingRequestContract === "legacy") {
        setHistoryOpen(true);
        setLegacyId(problem.existingRequestId);
      } else setSelected(problem.existingRequestId);
      mutation.clear();
    }
  };
  return (
    <>
      <SectionTitle title={t("prepare")} />
      <ResourceState resource={profile} />
      <div className="panel narrow">
        <Form
          busy={mutation.busy}
          onSubmit={async () => {
            const result = await mutation.run<RegistrationRequestV2>(
              "/api/v2/requests",
              {
                contact: contact ?? profile.data?.contact ?? "",
                preferredDepartmentId: preferredDepartmentId || null,
                description,
                sourceLanguage,
              },
            );
            if (result) {
              setSelected(result.id);
              setOffset(0);
              rows.refresh();
            }
          }}
        >
          <p>{profile.data?.name}</p>
          {profile.data && profile.data.name.trim().length < 2 && (
            <Notice>
              {t("completeProfile")}
              {onProfile && (
                <Button type="button" onClick={onProfile}>
                  {t("profile")}
                </Button>
              )}
            </Notice>
          )}
          <Field label={t("contact")}>
            <input
              required
              minLength={5}
              maxLength={80}
              autoComplete="tel"
              value={contact ?? profile.data?.contact ?? ""}
              onChange={(e) => setContact(e.target.value)}
            />
          </Field>
          <Field label={t("preferredDepartment")}>
            <select
              value={preferredDepartmentId}
              onChange={(e) => setPreferredDepartmentId(e.target.value)}
            >
              <option value="">{t("noPreference")}</option>
              {config.departments
                .filter((d) => d.active)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name ?? d.nameVi}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("descriptionLanguage")}>
            <select
              required
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value as LocaleV2)}
            >
              <option value="">{t("language")}</option>
              {languages
                .filter((l) => ["vi", "en", "zh", "ja"].includes(l.code))
                .map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("description")}>
            <textarea
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Feedback error={mutation.error} locale={locale} />
          {(problem?.existingRequestId || problem?.existingVisitId) && (
            <Button type="button" variant="secondary" onClick={openExisting}>
              {t(problem.existingVisitId ? "continueVisit" : "continueRequest")}
            </Button>
          )}
          <Button
            type="submit"
            busy={mutation.busy}
            disabled={
              !profile.data ||
              profile.data.name.trim().length < 2 ||
              !sourceLanguage
            }
          >
            {t("sendRequest")}
          </Button>
        </Form>
      </div>
      <div className="panel">
        <SectionTitle title={t("requestList")} />
        <ResourceState resource={rows} />
        {rows.data?.length === 0 && <Empty text={t("noRequests")} />}
        {rows.data?.map((r) => (
          <button
            className="record-row"
            key={r.id}
            onClick={() => setSelected(r.id)}
          >
            <span>
              {r.patientName} · {dateText(r.createdAt, locale)}
            </span>
            <Status value={r.status} />
          </button>
        ))}
        <div className="actions">
          <Button
            variant="quiet"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 100))}
          >
            {t("previousPage")}
          </Button>
          <Button
            variant="quiet"
            disabled={rows.data?.length !== 100}
            onClick={() => setOffset(offset + 100)}
          >
            {t("nextPage")}
          </Button>
        </div>
        {selected && <ResourceState resource={detail} />}
        {detail.data && (
          <article>
            <Status value={detail.data.status} />
            <p>
              {detail.data.contact} · {detail.data.sourceLanguage}
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{detail.data.description}</p>
            {detail.data.visitId ? (
              <Button onClick={() => onVisit(detail.data!.visitId!)}>
                {t("continueVisit")}
              </Button>
            ) : (
              detail.data.status === "Submitted" && (
                <Notice>{t("receptionAwaitingConfirmation")}</Notice>
              )
            )}
          </article>
        )}
      </div>
      <Button variant="quiet" onClick={() => setHistoryOpen((v) => !v)}>
        {t("legacyRecords")}
      </Button>
      {historyOpen && (
        <div className="panel">
          <ResourceState resource={legacy} />
          {legacy.data
            ?.filter((r) => !r.sourceLanguage)
            .map((r) => (
              <button
                className="record-row"
                key={r.id}
                onClick={() => setLegacyId(r.id)}
              >
                {r.name} · {dateText(r.createdAt, locale)}
              </button>
            ))}
          <div className="actions">
            <Button
              variant="quiet"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 100))}
            >
              {t("previousPage")}
            </Button>
            <Button
              variant="quiet"
              disabled={legacy.data?.length !== 100}
              onClick={() => setOffset(offset + 100)}
            >
              {t("nextPage")}
            </Button>
          </div>
          {legacyId && (
            <RequestDetail
              id={legacyId}
              onVisit={onVisit}
              onChanged={legacy.refresh}
              readOnly
            />
          )}
        </div>
      )}
    </>
  );
}

function LegacyReception({ onVisit }: { onVisit: (id: string) => void }) {
  const { t, locale, session } = useRuntime();
  const [offset, setOffset] = useState(0);
  const requests = useResource<RequestSummary[]>(
    `/api/requests?offset=${offset}`,
    true,
  );
  const profile = useResource<Profile>("/api/auth/profile");
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "new" | "appointments">("list");
  return (
    <>
      <SectionTitle eyebrow="01 / RECEPTION" title={t("prepare")} />
      <p className="page-intro">{t("prepareIntro")}</p>
      <div className="actions">
        <Button
          onClick={() => {
            setMode("new");
            setSelected(null);
          }}
        >
          <ClipboardList size={18} />
          {t("walkIn")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setMode("appointments");
            setSelected(null);
          }}
        >
          <CalendarDays size={18} />
          {t("appointment")}
        </Button>
      </div>
      <div className="split-layout">
        <aside className="panel">
          <h3>{t("requestList")}</h3>
          <ResourceState resource={requests} />
          {requests.data?.length === 0 && <Empty text={t("noRequests")} />}
          {requests.data?.map((r) => (
            <button
              className={`record-row ${selected === r.id ? "selected" : ""}`}
              key={r.id}
              onClick={() => {
                setSelected(r.id);
                setMode("list");
              }}
            >
              <QrCode size={20} />
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
              disabled={offset === 0 || requests.loading}
              onClick={() => {
                setSelected(null);
                setMode("list");
                setOffset(Math.max(0, offset - 100));
              }}
            >
              {t("previousPage")}
            </Button>
            <Button
              variant="quiet"
              disabled={requests.data?.length !== 100 || requests.loading}
              onClick={() => {
                setSelected(null);
                setMode("list");
                setOffset(offset + 100);
              }}
            >
              {t("nextPage")}
            </Button>
          </div>
        </aside>
        <div>
          {mode === "appointments" ? (
            <AppointmentPanel
              onPrepared={(id) => {
                setOffset(0);
                requests.refresh();
                setSelected(id);
                setMode("list");
              }}
            />
          ) : mode === "new" ? (
            <div className="panel">
              <h3>{t("newRequest")}</h3>
              {session.isGuest &&
              requests.data?.some((r) => r.status !== "Withdrawn") ? (
                <Notice>
                  {t("requestList")}
                  <Button
                    variant="quiet"
                    onClick={() => {
                      const r = requests.data?.find(
                        (r) => r.status !== "Withdrawn",
                      );
                      if (r) {
                        setSelected(r.id);
                        setMode("list");
                      }
                    }}
                  >
                    {t("details")}
                  </Button>
                </Notice>
              ) : profile.data ? (
                <RequestForm
                  key="new"
                  profile={profile.data}
                  onSaved={(id) => {
                    setOffset(0);
                    requests.refresh();
                    setSelected(id);
                    setMode("list");
                  }}
                />
              ) : (
                <ResourceState resource={profile} />
              )}
            </div>
          ) : selected ? (
            <RequestDetail
              key={selected}
              id={selected}
              onVisit={onVisit}
              onChanged={requests.refresh}
            />
          ) : (
            <div className="panel">
              <Empty text={t("selectRequest")} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function RequestForm({
  profile,
  request,
  onSaved,
}: {
  profile?: Profile;
  request?: ReceptionRequest;
  onSaved: (id: string) => void;
}) {
  const { t, config, locale } = useRuntime();
  const [name, setName] = useState(request?.name ?? profile?.name ?? "");
  const [contact, setContact] = useState(
    request?.contact ?? profile?.contact ?? "",
  );
  const [description, setDescription] = useState(request?.description ?? "");
  const [requests, setRequests] = useState(request?.requests ?? "");
  const [response, setResponse] = useState("");
  const mutation = useMutation();
  const message = request?.messages.filter((m) => !m.response).at(-1);
  const errors =
    mutation.error &&
    typeof mutation.error === "object" &&
    "problem" in mutation.error
      ? (mutation.error as { problem: { errors?: Record<string, string> } })
          .problem.errors
      : undefined;
  return (
    <Form
      busy={mutation.busy}
      onSubmit={async () => {
        const information = {
          name,
          contact,
          description,
          requests,
          departmentId:
            request?.departmentId ??
            config.departments.find((d) => d.code === "CONSULT")?.id,
          version: request?.version ?? 0,
        };
        const result = await mutation.run<{ id: string }>(
          request ? `/api/requests/${request.id}` : "/api/requests",
          request
            ? { information, messageId: message?.id ?? null, response }
            : information,
          request ? "PUT" : "POST",
        );
        if (result) onSaved(result.id);
      }}
    >
      <div className="form-grid">
        <Field label={t("name")} error={errors?.name && t("tooShort")}>
          <input
            required
            minLength={config.form.nameMin}
            maxLength={config.form.nameMax}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </Field>
        <Field label={t("contact")} error={errors?.contact && t("tooShort")}>
          <input
            required
            minLength={config.form.contactMin}
            maxLength={config.form.contactMax}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            autoComplete="tel"
          />
        </Field>
      </div>
      <Field label={t("description")} hint={t("descriptionHint")}>
        <textarea
          maxLength={config.form.descriptionMax}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </Field>
      <Field label={t("requests")}>
        <textarea
          maxLength={2000}
          value={requests}
          onChange={(e) => setRequests(e.target.value)}
          rows={2}
        />
      </Field>
      {message && (
        <Field label={t("response")}>
          <textarea
            required
            maxLength={2000}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
        </Field>
      )}
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
      <Button type="submit" busy={mutation.busy}>
        {t(request ? "supplement" : "sendRequest")}
        <ArrowRight size={17} />
      </Button>
    </Form>
  );
}
function RequestDetail({
  id,
  onVisit,
  onChanged,
  readOnly = false,
}: {
  id: string;
  onVisit: (id: string) => void;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const { t, locale } = useRuntime();
  const resource = useResource<ReceptionRequest>(`/api/requests/${id}`, true);
  const mutation = useMutation();
  const speech = useSpeech(id);
  const [edit, setEdit] = useState(false);
  const r = resource.data;
  return (
    <div className="panel">
      <ResourceState resource={resource} />
      {r && (
        <>
          <SectionTitle title={t("receptionQr")}>
            <Status value={r.status} />
          </SectionTitle>
          <QrPanel purpose="reception" code={r.code} expires={r.qrExpiresAt} />
          {readOnly && (
            <article>
              <p>
                {r.name} · {r.contact}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{r.description}</p>
              {r.requests && (
                <p style={{ whiteSpace: "pre-wrap" }}>{r.requests}</p>
              )}
            </article>
          )}
          {r.messages.map((m) => (
            <div className="message-box" key={m.id}>
              <p>{m.text}</p>
              <small>
                {t("actualLanguage")}: {m.language}
              </small>
              {m.language !== locale && <small>{t("fallback")}</small>}
              <SpeechControls
                speech={speech}
                onPlay={() =>
                  void speech.play(
                    `/api/requests/${id}/messages/${m.id}/narration`,
                    {
                      kind: "Message",
                      section: "",
                      sourceRevision: 1,
                      language: locale,
                      contentKey: m.contentKey,
                    },
                  )
                }
              />
              {m.response && <blockquote>{m.response}</blockquote>}
            </div>
          ))}
          {r.visitId ? (
            <Button onClick={() => onVisit(r.visitId!)}>
              {t("viewTicket")}
              <ArrowRight size={17} />
            </Button>
          ) : (
            !readOnly &&
            r.status !== "Withdrawn" && (
              <>
                <div className="actions">
                  <Button
                    variant="secondary"
                    onClick={() => setEdit((e) => !e)}
                  >
                    {t("supplement")}
                  </Button>
                  <Button
                    variant="quiet"
                    busy={mutation.busy}
                    onClick={async () => {
                      if (await mutation.run(`/api/requests/${id}/refresh-qr`))
                        resource.refresh();
                    }}
                  >
                    {t("refreshQr")}
                  </Button>
                  <Button
                    variant="danger"
                    busy={mutation.busy}
                    onClick={async () => {
                      if (await mutation.run(`/api/requests/${id}/withdraw`)) {
                        resource.refresh();
                        onChanged();
                      }
                    }}
                  >
                    {t("withdraw")}
                  </Button>
                </div>
                {(edit || r.status === "NeedsInformation") && (
                  <RequestForm
                    key={r.version}
                    request={r}
                    onSaved={() => {
                      resource.refresh();
                      onChanged();
                      setEdit(false);
                    }}
                  />
                )}
              </>
            )
          )}
          <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
        </>
      )}
    </div>
  );
}
function AppointmentPanel({
  onPrepared,
}: {
  onPrepared: (id: string) => void;
}) {
  const { t, locale, session, config } = useRuntime();
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState("");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const mutation = useMutation();
  if (session.isGuest)
    return (
      <div className="panel">
        <h3>{t("appointment")}</h3>
        <p>
          {localizeText(
            "Bạn có thể tạo yêu cầu không hẹn trước, sau đó đưa mã lịch hẹn cho nhân viên tiếp nhận xác minh. Nhân viên sẽ gắn lịch hẹn với chính yêu cầu đó.",
            locale,
          )}
        </p>
      </div>
    );
  return (
    <div className="panel">
      <h3>{t("externalAccount")}</h3>
      {config.demo && (
        <Notice>
          {t("demo")}.{" "}
          {localizeText(
            "Dữ liệu kiểm thử: DEMO-001 / SIM-VERIFY-DEMO-001. Mỗi định danh chỉ liên kết một bệnh nhân.",
            locale,
          )}
        </Notice>
      )}
      <Form
        busy={mutation.busy}
        onSubmit={async () => {
          await mutation.run("/api/external/link", { reference, proof });
        }}
      >
        <Field label={t("externalReference")}>
          <input
            required
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
        <Field label={t("externalProof")}>
          <input
            required
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Button type="submit" busy={mutation.busy}>
          {t("linkExternal")}
        </Button>
      </Form>
      <Button
        variant="secondary"
        busy={mutation.busy}
        onClick={async () => {
          const result = await mutation.run<Booking[]>(
            "/api/appointments",
            undefined,
            "GET",
          );
          if (result) setBookings(result);
        }}
      >
        {t("loadAppointments")}
      </Button>
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
      {bookings?.length === 0 && <Empty text={t("noAppointments")} />}
      {bookings?.map((b) => (
        <div className="booking-card" key={b.reference}>
          <CalendarDays />
          <div>
            <strong>{b.reference}</strong>
            <p>{dateText(b.scheduledAt, locale)}</p>
            <Status value={b.status} />
          </div>
          <Button
            busy={mutation.busy}
            onClick={async () => {
              const r = await mutation.run<{ id: string }>(
                "/api/appointments/prepare",
                {
                  reference: b.reference,
                  attendeeVerified: false,
                  verificationNote: "",
                },
              );
              if (r) onPrepared(r.id);
            }}
          >
            {t("prepareBooking")}
          </Button>
        </div>
      ))}
    </div>
  );
}
