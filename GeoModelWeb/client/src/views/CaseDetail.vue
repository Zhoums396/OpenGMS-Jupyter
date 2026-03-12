<template>
  <div class="case-detail-page">
    <header class="detail-nav">
      <div class="nav-left">
        <button class="back-btn" @click="goBack">
          <span>&larr;</span>
          <span>Back to Case Library</span>
        </button>
      </div>
      <div class="nav-center">
        <h1>Case Detail</h1>
      </div>
      <div class="nav-right"></div>
    </header>

    <main class="detail-content">
      <div v-if="loading" class="state-box">
        <div class="spinner"></div>
        <p>Loading case details...</p>
      </div>

      <div v-else-if="error" class="state-box">
        <p>{{ error }}</p>
        <button class="retry-btn" @click="loadCase">Retry</button>
      </div>

      <template v-else-if="caseData">
        <section class="hero-panel">
          <div class="hero-main">
            <p class="hero-kicker">Reproducible Case</p>
            <h2>{{ caseTitle }}</h2>
            <p class="hero-summary">{{ caseSummary }}</p>

            <div class="meta-row">
              <span class="meta-chip">Author: {{ caseData.owner }}</span>
              <span class="meta-chip">Updated: {{ formatDateTime(caseData.modifiedAt) }}</span>
              <span class="meta-chip">{{ caseData.notebookCount }} notebooks</span>
              <span class="meta-chip">{{ caseData.fileCount }} files</span>
            </div>

            <div v-if="caseTags.length" class="tag-row">
              <span v-for="tag in caseTags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>

          <aside class="hero-actions">
            <button class="action-btn reproduce-btn" @click="reproduceNow" :disabled="isReproducing">
              {{ isReproducing ? 'Preparing Reproduction...' : 'Reproduce Now (Fork + Run)' }}
            </button>
            <button class="action-btn" @click="openSharedPreview">Project Preview</button>
            <button class="action-btn primary" @click="forkProject" :disabled="isForking">
              {{ isForking ? 'Forking...' : 'Fork to My Space' }}
            </button>
            <button class="action-btn" @click="openCoreNotebook" :disabled="!resolvedCoreNotebook">
              {{ resolvedCoreNotebook ? `Open Core Notebook (${resolvedCoreNotebook})` : 'Open Core Notebook' }}
            </button>
            <button class="action-btn" @click="copySteps" :disabled="!hasSteps">
              {{ hasSteps ? 'Copy Reproduction Steps' : 'No Reproduction Steps' }}
            </button>
            <p v-if="reproduceStatus" class="reproduce-status">{{ reproduceStatus }}</p>
            <p v-if="copyStatus" class="copy-status">{{ copyStatus }}</p>
          </aside>
        </section>

        <section class="overview-grid">
          <article class="info-card">
            <h3>Scenario</h3>
            <p>{{ caseScenario }}</p>
          </article>

          <article class="info-card">
            <h3>Runtime</h3>
            <p><strong>Environment:</strong> {{ caseEnvironment }}</p>
            <p><strong>Core Notebook:</strong> {{ resolvedCoreNotebook || 'Not provided' }}</p>
          </article>

          <article class="info-card">
            <h3>Datasets</h3>
            <ul v-if="caseDatasets.length">
              <li v-for="item in caseDatasets" :key="item">{{ item }}</li>
            </ul>
            <p v-else>Not provided</p>
          </article>

          <article class="info-card">
            <h3>Reproduction Steps</h3>
            <ol v-if="caseSteps.length">
              <li v-for="item in caseSteps" :key="item">{{ item }}</li>
            </ol>
            <p v-else>Not provided</p>
          </article>

          <article class="info-card full-width">
            <h3>Expected Results</h3>
            <ul v-if="caseResults.length">
              <li v-for="item in caseResults" :key="item">{{ item }}</li>
            </ul>
            <p v-else>Not provided</p>
          </article>
        </section>

        <section class="files-panel">
          <div class="files-header">
            <div>
              <h3>Project Files</h3>
              <p>{{ filteredFiles.length }} / {{ allFiles.length }} items</p>
            </div>
            <div class="files-tools">
              <input
                v-model="fileQuery"
                class="file-search"
                type="text"
                placeholder="Search file name"
              >
              <select v-model="fileTypeFilter" class="file-filter">
                <option value="all">All types</option>
                <option value="notebook">Notebook</option>
                <option value="data">Data</option>
                <option value="script">Script</option>
                <option value="archive">Archive</option>
                <option value="folder">Folder</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div class="file-grid">
            <div v-for="file in filteredFiles" :key="file.name" class="file-item">
              <span class="kind-badge">{{ fileKindBadge(file) }}</span>
              <span class="file-name" :title="file.name">{{ file.name }}</span>
              <span class="file-meta">{{ formatSize(file.size) }}</span>
            </div>
          </div>

          <p v-if="filteredFiles.length === 0" class="empty-files">No files matched your filters.</p>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref('')
