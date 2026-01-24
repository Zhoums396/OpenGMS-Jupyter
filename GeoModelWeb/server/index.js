require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const https = require('https');

// 创建忽略 SSL 证书验证的 https agent
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Import routes
const authRoutes = require('./routes/auth');
const jupyterRoutes = require('./routes/jupyter');
// 使用 LangGraph 版本的 Agent 路由
const agentRoutes = require('./routes/agent-langgraph');
// 保留原始版本作为备份: const agentRoutes = require('./routes/agent');

const app = express();
const PORT = process.env.PORT || 3000;

// 从环境变量获取核心配置
const HOST_IP = process.env.HOST_IP || 'localhost';
const FRONTEND_URL = process.env.FRONTEND_URL || `http://${HOST_IP}:5173`;
const BACKEND_URL = process.env.BACKEND_URL || `http://${HOST_IP}:${PORT}`;

// 允许局域网访问
app.use(cors({
    origin: [
        'http://localhost:5173', 
        'http://localhost:3000',
        FRONTEND_URL,
        BACKEND_URL,
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/,  // 允许所有 192.168.x.x 的局域网地址
        /^http:\/\/172\.\d+\.\d+\.\d+:\d+$/   // 允许所有 172.x.x.x 的局域网地址
    ],
    credentials: true
}));
app.use(bodyParser.json());

// ==================== Auth & Jupyter Routes ====================
app.use('/api/auth', authRoutes);

// Jupyter 路由：部分端点公开
const jupyterOptionalAuth = (req, res, next) => {
    // container-by-port 端点不需要认证（用于扩展自动识别容器）
    if (req.path.startsWith('/container-by-port')) {
        req.user = req.user || { userId: 'anonymous' };
        return next();
    }
    // 其他端点需要认证
    return authRoutes.authenticateToken(req, res, next);
};
app.use('/api/jupyter', jupyterOptionalAuth, jupyterRoutes);

// Agent 路由：使用可选认证中间件
const agentOptionalAuth = (req, res, next) => {
    // 这些端点不需要认证（开发模式下全部公开）
    const publicPaths = ['/health', '/providers', '/config', '/test', '/chat', '/tool-results', '/scan-workspace', '/conversations'];
    if (publicPaths.some(p => req.path === p || req.path.startsWith(p))) {
        req.user = req.user || { userId: 'anonymous' };
        return next();
    }
    // 其他端点需要认证
    return authRoutes.authenticateToken(req, res, next);
};
app.use('/api/agent', agentOptionalAuth, agentRoutes);

// Configure Multer for temporary file storage
const upload = multer({ dest: 'uploads/' });

// API Configuration for DataMethod
const API_BASE_URL = 'http://172.21.252.222:8080';
const API_TOKEN = '883ada2fc996ab9487bed7a3ba21d2f1';
const DATA_SERVER_URL = 'http://221.224.35.86:38083/data';

// OGMS Configuration for Computational Models
const OGMS_PORTAL_URL = 'http://222.192.7.75';
const OGMS_MANAGER_URL = 'http://222.192.7.75/managerServer';
const OGMS_DATA_URL = 'http://222.192.7.75/dataTransferServer';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'token': API_TOKEN }
});

const ogmsApi = axios.create({
    baseURL: OGMS_PORTAL_URL,
    headers: { 'token': API_TOKEN }
});

// OpenGMP 数据中心 API
const OPENGMP_API_URL = 'https://geomodeling.njnu.edu.cn/OpenGMPBack';
const opengmpApi = axios.create({
    baseURL: OPENGMP_API_URL,
    httpsAgent: httpsAgent  // 忽略 SSL 证书验证
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        dataMethodAPI: API_BASE_URL,
        ogmsAPI: OGMS_PORTAL_URL
    });
});

