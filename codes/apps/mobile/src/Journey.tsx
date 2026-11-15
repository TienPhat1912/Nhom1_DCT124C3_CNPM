import { useState } from "react";
import { HospitalMap } from "./HospitalMap";
import { View } from "react-native";
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
import { useAction, useLoad, useNarration, useNative } from "./runtime";
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
  const { t, locale } = useNative();
  const r = useLoad<Visit>(
    id ? `/api/visits/${id}?language=${locale}` : null,
    true,
    true,
  );
  const [showTicket, setShowTicket] = useState(false);
  const v = r.data;
  const step = v?.steps.find((s) => s.id === v.currentStepId);
  const speech = useNarration(
    `${id}:${v?.version}:${step?.id}:${step?.templateVersion}`,
  );
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
              <Btn
                secondary
                busy={speech.loading}
                onPress={() =>
                  void speech.play(`/api/visits/${id}/narration`, {
                    kind: "Step",
                    section: "Instruction",
                    stepId: step.id,
                    sourceRevision: step.templateVersion,
                    contentKey: step.contentKey,
                    language: locale,
                  })
                }
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
              {speech.error && (
                <Txt style={{ color: "#a44638" }}>{speech.error}</Txt>
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
          <HospitalMap key={current.id} destination={current.destination} />
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
