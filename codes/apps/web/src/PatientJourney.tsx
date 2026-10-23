import { useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  MessageCircle,
  QrCode,
  Volume2,
} from "lucide-react";
import { dateText, type Step, type Ticket, type Visit } from "@hospital/shared";
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
export function PatientJourney({
  id,
  onSelected,
  onResults,
  onLink,
}: {
  id: string | null;
  onSelected: (id: string) => void;
  onResults: () => void;
  onLink: () => void;
}) {
  const { t, locale, session } = useRuntime();
  const resource = useResource<Visit>(
    id ? `/api/visits/${id}?language=${locale}` : null,
    true,
  );
  const mutation = useMutation();
  const [modal, setModal] = useState<
    "scan" | "ticket" | "directions" | "help" | null
  >(null);
  const v = resource.data;
  const step = v?.steps.find((s) => s.id === v.currentStepId);
  const speech = useSpeech(
    `${id}:${v?.version}:${step?.id}:${step?.templateVersion}`,
  );
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
            <span>
              {t("ticket")}: <strong>{v.ticketNumber}</strong>
            </span>
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
              {session.isGuest && (
                <div className="account-invitation">
                  <h3>{t("optionalAccount")}</h3>
                  <p>{t("optionalAccountHint")}</p>
                  <Button variant="secondary" onClick={onLink}>
                    {t("linkAccount")}
                  </Button>
                  <Button variant="quiet" onClick={onResults}>
                    {t("skip")}
                  </Button>
                </div>
              )}
            </div>
          ) : step ? (
            <div className="journey-grid">
              <div>
                <div className="current-step">
                  <div className="current-header">
                    <span className="eyebrow">{t("currentStep")}</span>
                    <Status value={step.status} />
                  </div>
                  <h2>{t(step.kind)}</h2>
                  <div className="next-action">
                    <span>{t("nextAction")}</span>
                    <p>{step.text ?? t("help")}</p>
                    <small>
                      {step.status === "Ready" ? t("proceed") : t("wait")}
                    </small>
                  </div>
                  {step.fallback && (
                    <Notice>
                      {t("fallback")} · {step.contentLanguage}
                    </Notice>
                  )}
                  <DestinationCard destination={step.destination} />
                  <div className="journey-tools">
                    <Button
                      variant="secondary"
                      busy={speech.loading}
                      onClick={() =>
                        void speech.play(`/api/visits/${id}/narration`, {
                          kind: "Step",
                          section: "Instruction",
                          stepId: step.id,
                          sourceRevision: step.templateVersion,
                          language: locale,
                        })
                      }
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
                  {speech.error && <Notice kind="error">{speech.error}</Notice>}
                  {step.canCompleteGuidance && (
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
                <strong>{step.queueNumber || v.ticketNumber}</strong>
                <Status value={step.queueStatus} />
                <p>{t("wait")}</p>
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
          <DirectionsPanel step={step} onHelp={() => setModal("help")} />
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
  const { t, locale } = useRuntime();
  return (
    <div
      className={`timeline-step ${current ? "current" : ""} ${step.status === "Completed" ? "done" : ""}`}
    >
      <div className="step-number">
        {step.status === "Completed" ? <Check size={17} /> : number}
      </div>
      <div>
        <strong>{t(step.kind)}</strong>
        <p>
          {locale === "vi" ? step.destination.nameVi : step.destination.nameEn}{" "}
          · {t("room")} {step.destination.room}
        </p>
      </div>
      <Status value={step.status} />
    </div>
  );
}
export function TicketPanel({ id }: { id: string }) {
  const { t } = useRuntime();
  const r = useResource<Ticket>(`/api/visits/${id}/ticket`);
  return (
    <>
      <ResourceState resource={r} />
      {r.data && (
        <>
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
function DirectionsPanel({ step, onHelp }: { step: Step; onHelp: () => void }) {
  const { t } = useRuntime();
  return (
    <>
      <HospitalMap key={step.id} destination={step.destination} />
      <Button variant="secondary" onClick={onHelp}>
        {t("help")}
      </Button>
    </>
  );
}
