<template>
  <div class="shared-preview-page">
    <!-- 顶部导航栏 -->
    <header class="preview-nav">
      <div class="nav-left">
        <button class="back-btn" @click="goBack">
          <span class="back-icon">←</span>
          <span>返回 Shared Space</span>
        </button>
      </div>
      <div class="nav-center">
        <h1 class="page-title">
          <span class="share-icon"></span>
          共享项目预览
        </h1>
      </div>
      <div class="nav-right">
        <button 
          class="fork-btn" 
          @click="forkProject"
          :disabled="isForking"
        >
          <span class="btn-icon"></span>
          {{ isForking ? 'Fork 中...' : 'Fork 到我的空间' }}
        </button>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="preview-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>加载项目信息...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <div class="error-icon"></div>
        <h2>{{ error }}</h2>
        <button class="retry-btn" @click="loadProject">重试</button>
      </div>

      <!-- 项目内容 -->
      <template v-else-if="project">
        <!-- 项目信息卡片 -->
        <div class="project-info-card">
          <div class="info-header">
            <div class="project-icon"></div>
            <div class="project-details">
              <h2 class="project-name">{{ project.name }}</h2>
              <div class="project-meta">
                <span class="owner-info">
                  <span class="meta-icon"></span>
                  {{ owner }}
                </span>
                <span class="stats-info">
                  <span class="meta-icon"></span>
                  {{ project.notebookCount }} notebooks
                </span>
                <span class="stats-info">
                  <span class="meta-icon"></span>
                  {{ project.fileCount }} files
                </span>
              </div>
              <p class="project-desc" v-if="project.description">{{ project.description }}</p>
              <p class="project-desc empty" v-else>暂无描述</p>
            </div>
          </div>
        </div>

        <!-- 文件列表和预览 -->
        <div class="files-container">
          <!-- 左侧文件树 -->
          <div class="file-tree">
            <div class="tree-header">
              <span class="header-icon"></span>
              <span>文件列表</span>
            </div>
            <div class="tree-content">
              <div 
                v-for="file in project.files" 
                :key="file.name"
                :class="['file-item', { active: selectedFile?.name === file.name }]"
                @click="selectFile(file)"
              >
                <span class="file-icon">{{ getFileIcon(file) }}</span>
                <span class="file-name">{{ file.name }}</span>
                <span class="file-size">{{ formatSize(file.size) }}</span>
              </div>
              <div v-if="project.files.length === 0" class="empty-tree">
                <span>暂无文件</span>
              </div>
            </div>
          </div>

          <!-- 右侧预览区 -->
          <div class="file-preview">
            <div v-if="!selectedFile" class="preview-empty">
              <div class="empty-icon"></div>
              <p>选择左侧文件进行预览</p>
            </div>
            
            <div v-else-if="loadingPreview" class="preview-loading">
              <div class="spinner"></div>
              <p>加载文件内容...</p>
            </div>

            <div v-else-if="previewError" class="preview-error">
              <div class="error-icon"></div>
              <p>{{ previewError }}</p>
            </div>

            <template v-else>
              <!-- Notebook 预览 -->
              <div v-if="isNotebook" class="notebook-preview">
                <div class="preview-header">
                  <span class="file-icon"></span>
                  <span class="file-name">{{ selectedFile.name }}</span>
                </div>
                <div class="notebook-cells">
                  <div 
                    v-for="(cell, index) in notebookCells" 
                    :key="index"
                    :class="['notebook-cell', cell.cell_type]"
                  >
                    <div class="cell-header">
                      <span class="cell-type">{{ cell.cell_type }}</span>
                      <span class="cell-index">[{{ index + 1 }}]</span>
                    </div>
                    <pre class="cell-content"><code>{{ cell.source.join('') }}</code></pre>
                  </div>
                </div>
              </div>

              <!-- 代码/文本预览 -->
              <div v-else class="code-preview">
                <div class="preview-header">
                  <span class="file-icon">{{ getFileIcon(selectedFile) }}</span>
                  <span class="file-name">{{ selectedFile.name }}</span>
                </div>
                <pre class="code-content"><code>{{ fileContent }}</code></pre>
              </div>
            </template>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const router = useRouter()

// 路由参数
const owner = computed(() => route.params.owner)
const projectName = computed(() => route.params.projectName)

// 状态
const loading = ref(true)
const error = ref(null)
const project = ref(null)
const selectedFile = ref(null)
const loadingPreview = ref(false)
const previewError = ref(null)
const fileContent = ref('')
const notebookCells = ref([])
const isForking = ref(false)

// 计算属性
const isNotebook = computed(() => selectedFile.value?.name.endsWith('.ipynb'))

