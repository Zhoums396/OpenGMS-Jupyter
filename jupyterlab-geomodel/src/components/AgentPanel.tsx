/**
 * Agent Chat Panel
 * AI 助手聊天界面，放置在左侧边栏
 */

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { INotebookTracker } from '@jupyterlab/notebook';
import { NotebookActions } from '@jupyterlab/notebook';
import { agentApi, ChatMessage, StreamEvent, ChatContext, ToolCall, WorkspaceFiles, Conversation, AgentCase } from '../services/agentApi';
import { LLMSettings } from './LLMSettings';
import { ChatHistory } from './ChatHistory';
import { renderMarkdown } from '../utils/markdownRenderer';
import { FAVICON_BASE64 } from '../assets';

/**
 * 获取 API 基础 URL（与 agentApi.ts 保持一致）
 */
function getApiBase(): string {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        return `http://${hostname}:3000`;
    }
    return 'http://localhost:3000';
}

/**
 * 获取认证 token
 */
function getToken(): string | null {
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('geomodel_token');
        if (tokenFromUrl) {
            localStorage.setItem('geomodel_jwt', tokenFromUrl);
            return tokenFromUrl;
        }
        return localStorage.getItem('geomodel_jwt');
    }
    return null;
}

/**
 * 构建带认证的请求头
 */
