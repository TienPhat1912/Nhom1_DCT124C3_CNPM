import departmentData from "../data/hospital-departments.json" with { type: "json" };
import type { Department, Locale } from "./types";

export type MapDepartment = {
  id: string;
  code: string;
  active?: boolean;
  building: string | null;
  floors: string[];
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
      nameVi: current?.nameVi ?? d.nameVi,
      nameEn: current?.nameEn ?? d.nameEn,
      active: current ? current.active : !authoritative,
    };
  });
}
export const floorLabel = (floor: string, locale: Locale) =>
  floor === "-1"
    ? locale === "vi"
      ? "Tầng hầm"
      : "Basement"
    : floor === "0"
      ? locale === "vi"
        ? "Tầng trệt"
        : "Ground floor"
      : `${locale === "vi" ? "Tầng" : "Floor"} ${floor}`;
export const departmentLabel = (d: MapDepartment, locale: Locale) =>
  locale === "vi" ? d.nameVi : d.nameEn;
export function departmentLocation(d: MapDepartment, locale: Locale) {
  const unknown = locale === "vi" ? "Cần xác nhận" : "Needs confirmation";
  return `${d.building ? (locale === "vi" ? "Khu " : "Building ") + d.building : unknown} · ${d.floors.length ? d.floors.map((f) => floorLabel(f, locale)).join(", ") : unknown}`;
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
