/**
 * Jupyter Management Routes (Docker Mode)
 * 使用 Docker 容器部署 JupyterLab
 */
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const router = express.Router();

// 文件上传配置
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// 数据服务器配置
const DATA_SERVER_URL = process.env.DATA_SERVER_URL || 'http://221.224.35.86:38083/data';
const API_TOKEN = process.env.API_TOKEN || '883ada2fc996ab9487bed7a3ba21d2f1';

// 配置
const JUPYTER_BASE_PORT = 8888;

// 可用的 Jupyter 镜像配置
const JUPYTER_IMAGES = {
    'geomodel-jupyter': {
        name: 'geomodel-jupyter:latest',
        label: 'Python 3.11 + GeoModel SDK',
        description: '预装 scipy, geopandas, rasterio, PyGeoModel SDK 等地理数据处理库',
        python: '3.11',
        features: ['scipy', 'geopandas', 'rasterio', 'PyGeoModel SDK'],
        default: true
    },
    'geomodel-jupyter-py39': {
        name: 'geomodel-jupyter-py39:latest',
        label: 'Python 3.9 纯净版',
        description: '轻量级环境，仅安装基础 Jupyter 和 GeoModel 扩展',
        python: '3.9',
        features: ['基础 Jupyter'],
        default: false
    }
};

// 默认镜像
const DEFAULT_IMAGE = 'geomodel-jupyter';
const JUPYTER_IMAGE = process.env.JUPYTER_IMAGE || JUPYTER_IMAGES[DEFAULT_IMAGE].name;

// 从 HOST_IP 自动生成 Jupyter 访问地址
const HOST_IP = process.env.HOST_IP || 'localhost';
const JUPYTER_HOST = process.env.JUPYTER_HOST || HOST_IP;
let USER_DATA_DIR = process.env.USER_DATA_DIR || path.join(__dirname, '..', 'jupyter-data');
if (!path.isAbsolute(USER_DATA_DIR)) {
    USER_DATA_DIR = path.join(__dirname, '..', USER_DATA_DIR);
}

// GeoModel 扩展路径
const GEOMODEL_EXTENSION_DIR = path.join(__dirname, '..', 'docker');
const GEOMODEL_EXTENSION_WHL = 'jupyterlab_geomodel-0.1.0-py3-none-any.whl';

// 用户 Jupyter 容器信息存储
const jupyterContainers = new Map();

// 确保用户数据目录存在
if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

// 生成随机 token
function generateToken() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 48; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

// 执行 Docker 命令
function runDockerCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stderr });
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

// 检查 Docker 是否可用
async function checkDockerAvailable() {
    try {
        await runDockerCommand('docker --version');
        return true;
    } catch (e) {
        return false;
    }
}

// 检查容器是否在运行
async function isContainerRunning(containerName) {
    try {
        const result = await runDockerCommand(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`);
        return result.includes(containerName);
    } catch (e) {
        return false;
    }
}

// 获取容器的端口映射
async function getContainerPort(containerName) {
    try {
        const result = await runDockerCommand(`docker port ${containerName} 8888`);
        const match = result.match(/:(\d+)/);
        return match ? parseInt(match[1]) : null;
    } catch (e) {
        return null;
    }
}

// 查找可用端口
async function findAvailablePort(startPort) {
    const net = require('net');
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
}

// 生成容器名称（基于用户和项目）
function getContainerName(username, projectName) {
    if (projectName) {
        return `jupyter-${username}-${projectName}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
    return `jupyter-${username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/**
 * GET /api/jupyter/status
 * 获取当前项目的 Jupyter 状态
 */
router.get('/status', async (req, res) => {
    const userId = req.user.userId;
    const username = req.user.username;
    const { projectName } = req.query;
    
    if (!projectName) {
        return res.json({
            status: 'stopped',
            message: 'No project specified'
        });
    }
    
    const containerName = getContainerName(username, projectName);
    const containerKey = `${userId}-${projectName}`;
    
    try {
        const running = await isContainerRunning(containerName);
        
        if (!running) {
            jupyterContainers.delete(containerKey);
            return res.json({
                status: 'stopped',
                message: 'No Jupyter container running for this project'
            });
        }
        
        // 获取存储的信息或从容器获取
        let containerInfo = jupyterContainers.get(containerKey);
        if (!containerInfo) {
            const port = await getContainerPort(containerName);
            if (port) {
                containerInfo = {
                    port,
                    token: 'check-container-logs',
                    url: `http://${JUPYTER_HOST}:${port}/lab`
                };
            }
        }
        
        if (containerInfo) {
            return res.json({
                status: 'running',
                url: containerInfo.url,
                token: containerInfo.token,
                port: containerInfo.port,
                containerName,
                projectName
            });
        }
        
        return res.json({
            status: 'running',
            message: 'Container is running but unable to get details',
            containerName,
            projectName
        });
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({
            error: 'Failed to check Jupyter status',
            message: error.message
        });
    }
});

/**
 * GET /api/jupyter/images
 * 获取可用的 Jupyter 镜像列表
 */
router.get('/images', async (req, res) => {
    try {
        // 检查每个镜像是否已存在
        const imagesWithStatus = await Promise.all(
            Object.entries(JUPYTER_IMAGES).map(async ([key, config]) => {
                let available = false;
                try {
                    const result = await runDockerCommand(`docker images ${config.name} --format "{{.Repository}}"`);
                    available = result.length > 0;
                } catch (e) {
                    available = false;
                }
                return {
                    id: key,
                    ...config,
                    available
                };
            })
        );
        
        res.json({
            images: imagesWithStatus,
            default: DEFAULT_IMAGE
        });
    } catch (error) {
        console.error('Error getting images:', error);
        res.status(500).json({ error: 'Failed to get image list' });
    }
});

/**
 * POST /api/jupyter/start
 * 启动 JupyterLab Docker 容器（基于项目）
 */
