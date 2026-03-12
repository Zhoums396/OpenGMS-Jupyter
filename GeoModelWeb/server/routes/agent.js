/**
 * AI Agent Routes
 * 提供 LLM 配置管理、对话 API、流式响应、工具调用系统
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ==================== LLM 配置管理 ====================

// 用户 LLM 配置存储路径
const USER_DATA_DIR = process.env.USER_DATA_DIR || path.join(__dirname, '..', 'jupyter-data');
const LLM_CONFIG_FILE = path.join(USER_DATA_DIR, 'llm-configs.json');

// 预设的 LLM Provider 模板
const LLM_PROVIDERS = {
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o-mini', 'gpt-4o'],
        defaultModel: 'gpt-4o-mini'
    },
    anthropic: {
        name: 'Anthropic (Claude)',
        baseUrl: 'https://api.anthropic.com/v1',
        models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'],
        defaultModel: 'claude-sonnet-4-20250514',
        isAnthropic: true
    },
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        models: ['deepseek-chat'],
        defaultModel: 'deepseek-chat'
    },
    aihubmix: {
        name: 'AiHubMix',
        baseUrl: 'https://api.aihubmix.com/v1',
        models: ['gpt-4o-mini', 'claude-3-5-sonnet', 'deepseek-chat', 'alicloud-qwen3.5-plus'],
        defaultModel: 'gpt-4o-mini'
    },
    ollama: {
        name: 'Ollama (本地)',
        baseUrl: 'http://localhost:11434/v1',
        models: ['qwen2.5:7b', 'llama3'],
        defaultModel: 'qwen2.5:7b',
        noApiKey: true
    },
    custom: {
        name: '自定义 (OpenAI 兼容)',
        baseUrl: '',
        models: [],
        defaultModel: ''
    }
};

// 读取用户 LLM 配置
function loadLLMConfigs() {
    try {
        if (fs.existsSync(LLM_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(LLM_CONFIG_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading LLM configs:', e);
    }
    return {};
}

// 保存用户 LLM 配置
function saveLLMConfigs(configs) {
    try {
        fs.writeFileSync(LLM_CONFIG_FILE, JSON.stringify(configs, null, 2));
    } catch (e) {
        console.error('Error saving LLM configs:', e);
    }
}

/**
 * GET /api/agent/providers
 * 获取可用的 LLM Provider 列表
 */
router.get('/providers', (req, res) => {
    res.json({ providers: LLM_PROVIDERS });
});

/**
 * GET /api/agent/config
 * 获取当前用户的 LLM 配置
 */
router.get('/config', (req, res) => {
    const userId = req.user.userId;
    const configs = loadLLMConfigs();
    const userConfig = configs[userId] || {
        provider: 'openai',
        apiKey: '',
        baseUrl: '',
        model: 'gpt-4o-mini',
        customModels: []
    };
    
    // 不返回完整 API Key，只返回是否已配置
    res.json({
        config: {
            ...userConfig,
            apiKey: userConfig.apiKey ? '***已配置***' : '',
            hasApiKey: !!userConfig.apiKey
        }
    });
});

/**
 * POST /api/agent/config
 * 保存用户的 LLM 配置
 */
router.post('/config', (req, res) => {
    const userId = req.user.userId;
    const { provider, apiKey, baseUrl, model, customModels } = req.body;
    
    const configs = loadLLMConfigs();
    const existingConfig = configs[userId] || {};
    
    configs[userId] = {
        provider: provider || existingConfig.provider || 'openai',
        // 如果传入新的 apiKey 就更新，否则保留原有的
        apiKey: apiKey && apiKey !== '***已配置***' ? apiKey : existingConfig.apiKey || '',
        baseUrl: baseUrl || existingConfig.baseUrl || '',
        model: model || existingConfig.model || 'gpt-4o-mini',
        customModels: customModels || existingConfig.customModels || [],
        updatedAt: new Date().toISOString()
    };
    
    saveLLMConfigs(configs);
    
    res.json({ 
        status: 'saved',
        message: 'LLM 配置已保存'
    });
});

