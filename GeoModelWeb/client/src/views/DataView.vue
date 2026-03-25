<template>
  <div class="catalog-page">
    <div class="catalog-shell">
      <aside class="catalog-sidebar">
        <h2 class="catalog-sidebar-title font-headline">Repository Filters</h2>

        <div class="catalog-filter-block category-list">
          <button
            v-for="cat in localizedCategories"
            :key="cat.value"
            :class="['catalog-filter-item', { active: selectedCategory === cat.value }]"
            @click="selectCategory(cat.value)"
          >
            <span v-if="selectedCategory === cat.value" class="catalog-filter-indicator"></span>
            <span>{{ cat.label }}</span>
          </button>
        </div>

        <div class="catalog-status-block">
          <p class="catalog-label">{{ $t('dataView.sortLabel') }}</p>

          <select v-model="sortField" @change="handleSortChange" class="catalog-select">
            <option value="createTime">{{ $t('dataView.sortLatest') }}</option>
            <option value="fileSize">{{ $t('dataView.sortSize') }}</option>
            <option value="pageviews">{{ $t('dataView.sortViews') }}</option>
          </select>

          <button class="catalog-order-btn" @click="toggleSortOrder">
            {{ sortAsc ? 'Ascending' : 'Descending' }}
          </button>
        </div>

        <div class="catalog-callout">
          <span class="catalog-callout-icon">◫</span>
          <h3 class="font-headline">Need project-ready data assets?</h3>
          <p>Fork datasets into your own workspace, stage uploads, and connect them directly to notebooks.</p>
          <button type="button" @click="$router.push('/jupyter')">Open Workspace</button>
        </div>
      </aside>

      <section class="catalog-main">
        <header class="catalog-header">
          <div class="catalog-header-copy">
            <h1 class="font-headline">{{ $t('dataView.title') }}</h1>
            <p>{{ $t('dataView.subtitle') }}</p>
          </div>

          <div class="catalog-search">
            <span class="catalog-search-icon">⌕</span>
            <input
              v-model="searchQuery"
              @keyup.enter="handleSearch"
              type="text"
              :placeholder="$t('dataView.searchPlaceholder')"
            >
          </div>
        </header>

        <div v-if="loading && !dataList.length" class="catalog-loading">
          <div class="spinner"></div>
          <p>{{ $t('dataView.loading') }}</p>
        </div>

        <div v-else-if="!dataList.length" class="catalog-empty">
          <p>{{ $t('dataView.noData') }}</p>
          <span>{{ $t('dataView.noDataHint') }}</span>
        </div>

        <div v-else class="catalog-list">
          <DataCard
            v-for="item in dataList"
            :key="item.id"
            :data="item"
            @view="handleView"
            @download="handleDownload"
          />
        </div>

        <div class="catalog-pagination" v-if="totalPages > 1">
          <button
            class="catalog-page-btn"
            :disabled="currentPage === 1"
            @click="changePage(currentPage - 1)"
          >
            ‹
          </button>

          <span class="catalog-page-current">{{ currentPage }}</span>
          <span class="catalog-page-total">/ {{ totalPages }}</span>

          <button
            class="catalog-page-btn"
            :disabled="currentPage === totalPages"
            @click="changePage(currentPage + 1)"
          >
            ›
          </button>
        </div>
      </section>
    </div>

    <footer class="catalog-footer">
      <div class="catalog-footer-shell">
        <p class="catalog-footer-brand font-headline">OpenGeoLab</p>
        <div class="catalog-footer-links">
          <a href="#">Institutional Repository</a>
          <a href="#">Data Governance</a>
          <a href="#">API Documentation</a>
          <a href="#">Privacy Policy</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import DataCard from '../components/DataCard.vue'

const { t } = useI18n()

const DOWNLOAD_BASE = 'https://geomodeling.njnu.edu.cn/OpenGMPBack'

