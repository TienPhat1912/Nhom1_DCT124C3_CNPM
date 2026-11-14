import type { Locale } from "./types";

/** Confirmed catalog snapshots remain Vietnamese source, separate from translated prose. */
export const patientResultLabels: Record<
  Locale,
  {
    title: string;
    symptoms: string;
    signs: string;
    diagnoses: string;
    confirmedAt: string;
  }
> = {
  vi: {
    title: "Kết quả đã xác nhận — bản gốc Việt",
    symptoms: "Triệu chứng",
    signs: "Dấu hiệu",
    diagnoses: "Chẩn đoán",
    confirmedAt: "Xác nhận lúc",
  },
  en: {
    title: "Confirmed results — Vietnamese original",
    symptoms: "Symptoms",
    signs: "Signs",
    diagnoses: "Diagnoses",
    confirmedAt: "Confirmed at",
  },
  zh: {
    title: "已确认结果 — 越南语原文",
    symptoms: "症状",
    signs: "体征",
    diagnoses: "诊断",
    confirmedAt: "确认时间",
  },
  ja: {
    title: "確認済みの結果 — ベトナム語原文",
    symptoms: "症状",
    signs: "所見",
    diagnoses: "診断",
    confirmedAt: "確認日時",
  },
  ko: {
    title: "확인된 결과 — 베트남어 원문",
    symptoms: "증상",
    signs: "징후",
    diagnoses: "진단",
    confirmedAt: "확인 시간",
  },
  ru: {
    title: "Подтверждённые результаты — оригинал на вьетнамском",
    symptoms: "Симптомы",
    signs: "Признаки",
    diagnoses: "Диагнозы",
    confirmedAt: "Подтверждено",
  },
};
