import { getUiText } from "../../../../packages/i18n/src/ui";
import React, { useState, useEffect } from 'react';
import { Narration } from './Narration';
import { api, getGuestToken, setAuthToken, setGuestToken } from '../api';
import { getDictionary, Language } from '../../../../packages/i18n/src/index';

interface Props {
  visitId: string;
  lang: Language;
  currentUser: any;
  onUserConverted: (user: any) => void;
}

export const ContentContinuity: React.FC<Props> = ({ visitId, lang, currentUser, onUserConverted }) => {
  const t = getDictionary(lang);
  const [diagnosis, setDiagnosis] = useState<any | null>(null);
  const [followUp, setFollowUp] = useState<any | null>(null);
  const [loadError, setLoadError] = useState('');
  const [booking, setBooking] = useState<{available:boolean;url?:string} | null>(null);
  useEffect(()=>{let live=true;setBooking(null);api.getBookingHandoff(visitId).then(value=>{if(live)setBooking(value);}).catch(e=>{if(live)setLoadError(e.message);});return()=>{live=false;};},[visitId]);

  // Conversion modal
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertMsg, setConvertMsg] = useState<string | null>(null);
  const [continuationToken, setContinuationToken] = useState('');
  const [convertExisting, setConvertExisting] = useState(false);

  useEffect(() => {
    let live = true;
    setDiagnosis(null); setFollowUp(null); setLoadError('');
    const refresh = async () => {
      if (!visitId) return;
      try {
        const [next, follow] = await Promise.all([
          api.getPatientDiagnosis(visitId, lang).catch(e => { if (e.message.includes('404')) return null; throw e; }),
          api.getFollowUp(visitId).catch(e => { if (e.message.includes('404')) return null; throw e; })
        ]);
        if (live) { setDiagnosis(next); setFollowUp(follow); setLoadError(''); }
      } catch(e) { if (live) setLoadError((e as Error).message); }
    };
    refresh(); const poll = setInterval(refresh, 5000);
    return () => { live = false; clearInterval(poll); };
  }, [visitId, lang]);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    const guestToken = getGuestToken();
    if (!guestToken) {
      alert('Không tìm thấy phiên khách để chuyển đổi');
      return;
    }

    setConvertLoading(true);
    setConvertMsg(null);
    try {
      const claim = continuationToken || guestToken;
      const res = convertExisting ? await (async () => {
        const login = await api.login({email,password});
        const previous = localStorage.getItem('token');
        try { setAuthToken(login.token); return await api.convertGuest(claim); }
        catch(e) { setAuthToken(previous); throw e; }
      })() : await api.registerAndConvertGuest(claim, {
        email,
        password,
        fullName: fullName || currentUser?.fullName || 'Khách Đã Đăng Ký',
        language: lang
      });
      if (res.token) {
        setAuthToken(res.token);
        setGuestToken(null);
        setConvertMsg(t.auth.convertSuccess);
        onUserConverted(res.user);
        setTimeout(() => setShowConvertModal(false), 2000);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setConvertLoading(false);
    }
  };

  return (
    <div className="card" id="content-continuity-card">
      <div className="card-header">
        <h2 className="card-title">📖 {t.clinical.title}</h2>
        {currentUser?.isGuest && (
          <button
            id="open-convert-modal-btn"
            className="btn btn-secondary btn-sm"
            onClick={async () => { try { const claim = await api.createContinuation('/visit/'+visitId); setContinuationToken(claim.continuationToken); setShowConvertModal(true); } catch(e) { setConvertMsg((e as Error).message); } }}
          >
            ⭐ {t.auth.convertGuest}
          </button>
        )}
      </div>

      {loadError && <p role="alert">{loadError}</p>}
      {convertMsg && !showConvertModal && <p role="status">{convertMsg}</p>}
      {diagnosis ? (
        <div id="patient-diagnosis-details">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <strong>{t.clinical.doctor}:</strong> {diagnosis.doctorName}<p>{t.clinical.publishedAt}: {new Date(diagnosis.publishedAt + (diagnosis.publishedAt.endsWith('Z') ? '' : 'Z')).toLocaleString()}</p>
            </div>
            <div>
              <span className="badge badge-completed">
                {t.clinical.version} {diagnosis.version}
              </span>
              <p>{getUiText(lang,"content_language")}: {diagnosis.language.toUpperCase()}</p>
            </div>
          </div>

          {diagnosis.isFallback && (
            <div className="alert alert-warning" style={{ fontSize: '0.85rem' }}>
              ⚠️ {t.clinical.fallbackNotice}
            </div>
          )}

          <div className="form-group" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
            <label className="form-label">🩺 {t.clinical.diagnosis}</label>
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>
              {diagnosis.diagnosis}
            </p><Narration id={diagnosis.id} section="diagnosis" lang={lang} />
          </div>

          <div className="form-group" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
            <label className="form-label">💡 {t.clinical.explanation}</label>
            <p style={{ fontSize: '0.95rem', color: '#334155' }}>
              {diagnosis.explanation}
            </p>
          </div>

          <div className="form-group" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
            <label className="form-label">📋 {t.clinical.careInstructions}</label>
            <p style={{ fontSize: '0.95rem', color: '#334155' }}>
              {diagnosis.careInstructions}
            </p><Narration id={diagnosis.id} section="care" lang={lang} />
          </div>
        </div>
      ) : (
        <div className="alert alert-info">
          <span>ℹ️ {t.clinical.noDiagnosisYet}</span>
        </div>
      )}

      {/* Follow-up Recommendation (BR-23) */}
      {followUp && (
        <div className="card" style={{ marginTop: '1.5rem', borderColor: 'var(--primary)', backgroundColor: '#f0f9ff' }}>
          <h4 style={{ color: 'var(--primary)' }}>📅 {t.clinical.followUpTitle}</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.75rem' }}>
            ℹ️ {t.clinical.followUpNote}
          </p>
          <p>
            <strong>{t.clinical.timeframe}:</strong> {followUp.suggestedTimeframe || (getUiText(lang,"no_timeframe_specified"))}
          </p>
          <p>
            <strong>{getUiText(lang,"instructions")}:</strong> {lang === 'vi' ? followUp.recommendationVi || followUp.recommendationEn : followUp.recommendationEn || followUp.recommendationVi}
          </p>
          {booking?.available ? <a className="btn btn-outline" href={booking.url} target="_blank" rel="noopener noreferrer">{getUiText(lang,"open_follow_up_booking")}</a> : <p>{getUiText(lang,"contact_reception_to_book_a_later_attendance_2")}</p>}
        </div>
      )}

      {/* Conversion Modal (BR-13, BR-14, BR-15) */}
      {showConvertModal && (
        <div className="modal-overlay" onClick={() => setShowConvertModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>⭐ {t.auth.convertGuest}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>
              {getUiText(lang,"link_an_account_to_keep_access_to_this_record_and_journey")}
            </p>

            {convertMsg ? (
              <div className="alert alert-success">{convertMsg}</div>
            ) : (
              <form onSubmit={handleConvert}>
                <label><input type="checkbox" checked={convertExisting} onChange={e=>setConvertExisting(e.target.checked)} />{getUiText(lang,"link_an_existing_account")}</label>
                <div className="form-group">
                  <label className="form-label">{t.auth.fullName}</label>
                  <input
                    type="text"
                    className="form-control"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    required={!convertExisting}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.auth.email}</label>
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.auth.password}</label>
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowConvertModal(false)}>
                    {getUiText(lang,"cancel")}
                  </button>
                  <button id="convert-guest-submit-btn" type="submit" className="btn btn-primary" disabled={convertLoading}>
                    {convertLoading ? '...' : t.auth.convertGuest}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
