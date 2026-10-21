import {
  useEffect,
  useId,
  useRef,
  useState,
  cloneElement,
  isValidElement,
  type FormEvent,
  type ReactNode,
} from "react";
import { QRCodeSVG } from "qrcode.react";
import type { IScannerControls } from "@zxing/browser";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  QrCode,
  Volume2,
  X,
  Square,
} from "lucide-react";
import {
  ApiError,
  dateText,
  displayName,
  qrToken,
  type Destination,
  type Locale,
  type Narration,
} from "@hospital/shared";
import { api, errorText, useRuntime } from "./runtime";
export function Button({
  children,
  variant = "primary",
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      className={`button ${variant} ${props.className ?? ""}`}
      disabled={props.disabled || busy}
    >
      {busy && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <label className="field">
      <span id={`${id}-label`}>{label}</span>
      {isValidElement<Record<string, unknown>>(children) ? cloneElement(children, {
        "aria-labelledby": `${id}-label`,
        "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
        "aria-invalid": error ? true : undefined,
      }) : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function Form({
  onSubmit,
  busy,
  children,
}: {
  onSubmit: () => void | Promise<void>;
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void onSubmit();
      }}
    >
      <fieldset disabled={busy}>{children}</fieldset>
    </form>
  );
}
export function Status({ value }: { value: string }) {
  const { t } = useRuntime();
  return <span className={`status s-${value}`}>{t(value)}</span>;
}
export function Notice({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: string;
}) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`notice ${kind}`}
    >
      {kind === "success" ? (
        <CheckCircle2 size={19} />
      ) : (
        <AlertCircle size={19} />
      )}
      <div>{children}</div>
    </div>
  );
}
export function Feedback({
  error,
  ok,
  locale,
}: {
  error?: unknown;
  ok?: boolean;
  locale: Locale;
}) {
  return (
    <>
      {error ? (
        <Notice kind="error">
          {errorText(error, locale)}
          {error instanceof ApiError && error.problem.errors && (
            <ul>
              {Object.entries(error.problem.errors).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          )}
        </Notice>
      ) : ok ? (
        <Notice kind="success">
          {locale === "vi"
            ? "Máy chủ đã xác nhận thao tác."
            : "The server confirmed your action."}
        </Notice>
      ) : null}
    </>
  );
}
export function ResourceState({
  resource,
  empty,
}: {
  resource: {
    data: unknown;
    error: unknown;
    loading: boolean;
    refresh: () => void;
    updated?: Date | null;
  };
  empty?: string;
}) {
  const { t, locale } = useRuntime();
  if (resource.error)
    return (
      <Notice kind="error">
        {errorText(resource.error, locale)}
        {resource.data ? (
          <p>
            {t("stale")} {resource.updated?.toLocaleTimeString()}
          </p>
        ) : null}
        <Button variant="quiet" onClick={resource.refresh}>
          {t("retry")}
        </Button>
      </Notice>
    );
  if (!resource.data && resource.loading)
    return (
      <div className="empty">
        <LoaderCircle className="spin" /> {t("loading")}
      </div>
    );
  if (!resource.data) return <div className="empty">{empty ?? t("empty")}</div>;
  return null;
}
export function Empty({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <MapPin />
      </div>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function DestinationCard({ destination }: { destination: Destination }) {
  const { locale, t } = useRuntime();
  return (
    <div className="destination">
      <MapPin size={24} />
      <div>
        <strong>{displayName(destination, locale)}</strong>
        <p>
          {t("building")} {destination.building} · {t("floor")}{" "}
          {destination.floor} · {t("room")} {destination.room}
        </p>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useRuntime();
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t("close")}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function QrPanel({
  purpose,
  code,
  expires,
  number,
}: {
  purpose: "ticket" | "reception";
  code: string;
  expires: string;
  number?: string;
}) {
  const { t, locale } = useRuntime();
  const url = `${window.location.origin}/#${purpose}=${code}`;
  return (
    <div className="qr-panel">
      <QRCodeSVG
        value={url}
        size={180}
        level="M"
        marginSize={3}
        title={t(purpose === "ticket" ? "ticketQr" : "receptionQr")}
      />
      <div>
        <span className="eyebrow">
          <QrCode size={14} />{" "}
          {t(purpose === "ticket" ? "ticketQr" : "receptionQr")}
        </span>
        {number && <h2>{number}</h2>}
        <p>{t(purpose === "ticket" ? "ticketHint" : "receptionQrHint")}</p>
        <small>
          {t("expires")}: {dateText(expires, locale)}
        </small>
        <details>
          <summary>{t("pasteCode")}</summary>
          <code className="code-wrap">{code}</code>
        </details>
      </div>
    </div>
  );
}
export function Scanner({
  purpose,
  onCode,
}: {
  purpose: "ticket" | "reception";
  onCode: (code: string) => Promise<void>;
}) {
  const { t } = useRuntime();
  const [value, setValue] = useState("");
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!camera || !video.current) return;
    let controls: IScannerControls | undefined;
    let disposed = false;
    const element = video.current;
    import("@zxing/browser")
      .then(({ BrowserQRCodeReader }) => {
        if (disposed) return;
        return new BrowserQRCodeReader().decodeFromVideoDevice(
          undefined,
          element,
          (result) => {
            if (result && !disposed) {
              setValue(result.getText());
              setCamera(false);
            }
          },
        );
      })
      .then((c) => {
        if (!c) return;
        controls = c;
        if (disposed) c.stop();
      })
      .catch(() => {
        setError(t("cameraError"));
        setCamera(false);
      });
    return () => {
      disposed = true;
      controls?.stop();
    };
  }, [camera, t]);
  return (
    <div className="scanner">
      {camera && <video ref={video} muted playsInline />}
      <Button
        variant="secondary"
        onClick={() => {
          setError("");
          setCamera((c) => !c);
        }}
      >
        <Camera size={18} />
        {t(camera ? "stopCamera" : "useCamera")}
      </Button>
      <Form
        busy={busy}
        onSubmit={async () => {
          const code = qrToken(value, purpose);
          if (!code) {
            setError(t("qrPurpose"));
            return;
          }
          setBusy(true);
          try {
            await onCode(code);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={t("pasteCode")}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            autoComplete="off"
          />
        </Field>
        <Button busy={busy} type="submit">
          {t("validateCode")}
          <ArrowRight size={16} />
        </Button>
      </Form>
      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}
export function useSpeech(contextKey: string) {
  const { t, locale } = useRuntime();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const stop = () => {
    generation.current++;
    window.speechSynthesis?.cancel();
    setPlaying(false);
  };
  useEffect(() => {
    generation.current++;
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setError("");
    return () => {
      generation.current++;
      window.speechSynthesis?.cancel();
    };
  }, [contextKey, locale]);
  const play = async (path: string, body?: unknown) => {
    stop();
    setError("");
    setLoading(true);
    const seq = generation.current;
    try {
      const n = await api<Narration>(path, "POST", body ?? {});
      if (seq !== generation.current) return;
      if (!window.speechSynthesis) {
        setError(t("audioError"));
        return;
      }
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) =>
        v.lang.toLowerCase().startsWith(n.language),
      );
      if (voices.length && !voice) {
        setError(t("audioError"));
        return;
      }
      const utterance = new SpeechSynthesisUtterance(n.text);
      utterance.lang =
        n.language === "vi"
          ? "vi-VN"
          : n.language === "en"
            ? "en-GB"
            : n.language;
      if (voice) utterance.voice = voice;
      utterance.onend = () => setPlaying(false);
      utterance.onerror = (e) => {
        setPlaying(false);
        if (e.error !== "canceled" && e.error !== "interrupted")
          setError(t("audioError"));
      };
      window.speechSynthesis.speak(utterance);
      setPlaying(true);
    } catch (e) {
      if (seq === generation.current) setError(e instanceof ApiError ? errorText(e, locale) : t("audioError"));
    } finally {
      setLoading(false);
    }
  };
  return { play, stop, playing, error, loading };
}
export function SpeechControls({
  speech,
  onPlay,
  label,
}: {
  speech: ReturnType<typeof useSpeech>;
  onPlay: () => void;
  label?: string;
}) {
  const { t } = useRuntime();
  return (
    <>
      <div className="actions">
        <Button variant="secondary" busy={speech.loading} onClick={onPlay}>
          <Volume2 size={18} />
          {label ?? t("listen")}
        </Button>
        <Button
          variant="quiet"
          onClick={speech.stop}
          disabled={!speech.playing}
        >
          <Square size={16} />
          {t("stop")}
        </Button>
      </div>
      {speech.error && <Notice kind="error">{speech.error}</Notice>}
    </>
  );
}
