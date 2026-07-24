import React, { useState } from 'react';
import { Palette, Edit3, Grid } from 'lucide-react';

import ThemeSettings from './ThemeSettings';
import ButtonStudio from './ButtonStudio';
import LayoutBuilder from './LayoutBuilder';

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

      {/* Active Sub-Tab Viewport */}
      <div className="settings-content-viewport">
        {activeSubTab === 'themes' && <ThemeSettings />}
        {activeSubTab === 'studio' && <ButtonStudio />}
        {activeSubTab === 'layout' && <LayoutBuilder />}
      </div>
    </div>
  );
}
