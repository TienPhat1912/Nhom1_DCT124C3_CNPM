import { QrScanner } from './QrScanner';
import React, { useState } from 'react';
import { api } from '../api';
import { getDictionary, Language } from '../../../../packages/i18n/src/index';

interface Props {
  lang: Language;
  onTicketRedeemed: (journey: any) => void;
}

export const TicketRedemption: React.FC<Props> = ({ lang, onTicketRedeemed }) => {
  const t = getDictionary(lang);
  const [tokenInput, setTokenInput] = useState(new URLSearchParams(window.location.search).get('ticket') || sessionStorage.getItem('pendingTicket') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const journey = await api.redeemTicket(tokenInput.includes('?ticket=') ? new URL(tokenInput).searchParams.get('ticket') || tokenInput.trim() : tokenInput.trim());
      sessionStorage.removeItem('pendingTicket');
      onTicketRedeemed(journey);
    } catch (err: any) {
      setError(err.message || t.ticket.invalidQr);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" id="ticket-redemption-card">
      <div className="card-header">
        <h2 className="card-title">🎟️ {t.ticket.title}</h2>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
        {t.ticket.scanOrEnter}
      </p>

      {error && (
        <div className="alert alert-danger" id="ticket-error-alert">
          <span>⚠️ {error}</span>
        </div>
      )}

      <QrScanner lang={lang} onCode={setTokenInput} />
      <form onSubmit={handleRedeem} id="redeem-ticket-form">
        <div className="form-group">
          <label className="form-label" htmlFor="ticket-token-input">{t.ticket.enterCode}</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="ticket-token-input"
              type="text"
              className="form-control"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="TKT_..."
              required
            />
            <button
              id="redeem-ticket-submit-btn"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? '...' : t.ticket.activateBtn}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