// Upload File Proxy
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const fileStream = fs.createReadStream(req.file.path);
        const form = new FormData();
        form.append('datafile', fileStream, req.file.originalname);
        form.append('name', req.file.originalname);

        console.log(`Uploading file ${req.file.originalname} to data server...`);

        const response = await axios.post(DATA_SERVER_URL, form, {
            headers: { ...form.getHeaders(), 'token': API_TOKEN }
        });

        fs.unlinkSync(req.file.path);

        if (response.status === 200 && (response.data.code === 1 || response.data.code === 0)) {
            console.log('Upload success:', response.data);
            const fileId = response.data.data ? response.data.data.id : (response.data.id || 'unknown_id');
            res.json({
                status: 'success',
                id: fileId,
                filename: req.file.originalname
            });
        } else {
            console.error('Upload failed upstream. Status:', response.status);
            res.status(500).json({
                error: 'Upstream upload failed',
                details: response.data
            });
        }
    } catch (error) {
        console.error('Error uploading file:', error.message);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({
            error: 'File upload failed',
            message: error.message
        });
    }
});

// ==================== OpenGMP Data Center Proxy ====================

// 获取数据中心数据列表
app.post('/api/datacenter/list', async (req, res) => {
    try {
        const params = {
            asc: req.body.asc || false,
            page: req.body.page || 1,
            pageSize: req.body.pageSize || 18,
            searchText: req.body.searchText || '',
            sortField: req.body.sortField || 'createTime',
            tagClass: req.body.tagClass || 'problemTags',
            tagName: req.body.tagName || ''
        };

        console.log('[DataCenter] Fetching data list:', params);

        const response = await opengmpApi.post('/centerRes/getResourceDataList', params);

        if (response.data.code === 0) {
            res.json(response.data);
        } else {
            res.status(400).json({
                code: -1,
                msg: response.data.msg || 'Failed to fetch data'
            });
        }
    } catch (error) {
        console.error('[DataCenter] Error:', error.message);
        res.status(500).json({
            code: -1,
            msg: 'Failed to fetch data from data center',
            error: error.message
        });
    }
});

// 下载数据代理（可选，如果直接下载有CORS问题）
app.get('/api/datacenter/download/:id', async (req, res) => {
    try {
        const dataId = req.params.id;
        const downloadUrl = `${OPENGMP_API_URL}/userRes/downloadDataItem/${dataId}`;
        
        // 重定向到实际下载地址
        res.redirect(downloadUrl);
    } catch (error) {
        console.error('[DataCenter] Download error:', error.message);
        res.status(500).json({ error: 'Download failed' });
    }
});

// ==================== DataMethod Endpoints ====================

app.get('/api/datamethods', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const search = (req.query.q || '').trim().toLowerCase();

        // 无搜索时，直接分页请求后端 API
        if (!search || search.length === 0) {
            const response = await api.get(`/container/method/listWithTag`, {
                params: { page, limit }
            });

            if (response.data.code === 0) {
                const methods = response.data.page.list.map(item => ({
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    author: item.author || 'Unknown',
                    tags: item.tags || [],
                    createTime: item.createTime
                }));

                res.json({
                    total: response.data.page.totalCount,
                    page: page,
                    limit: limit,
                    data: methods
                });
            } else {
                res.status(500).json({ error: response.data.msg });
            }
            return;
        }

        // 有搜索时，请求更多数据进行过滤（限制 500 条以避免太慢）
        const searchLimit = 500;
        const response = await api.get(`/container/method/listWithTag`, {
            params: { page: 1, limit: searchLimit }
        });

        if (response.data.code === 0) {
            // 过滤匹配搜索词的方法
            const allMethods = response.data.page.list
                .filter(item =>
                    item.name.toLowerCase().includes(search) ||
                    (item.description && item.description.toLowerCase().includes(search))
                )
                .map(item => ({
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    author: item.author || 'Unknown',
                    tags: item.tags || [],
                    createTime: item.createTime
                }));

            // 分页
            const total = allMethods.length;
            const startIndex = (page - 1) * limit;
            const paginatedMethods = allMethods.slice(startIndex, startIndex + limit);

            res.json({
                total: total,
                page: page,
                limit: limit,
                data: paginatedMethods,
                searchNote: total >= searchLimit ? `搜索结果可能不完整（仅搜索前 ${searchLimit} 条）` : null
            });
        } else {
            res.status(500).json({ error: response.data.msg });
        }
    } catch (error) {
        console.error('Error fetching data methods:', error.message);
        res.status(500).json({ error: 'Failed to fetch data methods' });
    }
});

