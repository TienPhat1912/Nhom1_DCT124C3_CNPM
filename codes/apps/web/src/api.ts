export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export function getGuestToken(): string | null {
  return localStorage.getItem('guestToken');
}

export function setGuestToken(token: string | null) {
  if (token) localStorage.setItem('guestToken', token);
  else localStorage.removeItem('guestToken');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(15000)
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('session-expired'));
    const errorMsg = data?.message || data?.error || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  verifyBookingAtDesk: (id:string,reference:string) => request(`/api/reception/requests/${id}/booking`,{method:'POST',body:JSON.stringify({reference,attendeeVerified:true})}),
  getBookingHandoff: (id:string) => request<{available:boolean;url?:string}>(`/api/patient/follow-up/${id}/booking`),
  saveProfile: (data: unknown) => request<any>('/api/patient/profile', {method:'PUT',body:JSON.stringify(data)}),
  getMyAssistance: () => request<any[]>('/api/patient/assistance'),
  // === Health ===
  getHealth: () => request<{ status: string }>('/health'),

  // === Auth & Sessions ===
  login: (data: any) => request<any>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: any) => request<any>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  createGuest: (language?: string) => request<any>('/api/auth/guest', { method: 'POST', body: JSON.stringify({ language }) }),
  convertGuest: (guestToken: string) => request<any>('/api/auth/convert-guest', { method: 'POST', body: JSON.stringify({ guestToken }) }),
  registerAndConvertGuest: (guestToken: string, register: any) => request<any>('/api/auth/register-convert-guest', { method: 'POST', body: JSON.stringify({ guestToken, register }) }),
  getMe: () => request<any>('/api/auth/me'),
  createContinuation: (returnTarget: string) => request<{continuationToken: string; returnTarget: string}>('/api/auth/guest-continuation', {method:'POST',body:JSON.stringify({returnTarget})}),
  linkAppointments: (externalAccount: string, password: string) => request('/api/appointments/link', {method:'POST',body:JSON.stringify({externalAccount,password})}),

  // === Appointments ===
  lookupAppointment: (id: string) => request<any>(`/api/appointments/${id}`),

  // === Registration ===
  createRegistration: (data: any) => request<any>('/api/registration/request', { method: 'POST', body: JSON.stringify(data) }),
  getRegistration: (id: string) => request<any>(`/api/registration/request/${id}`),
  getRegistrationByQr: (qr: string) => request<any>(`/api/registration/request/by-qr/${qr}`),
  askSupplement: (id: string, question: string) => request<any>(`/api/registration/request/${id}/supplement-question`, { method: 'POST', body: JSON.stringify({ question }) }),
  provideSupplement: (id: string, answer: string) => request<any>(`/api/registration/request/${id}/supplement-answer`, { method: 'POST', body: JSON.stringify({ answer }) }),

  // === Reception ===
  confirmReception: (data: any) => request<any>('/api/reception/confirm', { method: 'POST', body: JSON.stringify(data) }),
  reprintTicket: (visitId: string) => request<any>(`/api/reception/reprint/${visitId}`),
  reissueTicket: (visitId:string,guestSessionId?:string) => request<any>(`/api/reception/reissue/${visitId}`, {method:'POST',body:JSON.stringify({identityVerified:true,guestSessionId:guestSessionId||null})}),

  // === Journey ===
  redeemTicket: (qrToken: string) => request<any>('/api/journey/redeem-ticket', { method: 'POST', body: JSON.stringify({ qrToken }) }),
  getJourney: (visitId: string) => request<any>(`/api/journey/${visitId}`),
  completePharmacy: (visitId: string) => request<any>(`/api/journey/${visitId}/complete-pharmacy`, { method: 'POST' }),

  // === Doctor ===
  getDoctorVisits: () => request<any[]>('/api/doctor/visits'),
  getWorkspaceVisits: () => request<any[]>('/api/workspace/visits'),
  getPatientVisits: () => request<any[]>('/api/patient/visits'),
  getDoctorOrders: (visitId: string) => request<any[]>(`/api/doctor/orders/${visitId}`),
  changeOrder: (id: string, data: unknown) => request(`/api/doctor/orders/${id}`, { method:'PUT', body: JSON.stringify(data) }),
  createDoctorOrder: (data: any) => request<any>('/api/doctor/orders', { method: 'POST', body: JSON.stringify(data) }),
  saveDiagnosisDraft: (data: any) => request<any>('/api/doctor/diagnosis/draft', { method: 'POST', body: JSON.stringify(data) }),
  publishDiagnosis: (diagnosisId: string) => request<any>(`/api/doctor/diagnosis/publish/${diagnosisId}`, { method: 'POST' }),
  getDoctorDiagnosis: (visitId: string) => request<any>(`/api/doctor/diagnosis/${visitId}`),
  saveFollowUp: (data: any) => request<any>('/api/doctor/follow-up', { method: 'POST', body: JSON.stringify(data) }),
  getFollowUp: (visitId: string) => request<any>(`/api/patient/follow-up/${visitId}`),

  // === Service ===
  updateStepStatus: (stepId: string, status: number, reason?: string) => request<any>(`/api/services/step/${stepId}/status`, { method: 'POST', body: JSON.stringify({ status, reason }) }),

  // === Settlement ===
  recordSettlement: (data: any) => request<any>('/api/settlement/record', { method: 'POST', body: JSON.stringify(data) }),

  // === Patient Content & Audio ===
  getPatientDiagnosis: (visitId: string, lang = 'vi') => request<any>(`/api/content/diagnosis/${visitId}?lang=${lang}`),
  getNarration: (id: string, section: 'diagnosis' | 'care', lang: string) => request<any>(`/api/content/audio/${id}?section=${section}&lang=${lang}`),

  // === Assistance & Notifications ===
  createAssistance: (data: any) => request<any>('/api/assistance', { method: 'POST', body: JSON.stringify(data) }),
  getAssistance: () => request<any[]>('/api/assistance'),
  updateAssistance: (id: string, status: number, resolution?: string) => request<any>(`/api/assistance/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, resolution }) }),
  getNotifications: () => request<any[]>('/api/notifications'),

  // === Admin ===
  getDepartments: () => request<any[]>('/api/admin/departments'),
  getServices: () => request<any[]>('/api/admin/services'),
  getMappings: () => request<any[]>('/api/admin/mappings'),
  saveMapping: (data: any) => request<any>('/api/admin/mappings', { method: 'POST', body: JSON.stringify(data) }),
  getTemplates: () => request<any[]>('/api/admin/templates'),
  getConfiguration: (kind: string) => request<Record<string, string | number | boolean | null>[]>(`/api/admin/configuration/${kind}`),
  saveConfiguration: (kind: string, id: string, data: unknown) => kind === 'mappings' ? request('/api/admin/mappings', { method:'POST', body:JSON.stringify(data) }) : request(`/api/admin/${kind}/${id}`, { method:'PUT', body:JSON.stringify(data) }),
  getAdminVisits: () => request<any[]>('/api/admin/visits')
};
