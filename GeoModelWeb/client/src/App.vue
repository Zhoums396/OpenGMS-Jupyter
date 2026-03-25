<template>
  <div class="app-container" :class="{ 'no-nav': hideMainNav }">
    <nav v-if="!hideMainNav" class="top-nav">
      <div class="top-nav-shell">
        <router-link to="/" class="nav-brand">
          <img src="/logo.png" alt="OpenGeoLab" class="logo">
        </router-link>

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
          <a href="/jupyter" class="workspace-link">
            OpenGeoLab Jupyter
          </a>
          <button class="lang-switcher" @click="toggleLocale" :title="locale === 'en' ? '切换到中文' : 'Switch to English'">
            <span class="lang-icon">{{ locale === 'en' ? '中' : 'EN' }}</span>
          </button>
        </div>
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
  background-color: transparent;
}

.app-container.no-nav {
  background-color: transparent;
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 0;
  background: linear-gradient(180deg, rgba(7, 18, 31, 0.96), rgba(10, 34, 59, 0.94));
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.top-nav-shell {
  max-width: var(--max-shell-width);
  margin: 0 auto;
  min-height: 78px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1.25rem;
  padding: 0 1.5rem;
}

.nav-brand {
  display: flex;
  align-items: center;
  text-decoration: none;
}

.logo {
  height: 40px;
  width: auto;
}

.nav-items {
  display: flex;
  justify-content: center;
  gap: 1.25rem;
}

.nav-item {
  color: rgba(255, 255, 255, 0.76);
  text-decoration: none;
  font-family: 'Manrope', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  padding: 1.25rem 0.15rem;
  border-radius: 0;
  transition: color 0.25s ease;
  position: relative;
}

.nav-item:hover {
  color: #ffffff;
}

.nav-item.active {
  color: #ffffff;
}

.nav-item.active::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 68px;
  height: 3px;
  background-color: rgba(158, 239, 255, 0.96);
  border-radius: 999px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.workspace-link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 1.25rem;
  background: linear-gradient(135deg, var(--primary-strong), var(--primary-soft));
  border: none;
  border-radius: 10px;
  color: var(--surface-card);
  text-decoration: none;
  font-family: 'Manrope', sans-serif;
  font-weight: 800;
  font-size: 0.9rem;
  letter-spacing: 0.01em;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 18px 28px rgba(0, 30, 64, 0.16);
}

.workspace-link:hover {
  transform: translateY(-1px);
  box-shadow: 0 22px 32px rgba(0, 30, 64, 0.18);
}

.lang-switcher {
  min-height: 44px;
  min-width: 44px;
  padding: 0;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #ffffff;
  border-radius: 12px;
  cursor: pointer;
  font-family: 'Manrope', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  transition: background-color 0.25s ease, transform 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lang-switcher:hover {
  background-color: rgba(255, 255, 255, 0.16);
  transform: translateY(-1px);
}

.lang-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  line-height: 1;
}

.main-content {
  flex: 1;
  padding: 0;
  width: 100%;
}

.main-content.full-height {
  min-height: 100vh;
  max-width: none;
  padding: 0;
  margin: 0;
}

@media (max-width: 960px) {
  .top-nav-shell {
    grid-template-columns: auto 1fr;
    grid-template-areas:
      "brand actions"
      "menu menu";
    gap: 0.9rem;
  }

  .nav-brand {
    grid-area: brand;
  }

  .nav-right {
    grid-area: actions;
    justify-content: flex-end;
  }

  .nav-items {
    grid-area: menu;
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 0.2rem;
  }
}

@media (max-width: 640px) {
  .workspace-link {
    padding: 0.68rem 0.92rem;
    font-size: 0.82rem;
  }

  .nav-item {
    padding: 0.6rem 0.9rem;
    font-size: 0.88rem;
  }
}
</style>
