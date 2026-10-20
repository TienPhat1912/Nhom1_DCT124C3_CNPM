// JSON enum values follow services/api/Models/Enums.cs.
export type Language = 'vi' | 'en';
export interface PatientSession { token: string; guestToken?: string; guestSessionId?: string; user?: { id: string; fullName: string; role: string; patientId?: string; phoneNumber?:string } }
export interface JourneyStep { id: string; stepType: number; status: number; destinationVi?: string; destinationEn?: string; instructionVi?: string; instructionEn?: string }
export interface PatientJourney { visitId: string; visitStatus: number; journeyId: string; journeyStatus: number; nextActionVi: string; nextActionEn: string; destinationVi: string; destinationEn: string; waitOrProceed: string; queueTicket?: string; queueUpdatedAt?: string; canCompletePharmacy: boolean; steps: JourneyStep[] }
export interface Registration { requestId?: string; id?: string; receptionQrToken: string; status: number; staffQuestion?: string }
export interface PublishedContent { id: string; version: number; diagnosis: string; explanation?: string; careInstructions: string; doctorName: string; publishedAt: string; language: string; isFallback: boolean }
export interface VisitHistory { visitId: string; ticketNumber: string; departmentVi: string; departmentEn: string; journeyStatus: number; createdAt: string }
export interface NarrationText { text: string; language: string; version: number; audioAvailable: boolean }
