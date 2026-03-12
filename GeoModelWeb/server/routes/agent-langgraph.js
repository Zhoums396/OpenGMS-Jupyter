/**
 * AI Agent Routes - LangGraph 代理版本
 * 将请求代理到 Python LangGraph 后端
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Python Agent 服务地址
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8000';

// 创建不使用代理的 axios 实例（本地服务不需要代理）
const agentAxios = axios.create({
    proxy: false  // 禁用代理
});

// 用户 LLM 配置存储路径
const USER_DATA_DIR = process.env.USER_DATA_DIR || path.join(__dirname, '..', 'jupyter-data');
const LLM_CONFIG_FILE = path.join(USER_DATA_DIR, 'llm-configs.json');

// ==================== LLM 配置管理 (保留原有功能) ====================

const LLM_PROVIDERS = {
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o-mini', 'gpt-4o'],
        defaultModel: 'gpt-4o-mini'
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
    }
};

function ensureUserDataDir() {
    if (!fs.existsSync(USER_DATA_DIR)) {
        fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }
}

function normalizeBaseUrl(baseUrl, providerKey) {
    const provider = LLM_PROVIDERS[providerKey] || {};
    const fallback = provider.baseUrl || '';
    const input = (baseUrl || '').trim();
    let normalized = input || fallback;
    normalized = normalized.replace(/\/+$/, '');

    // Common typo fix for AiHubMix.
    if (providerKey === 'aihubmix' && /^https?:\/\/aihubmix\.com\/v1$/i.test(normalized)) {
        normalized = 'https://api.aihubmix.com/v1';
    }

    return normalized;
}

function normalizeLLMConfig(raw = {}) {
    const provider = LLM_PROVIDERS[raw.provider] ? raw.provider : 'openai';
    const providerInfo = LLM_PROVIDERS[provider];
    const model = raw.model || providerInfo.defaultModel;
    const baseUrl = normalizeBaseUrl(raw.baseUrl, provider);
    const apiKey = raw.apiKey || '';
    return {
        provider,
        apiKey,
        baseUrl,
        model
    };
}

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

function saveLLMConfigs(configs) {
    try {
        ensureUserDataDir();
        fs.writeFileSync(LLM_CONFIG_FILE, JSON.stringify(configs, null, 2));
    } catch (e) {
        console.error('Error saving LLM configs:', e);
    }
}

function getUserConfig(userId) {
    const configs = loadLLMConfigs();
    const fallback = {
        provider: 'openai',
        apiKey: '',
        baseUrl: LLM_PROVIDERS.openai.baseUrl,
        model: LLM_PROVIDERS.openai.defaultModel
    };
    return normalizeLLMConfig(configs[userId] || fallback);
}

router.get('/providers', (req, res) => {
    res.json({ providers: LLM_PROVIDERS });
});

/**
 * GET /api/agent/cases
 * Proxy curated smart cases from Python agent service
 */
router.get('/cases', async (req, res) => {
    try {
        const response = await agentAxios.get(`${AGENT_SERVICE_URL}/api/agent/cases`, { timeout: 10000 });
        res.json(response.data);
    } catch (error) {
        console.error('[Agent] List cases error:', error.message);
        res.status(500).json({ error: error.message, cases: [] });
    }
});

router.get('/config', (req, res) => {
    const userId = req.user?.userId || 'default';
    const userConfig = getUserConfig(userId);
    res.json({ config: userConfig });
});

router.post('/config', (req, res) => {
    const userId = req.user?.userId || 'default';
    const { provider, apiKey, baseUrl, model } = req.body;
    
    const configs = loadLLMConfigs();
    const existing = getUserConfig(userId);
    configs[userId] = normalizeLLMConfig({
        ...existing,
        provider,
        baseUrl,
        model,
        apiKey: apiKey === undefined ? existing.apiKey : apiKey
    });
    saveLLMConfigs(configs);
    
    res.json({ success: true, config: configs[userId] });
});

