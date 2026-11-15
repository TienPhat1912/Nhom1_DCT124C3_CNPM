import { useEffect, useRef, useState } from "react";
import { HospitalMap } from "./HospitalMap";
import { View, Switch } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { VisitTicket } from "./VisitTicket";
import {
  dateText,
  displayName,
  qrToken,
  type Step,
  type Visit,
} from "@hospital/shared";
import {
  Badge,
  Btn,
  Card,
  DestinationBlock,
  Feedback,
  Input,
  LoadingState,
  Txt,
  styles,
} from "./ui";
import {
  useAction,
  useLoad,
  useNarration,
  useNative,
  useVisitEvents,
} from "./runtime";
export function Journey({
  id,
  onResults,
  onHelp,
  onDirections,
}: {
  id: string | null;
  onResults: () => void;
  onHelp: (step?: string) => void;
  onDirections: (step: Step) => void;
}) {
  const { t, locale, session } = useNative();
  const r = useLoad<Visit>(
    id ? `/api/visits/${id}?language=${locale}` : null,
    true,
    true,
  );
  const [showTicket, setShowTicket] = useState(false);
  const v = r.data;
  const step = v?.steps.find((s) => s.id === v.currentStepId);
  useVisitEvents(id, r.refresh);
  const [autoplay, setAutoplay] = useState(true);
  const clinical =
    !!v?.examStatus &&
    (step?.kind === "Consultation" || step?.kind === "ReturnConsultation");
  const queue = clinical ? undefined : step?.queueStatus;
  const called = clinical
    ? v?.examStatus === "InConsultation"
    : queue === "Called";
  const ticket = v?.examStatus
    ? v.ticketNumber
    : step?.queueNumber || v?.ticketNumber;
  const key = JSON.stringify([
    session.sessionId,
    id,
    locale,
    step?.id,
    step?.templateVersion,
    step?.contentKey,
    step?.text,
    step?.contentLanguage,
    step?.destination,
    ticket,
    queue,
    called,
    v?.examStatus,
    v?.journeyStatus,
  ]);
  const speech = useNarration(key);
  const eligible = !!(
    v &&
    step &&
    v.journeyStatus === "Active" &&
    step.templateVersion &&
    step.text &&
    !r.stale &&
    !r.error &&
    speech.foreground
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
  const latest = useRef({ key, play });
  latest.current = { key, play };
  const consumed = useRef<string | null>(null);
  useEffect(() => {
    if (!autoplay || !eligible || consumed.current === key) return;
    const timer = setTimeout(() => {
      if (latest.current.key !== key) return;
      if (latest.current.play()) consumed.current = key;
    }, 0);
    return () => clearTimeout(timer);
  }, [key, eligible, autoplay]);
  return (
    <>
      <Txt tone="title">{t("yourJourney")}</Txt>
      <LoadingState resource={r} />
      {!id && <Txt>{t("noVisits")}</Txt>}
      {v && (
        <>
          <Card>
            <Txt tone="heading">{v.ticketNumber}</Txt>
            {v.doctorName && (
              <Txt>
                {v.departmentName ?? v.departmentNameVi} · {t("doctor")}:{" "}
                {v.doctorName}
              </Txt>
            )}
            {v.examStatus && (
              <>
                <Txt tone="muted">{t("examStatus")}</Txt>
                <Badge value={v.examStatus} />
              </>
            )}
            <Txt tone="muted">{t("visitStatus")}</Txt>
            <Badge value={v.status} />
            <Txt tone="muted">{t("journeyStatus")}</Txt>
            <Badge value={v.journeyStatus} />
            <Btn secondary onPress={() => setShowTicket((v) => !v)}>
              {t("viewTicket")}
            </Btn>
            {showTicket && id && <VisitTicket key={id} id={id} />}
          </Card>
          {v.journeyStatus === "PendingActivation" ? (
            <Card>
              <Txt>{t("pendingActivation")}</Txt>
            </Card>
          ) : v.journeyStatus === "Completed" ? (
            <Card>
              <Txt tone="title">✓ {t("journeyDone")}</Txt>
              <Txt>{t("journeyDoneHint")}</Txt>
              <Btn onPress={onResults}>{t("results")}</Btn>
            </Card>
          ) : step ? (
            <Card>
              <Txt tone="eyebrow">{t("currentStep")}</Txt>
              <Txt tone="title">
                {t(step.kind === "Service" ? "services" : step.kind)}
              </Txt>
              <Badge value={step.status} />
              <Txt tone="heading">{t("nextAction")}</Txt>
              <Txt>{step.text ?? t("help")}</Txt>
              <Txt tone="muted">
                {t(
                  v.examStatus === "Waiting"
                    ? "waitingForConsultation"
                    : v.examStatus === "InConsultation"
                      ? "InConsultation"
                      : step.status === "Ready"
                        ? "proceed"
                        : "wait",
                )}
              </Txt>
              {step.fallback && (
                <Txt tone="muted">
                  {t("fallback")}: {step.contentLanguage}
                </Txt>
              )}
              <DestinationBlock destination={step.destination} />
              <View style={styles.row}>
                <Txt>
                  {t("queue")}:{" "}
                  {v.examStatus
                    ? v.ticketNumber
                    : step.queueNumber || v.ticketNumber}
                </Txt>
                <Badge value={step.queueStatus} />
              </View>
              <Txt tone="muted">
                {t("updated")}: {dateText(step.queueUpdatedAt, locale)}
              </Txt>
              <View style={styles.row}>
                <Txt>{t("autoNarration")}</Txt>
                <Switch
                  accessibilityLabel={t("autoNarration")}
                  value={autoplay}
                  onValueChange={(value) => {
                    setAutoplay(value);
                    if (!value) void speech.stop();
                  }}
                />
              </View>
              <Btn
                secondary
                busy={speech.loading}
                disabled={!eligible}
                onPress={() => void play()}
              >
                {t("listen")}
              </Btn>
              <Btn
                secondary
                onPress={() => void speech.stop()}
                disabled={!speech.playing && !speech.loading}
              >
                {t("stop")}
              </Btn>
              <Btn secondary onPress={() => onDirections(step)}>
                {t("navigate")}
              </Btn>
              <Btn secondary onPress={() => onHelp(step.id)}>
                {t("help")}
              </Btn>
              {!!speech.text && <Txt>{speech.text}</Txt>}
              {speech.error && (
                <Txt style={{ color: "#a44638" }}>
                  {speech.error} {t("manualNarrationHint")}
                </Txt>
              )}
            </Card>
          ) : (
            <Txt>{t("noCurrent")}</Txt>
          )}
          <Card>
            <Txt tone="heading">{t("allSteps")}</Txt>
            {v.steps.map((s, index) => (
              <View
                key={s.id}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#e1e8e2",
                }}
              >
                <Txt>
                  {index + 1}. {t(s.kind === "Service" ? "services" : s.kind)}
                </Txt>
                <Txt tone="muted">
                  {displayName(s.destination, locale)} · {t("room")}{" "}
                  {s.destination.room}
                </Txt>
                <Badge value={s.status} />
              </View>
            ))}
          </Card>
          <Txt tone="muted">
            {t("updated")}: {dateText(v.updatedAt, locale)}
          </Txt>
        </>
      )}
    </>
  );
}
export function ScanTicket({
  onVisit,
  initialCode,
}: {
  onVisit: (id: string) => void;
  initialCode?: string | null;
}) {
  const { t, locale, api } = useNative();
  const [permission, requestPermission] = useCameraPermissions();
  const [camera, setCamera] = useState(false);
  const [code, setCode] = useState(initialCode ?? "");
  const action = useAction(api);
  const [invalid, setInvalid] = useState(false);
  return (
    <Card>
      <Txt tone="title">{t("scan")}</Txt>
      {camera && permission?.granted && (
        <CameraView
          style={{ height: 300, width: "100%" }}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={(r) => {
            setCode(r.data);
            setCamera(false);
          }}
        />
      )}
      <Btn
        secondary
        onPress={async () => {
          if (camera) {
            setCamera(false);
            return;
          }
          const p = permission?.granted
            ? permission
            : await requestPermission();
          if (p.granted) setCamera(true);
        }}
      >
        {t(camera ? "stopCamera" : "useCamera")}
      </Btn>
      {permission && !permission.granted && (
        <Txt tone="muted">{t("cameraError")}</Txt>
      )}
      <Input
        label={t("pasteCode")}
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      {invalid && <Txt style={{ color: "#a44638" }}>{t("qrPurpose")}</Txt>}
      <Btn
        busy={action.busy}
        onPress={async () => {
          const token = qrToken(code, "ticket");
          if (!token) {
            setInvalid(true);
            return;
          }
          const r = await action.run<{ visitId: string }>(
            "/api/tickets/redeem",
            { code: token },
          );
          if (r) onVisit(r.visitId);
        }}
      >
        {t("continueVisit")}
      </Btn>
      <Feedback error={action.error} locale={locale} />
    </Card>
  );
}
export function DirectionsScreen({
  visitId,
  onHelp,
}: {
  visitId: string;
  onHelp: (stepId?: string) => void;
}) {
  const { t, locale } = useNative();
  const visit = useLoad<Visit>(
    `/api/visits/${visitId}?language=${locale}`,
    true,
    true,
  );
  const current = visit.data?.steps.find(
    (s) => s.id === visit.data?.currentStepId,
  );
  return (
    <>
      <Txt tone="title">{t("navigate")}</Txt>
      <Card>
        <LoadingState resource={visit} />
        {current ? (
          <HospitalMap key={visitId} destination={current.destination} contextKey={current.id} />
        ) : (
          visit.data && <Txt>{t("noCurrent")}</Txt>
        )}
        <Btn secondary onPress={() => onHelp(current?.id)}>
          {t("help")}
        </Btn>
      </Card>
    </>
  );
}
