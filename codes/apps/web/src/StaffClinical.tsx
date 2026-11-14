import { useState } from "react";
import { displayName, type Step, type Visit } from "@hospital/shared";
import {
  Button,
  DestinationCard,
  Feedback,
  Field,
  Form,
  Notice,
  ResourceState,
  SectionTitle,
  Status,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";
import { DoctorContent } from "./StaffContent";
import { DoctorQueue } from "./DoctorQueue";
import { ServiceOrders } from "./ServiceOrders";
export default function StaffClinical({ id }: { id: string | null }) {
  const { config, session } = useRuntime();
  if (config.prdV2Enabled && session.role === "Service") return <ServiceOrders />;
  return config.prdV2Enabled && session.role === "Doctor" ? <DoctorQueue /> : <LegacyClinical id={id} />;
}
function LegacyClinical({ id }: { id: string | null }) {
  const { t, locale, session } = useRuntime();
  const r = useResource<Visit>(
    id ? `/api/visits/${id}?language=${locale}` : null,
    true,
  );
  const v = r.data;
  return (
    <>
      <SectionTitle eyebrow={t("staffWorkspace")} title={t(session.role)} />
      <ResourceState resource={r} empty={t("selectVisit")} />
      {v && (
        <>
          <div className="visit-meta">
            <strong>
              {v.patientName} · {v.ticketNumber}
            </strong>
            <span>
              {v.departmentName ?? v.departmentNameVi} · {v.doctorName}
            </span>
            <span>
              {t("visitStatus")}: <Status value={v.status} />
            </span>
            <span>
              {t("journeyStatus")}: <Status value={v.journeyStatus} />
            </span>
          </div>
          {session.role === "Doctor" && (
            <>
              <Orders
                key={`orders-${v.id}-${v.version}`}
                visit={v}
                onChange={r.refresh}
              />
              <Pharmacy
                key={`pharmacy-${v.id}-${v.version}`}
                visit={v}
                onChange={r.refresh}
              />
            </>
          )}
          {session.role === "Cashier" ? (
            <Settlement
              key={`${v.id}-${v.version}`}
              visit={v}
              onChange={r.refresh}
            />
          ) : (
            <div className="panel">
              <SectionTitle title={t("allSteps")} />
              {v.steps
                .filter((s) => s.authority === session.role)
                .map((s) => (
                  <StepActions
                    key={`${s.id}:${s.version}`}
                    step={s}
                    visitId={v.id}
                    onChange={r.refresh}
                  />
                ))}
            </div>
          )}
          {session.role === "Doctor" && (
            <DoctorContent key={v.id} visitId={v.id} />
          )}
        </>
      )}
    </>
  );
}
function StepActions({
  step,
  visitId,
  onChange,
}: {
  step: Step;
  visitId: string;
  onChange: () => void;
}) {
  const { t, locale, session } = useRuntime();
  const mutation = useMutation();
  const [reason, setReason] = useState("");
  const [queue, setQueue] = useState(step.queueNumber);
  const [queueStatus, setQueueStatus] = useState(step.queueStatus);
  const progress = async (status: string) => {
    if (
      await mutation.run(`/api/visits/${visitId}/steps/${step.id}/progress`, {
        status,
        reason,
        version: step.version,
      })
    )
      onChange();
  };
  return (
    <div className="step-work">
      <SectionTitle title={t(step.kind)}>
        <Status value={step.status} />
      </SectionTitle>
      <DestinationCard destination={step.destination} />
      {step.canProgress && (
        <>
          <div className="actions">
            {step.status === "Ready" && (
              <Button
                variant="secondary"
                busy={mutation.busy}
                onClick={() => void progress("InProgress")}
              >
                {t("startStep")}
              </Button>
            )}
            <Button
              busy={mutation.busy}
              onClick={() => void progress("Completed")}
            >
              {t("completeStep")}
            </Button>
          </div>
          {session.role === "Service" && (
            <details>
              <summary>{t("skipStep")}</summary>
              <Field label={t("reason")}>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  minLength={3}
                  maxLength={500}
                />
              </Field>
              <Button
                variant="danger"
                busy={mutation.busy}
                disabled={reason.length < 3}
                onClick={() => void progress("Skipped")}
              >
                {t("skipStep")}
              </Button>
            </details>
          )}
          <details className="sub-panel">
            <summary>{t("updateQueue")}</summary>
            <div className="form-grid">
              <Field label={t("queue")}>
                <input
                  value={queue}
                  maxLength={30}
                  onChange={(e) => setQueue(e.target.value)}
                />
              </Field>
              <Field label={t("queueStatus")}>
                <select
                  value={queueStatus}
                  onChange={(e) => setQueueStatus(e.target.value)}
                >
                  {["Waiting", "Called", "Serving"].map((s) => (
                    <option key={s} value={s}>
                      {t(s)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button
              variant="secondary"
              busy={mutation.busy}
              disabled={!queue}
              onClick={async () => {
                if (
                  await mutation.run(
                    `/api/visits/${visitId}/steps/${step.id}/queue`,
                    {
                      number: queue,
                      status: queueStatus,
                      version: step.version,
                    },
                  )
                )
                  onChange();
              }}
            >
              {t("updateQueue")}
            </Button>
          </details>
        </>
      )}
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
    </div>
  );
}
function Orders({ visit, onChange }: { visit: Visit; onChange: () => void }) {
  const { t, locale, config } = useRuntime();
  const [serviceId, setService] = useState(config.services[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [changeId, setChangeId] = useState("");
  const [reason, setReason] = useState("");
  const mutation = useMutation();
  return (
    <div className="panel">
      <SectionTitle title={t("orders")} />
      {visit.orders.map((o) => (
        <div className="order-row" key={o.id}>
          <div>
            <strong>
              {config.services.find((s) => s.id === o.hospitalServiceId)
                ? displayName(
                    config.services.find((s) => s.id === o.hospitalServiceId)!,
                    locale,
                  )
                : t("service")}
            </strong>
            <p>{o.note}</p>
          </div>
          <Status value={o.status} />
          {visit.status === "Active" && o.status === "Ordered" && (
            <Button
              variant="quiet"
              onClick={() => {
                setChangeId(o.id);
                setService(o.hospitalServiceId);
              }}
            >
              {t("edit")}
            </Button>
          )}
        </div>
      ))}
      {visit.status === "Active" && (
        <Form
          busy={mutation.busy}
          onSubmit={async () => {
            if (changeId) {
              const order = visit.orders.find((o) => o.id === changeId)!;
              if (
                await mutation.run(
                  `/api/visits/${visit.id}/orders/${changeId}`,
                  {
                    action: "Update",
                    serviceId,
                    reason,
                    version: order.version,
                  },
                  "PUT",
                )
              )
                onChange();
            } else if (
              await mutation.run(`/api/visits/${visit.id}/orders`, {
                serviceId,
                note,
                version: visit.version,
              })
            )
              onChange();
          }}
        >
          <div className="form-grid">
            <Field label={t("service")}>
              <select
                required
                value={serviceId}
                onChange={(e) => setService(e.target.value)}
              >
                {config.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {displayName(s, locale)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t(changeId ? "reason" : "note")}>
              <input
                required={!!changeId}
                minLength={changeId ? 3 : 0}
                maxLength={500}
                value={changeId ? reason : note}
                onChange={(e) =>
                  changeId ? setReason(e.target.value) : setNote(e.target.value)
                }
              />
            </Field>
          </div>
          <div className="actions">
            <Button type="submit" busy={mutation.busy}>
              {t(changeId ? "updateOrder" : "addOrder")}
            </Button>
            {changeId && (
              <>
                <Button
                  variant="danger"
                  disabled={reason.length < 3}
                  busy={mutation.busy}
                  onClick={async () => {
                    const order = visit.orders.find((o) => o.id === changeId)!;
                    if (
                      await mutation.run(
                        `/api/visits/${visit.id}/orders/${changeId}`,
                        {
                          action: "Cancel",
                          serviceId: null,
                          reason,
                          version: order.version,
                        },
                        "PUT",
                      )
                    )
                      onChange();
                  }}
                >
                  {t("cancelOrder")}
                </Button>
                <Button variant="quiet" onClick={() => setChangeId("")}>
                  {t("cancel")}
                </Button>
              </>
            )}
          </div>
        </Form>
      )}
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
    </div>
  );
}
function Pharmacy({ visit, onChange }: { visit: Visit; onChange: () => void }) {
  const { t, locale } = useRuntime();
  const mutation = useMutation();
  const [required, setRequired] = useState(
    visit.steps.some((s) => s.kind === "Pharmacy" && s.status !== "Cancelled"),
  );
  return visit.status === "Active" ? (
    <div className="panel">
      <label className="check-field">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        {t("pharmacyRequired")}
      </label>
      <Button
        variant="secondary"
        busy={mutation.busy}
        onClick={async () => {
          if (
            await mutation.run(`/api/visits/${visit.id}/pharmacy`, {
              required,
              version: visit.version,
            })
          )
            onChange();
        }}
      >
        {t("setPharmacy")}
      </Button>
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
    </div>
  ) : null;
}
function Settlement({
  visit,
  onChange,
}: {
  visit: Visit;
  onChange: () => void;
}) {
  const { t, locale } = useRuntime();
  const mutation = useMutation();
  const [outcome, setOutcome] = useState("Final");
  const [reviewed, setReviewed] = useState(false);
  return (
    <div className="panel">
      <SectionTitle title={t("settlement")} />
      <p>{t("settlementHint")}</p>
      <Notice kind={visit.clinicallyReady ? "success" : "info"}>
        {t(visit.clinicallyReady ? "clinicalReady" : "clinicalPending")}
      </Notice>
      <p>
        {t("workRevision")}: {visit.workRevision}
        {visit.finalSettlementRevision != null &&
          ` · ${t("settlement")}: ${visit.finalSettlementRevision}`}
      </p>
      {visit.status === "Active" && (
        <Form
          busy={mutation.busy}
          onSubmit={async () => {
            if (
              await mutation.run(`/api/visits/${visit.id}/settlement`, {
                outcome,
                workRevision: visit.workRevision,
                version: visit.version,
              })
            )
              onChange();
          }}
        >
          <Field label={t("outcome")}>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              {["Intermediate", "Final", "NoPaymentRequired"].map((s) => (
                <option key={s} value={s}>
                  {t(s)}
                </option>
              ))}
            </select>
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              required
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {t("review")}
          </label>
          <Button busy={mutation.busy} type="submit">
            {t("recordSettlement")}
          </Button>
        </Form>
      )}
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
    </div>
  );
}