const caseData = ref(null)
const isForking = ref(false)
const isReproducing = ref(false)
const reproduceStatus = ref('')
const copyStatus = ref('')
const fileQuery = ref('')
const fileTypeFilter = ref('all')

const owner = computed(() => route.params.owner)
const projectName = computed(() => route.params.projectName)

const getToken = () => localStorage.getItem('jupyter_token')
const authAxios = () => {
  const token = getToken()
  return axios.create({
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
}

const loadCase = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await authAxios().get(
      `/api/jupyter/cases/${encodeURIComponent(owner.value)}/${encodeURIComponent(projectName.value)}`
    )
    caseData.value = res.data.case
  } catch (e) {
    error.value = 'Failed to load case: ' + (e.response?.data?.error || e.message)
  } finally {
    loading.value = false
  }
}

const caseTitle = computed(() => caseData.value?.case?.title || caseData.value?.projectName || 'Untitled case')
const caseSummary = computed(() => caseData.value?.case?.summary || caseData.value?.description || 'No case summary yet')
const caseScenario = computed(() => caseData.value?.case?.scenario || 'Not provided')
const caseEnvironment = computed(() => caseData.value?.case?.environment || 'Not provided')
const caseDatasets = computed(() => caseData.value?.case?.datasets || [])
const caseSteps = computed(() => caseData.value?.case?.steps || [])
const caseResults = computed(() => caseData.value?.case?.results || [])
const caseTags = computed(() => caseData.value?.case?.tags || [])
const hasSteps = computed(() => caseSteps.value.length > 0)

const allFiles = computed(() => {
  const files = caseData.value?.files || []
  return [...files].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1
    if (a.type !== 'folder' && b.type === 'folder') return 1
    return a.name.localeCompare(b.name)
  })
})

const resolvedCoreNotebook = computed(() => {
  const fromMeta = (caseData.value?.case?.coreNotebook || '').trim()
  if (fromMeta) return fromMeta
  const fallback = allFiles.value.find(file => file.name.toLowerCase().endsWith('.ipynb'))
  return fallback?.name || ''
})

const detectFileKind = (file) => {
  if (file.type === 'folder') return 'folder'

  const lowerName = (file.name || '').toLowerCase()
  if (lowerName.endsWith('.ipynb')) return 'notebook'
  if (/\.(csv|json|xml|nc|tif|tiff|h5|hdf5|geojson|txt)$/i.test(lowerName)) return 'data'
  if (/\.(py|js|ts|sh|bat|r|m|jl)$/i.test(lowerName)) return 'script'
  if (/\.(zip|rar|7z|tar|gz|bz2)$/i.test(lowerName)) return 'archive'
  return 'other'
}

const filteredFiles = computed(() => {
  const query = fileQuery.value.trim().toLowerCase()

  return allFiles.value.filter(file => {
    const matchesQuery = !query || file.name.toLowerCase().includes(query)
    if (!matchesQuery) return false

    if (fileTypeFilter.value === 'all') return true
    return detectFileKind(file) === fileTypeFilter.value
  })
})

const fileKindBadge = (file) => {
  const kind = detectFileKind(file)
  if (kind === 'folder') return 'DIR'
  if (kind === 'notebook') return 'NB'
  if (kind === 'data') return 'DATA'
  if (kind === 'script') return 'CODE'
  if (kind === 'archive') return 'ZIP'
  return 'FILE'
}

const chooseRuntimeImageId = async (environmentText) => {
  try {
    const res = await authAxios().get('/api/jupyter/images')
    const images = (res.data?.images || []).filter(img => img.available)
    if (!images.length) return undefined

    const env = String(environmentText || '').toLowerCase().trim()
    const defaultImage = images.find(img => img.default)
    if (!env) return defaultImage?.id || images[0].id

    const keywords = env
      .split(/[^a-z0-9.+-]+/g)
      .filter(token => token.length >= 3)
      .slice(0, 14)

    const scoreImage = (image) => {
      const text = `${image.id} ${image.label || ''} ${image.description || ''} ${(image.features || []).join(' ')}`.toLowerCase()
      let score = 0

      for (const keyword of keywords) {
        if (text.includes(keyword)) score += 1
      }

      if (env.includes('3.9') && text.includes('3.9')) score += 4
      if (env.includes('geopandas') && text.includes('geopandas')) score += 4
      if (env.includes('rasterio') && text.includes('rasterio')) score += 4
      if (env.includes('scipy') && text.includes('scipy')) score += 3
      if ((env.includes('minimal') || env.includes('clean') || env.includes('lightweight')) && (text.includes('minimal') || text.includes('clean'))) score += 2

      return score
    }

    let best = images[0]
    let bestScore = scoreImage(best)
    for (const image of images.slice(1)) {
      const score = scoreImage(image)
      if (score > bestScore) {
        best = image
        bestScore = score
      }
    }

    if (bestScore > 0) return best.id
    return defaultImage?.id || images[0].id
  } catch (e) {
    return undefined
  }
}

