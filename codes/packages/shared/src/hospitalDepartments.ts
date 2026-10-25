import { localizeText } from "./localizedText.ts";
import departmentData from "../data/hospital-departments.json" with { type: "json" };
import type { Department, Locale } from "./types";

export type MapDepartment = {
  id: string;
  code: string;
  active?: boolean;
  building: string | null;
  floors: string[];
  name?: string;
  fallback?: boolean;
  nameVi: string;
  nameEn: string;
  marker: string;
};
// Transcribed from the user-supplied hospital directory. Empty floors and
// null building mean the source does not specify them; do not infer a route.
export const mapDepartments: MapDepartment[] = departmentData;
// Overlay administrator labels using stable codes; coordinates remain the source map.
export function configuredMapDepartments(
  departments: Department[],
  authoritative = false,
): MapDepartment[] {
  return mapDepartments.map((d) => {
    const current = departments.find((p) => p.code === d.code);
    return {
      ...d,
      name: current?.name,
      fallback: current?.fallback,
      nameVi: current?.nameVi ?? d.nameVi,
      nameEn: current?.nameEn ?? d.nameEn,
      active: current ? current.active : !authoritative,
    };
  });
}
export const floorLabel = (floor: string, locale: Locale) =>
  floor === "-1"
    ? localizeText("Tầng hầm", locale)
    : floor === "0"
      ? localizeText("Tầng trệt", locale)
      : `${localizeText("Tầng", locale)} ${floor}`;
export const departmentLabel = (d: MapDepartment, locale: Locale) =>
  locale === "vi" ? d.nameVi : (d.name ?? localizeText(d.nameVi, locale));
export function departmentLocation(d: MapDepartment, locale: Locale) {
  const unknown = localizeText("Cần xác nhận", locale);
  return `${d.building ? localizeText("Khu", locale) + " " + d.building : unknown} · ${d.floors.length ? d.floors.map((f) => floorLabel(f, locale)).join(", ") : unknown}`;
}
export const departmentNodeId = (id: string, floor: string) =>
  `department-${id}-${floor}`;
export const searchDepartments = (
  query: string,
  locale: Locale,
  departments = mapDepartments,
) => {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase();
  const term = normalize(query.trim());
  return departments.filter(
    (d) =>
      d.active !== false &&
      normalize(departmentLabel(d, locale) + " " + (d.building ?? "")).includes(
        term,
      ),
  );
};