/**
 * POST /api/agent/test
 * 测试 LLM 连接
 */
router.post('/test', async (req, res) => {
    const userId = req.user.userId;
    const configs = loadLLMConfigs();
    const userConfig = configs[userId];
    
    if (!userConfig || !userConfig.apiKey) {
        return res.status(400).json({ error: '请先配置 API Key' });
    }
    
    try {
        const provider = LLM_PROVIDERS[userConfig.provider] || {};
        const baseUrl = userConfig.baseUrl || provider.baseUrl;
        const model = userConfig.model || provider.defaultModel;
        
        // 发送测试请求
        const testMessage = { role: 'user', content: 'Hello, this is a test. Reply with "OK".' };
        
        if (provider.isAnthropic) {
            // Anthropic API 格式
            const response = await axios.post(`${baseUrl}/messages`, {
                model: model,
                max_tokens: 10,
                messages: [testMessage]
            }, {
                headers: {
                    'x-api-key': userConfig.apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            res.json({ 
                status: 'success',
                message: '连接成功',
                model: model,
                response: response.data.content?.[0]?.text || 'OK'
            });
        } else {
            // OpenAI 兼容 API 格式
            const response = await axios.post(`${baseUrl}/chat/completions`, {
                model: model,
                messages: [testMessage],
                max_tokens: 10
            }, {
                headers: {
                    'Authorization': `Bearer ${userConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            res.json({ 
                status: 'success',
                message: '连接成功',
                model: response.data.model || model,
                response: response.data.choices?.[0]?.message?.content || 'OK'
            });
        }
    } catch (error) {
        console.error('LLM test failed:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'LLM 连接测试失败',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// ==================== 工作目录数据扫描 ====================

/**
 * POST /api/agent/scan-workspace
 * 扫描用户工作目录中的数据文件
 * 从请求体或 JWT token 中获取用户信息
 */
router.post('/scan-workspace', async (req, res) => {
    // 优先从请求体获取，否则从 req.user (JWT 解析) 获取
    let userId = req.body.userId || req.user?.userId || req.user?.id;
    let userName = req.body.userName || req.user?.userName || req.user?.login;
    let projectName = req.body.projectName || '';
    
    // 如果还是没有，尝试从 header 获取
    if (!userName) {
        userName = req.headers['x-user-name'];
        userId = req.headers['x-user-id'];
    }
    
    console.log('[Agent] Scan workspace request:', { userId, userName, projectName });
    
    if (!userName) {
        // 如果完全没有用户信息，返回空结果而不是错误
        console.log('[Agent] No user info, returning empty workspace');
        return res.json({ 
            totalFiles: 0, 
            files: [], 
            grouped: { vector: [], raster: [], table: [], other: [] },
            summary: { vector: 0, raster: 0, table: 0, other: 0 },
            message: '无法获取用户信息' 
        });
    }
    
    try {
        const fs = require('fs');
        const path = require('path');
        
        // 构建用户工作目录路径
        const userWorkDir = path.join(
            process.cwd(), 
            'jupyter-data', 
            userName, 
            projectName || ''
        );
        
        console.log('[Agent] Scanning workspace:', userWorkDir);
        
        if (!fs.existsSync(userWorkDir)) {
            return res.json({ files: [], message: '工作目录不存在' });
        }
        
        // 地理数据文件扩展名
        const geoDataExtensions = [
            // 矢量数据
            '.shp', '.geojson', '.json', '.gpkg', '.kml', '.kmz', '.gml',
            // 栅格数据
            '.tif', '.tiff', '.img', '.dem', '.asc', '.nc', '.hdf', '.grd',
            // 表格数据
            '.csv', '.xlsx', '.xls', '.dbf',
            // 文本数据
            '.txt', '.xml',
            // 压缩包
            '.zip', '.tar', '.gz'
        ];
        
        // 递归扫描目录
        const scanDirectory = (dir, baseDir = dir) => {
            const results = [];
            
            try {
                const items = fs.readdirSync(dir);
                
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const relativePath = path.relative(baseDir, fullPath);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        // 递归扫描子目录（限制深度为3层）
                        if (relativePath.split(path.sep).length < 3) {
                            results.push(...scanDirectory(fullPath, baseDir));
                        }
                    } else {
                        const ext = path.extname(item).toLowerCase();
                        if (geoDataExtensions.includes(ext)) {
                            results.push({
                                name: item,
                                path: relativePath,
                                fullPath: fullPath,
                                extension: ext,
                                size: stat.size,
                                sizeFormatted: formatFileSize(stat.size),
                                modified: stat.mtime,
                                type: getDataType(ext)
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('[Agent] Error scanning directory:', dir, err.message);
            }
            
            return results;
        };
        
        // 格式化文件大小
        const formatFileSize = (bytes) => {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
        };
        
        // 判断数据类型
        const getDataType = (ext) => {
            const vectorExts = ['.shp', '.geojson', '.json', '.gpkg', '.kml', '.kmz', '.gml'];
            const rasterExts = ['.tif', '.tiff', '.img', '.dem', '.asc', '.nc', '.hdf', '.grd'];
            const tableExts = ['.csv', '.xlsx', '.xls', '.dbf'];
            
            if (vectorExts.includes(ext)) return 'vector';
            if (rasterExts.includes(ext)) return 'raster';
            if (tableExts.includes(ext)) return 'table';
            return 'other';
        };
        
        const files = scanDirectory(userWorkDir);
        
        // 按类型分组
        const grouped = {
            vector: files.filter(f => f.type === 'vector'),
            raster: files.filter(f => f.type === 'raster'),
            table: files.filter(f => f.type === 'table'),
            other: files.filter(f => f.type === 'other')
        };
        
        res.json({
            workDir: userWorkDir,
            totalFiles: files.length,
            files: files,
            grouped: grouped,
            summary: {
                vector: grouped.vector.length,
                raster: grouped.raster.length,
                table: grouped.table.length,
                other: grouped.other.length
            }
        });
        
    } catch (error) {
        console.error('[Agent] Workspace scan error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== Agent 工具定义 ====================

// 简化版工具 - 只保留 Notebook 操作工具
const AGENT_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'add_code_cell',
            description: '向当前 Notebook 添加一个新的代码单元格并自动运行。当需要执行代码时使用此工具。',
            parameters: {
                type: 'object',
                properties: {
                    code: { type: 'string', description: '要添加并运行的 Python 代码' }
                },
                required: ['code']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'add_markdown_cell',
            description: '向当前 Notebook 添加一个 Markdown 说明单元格',
            parameters: {
                type: 'object',
                properties: {
                    content: { type: 'string', description: 'Markdown 内容' }
                },
                required: ['content']
            }
        }
    }
];

/**
 * GET /api/agent/tools
 * 获取可用的 Agent 工具列表
 */
router.get('/tools', (req, res) => {
    res.json({ tools: AGENT_TOOLS });
});

// ==================== 对话会话管理 ====================

// 内存中的会话存储（生产环境应使用 Redis 或数据库）
const sessions = new Map();

/**
 * POST /api/agent/chat
 * 发送消息并获取 Agent 响应（流式）
 */
router.post('/chat', async (req, res) => {
    const userId = req.user.userId;
    const { message, sessionId, context } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: '消息不能为空' });
    }
    
    // 获取用户 LLM 配置
    const configs = loadLLMConfigs();
    const userConfig = configs[userId];
    
    if (!userConfig || !userConfig.apiKey) {
        return res.status(400).json({ 
            error: '请先配置 LLM',
            needConfig: true
        });
    }
    
    // 获取或创建会话
    const sid = sessionId || `${userId}-${Date.now()}`;
    if (!sessions.has(sid)) {
        sessions.set(sid, {
            messages: [],
            createdAt: new Date()
        });
    }
    const session = sessions.get(sid);
    
    // 构建系统提示
    const systemPrompt = buildSystemPrompt(context);
    
    // 添加用户消息
    session.messages.push({ role: 'user', content: message });
    
    try {
        const provider = LLM_PROVIDERS[userConfig.provider] || {};
        const baseUrl = userConfig.baseUrl || provider.baseUrl;
        const model = userConfig.model || provider.defaultModel;
        
        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Session-Id', sid);
        
        // 准备消息
        const messages = [
            { role: 'system', content: systemPrompt },
            ...session.messages.slice(-20) // 只保留最近20条消息
        ];
        
        let fullResponse = '';
        let toolCalls = [];
        
        if (provider.isAnthropic) {
            // Anthropic API
            const response = await axios.post(`${baseUrl}/messages`, {
                model: model,
                max_tokens: 4096,
                system: systemPrompt,
                messages: session.messages.slice(-20),
                tools: AGENT_TOOLS.map(t => ({
                    name: t.function.name,
                    description: t.function.description,
                    input_schema: t.function.parameters
                })),
                stream: true
            }, {
                headers: {
                    'x-api-key': userConfig.apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                responseType: 'stream'
            });
            
            // 处理流式响应
            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim());
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'content_block_delta' && data.delta?.text) {
                                fullResponse += data.delta.text;
                                res.write(`data: ${JSON.stringify({ type: 'text', content: data.delta.text })}\n\n`);
                            } else if (data.type === 'tool_use') {
                                toolCalls.push(data);
                                res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: data })}\n\n`);
                            }
                        } catch (e) {}
                    }
                }
            });
            
            response.data.on('end', () => {
                session.messages.push({ role: 'assistant', content: fullResponse });
                res.write(`data: ${JSON.stringify({ type: 'done', sessionId: sid })}\n\n`);
                res.end();
            });
            
            response.data.on('error', (error) => {
                console.error('Stream error:', error);
                res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
                res.end();
            });
            
        } else {
            // OpenAI 兼容 API
            console.log('[Agent] Sending request to:', `${baseUrl}/chat/completions`);
            console.log('[Agent] Model:', model);
            console.log('[Agent] Messages count:', messages.length);
            console.log('[Agent] Tools count:', AGENT_TOOLS.length);
            
            const response = await axios.post(`${baseUrl}/chat/completions`, {
                model: model,
                messages: messages,
                tools: AGENT_TOOLS,
                tool_choice: 'auto',
                stream: true
            }, {
                headers: {
                    'Authorization': `Bearer ${userConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'stream'
            });
            
            let currentToolCall = null;
            
            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim());
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') continue;
                        
                        try {
                            const data = JSON.parse(dataStr);
                            const delta = data.choices?.[0]?.delta;
                            
                            if (delta?.content) {
                                fullResponse += delta.content;
                                res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
                            }
                            
                            if (delta?.tool_calls) {
                                console.log('[Agent] Received tool_calls in stream:', JSON.stringify(delta.tool_calls));
                                for (const tc of delta.tool_calls) {
                                    if (tc.id) {
                                        if (currentToolCall) {
                                            toolCalls.push(currentToolCall);
                                            console.log('[Agent] Pushing completed tool call:', currentToolCall);
                                            res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: currentToolCall })}\n\n`);
                                        }
                                        currentToolCall = {
                                            id: tc.id,
                                            name: tc.function?.name || '',
                                            arguments: tc.function?.arguments || ''
                                        };
                                        console.log('[Agent] New tool call started:', currentToolCall.id);
                                    } else if (currentToolCall) {
                                        if (tc.function?.name) currentToolCall.name += tc.function.name;
                                        if (tc.function?.arguments) currentToolCall.arguments += tc.function.arguments;
                                    }
                                }
                            }
                        } catch (e) {
                            console.log('[Agent] Parse error:', e.message, 'for data:', dataStr.substring(0, 100));
                        }
                    }
                }
            });
            
            response.data.on('end', () => {
                console.log('[Agent] Stream ended. currentToolCall:', currentToolCall);
                console.log('[Agent] toolCalls collected:', toolCalls.length);
                
                if (currentToolCall) {
                    toolCalls.push(currentToolCall);
                    res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: currentToolCall })}\n\n`);
                }
                
                // 保存 assistant 消息，tool_calls 需要正确的 OpenAI 格式
                const assistantMessage = {
                    role: 'assistant',
                    content: fullResponse || null
                };
                
                if (toolCalls.length > 0) {
                    assistantMessage.tool_calls = toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: tc.arguments
                        }
                    }));
                }
                
                session.messages.push(assistantMessage);
                
                res.write(`data: ${JSON.stringify({ type: 'done', sessionId: sid, toolCalls })}\n\n`);
                res.end();
            });
            
            response.data.on('error', (error) => {
                console.error('Stream error:', error);
                res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
                res.end();
            });
        }
        
    } catch (error) {
        console.error('Chat error:', error.response?.data || error.message);
        
        // 如果还没开始流式响应，返回 JSON 错误
        if (!res.headersSent) {
            return res.status(500).json({ 
                error: 'LLM 请求失败',
                details: error.response?.data?.error?.message || error.message
            });
        }
        
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
});

/**
 * POST /api/agent/tool-result
 * 提交工具执行结果，继续对话（流式响应）
 */
router.post('/tool-results', async (req, res) => {
    const userId = req.user.userId;
    const { sessionId, toolResults } = req.body;
    
    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: '会话不存在' });
    }
    
    // 获取用户 LLM 配置
    const configs = loadLLMConfigs();
    const userConfig = configs[userId];
    
    if (!userConfig || !userConfig.apiKey) {
        return res.status(400).json({ error: '请先配置 LLM' });
    }
    
    // 添加工具结果到消息历史
    for (const toolResult of toolResults) {
        session.messages.push({
            role: 'tool',
            tool_call_id: toolResult.toolCallId,
            content: typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result)
        });
    }
    
    try {
        const provider = LLM_PROVIDERS[userConfig.provider] || {};
        const baseUrl = userConfig.baseUrl || provider.baseUrl;
        const model = userConfig.model || provider.defaultModel;
        
        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // 构建系统提示
        const systemPrompt = buildSystemPrompt({});
        
        // 准备消息
        const messages = [
            { role: 'system', content: systemPrompt },
            ...session.messages.slice(-30) // 保留更多消息以包含工具调用上下文
        ];
        
        let fullResponse = '';
        let toolCalls = [];
        
        console.log('[Agent] Continuing with tool results, messages:', session.messages.length);
        
        // OpenAI 兼容 API
        const response = await axios.post(`${baseUrl}/chat/completions`, {
            model: model,
            messages: messages,
            tools: AGENT_TOOLS,
            tool_choice: 'auto',
            stream: true
        }, {
            headers: {
                'Authorization': `Bearer ${userConfig.apiKey}`,
                'Content-Type': 'application/json'
            },
            responseType: 'stream'
        });
        
        let currentToolCall = null;
        
        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (dataStr === '[DONE]') continue;
                    
                    try {
                        const data = JSON.parse(dataStr);
                        const delta = data.choices?.[0]?.delta;
                        
                        if (delta?.content) {
                            fullResponse += delta.content;
                            res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
                        }
                        
                        if (delta?.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                if (tc.id) {
                                    if (currentToolCall) {
                                        toolCalls.push(currentToolCall);
                                        res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: currentToolCall })}\n\n`);
                                    }
                                    currentToolCall = {
                                        id: tc.id,
                                        name: tc.function?.name || '',
                                        arguments: tc.function?.arguments || ''
                                    };
                                } else if (currentToolCall) {
                                    if (tc.function?.name) currentToolCall.name += tc.function.name;
                                    if (tc.function?.arguments) currentToolCall.arguments += tc.function.arguments;
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        });
        
        response.data.on('end', () => {
            if (currentToolCall) {
                toolCalls.push(currentToolCall);
                res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: currentToolCall })}\n\n`);
            }
            
            // 保存 assistant 消息，tool_calls 需要正确的 OpenAI 格式
            if (fullResponse || toolCalls.length > 0) {
                const assistantMessage = {
                    role: 'assistant',
                    content: fullResponse || null
                };
                
                if (toolCalls.length > 0) {
                    assistantMessage.tool_calls = toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: tc.arguments
                        }
                    }));
                }
                
                session.messages.push(assistantMessage);
            }
            
            res.write(`data: ${JSON.stringify({ type: 'done', sessionId: sessionId, toolCalls })}\n\n`);
            res.end();
        });
        
        response.data.on('error', (error) => {
            console.error('Stream error:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        console.error('Tool result error:', error.response?.data || error.message);
        
        if (!res.headersSent) {
            return res.status(500).json({ 
                error: 'LLM 请求失败',
                details: error.response?.data?.error?.message || error.message
            });
        }
        
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
});


/**
 * DELETE /api/agent/session/:sessionId
 * 删除会话
 */
router.delete('/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    sessions.delete(sessionId);
    res.json({ status: 'deleted' });
});

/**
 * GET /api/agent/session/:sessionId
 * 获取会话历史
 */
router.get('/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: '会话不存在' });
    }
    
    res.json({ 
        sessionId,
        messages: session.messages,
        createdAt: session.createdAt
    });
});

// ==================== 辅助函数 ====================

/**
 * 构建系统提示
 */
function buildSystemPrompt(context) {
    const basePrompt = `你是 OpenGeoLab AI 助手，一个专业的地理信息科学与地理建模助手。你运行在 JupyterLab 环境中。