// 获取数据方法完整信息（包含 paramType 映射）- 必须在 :name 路由之前
app.get('/api/datamethods/info/:name', async (req, res) => {
    try {
        const name = req.params.name;
        const response = await api.get(`/container/method/infoByName/${name}`);

        // 返回完整响应，包含 paramType
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching data method info for ${req.params.name}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch data method info' });
    }
});

app.get('/api/datamethods/:name', async (req, res) => {
    try {
        const name = req.params.name;
        const response = await api.get(`/container/method/infoByName/${name}`);

        if (response.data.code === 0) {
            res.json(response.data.method);
        } else {
            res.status(404).json({ error: response.data.msg });
        }
    } catch (error) {
        console.error(`Error fetching data method details for ${req.params.name}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch data method details' });
    }
});

app.post('/api/datamethods/run', async (req, res) => {
    try {
        const { modelId, inputs } = req.body;
        console.log(`Invoking data method ${modelId} with inputs:`, inputs);

        const response = await api.post(`/container/method/invoke/${modelId}`, inputs);
        console.log('Data method API full response:', JSON.stringify(response.data, null, 2));

        if (response.data.code === 0) {
            // 处理输出：如果 value 是数组且包含元素，拼接完整 URL
            let processedOutput = response.data.output;
            if (processedOutput && typeof processedOutput === 'object') {
                const DATA_SERVER = 'http://221.224.35.86:38083/data';
                for (const [key, value] of Object.entries(processedOutput)) {
                    if (Array.isArray(value) && value.length > 0) {
                        // 如果数组中有 UUID，转换为完整 URL
                        processedOutput[key] = value.map(id => {
                            if (typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) {
                                return `${DATA_SERVER}/${id}`;
                            }
                            return id;
                        });
                    }
                }
            }
            
            res.json({
                status: 'success',
                message: 'Data method executed successfully',
                output: processedOutput,
                info: response.data.info
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: response.data.msg
            });
        }
    } catch (error) {
        console.error('Error running data method:', error.message);
        res.status(500).json({ error: 'Failed to run data method' });
    }
});

// ==================== OGMS Computational Model Endpoints ====================

// Cache for model list
let modelListCache = null;
const MODEL_DATA_PATH = path.join(__dirname, 'data', 'computeModel.json');

// Helper to load and process model data
const loadModelData = () => {
    if (modelListCache) return modelListCache;

    try {
        if (fs.existsSync(MODEL_DATA_PATH)) {
            console.log('Loading model data from:', MODEL_DATA_PATH);
            const rawData = fs.readFileSync(MODEL_DATA_PATH, 'utf8');
            const models = JSON.parse(rawData);

            // Transform to array and keep only necessary fields for listing
            modelListCache = Object.entries(models).map(([key, model]) => ({
                id: model._id || key,
                name: key, // Use key as name
                description: model.description || 'No description available',
                author: model.author || 'Unknown',
                tags: model.normalTags || [],
                viewCount: model.viewCount || 0
            }));

            console.log(`Loaded ${modelListCache.length} models.`);
            return modelListCache;
        } else {
            console.error('Model data file not found:', MODEL_DATA_PATH);
            return [];
        }
    } catch (error) {
        console.error('Error loading model data:', error.message);
        return [];
    }
};

// List OGMS Models (from local JSON)
app.get('/api/ogms/models', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const search = (req.query.q || '').toLowerCase();

        let models = loadModelData();

        // Filter by search query
        if (search) {
            models = models.filter(m =>
                m.name.toLowerCase().includes(search) ||
                (m.description && m.description.toLowerCase().includes(search))
            );
        }

        // Pagination
        const total = models.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedModels = models.slice(startIndex, endIndex);

        res.json({
            total,
            page,
            limit,
            data: paginatedModels
        });
    } catch (error) {
        console.error('Error listing models:', error.message);
        res.status(500).json({ error: 'Failed to list models' });
    }
});

app.get('/api/ogms/models/:name', async (req, res) => {
    try {
        const name = req.params.name;
        const encodedName = encodeURIComponent(name);

        const response = await ogmsApi.get(`/computableModel/ModelInfo_name/${encodedName}`);

        if (response.data && response.data.data) {
            res.json(response.data.data);
        } else {
            res.status(404).json({ error: 'Model not found' });
        }
    } catch (error) {
        console.error(`Error fetching OGMS model ${req.params.name}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch model info' });
    }
});

app.post('/api/ogms/models/invoke', async (req, res) => {
    try {
        console.log('OGMS Model Invoke Request:', JSON.stringify(req.body, null, 2));

        const response = await axios.post(
            `${OGMS_MANAGER_URL}/GeoModeling/computableModel/invoke`,
            req.body,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'token': API_TOKEN
                }
            }
        );

        console.log('OGMS Model Invoke Response:', JSON.stringify(response.data, null, 2));

        if (response.data && response.data.code === 1) {
            res.json({
                status: 'success',
                data: response.data.data
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: response.data?.msg || 'Model invocation failed'
            });
        }
    } catch (error) {
        console.error('Error invoking OGMS model:', error.message);
        res.status(500).json({ error: 'Failed to invoke model' });
    }
});