router.post('/start', async (req, res) => {
    const userId = req.user.userId;
    const username = req.user.username;
    const { projectName, imageId } = req.body; // 从请求中获取项目名和镜像ID
    
    if (!projectName) {
        return res.status(400).json({ error: '需要指定项目名称' });
    }
    
    // 确定使用的镜像
    const selectedImage = JUPYTER_IMAGES[imageId] || JUPYTER_IMAGES[DEFAULT_IMAGE];
    const imageName = selectedImage.name;
    console.log(`Using image: ${imageName} (${selectedImage.label})`);
    
    const containerName = getContainerName(username, projectName);
    const containerKey = `${userId}-${projectName}`;
    
    try {
        // 检查 Docker 是否可用
        const dockerAvailable = await checkDockerAvailable();
        if (!dockerAvailable) {
            return res.status(500).json({
                error: 'Docker not available',
                message: '请确保 Docker Desktop 已启动'
            });
        }
        
        // 检查项目是否存在
        const projectDir = path.join(USER_DATA_DIR, username, projectName);
        if (!fs.existsSync(projectDir)) {
            return res.status(404).json({ error: '项目不存在' });
        }
        
        // 检查容器是否已在运行
        const running = await isContainerRunning(containerName);
        if (running) {
            const containerInfo = jupyterContainers.get(containerKey);
            if (containerInfo) {
                return res.json({
                    status: 'already_running',
                    url: containerInfo.url,
                    token: containerInfo.token,
                    port: containerInfo.port,
                    containerName,
                    projectName
                });
            }
            // 容器在运行但没有信息，停止后重新启动
            await runDockerCommand(`docker stop ${containerName}`);
            await runDockerCommand(`docker rm ${containerName}`);
        }
        
        // 生成 token 和查找端口
        const token = generateToken();
        const port = await findAvailablePort(JUPYTER_BASE_PORT);
        
        // 将 Windows 项目路径转换为 Docker 可用的格式
        let dockerVolumePath = projectDir;
        if (process.platform === 'win32') {
            dockerVolumePath = projectDir.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, letter) => `/${letter.toLowerCase()}`);
        }
        
        console.log(`Starting JupyterLab container for project ${projectName}...`);
        console.log(`  Container: ${containerName}`);
        console.log(`  Port: ${port}`);
        console.log(`  Volume: ${dockerVolumePath}:/home/jovyan/work`);
        
        // 启动 Docker 容器 - 使用预装了扩展的自定义镜像
        // 项目目录挂载到 /home/jovyan/work
        const dockerCommand = [
            'docker run -d',
            `--name ${containerName}`,
            `-p ${port}:8888`,
            `-v "${dockerVolumePath}:/home/jovyan/work"`,
            '-w /home/jovyan/work',
            '-e JUPYTER_ENABLE_LAB=yes',
            `-e JUPYTER_TOKEN=${token}`,
            '--user root',
            '-e CHOWN_HOME=yes',
            '-e CHOWN_HOME_OPTS="-R"',
            '-e GRANT_SUDO=yes',
            imageName,  // 使用选择的镜像
            'start-notebook.sh'
        ].join(' ');
        
        console.log('Docker command:', dockerCommand);
        
        const containerId = await runDockerCommand(dockerCommand);
        console.log(`Container started: ${containerId.substring(0, 12)}`);
        
        // URL 使用配置的主机地址，支持局域网访问
        // 注意：这里的 token 是 Jupyter 的认证 token
        // 用户的 GeoModelWeb JWT 需要从请求头获取，传给扩展用于访问收藏 API
        const authHeader = req.headers.authorization || req.headers['authorization'] || '';
        const jwtToken = authHeader.replace('Bearer ', '');
        console.log('  JWT Token for extension:', jwtToken ? 'present' : 'missing');
        // 添加 container 和 project 参数，让前端可以知道当前的用户和项目
        const url = `http://${JUPYTER_HOST}:${port}/lab?token=${token}&geomodel_token=${encodeURIComponent(jwtToken)}&container=${encodeURIComponent(containerName)}&user=${encodeURIComponent(username)}&project=${encodeURIComponent(projectName || '')}`;
        
        // 存储容器信息
        jupyterContainers.set(containerKey, {
            containerId: containerId.substring(0, 12),
            containerName,
            port,
            token,
            url,
            username,
            projectName,
            startTime: new Date()
        });
        
        // 等待 Jupyter 启动
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        res.json({
            status: 'started',
            url,
            token,
            port,
            containerName,
            projectName,
            message: 'JupyterLab container is starting...'
        });
    } catch (error) {
        console.error('Error starting Jupyter container:', error);
        res.status(500).json({
            error: 'Failed to start JupyterLab',
            message: error.stderr || error.message || 'Unknown error'
        });
    }
});

/**
 * GET /api/jupyter/container-by-port/:port
 * 通过端口号查询容器信息（用于扩展自动识别当前容器）
 */
