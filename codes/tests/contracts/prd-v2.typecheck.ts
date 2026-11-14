// Consumer contract checks only; backend race/permission tests belong to implementation tasks.
import type {
  AcceptConsultationInputV2, ConfirmOrderInputV2, CompleteServiceInputV2,
  CompleteExaminationInputV2, ConfirmReceptionInputV2, FinalSettlementInputV2,
  RegistrationRequestInputV2, VisitV2, ApiProblemV2, DescriptionTranslationV2,
  ExaminationTicketV2, ExaminationPreviewV2,
} from "../../packages/shared/src/types";

const clinic = {
  id: "clinic-1", departmentId: "department-1", nameVi: "Phòng 101", nameEn: "Room 101",
  building: "A", floor: "1", room: "101",
};
const doctor = { id: "doctor-1", name: "Bác sĩ mẫu" };
const now = "2026-11-11T02:00:00Z";
const step: VisitV2["steps"][number] = {
  id: "step-1", version: 1, createdAt: now, kind: "Consultation", status: "Ready",
  sequence: 1, consultationNumber: null, doctorOrderId: null,
  destination: clinic, completedAt: null,
};
export const request: RegistrationRequestInputV2 = {
  contact: "demo-contact", preferredDepartmentId: null,
  description: "  Mô tả nguyên văn\n", sourceLanguage: "vi",
};
export const confirm: ConfirmReceptionInputV2 = {
  version: 3, clinicLocationId: clinic.id, clinicAssignmentVersion: 2,
  attendeeVerified: true, verificationNote: "Đã đối chiếu trực tiếp",
};
export const waiting: VisitV2 = {
  contractVersion: "prd-v2", id: "visit-1", version: 1, createdAt: now,
  status: "Active", journeyStatus: "Active", examStatus: "Waiting",
  patientName: "Bệnh nhân mẫu", clinicLocationId: clinic.id, clinic,
  doctorId: doctor.id, doctor,
  ticket: { clinicLocationId: clinic.id, issuedOn: "2026-11-11", sequenceNumber: 1, number: "001" },
  consultationCount: 0, examinationCompletedAt: null, closedAt: null, workRevision: 1,
  departmentId: clinic.departmentId, journeyId: "journey-1", journeyVersion: 1, updatedAt: now,
  finalSettlementRevision: null, finalSettlementOutcome: null,
  currentStepId: step.id, currentStep: step, latestConsultationCall: null,
  capabilities: {
    canAcceptConsultation: true, canConfirmOrder: false, canCompleteService: false,
    canPreviewExamination: false, canCompleteExamination: false, canSettle: false, canViewResults: false,
  },
  steps: [step], orders: [],
};
export const ticket: ExaminationTicketV2 = {
  ...waiting.ticket, id: "ticket-1", visitId: waiting.id, journeyId: waiting.journeyId,
  issuedAt: now, patientSnapshot: { name: waiting.patientName, contact: request.contact },
  clinicSnapshot: clinic, doctorSnapshot: doctor,
};
export const accept: AcceptConsultationInputV2 = { version: 1 };
export const order: ConfirmOrderInputV2 = { version: 2, serviceId: "service-1", note: "", previewId: "preview-1" };
export const completeService: CompleteServiceInputV2 = { version: 3, orderVersion: 1 };
export const preview: ExaminationPreviewV2 = {
  previewId: "preview-1", visitId: waiting.id, visitVersion: 5,
  selections: {
    version: 5, symptomSelections: [], signSelections: [],
    diagnosisSelections: [{ id: "diagnosis-1", version: 1 }], template: { id: "template-1", version: 2 },
  },
  content: { language: "vi", diagnosis: "Mẫu kiểm thử", explanation: "Mẫu kiểm thử", instructions: "Mẫu kiểm thử" },
};
export const completeExam: CompleteExaminationInputV2 = { version: 5, previewId: preview.previewId };
export const final: FinalSettlementInputV2 = { version: 6, workRevision: 3, outcome: "Final" };
export const noPayment: FinalSettlementInputV2 = { ...final, outcome: "NoPaymentRequired" };
export const duplicate: ApiProblemV2 = {
  title: "activeVisitExists", status: 409, detail: "Đã có lượt khám", existingVisitId: waiting.id,
};
export const fallback: DescriptionTranslationV2 = {
  original: "Example", sourceLanguage: "en", targetLanguage: "vi", sourceVersion: 1,
  status: "Unavailable", translated: null, fallback: true,
};

// @ts-expect-error: Visit status is not examination status.
export const invalidExam: VisitV2["examStatus"] = "Active";
// @ts-expect-error: reception activates a v2 Journey immediately.
export const invalidJourney: VisitV2["journeyStatus"] = "PendingActivation";
// @ts-expect-error: confirmed services cannot be skipped.
export const invalidOrder: VisitV2["orders"][number]["status"] = "Skipped";
// @ts-expect-error: legacy data cannot silently become a v2 response.
export const missingDiscriminator: VisitV2 = { ...waiting, contractVersion: undefined };
// @ts-expect-error: reception cannot override the assigned doctor.
export const injectedDoctor: ConfirmReceptionInputV2 = { ...confirm, doctorId: "other" };
// @ts-expect-error: patient identity comes from the session.
export const injectedPatient: RegistrationRequestInputV2 = { ...request, patientId: "other" };
// @ts-expect-error: one service per command, never a parallel array.
export const multipleServices: ConfirmOrderInputV2 = { version: 2, serviceIds: ["a", "b"], note: "", previewId: "preview-1" };
// @ts-expect-error: Visit version is required.
export const unversionedOrder: ConfirmOrderInputV2 = { serviceId: "a", note: "", previewId: "preview-1" };
// @ts-expect-error: confirmation requires the reviewed configuration preview.
export const unreviewedOrder: ConfirmOrderInputV2 = { version: 2, serviceId: "a", note: "" };
// @ts-expect-error: service completion also checks the order version.
export const unversionedService: CompleteServiceInputV2 = { version: 3 };
// @ts-expect-error: state is a server-owned consequence.
export const injectedState: AcceptConsultationInputV2 = { version: 1, examStatus: "InConsultation" };
// @ts-expect-error: capabilities do not grant permissions.
export const injectedPermission: AcceptConsultationInputV2 = { version: 1, canAcceptConsultation: true };
// @ts-expect-error: author comes from the authenticated Doctor.
export const injectedAuthor: CompleteExaminationInputV2 = { ...completeExam, authorId: "other" };
// @ts-expect-error: published text comes from the server preview.
export const injectedContent: CompleteExaminationInputV2 = { ...completeExam, content: preview.content };
// @ts-expect-error: intermediate payment cannot close a Visit.
export const intermediate: FinalSettlementInputV2 = { ...final, outcome: "Intermediate" };
// @ts-expect-error: settlement requires the work revision too.
export const noRevision: FinalSettlementInputV2 = { version: 6, outcome: "Final" };
// @ts-expect-error: failed translation must not masquerade as successful translation.
export const fakeTranslation: DescriptionTranslationV2 = { ...fallback, status: "Translated" };
