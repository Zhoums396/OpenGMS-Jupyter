"use strict";
(self["webpackChunkjupyterlab_geomodel"] = self["webpackChunkjupyterlab_geomodel"] || []).push([["lib_index_js"],{

/***/ "./lib/agentWidget.js":
/*!****************************!*\
  !*** ./lib/agentWidget.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AgentWidget: () => (/* binding */ AgentWidget)
/* harmony export */ });
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _components_AgentPanel__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./components/AgentPanel */ "./lib/components/AgentPanel.js");
/**
 * Agent Widget
 * JupyterLab 左侧边栏的 Agent 面板 Widget
 */



/**
 * Agent Panel Widget - 用于左侧边栏
 */
class AgentWidget extends _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.ReactWidget {
    constructor(notebookTracker, app) {
        super();
        this._notebookTracker = null;
        this._app = null;
        this._notebookTracker = notebookTracker || null;
        this._app = app || null;
        this.addClass('jp-AgentWidget');
        this.id = 'opengeolab-agent';
        this.title.label = ''; // 不显示文字，只显示图标
        this.title.caption = 'OpenGeoLab AI Agent';
        this.title.closable = true;
        this.title.iconClass = 'jp-AgentIcon';
    }
    /**
     * 更新 Notebook Tracker
     */
    setNotebookTracker(tracker) {
        this._notebookTracker = tracker;
        this.update();
    }
    /**
     * 渲染 React 组件
     */
    render() {
        return (react__WEBPACK_IMPORTED_MODULE_1__.createElement(_components_AgentPanel__WEBPACK_IMPORTED_MODULE_2__.AgentPanel, { notebookTracker: this._notebookTracker || undefined, app: this._app || undefined }));
    }
}


/***/ }),

/***/ "./lib/components/AgentPanel.js":
/*!**************************************!*\
  !*** ./lib/components/AgentPanel.js ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AgentPanel: () => (/* binding */ AgentPanel)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/notebook */ "webpack/sharing/consume/default/@jupyterlab/notebook");
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _services_agentApi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../services/agentApi */ "./lib/services/agentApi.js");
/* harmony import */ var _LLMSettings__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./LLMSettings */ "./lib/components/LLMSettings.js");
/* harmony import */ var _ChatHistory__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./ChatHistory */ "./lib/components/ChatHistory.js");
/* harmony import */ var _utils_markdownRenderer__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/markdownRenderer */ "./lib/utils/markdownRenderer.js");
/**
 * Agent Chat Panel
 * AI 助手聊天界面，放置在左侧边栏
 */







/**
 * 获取 API 基础 URL（与 agentApi.ts 保持一致）
 */
function getApiBase() {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        return `http://${hostname}:3000`;
    }
    return 'http://localhost:3000';
}
/**
 * 获取认证 token
 */