router.get('/container-by-port/:port', async (req, res) => {
    const port = parseInt(req.params.port);
    
    if (!port || isNaN(port)) {
        return res.status(400).json({ error: 'Invalid port number' });
    }
    
    try {
        // 从存储的容器信息中查找
        for (const [key, info] of jupyterContainers.entries()) {
            if (info.port === port) {
                return res.json({
                    found: true,
                    containerName: info.containerName,
                    userName: info.username,
                    projectName: info.projectName,
                    port: info.port
                });
            }
        }
        
        // 如果内存中没有，尝试通过 docker 命令查找
        try {
            const result = await runDockerCommand(
                `docker ps --filter "publish=${port}" --format "{{.Names}}"`
            );
            if (result) {
                const containerName = result.trim().split('\n')[0];
                const match = containerName.match(/^jupyter-([^-]+)-(.+)$/i);
                if (match) {
                    return res.json({
                        found: true,
                        containerName: containerName,
                        userName: match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase(),
                        projectName: match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase(),
                        port: port
                    });
                }
            }
        } catch (e) {
            console.log('[Jupyter] Docker query failed:', e.message);
        }
        
        res.json({ found: false });
    } catch (error) {
        console.error('Error finding container by port:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/jupyter/stop
 * 停止 JupyterLab Docker 容器（基于项目）
 */
router.post('/stop', async (req, res) => {
    const userId = req.user.userId;
    const username = req.user.username;
    const { projectName } = req.body;
    
    if (!projectName) {
        return res.status(400).json({ error: '需要指定项目名称' });
    }
    
    const containerName = getContainerName(username, projectName);
    const containerKey = `${userId}-${projectName}`;
    
    try {
        const running = await isContainerRunning(containerName);
        
        if (!running) {
            jupyterContainers.delete(containerKey);
            return res.json({
                status: 'not_running',
                message: 'No Jupyter container to stop'
            });
        }
        
        console.log(`Stopping container ${containerName}...`);
        
        // 停止并删除容器
        await runDockerCommand(`docker stop ${containerName}`);
        await runDockerCommand(`docker rm ${containerName}`);
        
        jupyterContainers.delete(containerKey);
        
        res.json({
            status: 'stopped',
            message: 'JupyterLab container stopped successfully'
        });
    } catch (error) {
        console.error('Error stopping Jupyter container:', error);
        res.status(500).json({
            error: 'Failed to stop JupyterLab',
            message: error.stderr || error.message
        });
    }
});

/**
 * 读取项目元信息
 */
function getProjectMeta(projectPath) {
    const metaPath = path.join(projectPath, '.project.json');
    if (fs.existsSync(metaPath)) {
        try {
            return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch (e) {
            return {};
        }
    }
    return {};
}

/**
 * 保存项目元信息
 */
function saveProjectMeta(projectPath, meta) {
    const metaPath = path.join(projectPath, '.project.json');
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

/**
 * GET /api/jupyter/projects
 * 获取用户的项目列表（以文件夹为单位）
 */
router.get('/projects', (req, res) => {
    const username = req.user.username;
    const userDir = path.join(USER_DATA_DIR, username);
    
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
        return res.json({ projects: [] });
    }
    
    try {
        const items = fs.readdirSync(userDir, { withFileTypes: true });
        const projects = items
            .filter(item => item.isDirectory() && !item.name.startsWith('.') && item.name !== '__pycache__')
            .map(item => {
                const projectPath = path.join(userDir, item.name);
                const stats = fs.statSync(projectPath);
                
                // 读取项目元信息
                const meta = getProjectMeta(projectPath);
                
                // 统计项目内的 notebook 数量
                const projectFiles = fs.readdirSync(projectPath);
                const notebookCount = projectFiles.filter(f => f.endsWith('.ipynb')).length;
                const fileCount = projectFiles.filter(f => !f.startsWith('.')).length;
                
                // 获取最新修改时间（遍历所有文件）
                let latestModified = stats.mtime;
                projectFiles.forEach(f => {
                    try {
                        const filePath = path.join(projectPath, f);
                        const fileStats = fs.statSync(filePath);
                        if (fileStats.mtime > latestModified) {
                            latestModified = fileStats.mtime;
                        }
                    } catch (e) {}
                });
                
                return {
                    name: item.name,
                    description: meta.description || '',
                    notebookCount,
                    fileCount,
                    modifiedAt: latestModified,
                    createdAt: stats.birthtime,
                    isPublic: meta.isPublic || false,
                    forkedFrom: meta.forkedFrom || null,  // { owner, projectName }
                    owner: username
                };
            })
            .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
        
        res.json({ projects });
    } catch (error) {
        console.error('Error listing projects:', error);
        res.json({ projects: [] });
    }
});

/**
 * POST /api/jupyter/projects
 * 创建新项目
 */
router.post('/projects', (req, res) => {
    const username = req.user.username;
    const { name, description, isPublic } = req.body;
    
    if (!name || !name.trim()) {
        return res.status(400).json({ error: '项目名称不能为空' });
    }
    
    // 验证项目名称（只允许字母、数字、中文、下划线、连字符）
    const safeName = name.trim();
    if (!/^[\w\u4e00-\u9fa5\-]+$/.test(safeName)) {
        return res.status(400).json({ error: '项目名称只能包含字母、数字、中文、下划线和连字符' });
    }
    
    const userDir = path.join(USER_DATA_DIR, username);
    const projectDir = path.join(userDir, safeName);
    
    if (fs.existsSync(projectDir)) {
        return res.status(400).json({ error: '项目已存在' });
    }
    
    try {
        fs.mkdirSync(projectDir, { recursive: true });
        
        // 创建项目元信息文件
        const projectMeta = {
            name: safeName,
            description: description || '',
            isPublic: isPublic || false,
            createdAt: new Date().toISOString(),
            createdBy: username
        };
        saveProjectMeta(projectDir, projectMeta);
        
        res.json({
            status: 'created',
            project: {
                name: safeName,
                description: description || '',
                notebookCount: 0,
                fileCount: 0,
                modifiedAt: new Date(),
                createdAt: new Date(),
                isPublic: isPublic || false,
                forkedFrom: null,
                owner: username
            }
        });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: '创建项目失败' });
    }
});

/**
 * GET /api/jupyter/projects/:projectName
 * 获取项目详情及其文件列表
 */
router.get('/projects/:projectName', (req, res) => {
    const username = req.user.username;
    const { projectName } = req.params;
    const userDir = path.join(USER_DATA_DIR, username);
    const projectDir = path.join(userDir, projectName);
    
    if (!fs.existsSync(projectDir)) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    try {
        const stats = fs.statSync(projectDir);
        const files = fs.readdirSync(projectDir);
        
        // 读取项目元信息
        let projectMeta = { name: projectName };
        const metaPath = path.join(projectDir, '.project.json');
        if (fs.existsSync(metaPath)) {
            try {
                projectMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            } catch (e) {}
        }
        
        // 获取所有文件信息
        const fileList = files
            .filter(f => !f.startsWith('.')) // 隐藏文件不显示
            .map(f => {
                const filePath = path.join(projectDir, f);
                const fileStats = fs.statSync(filePath);
                const isNotebook = f.endsWith('.ipynb');
                
                let notebookInfo = null;
                if (isNotebook) {
                    try {
                        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        notebookInfo = {
                            cellCount: content.cells ? content.cells.length : 0,
                            language: content.metadata?.kernelspec?.language || 'python'
                        };
                    } catch (e) {
                        notebookInfo = { cellCount: 0, language: 'unknown' };
                    }
                }
                
                return {
                    name: f,
                    type: isNotebook ? 'notebook' : (fileStats.isDirectory() ? 'folder' : 'file'),
                    size: fileStats.size,
                    modifiedAt: fileStats.mtime,
                    ...(notebookInfo && { notebook: notebookInfo })
                };
            })
            .sort((a, b) => {
                // notebooks 优先，然后按修改时间排序
                if (a.type === 'notebook' && b.type !== 'notebook') return -1;
                if (a.type !== 'notebook' && b.type === 'notebook') return 1;
                return new Date(b.modifiedAt) - new Date(a.modifiedAt);
            });
        
        res.json({
            project: {
                ...projectMeta,
                modifiedAt: stats.mtime,
                createdAt: stats.birthtime
            },
            files: fileList
        });
    } catch (error) {
        console.error('Error getting project details:', error);
        res.status(500).json({ error: '获取项目详情失败' });
    }
});

/**
 * GET /api/jupyter/projects/:projectName/folder
 * 获取项目中某个文件夹的内容
 * Query: path - 相对于项目根目录的文件夹路径
 */
router.get('/projects/:projectName/folder', (req, res) => {
    const username = req.user.username;
    const { projectName } = req.params;
    const folderPath = req.query.path || '';
    const userDir = path.join(USER_DATA_DIR, username);
    const projectDir = path.join(userDir, projectName);
    const targetDir = path.join(projectDir, folderPath);
    
    // 安全检查：确保目标路径在项目目录内
    const realTarget = path.resolve(targetDir);
    const realProject = path.resolve(projectDir);
    if (!realTarget.startsWith(realProject)) {
        return res.status(403).json({ error: '访问被拒绝' });
    }
    
    if (!fs.existsSync(targetDir)) {
        return res.status(404).json({ error: '文件夹不存在' });
    }
    
    try {
        const files = fs.readdirSync(targetDir);
        
        const fileList = files
            .filter(f => !f.startsWith('.'))
            .map(f => {
                const filePath = path.join(targetDir, f);
                const fileStats = fs.statSync(filePath);
                const isNotebook = f.endsWith('.ipynb');
                
                let notebookInfo = null;
                if (isNotebook) {
                    try {
                        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        notebookInfo = {
                            cellCount: content.cells ? content.cells.length : 0,
                            language: content.metadata?.kernelspec?.language || 'python'
                        };
                    } catch (e) {
                        notebookInfo = { cellCount: 0, language: 'unknown' };
                    }
                }
                
                return {
                    name: f,
                    type: isNotebook ? 'notebook' : (fileStats.isDirectory() ? 'folder' : 'file'),
                    size: fileStats.size,
                    modifiedAt: fileStats.mtime,
                    path: folderPath ? `${folderPath}/${f}` : f,
                    ...(notebookInfo && { notebook: notebookInfo })
                };
            })
            .sort((a, b) => {
                // 文件夹优先，然后是 notebooks
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                if (a.type === 'notebook' && b.type !== 'notebook') return -1;
                if (a.type !== 'notebook' && b.type === 'notebook') return 1;
                return a.name.localeCompare(b.name);
            });
        
        res.json({ files: fileList, folderPath });
    } catch (error) {
        console.error('Error reading folder:', error);
        res.status(500).json({ error: '读取文件夹失败' });
    }
});

/**
 * GET /api/jupyter/projects/:projectName/files/:filePath/content
 * 获取文本文件内容
 * filePath 需要被 encodeURIComponent 编码
 */
router.get('/projects/:projectName/files/:filePath/content', (req, res) => {
    const username = req.user.username;
    const { projectName, filePath } = req.params;
    const userDir = path.join(USER_DATA_DIR, username);
    const projectDir = path.join(userDir, projectName);
    const fullPath = path.join(projectDir, filePath);
    
    // 安全检查：确保路径在项目目录内
    const realPath = path.resolve(fullPath);
    const realProject = path.resolve(projectDir);
    if (!realPath.startsWith(realProject)) {
        return res.status(403).json({ error: '访问被拒绝' });
    }
    
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: '文件不存在' });
    }
    
    try {
        const stats = fs.statSync(fullPath);
        
        // 限制文件大小（最大 1MB）
        if (stats.size > 1024 * 1024) {
            return res.status(400).json({ error: '文件太大，无法预览' });
        }
        
        const content = fs.readFileSync(fullPath, 'utf8');
        res.json({ 
            content,
            size: stats.size,
            modifiedAt: stats.mtime
        });
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({ error: '读取文件失败' });
    }
});

