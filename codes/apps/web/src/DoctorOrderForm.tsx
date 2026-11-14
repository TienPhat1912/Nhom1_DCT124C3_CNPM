import { useEffect, useState } from "react";
import {
  ApiError,
  type Locale,
  type OrderPreviewV2,
  type VisitV2,
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
  { title: string; preview: string; confirm: string; sent: string }
> = {
  vi: {
    title: "Chỉ định một dịch vụ",
    preview: "Xem trước chỉ định",
    confirm: "Xác nhận chỉ định",
    sent: "Đã chỉ định dịch vụ",
  },
  en: {
    title: "Order one service",
    preview: "Preview order",
    confirm: "Confirm service order",
    sent: "Service ordered",
  },
  zh: {
    title: "开立一项服务",
    preview: "预览医嘱",
    confirm: "确认医嘱",
    sent: "已开立服务",
  },
  ja: {
    title: "サービスを1件指示",
    preview: "指示を確認",
    confirm: "指示を確定",
    sent: "サービス指示済み",
  },
  ko: {
    title: "서비스 1건 처방",
    preview: "처방 미리보기",
    confirm: "처방 확정",
    sent: "서비스 처방 완료",
  },
  ru: {
    title: "Назначить одну услугу",
    preview: "Предпросмотр назначения",
    confirm: "Подтвердить назначение",
    sent: "Услуга назначена",
  },
};
export function DoctorOrderForm({
  visit,
  onFollow,
  onChanged,
}: {
  visit: VisitV2;
  onFollow: (id: string) => void;
  onChanged: () => void;
}) {
  const { locale, t } = useRuntime();
  const text = labels[locale];
  const services = useResource<{ id: string; code: string; nameVi: string }[]>(
    "/api/v2/order-services",
  );
  const mutation = useMutation();
  const [serviceId, setService] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<OrderPreviewV2 | null>(null);
  useEffect(() => {
    if (
      mutation.error instanceof ApiError &&
      mutation.error.problem.status === 409
    )
      setPreview(null);
  }, [mutation.error]);
  return (
    <div className="panel">
      <SectionTitle title={text.title} />
      <ResourceState resource={services} />
      <Form
        busy={mutation.busy}
        onSubmit={async () => {
          const result = await mutation.run<OrderPreviewV2>(
            `/api/v2/visits/${visit.id}/orders/preview`,
            { version: visit.version, serviceId, note },
          );
          if (result) setPreview(result);
        }}
      >
        <Field label={t("service")}>
          <select
            required
            value={serviceId}
            disabled={!!preview}
            onChange={(e) => {
              setService(e.target.value);
              setPreview(null);
            }}
          >
            <option value="">{t("service")}</option>
            {services.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.nameVi}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("note")}>
          <textarea
            value={note}
            maxLength={500}
            disabled={!!preview}
            onChange={(e) => {
              setNote(e.target.value);
              setPreview(null);
            }}
          />
        </Field>
        <Feedback error={mutation.error} locale={locale} />
        {!preview && (
          <Button
            type="submit"
            disabled={!serviceId || !visit.capabilities.canConfirmOrder}
          >
            {text.preview}
          </Button>
        )}
        {preview && (
          <section data-testid="order-preview">
            <p>
              {preview.service.code} · {preview.service.nameVi}
            </p>
            <p>
              {preview.destination.nameVi} · {preview.destination.building} ·{" "}
              {preview.destination.floor} · {preview.destination.room}
            </p>
            <p>{preview.note}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPreview(null);
                mutation.clear();
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              busy={mutation.busy}
              onClick={async () => {
                onFollow(visit.id);
                const result = await mutation.run<VisitV2>(
                  `/api/v2/visits/${visit.id}/orders`,
                  {
                    version: preview.visitVersion,
                    serviceId: preview.service.id,
                    note: preview.note,
                    previewId: preview.previewId,
                  },
                );
                if (result) {
                  setPreview(null);
                  onChanged();
                }
              }}
            >
              {text.confirm}
            </Button>
          </section>
        )}
      </Form>
    </div>
  );
}
export function OrderedService({ id }: { id: string }) {
  const { locale } = useRuntime();
  const resource = useResource<VisitV2>(`/api/v2/visits/${id}`, true);
  const visit = resource.data;
  return (
    <>
      <ResourceState resource={resource} />
      {visit?.orders.length ? (
        <section className="panel" data-testid="ordered-service">
          <SectionTitle title={labels[locale].sent} />
          <p>{visit.patientName}</p>
          <Status value={visit.examStatus} />
          {visit.orders.map((order) => (
            <article key={order.id}>
              <p>
                {order.serviceSnapshot.code} · {order.serviceSnapshot.nameVi}
              </p>
              <p>
                {order.destinationSnapshot.nameVi} ·{" "}
                {order.destinationSnapshot.room}
              </p>
              <p>{order.note}</p>
              <Status value={order.status} />
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}
