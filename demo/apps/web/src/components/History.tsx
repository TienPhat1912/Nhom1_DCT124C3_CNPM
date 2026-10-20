import { getUiText } from "../../../../packages/i18n/src/ui";
import { useEffect, useState } from 'react';
import { api } from '../api';

export function History({ lang, onOpen }: { lang: string; onOpen: (id: string) => void }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const load = () => { setBusy(true); setError(''); api.getPatientVisits().then(setVisits).catch(e => setError(e.message)).finally(() => setBusy(false)); };
  useEffect(load, []);
  return <section className="card">
    <h2>{getUiText(lang,"visit_history")}</h2>
    {busy && <p role="status">{getUiText(lang,"loading")}</p>}
    {error && <p role="alert">{error}</p>}
    <button className="btn btn-outline" onClick={load}>{getUiText(lang,"refresh")}</button>
    {!busy && visits.length === 0 && <p>{getUiText(lang,"no_confirmed_visits_yet")}</p>}
    {visits.map(v => <button className="step-item" key={v.visitId} onClick={() => onOpen(v.visitId)}>
      <span>{v.ticketNumber} · {lang === 'vi' ? v.departmentVi : v.departmentEn}</span>
      <span>{new Date(v.createdAt + (v.createdAt.endsWith('Z') ? '' : 'Z')).toLocaleString(getUiText(lang,"en_us"))}</span>
    </button>)}
  </section>;
}