/**
 * DELETE /api/jupyter/projects/:projectName
 * 删除项目
 */
router.delete('/projects/:projectName', (req, res) => {
    const username = req.user.username;
    const { projectName } = req.params;
    const userDir = path.join(USER_DATA_DIR, username);
    const projectDir = path.join(userDir, projectName);
    
    if (!fs.existsSync(projectDir)) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    try {
        // 递归删除目录
        fs.rmSync(projectDir, { recursive: true, force: true });
        res.json({ status: 'deleted', message: '项目已删除' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: '删除项目失败' });
    }
});

/**
 * PUT /api/jupyter/projects/:projectName
 * 更新项目（重命名和/或更新描述）
 */
router.put('/projects/:projectName', (req, res) => {
    const username = req.user.username;
    const { projectName } = req.params;
    const { newName, description } = req.body;
    
    const userDir = path.join(USER_DATA_DIR, username);
    let currentPath = path.join(userDir, projectName);
    
    if (!fs.existsSync(currentPath)) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    try {
        let finalName = projectName;
        
        // 处理重命名
        if (newName && newName.trim() && newName.trim() !== projectName) {
            const safeName = newName.trim();
            if (!/^[\w\u4e00-\u9fa5\-]+$/.test(safeName)) {
                return res.status(400).json({ error: '项目名称只能包含字母、数字、中文、下划线和连字符' });
            }
            
            const newPath = path.join(userDir, safeName);
            if (fs.existsSync(newPath)) {
                return res.status(400).json({ error: '目标名称已存在' });
            }
            
            fs.renameSync(currentPath, newPath);
            currentPath = newPath;
            finalName = safeName;
        }
        
        // 更新项目元信息（包括 description）
        const metaPath = path.join(currentPath, '.project.json');
        let meta = {};
        if (fs.existsSync(metaPath)) {
            meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }
        
        meta.name = finalName;
        if (description !== undefined) {
            meta.description = description;
        }
        
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        
        res.json({ 
            status: 'updated', 
            name: finalName,
            description: meta.description || ''
        });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: '更新失败' });
    }
});

/**
 * GET /api/jupyter/projects/:projectName/notebooks/:notebookName/preview
 * 预览 Notebook 内容（不需要启动 Jupyter）
 * notebookName 需要被 encodeURIComponent 编码（前端已处理）
 */