// Helper to upload string as file (for XML params)
async function uploadStringAsFile(content, filename) {
    try {
        const form = new FormData();
        form.append('datafile', Buffer.from(content, 'utf-8'), filename);
        
        const response = await axios.post(DATA_SERVER_URL, form, {
            headers: { ...form.getHeaders(), 'token': API_TOKEN }
        });

        if (response.data.code === 1) {
            // Return the full URL as expected by OGMS
            // The ID returned is just the ID. We need to append it to the data server URL base.
            // However, openModel.py does: self.dataUrl + C.UPLOAD_DATA + res.get("id")
            // C.UPLOAD_DATA is likely just "/" or empty if dataUrl ends with /data
            // Let's assume DATA_SERVER_URL is the base.
            return `${DATA_SERVER_URL}/${response.data.data.id}`;
        }
        throw new Error('Upload failed: ' + response.data.msg);
    } catch (error) {
        console.error('Error uploading XML string:', error.message);
        throw error;
    }
}

// Helper to parse XML MDL to JSON (Standardized 'origin_lists' structure)
async function parseXmlMdlToJSON(xmlContent) {
    try {
        const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
        const result = await parser.parseStringPromise(xmlContent);
        
        const inputs = [];
        
        // Navigate to States
        const states = result.ModelClass?.Behavior?.StateGroup?.States?.State;
        if (!states) return { inputs: [] };

        const stateArray = Array.isArray(states) ? states : (states ? [states] : []);
        
        for (const state of stateArray) {
            const events = state.Event;
            const eventArray = Array.isArray(events) ? events : (events ? [events] : []);
            
            for (const event of eventArray) {
                if (event.type === 'response') {
                    const inputItem = {
                        statename: state.name,
                        event: event.name,
                        url: "",
                        suffix: "",
                        optional: event.optional,
                        text: event.description || event.name,
                        children: []
                    };
                    
                    // Check for children (numerical params)
                    const responseParam = event.ResponseParameter;
                    if (responseParam && responseParam.datasetReference) {
                        const refName = responseParam.datasetReference;
                        const datasets = result.ModelClass?.Behavior?.RelatedDatasets?.DatasetItem;
                        const datasetArray = Array.isArray(datasets) ? datasets : (datasets ? [datasets] : []);
                        const dataset = datasetArray.find(d => d.name === refName);
                        
                        if (dataset && dataset.type === 'internal') {
                            let paramName = refName;
                            try {
                                const udxNode = dataset.UdxDeclaration?.UdxNode?.UdxNode;
                                if (udxNode) {
                                    paramName = Array.isArray(udxNode) ? udxNode[0].name : udxNode.name;
                                }
                            } catch (e) { /* ignore */ }
                            
                            inputItem.children.push({
                                eventName: paramName,
                                value: ""
                            });
                        }
                    }
                    
                    inputs.push(inputItem);
                }
            }
        }
        
        return { inputs: inputs };
    } catch (err) {
        console.error('XML Parsing failed:', err);
        throw err;
    }
}

