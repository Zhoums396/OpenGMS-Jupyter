/**
 * Agent API Service
 * 处理与后端 Agent 服务的通信
 */

const API_BASE = '/api/agent';

export interface LLMConfig {
    provider: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    customModels: string[];
    hasApiKey?: boolean;
}

export interface LLMProvider {
    name: string;
    baseUrl: string;
    models: string[];
    defaultModel: string;
    isAnthropic?: boolean;
    noApiKey?: boolean;
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolCalls?: ToolCall[];
    timestamp?: Date;
    thinkingContent?: string;  // AI 的思考过程内容，用于折叠显示
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: string;
    result?: string;
}

export interface StreamEvent {
    type: 'text' | 'tool_call' | 'done' | 'error';
    content?: string;
    tool?: ToolCall;
    toolCalls?: ToolCall[];
    sessionId?: string;
    error?: string;
}

export interface ChatContext {
    notebookName?: string;
    currentCellCode?: string;
    selectedText?: string;
    workingDirectory?: string;
    availableFiles?: string[];
    workspaceFiles?: WorkspaceFiles;
}

export interface WorkspaceFile {
    name: string;
    path: string;
    extension: string;
    size: number;
    sizeFormatted: string;
    type: 'vector' | 'raster' | 'table' | 'other';
}

export interface WorkspaceFiles {
    totalFiles: number;
    vector: WorkspaceFile[];
    raster: WorkspaceFile[];
    table: WorkspaceFile[];
    other: WorkspaceFile[];
}

/**
 * 获取认证 token
 */
function getToken(): string | null {
    if (typeof window !== 'undefined') {
        // 首先检查 URL 中是否有 token
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('geomodel_token');
        if (tokenFromUrl) {
            localStorage.setItem('geomodel_jwt', tokenFromUrl);
            return tokenFromUrl;
        }
        // 从 localStorage 获取
        return localStorage.getItem('geomodel_jwt');
    }
    return null;
}

/**
 * 构建带认证的请求头
 */
function getAuthHeaders(): Record<string, string> {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * 获取 API 基础 URL
 */
function getApiBase(): string {
    if (typeof window !== 'undefined') {
        // 使用与 api.ts 相同的逻辑
        const hostname = window.location.hostname;
        // 验证 hostname 有效性，防止构造无效 URL
        if (hostname && hostname.length > 0) {
            return `http://${hostname}:3000`;
        }
        console.warn('[AgentAPI] Invalid hostname, falling back to localhost');
    }
    return 'http://localhost:3000';
}

/**
 * 获取可用的 LLM Provider 列表
 */
export async function getProviders(): Promise<Record<string, LLMProvider>> {
    const response = await fetch(`${getApiBase()}${API_BASE}/providers`, {
        headers: getAuthHeaders()
    });
    
    if (!response.ok) {
        throw new Error('获取 Provider 列表失败');
    }
    
    const data = await response.json();
    return data.providers;
}

/**
 * 获取当前用户的 LLM 配置
 */
export async function getConfig(): Promise<LLMConfig> {
    const response = await fetch(`${getApiBase()}${API_BASE}/config`, {
        headers: getAuthHeaders()
    });
    
    if (!response.ok) {
        throw new Error('获取配置失败');
    }
    
    const data = await response.json();
    return data.config;
}

/**
 * 保存 LLM 配置
 */
export async function saveConfig(config: Partial<LLMConfig>): Promise<void> {
    const response = await fetch(`${getApiBase()}${API_BASE}/config`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify(config)
    });
    
    if (!response.ok) {
        throw new Error('保存配置失败');
    }
}

/**
 * 测试 LLM 连接
 */
export async function testConnection(): Promise<{ status: string; message: string; model?: string }> {
    const response = await fetch(`${getApiBase()}${API_BASE}/test`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || '连接测试失败');
    }
    
    return data;
}

/**
 * 从容器名称或 URL 参数中提取用户和项目信息
 * URL 参数优先: user, project, container
 * 容器名格式: jupyter-{userName}-{projectName}
 * 目录格式: jupyter-data/{UserName}/{ProjectName}
 */
