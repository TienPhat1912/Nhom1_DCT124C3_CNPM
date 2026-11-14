import { useState } from "react";
import type {
  ClinicalCatalogEntryV2,
  ClinicalTemplateV2,
  ClinicalCatalogPageV2,
  ClinicalCatalogKindV2,
  ExaminationPreviewV2,
  CompleteExaminationResultV2,
  Locale,
  VisitV2,
} from "@hospital/shared";
import {
  Button,
  Feedback,
  Field,
  Notice,
  ResourceState,
  SectionTitle,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";
const labels: Record<Locale, string[]> = {
  vi: [
    "Kết thúc khám",
    "Triệu chứng",
    "Dấu hiệu",
    "Chẩn đoán",
    "Mẫu Việt",
    "Xem trước kết quả",
    "Sửa lựa chọn",
    "Xác nhận kết thúc khám",
    "Tôi đã kiểm tra nội dung Việt",
    "Dữ liệu DEMO chưa được bệnh viện phê duyệt",
    "Tìm mã hoặc tên",
  ],
  en: [
    "Complete examination",
    "Symptoms",
    "Signs",
    "Diagnoses",
    "Vietnamese template",
    "Preview examination",
    "Edit selections",
    "Confirm examination",
    "I reviewed the Vietnamese content",
    "DEMO data has not been approved by the hospital",
    "Search code or name",
  ],
  zh: [
    "结束诊察",
    "症状",
    "体征",
    "诊断",
    "越南语模板",
    "预览结果",
    "修改选择",
    "确认结束诊察",
    "已核对越南语内容",
    "演示数据未经医院批准",
    "搜索代码或名称",
  ],
  ja: [
    "診察終了",
    "症状",
    "所見",
    "診断",
    "ベトナム語テンプレート",
    "結果を確認",
    "選択を変更",
    "診察終了を確定",
    "ベトナム語原文を確認しました",
    "デモデータは病院未承認です",
    "コードまたは名前で検索",
  ],
  ko: [
    "진료 종료",
    "증상",
    "징후",
    "진단",
    "베트남어 서식",
    "결과 미리보기",
    "선택 수정",
    "진료 종료 확인",
    "베트남어 원문을 확인했습니다",
    "병원 미승인 데모 데이터",
    "코드 또는 이름 검색",
  ],
  ru: [
    "Завершение приёма",
    "Симптомы",
    "Признаки",
    "Диагнозы",
    "Вьетнамский шаблон",
    "Предпросмотр результата",
    "Изменить выбор",
    "Подтвердить завершение",
    "Вьетнамский текст проверен",
    "Демонстрационные данные не утверждены больницей",
    "Поиск по коду или названию",
  ],
};
type Entry = ClinicalCatalogEntryV2 | ClinicalTemplateV2;
function Picker({
  kind,
  title,
  selected,
  change,
}: {
  kind: ClinicalCatalogKindV2;
  title: string;
  selected: Entry[];
  change: (items: Entry[]) => void;
}) {
  const { locale, t } = useRuntime();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const resource = useResource<ClinicalCatalogPageV2>(
    `/api/v2/clinical-catalog/${kind}?search=${encodeURIComponent(search)}&offset=${offset}`,
  );
  return (
    <section className="sub-panel">
      <h4>{title}</h4>
      <Field label={`${labels[locale][10]} · ${title}`}>
        <input
          type="search"
          maxLength={100}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
        />
      </Field>
      <ResourceState resource={resource} />
      {resource.data?.items.length === 0 && <p>{t("empty")}</p>}
      {resource.data?.items.map((item) => (
        <label className="check-field" key={item.id}>
          <input
            type={kind === "templates" ? "radio" : "checkbox"}
            name={kind}
            checked={selected.some((s) => s.id === item.id)}
            onChange={(e) =>
              change(
                kind === "templates"
                  ? [item]
                  : e.target.checked
                    ? [...selected, item]
                    : selected.filter((s) => s.id !== item.id),
              )
            }
          />
          {item.code} · {item.nameVi}
          {item.isDemo ? " · DEMO" : ""}
        </label>
      ))}
      {selected.length > 0 && <p>{selected.map((s) => s.nameVi).join(", ")}</p>}
      <Button
        type="button"
        disabled={offset === 0}
        onClick={() => setOffset(Math.max(0, offset - 100))}
      >
        {t("previousPage")}
      </Button>
      <Button
        type="button"
        disabled={!resource.data?.hasMore}
        onClick={() => setOffset(offset + 100)}
      >
        {t("nextPage")}
      </Button>
    </section>
  );
}
export function ExaminationForm({
  visit,
  onChanged,
}: {
  visit: VisitV2;
  onChanged: (result: CompleteExaminationResultV2) => void;
}) {
  const { locale, t } = useRuntime();
  const text = labels[locale];
  const mutation = useMutation();
  const [selections, setSelections] = useState<Entry[][]>([[], [], [], []]);
  const [preview, setPreview] = useState<ExaminationPreviewV2 | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [result, setResult] = useState<CompleteExaminationResultV2 | null>(
    null,
  );
  const select = (a: Entry[]) =>
    a.map((x) => ({ id: x.id, version: x.version }));
  return (
    <section className="panel" data-testid="examination-form">
      <SectionTitle title={text[0]} />
      {result ? (
        <>
          <Notice kind="success">{t("Completed")}</Notice>
          <p>{result.record.content.diagnosis}</p>
          <p>{result.record.content.explanation}</p>
          <p>{result.record.content.instructions}</p>
        </>
      ) : preview ? (
        <section data-testid="examination-preview">
          <Notice>{t("vietnameseSource")}</Notice>
          <p className="preserve-text">{preview.content.diagnosis}</p>
          <p className="preserve-text">{preview.content.explanation}</p>
          <p className="preserve-text">{preview.content.instructions}</p>
          <label className="check-field">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {text[8]}
          </label>
          <Button
            disabled={mutation.busy}
            onClick={() => {
              setPreview(null);
              setReviewed(false);
              setSelections([[], [], [], []]);
              mutation.clear();
            }}
          >
            {text[6]}
          </Button>
          <Button
            disabled={mutation.busy}
            onClick={() => {
              setPreview(null);
              setReviewed(false);
              mutation.clear();
            }}
          >
            {t("cancel")}
          </Button>
          <Button
            busy={mutation.busy}
            disabled={!reviewed}
            onClick={async () => {
              const completed = await mutation.run<CompleteExaminationResultV2>(
                `/api/v2/visits/${visit.id}/examination/complete`,
                { version: preview.visitVersion, previewId: preview.previewId },
              );
              if (completed) {
                setResult(completed);
                onChanged(completed);
              }
            }}
          >
            {text[7]}
          </Button>
        </section>
      ) : (
        <>
          {(["symptoms", "signs", "diagnoses", "templates"] as const).map(
            (kind, index) => (
              <Picker
                key={kind}
                kind={kind}
                title={text[index + 1]}
                selected={selections[index]}
                change={(items) => {
                  setSelections(
                    selections.map((s, i) => (i === index ? items : s)),
                  );
                  mutation.clear();
                }}
              />
            ),
          )}
          {selections.flat().some((x) => x.isDemo) && (
            <Notice>{text[9]}</Notice>
          )}
          <Button
            busy={mutation.busy}
            disabled={selections[2].length === 0 || selections[3].length !== 1}
            onClick={async () => {
              const value = await mutation.run<ExaminationPreviewV2>(
                `/api/v2/visits/${visit.id}/examination/preview`,
                {
                  version: visit.version,
                  symptomSelections: select(selections[0]),
                  signSelections: select(selections[1]),
                  diagnosisSelections: select(selections[2]),
                  template: select(selections[3])[0],
                },
              );
              if (value) {
                setPreview(value);
                setReviewed(false);
              }
            }}
          >
            {text[5]}
          </Button>
        </>
      )}
      <Feedback error={mutation.error} locale={locale} />
    </section>
  );
}
