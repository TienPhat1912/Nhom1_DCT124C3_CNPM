import { getUiText, getUiTextList } from "../../../../packages/i18n/src/ui";
import { QRCodeSVG } from 'qrcode.react';
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { getDictionary, Language } from '../../../../packages/i18n/src/index';

interface Props {
  lang: Language;
  currentUser?:any;
  onReceptionRequestCreated: (req: any) => void;
}

export const ReceptionPrep: React.FC<Props> = ({ lang, currentUser, onReceptionRequestCreated }) => {
  const t = getDictionary(lang);
  const [tab, setTab] = useState<'appointment' | 'walkin'>('walkin');

  // Appointment lookup state
  const [aptId, setAptId] = useState('APT-2026-001234');
  const [aptData, setAptData] = useState<any | null>(null);
  const [aptLoading, setAptLoading] = useState(false);
  const [aptError, setAptError] = useState<string | null>(null);

  // Walk-in form state
  const [fullName, setFullName] = useState(currentUser?.isGuest ? '' : currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phoneNumber || '');
  const [condition, setCondition] = useState('');
  const [departmentId, setDepartmentId] = useState('11111111-0001-0000-0000-000000000001'); // Cardiology
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Created request
  const [activeRequest, setActiveRequest] = useState<any | null>(null);
  const [supplementAnswer, setSupplementAnswer] = useState('');
  const [supplementSuccess, setSupplementSuccess] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem('registration:' + (localStorage.getItem('guestToken') || localStorage.getItem('token')));
    if (!id) return;
    let live = true;
    const refresh = () => api.getRegistration(id).then(r => { if (live) setActiveRequest({ ...r, requestId: r.id }); }).catch(e => { if (live) setSubmitError(e.message); });
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => { live = false; clearInterval(interval); };
  }, []);
  useEffect(() => {
    if (activeRequest?.requestId) localStorage.setItem('registration:' + (localStorage.getItem('guestToken') || localStorage.getItem('token')), activeRequest.requestId);
  }, [activeRequest?.requestId]);

  const handleLookupAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAptLoading(true);
    setAptError(null);
    try {
      const data = await api.lookupAppointment(aptId);
      setAptData(data);
    } catch (err: any) {
      setAptError(err.message || 'Appointment not found');
      setAptData(null);
    } finally {
      setAptLoading(false);
    }
  };

  const handleCreateFromAppointment = async () => {
    if (!aptData) return;
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const req = await api.createRegistration({
        source: 0, // Booked
        appointmentId: aptData.appointmentId,
        departmentId: aptData.departmentId,
        fullName: aptData.patientName,
        phoneNumber: aptData.phoneNumber,
        conditionDescription: aptData.notes,
        preferredLanguage: lang
      });
      setActiveRequest(req);
      onReceptionRequestCreated(req);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const req = await api.createRegistration({
        source: 1, // WalkIn
        departmentId,
        fullName,
        phoneNumber: phone,
        conditionDescription: condition,
        preferredLanguage: lang
      });
      setActiveRequest(req);
      onReceptionRequestCreated(req);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleProvideSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest) return;
    try {
      await api.provideSupplement(activeRequest.requestId, supplementAnswer);
      setSupplementSuccess(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="card" id="reception-prep-card">
      <div className="card-header">
        <h2 className="card-title">📋 {t.reception.title}</h2>
      </div>

      {activeRequest ? (
        <div id="reception-qr-display">
          <div className="alert alert-success">
            <strong>✅ {t.reception.ticketIssued}</strong>
          </div>

          <div className="qr-box">
            <h3>{t.reception.receptionQrTitle}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {t.reception.receptionQrNote}
            </p>
            <div className="qr-code-graphic" id="reception-qr-token">
              <QRCodeSVG value={activeRequest.receptionQrToken} size={192} /><code>{activeRequest.receptionQrToken}</code>
            </div>
            <span className="badge badge-waiting">
              {t.reception.status}: {(getUiTextList(lang,["awaiting_reception","information_needed","information_supplied","confirmed","rejected"]))[activeRequest.status]}
            </span>
          </div>

          {activeRequest.staffQuestion && (
            <div className="card" style={{ borderColor: 'var(--warning)', marginTop: '1rem' }}>
              <h4 style={{ color: 'var(--warning)' }}>⚠️ {t.reception.staffQuestion}</h4>
              <p style={{ margin: '0.5rem 0' }}>{activeRequest.staffQuestion}</p>
              {supplementSuccess ? (
                <div className="alert alert-success">{getUiText(lang,"supplement_answer_sent")}</div>
              ) : (
                <form onSubmit={handleProvideSupplement}>
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-control"
                      value={supplementAnswer}
                      onChange={e => setSupplementAnswer(e.target.value)}
                      placeholder={t.reception.answerQuestion}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary btn-sm">
                    {t.reception.submitAnswer}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="tab-nav">
            <button
              id="tab-appointment-btn"
              type="button"
              className={`tab-btn ${tab === 'appointment' ? 'active' : ''}`}
              onClick={() => setTab('appointment')}
            >
              📅 {t.reception.hasAppointment}
            </button>
            <button
              id="tab-walkin-btn"
              type="button"
              className={`tab-btn ${tab === 'walkin' ? 'active' : ''}`}
              onClick={() => setTab('walkin')}
            >
              🚶 {t.reception.walkIn}
            </button>
          </div>

          {tab === 'appointment' ? (
            <div>
              <form onSubmit={handleLookupAppointment} style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="appointment-lookup-input">{t.reception.appointmentId}</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      id="appointment-lookup-input"
                      type="text"
                      className="form-control"
                      value={aptId}
                      onChange={e => setAptId(e.target.value)}
                      placeholder="APT-2026-001234"
                      required
                    />
                    <button id="lookup-appointment-submit-btn" type="submit" className="btn btn-primary" disabled={aptLoading}>
                      {aptLoading ? '...' : t.reception.lookupBtn}
                    </button>
                  </div>
                </div>
              </form>

              {aptError && <div className="alert alert-danger">{aptError}</div>}

              {aptData && (
                <div className="card" style={{ backgroundColor: '#f0fdf4', borderColor: '#86efac' }}>
                  <h4 style={{ color: '#166534', marginBottom: '0.5rem' }}>✅ {t.reception.appointmentFound}</h4>
                  <p><strong>{t.auth.fullName}:</strong> {aptData.patientName}</p>
                  <p><strong>{t.reception.department}:</strong> {lang === 'vi' ? aptData.departmentNameVi : aptData.departmentNameEn}</p>
                  <p><strong>{getUiText(lang,"notes")}:</strong> {aptData.notes}</p>
                  <button
                    id="create-request-appointment-btn"
                    className="btn btn-success"
                    style={{ marginTop: '1rem' }}
                    onClick={handleCreateFromAppointment}
                    disabled={submitLoading}
                  >
                    {submitLoading ? '...' : t.reception.submitRequest}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateWalkIn} id="walkin-registration-form">
              {submitError && <div className="alert alert-danger">{submitError}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="walkin-name">{t.auth.fullName}</label>
                <input
                  id="walkin-name"
                  type="text"
                  className="form-control"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="walkin-phone">{t.auth.phone}</label>
                <input
                  id="walkin-phone"
                  type="tel"
                  className="form-control"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="walkin-department">{t.reception.department}</label>
                <select
                  id="walkin-department"
                  className="form-control"
                  value={departmentId}
                  onChange={e => setDepartmentId(e.target.value)}
                >
                  <option value="11111111-0001-0000-0000-000000000001">Khoa Tim mạch (Cardiology)</option>
                  <option value="11111111-0001-0000-0000-000000000006">Khoa Khám bệnh tổng quát (General Practice)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="walkin-condition">{t.reception.condition}</label>
                <textarea
                  id="walkin-condition"
                  className="form-control"
                  rows={3}
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                  required
                />
              </div>
              <button
                id="walkin-submit-btn"
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={submitLoading}
              >
                {submitLoading ? '...' : t.reception.submitRequest}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
