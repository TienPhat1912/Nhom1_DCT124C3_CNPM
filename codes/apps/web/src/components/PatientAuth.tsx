import { getUiText } from "../../../../packages/i18n/src/ui";
import React, { useState } from 'react';
import { api, setAuthToken, setGuestToken } from '../api';
import { getDictionary, Language } from '../../../../packages/i18n/src/index';

interface Props {
  lang: Language;
  onAuthSuccess: (user: any) => void;
  currentUser: any;
}

export const PatientAuth: React.FC<Props> = ({ lang, onAuthSuccess, currentUser }) => {
  const t = getDictionary(lang);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [externalAccount, setExternalAccount] = useState('');
  const [externalPassword, setExternalPassword] = useState('');
  const [externalNotice, setExternalNotice] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ email, password });
      if (res.user?.role !== 'Patient') throw new Error(getUiText(lang,"choose_the_staff_role_to_sign_in_with_this_account"));
      if (res.token) {
        setAuthToken(res.token);
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.register({
        email,
        password,
        fullName,
        phoneNumber: phone,
        language: lang
      });
      if (res.token) {
        setAuthToken(res.token);
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.createGuest(lang);
      if (res.token) {
        setAuthToken(res.token);
        setGuestToken(res.guestToken);
        onAuthSuccess({
          isGuest: true,
          guestSessionId: res.guestSessionId,
          guestToken: res.guestToken,
          fullName: getUiText(lang,"guest_patient")
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (currentUser) {
    return (
      <div className="card" id="patient-profile-card">
        <div className="card-header">
          <h2 className="card-title">
            👤 {currentUser.isGuest ? t.roles.patient + ' (Guest)' : currentUser.fullName}
          </h2>
          <span className={`badge ${currentUser.isGuest ? 'badge-waiting' : 'badge-active'}`}>
            {currentUser.isGuest ? 'GUEST SESSION' : currentUser.role}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p><strong>Email:</strong> {currentUser.email || (getUiText(lang,"guest_mode_no_email"))}</p>
            <p><strong>{t.auth.language}:</strong> {lang.toUpperCase()}</p>
          </div>
          <button
            id="auth-logout-btn"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setAuthToken(null);
              setGuestToken(null);
              onAuthSuccess(null);
            }}
          >
            {t.auth.logout}
          </button>
        </div>
        {currentUser.isGuest && (
          <div className="alert alert-info" style={{ marginTop: '1rem' }}>
            <span>ℹ️ {t.auth.guestNotice}</span>
            <p>{getUiText(lang,"session_reference_for_reception_recovery")}: <code>{currentUser.guestSessionId}</code></p>
          </div>
        )}
        {!currentUser.isGuest && currentUser.role === 'Patient' && <form onSubmit={async e => {
          e.preventDefault(); setLoading(true); setError(null);
          try { const user = await api.saveProfile({fullName:fullName || currentUser.fullName,phoneNumber:phone || currentUser.phoneNumber,language:lang}); onAuthSuccess(user); }
          catch(e) { setError((e as Error).message); } finally { setLoading(false); }
        }}>
          <h3>{getUiText(lang,"update_profile")}</h3>
          <label htmlFor="profile-name">{t.auth.fullName}</label><input id="profile-name" className="form-control" value={fullName} placeholder={currentUser.fullName} onChange={e=>setFullName(e.target.value)} maxLength={100} />
          <label htmlFor="profile-phone">{getUiText(lang,"phone")}</label><input id="profile-phone" className="form-control" value={phone} placeholder={currentUser.phoneNumber || ''} onChange={e=>setPhone(e.target.value)} maxLength={20} />
          <button className="btn btn-outline" disabled={loading}>{getUiText(lang,"save_profile_2")}</button>
        </form>}
        {!currentUser.isGuest && currentUser.role === 'Patient' && <form onSubmit={async e => {
          e.preventDefault(); setLoading(true); setError(null);
          try { await api.linkAppointments(externalAccount, externalPassword); setExternalPassword(''); setExternalNotice(getUiText(lang,"identity_linked_you_can_retrieve_your_appointment_for_reception_p")); }
          catch(e) { setError((e as Error).message); } finally { setLoading(false); }
        }}>
          <h3>{getUiText(lang,"link_appointment_account_optional")}</h3>
          <label htmlFor="external-account">{getUiText(lang,"hospital_account")}</label><input id="external-account" className="form-control" value={externalAccount} onChange={e=>setExternalAccount(e.target.value)} required />
          <label htmlFor="external-password">{getUiText(lang,"hospital_account_password")}</label><input id="external-password" className="form-control" type="password" value={externalPassword} onChange={e=>setExternalPassword(e.target.value)} required />
          <button className="btn btn-outline" disabled={loading}>{getUiText(lang,"verify_link")}</button>
          {externalNotice && <p role="status">{externalNotice}</p>}{error && <p role="alert">{error}</p>}
        </form>}
      </div>
    );
  }

  return (
    <div className="card" id="patient-auth-card" style={{ maxWidth: '480px', margin: '0 auto 2rem' }}>
      <div className="card-header">
        <h2 className="card-title">
          {mode === 'login' ? t.auth.login : t.auth.register}
        </h2>
      </div>

      {error && <div className="alert alert-danger" id="auth-error-alert">{error}</div>}

      {mode === 'login' ? (
        <form onSubmit={handleLogin} id="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">{t.auth.email}</label>
            <input
              id="login-email"
              type="email"
              className="form-control"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="patient1@hospital.demo"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">{t.auth.password}</label>
            <input
              id="login-password"
              type="password"
              className="form-control"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? '...' : t.auth.login}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} id="register-form">
          <div className="form-group">
            <label className="form-label" htmlFor="reg-fullname">{t.auth.fullName}</label>
            <input
              id="reg-fullname"
              type="text"
              className="form-control"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">{t.auth.email}</label>
            <input
              id="reg-email"
              type="email"
              className="form-control"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="patient@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-phone">{t.auth.phone}</label>
            <input
              id="reg-phone"
              type="tel"
              className="form-control"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0912345678"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">{t.auth.password}</label>
            <input
              id="reg-password"
              type="password"
              className="form-control"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            id="register-submit-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? '...' : t.auth.register}
          </button>
        </form>
      )}

      <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          style={{ width: '100%', marginBottom: '0.75rem' }}
        >
          {mode === 'login' ? t.auth.noAccountYet : t.auth.alreadyHaveAccount}
        </button>

        <div style={{ margin: '0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          <span>hoặc / or</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
        </div>

        <button
          id="guest-continue-btn"
          type="button"
          className="btn btn-secondary"
          style={{ width: '100%' }}
          onClick={handleGuest}
          disabled={loading}
        >
          ⚡ {t.auth.guest}
        </button>
      </div>
    </div>
  );
};
