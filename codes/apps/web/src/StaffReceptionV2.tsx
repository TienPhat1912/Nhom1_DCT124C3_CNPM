import { useState } from "react";
import {
  dateText,
  type RegistrationRequestV2,
  type DescriptionTranslationV2,
  type ConfirmReceptionResultV2,
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
  Status,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";
import { TicketPanel } from "./PatientJourney";

type Clinic = {
  clinicLocationId: string;
  version: number;
  nameVi: string;
  room: string;
  activeDoctor: { id: string; name: string };
};

export function StaffReceptionV2() {
  const { t, locale } = useRuntime();
  const [offset, setOffset] = useState(0);
  const list = useResource<RegistrationRequestV2[]>(
    `/api/v2/requests?offset=${offset}`,
    true,
  );
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <SectionTitle title={t("Reception")} />
      <div className="split-layout">
        <aside className="panel">
          <h3>{t("requestList")}</h3>
          <ResourceState resource={list} />
          {list.data?.length === 0 && <Empty text={t("noRequests")} />}
          {list.data?.map((r) => (
            <button
              className={`record-row ${r.id === selected ? "selected" : ""}`}
              key={r.id}
              onClick={() => setSelected(r.id)}
            >
              <span>
                <strong>{r.patientName}</strong>
                <small>{dateText(r.createdAt, locale)}</small>
              </span>
              <Status value={r.status} />
            </button>
          ))}
          <div className="actions">
            <Button
              variant="quiet"
              disabled={offset === 0}
              onClick={() => {
                setSelected(null);
                setOffset(offset - 100);
              }}
            >
              {t("previousPage")}
            </Button>
            <Button
              variant="quiet"
              disabled={list.data?.length !== 100}
              onClick={() => {
                setSelected(null);
                setOffset(offset + 100);
              }}
            >
              {t("nextPage")}
            </Button>
          </div>
        </aside>
        {selected ? (
          <Review key={selected} id={selected} onChange={list.refresh} />
        ) : (
          <div className="panel">
            <Empty text={t("noSelection")} />
          </div>
        )}
      </div>
    </>
  );
}

function Review({ id, onChange }: { id: string; onChange: () => void }) {
  const { t, locale } = useRuntime();
  const detail = useResource<RegistrationRequestV2>(
    `/api/v2/requests/${id}`,
    true,
  );
  const clinics = useResource<Clinic[]>("/api/v2/reception/clinics");
  // Store the selection INCLUDING its version. A refresh must not silently approve another doctor.
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [verified, setVerified] = useState(false);
  const [note, setNote] = useState("");
  const [confirmedVisit, setConfirmedVisit] = useState<string | null>(null);
  const mutation = useMutation();
  const request = detail.data;
  const visitId = confirmedVisit ?? request?.visitId;
  return (
    <div className="panel">
      <ResourceState resource={detail} />
      {request && (
        <>
          <SectionTitle title={request.patientName}>
            <Status value={request.status} />
          </SectionTitle>
          <dl className="detail-grid">
            <dt>{t("contact")}</dt>
            <dd>{request.contact}</dd>
            <dt>{t("descriptionLanguage")}</dt>
            <dd>{request.sourceLanguage}</dd>
            <dt>{t("description")}</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>
              {request.description || "—"}
            </dd>
          </dl>
          <RequestTranslation
            id={id}
            version={request.version}
            original={request.description}
          />
          {visitId ? (
            <TicketPanel id={visitId} />
          ) : (
            request.canConfirm && (
              <Form
                busy={mutation.busy}
                onSubmit={async () => {
                  if (!clinic) return;
                  const result = await mutation.run<ConfirmReceptionResultV2>(
                    `/api/v2/requests/${id}/confirm`,
                    {
                      version: request.version,
                      clinicLocationId: clinic.clinicLocationId,
                      clinicAssignmentVersion: clinic.version,
                      attendeeVerified: verified,
                      verificationNote: note,
                    },
                  );
                  if (result) {
                    setConfirmedVisit(result.visit.id);
                    detail.refresh();
                    onChange();
                  } else {
                    detail.refresh();
                    clinics.refresh();
                    setClinic(null);
                    setVerified(false);
                  }
                }}
              >
                <ResourceState resource={clinics} />
                {!clinics.loading && clinics.data?.length === 0 && (
                  <Notice>{t("doctorUnavailable")}</Notice>
                )}
                <Field label={t("location")}>
                  <select
                    required
                    value={clinic?.clinicLocationId ?? ""}
                    onChange={(e) => {
                      setClinic(
                        clinics.data?.find(
                          (c) => c.clinicLocationId === e.target.value,
                        ) ?? null,
                      );
                      setVerified(false);
                    }}
                  >
                    <option value="">—</option>
                    {clinics.data?.map((c) => (
                      <option
                        key={c.clinicLocationId}
                        value={c.clinicLocationId}
                      >
                        {c.nameVi} · {c.room} · {c.activeDoctor.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {clinic && (
                  <p>
                    {t("doctor")}: <strong>{clinic.activeDoctor.name}</strong>
                  </p>
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
                    required
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                  />
                  {t("attendeeVerified")}
                </label>
                <Button
                  type="submit"
                  busy={mutation.busy}
                  disabled={!clinic || !verified}
                >
                  {t("confirmReception")}
                </Button>
              </Form>
            )
          )}
        </>
      )}
      <Feedback error={mutation.error} locale={locale} />
    </div>
  );
}

function RequestTranslation({
  id,
  version,
  original,
}: {
  id: string;
  version: number;
  original: string;
}) {
  const { t } = useRuntime();
  const translation = useResource<DescriptionTranslationV2>(
    `/api/v2/requests/${id}/translation?version=${version}`,
  );
  const result = translation.data;
  // A stale response must never be paired with a newer original.
  const current =
    result?.sourceVersion === version && result.original === original;
  const unavailable =
    !!translation.error || (current && result.status === "Unavailable");
  return (
    <section aria-label={t("requestTranslation")}>
      <h3>{t("requestTranslation")}</h3>
      {translation.loading && <p role="status">{t("loading")}</p>}
      {current && result.status === "Translated" && (
        <p style={{ whiteSpace: "pre-wrap" }}>{result.translated}</p>
      )}
      {current && result.status === "NotRequired" && (
        <p>{t("translationNotRequired")}</p>
      )}
      {unavailable && <Notice>{t("requestTranslationUnavailable")}</Notice>}
      {(unavailable || (!translation.loading && !current)) && (
        <Button onClick={translation.refresh}>{t("retry")}</Button>
      )}
    </section>
  );
}
