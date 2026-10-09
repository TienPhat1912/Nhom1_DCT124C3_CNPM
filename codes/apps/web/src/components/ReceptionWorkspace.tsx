import { getUiText, type UiTextKey } from "../../../../packages/i18n/src/ui";
import { QrScanner } from './QrScanner';
import { QRCodeSVG } from 'qrcode.react';
import React, { useState } from 'react';
import { api } from '../api';
import { useEffect } from 'react';
import { AssistanceInbox } from './AssistanceInbox';
import { getDictionary, Language } from '../../../../packages/i18n/src/index';

interface Props {
  lang: Language;
}

export const ReceptionWorkspace: React.FC<Props> = ({ lang }) => {
  const t = getDictionary(lang);
  const [qrInput, setQrInput] = useState('');
  const [requestData, setRequestData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supplement question
  const [question, setQuestion] = useState('Nhân viên tiếp nhận cần thêm thông tin. Vui lòng xem và trả lời.');
  const [questionSent, setQuestionSent] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const tr = (key: UiTextKey) => getUiText(lang, key);
  useEffect(()=>{ Promise.all([api.getTemplates(),api.getDepartments()]).then(([content,places])=>{setTemplates(content);setDepartments(places);}).catch(e=>setError(e.message)); },[]);

  // Confirmation state
  const [assignedDept, setAssignedDept] = useState('11111111-0001-0000-0000-000000000001'); // Cardiology
  const [requiresPharmacy, setRequiresPharmacy] = useState(true);
  const [issuedTicket, setIssuedTicket] = useState<any | null>(null);
  const [recoveryVisits,setRecoveryVisits]=useState<any[]>([]);
  const [recoveryVisit,setRecoveryVisit]=useState('');
  const [recoveryGuest,setRecoveryGuest]=useState('');
  const [verified,setVerified]=useState(false);
  const [bookingReference,setBookingReference]=useState('');
  const [bookingDetails,setBookingDetails]=useState<any>(null);
  const [bookingVerified,setBookingVerified]=useState(false);

  const handleLookupQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim()) return;
    setLoading(true);
    setError(null);
    setRequestData(null);
    setIssuedTicket(null);
    setQuestionSent(false);
    try {
      const data = await api.getRegistrationByQr(qrInput.trim());
      setRequestData(data);
      setBookingDetails(null);setBookingVerified(false);
    } catch (err: any) {
      setError(err.message || 'Không tìm thấy yêu cầu tiếp nhận');
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuestion = async () => {
    if (!requestData) return;
    try {
      await api.askSupplement(requestData.id, question);
      setQuestionSent(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmReception = async () => {
    if (!requestData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.confirmReception({
        registrationRequestId: requestData.id,
        departmentId: assignedDept,
        requiresPharmacy
      });
      setIssuedTicket(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" id="reception-workspace">
      <div className="card-header">
        <h2 className="card-title">📋 {t.staff.receptionTitle}</h2>
      </div>

      <QrScanner lang={lang} onCode={setQrInput} />
      <AssistanceInbox lang={lang}/>
      <details><summary>{tr("recover_access_reissue_ticket")}</summary>
        <button className="btn btn-outline" onClick={async()=>{try{setRecoveryVisits(await api.getWorkspaceVisits());}catch(e){setError((e as Error).message);}}}>{tr("find_desk_visits")}</button>
        <label htmlFor="recovery-visit">{tr("verified_visit")}</label><select id="recovery-visit" className="form-control" value={recoveryVisit} onChange={e=>{setRecoveryVisit(e.target.value);setVerified(false);}}><option value="">{tr("choose_visit")}</option>{recoveryVisits.map(v=><option key={v.visitId} value={v.visitId}>{v.patientName} · {v.ticketNumber}</option>)}</select>
        <label htmlFor="recovery-guest">{tr("new_guest_session_reference_if_replacing_access")}</label><input id="recovery-guest" className="form-control" value={recoveryGuest} onChange={e=>setRecoveryGuest(e.target.value)}/>
        <label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>{tr("i_verified_the_attendee_and_existing_visit_in_person")}</label>
        <button className="btn btn-outline" disabled={!verified||!recoveryVisit||loading} onClick={async()=>{setLoading(true);try{const issued=await api.reissueTicket(recoveryVisit,recoveryGuest);const printed=await api.reprintTicket(recoveryVisit);setIssuedTicket({...issued,visitId:issued.id,assignedDepartmentVi:printed.departmentVi,assignedDepartmentEn:printed.departmentEn});setVerified(false);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}}>{tr("reissue_code_for_existing_ticket")}</button>
      </details>
      {/* QR Lookup Form */}
      <form onSubmit={handleLookupQr} style={{ marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label className="form-label">{t.staff.scanReceptionQr}</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="reception-qr-input"
              type="text"
              className="form-control"
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              placeholder="REC_..."
              required
            />
            <button id="reception-lookup-btn" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '...' : tr("look_up")}
            </button>
          </div>
        </div>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Review Request & Action */}
      {requestData && !issuedTicket && (
        <div className="card" style={{ borderColor: 'var(--primary)' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>{tr("reception_patient_details")}</h3>
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <div>
              <p><strong>{t.auth.fullName}:</strong> {requestData.patient?.fullName}</p>
              <p><strong>{t.auth.phone}:</strong> {requestData.patient?.phoneNumber || 'N/A'}</p>
              <p><strong>{tr("source")}:</strong> {requestData.source === 0 ? tr("booked") : tr("walk_in")}</p>
            </div>
            <div>
              <p><strong>{tr("reason_for_visit")}:</strong> {requestData.conditionDescription}</p>
              {requestData.supplementInfo && (
                <div className="alert alert-info" style={{ marginTop: '0.5rem', padding: '0.5rem' }}>
                  <strong>{tr("patient_supplement")}:</strong> {requestData.supplementInfo}
                </div>
              )}
            </div>
          </div>

          {/* Ask Supplement */}
          <details><summary>{tr("check_a_supplied_booking_reference")}</summary>
            <label htmlFor="desk-booking-reference">{tr("booking_reference")}</label><input id="desk-booking-reference" className="form-control" value={bookingReference} onChange={e=>{setBookingReference(e.target.value);setBookingDetails(null);setBookingVerified(false);}}/>
            <button className="btn btn-outline" onClick={async()=>{try{setBookingDetails(await api.lookupAppointment(bookingReference));}catch(e){setError((e as Error).message);}}}>{tr("retrieve_booking")}</button>
            {bookingDetails&&<><p>{bookingDetails.patientName} · {bookingDetails.phoneNumber} · {bookingDetails.scheduledAt}</p><label><input type="checkbox" checked={bookingVerified} onChange={e=>setBookingVerified(e.target.checked)}/>{tr("booking_and_attendee_verified")}</label><button className="btn btn-outline" disabled={!bookingVerified||loading} onClick={async()=>{setLoading(true);try{await api.verifyBookingAtDesk(requestData.id,bookingReference);setRequestData(await api.getRegistration(requestData.id));setBookingDetails(null);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}}>{tr("attach_booking_to_this_request")}</button></>}
          </details>
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
            <label className="form-label">{tr("approved_supplement_question")}</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                className="form-control"
                value={question}
                onChange={e => setQuestion(e.target.value)}
              >{templates.map(item=><option key={item.id} value={item.contentVi}>{lang==='vi'?item.contentVi:item.contentEn}</option>)}</select>
              <button
                id="send-supplement-btn"
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleSendQuestion}
                disabled={questionSent}
              >
                {questionSent ? tr("sent") : tr("send_question")}
              </button>
            </div>
          </div>

          {/* Department Selection & Pharmacy requirement */}
          <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">{tr("initial_department")}</label>
              <select
                id="reception-dept-select"
                className="form-control"
                value={assignedDept}
                onChange={e => setAssignedDept(e.target.value)}
              >
                {departments.map(dept=><option key={dept.id} value={dept.id}>{lang==='vi'?dept.nameVi:dept.nameEn}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '1.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={requiresPharmacy}
                  onChange={e => setRequiresPharmacy(e.target.checked)}
                />
                <strong>{tr("pharmacy_guidance_required")}</strong>
              </label>
            </div>
          </div>

          <button
            id="reception-confirm-btn"
            type="button"
            className="btn btn-success btn-lg"
            onClick={handleConfirmReception}
            disabled={loading}
          >
            {loading ? '...' : `✓ ${t.staff.confirmTicket}`}
          </button>
        </div>
      )}

      {/* Issued Ticket Display */}
      {issuedTicket && (
        <div className="card" style={{ borderColor: 'var(--success)', backgroundColor: '#f0fdf4' }}>
          <div className="card-header">
            <h3 style={{ color: 'var(--success)' }}>🎟️ {t.staff.confirmTicket} ✓</h3>
            <span className="badge badge-ready">{tr("ticket_issued")}</span>
          </div>

          <div className="qr-box">
            <h4 style={{ fontSize: '1.5rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
              {tr("ticket_2")}: {issuedTicket.ticketNumber}
            </h4>
            <p><strong>{tr("department")}:</strong> {lang === 'vi' ? issuedTicket.assignedDepartmentVi : issuedTicket.assignedDepartmentEn}</p>
            <div className="qr-code-graphic" id="issued-ticket-qr">
              <QRCodeSVG value={window.location.origin + "/?ticket=" + issuedTicket.ticketQrToken} size={192} /><code>{issuedTicket.ticketQrToken}</code>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {tr("scan_the_ticket_with_the_owning_patient_session_to_resume_the_jou")}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              id="reprint-ticket-btn"
              className="btn btn-outline"
              onClick={async () => { try { await api.reprintTicket(issuedTicket.visitId); window.print(); } catch (e) { setError((e as Error).message); } }}
            >
              🖨️ {t.staff.reprintTicket}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setIssuedTicket(null);
                setRequestData(null);
                setQrInput('');
              }}
            >
              {tr("next_patient")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
