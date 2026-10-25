import { localizedCopy } from "./localizedText.ts";
import type { ReceptionResources } from "./types";
export type DirectoryDepartment = {
  id: string;
  mapKey: string;
  code: string;
  nameVi: string;
  nameEn: string;
  name?: string;
  building: string | null;
  floors: string[];
  locationConfirmed: boolean;
};
export type Directory = {
  version: string;
  source: { fileName: string; period: string; sha256: string };
  departments: DirectoryDepartment[];
  specialties: { id: string; departmentId: string; name: string }[];
  clinics: {
    id: string;
    departmentId: string;
    specialtyId: string;
    name: string;
    room: string | null;
    building: string;
    floor: string;
    locationConfirmed: boolean;
  }[];
  clinicians: {
    id: string;
    name: string;
    departmentId: string;
    isDoctor: boolean;
    titles: string[];
    specialtyIds: string[];
    clinicIds: string[];
    sourceVariants: { text: string; sheet: string; cell: string }[];
    directoryOnly: boolean;
  }[];
  warnings: { kind: string; doctorIds: string[]; detail: string }[];
};
export const directoryText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
export function directoryResults(
  data: Directory,
  query: string,
  department = "",
  specialty = "",
) {
  const term = directoryText(query);
  return data.clinicians.filter(
    (d) =>
      (!department || d.departmentId === department) &&
      (!specialty || d.specialtyIds.includes(specialty)) &&
      directoryText(
        [
          d.name,
          data.departments.find((x) => x.id === d.departmentId)?.nameVi ?? "",
          data.departments.find((x) => x.id === d.departmentId)?.name ?? "",
          ...data.specialties
            .filter((s) => d.specialtyIds.includes(s.id))
            .map((s) => s.name),
          ...data.clinics
            .filter((c) => d.clinicIds.includes(c.id))
            .map((c) => c.name + " " + (c.room ?? "")),
        ].join(" "),
      ).includes(term),
  );
}
export function compatibleDoctors(
  doctors: ReceptionResources["doctors"],
  department: string,
  location: string,
) {
  return doctors.filter(
    (d) =>
      d.departments.includes(department) &&
      (!d.clinicIds?.length || d.clinicIds.includes(location)),
  );
}
const basedirectoryCopy = {
  vi: {
    title: "Khoa và bác sĩ",
    search: "Tìm bác sĩ, chuyên khoa hoặc phòng khám",
    all: "Tất cả khoa/phòng",
    specialty: "Chuyên khoa / nhóm phòng khám",
    allSpecialties: "Tất cả chuyên khoa",
    source:
      "Danh mục từ lịch tháng 08/2025; không phải lịch khám hiện tại. Chuyên khoa được nhóm theo tên phòng khám trong bảng nguồn.",
    unknown: "Cần xác nhận vị trí phòng khám",
    noDoctors: "Nguồn Excel chưa có bác sĩ phù hợp với lựa chọn này.",
    results: "hồ sơ theo khoa",
    more: "Xem thêm",
    clinician: "Chuyên viên (CN.)",
    doctor: "Bác sĩ",
    review: "Tên/danh xưng cần đối chiếu nguồn",
    provenance: "Đối chiếu ô nguồn",
    chooseDepartment: "Chọn khoa/phòng",
    noLocation: "Vị trí khoa cần xác nhận",
    notes: "Các mục cần xác nhận trong nguồn",
    room: "Phòng",
  },
  en: {
    title: "Departments and doctors",
    search: "Search doctor, specialty or clinic",
    all: "All departments",
    specialty: "Specialty / clinic group",
    allSpecialties: "All specialties",
    source:
      "Directory from the August 2025 roster, not a current appointment schedule. Specialties are grouped by clinic names in the source.",
    unknown: "Clinic location needs confirmation",
    noDoctors: "The source has no clinician matching this selection.",
    results: "department records",
    more: "Show more",
    clinician: "Practitioner (CN.)",
    doctor: "Doctor",
    review: "Name/title needs source review",
    provenance: "Source cells",
    chooseDepartment: "Choose a department",
    noLocation: "Department location needs confirmation",
    notes: "Source items requiring confirmation",
    room: "Room",
  },
};

export const directoryCopy = {
  ...basedirectoryCopy,
  zh: localizedCopy(basedirectoryCopy.vi, "zh"),
  ko: localizedCopy(basedirectoryCopy.vi, "ko"),
  ja: localizedCopy(basedirectoryCopy.vi, "ja"),
  ru: localizedCopy(basedirectoryCopy.vi, "ru"),
};
