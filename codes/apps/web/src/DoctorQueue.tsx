import { useState } from "react";
import type { Locale, VisitV2 } from "@hospital/shared";
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
  { title: string; accept: string; current: string; empty: string }
> = {
  vi: {
    title: "Danh sách chờ khám",
    accept: "Nhận vào khám",
    current: "Ca đang khám",
    empty: "Chưa có bệnh nhân chờ khám.",
  },
  en: {
    title: "Consultation waiting list",
    accept: "Accept consultation",
    current: "Current consultation",
    empty: "No patients waiting.",
  },
  zh: {
    title: "候诊名单",
    accept: "接诊",
    current: "当前就诊",
    empty: "暂无候诊患者。",
  },
  ja: {
    title: "診察待ち一覧",
    accept: "診察開始",
    current: "診察中",
    empty: "待機中の患者はいません。",
  },
  ko: {
    title: "진료 대기 목록",
    accept: "진료 시작",
    current: "현재 진료",
    empty: "대기 중인 환자가 없습니다.",
  },
  ru: {
    title: "Очередь на приём",
    accept: "Начать приём",
    current: "Текущий приём",
    empty: "Ожидающих пациентов нет.",
  },
};
type Clinic = { clinicLocationId: string; nameVi: string; room: string };
type Queue = {
  currentVisitId: string | null;
  waiting: {
    id: string;
    version: number;
    patientName: string;
    number: string;
    issuedOn: string;
  }[];
};
export function DoctorQueue() {
  const { locale } = useRuntime();
  const clinics = useResource<Clinic[]>("/api/v2/doctor/clinics", true);
  return (
    <>
      <SectionTitle title={labels[locale].title} />
      <ResourceState resource={clinics} />
      {clinics.data?.map((c) => (
        <ClinicQueue key={c.clinicLocationId} clinic={c} />
      ))}
      {clinics.data?.length === 0 && <p>{labels[locale].empty}</p>}
    </>
  );
}
function ClinicQueue({ clinic }: { clinic: Clinic }) {
  const { locale } = useRuntime();
  const text = labels[locale];
  const [offset, setOffset] = useState(0);
  const queue = useResource<Queue>(
    `/api/v2/clinics/${clinic.clinicLocationId}/queue?offset=${offset}`,
    true,
  );
  const current = useResource<VisitV2>(
    queue.data?.currentVisitId
      ? `/api/v2/visits/${queue.data.currentVisitId}`
      : null,
    true,
  );
  const mutation = useMutation();
  const { t } = useRuntime();
  return (
    <section className="panel">
      <SectionTitle title={`${clinic.nameVi} · ${clinic.room}`} />
      <ResourceState resource={queue} />
      <ResourceState resource={current} />
      {current.data && (
        <article data-testid="current-consultation">
          <h3>{text.current} · {current.data.consultationCount}</h3>
          <p>
            {current.data.patientName} · {current.data.ticket.issuedOn} ·{" "}
            {current.data.ticket.number}
          </p>
          <Status value={current.data.examStatus} />
        </article>
      )}
      <Feedback error={mutation.error} locale={locale} />
      {queue.data?.waiting.length === 0 && <p>{text.empty}</p>}
      {queue.data?.waiting.map((v) => (
        <article className="record-row" key={v.id}>
          <span>
            {v.patientName} · {v.issuedOn} · {v.number}
          </span>
          <Button
            disabled={!!queue.data?.currentVisitId || !!queue.error}
            busy={mutation.busy}
            onClick={async () => {
              await mutation.run<VisitV2>(
                `/api/v2/visits/${v.id}/consultations/accept`,
                { version: v.version },
              );
              queue.refresh();
              current.refresh();
            }}
          >
            {text.accept}
          </Button>
        </article>
      ))}
      <Button
        disabled={offset === 0}
        onClick={() => setOffset(Math.max(0, offset - 100))}
      >
        {t("previousPage")}
      </Button>
      <Button
        disabled={queue.data?.waiting.length !== 100}
        onClick={() => setOffset(offset + 100)}
      >
        {t("nextPage")}
      </Button>
    </section>
  );
}
