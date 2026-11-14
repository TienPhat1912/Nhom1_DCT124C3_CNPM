import { useState } from "react";
import type { Locale, ServiceOrderWorkItemV2 } from "@hospital/shared";
import {
  Button,
  Feedback,
  ResourceState,
  SectionTitle,
  Status,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";

const labels: Record<
  Locale,
  {
    title: string;
    pending: string;
    completed: string;
    complete: string;
    empty: string;
    returned: string;
  }
> = {
  vi: {
    title: "Danh sách dịch vụ",
    pending: "Chưa hoàn tất",
    completed: "Hoàn tất",
    complete: "Hoàn tất dịch vụ",
    empty: "Chưa có dịch vụ trong danh sách này.",
    returned:
      "Bệnh nhân tự trở lại hàng chờ phòng khám cũ. Bác sĩ sẽ nhận lại khi sẵn sàng.",
  },
  en: {
    title: "Service orders",
    pending: "Not completed",
    completed: "Completed",
    complete: "Complete service",
    empty: "No service orders in this list.",
    returned:
      "The patient returns to the original clinic waiting list. The doctor will accept the patient when ready.",
  },
  zh: {
    title: "服务医嘱",
    pending: "未完成",
    completed: "已完成",
    complete: "完成服务",
    empty: "此列表暂无服务。",
    returned: "患者自动返回原诊室候诊，由医生再次接诊。",
  },
  ja: {
    title: "サービス一覧",
    pending: "未完了",
    completed: "完了",
    complete: "サービスを完了",
    empty: "この一覧にサービスはありません。",
    returned: "患者は元の診察室の待機列に戻り、医師が再度診察を開始します。",
  },
  ko: {
    title: "검사 및 서비스 목록",
    pending: "미완료",
    completed: "완료",
    complete: "서비스 완료",
    empty: "목록에 서비스가 없습니다.",
    returned:
      "환자는 기존 진료실의 대기 목록으로 돌아가며 의사가 다시 진료를 시작합니다.",
  },
  ru: {
    title: "Назначенные услуги",
    pending: "Не завершено",
    completed: "Завершено",
    complete: "Завершить услугу",
    empty: "В этом списке нет услуг.",
    returned:
      "Пациент возвращается в очередь прежнего кабинета. Врач начнёт повторный приём, когда будет готов.",
  },
};

export function ServiceOrders() {
  const { locale, t } = useRuntime();
  const text = labels[locale];
  const [status, setStatus] = useState("NotCompleted");
  const [offset, setOffset] = useState(0);
  const resource = useResource<ServiceOrderWorkItemV2[]>(
    `/api/v2/service/orders?status=${status}&offset=${offset}`,
    true,
  );
  return (
    <section className="panel" data-testid="service-orders">
      <SectionTitle title={text.title} />
      <div className="actions">
        {(["NotCompleted", "Completed"] as const).map((value) => (
          <Button
            key={value}
            variant={status === value ? "primary" : "secondary"}
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setOffset(0);
            }}
          >
            {value === "Completed" ? text.completed : text.pending}
          </Button>
        ))}
      </div>
      <ResourceState resource={resource} />
      {resource.data?.length === 0 && <p>{text.empty}</p>}
      {resource.data?.map((row) => (
        <ServiceOrder
          key={row.order.id}
          row={row}
          disabled={!!resource.error || resource.loading}
          refresh={resource.refresh}
        />
      ))}
      <div className="actions">
        <Button
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 100))}
        >
          {t("previousPage")}
        </Button>
        <Button
          disabled={resource.data?.length !== 100}
          onClick={() => setOffset(offset + 100)}
        >
          {t("nextPage")}
        </Button>
      </div>
    </section>
  );
}

function ServiceOrder({
  row,
  disabled,
  refresh,
}: {
  row: ServiceOrderWorkItemV2;
  disabled: boolean;
  refresh: () => void;
}) {
  const { locale, t } = useRuntime();
  const mutation = useMutation();
  const text = labels[locale];
  const order = row.order;
  return (
    <article className="sub-panel" data-testid={`service-order-${order.id}`}>
      <h3>
        {row.patientName} · {row.ticket.issuedOn} · {row.ticket.number}
      </h3>
      <p>
        {order.serviceSnapshot.code} · {order.serviceSnapshot.nameVi}
      </p>
      <p>
        {order.destinationSnapshot.nameVi} · {order.destinationSnapshot.room}
      </p>
      <p>{order.note}</p>
      <Status value={order.status} />
      {order.completedAt && (
        <p>
          {order.completedBy?.name} ·{" "}
          {new Date(order.completedAt).toLocaleString(locale)}
        </p>
      )}
      {order.status === "NotCompleted" && (
        <>
          <p>{text.returned}</p>
          <Button
            busy={mutation.busy}
            disabled={disabled || !row.canComplete}
            onClick={async () => {
              await mutation.run(
                `/api/v2/visits/${row.visitId}/orders/${order.id}/complete`,
                { version: row.visitVersion, orderVersion: order.version },
              );
              refresh();
            }}
          >
            {text.complete}
          </Button>
        </>
      )}
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
      {!!mutation.error && (
        <Button variant="secondary" onClick={refresh}>
          {t("refresh")}
        </Button>
      )}
    </article>
  );
}
