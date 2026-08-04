import React, { useState } from 'react';
import { Terminal as TermIcon, FileCode } from 'lucide-react';

export default function TypographyPreviewSection({
  theme,
  localTerminalScale,
  localTerminalPx,
  localEditorScale,
  localEditorPx,
}) {
  const [terminalSampleText, setTerminalSampleText] = useState(
    'mage@sovereign:~$ docker ps\nCONTAINER ID   IMAGE                STATUS\n896468d35eb4   sovereign-terminal   Up 30m (healthy)\nmage@sovereign:~$ echo "Theme Preview Active"'
  );

  const [editorSampleText, setEditorSampleText] = useState(
    'def initialize_sovereign_node(hostname="192.168.2.100"):\n    """Sovereign Workstation Node Gateway."""\n    print(f"Connected to {hostname}:2069")\n    return True'
  );

  return (
    <div className="live-font-preview-grid">
      <div className="preview-window-card">
        <div className="preview-card-header">
          <TermIcon size={12} color={theme?.accentHighlight || '#88C0D0'} />
          <span>Terminal ({Math.round(localTerminalScale * 100)}% — {localTerminalPx}px)</span>
        </div>
        <textarea
          className="live-preview-textarea"
          style={{
            backgroundColor: theme?.bgEarth || '#141E26',
            color: theme?.textParchment || '#E6EDF0',
            borderColor: theme?.accentMana || '#5E81AC',
            fontSize: `${localTerminalPx}px`,
            fontFamily: theme?.fontMono || 'monospace'
          }}
          value={terminalSampleText}
          onChange={(e) => setTerminalSampleText(e.target.value)}
        />
      </div>

      <div className="preview-window-card">
        <div className="preview-card-header">
          <FileCode size={12} color={theme?.accentMana || '#5E81AC'} />
          <span>Editor ({Math.round(localEditorScale * 100)}% — {localEditorPx}px)</span>
        </div>
        <textarea
          className="live-preview-textarea"
          style={{
            backgroundColor: theme?.bgCanopy || '#1F2D3A',
            color: theme?.textParchment || '#E6EDF0',
            borderColor: theme?.accentHighlight || '#88C0D0',
            fontSize: `${localEditorPx}px`,
            fontFamily: theme?.fontMono || 'monospace'
          }}
          value={editorSampleText}
          onChange={(e) => setEditorSampleText(e.target.value)}
        />
      </div>
    </div>
  );
}