async function extractContainerInfo(): Promise<{ userName: string; projectName: string } | null> {
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        
        // 1. 优先使用直接的 user 和 project 参数
        const directUser = urlParams.get('user');
        const directProject = urlParams.get('project');
        if (directUser) {
            console.log('[AgentAPI] Using URL params - user:', directUser, 'project:', directProject);
            return { 
                userName: directUser, 
                projectName: directProject || '' 
            };
        }
        
        // 2. 尝试从 container 参数解析
        const containerName = urlParams.get('container');
        if (containerName) {
            // 格式: jupyter-zhoums396-agent -> Zhoums396, Agent
            const match = containerName.match(/^jupyter-([^-]+)-(.+)$/i);
            if (match) {
                // 转换为驼峰式大小写（匹配目录命名）
                const userName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                const projectName = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
                console.log('[AgentAPI] Parsed from container name:', { userName, projectName });
                return { userName, projectName };
            }
        }
        
        // 3. 尝试从 hostname 推断（Docker 容器中 hostname 可能是容器名）
        const hostname = window.location.hostname;
        const hostMatch = hostname.match(/^jupyter-([^-]+)-(.+)$/i);
        if (hostMatch) {
            const userName = hostMatch[1].charAt(0).toUpperCase() + hostMatch[1].slice(1).toLowerCase();
            const projectName = hostMatch[2].charAt(0).toUpperCase() + hostMatch[2].slice(1).toLowerCase();
            console.log('[AgentAPI] Parsed from hostname:', { userName, projectName });
            return { userName, projectName };
        }
        
        // 4. 尝试通过当前端口号查询后端获取容器信息
        const port = window.location.port;
        if (port && port !== '80' && port !== '443') {
            try {
                const apiBase = getApiBase();
                const response = await fetch(`${apiBase}/api/jupyter/container-by-port/${port}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.found) {
                        console.log('[AgentAPI] Found container info from port:', data);
                        return {
                            userName: data.userName,
                            projectName: data.projectName
                        };
                    }
                }
            } catch (e) {
                console.log('[AgentAPI] Failed to query container by port:', e);
            }
        }
    }
    return null;
}

/**
 * 扫描用户工作目录中的数据文件
 */
export async function scanWorkspace(projectName?: string): Promise<WorkspaceFiles> {
    try {
        // 首先尝试从容器信息中获取用户和项目名（现在是异步的）
        const containerInfo = await extractContainerInfo();
        
        // 获取用户信息（作为后备）
        const userInfo = getUserInfo();
        
        // 确定最终使用的用户名和项目名
        let finalUserName = containerInfo?.userName || userInfo.userName;
        let finalProjectName = containerInfo?.projectName || projectName || '';
        
        console.log('[AgentAPI] Scanning workspace:', {
            containerInfo,
            userInfo,
            finalUserName,
            finalProjectName
        });
        
        // 构建 headers，只添加非空值
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        };
        // 只有当值非空时才添加自定义 headers
        if (userInfo.userId) {
            headers['x-user-id'] = userInfo.userId;
        }
        if (finalUserName) {
            headers['x-user-name'] = finalUserName;
        }
        
        // 获取容器名称（用于后端解析用户和项目）
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const containerName = urlParams?.get('container') || '';
        
        const response = await fetch(`${getApiBase()}${API_BASE}/scan-workspace`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                userId: userInfo.userId,
                userName: finalUserName,
                projectName: finalProjectName,
                containerName: containerName  // 传递容器名称给后端
            })
        });
        
        console.log('[AgentAPI] Scan response status:', response.status);
        
        if (!response.ok) {
            console.warn('[AgentAPI] Workspace scan failed:', response.status);
            return { totalFiles: 0, vector: [], raster: [], table: [], other: [] };
        }
        
        const data = await response.json();
        console.log('[AgentAPI] Scan result:', data);
        return {
            totalFiles: data.totalFiles || 0,
            vector: data.grouped?.vector || [],
            raster: data.grouped?.raster || [],
            table: data.grouped?.table || [],
            other: data.grouped?.other || []
        };
    } catch (e) {
        console.warn('[AgentAPI] Workspace scan error:', e);
        return { totalFiles: 0, vector: [], raster: [], table: [], other: [] };
    }
}

/**
 * 获取用户信息
 */
function getUserInfo(): { userId: string; userName: string } {
    if (typeof window !== 'undefined') {
        // 1. 尝试从 localStorage 的 geomodel_user 获取
        const userInfoStr = localStorage.getItem('geomodel_user');
        if (userInfoStr) {
            try {
                const userInfo = JSON.parse(userInfoStr);
                if (userInfo.login || userInfo.userName || userInfo.username) {
                    return {
                        userId: String(userInfo.id || userInfo.userId || ''),
                        userName: userInfo.login || userInfo.username || userInfo.userName || ''
                    };
                }
            } catch (e) {
                // ignore
            }
        }
        
        // 2. 尝试从 JWT token 解析
        const token = localStorage.getItem('geomodel_jwt');
        if (token) {
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    if (payload.userName || payload.login) {
                        return {
                            userId: String(payload.userId || payload.id || ''),
                            userName: payload.userName || payload.login || ''
                        };
                    }
                }
            } catch (e) {
                // ignore
            }
        }
        
        // 3. 尝试从 URL 参数获取
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserName = urlParams.get('user') || urlParams.get('userName');
        if (urlUserName) {
            return {
                userId: urlParams.get('userId') || '',
                userName: urlUserName
            };
        }
        
        // 4. 尝试从 cookie 获取
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'geomodel_user' && value) {
                try {
                    const decoded = decodeURIComponent(value);
                    const userInfo = JSON.parse(decoded);
                    return {
                        userId: String(userInfo.id || userInfo.userId || ''),
                        userName: userInfo.login || userInfo.userName || ''
                    };
                } catch (e) {
                    // ignore
                }
            }
        }
    }
    return { userId: '', userName: '' };
}

/**
 * 发送聊天消息（流式响应）
 */
export async function* chat(
    message: string,
    sessionId?: string,
    context?: ChatContext
): AsyncGenerator<StreamEvent> {
    const url = `${getApiBase()}${API_BASE}/chat`;
    console.log('[AgentAPI] chat URL:', url);
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ message, sessionId, context })
    });
    
    console.log('[AgentAPI] chat response status:', response.status);
    
    if (!response.ok) {
        let errorMsg = '请求失败';
        try {
            const error = await response.json();
            if (error.needConfig) {
                yield { type: 'error', error: '请先配置 LLM API' };
                return;
            }
            errorMsg = error.error || errorMsg;
        } catch (e) {
            console.error('[AgentAPI] Failed to parse error:', e);
        }
        throw new Error(errorMsg);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('无法读取响应流');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    yield data as StreamEvent;
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }
    }
}

/**
 * 获取可用的 Agent 工具列表
 */
export async function getTools(): Promise<any[]> {
    const response = await fetch(`${getApiBase()}${API_BASE}/tools`, {
        headers: getAuthHeaders()
    });
    
    if (!response.ok) {
        throw new Error('获取工具列表失败');
    }
    
    const data = await response.json();
    return data.tools;
}

/**
 * 提交工具执行结果（流式响应，用于 Agent 循环）
 */
export async function* submitToolResults(
    sessionId: string,
    toolResults: Array<{ toolCallId: string; result: any }>
): AsyncGenerator<StreamEvent> {
    try {
        const apiBase = getApiBase();
        const url = `${apiBase}${API_BASE}/tool-results`;
        console.log('[AgentAPI] submitToolResults URL:', url);
        console.log('[AgentAPI] submitToolResults sessionId:', sessionId);
        console.log('[AgentAPI] submitToolResults toolResults:', JSON.stringify(toolResults));
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ sessionId, toolResults })
        });
        
        console.log('[AgentAPI] submitToolResults response status:', response.status);
        
        if (!response.ok) {
            let errorMsg = '提交工具结果失败';
            try {
                const error = await response.json();
                errorMsg = error.error || errorMsg;
            } catch (e) {
                console.error('[AgentAPI] Failed to parse error response:', e);
            }
            yield { type: 'error', error: errorMsg };
            return;
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('无法读取响应流');
        }
        
        const decoder = new TextDecoder();
        let buffer = '';
    
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        yield data as StreamEvent;
                    } catch (e) {
                        console.warn('[AgentAPI] Failed to parse SSE data:', line, e);
                    }
                }
            }
        }
    } catch (error: any) {
        console.error('[AgentAPI] submitToolResults error:', error);
        yield { type: 'error', error: error.message || 'Unknown error in submitToolResults' };
    }
}

/**
 * 提交工具执行结果
 */
export async function submitToolResult(
    sessionId: string,
    toolCallId: string,
    result: any
): Promise<void> {
    const response = await fetch(`${getApiBase()}${API_BASE}/tool-results`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ sessionId, toolResults: [{ toolCallId, result }] })
    });
    
    if (!response.ok) {
        throw new Error('提交工具结果失败');
    }
}

/**
 * 获取会话历史
 */
export async function getSession(sessionId: string): Promise<{ messages: ChatMessage[] }> {
    const response = await fetch(`${getApiBase()}${API_BASE}/session/${sessionId}`, {
        headers: getAuthHeaders()
    });
    
    if (!response.ok) {
        throw new Error('获取会话历史失败');
    }
    
    return response.json();
}

/**
 * 删除会话
 */
export async function deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${getApiBase()}${API_BASE}/session/${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    
    if (!response.ok) {
        throw new Error('删除会话失败');
    }
}

// ==================== 对话历史 API ====================

export interface ConversationSummary {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    user_id: string;
    message_count: number;
    metadata?: Record<string, any>;
}

export interface Conversation {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    user_id: string;
    messages: ChatMessage[];
    metadata?: Record<string, any>;
}

/**
 * 获取对话列表
 */
export async function listConversations(
    userId: string = 'default',
    limit: number = 50,
    offset: number = 0
): Promise<{ conversations: ConversationSummary[]; total: number }> {
    const response = await fetch(
        `${getApiBase()}${API_BASE}/conversations?user_id=${userId}&limit=${limit}&offset=${offset}`,
        { headers: getAuthHeaders() }
    );
    
    if (!response.ok) {
        throw new Error('获取对话列表失败');
    }
    
    return response.json();
}

/**
 * 创建新对话
 */
export async function createConversation(
    userId: string = 'default',
    title?: string,
    metadata?: Record<string, any>
): Promise<ConversationSummary> {
    const response = await fetch(`${getApiBase()}${API_BASE}/conversations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ user_id: userId, title, metadata })
    });
    
    if (!response.ok) {
        throw new Error('创建对话失败');
    }
    
    return response.json();
}

