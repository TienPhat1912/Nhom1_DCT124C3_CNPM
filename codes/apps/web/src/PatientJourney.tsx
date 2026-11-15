import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  MessageCircle,
  QrCode,
  Volume2,
} from "lucide-react";
import {
  dateText,
  type Step,
  type Ticket,
  type Visit,
  type ExaminationTicketV2,
} from "@hospital/shared";
import {
  Button,
  DestinationCard,
  Empty,
  Feedback,
  Modal,
  Notice,
  QrPanel,
  ResourceState,
  Scanner,
  SectionTitle,
  Status,
  useSpeech,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";
import { HelpPanel } from "./PatientRecords";
import { HospitalMap } from "./HospitalMap";
import { useVisitEvents } from "./useVisitEvents";
export function PatientJourney({
  id,
  onSelected,
  onResults,
}: {
  id: string | null;
  onSelected: (id: string) => void;
  onResults: () => void;
}) {
  const { t, locale, session } = useRuntime();
  const resource = useResource<Visit>(
    id ? `/api/visits/${id}?language=${locale}` : null,
    true,
    true,
    `journey:${session.sessionId}`,
  );
  const mutation = useMutation();
  const [modal, setModal] = useState<
    "scan" | "ticket" | "directions" | "help" | null
  >(null);
  const v = resource.data;
  const step = v?.steps.find((s) => s.id === v.currentStepId);
  useVisitEvents(id, resource.refresh);
  const [autoplay, setAutoplay] = useState(true);
  const ticket = v?.examStatus
    ? v.ticketNumber
    : step?.queueNumber || v?.ticketNumber;
  const clinicalConsultation =
    !!v?.examStatus &&
    (step?.kind === "Consultation" || step?.kind === "ReturnConsultation");
  const queueStatus = clinicalConsultation ? undefined : step?.queueStatus;
  const called = clinicalConsultation
    ? v?.examStatus === "InConsultation"
    : queueStatus === "Called";
  // Operational meaning and content identity, never the aggregate Visit.Version.
  const narrationKey = JSON.stringify([
    session.sessionId,
    id,
    step?.id,
    locale,
    step?.templateVersion,
    step?.contentKey,
    step?.contentLanguage,
    step?.text,
    step?.destination,
    ticket,
    called,
    queueStatus,
    v?.examStatus,
    v?.journeyStatus,
  ]);
  const speech = useSpeech(narrationKey);
  const eligible = !!(
    v &&
    step &&
    !resource.stale &&
    !resource.error &&
    v.journeyStatus === "Active" &&
    step.templateVersion &&
    step.text
  );
  const play = () => {
    if (!eligible || !step || !ticket) return;
    return speech.play(
      `/api/visits/${id}/narration`,
      {
        kind: "Step",
        section: "Instruction",
        stepId: step.id,
        sourceRevision: step.templateVersion,
        contentKey: step.contentKey,
        language: locale,
      },
      { ticket, room: step.destination.room, called },
    );
  };
  const latestPlay = useRef({ key: narrationKey, play });
  latestPlay.current = { key: narrationKey, play };
  const consumed = useRef<string | null>(null);
  useEffect(() => {
    if (
      !autoplay ||
      !eligible ||
      document.hidden ||
      consumed.current === narrationKey
    )
      return;
    // Defer dispatch so React's development effect replay cannot consume a call
    // whose request was immediately canceled by its simulated unmount.
    const timer = setTimeout(() => {
      if (latestPlay.current.key !== narrationKey) return;
      const started = latestPlay.current.play();
      if (started) consumed.current = narrationKey;
    }, 0);
    return () => clearTimeout(timer);
  }, [autoplay, eligible, narrationKey]);
  const activate = async () => {
    if (!id) return;
    const ticket = await mutation.run<Ticket>(
      `/api/visits/${id}/ticket`,
      undefined,
      "GET",
    );
    if (
      ticket &&
      (await mutation.run("/api/tickets/redeem", { code: ticket.code }))
    )
      resource.refresh();
  };
  return (
    <>
      <SectionTitle eyebrow="02 / JOURNEY" title={t("yourJourney")}>
        <Button variant="secondary" onClick={() => setModal("scan")}>
          <QrCode size={18} />
          {t("scan")}
        </Button>
      </SectionTitle>
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
      <ResourceState resource={resource} empty={t("noVisits")} />
      {v && (
        <>
          <div className="visit-meta">
            {v.doctorName && (
              <span>
                {v.departmentName ?? v.departmentNameVi} · {t("doctor")}:{" "}
                <strong>{v.doctorName}</strong>
              </span>
            )}
            <span>
              {t("ticket")}: <strong>{v.ticketNumber}</strong>
            </span>
            {v.examStatus && (
              <span data-testid="exam-status">
                {t("examStatus")}: <Status value={v.examStatus} />
              </span>
            )}
            <span>
              {t("visitStatus")}: <Status value={v.status} />
            </span>
            <span>
              {t("journeyStatus")}: <Status value={v.journeyStatus} />
            </span>
            <Button variant="quiet" onClick={() => setModal("ticket")}>
              {t("viewTicket")}
            </Button>
          </div>
          {v.journeyStatus === "PendingActivation" ? (
            <div className="panel">
              <Empty text={t("pendingActivation")}>
                <Button busy={mutation.busy} onClick={() => void activate()}>
                  {t("activate")}
                  <ArrowRight size={18} />
                </Button>
              </Empty>
            </div>
          ) : v.journeyStatus === "Completed" ? (
            <div className="completion-card">
              <div className="completion-check">
                <Check size={35} />
              </div>
              <h2>{t("journeyDone")}</h2>
              <p>{t("journeyDoneHint")}</p>
              <Button onClick={onResults}>
                {t("results")}
                <ArrowRight size={17} />
              </Button>
            </div>
          ) : step ? (
            <div className="journey-grid">
              <div>
                <div className="current-step">
                  <div className="current-header">
                    <span className="eyebrow">{t("currentStep")}</span>
                    <Status value={step.status} />
                  </div>
                  <h2>{t(step.kind === "Service" ? "services" : step.kind)}</h2>
                  <div className="next-action">
                    <span>{t("nextAction")}</span>
                    <p>{step.text ?? t("help")}</p>
                    <small>
                      {v.examStatus === "Waiting"
                        ? t("waitingForConsultation")
                        : v.examStatus === "InConsultation"
                          ? t("InConsultation")
                          : step.status === "Ready"
                            ? t("proceed")
                            : t("wait")}
                    </small>
                  </div>
                  {step.fallback && (
                    <Notice>
                      {t("fallback")} · {step.contentLanguage}
                    </Notice>
                  )}
                  <DestinationCard destination={step.destination} />
                  <label className="narration-preference">
                    <input
                      type="checkbox"
                      checked={autoplay}
                      onChange={(event) => {
                        setAutoplay(event.target.checked);
                        if (!event.target.checked) speech.stop();
                      }}
                    />{" "}
                    {t("autoNarration")}
                  </label>
                  <div className="journey-tools">
                    <Button
                      variant="secondary"
                      busy={speech.loading}
                      disabled={!eligible}
                      onClick={() => void play()}
                    >
                      <Volume2 size={20} />
                      {t("listen")}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setModal("directions")}
                    >
                      <MapPin size={20} />
                      {t("navigate")}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setModal("help")}
                    >
                      <MessageCircle size={20} />
                      {t("help")}
                    </Button>
                  </div>
                  {speech.playing && (
                    <Button variant="quiet" onClick={speech.stop}>
                      {t("stop")}
                    </Button>
                  )}
                  {speech.text && (
                    <p data-testid="narration-text" aria-live="polite">
                      {speech.text}
                    </p>
                  )}
                  {speech.error && (
                    <Notice kind="error">
                      {speech.error} {t("manualNarrationHint")}
                    </Notice>
                  )}
                  {!v.examStatus && step.canCompleteGuidance && (
                    <div className="final-guidance">
                      <p>{t("guidanceOnly")}</p>
                      <Button
                        busy={mutation.busy}
                        onClick={async () => {
                          if (
                            await mutation.run(
                              `/api/visits/${id}/complete-guidance`,
                              { version: v.journeyVersion },
                            )
                          )
                            resource.refresh();
                        }}
                      >
                        {t("completeJourney")}
                      </Button>
                    </div>
                  )}
                </div>
                <p className="updated">
                  <Clock3 size={14} />
                  {t("updated")}: {dateText(v.updatedAt, locale)}
                </p>
              </div>
              <aside className="queue-card">
                <span className="eyebrow">{t("queue")}</span>
                <strong>
                  {v.examStatus
                    ? v.ticketNumber
                    : step.queueNumber || v.ticketNumber}
                </strong>
                <Status value={step.queueStatus} />
                <p>
                  {t(
                    v.examStatus === "Waiting"
                      ? "waitingForConsultation"
                      : (v.examStatus ?? "wait"),
                  )}
                </p>
                <small>{dateText(step.queueUpdatedAt, locale)}</small>
              </aside>
            </div>
          ) : (
            <Empty text={t("noCurrent")} />
          )}
          <div className="panel">
            <SectionTitle title={t("allSteps")} />
            <div className="timeline">
              {v.steps.map((s, i) => (
                <TimelineStep
                  key={s.id}
                  step={s}
                  number={i + 1}
                  current={s.id === v.currentStepId}
                />
              ))}
            </div>
          </div>
        </>
      )}
      {modal === "scan" && (
        <Modal title={t("scan")} onClose={() => setModal(null)}>
          <Scanner
            purpose="ticket"
            onCode={async (code) => {
              const result = await mutation.run<{ visitId: string }>(
                "/api/tickets/redeem",
                { code },
              );
              if (result) {
                onSelected(result.visitId);
                setModal(null);
                resource.refresh();
              }
            }}
          />
          <Feedback error={mutation.error} locale={locale} />
        </Modal>
      )}
      {modal === "ticket" && id && (
        <Modal title={t("ticket")} onClose={() => setModal(null)}>
          <TicketPanel id={id} />
        </Modal>
      )}
      {modal === "directions" && id && step && (
        <Modal title={t("navigate")} onClose={() => setModal(null)}>
          <DirectionsPanel
            key={id}
            autoplay={autoplay}
            step={step}
            onHelp={() => setModal("help")}
          />
        </Modal>
      )}
      {modal === "help" && (
        <Modal title={t("help")} onClose={() => setModal(null)}>
          <HelpPanel visitId={id} stepId={step?.id} />
        </Modal>
      )}
    </>
  );
}
function TimelineStep({
  step,
  number,
  current,
}: {
  step: Step;
  number: number;
  current: boolean;
}) {
  const { t } = useRuntime();
  return (
    <div
      className={`timeline-step ${current ? "current" : ""} ${step.status === "Completed" ? "done" : ""}`}
    >
      <div className="step-number">
        {step.status === "Completed" ? <Check size={17} /> : number}
      </div>
      <div>
        <strong>{t(step.kind === "Service" ? "services" : step.kind)}</strong>
        <p>
          {step.destination.name ?? step.destination.nameVi} · {t("room")}{" "}
          {step.destination.room}
        </p>
      </div>
      <Status value={step.status} />
    </div>
  );
}
export function TicketPanel({ id }: { id: string }) {
  const { t } = useRuntime();
  const r = useResource<Ticket | ExaminationTicketV2>(
    `/api/visits/${id}/ticket`,
  );
  if (r.data && "patientSnapshot" in r.data) {
    const ticket = r.data;
    return (
      <article className="ticket-snapshot" data-testid="ticket-v2">
        <SectionTitle title={`${t("ticket")}: ${ticket.number}`} />
        <p>
          {ticket.patientSnapshot.name} · {ticket.patientSnapshot.contact}
        </p>
        <p>
          {ticket.clinicSnapshot.nameVi} · {ticket.clinicSnapshot.room}
        </p>
        <p>
          {ticket.clinicSnapshot.building} · {ticket.clinicSnapshot.floor}
        </p>
        <p>
          {t("doctor")}: <strong>{ticket.doctorSnapshot.name}</strong>
        </p>
        <p>
          <time dateTime={ticket.issuedOn}>{ticket.issuedOn}</time> ·{" "}
          {ticket.number}
        </p>
        <Button variant="secondary" onClick={() => window.print()}>
          {t("print")}
        </Button>
      </article>
    );
  }
  return (
    <>
      <ResourceState resource={r} />
      {r.data && "code" in r.data && (
        <>
          {r.data.doctorName && (
            <p>
              {r.data.departmentName ?? r.data.departmentNameVi} · {t("doctor")}
              : <strong>{r.data.doctorName}</strong>
            </p>
          )}
          <QrPanel
            purpose="ticket"
            code={r.data.code}
            expires={r.data.expiresAt}
            number={r.data.number}
          />
          <Button variant="secondary" onClick={() => window.print()}>
            {t("print")}
          </Button>
        </>
      )}
    </>
  );
}
function DirectionsPanel({
  step,
  onHelp,
  autoplay,
}: {
  step: Step;
  onHelp: () => void;
  autoplay: boolean;
}) {
  const { t } = useRuntime();
  return (
    <>
      <HospitalMap
        autoplay={autoplay}
        destination={step.destination}
        contextKey={step.id}
      />
      <Button variant="secondary" onClick={onHelp}>
        {t("help")}
      </Button>
    </>
  );
}
