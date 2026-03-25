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
const { getDatabaseInfo, initDatabase } = require('./db/database');

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
        'http://localhost:8888',
        'http://127.0.0.1:8888',
        FRONTEND_URL,
        BACKEND_URL,
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
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
    const publicPaths = ['/health', '/providers', '/config', '/test', '/chat', '/tool-results', '/scan-workspace', '/conversations', '/cases'];
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
const OGMS_DEPLOYED_MODEL_QUERY_TOKEN = process.env.OGMS_DEPLOYED_MODEL_QUERY_TOKEN || 'ua6R2Qbf=0cvx_0alqEHJRFRaPfczQAGVL6obCzYn1J2tWiQZKc0MD9oss1d3YEE6a21Ollu8xNEo9b1mV4EBJzlX08xQswyK2OTcOsAiQ';
const OGMS_DEPLOYED_MODEL_URL = `${OGMS_PORTAL_URL}/managementSystem/deployedModel?${OGMS_DEPLOYED_MODEL_QUERY_TOKEN}`;

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'token': API_TOKEN }
});

const DATA_METHOD_CACHE_TTL_MS = parseInt(process.env.DATA_METHOD_CACHE_TTL_MS || '300000', 10);
const dataMethodCache = new Map();
const DATA_METHOD_REPOSITORY_CACHE_TTL_MS = parseInt(process.env.DATA_METHOD_REPOSITORY_CACHE_TTL_MS || '21600000', 10);
const OGMS_MODEL_LIST_CACHE_TTL_MS = parseInt(process.env.OGMS_MODEL_LIST_CACHE_TTL_MS || '300000', 10);
const OGMS_MODEL_DETAIL_CACHE_TTL_MS = parseInt(process.env.OGMS_MODEL_DETAIL_CACHE_TTL_MS || '1800000', 10);
const OGMS_MODEL_REPOSITORY_CACHE_TTL_MS = parseInt(process.env.OGMS_MODEL_REPOSITORY_CACHE_TTL_MS || '21600000', 10);
const ogmsModelListCache = new Map();
const ogmsModelDetailCache = new Map();
const ogmsModelRepositoryCache = new Map();
const dataMethodRepositoryCache = new Map();
const DATA_METHOD_TAG_NAME_MAP = {
    '1': 'Math and Stats Tools',
    '2': 'Image Processing Tools',
    '3': 'Filters',
    '4': 'Data Tools',
    '5': 'GIS Analysis',
    '6': 'LiDAR Tools',
    '7': 'Geomorphometric Analysis',
    '8': 'Hydrological Analysis',
    '9': 'Overlay Tools',
    '10': 'Image Enhancement',
    '11': 'Patch Shape Tools',
    '12': 'Distance Tools',
    '13': 'Stream Network Analysis',
    '14': 'Whitebox',
    '15': 'Machine Learning'
};
const OGMS_MODEL_TAG_NAME_MAP = {
    'a24cba2b-9ce1-44de-ac68-8ec36a535d0e': 'Land regions',
    '75aee2b7-b39a-4cd0-9223-3b7ce755e457': 'Ocean regions',
    '1bf4f381-6bd8-4716-91ab-5a56e51bd2f9': 'Frozen regions',
    '8f4d4fca-4d09-49b4-b6f7-5021bc57d0e5': 'Atmospheric regions',
    'd33a1ebe-b2f5-4ed3-9c76-78cfb61c23ee': 'Space-earth regions',
    'd3ba6e0b-78ec-4fe8-9985-4d5708f28e3e': 'Solid-earth regions',
    '808e74a4-41c6-4558-a850-4daec1f199df': 'Development activities',
    '40534cf8-039a-4a0a-8db9-7c9bff484190': 'Social activities',
    'cf9cd106-b873-4a8a-9336-dd72398fc769': 'Economic activities',
    '14130969-fda6-41ea-aa32-0af43104840b': 'Global scale',
    'e56c1254-70b8-4ff4-b461-b8fa3039944e': 'Regional scale',
    'afa99af9-4224-4fac-a81f-47a7fb663dba': 'Geoinformation analysis',
    'f20411a5-2f55-4ee9-9590-c2ec826b8bd5': 'Remote sensing analysis',
    '1c876281-a032-4575-8eba-f1a8fb4560d8': 'Geostatistical analysis',
    'c6fcc899-8ca4-4269-a21e-a39d38c034a6': 'Intelligent computation analysis',
    '1d564d0f-51c6-40ca-bd75-3f9489ccf1d6': 'Physical process calculation',
    '63266a14-d7f9-44cb-8204-c877eaddcaa1': 'Chemical process calculation',
    '6d1efa2c-830d-4546-b759-c66806c4facc': 'Biological process calculation',
    '6952d5b2-cb0f-4ba7-96fd-5761dd566344': 'Human-activity calculation'
};

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
const DATA_CENTER_WEB_HOST = 'https://geomodeling.njnu.edu.cn';
const DATA_CENTER_NODE_HOST = 'https://geomodeling.njnu.edu.cn/OpenGMPNodeBack';
const GEODATA_COMPONENTS_API_URL = 'http://nnu.geodata.cn/service/scidata/datacomponents/bytype/';
const GEODATA_IMAGE_HOST = 'https://img.data.ac.cn';
const DATA_CENTER_THUMBNAIL_CACHE_TTL_MS = parseInt(process.env.DATA_CENTER_THUMBNAIL_CACHE_TTL_MS || '21600000', 10);
const dataCenterThumbnailCache = new Map();
let ogmsModelRepositoryPromise = null;
let dataMethodRepositoryPromise = null;