/**
 * POST /api/agent/test
 * 测试 LLM 连接
 */
router.post('/test', async (req, res) => {
    try {
        const userId = req.user?.userId || 'default';
        const userConfig = getUserConfig(userId);
        const provider = LLM_PROVIDERS[userConfig.provider] || {};
        const baseUrl = userConfig.baseUrl || provider.baseUrl;
        const model = userConfig.model || provider.defaultModel;

        if (!baseUrl || !model) {
            return res.status(400).json({
                success: false,
                error: 'LLM base URL or model is missing'
            });
        }

        if (!provider.noApiKey && !userConfig.apiKey) {
            return res.status(400).json({
                success: false,
                error: 'API key is required for the selected provider'
            });
        }

        const headers = {
            'Content-Type': 'application/json'
        };
        if (!provider.noApiKey) {
            headers.Authorization = `Bearer ${userConfig.apiKey}`;
        }

        const response = await agentAxios.post(
            `${baseUrl}/chat/completions`,
            {
                model,
                messages: [{ role: 'user', content: 'Reply with OK.' }],
                max_tokens: 8,
                temperature: 0
            },
            {
                headers,
                timeout: 10000
            }
        );

        res.json({
            success: true,
            message: 'Connection successful',
            model: response.data?.model || model
        });
    } catch (error) {
        const detail = error.response?.data || error.message;
        console.error('[Agent Test] Error:', detail);
        res.status(500).json({ 
            success: false, 
            error: typeof detail === 'string' ? detail : JSON.stringify(detail)
        });
    }
});

// ==================== Ask mode: simple Q&A (no tools) ====================

/**
 * POST /api/agent/ask
 * Simple streaming chat — directly calls LLM without agent-service tool loop
 */
