<template>
  <div class="data-view">
    <div class="view-header">
      <h1>{{ $t('dataView.title') }}</h1>
      <p class="subtitle">{{ $t('dataView.subtitle') }}</p>
      
      <div class="search-container">
        <input 
          v-model="searchQuery" 
          @keyup.enter="handleSearch"
          type="text" 
          :placeholder="$t('dataView.searchPlaceholder')"
          class="search-input"
        >
        <button @click="handleSearch" class="search-btn">
          {{ $t('dataView.search') }}
        </button>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="filter-section">
      <div class="filter-label">{{ $t('dataView.categoryLabel') }}</div>
      <div class="category-tags">
        <button 
          v-for="cat in localizedCategories" 
          :key="cat.value"
          :class="['category-btn', { active: selectedCategory === cat.value }]"
          @click="selectCategory(cat.value)"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <!-- 排序选项 -->
    <div class="sort-section">
      <span class="sort-label">{{ $t('dataView.sortLabel') }}</span>
      <select v-model="sortField" @change="handleSortChange" class="sort-select">
        <option value="createTime">{{ $t('dataView.sortLatest') }}</option>
        <option value="fileSize">{{ $t('dataView.sortSize') }}</option>
        <option value="pageviews">{{ $t('dataView.sortViews') }}</option>
      </select>
      <button class="sort-order-btn" @click="toggleSortOrder" :title="sortAsc ? '↑' : '↓'">
        {{ sortAsc ? '↑' : '↓' }}
      </button>
      <span class="total-count" v-if="total > 0">{{ $t('dataView.totalCount', { count: total }) }}</span>
    </div>

    <div v-if="loading && !dataList.length" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('dataView.loading') }}</p>
    </div>

    <div v-else-if="!dataList.length" class="empty-state">
      <div class="empty-icon"></div>
      <p>{{ $t('dataView.noData') }}</p>
      <p class="empty-hint">{{ $t('dataView.noDataHint') }}</p>
    </div>

    <div v-else class="content-wrapper">
      <div class="data-grid">
        <DataCard 
          v-for="item in dataList" 
          :key="item.id" 
          :data="item" 
          @view="handleView"
          @download="handleDownload"
        />
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button 
          class="page-btn" 
          :disabled="currentPage === 1" 
          @click="changePage(1)"
          :title="$t('dataView.firstPage')"
        >
          «
        </button>
        <button 
          class="page-btn" 
          :disabled="currentPage === 1" 
          @click="changePage(currentPage - 1)"
        >
          &lt; {{ $t('dataView.previous') }}
        </button>
        
        <div class="page-numbers">
          <button 
            v-for="page in visiblePages" 
            :key="page"
            :class="['page-num', { active: page === currentPage }]"
            @click="changePage(page)"
          >
            {{ page }}
          </button>
        </div>
        
        <button 
          class="page-btn" 
          :disabled="currentPage === totalPages" 
          @click="changePage(currentPage + 1)"
        >
          {{ $t('dataView.next') }} &gt;
        </button>
        <button 
          class="page-btn" 
          :disabled="currentPage === totalPages" 
          @click="changePage(totalPages)"
          :title="$t('dataView.lastPage')"
        >
          »
        </button>
        
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import DataCard from '../components/DataCard.vue'

const { t } = useI18n()

// 使用本地后端代理，避免 CORS 问题
const API_BASE = ''  // 通过 Vite 代理或直接使用后端

// 数据中心下载地址
const DOWNLOAD_BASE = 'https://geomodeling.njnu.edu.cn/OpenGMPBack'

// 分类映射（API 使用中文值）
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

// 本地化后的分类
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

// 计算可见页码
const visiblePages = computed(() => {
  const pages = []
  const totalP = totalPages.value
  const current = currentPage.value
  
  if (totalP <= 7) {
    for (let i = 1; i <= totalP; i++) pages.push(i)
  } else {
    if (current <= 4) {
      pages.push(1, 2, 3, 4, 5, 6, 7)
    } else if (current >= totalP - 3) {
      for (let i = totalP - 6; i <= totalP; i++) pages.push(i)
    } else {
      for (let i = current - 3; i <= current + 3; i++) pages.push(i)
    }
  }
  
  return pages.filter(p => p >= 1 && p <= totalP)
})

// 获取数据列表
const fetchData = async (page = 1) => {
  loading.value = true
  try {
    const params = {
      asc: sortAsc.value,
      page: page,
      pageSize: pageSize,
      searchText: searchQuery.value,
      sortField: sortField.value,
      tagClass: 'problemTags',
      tagName: selectedCategory.value
    }
    
    // 使用后端代理接口
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
  // 可以打开详情模态框或跳转到详情页
  console.log('View data:', data)
}

const handleDownload = (data) => {
  if (data.id) {
    // 使用原始下载地址（下载不需要代理，直接跳转即可）
    window.open(`${DOWNLOAD_BASE}/userRes/downloadDataItem/${data.id}`, '_blank')
  } else {
    alert('下载链接不可用')
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.data-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  animation: fadeIn 0.5s ease;
}

.view-header {
  text-align: center;
  margin-bottom: 2rem;
  padding: 2rem 2rem 1.5rem;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.view-header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: #000000;
  font-weight: 600;
}

.subtitle {
  color: #606266;
  font-size: 1rem;
  margin-bottom: 1.5rem;
}

.search-container {
  display: flex;
  gap: 0.75rem;
  max-width: 600px;
  margin: 0 auto;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.95rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.search-btn {
  padding: 0 1.5rem;
  background: var(--accent-color);
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.search-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

/* 分类筛选 */
.filter-section {
  margin-bottom: 1.5rem;
  padding: 1rem 1.25rem;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.filter-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 12px;
  font-weight: 500;
}

.category-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-btn {
  padding: 6px 14px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.category-btn:hover {
  background: var(--accent-light);
  color: var(--accent-color);
  border-color: var(--accent-color);
}

.category-btn.active {
  background: var(--accent-light);
  border-color: var(--accent-color);
  color: var(--accent-color);
  font-weight: 500;
}

/* 排序选项 */
.sort-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 1.5rem;
  padding: 12px 16px;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.sort-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.sort-select {
  padding: 6px 12px;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
}

.sort-select:focus {
  outline: none;
  border-color: var(--accent-color);
}

.sort-order-btn {
  width: 32px;
  height: 32px;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.sort-order-btn:hover {
  background: var(--accent-light);
  color: var(--accent-color);
  border-color: var(--accent-color);
}

.total-count {
  margin-left: auto;
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* 数据网格 */
.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

/* 加载状态 */
.loading-state {
  text-align: center;
  padding: 4rem;
  color: var(--text-secondary);
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 4rem;
  color: var(--text-secondary);
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-hint {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-top: 8px;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 2rem;
  padding: 1rem;
  background: var(--card-bg);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  flex-wrap: wrap;
}

.page-btn {
  padding: 8px 14px;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--bg-color);
}

.page-numbers {
  display: flex;
  gap: 4px;
}

.page-num {
  width: 36px;
  height: 36px;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.page-num:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.page-num.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.page-info {
  margin-left: 12px;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式 */
@media (max-width: 768px) {
  .data-view {
    padding: 1rem;
  }
  
  .view-header h1 {
    font-size: 1.8rem;
  }
  
  .search-container {
    flex-direction: column;
  }
  
  .category-tags {
    justify-content: center;
  }
  
  .sort-section {
    flex-wrap: wrap;
  }
  
  .data-grid {
    grid-template-columns: 1fr;
  }
}
</style>
