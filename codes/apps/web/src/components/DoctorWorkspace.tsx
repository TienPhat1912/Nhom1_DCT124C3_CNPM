import { getUiText, getUiTextList, type UiTextKey } from "../../../../packages/i18n/src/ui";
import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useRef } from 'react';
import type { Language } from '../../../../packages/i18n/src/index';
import type { JourneyStep } from '../../../../packages/contracts/src/api-types';

export function DoctorWorkspace({lang}: {lang: Language}) {
  const tr = (key: UiTextKey) => getUiText(lang, key);
  const [visits, setVisits] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [steps, setSteps] = useState<JourneyStep[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [service, setService] = useState('');
  const [draft, setDraft] = useState<any>(null);
  const [form, setForm] = useState({diagnosisVi:'',diagnosisEn:'',explanationVi:'',explanationEn:'',careInstructionsVi:'',careInstructionsEn:'',enTranslationApproved:false});
  const [followUp, setFollowUp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const orderAttempt = useRef({context:'', key:''});
  const act = async (work: () => Promise<void>) => { setBusy(true); setError(''); setNotice(''); try { await work(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } };
  const refresh = async () => { setVisits(await api.getDoctorVisits()); const choices = (await api.getServices()).filter(s => [1,2,6].includes(s.stepType)); setServices(choices); if (!service && choices[0]) setService(choices[0].id); };
  const details = async (id: string) => { const j = await api.getJourney(id); setSteps(j.steps); setOrders(await api.getDoctorOrders(id)); };
  useEffect(() => { act(refresh); }, []);
  useEffect(() => {
    setDraft(null); setForm({diagnosisVi:'',diagnosisEn:'',explanationVi:'',explanationEn:'',careInstructionsVi:'',careInstructionsEn:'',enTranslationApproved:false}); setFollowUp(''); setSteps([]); setOrders([]);
    if (!selected) return;
    let live = true;
    act(async () => {
      await details(selected);
      try { const d = await api.getDoctorDiagnosis(selected); if (live) { setDraft(d); setForm({diagnosisVi:d.diagnosisVi || '',diagnosisEn:d.diagnosisEn || '',explanationVi:d.explanationVi || '',explanationEn:d.explanationEn || '',careInstructionsVi:d.careInstructionsVi || '',careInstructionsEn:d.careInstructionsEn || '',enTranslationApproved:d.enTranslationApproved}); } }
      catch(e) { if (!(e as Error).message.includes('404')) throw e; }
    });
    return () => {live=false;};
  }, [selected]);
  return <section className="card" id="doctor-workspace">
    <h2>{tr("doctor_workspace")}</h2>
    {error && <p role="alert" className="alert alert-danger">{error}</p>}{notice && <p role="status" className="alert alert-success">{notice}</p>}
    <button className="btn btn-outline" disabled={busy} onClick={() => act(refresh)}>{tr("refresh")}</button>
    <label htmlFor="doctor-visit-select">{tr("assigned_visit")}</label>
    <select id="doctor-visit-select" disabled={busy} className="form-control" value={selected} onChange={e => setSelected(e.target.value)}><option value="">{tr("choose_visit")}</option>{visits.map(v => <option value={v.visitId} key={v.visitId}>{v.patientName} · {v.ticketNumber}</option>)}</select>
    {!visits.length && <p>{tr("no_assigned_visits_yet")}</p>}
    {selected && <>
      <h3>{tr("consultation_progress")}</h3>
      {steps.filter(s => [0,3].includes(s.stepType)).map(s => <div className="step-item" key={s.id}><span>{lang === 'vi' ? s.destinationVi : s.destinationEn}</span><button id={`doctor-complete-${s.stepType}`} className="btn btn-success" disabled={busy || ![1,2].includes(s.status)} onClick={() => act(async () => { await api.updateStepStatus(s.id,3); await details(selected); })}>{s.status === 3 ? tr("completed_2") : tr("complete_consultation")}</button></div>)}
      <h3>{tr("service_orders")}</h3>
      <label htmlFor="doctor-service-select">{tr("service")}</label><select id="doctor-service-select" className="form-control" value={service} onChange={e => setService(e.target.value)}>{services.map(s => <option value={s.id} key={s.id}>{lang === 'vi' ? s.nameVi : s.nameEn}</option>)}</select>
      <button id="doctor-order-btn" className="btn btn-primary" disabled={busy || !service} onClick={() => act(async () => { const context = selected+service; if (orderAttempt.current.context !== context) orderAttempt.current = {context,key:crypto.randomUUID()}; await api.createDoctorOrder({visitId:selected, serviceId:service, idempotencyKey:orderAttempt.current.key}); orderAttempt.current = {context:'',key:''}; await details(selected); })}>{tr("add_order")}</button>
      {orders.map(o => <div className="step-item" key={o.id}><span>{lang === 'vi' ? o.service?.nameVi : o.service?.nameEn}</span>{!o.isCancelled && <button className="btn btn-outline" disabled={busy} onClick={() => { const reason = prompt(tr("cancellation_reason")); if (reason) act(async () => { await api.changeOrder(o.id,{cancel:true,reason}); await details(selected); }); }}>{tr("cancel_unstarted_order")}</button>}</div>)}
      <h3>{tr("diagnosis_and_care_instructions")}</h3>
      {(['diagnosisVi','diagnosisEn','explanationVi','explanationEn','careInstructionsVi','careInstructionsEn'] as const).map((key,i) => <div className="form-group" key={key}><label htmlFor={key}>{(getUiTextList(lang,["diagnosis_vi","diagnosis_en","explanation_vi","explanation_en","care_instructions_vi","care_instructions_en"]))[i]}</label><textarea className="form-control" id={key} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} /></div>)}
      <label><input type="checkbox" checked={form.enTranslationApproved} onChange={e => setForm({...form,enTranslationApproved:e.target.checked})} />{tr("i_approved_the_english_translation_for_this_version")}</label>
      <div><button id="doctor-save-draft-btn" className="btn btn-outline" disabled={busy} onClick={() => act(async () => { setDraft(await api.saveDiagnosisDraft({...form,id:draft?.id,visitId:selected})); setNotice(tr("private_draft_saved")); })}>{tr("save_draft")}</button>{' '}<button id="doctor-publish-btn" className="btn btn-primary" disabled={busy || !draft || draft.status===1} onClick={() => act(async () => { setDraft(await api.publishDiagnosis(draft.id)); setNotice(tr("published_to_patient")); })}>{tr("publish_to_patient")}</button></div>
      <label htmlFor="follow-up">{tr("follow_up_recommendation_optional")}</label><input id="follow-up" className="form-control" value={followUp} onChange={e => setFollowUp(e.target.value)} />
      <button className="btn btn-outline" disabled={busy || !followUp} onClick={() => act(async () => { await api.saveFollowUp({visitId:selected,recommendationVi:lang==='vi'?followUp:null,recommendationEn:lang==='en'?followUp:null}); setNotice(tr("recommendation_saved_no_appointment_booked")); })}>{tr("save_recommendation")}</button>
    </>}
  </section>;
}
