import React, { createContext, useContext, useState, useEffect } from 'react';
import { gsFetch } from '../utils/google';
import { DEFAULT_DEPT_NAME, DEFAULT_YEAR } from '../constants';

const ConfigContext = createContext();

export const ConfigProvider = ({ children, gsCfg }) => {
    const [config, setConfig] = useState({
        spreadsheetId: "",
        deptName: DEFAULT_DEPT_NAME,
        year: DEFAULT_YEAR,
        receiptFolderId: "",
        memberPhotoFolderId: "",
        fellowshipFolderId: "",
        passwords: { admin: "33", guest: "30" },
        isLoaded: false
    });

    const fetchConfig = async () => {
        if (!gsCfg.url) return;
        try {
            const res = await gsFetch(gsCfg, 'getConfig', {});
            if (res.ok && res.config) {
                setConfig(prev => ({ ...prev, ...res.config, isLoaded: true }));
            } else {
                console.warn("Config fetch response not ok", res);
                setConfig(prev => ({ ...prev, isLoaded: true }));
            }
        } catch (e) {
            console.warn("Failed to fetch dynamic config", e);
            // 로드 실패 시 기본값 사용하지만 로딩 상태는 완료로 표시 (무한 로딩 방지)
            setConfig(prev => ({ ...prev, isLoaded: true }));
        }
    };

    useEffect(() => {
        if (gsCfg.url) {
            fetchConfig();
        } else {
            setConfig(prev => ({ ...prev, isLoaded: true }));
        }
    }, [gsCfg.url]);

    return (
        <ConfigContext.Provider value={{ config, refreshConfig: fetchConfig, isLoaded: config.isLoaded }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
};
