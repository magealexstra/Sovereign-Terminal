import React, { createContext, useContext, useReducer, useEffect } from 'react';

// State shape: { [path]: { state: 'downloading'|'cached'|'skip', percent: 0-100 } }
// 'path' is the raw file path string from the SW postMessage (e.g. '/srv/media/file.mkv')

const CacheStateContext = createContext(null);

function cacheReducer(state, action) {
  switch (action.type) {
    case 'cache-progress':
      return { ...state, [action.path]: { state: 'downloading', percent: action.percent } };
    case 'cache-complete':
      return { ...state, [action.path]: { state: 'cached', percent: 100 } };
    case 'cache-skip':
      return { ...state, [action.path]: { state: 'skip', percent: 0 } };
    default:
      return state;
  }
}

// Module-level singleton — allows main.jsx to dispatch without being inside the React tree.
// It holds the mounted provider's dispatch and is empty while no provider is mounted.
let _dispatch = null;
export function dispatchCacheMessage(action) { if (_dispatch) _dispatch(action); }

export function CacheStateProvider({ children }) {
  const [cacheState, dispatch] = useReducer(cacheReducer, {});

  // Set the singleton so external code (main.jsx) can dispatch, and clear it when the provider unmounts.
  useEffect(() => {
    _dispatch = dispatch;
    return () => {
      if (_dispatch === dispatch) _dispatch = null;
    };
  }, [dispatch]);

  return (
    <CacheStateContext.Provider value={cacheState}>
      {children}
    </CacheStateContext.Provider>
  );
}

export function useCacheState() {
  return useContext(CacheStateContext);
}