router.post('/ask', async (req, res) => {
    const { message, history } = req.body;
    const userId = req.user?.userId || 'default';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
        const userConfig = getUserConfig(userId);
        const provider = LLM_PROVIDERS[userConfig.provider] || {};
        const baseUrl = userConfig.baseUrl || provider.baseUrl;
        const model = userConfig.model || provider.defaultModel;

        if (!baseUrl || !model) {
            res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: 'LLM not configured. Please set provider and model in settings.' })}\n\n`);
            return res.end();
        }
        if (!provider.noApiKey && !userConfig.apiKey) {
            res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: 'API key is required. Please configure in settings.' })}\n\n`);
            return res.end();
        }

        const headers = { 'Content-Type': 'application/json' };
        if (!provider.noApiKey) {
            headers.Authorization = `Bearer ${userConfig.apiKey}`;
        }

        // Build messages array: optional history + current message
        const messages = [];
        messages.push({ role: 'system', content: 'You are a helpful geospatial analysis assistant. Answer questions clearly and concisely. Use Chinese if the user speaks Chinese.' });
        if (history && Array.isArray(history)) {
            for (const h of history.slice(-10)) { // Keep last 10 messages for context
                messages.push({ role: h.role, content: h.content });
            }
        }
        messages.push({ role: 'user', content: message });

        const response = await agentAxios({
            method: 'POST',
            url: `${baseUrl}/chat/completions`,
            data: {
                model,
                messages,
                stream: true,
                temperature: 0.7,
                max_tokens: 4096
            },
            headers,
            responseType: 'stream',
            timeout: 120000
        });

        let buffer = '';

        response.data.on('data', chunk => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;
                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') {
                    res.write(`event: message\ndata: ${JSON.stringify({ type: 'done' })}\n\n`);
                    continue;
                }
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta;
                    if (delta?.content) {
                        res.write(`event: message\ndata: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
                    }
                } catch (e) {
                    // Skip malformed chunks
                }
            }
        });

        response.data.on('end', () => {
            res.write(`event: message\ndata: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
        });

        response.data.on('error', err => {
            console.error('[Ask] Stream error:', err);
            res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
            res.end();
        });

    } catch (error) {
        const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        console.error('[Ask] Error:', detail);
        res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: detail })}\n\n`);
        res.end();
    }
});

// ==================== 代理到 Python LangGraph 后端 ====================

/**
 * POST /api/agent/chat
 * 代理聊天请求到 Python 后端
 */
router.post('/chat', async (req, res) => {
    const { message, sessionId, context } = req.body;
    const userId = req.user?.userId;
    const userName =
        req.body?.userName ||
        context?.userName ||
        req.user?.userName ||
        req.user?.login ||
        req.query?.user ||
        req.headers['x-user-name'];
    const projectName =
        req.body?.projectName ||
        context?.projectName ||
        req.query?.project ||
        '';
    
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    try {
        const effectiveUserId = userId || 'default';
        const userConfig = getUserConfig(effectiveUserId);

        // 代理请求到 Python 后端
        const response = await agentAxios({
            method: 'POST',
            url: `${AGENT_SERVICE_URL}/api/agent/chat`,
            data: {
                message,
                session_id: sessionId,
                user_id: effectiveUserId,
                user_name: userName,
                project_name: projectName,
                context: context,
                llm_config: {
                    provider: userConfig.provider,
                    model: userConfig.model,
                    base_url: userConfig.baseUrl,
                    api_key: userConfig.apiKey
                }
            },
            responseType: 'stream',
            headers: {
                'Accept': 'text/event-stream',
                'Content-Type': 'application/json'
            }
        });
        
        // 转发流式响应
        response.data.on('data', chunk => {
            res.write(chunk);
        });
        
        response.data.on('end', () => {
            res.end();
        });
        
        response.data.on('error', err => {
            console.error('[Agent Proxy] Stream error:', err);
            res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        console.error('[Agent Proxy] Error:', error.message);
        res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
});

/**
 * POST /api/agent/tool-results
 * 代理工具结果到 Python 后端
 */
router.post('/tool-results', async (req, res) => {
    const { sessionId, toolResults } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    try {
        const response = await agentAxios({
            method: 'POST',
            url: `${AGENT_SERVICE_URL}/api/agent/tool-results`,
            data: {
                session_id: sessionId,
                tool_results: toolResults.map(r => ({
                    tool_call_id: r.toolCallId,
                    result: r.result,
                    ...(r.images && { images: r.images })
                }))
            },
            responseType: 'stream',
            headers: {
                'Accept': 'text/event-stream',
                'Content-Type': 'application/json'
            }
        });
        
        response.data.on('data', chunk => {
            res.write(chunk);
        });
        
        response.data.on('end', () => {
            res.end();
        });
        
        response.data.on('error', err => {
            console.error('[Agent Proxy] Tool results stream error:', err);
            res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        console.error('[Agent Proxy] Tool results error:', error.message);
        res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
});

/**
 * GET /api/agent/session/:sessionId
 * 获取会话状态
 */
router.get('/session/:sessionId', async (req, res) => {
    try {
        const response = await agentAxios.get(
            `${AGENT_SERVICE_URL}/api/agent/session/${req.params.sessionId}`
        );
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            error: error.message
        });
    }
});

/**
 * DELETE /api/agent/session/:sessionId
 * 删除会话
 */
router.delete('/session/:sessionId', async (req, res) => {
    try {
        const response = await agentAxios.delete(
            `${AGENT_SERVICE_URL}/api/agent/session/${req.params.sessionId}`
        );
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            error: error.message
        });
    }
});

// ==================== 工作目录扫描 (保留原有功能) ====================

router.post('/scan-workspace', async (req, res) => {
    let userName = req.body.userName || req.user?.userName || req.headers['x-user-name'];
    let projectName = req.body.projectName || '';
    const containerName = req.body.containerName || '';
    
    console.log('[Agent] scan-workspace request:', { userName, projectName, containerName });
    
    // 从容器名称解析用户和项目信息（格式: jupyter-{user}-{project}）
    if (containerName && !projectName) {
        const match = containerName.match(/^jupyter-([^-]+)-(.+)$/i);
        if (match) {
            // 转换为首字母大写格式以匹配目录名
            userName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            projectName = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
            console.log('[Agent] Parsed from container name:', { userName, projectName });
        }
    }
    
    if (!userName) {
        return res.json({ 
            totalFiles: 0, 
            grouped: { vector: [], raster: [], table: [], other: [] }
        });
    }
    
    try {
        const jupyterDataDir = path.join(process.cwd(), 'jupyter-data');
        
        // 智能查找用户目录（不区分大小写）
        let userDir = null;
        if (fs.existsSync(jupyterDataDir)) {
            const dirs = fs.readdirSync(jupyterDataDir);
            // 尝试精确匹配
            userDir = dirs.find(d => d === userName);
            // 尝试不区分大小写匹配
            if (!userDir) {
                userDir = dirs.find(d => d.toLowerCase() === userName.toLowerCase());
            }
        }
        
        if (!userDir) {
            console.log('[Agent] User directory not found for:', userName);
            return res.json({ totalFiles: 0, grouped: { vector: [], raster: [], table: [], other: [] } });
        }
        
        // 构建完整的用户目录路径
        let userWorkDir = path.join(jupyterDataDir, userDir);
        
        // 如果有项目名，智能查找项目子目录
        if (projectName) {
            const subDirs = fs.readdirSync(userWorkDir).filter(d => 
                fs.statSync(path.join(userWorkDir, d)).isDirectory()
            );
            let projectDir = subDirs.find(d => d === projectName);
            if (!projectDir) {
                projectDir = subDirs.find(d => d.toLowerCase() === projectName.toLowerCase());
            }
            if (projectDir) {
                userWorkDir = path.join(userWorkDir, projectDir);
            }
        } else {
            // 如果没有指定项目名，检查是否只有一个子目录，如果是则使用它
            const subDirs = fs.readdirSync(userWorkDir).filter(d => {
                const fullPath = path.join(userWorkDir, d);
                return fs.statSync(fullPath).isDirectory() && !d.startsWith('.');
            });
            if (subDirs.length === 1) {
                userWorkDir = path.join(userWorkDir, subDirs[0]);
                console.log('[Agent] Auto-selected project directory:', subDirs[0]);
            }
        }
        
        console.log('[Agent] Final workspace directory:', userWorkDir);
        
        if (!fs.existsSync(userWorkDir)) {
            return res.json({ totalFiles: 0, grouped: { vector: [], raster: [], table: [], other: [] } });
        }
        
        const geoDataExtensions = [
            '.shp', '.geojson', '.json', '.gpkg', '.kml',
            '.tif', '.tiff', '.img', '.dem', '.asc', '.nc',
            '.csv', '.xlsx', '.xls', '.dbf',
            '.txt', '.xml', '.zip'
        ];
        
        const scanDirectory = (dir, baseDir = dir, depth = 0) => {
            const results = [];
            if (depth > 3) return results;
            
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const relativePath = path.relative(baseDir, fullPath);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        results.push(...scanDirectory(fullPath, baseDir, depth + 1));
                    } else {
                        const ext = path.extname(item).toLowerCase();
                        if (geoDataExtensions.includes(ext)) {
                            results.push({
                                name: item,
                                path: relativePath,
                                extension: ext,
                                size: stat.size,
                                sizeFormatted: formatFileSize(stat.size),
                                type: getDataType(ext)
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('[Agent] Scan error:', err.message);
            }
            return results;
        };
        
        const formatFileSize = (bytes) => {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        };
        
        const getDataType = (ext) => {
            if (['.shp', '.geojson', '.json', '.gpkg', '.kml'].includes(ext)) return 'vector';
            if (['.tif', '.tiff', '.img', '.dem', '.asc', '.nc'].includes(ext)) return 'raster';
            if (['.csv', '.xlsx', '.xls', '.dbf'].includes(ext)) return 'table';
            return 'other';
        };
        
        const files = scanDirectory(userWorkDir);
        const grouped = { vector: [], raster: [], table: [], other: [] };
        
        for (const file of files) {
            if (grouped[file.type]) {
                grouped[file.type].push(file);
            }
        }
        
        res.json({
            totalFiles: files.length,
            files,
            grouped
        });
        
    } catch (error) {
        console.error('[Agent] Scan workspace error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 对话历史 API 代理 ====================

/**
 * GET /api/agent/conversations - 列出对话
 */
router.get('/conversations', async (req, res) => {
    try {
        const { user_id = 'default', limit = 50, offset = 0 } = req.query;
        const response = await agentAxios.get(
            `${AGENT_SERVICE_URL}/api/conversations`,
            { params: { user_id, limit, offset }, timeout: 10000 }
        );
        res.json(response.data);
    } catch (error) {
        console.error('[Agent] List conversations error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agent/conversations - 创建新对话
 */
router.post('/conversations', async (req, res) => {
    try {
        const response = await agentAxios.post(
            `${AGENT_SERVICE_URL}/api/conversations`,
            req.body,
            { timeout: 10000 }
        );
        res.json(response.data);
    } catch (error) {
        console.error('[Agent] Create conversation error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/agent/conversations/:id - 获取对话详情
 */
router.get('/conversations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id = 'default' } = req.query;
        const response = await agentAxios.get(
            `${AGENT_SERVICE_URL}/api/conversations/${id}`,
            { params: { user_id }, timeout: 10000 }
        );
        res.json(response.data);
    } catch (error) {
        console.error('[Agent] Get conversation error:', error.message);
        if (error.response?.status === 404) {
            res.status(404).json({ error: 'Conversation not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

/**
 * PUT /api/agent/conversations/:id/title - 更新对话标题
 */
router.put('/conversations/:id/title', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id = 'default' } = req.query;
        const response = await agentAxios.put(
            `${AGENT_SERVICE_URL}/api/conversations/${id}/title`,
            req.body,
            { params: { user_id }, timeout: 10000 }
        );
        res.json(response.data);
    } catch (error) {
        console.error('[Agent] Update title error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/agent/conversations/:id - 删除对话
 */
router.delete('/conversations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id = 'default' } = req.query;
        const response = await agentAxios.delete(
            `${AGENT_SERVICE_URL}/api/conversations/${id}`,
            { params: { user_id }, timeout: 10000 }
        );
        res.json(response.data);
    } catch (error) {
        console.error('[Agent] Delete conversation error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agent/conversations/:id/messages - 向对话添加消息
 */
router.post('/conversations/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await agentAxios.post(
            `${AGENT_SERVICE_URL}/api/conversations/${id}/messages`,
            req.body,
            { timeout: 10000 }
        );
        res.json(response.data);
    } catch (error) {
        console.error('[Agent] Add message error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/agent/conversations/search - 搜索对话
 */
router.get('/conversations/search', async (req, res) => {
    try {
        const { q, user_id = 'default', limit = 20 } = req.query;
        const response = await agentAxios.get(
            `${AGENT_SERVICE_URL}/api/conversations/search`,
            { params: { q, user_id, limit }, timeout: 10000 }
        );
        res.json(response.data);
    } catch (error) {
        console.error('[Agent] Search conversations error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 健康检查 ====================

router.get('/health', async (req, res) => {
    try {
        const pythonHealth = await agentAxios.get(`${AGENT_SERVICE_URL}/health`, { timeout: 5000 });
        res.json({
            status: 'ok',
            nodejs: 'ok',
            python: pythonHealth.data.status,
            langraph: true
        });
    } catch (error) {
        console.error('[Agent Health] Python check failed:', error.message);
        res.json({
            status: 'degraded',
            nodejs: 'ok',
            python: 'unavailable',
            langraph: false,
            error: error.message
        });
    }
});

module.exports = router;
