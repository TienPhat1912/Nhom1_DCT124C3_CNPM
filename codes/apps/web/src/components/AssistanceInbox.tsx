import { getUiText, getUiTextList, type UiTextKey } from "../../../../packages/i18n/src/ui";
import { useEffect, useState } from 'react';
import { api } from '../api';
export function AssistanceInbox({lang}:{lang:string}) {
  const tr = (key: UiTextKey) => getUiText(lang, key);
  const [requests,setRequests]=useState<any[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{let live=true;const load=()=>api.getAssistance().then(rows=>{if(live)setRequests(rows);}).catch(e=>{if(live)setError(e.message);});load();const timer=setInterval(load,5000);return()=>{live=false;clearInterval(timer);};},[]);
  return <section><h3>{tr("assistance_in_your_scope")}</h3>{error&&<p role="alert">{error}</p>}{!requests.length&&<p>{tr("no_requests_yet")}</p>}{requests.map(row=><div className="step-item" key={row.id}><span>{row.patient?.fullName} · {row.description} · {(getUiTextList(lang,["open","acknowledged","resolved","escalated"]))[row.status]}</span>{row.status!==2&&[1,2,3].map((status,i)=><button className="btn btn-outline" key={status} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api.updateAssistance(row.id,status,tr("staff_updated"));setRequests(await api.getAssistance());}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{(getUiTextList(lang,["acknowledge","resolve","escalate"]))[i]}</button>)}</div>)}</section>;
}
