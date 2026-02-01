import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import YouthBudgetApp from './YouthBudgetApp.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import { ConfigProvider } from './context/ConfigContext'
import { DEFAULT_SCRIPT_URL, DEFAULT_SCRIPT_TOKEN } from './constants'
import './index.css'

const Root = () => {
  // 간단하게 gsCfg를 여기서 관리하거나 useGScriptConfig 로직을 가져옵니다.
  const [gsCfg] = useState({ url: DEFAULT_SCRIPT_URL, token: DEFAULT_SCRIPT_TOKEN });

  return (
    <React.StrictMode>
      <ErrorBoundary>
        <ConfigProvider gsCfg={gsCfg}>
          <YouthBudgetApp />
        </ConfigProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
