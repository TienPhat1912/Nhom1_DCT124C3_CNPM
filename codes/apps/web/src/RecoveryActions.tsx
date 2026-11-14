import { useState } from "react";
import { dateText } from "@hospital/shared";
import { Button, Field, Feedback, Notice } from "./components";
import { useMutation, useRuntime } from "./runtime";
export function RecoveryActions({
  id,
  onReissued,
}: {
  id: string;
  onReissued?: () => void;
}) {
  const { t, locale } = useRuntime();
  const [verified, setVerified] = useState(false);
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const mutation = useMutation();
  return (
    <details className="sub-panel">
      <summary>{t("recover")}</summary>
      <Field label={t("verificationNote")}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          minLength={3}
          maxLength={500}
        />
      </Field>
      <label className="check-field">
        <input
          type="checkbox"
          checked={verified}
          onChange={(e) => setVerified(e.target.checked)}
        />
        {t("attendeeVerified")}
      </label>
      <div className="actions">
        {onReissued && (
          <Button
            variant="secondary"
            disabled={!verified || note.length < 3}
            busy={mutation.busy}
            onClick={async () => {
              if (
                await mutation.run(`/api/visits/${id}/reissue`, {
                  attendeeVerified: verified,
                  verificationNote: note,
                })
              )
                onReissued();
            }}
          >
            {t("reissue")}
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={!verified || note.length < 3}
          busy={mutation.busy}
          onClick={async () => {
            const r = await mutation.run<{
              recoveryCode: string;
              expiresAt: string;
            }>(`/api/visits/${id}/recovery`, {
              attendeeVerified: verified,
              verificationNote: note,
            });
            if (r) {
              setCode(r.recoveryCode);
              setExpiresAt(r.expiresAt);
            }
          }}
        >
          {t("issueRecovery")}
        </Button>
      </div>
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
      {code && (
        <Notice>
          <strong>{t("recoveryCode")}</strong>
          <code className="code-wrap">{code}</code>
          <p>
            {t("expires")}: {dateText(expiresAt, locale)}
          </p>
        </Notice>
      )}
    </details>
  );
}
