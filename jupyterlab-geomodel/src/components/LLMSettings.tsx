/**
 * LLM Settings Panel
 * 用户配置 LLM API 的界面
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

    // 加载配置
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
            console.error('加载配置失败:', error);
            setMessage({ type: 'error', text: '加载配置失败' });
        } finally {
            setLoading(false);
        }
    };

    // 选择 Provider 时自动填充默认值
    const handleProviderChange = (provider: string) => {
        const providerInfo = providers[provider];
        setConfig(prev => ({
            ...prev,
            provider,
            baseUrl: providerInfo?.baseUrl || '',
            model: providerInfo?.defaultModel || '',
            // 保留已有的 apiKey
            apiKey: prev.apiKey
        }));
    };

    // 保存配置
    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        
        try {
            await agentApi.saveConfig(config);
            setMessage({ type: 'success', text: '配置已保存' });
            onSaved?.();
        } catch (error) {
            setMessage({ type: 'error', text: '保存失败' });
        } finally {
            setSaving(false);
        }
    };

    // 测试连接
    const handleTest = async () => {
        setTesting(true);
        setMessage(null);
        
        try {
            // 先保存配置
            await agentApi.saveConfig(config);
            // 再测试
            const result = await agentApi.testConnection();
            setMessage({ type: 'success', text: `连接成功！模型: ${result.model}` });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || '连接测试失败' });
        } finally {
            setTesting(false);
        }
    };

    const currentProvider = providers[config.provider || 'openai'];

    if (loading) {
        return (
            <div className="llm-settings-panel">
                <div className="loading">加载中...</div>
            </div>
        );
    }

    return (
        <div className="llm-settings-panel">
            <div className="settings-header">
                <h3>🤖 LLM 配置</h3>
                <button className="close-btn" onClick={onClose}>✕</button>
            </div>

            <div className="settings-content">
                {/* Provider 选择 */}
                <div className="form-group">
                    <label>LLM 服务商</label>
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
                    <small>留空使用默认地址</small>
                </div>

                {/* API Key */}
                {!currentProvider?.noApiKey && (
                    <div className="form-group">
                        <label>API Key</label>
                        <input
                            type="password"
                            value={config.apiKey}
                            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder={config.hasApiKey ? '***已配置*** (留空保持不变)' : '请输入 API Key'}
                        />
                    </div>
                )}

                {/* 模型选择 */}
                <div className="form-group">
                    <label>模型</label>
                    {currentProvider?.models && currentProvider.models.length > 0 ? (
                        <select
                            value={config.model}
                            onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                        >
                            {currentProvider.models.map((model) => (
                                <option key={model} value={model}>
                                    {model}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={config.model}
                            onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                            placeholder="输入模型名称"
                        />
                    )}
                </div>

                {/* 消息提示 */}
                {message && (
                    <div className={`message ${message.type}`}>
                        {message.type === 'success' ? '✓' : '✕'} {message.text}
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="button-group">
                    <button
                        className="btn-secondary"
                        onClick={handleTest}
                        disabled={testing || saving}
                    >
                        {testing ? '测试中...' : '🔗 测试连接'}
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={saving || testing}
                    >
                        {saving ? '保存中...' : '💾 保存配置'}
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
