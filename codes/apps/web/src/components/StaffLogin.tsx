import { getUiText } from "../../../../packages/i18n/src/ui";
import { useState } from 'react';
import { api, setAuthToken, setGuestToken } from '../api';

export function StaffLogin({ lang, onSuccess }: { lang: string; onSuccess: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <form className="card" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api.login({ email, password });
      setAuthToken(result.token); setGuestToken(null); onSuccess(result.user);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }}>
    <h2>{getUiText(lang,"staff_sign_in")}</h2>
    <label className="form-label" htmlFor="staff-email">Email</label>
    <input className="form-control" id="staff-email" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
    <label className="form-label" htmlFor="staff-password">{getUiText(lang,"password")}</label>
    <input className="form-control" id="staff-password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
    {error && <p role="alert" className="alert alert-danger">{error}</p>}
    <button className="btn btn-primary" disabled={busy}>{busy ? '…' : getUiText(lang,"sign_in")}</button>
  </form>;
}
