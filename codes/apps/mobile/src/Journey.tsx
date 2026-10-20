import { useState } from "react";
import { View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import {
  dateText,
  displayName,
  qrToken,
  type Directions,
  type Step,
  type Ticket,
  type Visit,
} from "@hospital/shared";
import {
  Badge,
  Btn,
  Card,
  Choice,
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
  WEB_URL,
} from "./runtime";
export function Journey({
  id,
  onScan,
  onResults,
  onHelp,
  onDirections,
  onLink,
}: {
  id: string | null;
  onScan: () => void;
  onResults: () => void;
  onHelp: (step?: string) => void;
  onDirections: (step: Step) => void;
  onLink: () => void;
}) {
  const { t, locale, session, api } = useNative();
  const r = useLoad<Visit>(
    id ? `/api/visits/${id}?language=${locale}` : null,
    true,
  );
  const action = useAction(api);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const v = r.data;
  const step = v?.steps.find((s) => s.id === v.currentStepId);
  const speech = useNarration(
    `${id}:${v?.version}:${step?.id}:${step?.templateVersion}`,
  );
  const loadTicket = async () => {
    const result = await action.run<Ticket>(
      `/api/visits/${id}/ticket`,
      undefined,
      "GET",
    );
    if (result) setTicket(result);
    return result;
  };
  return (
    <>
      <Txt tone="title">{t("yourJourney")}</Txt>
      <Btn secondary onPress={onScan}>
        {t("scan")}
      </Btn>
      <LoadingState resource={r} />
      {!id && <Txt>{t("noVisits")}</Txt>}
      {v && (
        <>
          <Card>
            <Txt tone="heading">{v.ticketNumber}</Txt>
            <Txt tone="muted">{t("visitStatus")}</Txt>
            <Badge value={v.status} />
            <Txt tone="muted">{t("journeyStatus")}</Txt>
            <Badge value={v.journeyStatus} />
            <Btn secondary busy={action.busy} onPress={() => void loadTicket()}>
              {t("viewTicket")}
            </Btn>
            {ticket && (
              <>
                <View style={{ alignItems: "center", padding: 15 }}>
                  <QRCode
                    value={`${WEB_URL}/#ticket=${ticket.code}`}
                    size={180}
                  />
                </View>
                <Txt tone="muted">
                  {t("ticketHint")} · {dateText(ticket.expiresAt, locale)}
                </Txt>
              </>
            )}
          </Card>
          {v.journeyStatus === "PendingActivation" ? (
            <Card>
              <Txt>{t("pendingActivation")}</Txt>
              <Btn
                busy={action.busy}
                onPress={async () => {
                  const ticket = await loadTicket();
                  if (
                    ticket &&
                    (await action.run("/api/tickets/redeem", {
                      code: ticket.code,
                    }))
                  )
                    r.refresh();
                }}
              >
                {t("activate")}
              </Btn>
            </Card>
          ) : v.journeyStatus === "Completed" ? (
            <Card>
              <Txt tone="title">✓ {t("journeyDone")}</Txt>
              <Txt>{t("journeyDoneHint")}</Txt>
              <Btn onPress={onResults}>{t("results")}</Btn>
              {session.isGuest && (
                <>
                  <Txt>{t("optionalAccountHint")}</Txt>
                  <Btn secondary onPress={onLink}>
                    {t("linkAccount")}
                  </Btn>
                  <Btn secondary onPress={onResults}>
                    {t("skip")}
                  </Btn>
                </>
              )}
            </Card>
          ) : step ? (
            <Card>
              <Txt tone="eyebrow">{t("currentStep")}</Txt>
              <Txt tone="title">{t(step.kind)}</Txt>
              <Badge value={step.status} />
              <Txt tone="heading">{t("nextAction")}</Txt>
              <Txt>{step.text ?? t("help")}</Txt>
              <Txt tone="muted">
                {t(step.status === "Ready" ? "proceed" : "wait")}
              </Txt>
              {step.fallback && (
                <Txt tone="muted">
                  {t("fallback")}: {step.contentLanguage}
                </Txt>
              )}
              <DestinationBlock destination={step.destination} />
              <View style={styles.row}>
                <Txt>
                  {t("queue")}: {step.queueNumber || v.ticketNumber}
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
                    language: locale,
                  })
                }
              >
                {t("listen")}
              </Btn>
              <Btn
                secondary
                onPress={() => void speech.stop()}
                disabled={!speech.playing}
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
              {step.canCompleteGuidance && (
                <>
                  <Txt tone="muted">{t("guidanceOnly")}</Txt>
                  <Btn
                    busy={action.busy}
                    onPress={async () => {
                      if (
                        await action.run(
                          `/api/visits/${id}/complete-guidance`,
                          { version: v.journeyVersion },
                        )
                      )
                        r.refresh();
                    }}
                  >
                    {t("completeJourney")}
                  </Btn>
                </>
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
                  {index + 1}. {t(s.kind)}
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
      <Feedback error={action.error} ok={action.ok} locale={locale} />
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
        {t("activate")}
      </Btn>
      <Feedback error={action.error} locale={locale} />
    </Card>
  );
}
export function DirectionsScreen({
  visitId,
  step,
  onHelp,
}: {
  visitId: string;
  step: Step;
  onHelp: () => void;
}) {
  const { t, locale, config } = useNative();
  const [from, setFrom] = useState("");
  const r = useLoad<Directions>(
    `/api/visits/${visitId}/navigation?stepId=${step.id}&language=${locale}${from ? `&from=${from}` : ""}`,
  );
  return (
    <>
      <Txt tone="title">{t("navigate")}</Txt>
      <Card>
        <Txt tone="heading">{t("startLocation")}</Txt>
        {config.locations.map((l) => (
          <Choice
            key={l.id}
            label={displayName(l, locale)}
            selected={from === l.id}
            onPress={() => setFrom(l.id)}
          />
        ))}
      </Card>
      <Card>
        <LoadingState resource={r} />
        {r.data && (
          <>
            <DestinationBlock destination={r.data.destination} />
            <Txt>{r.data.instructions ?? t("noRoute")}</Txt>
            {r.data.fallback && r.data.language && (
              <Txt tone="muted">
                {t("fallback")}: {r.data.language}
              </Txt>
            )}
          </>
        )}
        <Btn secondary onPress={onHelp}>
          {t("help")}
        </Btn>
      </Card>
    </>
  );
}
