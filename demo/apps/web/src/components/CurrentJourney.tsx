import { getUiText } from "../../../../packages/i18n/src/ui";
import React, { useState } from 'react';
import { api } from '../api';
import { getDictionary, Language } from '../../../../packages/i18n/src/index';

interface Props {
  journeyData: any;
  lang: Language;
  onRefresh: () => void;
}

export const CurrentJourney: React.FC<Props> = ({ journeyData, lang, onRefresh }) => {
  const t = getDictionary(lang);
  const [pharmacyLoading, setPharmacyLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!journeyData) return null;

  const getStepTypeLabel = (type: number) => {
    switch (type) {
      case 0: return getUiText(lang,"initial_consultation");
      case 1: return getUiText(lang,"laboratory_test");
      case 2: return getUiText(lang,"diagnostic_imaging");
      case 3: return getUiText(lang,"return_consultation");
      case 4: return getUiText(lang,"payment_settlement");
      case 5: return getUiText(lang,"hospital_pharmacy");
      default: return getUiText(lang,"other_service");
    }
  };

  const getStepStatusBadge = (status: number) => {
    switch (status) {
      case 0: return <span className="badge badge-waiting">{t.journey.stepWaiting}</span>;
      case 1: return <span className="badge badge-ready">{t.journey.stepReady}</span>;
      case 2: return <span className="badge badge-inprogress">{t.journey.stepInProgress}</span>;
      case 3: return <span className="badge badge-completed">{t.journey.stepCompleted}</span>;
      default: return <span className="badge badge-closed">{t.journey.stepSkipped}</span>;
    }
  };

  const handleCompletePharmacy = async () => {
    setPharmacyLoading(true);
    setSuccessMsg(null);
    try {
      await api.completePharmacy(journeyData.visitId);
      setSuccessMsg(t.journey.pharmacySuccess);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPharmacyLoading(false);
    }
  };

  const isVisitClosed = journeyData.visitStatus === 1 || journeyData.visitStatus === 'Closed';
  const isJourneyActive = journeyData.journeyStatus === 1 || journeyData.journeyStatus === 'Active';

  return (
    <div className="card" id="current-journey-card">
      <div className="card-header">
        <h2 className="card-title">🧭 {t.journey.title}</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button id="journey-refresh-btn" className="btn btn-outline btn-sm" onClick={onRefresh}>
            {getUiText(lang,"refresh")}
          </button>
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      {/* Status Indicators (BR-04, BR-05) */}
      <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
        <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.journey.visitStatus}:</span>
          <div style={{ marginTop: '0.25rem' }}>
            <span className={`badge ${isVisitClosed ? 'badge-closed' : 'badge-active'}`}>
              {isVisitClosed ? t.journey.closed : t.journey.active}
            </span>
          </div>
        </div>

        <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.journey.journeyStatus}:</span>
          <div style={{ marginTop: '0.25rem' }}>
            <span className={`badge ${journeyData.journeyStatus === 2 ? 'badge-completed' : 'badge-ready'}`}>
              {journeyData.journeyStatus === 2 ? t.journey.completed : isJourneyActive ? t.journey.active : t.journey.pendingActivation}
            </span>
          </div>
        </div>
      </div>

      {/* Current Guidance Banner */}
      <div
        className="alert"
        style={{
          backgroundColor: journeyData.waitOrProceed === 'Proceed' ? '#ecfdf5' : '#fffbeb',
          borderColor: journeyData.waitOrProceed === 'Proceed' ? '#a7f3d0' : '#fde68a',
          flexDirection: 'column',
          gap: '0.5rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: journeyData.waitOrProceed === 'Proceed' ? '#065f46' : '#92400e' }}>
            {journeyData.journeyStatus === 2 ? t.journey.completed : journeyData.waitOrProceed === 'Proceed' ? '🟢 ' + t.journey.proceed : '🟡 ' + t.journey.wait}
          </span>
          {journeyData.queueTicket && (
            <span className="badge badge-active" style={{ fontSize: '0.9rem' }}>
              {t.journey.queueTicket}: {journeyData.queueTicket}
            </span>
          )}
        </div>
        <p style={{ fontSize: '1rem', color: '#0f172a' }}>
          <strong>{t.journey.nextAction}:</strong> {lang === 'vi' ? journeyData.nextActionVi : journeyData.nextActionEn}
        </p>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
          📍 <strong>{t.journey.destination}:</strong> {lang === 'vi' ? journeyData.destinationVi : journeyData.destinationEn}
        </p>
      </div>

      {journeyData.queueUpdatedAt && <p>{getUiText(lang,"queue_updated")}: {new Date(journeyData.queueUpdatedAt + (journeyData.queueUpdatedAt.endsWith('Z') ? '' : 'Z')).toLocaleString()}</p>}
      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        <button className="btn btn-outline" onClick={() => {
          if (!window.speechSynthesis) return;
          window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(lang === 'vi' ? journeyData.nextActionVi : journeyData.nextActionEn); speech.lang = getUiText(lang,"en_us"); window.speechSynthesis.speak(speech);
        }}>{getUiText(lang,"listen")}</button>
        <button className="btn btn-outline" onClick={() => window.speechSynthesis?.cancel()}>{getUiText(lang,"stop")}</button>
        <button className="btn btn-outline" onClick={() => alert(lang === 'vi' ? journeyData.destinationVi : journeyData.destinationEn)}>{getUiText(lang,"navigate")}</button>
        <button className="btn btn-outline" onClick={async () => { try { await api.createAssistance({visitId:journeyData.visitId, category:'Navigation', description:lang === 'vi' ? journeyData.destinationVi : journeyData.destinationEn}); alert(getUiText(lang,"assistance_requested_2")); } catch(e) { alert((e as Error).message); } }}>{getUiText(lang,"request_assistance")}</button>
      </div>
      {/* Pharmacy Guidance Completion Button (BR-09, BR-11, BR-12) */}
      {journeyData.canCompletePharmacy && (
        <div className="card" style={{ borderColor: 'var(--secondary)', backgroundColor: '#f0fdfa', marginTop: '1rem' }}>
          <h4 style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>💊 {t.journey.completePharmacy}</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            {t.journey.completePharmacyNote}
          </p>
          <button
            id="complete-pharmacy-btn"
            className="btn btn-secondary btn-lg"
            onClick={handleCompletePharmacy}
            disabled={pharmacyLoading}
          >
            {pharmacyLoading ? '...' : `✓ ${t.journey.completePharmacy}`}
          </button>
        </div>
      )}

      {/* Step Checklist */}
      <h3 style={{ margin: '1.5rem 0 0.75rem', fontSize: '1.1rem' }}>{t.journey.stepList}</h3>
      <div id="journey-steps-list">
        {journeyData.steps.map((step: any, idx: number) => {
          const isCurrent = journeyData.currentStep?.id === step.id;
          return (
            <div key={step.id} className={`step-item ${isCurrent ? 'current' : ''}`} id={`step-item-${idx}`}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <strong>{idx + 1}. {getStepTypeLabel(step.stepType)}</strong>
                  {isCurrent && <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>BƯỚC HIỆN TẠI</span>}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  📍 {lang === 'vi' ? step.destinationVi : step.destinationEn}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  {lang === 'vi' ? step.instructionVi : step.instructionEn}
                </div>
              </div>
              <div>{getStepStatusBadge(step.status)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
