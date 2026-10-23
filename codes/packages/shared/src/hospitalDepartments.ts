import type { Locale } from "./types";

export type MapDepartment = {
  id: string;
  building: string | null;
  floors: string[];
  nameVi: string;
  nameEn: string;
  marker: string;
};
// Transcribed from the user-supplied hospital directory. Empty floors and
// null building mean the source does not specify them; do not infer a route.
export const mapDepartments: MapDepartment[] = [
  {
    id: "C-pharmacy",
    building: "C",
    floors: ["-1"],
    nameVi: "Khoa Dược",
    nameEn: "Pharmacy Department",
    marker: "1",
  },
  {
    id: "C-intensive-care",
    building: "C",
    floors: ["0"],
    nameVi: "Khoa Hồi sức tích cực chống độc",
    nameEn: "Intensive Care Department",
    marker: "2",
  },
  {
    id: "C-neonatal",
    building: "C",
    floors: ["0"],
    nameVi: "Khoa Hồi sức tích cực Nhi – Sơ sinh",
    nameEn: "Neonatal Pediatric Intensive Care Department",
    marker: "3",
  },
  {
    id: "C-plastic-surgery",
    building: "C",
    floors: ["0"],
    nameVi: "Khoa Phẫu thuật tạo hình thẩm mỹ",
    nameEn: "Plastic and Cosmetic Surgery Department",
    marker: "4",
  },
  {
    id: "C-obstetrics",
    building: "C",
    floors: ["1"],
    nameVi: "Khoa Sản C",
    nameEn: "Obstetrics and Gynaecology C Department",
    marker: "5",
  },
  {
    id: "C-thoracic",
    building: "C",
    floors: ["1"],
    nameVi: "Khoa Ngoại lồng ngực mạch máu",
    nameEn: "Thoracic and Vascular Surgery Department",
    marker: "6",
  },
  {
    id: "C-ophthalmology",
    building: "C",
    floors: ["1"],
    nameVi: "Khoa Mắt",
    nameEn: "Ophthalmology Department",
    marker: "7",
  },
  {
    id: "C-cardiac-surgery",
    building: "C",
    floors: ["2"],
    nameVi: "Khu Phẫu thuật tim",
    nameEn: "Cardiovascular Surgery Area",
    marker: "8",
  },
  {
    id: "C-cardiac-intensive",
    building: "C",
    floors: ["3"],
    nameVi: "Khoa Hồi sức tim mạch",
    nameEn: "Cardiac Intensive Care Department",
    marker: "9",
  },
  {
    id: "C-isolation",
    building: "C",
    floors: ["3"],
    nameVi: "Khu Cách ly",
    nameEn: "Isolation Area",
    marker: "10",
  },
  {
    id: "C-neurosurgery",
    building: "C",
    floors: ["4"],
    nameVi: "Khoa Ngoại thần kinh",
    nameEn: "Neurosurgery Department",
    marker: "11",
  },
  {
    id: "C-urology",
    building: "C",
    floors: ["4"],
    nameVi: "Khoa Tiết niệu – Nam khoa",
    nameEn: "Urology and Andrology Department",
    marker: "12",
  },
  {
    id: "C-ent",
    building: "C",
    floors: ["5"],
    nameVi: "Khoa Tai Mũi Họng",
    nameEn: "Otolaryngology Department",
    marker: "13",
  },
  {
    id: "C-endocrinology",
    building: "C",
    floors: ["5"],
    nameVi: "Khoa Nội tiết",
    nameEn: "Endocrinology Department",
    marker: "14",
  },
  {
    id: "C-dental",
    building: "C",
    floors: ["5"],
    nameVi: "Khoa Răng Hàm Mặt",
    nameEn: "Dental Department",
    marker: "15",
  },
  {
    id: "C-orthopaedics",
    building: "C",
    floors: ["6"],
    nameVi: "Khoa Ngoại chấn thương chỉnh hình",
    nameEn: "Traumatology and Orthopaedics Department",
    marker: "16",
  },
  {
    id: "C-psychiatry",
    building: "C",
    floors: ["7"],
    nameVi: "Khoa Tâm thể",
    nameEn: "Psychiatry Department",
    marker: "17",
  },
  {
    id: "C-it",
    building: "C",
    floors: ["7"],
    nameVi: "Phòng Công nghệ thông tin",
    nameEn: "Information Technology Department",
    marker: "18",
  },
  {
    id: "C-hall",
    building: "C",
    floors: ["7"],
    nameVi: "Hội trường",
    nameEn: "Hall",
    marker: "19",
  },
  {
    id: "D-obstetrics",
    building: "D",
    floors: ["0"],
    nameVi: "Khoa Sản B",
    nameEn: "Obstetrics and Gynaecology B Department",
    marker: "1",
  },
  {
    id: "D-infection-control",
    building: "D",
    floors: ["0"],
    nameVi: "Khoa Kiểm soát nhiễm khuẩn",
    nameEn: "Infection Control Department",
    marker: "2",
  },
  {
    id: "D-microbiology",
    building: "D",
    floors: ["0"],
    nameVi: "Khoa Vi sinh",
    nameEn: "Microbiology Department",
    marker: "3",
  },
  {
    id: "D-anaesthesiology",
    building: "D",
    floors: ["1"],
    nameVi: "Khoa Gây mê hồi sức",
    nameEn: "Anaesthesiology Department",
    marker: "4",
  },
  {
    id: "D-paediatrics",
    building: "D",
    floors: ["2"],
    nameVi: "Khoa Nhi",
    nameEn: "Paediatrics Department",
    marker: "5",
  },
  {
    id: "D-administration",
    building: "D",
    floors: ["2"],
    nameVi: "Khu Hành chính",
    nameEn: "Administrative Area",
    marker: "6",
  },
  {
    id: "D-general-surgery",
    building: "D",
    floors: ["3"],
    nameVi: "Khoa Ngoại tổng hợp",
    nameEn: "General Surgery Department",
    marker: "7",
  },
  {
    id: "D-oncology",
    building: "D",
    floors: ["3"],
    nameVi: "Khoa Ung bướu",
    nameEn: "Oncology Department",
    marker: "8",
  },
  {
    id: "F-traditional",
    building: "F",
    floors: [],
    nameVi: "Khoa Y học cổ truyền",
    nameEn: "Traditional Medicine Department",
    marker: "1",
  },
  {
    id: "G-meeting",
    building: "G",
    floors: ["-1"],
    nameVi: "Hội trường",
    nameEn: "Meeting Room",
    marker: "1",
  },
  {
    id: "G-nephrology",
    building: "G",
    floors: ["0", "1"],
    nameVi: "Khoa Nội thận – Thận nhân tạo",
    nameEn: "Nephrology and Dialysis Department",
    marker: "2",
  },
  {
    id: "G-cardiology",
    building: "G",
    floors: ["2", "3"],
    nameVi: "Khoa Nội tim mạch – Lão học",
    nameEn: "Cardiology and Gerontology Department",
    marker: "3",
  },
  {
    id: "unlocated-reception",
    building: null,
    floors: [],
    nameVi: "Phòng Tiếp công dân",
    nameEn: "Public Reception Room",
    marker: "1",
  },
  {
    id: "unlocated-dermatology",
    building: null,
    floors: [],
    nameVi: "Khoa Da liễu",
    nameEn: "Dermatology Department",
    marker: "2",
  },
  {
    id: "unlocated-rehabilitation",
    building: null,
    floors: [],
    nameVi: "Khoa Vật lý trị liệu – Phục hồi chức năng",
    nameEn: "Physiotherapy and Rehabilitation Department",
    marker: "3",
  },
  {
    id: "A-insurance",
    building: "A",
    floors: ["0"],
    nameVi: "Khu khám Bảo hiểm y tế",
    nameEn: "Health Insurance Outpatients Clinic",
    marker: "1",
  },
  {
    id: "A-premium",
    building: "A",
    floors: ["0"],
    nameVi: "Khu khám chữa bệnh chất lượng cao",
    nameEn: "Premium Service Outpatients Clinic",
    marker: "2",
  },
  {
    id: "A-emergency",
    building: "A",
    floors: ["0"],
    nameVi: "Khoa Cấp cứu",
    nameEn: "Emergency Department",
    marker: "3",
  },
  {
    id: "A-outpatients",
    building: "A",
    floors: ["0"],
    nameVi: "Khoa Khám bệnh",
    nameEn: "Outpatients Department",
    marker: "4",
  },
  {
    id: "A-services",
    building: "A",
    floors: ["0"],
    nameVi: "Khoa Dịch vụ",
    nameEn: "Services Department",
    marker: "5",
  },
  {
    id: "A-nutrition",
    building: "A",
    floors: ["1"],
    nameVi: "Khoa Dinh dưỡng",
    nameEn: "Nutrition Department",
    marker: "6",
  },
  {
    id: "B-imaging",
    building: "B",
    floors: ["0"],
    nameVi: "Khoa Chẩn đoán hình ảnh",
    nameEn: "Diagnostic Imaging Department",
    marker: "1",
  },
  {
    id: "B-functional",
    building: "B",
    floors: ["0"],
    nameVi: "Khoa Thăm dò chức năng",
    nameEn: "Functional Exploration Department",
    marker: "2",
  },
  {
    id: "B-haematology",
    building: "B",
    floors: ["0"],
    nameVi: "Khoa Huyết học – Truyền máu",
    nameEn: "Haematology and Blood Transfusion Department",
    marker: "3",
  },
  {
    id: "B-biochemistry",
    building: "B",
    floors: ["0"],
    nameVi: "Khoa Hóa sinh – Miễn dịch",
    nameEn: "Biochemistry and Immunology Department",
    marker: "4",
  },
  {
    id: "B-internal",
    building: "B",
    floors: ["1", "2"],
    nameVi: "Khoa Nội tổng hợp",
    nameEn: "Internal Medicine Department",
    marker: "5",
  },
  {
    id: "E-premium",
    building: "E",
    floors: [],
    nameVi: "Khám chữa bệnh chất lượng cao",
    nameEn: "Premium Service Outpatients Clinic",
    marker: "1",
  },
  {
    id: "E-pathology",
    building: "E",
    floors: [],
    nameVi: "Khoa Giải phẫu bệnh",
    nameEn: "Anatomical Pathology Department",
    marker: "2",
  },
];
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
export const searchDepartments = (query: string, locale: Locale) => {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase();
  const term = normalize(query.trim());
  return mapDepartments.filter((d) =>
    normalize(departmentLabel(d, locale) + " " + (d.building ?? "")).includes(
      term,
    ),
  );
};
