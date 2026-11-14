import { useState } from "react";
import type {
  FinalSettlementOutcomeV2,
  Locale,
  VisitSummaryV2,
  VisitV2,
} from "@hospital/shared";
import {
  Button,
  Feedback,
  Field,
  Form,
  ResourceState,
  SectionTitle,
  Status,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";

const labels: Record<
  Locale,
  { title: string; empty: string; done: string; review: string }
> = {
  vi: {
    title: "Lượt khám chờ quyết toán",
    empty: "Chưa có lượt khám đủ điều kiện quyết toán.",
    done: "Đã quyết toán và hoàn tất hành trình.",
    review: "Tôi đã kiểm tra đúng bệnh nhân, số phiếu và kết quả quyết toán.",
  },
  en: {
    title: "Visits ready for settlement",
    empty: "No visits are ready for settlement.",
    done: "Settlement recorded. Visit and journey completed.",
    review: "I have checked the patient, ticket and settlement outcome.",
  },
  zh: {
    title: "待结算就诊",
    empty: "暂无符合结算条件的就诊。",
    done: "结算已记录，就诊和行程已完成。",
    review: "我已核对患者、号码及结算结果。",
  },
  ja: {
    title: "会計待ちの診察",
    empty: "会計可能な診察はありません。",
    done: "会計を記録し、診察と行程が完了しました。",
    review: "患者、受付番号、会計結果を確認しました。",
  },
  ko: {
    title: "수납 대기 진료",
    empty: "수납 가능한 진료가 없습니다.",
    done: "수납이 기록되었으며 진료와 여정이 완료되었습니다.",
    review: "환자, 접수 번호 및 수납 결과를 확인했습니다.",
  },
  ru: {
    title: "Приёмы, готовые к расчёту",
    empty: "Нет приёмов, готовых к расчёту.",
    done: "Расчёт записан. Приём и маршрут завершены.",
    review: "Я проверил пациента, номер талона и результат расчёта.",
  },
};

export function CashierSettlements() {
  const { locale, t } = useRuntime();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const queue = useResource<VisitSummaryV2[]>(
    `/api/v2/cashier/visits?offset=${offset}`,
    true,
  );
  const detail = useResource<VisitV2>(
    selected ? `/api/v2/visits/${selected}` : null,
    true,
  );
  const refresh = () => {
    queue.refresh();
    detail.refresh();
  };
  return (
    <section className="panel" data-testid="cashier-settlements">
      <SectionTitle title={labels[locale].title} />
      <ResourceState resource={queue} />
      {queue.data?.length === 0 && <p>{labels[locale].empty}</p>}
      <div className="actions">
        {queue.data?.map((v) => (
          <Button
            key={v.id}
            variant={selected === v.id ? "primary" : "secondary"}
            aria-pressed={selected === v.id}
            disabled={queue.loading || !!queue.error}
            onClick={() => setSelected(v.id)}
          >
            {v.patientName} · {v.ticket.issuedOn} · {v.ticket.number} ·{" "}
            {v.clinic.room}
          </Button>
        ))}
      </div>
      <div className="actions">
        <Button
          variant="secondary"
          disabled={offset === 0 || queue.loading}
          onClick={() => setOffset(Math.max(0, offset - 100))}
        >
          {t("previousPage")}
        </Button>
        <Button
          variant="secondary"
          disabled={queue.data?.length !== 100 || queue.loading}
          onClick={() => setOffset(offset + 100)}
        >
          {t("nextPage")}
        </Button>
        <Button variant="secondary" onClick={refresh}>
          {t("refresh")}
        </Button>
      </div>
      {selected && <ResourceState resource={detail} />}
      {detail.data && (
        <SettlementForm
          key={`${detail.data.id}:${detail.data.version}`}
          visit={detail.data}
          disabled={detail.loading || !!detail.error}
          refresh={refresh}
        />
      )}
    </section>
  );
}

function SettlementForm({
  visit,
  disabled,
  refresh,
}: {
  visit: VisitV2;
  disabled: boolean;
  refresh: () => void;
}) {
  const { locale, t } = useRuntime();
  const mutation = useMutation();
  const [outcome, setOutcome] = useState<FinalSettlementOutcomeV2>("Final");
  const [reviewed, setReviewed] = useState(false);
  const [completed, setCompleted] = useState<VisitV2 | null>(null);
  const v = completed ?? visit;
  const closed = v.status === "Closed";
  return (
    <article className="sub-panel" data-testid="settlement-form">
      <h3>
        {v.patientName} · {v.ticket.issuedOn} · {v.ticket.number}
      </h3>
      <p>
        {v.clinic.nameVi} · {v.clinic.room} · {v.doctor.name}
      </p>
      <p>
        {t("visitStatus")}: <Status value={v.status} /> · {t("journeyStatus")}:{" "}
        <Status value={v.journeyStatus} />
      </p>
      <p>{t("settlementHint")}</p>
      {closed ? (
        <p role="status">
          {labels[locale].done}{" "}
          {v.finalSettlementOutcome && t(v.finalSettlementOutcome)}
        </p>
      ) : (
        <Form
          busy={mutation.busy}
          onSubmit={async () => {
            if (disabled || !v.capabilities.canSettle || !reviewed) return;
            const result = await mutation.run<VisitV2>(
              `/api/v2/visits/${v.id}/settlement`,
              {
                version: v.version,
                workRevision: v.workRevision,
                outcome,
              },
            );
            setReviewed(false);
            if (result) setCompleted(result);
            refresh();
          }}
        >
          <Field label={t("outcome")}>
            <select
              value={outcome}
              disabled={disabled || mutation.busy || !v.capabilities.canSettle}
              onChange={(e) => {
                setOutcome(e.target.value as FinalSettlementOutcomeV2);
                setReviewed(false);
              }}
            >
              {(["Final", "NoPaymentRequired"] as const).map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              required
              checked={reviewed}
              disabled={disabled || mutation.busy || !v.capabilities.canSettle}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {labels[locale].review}
          </label>
          {!v.capabilities.canSettle && <p>{t("clinicalPending")}</p>}
          <Button
            type="submit"
            busy={mutation.busy}
            disabled={disabled || !reviewed || !v.capabilities.canSettle}
          >
            {t("recordSettlement")}
          </Button>
        </Form>
      )}
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
    </article>
  );
}