/**
 * 获取对话详情
 */
export async function getConversation(
    conversationId: string,
    userId: string = 'default'
): Promise<Conversation> {
    const response = await fetch(
        `${getApiBase()}${API_BASE}/conversations/${conversationId}?user_id=${userId}`,
        { headers: getAuthHeaders() }
    );
    
    if (!response.ok) {
        throw new Error('获取对话详情失败');
    }
    
    return response.json();
}

/**
 * 更新对话标题
 */
export async function updateConversationTitle(
    conversationId: string,
    title: string,
    userId: string = 'default'
): Promise<ConversationSummary> {
    const response = await fetch(
        `${getApiBase()}${API_BASE}/conversations/${conversationId}/title?user_id=${userId}`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ title })
        }
    );
    
    if (!response.ok) {
        throw new Error('更新对话标题失败');
    }
    
    return response.json();
}

/**
 * 删除对话
 */
export async function deleteConversation(
    conversationId: string,
    userId: string = 'default'
): Promise<void> {
    const response = await fetch(
        `${getApiBase()}${API_BASE}/conversations/${conversationId}?user_id=${userId}`,
        {
            method: 'DELETE',
            headers: getAuthHeaders()
        }
    );
    
    if (!response.ok) {
        throw new Error('删除对话失败');
    }
}