## 你的核心能力

### 1. Notebook 操作工具
你可以使用以下工具直接操作用户的 Jupyter Notebook：
- **add_code_cell**: 向 Notebook 添加代码单元格并自动运行
- **add_markdown_cell**: 向 Notebook 添加 Markdown 说明
- **run_code**: 执行 Python 代码

### 2. 调用地理计算模型 (OGMS Models)
当用户想调用某个地理计算模型时，使用 add_code_cell 工具插入以下代码模板：

\`\`\`python
# OpenGMS Model Invocation
from ogmsServer2.openModel import OGMSAccess

# 创建模型访问实例 (使用实际的模型名称)
model = OGMSAccess("模型名称", token="883ada2fc996ab9487bed7a3ba21d2f1")

# 设置输入参数
# 参数格式: { "StateName": { "EventName": "文件路径或值" } }
params = {
    "InputData": {
        "DataEvent": "./data.tif"  # 使用工作目录中的实际文件
    }
}

# 运行模型
try:
    outputs = model.createTask(params)
    print("模型运行完成!")
    print("输出结果:", outputs)

    # 下载输出文件
    model.downloadAllData()
except Exception as e:
    print(f"模型运行失败: {e}")
\`\`\`

**重要**: Token 已预配置为 \`883ada2fc996ab9487bed7a3ba21d2f1\`，在代码中直接使用此 token。

常见的地理计算模型包括（使用中文名称）：
- 基于随机森林的滑坡遥感灾害提取模型: 遥感滑坡灾害识别
- 基于随机森林的滑坡遥感灾害提取模型（模型培训班）: 培训用滑坡模型
- SWAT_Model: 土壤水评估工具，用于流域水文模拟
- SWMM: EPA 雨水管理模型，用于城市排水模拟  
- MODFLOW: 地下水流动模拟模型
- HEC-HMS: 水文工程中心水文模型
- SEIMS: 分布式流域建模系统

**注意**: 模型名称通常是中文，如"基于随机森林的滑坡遥感灾害提取模型"，需要完全匹配。

### 3. 调用数据处理方法 (DataMethods)
当用户想调用数据处理方法时，使用 add_code_cell 工具插入以下代码：

\`\`\`python
import requests

# 调用数据方法
response = requests.post(
    "http://172.21.252.222:8080/container/method/run",
    json={
        "name": "方法名称",
        "params": {
            "参数名": "参数值"
        }
    }
)
result = response.json()
print("处理结果:", result)
\`\`\`

### 4. 搜索模型和数据方法
当用户想搜索可用的模型或方法时，插入以下代码：

搜索模型：
\`\`\`python
import requests
# 注意: 在 Docker 容器内运行，使用 host.docker.internal 访问宿主机服务
API_HOST = "http://host.docker.internal:3000"
response = requests.get(f"{API_HOST}/api/ogms/models", params={"q": "关键词", "limit": 10})
models = response.json()
for m in models.get("data", []):
    print(f"- {m['name']}: {m.get('description', 'No description')[:100]}...")
\`\`\`

搜索数据方法：
\`\`\`python
import requests
API_HOST = "http://host.docker.internal:3000"
response = requests.get(f"{API_HOST}/api/datamethods", params={"q": "关键词", "limit": 10})
methods = response.json()
for m in methods.get("data", []):
    print(f"- {m['name']}: {m.get('description', 'No description')[:100]}...")
\`\`\`

## 工作流程

1. 当用户说 "帮我调用 XXX 模型" → 先检查工作目录数据，使用 add_code_cell 插入代码
2. 当用户说 "搜索 XXX 相关的模型" → 使用 add_code_cell 插入搜索代码并运行
3. 当用户说 "调用 XXX 数据方法" → 使用 add_code_cell 插入 DataMethod 调用代码
4. 当用户需要解释或帮助 → 使用 add_markdown_cell 添加说明

## 重要规则

1. **始终使用 add_code_cell 工具** 来插入代码，不要只是在回复中显示代码
2. 代码会自动运行，用户可以看到结果
3. 使用中文回复
4. 简洁专业，避免冗长解释
5. **优先使用工作目录中的现有数据文件**，自动匹配到模型参数中
6. 如果工作目录中没有合适的数据，告诉用户需要哪些数据，并建议从数据中心获取`;

    // 如果有上下文信息，添加到提示中
    if (context) {
        let contextStr = '\n\n## 当前上下文';
        
        if (context.notebookName) {
            contextStr += `\n- 当前 Notebook: ${context.notebookName}`;
        }
        if (context.currentCellCode) {
            contextStr += `\n- 当前单元格代码:\n\`\`\`python\n${context.currentCellCode}\n\`\`\``;
        }
        if (context.selectedText) {
            contextStr += `\n- 用户选中的文本: "${context.selectedText}"`;
        }
        if (context.workingDirectory) {
            contextStr += `\n- 工作目录: ${context.workingDirectory}`;
        }
        
        // 新增：工作目录数据文件上下文
        if (context.workspaceFiles) {
            contextStr += `\n\n### 工作目录数据文件`;
            contextStr += `\n用户工作目录中包含以下地理数据文件，你可以在生成代码时直接使用这些文件路径：`;
            
            const files = context.workspaceFiles;
            
            if (files.vector && files.vector.length > 0) {
                contextStr += `\n\n**矢量数据 (${files.vector.length} 个):**`;
                for (const f of files.vector.slice(0, 10)) {
                    contextStr += `\n- \`${f.path}\` (${f.sizeFormatted}) - ${f.extension}`;
                }
            }
            
            if (files.raster && files.raster.length > 0) {
                contextStr += `\n\n**栅格数据 (${files.raster.length} 个):**`;
                for (const f of files.raster.slice(0, 10)) {
                    contextStr += `\n- \`${f.path}\` (${f.sizeFormatted}) - ${f.extension}`;
                }
            }
            
            if (files.table && files.table.length > 0) {
                contextStr += `\n\n**表格数据 (${files.table.length} 个):**`;
                for (const f of files.table.slice(0, 10)) {
                    contextStr += `\n- \`${f.path}\` (${f.sizeFormatted}) - ${f.extension}`;
                }
            }
            
            if (files.other && files.other.length > 0) {
                contextStr += `\n\n**其他文件 (${files.other.length} 个):**`;
                for (const f of files.other.slice(0, 5)) {
                    contextStr += `\n- \`${f.path}\` (${f.sizeFormatted})`;
                }
            }
            
            if (files.totalFiles === 0) {
                contextStr += `\n\n⚠️ 工作目录中没有发现地理数据文件。如果用户需要运行模型，请建议他们：`;
                contextStr += `\n1. 从数据中心下载所需数据`;
                contextStr += `\n2. 上传本地数据到工作目录`;
            }
            
            contextStr += `\n\n**注意：** 在生成代码时，使用相对路径引用这些文件（相对于 Notebook 所在目录）。`;
        }
        
        return basePrompt + contextStr;
    }
    
    return basePrompt;
}

module.exports = router;