const categoryKeys = [
  { key: 'all', value: '' },
  { key: 'basicGeo', value: '基础地理' },
  { key: 'landUse', value: '土地利用/覆盖' },
  { key: 'terrain', value: '地形' },
  { key: 'landform', value: '地貌' },
  { key: 'climate', value: '气候' },
  { key: 'hydrology', value: '水文' },
  { key: 'soil', value: '土壤' },
  { key: 'vegetation', value: '植被' },
  { key: 'ecosystem', value: '生态系统' },
  { key: 'population', value: '人口' },
  { key: 'socioeconomic', value: '社会经济' },
  { key: 'agriculture', value: '农业' },
  { key: 'disaster', value: '灾害' },
  { key: 'environment', value: '环境' },
  { key: 'lake', value: '湖泊' },
  { key: 'other', value: '其他数据' }
]

const localizedCategories = computed(() => {
  return categoryKeys.map(cat => ({
    label: t(`dataView.categories.${cat.key}`),
    value: cat.value
  }))
})

const searchQuery = ref('')
const selectedCategory = ref('')
const sortField = ref('createTime')
const sortAsc = ref(false)
const dataList = ref([])
const loading = ref(false)
const currentPage = ref(1)
const total = ref(0)
const totalPages = ref(0)
const pageSize = 18

const fetchData = async (page = 1) => {
  loading.value = true
  try {
    const params = {
      asc: sortAsc.value,
      page,
      pageSize,
      searchText: searchQuery.value,
      sortField: sortField.value,
      tagClass: 'problemTags',
      tagName: selectedCategory.value
    }

    const response = await axios.post('/api/datacenter/list', params)

    if (response.data.code === 0 && response.data.data) {
      dataList.value = response.data.data.content || []
      total.value = response.data.data.totalElements || 0
      totalPages.value = response.data.data.totalPages || 0
      currentPage.value = page
    } else {
      console.error('API Error:', response.data.msg)
      dataList.value = []
    }
  } catch (error) {
    console.error('Failed to fetch data:', error)
    dataList.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchData(1)
}

const selectCategory = (category) => {
  selectedCategory.value = category
  currentPage.value = 1
  fetchData(1)
}

const handleSortChange = () => {
  currentPage.value = 1
  fetchData(1)
}

const toggleSortOrder = () => {
  sortAsc.value = !sortAsc.value
  fetchData(currentPage.value)
}

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    fetchData(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const handleView = (data) => {
  console.log('View data:', data)
}

const handleDownload = (data) => {
  if (data.id) {
    window.open(`${DOWNLOAD_BASE}/userRes/downloadDataItem/${data.id}`, '_blank')
    return
  }

  alert('下载链接不可用')
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.catalog-page {
  padding: 2.5rem 2rem 4rem;
  background: #f8f9fa;
}

.catalog-shell,
.catalog-footer-shell {
  max-width: 1560px;
  margin: 0 auto;
}

.catalog-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 3rem;
  align-items: start;
}

.catalog-sidebar {
  padding-top: 0.5rem;
}

.catalog-sidebar-title,
.catalog-footer-brand {
  margin: 0;
  color: var(--primary-strong);
}

.catalog-sidebar-title {
  font-size: 0.98rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.catalog-filter-block,
.catalog-status-block {
  margin-top: 1.75rem;
}

.category-list {
  max-height: 520px;
  overflow: auto;
  padding-right: 0.25rem;
}

.catalog-filter-item {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  margin-bottom: 0.3rem;
  padding: 0 1rem 0 1.15rem;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.catalog-filter-item:hover {
  background: rgba(243, 244, 245, 0.98);
  color: var(--primary-strong);
}

.catalog-filter-item.active {
  background: rgba(225, 227, 228, 0.95);
  color: var(--primary-strong);
  font-weight: 700;
}

.catalog-filter-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  width: 4px;
  height: 24px;
  border-radius: 0 4px 4px 0;
  background: var(--accent-color);
  transform: translateY(-50%);
}

.catalog-label {
  margin: 0 0 1rem;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--text-muted);
}

.catalog-select,
.catalog-order-btn {
  width: 100%;
  min-height: 48px;
  border: none;
  border-radius: 12px;
  font: inherit;
}

.catalog-select {
  padding: 0 0.95rem;
  background: rgba(243, 244, 245, 0.96);
  color: var(--primary-strong);
}

.catalog-order-btn {
  margin-top: 0.8rem;
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
  font-family: 'Manrope', sans-serif;
  font-weight: 800;
  cursor: pointer;
}

.catalog-callout {
  margin-top: 2rem;
  padding: 1.6rem;
  border-radius: 18px;
  background: linear-gradient(150deg, #0a2129, #123248);
  color: white;
}

.catalog-callout-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.14);
}

.catalog-callout h3 {
  margin: 1rem 0 0;
  font-size: 1.2rem;
  line-height: 1.2;
}

.catalog-callout p {
  margin: 0.9rem 0 0;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.78);
}