function getCacheValue(cacheKey) {
    const entry = dataMethodCache.get(cacheKey);
    if (!entry) {
        return null;
    }

    if (entry.expiresAt <= Date.now()) {
        dataMethodCache.delete(cacheKey);
        return null;
    }

    return entry.value;
}

function setCacheValue(cacheKey, value) {
    dataMethodCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + DATA_METHOD_CACHE_TTL_MS
    });
}

function getOgmsCacheValue(cacheMap, cacheKey) {
    const entry = cacheMap.get(cacheKey);
    if (!entry) {
        return null;
    }

    if (entry.expiresAt <= Date.now()) {
        cacheMap.delete(cacheKey);
        return null;
    }

    return entry.value;
}

function setOgmsCacheValue(cacheMap, cacheKey, value, ttlMs) {
    cacheMap.set(cacheKey, {
        value,
        expiresAt: Date.now() + ttlMs
    });
}

async function mapInBatches(items, batchSize, mapper) {
    const results = [];
    for (let index = 0; index < items.length; index += batchSize) {
        const batch = items.slice(index, index + batchSize);
        const batchResults = await Promise.all(batch.map(mapper));
        results.push(...batchResults);
    }
    return results;
}

function extractDataGuidFromAddress(address) {
    const source = String(address || '').trim();
    if (!source) {
        return '';
    }

    const match = source.match(/[?&]dataguid=(\d+)/i);
    return match ? match[1] : '';
}

function uniqueValues(values) {
    return Array.from(new Set(values.filter(Boolean)));
}

function buildDataCenterThumbnailCandidates(item, geodataThumbnailUrl = '') {
    const rawCandidates = [
        geodataThumbnailUrl,
        item.thumbnailUrl,
        item.imgWebAddress,
        item.imgRelativePath,
        item.subDataItems?.[0]?.visualWebAddress
    ]
        .map(value => String(value || '').trim())
        .filter(Boolean);

    const resolvedCandidates = rawCandidates.flatMap(value => {
        if (value.startsWith('http://') || value.startsWith('https://')) {
            return [value];
        }

        if (value.startsWith('/store/')) {
            return [
                `${OPENGMP_API_URL}${value}`,
                `${DATA_CENTER_WEB_HOST}${value}`,
                `${DATA_CENTER_NODE_HOST}${value}`
            ];
        }

        if (value.startsWith('/resourceData/')) {
            return [
                `${OPENGMP_API_URL}${value}`,
                `${OPENGMP_API_URL}/store${value}`,
                `${DATA_CENTER_WEB_HOST}${value}`,
                `${DATA_CENTER_WEB_HOST}/store${value}`,
                `${DATA_CENTER_NODE_HOST}${value}`,
                `${DATA_CENTER_NODE_HOST}/store${value}`
            ];
        }

        if (value.startsWith('/')) {
            return [
                `${OPENGMP_API_URL}${value}`,
                `${DATA_CENTER_WEB_HOST}${value}`,
                `${DATA_CENTER_NODE_HOST}${value}`
            ];
        }

        return [
            `${OPENGMP_API_URL}/${value}`,
            `${DATA_CENTER_WEB_HOST}/${value}`,
            `${DATA_CENTER_NODE_HOST}/${value}`
        ];
    });

    return uniqueValues(resolvedCandidates);
}

