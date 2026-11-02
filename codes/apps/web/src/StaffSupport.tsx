import { useState } from "react";
import { dateText, displayName, type Assistance } from "@hospital/shared";
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
  const { t, locale, config } = useRuntime();
  const mutation = useMutation();
  const [resolution, setResolution] = useState("");
  const [department, setDepartment] = useState(a.departmentId);
  const update = async (status: string, escalate = false) => {
    if (
      await mutation.run(
        `/api/assistance/${a.id}`,
        {
          status,
          resolution,
          escalate,
          departmentId: department,
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
      <p>{a.description}</p>
      <small>{dateText(a.createdAt, locale)}</small>
      {a.resolution && (
        <p>
          {t("resolution")}: {a.resolution}
        </p>
      )}
      {a.status !== "Resolved" && (
        <>
          <Field label={t("resolution")} hint={t("vietnameseSource")}>
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
          {a.status === "Acknowledged" && (
            <details>
              <summary>{t("escalate")}</summary>
              <Field label={t("department")}>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  {config.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {displayName(d, locale)}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                variant="secondary"
                disabled={
                  resolution.length < 3 || department === a.departmentId
                }
                busy={mutation.busy}
                onClick={() => void update("Acknowledged", true)}
              >
                {t("escalate")}
              </Button>
            </details>
          )}
        </>
      )}
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
    </div>
  );
}
