export type Role =
  "Patient" | "Reception" | "Doctor" | "Service" | "Cashier" | "Admin";
export type Locale = "vi" | "en" | "zh" | "ko" | "ja" | "ru";
export type Session = {
  sessionId: string;
  patientId: string | null;
  role: Role;
  name: string;
  language: string;
  isGuest: boolean;
  expiresAt: string;
  token: string | null;
};
export type Entity = { id: string; version: number; createdAt: string };
export type Department = Entity & {
  code: string;
  name?: string;
  fallback?: boolean;
  nameVi: string;
  nameEn: string;
  active: boolean;
};
export type Location = Entity & {
  departmentId: string;
  name?: string;
  nameVi: string;
  nameEn: string;
  building: string;
  floor: string;
  room: string;
  active: boolean;
};
export type Destination = Pick<
  Location,
  "id" | "name" | "nameVi" | "nameEn" | "building" | "floor" | "room"
>;
export type HospitalService = Entity & {
  code: string;
  name?: string;
  nameVi: string;
  nameEn: string;
  departmentId: string;
  locationId: string;
  active: boolean;
  returnRequired: boolean;
};
export type Configuration = {
  catalogVersion?: string;
  name: string;
  demo: boolean;
  departments: Department[];
  locations: Location[];
  services: HospitalService[];
  guestHours: number;
  pollSeconds: number;
  emergency?: string;
  emergencyVi: string;
  emergencyEn: string;
  form: {
    nameMin: number;
    nameMax: number;
    contactMin: number;
    contactMax: number;
    descriptionMax: number;
  };
};
export type VisitSummary = Entity & {
  status: "Active" | "Closed";
  journeyStatus: "PendingActivation" | "Active" | "Completed";
  patientName: string;
  ticketNumber: string;
  closedAt: string | null;
  workRevision: number;
};
export type Step = Entity & {
  kind:
    | "Consultation"
    | "ReturnConsultation"
    | "Service"
    | "IntermediatePayment"
    | "Settlement"
    | "Pharmacy";
  status:
    "Waiting" | "Ready" | "InProgress" | "Completed" | "Skipped" | "Cancelled";
  authority: Role;
  doctorOrderId: string | null;
  mappingVersion: number;
  sequence: number;
  locationId: string;
  departmentId: string;
  destination: Destination;
  queueNumber: string;
  queueStatus: string;
  queueUpdatedAt: string;
  resolutionReason: string;
  completedAt: string | null;
  prerequisites: string[];
  text: string | null;
  contentKey?: string;
  contentLanguage: string | null;
  fallback: boolean;
  templateVersion: number | null;
  canProgress: boolean;
  canCompleteGuidance: boolean;
};
export type Order = Entity & {
  hospitalServiceId: string;
  status: string;
  note: string;
  mappingVersion: number;
};
export type Visit = VisitSummary & {
  doctorName?: string;
  departmentName?: string;
  departmentNameVi?: string;
  departmentNameEn?: string;
  doctorSpecialties?: string[];
  departmentId: string;
  doctorId: string;
  finalSettlementRevision: number | null;
  finalSettlementOutcome: string | null;
  journeyId: string;
  journeyVersion: number;
  completionSource: string | null;
  currentStepId: string | null;
  clinicallyReady: boolean;
  updatedAt: string;
  steps: Step[];
  orders: Order[];
};
export type Ticket = {
  doctorName?: string;
  departmentName?: string;
  departmentNameVi?: string;
  departmentNameEn?: string;
  id: string;
  number: string;
  visitId: string;
  journeyId: string;
  code: string;
  expiresAt: string;
};
export type ReceptionMessage = Entity & {
  contentKey?: string;
  templateId: string;
  text: string;
  language: string;
  response: string;
};
export type RequestSummary = Entity & {
  name: string;
  status: string;
  departmentId: string;
  appointmentId: string | null;
};
export type ReceptionRequest = RequestSummary & {
  contact: string;
  description: string;
  requests: string;
  messages: ReceptionMessage[];
  code: string;
  qrExpiresAt: string;
  visitId: string | null;
};
export type Profile = Entity & {
  name: string;
  contact: string;
  language: string;
};
export type Summary = {
  contentKey?: string;
  id: string;
  revision: number;
  language: string;
  fallback: boolean;
  diagnosis: string;
  explanation: string;
  instructions: string;
  authorName: string;
  publishedAt: string | null;
  documentReference: string;
  original: {
    language: string;
    diagnosis: string;
    explanation: string;
    instructions: string;
  };
};
export type Draft = Entity & {
  visitId: string;
  revision: number;
  status: string;
  language: string;
  diagnosis: string;
  explanation: string;
  instructions: string;
  documentReference: string;
  authorName: string;
  publishedAt: string | null;
};
export type FollowUp = Entity & {
  departmentId: string;
  recommendedAt: string;
  text: string;
  language: string;
  status: string;
};
export type Content = {
  summary: Summary | null;
  followUps: FollowUp[];
  bookingUrl: string | null;
};
export type Narration = {
  contentKey?: string;
  text: string;
  language: string;
  revision: number;
  provider: string;
  fallback?: boolean;
  cacheKey: string;
};
export type Directions = {
  destination: Destination;
  instructions: string | null;
  language: string | null;
  fallback: boolean;
  availableStarts: Location[];
};
export type Assistance = Entity & {
  patientId: string;
  visitId: string | null;
  registrationRequestId: string | null;
  journeyStepId: string | null;
  departmentId: string;
  category: string;
  description: string;
  status: string;
  resolution: string;
  escalated: boolean;
};
export type Notification = Entity & {
  visitId: string | null;
  key: string;
  read: boolean;
};
export type Booking = {
  reference: string;
  identityReference: string;
  scheduledAt: string;
  departmentCode: string;
  status: string;
};
export type Template = Entity & {
  key: string;
  language: string;
  revision: number;
  text: string;
  published: boolean;
  category: string;
};
export type MappingNode = {
  key: string;
  locationId: string;
  templateKey: string;
  authority: string;
  dependsOn: string[];
};
export type Mapping = Entity & {
  hospitalServiceId: string;
  revision: number;
  published: boolean;
  stepsJson: string;
};
export type Route = Entity & {
  fromLocationId: string;
  toLocationId: string;
  language: string;
  instructions: string;
  active: boolean;
};
export type Staff = Entity & {
  email: string;
  name: string;
  role: Role;
  active: boolean;
  departmentIds: string[];
  specialties?: string[];
  directoryOnly?: boolean;
};
export type StaffProfile = {
  id: string;
  name: string;
  role: Role;
  departments: Department[];
  specialties: string[];
  clinics: Location[];
};
export type AdminConfig = {
  departments: Department[];
  locations: Location[];
  services: HospitalService[];
  mappings: Mapping[];
  templates: Template[];
  routes: Route[];
  staff: Staff[];
};
export type ReceptionResources = {
  clinics?: { id: string; specialty: string }[];
  doctors: {
    id: string;
    name: string;
    departments: string[];
    specialties?: string[];
    clinicIds?: string[];
    directoryOnly?: boolean;
  }[];
  templates: Template[];
};
export type AdminDashboardData = {
  generatedAt: string;
  timeZone: string;
  days: number;
  summary: {
    visitsToday: number;
    closedToday: number;
    activeVisits: number;
    pendingRequests: number;
    openAssistance: number;
  };
  daily: { date: string; admitted: number; closed: number }[];
  departments: {
    id: string;
    name?: string;
    nameVi: string;
    nameEn: string;
    active: boolean;
    activeVisits: number;
    waitingSteps: number;
    inProgressSteps: number;
    openAssistance: number;
  }[];
  configuration: {
    activeDepartments: number;
    activeStaff: number;
    activeServices: number;
    servicesWithoutMapping: number;
  };
};
export type ApiProblem = {
  title: string;
  status: number;
  detail: string;
  errors?: Record<string, string>;
  traceId?: string;
};

