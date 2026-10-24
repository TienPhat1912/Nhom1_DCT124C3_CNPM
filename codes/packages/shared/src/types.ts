export type Role =
  "Patient" | "Reception" | "Doctor" | "Service" | "Cashier" | "Admin";
export type Locale = "vi" | "en";
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
  nameVi: string;
  nameEn: string;
  active: boolean;
};
export type Location = Entity & {
  departmentId: string;
  nameVi: string;
  nameEn: string;
  building: string;
  floor: string;
  room: string;
  active: boolean;
};
export type Destination = Pick<
  Location,
  "id" | "nameVi" | "nameEn" | "building" | "floor" | "room"
>;
export type HospitalService = Entity & {
  code: string;
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
export type Translation = Entity & {
  summaryVersionId: string;
  language: string;
  diagnosis: string;
  explanation: string;
  instructions: string;
  approved: boolean;
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
  translations: Translation[];
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
