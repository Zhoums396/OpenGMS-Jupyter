<script setup>
import { RouterLink } from 'vue-router'
import AgentSpotlightSection from '../components/AgentSpotlightSection.vue'
import DemoVideo from '../components/DemoVideo.vue'
import {
  caseCards,
  docsPageUrl,
  heroTags,
  homeCapabilityPanels,
  workflowSteps
} from '../content/site'
</script>

<template>
  <section class="page-section hero-section">
    <div class="page-intro page-intro--hero">
      <span class="eyebrow">GeoCopilot</span>
      <h1>
        The workspace-aware AI agent for
        <span>GeoCopilot</span>
      </h1>
      <p>
        A Jupyter-native agent that reads workspace context, writes executable cells, runs code, and
        recovers from failures without pulling the user out of the GeoCopilot workflow.
      </p>

      <div class="action-row">
        <RouterLink class="primary-button" to="/download">Download</RouterLink>
        <RouterLink class="secondary-button" to="/video">Watch Demo</RouterLink>
      </div>

      <div class="tag-row" aria-label="Core agent capabilities">
        <span v-for="tag in heroTags" :key="tag">{{ tag }}</span>
      </div>
    </div>

    <div class="hero-stage">
      <div class="hero-glow glow-left" aria-hidden="true"></div>
      <div class="hero-glow glow-right" aria-hidden="true"></div>
      <DemoVideo hero />
    </div>
  </section>

  <AgentSpotlightSection />

  <section class="page-section section-block">
    <div class="section-heading centered narrow">
      <span class="eyebrow">Ready To Go</span>
      <h2>Open the workspace, start the agent, and keep the work inside JupyterLab</h2>
      <p>
        The strongest version of the product is the one that feels native to workspace work: aware
        of context, able to act directly on cells, and reliable enough to carry a workflow forward.
      </p>
    </div>

    <div class="home-capability-grid">
      <article
        v-for="panel in homeCapabilityPanels"
        :key="panel.title"
        class="home-capability-panel"
        :class="[panel.tone, `home-capability-panel--${panel.size}`]"
      >
        <span class="home-capability-icon">{{ panel.icon }}</span>
        <h3>{{ panel.title }}</h3>
        <p v-if="panel.body">{{ panel.body }}</p>
        <p v-if="panel.subtitle" class="home-capability-subtitle">{{ panel.subtitle }}</p>

        <div v-if="panel.points" class="home-capability-list">
          <div v-for="point in panel.points" :key="point" class="home-capability-item">
            <span class="home-capability-bullet"></span>
            <span>{{ point }}</span>
          </div>
        </div>
      </article>
    </div>
  </section>

  <section class="page-section section-block">
    <div class="section-heading narrow">
      <span class="eyebrow">Use Cases</span>
      <h2>Move from prompt to working workspace output</h2>
      <p>
        These are the kinds of workspace sessions the agent should make easier: fixing analysis
        errors, writing the next cell from live context, and continuing a project without losing
        momentum.
      </p>
    </div>

    <div class="workflow-steps">
      <article v-for="step in workflowSteps" :key="step.number" class="workflow-step-card">
        <span class="step-number">{{ step.number }}</span>
        <h3>{{ step.title }}</h3>
        <p>{{ step.body }}</p>
      </article>
    </div>

    <div class="case-grid">
      <article v-for="card in caseCards" :key="card.title" class="case-card">
        <span class="case-pill">{{ card.eyebrow }}</span>
        <h3>{{ card.title }}</h3>
        <p>{{ card.body }}</p>
      </article>
    </div>
  </section>

  <section class="page-section section-block">
    <div class="note-panel">
      <div>
        <span class="card-eyebrow">Scope Boundary</span>
        <h2>Show the agent clearly, then explain where GeoCopilot companion features fit</h2>
        <p>
          The product is strongest when the homepage proves the workspace-aware agent loop first.
          GeoCopilot companion capabilities can still appear elsewhere in the site, but the home
          story should stay anchored on what GeoCopilot itself can do inside JupyterLab.
        </p>
      </div>

      <a class="ghost-button" :href="docsPageUrl">Open Docs</a>
    </div>
  </section>

  <section class="page-section section-block">
    <div class="cta-panel">
      <div class="cta-copy">
        <span class="eyebrow">Next Step</span>
        <h2>Start with the core loop, then branch into feature detail or full video</h2>
        <p>
          Home should earn attention fast. Features can then unpack each verified behavior, and the
          video walkthrough can show one longer task from prompt to result.
        </p>
      </div>

      <div class="action-row">
        <RouterLink class="primary-button" to="/features">Open Features</RouterLink>
        <RouterLink class="secondary-button" to="/download">Open Download</RouterLink>
      </div>
    </div>
  </section>
</template>
