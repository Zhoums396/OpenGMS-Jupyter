/**
 * LLM Settings Panel
 * Configure LLM API for the assistant
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { agentApi, LLMConfig, LLMProvider } from '../services/agentApi';

interface LLMSettingsProps {
    onClose: () => void;
    onSaved?: () => void;
}

export const LLMSettings: React.FC<LLMSettingsProps> = ({ onClose, onSaved }) => {
    const [providers, setProviders] = useState<Record<string, LLMProvider>>({});
    const [config, setConfig] = useState<Partial<LLMConfig>>({
        provider: 'openai',
        apiKey: '',
        baseUrl: '',
        model: 'gpt-4o-mini'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Load configuration
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [providersData, configData] = await Promise.all([
                agentApi.getProviders(),
                agentApi.getConfig()
            ]);
            setProviders(providersData);
            setConfig(configData);
        } catch (error) {
            console.error('Failed to load LLM config:', error);
            setMessage({ type: 'error', text: 'Failed to load configuration' });
        } finally {
            setLoading(false);
        }
    };

    // Auto-fill defaults when provider changes
    const handleProviderChange = (provider: string) => {
        const providerInfo = providers[provider];
        setConfig(prev => ({
            ...prev,
            provider,
            baseUrl: providerInfo?.baseUrl || '',
            model: providerInfo?.defaultModel || '',
            // Keep the existing API key
            apiKey: prev.apiKey
        }));
    };

    // Save configuration
    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        
        try {
            await agentApi.saveConfig(config);
            setMessage({ type: 'success', text: 'Configuration saved' });
            onSaved?.();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save configuration' });
        } finally {
            setSaving(false);
        }
    };

    // Test connection
    const handleTest = async () => {
        setTesting(true);
        setMessage(null);
        
        try {
            // Save first to keep backend/runtime in sync
            await agentApi.saveConfig(config);
            // Then test
            const result = await agentApi.testConnection();
            setMessage({ type: 'success', text: `Connection successful. Model: ${result.model || 'unknown'}` });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Connection test failed' });
        } finally {
            setTesting(false);
        }
    };

    const currentProvider = providers[config.provider || 'openai'];

    if (loading) {
        return (
                <div className="llm-settings-panel">
                <div className="loading">Loading...</div>
            </div>
        );
    }

    return (
        <div className="llm-settings-panel">
            <div className="settings-header">
                <h3>🤖 LLM Configuration</h3>
                <button className="close-btn" onClick={onClose}>✕</button>
            </div>

            <div className="settings-content">
                {/* Provider */}
                <div className="form-group">
                    <label>LLM Provider</label>
                    <select
                        value={config.provider}
                        onChange={(e) => handleProviderChange(e.target.value)}
                    >
                        {Object.entries(providers).map(([key, provider]) => (
                            <option key={key} value={key}>
                                {provider.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* API Base URL */}
                <div className="form-group">
                    <label>API Base URL</label>
                    <input
                        type="text"
                        value={config.baseUrl}
                        onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                        placeholder={currentProvider?.baseUrl || 'https://api.openai.com/v1'}
                    />
                    <small>Leave empty to use the provider default</small>
                </div>

                {/* API Key */}
                {!currentProvider?.noApiKey && (
                    <div className="form-group">
                        <label>API Key</label>
                        <input
                            type="password"
                            value={config.apiKey}
                            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder={config.hasApiKey ? '***Configured*** (keep empty to reuse)' : 'Enter API key'}
                        />
                    </div>
                )}

                {/* Feedback */}
                {message && (
                    <div className={`message ${message.type}`}>
                        {message.type === 'success' ? '✓' : '✕'} {message.text}
                    </div>
                )}

                {/* Actions */}
                <div className="button-group">
                    <button
                        className="btn-secondary"
                        onClick={handleTest}
                        disabled={testing || saving}
                    >
                        {testing ? 'Testing...' : '🔗 Test Connection'}
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={saving || testing}
                    >
                        {saving ? 'Saving...' : '💾 Save Configuration'}
                    </button>
                </div>
            </div>

            <style>{`
                .llm-settings-panel {
                    padding: 16px;
                    background: var(--jp-layout-color1);
                    height: 100%;
                    overflow-y: auto;
                }
                
                .settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--jp-border-color1);
                }
                
                .settings-header h3 {
                    margin: 0;
                    font-size: 16px;
                    color: var(--jp-ui-font-color0);
                }
                
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: var(--jp-ui-font-color2);
                    padding: 4px 8px;
                    border-radius: 4px;
                }
                
                .close-btn:hover {
                    background: var(--jp-layout-color2);
                }
                
                .form-group {
                    margin-bottom: 16px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 500;
                    color: var(--jp-ui-font-color0);
                    font-size: 13px;
                }
                
                .form-group input,
                .form-group select {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--jp-border-color1);
                    border-radius: 4px;
                    background: var(--jp-layout-color0);
                    color: var(--jp-ui-font-color0);
                    font-size: 13px;
                    box-sizing: border-box;
                }
                
                .form-group input:focus,
                .form-group select:focus {
                    outline: none;
                    border-color: var(--jp-brand-color1);
                }
                
                .form-group small {
                    display: block;
                    margin-top: 4px;
                    color: var(--jp-ui-font-color2);
                    font-size: 11px;
                }
                
                .message {
                    padding: 10px 12px;
                    border-radius: 4px;
                    margin-bottom: 16px;
                    font-size: 13px;
                }
                
                .message.success {
                    background: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }
                
                .message.error {
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }
                
                .button-group {
                    display: flex;
                    gap: 12px;
                    margin-top: 20px;
                }
                
                .button-group button {
                    flex: 1;
                    padding: 10px 16px;
                    border: none;
                    border-radius: 4px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                
                .btn-primary {
                    background: var(--jp-brand-color1);
                    color: white;
                }
                
                .btn-primary:hover:not(:disabled) {
                    background: var(--jp-brand-color0);
                }
                
                .btn-secondary {
                    background: var(--jp-layout-color2);
                    color: var(--jp-ui-font-color0);
                }
                
                .btn-secondary:hover:not(:disabled) {
                    background: var(--jp-layout-color3);
                }
                
                .button-group button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                .loading {
                    text-align: center;
                    padding: 40px;
                    color: var(--jp-ui-font-color2);
                }
            `}</style>
        </div>
    );
};
