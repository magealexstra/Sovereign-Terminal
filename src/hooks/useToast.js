import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * useToast — lightweight self-dismissing toast hook.
 *
 * Returns:
 *   toast       {string|null}  Current message. Null when no toast is active.
 *   showToast   {function}     Call showToast(msg, ms?) to display a message.
 *                              Defaults to 2000ms auto-dismiss. The function keeps
 *                              the same identity across renders, so it is safe in
 *                              effect dependency lists.
 *
 * Usage:
 *   const { toast, showToast } = useToast();
 *   showToast('Copied to Clipboard');
 *   // In JSX: {toast && <div className="copy-toast"><span>{toast}</span></div>}
 */
export function useToast(defaultDuration = 2000) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const defaultDurationRef = useRef(defaultDuration);
  defaultDurationRef.current = defaultDuration;

  const mountedRef = useRef(true);

  // A pending dismissal must not fire after the component is gone, and a late
  // call (for example when a request finishes after unmount) must not start a new one.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
    };
  }, []);

  const showToast = useCallback((msg, ms = defaultDurationRef.current) => {
    if (!mountedRef.current) return;
    setToast(msg);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), ms);
  }, []);

  return { toast, showToast };
}
