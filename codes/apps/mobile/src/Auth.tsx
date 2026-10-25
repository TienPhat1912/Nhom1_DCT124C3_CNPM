import { LanguagePicker } from "./LanguagePicker";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { translator, type Locale, type Session } from "@hospital/shared";
import { Btn, Card, Choice, Feedback, Input, Txt, styles } from "./ui";
import { useAction } from "./runtime";
export function Auth({
  locale,
  setLocale,
  onSession,
}: {
  locale: Locale;
  setLocale: (l: Locale) => void;
  onSession: (s: Session) => Promise<void>;
}) {
  const t = translator(locale);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [validation, setValidation] = useState("");
  const action = useAction();
  const submit = async () => {
    setValidation("");
    if (mode === "recover") {
      const r = await action.run<{ session: Session }>("/api/auth/recover", {
        code,
      });
      if (r) await onSession(r.session);
      return;
    }
    if (
      !email.includes("@") ||
      !password ||
      (mode === "register" &&
        (name.trim().length < 2 ||
          contact.trim().length < 5 ||
          password.length < 12))
    ) {
      setValidation(t("validation"));
      return;
    }
    const s = await action.run<Session>(`/api/auth/${mode}`, {
      email,
      password,
      name,
      contact,
      language: locale,
    });
    if (s) await onSession(s);
  };
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.row}>
        <Txt tone="title">✚ {t("brand")}</Txt>
        <LanguagePicker locale={locale} onChange={setLocale} />
      </View>
      <Txt tone="eyebrow">{t("hospital")}</Txt>
      <Txt tone="title">{t("welcome")}</Txt>
      <Txt tone="muted">{t("intro")}</Txt>
      <Card>
        <View style={styles.row}>
          <Choice
            label={t("signIn")}
            selected={mode === "login"}
            onPress={() => setMode("login")}
          />
          <Choice
            label={t("register")}
            selected={mode === "register"}
            onPress={() => setMode("register")}
          />
        </View>
        {mode === "recover" ? (
          <>
            <Txt>{t("recoveryHint")}</Txt>
            <Input
              label={t("recoveryCode")}
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
            />
          </>
        ) : (
          <>
            <Input
              label={t("email")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Input
              label={t("password")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              maxLength={128}
              hint={mode === "register" ? t("passwordHint") : undefined}
            />
            {mode === "register" && (
              <>
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
              </>
            )}
          </>
        )}
        {validation && <Txt style={{ color: "#a44638" }}>{validation}</Txt>}
        <Feedback error={action.error} locale={locale} />
        <Btn busy={action.busy} onPress={() => void submit()}>
          {t(
            mode === "login"
              ? "signIn"
              : mode === "register"
                ? "register"
                : "recover",
          )}
        </Btn>
        <Btn
          secondary
          busy={action.busy}
          onPress={async () => {
            const s = await action.run<Session>("/api/auth/guest", {
              language: locale,
            });
            if (s) await onSession(s);
          }}
        >
          {t("guest")}
        </Btn>
        <Btn secondary onPress={() => setMode("recover")}>
          {t("recover")}
        </Btn>
        <Txt tone="muted">{t("guestNote")}</Txt>
      </Card>
    </ScrollView>
  );
}
