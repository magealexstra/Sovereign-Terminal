import React, { createContext, useContext, useReducer } from 'react';

// State shape: { [path]: { state: 'downloading'|'cached'|'skip', percent: 0-100 } }
// 'path' is the raw file path string from the SW postMessage (e.g. '/srv/media/file.mkv')

const CacheStateContext = createContext(null);
const CacheDispatchContext = createContext(null);

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

// Module-level singleton — allows main.jsx to dispatch without being inside the React tree
let _dispatch = null;
export function _setCacheDispatch(fn) { _dispatch = fn; }
export function dispatchCacheMessage(action) { if (_dispatch) _dispatch(action); }

export function CacheStateProvider({ children }) {
  const [cacheState, dispatch] = useReducer(cacheReducer, {});
  
  // Set the singleton so external code (main.jsx) can dispatch
  _setCacheDispatch(dispatch);

  return (
    <CacheStateContext.Provider value={cacheState}>
      <CacheDispatchContext.Provider value={dispatch}>
        {children}
      </CacheDispatchContext.Provider>
    </CacheStateContext.Provider>
  );
}

export function useCacheState() {
  return useContext(CacheStateContext);
}
