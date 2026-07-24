import React, { useState } from 'react';
import { Palette, Edit3, Layout } from 'lucide-react';
import ThemeSettings from './ThemeSettings';
import ButtonStudio from './ButtonStudio';
import LayoutBuilder from './LayoutBuilder';

export default function SettingsManager() {
  const [subTab, setSubTab] = useState('themes'); // 'themes' | 'studio' | 'layout'

  return (
    <div className="settings-manager-workspace">
      {/* Sub-Tab Navigation Bar */}
      <div className="settings-subtabs-bar">
        <button
          className={`subtab-btn ${subTab === 'themes' ? 'active' : ''}`}
          onClick={() => setSubTab('themes')}
        >
          <Palette size={15} />
          <span>1. Themes & Styling</span>
        </button>

        <button
          className={`subtab-btn ${subTab === 'studio' ? 'active' : ''}`}
          onClick={() => setSubTab('studio')}
        >
          <Edit3 size={15} />
          <span>2. Touch Button Studio</span>
        </button>

        <button
          className={`subtab-btn ${subTab === 'layout' ? 'active' : ''}`}
          onClick={() => setSubTab('layout')}
        >
          <Layout size={15} />
          <span>3. Grid & Dock Layout</span>
        </button>
      </div>

      {/* Sub-Tab Content Viewport */}
      <div className="settings-content-viewport">
        {subTab === 'themes' && <ThemeSettings />}
        {subTab === 'studio' && <ButtonStudio />}
        {subTab === 'layout' && <LayoutBuilder />}
      </div>
    </div>
  );
}
