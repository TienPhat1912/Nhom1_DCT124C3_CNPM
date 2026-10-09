import { getUiText } from "../../../packages/i18n/src/ui";
import React, { useState, useEffect } from 'react';
import { StaffLogin } from './components/StaffLogin';
import { History } from './components/History';
import { RoleSwitcher, ActiveRole } from './components/RoleSwitcher';
import { PatientAuth } from './components/PatientAuth';
import { ReceptionPrep } from './components/ReceptionPrep';
import { TicketRedemption } from './components/TicketRedemption';
import { CurrentJourney } from './components/CurrentJourney';
import { GuidanceTools } from './components/GuidanceTools';
import { ContentContinuity } from './components/ContentContinuity';
import { ReceptionWorkspace } from './components/ReceptionWorkspace';
import { DoctorWorkspace } from './components/DoctorWorkspace';
import { ServiceWorkspace } from './components/ServiceWorkspace';
import { CashierWorkspace } from './components/CashierWorkspace';
import { AdminWorkspace } from './components/AdminWorkspace';
import { api, getAuthToken, setAuthToken, setGuestToken } from './api';
import { getDictionary, Language } from '../../../packages/i18n/src/index';

export const App: React.FC = () => {
  const [lang, setLang] = useState<Language>((localStorage.getItem('language') as Language) || 'vi');
  const [activeRole, setActiveRole] = useState<ActiveRole>('patient');
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Patient view state
  const [patientTab, setPatientTab] = useState<'prep' | 'ticket' | 'journey' | 'tools' | 'history'>(new URLSearchParams(window.location.search).has('ticket') ? 'ticket' : 'prep');
  const [currentJourney, setCurrentJourney] = useState<any | null>(null);
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);

  const t = getDictionary(lang);
  const [sessionError, setSessionError] = useState('');
  const roleNames: Record<ActiveRole, string> = { patient: 'Patient', receptionist: 'Receptionist', doctor: 'Doctor', service: 'ServiceStaff', cashier: 'Cashier', admin: 'Administrator' };
  const authorized = currentUser && (activeRole === 'patient' ? currentUser.isGuest || currentUser.role === 'Patient' : currentUser.role === roleNames[activeRole]);
  const saveSession = (role: ActiveRole) => sessionStorage.setItem('session:' + role, JSON.stringify({ token: getAuthToken(), guestToken: localStorage.getItem('guestToken') }));
  const handleAuth = (user: any) => {
    setCurrentUser(user); setSessionError('');
    if (!user) { setCurrentJourney(null); setActiveVisitId(null); sessionStorage.removeItem('session:' + activeRole); return; }
    const role = (Object.keys(roleNames) as ActiveRole[]).find(r => roleNames[r] === user.role) || 'patient';
    setActiveRole(role); saveSession(role);
  };
  const changeRole = (role: ActiveRole) => {
    saveSession(activeRole); setActiveRole(role); setCurrentUser(null); setCurrentJourney(null); setActiveVisitId(null); setSessionError('');
    const saved = JSON.parse(sessionStorage.getItem('session:' + role) || '{}');
    setAuthToken(saved.token || null); setGuestToken(saved.guestToken || null);
    if (saved.token) api.getMe().then(setCurrentUser).catch(e => setSessionError(e.message));
  };
  useEffect(() => {
    localStorage.setItem('language', lang); document.documentElement.lang = lang;
    window.speechSynthesis?.cancel();
  }, [lang]);
  useEffect(() => {
    const expired = () => { setCurrentUser(null); setCurrentJourney(null); setSessionError(getUiText(lang,"session_expired_sign_in_again_or_ask_reception_for_verified_recov")); };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, [lang]);
  useEffect(() => {
    if (!authorized || activeRole !== 'patient') return;
    let live = true;
    const key = currentUser.id || currentUser.guestSessionId;
    const stored = localStorage.getItem('activeVisit:' + key);
    if (stored) { setActiveVisitId(stored); api.getJourney(stored).then(j=>{if(live)setCurrentJourney(j);}).catch(e => {if(live)setSessionError(e.message);}); }
    return () => {live=false;};
  }, [currentUser]);
  useEffect(() => {
    if (activeVisitId && currentUser) localStorage.setItem('activeVisit:' + (currentUser.id || currentUser.guestSessionId), activeVisitId);
    if (!activeVisitId || !authorized || activeRole !== 'patient') return;
    let live = true;
    const refresh = () => api.getJourney(activeVisitId).then(j => { if (live) { setCurrentJourney(j); setSessionError(''); } }).catch(e => { if (live) setSessionError(e.message); });
    const interval = setInterval(refresh, 5000);
    window.addEventListener('online', refresh);
    return () => { live = false; clearInterval(interval); window.removeEventListener('online', refresh); };
  }, [activeVisitId, currentUser]);

  useEffect(() => {
    // Check existing auth
    if (getAuthToken()) {
      api.getMe()
        .then(handleAuth)
        .catch(() => {
          setSessionError(getUiText(lang,"session_restoration_failed_please_sign_in_again"));
        });
    }
  }, []);

  const refreshJourney = () => {
    if (activeVisitId) {
      api.getJourney(activeVisitId)
        .then(setCurrentJourney)
        .catch(console.error);
    }
  };

  const handleTicketRedeemed = (journeyData: any) => {
    setCurrentJourney(journeyData);
    setActiveVisitId(journeyData.visitId);
    setPatientTab('journey');
  };

  const toggleLanguage = () => {
    setLang(lang === 'vi' ? 'en' : 'vi');
  };

  return (
    <div className="app-container">
      {/* Top Header Navigation */}
      <header className="top-nav">
        <div className="brand">
          <div className="brand-icon">🏥</div>
          <div>
            <div>{t.app.hospitalName}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 400, color: '#94a3b8' }}>
              {t.app.subtitle}
            </div>
          </div>
        </div>

        {/* Demo Role Switcher */}
        <RoleSwitcher activeRole={activeRole} onRoleChange={changeRole} lang={lang} />

        {/* Actions (Language & User Profile) */}
        <div className="nav-actions">
          <button id="lang-toggle-btn" className="lang-btn" onClick={toggleLanguage} type="button">
            🌐 {getUiText(lang,"ti_ng_vi_t_vi")}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {sessionError && <p role="alert" className="alert alert-warning">{sessionError}</p>}
        {activeRole !== 'patient' && !authorized && <StaffLogin lang={lang} onSuccess={handleAuth} />}
        {activeRole !== 'patient' && authorized && <div className="card"><span>{currentUser.fullName}</span><button className="btn btn-outline" onClick={() => { setAuthToken(null); handleAuth(null); }}>{t.auth.logout}</button></div>}
        {/* === ROLE: PATIENT === */}
        {activeRole === 'patient' && (
          <div>
            <a className="btn btn-outline" href={new URLSearchParams(window.location.search).has('ticket') ? 'hospitalguide://ticket/'+encodeURIComponent(new URLSearchParams(window.location.search).get('ticket')!) : 'hospitalguide://entry'}>{getUiText(lang,"open_installed_patient_app")}</a>
            <PatientAuth
              lang={lang}
              currentUser={currentUser}
              onAuthSuccess={handleAuth}
            />

            {authorized && <>
            {/* Patient Workspace Navigation */}
            <div className="tab-nav" id="patient-nav-tabs">
              <button
                id="patient-tab-prep-btn"
                className={`tab-btn ${patientTab === 'prep' ? 'active' : ''}`}
                onClick={() => setPatientTab('prep')}
              >
                1. 📝 {t.reception.title}
              </button>
              <button
                id="patient-tab-ticket-btn"
                className={`tab-btn ${patientTab === 'ticket' ? 'active' : ''}`}
                onClick={() => setPatientTab('ticket')}
              >
                2. 🎟️ {t.ticket.title}
              </button>
              <button
                id="patient-tab-journey-btn"
                className={`tab-btn ${patientTab === 'journey' ? 'active' : ''}`}
                onClick={() => setPatientTab('journey')}
              >
                3. 🧭 {t.journey.title}
              </button>
              <button
                id="patient-tab-tools-btn"
                className={`tab-btn ${patientTab === 'tools' ? 'active' : ''}`}
                onClick={() => setPatientTab('tools')}
              >
                4. 🛠️ {t.tools.toolsTitle}
              </button>
              <button
                id="patient-tab-history-btn"
                className={`tab-btn ${patientTab === 'history' ? 'active' : ''}`}
                onClick={() => setPatientTab('history')}
              >
                5. 📖 {t.clinical.title}
              </button>
            </div>

            {/* Patient Screen Sections */}
            {patientTab === 'prep' && (
              <ReceptionPrep
                lang={lang}
                currentUser={currentUser}
                onReceptionRequestCreated={req => {
                  localStorage.setItem('lastRegistrationId', req.requestId);
                }}
              />
            )}

            {patientTab === 'ticket' && (
              <TicketRedemption
                lang={lang}
                onTicketRedeemed={handleTicketRedeemed}
              />
            )}

            {patientTab === 'journey' && (
              currentJourney ? (
                <CurrentJourney
                  journeyData={currentJourney}
                  lang={lang}
                  onRefresh={refreshJourney}
                />
              ) : (
                <div className="card">
                  <div className="alert alert-info">
                    ℹ️ Vui lòng quét hoặc kích hoạt mã phiếu khám ở tab <strong>"2. Kích Hoạt Phiếu Khám"</strong> để xem lộ trình bệnh viện.
                  </div>
                  <TicketRedemption lang={lang} onTicketRedeemed={handleTicketRedeemed} />
                </div>
              )
            )}

            {patientTab === 'tools' && (
              <GuidanceTools
                visitId={activeVisitId || currentJourney?.visitId || ''}
                lang={lang}
              />
            )}

            {patientTab === 'history' && <History lang={lang} onOpen={id => { setActiveVisitId(id); api.getJourney(id).then(setCurrentJourney).catch(e => setSessionError(e.message)); }} />}
            {patientTab === 'history' && (
              <ContentContinuity
                visitId={activeVisitId || currentJourney?.visitId || ''}
                lang={lang}
                currentUser={currentUser}
                onUserConverted={u => setCurrentUser(u)}
              />
            )}
            </>}
          </div>
        )}

        {/* === ROLE: RECEPTIONIST (FE-R01) === */}
        {activeRole === 'receptionist' && authorized && (
          <ReceptionWorkspace lang={lang} />
        )}

        {/* === ROLE: DOCTOR (FE-D01) === */}
        {activeRole === 'doctor' && authorized && (
          <DoctorWorkspace lang={lang} />
        )}

        {/* === ROLE: SERVICE STAFF (FE-S01) === */}
        {activeRole === 'service' && authorized && (
          <ServiceWorkspace lang={lang} />
        )}

        {/* === ROLE: CASHIER (FE-C01) === */}
        {activeRole === 'cashier' && authorized && (
          <CashierWorkspace lang={lang} />
        )}

        {/* === ROLE: ADMINISTRATOR (FE-A01) === */}
        {activeRole === 'admin' && authorized && (
          <AdminWorkspace lang={lang} />
        )}
      </main>

      {/* Footer */}
      <footer>
        <strong>Multilingual Hospital Visit Narration & Guidance System</strong> • Developed per PRD Version 4.1 Specifications
      </footer>
    </div>
  );
};
