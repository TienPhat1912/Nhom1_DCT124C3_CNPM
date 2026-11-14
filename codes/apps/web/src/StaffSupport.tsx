import { useState } from "react";
import {
  dateText,
  type Assistance,
  type DescriptionTranslationV2,
} from "@hospital/shared";
import {
  Button,
  Empty,
  Feedback,
  Field,
  ResourceState,
  SectionTitle,
  Status,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";
export default function StaffSupport() {
  const { t } = useRuntime();
  const r = useResource<Assistance[]>("/api/assistance", true);
  return (
    <>
      <SectionTitle title={t("assistance")} />
      <ResourceState resource={r} />
      {r.data?.length === 0 && <Empty text={t("noHelp")} />}
      {r.data?.map((a) => (
        <AssistanceCard
          key={`${a.id}:${a.version}`}
          item={a}
          onChange={r.refresh}
        />
      ))}
    </>
  );
}
function AssistanceCard({
  item: a,
  onChange,
}: {
  item: Assistance;
  onChange: () => void;
}) {
  const { t, locale } = useRuntime();
  const mutation = useMutation();
  const [resolution, setResolution] = useState("");
  const [opened, setOpened] = useState(false);
  const detail = useResource<{
    id: string;
    version: number;
    translation: DescriptionTranslationV2;
  }>(opened ? `/api/assistance/${a.id}` : null);
  const translated =
    detail.data?.version === a.version &&
    detail.data.translation.original === a.description
      ? detail.data.translation
      : null;
  const update = async (status: string, escalate = false) => {
    if (
      await mutation.run(
        `/api/assistance/${a.id}`,
        {
          status,
          resolution,
          escalate,
          departmentId: null,
          version: a.version,
        },
        "PUT",
      )
    )
      onChange();
  };
  return (
    <div className="panel">
      <SectionTitle title={t(a.category)}>
        <Status value={a.status} />
      </SectionTitle>
      <p>{a.patientName}</p>
      {a.destinationSnapshot && (
        <small>{destinationLabel(a.destinationSnapshot)}</small>
      )}
      <Button variant="quiet" onClick={() => setOpened(!opened)}>
        {t("details")}
      </Button>
      {opened && (
        <>
          <p style={{ whiteSpace: "pre-wrap" }}>{a.description}</p>
          <small>{a.sourceLanguage ?? "—"}</small>
          {detail.loading && <p>{t("loading")}</p>}
          {translated?.status === "Translated" && (
            <section aria-label={t("requestTranslation")}>
              <h3>{t("requestTranslation")}</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{translated.translated}</p>
            </section>
          )}
          {translated?.status === "NotRequired" && (
            <p>{t("translationNotRequired")}</p>
          )}
          {(!!detail.error || translated?.status === "Unavailable") && (
            <p>{t("requestTranslationUnavailable")}</p>
          )}
          {(!!detail.error || translated?.status === "Unavailable") && (
            <Button onClick={detail.refresh}>{t("retry")}</Button>
          )}
        </>
      )}
      <small>{dateText(a.createdAt, locale)}</small>
      {a.resolution && (
        <p>
          {t("resolution")}: {a.resolution}
        </p>
      )}
      {a.status !== "Resolved" && (
        <>
          <Field label={t("resolution")}>
            <textarea
              value={resolution}
              maxLength={500}
              onChange={(e) => setResolution(e.target.value)}
            />
          </Field>
          <div className="actions">
            {a.status === "Open" ? (
              <Button
                busy={mutation.busy}
                onClick={() => void update("Acknowledged")}
              >
                {t("acknowledge")}
              </Button>
            ) : (
              <Button
                busy={mutation.busy}
                disabled={resolution.length < 3}
                onClick={() => void update("Resolved")}
              >
                {t("resolve")}
              </Button>
            )}
          </div>
        </>
      )}
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
    </div>
  );
}

function destinationLabel(snapshot: string): string {
  try {
    const value = JSON.parse(snapshot);
    return [value.nameVi, value.room].filter(Boolean).join(" · ");
  } catch {
    return "";
  }
}