router.get('/projects/:projectName/notebooks/:notebookName/preview', (req, res) => {
    const username = req.user.username;
    const { projectName, notebookName } = req.params;
    const userDir = path.join(USER_DATA_DIR, username);
    const projectDir = path.join(userDir, projectName);
    // notebookName 已被 decodeURIComponent 自动解码
    const notebookPath = path.join(projectDir, notebookName);
    
    // 安全检查：确保路径在项目目录内
    const realNotebook = path.resolve(notebookPath);
    const realProject = path.resolve(projectDir);
    if (!realNotebook.startsWith(realProject)) {
        return res.status(403).json({ error: '访问被拒绝' });
    }
    
    if (!fs.existsSync(notebookPath)) {
        return res.status(404).json({ error: 'Notebook 不存在' });
    }
    
    try {
        const content = JSON.parse(fs.readFileSync(notebookPath, 'utf8'));
        
        // 简化预览内容（包含输出）
        const preview = {
            name: notebookName,
            metadata: {
                kernelspec: content.metadata?.kernelspec,
                language_info: content.metadata?.language_info
            },
            cellCount: content.cells?.length || 0,
            cells: (content.cells || []).slice(0, 20).map((cell, index) => {
                // 处理输出
                let outputs = [];
                if (cell.outputs && cell.outputs.length > 0) {
                    outputs = cell.outputs.map(output => {
                        if (output.output_type === 'stream') {
                            return {
                                type: 'stream',
                                name: output.name,
                                text: Array.isArray(output.text) ? output.text.join('') : output.text
                            };
                        } else if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
                            const data = output.data || {};
                            return {
                                type: output.output_type,
                                text: data['text/plain'] ? (Array.isArray(data['text/plain']) ? data['text/plain'].join('') : data['text/plain']) : null,
                                html: data['text/html'] ? (Array.isArray(data['text/html']) ? data['text/html'].join('') : data['text/html']) : null,
                                image: data['image/png'] || null
                            };
                        } else if (output.output_type === 'error') {
                            return {
                                type: 'error',
                                ename: output.ename,
                                evalue: output.evalue,
                                traceback: output.traceback ? output.traceback.join('\n') : ''
                            };
                        }
                        return { type: output.output_type };
                    });
                }
                return {
                    index,
                    type: cell.cell_type,
                    source: Array.isArray(cell.source) ? cell.source.join('') : cell.source,
                    execution_count: cell.execution_count,
                    outputs
                };
            })
        };
        
        res.json(preview);
    } catch (error) {
        console.error('Error reading notebook:', error);
        res.status(500).json({ error: '读取 Notebook 失败' });
    }
});

/**
 * GET /api/jupyter/check
 * 检查 Docker 是否可用
 */
router.get('/check', async (req, res) => {
    const dockerAvailable = await checkDockerAvailable();
    
    if (dockerAvailable) {
        try {
            const images = await runDockerCommand(`docker images ${JUPYTER_IMAGE} --format "{{.Repository}}"`);
            const imageExists = images.includes('jupyter/scipy-notebook');
            
            res.json({
                available: true,
                imageExists,
                image: JUPYTER_IMAGE,
                message: imageExists 
                    ? 'Docker and Jupyter image are ready' 
                    : `Jupyter image not found. Run: docker pull ${JUPYTER_IMAGE}`
            });
        } catch (e) {
            res.json({
                available: true,
                imageExists: false,
                image: JUPYTER_IMAGE,
                message: `Run: docker pull ${JUPYTER_IMAGE}`
            });
        }
    } else {
        res.json({
            available: false,
            message: 'Docker is not available. Please start Docker Desktop.'
        });
    }
});

/**
 * POST /api/jupyter/pull-image
 * 拉取 Jupyter Docker 镜像
 */
router.post('/pull-image', async (req, res) => {
    try {
        const dockerAvailable = await checkDockerAvailable();
        if (!dockerAvailable) {
            return res.status(500).json({
                error: 'Docker not available',
                message: '请先启动 Docker Desktop'
            });
        }
        
        console.log(`Pulling image ${JUPYTER_IMAGE}...`);
        
        exec(`docker pull ${JUPYTER_IMAGE}`, (error, stdout, stderr) => {
            if (error) {
                console.error('Error pulling image:', error);
            } else {
                console.log('Image pulled successfully');
            }
        });
        
        res.json({
            status: 'pulling',
            image: JUPYTER_IMAGE,
            message: '正在拉取镜像，这可能需要几分钟...'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to pull image',
            message: error.message
        });
    }
});

// ========== My Model / My Data Method 存储 ==========

// 用户收藏数据存储目录
const USER_FAVORITES_FILE = path.join(USER_DATA_DIR, 'user-favorites.json');