function getAuthHeaders(): Record<string, string> {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

interface AgentPanelProps {
    notebookTracker?: INotebookTracker;
    app?: any; // JupyterFrontEnd - used for creating notebooks
}

/** ThoughtChain step data */
interface ThoughtStep {
    id: number;
    title: string;
    status: 'running' | 'done' | 'error';
    startTime: number;
    endTime?: number;
}

/** Extended message type with thought chain */
type ExtendedMessage = ChatMessage & {
    executedActions?: string[];
    thoughtSteps?: ThoughtStep[];
};

export const AgentPanel: React.FC<AgentPanelProps> = ({ notebookTracker, app }) => {
    const [messages, setMessages] = useState<ExtendedMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [hasConfig, setHasConfig] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [executedTools, setExecutedTools] = useState<string[]>([]);
    const [smartCases, setSmartCases] = useState<AgentCase[]>([]);
    const [isLoadingCases, setIsLoadingCases] = useState(false);
    const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
    
    // 历史对话相关状态
    const [showHistory, setShowHistory] = useState(false);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string>('default_user');
    const [conversationTitle, setConversationTitle] = useState<string>('New Chat');
    
    // ThoughtChain 跟踪
    const [activeThoughtSteps, setActiveThoughtSteps] = useState<ThoughtStep[]>([]);
    const thoughtStepsRef = useRef<ThoughtStep[]>([]);
    const thoughtStepIdRef = useRef(0);
    const thoughtChainStartRef = useRef(0);
    
    // Model 选择器
    const [currentModel, setCurrentModel] = useState('');
    const [availableModels, setAvailableModels] = useState<Array<{provider: string; model: string; label: string}>>([]);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    
    // Chat mode: 'agent' (full tool loop) or 'ask' (simple Q&A)
    const [chatMode, setChatMode] = useState<'agent' | 'ask'>('agent');
    
    // File upload
    const [attachedFiles, setAttachedFiles] = useState<Array<{name: string; size: number; uploaded: boolean}>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    // 跟踪 agent 最后操作的 cell 索引，防止用户点击其他 cell 导致插入位置错乱
    const lastAgentCellIndexRef = useRef<number>(-1);

    // 初始化用户ID（从 localStorage 或生成）
    useEffect(() => {
        const storedUserId = localStorage.getItem('geomodel_user_id');
        if (storedUserId) {
            setUserId(storedUserId);
        } else {
            const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('geomodel_user_id', newUserId);
            setUserId(newUserId);
        }
    }, []);

    // 保存对话历史到服务器
    const saveConversationHistory = useCallback(async (convId: string, userMsg: string, assistantMsg: string) => {
        if (!convId) return;
        
        try {
            // 保存用户消息
            if (userMsg) {
                await agentApi.addMessageToConversation(convId, 'user', userMsg, userId);
            }
            // 保存助手消息
            if (assistantMsg) {
                await agentApi.addMessageToConversation(convId, 'assistant', assistantMsg, userId);
            }
        } catch (e) {
            console.warn('[Agent] Failed to save conversation history:', e);
        }
    }, [userId]);

    // 切换思考过程的展开/折叠状态
    const toggleThinking = (messageIndex: number) => {
        setExpandedThinking(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageIndex)) {
                newSet.delete(messageIndex);
            } else {
                newSet.add(messageIndex);
            }
            return newSet;
        });
    };

    // ==================== ThoughtChain helpers ====================
    const addThoughtStep = (title: string): number => {
        const id = ++thoughtStepIdRef.current;
        const step: ThoughtStep = { id, title, status: 'running', startTime: Date.now() };
        thoughtStepsRef.current = [...thoughtStepsRef.current, step];
        setActiveThoughtSteps([...thoughtStepsRef.current]);
        return id;
    };

    const completeThoughtStep = (id: number) => {
        thoughtStepsRef.current = thoughtStepsRef.current.map(s =>
            s.id === id ? { ...s, status: 'done', endTime: Date.now() } : s
        );
        setActiveThoughtSteps([...thoughtStepsRef.current]);
    };

    const failThoughtStep = (id: number) => {
        thoughtStepsRef.current = thoughtStepsRef.current.map(s =>
            s.id === id ? { ...s, status: 'error', endTime: Date.now() } : s
        );
        setActiveThoughtSteps([...thoughtStepsRef.current]);
    };

    const resetThoughtChain = () => {
        thoughtStepsRef.current = [];
        thoughtStepIdRef.current = 0;
        thoughtChainStartRef.current = Date.now();
        setActiveThoughtSteps([]);
    };

    // ==================== Model selector ====================
    const loadModelsData = async () => {
        try {
            const [config, providers] = await Promise.all([
                agentApi.getConfig(),
                agentApi.getProviders()
            ]);
            setCurrentModel(config.model || '');

            const models: Array<{provider: string; model: string; label: string}> = [];
            // Add current model first
            if (config.model) {
                models.push({ provider: config.provider, model: config.model, label: config.model });
            }
            // Add custom models from config
            if (config.customModels?.length) {
                config.customModels.forEach(m => {
                    if (!models.find(e => e.model === m)) {
                        models.push({ provider: config.provider, model: m, label: m });
                    }
                });
            }
            // Add provider models
            Object.entries(providers).forEach(([key, provider]) => {
                provider.models.forEach(m => {
                    if (!models.find(e => e.model === m)) {
                        models.push({ provider: key, model: m, label: m });
                    }
                });
            });
            setAvailableModels(models);
        } catch (e) {
            console.warn('[Agent] Failed to load models:', e);
        }
    };

    const handleModelChange = async (model: string) => {
        setCurrentModel(model);
        setShowModelDropdown(false);
        try {
            // Find the provider that owns this model and sync provider/baseUrl
            const match = availableModels.find(m => m.model === model);
            if (match && match.provider) {
                await agentApi.saveConfig({ model, provider: match.provider });
            } else {
                await agentApi.saveConfig({ model });
            }
        } catch (e) {
            console.warn('[Agent] Failed to save model selection:', e);
        }
    };

    // ==================== File upload ====================
    /**
     * Upload file to Jupyter workspace via Contents API.
     * Text files use 'text' format, binary files use 'base64' format.
     */
    const uploadToJupyter = async (file: File): Promise<boolean> => {
        try {
            const isText = /\.(txt|csv|tsv|json|geojson|py|r|md|yaml|yml|xml|html|js|ts|toml|ini|cfg|log|sh|bat|sql|tex|bib)$/i.test(file.name);

            let body: any;
            if (isText) {
                const text = await file.text();
                body = {
                    type: 'file',
                    format: 'text',
                    name: file.name,
                    content: text
                };
            } else {
                // Binary file → base64
                const buffer = await file.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const b64 = btoa(binary);
                body = {
                    type: 'file',
                    format: 'base64',
                    name: file.name,
                    content: b64
                };
            }

            // Use Jupyter Contents API: PUT /api/contents/{path}
            const jupyterBase = window.location.origin;
            const basePath = (window as any).jupyterlab?.baseUrl || '/';
            const apiUrl = `${jupyterBase}${basePath}api/contents/${encodeURIComponent(file.name)}`;

            // Get XSRF token from cookie
            const xsrfMatch = document.cookie.match(/(?:^|;\s*)_xsrf=([^;]*)/);
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (xsrfMatch) {
                headers['X-XSRFToken'] = decodeURIComponent(xsrfMatch[1]);
            }

            const resp = await fetch(apiUrl, {
                method: 'PUT',
                headers,
                body: JSON.stringify(body)
            });

            if (!resp.ok) {
                console.error('[Upload] Jupyter API error:', resp.status, await resp.text());
                return false;
            }
            console.log('[Upload] Uploaded to Jupyter workspace:', file.name);
            return true;
        } catch (e) {
            console.error('[Upload] Failed:', e);
            return false;
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const MAX_SIZE = 50 * 1024 * 1024; // 50MB
        setIsUploading(true);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > MAX_SIZE) {
                alert(`文件 "${file.name}" 超过 50MB 上限`);
                continue;
            }

            // Actually upload to Jupyter workspace
            const success = await uploadToJupyter(file);
            setAttachedFiles(prev => [...prev, {
                name: file.name,
                size: file.size,
                uploaded: success
            }]);
        }

        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachedFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // 检查是否已配置 LLM
    useEffect(() => {
        checkConfig();
        loadSmartCases();
        loadModelsData();
    }, []);

    const checkConfig = async () => {
        try {
            const config = await agentApi.getConfig();
            setHasConfig(!!config.hasApiKey);
        } catch (e) {
            setHasConfig(false);
        }
    };

    const loadSmartCases = async () => {
        try {
            setIsLoadingCases(true);
            const cases = await agentApi.getCases();
            setSmartCases(cases.slice(0, 3));
        } catch (e) {
            console.warn('[Agent] Failed to load smart cases:', e);
            setSmartCases([]);
        } finally {
            setIsLoadingCases(false);
        }
    };

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    // 缓存的工作目录文件
    const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFiles | null>(null);

    // 获取当前项目名称
    const getProjectName = useCallback((): string => {
        if (notebookTracker?.currentWidget) {
            // 从 notebook 路径中提取项目名称
            const path = notebookTracker.currentWidget.context.path;
            console.log('[Agent] Notebook path:', path);
            // 通常路径格式为 projectName/notebook.ipynb
            const parts = path.split('/');
            if (parts.length > 1) {
                return parts[0];
            }
            // 如果没有子目录，可能整个工作目录就是项目
            return '';
        }
        // 尝试从 URL 获取
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const project = urlParams.get('project');
            if (project) {
                return project;
            }
            // 尝试从 pathname 解析
            const pathMatch = window.location.pathname.match(/\/lab\/tree\/([^/]+)/);
            if (pathMatch) {
                return decodeURIComponent(pathMatch[1]);
            }
        }
        return '';
    }, [notebookTracker]);

    const getWorkspaceUserName = useCallback((): string => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const user = params.get('user') || params.get('userName');
            if (user) {
                return user;
            }
        }
        const userInfo = localStorage.getItem('geomodel_user');
        if (userInfo) {
            try {
                const parsed = JSON.parse(userInfo);
                return parsed.login || parsed.userName || parsed.username || '';
            } catch (e) {
                return '';
            }
        }
        return '';
    }, []);

    // 扫描工作目录数据
    const scanWorkspaceData = useCallback(async (): Promise<WorkspaceFiles> => {
        try {
            const projectName = getProjectName();
            console.log('[Agent] Scanning workspace for project:', projectName);
            const files = await agentApi.scanWorkspace(projectName);
            console.log('[Agent] Workspace files found:', files.totalFiles);
            setWorkspaceFiles(files);
            return files;
        } catch (e) {
            console.warn('[Agent] Workspace scan failed:', e);
            return { totalFiles: 0, vector: [], raster: [], table: [], other: [] };
        }
    }, [getProjectName]);

    // 获取当前 Notebook 上下文（包含工作目录数据）
    const getNotebookContext = useCallback(async (): Promise<ChatContext> => {
        const context: ChatContext = {};
        context.projectName = getProjectName();
        context.userName = getWorkspaceUserName();
        
        if (notebookTracker?.currentWidget) {
            const notebook = notebookTracker.currentWidget;
            context.notebookName = notebook.title.label;
            
            // 获取当前选中的单元格代码
            const activeCell = notebook.content.activeCell;
            if (activeCell && activeCell.model.type === 'code') {
                context.currentCellCode = activeCell.model.sharedModel.source;
            }
            
            // 获取工作目录
            const path = notebook.context.path;
            const parts = path.split('/');
            if (parts.length > 1) {
                context.workingDirectory = parts.slice(0, -1).join('/');
            }
        }
        
        // 添加工作目录文件信息
        if (!workspaceFiles || workspaceFiles.totalFiles === 0) {
            // 首次或需要刷新时扫描
            context.workspaceFiles = await scanWorkspaceData();
        } else {
            context.workspaceFiles = workspaceFiles;
        }
        
        return context;
    }, [notebookTracker, workspaceFiles, scanWorkspaceData, getProjectName, getWorkspaceUserName]);

    // 工具执行结果类型（支持附带图片用于视觉检测）
    interface ToolExecutionResult {
        result: string;
        images?: string[];  // base64 PNG 图片数据
    }

    // 执行工具调用
    const executeToolCall = useCallback(async (tool: ToolCall): Promise<ToolExecutionResult> => {
        console.log('[Agent] Executing tool:', tool.name, tool.arguments);
        
        let notebook = notebookTracker?.currentWidget;

        try {
            const args = JSON.parse(tool.arguments || '{}');
            
            // 如果没有打开的 notebook，自动创建并打开一个
            if (!notebook) {
                if (app) {
                    console.log('[Agent] No notebook open, auto-creating one...');
                    try {
                        // 1. 创建 notebook 文件
                        const model: any = await app.commands.execute('docmanager:new-untitled', {
                            type: 'notebook'
                        });
                        
                        // 2. 用 docmanager:open 打开它
                        if (model && model.path) {
                            console.log('[Agent] Created notebook file:', model.path);
                            await app.commands.execute('docmanager:open', {
                                path: model.path,
                                factory: 'Notebook',
                                kernel: { name: 'python3' }
                            });
                        }
                        
                        // 等待 notebook tracker 捕获到新的 notebook
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        notebook = notebookTracker?.currentWidget;
                        
                        if (!notebook) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            notebook = notebookTracker?.currentWidget;
                        }
                        
                        if (notebook) {
                            await notebook.sessionContext.ready;
                            console.log('[Agent] Notebook opened and ready:', notebook.title.label);
                        }
                    } catch (createErr) {
                        console.error('[Agent] Failed to auto-create notebook:', createErr);
                    }
                }
                
                if (!notebook) {
                    return { result: 'Error: No notebook is currently open and auto-creation failed. Please manually create a notebook in JupyterLab (File → New → Notebook).' };
                }
            }
            
            switch (tool.name) {
                case 'edit_code_cell': {
                    const cellIndex = args.cell_index;
                    const newCode = args.new_code || '';
                    const oldCode = args.old_code || '';
                    const replacementCode = args.replacement_code || '';
                    
                    // Validate cell_index
                    const totalCells = notebook.content.widgets.length;
                    if (cellIndex === undefined || cellIndex === null || cellIndex < 0 || cellIndex >= totalCells) {
                        return { result: `Error: Invalid cell_index ${cellIndex}. Notebook has ${totalCells} cells (0-${totalCells - 1}).` };
                    }
                    
                    const targetCell = notebook.content.widgets[cellIndex];
                    if (!targetCell || !targetCell.model) {
                        return { result: `Error: Cannot access cell at index ${cellIndex}.` };
                    }
                    
                    const currentSource = targetCell.model.sharedModel.getSource();
                    let updatedCode: string;
                    
                    if (oldCode && replacementCode !== undefined) {
                        // Incremental edit: replace old_code with replacement_code
                        if (!currentSource.includes(oldCode)) {
                            return { result: `Error: Could not find the specified old_code in cell ${cellIndex}. The cell content may have changed. Current cell content:\n${currentSource.slice(0, 500)}` };
                        }
                        updatedCode = currentSource.replace(oldCode, replacementCode);
                    } else if (newCode) {
                        // Full replacement
                        updatedCode = newCode;
                    } else {
                        return { result: 'Error: Must provide either new_code (full replace) or old_code+replacement_code (incremental edit).' };
                    }
                    
                    // Apply the edit
                    targetCell.model.sharedModel.setSource(updatedCode);
                    // Select the cell (but do NOT update lastAgentCellIndexRef — editing
                    // an existing cell should not change where the next NEW cell gets inserted)
                    notebook.content.activeCellIndex = cellIndex;
                    
                    // Re-execute the cell
                    await NotebookActions.run(notebook.content, notebook.sessionContext);
                    
                    // Wait for output
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Capture output (same logic as add_code_cell)
                    let cellOutput = '';
                    const editCapturedImages: string[] = [];
                    try {
                        const cellModel = targetCell.model as any;
                        const outputs = cellModel.outputs;
                        if (outputs && outputs.length > 0) {
                            const outputParts: string[] = [];
                            const MAX_OUTPUT_CHARS = 3000;
                            let totalChars = 0;
                            
                            for (let i = 0; i < outputs.length && totalChars < MAX_OUTPUT_CHARS; i++) {
                                const output = outputs.get(i);
                                const json = output.toJSON();
                                
                                if (json.output_type === 'error') {
                                    const errorMsg = `ERROR - ${json.ename}: ${json.evalue}`;
                                    outputParts.push(errorMsg);
                                    if (json.traceback && Array.isArray(json.traceback)) {
                                        const tb = json.traceback.map((line: string) => 
                                            line.replace(/\u001b\[[0-9;]*m/g, '')
                                        );
                                        outputParts.push(tb.slice(-5).join('\n'));
                                    }
                                    totalChars += errorMsg.length;
                                } else if (json.output_type === 'stream') {
                                    const text = typeof json.text === 'string' ? json.text : (json.text || []).join('');
                                    if (text.trim()) {
                                        const truncated = text.length > 1000 ? text.slice(0, 1000) + '...(truncated)' : text;
                                        outputParts.push(`[${json.name || 'stdout'}]: ${truncated}`);
                                        totalChars += truncated.length;
                                    }
                                } else if (json.output_type === 'execute_result') {
                                    const textData = json.data?.['text/plain'] || '';
                                    if (textData) {
                                        const truncated = textData.length > 1000 ? textData.slice(0, 1000) + '...(truncated)' : textData;
                                        outputParts.push(`[result]: ${truncated}`);
                                        totalChars += truncated.length;
                                    }
                                } else if (json.output_type === 'display_data') {
                                    if (json.data?.['image/png']) {
                                        outputParts.push('[display]: Chart/image generated — attached for visual inspection');
                                        // 捕获 base64 PNG 用于视觉检测（限制 500KB）
                                        const pngBase64 = json.data['image/png'];
                                        if (pngBase64 && pngBase64.length < 500000) {
                                            editCapturedImages.push(pngBase64);
                                            console.log(`[Agent] Captured image for visual inspection (${Math.round(pngBase64.length / 1024)}KB)`);
                                        }
                                    } else if (json.data?.['image/svg+xml']) {
                                        outputParts.push('[display]: SVG image generated successfully');
                                    } else if (json.data?.['text/plain']) {
                                        const truncated = json.data['text/plain'].length > 500 ? json.data['text/plain'].slice(0, 500) + '...(truncated)' : json.data['text/plain'];
                                        outputParts.push(`[display]: ${truncated}`);
                                        totalChars += truncated.length;
                                    }
                                }
                            }
                            
                            if (outputParts.length > 0) {
                                cellOutput = '\n--- Cell Output ---\n' + outputParts.join('\n');
                            }
                        }
                    } catch (outputErr) {
                        console.warn('[Agent] Failed to capture cell output:', outputErr);
                    }
                    
                    setExecutedTools(prev => [...prev, `Edited cell [${cellIndex}]`]);
                    
                    const hasError = cellOutput.includes('ERROR -');
                    const hasWarning = cellOutput.includes('Warning:') || cellOutput.includes('WARNING');
                    const hasCJKIssue = cellOutput.includes('missing from current font') || cellOutput.includes('CJK');
                    
                    let statusMsg: string;
                    if (hasError) {
                        statusMsg = `Cell [${cellIndex}] edited and re-executed with ERRORS. You MUST fix these errors.`;
                    } else if (hasCJKIssue) {
                        statusMsg = `Cell [${cellIndex}] edited and re-executed but has CJK FONT WARNINGS. Add font config before plotting.`;
                    } else if (hasWarning) {
                        statusMsg = `Cell [${cellIndex}] edited and re-executed with WARNINGS. Review if needed.`;
                    } else {
                        statusMsg = `Cell [${cellIndex}] edited and re-executed successfully.`;
                    }
                    const editResultText = cellOutput ? `${statusMsg}${cellOutput}` : statusMsg;
                    return { result: editResultText, images: editCapturedImages.length > 0 ? editCapturedImages : undefined };
                }
                
                case 'add_code_cell': {
                    const code = args.code || '';
                    // 智能确定插入位置：优先使用 agent 上次插入的位置，防止用户点击其他 cell 导致错位
                    const totalCells = notebook.content.widgets.length;
                    let targetIndex: number;
                    if (lastAgentCellIndexRef.current >= 0 && lastAgentCellIndexRef.current < totalCells) {
                        targetIndex = lastAgentCellIndexRef.current;
                    } else {
                        // 首次插入或 ref 无效：插入到 notebook 最末尾
                        targetIndex = totalCells - 1;
                    }
                    console.log(`[Agent] add_code_cell: inserting after cell ${targetIndex} (total=${totalCells}, lastAgentRef=${lastAgentCellIndexRef.current}, userActive=${notebook.content.activeCellIndex})`);
                    // 先将活动 cell 设为目标位置，再插入
                    notebook.content.activeCellIndex = targetIndex;
                    const activeCellIndex = targetIndex;
                    NotebookActions.insertBelow(notebook.content);
                    
                    // 等待一下让 UI 更新
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // 获取新插入的单元格
                    const newCellIndex = activeCellIndex + 1;
                    const newCell = notebook.content.widgets[newCellIndex];
                    let cellOutput = '';
                    const capturedImages: string[] = [];
                    
                    if (newCell && newCell.model) {
                        newCell.model.sharedModel.setSource(code);
                        // 确保选中新单元格并更新 agent 追踪索引
                        notebook.content.activeCellIndex = newCellIndex;
                        lastAgentCellIndexRef.current = newCellIndex;
                        // 自动运行插入的代码
                        const runResult = await NotebookActions.run(notebook.content, notebook.sessionContext);
                        
                        // 等待输出完全更新（绘图等较慢操作需要更多时间）
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // 捕获 cell 执行输出（包括错误）
                        try {
                            const cellModel = newCell.model as any;
                            const outputs = cellModel.outputs;
                            if (outputs && outputs.length > 0) {
                                const outputParts: string[] = [];
                                const MAX_OUTPUT_CHARS = 3000;
                                let totalChars = 0;
                                
                                for (let i = 0; i < outputs.length && totalChars < MAX_OUTPUT_CHARS; i++) {
                                    const output = outputs.get(i);
                                    const json = output.toJSON();
                                    
                                    if (json.output_type === 'error') {
                                        // 捕获错误信息
                                        const errorMsg = `ERROR - ${json.ename}: ${json.evalue}`;
                                        outputParts.push(errorMsg);
                                        // 包含 traceback 的最后几行
                                        if (json.traceback && Array.isArray(json.traceback)) {
                                            const tb = json.traceback.map((line: string) => 
                                                line.replace(/\u001b\[[0-9;]*m/g, '') // 去除 ANSI 颜色码
                                            );
                                            const tbText = tb.slice(-5).join('\n');
                                            outputParts.push(tbText);
                                        }
                                        totalChars += errorMsg.length;
                                    } else if (json.output_type === 'stream') {
                                        const text = typeof json.text === 'string' ? json.text : (json.text || []).join('');
                                        if (text.trim()) {
                                            const truncated = text.length > 1000 ? text.slice(0, 1000) + '...(truncated)' : text;
                                            outputParts.push(`[${json.name || 'stdout'}]: ${truncated}`);
                                            totalChars += truncated.length;
                                        }
                                    } else if (json.output_type === 'execute_result') {
                                        const textData = json.data?.['text/plain'] || '';
                                        if (textData) {
                                            const truncated = textData.length > 1000 ? textData.slice(0, 1000) + '...(truncated)' : textData;
                                            outputParts.push(`[result]: ${truncated}`);
                                            totalChars += truncated.length;
                                        }
                                    } else if (json.output_type === 'display_data') {
                                        // 图表等：捕获 base64 PNG 用于视觉检测
                                        if (json.data?.['image/png']) {
                                            outputParts.push('[display]: Chart/image generated — attached for visual inspection');
                                            const pngBase64 = json.data['image/png'];
                                            if (pngBase64 && pngBase64.length < 500000) {
                                                capturedImages.push(pngBase64);
                                                console.log(`[Agent] Captured image for visual inspection (${Math.round(pngBase64.length / 1024)}KB)`);
                                            }
                                        } else if (json.data?.['image/svg+xml']) {
                                            outputParts.push('[display]: SVG image generated successfully');
                                        } else if (json.data?.['text/plain']) {
                                            const truncated = json.data['text/plain'].length > 500 ? json.data['text/plain'].slice(0, 500) + '...(truncated)' : json.data['text/plain'];
                                            outputParts.push(`[display]: ${truncated}`);
                                            totalChars += truncated.length;
                                        }
                                    }
                                }
                                
                                if (outputParts.length > 0) {
                                    cellOutput = '\n--- Cell Output ---\n' + outputParts.join('\n');
                                }
                            }
                        } catch (outputErr) {
                            console.warn('[Agent] Failed to capture cell output:', outputErr);
                        }
                    }
                    setExecutedTools(prev => [...prev, 'Inserted and executed code cell']);
                    
                    // 返回包含执行输出的结果（含 cell_index 以便后续 edit_code_cell 使用）
                    const hasError = cellOutput.includes('ERROR -');
                    const hasWarning = cellOutput.includes('Warning:') || cellOutput.includes('WARNING');
                    const hasCJKIssue = cellOutput.includes('missing from current font') || cellOutput.includes('CJK');
                    
                    const cellIdxInfo = `[cell_index=${newCellIndex}]`;
                    let statusMsg: string;
                    if (hasError) {
                        statusMsg = `Code cell ${cellIdxInfo} inserted and executed with ERRORS. Use edit_code_cell(cell_index=${newCellIndex}, ...) to fix the code in-place.`;
                    } else if (hasCJKIssue) {
                        statusMsg = `Code cell ${cellIdxInfo} executed but has CJK FONT WARNINGS — Chinese/Japanese/Korean characters will show as boxes (□□□) in plots. Use edit_code_cell(cell_index=${newCellIndex}, ...) to add font configuration.`;
                    } else if (hasWarning) {
                        statusMsg = `Code cell ${cellIdxInfo} executed with WARNINGS. Review and fix if needed using edit_code_cell(cell_index=${newCellIndex}, ...).`;
                    } else {
                        statusMsg = `Code cell ${cellIdxInfo} inserted and executed successfully.`;
                    }
                    const addResultText = cellOutput ? `${statusMsg}${cellOutput}` : statusMsg;
                    return { result: addResultText, images: capturedImages.length > 0 ? capturedImages : undefined };
                }
                
                case 'add_markdown_cell': {
                    const content = args.content || '';
                    // 智能确定插入位置：优先使用 agent 上次插入的位置
                    const mdTotalCells = notebook.content.widgets.length;
                    let mdTargetIndex: number;
                    if (lastAgentCellIndexRef.current >= 0 && lastAgentCellIndexRef.current < mdTotalCells) {
                        mdTargetIndex = lastAgentCellIndexRef.current;
                    } else {
                        mdTargetIndex = mdTotalCells - 1;
                    }
                    console.log(`[Agent] add_markdown_cell: inserting after cell ${mdTargetIndex} (total=${mdTotalCells}, lastAgentRef=${lastAgentCellIndexRef.current})`);
                    notebook.content.activeCellIndex = mdTargetIndex;
                    const activeCellIndex = mdTargetIndex;
                    NotebookActions.insertBelow(notebook.content);
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    const newCellIndex = activeCellIndex + 1;
                    notebook.content.activeCellIndex = newCellIndex;
                    
                    // 更改单元格类型为 markdown
                    NotebookActions.changeCellType(notebook.content, 'markdown');
                    
                    const newCell = notebook.content.widgets[newCellIndex];
                    if (newCell && newCell.model) {
                        newCell.model.sharedModel.setSource(content);
                        // 更新 agent 追踪索引
                        lastAgentCellIndexRef.current = newCellIndex;
                        // 渲染 markdown
                        await NotebookActions.run(notebook.content, notebook.sessionContext);
                    }
                    setExecutedTools(prev => [...prev, 'Inserted Markdown cell']);
                    return { result: 'Markdown cell inserted' };
                }
                
                default:
                    console.log('[Agent] Unknown tool:', tool.name);
                    return { result: `Tool ${tool.name} is not supported in frontend` };
            }
        } catch (e: any) {
            console.error('[Agent] Tool execution error:', e);
            return { result: `Tool execution failed: ${e.message}` };
        }
    }, [notebookTracker, app]);

    // 发送消息
    const handleSend = async (overrideInput?: string) => {
        const nextInput = (overrideInput ?? input).trim();
        if (!nextInput || isLoading) return;
        
        // Build message content with uploaded file info
        let messageContent = nextInput;
        if (attachedFiles.length > 0) {
            const uploadedFiles = attachedFiles.filter(f => f.uploaded);
            if (uploadedFiles.length > 0) {
                const fileList = uploadedFiles.map(f => `  - ${f.name} (${formatFileSize(f.size)})`).join('\n');
                messageContent = nextInput + `\n\n[用户已上传以下文件到项目工作目录:]\n${fileList}\n[请在分析中使用这些文件，文件路径为工作目录下的文件名]`;
            }
        }

        const userMessage: ChatMessage = {
            role: 'user',
            content: nextInput,
            timestamp: new Date()
        };
        
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setAttachedFiles([]);
        setIsLoading(true);
        setStreamingContent('');
        setExecutedTools([]);
        resetThoughtChain();
        // 重置 agent cell 追踪（新对话从 notebook 末尾开始）
        lastAgentCellIndexRef.current = -1;
        
        try {
            if (chatMode === 'ask') {
                // Ask mode: direct LLM streaming, no tools
                const history = messages
                    .filter(m => m.role === 'user' || m.role === 'assistant')
                    .slice(-10)
                    .map(m => ({ role: m.role, content: m.content }));
                
                let fullContent = '';
                const eventStream = agentApi.askDirect(messageContent, history);
                
                for await (const event of eventStream) {
                    switch (event.type) {
                        case 'text':
                            fullContent += event.content || '';
                            setStreamingContent(fullContent);
                            break;
                        case 'error':
                            throw new Error(event.error);
                        case 'done':
                            break;
                    }
                }
                
                if (fullContent) {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: fullContent,
                        timestamp: new Date()
                    }]);
                }
            } else {
                // Agent mode: full tool loop
                const context = await getNotebookContext();
                let currentSessionId = sessionId;
                
                let convId = currentConversationId;
                if (!convId) {
                    try {
                        const title = nextInput.length > 30 
                            ? nextInput.substring(0, 30) + '...' 
                            : nextInput;
                        const newConv = await agentApi.createConversation(userId, title);
                        convId = newConv.id;
                        setCurrentConversationId(convId);
                        setConversationTitle(title);
                    } catch (e) {
                        console.warn('[Agent] Failed to create conversation:', e);
                    }
                }
                
                await processAgentLoop(messageContent, context, currentSessionId, convId);
            }
        } catch (error: any) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${error.message}`,
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
            setStreamingContent('');
            setActiveThoughtSteps([]);
        }
    };

    const handleRunSmartCase = (agentCase: AgentCase) => {
        if (isLoading) return;
        handleSend(agentCase.starterPrompt);
    };

    // Agent 循环处理函数 (with ThoughtChain tracking)
    const processAgentLoop = async (
        initialMessage: string, 
        context: ChatContext, 
        currentSessionId: string | null,
        conversationId: string | null = null,
        isToolResult: boolean = false,
        toolResultsToSubmit?: Array<{ toolCallId: string; result: string }>
    ) => {
        console.log('[Agent] processAgentLoop called:', {
            initialMessage: initialMessage.substring(0, 50),
            currentSessionId,
            conversationId,
            isToolResult,
            toolResultsCount: toolResultsToSubmit?.length
        });
        
        let fullContent = '';
        const pendingToolCalls: ToolCall[] = [];
        let thinkingStepId: number | null = null;
        
        try {
            const eventStream = isToolResult && currentSessionId && toolResultsToSubmit
                ? agentApi.submitToolResults(currentSessionId, toolResultsToSubmit)
                : agentApi.chat(initialMessage, currentSessionId || undefined, context);
            
            for await (const event of eventStream) {
                switch (event.type) {
                    case 'text':
                        if (!thinkingStepId) {
                            thinkingStepId = addThoughtStep(isToolResult ? 'Analyzing results' : 'Thinking');
                        }
                        fullContent += event.content || '';
                        setStreamingContent(fullContent);
                        break;
                
                case 'tool_call':
                    if (event.tool) {
                        pendingToolCalls.push(event.tool);
                    }
                    break;
                
                case 'done':
                    if (event.sessionId) {
                        currentSessionId = event.sessionId;
                        setSessionId(event.sessionId);
                    }
                    
                    // Complete thinking step
                    if (thinkingStepId) {
                        completeThoughtStep(thinkingStepId);
                        thinkingStepId = null;
                    }
                    
                    const toolsToExecute = (event.toolCalls && event.toolCalls.length > 0) 
                        ? event.toolCalls 
                        : pendingToolCalls;
                    
                    if (toolsToExecute.length > 0) {
                        setStreamingContent('');
                        fullContent = '';
                        
                        // Execute each tool with ThoughtChain tracking
                        const toolResultsArray: Array<{ toolCallId: string; result: string; images?: string[] }> = [];
                        
                        for (const tool of toolsToExecute) {
                            const toolDisplayName = getToolDisplayName(tool.name);
                            const stepId = addThoughtStep(toolDisplayName);
                            
                            try {
                                const execResult = await executeToolCall(tool);
                                toolResultsArray.push({
                                    toolCallId: tool.id,
                                    result: execResult.result,
                                    ...(execResult.images && { images: execResult.images })
                                });
                                setExecutedTools(prev => [...prev, toolDisplayName]);
                                completeThoughtStep(stepId);
                            } catch (err: any) {
                                toolResultsArray.push({
                                    toolCallId: tool.id,
                                    result: `Error: ${err.message}`
                                });
                                failThoughtStep(stepId);
                            }
                        }
                        
                        // Recurse to continue the agent loop
                        await processAgentLoop('', context, currentSessionId, conversationId, true, toolResultsArray);
                        return;
                    }
                    break;
                
                case 'error':
                    if (thinkingStepId) failThoughtStep(thinkingStepId);
                    if (event.error?.includes('Please configure') || event.error?.includes('请先配置')) {
                        setShowSettings(true);
                    }
                    throw new Error(event.error);
            }
        }
        } catch (error: any) {
            console.error('[Agent] processAgentLoop error:', error);
            throw error;
        }
        
        // No more tool calls — add final assistant message with ThoughtChain
        if (thinkingStepId) {
            completeThoughtStep(thinkingStepId);
        }
        
        // Snapshot the thought chain
        const finalSteps = [...thoughtStepsRef.current];
        const hasSteps = finalSteps.length > 0;
        
        // Always add a message: with content, or with just ThoughtChain
        if (fullContent || hasSteps) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: fullContent || '',
                thoughtSteps: hasSteps ? finalSteps : undefined,
                timestamp: new Date()
            } as ExtendedMessage]);
            
            if (fullContent) {
                if (conversationId && !isToolResult) {
                    saveConversationHistory(conversationId, initialMessage, fullContent);
                } else if (conversationId && isToolResult) {
                    saveConversationHistory(conversationId, '', fullContent);
                }
            }
        }
    };

    // 快捷键处理
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // 停止 Agent
    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
        setStreamingContent('');
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: '⏹ Stopped by user.',
            timestamp: new Date()
        }]);
    };

    // 新建会话
    const handleNewChat = async () => {
        setMessages([]);
        setSessionId(null);
        setStreamingContent('');
        setExecutedTools([]);
        setCurrentConversationId(null);
        setConversationTitle('New Chat');
        setShowHistory(false);
    };

    // 加载历史对话
    const handleSelectConversation = async (conversationId: string) => {
        try {
            const conversation = await agentApi.getConversation(conversationId, userId);
            
            // 转换消息格式
            const loadedMessages: ChatMessage[] = conversation.messages.map(msg => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content,
                timestamp: new Date(msg.timestamp)
            }));
            
            setMessages(loadedMessages);
            setCurrentConversationId(conversationId);
            setConversationTitle(conversation.title);
            setSessionId(null); // 重置 sessionId，让 agent 重新开始
            setShowHistory(false);
        } catch (e) {
            console.error('Failed to load conversation:', e);
            alert('Failed to load conversation');
        }
    };

    // 渲染代码块
    const renderCodeBlock = (code: string, language: string = 'python') => {
        return (
            <div className="agent-code-block">
                <div className="code-block-header">
                    <span className="code-lang-badge">{language}</span>
                    <div className="code-actions">
                        <button 
                            className="code-action-btn"
                            onClick={() => navigator.clipboard.writeText(code)}
                            title="Copy"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <pre className="code-block-content"><code>{code}</code></pre>
            </div>
        );
    };

    // 解析并渲染消息内容（支持代码块 + markdown）
    const renderMessageContent = (content: string) => {
        const parts: React.ReactNode[] = [];
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;
        let keyIndex = 0;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            // 添加代码块之前的文本（用 markdown 渲染）
            if (match.index > lastIndex) {
                const text = content.slice(lastIndex, match.index);
                parts.push(
                    <div key={keyIndex++} className="md-content">
                        {renderMarkdown(text)}
                    </div>
                );
            }
            
            // 添加代码块
            const language = match[1] || 'python';
            const code = match[2].trim();
            parts.push(
                <div key={keyIndex++}>
                    {renderCodeBlock(code, language)}
                </div>
            );
            
            lastIndex = match.index + match[0].length;
        }
        
        // 添加剩余文本（用 markdown 渲染）
        if (lastIndex < content.length) {
            const remaining = content.slice(lastIndex);
            parts.push(
                <div key={keyIndex++} className="md-content">
                    {renderMarkdown(remaining)}
                </div>
            );
        }
        
        return parts.length > 0 ? parts : content;
    };

    // ==================== ThoughtChain rendering ====================
    const formatDuration = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const renderThoughtChain = (steps: ThoughtStep[], isLive: boolean = false) => {
        if (!steps || steps.length === 0) return null;
        
        const totalTime = steps.length > 0 
            ? (steps[steps.length - 1].endTime || Date.now()) - steps[0].startTime 
            : 0;
        const isExpanded = isLive || expandedThinking.has(-999); // -999 is placeholder, per-message below
        
        return (
            <div className="thought-chain">
                <div className="thought-chain-header" onClick={() => !isLive && toggleThinking(-999)}>
                    <div className="thought-chain-icon">
                        {isLive ? (
                            <div className="thought-chain-spinner"></div>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm.93 4.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 4.588z"/>
                                <circle cx="8" cy="3.5" r=".75"/>
                            </svg>
                        )}
                    </div>
                    <span className="thought-chain-summary">
                        {isLive ? 'Thinking...' : `Thought for ${formatDuration(totalTime)}`}
                    </span>
                    <span className="thought-chain-count">{steps.length} steps</span>
                    {!isLive && (
                        <svg className={`thought-chain-arrow ${isExpanded ? 'expanded' : ''}`} width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
                        </svg>
                    )}
                </div>
                {(isLive || isExpanded) && (
                    <div className="thought-chain-steps">
                        {steps.map((step, i) => (
                            <div key={step.id} className={`thought-step thought-step-${step.status}`}>
                                <div className="thought-step-indicator">
                                    {step.status === 'running' ? (
                                        <div className="step-spinner"></div>
                                    ) : step.status === 'done' ? (
                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="step-check">
                                            <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                                        </svg>
                                    ) : (
                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="step-error">
                                            <path fillRule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
                                        </svg>
                                    )}
                                </div>
                                <span className="thought-step-title">{step.title}</span>
                                {step.endTime && (
                                    <span className="thought-step-time">{formatDuration(step.endTime - step.startTime)}</span>
                                )}
                                <span className={`thought-step-badge badge-${step.status}`}>
                                    {step.status === 'running' ? 'Running' : step.status === 'done' ? 'Done' : 'Error'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderMessageThoughtChain = (steps: ThoughtStep[], msgIndex: number) => {
        if (!steps || steps.length === 0) return null;
        
        const totalTime = steps.length > 0 
            ? (steps[steps.length - 1].endTime || Date.now()) - steps[0].startTime 
            : 0;
        const isExpanded = expandedThinking.has(msgIndex);
        
        return (
            <div className="thought-chain">
                <div className="thought-chain-header" onClick={() => toggleThinking(msgIndex)}>
                    <div className="thought-chain-icon">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm.93 4.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 4.588z"/>
                            <circle cx="8" cy="3.5" r=".75"/>
                        </svg>
                    </div>
                    <span className="thought-chain-summary">Thought for {formatDuration(totalTime)}</span>
                    <span className="thought-chain-count">{steps.length} steps</span>
                    <svg className={`thought-chain-arrow ${isExpanded ? 'expanded' : ''}`} width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
                    </svg>
                </div>
                {isExpanded && (
                    <div className="thought-chain-steps">
                        {steps.map((step) => (
                            <div key={step.id} className={`thought-step thought-step-${step.status}`}>
                                <div className="thought-step-indicator">
                                    {step.status === 'done' ? (
                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="step-check">
                                            <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                                        </svg>
                                    ) : (
                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="step-error">
                                            <path fillRule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
                                        </svg>
                                    )}
                                </div>
                                <span className="thought-step-title">{step.title}</span>
                                {step.endTime && (
                                    <span className="thought-step-time">{formatDuration(step.endTime - step.startTime)}</span>
                                )}
                                <span className={`thought-step-badge badge-${step.status}`}>
                                    {step.status === 'done' ? 'Done' : 'Error'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // 渲染消息
    const renderMessage = (msg: ExtendedMessage, index: number) => {
        const isUser = msg.role === 'user';
        const hasContent = msg.content && msg.content.trim().length > 0;
        const hasThoughtSteps = msg.thoughtSteps && msg.thoughtSteps.length > 0;
        
        return (
            <div key={index} className={`agent-message ${isUser ? 'user' : 'assistant'}`}>
                {isUser ? (
                    <div className="user-message-bubble">
                        <div className="user-avatar">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/>
                                <path d="M8 4a2 2 0 100 4 2 2 0 000-4zM4 10.5c0-1.5 2-2.5 4-2.5s4 1 4 2.5V12H4v-1.5z"/>
                            </svg>
                        </div>
                        <div className="user-message-content">{msg.content}</div>
                    </div>
                ) : (
                    <div className="assistant-response">
                        <div className="assistant-header">
                            <div className="assistant-avatar">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z"/>
                                </svg>
                            </div>
                            <span className="assistant-label">OpenGeoLab AI</span>
                        </div>
                        {/* ThoughtChain (if present) */}
                        {hasThoughtSteps && renderMessageThoughtChain(msg.thoughtSteps!, index)}
                        {/* Message content */}
                        {hasContent && (
                            <div className="assistant-content">
                                {renderMessageContent(msg.content)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };
    
    // 获取工具的友好显示名称
    const getToolDisplayName = (toolName: string): string => {
        const nameMap: Record<string, string> = {
            'add_code_cell': 'Insert and run code cell',
            'edit_code_cell': 'Edit and re-run code cell',
            'add_markdown_cell': 'Insert markdown cell',
            'run_terminal_command': 'Run terminal command',
            'list_project_files': 'List project files',
            'read_project_file': 'Read project file',
            'write_project_file': 'Write project file',
            'edit_project_file': 'Edit project file',
            'insert_lines_in_file': 'Insert lines in file',
            'undo_edit': 'Undo file edit',
            'grep_project_files': 'Search in files',
            'search_models': 'Search models',
            'search_data_methods': 'Search data methods',
            'get_model_info': 'Get model info',
            'think': 'Deep thinking',
            'finish': 'Task complete',
            'web_search': 'Web search',
            'download_file': 'Download file',
            'run_mcp_tool': 'Run MCP tool'
        };
        return nameMap[toolName] || toolName;
    };

    // 如果显示设置面板
    if (showSettings) {
        return (
            <LLMSettings
                onClose={() => setShowSettings(false)}
                onSaved={() => {
                    checkConfig();
                    setShowSettings(false);
                }}
            />
        );
    }

    return (
        <div className="agent-panel">
            {/* Chat history sidebar */}
            <ChatHistory
                userId={userId}
                currentConversationId={currentConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewChat}
                isVisible={showHistory}
                onClose={() => setShowHistory(false)}
            />
            
            {/* Header */}
            <div className="agent-header">
                <div className="header-left">
                    <img className="agent-logo" src={`data:image/x-icon;base64,${FAVICON_BASE64}`} alt="OpenGeoLab" width="20" height="20" />
                    <span className="header-title">{conversationTitle}</span>
                </div>
                <div className="header-right">
                    <button className="icon-btn" onClick={() => setShowHistory(true)} title="Chat history">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v8.5a.25.25 0 01-.25.25h-6.5a.75.75 0 00-.53.22L4.5 14.44v-2.19a.75.75 0 00-.75-.75h-2a.25.25 0 01-.25-.25v-8.5zM1.75 1A1.75 1.75 0 000 2.75v8.5C0 12.216.784 13 1.75 13H3v2.25c0 .69.56 1.25 1.25 1.25.33 0 .65-.132.884-.366L7.634 13.5H14.25A1.75 1.75 0 0016 11.75v-8.5A1.75 1.75 0 0014.25 1H1.75z"/>
                        </svg>
                    </button>
                    <button className="icon-btn" onClick={handleNewChat} title="New chat">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M7.25 1.75a.75.75 0 011.5 0V7h5.25a.75.75 0 010 1.5H8.75v5.25a.75.75 0 01-1.5 0V8.5H2a.75.75 0 010-1.5h5.25V1.75z"/>
                        </svg>
                    </button>
                    <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="evenodd" d="M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.423 1.53.27l1.102-.303c.11-.03.175.016.195.046.219.31.41.641.573.989.014.031.022.11-.059.19l-.815.806c-.411.406-.562.957-.53 1.456a4.588 4.588 0 010 .582c-.032.499.119 1.05.53 1.456l.815.806c.08.08.073.159.059.19a6.494 6.494 0 01-.573.99c-.02.029-.086.074-.195.045l-1.103-.303c-.559-.153-1.112-.008-1.529.27-.16.107-.327.204-.5.29-.449.222-.851.628-.998 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.613 6.613 0 01-1.142 0c-.036-.003-.108-.037-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a4.502 4.502 0 01-.501-.29c-.417-.278-.97-.423-1.53-.27l-1.102.303c-.11.03-.175-.016-.195-.046a6.492 6.492 0 01-.573-.989c-.014-.031-.022-.11.059-.19l.815-.806c.411-.406.562-.957.53-1.456a4.587 4.587 0 010-.582c.032-.499-.119-1.05-.53-1.456l-.815-.806c-.08-.08-.073-.159-.059-.19.162-.348.354-.68.573-.989.02-.03.085-.076.195-.046l1.103.303c.559.153 1.112.008 1.529-.27.16-.107.327-.204.5-.29.449-.222.851-.628.998-1.189l.289-1.105c.029-.11.101-.143.137-.146zM8 0c-.236 0-.47.01-.701.03-.743.065-1.29.615-1.458 1.261l-.29 1.106c-.017.066-.078.158-.211.224a5.994 5.994 0 00-.668.386c-.123.082-.233.09-.3.071L3.27 2.776c-.644-.177-1.392.02-1.82.63a7.977 7.977 0 00-.704 1.217c-.315.675-.111 1.422.363 1.891l.815.806c.05.048.098.147.088.294a6.084 6.084 0 000 .772c.01.147-.038.246-.088.294l-.815.806c-.474.469-.678 1.216-.363 1.891.2.428.436.835.704 1.218.428.609 1.176.806 1.82.63l1.103-.303c.066-.019.176-.011.299.071.213.143.436.272.668.386.133.066.194.158.212.224l.289 1.106c.169.646.715 1.196 1.458 1.26a8.094 8.094 0 001.402 0c.743-.064 1.29-.614 1.458-1.26l.29-1.106c.017-.066.078-.158.211-.224a5.98 5.98 0 00.668-.386c.123-.082.233-.09.3-.071l1.102.302c.644.177 1.392-.02 1.82-.63.268-.382.505-.789.704-1.217.315-.675.111-1.422-.364-1.891l-.814-.806c-.05-.048-.098-.147-.088-.294a6.1 6.1 0 000-.772c-.01-.147.039-.246.088-.294l.814-.806c.475-.469.679-1.216.364-1.891a7.992 7.992 0 00-.704-1.218c-.428-.609-1.176-.806-1.82-.63l-1.103.303c-.066.019-.176.011-.299-.071a5.991 5.991 0 00-.668-.386c-.133-.066-.194-.158-.212-.224L10.16 1.29C9.99.645 9.444.095 8.701.031A8.094 8.094 0 008 0zm0 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6.5 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="agent-messages">
                {messages.length === 0 && !streamingContent && (
                    <div className="agent-welcome">
                        <div className="welcome-icon">
                            <img src={`data:image/x-icon;base64,${FAVICON_BASE64}`} alt="OpenGeoLab" width="48" height="48" style={{opacity: 0.7}} />
                        </div>
                        <h3>OpenGeoLab AI Assistant</h3>
                        <p className="welcome-subtitle">I can code, inspect your project, run terminal commands, and help reproduce workflows.</p>

                        <div className="smart-cases">
                            <div className="smart-cases-title">Smart Cases</div>
                            {isLoadingCases && <div className="smart-cases-loading">Loading cases...</div>}
                            {!isLoadingCases && smartCases.length === 0 && (
                                <div className="smart-cases-empty">No curated cases available.</div>
                            )}
                            {!isLoadingCases && smartCases.map((agentCase) => (
                                <button
                                    key={agentCase.id}
                                    className="smart-case-item"
                                    onClick={() => handleRunSmartCase(agentCase)}
                                    disabled={isLoading}
                                >
                                    <span className="smart-case-name">{agentCase.title}</span>
                                    <span className="smart-case-meta">{agentCase.category} · {agentCase.difficulty}</span>
                                </button>
                            ))}
                        </div>

                        {!hasConfig && (
                            <button className="config-btn" onClick={() => setShowSettings(true)}>
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.423 1.53.27l1.102-.303c.11-.03.175.016.195.046a6.588 6.588 0 01.573.989c.014.031.022.11-.059.19l-.815.806c-.411.406-.562.957-.53 1.456a4.588 4.588 0 010 .582c-.032.499.119 1.05.53 1.456l.815.806c.08.08.073.159.059.19-.163.348-.355.68-.573.99-.02.029-.086.074-.195.045l-1.103-.303c-.559-.153-1.112-.008-1.529.27-.16.107-.327.204-.5.29-.449.222-.851.628-.998 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.613 6.613 0 01-1.142 0c-.036-.003-.108-.037-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a4.502 4.502 0 01-.501-.29c-.417-.278-.97-.423-1.53-.27l-1.102.303c-.11.03-.175-.016-.195-.046a6.492 6.492 0 01-.573-.989c-.014-.031-.022-.11.059-.19l.815-.806c.411-.406.562-.957.53-1.456a4.587 4.587 0 010-.582c.032-.499-.119-1.05-.53-1.456l-.815-.806c-.08-.08-.073-.159-.059-.19.162-.348.354-.68.573-.989.02-.03.085-.076.195-.046l1.103.303c.559.153 1.112.008 1.529-.27.16-.107.327-.204.5-.29.449-.222.851-.628.998-1.189l.289-1.105c.029-.11.101-.143.137-.146zM8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/>
                                </svg>
                                Configure LLM API
                            </button>
                        )}
                    </div>
                )}
                
                {messages.map(renderMessage)}
                
                {/* Live ThoughtChain during processing */}
                {isLoading && activeThoughtSteps.length > 0 && (
                    <div className="agent-message assistant">
                        <div className="assistant-response">
                            <div className="assistant-header">
                                <div className="assistant-avatar">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z"/>
                                    </svg>
                                </div>
                                <span className="assistant-label">OpenGeoLab AI</span>
                            </div>
                            {renderThoughtChain(activeThoughtSteps, true)}
                            {streamingContent && (
                                <div className="assistant-content">
                                    {renderMessageContent(streamingContent)}
                                    <span className="typing-cursor">▊</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Streaming without thought chain (fallback) */}
                {streamingContent && activeThoughtSteps.length === 0 && (
                    <div className="agent-message assistant">
                        <div className="assistant-response">
                            <div className="assistant-header">
                                <div className="assistant-avatar">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z"/>
                                    </svg>
                                </div>
                                <span className="assistant-label">OpenGeoLab AI</span>
                            </div>
                            <div className="assistant-content">
                                {renderMessageContent(streamingContent)}
                                <span className="typing-cursor">▊</span>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Loading indicator (no thought steps yet) */}
                {isLoading && !streamingContent && activeThoughtSteps.length === 0 && (
                    <div className="agent-loading">
                        <div className="loading-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            {/* Input area with model selector and file upload */}
            <div className="agent-input-area">
                {/* Attached files display */}
                {(attachedFiles.length > 0 || isUploading) && (
                    <div className="attached-files">
                        {attachedFiles.map((file, i) => (
                            <div key={i} className={`attached-file-chip ${file.uploaded ? 'chip-success' : 'chip-error'}`}>
                                {file.uploaded ? (
                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="chip-icon-ok">
                                        <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                                    </svg>
                                ) : (
                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="chip-icon-err">
                                        <path fillRule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
                                    </svg>
                                )}
                                <span className="file-chip-name">{file.name}</span>
                                <span className="file-chip-size">{formatFileSize(file.size)}</span>
                                <button className="file-chip-remove" onClick={() => removeAttachedFile(i)}>×</button>
                            </div>
                        ))}
                        {isUploading && (
                            <div className="attached-file-chip chip-uploading">
                                <div className="chip-spinner"></div>
                                <span>Uploading...</span>
                            </div>
                        )}
                    </div>
                )}
                
                {isLoading && (
                    <div className="agent-status-bar">
                        <div className="status-pulse"></div>
                        <span className="status-text">
                            {streamingContent ? 'Agent is responding...' : executedTools.length > 0 ? 'Executing tools...' : 'Agent is thinking...'}
                        </span>
                    </div>
                )}
                <div className={`input-wrapper ${isLoading ? 'input-wrapper-loading' : ''}`}>
                    {/* File upload button */}
                    <button 
                        className="attach-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        title="Attach files"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4.317 1.592a3.75 3.75 0 015.366 0l4.608 4.763a.75.75 0 01-1.078 1.043l-4.608-4.763a2.25 2.25 0 00-3.21 0L1.636 6.56a3.5 3.5 0 004.944 4.949l4.608-4.763a1.25 1.25 0 00-1.788-1.747L5.792 9.762a.25.25 0 00.358.348l2.608-2.697a.75.75 0 011.078 1.044l-2.608 2.697a1.75 1.75 0 01-2.436-2.514l3.608-3.763a2.75 2.75 0 013.866 3.834L7.658 13.47a5 5 0 01-7.022-7.118l3.681-3.76z"/>
                        </svg>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                    />
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isLoading ? (chatMode === 'ask' ? 'Thinking...' : 'Agent is working...') : (chatMode === 'ask' ? 'Ask a question...' : 'Ask OpenGeoLab AI Agent...')}
                        disabled={isLoading}
                        rows={1}
                    />
                    {isLoading ? (
                        <button
                            className="stop-btn"
                            onClick={handleStop}
                            title="Stop generation"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <rect x="3" y="3" width="10" height="10" rx="2" />
                            </svg>
                        </button>
                    ) : (
                        <button
                            className="submit-btn"
                            onClick={() => handleSend()}
                            disabled={!input.trim() && attachedFiles.filter(f => f.uploaded).length === 0}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M.989 8l6.012-6.012v4.762h8v2.5h-8v4.762L.99 8z" transform="rotate(-90 8 8)"/>
                            </svg>
                        </button>
                    )}
                </div>
                
                {/* Model selector */}
                <div className="model-selector-bar">
                    {/* Mode toggle */}
                    <button 
                        className={`mode-toggle-btn ${chatMode}`}
                        onClick={() => setChatMode(prev => prev === 'agent' ? 'ask' : 'agent')}
                        disabled={isLoading}
                        title={chatMode === 'agent' ? 'Agent mode: can execute code, use tools' : 'Ask mode: simple Q&A, no tool calls'}
                    >
                        {chatMode === 'agent' ? (
                            <>
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 1a2 2 0 012 2v2H6V3a2 2 0 012-2zM6 6h4v1H6V6zm-3.5 2A1.5 1.5 0 001 9.5v4A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5v-4A1.5 1.5 0 0013.5 8h-11zM4 11a1 1 0 110-2 1 1 0 010 2zm4 0a1 1 0 110-2 1 1 0 010 2zm4 0a1 1 0 110-2 1 1 0 010 2z"/>
                                </svg>
                                <span>Agent</span>
                            </>
                        ) : (
                            <>
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0114.25 13H8.06l-2.573 2.573A1.458 1.458 0 013 14.543V13H1.75A1.75 1.75 0 010 11.25v-8.5z"/>
                                </svg>
                                <span>Ask</span>
                            </>
                        )}
                    </button>
                    <div className="model-selector-wrapper">
                        <button 
                            className="model-selector-btn"
                            onClick={() => setShowModelDropdown(!showModelDropdown)}
                            disabled={isLoading}
                        >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z"/>
                            </svg>
                            <span>{currentModel || 'Select model'}</span>
                            <svg className={`model-arrow ${showModelDropdown ? 'expanded' : ''}`} width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
                            </svg>
                        </button>
                        {showModelDropdown && availableModels.length > 0 && (
                            <div className="model-dropdown">
                                {availableModels.map((m, i) => (
                                    <button 
                                        key={i}
                                        className={`model-option ${m.model === currentModel ? 'active' : ''}`}
                                        onClick={() => handleModelChange(m.model)}
                                    >
                                        {m.label}
                                        {m.model === currentModel && (
                                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                                <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                /* OpenGeoLab AI 面板 - 浅色主题 */
                .agent-panel {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--jp-layout-color1, #ffffff);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                /* 头部 */
                .agent-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    border-bottom: 1px solid var(--jp-border-color1, #e0e0e0);
                    min-height: 36px;
                    background: var(--jp-layout-color2, #f5f5f5);
                }
                
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .agent-logo {
                    width: 20px;
                    height: 20px;
                    object-fit: contain;
                }
                
                .header-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .header-right {
                    display: flex;
                    gap: 4px;
                }
                
                .icon-btn {
                    background: transparent;
                    border: none;
                    padding: 4px;
                    cursor: pointer;
                    border-radius: 4px;
                    color: var(--jp-ui-font-color1, #666666);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .icon-btn:hover {
                    background: var(--jp-layout-color3, #e0e0e0);
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                /* 消息区域 */
                .agent-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                    background: var(--jp-layout-color1, #ffffff);
                }
                
                /* 欢迎界面 */
                .agent-welcome {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    text-align: center;
                    padding: 20px;
                }
                
                .agent-welcome .welcome-icon {
                    margin-bottom: 16px;
                    color: var(--jp-brand-color1, #1976d2);
                }
                
                .agent-welcome h3 {
                    margin: 0 0 8px 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .welcome-subtitle {
                    font-size: 13px;
                    color: var(--jp-ui-font-color1, #666666);
                    margin: 0 0 20px 0;
                }

                .smart-cases {
                    width: 100%;
                    max-width: 360px;
                    text-align: left;
                    margin-bottom: 16px;
                }

                .smart-cases-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--jp-ui-font-color1, #666666);
                    margin-bottom: 8px;
                }

                .smart-cases-loading,
                .smart-cases-empty {
                    font-size: 12px;
                    color: var(--jp-ui-font-color2, #8a8a8a);
                    margin-bottom: 6px;
                }

                .smart-case-item {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 2px;
                    border: 1px solid var(--jp-border-color1, #dcdcdc);
                    border-radius: 8px;
                    background: var(--jp-layout-color0, #ffffff);
                    color: var(--jp-ui-font-color0, #333333);
                    padding: 8px 10px;
                    margin-bottom: 6px;
                    cursor: pointer;
                    text-align: left;
                }

                .smart-case-item:hover {
                    border-color: var(--jp-brand-color1, #1976d2);
                    background: rgba(25, 118, 210, 0.06);
                }

                .smart-case-item:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .smart-case-name {
                    font-size: 12px;
                    font-weight: 600;
                }

                .smart-case-meta {
                    font-size: 11px;
                    color: var(--jp-ui-font-color2, #8a8a8a);
                }
                
                .config-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: var(--jp-brand-color1, #1976d2);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                
                .config-btn:hover {
                    background: var(--jp-brand-color0, #1565c0);
                }
                
                /* 消息 */
                .agent-message {
                    margin-bottom: 16px;
                }
                
                /* 用户消息 */
                .user-message-bubble {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    background: var(--jp-brand-color1, #1976d2);
                    color: white;
                    padding: 10px 14px;
                    border-radius: 12px;
                    border-bottom-right-radius: 4px;
                    margin-left: 24px;
                }
                
                .user-avatar {
                    flex-shrink: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.9;
                }
                
                .user-message-content {
                    font-size: 13px;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                
                /* 助手响应 */
                .assistant-response {
                    padding: 0;
                }
                
                .assistant-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                
                .assistant-avatar {
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--jp-brand-color1, #1976d2);
                }
                
                .assistant-label {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .assistant-content {
                    font-size: 13px;
                    line-height: 1.6;
                    color: var(--jp-ui-font-color0, #333333);
                    padding-left: 28px;
                }
                
                .assistant-content .text-content {
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                
                /* Markdown rendered content */
                .assistant-content .md-content {
                    word-break: break-word;
                }
                .assistant-content .md-content p {
                    margin: 0.4em 0;
                }
                .assistant-content .md-content h1,
                .assistant-content .md-content h2,
                .assistant-content .md-content h3,
                .assistant-content .md-content h4 {
                    margin: 0.6em 0 0.3em 0;
                    font-weight: 600;
                    line-height: 1.3;
                }
                .assistant-content .md-content h1 { font-size: 1.3em; }
                .assistant-content .md-content h2 { font-size: 1.15em; }
                .assistant-content .md-content h3 { font-size: 1.05em; }
                .assistant-content .md-content ul,
                .assistant-content .md-content ol {
                    margin: 0.3em 0;
                    padding-left: 1.5em;
                }
                .assistant-content .md-content li {
                    margin: 0.15em 0;
                }
                .assistant-content .md-content li > ul,
                .assistant-content .md-content li > ol {
                    margin: 0.1em 0;
                }
                .assistant-content .md-content .md-inline-code {
                    background: rgba(0,0,0,0.06);
                    padding: 1px 5px;
                    border-radius: 3px;
                    font-family: var(--jp-code-font-family, monospace);
                    font-size: 0.9em;
                }
                .assistant-content .md-content strong {
                    font-weight: 600;
                }
                .assistant-content .md-content a {
                    color: var(--jp-brand-color1, #1976d2);
                    text-decoration: none;
                }
                .assistant-content .md-content a:hover {
                    text-decoration: underline;
                }
                /* Markdown tables */
                .assistant-content .md-content .md-table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 0.5em 0;
                    font-size: 0.92em;
                    overflow-x: auto;
                    display: block;
                }
                .assistant-content .md-content .md-table thead {
                    display: table;
                    width: 100%;
                    table-layout: fixed;
                }
                .assistant-content .md-content .md-table tbody {
                    display: table;
                    width: 100%;
                    table-layout: fixed;
                }
                .assistant-content .md-content .md-table th,
                .assistant-content .md-content .md-table td {
                    border: 1px solid var(--jp-border-color1, #ddd);
                    padding: 6px 10px;
                    text-align: left;
                }
                .assistant-content .md-content .md-table th {
                    background: var(--jp-layout-color2, #f5f5f5);
                    font-weight: 600;
                }
                .assistant-content .md-content .md-table tr:nth-child(even) td {
                    background: var(--jp-layout-color1, #fafafa);
                }
                .assistant-content .md-content hr {
                    border: none;
                    border-top: 1px solid var(--jp-border-color1, #ddd);
                    margin: 0.8em 0;
                }

                /* 工具调用列表 */
                .tool-calls-list {
                    margin-top: 12px;
                    padding-left: 28px;
                }
                
                .tool-call-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    padding: 4px 0;
                    color: var(--jp-ui-font-color1, #666666);
                }
                
                .tool-check {
                    color: #4caf50;
                    font-weight: bold;
                }
                
                /* 代码块 */
                .agent-code-block {
                    margin: 12px 0;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #f8f8f8;
                    border: 1px solid var(--jp-border-color1, #e0e0e0);
                }
                
                .code-block-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 6px 12px;
                    background: #f0f0f0;
                    border-bottom: 1px solid var(--jp-border-color1, #e0e0e0);
                }
                
                .code-lang-badge {
                    font-size: 11px;
                    color: var(--jp-ui-font-color1, #666666);
                    font-weight: 500;
                }
                
                .code-actions {
                    display: flex;
                    gap: 4px;
                }
                
                .code-action-btn {
                    background: transparent;
                    border: none;
                    padding: 4px;
                    cursor: pointer;
                    border-radius: 4px;
                    color: var(--jp-ui-font-color1, #666666);
                    display: flex;
                    align-items: center;
                }
                
                .code-action-btn:hover {
                    background: var(--jp-layout-color3, #e0e0e0);
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .code-block-content {
                    margin: 0;
                    padding: 12px;
                    overflow-x: auto;
                    font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
                    font-size: 12px;
                    line-height: 1.5;
                    color: #333333;
                    background: #f8f8f8;
                }
                
                .code-block-content code {
                    white-space: pre;
                }
                
                /* 已执行的操作 */
                .executed-actions {
                    padding: 4px 0 4px 28px;
                }
                
                .action-item.completed {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    padding: 4px 0;
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .action-item.completed .check-icon {
                    color: #4caf50;
                    flex-shrink: 0;
                }
                
                /* 思考过程折叠区域 */
                .thinking-section {
                    margin-bottom: 8px;
                    padding-left: 28px;
                }
                
                .thinking-toggle {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: transparent;
                    border: none;
                    padding: 4px 8px 4px 0;
                    cursor: pointer;
                    font-size: 12px;
                    color: var(--jp-ui-font-color2, #666666);
                    transition: color 0.15s;
                }
                
                .thinking-toggle:hover {
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .thinking-arrow {
                    transition: transform 0.2s ease;
                }
                
                .thinking-arrow.expanded {
                    transform: rotate(180deg);
                }
                
                .thinking-label {
                    font-weight: 500;
                }
                
                .thinking-content {
                    margin-top: 8px;
                    padding: 10px 12px;
                    background: var(--jp-layout-color2, #f5f5f5);
                    border-radius: 6px;
                    border-left: 3px solid var(--jp-brand-color1, #1976d2);
                    font-size: 12px;
                    line-height: 1.5;
                    color: var(--jp-ui-font-color1, #555555);
                    max-height: 200px;
                    overflow-y: auto;
                }
                
                .thinking-content .text-content {
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                
                /* 操作状态（加载中）*/
                .agent-actions {
                    padding: 8px 0 8px 28px;
                }
                
                .action-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    padding: 3px 0;
                    color: var(--jp-ui-font-color1, #666666);
                }
                
                .check-icon {
                    color: #4caf50;
                }
                
                /* 加载状态 */
                .agent-loading {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 0 12px 28px;
                }
                
                .loading-dots {
                    display: flex;
                    gap: 4px;
                }
                
                .loading-dots span {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--jp-brand-color1, #1976d2);
                    opacity: 0.5;
                    animation: loadingPulse 1.4s infinite ease-in-out;
                }
                
                .loading-dots span:nth-child(2) {
                    animation-delay: 0.2s;
                }
                
                .loading-dots span:nth-child(3) {
                    animation-delay: 0.4s;
                }
                
                @keyframes loadingPulse {
                    0%, 60%, 100% { opacity: 0.3; transform: scale(1); }
                    30% { opacity: 1; transform: scale(1.2); }
                }
                
                .typing-cursor {
                    animation: cursorBlink 1s infinite;
                    color: var(--jp-brand-color1, #1976d2);
                }
                
                @keyframes cursorBlink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }
                
                /* 输入区域 */
                .agent-input-area {
                    padding: 12px;
                    border-top: 1px solid var(--jp-border-color1, #e0e0e0);
                    background: var(--jp-layout-color2, #f5f5f5);
                }
                
                .input-wrapper {
                    display: flex;
                    align-items: flex-end;
                    gap: 8px;
                    background: var(--jp-layout-color0, #ffffff);
                    border: 1px solid var(--jp-border-color1, #e0e0e0);
                    border-radius: 8px;
                    padding: 8px 8px 8px 12px;
                    transition: border-color 0.15s;
                }
                
                .input-wrapper:focus-within {
                    border-color: var(--jp-brand-color1, #1976d2);
                    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
                }
                
                .input-wrapper textarea {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: var(--jp-ui-font-color0, #333333);
                    font-size: 13px;
                    font-family: inherit;
                    resize: none;
                    outline: none;
                    min-height: 20px;
                    max-height: 120px;
                    line-height: 1.4;
                }
                
                .input-wrapper textarea::placeholder {
                    color: var(--jp-ui-font-color2, #999999);
                }
                
                .submit-btn {
                    flex-shrink: 0;
                    width: 32px;
                    height: 32px;
                    border: none;
                    border-radius: 6px;
                    background: var(--jp-brand-color1, #1976d2);
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.15s;
                }
                
                .submit-btn:hover:not(:disabled) {
                    background: var(--jp-brand-color0, #1565c0);
                }
                
                .submit-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
                
                /* Stop button */
                .stop-btn {
                    flex-shrink: 0;
                    width: 32px;
                    height: 32px;
                    border: 2px solid #e53935;
                    border-radius: 6px;
                    background: transparent;
                    color: #e53935;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s;
                    animation: stopPulse 2s ease-in-out infinite;
                }
                
                .stop-btn:hover {
                    background: #e53935;
                    color: white;
                }
                
                @keyframes stopPulse {
                    0%, 100% { border-color: #e53935; opacity: 1; }
                    50% { border-color: #ef9a9a; opacity: 0.8; }
                }
                
                /* Input wrapper loading state */
                .input-wrapper-loading {
                    border-color: var(--jp-brand-color1, #1976d2) !important;
                    background: var(--jp-layout-color2, #f5f5f5) !important;
                }
                
                /* Agent status bar */
                .agent-status-bar {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 0 4px 8px 4px;
                }
                
                .status-pulse {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--jp-brand-color1, #1976d2);
                    animation: statusPulse 1.5s ease-in-out infinite;
                }
                
                @keyframes statusPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.8); }
                }
                
                .status-text {
                    font-size: 11px;
                    color: var(--jp-ui-font-color2, #999999);
                    font-style: italic;
                }
                
                /* ==================== 历史对话面板样式 ==================== */
                .chat-history-panel {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: var(--jp-layout-color1, #ffffff);
                    z-index: 100;
                    display: flex;
                    flex-direction: column;
                }
                
                .chat-history-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--jp-border-color1, #e0e0e0);
                    background: var(--jp-layout-color2, #f5f5f5);
                }
                
                .chat-history-header h3 {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .chat-history-header .close-btn {
                    background: transparent;
                    border: none;
                    padding: 4px;
                    cursor: pointer;
                    border-radius: 4px;
                    color: var(--jp-ui-font-color1, #666666);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .chat-history-header .close-btn:hover {
                    background: var(--jp-layout-color3, #e0e0e0);
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .chat-history-search {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--jp-border-color1, #e0e0e0);
                }
                
                .search-input-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--jp-layout-color0, #ffffff);
                    border: 1px solid var(--jp-border-color1, #e0e0e0);
                    border-radius: 6px;
                    padding: 6px 10px;
                }
                
                .search-input-wrapper:focus-within {
                    border-color: var(--jp-brand-color1, #1976d2);
                }
                
                .search-icon {
                    color: var(--jp-ui-font-color2, #999999);
                    flex-shrink: 0;
                }
                
                .search-input {
                    flex: 1;
                    border: none;
                    background: transparent;
                    font-size: 13px;
                    color: var(--jp-ui-font-color0, #333333);
                    outline: none;
                }
                
                .search-input::placeholder {
                    color: var(--jp-ui-font-color2, #999999);
                }
                
                .clear-search-btn {
                    background: transparent;
                    border: none;
                    padding: 2px;
                    cursor: pointer;
                    color: var(--jp-ui-font-color2, #999999);
                    display: flex;
                    align-items: center;
                }
                
                .clear-search-btn:hover {
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .new-conversation-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin: 12px 16px;
                    padding: 10px 16px;
                    background: var(--jp-brand-color1, #1976d2);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                
                .new-conversation-btn:hover {
                    background: var(--jp-brand-color0, #1565c0);
                }
                
                .chat-history-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0 8px 8px;
                }
                
                .loading-indicator {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 20px;
                    color: var(--jp-ui-font-color1, #666666);
                }
                
                .loading-indicator .spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid var(--jp-border-color1, #e0e0e0);
                    border-top-color: var(--jp-brand-color1, #1976d2);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                .error-message {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 20px;
                    color: #d32f2f;
                }
                
                .error-message button {
                    padding: 4px 12px;
                    background: var(--jp-layout-color2, #f5f5f5);
                    border: 1px solid var(--jp-border-color1, #e0e0e0);
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    color: var(--jp-ui-font-color2, #999999);
                    text-align: center;
                }
                
                .empty-state p {
                    margin: 12px 0 0 0;
                    font-size: 13px;
                }
                
                .conversation-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    padding: 10px 12px;
                    margin: 4px 0;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                
                .conversation-item:hover {
                    background: var(--jp-layout-color2, #f5f5f5);
                }
                
                .conversation-item.active {
                    background: rgba(25, 118, 210, 0.1);
                }
                
                .conversation-icon {
                    flex-shrink: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--jp-layout-color2, #f5f5f5);
                    border-radius: 8px;
                    color: var(--jp-brand-color1, #1976d2);
                }
                
                .conversation-info {
                    flex: 1;
                    min-width: 0;
                }
                
                .conversation-title {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--jp-ui-font-color0, #333333);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-bottom: 4px;
                }
                
                .conversation-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    color: var(--jp-ui-font-color2, #999999);
                }
                
                .conversation-item .delete-btn {
                    flex-shrink: 0;
                    background: transparent;
                    border: none;
                    padding: 4px;
                    cursor: pointer;
                    border-radius: 4px;
                    color: var(--jp-ui-font-color2, #999999);
                    opacity: 0;
                    transition: opacity 0.15s, color 0.15s;
                    display: flex;
                    align-items: center;
                }
                
                .conversation-item:hover .delete-btn {
                    opacity: 1;
                }
                
                .conversation-item .delete-btn:hover {
                    color: #d32f2f;
                    background: rgba(211, 47, 47, 0.1);
                }
                
                /* ==================== ThoughtChain ==================== */
                .thought-chain {
                    margin: 8px 0 12px 28px;
                    border: 1px solid var(--jp-border-color1, #e0e0e0);
                    border-radius: 8px;
                    overflow: hidden;
                    background: var(--jp-layout-color0, #ffffff);
                }
                
                .thought-chain-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    cursor: pointer;
                    background: var(--jp-layout-color2, #f5f5f5);
                    border-bottom: 1px solid transparent;
                    transition: background 0.15s;
                    user-select: none;
                }
                
                .thought-chain-header:hover {
                    background: var(--jp-layout-color3, #e8e8e8);
                }
                
                .thought-chain-icon {
                    display: flex;
                    align-items: center;
                    color: var(--jp-brand-color1, #1976d2);
                }
                
                .thought-chain-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid var(--jp-border-color1, #e0e0e0);
                    border-top-color: var(--jp-brand-color1, #1976d2);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                
                .thought-chain-summary {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .thought-chain-count {
                    font-size: 11px;
                    color: var(--jp-ui-font-color2, #999999);
                    background: var(--jp-layout-color3, #e0e0e0);
                    padding: 1px 6px;
                    border-radius: 10px;
                }
                
                .thought-chain-arrow {
                    margin-left: auto;
                    color: var(--jp-ui-font-color2, #999999);
                    transition: transform 0.2s ease;
                }
                
                .thought-chain-arrow.expanded {
                    transform: rotate(180deg);
                }
                
                .thought-chain-steps {
                    padding: 4px 0;
                    border-top: 1px solid var(--jp-border-color1, #e0e0e0);
                }
                
                .thought-step {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 12px;
                    font-size: 12px;
                    transition: background 0.1s;
                }
                
                .thought-step:hover {
                    background: var(--jp-layout-color2, #f5f5f5);
                }
                
                .thought-step-indicator {
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                    width: 16px;
                    justify-content: center;
                }
                
                .step-spinner {
                    width: 12px;
                    height: 12px;
                    border: 1.5px solid var(--jp-border-color1, #e0e0e0);
                    border-top-color: var(--jp-brand-color1, #1976d2);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                
                .step-check {
                    color: #4caf50;
                }
                
                .step-error {
                    color: #e53935;
                }
                
                .thought-step-title {
                    flex: 1;
                    color: var(--jp-ui-font-color0, #333333);
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .thought-step-time {
                    font-size: 11px;
                    color: var(--jp-ui-font-color2, #999999);
                    flex-shrink: 0;
                }
                
                .thought-step-badge {
                    font-size: 10px;
                    padding: 1px 6px;
                    border-radius: 8px;
                    flex-shrink: 0;
                    font-weight: 500;
                }
                
                .badge-done {
                    background: #e8f5e9;
                    color: #2e7d32;
                }
                
                .badge-running {
                    background: #e3f2fd;
                    color: #1565c0;
                    animation: badgePulse 1.5s ease-in-out infinite;
                }
                
                .badge-error {
                    background: #ffebee;
                    color: #c62828;
                }
                
                @keyframes badgePulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                /* ==================== Attached Files ==================== */
                .attached-files {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    padding: 0 4px 8px 4px;
                }
                
                .attached-file-chip {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 8px;
                    background: var(--jp-layout-color0, #ffffff);
                    border: 1px solid var(--jp-border-color1, #e0e0e0);
                    border-radius: 6px;
                    font-size: 11px;
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .file-chip-name {
                    max-width: 120px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-weight: 500;
                }
                
                .file-chip-size {
                    color: var(--jp-ui-font-color2, #999999);
                }
                
                .file-chip-remove {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--jp-ui-font-color2, #999999);
                    padding: 0 2px;
                    font-size: 14px;
                    line-height: 1;
                }
                
                .file-chip-remove:hover {
                    color: #e53935;
                }
                
                .chip-success {
                    border-color: #c8e6c9;
                }
                
                .chip-error {
                    border-color: #ffcdd2;
                    background: #fff5f5;
                }
                
                .chip-icon-ok {
                    color: #4caf50;
                }
                
                .chip-icon-err {
                    color: #e53935;
                }
                
                .chip-uploading {
                    border-color: var(--jp-brand-color1, #1976d2);
                    color: var(--jp-ui-font-color2, #999999);
                    font-size: 11px;
                }
                
                .chip-spinner {
                    width: 10px;
                    height: 10px;
                    border: 1.5px solid var(--jp-border-color1, #e0e0e0);
                    border-top-color: var(--jp-brand-color1, #1976d2);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                
                /* ==================== Attach Button ==================== */
                .attach-btn {
                    flex-shrink: 0;
                    background: transparent;
                    border: none;
                    padding: 4px;
                    cursor: pointer;
                    color: var(--jp-ui-font-color2, #999999);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: color 0.15s;
                }
                
                .attach-btn:hover:not(:disabled) {
                    color: var(--jp-brand-color1, #1976d2);
                }
                
                .attach-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
                
                /* ==================== Model Selector ==================== */
                .model-selector-bar {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 0 0 0;
                }
                
                /* Mode toggle button */
                .mode-toggle-btn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: transparent;
                    border: 1px solid transparent;
                    padding: 3px 8px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 11px;
                    color: var(--jp-ui-font-color2, #999999);
                    transition: all 0.15s;
                    white-space: nowrap;
                }
                .mode-toggle-btn:hover:not(:disabled) {
                    background: var(--jp-layout-color0, #ffffff);
                    border-color: var(--jp-border-color1, #e0e0e0);
                    color: var(--jp-ui-font-color0, #333333);
                }
                .mode-toggle-btn.agent {
                    color: var(--jp-brand-color1, #1976d2);
                }
                .mode-toggle-btn.ask {
                    color: var(--jp-success-color1, #388e3c);
                }
                .mode-toggle-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .model-selector-wrapper {
                    position: relative;
                }
                
                .model-selector-btn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: transparent;
                    border: 1px solid transparent;
                    padding: 3px 8px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 11px;
                    color: var(--jp-ui-font-color2, #999999);
                    transition: all 0.15s;
                }
                
                .model-selector-btn:hover:not(:disabled) {
                    background: var(--jp-layout-color0, #ffffff);
                    border-color: var(--jp-border-color1, #e0e0e0);
                    color: var(--jp-ui-font-color0, #333333);
                }
                
                .model-selector-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .model-arrow {
                    transition: transform 0.2s ease;
                }
                
                .model-arrow.expanded {
                    transform: rotate(180deg);
                }
                
                .model-dropdown {
                    position: absolute;
                    bottom: 100%;
                    left: 0;
                    min-width: 200px;
                    max-height: 240px;
                    overflow-y: auto;
                    background: var(--jp-layout-color0, #ffffff);
                    border: 1px solid var(--jp-border-color1, #e0e0e0);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    z-index: 200;
                    padding: 4px;
                    margin-bottom: 4px;
                }
                
                .model-option {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    padding: 6px 10px;
                    background: transparent;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    color: var(--jp-ui-font-color0, #333333);
                    text-align: left;
                    transition: background 0.1s;
                }
                
                .model-option:hover {
                    background: var(--jp-layout-color2, #f5f5f5);
                }
                
                .model-option.active {
                    background: rgba(25, 118, 210, 0.08);
                    color: var(--jp-brand-color1, #1976d2);
                    font-weight: 500;
                }
                
                .model-option.active svg {
                    color: var(--jp-brand-color1, #1976d2);
                }
            `}</style>
        </div>
    );
};