async function resolveGeodataThumbnailUrl(fileWebAddress) {
    const dataGuid = extractDataGuidFromAddress(fileWebAddress);
    if (!dataGuid) {
        return '';
    }

    const cacheKey = `thumb:${dataGuid}`;
    const cachedValue = getOgmsCacheValue(dataCenterThumbnailCache, cacheKey);
    if (cachedValue !== null) {
        return cachedValue;
    }

    try {
        const response = await axios.get(GEODATA_COMPONENTS_API_URL, {
            params: { dataGuid },
            timeout: 3000
        });

        const components = Array.isArray(response.data?.op_read) ? response.data.op_read : [];
        const thumbnail = components.find(component => Number(component?.type) === 1 && component?.fileId);
        const rawFileId = String(thumbnail?.fileId || '').trim();

        const resolvedUrl = rawFileId
            ? (rawFileId.startsWith('http://') || rawFileId.startsWith('https://')
                ? rawFileId
                : `${GEODATA_IMAGE_HOST}/${rawFileId.replace(/^\/+/, '')}`)
            : '';

        setOgmsCacheValue(dataCenterThumbnailCache, cacheKey, resolvedUrl, DATA_CENTER_THUMBNAIL_CACHE_TTL_MS);
        return resolvedUrl;
    } catch (error) {
        // 失败时做短缓存，避免短时间内重复打满外部接口
        setOgmsCacheValue(dataCenterThumbnailCache, cacheKey, '', 5 * 60 * 1000);
        return '';
    }
}

async function enrichDataCenterItem(item) {
    const geodataThumbnailUrl = await resolveGeodataThumbnailUrl(item.fileWebAddress);
    const thumbnailCandidates = buildDataCenterThumbnailCandidates(item, geodataThumbnailUrl);

    return {
        ...item,
        thumbnailUrl: thumbnailCandidates[0] || '',
        thumbnailCandidates
    };
}

function mapDataMethodSummary(item) {
    const params = Array.isArray(item.params) ? item.params : [];
    const rawTags = item.tags || item.tagList || item.tagIdList || [];
    const tags = rawTags.map(tag => DATA_METHOD_TAG_NAME_MAP[String(tag)] || String(tag));
    const inputParams = params.filter(param => param.Type === 'DataInput');
    const outputParams = params.filter(param => param.Type === 'DataOutput');
    const optionParams = params.filter(param => param.Type !== 'DataInput' && param.Type !== 'DataOutput');
    const flattenTypeValues = (typeDef) => {
        if (!typeDef) {
            return [];
        }

        if (typeof typeDef === 'string' || typeof typeDef === 'number' || typeof typeDef === 'boolean') {
            return [String(typeDef)];
        }

        if (Array.isArray(typeDef)) {
            return typeDef.flatMap(flattenTypeValues);
        }

        if (typeof typeDef === 'object') {
            return Object.values(typeDef).flatMap(flattenTypeValues);
        }

        return [];
    };
    const collectKinds = paramList => Array.from(new Set(
        paramList
            .flatMap(param => {
                const typeDef = param.parameter_type;
                return flattenTypeValues(typeDef);
            })
            .map(value => String(value).trim())
            .filter(value => value && value !== '[object Object]')
    ));

    return {
        id: item.id,
        name: item.name,
        description: item.description,
        longDescription: item.longDesc || item.description || '',
        author: item.author || 'Unknown',
        tags,
        createTime: item.createTime,
        engine: item.uuid || null,
        execution: item.execution || null,
        methodType: item.type || null,
        category: item.category || null,
        paramCount: params.length,
        inputCount: inputParams.length,
        outputCount: outputParams.length,
        optionCount: optionParams.length,
        inputKinds: collectKinds(inputParams),
        outputKinds: collectKinds(outputParams)
    };
}

