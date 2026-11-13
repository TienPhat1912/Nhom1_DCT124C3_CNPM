import { localizeText } from "@hospital/shared";
import { useState } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { ReceptionV2 } from "./ReceptionV2";
import {
  dateText,
  type Booking,
  type Profile,
  type ReceptionRequest,
  type RequestSummary,
} from "@hospital/shared";
import {
  Btn,
  Card,
  Choice,
  Feedback,
  Input,
  LoadingState,
  Txt,
  Badge,
  styles,
} from "./ui";
import {
  useAction,
  useLoad,
  useNarration,
  useNative,
  WEB_URL,
} from "./runtime";
export function Reception({
  onVisit,
  onProfile,
}: {
  onVisit: (id: string) => void;
  onProfile?: () => void;
}) {
  const { config } = useNative();
  return config.prdV2Enabled ? (
    <ReceptionV2 onVisit={onVisit} onProfile={onProfile} />
  ) : (
    <LegacyReception onVisit={onVisit} />
  );
}
function LegacyReception({ onVisit }: { onVisit: (id: string) => void }) {
  const { t, locale } = useNative();
  const [offset, setOffset] = useState(0);
  const list = useLoad<RequestSummary[]>(
    `/api/requests?offset=${offset}`,
    true,
  );
  const profile = useLoad<Profile>("/api/auth/profile");
  const [id, setId] = useState<string | null>(null);
  const [mode, setMode] = useState("list");
  return (
    <>
      <Txt tone="title">{t("prepare")}</Txt>
      <Txt tone="muted">{t("prepareIntro")}</Txt>
      <Btn
        onPress={() => {
          setMode("new");
          setId(null);
        }}
      >
        {t("walkIn")}
      </Btn>
      <Btn
        secondary
        onPress={() => {
          setMode("appointments");
          setId(null);
        }}
      >
        {t("appointment")}
      </Btn>
      <LoadingState resource={list} />
      {list.data?.map((r) => (
        <Choice
          key={r.id}
          selected={id === r.id}
          label={`${r.name} · ${t(r.status)} · ${dateText(r.createdAt, locale)}`}
          onPress={() => {
            setId(r.id);
            setMode("list");
          }}
        />
      ))}
      {list.data?.length === 0 && <Txt tone="muted">{t("noRequests")}</Txt>}
      <Btn
        secondary
        disabled={offset === 0 || list.loading}
        onPress={() => {
          setId(null);
          setMode("list");
          setOffset(Math.max(0, offset - 100));
        }}
      >
        {t("previousPage")}
      </Btn>
      <Btn
        secondary
        disabled={list.data?.length !== 100 || list.loading}
        onPress={() => {
          setId(null);
          setMode("list");
          setOffset(offset + 100);
        }}
      >
        {t("nextPage")}
      </Btn>
      {mode === "new" && profile.data && (
        <Card>
          <WalkInForm
            profile={profile.data}
            onSaved={(rid) => {
              setOffset(0);
              setId(rid);
              setMode("list");
              list.refresh();
            }}
          />
        </Card>
      )}
      {mode === "appointments" && (
        <Appointments
          onPrepared={(rid) => {
            setOffset(0);
            setId(rid);
            setMode("list");
            list.refresh();
          }}
        />
      )}
      {id && (
        <RequestDetails
          key={id}
          id={id}
          onVisit={onVisit}
          onChanged={list.refresh}
        />
      )}
    </>
  );
}
function WalkInForm({
  profile,
  request,
  onSaved,
}: {
  profile?: Profile;
  request?: ReceptionRequest;
  onSaved: (id: string) => void;
}) {
  const { t, locale, config, api } = useNative();
  const action = useAction(api);
  const [name, setName] = useState(request?.name ?? profile?.name ?? "");
  const [contact, setContact] = useState(
    request?.contact ?? profile?.contact ?? "",
  );
  const [description, setDescription] = useState(request?.description ?? "");
  const [requests, setRequests] = useState(request?.requests ?? "");
  const [response, setResponse] = useState("");
  const [invalid, setInvalid] = useState(false);
  const message = request?.messages.filter((m) => !m.response).at(-1);
  return (
    <>
      <Input
        label={t("name")}
        value={name}
        onChangeText={setName}
        maxLength={config.form.nameMax}
        editable={!action.busy}
      />
      {invalid && name.trim().length < config.form.nameMin && (
        <Txt style={{ color: "#a44638" }}>{t("tooShort")}</Txt>
      )}
      <Input
        label={t("contact")}
        value={contact}
        onChangeText={setContact}
        maxLength={config.form.contactMax}
        editable={!action.busy}
      />
      {invalid && contact.trim().length < config.form.contactMin && (
        <Txt style={{ color: "#a44638" }}>{t("tooShort")}</Txt>
      )}
      <Input
        label={t("description")}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        hint={t("descriptionHint")}
        editable={!action.busy}
      />
      <Input
        label={t("requests")}
        value={requests}
        onChangeText={setRequests}
        multiline
        maxLength={2000}
        editable={!action.busy}
      />
      {message && (
        <Input
          label={t("response")}
          value={response}
          onChangeText={setResponse}
          multiline
          maxLength={2000}
          editable={!action.busy}
        />
      )}
      <Feedback error={action.error} ok={action.ok} locale={locale} />
      <Btn
        busy={action.busy}
        onPress={async () => {
          if (
            name.trim().length < config.form.nameMin ||
            contact.trim().length < config.form.contactMin ||
            (message && !response.trim())
          ) {
            setInvalid(true);
            return;
          }
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
          const result = await action.run<{ id: string }>(
            request ? `/api/requests/${request.id}` : "/api/requests",
            request
              ? { information, messageId: message?.id ?? null, response }
              : information,
            request ? "PUT" : "POST",
          );
          if (result) onSaved(result.id);
        }}
      >
        {t(request ? "supplement" : "sendRequest")}
      </Btn>
    </>
  );
}
function RequestDetails({
  id,
  onVisit,
  onChanged,
}: {
  id: string;
  onVisit: (id: string) => void;
  onChanged: () => void;
}) {
  const { t, locale, api } = useNative();
  const resource = useLoad<ReceptionRequest>(`/api/requests/${id}`, true);
  const action = useAction(api);
  const speech = useNarration(id);
  const [edit, setEdit] = useState(false);
  const r = resource.data;
  return (
    <Card>
      <LoadingState resource={resource} />
      {r && (
        <>
          <Txt tone="heading">{t("receptionQr")}</Txt>
          <Badge value={r.status} />
          <View style={{ alignItems: "center", padding: 15 }}>
            <QRCode value={`${WEB_URL}/#reception=${r.code}`} size={190} />
          </View>
          <Txt>{t("receptionQrHint")}</Txt>
          <Txt tone="muted">
            {t("expires")}: {dateText(r.qrExpiresAt, locale)}
          </Txt>
          {r.messages.map((m) => (
            <View key={m.id} style={styles.destination}>
              <Txt>{m.text}</Txt>
              <Txt tone="muted">
                {t("actualLanguage")}: {m.language}
                {m.language !== locale ? ` · ${t("fallback")}` : ""}
              </Txt>
              <Btn
                secondary
                busy={speech.loading}
                onPress={() =>
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
              >
                {t("listen")}
              </Btn>
              {(speech.playing || speech.loading) && (
                <Btn secondary onPress={() => void speech.stop()}>
                  {t("stop")}
                </Btn>
              )}
              {m.response && (
                <Txt>
                  {t("response")}: {m.response}
                </Txt>
              )}
            </View>
          ))}
          {speech.error && (
            <Txt style={{ color: "#a44638" }}>{speech.error}</Txt>
          )}
          {r.visitId ? (
            <Btn onPress={() => onVisit(r.visitId!)}>{t("viewTicket")}</Btn>
          ) : (
            r.status !== "Withdrawn" && (
              <>
                <Btn secondary onPress={() => setEdit((e) => !e)}>
                  {t("supplement")}
                </Btn>
                <Btn
                  secondary
                  busy={action.busy}
                  onPress={async () => {
                    if (await action.run(`/api/requests/${id}/refresh-qr`))
                      resource.refresh();
                  }}
                >
                  {t("refreshQr")}
                </Btn>
                <Btn
                  secondary
                  busy={action.busy}
                  onPress={async () => {
                    if (await action.run(`/api/requests/${id}/withdraw`)) {
                      resource.refresh();
                      onChanged();
                    }
                  }}
                >
                  {t("withdraw")}
                </Btn>
                {(edit || r.status === "NeedsInformation") && (
                  <WalkInForm
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
          <Feedback error={action.error} ok={action.ok} locale={locale} />
        </>
      )}
    </Card>
  );
}
function Appointments({ onPrepared }: { onPrepared: (id: string) => void }) {
  const { t, locale, session, api, config } = useNative();
  const action = useAction(api);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState("");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  if (session.isGuest)
    return (
      <Card>
        <Txt>
          {localizeText(
            "Chuẩn bị yêu cầu tiếp nhận và đưa mã lịch hẹn cho nhân viên xác minh tại quầy.",
            locale,
          )}
        </Txt>
      </Card>
    );
  return (
    <Card>
      <Txt tone="heading">{t("externalAccount")}</Txt>
      {config.demo && (
        <Txt tone="muted">{t("demo")}: DEMO-001 / SIM-VERIFY-DEMO-001</Txt>
      )}
      <Input
        label={t("externalReference")}
        value={reference}
        onChangeText={setReference}
        autoCapitalize="none"
      />
      <Input
        label={t("externalProof")}
        value={proof}
        onChangeText={setProof}
        autoCapitalize="none"
      />
      <Btn
        busy={action.busy}
        onPress={async () => {
          await action.run("/api/external/link", { reference, proof });
        }}
      >
        {t("linkExternal")}
      </Btn>
      <Btn
        secondary
        busy={action.busy}
        onPress={async () => {
          const r = await action.run<Booking[]>(
            "/api/appointments",
            undefined,
            "GET",
          );
          if (r) setBookings(r);
        }}
      >
        {t("loadAppointments")}
      </Btn>
      <Feedback error={action.error} ok={action.ok} locale={locale} />
      {bookings?.length === 0 && <Txt>{t("noAppointments")}</Txt>}
      {bookings?.map((b) => (
        <View key={b.reference} style={styles.destination}>
          <Txt tone="heading">{b.reference}</Txt>
          <Txt>{dateText(b.scheduledAt, locale)}</Txt>
          <Badge value={b.status} />
          <Btn
            busy={action.busy}
            onPress={async () => {
              const r = await action.run<{ id: string }>(
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
          </Btn>
        </View>
      ))}
    </Card>
  );
}