// 读取用户收藏数据
function loadUserFavorites() {
    try {
        if (fs.existsSync(USER_FAVORITES_FILE)) {
            return JSON.parse(fs.readFileSync(USER_FAVORITES_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading user favorites:', e);
    }
    return {};
}

// 保存用户收藏数据
function saveUserFavorites(data) {
    try {
        fs.writeFileSync(USER_FAVORITES_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving user favorites:', e);
    }
}

/**
 * GET /api/jupyter/my-models
 * 获取用户收藏的模型列表
 */
router.get('/my-models', (req, res) => {
    const userId = req.user.userId;
    const favorites = loadUserFavorites();
    const userModels = favorites[userId]?.models || [];
    res.json({ models: userModels });
});

/**
 * POST /api/jupyter/my-models
 * 添加模型到用户收藏
 */
router.post('/my-models', (req, res) => {
    const userId = req.user.userId;
    const { model } = req.body;
    
    if (!model || !model.id) {
        return res.status(400).json({ error: '无效的模型数据' });
    }
    
    const favorites = loadUserFavorites();
    if (!favorites[userId]) {
        favorites[userId] = { models: [], dataMethods: [] };
    }
    
    // 检查是否已存在
    const exists = favorites[userId].models.some(m => m.id === model.id);
    if (exists) {
        return res.status(400).json({ error: '模型已在列表中' });
    }
    
    // 添加模型（只保存必要信息）
    favorites[userId].models.push({
        id: model.id,
        name: model.name,
        description: model.description || '',
        author: model.author || 'OpenGeoLab',
        addedAt: new Date().toISOString()
    });
    
    saveUserFavorites(favorites);
    res.json({ status: 'added', model });
});

/**
 * DELETE /api/jupyter/my-models/:id
 * 从用户收藏中移除模型
 */
router.delete('/my-models/:id', (req, res) => {
    const userId = req.user.userId;
    const modelId = req.params.id;
    
    const favorites = loadUserFavorites();
    if (!favorites[userId]) {
        return res.status(404).json({ error: '模型不存在' });
    }
    
    // 使用 String() 转换确保类型一致
    const index = favorites[userId].models.findIndex(m => String(m.id) === String(modelId));
    if (index === -1) {
        return res.status(404).json({ error: '模型不存在' });
    }
    
    favorites[userId].models.splice(index, 1);
    saveUserFavorites(favorites);
    res.json({ status: 'removed' });
});

/**
 * GET /api/jupyter/my-datamethods
 * 获取用户收藏的数据方法列表
 */
router.get('/my-datamethods', (req, res) => {
    const userId = req.user.userId;
    const favorites = loadUserFavorites();
    const userDataMethods = favorites[userId]?.dataMethods || [];
    res.json({ dataMethods: userDataMethods });
});

/**
 * POST /api/jupyter/my-datamethods
 * 添加数据方法到用户收藏
 */
router.post('/my-datamethods', (req, res) => {
    const userId = req.user.userId;
    const { dataMethod } = req.body;
    
    if (!dataMethod || !dataMethod.id) {
        return res.status(400).json({ error: '无效的数据方法' });
    }
    
    const favorites = loadUserFavorites();
    if (!favorites[userId]) {
        favorites[userId] = { models: [], dataMethods: [] };
    }
    
    // 检查是否已存在
    const exists = favorites[userId].dataMethods.some(m => m.id === dataMethod.id);
    if (exists) {
        return res.status(400).json({ error: '数据方法已在列表中' });
    }
    
    // 添加数据方法（只保存必要信息）
    favorites[userId].dataMethods.push({
        id: dataMethod.id,
        name: dataMethod.name,
        description: dataMethod.description || '',
        author: dataMethod.author || 'OpenGeoLab',
        addedAt: new Date().toISOString()
    });
    
    saveUserFavorites(favorites);
    res.json({ status: 'added', dataMethod });
});

/**
 * DELETE /api/jupyter/my-datamethods/:id
 * 从用户收藏中移除数据方法
 */
router.delete('/my-datamethods/:id', (req, res) => {
    const userId = req.user.userId;
    const dataMethodId = req.params.id;
    
    const favorites = loadUserFavorites();
    if (!favorites[userId]) {
        return res.status(404).json({ error: '数据方法不存在' });
    }
    
    // 使用 String() 转换确保类型一致
    const index = favorites[userId].dataMethods.findIndex(m => String(m.id) === String(dataMethodId));
    if (index === -1) {
        return res.status(404).json({ error: '数据方法不存在' });
    }
    
    favorites[userId].dataMethods.splice(index, 1);
    saveUserFavorites(favorites);
    res.json({ status: 'removed' });
});

// ========== My Data 存储 ==========

/**
 * GET /api/jupyter/my-data
 * 获取用户上传的数据列表
 */
router.get('/my-data', (req, res) => {
    const userId = req.user.userId;
    const favorites = loadUserFavorites();
    const userDataList = favorites[userId]?.dataList || [];
    res.json({ dataList: userDataList });
});

/**
 * POST /api/jupyter/my-data
 * 添加数据到用户的数据列表
 */
router.post('/my-data', (req, res) => {
    const userId = req.user.userId;
    const { data } = req.body;
    
    if (!data || !data.name) {
        return res.status(400).json({ error: '无效的数据' });
    }
    
    const favorites = loadUserFavorites();
    if (!favorites[userId]) {
        favorites[userId] = { models: [], dataMethods: [], dataList: [] };
    }
    if (!favorites[userId].dataList) {
        favorites[userId].dataList = [];
    }
    
    // 生成唯一ID
    const dataId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // 添加数据记录
    favorites[userId].dataList.push({
        id: dataId,
        name: data.name,
        description: data.description || '',
        type: data.type || 'unknown',
        size: data.size || 0,
        url: data.url || '',
        uploadedAt: new Date().toISOString()
    });
    
    saveUserFavorites(favorites);
    res.json({ status: 'added', dataId });
});

/**
 * DELETE /api/jupyter/my-data/:id
 * 从用户数据列表中移除数据
 */
router.delete('/my-data/:id', (req, res) => {
    const userId = req.user.userId;
    const dataId = req.params.id;
    
    const favorites = loadUserFavorites();
    if (!favorites[userId] || !favorites[userId].dataList) {
        return res.status(404).json({ error: '数据不存在' });
    }
    
    const index = favorites[userId].dataList.findIndex(d => String(d.id) === String(dataId));
    if (index === -1) {
        return res.status(404).json({ error: '数据不存在' });
    }
    
    favorites[userId].dataList.splice(index, 1);
    saveUserFavorites(favorites);
    res.json({ status: 'removed' });
});

/**
 * PUT /api/jupyter/my-data/:id
 * 更新数据信息（如重命名）
 */
router.put('/my-data/:id', (req, res) => {
    const userId = req.user.userId;
    const dataId = req.params.id;
    const { name, description } = req.body;
    
    const favorites = loadUserFavorites();
    if (!favorites[userId] || !favorites[userId].dataList) {
        return res.status(404).json({ error: '数据不存在' });
    }
    
    const dataItem = favorites[userId].dataList.find(d => String(d.id) === String(dataId));
    if (!dataItem) {
        return res.status(404).json({ error: '数据不存在' });
    }
    
    if (name) dataItem.name = name;
    if (description !== undefined) dataItem.description = description;
    dataItem.updatedAt = new Date().toISOString();
    
    saveUserFavorites(favorites);
    res.json({ status: 'updated', data: dataItem });
});

/**
 * POST /api/jupyter/my-data/folder
 * 创建文件夹
 */
router.post('/my-data/folder', (req, res) => {
    const userId = req.user.userId;
    const { name, path: folderPath, parentId } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: '文件夹名称不能为空' });
    }
    
    const favorites = loadUserFavorites();
    if (!favorites[userId]) {
        favorites[userId] = { models: [], dataMethods: [], dataList: [] };
    }
    if (!favorites[userId].dataList) {
        favorites[userId].dataList = [];
    }
    
    // 检查同级目录是否存在同名文件夹
    const existing = favorites[userId].dataList.find(d => 
        d.type === 'folder' && 
        d.name === name && 
        d.parentId === (parentId || null)
    );
    if (existing) {
        return res.status(400).json({ error: '同名文件夹已存在' });
    }
    
    const folderId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const fullPath = folderPath === '/' ? '/' + name : folderPath + '/' + name;
    
    const newFolder = {
        id: folderId,
        name: name,
        type: 'folder',
        path: fullPath,
        parentId: parentId || null,
        createdAt: new Date().toISOString()
    };
    
    favorites[userId].dataList.push(newFolder);
    saveUserFavorites(favorites);
    
    res.json({ status: 'created', id: folderId, folder: newFolder });
});

/**
 * POST /api/jupyter/my-data/fork
 * Fork 数据中心的数据到用户数据列表
 */
router.post('/my-data/fork', (req, res) => {
    const userId = req.user.userId;
    const { sourceId, name, type, size, description, downloadUrl, author, source, parentId, path } = req.body;
    
    if (!sourceId || !name) {
        return res.status(400).json({ error: '无效的 Fork 数据' });
    }
    
    const favorites = loadUserFavorites();
    if (!favorites[userId]) {
        favorites[userId] = { models: [], dataMethods: [], dataList: [] };
    }
    if (!favorites[userId].dataList) {
        favorites[userId].dataList = [];
    }
    
    // 检查是否已经 fork 过
    const existing = favorites[userId].dataList.find(d => 
        d.forked && d.sourceId === sourceId
    );
    if (existing) {
        return res.status(400).json({ error: '该数据已经 Fork 过了', existingId: existing.id });
    }
    
    const dataId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    const forkedData = {
        id: dataId,
        sourceId: sourceId,
        name: name,
        type: type || 'unknown',
        size: size || 0,
        description: description || '',
        url: downloadUrl || '',
        forked: true,
        source: source || 'datacenter',
        author: author || '',
        parentId: parentId || null,
        path: path || '/',
        forkedAt: new Date().toISOString(),
        uploadedAt: new Date().toISOString()
    };
    
    favorites[userId].dataList.push(forkedData);
    saveUserFavorites(favorites);
    
    console.log(`[Fork Data] User ${userId} forked data: ${name} (source: ${sourceId}) to path: ${path || '/'}`);
    
    res.json({ status: 'forked', dataId: dataId, data: forkedData });
});

/**
 * POST /api/jupyter/upload-data
 * 上传数据文件到数据服务器，并保存到用户的数据列表
 */
router.post('/upload-data', upload.single('file'), async (req, res) => {
    const userId = req.user.userId;
    
    if (!req.file) {
        return res.status(400).json({ error: '请选择要上传的文件' });
    }
    
    try {
        // 读取上传的文件
        const fileStream = fs.createReadStream(req.file.path);
        const form = new FormData();
        form.append('datafile', fileStream, req.file.originalname);
        form.append('name', req.file.originalname);
        
        console.log(`[Upload Data] User ${userId} uploading file: ${req.file.originalname}`);
        
        // 上传到数据服务器
        const response = await axios.post(DATA_SERVER_URL, form, {
            headers: { 
                ...form.getHeaders(), 
                'token': API_TOKEN 
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        // 清理临时文件
        fs.unlinkSync(req.file.path);
        
        if (response.status === 200 && (response.data.code === 1 || response.data.code === 0)) {
            console.log('[Upload Data] Success:', response.data);
            
            // 从响应中提取文件 ID 和 URL
            const fileData = response.data.data || response.data;
            const fileId = fileData.id || fileData.uid || Date.now().toString(36) + Math.random().toString(36).substr(2);
            const fileUrl = fileData.url || `${DATA_SERVER_URL}/${fileId}`;
            
            // 获取请求参数
            const dataName = req.body.dataName || req.file.originalname;
            const description = req.body.description || '';
            const fileExt = path.extname(req.file.originalname).slice(1).toLowerCase() || 'unknown';
            const parentId = req.body.parentId || null;
            const dataPath = req.body.path || '/';
            
            // 保存到用户数据列表
            const favorites = loadUserFavorites();
            if (!favorites[userId]) {
                favorites[userId] = { models: [], dataMethods: [], dataList: [] };
            }
            if (!favorites[userId].dataList) {
                favorites[userId].dataList = [];
            }
            
            const dataId = fileId;
            favorites[userId].dataList.push({
                id: dataId,
                name: dataName,
                filename: req.file.originalname,
                description: description,
                type: fileExt,
                size: req.file.size,
                url: fileUrl,
                parentId: parentId,
                path: dataPath,
                uploadedAt: new Date().toISOString()
            });
            
            saveUserFavorites(favorites);
            
            console.log(`[Upload Data] User ${userId} uploaded ${dataName} to path: ${dataPath}`);
            
            res.json({
                success: true,
                dataId: dataId,
                url: fileUrl,
                filename: req.file.originalname
            });
        } else {
            console.error('[Upload Data] Failed:', response.data);
            res.status(500).json({
                error: '上传到数据服务器失败',
                details: response.data
            });
        }
    } catch (error) {
        console.error('[Upload Data] Error:', error.message);
        // 清理临时文件
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            error: '文件上传失败',
            message: error.message
        });
    }
});

/**
 * GET /api/jupyter/shared-projects
 * 获取所有公开项目（Shared Space）
 */
router.get('/shared-projects', (req, res) => {
    try {
        const allSharedProjects = [];
        
        // 遍历所有用户目录
        if (!fs.existsSync(USER_DATA_DIR)) {
            return res.json({ projects: [] });
        }
        
        const users = fs.readdirSync(USER_DATA_DIR, { withFileTypes: true })
            .filter(item => item.isDirectory());
        
        for (const userDir of users) {
            const username = userDir.name;
            const userPath = path.join(USER_DATA_DIR, username);
            
            // 遍历用户的所有项目
            const items = fs.readdirSync(userPath, { withFileTypes: true });
            for (const item of items) {
                if (!item.isDirectory() || item.name.startsWith('.') || item.name === '__pycache__') {
                    continue;
                }
                
                const projectPath = path.join(userPath, item.name);
                const meta = getProjectMeta(projectPath);
                
                // 只获取公开项目
                if (!meta.isPublic) continue;
                
                const stats = fs.statSync(projectPath);
                const projectFiles = fs.readdirSync(projectPath);
                const notebookCount = projectFiles.filter(f => f.endsWith('.ipynb')).length;
                const fileCount = projectFiles.filter(f => !f.startsWith('.')).length;
                
                // 获取最新修改时间
                let latestModified = stats.mtime;
                projectFiles.forEach(f => {
                    try {
                        const filePath = path.join(projectPath, f);
                        const fileStats = fs.statSync(filePath);
                        if (fileStats.mtime > latestModified) {
                            latestModified = fileStats.mtime;
                        }
                    } catch (e) {}
                });
                
                allSharedProjects.push({
                    name: item.name,
                    description: meta.description || '',
                    owner: username,
                    notebookCount,
                    fileCount,
                    modifiedAt: latestModified,
                    createdAt: stats.birthtime,
                    isPublic: true
                });
            }
        }
        
        // 按修改时间排序
        allSharedProjects.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
        res.json({ projects: allSharedProjects });
    } catch (error) {
        console.error('Error fetching shared projects:', error);
        res.status(500).json({ error: '获取共享项目失败' });
    }
});

/**
 * GET /api/jupyter/shared-projects/:owner/:projectName
 * 获取公开项目详情（用于预览）
 */
router.get('/shared-projects/:owner/:projectName', (req, res) => {
    const { owner, projectName } = req.params;
    const projectDir = path.join(USER_DATA_DIR, owner, projectName);
    
    if (!fs.existsSync(projectDir)) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    const meta = getProjectMeta(projectDir);
    if (!meta.isPublic) {
        return res.status(403).json({ error: '该项目未公开' });
    }
    
    try {
        const stats = fs.statSync(projectDir);
        const files = fs.readdirSync(projectDir, { withFileTypes: true })
            .filter(item => !item.name.startsWith('.'))
            .map(item => {
                const filePath = path.join(projectDir, item.name);
                const fileStats = fs.statSync(filePath);
                return {
                    name: item.name,
                    type: item.isDirectory() ? 'folder' : 'file',
                    size: fileStats.size,
                    modifiedAt: fileStats.mtime
                };
            });
        
        res.json({
            project: {
                name: projectName,
                description: meta.description || '',
                owner,
                files,
                notebookCount: files.filter(f => f.name.endsWith('.ipynb')).length,
                fileCount: files.length,
                modifiedAt: stats.mtime,
                createdAt: stats.birthtime
            }
        });
    } catch (error) {
        console.error('Error fetching shared project:', error);
        res.status(500).json({ error: '获取项目失败' });
    }
});

/**
 * GET /api/jupyter/shared-projects/:owner/:projectName/files/:filePath/content
 * 获取公开项目文件内容（用于预览）
 */
router.get('/shared-projects/:owner/:projectName/files/:filePath/content', (req, res) => {
    const { owner, projectName, filePath } = req.params;
    const projectDir = path.join(USER_DATA_DIR, owner, projectName);
    
    const meta = getProjectMeta(projectDir);
    if (!meta.isPublic) {
        return res.status(403).json({ error: '该项目未公开' });
    }
    
    const fullPath = path.join(projectDir, decodeURIComponent(filePath));
    
    // 安全检查
    if (!fullPath.startsWith(projectDir)) {
        return res.status(403).json({ error: '非法路径' });
    }
    
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: '文件不存在' });
    }
    
    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const stats = fs.statSync(fullPath);
        res.json({
            name: path.basename(fullPath),
            content,
            size: stats.size,
            modifiedAt: stats.mtime
        });
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({ error: '读取文件失败' });
    }
});

