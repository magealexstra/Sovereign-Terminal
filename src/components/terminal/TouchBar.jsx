import React, { useState, useEffect } from 'react';
import { Terminal as TermIcon, Sliders, ChevronDown, Cpu, Shield, Wifi } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function TouchBar({ onSendKey }) {
  const { theme } = useApp();
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // Dynamic visualViewport tracker for mobile on-screen keyboard gliding
  useEffect(() => {
    const handleViewportResize = () => {
      if (window.visualViewport) {
        const offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
        setKeyboardOffset(offset);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
        window.visualViewport.removeEventListener('scroll', handleViewportResize);
      }
    };
  }, []);

  const touchKeys = [
    { label: 'ESC', value: '\x1b' },
    { label: 'TAB', value: '\t' },
    { label: 'CTRL', value: '\x11' },
    { label: 'ALT', value: '\x1b' },
    { label: '│', value: '|' },
    { label: '—', value: '-' },
    { label: '/', value: '/' },
    { label: '~', value: '~' },
    { label: '▲', value: '\x1b[A' },
    { label: '▼', value: '\x1b[B' },
    { label: '◄', value: '\x1b[D' },
    { label: '►', value: '\x1b[C' },
    { label: 'htop', value: 'htop\n' },
    { label: 'docker', value: 'docker ps\n' }
  ];

  return (
    <div
      className="touch-bar-gliding-wrapper"
      style={{
        transform: `translateY(-${keyboardOffset}px)`,
        transition: 'transform 0.1s ease-out'
      }}
    >
      <div className="touch-bar-scroll-strip">
        {touchKeys.map((k, idx) => (
          <button
            key={idx}
            type="button"
            className="touch-bar-pill-btn"
            onClick={() => onSendKey && onSendKey(k.value)}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