/**
 * 搜索对话
 */
export async function searchConversations(
    query: string,
    userId: string = 'default',
    limit: number = 20
): Promise<{ results: ConversationSummary[]; total: number }> {
    const response = await fetch(
        `${getApiBase()}${API_BASE}/conversations/search?q=${encodeURIComponent(query)}&user_id=${userId}&limit=${limit}`,
        { headers: getAuthHeaders() }
    );
    
    if (!response.ok) {
        throw new Error('搜索对话失败');
    }
    
    return response.json();
}

/**
 * 向对话添加消息
 */
export async function addMessageToConversation(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    userId: string = 'default'
): Promise<{ status: string; message_count: number }> {
    const response = await fetch(
        `${getApiBase()}${API_BASE}/conversations/${conversationId}/messages`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ role, content, user_id: userId })
        }
    );
    
    if (!response.ok) {
        throw new Error('添加消息失败');
    }
    
    return response.json();
}

/**
 * 带历史记录的聊天（SSE 流式）
 */
export async function* chatWithHistory(
    message: string,
    conversationId: string | null,
    userId: string = 'default',
    context?: ChatContext
): AsyncGenerator<StreamEvent & { conversationId?: string }> {
    const apiBase = getApiBase();
    const containerInfo = await extractContainerInfo();
    
    const requestBody: Record<string, any> = {
        message,
        conversation_id: conversationId,
        user_id: userId,
        context
    };
    
    if (containerInfo) {
        requestBody.user_name = containerInfo.userName;
        requestBody.project_name = containerInfo.projectName;
    }
    
    try {
        const response = await fetch(`${apiBase}${API_BASE}/chat-with-history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                ...getAuthHeaders()
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`请求失败: ${response.status} - ${text}`);
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('无法获取响应流');
        }
        
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    try {
                        const data = JSON.parse(line.slice(5).trim());
                        yield data as StreamEvent & { conversationId?: string };
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        }
    } catch (error: any) {
        console.error('[AgentAPI] chatWithHistory error:', error);
        yield { type: 'error', error: error.message || 'Unknown error' };
    }
}

export const agentApi = {
    getProviders,
    getConfig,
    saveConfig,
    testConnection,
    chat,
    chatWithHistory,
    getTools,
    submitToolResult,
    submitToolResults,
    getSession,
    deleteSession,
    scanWorkspace,
    // 对话历史
    listConversations,
    createConversation,
    getConversation,
    updateConversationTitle,
    deleteConversation,
    searchConversations,
    addMessageToConversation
};