// PB-001 target wire contracts. Existing DTOs above remain the legacy format.
// No endpoint or workflow is enabled by these types; see docs/architecture/API.md.
export type ExamStatus = "Waiting" | "InConsultation" | "InService" | "Completed";
export type LocaleV2 = "vi" | "en" | "zh" | "ja";
export type DoctorSnapshotV2 = { id: string; name: string };
export type ClinicSnapshotV2 = Destination & { departmentId: string };
export type TicketNumberV2 = {
  clinicLocationId: string;
  /** YYYY-MM-DD in Asia/Ho_Chi_Minh, fixed at reception. */
  issuedOn: string;
  sequenceNumber: number;
  /** Positive sequence padded to at least three digits; not a global ID. */
  number: string;
};
export type ExaminationTicketV2 = TicketNumberV2 & {
  id: string;
  visitId: string;
  journeyId: string;
  issuedAt: string;
  patientSnapshot: { name: string; contact: string };
  clinicSnapshot: ClinicSnapshotV2;
  doctorSnapshot: DoctorSnapshotV2;
};
export type ClinicAssignmentV2 = {
  clinicLocationId: string;
  version: number;
  doctorIds: string[];
  activeDoctor: DoctorSnapshotV2 | null;
  activeVisitCount: number;
  canChangeDoctor: boolean;
};
export type SetActiveDoctorInputV2 = { version: number; doctorId: string };
export type RegistrationRequestInputV2 = {
  contact: string;
  preferredDepartmentId: string | null;
  /** Store exactly as submitted, without trimming the original. */
  description: string;
  sourceLanguage: LocaleV2;
};
export type RegistrationRequestV2 = Entity & RegistrationRequestInputV2 & {
  contractVersion: "prd-v2";
  patientName: string;
  status: "Submitted" | "Confirmed" | "Withdrawn";
  /** Server-owned reception scope, independent of patient preference. */
  departmentId: string;
  visitId: string | null;
  canConfirm: boolean;
};
export type ConfirmReceptionInputV2 = {
  /** RegistrationRequest.version, not Visit.version. */
  version: number;
  clinicLocationId: string;
  clinicAssignmentVersion: number;
  attendeeVerified: boolean;
  verificationNote: string;
};
export type ConsultationCallV2 = {
  id: string;
  visitId: string;
  consultationNumber: number;
  occurredAt: string;
  contentRevision: number;
  ticket: TicketNumberV2;
  clinic: ClinicSnapshotV2;
  doctor: DoctorSnapshotV2;
};
export type JourneyStepV2 = Entity & {
  kind: "Consultation" | "ReturnConsultation" | "Service" | "Settlement";
  status: "Waiting" | "Ready" | "InProgress" | "Completed";
  sequence: number;
  consultationNumber: number | null;
  doctorOrderId: string | null;
  destination: ClinicSnapshotV2;
  completedAt: string | null;
};
export type DoctorOrderV2 = Entity & {
  hospitalServiceId: string;
  status: "NotCompleted" | "Completed";
  consultationNumber: number;
  note: string;
  serviceSnapshot: { code: string; nameVi: string; nameEn: string };
  destinationSnapshot: ClinicSnapshotV2;
  orderedBy: DoctorSnapshotV2;
  completedBy: { id: string; name: string } | null;
  completedAt: string | null;
};
/** Server-computed for the authenticated reader; never accepted as input. */
export type VisitCapabilitiesV2 = {
  canAcceptConsultation: boolean;
  canConfirmOrder: boolean;
  canCompleteService: boolean;
  canPreviewExamination: boolean;
  canCompleteExamination: boolean;
  canSettle: boolean;
  canViewResults: boolean;
};
export type FinalSettlementOutcomeV2 = "Final" | "NoPaymentRequired";
export type VisitSummaryV2 = Entity & {
  contractVersion: "prd-v2";
  status: "Active" | "Closed";
  journeyStatus: "Active" | "Completed";
  examStatus: ExamStatus;
  patientName: string;
  clinicLocationId: string;
  clinic: ClinicSnapshotV2;
  doctorId: string;
  doctor: DoctorSnapshotV2;
  ticket: TicketNumberV2;
  consultationCount: number;
  examinationCompletedAt: string | null;
  closedAt: string | null;
  workRevision: number;
};
export type VisitV2 = VisitSummaryV2 & {
  departmentId: string;
  journeyId: string;
  journeyVersion: number;
  updatedAt: string;
  finalSettlementRevision: number | null;
  finalSettlementOutcome: FinalSettlementOutcomeV2 | null;
  currentStepId: string | null;
  currentStep: JourneyStepV2 | null;
  latestConsultationCall: ConsultationCallV2 | null;
  capabilities: VisitCapabilitiesV2;
  steps: JourneyStepV2[];
  orders: DoctorOrderV2[];
};
export type ConfirmReceptionResultV2 = {
  request: RegistrationRequestV2;
  visit: VisitV2;
  ticket: ExaminationTicketV2;
};
/** Version of the whole Visit aggregate, not the step/order/Journey. */
export type VisitCommandInputV2 = { version: number };
export type AcceptConsultationInputV2 = VisitCommandInputV2;
export type ConfirmOrderInputV2 = VisitCommandInputV2 & { serviceId: string; note: string };
export type CompleteServiceInputV2 = VisitCommandInputV2 & { orderVersion: number };
export type CatalogSelectionV2 = { id: string; version: number };
export type PreviewExaminationInputV2 = VisitCommandInputV2 & {
  symptomSelections: CatalogSelectionV2[];
  signSelections: CatalogSelectionV2[];
  diagnosisSelections: CatalogSelectionV2[];
  template: CatalogSelectionV2;
};
export type ExaminationContentV2 = {
  language: "vi";
  diagnosis: string;
  explanation: string;
  instructions: string;
};
export type ExaminationPreviewV2 = {
  previewId: string;
  visitId: string;
  visitVersion: number;
  selections: PreviewExaminationInputV2;
  content: ExaminationContentV2;
};
export type CompleteExaminationInputV2 = VisitCommandInputV2 & { previewId: string };
export type ClinicalCatalogSnapshotV2 = CatalogSelectionV2 & { code: string; nameVi: string };
export type ClinicalRecordV2 = Entity & {
  visitId: string;
  symptoms: ClinicalCatalogSnapshotV2[];
  signs: ClinicalCatalogSnapshotV2[];
  diagnoses: ClinicalCatalogSnapshotV2[];
  template: CatalogSelectionV2;
  content: ExaminationContentV2;
  author: DoctorSnapshotV2;
  confirmedAt: string;
  publishedAt: string;
};
export type CompleteExaminationResultV2 = { visit: VisitV2; record: ClinicalRecordV2 };
export type FinalSettlementInputV2 = VisitCommandInputV2 & {
  workRevision: number;
  outcome: FinalSettlementOutcomeV2;
};
export type BusinessErrorCodeV2 =
  | "unauthorized" | "forbidden" | "notFound" | "validation"
  | "conflict" | "workRevisionConflict" | "idempotencyConflict"
  | "pendingRequestExists" | "activeVisitExists" | "requestNotPending"
  | "clinicUnavailable" | "doctorUnavailable" | "doctorNotInClinic"
  | "clinicAssignmentChanged" | "clinicHasActiveVisits" | "clinicBusy"
  | "visitNotActive" | "invalidExamStatus" | "unfinishedOrderExists"
  | "orderAlreadyCompleted" | "orderImmutable" | "previewStale"
  | "examinationNotCompleted" | "servicesNotCompleted"
  | "workflowNotEnabled" | "legacyCommandDisabled";
export type ApiProblemV2 = Omit<ApiProblem, "title"> & {
  /** Machine-readable code, consistent with legacy ApiProblem.title. */
  title: BusinessErrorCodeV2;
  /** Include only IDs the authenticated reader may access. */
  existingRequestId?: string;
  existingVisitId?: string;
  currentVersion?: number;
};
// Supporting contracts for PB-017/018/019 and PB-028/029.
export type DescriptionTranslationV2 = {
  original: string;
  sourceLanguage: string;
  targetLanguage: "vi";
  sourceVersion: number;
} & (
  | { status: "Translated"; translated: string; fallback: false }
  | { status: "NotRequired"; translated: null; fallback: false }
  | { status: "Unavailable"; translated: null; fallback: true }
);
export type PresenceHeartbeatV2 = { lastSeenAt: string; heartbeatSeconds: number; ttlSeconds: number };
export type OnlinePresenceV2 = {
  generatedAt: string;
  ttlSeconds: number;
  accounts: number;
  guests: number;
  total: number;
};
