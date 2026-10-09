import { getUiText, getUiTextList, type UiTextKey } from "../../../../packages/i18n/src/ui";
import { useEffect, useState } from 'react';
import { api } from '../api';
import { AssistanceInbox } from './AssistanceInbox';
export function ServiceWorkspace({lang}: {lang:string}) {
  const tr = (key: UiTextKey) => getUiText(lang, key);
  const [visits,setVisits]=useState<any[]>([]); const [selected,setSelected]=useState(''); const [steps,setSteps]=useState<any[]>([]); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const act=async(work:()=>Promise<void>)=>{setBusy(true);setError('');try{await work();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const load=async()=>{setVisits(await api.getWorkspaceVisits());};
  const detail=async(id:string)=>{setSelected(id);setSteps((await api.getJourney(id)).steps.filter((s:any)=>[1,2,6].includes(s.stepType)));};
  useEffect(()=>{act(load);},[]);
  return <section className="card" id="service-workspace"><h2>{tr("service_workspace")}</h2>{error&&<p role="alert" className="alert alert-danger">{error}</p>}
    <button className="btn btn-outline" disabled={busy} onClick={()=>act(load)}>{tr("refresh")}</button>
    <label htmlFor="service-visit-select">{tr("patient_with_assigned_services")}</label><select id="service-visit-select" disabled={busy} className="form-control" value={selected} onChange={e=>act(()=>detail(e.target.value))}><option value="">{tr("choose_visit")}</option>{visits.map(v=><option key={v.visitId} value={v.visitId}>{v.patientName} · {v.ticketNumber}</option>)}</select>
    {!visits.length&&<p>{tr("no_assigned_services_yet")}</p>}
    {steps.map((s,i)=><div className="step-item" key={s.id}><span>{lang==='vi'?s.destinationVi:s.destinationEn} · {(getUiTextList(lang,["waiting","ready","in_progress","completed_2","skipped_2","cancelled"]))[s.status]}</span>{[1,2].includes(s.status)&&<button id={`complete-step-btn-${i}`} className="btn btn-success" disabled={busy} onClick={()=>act(async()=>{await api.updateStepStatus(s.id,3);await detail(selected);})}>{tr("complete_service")}</button>}</div>)}
    <AssistanceInbox lang={lang}/>
  </section>;
}
