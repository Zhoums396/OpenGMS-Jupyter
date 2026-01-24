/**
 * Agent Chat Panel
 * AI 助手聊天界面，放置在左侧边栏
 */

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { INotebookTracker } from '@jupyterlab/notebook';
import { NotebookActions } from '@jupyterlab/notebook';
import { agentApi, ChatMessage, StreamEvent, ChatContext, ToolCall, WorkspaceFiles, Conversation } from '../services/agentApi';
import { LLMSettings } from './LLMSettings';
import { ChatHistory } from './ChatHistory';

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
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ notebookTracker }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [hasConfig, setHasConfig] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [executedTools, setExecutedTools] = useState<string[]>([]);
    const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());  // 跟踪哪些消息的思考过程是展开的
    
    // 历史对话相关状态
    const [showHistory, setShowHistory] = useState(false);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string>('default_user');
    const [conversationTitle, setConversationTitle] = useState<string>('新对话');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

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

    // 检查是否已配置 LLM
    useEffect(() => {
        checkConfig();
    }, []);

    const checkConfig = async () => {
        try {
            const config = await agentApi.getConfig();
            setHasConfig(!!config.hasApiKey);
        } catch (e) {
            setHasConfig(false);
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
    }, [notebookTracker, workspaceFiles, scanWorkspaceData]);

    // 执行工具调用
    const executeToolCall = useCallback(async (tool: ToolCall): Promise<string> => {
        console.log('[Agent] Executing tool:', tool.name, tool.arguments);
        
        const notebook = notebookTracker?.currentWidget;

        try {
            const args = JSON.parse(tool.arguments || '{}');
            
            // 前端执行的工具（notebook 操作）
            if (!notebook) {
                return '错误: 没有打开的 Notebook，请先打开或创建一个 Notebook';
            }
            
            switch (tool.name) {
                case 'add_code_cell': {
                    const code = args.code || '';
                    // 获取当前单元格索引
                    const activeCellIndex = notebook.content.activeCellIndex;
                    // 在当前位置后插入新的代码单元格
                    NotebookActions.insertBelow(notebook.content);
                    
                    // 等待一下让 UI 更新
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // 获取新插入的单元格
                    const newCellIndex = activeCellIndex + 1;
                    const newCell = notebook.content.widgets[newCellIndex];
                    
                    if (newCell && newCell.model) {
                        newCell.model.sharedModel.setSource(code);
                        // 确保选中新单元格
                        notebook.content.activeCellIndex = newCellIndex;
                        // 自动运行插入的代码
                        await NotebookActions.run(notebook.content, notebook.sessionContext);
                    }
                    setExecutedTools(prev => [...prev, `📝 添加并运行代码单元格`]);
                    return '成功添加并运行代码单元格';
                }
                
                case 'add_markdown_cell': {
                    const content = args.content || '';
                    const activeCellIndex = notebook.content.activeCellIndex;
                    NotebookActions.insertBelow(notebook.content);
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    const newCellIndex = activeCellIndex + 1;
                    notebook.content.activeCellIndex = newCellIndex;
                    
                    // 更改单元格类型为 markdown
                    NotebookActions.changeCellType(notebook.content, 'markdown');
                    
                    const newCell = notebook.content.widgets[newCellIndex];
                    if (newCell && newCell.model) {
                        newCell.model.sharedModel.setSource(content);
                        // 渲染 markdown
                        await NotebookActions.run(notebook.content, notebook.sessionContext);
                    }
                    setExecutedTools(prev => [...prev, `📄 添加 Markdown 单元格`]);
                    return '成功添加 Markdown 单元格';
                }
                
                default:
                    console.log('[Agent] Unknown tool:', tool.name);
                    return `工具 ${tool.name} 暂不支持`;
            }
        } catch (e: any) {
            console.error('[Agent] Tool execution error:', e);
            return `工具执行错误: ${e.message}`;
        }
    }, [notebookTracker]);

    // 发送消息
    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        
        const userMessage: ChatMessage = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };
        
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input.trim();
        setInput('');
        setIsLoading(true);
        setStreamingContent('');
        setExecutedTools([]);
        
        try {
            // 异步获取上下文（包括工作目录扫描）
            const context = await getNotebookContext();
            let currentSessionId = sessionId;
            
            // 如果是新对话，先创建对话记录
            let convId = currentConversationId;
            if (!convId) {
                try {
                    // 根据第一条消息生成标题
                    const title = currentInput.length > 30 
                        ? currentInput.substring(0, 30) + '...' 
                        : currentInput;
                    const newConv = await agentApi.createConversation(userId, title);
                    convId = newConv.id;
                    setCurrentConversationId(convId);
                    setConversationTitle(title);
                } catch (e) {
                    console.warn('[Agent] Failed to create conversation:', e);
                }
            }
            
            // Agent 循环：处理工具调用直到没有更多工具调用
            await processAgentLoop(userMessage.content, context, currentSessionId, convId);
            
        } catch (error: any) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ 错误: ${error.message}`,
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
            setStreamingContent('');
        }
    };

    // Agent 循环处理函数
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
        
        try {
            // 选择使用 chat 还是 submitToolResults
            const eventStream = isToolResult && currentSessionId && toolResultsToSubmit
                ? agentApi.submitToolResults(currentSessionId, toolResultsToSubmit)
                : agentApi.chat(initialMessage, currentSessionId || undefined, context);
            
            console.log('[Agent] Starting event stream, isToolResult:', isToolResult);
            
            for await (const event of eventStream) {
                console.log('[Agent] Event received:', event.type);
                
                switch (event.type) {
                    case 'text':
                        fullContent += event.content || '';
                        setStreamingContent(fullContent);
                        break;
                
                case 'tool_call':
                    console.log('[Agent] Tool call received:', event.tool);
                    if (event.tool) {
                        pendingToolCalls.push(event.tool);
                    }
                    break;
                
                case 'done':
                    if (event.sessionId) {
                        currentSessionId = event.sessionId;
                        setSessionId(event.sessionId);
                    }
                    
                    // 获取要执行的工具
                    const toolsToExecute = (event.toolCalls && event.toolCalls.length > 0) 
                        ? event.toolCalls 
                        : pendingToolCalls;
                    
                    // 如果有工具需要执行
                    if (toolsToExecute.length > 0) {
                        // 保存当前的思考内容（用于后续折叠显示）
                        const thinkingText = fullContent.trim();
                        
                        // 清空流式内容显示
                        setStreamingContent('');
                        fullContent = '';
                        
                        // 逐个执行工具并立即显示进度
                        const toolResultsArray: Array<{ toolCallId: string; result: string }> = [];
                        const executedActionNames: string[] = [];
                        const executedToolCalls: ToolCall[] = [];
                        
                        for (const tool of toolsToExecute) {
                            const toolDisplayName = getToolDisplayName(tool.name);
                            
                            // 立即显示正在执行的工具
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: `⏳ 正在执行: ${toolDisplayName}...`,
                                timestamp: new Date()
                            }]);
                            
                            // 执行工具
                            const result = await executeToolCall(tool);
                            toolResultsArray.push({
                                toolCallId: tool.id,
                                result: result
                            });
                            executedActionNames.push(toolDisplayName);
                            executedToolCalls.push(tool);
                            
                            // 删除"正在执行"的临时消息
                            setMessages(prev => prev.slice(0, -1));
                        }
                        
                        // 添加包含思考内容和工具执行结果的消息
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: '',  // 内容为空，通过 executedActions 显示
                            toolCalls: executedToolCalls,
                            executedActions: executedActionNames,
                            thinkingContent: thinkingText || undefined,  // 保存思考内容
                            timestamp: new Date()
                        } as ChatMessage & { executedActions?: string[] }]);
                        
                        // 将工具结果发送回 LLM，继续对话
                        console.log('[Agent] Submitting tool results and continuing...');
                        await processAgentLoop('', context, currentSessionId, conversationId, true, toolResultsArray);
                        return; // 递归调用后直接返回
                    }
                    break;
                
                case 'error':
                    console.error('[Agent] Error event received:', event.error);
                    if (event.error?.includes('请先配置')) {
                        setShowSettings(true);
                    }
                    throw new Error(event.error);
            }
        }
        } catch (error: any) {
            console.error('[Agent] processAgentLoop error:', error);
            throw error;
        }
        
        // 没有工具调用时，添加最终的助手消息
        if (fullContent) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: fullContent,
                timestamp: new Date()
            }]);
            
            // 保存对话历史（只保存最终响应）
            if (conversationId && !isToolResult) {
                // 仅在首次调用（非工具结果回调）时保存用户消息
                saveConversationHistory(conversationId, initialMessage, fullContent);
            } else if (conversationId && isToolResult) {
                // 工具结果回调时只保存助手响应
                saveConversationHistory(conversationId, '', fullContent);
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

    // 新建会话
    const handleNewChat = async () => {
        setMessages([]);
        setSessionId(null);
        setStreamingContent('');
        setExecutedTools([]);
        setCurrentConversationId(null);
        setConversationTitle('新对话');
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
            alert('加载对话失败');
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
                            title="复制"
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

    // 解析并渲染消息内容（支持代码块）
    const renderMessageContent = (content: string) => {
        const parts: React.ReactNode[] = [];
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;
        let keyIndex = 0;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            // 添加代码块之前的文本
            if (match.index > lastIndex) {
                const text = content.slice(lastIndex, match.index);
                parts.push(<span key={keyIndex++} className="text-content">{text}</span>);
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
        
        // 添加剩余文本
        if (lastIndex < content.length) {
            parts.push(<span key={keyIndex++} className="text-content">{content.slice(lastIndex)}</span>);
        }
        
        return parts.length > 0 ? parts : content;
    };

    // 渲染消息
    const renderMessage = (msg: ChatMessage & { executedActions?: string[] }, index: number) => {
        const isUser = msg.role === 'user';
        const hasContent = msg.content && msg.content.trim().length > 0;
        const hasActions = msg.executedActions && msg.executedActions.length > 0;
        const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;
        const hasThinking = msg.thinkingContent && msg.thinkingContent.trim().length > 0;
        const isThinkingExpanded = expandedThinking.has(index);
        
        // 如果是只有工具执行的消息（无文本内容）
        if (!isUser && !hasContent && (hasActions || hasToolCalls)) {
            return (
                <div key={index} className="agent-message assistant">
                    <div className="assistant-response">
                        {/* 思考过程折叠区域 */}
                        {hasThinking && (
                            <div className="thinking-section">
                                <button 
                                    className="thinking-toggle"
                                    onClick={() => toggleThinking(index)}
                                    title={isThinkingExpanded ? "折叠思考过程" : "展开思考过程"}
                                >
                                    <svg 
                                        className={`thinking-arrow ${isThinkingExpanded ? 'expanded' : ''}`} 
                                        width="12" 
                                        height="12" 
                                        viewBox="0 0 16 16" 
                                        fill="currentColor"
                                    >
                                        <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
                                    </svg>
                                    <span className="thinking-label">思考过程</span>
                                </button>
                                {isThinkingExpanded && (
                                    <div className="thinking-content">
                                        {renderMessageContent(msg.thinkingContent!)}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="executed-actions">
                            {hasActions && msg.executedActions!.map((action, i) => (
                                <div key={i} className="action-item completed">
                                    <svg className="check-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                        <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                                    </svg>
                                    <span>{action}</span>
                                </div>
                            ))}
                            {!hasActions && hasToolCalls && msg.toolCalls!.map((tool, i) => (
                                <div key={i} className="action-item completed">
                                    <svg className="check-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                        <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                                    </svg>
                                    <span>{getToolDisplayName(tool.name)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }
        
        return (
            <div key={index} className={`agent-message ${isUser ? 'user' : 'assistant'}`}>
                {isUser ? (
                    // 用户消息 - 简单气泡
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
                    // 助手消息
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
                            {renderMessageContent(msg.content)}
                        </div>
                    </div>
                )}
            </div>
        );
    };
    
    // 获取工具的友好显示名称
    const getToolDisplayName = (toolName: string): string => {
        const nameMap: Record<string, string> = {
            'add_code_cell': '添加并运行代码单元格',
            'add_markdown_cell': '添加 Markdown 单元格',
            'run_code': '执行代码',
            'read_file': '读取文件',
            'list_files': '列出文件',
            'search_models': '搜索地理模型',
            'search_datamethods': '搜索数据方法',
            'get_model_info': '获取模型详情',
            'get_datamethod_info': '获取数据方法详情',
            'generate_model_code': '生成模型调用代码',
            'generate_datamethod_code': '生成数据方法调用代码'
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
            {/* 历史对话侧边栏 */}
            <ChatHistory
                userId={userId}
                currentConversationId={currentConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewChat}
                isVisible={showHistory}
                onClose={() => setShowHistory(false)}
            />
            
            {/* 头部 */}
            <div className="agent-header">
                <div className="header-left">
                    <svg className="agent-logo" width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z"/>
                    </svg>
                    <span className="header-title">{conversationTitle}</span>
                </div>
                <div className="header-right">
                    <button className="icon-btn" onClick={() => setShowHistory(true)} title="历史对话">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v8.5a.25.25 0 01-.25.25h-6.5a.75.75 0 00-.53.22L4.5 14.44v-2.19a.75.75 0 00-.75-.75h-2a.25.25 0 01-.25-.25v-8.5zM1.75 1A1.75 1.75 0 000 2.75v8.5C0 12.216.784 13 1.75 13H3v2.25c0 .69.56 1.25 1.25 1.25.33 0 .65-.132.884-.366L7.634 13.5H14.25A1.75 1.75 0 0016 11.75v-8.5A1.75 1.75 0 0014.25 1H1.75z"/>
                        </svg>
                    </button>
                    <button className="icon-btn" onClick={handleNewChat} title="新建对话">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M7.25 1.75a.75.75 0 011.5 0V7h5.25a.75.75 0 010 1.5H8.75v5.25a.75.75 0 01-1.5 0V8.5H2a.75.75 0 010-1.5h5.25V1.75z"/>
                        </svg>
                    </button>
                    <button className="icon-btn" onClick={() => setShowSettings(true)} title="设置">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="evenodd" d="M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.423 1.53.27l1.102-.303c.11-.03.175.016.195.046.219.31.41.641.573.989.014.031.022.11-.059.19l-.815.806c-.411.406-.562.957-.53 1.456a4.588 4.588 0 010 .582c-.032.499.119 1.05.53 1.456l.815.806c.08.08.073.159.059.19a6.494 6.494 0 01-.573.99c-.02.029-.086.074-.195.045l-1.103-.303c-.559-.153-1.112-.008-1.529.27-.16.107-.327.204-.5.29-.449.222-.851.628-.998 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.613 6.613 0 01-1.142 0c-.036-.003-.108-.037-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a4.502 4.502 0 01-.501-.29c-.417-.278-.97-.423-1.53-.27l-1.102.303c-.11.03-.175-.016-.195-.046a6.492 6.492 0 01-.573-.989c-.014-.031-.022-.11.059-.19l.815-.806c.411-.406.562-.957.53-1.456a4.587 4.587 0 010-.582c.032-.499-.119-1.05-.53-1.456l-.815-.806c-.08-.08-.073-.159-.059-.19.162-.348.354-.68.573-.989.02-.03.085-.076.195-.046l1.103.303c.559.153 1.112.008 1.529-.27.16-.107.327-.204.5-.29.449-.222.851-.628.998-1.189l.289-1.105c.029-.11.101-.143.137-.146zM8 0c-.236 0-.47.01-.701.03-.743.065-1.29.615-1.458 1.261l-.29 1.106c-.017.066-.078.158-.211.224a5.994 5.994 0 00-.668.386c-.123.082-.233.09-.3.071L3.27 2.776c-.644-.177-1.392.02-1.82.63a7.977 7.977 0 00-.704 1.217c-.315.675-.111 1.422.363 1.891l.815.806c.05.048.098.147.088.294a6.084 6.084 0 000 .772c.01.147-.038.246-.088.294l-.815.806c-.474.469-.678 1.216-.363 1.891.2.428.436.835.704 1.218.428.609 1.176.806 1.82.63l1.103-.303c.066-.019.176-.011.299.071.213.143.436.272.668.386.133.066.194.158.212.224l.289 1.106c.169.646.715 1.196 1.458 1.26a8.094 8.094 0 001.402 0c.743-.064 1.29-.614 1.458-1.26l.29-1.106c.017-.066.078-.158.211-.224a5.98 5.98 0 00.668-.386c.123-.082.233-.09.3-.071l1.102.302c.644.177 1.392-.02 1.82-.63.268-.382.505-.789.704-1.217.315-.675.111-1.422-.364-1.891l-.814-.806c-.05-.048-.098-.147-.088-.294a6.1 6.1 0 000-.772c-.01-.147.039-.246.088-.294l.814-.806c.475-.469.679-1.216.364-1.891a7.992 7.992 0 00-.704-1.218c-.428-.609-1.176-.806-1.82-.63l-1.103.303c-.066.019-.176.011-.299-.071a5.991 5.991 0 00-.668-.386c-.133-.066-.194-.158-.212-.224L10.16 1.29C9.99.645 9.444.095 8.701.031A8.094 8.094 0 008 0zm0 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6.5 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* 消息区域 */}
            <div className="agent-messages">
                {messages.length === 0 && !streamingContent && (
                    <div className="agent-welcome">
                        <div className="welcome-icon">
                            <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" opacity="0.5">
                                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z"/>
                            </svg>
                        </div>
                        <h3>OpenGeoLab AI 助手</h3>
                        <p className="welcome-subtitle">我可以帮你编写代码、搜索模型、处理数据</p>
                        {!hasConfig && (
                            <button className="config-btn" onClick={() => setShowSettings(true)}>
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.423 1.53.27l1.102-.303c.11-.03.175.016.195.046a6.588 6.588 0 01.573.989c.014.031.022.11-.059.19l-.815.806c-.411.406-.562.957-.53 1.456a4.588 4.588 0 010 .582c-.032.499.119 1.05.53 1.456l.815.806c.08.08.073.159.059.19-.163.348-.355.68-.573.99-.02.029-.086.074-.195.045l-1.103-.303c-.559-.153-1.112-.008-1.529.27-.16.107-.327.204-.5.29-.449.222-.851.628-.998 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.613 6.613 0 01-1.142 0c-.036-.003-.108-.037-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a4.502 4.502 0 01-.501-.29c-.417-.278-.97-.423-1.53-.27l-1.102.303c-.11.03-.175-.016-.195-.046a6.492 6.492 0 01-.573-.989c-.014-.031-.022-.11.059-.19l.815-.806c.411-.406.562-.957.53-1.456a4.587 4.587 0 010-.582c.032-.499-.119-1.05-.53-1.456l-.815-.806c-.08-.08-.073-.159-.059-.19.162-.348.354-.68.573-.989.02-.03.085-.076.195-.046l1.103.303c.559.153 1.112.008 1.529-.27.16-.107.327-.204.5-.29.449-.222.851-.628.998-1.189l.289-1.105c.029-.11.101-.143.137-.146zM8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/>
                                </svg>
                                配置 LLM API
                            </button>
                        )}
                    </div>
                )}
                
                {messages.map(renderMessage)}
                
                {/* 流式响应显示 */}
                {streamingContent && (
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
                
                {/* 工具执行状态 */}
                {executedTools.length > 0 && isLoading && (
                    <div className="agent-actions">
                        {executedTools.map((tool, i) => (
                            <div key={i} className="action-item">
                                <svg className="check-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                    <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                                </svg>
                                <span>{tool}</span>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* 加载指示器 */}
                {isLoading && !streamingContent && (
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

            {/* 输入区域 */}
            <div className="agent-input-area">
                <div className="input-wrapper">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="询问 OpenGeoLab AI..."
                        disabled={isLoading}
                        rows={1}
                    />
                    <button
                        className="submit-btn"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M.989 8l6.012-6.012v4.762h8v2.5h-8v4.762L.99 8z" transform="rotate(-90 8 8)"/>
                        </svg>
                    </button>
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
                    color: var(--jp-brand-color1, #1976d2);
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
            `}</style>
        </div>
    );
};
