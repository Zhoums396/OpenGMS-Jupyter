<template>
  <div class="model-card" @click="$emit('run', model)">
    <div class="card-header">
      <h3>{{ model.name }}</h3>
      <span class="view-count" v-if="model.viewCount">
        <i class="fas fa-eye"></i> {{ model.viewCount }}
      </span>
    </div>
    
    <div class="card-body">
      <p class="description">{{ truncate(model.description, 100) }}</p>
      
      <div class="tags" v-if="model.tags && model.tags.length">
        <span v-for="tag in model.tags.slice(0, 3)" :key="tag" class="tag">
          {{ tag }}
        </span>
      </div>
    </div>
    
    <div class="card-footer">
      <span class="author">
        <i class="fas fa-user"></i> {{ model.author || 'Unknown' }}
      </span>
      <button class="run-btn">
        {{ $t('ogmsModelView.runModel') || 'Run' }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  model: {
    type: Object,
    required: true
  }
})

const truncate = (text, length) => {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}
</script>

<style scoped>
.model-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 200px;
  box-shadow: var(--shadow-sm);
}

.model-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-color);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary);
  font-weight: 600;
  line-height: 1.4;
}

.view-count {
  font-size: 0.8rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--bg-color);
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
}

.card-body {
  flex: 1;
  margin-bottom: 1rem;
}

.description {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
  margin-bottom: 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tag {
  background: var(--accent-light);
  color: var(--accent-color);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-light);
}

.author {
  font-size: 0.85rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.run-btn {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.run-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}
</style>
