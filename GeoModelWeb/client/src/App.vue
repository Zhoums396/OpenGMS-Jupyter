<template>
  <div class="app-container" :class="{ 'no-nav': hideMainNav }">
    <nav v-if="!hideMainNav" class="top-nav">
      <div class="nav-left">
        <img src="/logo.png" alt="OpenGeoLab" class="logo">
      </div>
      
      <div class="nav-items">
        <router-link to="/model" class="nav-item" active-class="active">
          {{ $t('nav.model') }}
        </router-link>
        <router-link to="/data" class="nav-item" active-class="active">
          {{ $t('nav.data') }}
        </router-link>
        <router-link to="/datamethod" class="nav-item" active-class="active">
          {{ $t('nav.dataMethod') }}
        </router-link>
      </div>
      
      <div class="nav-right">
        <a href="/jupyter" class="jupyter-btn" target="_blank">
          {{ $t('nav.jupyter') }}
        </a>
        <button class="lang-switcher" @click="toggleLocale" :title="locale === 'en' ? '切换到中文' : 'Switch to English'">
          <span class="lang-icon">{{ locale === 'en' ? '中' : 'EN' }}</span>
        </button>
      </div>
    </nav>
    <main class="main-content" :class="{ 'full-height': hideMainNav }">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const { locale } = useI18n()
const route = useRoute()

const hideMainNav = computed(() => route.meta?.hideMainNav)

const toggleLocale = () => {
  locale.value = locale.value === 'en' ? 'zh' : 'en'
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
}

.app-container.no-nav {
  background-color: transparent;
}

.top-nav {
  height: 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
  background-color: var(--nav-bg);
  border-bottom: none;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow-md);
}

.nav-left {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  z-index: 2;
}

.logo {
  height: 40px;
  width: auto;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.logo:hover {
  transform: scale(1.05);
}

.nav-items {
  display: flex;
  gap: 0.5rem;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}

.nav-item {
  color: var(--nav-text-secondary);
  text-decoration: none;
  font-size: 1rem;
  font-weight: 500;
  padding: 0.5rem 1.2rem;
  border-radius: 4px;
  transition: all 0.3s ease;
  position: relative;
}

.nav-item:hover {
  color: var(--nav-text);
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
  color: var(--nav-text);
  background-color: rgba(255, 255, 255, 0.15);
}

.nav-item.active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 3px;
  background-color: var(--accent-color);
  border-radius: 2px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 0 0 auto;
  z-index: 2;
}

/* My Jupyter 按钮样式 */
.jupyter-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.52rem 1rem;
  background-color: var(--accent-color);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  color: white;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  letter-spacing: 0.01em;
  transition: background-color 0.2s ease, border-color 0.2s ease;
  box-shadow: none;
}

.jupyter-btn:hover {
  background-color: var(--accent-hover);
  border-color: rgba(255, 255, 255, 0.22);
}

.jupyter-btn.active {
  background-color: var(--accent-hover);
  border-color: rgba(255, 255, 255, 0.26);
}

.lang-switcher {
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--nav-text);
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lang-switcher:hover {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.lang-icon {
  font-weight: 600;
  font-size: 0.9rem;
}

.main-content {
  flex: 1;
  padding: 2rem;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

.main-content.full-height {
  min-height: 100vh;
  max-width: none;
  padding: 0;
  margin: 0;
}
</style>