.catalog-callout button {
  min-height: 46px;
  margin-top: 1.2rem;
  padding: 0 1.2rem;
  border: none;
  border-radius: 8px;
  background: rgba(17, 182, 205, 0.92);
  color: white;
  font-family: 'Manrope', sans-serif;
  font-weight: 800;
  cursor: pointer;
}

.catalog-main {
  min-width: 0;
}

.catalog-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 2rem;
  padding-top: 0.75rem;
}

.catalog-header-copy h1 {
  margin: 0;
  font-size: clamp(2.7rem, 4vw, 3.75rem);
  line-height: 0.97;
  letter-spacing: -0.045em;
  color: var(--primary-strong);
}

.catalog-header-copy p {
  max-width: 780px;
  margin: 1rem 0 0;
  font-size: 1.06rem;
  line-height: 1.65;
  color: var(--text-secondary);
}

.catalog-search {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.8rem;
  width: 380px;
  min-height: 56px;
  padding: 0 1rem;
  border-radius: 12px;
  background: rgba(243, 244, 245, 0.96);
  box-shadow: inset 0 -2px 0 transparent;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.catalog-search:focus-within {
  background: rgba(255, 255, 255, 0.98);
  box-shadow: inset 0 -2px 0 var(--accent-color);
}

.catalog-search-icon {
  color: var(--text-muted);
}

.catalog-search input {
  border: none;
  background: transparent;
  font: inherit;
  color: var(--primary-strong);
  outline: none;
}

.catalog-list {
  display: grid;
  gap: 1rem;
  margin-top: 2rem;
}

.catalog-loading,
.catalog-empty {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  padding: 3rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 24px rgba(var(--primary-rgb), 0.05);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 104, 118, 0.15);
  border-top-color: var(--accent-color);
  border-radius: 999px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.catalog-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 2rem;
}

.catalog-page-btn,
.catalog-page-current {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: none;
  font: inherit;
}

.catalog-page-btn {
  background: rgba(243, 244, 245, 0.98);
  color: var(--primary-strong);
  cursor: pointer;
}

.catalog-page-current {
  background: linear-gradient(135deg, var(--primary-strong), var(--primary-soft));
  color: white;
  font-weight: 800;
}

.catalog-page-total {
  color: var(--text-secondary);
}

.catalog-footer {
  margin-top: 4rem;
}

.catalog-footer-shell {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(195, 198, 209, 0.35);
}

.catalog-footer-brand {
  font-size: 1.6rem;
}

.catalog-footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 1rem 2rem;
}

.catalog-footer-links a {
  color: var(--text-secondary);
  text-decoration: none;
}

@media (max-width: 1080px) {
  .catalog-shell {
    grid-template-columns: 1fr;
  }

  .catalog-header {
    flex-direction: column;
    align-items: stretch;
  }

  .catalog-search {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .catalog-page {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .catalog-footer-shell {
    flex-direction: column;
  }

  .catalog-footer-links {
    justify-content: flex-start;
  }
}
</style>
