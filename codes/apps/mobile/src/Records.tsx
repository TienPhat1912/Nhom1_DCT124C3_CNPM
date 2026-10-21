import { useState } from "react";
import { Linking, View } from "react-native";
import {
  dateText,
  displayName,
  type Assistance,
  type Content,
  type Notification,
  type Profile,
  type Session,
} from "@hospital/shared";
import {
  Badge,
  Btn,
  Card,
  Choice,
  Feedback,
  Input,
  LoadingState,
  Txt,
  styles,
} from "./ui";
import { useAction, useLoad, useNarration, useNative } from "./runtime";
export function Results({ id }: { id: string | null }) {
  const { t, locale, config } = useNative();
  const r = useLoad<Content>(
    id ? `/api/visits/${id}/content?language=${locale}` : null,
    true,
  );
  const s = r.data?.summary;
  const speech = useNarration(`${id}:${s?.revision}:${s?.language}`);
  const [original, setOriginal] = useState(false);
  const play = (section: string) =>
    void speech.play(`/api/visits/${id}/narration`, {
      kind: "Summary",
      section,
      sourceRevision: s?.revision,
      language: locale,
    });
  return (
    <>
      <Txt tone="title">{t("results")}</Txt>
      <Txt tone="muted">{t("recordHint")}</Txt>
      <LoadingState resource={r} />
      {r.data && (
        <>
          {s ? (
            <>
              <Card>
                <Txt tone="muted">
                  {t("author")}: {s.authorName}
                </Txt>
                <Txt tone="muted">
                  {t("publishedAt")}: {dateText(s.publishedAt, locale)} ·{" "}
                  {t("revision")} {s.revision}
                </Txt>
                <Txt tone="muted">
                  {t("actualLanguage")}: {s.language}
                  {s.fallback ? ` · ${t("fallback")}` : ""}
                </Txt>
                <Txt tone="heading">{t("diagnosis")}</Txt>
                <Txt>{s.diagnosis}</Txt>
                {!!s.explanation && (
                  <>
                    <Txt tone="heading">{t("explanation")}</Txt>
                    <Txt>{s.explanation}</Txt>
                  </>
                )}
                <Btn
                  secondary
                  busy={speech.loading}
                  onPress={() => play("Diagnosis")}
                >
                  {t("listen")}
                </Btn>
                <Btn
                  secondary
                  disabled={!speech.playing}
                  onPress={() => void speech.stop()}
                >
                  {t("stop")}
                </Btn>
              </Card>
              <Card>
                <Txt tone="heading">{t("instructions")}</Txt>
                <Txt>{s.instructions}</Txt>
                <Btn
                  secondary
                  busy={speech.loading}
                  onPress={() => play("Instructions")}
                >
                  {t("listen")}
                </Btn>
                <Btn
                  secondary
                  disabled={!speech.playing}
                  onPress={() => void speech.stop()}
                >
                  {t("stop")}
                </Btn>
                {s.documentReference && (
                  <Txt tone="muted">
                    {t("documentReference")}: {s.documentReference}
                  </Txt>
                )}
                <Btn secondary onPress={() => setOriginal((o) => !o)}>
                  {t("original")}
                </Btn>
                {original && (
                  <>
                    <Txt tone="muted">{s.original.language}</Txt>
                    <Txt>{s.original.diagnosis}</Txt>
                    <Txt>{s.original.explanation}</Txt>
                    <Txt>{s.original.instructions}</Txt>
                  </>
                )}
              </Card>
              {speech.error && (
                <Txt style={{ color: "#a44638" }}>{speech.error}</Txt>
              )}
            </>
          ) : (
            <Card>
              <Txt>{t("noPublished")}</Txt>
            </Card>
          )}
          <Card>
            <Txt tone="heading">{t("followUp")}</Txt>
            <Txt tone="muted">{t("followUpHint")}</Txt>
            {r.data.followUps.length === 0 && <Txt>{t("noFollowUp")}</Txt>}
            {r.data.followUps.map((f) => (
              <View key={f.id} style={styles.destination}>
                <Txt>
                  {displayName(
                    config.departments.find((d) => d.id === f.departmentId) ?? {
                      nameVi: t("department"),
                      nameEn: t("department"),
                    },
                    locale,
                  )}
                </Txt>
                <Txt>{dateText(f.recommendedAt, locale)}</Txt>
                <Txt>{f.text}</Txt>
                <Txt tone="muted">
                  {t("actualLanguage")}: {f.language}
                  {f.language !== locale ? ` · ${t("fallback")}` : ""}
                </Txt>
              </View>
            ))}
            {r.data.followUps.length > 0 &&
              (r.data.bookingUrl?.startsWith("https://") ? (
                <Btn
                  secondary
                  onPress={() => void Linking.openURL(r.data!.bookingUrl!)}
                >
                  {t("bookFollowUp")}
                </Btn>
              ) : (
                <Txt tone="muted">{t("bookingUnavailable")}</Txt>
              ))}
          </Card>
        </>
      )}
    </>
  );
}
export function Help({
  visitId,
  stepId,
}: {
  visitId: string | null;
  stepId?: string;
}) {
  const { t, locale, api, config } = useNative();
  const r = useLoad<Assistance[]>("/api/assistance", true);
  const action = useAction(api);
  const [category, setCategory] = useState("Navigation");
  const [description, setDescription] = useState("");
  return (
    <>
      <Txt tone="title">{t("assistance")}</Txt>
      <Card>
        <Txt tone="muted">
          {locale === "vi" ? config.emergencyVi : config.emergencyEn}
        </Txt>
        <Txt tone="heading">{t("category")}</Txt>
        {["Navigation", "Language", "Reception", "Queue", "Other"].map((c) => (
          <Choice
            key={c}
            label={t(c)}
            selected={category === c}
            onPress={() => setCategory(c)}
          />
        ))}
        <Input
          label={t("helpDescription")}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
        />
        <Btn
          busy={action.busy}
          onPress={async () => {
            if (
              await action.run("/api/assistance", {
                category,
                description,
                visitId,
                requestId: null,
                stepId: stepId ?? null,
              })
            ) {
              setDescription("");
              r.refresh();
            }
          }}
        >
          {t("sendHelp")}
        </Btn>
        <Feedback error={action.error} ok={action.ok} locale={locale} />
      </Card>
      <LoadingState resource={r} />
      {r.data?.length === 0 && <Txt>{t("noHelp")}</Txt>}
      {r.data?.map((a) => (
        <Card key={a.id}>
          <Txt tone="heading">{t(a.category)}</Txt>
          <Badge value={a.status} />
          <Txt>{a.description}</Txt>
          {a.resolution && (
            <Txt>
              {t("resolution")}: {a.resolution}
            </Txt>
          )}
          <Txt tone="muted">{dateText(a.createdAt, locale)}</Txt>
        </Card>
      ))}
    </>
  );
}
export function Notifications({ onVisit }: { onVisit: (id: string) => void }) {
  const { t, locale, api } = useNative();
  const r = useLoad<Notification[]>("/api/notifications", true);
  const action = useAction(api);
  return (
    <>
      <Txt tone="title">{t("notifications")}</Txt>
      <LoadingState resource={r} />
      {r.data?.length === 0 && <Txt>{t("noNotifications")}</Txt>}
      {r.data?.map((n) => (
        <Card key={n.id}>
          <Txt tone="heading">{t(n.key)}</Txt>
          <Txt tone="muted">{dateText(n.createdAt, locale)}</Txt>
          {n.visitId && (
            <Btn secondary onPress={() => onVisit(n.visitId!)}>
              {t("details")}
            </Btn>
          )}
          {!n.read && (
            <Btn
              secondary
              busy={action.busy}
              onPress={async () => {
                if (await action.run(`/api/notifications/${n.id}/read`))
                  r.refresh();
              }}
            >
              {t("readNotification")}
            </Btn>
          )}
        </Card>
      ))}
      <Feedback error={action.error} locale={locale} />
    </>
  );
}
export function ProfileScreen({ onLink }: { onLink: () => void }) {
  const { t } = useNative();
  const r = useLoad<Profile>("/api/auth/profile");
  return (
    <>
      <Txt tone="title">{t("profile")}</Txt>
      <LoadingState resource={r} />
      {r.data && (
        <ProfileForm
          key={r.data.version}
          profile={r.data}
          onSaved={r.refresh}
          onLink={onLink}
        />
      )}
    </>
  );
}
function ProfileForm({
  profile,
  onSaved,
  onLink,
}: {
  profile: Profile;
  onSaved: () => void;
  onLink: () => void;
}) {
  const { t, locale, setLocale, api, session, updateSession } = useNative();
  const [name, setName] = useState(profile.name);
  const [contact, setContact] = useState(profile.contact);
  const action = useAction(api);
  return (
    <Card>
      <Input
        label={t("name")}
        value={name}
        onChangeText={setName}
        maxLength={120}
      />
      <Input
        label={t("contact")}
        value={contact}
        onChangeText={setContact}
        maxLength={80}
      />
      <Choice
        label="Tiếng Việt"
        selected={locale === "vi"}
        onPress={() => setLocale("vi")}
      />
      <Choice
        label="English"
        selected={locale === "en"}
        onPress={() => setLocale("en")}
      />
      <Btn
        busy={action.busy}
        disabled={name.trim().length < 2 || contact.trim().length < 5}
        onPress={async () => {
          if (
            await action.run(
              "/api/auth/profile",
              { name, contact, language: locale, version: profile.version },
              "PUT",
            )
          ) {
            await updateSession({ ...session, name, language: locale });
            onSaved();
          }
        }}
      >
        {t("save")}
      </Btn>
      <Feedback error={action.error} ok={action.ok} locale={locale} />
      {session.isGuest && (
        <>
          <Txt>{t("optionalAccountHint")}</Txt>
          <Btn secondary onPress={onLink}>
            {t("linkAccount")}
          </Btn>
        </>
      )}
    </Card>
  );
}
export function LinkAccountScreen({
  visitId,
  onDone,
  onCancel,
}: {
  visitId: string | null;
  onDone: (session: Session, id: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const { t, locale, api } = useNative();
  const [register, setRegister] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const action = useAction(api);
  return (
    <Card>
      <Txt tone="title">{t("linkAccount")}</Txt>
      <Txt>{t("optionalAccountHint")}</Txt>
      <Choice
        label={t("newAccount")}
        selected={register}
        onPress={() => setRegister(true)}
      />
      <Choice
        label={t("existingAccount")}
        selected={!register}
        onPress={() => setRegister(false)}
      />
      <Input
        label={t("email")}
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <Input
        label={t("password")}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        hint={register ? t("passwordHint") : undefined}
      />
      <Btn
        busy={action.busy}
        disabled={!email.includes("@") || password.length < (register ? 12 : 1)}
        onPress={async () => {
          const claim = await action.run<{ claim: string }>(
            "/api/auth/link-claim",
            { returnVisitId: visitId },
          );
          if (!claim) return;
          const r = await action.run<{
            session: Session;
            returnVisitId: string | null;
          }>("/api/auth/convert", {
            claim: claim.claim,
            email,
            password,
            register,
          });
          if (r) await onDone(r.session, r.returnVisitId);
        }}
      >
        {t("linkAccount")}
      </Btn>
      <Btn secondary onPress={onCancel}>
        {t("cancel")}
      </Btn>
      <Feedback error={action.error} locale={locale} />
    </Card>
  );
}
