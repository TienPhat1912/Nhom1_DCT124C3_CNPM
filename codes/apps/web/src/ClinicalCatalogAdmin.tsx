import { useState } from "react";
import type {
  ClinicalCatalogEntryV2,
  ClinicalCatalogKindV2,
  ClinicalCatalogPageV2,
  ClinicalTemplateV2,
  Locale,
} from "@hospital/shared";
import {
  Button,
  Empty,
  Feedback,
  Field,
  Form,
  Notice,
  ResourceState,
  SectionTitle,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";

type Labels = {
  title: string;
  symptoms: string;
  signs: string;
  diagnoses: string;
  templates: string;
  demo: string;
  help: string;
  search: string;
  inactive: string;
};
export const clinicalCatalogLabels: Record<Locale, Labels> = {
  vi: {
    title: "Danh mục lâm sàng",
    symptoms: "Triệu chứng",
    signs: "Dấu hiệu",
    diagnoses: "Chẩn đoán",
    templates: "Mẫu kết quả Việt",
    demo: "Dữ liệu minh họa, chưa được bệnh viện phê duyệt. Không sử dụng làm danh mục hoặc hướng dẫn lâm sàng chính thức.",
    help: "Nguồn tiếng Việt. Chỉ dùng {{symptoms}}, {{signs}}, {{diagnoses}} để chèn lựa chọn của bác sĩ. Phần chẩn đoán phải có {{diagnoses}}; không tự suy ra chẩn đoán từ triệu chứng.",
    search: "Tìm theo mã hoặc tên",
    inactive: "Ngừng dùng",
  },
  en: {
    title: "Clinical catalog",
    symptoms: "Symptoms",
    signs: "Signs",
    diagnoses: "Diagnoses",
    templates: "Vietnamese result templates",
    demo: "Demo data has not been approved by the hospital. Do not use it as an official clinical catalog or care guidance.",
    help: "Vietnamese source. Use only {{symptoms}}, {{signs}}, {{diagnoses}} for the doctor's selections. Diagnosis must include {{diagnoses}}. No diagnosis is inferred from symptoms.",
    search: "Search by code or name",
    inactive: "Inactive",
  },
  zh: {
    title: "临床目录",
    symptoms: "症状",
    signs: "体征",
    diagnoses: "诊断",
    templates: "越南语结果模板",
    demo: "演示数据未经医院批准，不可作为正式临床目录或护理指导。",
    help: "越南语原文。仅支持 {{symptoms}}、{{signs}}、{{diagnoses}} 插入医生的选择。诊断须含 {{diagnoses}}，不根据症状推断诊断。",
    search: "按代码或名称搜索",
    inactive: "停用",
  },
  ja: {
    title: "臨床カタログ",
    symptoms: "症状",
    signs: "所見",
    diagnoses: "診断",
    templates: "ベトナム語結果テンプレート",
    demo: "デモデータは病院未承認です。正式な臨床カタログやケア指導には使用しないでください。",
    help: "原文はベトナム語。医師の選択には {{symptoms}}、{{signs}}、{{diagnoses}} のみ使用できます。診断には {{diagnoses}} が必須です。症状から診断を推測しません。",
    search: "コードまたは名前で検索",
    inactive: "使用停止",
  },
  ko: {
    title: "임상 목록",
    symptoms: "증상",
    signs: "징후",
    diagnoses: "진단",
    templates: "베트남어 결과 서식",
    demo: "병원에서 승인하지 않은 데모 데이터입니다. 공식 임상 목록이나 관리 지침으로 사용하지 마세요.",
    help: "베트남어 원문입니다. 의사가 선택한 항목에 {{symptoms}}, {{signs}}, {{diagnoses}}만 사용할 수 있습니다. 진단에는 {{diagnoses}}가 필수입니다. 증상으로 진단을 추론하지 않습니다.",
    search: "코드 또는 이름 검색",
    inactive: "사용 중지",
  },
  ru: {
    title: "Клинический справочник",
    symptoms: "Симптомы",
    signs: "Признаки",
    diagnoses: "Диагнозы",
    templates: "Шаблоны на вьетнамском",
    demo: "Демонстрационные данные не утверждены больницей. Не используйте их как официальный справочник или рекомендации по уходу.",
    help: "Вьетнамский оригинал. Для выбора врача допустимы только {{symptoms}}, {{signs}}, {{diagnoses}}. Диагноз должен содержать {{diagnoses}}. Диагноз не выводится из симптомов.",
    search: "Поиск по коду или названию",
    inactive: "Не используется",
  },
};
type Entry = ClinicalCatalogEntryV2 | ClinicalTemplateV2;
export default function ClinicalCatalogAdmin() {
  const { locale, t } = useRuntime();
  const text = clinicalCatalogLabels[locale];
  const [kind, setKind] = useState<ClinicalCatalogKindV2>("symptoms");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const resource = useResource<ClinicalCatalogPageV2>(
    `/api/v2/admin/clinical-catalog/${kind}?search=${encodeURIComponent(search)}&offset=${offset}`,
  );
  const entry = resource.data?.items.find((item) => item.id === selected);
  const clear = () => {
    setSelected(null);
    setCreating(false);
  };
  return (
    <section data-testid="clinical-catalog">
      <SectionTitle title={text.title} />
      <nav className="tabs" aria-label={text.title}>
        {(["symptoms", "signs", "diagnoses", "templates"] as const).map(
          (value) => (
            <button
              type="button"
              key={value}
              className={kind === value ? "selected" : ""}
              aria-current={kind === value ? "page" : undefined}
              onClick={() => {
                setKind(value);
                setSearch("");
                setOffset(0);
                clear();
              }}
            >
              {text[value]}
            </button>
          ),
        )}
      </nav>
      <ResourceState resource={resource} />
      <div className="split-layout">
        <aside className="panel">
          <div className="actions">
            <Button
              onClick={() => {
                setSelected(null);
                setCreating(true);
              }}
            >
              {t("create")}
            </Button>
            <Button variant="secondary" onClick={resource.refresh}>
              {t("refresh")}
            </Button>
          </div>
          <Field label={text.search}>
            <input
              type="search"
              maxLength={100}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
                clear();
              }}
            />
          </Field>
          {resource.data?.items.length === 0 && <Empty text={t("empty")} />}
          {resource.data?.items.map((item) => (
            <button
              type="button"
              className={`record-row ${selected === item.id ? "selected" : ""}`}
              key={item.id}
              onClick={() => {
                setSelected(item.id);
                setCreating(false);
              }}
            >
              <span>
                <strong>{item.nameVi}</strong>
                <small>
                  {item.code} · {t("revision")} {item.version} ·{" "}
                  {item.active ? t("enabled") : text.inactive}
                  {item.isDemo ? " · DEMO" : ""}
                </small>
              </span>
              <span>{t("edit")}</span>
            </button>
          ))}
          <div className="actions">
            <Button
              disabled={offset === 0 || resource.loading}
              onClick={() => {
                setOffset(Math.max(0, offset - 100));
                clear();
              }}
            >
              {t("previousPage")}
            </Button>
            <Button
              disabled={!resource.data?.hasMore || resource.loading}
              onClick={() => {
                setOffset(offset + 100);
                clear();
              }}
            >
              {t("nextPage")}
            </Button>
          </div>
        </aside>
        <div className="panel">
          {creating || entry ? (
            <CatalogEditor
              key={`${kind}:${entry?.id ?? "new"}:${entry?.version}`}
              kind={kind}
              entry={entry}
              onSaved={() => {
                clear();
                resource.refresh();
              }}
              onCancel={clear}
              onRefresh={resource.refresh}
            />
          ) : (
            <Empty text={t("noSelection")} />
          )}
        </div>
      </div>
    </section>
  );
}
function CatalogEditor({
  kind,
  entry,
  onSaved,
  onCancel,
  onRefresh,
}: {
  kind: ClinicalCatalogKindV2;
  entry?: Entry;
  onSaved: () => void;
  onCancel: () => void;
  onRefresh: () => void;
}) {
  const { locale, t } = useRuntime();
  const text = clinicalCatalogLabels[locale];
  const mutation = useMutation();
  const [code, setCode] = useState(entry?.code ?? "");
  const [name, setName] = useState(entry?.nameVi ?? "");
  const [active, setActive] = useState(entry?.active ?? false);
  const template = entry && "diagnosisTemplate" in entry ? entry : null;
  const [diagnosis, setDiagnosis] = useState(
    template?.diagnosisTemplate ?? "{{diagnoses}}",
  );
  const [explanation, setExplanation] = useState(
    template?.explanationTemplate ?? "",
  );
  const [instructions, setInstructions] = useState(
    template?.instructionsTemplate ?? "",
  );
  return (
    <div data-testid="clinical-catalog-editor">
      <SectionTitle
        title={`${entry ? t("edit") : t("create")} · ${text[kind]}`}
      />
      {entry?.isDemo && <Notice>{text.demo}</Notice>}
      <Form
        busy={mutation.busy}
        onSubmit={async () => {
          const body = {
            version: entry?.version ?? 0,
            code,
            nameVi: name,
            active,
            ...(kind === "templates"
              ? {
                  language: "vi",
                  diagnosisTemplate: diagnosis,
                  explanationTemplate: explanation,
                  instructionsTemplate: instructions,
                }
              : {}),
          };
          const result = await mutation.run(
            `/api/v2/admin/clinical-catalog/${kind}${entry ? `/${entry.id}` : ""}`,
            body,
            entry ? "PUT" : "POST",
          );
          if (result) onSaved();
        }}
      >
        <Field label={t("code")}>
          <input
            required
            readOnly={!!entry}
            minLength={2}
            maxLength={40}
            pattern="[A-Za-z][A-Za-z0-9_-]{1,39}"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <Field label={t("nameVi")}>
          <input
            required
            minLength={2}
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <label className="check-field">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          {t("enabled")}
        </label>
        {kind === "templates" && (
          <>
            <Notice>{text.help}</Notice>
            <Field label={`${t("diagnosis")} (vi)`}>
              <textarea
                required
                maxLength={4000}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </Field>
            <Field label={`${t("explanation")} (vi)`}>
              <textarea
                maxLength={4000}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </Field>
            <Field label={`${t("instructions")} (vi)`}>
              <textarea
                required
                maxLength={6000}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </Field>
          </>
        )}
        <Feedback error={mutation.error} locale={locale} />
        <div className="actions">
          <Button type="submit" busy={mutation.busy}>
            {t("save")}
          </Button>
          <Button type="button" variant="quiet" onClick={onCancel}>
            {t("cancel")}
          </Button>
        </div>
      </Form>
      {!!mutation.error && (
        <Button variant="secondary" onClick={onRefresh}>
          {t("refresh")}
        </Button>
      )}
    </div>
  );
}
