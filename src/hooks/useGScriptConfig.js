import { useState, useEffect } from 'react';
import { GS_META, DEFAULT_SCRIPT_URL, DEFAULT_SCRIPT_TOKEN } from '../constants';

export function useGScriptConfig() {
  // Always use hardcoded defaults to prevent user interference as requested
  const [cfg, setCfg] = useState({ url: DEFAULT_SCRIPT_URL, token: DEFAULT_SCRIPT_TOKEN });

  // Sync to localStorage only if needed for other parts of the app, 
  // but the source of truth is now constants.js
  useEffect(() => {
    localStorage.setItem(GS_META, JSON.stringify(cfg));
  }, [cfg]);

  return [cfg, setCfg];
}
