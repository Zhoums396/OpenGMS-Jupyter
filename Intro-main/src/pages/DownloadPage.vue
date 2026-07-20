<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { downloadCards, geomodelDocsUrl, installCommand, projectCards, repoUrl } from '../content/site'

const copiedInstall = ref(false)
let copyResetTimer = null

const copyInstallCommand = async () => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return
  }

  await navigator.clipboard.writeText(installCommand)
  copiedInstall.value = true

  if (copyResetTimer) {
    window.clearTimeout(copyResetTimer)
  }

  copyResetTimer = window.setTimeout(() => {
    copiedInstall.value = false
  }, 1800)
}
</script>

<template>
  <section class="page-section page-hero">
    <div class="page-intro centered narrow">
      <span class="eyebrow">Download</span>
      <h1>
        Download and install
        <span>GeoCopilot</span>
      </h1>
      <p>
        Install the JupyterLab extension, review the source repository, and use the documented
        setup steps to get the GeoCopilot workflow running locally.
      </p>

      <div class="action-row centered">
        <a class="primary-button" :href="geomodelDocsUrl" target="_blank" rel="noreferrer">
          Open Install Guide
        </a>
        <a class="secondary-button" :href="repoUrl" target="_blank" rel="noreferrer">
          Open GitHub
        </a>
      </div>
    </div>
  </section>

  <section class="page-section section-block">
    <div class="download-grid">
      <article v-for="card in downloadCards" :key="card.title" class="download-card">
        <span class="card-eyebrow">{{ card.eyebrow }}</span>
        <h3>{{ card.title }}</h3>
        <p>{{ card.body }}</p>

        <div class="card-footer">
          <span class="card-meta">{{ card.meta }}</span>
          <a class="card-action" :href="card.href" target="_blank" rel="noreferrer">
            {{ card.actionLabel }}
          </a>
        </div>
      </article>
    </div>

    <div class="install-shell">
      <div class="install-copy">
        <div>
          <span class="card-eyebrow">Install Command</span>
          <h3>Source install for the GeoCopilot extension</h3>
          <p>
            Use the source-install path to register the extension with JupyterLab and start the
            workspace-side experience shown elsewhere on the site.
          </p>
        </div>

        <div class="install-actions">
          <button class="secondary-button" type="button" @click="copyInstallCommand">
            {{ copiedInstall ? 'Copied' : 'Copy command' }}
          </button>
          <a class="primary-button" :href="geomodelDocsUrl" target="_blank" rel="noreferrer">
            Read install docs
          </a>
        </div>
      </div>

      <pre class="command-panel"><code>{{ installCommand }}</code></pre>
    </div>
  </section>

  <section class="page-section section-block">
    <div class="section-heading narrow">
      <span class="eyebrow">Repository Map</span>
      <h2>Understand the pieces behind the workspace workflow</h2>
      <p>
        The repository is split across extension, agent, and web layers. Knowing the boundaries
        helps users understand what they are installing and where each capability lives.
      </p>
    </div>

    <div class="summary-grid">
      <article v-for="card in projectCards" :key="card.title" class="summary-card">
        <span class="card-eyebrow">{{ card.eyebrow }}</span>
        <h3>{{ card.title }}</h3>
        <p>{{ card.body }}</p>
        <a class="card-action" :href="card.href" target="_blank" rel="noreferrer">
          {{ card.actionLabel }}
        </a>
      </article>
    </div>
  </section>

  <section class="page-section section-block">
    <div class="cta-panel">
      <div class="cta-copy">
        <span class="eyebrow">Next Step</span>
        <h2>After installation, either inspect the feature set or watch the workflow end to end</h2>
        <p>
          Download gets the environment ready. Features explains what the agent can do, and Video
          shows how that behavior looks inside a real workspace session.
        </p>
      </div>

      <div class="action-row">
        <RouterLink class="ghost-button" to="/features">Open Features</RouterLink>
        <RouterLink class="primary-button" to="/video">Open Video</RouterLink>
      </div>
    </div>
  </section>
</template>
