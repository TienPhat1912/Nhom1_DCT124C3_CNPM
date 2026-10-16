import { getUiText, type UiTextKey } from "../../../../packages/i18n/src/ui";
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
export function CashierWorkspace({lang}: {lang:string}) {
  const tr = (key: UiTextKey) => getUiText(lang, key);
  const [visits,setVisits]=useState<any[]>([]);const [selected,setSelected]=useState('');const [journey,setJourney]=useState<any>(null);const [kind,setKind]=useState(1);const [amount,setAmount]=useState(0);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [result,setResult]=useState<any>(null);
  const key=useRef(crypto.randomUUID());
  const act=async(work:()=>Promise<void>)=>{setBusy(true);setError('');try{await work();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const load=async()=>setVisits(await api.getWorkspaceVisits());
  useEffect(()=>{act(load);},[]);
  const choose=async(id:string)=>{setSelected(id);setResult(null);key.current=crypto.randomUUID();setJourney(id?await api.getJourney(id):null);};
  return <section className="card" id="cashier-workspace"><h2>{tr("cashier_workspace")}</h2>{error&&<p role="alert" className="alert alert-danger">{error}</p>}
    <button className="btn btn-outline" disabled={busy} onClick={()=>act(load)}>{tr("refresh")}</button><label htmlFor="cashier-visit-select">{tr("choose_visit")}</label><select id="cashier-visit-select" disabled={busy} className="form-control" value={selected} onChange={e=>act(()=>choose(e.target.value))}><option value="">{tr("choose_visit")}</option>{visits.map(v=><option value={v.visitId} key={v.visitId}>{v.patientName} · {v.ticketNumber}</option>)}</select>
    {!visits.length&&<p>{tr("no_visits_yet")}</p>}
    {journey&&<><p>{tr("visits_close_only_after_required_work_and_current_final_settlemen")}</p>{journey.steps.map((s:any)=><p key={s.id}>{lang==='vi'?s.destinationVi:s.destinationEn}: {[3,4,5].includes(s.status)?tr("resolved"):tr("pending")}</p>)}</>}
    <form onSubmit={e=>{e.preventDefault();act(async()=>{const outcome=await api.recordSettlement({visitId:selected,type:kind,amount:kind===2?0:amount,idempotencyKey:key.current,notes:'Demo staff settlement'});setResult(outcome);setJourney(await api.getJourney(selected));key.current=crypto.randomUUID();});}}>
      <label htmlFor="settlement-type-select">{tr("settlement_type")}</label><select id="settlement-type-select" className="form-control" value={kind} onChange={e=>{setKind(Number(e.target.value));key.current=crypto.randomUUID();}}><option value="1">{tr("final_settlement")}</option><option value="0">{tr("intermediate")}</option><option value="2">{tr("no_payment_required")}</option></select>
      <label htmlFor="settlement-amount-input">{tr("amount_vnd")}</label><input id="settlement-amount-input" className="form-control" type="number" min="0" value={amount} disabled={kind===2} onChange={e=>{setAmount(Number(e.target.value));key.current=crypto.randomUUID();}} />
      <button id="process-settlement-btn" className="btn btn-primary" disabled={busy||!selected||journey?.visitStatus===1}>{tr("record_settlement_outcome")}</button>
    </form>
    {result&&<div id="settlement-result-alert" role="status" className="alert alert-success">{result.isVisitClosed?tr("visit_closed_pharmacy_guidance_may_continue"):tr("recorded_visit_remains_active")}</div>}
  </section>;
}