const openNotebookFromJupyterUrl = (url, token, notebookName, popupWindow) => {
  if (!url) return false

  const baseUrl = url.split('?')[0]
  let targetUrl = url
  if (notebookName) {
    if (token) {
      targetUrl = `${baseUrl}/tree/${encodeURIComponent(notebookName)}?token=${encodeURIComponent(token)}`
    } else {
      targetUrl = `${baseUrl}/tree/${encodeURIComponent(notebookName)}`
    }
  }

  if (popupWindow) {
    popupWindow.location.href = targetUrl
    return true
  }

  window.open(targetUrl, '_blank')
  return true
}

const reproduceNow = async () => {
  if (!caseData.value || isReproducing.value) return

  if (!getToken()) {
    alert('Please sign in first.')
    router.push('/jupyter')
    return
  }

  isReproducing.value = true
  reproduceStatus.value = 'Forking project...'
  const popupWindow = window.open('', '_blank')

  try {
    const preferredName = `${caseData.value.projectName}-repro`
    const forkRes = await authAxios().post(
      `/api/jupyter/fork/${encodeURIComponent(caseData.value.owner)}/${encodeURIComponent(caseData.value.projectName)}`,
      { newName: preferredName }
    )

    const forkedProjectName = forkRes.data?.project?.name
    if (!forkedProjectName) {
      throw new Error('Fork succeeded but project name is missing.')
    }

    reproduceStatus.value = 'Selecting runtime image...'
    const imageId = await chooseRuntimeImageId(caseEnvironment.value)

    reproduceStatus.value = 'Starting Jupyter runtime...'
    const startRes = await authAxios().post('/api/jupyter/start', {
      projectName: forkedProjectName,
      imageId
    })

    const status = startRes.data?.status
    if (status !== 'started' && status !== 'already_running') {
      throw new Error(startRes.data?.error || 'Failed to start runtime.')
    }

    const opened = openNotebookFromJupyterUrl(
      startRes.data?.url,
      startRes.data?.token,
      resolvedCoreNotebook.value,
      popupWindow
    )

    if (!opened && popupWindow) popupWindow.close()

    reproduceStatus.value = 'Reproduction environment is ready.'
    router.push(`/jupyter/project/${encodeURIComponent(forkedProjectName)}`)
  } catch (e) {
    if (popupWindow) popupWindow.close()
    reproduceStatus.value = 'Reproduction failed.'
    alert('Failed to reproduce: ' + (e.response?.data?.error || e.message))
  } finally {
    isReproducing.value = false
    window.setTimeout(() => {
      reproduceStatus.value = ''
    }, 2500)
  }
}

const forkProject = async () => {
  if (!caseData.value || isForking.value) return
  isForking.value = true
  try {
    const res = await authAxios().post(
      `/api/jupyter/fork/${encodeURIComponent(caseData.value.owner)}/${encodeURIComponent(caseData.value.projectName)}`
    )
    if (res.data.status === 'forked') {
      alert(`Fork successful: ${res.data.project.name}`)
      if (confirm('Open the forked project now?')) {
        router.push(`/jupyter/project/${encodeURIComponent(res.data.project.name)}`)
      }
    }
  } catch (e) {
    alert('Fork failed: ' + (e.response?.data?.error || e.message))
  } finally {
    isForking.value = false
  }
}

const copySteps = async () => {
  if (!hasSteps.value) return

  const text = caseSteps.value.map((step, index) => `${index + 1}. ${step}`).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copyStatus.value = 'Reproduction steps copied'
  } catch (e) {
    copyStatus.value = 'Failed to copy steps'
  }

  window.setTimeout(() => {
    copyStatus.value = ''
  }, 1800)
}

const openSharedPreview = () => {
  if (!caseData.value) return
  router.push(`/jupyter/shared/${encodeURIComponent(caseData.value.owner)}/${encodeURIComponent(caseData.value.projectName)}`)
}

const openCoreNotebook = () => {
  if (!caseData.value || !resolvedCoreNotebook.value) return
  router.push({
    path: `/jupyter/shared/${encodeURIComponent(caseData.value.owner)}/${encodeURIComponent(caseData.value.projectName)}`,
    query: { notebook: resolvedCoreNotebook.value }
  })
}

