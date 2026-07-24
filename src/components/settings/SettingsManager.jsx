import React, { useState, Component } from 'react';
import { Palette, Edit3, Grid, AlertTriangle } from 'lucide-react';

import ThemeSettings from './ThemeSettings';
import ButtonStudio from './ButtonStudio';
import LayoutBuilder from './LayoutBuilder';

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
        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#E6EDF0' }}>
          <AlertTriangle size={32} color="#FF003C" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Sub-Tab Display Recovered</h3>
          <p style={{ fontSize: '0.8rem', color: '#A3B1B8' }}>A minor rendering variance occurred.</p>
          <button
            style={{
              marginTop: '1rem',
              padding: '0.4rem 0.8rem',
              background: '#88C0D0',
              color: '#0A1118',
              border: 'none',
              borderRadius: '14px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
            onClick={() => this.setState({ hasError: false })}
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
      </div>

      {/* Active Sub-Tab Viewport protected by ErrorBoundary */}
      <div className="settings-content-viewport">
        <ErrorBoundary>
          {activeSubTab === 'themes' && <ThemeSettings />}
          {activeSubTab === 'studio' && <ButtonStudio />}
          {activeSubTab === 'layout' && <LayoutBuilder />}
        </ErrorBoundary>
      </div>
    </div>
  );
}
