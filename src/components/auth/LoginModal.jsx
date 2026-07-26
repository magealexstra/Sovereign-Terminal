import React, { useState } from 'react';
import { Lock, KeyRound, User, AlertCircle, ArrowRight } from 'lucide-react';

/**
 * LoginModal — Sleek, centered authentication modal that dynamically adapts UI based on authMode ('token' vs 'pam').
 */
export default function LoginModal({ authMode = 'token', onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const isPam = authMode === 'pam';

  const [saveSudoPass, setSaveSudoPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPam && (!username.trim() || !password.trim())) return;
    if (!isPam && !password.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = isPam ? { username: username.trim(), password } : { password };
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (saveSudoPass && password) {
          sessionStorage.setItem('sovereign_sudo_password', password);
        } else {
          sessionStorage.removeItem('sovereign_sudo_password');
        }
        onLoginSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.detail || (isPam ? 'Invalid Linux OS username or password' : 'Invalid authentication token'));
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
          <p>
            {isPam
              ? 'Enter your Linux OS system account credentials to unlock workstation'
              : 'Enter your session token to unlock the control workstation'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {errorMsg && (
            <div className="login-error-banner">
              <AlertCircle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}

          {isPam && (
            <div className="login-input-box">
              <User size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Linux Username..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
          )}

          <div className="login-input-box">
            <KeyRound size={16} color="var(--text-muted)" />
            <input
              type="password"
              placeholder={isPam ? 'Password...' : 'Session Auth Token...'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus={!isPam}
              required
            />
          </div>

          {isPam && (
            <label className="login-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.76rem', color: 'var(--text-muted)', cursor: 'pointer', margin: '0.2rem 0 0.6rem 0.2rem' }}>
              <input
                type="checkbox"
                checked={saveSudoPass}
                onChange={(e) => setSaveSudoPass(e.target.checked)}
                style={{ accentColor: 'var(--accent-mana)', cursor: 'pointer' }}
              />
              <span>Save password for quick sudo entry</span>
            </label>
          )}

          <button type="submit" className="login-submit-btn" disabled={loading}>
            <span>{loading ? 'Authenticating...' : 'Authenticate'}</span>
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
