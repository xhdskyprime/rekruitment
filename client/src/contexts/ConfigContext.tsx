import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface ConfigContextType {
    recruitmentPhase: 'registration' | 'verification' | 'announcement';
    refreshConfig: () => Promise<void>;
    loading: boolean;
}

const ConfigContext = createContext<ConfigContextType>({
    recruitmentPhase: 'registration',
    refreshConfig: async () => {},
    loading: true
});

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [recruitmentPhase, setRecruitmentPhase] = useState<'registration' | 'verification' | 'announcement'>('registration');
    const [loading, setLoading] = useState(true);

    const fetchConfig = async () => {
        try {
            console.log('[ConfigContext] Fetching config...');
            const response = await axios.get('/api/settings');
            console.log('[ConfigContext] API Response:', response.data);
            if (response.data && response.data.recruitmentPhase) {
                console.log('[ConfigContext] Updating recruitmentPhase to:', response.data.recruitmentPhase);
                setRecruitmentPhase(response.data.recruitmentPhase);
            }
        } catch (error) {
            console.error('[ConfigContext] Failed to fetch config:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    return (
        <ConfigContext.Provider value={{ recruitmentPhase, refreshConfig: fetchConfig, loading }}>
            {children}
        </ConfigContext.Provider>
    );
};