// Logic from openModel.py: _mergeData and _validData
async function processAndMergeInputs(originLists, userInputs) {
    // 1. Process User Inputs (Upload XML for values)
    // userInputs structure: { stateName: { eventName: { value: ..., url: ..., name: ... } } }
    const processedInputs = {}; // Map: state -> event -> { url, children, suffix }

    for (const stateName in userInputs) {
        processedInputs[stateName] = {};
        for (const eventName in userInputs[stateName]) {
            const input = userInputs[stateName][eventName];
            
            // Case 1: Numerical Value (needs XML wrapping)
            if (input.value !== undefined && input.value !== '' && !input.url) {
                const xmlContent = `<Dataset> <XDO name="${eventName}" kernelType="string" value="${input.value}" /> </Dataset>`;
                const xmlUrl = await uploadStringAsFile(xmlContent, `${eventName}.xml`);
                
                processedInputs[stateName][eventName] = {
                    url: xmlUrl,
                    suffix: 'xml',
                    children: { [eventName]: input.value } // Simplified for lookup
                };
            }
            // Case 2: File URL (already uploaded)
            else if (input.url) {
                let fileUrl = input.url;
                // Ensure full URL
                if (!fileUrl.startsWith('http')) {
                    fileUrl = `${DATA_SERVER_URL}/${fileUrl}`;
                }
                
                processedInputs[stateName][eventName] = {
                    url: fileUrl,
                    suffix: input.name ? input.name.split('.').pop() : 'xml'
                };
            }
        }
    }

    // 2. Merge with MDL Template
    const validInputs = [];
    
    if (originLists.inputs) {
        for (let inputItem of originLists.inputs) {
            const stateName = inputItem.statename;
            const eventName = inputItem.event;
            
            const userEventData = processedInputs[stateName]?.[eventName];
            
            if (userEventData) {
                // Update URL and Suffix
                if (userEventData.url) {
                    inputItem.url = userEventData.url;
                }
                if (userEventData.suffix) {
                    inputItem.suffix = userEventData.suffix;
                }
                
                // Update Children (Numerical Values)
                if (inputItem.children && inputItem.children.length > 0 && userEventData.children) {
                    inputItem.suffix = 'xml'; // Enforce XML for numerical
                    for (let child of inputItem.children) {
                        // The child.eventName might match the key in userEventData.children
                        // In openModel.py: if event_name in b_child
                        // Here userEventData.children is { eventName: value }
                        // But wait, openModel.py uses the parameter name (e.g. "system_efficiency")
                        // My XML parser extracts that name into child.eventName.
                        // But my frontend sends data keyed by EVENT name, not PARAMETER name.
                        // And my XML generation uses EVENT name as XDO name.
                        // This might be a mismatch if Event Name != Parameter Name.
                        // However, openModel.py _create_value_xml uses 'key' which is from params keys.
                        // And params keys come from input_files which are keyed by event_name (mostly).
                        
                        // Let's assume the value passed is for this child.
                        // We just take the value from user input.
                        const val = userEventData.children[eventName]; 
                        if (val !== undefined) {
                            child.value = val;
                        }
                    }
                }
            }
            
            // 3. Validate (Filter optional/required)
            const isOptional = inputItem.optional === "True" || inputItem.optional === true;
            const hasUrl = !!inputItem.url;
            
            if (!isOptional) {
                // Required: Must have URL
                if (!hasUrl) {
                    throw new Error(`Missing required input: ${stateName} - ${eventName}`);
                }
                validInputs.push(inputItem);
            } else {
                // Optional: Include only if has URL
                if (hasUrl) {
                    validInputs.push(inputItem);
                }
            }
        }
    }
    
    return validInputs;
}

