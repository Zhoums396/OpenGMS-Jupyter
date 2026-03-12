<template>
  <div class="case-library-page">
    <header class="library-nav">
      <div class="nav-left">
        <button class="back-btn" @click="goBack">
          <span>&larr;</span>
          <span>Back to Dashboard</span>
        </button>
      </div>
      <div class="nav-center">
        <h1>Case Library</h1>
      </div>
      <div class="nav-right"></div>
    </header>

    <main class="library-content">
      <section class="library-hero">
        <div class="hero-left">
          <p class="hero-kicker">Knowledge Reproduction</p>
          <h2>Discover reusable geoscience cases</h2>
          <p class="hero-subtitle">
            Browse published projects with reproducible steps, datasets, and runnable notebooks.
          </p>
        </div>
        <div class="hero-stats">
          <div class="stat-card">
            <span class="stat-label">Cases</span>
            <span class="stat-value">{{ cases.length }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Contributors</span>
            <span class="stat-value">{{ ownerCount }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Notebooks</span>
            <span class="stat-value">{{ totalNotebooks }}</span>
          </div>
        </div>
      </section>

      <section class="toolbar-panel">
        <div class="toolbar-left">
          <input
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="Search by title, tag, scenario, or owner"
          >
        </div>
        <div class="toolbar-right">
          <label class="sort-label" for="sortBy">Sort</label>
          <select id="sortBy" v-model="sortBy" class="sort-select">
            <option value="updated">Recently updated</option>
            <option value="notebooks">Most notebooks</option>
            <option value="files">Most files</option>
            <option value="title">Title A-Z</option>
          </select>
        </div>
      </section>

      <div v-if="loading" class="state-box">
        <div class="spinner"></div>
        <p>Loading cases...</p>
      </div>

      <div v-else-if="error" class="state-box">
        <p>{{ error }}</p>
        <button class="retry-btn" @click="loadCases">Retry</button>
      </div>

      <div v-else-if="visibleCases.length === 0" class="state-box">
        <p>{{ searchQuery.trim() ? 'No matching cases' : 'No cases found yet' }}</p>
        <p v-if="!searchQuery.trim()" class="empty-hint">
          Cases appear after a project is published as a case in My Space.
        </p>
      </div>

      <div v-else class="case-grid">
        <article
          v-for="(item, index) in visibleCases"
          :key="`${item.owner}/${item.projectName}`"
          class="case-card"
          @click="openCase(item)"
        >
          <div class="case-cover" :style="getCaseCoverStyle(item, index)">
            <div class="cover-content">
              <span class="scenario-pill">{{ getScenario(item) }}</span>
              <h3 class="case-title">{{ getCaseTitle(item) }}</h3>
              <p class="case-summary">
                {{ truncate(getCaseSummary(item), 120) }}
              </p>
            </div>
          </div>

          <div class="case-body">
            <div class="owner-row">
              <span class="owner-avatar">{{ getOwnerInitial(item.owner) }}</span>
              <div class="owner-meta">
                <span class="owner-name">@{{ item.owner }}</span>
                <span class="updated-time">Updated {{ formatDate(item.modifiedAt) }}</span>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-item">
                <span class="meta-value">{{ item.notebookCount }}</span>
                <span class="meta-label">Notebooks</span>
              </div>
              <div class="meta-item">
                <span class="meta-value">{{ item.fileCount }}</span>
                <span class="meta-label">Files</span>
              </div>
            </div>

            <div class="tag-row">
              <span
                v-for="tag in getVisibleTags(item)"
                :key="`${item.owner}/${item.projectName}/${tag}`"
                class="tag"
              >
                {{ tag }}
              </span>
            </div>

            <button class="view-btn" @click.stop="openCase(item)">View Case</button>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const cases = ref([])
const searchQuery = ref('')
const sortBy = ref('updated')

const ACCENT_PALETTES = [
  ['#0f172a', '#1d4ed8'],
  ['#064e3b', '#0891b2'],
  ['#4c1d95', '#2563eb'],
  ['#7c2d12', '#ea580c'],
  ['#1f2937', '#0ea5e9']
]

const getToken = () => localStorage.getItem('jupyter_token')
const authAxios = () => {
  const token = getToken()
  return axios.create({
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
}

const loadCases = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await authAxios().get('/api/jupyter/cases')
    cases.value = res.data.cases || []
  } catch (e) {
    error.value = 'Failed to load cases: ' + (e.response?.data?.error || e.message)
  } finally {
    loading.value = false
  }
}

const getCaseTitle = (item) => item.case?.title || item.projectName || 'Untitled Case'
const getCaseSummary = (item) => item.case?.summary || item.description || 'No case summary yet'
const getScenario = (item) => item.case?.scenario || 'General'
const getTags = (item) => item.case?.tags || []
const getVisibleTags = (item) => getTags(item).slice(0, 4)

const ownerCount = computed(() => new Set(cases.value.map(item => item.owner)).size)
const totalNotebooks = computed(() => cases.value.reduce((sum, item) => sum + (item.notebookCount || 0), 0))

const visibleCases = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  let result = cases.value.filter(item => {
    if (!query) return true
    const title = getCaseTitle(item).toLowerCase()
    const summary = getCaseSummary(item).toLowerCase()
    const tags = getTags(item).join(' ').toLowerCase()
    const scenario = getScenario(item).toLowerCase()
    const owner = (item.owner || '').toLowerCase()
    return title.includes(query) || summary.includes(query) || tags.includes(query) || scenario.includes(query) || owner.includes(query)
  })

  result = [...result]
  if (sortBy.value === 'notebooks') {
    result.sort((a, b) => (b.notebookCount || 0) - (a.notebookCount || 0))
  } else if (sortBy.value === 'files') {
    result.sort((a, b) => (b.fileCount || 0) - (a.fileCount || 0))
  } else if (sortBy.value === 'title') {
    result.sort((a, b) => getCaseTitle(a).localeCompare(getCaseTitle(b)))
  } else {
    result.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
  }

  return result
})

