import { useState, useRef } from 'react';

/**
 * useToast — lightweight self-dismissing toast hook.
 *
 * Returns:
 *   toast       {string|null}  Current message. Null when no toast is active.
 *   showToast   {function}     Call showToast(msg, ms?) to display a message.
 *                              Defaults to 2000ms auto-dismiss.
 *
 * Usage:
 *   const { toast, showToast } = useToast();
 *   showToast('Copied to Clipboard');
 *   // In JSX: {toast && <div className="copy-toast"><span>{toast}</span></div>}
 */
export function useToast(defaultDuration = 2000) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = (msg, ms = defaultDuration) => {
    setToast(msg);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), ms);
  };

  return { toast, showToast };
}
