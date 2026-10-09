// Shared API Contracts and Domain Types

export type UserRole = 'Patient' | 'Receptionist' | 'Doctor' | 'ServiceStaff' | 'Cashier' | 'Administrator';

export type VisitStatus = 'Active' | 'Closed';

export type JourneyStatus = 'PendingActivation' | 'Active' | 'Completed';

export type StepStatus = 'Waiting' | 'Ready' | 'InProgress' | 'Completed' | 'Skipped' | 'Cancelled';

export type StepType = 'Consultation' | 'Laboratory' | 'Imaging' | 'ReturnConsultation' | 'Payment' | 'Pharmacy' | 'Other';

export type SettlementType = 'Intermediate' | 'Final' | 'NoPaymentRequired';

export type QrPurpose = 'HospitalEntry' | 'Reception' | 'ExaminationTicket';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  preferredLanguage: string;
  patientId?: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: UserDto;
  error?: string;
}

export interface GuestAuthResult {
  success: boolean;
  token?: string;
  guestToken?: string;
  guestSessionId?: string;
  error?: string;
}

export interface JourneyStepDto {
  id: string;
  stepType: number | StepType;
  status: number | StepStatus;
  sortOrder: number;
  destinationVi?: string;
  destinationEn?: string;
  instructionVi?: string;
  instructionEn?: string;
  queueTicket?: string;
  queueUpdatedAt?: string;
  statusReason?: string;
}

export interface JourneyResponseDto {
  visitId: string;
  visitStatus: number | VisitStatus;
  journeyId: string;
  journeyStatus: number | JourneyStatus;
  currentStep?: JourneyStepDto;
  nextActionVi: string;
  nextActionEn: string;
  destinationVi: string;
  destinationEn: string;
  waitOrProceed: 'Proceed' | 'Wait';
  queueTicket?: string;
  queueUpdatedAt?: string;
  allowedActions: string[];
  steps: JourneyStepDto[];
  requiresPharmacy: boolean;
  canCompletePharmacy: boolean;
}

export interface ReceptionConfirmationResponseDto {
  visitId: string;
  journeyId: string;
  ticketNumber: string;
  ticketQrToken: string;
  visitStatus: number | VisitStatus;
  journeyStatus: number | JourneyStatus;
  assignedDepartmentVi: string;
  assignedDepartmentEn: string;
  confirmedAt: string;
}

export interface DiagnosisSummaryDto {
  id: string;
  visitId: string;
  version: number;
  diagnosis?: string;
  explanation?: string;
  careInstructions?: string;
  language: string;
  isFallback: boolean;
  doctorName: string;
  publishedAt: string;
}

export interface FollowUpRecommendationDto {
  id: string;
  visitId: string;
  recommendationVi?: string;
  recommendationEn?: string;
  suggestedTimeframe?: string;
  isBookingConfirmed: boolean;
}

export interface VisitSummaryDto {
  visitId: string;
  ticketNumber: string;
  status: number | VisitStatus;
  patientName: string;
  departmentVi: string;
  departmentEn: string;
  doctorName?: string;
  totalSteps: number;
  completedSteps: number;
  createdAt: string;
}
