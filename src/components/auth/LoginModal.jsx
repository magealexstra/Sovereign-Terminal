import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';

/**
 * LoginModal — Sleek, centered authentication modal rendered when session is unauthenticated.
 */
export default function LoginModal({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        onLoginSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.detail || 'Invalid authentication token');
      }
    } catch (err) {
      setErrorMsg('Failed to connect to authentication server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-modal-overlay">
      <div className="login-modal-card">
        <div className="login-header">
          <div className="login-icon-badge">
            <Lock size={22} color="var(--accent-mana)" />
          </div>
          <h2>SOVEREIGN TERMINAL</h2>
          <p>Enter your session token to unlock the control workstation</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {errorMsg && (
            <div className="login-error-banner">
              <AlertCircle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="login-input-box">
            <KeyRound size={16} color="var(--text-muted)" />
            <input
              type="password"
              placeholder="Session Auth Token..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            <span>{loading ? 'Authenticating...' : 'Authenticate'}</span>
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
