import { languages, normalizeLocale } from "@hospital/shared";
import { useState } from "react";
import { ArrowRight, ShieldCheck, Languages, HeartPulse } from "lucide-react";
import { translator, type Locale, type Session } from "@hospital/shared";
import { Button, Feedback, Field, Form } from "./components";
import { useMutation } from "./runtime";
export default function Auth({
  locale,
  setLocale,
  onSession,
  expired,
}: {
  locale: Locale;
  setLocale: (l: Locale) => void;
  onSession: (s: Session) => void;
  expired: boolean;
}) {
  const t = translator(locale);
  const [mode, setMode] = useState<"login" | "register" | "recover">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const mutation = useMutation();
  const submit = async () => {
    if (mode === "recover") {
      const result = await mutation.run<{ session: Session; visitId: string }>(
        "/api/auth/recover",
        { code },
      );
      if (result) onSession(result.session);
    } else {
      const s = await mutation.run<Session>(
        `/api/auth/${mode}`,
        mode === "login"
          ? { email, password, language: locale }
          : { email, password, name, contact, language: locale },
      );
      if (s) onSession(s);
    }
  };
  return (
    <div className="entry-layout">
      <section className="entry-story">
        <a className="brand" href="/">
          <span className="brand-icon">
            <HeartPulse />
          </span>
          <span>
            {t("brand")}
            <small>{t("tagline")}</small>
          </span>
        </a>
        <div className="entry-copy">
          <span className="eyebrow">{t("hospital")}</span>
          <h1>{t("welcome")}</h1>
          <p>{t("intro")}</p>
          <div className="entry-path">
            <span>
              01<small>{t("prepare")}</small>
            </span>
            <i />
            <span>
              02<small>{t("journey")}</small>
            </span>
            <i />
            <span>
              03<small>{t("results")}</small>
            </span>
          </div>
        </div>
        <div className="privacy-note">
          <ShieldCheck size={24} />
          <p>{t("guestNote")}</p>
        </div>
      </section>
      <section className="entry-access">
        <div className="language-picker">
          <Languages size={18} />
          <select
            aria-label={t("language")}
            value={locale}
            onChange={(e) => setLocale(normalizeLocale(e.target.value))}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="access-card">
          <span className="eyebrow">
            {t("brand")} / {t("hospital")}
          </span>
          <h2>
            {t(
              mode === "login"
                ? "signIn"
                : mode === "register"
                  ? "register"
                  : "recover",
            )}
          </h2>
          <p>{t("staffEntry")}</p>
          {expired && (
            <div className="notice error" role="alert">
              {t("sessionExpired")}
            </div>
          )}
          <div className="segmented">
            <button
              className={mode === "login" ? "selected" : ""}
              onClick={() => {
                setMode("login");
                mutation.clear();
              }}
            >
              {t("signIn")}
            </button>
            <button
              className={mode === "register" ? "selected" : ""}
              onClick={() => {
                setMode("register");
                mutation.clear();
              }}
            >
              {t("register")}
            </button>
          </div>
          <Form busy={mutation.busy} onSubmit={submit}>
            {mode === "recover" ? (
              <>
                <p>{t("recoveryHint")}</p>
                <Field label={t("recoveryCode")}>
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="off"
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label={t("email")}>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                </Field>
                <Field
                  label={t("password")}
                  hint={mode === "register" ? t("passwordHint") : undefined}
                >
                  <input
                    type="password"
                    required
                    minLength={mode === "register" ? 12 : 1}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                  />
                </Field>
                {mode === "register" && (
                  <>
                    <Field label={t("name")}>
                      <input
                        required
                        minLength={2}
                        maxLength={120}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                      />
                    </Field>
                    <Field label={t("contact")}>
                      <input
                        required
                        minLength={5}
                        maxLength={80}
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        autoComplete="tel"
                      />
                    </Field>
                  </>
                )}
              </>
            )}
            <Feedback error={mutation.error} locale={locale} />
            <Button className="full" type="submit" busy={mutation.busy}>
              {t(
                mode === "login"
                  ? "signIn"
                  : mode === "register"
                    ? "register"
                    : "recover",
              )}
              <ArrowRight size={17} />
            </Button>
          </Form>
          <div className="divider">
            <span>{t("or")}</span>
          </div>
          <Button
            className="full"
            variant="secondary"
            busy={mutation.busy}
            onClick={async () => {
              const s = await mutation.run<Session>("/api/auth/guest", {
                language: locale,
              });
              if (s) onSession(s);
            }}
          >
            {t("guest")}
          </Button>
          <button className="text-button" onClick={() => setMode("recover")}>
            {t("recover")}
          </button>
        </div>
      </section>
    </div>
  );
}