function normalizeMethodFacetLabel(value) {
    return String(value || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchesMethodFilters(method, {
    search = '',
    facet = 'all',
    interactive = false,
    python = false
} = {}) {
    const normalizedSearch = String(search || '').trim().toLowerCase();
    const facetValues = [method.engine, method.execution, method.methodType]
        .filter(Boolean)
        .map(normalizeMethodFacetLabel);

    if (normalizedSearch) {
        const haystacks = [
            method.name,
            method.description,
            method.longDescription
        ]
            .map(value => String(value || '').toLowerCase());

        if (!haystacks.some(value => value.includes(normalizedSearch))) {
            return false;
        }
    }

    if (facet && facet !== 'all' && !facetValues.includes(facet)) {
        return false;
    }

    const execution = String(method.execution || '').toLowerCase();
    const engine = String(method.engine || '').toLowerCase();

    if (interactive && !execution.includes('interactive')) {
        return false;
    }

    if (python && !engine.includes('python')) {
        return false;
    }

    return true;
}

function buildMethodFacetCounts(methods) {
    const map = new Map();

    methods.forEach(method => {
        [method.engine, method.execution, method.methodType]
            .filter(Boolean)
            .forEach(raw => {
                const label = normalizeMethodFacetLabel(raw);
                if (!label) return;
                map.set(label, (map.get(label) || 0) + 1);
            });
    });

    return Array.from(map.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

async function fetchDataMethodListPage(page, limit) {
    const cacheKey = `page:${page}:limit:${limit}`;
    const cachedValue = getCacheValue(cacheKey);
    if (cachedValue) {
        return cachedValue;
    }

    // `listWithStringTag` 与参考项目一致，实测比 `listWithTag` 更快。
    const response = await api.get('/container/method/listWithStringTag', {
        params: { page, limit }
    });

    if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Failed to fetch data methods');
    }

    const payload = {
        total: response.data.page.totalCount,
        page,
        limit,
        data: response.data.page.list.map(mapDataMethodSummary)
    };

    setCacheValue(cacheKey, payload);
    return payload;
}

async function fetchSearchableDataMethodBatch(searchLimit) {
    const cacheKey = `search-batch:${searchLimit}`;
    const cachedValue = getCacheValue(cacheKey);
    if (cachedValue) {
        return cachedValue;
    }

    const response = await api.get('/container/method/listWithStringTag', {
        params: { page: 1, limit: searchLimit }
    });

    if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Failed to fetch searchable data methods');
    }

    const payload = {
        totalCount: response.data.page.totalCount,
        methods: response.data.page.list.map(mapDataMethodSummary)
    };

    setCacheValue(cacheKey, payload);
    return payload;
}

async function fetchAllDataMethods() {
    const cacheKey = 'all';
    const cachedValue = getCacheValue(`repository:${cacheKey}`);
    if (cachedValue) {
        return cachedValue;
    }

    if (dataMethodRepositoryPromise) {
        return dataMethodRepositoryPromise;
    }

    dataMethodRepositoryPromise = (async () => {
        const firstPage = await api.get('/container/method/listWithStringTag', {
            params: { page: 1, limit: 300 }
        });

        if (firstPage.data.code !== 0) {
            throw new Error(firstPage.data.msg || 'Failed to fetch data methods repository');
        }

        const totalCount = firstPage.data.page.totalCount || 0;
        const totalPages = Math.max(1, Math.ceil(totalCount / 300));
        const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

        const pageResponses = await Promise.all(pageNumbers.map(page =>
            api.get('/container/method/listWithStringTag', {
                params: { page, limit: 300 }
            })
        ));

        const methods = pageResponses.flatMap(response =>
            (Array.isArray(response.data?.page?.list) ? response.data.page.list : []).map(mapDataMethodSummary)
        );

        const payload = {
            total: totalCount,
            methods
        };

        dataMethodCache.set(`repository:${cacheKey}`, {
            value: payload,
            expiresAt: Date.now() + DATA_METHOD_REPOSITORY_CACHE_TTL_MS
        });

        return payload;
    })();

    try {
        return await dataMethodRepositoryPromise;
    } finally {
        dataMethodRepositoryPromise = null;
    }
}

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
            const content = Array.isArray(response.data?.data?.content)
                ? response.data.data.content
                : [];

            if (content.length > 0) {
                response.data.data.content = await Promise.all(content.map(item => enrichDataCenterItem(item)));
            }

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
        const facet = String(req.query.facet || 'all').trim();
        const interactive = String(req.query.interactive || 'false') === 'true';
        const python = String(req.query.python || 'false') === 'true';

        const requiresRepositoryFilter = Boolean(search) || facet !== 'all' || interactive || python;

        // 无搜索、无附加过滤时，直接分页请求后端 API
        if (!requiresRepositoryFilter) {
            const payload = await fetchDataMethodListPage(page, limit);
            res.json(payload);
            return;
        }

        const repository = await fetchAllDataMethods();
        const filteredMethods = repository.methods.filter(method => matchesMethodFilters(method, {
            search,
            facet,
            interactive,
            python
        }));

        const total = filteredMethods.length;
        const startIndex = (page - 1) * limit;
        const payload = {
            total,
            page,
            limit,
            data: filteredMethods.slice(startIndex, startIndex + limit),
            searchNote: null
        };
        res.json(payload);
    } catch (error) {
        console.error('Error fetching data methods:', error.message);
        res.status(500).json({ error: 'Failed to fetch data methods' });
    }
});

