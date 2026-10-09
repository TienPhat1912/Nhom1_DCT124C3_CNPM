import { getUiText, getUiTextList, type UiTextKey } from "../../../../packages/i18n/src/ui";
import { useEffect, useState } from 'react';
import { Narration } from './Narration';
import { api } from '../api';
import type { Language } from '../../../../packages/i18n/src/index';

export function GuidanceTools({visitId,lang}:{visitId:string;lang:Language}) {
  const tr = (key: UiTextKey) => getUiText(lang, key);
  const [diagnosis,setDiagnosis]=useState<any>(null);
  const [journey,setJourney]=useState<any>(null);
  const [notifications,setNotifications]=useState<any[]>([]);
  const [assistance,setAssistance]=useState<any[]>([]);
  const [description,setDescription]=useState('');
  const [category,setCategory]=useState('Navigation');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let live=true; setDiagnosis(null);setJourney(null);setNotifications([]);setAssistance([]);setError('');
    const refresh=async()=>{
      try {
        const [content,current,feed,requests]=await Promise.all([
          visitId?api.getPatientDiagnosis(visitId,lang).catch(e=>{if(e.message.includes('404'))return null;throw e;}):null,
          visitId?api.getJourney(visitId):null,api.getNotifications(),api.getMyAssistance()
        ]);
        if(live){setDiagnosis(content);setJourney(current);setNotifications(feed);setAssistance(requests);setError('');}
      }catch(e){if(live)setError((e as Error).message);}
    };
    refresh();const timer=setInterval(refresh,5000);
    return()=>{live=false;clearInterval(timer);};
  },[visitId,lang]);
  return <section className="card" id="guidance-tools-card">
    <h2>{tr("guidance_and_assistance")}</h2>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div className="grid-2">
      <div><h3>{tr("listen_to_doctor_information")}</h3>
        {diagnosis?<><p>{tr("diagnosis_and_explanation")}</p><Narration id={diagnosis.id} section="diagnosis" lang={lang}/><p>{tr("care_instructions")}</p><Narration id={diagnosis.id} section="care" lang={lang}/></>:<p>{tr("no_published_information_yet")}</p>}
      </div>
      <div><h3>{tr("your_destination")}</h3><p>{journey?(lang==='vi'?journey.destinationVi:journey.destinationEn):tr("patient_reception_floor_1")}</p><p>{tr("if_you_need_directions_request_staff_assistance")}</p></div>
    </div>
    <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await api.createAssistance({visitId:visitId||null,category,description});setAssistance(await api.getMyAssistance());setDescription('');setNotice(tr("assistance_requested"));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
      <h3>{tr("request_assistance")}</h3>
      <label htmlFor="assistance-category">{tr("category_2")}</label><select id="assistance-category" className="form-control" value={category} onChange={e=>setCategory(e.target.value)}>{['Navigation','Mobility','Language','Other'].map((value,i)=><option key={value} value={value}>{(getUiTextList(lang,["directions","mobility_wheelchair","language","other"]))[i]}</option>)}</select>
      <label htmlFor="assistance-description">{tr("your_need_and_current_location")}</label><textarea id="assistance-description" className="form-control" required maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)}/>
      <button id="send-assist-submit-btn" className="btn btn-secondary" disabled={busy}>{tr("send_request")}</button>
    </form>
    <h3>{tr("assistance_status")}</h3>
    {!assistance.length&&<p>{tr("no_requests_yet")}</p>}
    {assistance.map(a=><p key={a.id}>{a.description} · {(getUiTextList(lang,["requested","acknowledged","resolved","escalated"]))[a.status]} {a.resolution}</p>)}
    <h3>{tr("notifications")}</h3>
    {!notifications.length&&<p>{tr("no_notifications_yet")}</p>}
    {notifications.map(n=><p key={n.id}><strong>{lang==='vi'?n.titleVi:n.titleEn}</strong>: {lang==='vi'?n.bodyVi:n.bodyEn}</p>)}
  </section>;
}
