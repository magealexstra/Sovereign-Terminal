import React, { useState, Component } from 'react';
import { Palette, Edit3, Grid, AlertTriangle, Terminal as TmuxTabIcon } from 'lucide-react';

import ThemeSettings from './ThemeSettings';
import ButtonStudio from './ButtonStudio';
import LayoutBuilder from './LayoutBuilder';
import TmuxManager from './TmuxManager';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Settings Sub-Tab Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-parchment)' }}>
          <AlertTriangle size={32} color="var(--status-danger)" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Sub-Tab Display Recovered</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>A minor rendering variance occurred.</p>
          {this.state.error && (
            <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(255, 0, 60, 0.15)', border: '1px solid var(--status-danger)', borderRadius: '8px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textAlign: 'left', wordBreak: 'break-all' }}>
              {this.state.error.toString()}
            </div>
          )}
          <button
            type="button"
            style={{
              marginTop: '1rem',
              padding: '0.4rem 0.8rem',
              background: 'var(--accent-mana)',
              color: 'var(--bg-earth)',
              border: 'none',
              borderRadius: '14px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
            }}
          >
            Reload Settings View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SettingsManager() {
  const [activeSubTab, setActiveSubTab] = useState('themes');
  const [resetCount, setResetCount] = useState(0);

  return (
    <div className="settings-master-container">
      {/* Equal-Distribution Dynamic Sub-Tab Bar */}
      <div className="settings-subtabs-bar">
        <button
          type="button"
          className={`subtab-btn ${activeSubTab === 'themes' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('themes')}
        >
          <Palette size={13} />
          <span className="tab-auto-text">1. Themes</span>
        </button>

        <button
          type="button"
          className={`subtab-btn ${activeSubTab === 'studio' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('studio')}
        >
          <Edit3 size={13} />
          <span className="tab-auto-text">2. Studio</span>
        </button>

        <button
          type="button"
          className={`subtab-btn ${activeSubTab === 'layout' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('layout')}
        >
          <Grid size={13} />
          <span className="tab-auto-text">3. Layout</span>
        </button>

        <button
          type="button"
          className={`subtab-btn ${activeSubTab === 'tmux' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('tmux')}
        >
          <TmuxTabIcon size={13} />
          <span className="tab-auto-text">4. TMUX</span>
        </button>
      </div>

      {/* Active Sub-Tab Viewport protected by ErrorBoundary */}
      <div className="settings-content-viewport">
        <ErrorBoundary key={`${activeSubTab}-${resetCount}`} onReset={() => setResetCount((c) => c + 1)}>
          {activeSubTab === 'themes' && <ThemeSettings />}
          {activeSubTab === 'studio' && <ButtonStudio />}
          {activeSubTab === 'layout' && <LayoutBuilder />}
          {activeSubTab === 'tmux'   && <TmuxManager />}
        </ErrorBoundary>
      </div>
    </div>
  );
}