app.get('/api/datamethods/facets', async (req, res) => {
    try {
        const search = (req.query.q || '').trim().toLowerCase();
        const interactive = String(req.query.interactive || 'false') === 'true';
        const python = String(req.query.python || 'false') === 'true';

        const repository = await fetchAllDataMethods();
        const scopedMethods = repository.methods.filter(method => matchesMethodFilters(method, {
            search,
            interactive,
            python
        }));

        res.json({
            total: scopedMethods.length,
            facets: buildMethodFacetCounts(scopedMethods).slice(0, 8)
        });
    } catch (error) {
        console.error('Error fetching data method facets:', error.message);
        res.status(500).json({ error: 'Failed to fetch data method facets' });
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

function mapOgmsModelTags(itemClassifications) {
    if (!Array.isArray(itemClassifications)) {
        return [];
    }

    return itemClassifications
        .map(tagId => OGMS_MODEL_TAG_NAME_MAP[String(tagId)])
        .filter(Boolean);
}

function mapOgmsModelSummary(item, detail = null) {
    return {
        id: item.id || item.md5 || item.name,
        name: item.name,
        description: detail?.description || 'No description available',
        author: detail?.author || item.author || item.authorEmail || 'Unknown',
        tags: detail?.tags || [],
        viewCount: item.viewCount || 0,
        invokeCount: detail?.invokeCount || 0,
        shareCount: detail?.shareCount || 0,
        thumbsUpCount: detail?.thumbsUpCount || 0,
        deploy: detail?.deploy || false,
        online: detail?.online || false,
        healthText: detail?.healthText || null,
        status: detail?.status || item.status || null,
        createTime: detail?.createTime || item.createTime || null,
        lastModifyTime: detail?.lastModifyTime || item.lastModifyTime || null,
        md5: item.md5 || null
    };
}

function matchesOgmsModelFilters(model, {
    search = '',
    domain = 'all',
    online = false,
    publicOnly = false,
    institutionalOnly = false
} = {}) {
    const normalizedSearch = String(search || '').trim().toLowerCase();

    if (normalizedSearch) {
        const haystacks = [
            model.name,
            model.description,
            model.author
        ]
            .map(value => String(value || '').toLowerCase());

        if (!haystacks.some(value => value.includes(normalizedSearch))) {
            return false;
        }
    }

    const tags = Array.isArray(model.tags) ? model.tags : [];
    const statusText = String(model.status || '').toLowerCase();
    const isPublic = statusText.includes('public') || statusText.includes('catalog');
    const isInstitutional = statusText.includes('institutional') || statusText.includes('private');

    if (domain && domain !== 'all' && !tags.includes(domain)) {
        return false;
    }

    if (online && !model.online) {
        return false;
    }

    if (publicOnly && !isPublic) {
        return false;
    }

    if (institutionalOnly && !isInstitutional) {
        return false;
    }

    return true;
}

function buildOgmsDomainFacetCounts(models) {
    const map = new Map();

    models.forEach(model => {
        const tags = Array.isArray(model.tags) ? model.tags : [];
        tags.forEach(tag => {
            const label = String(tag || '').trim();
            if (!label) return;
            map.set(label, (map.get(label) || 0) + 1);
        });
    });

    return Array.from(map.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

async function fetchOgmsModelDetailByMd5(md5) {
    const cacheKey = String(md5);
    const cachedValue = getOgmsCacheValue(ogmsModelDetailCache, cacheKey);
    if (cachedValue) {
        return cachedValue;
    }

    const response = await ogmsApi.get(`/computableModel/ModelInfoAndClassifications_pid/${encodeURIComponent(md5)}`);
    const detail = response.data?.data;
    if (!detail) {
        throw new Error(`OGMS model detail not found for ${md5}`);
    }

    const mappedDetail = {
        description: detail.overview || detail.description || 'No description available',
        author: detail.author || detail.authorEmail || 'Unknown',
        tags: mapOgmsModelTags(detail.itemClassifications),
        invokeCount: detail.invokeCount || 0,
        shareCount: detail.shareCount || 0,
        thumbsUpCount: detail.thumbsUpCount || 0,
        deploy: !!detail.deploy,
        online: !!detail.checkedModel?.online,
        healthText: detail.checkedModel?.msg || null,
        createTime: detail.createTime || null,
        lastModifyTime: detail.lastModifyTime || null,
        status: detail.status || null
    };

    setOgmsCacheValue(ogmsModelDetailCache, cacheKey, mappedDetail, OGMS_MODEL_DETAIL_CACHE_TTL_MS);
    return mappedDetail;
}

async function fetchAllOgmsModelListItems() {
    const pageSize = 1000;
    const firstPage = await axios.post(
        OGMS_DEPLOYED_MODEL_URL,
        {
            asc: false,
            page: 1,
            pageSize,
            searchText: '',
            sortField: 'viewCount'
        },
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );

    const firstPayload = firstPage.data?.data;
    const total = firstPayload?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const items = Array.isArray(firstPayload?.content) ? firstPayload.content : [];

    if (totalPages === 1) {
        return { total, items };
    }

    const pageNumbers = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
    const remainingResponses = await Promise.all(pageNumbers.map(page =>
        axios.post(
            OGMS_DEPLOYED_MODEL_URL,
            {
                asc: false,
                page,
                pageSize,
                searchText: '',
                sortField: 'viewCount'
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        )
    ));

    remainingResponses.forEach(response => {
        const content = Array.isArray(response.data?.data?.content) ? response.data.data.content : [];
        items.push(...content);
    });

    return { total, items };
}

async function fetchOgmsModelRepository() {
    const cacheKey = 'repository:all';
    const cachedValue = getOgmsCacheValue(ogmsModelRepositoryCache, cacheKey);
    if (cachedValue) {
        return cachedValue;
    }

    if (ogmsModelRepositoryPromise) {
        return ogmsModelRepositoryPromise;
    }

    ogmsModelRepositoryPromise = (async () => {
        const { total, items } = await fetchAllOgmsModelListItems();

        const models = await mapInBatches(items, 200, async item => {
            let detail = null;
            if (item.md5) {
                try {
                    detail = await fetchOgmsModelDetailByMd5(item.md5);
                } catch (error) {
                    console.warn(`Failed to enrich OGMS model ${item.name}:`, error.message);
                }
            }
            return mapOgmsModelSummary(item, detail);
        });

        const payload = { total, models };
        setOgmsCacheValue(ogmsModelRepositoryCache, cacheKey, payload, OGMS_MODEL_REPOSITORY_CACHE_TTL_MS);
        return payload;
    })();

    try {
        return await ogmsModelRepositoryPromise;
    } finally {
        ogmsModelRepositoryPromise = null;
    }
}

async function fetchOgmsModelListPage(page, limit, searchText) {
    const cacheKey = `${page}:${limit}:${searchText || ''}`;
    const cachedValue = getOgmsCacheValue(ogmsModelListCache, cacheKey);
    if (cachedValue) {
        return cachedValue;
    }

    const response = await axios.post(
        OGMS_DEPLOYED_MODEL_URL,
        {
            asc: false,
            page,
            pageSize: limit,
            searchText: searchText || '',
            sortField: 'viewCount'
        },
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );

    const pageData = response.data?.data;
    const content = Array.isArray(pageData?.content) ? pageData.content : [];
    const models = await Promise.all(
        content.map(async item => {
            let detail = null;

            if (item.md5) {
                try {
                    detail = await fetchOgmsModelDetailByMd5(item.md5);
                } catch (error) {
                    console.warn(`Failed to enrich OGMS model ${item.name}:`, error.message);
                }
            }

            return mapOgmsModelSummary(item, detail);
        })
    );

    const payload = {
        total: pageData?.total || models.length,
        page,
        limit,
        data: models
    };

    setOgmsCacheValue(ogmsModelListCache, cacheKey, payload, OGMS_MODEL_LIST_CACHE_TTL_MS);
    return payload;
}

// List OGMS Models (remote-first, local JSON fallback)
app.get('/api/ogms/models', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const search = (req.query.q || '').trim();
        const domain = String(req.query.domain || 'all').trim();
        const online = String(req.query.online || 'false') === 'true';
        const publicOnly = String(req.query.public || 'false') === 'true';
        const institutionalOnly = String(req.query.institutional || 'false') === 'true';
        const requiresRepositoryFilter = Boolean(search) || domain !== 'all' || online || publicOnly || institutionalOnly;

        if (requiresRepositoryFilter) {
            const repository = await fetchOgmsModelRepository();
            const filteredModels = repository.models.filter(model => matchesOgmsModelFilters(model, {
                search,
                domain,
                online,
                publicOnly,
                institutionalOnly
            }));

            const total = filteredModels.length;
            const startIndex = (page - 1) * limit;

            return res.json({
                total,
                page,
                limit,
                data: filteredModels.slice(startIndex, startIndex + limit)
            });
        }

        try {
            const payload = await fetchOgmsModelListPage(page, limit, search);
            return res.json(payload);
        } catch (remoteError) {
            console.warn('Remote OGMS model list failed, fallback to local computeModel.json:', remoteError.message);
        }

        const normalizedSearch = search.toLowerCase();
        let models = loadModelData();

        if (normalizedSearch) {
            models = models.filter(m =>
                m.name.toLowerCase().includes(normalizedSearch) ||
                (m.description && m.description.toLowerCase().includes(normalizedSearch))
            );
        }

        const total = models.length;
        const startIndex = (page - 1) * limit;
        const paginatedModels = models.slice(startIndex, startIndex + limit);

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

app.get('/api/ogms/models/facets', async (req, res) => {
    try {
        const search = (req.query.q || '').trim();
        const online = String(req.query.online || 'false') === 'true';
        const publicOnly = String(req.query.public || 'false') === 'true';
        const institutionalOnly = String(req.query.institutional || 'false') === 'true';

        const repository = await fetchOgmsModelRepository();
        const scopedModels = repository.models.filter(model => matchesOgmsModelFilters(model, {
            search,
            online,
            publicOnly,
            institutionalOnly
        }));

        res.json({
            total: scopedModels.length,
            domains: buildOgmsDomainFacetCounts(scopedModels).slice(0, 8)
        });
    } catch (error) {
        console.error('Error fetching OGMS model facets:', error.message);
        res.status(500).json({ error: 'Failed to fetch model facets' });
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

async function startServer() {
    await initDatabase();

    app.listen(PORT, () => {
        const databaseInfo = getDatabaseInfo();
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`DataMethod API: ${API_BASE_URL}`);
        console.log(`OGMS Model API: ${OGMS_PORTAL_URL}`);
        console.log(`MongoDB: ${databaseInfo.uri}/${databaseInfo.dbName}`);
        console.log(`GitHub OAuth callback: http://localhost:${PORT}/api/auth/github/callback`);
        console.log(`Google OAuth callback: http://localhost:${PORT}/api/auth/google/callback`);
        console.log(`Jupyter API: http://localhost:${PORT}/api/jupyter`);
    });
}

startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