// Token 管理
const getToken = () => localStorage.getItem('jupyter_token')
const authAxios = () => {
  const token = getToken()
  return axios.create({
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
}

// 加载项目信息
const loadProject = async () => {
  loading.value = true
  error.value = null
  
  try {
    const res = await authAxios().get(`/api/jupyter/shared-projects/${encodeURIComponent(owner.value)}/${encodeURIComponent(projectName.value)}`)
    project.value = res.data.project
  } catch (e) {
    if (e.response?.status === 404) {
      error.value = '项目不存在'
    } else if (e.response?.status === 403) {
      error.value = '该项目未公开或无权访问'
    } else {
      error.value = '加载失败: ' + (e.response?.data?.error || e.message)
    }
  } finally {
    loading.value = false
  }
}

// 选择文件
const selectFile = async (file) => {
  if (file.type === 'folder') return
  
  selectedFile.value = file
  loadingPreview.value = true
  previewError.value = null
  fileContent.value = ''
  notebookCells.value = []
  
  try {
    const res = await authAxios().get(
      `/api/jupyter/shared-projects/${encodeURIComponent(owner.value)}/${encodeURIComponent(projectName.value)}/files/${encodeURIComponent(file.name)}/content`
    )
    
    if (file.name.endsWith('.ipynb')) {
      // 解析 Notebook
      try {
        const notebook = JSON.parse(res.data.content)
        notebookCells.value = notebook.cells || []
      } catch (e) {
        previewError.value = 'Notebook 解析失败'
      }
    } else {
      fileContent.value = res.data.content
    }
  } catch (e) {
    previewError.value = '文件加载失败: ' + (e.response?.data?.error || e.message)
  } finally {
    loadingPreview.value = false
  }
}

// Fork 项目
const forkProject = async () => {
  isForking.value = true
  
  try {
    const res = await authAxios().post(`/api/jupyter/fork/${encodeURIComponent(owner.value)}/${encodeURIComponent(projectName.value)}`)
    
    if (res.data.status === 'forked') {
      alert(`成功 Fork 项目！新项目名称：${res.data.project.name}`)
      
      if (confirm('是否立即打开 Fork 的项目？')) {
        router.push(`/jupyter/project/${encodeURIComponent(res.data.project.name)}`)
      }
    }
  } catch (e) {
    alert('Fork 失败: ' + (e.response?.data?.error || e.message))
  } finally {
    isForking.value = false
  }
}

// 返回
const goBack = () => {
  router.push('/jupyter')
}

// 工具函数
const getFileIcon = (file) => {
  if (file.type === 'folder') return ''
  const name = file.name.toLowerCase()
  if (name.endsWith('.ipynb')) return ''
  if (name.endsWith('.py')) return ''
  if (name.endsWith('.md')) return ''
  if (name.endsWith('.json')) return ''
  if (name.endsWith('.csv')) return ''
  if (name.endsWith('.txt')) return ''
  return ''
}

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 初始化
onMounted(() => {
  loadProject()
})
</script>

<style scoped>
.shared-preview-page {
  min-height: 100vh;
  background: #f5f7fa;
  color: #303133;
}

/* 导航栏 */
.preview-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 64px;
  background: #000000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.nav-left .back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s;
}

.nav-left .back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.4);
  color: #ffffff;
}

.nav-center .page-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  color: #ffffff;
}

.share-icon {
  font-size: 1.4rem;
}

.nav-right .fork-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #f37626 0%, #e05d10 100%);
  border: none;
  border-radius: 8px;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-right .fork-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(243, 118, 38, 0.4);
}

.nav-right .fork-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 主内容 */
.preview-content {
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
}

/* 加载和错误状态 */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e4e7ed;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  font-size: 3rem;
}

.retry-btn {
  padding: 10px 24px;
  background: #409eff;
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

/* 项目信息卡片 */
.project-info-card {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.info-header {
  display: flex;
  gap: 20px;
}

.info-header .project-icon {
  font-size: 3rem;
}

.project-details {
  flex: 1;
}

.project-name {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.project-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
}

.owner-info,
.stats-info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #909399;
  font-size: 0.9rem;
}

.meta-icon {
  font-size: 1rem;
}

.project-desc {
  color: #606266;
  line-height: 1.6;
  margin: 0;
}

.project-desc.empty {
  color: #c0c4cc;
  font-style: italic;
}

/* 文件容器 */
.files-container {
  display: flex;
  gap: 24px;
  min-height: 500px;
}

/* 文件树 */
.file-tree {
  width: 300px;
  flex-shrink: 0;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.tree-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: #f8f9fb;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 600;
  color: #303133;
}

.tree-content {
  max-height: 500px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f0f2f5;
}

.file-item:hover {
  background: rgba(64, 158, 255, 0.05);
}

.file-item.active {
  background: rgba(64, 158, 255, 0.1);
  border-left: 3px solid #409eff;
}

.file-item .file-icon {
  font-size: 1.1rem;
}

.file-item .file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-item .file-size {
  font-size: 0.8rem;
  color: #909399;
}

.empty-tree {
  padding: 24px;
  text-align: center;
  color: #909399;
}

/* 预览区 */
.file-preview {
  flex: 1;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.preview-empty,
.preview-loading,
.preview-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 12px;
  color: #909399;
}

.preview-empty .empty-icon,
.preview-error .error-icon {
  font-size: 3rem;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  background: #f8f9fb;
  border-bottom: 1px solid #e4e7ed;
}

.preview-header .file-icon {
  font-size: 1.2rem;
}

.preview-header .file-name {
  font-weight: 600;
  color: #303133;
}

/* Notebook 预览 */
.notebook-cells {
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
}

.notebook-cell {
  margin-bottom: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}

.notebook-cell.code {
  border-left: 3px solid #409eff;
}

.notebook-cell.markdown {
  border-left: 3px solid #67c23a;
}

.cell-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8f9fb;
  font-size: 0.8rem;
  color: #606266;
  border-bottom: 1px solid #e4e7ed;
}

.cell-content {
  margin: 0;
  padding: 12px;
  background: #fafbfc;
  font-size: 0.9rem;
  overflow-x: auto;
  color: #303133;
}

.cell-content code {
  white-space: pre-wrap;
  word-break: break-all;
}

/* 代码预览 */
.code-content {
  margin: 0;
  padding: 16px;
  background: #fafbfc;
  max-height: 600px;
  overflow: auto;
  font-size: 0.9rem;
  color: #303133;
}

.code-content code {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
