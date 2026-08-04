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

const SUB_TABS = [
  { id: 'themes', label: '1. Themes', Icon: Palette },
  { id: 'studio', label: '2. Studio', Icon: Edit3 },
  { id: 'layout', label: '3. Layout', Icon: Grid },
  { id: 'tmux',   label: '4. TMUX',   Icon: TmuxTabIcon }
];

export default function SettingsManager() {
  const [activeSubTab, setActiveSubTab] = useState('themes');
  const [resetCount, setResetCount] = useState(0);

  return (
    <div className="settings-master-container">
      {/* Equal-Distribution Dynamic Sub-Tab Bar */}
      <div className="settings-subtabs-bar">
        {SUB_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`subtab-btn ${activeSubTab === id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(id)}
          >
            <Icon size={13} />
            <span className="tab-auto-text">{label}</span>
          </button>
        ))}
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