const getCaseCoverStyle = (item, index) => {
  const coverImage = item.case?.coverImage || ''
  if (coverImage && /^https?:\/\//i.test(coverImage)) {
    const safeUrl = encodeURI(coverImage)
    return {
      backgroundImage: `linear-gradient(120deg, rgba(15, 23, 42, 0.72), rgba(30, 64, 175, 0.42)), url("${safeUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }

  const palette = ACCENT_PALETTES[index % ACCENT_PALETTES.length]
  return {
    backgroundImage: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`
  }
}

const getOwnerInitial = (owner) => {
  if (!owner) return 'U'
  return owner.charAt(0).toUpperCase()
}

const truncate = (text, maxLength = 120) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '...'
}

const openCase = (item) => {
  router.push(`/jupyter/cases/${encodeURIComponent(item.owner)}/${encodeURIComponent(item.projectName)}`)
}

const goBack = () => {
  router.push('/jupyter')
}

const formatDate = (date) => {
  if (!date) return '-'
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

onMounted(() => {
  loadCases()
})
</script>

<style scoped>
.case-library-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #eef2f8 0%, #f4f6fa 45%, #f7f9fc 100%);
  color: #111827;
}

.library-nav {
  height: 64px;
  background: #000;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.nav-center h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.back-btn {
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: transparent;
  color: #fff;
  border-radius: 7px;
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.library-content {
  max-width: 1240px;
  margin: 0 auto;
  padding: 24px;
}

.library-hero {
  border: 1px solid #dbe3ef;
  border-radius: 18px;
  background: linear-gradient(130deg, #ffffff 0%, #f3f6fd 52%, #ecf3ff 100%);
  padding: 22px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.hero-kicker {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #475569;
  font-weight: 700;
}

.hero-left h2 {
  margin: 0;
  font-size: 28px;
  line-height: 1.15;
}

.hero-subtitle {
  margin: 10px 0 0;
  color: #475569;
  max-width: 620px;
  line-height: 1.55;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(90px, 1fr));
  gap: 10px;
}

.stat-card {
  min-width: 108px;
  border: 1px solid #dbe4f4;
  border-radius: 12px;
  padding: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
}

.stat-value {
  font-size: 23px;
  font-weight: 700;
  color: #0f172a;
}

.toolbar-panel {
  border: 1px solid #dbe3ef;
  background: #fff;
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.toolbar-left {
  flex: 1;
}

.search-input {
  width: 100%;
  max-width: 560px;
  padding: 11px 12px;
  border: 1px solid #d4dceb;
  border-radius: 9px;
  font-size: 14px;
  background: #f8fafd;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-label {
  font-size: 13px;
  color: #475569;
}

.sort-select {
  padding: 9px 10px;
  border: 1px solid #d4dceb;
  border-radius: 9px;
  font-size: 13px;
  color: #334155;
  background: #fff;
}

.state-box {
  min-height: 300px;
  border: 1px dashed #c7d2e5;
  border-radius: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.empty-hint {
  margin: 0;
  color: #64748b;
  font-size: 13px;
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

.case-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 18px;
}

.case-card {
  border: 1px solid #dbe3ef;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  cursor: pointer;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

.case-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 34px rgba(30, 41, 59, 0.14);
}

.case-cover {
  min-height: 170px;
  padding: 16px;
  color: #f8fafc;
  display: flex;
  align-items: flex-end;
}

.cover-content {
  width: 100%;
}

.scenario-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid rgba(248, 250, 252, 0.38);
  margin-bottom: 10px;
}

.case-title {
  margin: 0;
  font-size: 23px;
  line-height: 1.15;
}

.case-summary {
  margin: 9px 0 0;
  color: rgba(248, 250, 252, 0.92);
  line-height: 1.45;
  font-size: 13px;
}

.case-body {
  padding: 14px;
}

.owner-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.owner-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #cbd5e1, #94a3b8);
  color: #0f172a;
  font-weight: 700;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.owner-meta {
  display: flex;
  flex-direction: column;
}

.owner-name {
  font-size: 13px;
  color: #1e293b;
}

.updated-time {
  font-size: 12px;
  color: #64748b;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.meta-item {
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  padding: 8px;
  background: #f8fbff;
  display: flex;
  flex-direction: column;
}

.meta-value {
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}

.meta-label {
  font-size: 11px;
  color: #64748b;
}

.tag-row {
  min-height: 28px;
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  background: #e7efff;
  color: #1d4ed8;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
}

.view-btn {
  width: 100%;
  border: 1px solid #bfd0f7;
  background: #e8f0ff;
  color: #0f3ea7;
  border-radius: 9px;
  padding: 9px 12px;
  cursor: pointer;
  font-weight: 600;
}

@media (max-width: 900px) {
  .library-hero {
    flex-direction: column;
  }

  .hero-left h2 {
    font-size: 24px;
  }

  .hero-stats {
    grid-template-columns: repeat(3, 1fr);
  }

  .toolbar-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .library-content {
    padding: 14px;
  }

  .library-nav {
    padding: 0 10px;
  }

  .nav-center h1 {
    font-size: 18px;
  }

  .hero-stats {
    grid-template-columns: 1fr;
  }

  .case-grid {
    grid-template-columns: 1fr;
  }
}
</style>