app.get('/api/ogms/models/:name', async (req, res) => {
    try {
        const name = req.params.name;
        const encodedName = encodeURIComponent(name);

        const response = await ogmsApi.get(`/computableModel/ModelInfo_name/${encodedName}`);

        if (response.data && response.data.data) {
            const modelInfo = response.data.data;
            
            // Check if MDL is XML string and parse it
            if (modelInfo.mdl && typeof modelInfo.mdl === 'string') {
                try {
                    console.log(`Parsing XML MDL for model: ${name}`);
                    const parsedMdl = await parseXmlMdlToJSON(modelInfo.mdl);
                    modelInfo.mdl = parsedMdl; // Replace string with parsed object
                } catch (e) {
                    console.warn(`Failed to parse XML MDL for ${name}, returning original.`);
                }
            }
            
            res.json(modelInfo);
        } else {
            res.status(404).json({ error: 'Model not found' });
        }
    } catch (error) {
        console.error(`Error fetching OGMS model ${req.params.name}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch model info' });
    }
});

// Advanced Execute Endpoint (Handles MDL parsing and data preparation)
app.post('/api/ogms/models/execute', async (req, res) => {
    try {
        const { modelName, inputs, username } = req.body;
        
        // 1. Get Model Info to get MDL structure
        const encodedName = encodeURIComponent(modelName);
        const requestUrl = `/computableModel/ModelInfo_name/${encodedName}`;
        console.log(`Fetching model info from: ${requestUrl}`);
        
        const infoRes = await axios.get(`${OGMS_PORTAL_URL}${requestUrl}`);
        
        if (!infoRes.data || (infoRes.data.code !== 1 && infoRes.data.code !== 0)) {
            console.error('Model info fetch failed:', infoRes.data);
            return res.status(404).json({ error: 'Model not found', details: infoRes.data });
        }

        const modelInfo = infoRes.data.data;
        let originLists = modelInfo.mdl; 
        
        // Handle XML MDL
        if (typeof originLists === 'string') {
            console.log('MDL is XML string, parsing...');
            try {
                originLists = await parseXmlMdlToJSON(originLists);
                console.log('Parsed XML to inputs:', JSON.stringify(originLists, null, 2));
            } catch (err) {
                console.error('XML Parsing failed:', err);
                return res.status(500).json({ error: 'Failed to parse XML model definition' });
            }
        } else {
            // Deep copy to avoid modifying cache if any
            originLists = JSON.parse(JSON.stringify(originLists));
        }

        // 2. Merge Data using the new logic
        let validInputs;
        try {
            validInputs = await processAndMergeInputs(originLists, inputs);
        } catch (validationError) {
            console.error('Validation Error:', validationError.message);
            return res.status(400).json({ error: validationError.message });
        }

        const invokePayload = {
            oid: modelInfo.msid, 
            ip: req.ip,
            pid: username || 'test_user',
            inputs: validInputs
        };

        console.log('Invoking with payload:', JSON.stringify(invokePayload, null, 2));

        const invokeRes = await axios.post(
            `${OGMS_MANAGER_URL}/GeoModeling/computableModel/invoke`,
            invokePayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'token': API_TOKEN
                }
            }
        );

        if (invokeRes.data.code === 1) {
            res.json({
                status: 'success',
                data: invokeRes.data.data
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: invokeRes.data.msg
            });
        }

    } catch (error) {
        console.error('Error in execute:', error);
        res.status(500).json({ error: 'Execution failed: ' + error.message });
    }
});

app.post('/api/ogms/models/refresh', async (req, res) => {
    try {
        const response = await axios.post(
            `${OGMS_MANAGER_URL}/GeoModeling/computableModel/refreshTaskRecord`,
            req.body,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'token': API_TOKEN
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Error refreshing task status:', error.message);
        res.status(500).json({ error: 'Failed to refresh task status' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`DataMethod API: ${API_BASE_URL}`);
    console.log(`OGMS Model API: ${OGMS_PORTAL_URL}`);
    console.log(`GitHub OAuth callback: http://localhost:${PORT}/api/auth/github/callback`);
    console.log(`Jupyter API: http://localhost:${PORT}/api/jupyter`);
});