const goBack = () => {
  router.push('/jupyter/cases')
}

const formatDateTime = (date) => {
  if (!date) return '-'
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}/${month}/${day} ${hour}:${minute}`
}

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

onMounted(() => {
  loadCase()
})
</script>

<style scoped>
.case-detail-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #edf2f8 0%, #f4f6fa 100%);
  color: #0f172a;
}

.detail-nav {
  height: 64px;
  background: #000;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.detail-nav h1 {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
}

.back-btn {
  border: 1px solid rgba(255, 255, 255, 0.26);
  background: transparent;
  color: #fff;
  border-radius: 7px;
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-content {
  max-width: 1240px;
  margin: 0 auto;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.state-box {
  min-height: 320px;
  border: 1px dashed #c7d2e5;
  border-radius: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #d7dce5;
  border-top-color: #2f6cf6;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.retry-btn {
  border: none;
  border-radius: 7px;
  background: #2f6cf6;
  color: #fff;
  padding: 8px 14px;
  cursor: pointer;
}

.hero-panel {
  border: 1px solid #dbe3ef;
  border-radius: 18px;
  background: linear-gradient(130deg, #ffffff 0%, #f4f7fd 52%, #edf4ff 100%);
  padding: 20px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
}

.hero-kicker {
  margin: 0 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #475569;
  font-weight: 700;
}

.hero-main h2 {
  margin: 0;
  font-size: 34px;
  line-height: 1.1;
}

.hero-summary {
  margin: 11px 0;
  color: #334155;
  line-height: 1.66;
  max-width: 760px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-chip {
  border: 1px solid #d2ddef;
  border-radius: 999px;
  padding: 6px 11px;
  font-size: 12px;
  color: #334155;
  background: #f8fbff;
}

.tag-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  background: #e6edff;
  color: #1d4ed8;
  font-size: 12px;
  border-radius: 999px;
  padding: 4px 9px;
}

.hero-actions {
  border: 1px solid #dbe4f4;
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  border: 1px solid #cbd8f5;
  border-radius: 9px;
  background: #eef4ff;
  color: #1e3a8a;
  padding: 10px;
  text-align: left;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 15px rgba(30, 58, 138, 0.15);
}

.action-btn.primary {
  background: #2f6cf6;
  border-color: #2f6cf6;
  color: #fff;
}

.action-btn.reproduce-btn {
  background: linear-gradient(135deg, #0f766e, #0ea5e9);
  border-color: transparent;
  color: #fff;
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.reproduce-status {
  margin: 2px 0 0;
  font-size: 12px;
  color: #0f766e;
}

.copy-status {
  margin: 2px 0 0;
  font-size: 12px;
  color: #0f766e;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.info-card {
  border: 1px solid #dbe3ef;
  border-radius: 12px;
  background: #fff;
  padding: 14px;
}

.info-card h3 {
  margin: 0 0 8px;
}

.info-card p,
.info-card li {
  color: #334155;
  line-height: 1.6;
}

.info-card ul,
.info-card ol {
  margin: 0;
  padding-left: 18px;
}

.full-width {
  grid-column: 1 / -1;
}

.files-panel {
  border: 1px solid #dbe3ef;
  border-radius: 14px;
  background: #fff;
  padding: 14px;
}

.files-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 12px;
}

.files-header h3 {
  margin: 0;
}

.files-header p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}

.files-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-search,
.file-filter {
  border: 1px solid #d4dceb;
  border-radius: 9px;
  padding: 9px 10px;
  font-size: 13px;
  background: #f8fbff;
}

.file-search {
  min-width: 220px;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
}

.file-item {
  border: 1px solid #e2e8f3;
  border-radius: 9px;
  padding: 9px 10px;
  background: #f9fbff;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.kind-badge {
  border-radius: 999px;
  background: #dbe8ff;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  text-align: center;
}

.file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #1e293b;
}

.file-meta {
  color: #64748b;
  font-size: 12px;
}

.empty-files {
  margin: 14px 0 0;
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 1080px) {
  .hero-panel {
    grid-template-columns: 1fr;
  }

  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .detail-content {
    padding: 14px;
  }

  .detail-nav {
    padding: 0 10px;
  }

  .detail-nav h1 {
    font-size: 18px;
  }

  .hero-main h2 {
    font-size: 27px;
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }

  .files-header {
    flex-direction: column;
    align-items: stretch;
  }

  .files-tools {
    flex-direction: column;
    align-items: stretch;
  }

  .file-search {
    min-width: 0;
  }

  .file-grid {
    grid-template-columns: 1fr;
  }
}
</style>