/**
 * 递归复制目录
 */
function copyDirectorySync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const items = fs.readdirSync(src, { withFileTypes: true });
    
    for (const item of items) {
        const srcPath = path.join(src, item.name);
        const destPath = path.join(dest, item.name);
        
        if (item.isDirectory()) {
            copyDirectorySync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * POST /api/jupyter/fork/:owner/:projectName
 * Fork 公开项目到当前用户空间
 */
router.post('/fork/:owner/:projectName', (req, res) => {
    const currentUser = req.user.username;
    const { owner, projectName } = req.params;
    const newName = req.body?.newName;  // 可选：自定义 fork 后的名称（防御性读取）
    
    // 不能 fork 自己的项目
    if (owner === currentUser) {
        return res.status(400).json({ error: '不能 fork 自己的项目' });
    }
    
    const sourceDir = path.join(USER_DATA_DIR, owner, projectName);
    
    if (!fs.existsSync(sourceDir)) {
        return res.status(404).json({ error: '源项目不存在' });
    }
    
    const sourceMeta = getProjectMeta(sourceDir);
    if (!sourceMeta.isPublic) {
        return res.status(403).json({ error: '该项目未公开，无法 fork' });
    }
    
    // 确定目标项目名称
    let targetName = newName?.trim() || projectName;
    const userDir = path.join(USER_DATA_DIR, currentUser);
    let targetDir = path.join(userDir, targetName);
    
    // 如果目标名称已存在，自动添加后缀
    let suffix = 1;
    while (fs.existsSync(targetDir)) {
        targetName = `${newName?.trim() || projectName}-${suffix}`;
        targetDir = path.join(userDir, targetName);
        suffix++;
    }
    
    try {
        // 确保用户目录存在
        fs.mkdirSync(userDir, { recursive: true });
        
        // 复制项目
        copyDirectorySync(sourceDir, targetDir);
        
        // 更新元信息
        const newMeta = {
            name: targetName,
            description: sourceMeta.description || '',
            isPublic: false,  // fork 后默认不公开
            forkedFrom: {
                owner: owner,
                projectName: projectName
            },
            createdAt: new Date().toISOString(),
            createdBy: currentUser,
            forkedAt: new Date().toISOString()
        };
        saveProjectMeta(targetDir, newMeta);
        
        // 获取项目统计
        const projectFiles = fs.readdirSync(targetDir);
        const notebookCount = projectFiles.filter(f => f.endsWith('.ipynb')).length;
        const fileCount = projectFiles.filter(f => !f.startsWith('.')).length;
        
        res.json({
            status: 'forked',
            project: {
                name: targetName,
                description: newMeta.description,
                notebookCount,
                fileCount,
                modifiedAt: new Date(),
                createdAt: new Date(),
                isPublic: false,
                forkedFrom: newMeta.forkedFrom,
                owner: currentUser
            }
        });
    } catch (error) {
        console.error('Error forking project:', error);
        res.status(500).json({ error: 'Fork 项目失败' });
    }
});

/**
 * PUT /api/jupyter/projects/:projectName/visibility
 * 更新项目公开状态
 */
router.put('/projects/:projectName/visibility', (req, res) => {
    const username = req.user.username;
    const { projectName } = req.params;
    const { isPublic } = req.body;
    
    const projectDir = path.join(USER_DATA_DIR, username, projectName);
    
    if (!fs.existsSync(projectDir)) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    try {
        const meta = getProjectMeta(projectDir);
        meta.isPublic = !!isPublic;
        saveProjectMeta(projectDir, meta);
        
        res.json({ status: 'updated', isPublic: meta.isPublic });
    } catch (error) {
        console.error('Error updating visibility:', error);
        res.status(500).json({ error: '更新失败' });
    }
});

module.exports = router;
