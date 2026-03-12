<template>
  <div class="jupyter-project-page">
    <!-- 顶部导航 -->
    <header class="project-nav">
      <div class="nav-left">
        <a href="/" class="logo-link">
          <img src="/logo.png" alt="OpenGeoLab" class="logo">
        </a>
        <router-link to="/jupyter" class="back-link">
          <span class="back-icon">←</span>
          <span>返回 Dashboard</span>
        </router-link>
      </div>
      <div class="nav-center">
        <h1 class="project-title">
          <span class="project-icon"></span>
          {{ projectName }}
        </h1>
      </div>
      <div class="nav-right">
        <button 
          class="jupyter-btn"
          :class="{ running: jupyterStatus === 'running', starting: isStarting }"
          @click="toggleJupyter"
          :disabled="isStarting || isStopping"
        >
          <span v-if="isStarting" class="loading-spinner"></span>
          <span v-else-if="jupyterStatus === 'running'" class="status-dot"></span>
          <span v-else class="jupyter-icon"></span>
          <span v-if="isStarting">启动中...</span>
          <span v-else-if="jupyterStatus === 'running'">打开 JupyterLab</span>
          <span v-else>启动 Jupyter</span>
        </button>
      </div>
    </header>

    <!-- 主内容区 -->
    <div class="project-container">
      <!-- Left workspace panel -->
      <aside class="file-sidebar">
        <div class="sidebar-header">
          <h2>Project Workspace</h2>
          <span class="file-count">{{ fileCount }} files</span>
        </div>

        <div class="version-switcher">
          <label for="versionSelect">Version</label>
          <select id="versionSelect" v-model="selectedVersionId" class="version-select">
            <option v-for="version in versionEntries" :key="version.id" :value="version.id">
              {{ version.label }}
            </option>
          </select>
        </div>

        <div class="workspace-tabs">
          <button :class="['workspace-tab', { active: workspaceTab === 'content' }]" @click="workspaceTab = 'content'">Content</button>
          <button :class="['workspace-tab', { active: workspaceTab === 'data' }]" @click="workspaceTab = 'data'">Data</button>
          <button :class="['workspace-tab', { active: workspaceTab === 'versions' }]" @click="workspaceTab = 'versions'">Versions</button>
          <button :class="['workspace-tab', { active: workspaceTab === 'forks' }]" @click="workspaceTab = 'forks'">Fork Records</button>
        </div>

        <div class="workspace-body">
          <div v-show="workspaceTab === 'content'" class="file-tree">
            <div class="tree-root">
              <div class="tree-item root-item" @click="toggleRootExpand">
                <span :class="['chevron', { expanded: rootExpanded }]">▶</span>
                <span class="folder-emoji"></span>
                <span class="item-name root-name">{{ projectName }}</span>
              </div>

              <div v-show="rootExpanded" class="tree-children">
                <template v-for="item in fileTree" :key="item.path">
                  <div v-if="item.type === 'folder'" class="tree-folder">
                    <div
                      class="tree-item folder-item"
                      :style="{ paddingLeft: '24px' }"
                      @click="toggleFolder(item.path)"
                    >
                      <span :class="['chevron', { expanded: expandedFolders.has(item.path) }]">▶</span>
                      <span class="folder-emoji"></span>
                      <span class="item-name">{{ item.name }}</span>
                    </div>
                    <div v-show="expandedFolders.has(item.path)" class="tree-children">
                      <template v-for="child in item.children" :key="child.path">
                        <div v-if="child.type === 'folder'" class="tree-folder">
                          <div
                            class="tree-item folder-item"
                            :style="{ paddingLeft: '44px' }"
                            @click="toggleFolder(child.path)"
                          >
                            <span :class="['chevron', { expanded: expandedFolders.has(child.path) }]">▶</span>
                            <span class="folder-emoji"></span>
                            <span class="item-name">{{ child.name }}</span>
                          </div>
                          <div v-show="expandedFolders.has(child.path)" class="tree-children">
                            <template v-for="grandchild in child.children" :key="grandchild.path">
                              <div v-if="grandchild.type === 'folder'" class="tree-folder">
                                <div
                                  class="tree-item folder-item"
                                  :style="{ paddingLeft: '64px' }"
                                  @click="toggleFolder(grandchild.path)"
                                >
                                  <span :class="['chevron', { expanded: expandedFolders.has(grandchild.path) }]">▶</span>
                                  <span class="folder-emoji"></span>
                                  <span class="item-name">{{ grandchild.name }}</span>
                                </div>
                                <div v-show="expandedFolders.has(grandchild.path)" class="tree-children">
                                  <div
                                    v-for="ggchild in grandchild.children"
                                    :key="ggchild.path"
                                    :class="['tree-item', { selected: selectedFile?.path === ggchild.path }]"
                                    :style="{ paddingLeft: '84px' }"
                                    @click="handleFileSelect(ggchild)"
                                  >
                                    <span class="chevron-placeholder"></span>
                                    <span class="file-emoji">{{ getFileEmoji(ggchild) }}</span>
                                    <span class="item-name">{{ ggchild.name }}</span>
                                  </div>
                                </div>
                              </div>
                              <div
                                v-else
                                :class="['tree-item', { selected: selectedFile?.path === grandchild.path }]"
                                :style="{ paddingLeft: '64px' }"
                                @click="handleFileSelect(grandchild)"
                              >
                                <span class="chevron-placeholder"></span>
                                <span class="file-emoji">{{ getFileEmoji(grandchild) }}</span>
                                <span class="item-name">{{ grandchild.name }}</span>
                              </div>
                            </template>
                          </div>
                        </div>
                        <div
                          v-else
                          :class="['tree-item', { selected: selectedFile?.path === child.path }]"
                          :style="{ paddingLeft: '44px' }"
                          @click="handleFileSelect(child)"
                        >
                          <span class="chevron-placeholder"></span>
                          <span class="file-emoji">{{ getFileEmoji(child) }}</span>
                          <span class="item-name">{{ child.name }}</span>
                        </div>
                      </template>
                    </div>
                  </div>
                  <div
                    v-else
                    :class="['tree-item', { selected: selectedFile?.path === item.path }]"
                    :style="{ paddingLeft: '24px' }"
                    @click="handleFileSelect(item)"
                  >
                    <span class="chevron-placeholder"></span>
                    <span class="file-emoji">{{ getFileEmoji(item) }}</span>
                    <span class="item-name">{{ item.name }}</span>
                  </div>
                </template>

                <div v-if="fileTree.length === 0" class="empty-tree">
                  <p>No files yet</p>
                  <p class="hint">Start Jupyter to create project files</p>
                </div>
              </div>
            </div>
          </div>

          <div v-show="workspaceTab === 'data'" class="tab-panel">
            <div class="tab-title">Data Files</div>
            <div v-if="dataFiles.length === 0" class="empty-tree">
              <p>No data files detected</p>
              <p class="hint">Add CSV, TIFF, JSON, XML, ZIP or related files</p>
            </div>
            <div v-else class="data-file-list">
              <button
                v-for="item in dataFiles"
                :key="item.path || item.name"
                class="data-file-item"
                @click="selectFile(item)"
              >
                <span class="file-name">{{ item.name }}</span>
                <span class="file-size">{{ formatSize(item.size) }}</span>
              </button>
            </div>
          </div>

          <div v-show="workspaceTab === 'versions'" class="tab-panel">
            <div class="tab-title">Version Timeline</div>
            <div v-if="versionEntries.length === 0" class="empty-tree">
              <p>No version metadata available</p>
            </div>
            <div v-else class="version-list">
              <button
                v-for="entry in versionEntries"
                :key="entry.id"
                :class="['version-item', { active: selectedVersionId === entry.id }]"
                @click="selectedVersionId = entry.id"
              >
                <span class="version-name">{{ entry.label }}</span>
                <span class="version-time">{{ formatDateTime(entry.time) }}</span>
                <span class="version-note">{{ entry.note }}</span>
              </button>
            </div>
          </div>

          <div v-show="workspaceTab === 'forks'" class="tab-panel">
            <div class="tab-title">Fork Records</div>
            <div v-if="forkRecords.length === 0" class="empty-tree">
              <p>No fork records yet</p>
            </div>
            <div v-else class="fork-list">
              <div v-for="record in forkRecords" :key="record.id" class="fork-item">
                <span class="fork-title">{{ record.title }}</span>
                <span class="fork-time">{{ formatDateTime(record.time) }}</span>
                <span class="fork-note">{{ record.note }}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧预览区 -->
      <main class="preview-area">
        <div v-if="!selectedFile" class="no-selection">
          <div class="empty-state">
            <span class="empty-icon"></span>
            <p>选择左侧文件进行预览</p>
          </div>
        </div>
        
        <!-- Notebook 预览 -->
        <div v-else-if="selectedFile.type === 'notebook'" class="notebook-preview">
          <div class="preview-header">
            <h2>{{ selectedFile.name }}</h2>
            <div class="preview-actions">
              <button 
                class="action-btn primary" 
                @click="openInJupyter"
                :disabled="jupyterStatus !== 'running'"
              >
                在 Jupyter 中打开
              </button>
            </div>
          </div>
          
          <div class="preview-meta">
            <span class="meta-item">
              <span class="meta-label">语言:</span>
              <span class="meta-value">{{ notebookPreview?.metadata?.kernelspec?.display_name || 'Python' }}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">Cells:</span>
              <span class="meta-value">{{ notebookPreview?.cellCount || 0 }}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">修改时间:</span>
              <span class="meta-value">{{ formatDateTime(selectedFile.modifiedAt) }}</span>
            </span>
          </div>

          <!-- Notebook 内容预览 -->
          <div v-if="isLoadingPreview" class="loading-preview">
            <span class="loading-spinner"></span>
            <span>加载预览中...</span>
          </div>
          <div v-else-if="notebookPreview" class="notebook-cells">
            <div 
              v-for="(cell, idx) in notebookPreview.cells" 
              :key="idx"
              :class="['cell-preview', cell.type]"
            >
              <div class="cell-header">
                <span class="cell-type">{{ cell.type === 'code' ? 'Code' : 'Markdown' }}</span>
                <span class="cell-index">[{{ cell.execution_count || idx + 1 }}]</span>
              </div>
              <pre v-if="cell.type === 'code'" class="cell-content code"><code>{{ cell.source }}</code></pre>
              <div v-else class="cell-content markdown">{{ cell.source }}</div>
              <!-- 输出区域 -->
              <div v-if="cell.outputs && cell.outputs.length > 0" class="cell-outputs">
                <div v-for="(output, oidx) in cell.outputs" :key="oidx" class="cell-output">
                  <template v-if="output.type === 'stream'">
                    <pre class="output-stream" :class="output.name">{{ output.text }}</pre>
                  </template>
                  <template v-else-if="output.type === 'execute_result' || output.type === 'display_data'">
                    <div v-if="output.image" class="output-image">
                      <img :src="'data:image/png;base64,' + output.image" alt="output" />
                    </div>
                    <pre v-else-if="output.text" class="output-text">{{ output.text }}</pre>
                  </template>
                  <template v-else-if="output.type === 'error'">
                    <pre class="output-error">{{ output.ename }}: {{ output.evalue }}</pre>
                  </template>
                </div>
              </div>
            </div>
            <div v-if="notebookPreview.cellCount > 20" class="more-cells">
              <p>... 还有 {{ notebookPreview.cellCount - 20 }} 个 cells</p>
              <button class="action-btn" @click="openInJupyter" :disabled="jupyterStatus !== 'running'">
                在 Jupyter 中查看完整内容
              </button>
            </div>
          </div>
        </div>

        <!-- 文本文件预览 -->
        <div v-else-if="isTextFile(selectedFile.name)" class="text-file-preview">
          <div class="preview-header">
            <h2>{{ selectedFile.name }}</h2>
            <div class="preview-meta">
              <span class="meta-item">
                <span class="meta-label">大小:</span>
                <span class="meta-value">{{ formatSize(selectedFile.size) }}</span>
              </span>
              <span class="meta-item">
                <span class="meta-label">修改时间:</span>
                <span class="meta-value">{{ formatDateTime(selectedFile.modifiedAt) }}</span>
              </span>
            </div>
          </div>
          <div v-if="isLoadingPreview" class="loading-preview">
            <span class="loading-spinner"></span>
            <span>加载预览中...</span>
          </div>
          <div v-else class="text-content-wrapper">
            <pre class="text-content"><code>{{ textFileContent }}</code></pre>
          </div>
        </div>

        <!-- 其他文件预览 -->
        <div v-else class="file-preview">
          <div class="preview-header">
            <h2>{{ selectedFile.name }}</h2>
          </div>
          <div class="file-info-card">
            <p><strong>类型:</strong> {{ selectedFile.type }}</p>
            <p><strong>大小:</strong> {{ formatSize(selectedFile.size) }}</p>
            <p><strong>修改时间:</strong> {{ formatDateTime(selectedFile.modifiedAt) }}</p>
          </div>
        </div>
      </main>
    </div>

    <!-- Jupyter 运行状态浮动条 -->
    <div v-if="jupyterStatus === 'running'" class="jupyter-floating-bar">
      <div class="floating-info">
        <span class="status-dot running"></span>
        <span>JupyterLab 运行中</span>
      </div>
      <div class="floating-actions">
        <a :href="jupyterUrl" target="_blank" class="floating-btn open">打开</a>
        <button class="floating-btn stop" @click="stopJupyter" :disabled="isStopping">
          {{ isStopping ? '停止中...' : '停止' }}
        </button>
      </div>
    </div>
    
    <!-- 镜像选择对话框 -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showImageSelector" class="image-selector-overlay" @click.self="showImageSelector = false">
          <div class="image-selector-modal">
            <div class="modal-header">
              <div class="header-content">
                <div class="header-icon"></div>
                <div class="header-text">
                  <h3>选择 Python 环境</h3>
                  <p>为您的 Jupyter 笔记本选择合适的运行环境</p>
                </div>
              </div>
              <button class="close-btn" @click="showImageSelector = false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div v-if="loadingImages" class="loading-images">
                <div class="spinner"></div>
                <span>加载镜像列表...</span>
              </div>
              <div v-else class="image-grid">
                <div 
                  v-for="image in availableImages" 
                  :key="image.id"
                  :class="['image-card', { selected: selectedImageId === image.id, unavailable: !image.available }]"
                  @click="image.available && selectImage(image.id)"
                >
                  <div class="card-check">
                    <div class="check-circle">
                      <svg v-if="selectedImageId === image.id" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                      </svg>
                    </div>
                  </div>
                  <div class="card-content">
                    <div class="card-badges">
                      <span class="python-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.4 0 5.8 2.6 5.8 2.6l.1 2.7h6.3v.8H3.6S0 5.6 0 12s3.1 6.2 3.1 6.2h1.9v-3s-.1-3.1 3.1-3.1h5.3s3-.1 3-2.9V3.4S16.9 0 12 0zm-3 2c.5 0 .9.4.9 1s-.4 1-.9 1-1-.4-1-1 .4-1 1-1z"/>
                          <path d="M12 24c6.6 0 6.2-2.6 6.2-2.6l-.1-2.7h-6.3v-.8h8.6s3.6.5 3.6-6.1-3.1-6.2-3.1-6.2h-1.9v3s.1 3.1-3.1 3.1H10.6s-3 .1-3 2.9v5.8S7.1 24 12 24zm3-2c-.5 0-.9-.4-.9-1s.4-1 .9-1 1 .4 1 1-.4 1-1 1z"/>
                        </svg>
                        {{ image.python }}
                      </span>
                      <span v-if="image.default" class="recommend-badge">推荐</span>
                      <span v-if="!image.available" class="unavailable-badge">未安装</span>
                    </div>
                    <h4 class="card-title">{{ image.label }}</h4>
                    <p class="card-desc">{{ image.description }}</p>
                    <div class="card-features">
                      <span v-for="feature in image.features" :key="feature" class="feature-chip">
                        {{ feature }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="cancel-btn" @click="showImageSelector = false">取消</button>
              <button 
                class="confirm-btn" 
                @click="confirmStartJupyter"
                :disabled="!selectedImageId || isStarting"
              >
                <span v-if="isStarting" class="btn-loading">
                  <span class="spinner-sm"></span>
                  启动中...
                </span>
                <span v-else>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  启动 Jupyter
                </span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const router = useRouter()

// 状态
const projectName = computed(() => route.params.projectName)
const project = ref(null)
const files = ref([])
const selectedFile = ref(null)
const notebookPreview = ref(null)
const textFileContent = ref(null)
const isLoadingPreview = ref(false)
const isStarting = ref(false)
const isStopping = ref(false)
const jupyterStatus = ref('stopped')
const jupyterUrl = ref('')
const jupyterToken = ref('')

// 文件树相关状态
const rootExpanded = ref(true)
const expandedFolders = ref(new Set())
const folderContents = ref({}) // 存储各文件夹的内容

// 镜像选择相关状态
const showImageSelector = ref(false)
const availableImages = ref([])
const selectedImageId = ref('')
const loadingImages = ref(false)
const workspaceTab = ref('content')
const selectedVersionId = ref('')

// 需要隐藏的文件/文件夹
const hiddenPatterns = [
  '__pycache__',
  '.ipynb_checkpoints',
  '.git',
  '.DS_Store',
  'Thumbs.db',
  '.pyc',
  '.pyo',
  '__MACOSX'
]

const dataExtensions = [
  '.csv', '.tsv', '.xlsx', '.xls', '.json', '.xml',
  '.tif', '.tiff', '.nc', '.h5', '.hdf5',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.geojson', '.shp', '.dbf', '.prj', '.txt'
]

// 过滤隐藏文件
const shouldHideFile = (name) => {
  return hiddenPatterns.some(pattern => 
    name === pattern || name.endsWith(pattern) || name.startsWith('.')
  )
}

const isDataAsset = (name = '') => {
  const lowerName = name.toLowerCase()
  return dataExtensions.some(ext => lowerName.endsWith(ext))
}

// 构建文件树结构
const fileTree = computed(() => {
  // 过滤并排序文件
  const filteredFiles = files.value.filter(f => !shouldHideFile(f.name))
  
  // 分离文件夹和文件
  const folders = filteredFiles.filter(f => f.type === 'folder')
  const regularFiles = filteredFiles.filter(f => f.type !== 'folder')
  
  // 文件夹排在前面，然后是文件，都按名称排序
  const sortedItems = [
    ...folders.sort((a, b) => a.name.localeCompare(b.name)),
    ...regularFiles.sort((a, b) => a.name.localeCompare(b.name))
  ]
  
  // 构建树结构
  return sortedItems.map(file => {
    const itemPath = file.path || file.name
    const item = {
      ...file,
      path: itemPath
    }
    
    // 如果是文件夹，添加子内容
    if (file.type === 'folder') {
      const children = folderContents.value[itemPath] || []
      item.children = buildChildrenTree(children, itemPath)
    }
    
    return item
  })
})

// 递归构建子文件树
const buildChildrenTree = (items, parentPath) => {
  const filteredItems = items.filter(f => !shouldHideFile(f.name))
  const folders = filteredItems.filter(f => f.type === 'folder')
  const regularFiles = filteredItems.filter(f => f.type !== 'folder')
  
  const sortedItems = [
    ...folders.sort((a, b) => a.name.localeCompare(b.name)),
    ...regularFiles.sort((a, b) => a.name.localeCompare(b.name))
  ]
  
  return sortedItems.map(file => {
    const itemPath = file.path || `${parentPath}/${file.name}`
    const item = {
      ...file,
      path: itemPath
    }
    
    if (file.type === 'folder') {
      const children = folderContents.value[itemPath] || []
      item.children = buildChildrenTree(children, itemPath)
    }
    
    return item
  })
}

// 文件计数（排除隐藏文件）
const fileCount = computed(() => {
  return files.value.filter(f => !shouldHideFile(f.name)).length
})

const dataFiles = computed(() => {
  return files.value
    .filter(item => item.type !== 'folder')
    .filter(item => !shouldHideFile(item.name))
    .filter(item => isDataAsset(item.name))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const versionEntries = computed(() => {
  const list = []
  if (!project.value) return list

  list.push({
    id: 'current',
    label: 'Current',
    time: project.value.modifiedAt || project.value.createdAt || new Date().toISOString(),
    note: 'Latest workspace snapshot'
  })

  if (project.value.createdAt) {
    list.push({
      id: 'initial',
      label: 'Initial',
      time: project.value.createdAt,
      note: 'Project creation point'
    })
  }

  if (project.value.forkedAt) {
    list.push({
      id: 'forked',
      label: 'Forked',
      time: project.value.forkedAt,
      note: 'Created from upstream project'
    })
  }

  return list
})

const forkRecords = computed(() => {
  if (!project.value) return []
  const records = []

  if (project.value.forkedFrom) {
    records.push({
      id: 'upstream',
      title: `Forked from ${project.value.forkedFrom.owner}/${project.value.forkedFrom.projectName}`,
      time: project.value.forkedAt || project.value.createdAt || new Date().toISOString(),
      note: 'Upstream reference'
    })
  }

  records.push({
    id: 'owner',
    title: `Owned by ${project.value.createdBy || 'Current user'}`,
    time: project.value.createdAt || new Date().toISOString(),
    note: 'Project owner record'
  })

  return records
})

// 切换根目录展开
const toggleRootExpand = () => {
  rootExpanded.value = !rootExpanded.value
}

// 切换文件夹展开/折叠
const toggleFolder = async (folderPath) => {
  const newSet = new Set(expandedFolders.value)
  if (newSet.has(folderPath)) {
    newSet.delete(folderPath)
  } else {
    // 如果还没有加载过这个文件夹的内容，先加载
    if (!folderContents.value[folderPath]) {
      await loadFolderContents(folderPath)
    }
    newSet.add(folderPath)
  }
  expandedFolders.value = newSet
}

// 加载文件夹内容
const loadFolderContents = async (folderPath) => {
  const token = getToken()
  if (!token) return
  
  try {
    const response = await axios.get(`/api/jupyter/projects/${projectName.value}/folder`, {
      params: { path: folderPath },
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (response.data && response.data.files) {
      folderContents.value[folderPath] = response.data.files
    }
  } catch (error) {
    console.error('Failed to load folder contents:', error)
  }
}

// 处理文件选择
const handleFileSelect = (item) => {
  selectFile(item)
}

// 获取存储的 token
const getToken = () => localStorage.getItem('jupyter_token')

// 创建带认证的 axios 实例
const authAxios = () => {
  const token = getToken()
  return axios.create({
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
}

// 加载项目详情
const loadProject = async () => {
  try {
    const res = await authAxios().get(`/api/jupyter/projects/${projectName.value}`)
    project.value = res.data.project
    files.value = res.data.files
    
    // 自动选择第一个 notebook
    const firstNotebook = files.value.find(f => f.type === 'notebook')
    if (firstNotebook) {
      selectFile(firstNotebook)
    }
  } catch (e) {
    console.error('Failed to load project:', e)
    if (e.response?.status === 404) {
      alert('项目不存在')
      router.push('/jupyter')
    }
  }
}

// 选择文件
const selectFile = async (file) => {
  selectedFile.value = file
  notebookPreview.value = null
  textFileContent.value = null
  
  const filePath = file.path || file.name
  
  if (file.type === 'notebook') {
    await loadNotebookPreview(filePath)
  } else if (isTextFile(file.name)) {
    await loadTextFileContent(filePath)
  }
}

// 判断是否为文本文件
const isTextFile = (filename) => {
  const textExtensions = ['.py', '.txt', '.md', '.json', '.csv', '.yaml', '.yml', '.xml', '.html', '.css', '.js', '.ts', '.sh', '.bat', '.ini', '.cfg', '.conf', '.log']
  const lowerName = filename.toLowerCase()
  return textExtensions.some(ext => lowerName.endsWith(ext))
}

// 加载文本文件内容
const loadTextFileContent = async (filePath) => {
  isLoadingPreview.value = true
  try {
    const encodedPath = encodeURIComponent(filePath)
    const res = await authAxios().get(
      `/api/jupyter/projects/${projectName.value}/files/${encodedPath}/content`
    )
    textFileContent.value = res.data.content
  } catch (e) {
    console.error('Failed to load text file:', e)
    textFileContent.value = '无法加载文件内容'
  } finally {
    isLoadingPreview.value = false
  }
}

// 加载 Notebook 预览
const loadNotebookPreview = async (notebookPath) => {
  isLoadingPreview.value = true
  try {
    // 使用 encodeURIComponent 编码整个路径，包括斜杠
    const encodedPath = encodeURIComponent(notebookPath)
    const res = await authAxios().get(
      `/api/jupyter/projects/${projectName.value}/notebooks/${encodedPath}/preview`
    )
    notebookPreview.value = res.data
  } catch (e) {
    console.error('Failed to load notebook preview:', e)
  } finally {
    isLoadingPreview.value = false
  }
}

// 获取 Jupyter 状态（基于项目）
const fetchJupyterStatus = async () => {
  try {
    const res = await authAxios().get(`/api/jupyter/status?projectName=${encodeURIComponent(projectName.value)}`)
    if (res.data.status === 'running') {
      jupyterStatus.value = 'running'
      jupyterUrl.value = res.data.url
      jupyterToken.value = res.data.token
    } else {
      jupyterStatus.value = 'stopped'
    }
  } catch (e) {
    jupyterStatus.value = 'stopped'
  }
}

// 获取可用镜像列表
const fetchImages = async () => {
  loadingImages.value = true
  try {
    const res = await authAxios().get('/api/jupyter/images')
    availableImages.value = res.data.images || []
    
    // 优先使用用户在设置中选择的默认环境
    const userDefaultEnvId = localStorage.getItem('default_jupyter_env')
    if (userDefaultEnvId) {
      const userDefaultImage = availableImages.value.find(img => img.id === userDefaultEnvId && img.available)
      if (userDefaultImage) {
        selectedImageId.value = userDefaultImage.id
        return
      }
    }
    
    // 其次选择系统默认镜像
    const defaultImage = availableImages.value.find(img => img.default && img.available)
    if (defaultImage) {
      selectedImageId.value = defaultImage.id
    } else {
      // 如果没有默认镜像，选择第一个可用的
      const firstAvailable = availableImages.value.find(img => img.available)
      if (firstAvailable) {
        selectedImageId.value = firstAvailable.id
      }
    }
  } catch (e) {
    console.error('Failed to fetch images:', e)
    availableImages.value = []
  } finally {
    loadingImages.value = false
  }
}

// 选择镜像
const selectImage = (imageId) => {
  const image = availableImages.value.find(img => img.id === imageId)
  if (image && image.available) {
    selectedImageId.value = imageId
  }
}

// 确认启动 Jupyter（使用选择的镜像）
const confirmStartJupyter = async () => {
  if (!selectedImageId.value) {
    alert('请选择一个镜像')
    return
  }
  showImageSelector.value = false
  await startJupyter(selectedImageId.value)
}

// 启动/打开 Jupyter
const toggleJupyter = async () => {
  if (jupyterStatus.value === 'running') {
    // 直接打开 JupyterLab（项目目录已挂载为根目录）
    window.open(jupyterUrl.value, '_blank')
  } else {
    // 显示镜像选择器
    await fetchImages()
    showImageSelector.value = true
  }
}

// 启动 Jupyter（传入项目名和镜像ID）
const startJupyter = async (imageId) => {
  isStarting.value = true
  try {
    const res = await authAxios().post('/api/jupyter/start', {
      projectName: projectName.value,
      imageId: imageId
    })
    if (res.data.status === 'started' || res.data.status === 'already_running') {
      jupyterStatus.value = 'running'
      jupyterUrl.value = res.data.url
      jupyterToken.value = res.data.token
      
      // 直接打开 JupyterLab（项目已挂载为根目录）
      setTimeout(() => {
        window.open(jupyterUrl.value, '_blank')
      }, 2000)
    }
  } catch (e) {
    alert('启动失败: ' + (e.response?.data?.error || e.message))
  } finally {
    isStarting.value = false
  }
}

// 停止 Jupyter（传入项目名）
const stopJupyter = async () => {
  isStopping.value = true
  try {
    await authAxios().post('/api/jupyter/stop', {
      projectName: projectName.value
    })
    jupyterStatus.value = 'stopped'
    jupyterUrl.value = ''
    jupyterToken.value = ''
  } catch (e) {
    alert('停止失败: ' + (e.response?.data?.error || e.message))
  } finally {
    isStopping.value = false
  }
}

// 在 Jupyter 中打开当前文件
const openInJupyter = async () => {
  if (jupyterStatus.value !== 'running') {
    await startJupyter()
    // 等待启动完成
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  if (jupyterUrl.value && selectedFile.value) {
    // 项目目录已挂载为 /home/jovyan/work，文件直接在根目录
    // jupyterUrl 格式: http://localhost:port/lab?token=xxx
    // 目标格式: http://localhost:port/lab/tree/filename.ipynb?token=xxx
    const baseUrl = jupyterUrl.value.split('?')[0] // http://localhost:port/lab
    const url = `${baseUrl}/tree/${encodeURIComponent(selectedFile.value.name)}?token=${jupyterToken.value}`
    window.open(url, '_blank')
  }
}

// 工具函数
const getFileIcon = (file) => {
  if (file.type === 'notebook') return ''
  if (file.type === 'folder') return ''
  if (file.name.endsWith('.py')) return ''
  if (file.name.endsWith('.json')) return ''
  if (file.name.endsWith('.csv')) return ''
  if (file.name.endsWith('.md')) return ''
  return ''
}

// 获取文件 emoji 图标
const getFileEmoji = (item) => {
  if (item.type === 'folder') return ''
  
  const name = item.name.toLowerCase()
  
  // Notebook
  if (name.endsWith('.ipynb')) return ''
  
  // Python
  if (name.endsWith('.py')) return ''
  
  // JSON
  if (name.endsWith('.json')) return ''
  
  // CSV/Data
  if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) return ''
  
  // Markdown
  if (name.endsWith('.md') || name.endsWith('.markdown')) return ''
  
  // Image
  if (name.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|tiff?|bmp)$/i)) return ''
  
  // Text
  if (name.endsWith('.txt') || name.endsWith('.log')) return ''
  
  // Config
  if (name.endsWith('.yml') || name.endsWith('.yaml') || name.endsWith('.toml')) return ''
  
  // Default
  return ''
}

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const formatDateTime = (date) => {
  if (!date) return '-'
  const d = new Date(date)
  return d.toLocaleString('zh-CN')
}

// 初始化
onMounted(async () => {
  if (!getToken()) {
    router.push('/jupyter')
    return
  }
  
  await Promise.all([
    loadProject(),
    fetchJupyterStatus()
  ])
})

watch(versionEntries, (entries) => {
  if (!entries.length) {
    selectedVersionId.value = ''
    return
  }

  const exists = entries.some(entry => entry.id === selectedVersionId.value)
  if (!exists) {
    selectedVersionId.value = entries[0].id
  }
}, { immediate: true })

// 监听项目名变化
watch(projectName, () => {
  loadProject()
})
</script>

<style scoped>
.jupyter-project-page {
  min-height: 100vh;
  background: #f5f7fa;
  color: #303133;
}

/* 顶部导航 */
.project-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
  height: 64px;
  background: #000000;
  border-bottom: none;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 2rem;
  flex: 1;
}

.logo-link {
  display: flex;
  align-items: center;
}

.logo {
  height: 38px;
  width: auto;
}

.back-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.back-link:hover {
  color: #ffffff;
}

.back-icon {
  font-size: 1.1rem;
}

.nav-center {
  flex: 2;
  display: flex;
  justify-content: center;
}

.project-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.2rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.project-icon {
  font-size: 1.5rem;
}

.nav-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}

/* Jupyter 按钮 */
.jupyter-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #f37626, #e05d10);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.jupyter-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(243, 118, 38, 0.4);
}

.jupyter-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.jupyter-btn.running {
  background: linear-gradient(135deg, #10b981, #059669);
}

.jupyter-btn.starting {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.jupyter-btn .status-dot {
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.jupyter-btn .loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* 主容器 */
.project-container {
  display: flex;
  height: calc(100vh - 64px);
}

/* 左侧文件栏 */
.file-sidebar {
  width: 320px;
  background: #ffffff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid #e4e7ed;
  background: #f8f9fb;
}

.sidebar-header h2 {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0;
  color: #303133;
}

.file-count {
  font-size: 0.75rem;
  color: #909399;
}

.version-switcher {
  padding: 10px 12px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
}

.version-switcher label {
  font-size: 12px;
  color: #606266;
  min-width: 52px;
}

.version-select {
  flex: 1;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  color: #303133;
  font-size: 12px;
  padding: 6px 8px;
}

.workspace-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid #e4e7ed;
  background: #f8f9fb;
}

.workspace-tab {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #ffffff;
  color: #606266;
  padding: 7px 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.workspace-tab:hover {
  border-color: #409eff;
  color: #409eff;
}

.workspace-tab.active {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.1);
  color: #1f6ad8;
}

.workspace-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 文件树样式 */
.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.tab-panel {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
}

.tab-title {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.data-file-list,
.version-list,
.fork-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-file-item {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  padding: 8px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.data-file-item:hover {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.06);
}

.data-file-item .file-name {
  color: #303133;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-file-item .file-size {
  color: #909399;
  font-size: 11px;
  flex-shrink: 0;
}

.version-item {
  width: 100%;
  text-align: left;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
}

.version-item:hover {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.04);
}

.version-item.active {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.1);
}

.version-name {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.version-time {
  font-size: 11px;
  color: #606266;
}

.version-note {
  font-size: 11px;
  color: #909399;
}

.fork-item {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fork-title {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.fork-time {
  font-size: 11px;
  color: #606266;
}

.fork-note {
  font-size: 11px;
  color: #909399;
}

.tree-root {
  user-select: none;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  padding-left: 8px;
  cursor: pointer;
  transition: background 0.1s;
  font-size: 13px;
}

.tree-item:hover {
  background: rgba(64, 158, 255, 0.08);
}

.tree-item.selected {
  background: rgba(64, 158, 255, 0.15);
}

.tree-item.root-item {
  padding: 8px 12px;
  padding-left: 8px;
  font-weight: 500;
  background: transparent;
}

.tree-item.root-item:hover {
  background: rgba(64, 158, 255, 0.05);
}

.chevron {
  width: 18px;
  font-size: 11px;
  color: #909399;
  transition: transform 0.15s;
  display: inline-block;
  text-align: center;
  flex-shrink: 0;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.chevron-placeholder {
  width: 18px;
  flex-shrink: 0;
}

.folder-emoji {
  font-size: 16px;
  margin-right: 8px;
}

.file-emoji {
  font-size: 16px;
  margin-right: 8px;
}

.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #606266;
}

.item-name.root-name {
  color: #303133;
  font-weight: 600;
}

.tree-children {
  /* 子文件缩进 */
}

.tree-children .tree-item {
  padding-left: 28px;
}

.empty-tree {
  padding: 24px 16px;
  text-align: center;
  color: #909399;
  font-size: 12px;
}

.empty-tree p {
  margin: 4px 0;
}

.empty-tree .hint {
  font-size: 11px;
  color: #c0c4cc;
}

/* 右侧预览区 */
.preview-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #f5f7fa;
}

.no-selection {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.empty-state {
  text-align: center;
  color: #909399;
}

.empty-state .empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 16px;
}

/* Notebook 预览 */
.notebook-preview {
  max-width: 1000px;
  margin: 0 auto;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.preview-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #dcdfe6;
  background: #ffffff;
  color: #606266;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  border-color: #409eff;
  color: #409eff;
  background: rgba(64, 158, 255, 0.05);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.primary {
  background: linear-gradient(135deg, #409eff, #2d8cf0);
  border: none;
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.preview-meta {
  display: flex;
  gap: 24px;
  padding: 16px 20px;
  background: #ffffff;
  border-radius: 8px;
  margin-bottom: 24px;
  border: 1px solid #e4e7ed;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.meta-item {
  display: flex;
  gap: 8px;
}

.meta-label {
  color: #909399;
}

.meta-value {
  color: #303133;
}

.loading-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 60px;
  color: #909399;
}

/* Notebook Cells */
.notebook-cells {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cell-preview {
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e4e7ed;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.cell-preview.code {
  border-left: 3px solid #409eff;
}

.cell-preview.markdown {
  border-left: 3px solid #10b981;
}

.cell-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #f8f9fb;
  font-size: 0.8rem;
  color: #606266;
  border-bottom: 1px solid #e4e7ed;
}

.cell-type {
  font-weight: 500;
}

.cell-index {
  color: #909399;
}

.cell-content {
  padding: 16px;
  font-size: 0.9rem;
  line-height: 1.5;
  max-height: 300px;
  overflow: auto;
}

.cell-content.code {
  background: #f8f9fb;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.cell-content.code code {
  color: #24292f;
}

.cell-content.markdown {
  color: #606266;
  white-space: pre-wrap;
}

/* 输出区域 */
.cell-outputs {
  border-top: 1px dashed #e4e7ed;
  background: #f8f9fb;
}

.cell-output {
  padding: 12px 16px;
}

.output-stream {
  margin: 0;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 0.85rem;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-all;
}

.output-stream.stderr {
  color: #f56c6c;
}

.output-text {
  margin: 0;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 0.85rem;
  color: #67c23a;
  white-space: pre-wrap;
}

.output-error {
  margin: 0;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 0.85rem;
  color: #f56c6c;
  white-space: pre-wrap;
}

.output-image {
  max-width: 100%;
  overflow: auto;
}

.output-image img {
  max-width: 100%;
  height: auto;
}

.more-cells {
  text-align: center;
  padding: 24px;
  color: #909399;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.more-cells p {
  margin-bottom: 16px;
}

/* 文件预览 */
.file-preview {
  max-width: 600px;
  margin: 0 auto;
}

.file-info-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 24px;
  border: 1px solid #e4e7ed;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.file-info-card p {
  margin: 12px 0;
  color: #606266;
}

/* 文本文件预览 */
.text-file-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.text-file-preview .preview-header {
  flex-shrink: 0;
  padding-bottom: 16px;
  border-bottom: 1px solid #e4e7ed;
  margin-bottom: 16px;
}

.text-file-preview .preview-header h2 {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: #303133;
}

.text-file-preview .preview-meta {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.text-content-wrapper {
  flex: 1;
  overflow: auto;
  background: #f8f9fb;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.text-content {
  margin: 0;
  padding: 16px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #303133;
  white-space: pre-wrap;
  word-wrap: break-word;
  tab-size: 4;
}

.text-content code {
  font-family: inherit;
  background: none;
}

/* 浮动条 */
.jupyter-floating-bar {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.floating-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #303133;
}

.status-dot.running {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.floating-actions {
  display: flex;
  gap: 8px;
}

.floating-btn {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.floating-btn.open {
  background: #409eff;
  border: none;
  color: white;
}

.floating-btn.open:hover {
  background: #2d8cf0;
}

.floating-btn.stop {
  background: transparent;
  border: 1px solid #ff4d4f;
  color: #ff4d4f;
}

.floating-btn.stop:hover:not(:disabled) {
  background: #ff4d4f;
  color: white;
}

.floating-btn.stop:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 动画 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 滚动条 */
.file-list::-webkit-scrollbar,
.preview-area::-webkit-scrollbar,
.cell-content::-webkit-scrollbar {
  width: 6px;
}

.file-list::-webkit-scrollbar-track,
.preview-area::-webkit-scrollbar-track,
.cell-content::-webkit-scrollbar-track {
  background: transparent;
}

.file-list::-webkit-scrollbar-thumb,
.preview-area::-webkit-scrollbar-thumb,
.cell-content::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}

.file-list::-webkit-scrollbar-thumb:hover,
.preview-area::-webkit-scrollbar-thumb:hover,
.cell-content::-webkit-scrollbar-thumb:hover {
  background: #909399;
}

/* 镜像选择器 - 重新设计 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-active .image-selector-modal,
.modal-fade-leave-active .image-selector-modal {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .image-selector-modal,
.modal-fade-leave-to .image-selector-modal {
  transform: scale(0.95) translateY(-10px);
  opacity: 0;
}

.image-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.image-selector-modal {
  background: #ffffff;
  border-radius: 12px;
  width: 90%;
  max-width: 520px;
  overflow: hidden;
  border: 1px solid #e4e7ed;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
}

.modal-header {
  padding: 20px 24px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
  color: #ffffff;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.header-text h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: #ffffff;
}

.header-text p {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.modal-body {
  padding: 20px 24px;
  background: #ffffff;
}

.loading-images {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.loading-images .spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e4e7ed;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

.image-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.image-card {
  position: relative;
  display: flex;
  padding: 16px 20px;
  background: #f8f9fb;
  border: 2px solid #e4e7ed;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.image-card:hover:not(.unavailable) {
  background: #f0f5ff;
  border-color: rgba(64, 158, 255, 0.5);
  transform: translateY(-1px);
}

.image-card.selected {
  background: rgba(64, 158, 255, 0.1);
  border-color: #409eff;
  box-shadow: 0 0 20px rgba(64, 158, 255, 0.15);
}

.image-card.unavailable {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-check {
  position: absolute;
  top: 16px;
  right: 16px;
}

.check-circle {
  width: 22px;
  height: 22px;
  border: 2px solid #dcdfe6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: transparent;
}

.image-card.selected .check-circle {
  background: linear-gradient(135deg, #409eff, #2d8cf0);
  border-color: transparent;
  color: #fff;
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.python-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  background: linear-gradient(135deg, #306998, #4b8bbe);
  color: #fff;
  border-radius: 6px;
}

.python-badge svg {
  opacity: 0.9;
}

.recommend-badge {
  font-size: 0.7rem;
  font-weight: 500;
  padding: 4px 8px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  border-radius: 6px;
}

.unavailable-badge {
  font-size: 0.7rem;
  font-weight: 500;
  padding: 4px 8px;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border-radius: 6px;
}

.card-title {
  margin: 0 0 6px;
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
}

.card-desc {
  margin: 0 0 12px;
  font-size: 0.85rem;
  color: #909399;
  line-height: 1.5;
}

.card-features {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.feature-chip {
  font-size: 0.7rem;
  font-weight: 500;
  padding: 4px 10px;
  background: #f0f2f5;
  color: #606266;
  border-radius: 20px;
  border: 1px solid #e4e7ed;
}

.modal-footer {
  padding: 16px 24px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #e4e7ed;
  background: #ffffff;
}

.cancel-btn {
  padding: 10px 20px;
  background: #ffffff;
  border: 1px solid #dcdfe6;
  color: #606266;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #f5f7fa;
  border-color: #c0c4cc;
  color: #303133;
}

.confirm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  background: linear-gradient(135deg, #409eff, #2d8cf0);
  border: none;
  color: #fff;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2d8cf0, #1a6fcc);
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(64, 158, 255, 0.3);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-loading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (max-width: 1080px) {
  .file-sidebar {
    width: 290px;
  }
}

@media (max-width: 768px) {
  .project-container {
    flex-direction: column;
    height: auto;
    min-height: calc(100vh - 64px);
  }

  .file-sidebar {
    width: 100%;
    height: 46vh;
    border-right: none;
    border-bottom: 1px solid #e4e7ed;
    box-shadow: none;
  }

  .preview-area {
    padding: 14px;
  }
}
</style>