function getToken() {
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
function getAuthHeaders() {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}
const AgentPanel = ({ notebookTracker, app }) => {
    const [messages, setMessages] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [input, setInput] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('');
    const [isLoading, setIsLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const [sessionId, setSessionId] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    const [showSettings, setShowSettings] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const [hasConfig, setHasConfig] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const [streamingContent, setStreamingContent] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('');
    const [executedTools, setExecutedTools] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [smartCases, setSmartCases] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [isLoadingCases, setIsLoadingCases] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const [expandedThinking, setExpandedThinking] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(new Set());
    // 历史对话相关状态
    const [showHistory, setShowHistory] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const [currentConversationId, setCurrentConversationId] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    const [userId, setUserId] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('default_user');
    const [conversationTitle, setConversationTitle] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('New Chat');
    // ThoughtChain 跟踪
    const [activeThoughtSteps, setActiveThoughtSteps] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const thoughtStepsRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)([]);
    const thoughtStepIdRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(0);
    const thoughtChainStartRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(0);
    // Model 选择器
    const [currentModel, setCurrentModel] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('');
    const [availableModels, setAvailableModels] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [showModelDropdown, setShowModelDropdown] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    // Chat mode: 'agent' (full tool loop) or 'ask' (simple Q&A)
    const [chatMode, setChatMode] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('agent');
    // File upload
    const [attachedFiles, setAttachedFiles] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [isUploading, setIsUploading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const fileInputRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
    const messagesEndRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
    const inputRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
    const abortControllerRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
    // 跟踪 agent 最后操作的 cell 索引，防止用户点击其他 cell 导致插入位置错乱
    const lastAgentCellIndexRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(-1);
    // 初始化用户ID（从 localStorage 或生成）
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
        const storedUserId = localStorage.getItem('geomodel_user_id');
        if (storedUserId) {
            setUserId(storedUserId);
        }
        else {
            const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('geomodel_user_id', newUserId);
            setUserId(newUserId);
        }
    }, []);
    // 保存对话历史到服务器
    const saveConversationHistory = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (convId, userMsg, assistantMsg) => {
        if (!convId)
            return;
        try {
            // 保存用户消息
            if (userMsg) {
                await _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.addMessageToConversation(convId, 'user', userMsg, userId);
            }
            // 保存助手消息
            if (assistantMsg) {
                await _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.addMessageToConversation(convId, 'assistant', assistantMsg, userId);
            }
        }
        catch (e) {
            console.warn('[Agent] Failed to save conversation history:', e);
        }
    }, [userId]);
    // 切换思考过程的展开/折叠状态
    const toggleThinking = (messageIndex) => {
        setExpandedThinking(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageIndex)) {
                newSet.delete(messageIndex);
            }
            else {
                newSet.add(messageIndex);
            }
            return newSet;
        });
    };
    // ==================== ThoughtChain helpers ====================
    const addThoughtStep = (title) => {
        const id = ++thoughtStepIdRef.current;
        const step = { id, title, status: 'running', startTime: Date.now() };
        thoughtStepsRef.current = [...thoughtStepsRef.current, step];
        setActiveThoughtSteps([...thoughtStepsRef.current]);
        return id;
    };
    const completeThoughtStep = (id) => {
        thoughtStepsRef.current = thoughtStepsRef.current.map(s => s.id === id ? { ...s, status: 'done', endTime: Date.now() } : s);
        setActiveThoughtSteps([...thoughtStepsRef.current]);
    };
    const failThoughtStep = (id) => {
        thoughtStepsRef.current = thoughtStepsRef.current.map(s => s.id === id ? { ...s, status: 'error', endTime: Date.now() } : s);
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
        var _a;
        try {
            const [config, providers] = await Promise.all([
                _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.getConfig(),
                _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.getProviders()
            ]);
            setCurrentModel(config.model || '');
            const models = [];
            // Add current model first
            if (config.model) {
                models.push({ provider: config.provider, model: config.model, label: config.model });
            }
            // Add custom models from config
            if ((_a = config.customModels) === null || _a === void 0 ? void 0 : _a.length) {
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
        }
        catch (e) {
            console.warn('[Agent] Failed to load models:', e);
        }
    };
    const handleModelChange = async (model) => {
        setCurrentModel(model);
        setShowModelDropdown(false);
        try {
            // Find the provider that owns this model and sync provider/baseUrl
            const match = availableModels.find(m => m.model === model);
            if (match && match.provider) {
                await _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.saveConfig({ model, provider: match.provider });
            }
            else {
                await _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.saveConfig({ model });
            }
        }
        catch (e) {
            console.warn('[Agent] Failed to save model selection:', e);
        }
    };
    // ==================== File upload ====================
    /**
     * Upload file to Jupyter workspace via Contents API.
     * Text files use 'text' format, binary files use 'base64' format.
     */
    const uploadToJupyter = async (file) => {
        var _a;
        try {
            const isText = /\.(txt|csv|tsv|json|geojson|py|r|md|yaml|yml|xml|html|js|ts|toml|ini|cfg|log|sh|bat|sql|tex|bib)$/i.test(file.name);
            let body;
            if (isText) {
                const text = await file.text();
                body = {
                    type: 'file',
                    format: 'text',
                    name: file.name,
                    content: text
                };
            }
            else {
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
            const basePath = ((_a = window.jupyterlab) === null || _a === void 0 ? void 0 : _a.baseUrl) || '/';
            const apiUrl = `${jupyterBase}${basePath}api/contents/${encodeURIComponent(file.name)}`;
            // Get XSRF token from cookie
            const xsrfMatch = document.cookie.match(/(?:^|;\s*)_xsrf=([^;]*)/);
            const headers = { 'Content-Type': 'application/json' };
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
        }
        catch (e) {
            console.error('[Upload] Failed:', e);
            return false;
        }
    };
    const handleFileSelect = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0)
            return;
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
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    };
    const removeAttachedFile = (index) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };
    const formatFileSize = (bytes) => {
        if (bytes < 1024)
            return bytes + ' B';
        if (bytes < 1024 * 1024)
            return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };
    // 检查是否已配置 LLM
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
        checkConfig();
        loadSmartCases();
        loadModelsData();
    }, []);
    const checkConfig = async () => {
        try {
            const config = await _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.getConfig();
            setHasConfig(!!config.hasApiKey);
        }
        catch (e) {
            setHasConfig(false);
        }
    };
    const loadSmartCases = async () => {
        try {
            setIsLoadingCases(true);
            const cases = await _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.getCases();
            setSmartCases(cases.slice(0, 3));
        }
        catch (e) {
            console.warn('[Agent] Failed to load smart cases:', e);
            setSmartCases([]);
        }
        finally {
            setIsLoadingCases(false);
        }
    };
    // 自动滚动到底部
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
        var _a;
        (_a = messagesEndRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);
    // 缓存的工作目录文件
    const [workspaceFiles, setWorkspaceFiles] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    // 获取当前项目名称
    const getProjectName = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
        if (notebookTracker === null || notebookTracker === void 0 ? void 0 : notebookTracker.currentWidget) {
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
    const getWorkspaceUserName = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
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
            }
            catch (e) {
                return '';
            }
        }
        return '';
    }, []);
    // 扫描工作目录数据
    const scanWorkspaceData = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
        try {
            const projectName = getProjectName();
            console.log('[Agent] Scanning workspace for project:', projectName);
            const files = await _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.scanWorkspace(projectName);
            console.log('[Agent] Workspace files found:', files.totalFiles);
            setWorkspaceFiles(files);
            return files;
        }
        catch (e) {
            console.warn('[Agent] Workspace scan failed:', e);
            return { totalFiles: 0, vector: [], raster: [], table: [], other: [] };
        }
    }, [getProjectName]);
    // 获取当前 Notebook 上下文（包含工作目录数据）
    const getNotebookContext = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
        const context = {};
        context.projectName = getProjectName();
        context.userName = getWorkspaceUserName();
        if (notebookTracker === null || notebookTracker === void 0 ? void 0 : notebookTracker.currentWidget) {
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
        }
        else {
            context.workspaceFiles = workspaceFiles;
        }
        return context;
    }, [notebookTracker, workspaceFiles, scanWorkspaceData, getProjectName, getWorkspaceUserName]);
    // 执行工具调用
    const executeToolCall = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (tool) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        console.log('[Agent] Executing tool:', tool.name, tool.arguments);
        let notebook = notebookTracker === null || notebookTracker === void 0 ? void 0 : notebookTracker.currentWidget;
        try {
            const args = JSON.parse(tool.arguments || '{}');
            // 如果没有打开的 notebook，自动创建并打开一个
            if (!notebook) {
                if (app) {
                    console.log('[Agent] No notebook open, auto-creating one...');
                    try {
                        // 1. 创建 notebook 文件
                        const model = await app.commands.execute('docmanager:new-untitled', {
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
                        notebook = notebookTracker === null || notebookTracker === void 0 ? void 0 : notebookTracker.currentWidget;
                        if (!notebook) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            notebook = notebookTracker === null || notebookTracker === void 0 ? void 0 : notebookTracker.currentWidget;
                        }
                        if (notebook) {
                            await notebook.sessionContext.ready;
                            console.log('[Agent] Notebook opened and ready:', notebook.title.label);
                        }
                    }
                    catch (createErr) {
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
                    let updatedCode;
                    if (oldCode && replacementCode !== undefined) {
                        // Incremental edit: replace old_code with replacement_code
                        if (!currentSource.includes(oldCode)) {
                            return { result: `Error: Could not find the specified old_code in cell ${cellIndex}. The cell content may have changed. Current cell content:\n${currentSource.slice(0, 500)}` };
                        }
                        updatedCode = currentSource.replace(oldCode, replacementCode);
                    }
                    else if (newCode) {
                        // Full replacement
                        updatedCode = newCode;
                    }
                    else {
                        return { result: 'Error: Must provide either new_code (full replace) or old_code+replacement_code (incremental edit).' };
                    }
                    // Apply the edit
                    targetCell.model.sharedModel.setSource(updatedCode);
                    // Select the cell (but do NOT update lastAgentCellIndexRef — editing
                    // an existing cell should not change where the next NEW cell gets inserted)
                    notebook.content.activeCellIndex = cellIndex;
                    // Re-execute the cell
                    await _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.run(notebook.content, notebook.sessionContext);
                    // Wait for output
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    // Capture output (same logic as add_code_cell)
                    let cellOutput = '';
                    const editCapturedImages = [];
                    try {
                        const cellModel = targetCell.model;
                        const outputs = cellModel.outputs;
                        if (outputs && outputs.length > 0) {
                            const outputParts = [];
                            const MAX_OUTPUT_CHARS = 3000;
                            let totalChars = 0;
                            for (let i = 0; i < outputs.length && totalChars < MAX_OUTPUT_CHARS; i++) {
                                const output = outputs.get(i);
                                const json = output.toJSON();
                                if (json.output_type === 'error') {
                                    const errorMsg = `ERROR - ${json.ename}: ${json.evalue}`;
                                    outputParts.push(errorMsg);
                                    if (json.traceback && Array.isArray(json.traceback)) {
                                        const tb = json.traceback.map((line) => line.replace(/\u001b\[[0-9;]*m/g, ''));
                                        outputParts.push(tb.slice(-5).join('\n'));
                                    }
                                    totalChars += errorMsg.length;
                                }
                                else if (json.output_type === 'stream') {
                                    const text = typeof json.text === 'string' ? json.text : (json.text || []).join('');
                                    if (text.trim()) {
                                        const truncated = text.length > 1000 ? text.slice(0, 1000) + '...(truncated)' : text;
                                        outputParts.push(`[${json.name || 'stdout'}]: ${truncated}`);
                                        totalChars += truncated.length;
                                    }
                                }
                                else if (json.output_type === 'execute_result') {
                                    const textData = ((_a = json.data) === null || _a === void 0 ? void 0 : _a['text/plain']) || '';
                                    if (textData) {
                                        const truncated = textData.length > 1000 ? textData.slice(0, 1000) + '...(truncated)' : textData;
                                        outputParts.push(`[result]: ${truncated}`);
                                        totalChars += truncated.length;
                                    }
                                }
                                else if (json.output_type === 'display_data') {
                                    if ((_b = json.data) === null || _b === void 0 ? void 0 : _b['image/png']) {
                                        outputParts.push('[display]: Chart/image generated — attached for visual inspection');
                                        // 捕获 base64 PNG 用于视觉检测（限制 500KB）
                                        const pngBase64 = json.data['image/png'];
                                        if (pngBase64 && pngBase64.length < 500000) {
                                            editCapturedImages.push(pngBase64);
                                            console.log(`[Agent] Captured image for visual inspection (${Math.round(pngBase64.length / 1024)}KB)`);
                                        }
                                    }
                                    else if ((_c = json.data) === null || _c === void 0 ? void 0 : _c['image/svg+xml']) {
                                        outputParts.push('[display]: SVG image generated successfully');
                                    }
                                    else if ((_d = json.data) === null || _d === void 0 ? void 0 : _d['text/plain']) {
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
                    }
                    catch (outputErr) {
                        console.warn('[Agent] Failed to capture cell output:', outputErr);
                    }
                    setExecutedTools(prev => [...prev, `Edited cell [${cellIndex}]`]);
                    const hasError = cellOutput.includes('ERROR -');
                    const hasWarning = cellOutput.includes('Warning:') || cellOutput.includes('WARNING');
                    const hasCJKIssue = cellOutput.includes('missing from current font') || cellOutput.includes('CJK');
                    let statusMsg;
                    if (hasError) {
                        statusMsg = `Cell [${cellIndex}] edited and re-executed with ERRORS. You MUST fix these errors.`;
                    }
                    else if (hasCJKIssue) {
                        statusMsg = `Cell [${cellIndex}] edited and re-executed but has CJK FONT WARNINGS. Add font config before plotting.`;
                    }
                    else if (hasWarning) {
                        statusMsg = `Cell [${cellIndex}] edited and re-executed with WARNINGS. Review if needed.`;
                    }
                    else {
                        statusMsg = `Cell [${cellIndex}] edited and re-executed successfully.`;
                    }
                    const editResultText = cellOutput ? `${statusMsg}${cellOutput}` : statusMsg;
                    return { result: editResultText, images: editCapturedImages.length > 0 ? editCapturedImages : undefined };
                }
                case 'add_code_cell': {
                    const code = args.code || '';
                    // 智能确定插入位置：优先使用 agent 上次插入的位置，防止用户点击其他 cell 导致错位
                    const totalCells = notebook.content.widgets.length;
                    let targetIndex;
                    if (lastAgentCellIndexRef.current >= 0 && lastAgentCellIndexRef.current < totalCells) {
                        targetIndex = lastAgentCellIndexRef.current;
                    }
                    else {
                        // 首次插入或 ref 无效：插入到 notebook 最末尾
                        targetIndex = totalCells - 1;
                    }
                    console.log(`[Agent] add_code_cell: inserting after cell ${targetIndex} (total=${totalCells}, lastAgentRef=${lastAgentCellIndexRef.current}, userActive=${notebook.content.activeCellIndex})`);
                    // 先将活动 cell 设为目标位置，再插入
                    notebook.content.activeCellIndex = targetIndex;
                    const activeCellIndex = targetIndex;
                    _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.insertBelow(notebook.content);
                    // 等待一下让 UI 更新
                    await new Promise(resolve => setTimeout(resolve, 100));
                    // 获取新插入的单元格
                    const newCellIndex = activeCellIndex + 1;
                    const newCell = notebook.content.widgets[newCellIndex];
                    let cellOutput = '';
                    const capturedImages = [];
                    if (newCell && newCell.model) {
                        newCell.model.sharedModel.setSource(code);
                        // 确保选中新单元格并更新 agent 追踪索引
                        notebook.content.activeCellIndex = newCellIndex;
                        lastAgentCellIndexRef.current = newCellIndex;
                        // 自动运行插入的代码
                        const runResult = await _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.run(notebook.content, notebook.sessionContext);
                        // 等待输出完全更新（绘图等较慢操作需要更多时间）
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        // 捕获 cell 执行输出（包括错误）
                        try {
                            const cellModel = newCell.model;
                            const outputs = cellModel.outputs;
                            if (outputs && outputs.length > 0) {
                                const outputParts = [];
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
                                            const tb = json.traceback.map((line) => line.replace(/\u001b\[[0-9;]*m/g, '') // 去除 ANSI 颜色码
                                            );
                                            const tbText = tb.slice(-5).join('\n');
                                            outputParts.push(tbText);
                                        }
                                        totalChars += errorMsg.length;
                                    }
                                    else if (json.output_type === 'stream') {
                                        const text = typeof json.text === 'string' ? json.text : (json.text || []).join('');
                                        if (text.trim()) {
                                            const truncated = text.length > 1000 ? text.slice(0, 1000) + '...(truncated)' : text;
                                            outputParts.push(`[${json.name || 'stdout'}]: ${truncated}`);
                                            totalChars += truncated.length;
                                        }
                                    }
                                    else if (json.output_type === 'execute_result') {
                                        const textData = ((_e = json.data) === null || _e === void 0 ? void 0 : _e['text/plain']) || '';
                                        if (textData) {
                                            const truncated = textData.length > 1000 ? textData.slice(0, 1000) + '...(truncated)' : textData;
                                            outputParts.push(`[result]: ${truncated}`);
                                            totalChars += truncated.length;
                                        }
                                    }
                                    else if (json.output_type === 'display_data') {
                                        // 图表等：捕获 base64 PNG 用于视觉检测
                                        if ((_f = json.data) === null || _f === void 0 ? void 0 : _f['image/png']) {
                                            outputParts.push('[display]: Chart/image generated — attached for visual inspection');
                                            const pngBase64 = json.data['image/png'];
                                            if (pngBase64 && pngBase64.length < 500000) {
                                                capturedImages.push(pngBase64);
                                                console.log(`[Agent] Captured image for visual inspection (${Math.round(pngBase64.length / 1024)}KB)`);
                                            }
                                        }
                                        else if ((_g = json.data) === null || _g === void 0 ? void 0 : _g['image/svg+xml']) {
                                            outputParts.push('[display]: SVG image generated successfully');
                                        }
                                        else if ((_h = json.data) === null || _h === void 0 ? void 0 : _h['text/plain']) {
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
                        }
                        catch (outputErr) {
                            console.warn('[Agent] Failed to capture cell output:', outputErr);
                        }
                    }
                    setExecutedTools(prev => [...prev, 'Inserted and executed code cell']);
                    // 返回包含执行输出的结果（含 cell_index 以便后续 edit_code_cell 使用）
                    const hasError = cellOutput.includes('ERROR -');
                    const hasWarning = cellOutput.includes('Warning:') || cellOutput.includes('WARNING');
                    const hasCJKIssue = cellOutput.includes('missing from current font') || cellOutput.includes('CJK');
                    const cellIdxInfo = `[cell_index=${newCellIndex}]`;
                    let statusMsg;
                    if (hasError) {
                        statusMsg = `Code cell ${cellIdxInfo} inserted and executed with ERRORS. Use edit_code_cell(cell_index=${newCellIndex}, ...) to fix the code in-place.`;
                    }
                    else if (hasCJKIssue) {
                        statusMsg = `Code cell ${cellIdxInfo} executed but has CJK FONT WARNINGS — Chinese/Japanese/Korean characters will show as boxes (□□□) in plots. Use edit_code_cell(cell_index=${newCellIndex}, ...) to add font configuration.`;
                    }
                    else if (hasWarning) {
                        statusMsg = `Code cell ${cellIdxInfo} executed with WARNINGS. Review and fix if needed using edit_code_cell(cell_index=${newCellIndex}, ...).`;
                    }
                    else {
                        statusMsg = `Code cell ${cellIdxInfo} inserted and executed successfully.`;
                    }
                    const addResultText = cellOutput ? `${statusMsg}${cellOutput}` : statusMsg;
                    return { result: addResultText, images: capturedImages.length > 0 ? capturedImages : undefined };
                }
                case 'add_markdown_cell': {
                    const content = args.content || '';
                    // 智能确定插入位置：优先使用 agent 上次插入的位置
                    const mdTotalCells = notebook.content.widgets.length;
                    let mdTargetIndex;
                    if (lastAgentCellIndexRef.current >= 0 && lastAgentCellIndexRef.current < mdTotalCells) {
                        mdTargetIndex = lastAgentCellIndexRef.current;
                    }
                    else {
                        mdTargetIndex = mdTotalCells - 1;
                    }
                    console.log(`[Agent] add_markdown_cell: inserting after cell ${mdTargetIndex} (total=${mdTotalCells}, lastAgentRef=${lastAgentCellIndexRef.current})`);
                    notebook.content.activeCellIndex = mdTargetIndex;
                    const activeCellIndex = mdTargetIndex;
                    _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.insertBelow(notebook.content);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const newCellIndex = activeCellIndex + 1;
                    notebook.content.activeCellIndex = newCellIndex;
                    // 更改单元格类型为 markdown
                    _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.changeCellType(notebook.content, 'markdown');
                    const newCell = notebook.content.widgets[newCellIndex];
                    if (newCell && newCell.model) {
                        newCell.model.sharedModel.setSource(content);
                        // 更新 agent 追踪索引
                        lastAgentCellIndexRef.current = newCellIndex;
                        // 渲染 markdown
                        await _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookActions.run(notebook.content, notebook.sessionContext);
                    }
                    setExecutedTools(prev => [...prev, 'Inserted Markdown cell']);
                    return { result: 'Markdown cell inserted' };
                }
                default:
                    console.log('[Agent] Unknown tool:', tool.name);
                    return { result: `Tool ${tool.name} is not supported in frontend` };
            }
        }
        catch (e) {
            console.error('[Agent] Tool execution error:', e);
            return { result: `Tool execution failed: ${e.message}` };
        }
    }, [notebookTracker, app]);
    // 发送消息
    const handleSend = async (overrideInput) => {
        const nextInput = (overrideInput !== null && overrideInput !== void 0 ? overrideInput : input).trim();
        if (!nextInput || isLoading)
            return;
        // Build message content with uploaded file info
        let messageContent = nextInput;
        if (attachedFiles.length > 0) {
            const uploadedFiles = attachedFiles.filter(f => f.uploaded);
            if (uploadedFiles.length > 0) {
                const fileList = uploadedFiles.map(f => `  - ${f.name} (${formatFileSize(f.size)})`).join('\n');
                messageContent = nextInput + `\n\n[用户已上传以下文件到项目工作目录:]\n${fileList}\n[请在分析中使用这些文件，文件路径为工作目录下的文件名]`;
            }
        }
        const userMessage = {
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
                const eventStream = _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.askDirect(messageContent, history);
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
            }
            else {
                // Agent mode: full tool loop
                const context = await getNotebookContext();
                let currentSessionId = sessionId;
                let convId = currentConversationId;
                if (!convId) {
                    try {
                        const title = nextInput.length > 30
                            ? nextInput.substring(0, 30) + '...'
                            : nextInput;
                        const newConv = await _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.createConversation(userId, title);
                        convId = newConv.id;
                        setCurrentConversationId(convId);
                        setConversationTitle(title);
                    }
                    catch (e) {
                        console.warn('[Agent] Failed to create conversation:', e);
                    }
                }
                await processAgentLoop(messageContent, context, currentSessionId, convId);
            }
        }
        catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Error: ${error.message}`,
                    timestamp: new Date()
                }]);
        }
        finally {
            setIsLoading(false);
            setStreamingContent('');
            setActiveThoughtSteps([]);
        }
    };
    const handleRunSmartCase = (agentCase) => {
        if (isLoading)
            return;
        handleSend(agentCase.starterPrompt);
    };
    // Agent 循环处理函数 (with ThoughtChain tracking)
    const processAgentLoop = async (initialMessage, context, currentSessionId, conversationId = null, isToolResult = false, toolResultsToSubmit) => {
        var _a, _b;
        console.log('[Agent] processAgentLoop called:', {
            initialMessage: initialMessage.substring(0, 50),
            currentSessionId,
            conversationId,
            isToolResult,
            toolResultsCount: toolResultsToSubmit === null || toolResultsToSubmit === void 0 ? void 0 : toolResultsToSubmit.length
        });
        let fullContent = '';
        const pendingToolCalls = [];
        let thinkingStepId = null;
        try {
            const eventStream = isToolResult && currentSessionId && toolResultsToSubmit
                ? _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.submitToolResults(currentSessionId, toolResultsToSubmit)
                : _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.chat(initialMessage, currentSessionId || undefined, context);
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
                            const toolResultsArray = [];
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
                                }
                                catch (err) {
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
                        if (thinkingStepId)
                            failThoughtStep(thinkingStepId);
                        if (((_a = event.error) === null || _a === void 0 ? void 0 : _a.includes('Please configure')) || ((_b = event.error) === null || _b === void 0 ? void 0 : _b.includes('请先配置'))) {
                            setShowSettings(true);
                        }
                        throw new Error(event.error);
                }
            }
        }
        catch (error) {
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
                }]);
            if (fullContent) {
                if (conversationId && !isToolResult) {
                    saveConversationHistory(conversationId, initialMessage, fullContent);
                }
                else if (conversationId && isToolResult) {
                    saveConversationHistory(conversationId, '', fullContent);
                }
            }
        }
    };
    // 快捷键处理
    const handleKeyDown = (e) => {
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
    const handleSelectConversation = async (conversationId) => {
        try {
            const conversation = await _services_agentApi__WEBPACK_IMPORTED_MODULE_2__.agentApi.getConversation(conversationId, userId);
            // 转换消息格式
            const loadedMessages = conversation.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.timestamp)
            }));
            setMessages(loadedMessages);
            setCurrentConversationId(conversationId);
            setConversationTitle(conversation.title);
            setSessionId(null); // 重置 sessionId，让 agent 重新开始
            setShowHistory(false);
        }
        catch (e) {
            console.error('Failed to load conversation:', e);
            alert('Failed to load conversation');
        }
    };
    // 渲染代码块
    const renderCodeBlock = (code, language = 'python') => {
        return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "agent-code-block" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "code-block-header" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "code-lang-badge" }, language),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "code-actions" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "code-action-btn", onClick: () => navigator.clipboard.writeText(code), title: "Copy" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor" },
                            react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" }),
                            react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" }))))),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("pre", { className: "code-block-content" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("code", null, code))));
    };
    // 解析并渲染消息内容（支持代码块 + markdown）
    const renderMessageContent = (content) => {
        const parts = [];
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;
        let keyIndex = 0;
        while ((match = codeBlockRegex.exec(content)) !== null) {
            // 添加代码块之前的文本（用 markdown 渲染）
            if (match.index > lastIndex) {
                const text = content.slice(lastIndex, match.index);
                parts.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { key: keyIndex++, className: "md-content" }, (0,_utils_markdownRenderer__WEBPACK_IMPORTED_MODULE_5__.renderMarkdown)(text)));
            }
            // 添加代码块
            const language = match[1] || 'python';
            const code = match[2].trim();
            parts.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { key: keyIndex++ }, renderCodeBlock(code, language)));
            lastIndex = match.index + match[0].length;
        }
        // 添加剩余文本（用 markdown 渲染）
        if (lastIndex < content.length) {
            const remaining = content.slice(lastIndex);
            parts.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { key: keyIndex++, className: "md-content" }, (0,_utils_markdownRenderer__WEBPACK_IMPORTED_MODULE_5__.renderMarkdown)(remaining)));
        }
        return parts.length > 0 ? parts : content;
    };
    // ==================== ThoughtChain rendering ====================
    const formatDuration = (ms) => {
        if (ms < 1000)
            return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };
    const renderThoughtChain = (steps, isLive = false) => {
        if (!steps || steps.length === 0)
            return null;
        const totalTime = steps.length > 0
            ? (steps[steps.length - 1].endTime || Date.now()) - steps[0].startTime
            : 0;
        const isExpanded = isLive || expandedThinking.has(-999); // -999 is placeholder, per-message below
        return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "thought-chain" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "thought-chain-header", onClick: () => !isLive && toggleThinking(-999) },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "thought-chain-icon" }, isLive ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "thought-chain-spinner" })) : (react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 0a8 8 0 100 16A8 8 0 008 0zm.93 4.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 4.588z" }),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("circle", { cx: "8", cy: "3.5", r: ".75" })))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "thought-chain-summary" }, isLive ? 'Thinking...' : `Thought for ${formatDuration(totalTime)}`),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "thought-chain-count" },
                    steps.length,
                    " steps"),
                !isLive && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { className: `thought-chain-arrow ${isExpanded ? 'expanded' : ''}`, width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" })))),
            (isLive || isExpanded) && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "thought-chain-steps" }, steps.map((step, i) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { key: step.id, className: `thought-step thought-step-${step.status}` },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "thought-step-indicator" }, step.status === 'running' ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "step-spinner" })) : step.status === 'done' ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", className: "step-check" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { fillRule: "evenodd", d: "M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" }))) : (react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", className: "step-error" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { fillRule: "evenodd", d: "M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" })))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "thought-step-title" }, step.title),
                step.endTime && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "thought-step-time" }, formatDuration(step.endTime - step.startTime))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: `thought-step-badge badge-${step.status}` }, step.status === 'running' ? 'Running' : step.status === 'done' ? 'Done' : 'Error'))))))));
    };
    const renderMessageThoughtChain = (steps, msgIndex) => {
        if (!steps || steps.length === 0)
            return null;
        const totalTime = steps.length > 0
            ? (steps[steps.length - 1].endTime || Date.now()) - steps[0].startTime
            : 0;
        const isExpanded = expandedThinking.has(msgIndex);
        return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "thought-chain" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "thought-chain-header", onClick: () => toggleThinking(msgIndex) },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "thought-chain-icon" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 0a8 8 0 100 16A8 8 0 008 0zm.93 4.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 4.588z" }),
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("circle", { cx: "8", cy: "3.5", r: ".75" }))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "thought-chain-summary" },
                    "Thought for ",
                    formatDuration(totalTime)),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "thought-chain-count" },
                    steps.length,
                    " steps"),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { className: `thought-chain-arrow ${isExpanded ? 'expanded' : ''}`, width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" }))),
            isExpanded && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "thought-chain-steps" }, steps.map((step) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { key: step.id, className: `thought-step thought-step-${step.status}` },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "thought-step-indicator" }, step.status === 'done' ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", className: "step-check" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { fillRule: "evenodd", d: "M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" }))) : (react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", className: "step-error" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { fillRule: "evenodd", d: "M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" })))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "thought-step-title" }, step.title),
                step.endTime && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "thought-step-time" }, formatDuration(step.endTime - step.startTime))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: `thought-step-badge badge-${step.status}` }, step.status === 'done' ? 'Done' : 'Error'))))))));
    };
    // 渲染消息
    const renderMessage = (msg, index) => {
        const isUser = msg.role === 'user';
        const hasContent = msg.content && msg.content.trim().length > 0;
        const hasThoughtSteps = msg.thoughtSteps && msg.thoughtSteps.length > 0;
        return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { key: index, className: `agent-message ${isUser ? 'user' : 'assistant'}` }, isUser ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "user-message-bubble" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "user-avatar" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z" }),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 4a2 2 0 100 4 2 2 0 000-4zM4 10.5c0-1.5 2-2.5 4-2.5s4 1 4 2.5V12H4v-1.5z" }))),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "user-message-content" }, msg.content))) : (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-response" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-header" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-avatar" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z" }))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "assistant-label" }, "OpenGeoLab AI")),
            hasThoughtSteps && renderMessageThoughtChain(msg.thoughtSteps, index),
            hasContent && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-content" }, renderMessageContent(msg.content)))))));
    };
    // 获取工具的友好显示名称
    const getToolDisplayName = (toolName) => {
        const nameMap = {
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
        return (react__WEBPACK_IMPORTED_MODULE_0__.createElement(_LLMSettings__WEBPACK_IMPORTED_MODULE_3__.LLMSettings, { onClose: () => setShowSettings(false), onSaved: () => {
                checkConfig();
                setShowSettings(false);
            } }));
    }
    return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "agent-panel" },
        react__WEBPACK_IMPORTED_MODULE_0__.createElement(_ChatHistory__WEBPACK_IMPORTED_MODULE_4__.ChatHistory, { userId: userId, currentConversationId: currentConversationId, onSelectConversation: handleSelectConversation, onNewConversation: handleNewChat, isVisible: showHistory, onClose: () => setShowHistory(false) }),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "agent-header" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "header-left" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { className: "agent-logo", width: "20", height: "20", viewBox: "0 0 16 16", fill: "currentColor" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z" })),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "header-title" }, conversationTitle)),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "header-right" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "icon-btn", onClick: () => setShowHistory(true), title: "Chat history" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v8.5a.25.25 0 01-.25.25h-6.5a.75.75 0 00-.53.22L4.5 14.44v-2.19a.75.75 0 00-.75-.75h-2a.25.25 0 01-.25-.25v-8.5zM1.75 1A1.75 1.75 0 000 2.75v8.5C0 12.216.784 13 1.75 13H3v2.25c0 .69.56 1.25 1.25 1.25.33 0 .65-.132.884-.366L7.634 13.5H14.25A1.75 1.75 0 0016 11.75v-8.5A1.75 1.75 0 0014.25 1H1.75z" }))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "icon-btn", onClick: handleNewChat, title: "New chat" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M7.25 1.75a.75.75 0 011.5 0V7h5.25a.75.75 0 010 1.5H8.75v5.25a.75.75 0 01-1.5 0V8.5H2a.75.75 0 010-1.5h5.25V1.75z" }))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "icon-btn", onClick: () => setShowSettings(true), title: "Settings" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { fillRule: "evenodd", d: "M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.423 1.53.27l1.102-.303c.11-.03.175.016.195.046.219.31.41.641.573.989.014.031.022.11-.059.19l-.815.806c-.411.406-.562.957-.53 1.456a4.588 4.588 0 010 .582c-.032.499.119 1.05.53 1.456l.815.806c.08.08.073.159.059.19a6.494 6.494 0 01-.573.99c-.02.029-.086.074-.195.045l-1.103-.303c-.559-.153-1.112-.008-1.529.27-.16.107-.327.204-.5.29-.449.222-.851.628-.998 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.613 6.613 0 01-1.142 0c-.036-.003-.108-.037-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a4.502 4.502 0 01-.501-.29c-.417-.278-.97-.423-1.53-.27l-1.102.303c-.11.03-.175-.016-.195-.046a6.492 6.492 0 01-.573-.989c-.014-.031-.022-.11.059-.19l.815-.806c.411-.406.562-.957.53-1.456a4.587 4.587 0 010-.582c.032-.499-.119-1.05-.53-1.456l-.815-.806c-.08-.08-.073-.159-.059-.19.162-.348.354-.68.573-.989.02-.03.085-.076.195-.046l1.103.303c.559.153 1.112.008 1.529-.27.16-.107.327-.204.5-.29.449-.222.851-.628.998-1.189l.289-1.105c.029-.11.101-.143.137-.146zM8 0c-.236 0-.47.01-.701.03-.743.065-1.29.615-1.458 1.261l-.29 1.106c-.017.066-.078.158-.211.224a5.994 5.994 0 00-.668.386c-.123.082-.233.09-.3.071L3.27 2.776c-.644-.177-1.392.02-1.82.63a7.977 7.977 0 00-.704 1.217c-.315.675-.111 1.422.363 1.891l.815.806c.05.048.098.147.088.294a6.084 6.084 0 000 .772c.01.147-.038.246-.088.294l-.815.806c-.474.469-.678 1.216-.363 1.891.2.428.436.835.704 1.218.428.609 1.176.806 1.82.63l1.103-.303c.066-.019.176-.011.299.071.213.143.436.272.668.386.133.066.194.158.212.224l.289 1.106c.169.646.715 1.196 1.458 1.26a8.094 8.094 0 001.402 0c.743-.064 1.29-.614 1.458-1.26l.29-1.106c.017-.066.078-.158.211-.224a5.98 5.98 0 00.668-.386c.123-.082.233-.09.3-.071l1.102.302c.644.177 1.392-.02 1.82-.63.268-.382.505-.789.704-1.217.315-.675.111-1.422-.364-1.891l-.814-.806c-.05-.048-.098-.147-.088-.294a6.1 6.1 0 000-.772c-.01-.147.039-.246.088-.294l.814-.806c.475-.469.679-1.216.364-1.891a7.992 7.992 0 00-.704-1.218c-.428-.609-1.176-.806-1.82-.63l-1.103.303c-.066.019-.176.011-.299-.071a5.991 5.991 0 00-.668-.386c-.133-.066-.194-.158-.212-.224L10.16 1.29C9.99.645 9.444.095 8.701.031A8.094 8.094 0 008 0zm0 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6.5 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" }))))),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "agent-messages" },
            messages.length === 0 && !streamingContent && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "agent-welcome" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "welcome-icon" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "48", height: "48", viewBox: "0 0 16 16", fill: "currentColor", opacity: "0.5" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z" }))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("h3", null, "OpenGeoLab AI Assistant"),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", { className: "welcome-subtitle" }, "I can code, inspect your project, run terminal commands, and help reproduce workflows."),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "smart-cases" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "smart-cases-title" }, "Smart Cases"),
                    isLoadingCases && react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "smart-cases-loading" }, "Loading cases..."),
                    !isLoadingCases && smartCases.length === 0 && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "smart-cases-empty" }, "No curated cases available.")),
                    !isLoadingCases && smartCases.map((agentCase) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { key: agentCase.id, className: "smart-case-item", onClick: () => handleRunSmartCase(agentCase), disabled: isLoading },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "smart-case-name" }, agentCase.title),
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "smart-case-meta" },
                            agentCase.category,
                            " \u00B7 ",
                            agentCase.difficulty))))),
                !hasConfig && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "config-btn", onClick: () => setShowSettings(true) },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.423 1.53.27l1.102-.303c.11-.03.175.016.195.046a6.588 6.588 0 01.573.989c.014.031.022.11-.059.19l-.815.806c-.411.406-.562.957-.53 1.456a4.588 4.588 0 010 .582c-.032.499.119 1.05.53 1.456l.815.806c.08.08.073.159.059.19-.163.348-.355.68-.573.99-.02.029-.086.074-.195.045l-1.103-.303c-.559-.153-1.112-.008-1.529.27-.16.107-.327.204-.5.29-.449.222-.851.628-.998 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.613 6.613 0 01-1.142 0c-.036-.003-.108-.037-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a4.502 4.502 0 01-.501-.29c-.417-.278-.97-.423-1.53-.27l-1.102.303c-.11.03-.175-.016-.195-.046a6.492 6.492 0 01-.573-.989c-.014-.031-.022-.11.059-.19l.815-.806c.411-.406.562-.957.53-1.456a4.587 4.587 0 010-.582c.032-.499-.119-1.05-.53-1.456l-.815-.806c-.08-.08-.073-.159-.059-.19.162-.348.354-.68.573-.989.02-.03.085-.076.195-.046l1.103.303c.559.153 1.112.008 1.529-.27.16-.107.327-.204.5-.29.449-.222.851-.628.998-1.189l.289-1.105c.029-.11.101-.143.137-.146zM8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" })),
                    "Configure LLM API")))),
            messages.map(renderMessage),
            isLoading && activeThoughtSteps.length > 0 && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "agent-message assistant" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-response" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-header" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-avatar" },
                            react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor" },
                                react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z" }))),
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "assistant-label" }, "OpenGeoLab AI")),
                    renderThoughtChain(activeThoughtSteps, true),
                    streamingContent && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-content" },
                        renderMessageContent(streamingContent),
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "typing-cursor" }, "\u258A")))))),
            streamingContent && activeThoughtSteps.length === 0 && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "agent-message assistant" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-response" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-header" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-avatar" },
                            react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor" },
                                react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z" }))),
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "assistant-label" }, "OpenGeoLab AI")),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "assistant-content" },
                        renderMessageContent(streamingContent),
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "typing-cursor" }, "\u258A"))))),
            isLoading && !streamingContent && activeThoughtSteps.length === 0 && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "agent-loading" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "loading-dots" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null)))),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { ref: messagesEndRef })),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "agent-input-area" },
            (attachedFiles.length > 0 || isUploading) && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "attached-files" },
                attachedFiles.map((file, i) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { key: i, className: `attached-file-chip ${file.uploaded ? 'chip-success' : 'chip-error'}` },
                    file.uploaded ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", className: "chip-icon-ok" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { fillRule: "evenodd", d: "M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" }))) : (react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", className: "chip-icon-err" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { fillRule: "evenodd", d: "M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" }))),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "file-chip-name" }, file.name),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "file-chip-size" }, formatFileSize(file.size)),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "file-chip-remove", onClick: () => removeAttachedFile(i) }, "\u00D7")))),
                isUploading && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "attached-file-chip chip-uploading" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "chip-spinner" }),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null, "Uploading..."))))),
            isLoading && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "agent-status-bar" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "status-pulse" }),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "status-text" }, streamingContent ? 'Agent is responding...' : executedTools.length > 0 ? 'Executing tools...' : 'Agent is thinking...'))),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: `input-wrapper ${isLoading ? 'input-wrapper-loading' : ''}` },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "attach-btn", onClick: () => { var _a; return (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, disabled: isLoading, title: "Attach files" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M4.317 1.592a3.75 3.75 0 015.366 0l4.608 4.763a.75.75 0 01-1.078 1.043l-4.608-4.763a2.25 2.25 0 00-3.21 0L1.636 6.56a3.5 3.5 0 004.944 4.949l4.608-4.763a1.25 1.25 0 00-1.788-1.747L5.792 9.762a.25.25 0 00.358.348l2.608-2.697a.75.75 0 011.078 1.044l-2.608 2.697a1.75 1.75 0 01-2.436-2.514l3.608-3.763a2.75 2.75 0 013.866 3.834L7.658 13.47a5 5 0 01-7.022-7.118l3.681-3.76z" }))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("input", { ref: fileInputRef, type: "file", multiple: true, style: { display: 'none' }, onChange: handleFileSelect }),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("textarea", { ref: inputRef, value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: isLoading ? (chatMode === 'ask' ? 'Thinking...' : 'Agent is working...') : (chatMode === 'ask' ? 'Ask a question...' : 'Ask OpenGeoLab AI Agent...'), disabled: isLoading, rows: 1 }),
                isLoading ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "stop-btn", onClick: handleStop, title: "Stop generation" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("rect", { x: "3", y: "3", width: "10", height: "10", rx: "2" })))) : (react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "submit-btn", onClick: () => handleSend(), disabled: !input.trim() && attachedFiles.filter(f => f.uploaded).length === 0 },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M.989 8l6.012-6.012v4.762h8v2.5h-8v4.762L.99 8z", transform: "rotate(-90 8 8)" }))))),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "model-selector-bar" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: `mode-toggle-btn ${chatMode}`, onClick: () => setChatMode(prev => prev === 'agent' ? 'ask' : 'agent'), disabled: isLoading, title: chatMode === 'agent' ? 'Agent mode: can execute code, use tools' : 'Ask mode: simple Q&A, no tool calls' }, chatMode === 'agent' ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null,
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 1a2 2 0 012 2v2H6V3a2 2 0 012-2zM6 6h4v1H6V6zm-3.5 2A1.5 1.5 0 001 9.5v4A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5v-4A1.5 1.5 0 0013.5 8h-11zM4 11a1 1 0 110-2 1 1 0 010 2zm4 0a1 1 0 110-2 1 1 0 010 2zm4 0a1 1 0 110-2 1 1 0 010 2z" })),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null, "Agent"))) : (react__WEBPACK_IMPORTED_MODULE_0__.createElement(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null,
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0114.25 13H8.06l-2.573 2.573A1.458 1.458 0 013 14.543V13H1.75A1.75 1.75 0 010 11.25v-8.5z" })),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null, "Ask")))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "model-selector-wrapper" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "model-selector-btn", onClick: () => setShowModelDropdown(!showModelDropdown), disabled: isLoading },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor" },
                            react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 0a8 8 0 100 16A8 8 0 008 0zm2.8 11.2c-.4.4-1 .8-1.8.8s-1.4-.4-1.8-.8c-.8-.8-1.2-2-1.2-3.2s.4-2.4 1.2-3.2c.4-.4 1-.8 1.8-.8s1.4.4 1.8.8c.8.8 1.2 2 1.2 3.2s-.4 2.4-1.2 3.2z" })),
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null, currentModel || 'Select model'),
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { className: `model-arrow ${showModelDropdown ? 'expanded' : ''}`, width: "10", height: "10", viewBox: "0 0 16 16", fill: "currentColor" },
                            react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" }))),
                    showModelDropdown && availableModels.length > 0 && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "model-dropdown" }, availableModels.map((m, i) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { key: i, className: `model-option ${m.model === currentModel ? 'active' : ''}`, onClick: () => handleModelChange(m.model) },
                        m.label,
                        m.model === currentModel && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor" },
                            react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { fillRule: "evenodd", d: "M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" }))))))))))),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("style", null, `
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
            `)));
};


/***/ }),

/***/ "./lib/components/ChatHistory.js":
/*!***************************************!*\
  !*** ./lib/components/ChatHistory.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChatHistory: () => (/* binding */ ChatHistory)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _services_agentApi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../services/agentApi */ "./lib/services/agentApi.js");
/**
 * 对话历史侧边栏组件
 * 显示历史对话列表，支持搜索、加载、删除
 */



const ChatHistory = ({ userId, currentConversationId, onSelectConversation, onNewConversation, isVisible, onClose }) => {
    const [conversations, setConversations] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [isLoading, setIsLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const [searchQuery, setSearchQuery] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('');
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    // 加载对话列表
    const loadConversations = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await _services_agentApi__WEBPACK_IMPORTED_MODULE_1__.agentApi.listConversations(userId, 50, 0);
            setConversations(result.conversations);
        }
        catch (e) {
            console.error('Failed to load conversations:', e);
            setError('加载历史对话失败');
        }
        finally {
            setIsLoading(false);
        }
    }, [userId]);
    // 搜索对话
    const searchConversations = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (query) => {
        if (!query.trim()) {
            loadConversations();
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const result = await _services_agentApi__WEBPACK_IMPORTED_MODULE_1__.agentApi.searchConversations(query, userId, 20);
            setConversations(result.results);
        }
        catch (e) {
            console.error('Failed to search conversations:', e);
            setError('搜索失败');
        }
        finally {
            setIsLoading(false);
        }
    }, [userId, loadConversations]);
    // 删除对话
    const handleDelete = async (e, conversationId) => {
        e.stopPropagation();
        if (!confirm('确定要删除这个对话吗？')) {
            return;
        }
        try {
            await _services_agentApi__WEBPACK_IMPORTED_MODULE_1__.agentApi.deleteConversation(conversationId, userId);
            setConversations(prev => prev.filter(c => c.id !== conversationId));
            // 如果删除的是当前对话，创建新对话
            if (conversationId === currentConversationId) {
                onNewConversation();
            }
        }
        catch (e) {
            console.error('Failed to delete conversation:', e);
            alert('删除失败');
        }
    };
    // 组件挂载或可见时加载数据
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
        if (isVisible) {
            loadConversations();
        }
    }, [isVisible, loadConversations]);
    // 搜索防抖
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
        const timer = setTimeout(() => {
            searchConversations(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, searchConversations]);
    // 格式化时间
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }
        else if (diffDays === 1) {
            return '昨天';
        }
        else if (diffDays < 7) {
            return `${diffDays}天前`;
        }
        else {
            return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        }
    };
    if (!isVisible) {
        return null;
    }
    return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "chat-history-panel" },
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "chat-history-header" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("h3", null, "\u5386\u53F2\u5BF9\u8BDD"),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "close-btn", onClick: onClose, title: "\u5173\u95ED" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" })))),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "chat-history-search" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "search-input-wrapper" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { className: "search-icon", width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm-.82 4.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04z" })),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("input", { type: "text", placeholder: "\u641C\u7D22\u5BF9\u8BDD...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "search-input" }),
                searchQuery && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "clear-search-btn", onClick: () => setSearchQuery('') },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" })))))),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "new-conversation-btn", onClick: onNewConversation },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zm6.75-3.5v3h3a.75.75 0 010 1.5h-3v3a.75.75 0 01-1.5 0v-3h-3a.75.75 0 010-1.5h3v-3a.75.75 0 011.5 0z" })),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null, "\u65B0\u5EFA\u5BF9\u8BDD")),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "chat-history-list" },
            isLoading && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "loading-indicator" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "spinner" }),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null, "\u52A0\u8F7D\u4E2D..."))),
            error && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "error-message" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null, error),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { onClick: loadConversations }, "\u91CD\u8BD5"))),
            !isLoading && !error && conversations.length === 0 && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "empty-state" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "48", height: "48", viewBox: "0 0 16 16", fill: "currentColor", opacity: "0.3" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M2.5 1A1.5 1.5 0 001 2.5v11A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0013.5 1h-11zm.25 1.5h10.5a.25.25 0 01.25.25v10.5a.25.25 0 01-.25.25H2.75a.25.25 0 01-.25-.25V2.75a.25.25 0 01.25-.25z" })),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", null, searchQuery ? '没有找到匹配的对话' : '还没有历史对话'))),
            !isLoading && conversations.map((conv) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { key: conv.id, className: `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`, onClick: () => onSelectConversation(conv.id) },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "conversation-icon" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v8.5a.25.25 0 01-.25.25h-6.5a.75.75 0 00-.53.22L4.5 14.44v-2.19a.75.75 0 00-.75-.75h-2a.25.25 0 01-.25-.25v-8.5z" }))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "conversation-info" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "conversation-title" }, conv.title),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "conversation-meta" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "message-count" },
                            conv.message_count,
                            " \u6761\u6D88\u606F"),
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "time" }, formatTime(conv.updated_at)))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "delete-btn", onClick: (e) => handleDelete(e, conv.id), title: "\u5220\u9664\u5BF9\u8BDD" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("path", { d: "M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" })))))))));
};


/***/ }),

/***/ "./lib/components/CodePreview.js":
/*!***************************************!*\
  !*** ./lib/components/CodePreview.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CodePreview: () => (/* binding */ CodePreview)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/**
 * Code Preview Component
 */

const CodePreview = ({ code }) => {
    const [copied, setCopied] = react__WEBPACK_IMPORTED_MODULE_0__.useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch (err) {
            console.error('Failed to copy:', err);
        }
    };
    if (!code) {
        return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-code-preview empty" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", null, "Code will be generated after parameters are filled")));
    }
    return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-code-preview" },
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "code-header" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null, "Code Preview"),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { onClick: handleCopy }, copied ? 'Copied' : 'Copy')),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("pre", { className: "code-content" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("code", null, code))));
};


/***/ }),

/***/ "./lib/components/GeoModelPanel.js":
/*!*****************************************!*\
  !*** ./lib/components/GeoModelPanel.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GeoModelPanel: () => (/* binding */ GeoModelPanel)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _ModelBrowser__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./ModelBrowser */ "./lib/components/ModelBrowser.js");
/* harmony import */ var _ParameterForm__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./ParameterForm */ "./lib/components/ParameterForm.js");
/* harmony import */ var _CodePreview__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./CodePreview */ "./lib/components/CodePreview.js");
/* harmony import */ var _services_api__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../services/api */ "./lib/services/api.js");
/* harmony import */ var _utils_codeGenerator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/codeGenerator */ "./lib/utils/codeGenerator.js");
/**
 * GeoModel Main Panel Component
 */







// Debounce hook
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(value);
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}
const GeoModelPanel = ({ notebookTracker }) => {
    // State
    const [activeTab, setActiveTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('model');
    const [source, setSource] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('all');
    const [items, setItems] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const [searchQuery, setSearchQuery] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('');
    const [authWarning, setAuthWarning] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    // Pagination state
    const [currentPage, setCurrentPage] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(1);
    const [totalItems, setTotalItems] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
    const [totalPages, setTotalPages] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
    const pageSize = 20;
    // Debounced search query (300ms delay)
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    // Selected item (with full details)
    const [selectedItem, setSelectedItem] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    const [loadingDetail, setLoadingDetail] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    // Parameter values
    const [paramValues, setParamValues] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)({});
    // Generated code
    const [generatedCode, setGeneratedCode] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('');
    // Reset page when search query or tab changes
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery, activeTab, source]);
    // Load data
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
        loadItems();
    }, [activeTab, source, debouncedSearchQuery, currentPage]);
    const loadItems = async () => {
        setLoading(true);
        setAuthWarning(false);
        try {
            if (activeTab === 'model') {
                if (source === 'all') {
                    const result = await (0,_services_api__WEBPACK_IMPORTED_MODULE_4__.fetchModels)(debouncedSearchQuery, currentPage, pageSize);
                    setItems(result.data);
                    setTotalItems(result.total);
                    setTotalPages(result.totalPages);
                }
                else {
                    if (!(0,_services_api__WEBPACK_IMPORTED_MODULE_4__.isAuthenticated)()) {
                        setAuthWarning(true);
                        setItems([]);
                        setTotalItems(0);
                        setTotalPages(0);
                    }
                    else {
                        const data = await (0,_services_api__WEBPACK_IMPORTED_MODULE_4__.fetchMyModels)();
                        setItems(data);
                        setTotalItems(data.length);
                        setTotalPages(1);
                    }
                }
            }
            else {
                if (source === 'all') {
                    const result = await (0,_services_api__WEBPACK_IMPORTED_MODULE_4__.fetchDataMethods)(debouncedSearchQuery, currentPage, pageSize);
                    setItems(result.data);
                    setTotalItems(result.total);
                    setTotalPages(result.totalPages);
                }
                else {
                    if (!(0,_services_api__WEBPACK_IMPORTED_MODULE_4__.isAuthenticated)()) {
                        setAuthWarning(true);
                        setItems([]);
                        setTotalItems(0);
                        setTotalPages(0);
                    }
                    else {
                        const data = await (0,_services_api__WEBPACK_IMPORTED_MODULE_4__.fetchMyDataMethods)();
                        setItems(data);
                        setTotalItems(data.length);
                        setTotalPages(1);
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to load items:', error);
        }
        finally {
            setLoading(false);
        }
    };
    // Select item - load detailed info
    const handleSelectItem = async (item) => {
        setLoadingDetail(true);
        setParamValues({});
        setGeneratedCode('');
        try {
            let detail = null;
            // Use name as ID to get details
            const itemName = item.name || item.id;
            if (activeTab === 'model') {
                detail = await (0,_services_api__WEBPACK_IMPORTED_MODULE_4__.fetchModelDetail)(String(itemName));
            }
            else {
                detail = await (0,_services_api__WEBPACK_IMPORTED_MODULE_4__.fetchDataMethodDetail)(String(itemName));
            }
            if (detail) {
                setSelectedItem(detail);
                console.log('[GeoModel] Loaded detail with parameters:', detail.parameters);
                // Generate initial code immediately
                const initialCode = activeTab === 'model'
                    ? (0,_utils_codeGenerator__WEBPACK_IMPORTED_MODULE_5__.generateModelCode)(detail, {})
                    : (0,_utils_codeGenerator__WEBPACK_IMPORTED_MODULE_5__.generateDataMethodCode)(detail, {});
                setGeneratedCode(initialCode);
            }
            else {
                // If getting details failed, use original data
                setSelectedItem(item);
                console.warn('[GeoModel] Failed to load detail, using original item');
                // Use original data to generate code
                const initialCode = activeTab === 'model'
                    ? (0,_utils_codeGenerator__WEBPACK_IMPORTED_MODULE_5__.generateModelCode)(item, {})
                    : (0,_utils_codeGenerator__WEBPACK_IMPORTED_MODULE_5__.generateDataMethodCode)(item, {});
                setGeneratedCode(initialCode);
            }
        }
        catch (error) {
            console.error('Failed to load item detail:', error);
            setSelectedItem(item);
            // Generate basic code even on error
            const initialCode = activeTab === 'model'
                ? (0,_utils_codeGenerator__WEBPACK_IMPORTED_MODULE_5__.generateModelCode)(item, {})
                : (0,_utils_codeGenerator__WEBPACK_IMPORTED_MODULE_5__.generateDataMethodCode)(item, {});
            setGeneratedCode(initialCode);
        }
        finally {
            setLoadingDetail(false);
        }
    };
    // Back to list
    const handleBack = () => {
        setSelectedItem(null);
        setParamValues({});
        setGeneratedCode('');
    };
    // Parameter value change
    const handleParamChange = (name, value) => {
        const newValues = { ...paramValues, [name]: value };
        setParamValues(newValues);
        // Generate code preview in realtime
        if (selectedItem) {
            const code = activeTab === 'model'
                ? (0,_utils_codeGenerator__WEBPACK_IMPORTED_MODULE_5__.generateModelCode)(selectedItem, newValues)
                : (0,_utils_codeGenerator__WEBPACK_IMPORTED_MODULE_5__.generateDataMethodCode)(selectedItem, newValues);
            setGeneratedCode(code);
        }
    };
    // Insert code into Notebook
    const handleInsertCode = async () => {
        var _a, _b;
        const notebook = notebookTracker.currentWidget;
        if (!notebook || !generatedCode) {
            alert('Please open a Notebook and generate code first');
            return;
        }
        const notebookModel = notebook.content.model;
        if (!notebookModel) {
            return;
        }
        // If data method, first create dependency.py file
        if (activeTab === 'datamethod') {
            try {
                // Generate dependency.py content and convert to base64
                const dependencyContent = (0,_utils_codeGenerator__WEBPACK_IMPORTED_MODULE_5__.generateDependencyFile)();
                const base64Content = btoa(unescape(encodeURIComponent(dependencyContent)));
                // Use base64 decode to avoid quote escaping issues
                await ((_b = (_a = notebook.context.sessionContext.session) === null || _a === void 0 ? void 0 : _a.kernel) === null || _b === void 0 ? void 0 : _b.requestExecute({
                    code: `
# Auto-create dependency.py helper file
import base64
_dep_b64 = "${base64Content}"
_dep_content = base64.b64decode(_dep_b64).decode('utf-8')
with open('dependency.py', 'w', encoding='utf-8') as f:
    f.write(_dep_content)
print('✓ dependency.py created/updated')
del _dep_b64, _dep_content
`
                }).done);
                console.log('[GeoModel] dependency.py created/updated');
            }
            catch (error) {
                console.error('Failed to create dependency.py:', error);
                // Continue inserting code even if creating dependency file failed
            }
        }
        // Get current active cell index
        const activeCellIndex = notebook.content.activeCellIndex;
        // Create new code cell
        const cellModel = notebookModel.sharedModel.insertCell(activeCellIndex + 1, {
            cell_type: 'code',
            source: generatedCode
        });
        // Activate newly inserted cell
        notebook.content.activeCellIndex = activeCellIndex + 1;
        console.log('Code inserted successfully!');
    };
    return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-panel" },
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-header" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("h2", null, "OpenGeoLab"),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", null, "Model & Data Method Browser")),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-tabs" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: `tab-btn ${activeTab === 'model' ? 'active' : ''}`, onClick: () => { setActiveTab('model'); setSelectedItem(null); } }, "Model"),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: `tab-btn ${activeTab === 'datamethod' ? 'active' : ''}`, onClick: () => { setActiveTab('datamethod'); setSelectedItem(null); } }, "Data Method")),
        !selectedItem ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null,
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-source" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("label", null,
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("input", { type: "radio", name: "source", value: "all", checked: source === 'all', onChange: () => setSource('all') }),
                    "All"),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("label", null,
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("input", { type: "radio", name: "source", value: "personal", checked: source === 'personal', onChange: () => setSource('personal') }),
                    "My Favorites")),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-search" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("input", { type: "text", placeholder: `Search ${activeTab === 'model' ? 'models' : 'data methods'}...`, value: searchQuery, onChange: (e) => setSearchQuery(e.target.value) }),
                searchQuery && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "search-clear", onClick: () => setSearchQuery(''), title: "Clear search" }, "\u00D7"))),
            !loading && source === 'all' && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-results-info" }, searchQuery ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null,
                "Found ",
                totalItems,
                " ",
                activeTab === 'model' ? 'models' : 'data methods',
                " for \"",
                searchQuery,
                "\"")) : (react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null,
                "Total: ",
                totalItems,
                " ",
                activeTab === 'model' ? 'models' : 'data methods')))),
            authWarning && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-auth-warning" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", null, "Not logged in, cannot view favorites"),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", { className: "auth-hint" }, "Please reopen Jupyter from OpenGeoLab to authenticate"))),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement(_ModelBrowser__WEBPACK_IMPORTED_MODULE_1__.ModelBrowser, { items: items, loading: loading, onSelect: handleSelectItem, type: activeTab }),
            !loading && totalPages > 1 && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-pagination" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "page-btn", onClick: () => setCurrentPage(1), disabled: currentPage === 1, title: "First page" }, "\u00AB"),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "page-btn", onClick: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: currentPage === 1 }, "\u2039 Prev"),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "page-info" },
                    "Page ",
                    currentPage,
                    " / ",
                    totalPages),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "page-btn", onClick: () => setCurrentPage(p => Math.min(totalPages, p + 1)), disabled: currentPage === totalPages }, "Next \u203A"),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "page-btn", onClick: () => setCurrentPage(totalPages), disabled: currentPage === totalPages, title: "Last page" }, "\u00BB"))))) : (react__WEBPACK_IMPORTED_MODULE_0__.createElement(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null,
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-back" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { onClick: handleBack }, "\u2190 Back to List"),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "item-name" }, selectedItem.name)),
            loadingDetail ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-loading" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "spinner" }),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", null, "Loading parameter info..."))) : (react__WEBPACK_IMPORTED_MODULE_0__.createElement(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null,
                react__WEBPACK_IMPORTED_MODULE_0__.createElement(_ParameterForm__WEBPACK_IMPORTED_MODULE_2__.ParameterForm, { item: selectedItem, values: paramValues, onChange: handleParamChange }),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement(_CodePreview__WEBPACK_IMPORTED_MODULE_3__.CodePreview, { code: generatedCode }),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-actions" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "insert-btn", onClick: handleInsertCode, disabled: !generatedCode }, "Insert Code"))))))));
};


/***/ }),

/***/ "./lib/components/LLMSettings.js":
/*!***************************************!*\
  !*** ./lib/components/LLMSettings.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LLMSettings: () => (/* binding */ LLMSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _services_agentApi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../services/agentApi */ "./lib/services/agentApi.js");
/**
 * LLM Settings Panel
 * Configure LLM API for the assistant
 */



const LLMSettings = ({ onClose, onSaved }) => {
    const [providers, setProviders] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)({});
    const [config, setConfig] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)({
        provider: 'openai',
        apiKey: '',
        baseUrl: '',
        model: 'gpt-4o-mini'
    });
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
    const [saving, setSaving] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const [testing, setTesting] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const [message, setMessage] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    // Load configuration
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
        loadData();
    }, []);
    const loadData = async () => {
        try {
            const [providersData, configData] = await Promise.all([
                _services_agentApi__WEBPACK_IMPORTED_MODULE_1__.agentApi.getProviders(),
                _services_agentApi__WEBPACK_IMPORTED_MODULE_1__.agentApi.getConfig()
            ]);
            setProviders(providersData);
            setConfig(configData);
        }
        catch (error) {
            console.error('Failed to load LLM config:', error);
            setMessage({ type: 'error', text: 'Failed to load configuration' });
        }
        finally {
            setLoading(false);
        }
    };
    // Auto-fill defaults when provider changes
    const handleProviderChange = (provider) => {
        const providerInfo = providers[provider];
        setConfig(prev => ({
            ...prev,
            provider,
            baseUrl: (providerInfo === null || providerInfo === void 0 ? void 0 : providerInfo.baseUrl) || '',
            model: (providerInfo === null || providerInfo === void 0 ? void 0 : providerInfo.defaultModel) || '',
            // Keep the existing API key
            apiKey: prev.apiKey
        }));
    };
    // Save configuration
    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await _services_agentApi__WEBPACK_IMPORTED_MODULE_1__.agentApi.saveConfig(config);
            setMessage({ type: 'success', text: 'Configuration saved' });
            onSaved === null || onSaved === void 0 ? void 0 : onSaved();
        }
        catch (error) {
            setMessage({ type: 'error', text: 'Failed to save configuration' });
        }
        finally {
            setSaving(false);
        }
    };
    // Test connection
    const handleTest = async () => {
        setTesting(true);
        setMessage(null);
        try {
            // Save first to keep backend/runtime in sync
            await _services_agentApi__WEBPACK_IMPORTED_MODULE_1__.agentApi.saveConfig(config);
            // Then test
            const result = await _services_agentApi__WEBPACK_IMPORTED_MODULE_1__.agentApi.testConnection();
            setMessage({ type: 'success', text: `Connection successful. Model: ${result.model || 'unknown'}` });
        }
        catch (error) {
            setMessage({ type: 'error', text: error.message || 'Connection test failed' });
        }
        finally {
            setTesting(false);
        }
    };
    const currentProvider = providers[config.provider || 'openai'];
    if (loading) {
        return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "llm-settings-panel" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "loading" }, "Loading...")));
    }
    return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "llm-settings-panel" },
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "settings-header" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("h3", null, "\uD83E\uDD16 LLM Configuration"),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "close-btn", onClick: onClose }, "\u2715")),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "settings-content" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "form-group" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("label", null, "LLM Provider"),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("select", { value: config.provider, onChange: (e) => handleProviderChange(e.target.value) }, Object.entries(providers).map(([key, provider]) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("option", { key: key, value: key }, provider.name))))),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "form-group" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("label", null, "API Base URL"),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("input", { type: "text", value: config.baseUrl, onChange: (e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value })), placeholder: (currentProvider === null || currentProvider === void 0 ? void 0 : currentProvider.baseUrl) || 'https://api.openai.com/v1' }),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("small", null, "Leave empty to use the provider default")),
            !(currentProvider === null || currentProvider === void 0 ? void 0 : currentProvider.noApiKey) && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "form-group" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("label", null, "API Key"),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("input", { type: "password", value: config.apiKey, onChange: (e) => setConfig(prev => ({ ...prev, apiKey: e.target.value })), placeholder: config.hasApiKey ? '***Configured*** (keep empty to reuse)' : 'Enter API key' }))),
            message && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: `message ${message.type}` },
                message.type === 'success' ? '✓' : '✕',
                " ",
                message.text)),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "button-group" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "btn-secondary", onClick: handleTest, disabled: testing || saving }, testing ? 'Testing...' : '🔗 Test Connection'),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "btn-primary", onClick: handleSave, disabled: saving || testing }, saving ? 'Saving...' : '💾 Save Configuration'))),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("style", null, `
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
            `)));
};


/***/ }),

/***/ "./lib/components/ModelBrowser.js":
/*!****************************************!*\
  !*** ./lib/components/ModelBrowser.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ModelBrowser: () => (/* binding */ ModelBrowser)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/**
 * Model/Data Method Browser Component
 */

const ModelBrowser = ({ items, loading, onSelect, type }) => {
    if (loading) {
        return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-loading" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "spinner" }),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", null, "Loading...")));
    }
    if (items.length === 0) {
        return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-empty" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", null,
                "No ",
                type === 'model' ? 'models' : 'data methods',
                " found")));
    }
    return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-list" }, items.map((item) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { key: item.id, className: "geomodel-item", onClick: () => onSelect(item) },
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "item-icon" }, type === 'model' ? 'M' : 'D'),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "item-info" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("h4", { className: "item-name" }, item.name),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", { className: "item-desc" }, item.description || 'No description available'),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "item-author" }, item.author || 'OpenGeoLab')),
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "item-arrow" }, "\u203A"))))));
};


/***/ }),

/***/ "./lib/components/ParameterForm.js":
/*!*****************************************!*\
  !*** ./lib/components/ParameterForm.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ParameterForm: () => (/* binding */ ParameterForm)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _services_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../services/api */ "./lib/services/api.js");
/**
 * Parameter Form Component - Dynamically generate forms based on model/method parameter definitions
 */


const ParameterForm = ({ item, values, onChange }) => {
    // Get parameter list
    const parameters = item.parameters || [];
    // File browser state
    const [showFileBrowser, setShowFileBrowser] = react__WEBPACK_IMPORTED_MODULE_0__.useState(false);
    const [browserFiles, setBrowserFiles] = react__WEBPACK_IMPORTED_MODULE_0__.useState([]);
    const [browserLoading, setBrowserLoading] = react__WEBPACK_IMPORTED_MODULE_0__.useState(false);
    const [activeParamName, setActiveParamName] = react__WEBPACK_IMPORTED_MODULE_0__.useState('');
    if (parameters.length === 0) {
        return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-form" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "form-notice" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", null,
                    "This ",
                    item.type === 'model' ? 'model' : 'data method',
                    " requires no input parameters"))));
    }
    // Render single parameter input control
    const renderInput = (param) => {
        var _a, _b, _c, _d;
        const value = (_c = (_b = (_a = values[param.name]) !== null && _a !== void 0 ? _a : param.defaultValue) !== null && _b !== void 0 ? _b : param.default) !== null && _c !== void 0 ? _c : '';
        switch (param.type) {
            case 'file':
                return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "file-input-wrapper" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("input", { type: "text", placeholder: "Enter file path...", value: value, onChange: (e) => onChange(param.name, e.target.value) }),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "browse-btn", onClick: () => handleFileBrowse(param.name) }, "Browse...")));
            case 'select':
                return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("select", { value: value, onChange: (e) => onChange(param.name, e.target.value) },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("option", { value: "" }, "-- Please select --"), (_d = param.options) === null || _d === void 0 ? void 0 :
                    _d.map((opt) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("option", { key: String(opt.value), value: opt.value }, opt.label)))));
            case 'number':
                return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("input", { type: "number", value: value, min: param.min, max: param.max, step: param.step || 1, onChange: (e) => onChange(param.name, parseFloat(e.target.value)) }));
            case 'boolean':
                return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("label", { className: "checkbox-wrapper" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("input", { type: "checkbox", checked: !!value, onChange: (e) => onChange(param.name, e.target.checked) }),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", null, param.label || param.name)));
            case 'textarea':
                return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("textarea", { value: value, rows: 4, placeholder: param.placeholder || '', onChange: (e) => onChange(param.name, e.target.value) }));
            default:
                return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("input", { type: "text", value: value, placeholder: param.placeholder || '', onChange: (e) => onChange(param.name, e.target.value) }));
        }
    };
    // Open file browser - select from Jupyter working directory
    const handleFileBrowse = async (paramName) => {
        setActiveParamName(paramName);
        setBrowserLoading(true);
        setShowFileBrowser(true);
        try {
            const files = await (0,_services_api__WEBPACK_IMPORTED_MODULE_1__.fetchJupyterFiles)();
            // Filter to show only files, not folders or notebooks
            const dataFiles = files.filter((f) => f.type === 'file');
            setBrowserFiles(dataFiles);
        }
        catch (e) {
            console.error('Error fetching files:', e);
            setBrowserFiles([]);
        }
        finally {
            setBrowserLoading(false);
        }
    };
    // Select file
    const handleFileSelect = (fileName) => {
        onChange(activeParamName, `./${fileName}`);
        setShowFileBrowser(false);
        setActiveParamName('');
    };
    // Close file browser
    const handleCloseBrowser = () => {
        setShowFileBrowser(false);
        setActiveParamName('');
    };
    // Refresh file list
    const handleRefreshFiles = async () => {
        setBrowserLoading(true);
        try {
            const files = await (0,_services_api__WEBPACK_IMPORTED_MODULE_1__.fetchJupyterFiles)();
            const dataFiles = files.filter((f) => f.type === 'file');
            setBrowserFiles(dataFiles);
        }
        catch (e) {
            console.error('Error refreshing files:', e);
        }
        finally {
            setBrowserLoading(false);
        }
    };
    // Render file browser modal
    const renderFileBrowser = () => {
        if (!showFileBrowser)
            return null;
        return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "file-browser-overlay" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "file-browser-modal" },
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "file-browser-header" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("h4", null, "Select File (Working Directory)"),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "header-actions" },
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "refresh-btn", onClick: handleRefreshFiles, disabled: browserLoading, title: "Refresh file list" }, "\uD83D\uDD04"),
                        react__WEBPACK_IMPORTED_MODULE_0__.createElement("button", { className: "close-btn", onClick: handleCloseBrowser }, "\u00D7"))),
                react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "file-browser-content" }, browserLoading ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "loading" }, "Loading...")) : browserFiles.length === 0 ? (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "empty-notice" },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", null, "No data files in working directory"),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", { className: "hint" }, "Please upload files via Jupyter file browser first"))) : (react__WEBPACK_IMPORTED_MODULE_0__.createElement("ul", { className: "file-list" }, browserFiles.map((file) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("li", { key: file.name, className: "file-item", onClick: () => handleFileSelect(file.name) },
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "file-icon" }, "\uD83D\uDCC4"),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "file-name" }, file.name),
                    react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "file-size" }, formatFileSize(file.size)))))))))));
    };
    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes < 1024)
            return bytes + ' B';
        if (bytes < 1024 * 1024)
            return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };
    return (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { className: "geomodel-form" },
        react__WEBPACK_IMPORTED_MODULE_0__.createElement("h3", null, "Parameter Settings"),
        parameters.map((param) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("div", { key: param.name, className: "form-group" },
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("label", null,
                param.label || param.name,
                param.required && react__WEBPACK_IMPORTED_MODULE_0__.createElement("span", { className: "required" }, "*")),
            param.description && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", { className: "param-desc" }, param.description)),
            renderInput(param)))),
        renderFileBrowser()));
};


/***/ }),

/***/ "./lib/index.js":
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _jupyterlab_application__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/application */ "webpack/sharing/consume/default/@jupyterlab/application");
/* harmony import */ var _jupyterlab_application__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_application__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/notebook */ "webpack/sharing/consume/default/@jupyterlab/notebook");
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @jupyterlab/ui-components */ "webpack/sharing/consume/default/@jupyterlab/ui-components");
/* harmony import */ var _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _widget__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./widget */ "./lib/widget.js");
/* harmony import */ var _agentWidget__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./agentWidget */ "./lib/agentWidget.js");
/**
 * JupyterLab GeoModel Extension
 *
 * Main entry file - Register extension and sidebar panels
 * - Left sidebar: AI Agent Panel
 * - Right sidebar: GeoModel Tools Panel
 */





// GeoModel icon SVG
const geoModelIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
</svg>`;
// AI Agent icon SVG
const agentIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5z"/>
</svg>`;
const geoModelIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_2__.LabIcon({
    name: 'geomodel:icon',
    svgstr: geoModelIconSvg
});
const agentIcon = new _jupyterlab_ui_components__WEBPACK_IMPORTED_MODULE_2__.LabIcon({
    name: 'geomodel:agent-icon',
    svgstr: agentIconSvg
});
/**
 * Extension ID
 */
const EXTENSION_ID = 'jupyterlab-geomodel:plugin';
/**
 * Command IDs
 */
const CommandIds = {
    openTools: 'geomodel:open-tools',
    openAgent: 'geomodel:open-agent'
};
/**
 * Main plugin definition
 */
const plugin = {
    id: EXTENSION_ID,
    autoStart: true,
    requires: [_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.INotebookTracker],
    optional: [_jupyterlab_application__WEBPACK_IMPORTED_MODULE_0__.ILayoutRestorer],
    activate: (app, notebookTracker, restorer) => {
        console.log('JupyterLab GeoModel extension is activated!');
        // ==================== Right Sidebar: GeoModel Tools ====================
        const toolsWidget = new _widget__WEBPACK_IMPORTED_MODULE_3__.GeoModelWidget(notebookTracker);
        toolsWidget.id = 'geomodel-sidebar';
        toolsWidget.title.icon = geoModelIcon;
        toolsWidget.title.caption = 'OpenGeoLab';
        // Add to right sidebar
        app.shell.add(toolsWidget, 'right', { rank: 100 });
        // Register tools panel command
        app.commands.addCommand(CommandIds.openTools, {
            label: 'OpenGeoLab Panel',
            icon: geoModelIcon,
            execute: () => {
                app.shell.activateById(toolsWidget.id);
            }
        });
        // ==================== Left Sidebar: AI Agent ====================
        const agentWidget = new _agentWidget__WEBPACK_IMPORTED_MODULE_4__.AgentWidget(notebookTracker, app);
        agentWidget.id = 'geomodel-agent';
        agentWidget.title.icon = agentIcon;
        agentWidget.title.caption = 'OpenGeoLab AI Agent';
        // Add to left sidebar
        app.shell.add(agentWidget, 'left', { rank: 200 });
        // Register agent panel command
        app.commands.addCommand(CommandIds.openAgent, {
            label: 'OpenGeoLab AI Agent',
            icon: agentIcon,
            execute: () => {
                app.shell.activateById(agentWidget.id);
            }
        });
        // ==================== Restorer ====================
        if (restorer) {
            restorer.add(toolsWidget, 'geomodel-sidebar');
            restorer.add(agentWidget, 'geomodel-agent');
        }
        console.log('OpenGeoLab: Tools panel added to right sidebar');
        console.log('OpenGeoLab: AI Agent panel added to left sidebar');
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (plugin);


/***/ }),

/***/ "./lib/services/agentApi.js":
/*!**********************************!*\
  !*** ./lib/services/agentApi.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   addMessageToConversation: () => (/* binding */ addMessageToConversation),
/* harmony export */   agentApi: () => (/* binding */ agentApi),
/* harmony export */   askDirect: () => (/* binding */ askDirect),
/* harmony export */   chat: () => (/* binding */ chat),
/* harmony export */   chatWithHistory: () => (/* binding */ chatWithHistory),
/* harmony export */   createConversation: () => (/* binding */ createConversation),
/* harmony export */   deleteConversation: () => (/* binding */ deleteConversation),
/* harmony export */   deleteSession: () => (/* binding */ deleteSession),
/* harmony export */   getCases: () => (/* binding */ getCases),
/* harmony export */   getConfig: () => (/* binding */ getConfig),
/* harmony export */   getConversation: () => (/* binding */ getConversation),
/* harmony export */   getProviders: () => (/* binding */ getProviders),
/* harmony export */   getSession: () => (/* binding */ getSession),
/* harmony export */   getTools: () => (/* binding */ getTools),
/* harmony export */   listConversations: () => (/* binding */ listConversations),
/* harmony export */   saveConfig: () => (/* binding */ saveConfig),
/* harmony export */   scanWorkspace: () => (/* binding */ scanWorkspace),
/* harmony export */   searchConversations: () => (/* binding */ searchConversations),
/* harmony export */   submitToolResult: () => (/* binding */ submitToolResult),
/* harmony export */   submitToolResults: () => (/* binding */ submitToolResults),
/* harmony export */   testConnection: () => (/* binding */ testConnection),
/* harmony export */   updateConversationTitle: () => (/* binding */ updateConversationTitle)
/* harmony export */ });
/**
 * Agent API Service
 * 处理与后端 Agent 服务的通信
 */
const API_BASE = '/api/agent';
/**
 * 获取认证 token
 */
function getToken() {
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
function getAuthHeaders() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}
/**
 * 获取 API 基础 URL
 */
function getApiBase() {
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
async function getProviders() {
    const response = await fetch(`${getApiBase()}${API_BASE}/providers`, {
        headers: getAuthHeaders()
    });
    if (!response.ok) {
        throw new Error('Failed to load provider list');
    }
    const data = await response.json();
    return data.providers;
}
/**
 * 获取当前用户的 LLM 配置
 */
async function getConfig() {
    const response = await fetch(`${getApiBase()}${API_BASE}/config`, {
        headers: getAuthHeaders()
    });
    if (!response.ok) {
        throw new Error('Failed to load configuration');
    }
    const data = await response.json();
    return data.config;
}
/**
 * 保存 LLM 配置
 */
async function saveConfig(config) {
    const response = await fetch(`${getApiBase()}${API_BASE}/config`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify(config)
    });
    if (!response.ok) {
        throw new Error('Failed to save configuration');
    }
}
/**
 * 测试 LLM 连接
 */
async function testConnection() {
    const response = await fetch(`${getApiBase()}${API_BASE}/test`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        }
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Connection test failed');
    }
    return data;
}
/**
 * 从容器名称或 URL 参数中提取用户和项目信息
 * URL 参数优先: user, project, container
 * 容器名格式: jupyter-{userName}-{projectName}
 * 目录格式: jupyter-data/{UserName}/{ProjectName}
 */
async function extractContainerInfo() {
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
            }
            catch (e) {
                console.log('[AgentAPI] Failed to query container by port:', e);
            }
        }
    }
    return null;
}
/**
 * 扫描用户工作目录中的数据文件
 */
async function scanWorkspace(projectName) {
    var _a, _b, _c, _d;
    try {
        // 首先尝试从容器信息中获取用户和项目名（现在是异步的）
        const containerInfo = await extractContainerInfo();
        // 获取用户信息（作为后备）
        const userInfo = getUserInfo();
        // 确定最终使用的用户名和项目名
        let finalUserName = (containerInfo === null || containerInfo === void 0 ? void 0 : containerInfo.userName) || userInfo.userName;
        let finalProjectName = (containerInfo === null || containerInfo === void 0 ? void 0 : containerInfo.projectName) || projectName || '';
        console.log('[AgentAPI] Scanning workspace:', {
            containerInfo,
            userInfo,
            finalUserName,
            finalProjectName
        });
        // 构建 headers，只添加非空值
        const headers = {
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
        const containerName = (urlParams === null || urlParams === void 0 ? void 0 : urlParams.get('container')) || '';
        const response = await fetch(`${getApiBase()}${API_BASE}/scan-workspace`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                userId: userInfo.userId,
                userName: finalUserName,
                projectName: finalProjectName,
                containerName: containerName // 传递容器名称给后端
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
            vector: ((_a = data.grouped) === null || _a === void 0 ? void 0 : _a.vector) || [],
            raster: ((_b = data.grouped) === null || _b === void 0 ? void 0 : _b.raster) || [],
            table: ((_c = data.grouped) === null || _c === void 0 ? void 0 : _c.table) || [],
            other: ((_d = data.grouped) === null || _d === void 0 ? void 0 : _d.other) || []
        };
    }
    catch (e) {
        console.warn('[AgentAPI] Workspace scan error:', e);
        return { totalFiles: 0, vector: [], raster: [], table: [], other: [] };
    }
}
/**
 * 获取用户信息
 */
function getUserInfo() {
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
            }
            catch (e) {
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
            }
            catch (e) {
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
                }
                catch (e) {
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
async function* chat(message, sessionId, context) {
    var _a;
    const url = `${getApiBase()}${API_BASE}/chat`;
    const containerInfo = await extractContainerInfo();
    const mergedContext = {
        ...(context || {}),
        projectName: (context === null || context === void 0 ? void 0 : context.projectName) || (containerInfo === null || containerInfo === void 0 ? void 0 : containerInfo.projectName) || '',
        userName: (context === null || context === void 0 ? void 0 : context.userName) || (containerInfo === null || containerInfo === void 0 ? void 0 : containerInfo.userName) || ''
    };
    const requestBody = {
        message,
        sessionId,
        context: mergedContext
    };
    if (containerInfo) {
        requestBody.userName = containerInfo.userName;
        requestBody.projectName = containerInfo.projectName;
    }
    console.log('[AgentAPI] chat URL:', url);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify(requestBody)
    });
    console.log('[AgentAPI] chat response status:', response.status);
    if (!response.ok) {
        let errorMsg = 'Request failed';
        try {
            const error = await response.json();
            if (error.needConfig) {
                yield { type: 'error', error: 'Please configure LLM API first' };
                return;
            }
            errorMsg = error.error || errorMsg;
        }
        catch (e) {
            console.error('[AgentAPI] Failed to parse error:', e);
        }
        throw new Error(errorMsg);
    }
    const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
    if (!reader) {
        throw new Error('无法读取响应流');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    yield data;
                }
                catch (e) {
                    // 忽略解析错误
                }
            }
        }
    }
}
/**
 * 获取可用的 Agent 工具列表
 */
async function getTools() {
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
 * Get curated smart cases for autonomous workflows
 */
async function getCases() {
    const response = await fetch(`${getApiBase()}${API_BASE}/cases`, {
        headers: getAuthHeaders()
    });
    if (!response.ok) {
        throw new Error('Failed to fetch agent cases');
    }
    const data = await response.json();
    return data.cases || [];
}
/**
 * 提交工具执行结果（流式响应，用于 Agent 循环）
 */
async function* submitToolResults(sessionId, toolResults) {
    var _a;
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
            }
            catch (e) {
                console.error('[AgentAPI] Failed to parse error response:', e);
            }
            yield { type: 'error', error: errorMsg };
            return;
        }
        const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
        if (!reader) {
            throw new Error('无法读取响应流');
        }
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        yield data;
                    }
                    catch (e) {
                        console.warn('[AgentAPI] Failed to parse SSE data:', line, e);
                    }
                }
            }
        }
    }
    catch (error) {
        console.error('[AgentAPI] submitToolResults error:', error);
        yield { type: 'error', error: error.message || 'Unknown error in submitToolResults' };
    }
}
/**
 * 提交工具执行结果
 */
async function submitToolResult(sessionId, toolCallId, result) {
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
async function getSession(sessionId) {
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
async function deleteSession(sessionId) {
    const response = await fetch(`${getApiBase()}${API_BASE}/session/${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!response.ok) {
        throw new Error('删除会话失败');
    }
}
/**
 * 获取对话列表
 */
async function listConversations(userId = 'default', limit = 50, offset = 0) {
    const response = await fetch(`${getApiBase()}${API_BASE}/conversations?user_id=${userId}&limit=${limit}&offset=${offset}`, { headers: getAuthHeaders() });
    if (!response.ok) {
        throw new Error('获取对话列表失败');
    }
    return response.json();
}
/**
 * 创建新对话
 */
async function createConversation(userId = 'default', title, metadata) {
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
async function getConversation(conversationId, userId = 'default') {
    const response = await fetch(`${getApiBase()}${API_BASE}/conversations/${conversationId}?user_id=${userId}`, { headers: getAuthHeaders() });
    if (!response.ok) {
        throw new Error('获取对话详情失败');
    }
    return response.json();
}
/**
 * 更新对话标题
 */
async function updateConversationTitle(conversationId, title, userId = 'default') {
    const response = await fetch(`${getApiBase()}${API_BASE}/conversations/${conversationId}/title?user_id=${userId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ title })
    });
    if (!response.ok) {
        throw new Error('更新对话标题失败');
    }
    return response.json();
}
/**
 * 删除对话
 */
async function deleteConversation(conversationId, userId = 'default') {
    const response = await fetch(`${getApiBase()}${API_BASE}/conversations/${conversationId}?user_id=${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!response.ok) {
        throw new Error('删除对话失败');
    }
}
/**
 * 搜索对话
 */
async function searchConversations(query, userId = 'default', limit = 20) {
    const response = await fetch(`${getApiBase()}${API_BASE}/conversations/search?q=${encodeURIComponent(query)}&user_id=${userId}&limit=${limit}`, { headers: getAuthHeaders() });
    if (!response.ok) {
        throw new Error('搜索对话失败');
    }
    return response.json();
}
/**
 * 向对话添加消息
 */
async function addMessageToConversation(conversationId, role, content, userId = 'default') {
    const response = await fetch(`${getApiBase()}${API_BASE}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ role, content, user_id: userId })
    });
    if (!response.ok) {
        throw new Error('添加消息失败');
    }
    return response.json();
}
/**
 * 带历史记录的聊天（SSE 流式）
 */
async function* chatWithHistory(message, conversationId, userId = 'default', context) {
    var _a;
    const apiBase = getApiBase();
    const containerInfo = await extractContainerInfo();
    const requestBody = {
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
        const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
        if (!reader) {
            throw new Error('无法获取响应流');
        }
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    try {
                        const data = JSON.parse(line.slice(5).trim());
                        yield data;
                    }
                    catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        }
    }
    catch (error) {
        console.error('[AgentAPI] chatWithHistory error:', error);
        yield { type: 'error', error: error.message || 'Unknown error' };
    }
}
/**
 * Ask mode: 直接调用 LLM，不经过 Agent 工具循环
 */
async function* askDirect(message, history) {
    var _a;
    const url = `${getApiBase()}${API_BASE}/ask`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ message, history })
    });
    if (!response.ok) {
        let errorMsg = 'Ask request failed';
        try {
            const error = await response.json();
            errorMsg = error.error || errorMsg;
        }
        catch (e) {
            // ignore
        }
        throw new Error(errorMsg);
    }
    const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
    if (!reader) {
        throw new Error('无法读取响应流');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            if (line.startsWith('data:')) {
                try {
                    const data = JSON.parse(line.slice(5).trim());
                    yield data;
                }
                catch (e) {
                    // ignore parse errors
                }
            }
        }
    }
}
const agentApi = {
    getProviders,
    getConfig,
    saveConfig,
    testConnection,
    chat,
    chatWithHistory,
    askDirect,
    getCases,
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


/***/ }),

/***/ "./lib/services/api.js":
/*!*****************************!*\
  !*** ./lib/services/api.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fetchDataMethodDetail: () => (/* binding */ fetchDataMethodDetail),
/* harmony export */   fetchDataMethods: () => (/* binding */ fetchDataMethods),
/* harmony export */   fetchJupyterFiles: () => (/* binding */ fetchJupyterFiles),
/* harmony export */   fetchModelDetail: () => (/* binding */ fetchModelDetail),
/* harmony export */   fetchModels: () => (/* binding */ fetchModels),
/* harmony export */   fetchMyDataMethods: () => (/* binding */ fetchMyDataMethods),
/* harmony export */   fetchMyModels: () => (/* binding */ fetchMyModels),
/* harmony export */   isAuthenticated: () => (/* binding */ isAuthenticated)
/* harmony export */ });
// API Base URL - Dynamic detection
const getApiBaseUrl = () => {
    if (typeof window !== 'undefined') {
        // @ts-ignore - Allow configuration via global variable
        if (window.GEOMODEL_API_URL) {
            // @ts-ignore
            return window.GEOMODEL_API_URL;
        }
        // JupyterLab frontend runs in user's browser
        // Use the host address that accesses Jupyter (backend port 3000 on same server)
        const hostname = window.location.hostname;
        return `http://${hostname}:3000/api`;
    }
    return 'http://localhost:3000/api';
};
const API_BASE_URL = getApiBaseUrl();
console.log('[GeoModel Extension] API Base URL:', API_BASE_URL);
// Check and save JWT Token immediately on page load
if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('geomodel_token');
    if (tokenFromUrl) {
        console.log('[GeoModel Extension] Found JWT token in URL, saving to localStorage');
        localStorage.setItem('geomodel_jwt', tokenFromUrl);
        // After saving token, remove it from URL (security consideration), but keep other params
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('geomodel_token');
        window.history.replaceState({}, '', newUrl.toString());
    }
}
// Get JWT Token (from localStorage)
const getAuthToken = () => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('geomodel_jwt');
        if (!token) {
            console.warn('[GeoModel Extension] No JWT token found. Personal favorites will not be available.');
            console.warn('[GeoModel Extension] Please reopen Jupyter from OpenGeoLab to get authenticated.');
        }
        return token;
    }
    return null;
};
// Check if authenticated
const isAuthenticated = () => {
    return !!getAuthToken();
};
// Create request headers
const createHeaders = (withAuth = false) => {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (withAuth) {
        const token = getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    return headers;
};
/**
 * Parse parameters from OGMS model details
 * Parse mdlJson.ModelClass structure to get input parameters
 */
function parseModelParameters(modelDetail) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const parameters = [];
    try {
        const mdlJson = modelDetail.mdlJson || modelDetail.mdl;
        if (!mdlJson) {
            console.log('[GeoModel] No mdlJson found in model detail');
            return parameters;
        }
        // Parse ModelClass -> Behavior -> StateGroup -> States -> State -> Event
        const modelClasses = mdlJson.ModelClass || [];
        const relatedDatasets = ((_f = (_e = (_d = (_c = (_b = (_a = mdlJson.ModelClass) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.Behavior) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.RelatedDatasets) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.DatasetItem) || [];
        for (const modelClass of modelClasses) {
            const behaviors = modelClass.Behavior || [];
            for (const behavior of behaviors) {
                const stateGroups = behavior.StateGroup || [];
                for (const stateGroup of stateGroups) {
                    const states = stateGroup.States || [];
                    for (const statesItem of states) {
                        const stateList = statesItem.State || [];
                        for (const state of stateList) {
                            const stateName = state.name || '';
                            const events = state.Event || [];
                            for (const event of events) {
                                // Only handle response type (input parameters)
                                if (event.type === 'response') {
                                    const eventName = event.name || '';
                                    const description = event.description || '';
                                    const optional = event.optional !== 'False';
                                    // Check if there is a related dataset definition
                                    const responseParams = event.ResponseParameter || [];
                                    for (const param of responseParams) {
                                        const datasetRef = param.datasetReference;
                                        const dataset = relatedDatasets.find((d) => d.name === datasetRef);
                                        // Check if has UdxDeclaration (numeric parameter)
                                        if (dataset === null || dataset === void 0 ? void 0 : dataset.UdxDeclaration) {
                                            const udxNodes = ((_j = (_h = (_g = dataset.UdxDeclaration[0]) === null || _g === void 0 ? void 0 : _g.UdxNode) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.UdxNode) || [];
                                            for (const node of udxNodes) {
                                                parameters.push({
                                                    name: `${stateName}.${eventName}.${node.name}`,
                                                    label: node.name,
                                                    type: ((_k = node.type) === null || _k === void 0 ? void 0 : _k.includes('INT')) ? 'number' :
                                                        ((_l = node.type) === null || _l === void 0 ? void 0 : _l.includes('REAL')) ? 'number' : 'string',
                                                    description: node.description || `${stateName} - ${eventName}`,
                                                    required: !optional
                                                });
                                            }
                                        }
                                        else {
                                            // File type parameter
                                            parameters.push({
                                                name: `${stateName}.${eventName}`,
                                                label: eventName,
                                                type: 'file',
                                                description: description || `${stateName} - ${eventName}`,
                                                required: !optional
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        console.log(`[GeoModel] Parsed ${parameters.length} parameters from model`);
    }
    catch (e) {
        console.error('Error parsing model parameters:', e);
    }
    return parameters;
}
/**
 * Parse parameters from data method details
 * Data method parameters are in the params array, each parameter has:
 * - Name: Parameter name
 * - Type: DataInput/DataOutput/ParamInput
 * - Flags: Command line parameter flags
 * - Optional: Whether optional
 * - Description: Description
 * - default_value: Default value
 * - parameter_type: Parameter type specification
 *
 * parameter_type possible values:
 * - "Boolean": Boolean value
 * - "Integer": Integer
 * - "Float": Float
 * - "String": String
 * - "StringOrNumber": String or number
 * - "Directory": Directory path
 * - { "ExistingFile": "Raster" }: Raster file input
 * - { "ExistingFile": "Csv" }: CSV file input
 * - { "ExistingFile": "Lidar" }: LiDAR file input
 * - { "ExistingFile": { "Vector": "Point"|"Line"|"Polygon"|"Any" } }: Vector file input
 * - { "ExistingFile": { "RasterAndVector": "Point"|"Line"|"Polygon"|"Any" } }: Raster or vector input
 * - { "ExistingFile": "Text" }: Text file input
 * - { "ExistingFileOrFloat": "Raster"|"Csv"|... }: File or float input
 * - { "FileList": "Raster"|... }: Multiple file input
 * - { "NewFile": "Raster"|"Html"|"Csv"|... }: Output file
 * - { "OptionList": ["opt1", "opt2"] }: Enum options
 * - { "VectorAttributeField": ["Number", "--input"] }: Vector attribute field
 */
function parseDataMethodParameters(methodDetail) {
    const parameters = [];
    try {
        // Data method parameters are in the params array
        if (methodDetail.params && Array.isArray(methodDetail.params)) {
            methodDetail.params.forEach((param) => {
                // Get parameter flags (for command line)
                const flags = param.Flags || [];
                const flagName = flags.length > 0 ? flags[flags.length - 1].replace(/^-+/, '') : param.Name;
                // Determine parameter type
                let paramType = 'string';
                let options;
                let placeholder;
                const pType = param.parameter_type;
                const dataType = param.Type; // DataInput/DataOutput/ParamInput
                // Determine parameter type based on Type and parameter_type
                if (dataType === 'DataInput' || dataType === 'DataOutput') {
                    paramType = 'file';
                    // Set placeholder based on parameter_type
                    if (pType && typeof pType === 'object') {
                        if (pType.ExistingFile) {
                            const fileType = pType.ExistingFile;
                            if (fileType === 'Raster') {
                                placeholder = 'Raster file (.tif, .tiff)';
                            }
                            else if (fileType === 'Csv') {
                                placeholder = 'CSV file (.csv)';
                            }
                            else if (fileType === 'Lidar') {
                                placeholder = 'LiDAR file (.zlidar, .las)';
                            }
                            else if (fileType === 'Text') {
                                placeholder = 'Text file (.txt)';
                            }
                            else if (typeof fileType === 'object') {
                                if (fileType.Vector) {
                                    placeholder = `Vector file (.shp) - ${fileType.Vector}`;
                                }
                                else if (fileType.RasterAndVector) {
                                    placeholder = `Raster or vector file - ${fileType.RasterAndVector}`;
                                }
                            }
                        }
                        else if (pType.NewFile) {
                            const outType = pType.NewFile;
                            placeholder = `Output filename (${outType})`;
                        }
                        else if (pType.FileList) {
                            placeholder = 'Multiple file paths (comma separated)';
                        }
                        else if (pType.ExistingFileOrFloat) {
                            placeholder = 'File path or float number';
                        }
                    }
                }
                else if (pType === 'Boolean') {
                    paramType = 'boolean';
                }
                else if (pType === 'Integer') {
                    paramType = 'number';
                    placeholder = 'Integer';
                }
                else if (pType === 'Float') {
                    paramType = 'number';
                    placeholder = 'Float';
                }
                else if (pType === 'String') {
                    paramType = 'string';
                }
                else if (pType === 'StringOrNumber') {
                    paramType = 'string';
                    placeholder = 'String or number';
                }
                else if (pType === 'Directory') {
                    paramType = 'string';
                    placeholder = 'Directory path';
                }
                else if (pType && typeof pType === 'object') {
                    if (pType.OptionList && Array.isArray(pType.OptionList)) {
                        paramType = 'select';
                        options = pType.OptionList.map((opt) => ({ label: opt, value: opt }));
                    }
                    else if (pType.VectorAttributeField) {
                        paramType = 'string';
                        placeholder = 'Vector attribute field name';
                    }
                }
                parameters.push({
                    name: flagName,
                    label: param.Name,
                    type: paramType,
                    description: param.Description || '',
                    required: param.Optional === false,
                    defaultValue: param.default_value,
                    options: options,
                    placeholder: placeholder
                });
            });
        }
        console.log(`[GeoModel] Parsed ${parameters.length} parameters from datamethod:`, parameters);
    }
    catch (e) {
        console.error('Error parsing data method parameters:', e);
    }
    return parameters;
}
/**
 * Fetch all models list with pagination
 */
async function fetchModels(query = '', page = 1, limit = 20) {
    try {
        const url = `${API_BASE_URL}/ogms/models?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`;
        console.log('[GeoModel] Fetching models from:', url);
        const response = await fetch(url, {
            method: 'GET',
            headers: createHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status}`);
        }
        const result = await response.json();
        console.log('[GeoModel] Models response, total:', result.total);
        // Convert to unified format, use name as ID (OGMS queries by name)
        const models = (result.data || []).map((m) => ({
            id: m.name,
            name: m.name,
            description: m.description || '',
            author: m.author || 'OpenGMS',
            type: 'model'
        }));
        return {
            data: models,
            total: result.total || models.length,
            page: result.page || page,
            limit: result.limit || limit,
            totalPages: Math.ceil((result.total || models.length) / limit)
        };
    }
    catch (error) {
        console.error('Error fetching models:', error);
        return { data: [], total: 0, page: 1, limit, totalPages: 0 };
    }
}
/**
 * Fetch all data methods list with pagination
 */
async function fetchDataMethods(query = '', page = 1, limit = 20) {
    try {
        const url = `${API_BASE_URL}/datamethods?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`;
        console.log('[GeoModel] Fetching data methods from:', url);
        const response = await fetch(url, {
            method: 'GET',
            headers: createHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch data methods: ${response.status}`);
        }
        const result = await response.json();
        console.log('[GeoModel] DataMethods response, total:', result.total);
        // Convert to unified format, use name as ID
        const methods = (result.data || []).map((m) => ({
            id: m.name,
            name: m.name,
            description: m.description || '',
            author: m.author || 'Unknown',
            type: 'datamethod'
        }));
        return {
            data: methods,
            total: result.total || methods.length,
            page: result.page || page,
            limit: result.limit || limit,
            totalPages: Math.ceil((result.total || methods.length) / limit)
        };
    }
    catch (error) {
        console.error('Error fetching data methods:', error);
        return { data: [], total: 0, page: 1, limit, totalPages: 0 };
    }
}
/**
 * Fetch user's favorite models list
 */
async function fetchMyModels() {
    try {
        const url = `${API_BASE_URL}/jupyter/my-models`;
        console.log('[GeoModel] Fetching my models from:', url);
        const response = await fetch(url, {
            method: 'GET',
            headers: createHeaders(true)
        });
        if (!response.ok) {
            console.log('[GeoModel] My models fetch failed, may not be authenticated');
            return [];
        }
        const result = await response.json();
        console.log('[GeoModel] My models response:', result);
        return (result.models || []).map((m) => ({
            ...m,
            id: m.name || m.id,
            type: 'model'
        }));
    }
    catch (error) {
        console.error('Error fetching my models:', error);
        return [];
    }
}
/**
 * Fetch user's favorite data methods list
 */
async function fetchMyDataMethods() {
    try {
        const url = `${API_BASE_URL}/jupyter/my-datamethods`;
        console.log('[GeoModel] Fetching my datamethods from:', url);
        const response = await fetch(url, {
            method: 'GET',
            headers: createHeaders(true)
        });
        if (!response.ok) {
            console.log('[GeoModel] My datamethods fetch failed, may not be authenticated');
            return [];
        }
        const result = await response.json();
        console.log('[GeoModel] My datamethods response:', result);
        return (result.dataMethods || []).map((m) => ({
            ...m,
            id: m.name || m.id,
            type: 'datamethod'
        }));
    }
    catch (error) {
        console.error('Error fetching my data methods:', error);
        return [];
    }
}
/**
 * Fetch Jupyter working directory file list
 */
async function fetchJupyterFiles(subPath = '') {
    try {
        // Method 1: Use Jupyter built-in contents API to get working directory files
        // Jupyter service runs on the same domain as the current page
        const jupyterBaseUrl = window.location.origin;
        const contentsUrl = `${jupyterBaseUrl}/api/contents/${subPath}`;
        console.log('[GeoModel] Fetching files from Jupyter API:', contentsUrl);
        const response = await fetch(contentsUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            console.log('[GeoModel] Jupyter API failed, status:', response.status);
            throw new Error(`Failed to fetch files: ${response.status}`);
        }
        const result = await response.json();
        console.log('[GeoModel] Jupyter contents API response:', result);
        // Jupyter contents API returns { content: [...] } format
        if (result.content && Array.isArray(result.content)) {
            return result.content.map((item) => ({
                name: item.name,
                type: item.type === 'directory' ? 'folder' : 'file',
                size: item.size || 0
            }));
        }
        return [];
    }
    catch (error) {
        console.error('Error fetching Jupyter files:', error);
        return [];
    }
}
/**
 * Fetch model details (including parameter definitions)
 * Note: OGMS API uses model name as identifier
 */
async function fetchModelDetail(modelName) {
    try {
        // OGMS API uses name as path parameter
        const url = `${API_BASE_URL}/ogms/models/${encodeURIComponent(modelName)}`;
        console.log('[GeoModel] Fetching model detail from:', url);
        const response = await fetch(url, {
            method: 'GET',
            headers: createHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch model detail: ${response.status}`);
        }
        const modelDetail = await response.json();
        console.log('[GeoModel] Model detail received');
        // Parse parameters
        const parameters = parseModelParameters(modelDetail);
        return {
            id: modelName,
            name: modelName,
            description: modelDetail.description || '',
            author: modelDetail.author || 'OpenGMS',
            type: 'model',
            parameters,
            mdlJson: modelDetail.mdl || modelDetail.mdlJson
        };
    }
    catch (error) {
        console.error('Error fetching model detail:', error);
        return null;
    }
}
/**
 * Fetch data method details (including parameter definitions)
 */
async function fetchDataMethodDetail(methodName) {
    try {
        // Data method API uses name as path parameter
        const url = `${API_BASE_URL}/datamethods/${encodeURIComponent(methodName)}`;
        console.log('[GeoModel] Fetching datamethod detail from:', url);
        const response = await fetch(url, {
            method: 'GET',
            headers: createHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch data method detail: ${response.status}`);
        }
        const methodDetail = await response.json();
        console.log('[GeoModel] DataMethod detail received');
        // Parse parameters
        const parameters = parseDataMethodParameters(methodDetail);
        return {
            id: methodDetail.name || methodName,
            name: methodDetail.name || methodName,
            description: methodDetail.description || '',
            author: methodDetail.author || 'Unknown',
            type: 'datamethod',
            parameters,
            toolId: methodDetail.toolId
        };
    }
    catch (error) {
        console.error('Error fetching data method detail:', error);
        return null;
    }
}


/***/ }),

/***/ "./lib/utils/codeGenerator.js":
/*!************************************!*\
  !*** ./lib/utils/codeGenerator.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   generateDataMethodCode: () => (/* binding */ generateDataMethodCode),
/* harmony export */   generateDependencyFile: () => (/* binding */ generateDependencyFile),
/* harmony export */   generateModelCode: () => (/* binding */ generateModelCode),
/* harmony export */   generateQuickCode: () => (/* binding */ generateQuickCode)
/* harmony export */ });
/**
 * Get API Host Address
 * Prioritize the current browser's host address for auto-adaptation from any IP
 */
function getApiHost() {
    if (typeof window !== 'undefined' && window.location.hostname) {
        return window.location.hostname;
    }
    // Non-browser environment (e.g., Node.js) uses localhost
    return 'localhost';
}
/**
 * Generate dependency.py content - Helper function library for data methods
 */
function generateDependencyFile() {
    const hostname = getApiHost();
    const apiUrl = `http://${hostname}:3000/api`;
    return `"""
OpenGMS Data Method Helper Library
Auto-generated dependency file containing helper functions for data method calls
"""
import requests
import os
import re

# ============ Configuration ============
GEOMODEL_API = "${apiUrl}"
DATA_SERVER_URL = "http://221.224.35.86:38083/data"

# ============ Helper Functions ============

def upload_file(filepath):
    """Upload local file to relay server, return file ID"""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")
    
    with open(filepath, "rb") as f:
        files = {"file": (os.path.basename(filepath), f)}
        resp = requests.post(f"{GEOMODEL_API}/upload", files=files)
    
    result = resp.json()
    if result.get("status") == "success":
        print(f"✓ File uploaded: {filepath} -> ID: {result['id']}")
        return result["id"]
    else:
        raise Exception(f"File upload failed: {result}")


def is_uuid(s):
    """Check if string is UUID format"""
    return bool(re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", str(s), re.I))


def download_file(file_id_or_url, output_path):
    """Download file from URL or file ID to local"""
    if is_uuid(file_id_or_url):
        url = f"{DATA_SERVER_URL}/{file_id_or_url}"
    elif str(file_id_or_url).startswith("http"):
        url = file_id_or_url
    else:
        print(f"⚠ Unrecognized output format: {file_id_or_url}")
        return None
    
    print(f"Downloading: {url}")
    resp = requests.get(url)
    if resp.status_code == 200:
        with open(output_path, "wb") as f:
            f.write(resp.content)
        print(f"✓ File downloaded: {output_path} ({len(resp.content)} bytes)")
        return output_path
    else:
        raise Exception(f"File download failed: HTTP {resp.status_code}")


def run_datamethod(method_name, params):
    """
    Execute OpenGMS data method (simplified interface)
    
    Parameters:
        method_name: Data method name
        params: Parameter list, passed in order shown in interface
                - File parameters: pass local path (will be auto-uploaded)
                - Output parameters: pass desired save path
                - Other parameters: pass value directly
    
    Returns:
        dict: Contains execution status and output file paths
    
    Example:
        result = run_datamethod("AggregateRaster", [
            "./input.tif",      # Input file
            "./output.tif",     # Output file
            "2",                # Aggregation factor
            "AVG"               # Aggregation type
        ])
    """
    print(f"\\n{'='*50}")
    print(f"Executing data method: {method_name}")
    print(f"{'='*50}\\n")
    
    # 1. Get data method info
    info_resp = requests.get(f"{GEOMODEL_API}/datamethods/info/{method_name}")
    method_info = info_resp.json()
    
    if method_info.get("code") != 0:
        raise Exception(f"Failed to get data method info: {method_info}")
    
    method_data = method_info["method"]
    method_id = method_data["id"]
    param_type = method_info.get("paramType", {})
    
    print(f"Method ID: {method_id}")
    
    # 2. Get parameter key list (in API required order)
    val_keys = []
    val_keys.extend(param_type.get("FileInput", []))
    val_keys.extend(param_type.get("Output", []))
    val_keys.extend(param_type.get("ParamInput", []))
    
    file_input_keys = set(param_type.get("FileInput", []))
    output_keys = set(param_type.get("Output", []))
    
    # 3. Process parameter values
    processed_values = []
    output_files = {}  # Save output file mapping {key: local_path}
    
    for key, val in zip(val_keys, params):
        val = str(val)
        if key in file_input_keys and os.path.exists(val):
            # FileInput: Upload local file
            file_id = upload_file(val)
            processed_values.append(file_id)
        elif key in output_keys:
            # Output: Record local path, extract filename
            output_files[key] = val
            basename = os.path.basename(val)
            name_without_ext = os.path.splitext(basename)[0]
            processed_values.append(name_without_ext)
            print(f"Output param: {key} -> {name_without_ext} (save to: {val})")
        else:
            # ParamInput: Use directly
            processed_values.append(val)
    
    # 4. Build and call API
    inputs = {key: val for key, val in zip(val_keys, processed_values)}
    print(f"\\nCall params: {inputs}\\n")
    
    run_resp = requests.post(
        f"{GEOMODEL_API}/datamethods/run",
        json={"modelId": method_id, "inputs": inputs}
    )
    result = run_resp.json()
    
    # 5. Handle result
    if result.get("status") != "success":
        raise Exception(f"Execution failed: {result.get('message', result)}")
    
    print("✓ Data method executed successfully!")
    
    # 6. Download output files
    output_info = result.get("output", {})
    downloaded_files = {}
    
    if output_info:
        for key, value in output_info.items():
            file_ids = value if isinstance(value, list) else [value] if value else []
            local_path = output_files.get(key, f"output_{key}.tif")
            
            for idx, file_id in enumerate(file_ids):
                if file_id:
                    save_name = local_path
                    if len(file_ids) > 1:
                        base, ext = os.path.splitext(save_name)
                        save_name = f"{base}_{idx+1}{ext}"
                    
                    download_file(file_id, save_name)
                    downloaded_files[key] = save_name
    
    print(f"\\n{'='*50}")
    print("Execution complete!")
    print(f"{'='*50}\\n")
    
    return {
        "status": "success",
        "outputs": downloaded_files,
        "info": result.get("info", "")
    }
`;
}
/**
 * Generate model invocation code
 * Based on PyGeoModel/ogmsServer2 actual calling method
 */
function generateModelCode(model, paramValues) {
    const lines = [];
    // OpenGMS Token (built-in)
    const OGMS_TOKEN = '6U3O1Sy5696I5ryJFaYCYVjcIV7rhd1MKK0QGX9A7zafogi8xTdvejl6ISUP1lEs';
    // Import statements
    lines.push('# OpenGMS Model Invocation');
    lines.push('# Using ogmsServer2 SDK to run geographic models');
    lines.push('from ogmsServer2.openModel import OGMSAccess');
    lines.push('');
    // Create model instance (Token built-in)
    lines.push(`# Create model access instance: ${model.name}`);
    lines.push(`model = OGMSAccess("${model.name}", token="${OGMS_TOKEN}")`);
    lines.push('');
    // Build parameter dictionary
    lines.push('# Set input parameters');
    lines.push('# Parameter format: { "StateName": { "EventName": "file path or value" } }');
    lines.push('params = {');
    if (model.parameters && model.parameters.length > 0) {
        // Group parameters by StateName
        const groupedParams = {};
        for (const param of model.parameters) {
            const value = paramValues[param.name];
            // Parse parameter name: "StateName.EventName" or "StateName.EventName.ChildName"
            const parts = param.name.split('.');
            const stateName = parts[0];
            const eventName = parts[1] || param.name;
            if (!groupedParams[stateName]) {
                groupedParams[stateName] = {};
            }
            if (parts.length === 3) {
                // Numeric parameter: StateName.EventName.ChildName
                const childName = parts[2];
                if (!groupedParams[stateName][eventName]) {
                    groupedParams[stateName][eventName] = { value: '' };
                }
                if (value !== undefined && value !== '') {
                    groupedParams[stateName][eventName] = { value: String(value) };
                }
            }
            else {
                // File parameter: StateName.EventName
                if (value !== undefined && value !== '') {
                    groupedParams[stateName][eventName] = value;
                }
                else {
                    groupedParams[stateName][eventName] = `"/path/to/${eventName}_data"  # TODO: Set actual file path`;
                }
            }
        }
        // Generate parameter code
        const stateNames = Object.keys(groupedParams);
        stateNames.forEach((stateName, stateIdx) => {
            lines.push(`    "${stateName}": {`);
            const events = Object.entries(groupedParams[stateName]);
            events.forEach(([eventName, eventValue], eventIdx) => {
                const comma = eventIdx < events.length - 1 ? ',' : '';
                if (typeof eventValue === 'object' && eventValue.value !== undefined) {
                    // Numeric parameter
                    lines.push(`        "${eventName}": "${eventValue.value}"${comma}  # Numeric parameter`);
                }
                else {
                    // File parameter
                    const valueStr = typeof eventValue === 'string' && eventValue.startsWith('"')
                        ? eventValue
                        : `"${eventValue}"`;
                    lines.push(`        "${eventName}": ${valueStr}${comma}`);
                }
            });
            const stateComma = stateIdx < stateNames.length - 1 ? ',' : '';
            lines.push(`    }${stateComma}`);
        });
    }
    else {
        lines.push('    # Please add input parameters as required by the model');
        lines.push('    # "StateName": {');
        lines.push('    #     "EventName": "/path/to/input_file"');
        lines.push('    # }');
    }
    lines.push('}');
    lines.push('');
    // Run model
    lines.push('# Run model (will auto-wait for completion)');
    lines.push('try:');
    lines.push('    outputs = model.createTask(params)');
    lines.push('    print("Model run completed!")');
    lines.push('    print("Output results:", outputs)');
    lines.push('');
    lines.push('    # Download output files');
    lines.push('    model.downloadAllData()');
    lines.push('except Exception as e:');
    lines.push('    print(f"Model run failed: {e}")');
    return lines.join('\n');
}
/**
 * Generate data method invocation code (simplified version)
 * Depends on helper functions in dependency.py
 */
function generateDataMethodCode(method, paramValues) {
    const lines = [];
    // Import dependency
    lines.push('# Import OpenGMS data method helper library');
    lines.push('from dependency import run_datamethod');
    lines.push('');
    // Method description
    lines.push(`# Data Method: ${method.name}`);
    if (method.description) {
        lines.push(`# ${method.description}`);
    }
    lines.push('');
    // Collect parameters
    const paramList = [];
    if (method.parameters && method.parameters.length > 0) {
        method.parameters.forEach((param) => {
            const value = paramValues[param.name];
            const actualValue = value !== undefined && value !== ''
                ? String(value)
                : (param.defaultValue !== undefined ? String(param.defaultValue) : '');
            paramList.push({
                name: param.name,
                label: param.label || param.name,
                value: actualValue,
                type: param.type || 'string'
            });
        });
    }
    // Generate parameter comments and call
    lines.push('# Execute data method');
    lines.push(`result = run_datamethod("${method.name}", [`);
    paramList.forEach((p, idx) => {
        const comma = idx < paramList.length - 1 ? ',' : '';
        const typeHint = p.type === 'file' ? 'file path' : 'parameter';
        lines.push(`    "${p.value}"${comma}  # ${p.label} (${typeHint})`);
    });
    lines.push('])');
    lines.push('');
    lines.push('# View results');
    lines.push('print("Output files:", result["outputs"])');
    return lines.join('\n');
}
/**
 * Format Python value
 */
function formatPythonValue(value, type) {
    switch (type) {
        case 'string':
        case 'file':
        case 'textarea':
            return `"${escapeString(String(value))}"`;
        case 'number':
            return String(value);
        case 'boolean':
            return value ? 'True' : 'False';
        default:
            if (typeof value === 'string') {
                return `"${escapeString(value)}"`;
            }
            return String(value);
    }
}
/**
 * Escape special characters in string
 */
function escapeString(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}
/**
 * Generate simplified code (for quick invocation)
 */
function generateQuickCode(item, paramValues) {
    const isModel = 'md5' in item || item.type === 'model';
    const params = Object.entries(paramValues)
        .filter(([_, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `    "${k}": ${JSON.stringify(v)}`)
        .join(',\n');
    if (isModel) {
        return `from ogmsServer2.openModel import OGMSAccess

model = OGMSAccess("${item.name}", token="your_token")
outputs = model.createTask({
${params}
})
model.downloadAllData()`;
    }
    else {
        return `import requests

result = requests.post(
    "http://172.21.252.222:8080/container/method/invoke/${item.id}",
    json={
${params}
    }
)
print(result.json())`;
    }
}


/***/ }),

/***/ "./lib/utils/markdownRenderer.js":
/*!***************************************!*\
  !*** ./lib/utils/markdownRenderer.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   renderMarkdown: () => (/* binding */ renderMarkdown)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/**
 * Lightweight Markdown-to-React renderer
 * Handles: **bold**, *italic*, `code`, headers, lists (nested), paragraphs, links
 */

/** Render inline markdown: **bold**, *italic*, `code`, [link](url) */
function renderInline(text, baseKey = '') {
    const parts = [];
    // Regex handles: **bold**, *italic*, `code`, [text](url)
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`\n]+?)`|\[([^\]]+?)\]\(([^)]+?)\))/g;
    let lastIdx = 0;
    let match;
    let k = 0;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIdx) {
            parts.push(text.slice(lastIdx, match.index));
        }
        if (match[2] !== undefined) {
            // **bold**
            parts.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement("strong", { key: `${baseKey}b${k++}` }, renderInline(match[2], `${baseKey}b${k}`)));
        }
        else if (match[3] !== undefined) {
            // *italic*
            parts.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement("em", { key: `${baseKey}i${k++}` }, renderInline(match[3], `${baseKey}i${k}`)));
        }
        else if (match[4] !== undefined) {
            // `code`
            parts.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement("code", { key: `${baseKey}c${k++}`, className: "md-inline-code" }, match[4]));
        }
        else if (match[5] !== undefined && match[6] !== undefined) {
            // [text](url)
            parts.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement("a", { key: `${baseKey}a${k++}`, href: match[6], target: "_blank", rel: "noopener noreferrer" }, match[5]));
        }
        lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
        parts.push(text.slice(lastIdx));
    }
    if (parts.length === 0)
        return text;
    if (parts.length === 1)
        return parts[0];
    return react__WEBPACK_IMPORTED_MODULE_0__.createElement(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, parts);
}
/**
 * Render a markdown string to React elements.
 * Handles: headings, bold, italic, inline code, bullet/numbered lists (with nesting), paragraphs.
 */
function renderMarkdown(text) {
    const lines = text.split('\n');
    const elements = [];
    let keyIdx = 0;
    // Accumulate list items with indent info
    let listBuffer = [];
    let paragraphBuffer = [];
    const flushParagraph = () => {
        if (paragraphBuffer.length > 0) {
            const joined = paragraphBuffer.join('\n');
            if (joined.trim()) {
                elements.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement("p", { key: `p${keyIdx++}` }, renderInline(joined, `p${keyIdx}`)));
            }
            paragraphBuffer = [];
        }
    };
    const buildNestedList = (items) => {
        if (items.length === 0)
            return null;
        const result = [];
        let i = 0;
        const baseIndent = items[0].indent;
        const listType = items[0].type;
        while (i < items.length) {
            const item = items[i];
            // Collect children (items with greater indent)
            const children = [];
            let j = i + 1;
            while (j < items.length && items[j].indent > baseIndent) {
                children.push(items[j]);
                j++;
            }
            result.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement("li", { key: `li${keyIdx++}` },
                renderInline(item.text, `li${keyIdx}`),
                children.length > 0 ? buildNestedList(children) : null));
            i = j;
        }
        return listType === 'ol'
            ? react__WEBPACK_IMPORTED_MODULE_0__.createElement("ol", { key: `ol${keyIdx++}` }, result)
            : react__WEBPACK_IMPORTED_MODULE_0__.createElement("ul", { key: `ul${keyIdx++}` }, result);
    };
    const flushList = () => {
        if (listBuffer.length > 0) {
            const listEl = buildNestedList(listBuffer);
            if (listEl)
                elements.push(listEl);
            listBuffer = [];
        }
    };
    // Helper: check if a line is a table row
    const isTableRow = (line) => {
        const trimmed = line.trim();
        return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1;
    };
    // Helper: check if a line is a table separator (e.g. |---|---|---| or | :---: | --- |)
    const isTableSeparator = (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('|') || !trimmed.endsWith('|'))
            return false;
        const inner = trimmed.slice(1, -1);
        const cells = inner.split('|');
        return cells.every(cell => /^\s*:?-{2,}:?\s*$/.test(cell));
    };
    // Helper: parse table cells from a row line
    const parseTableCells = (line) => {
        const trimmed = line.trim();
        const inner = trimmed.slice(1, -1); // remove leading/trailing |
        return inner.split('|').map(cell => cell.trim());
    };
    // Helper: flush a table buffer into a <table> element
    const flushTable = (tableLines) => {
        if (tableLines.length < 2) {
            // Not enough lines for a table, treat as paragraphs
            tableLines.forEach(l => paragraphBuffer.push(l));
            return;
        }
        // Find separator line
        let sepIdx = -1;
        for (let ti = 0; ti < tableLines.length; ti++) {
            if (isTableSeparator(tableLines[ti])) {
                sepIdx = ti;
                break;
            }
        }
        const headerRows = sepIdx > 0 ? tableLines.slice(0, sepIdx) : [];
        const bodyRows = sepIdx >= 0 ? tableLines.slice(sepIdx + 1) : tableLines;
        elements.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement("table", { key: `tbl${keyIdx++}`, className: "md-table" },
            headerRows.length > 0 && (react__WEBPACK_IMPORTED_MODULE_0__.createElement("thead", null, headerRows.map((row, ri) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("tr", { key: `thr${keyIdx++}` }, parseTableCells(row).map((cell, ci) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("th", { key: `th${keyIdx++}` }, renderInline(cell, `th${keyIdx}`))))))))),
            react__WEBPACK_IMPORTED_MODULE_0__.createElement("tbody", null, bodyRows.map((row, ri) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("tr", { key: `tbr${keyIdx++}` }, parseTableCells(row).map((cell, ci) => (react__WEBPACK_IMPORTED_MODULE_0__.createElement("td", { key: `td${keyIdx++}` }, renderInline(cell, `td${keyIdx}`))))))))));
    };
    let tableBuffer = [];
    const flushTableBuffer = () => {
        if (tableBuffer.length > 0) {
            flushTable(tableBuffer);
            tableBuffer = [];
        }
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Table row detection (must come before other matchers)
        if (isTableRow(line) || (tableBuffer.length > 0 && isTableSeparator(line))) {
            flushParagraph();
            flushList();
            tableBuffer.push(line);
            continue;
        }
        else if (tableBuffer.length > 0) {
            // End of table
            flushTableBuffer();
        }
        // Horizontal rule: --- or *** or ___
        if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
            flushParagraph();
            flushList();
            elements.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement("hr", { key: `hr${keyIdx++}` }));
            continue;
        }
        // Heading: # to ####
        const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            const level = headingMatch[1].length;
            const HeadTag = (`h${level}`);
            elements.push(react__WEBPACK_IMPORTED_MODULE_0__.createElement(HeadTag, { key: `h${keyIdx++}` }, renderInline(headingMatch[2], `h${keyIdx}`)));
            continue;
        }
        // Unordered list: leading spaces/tabs + - or * followed by space
        const ulMatch = line.match(/^(\s*)([-*])\s+(.+)/);
        if (ulMatch) {
            flushParagraph();
            const indent = ulMatch[1].length;
            listBuffer.push({ indent, type: 'ul', text: ulMatch[3] });
            continue;
        }
        // Ordered list: leading spaces + number. + space
        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)/);
        if (olMatch) {
            flushParagraph();
            const indent = olMatch[1].length;
            listBuffer.push({ indent, type: 'ol', text: olMatch[3] });
            continue;
        }
        // Empty line
        if (line.trim() === '') {
            flushList();
            flushParagraph();
            continue;
        }
        // Regular text — if we're in a list context and this line is continuation, 
        // treat as new paragraph
        flushList();
        paragraphBuffer.push(line);
    }
    flushTableBuffer();
    flushList();
    flushParagraph();
    return elements;
}


/***/ }),

/***/ "./lib/widget.js":
/*!***********************!*\
  !*** ./lib/widget.js ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GeoModelWidget: () => (/* binding */ GeoModelWidget)
/* harmony export */ });
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "webpack/sharing/consume/default/react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _components_GeoModelPanel__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./components/GeoModelPanel */ "./lib/components/GeoModelPanel.js");
/**
 * GeoModel Sidebar Main Widget
 */



/**
 * Main Widget Class - Wraps React Component
 */
class GeoModelWidget extends _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.ReactWidget {
    constructor(notebookTracker) {
        super();
        this._notebookTracker = notebookTracker;
        this.addClass('jp-GeoModel-sidebar');
    }
    /**
     * Render React Component
     */
    render() {
        return (react__WEBPACK_IMPORTED_MODULE_1__.createElement(_components_GeoModelPanel__WEBPACK_IMPORTED_MODULE_2__.GeoModelPanel, { notebookTracker: this._notebookTracker }));
    }
}


/***/ })

}]);
//# sourceMappingURL=lib_index_js.06af641288ffa6c9a79d.js.map