<template>
  <div class="home-page">
    <section class="hero-section">
      <div class="hero-pattern" aria-hidden="true"></div>
      <div class="hero-shell">
        <span class="hero-badge">Precision Earth Science</span>
        <h1 class="hero-title font-headline">
          Geographic
          <span>Computational Platform</span>
        </h1>
        <p class="hero-copy">
          A collaborative research ecosystem designed for planetary-scale spatial analysis,
          high-fidelity environmental modeling, and integrated data and method discovery.
        </p>

        <div class="hero-search">
          <span class="search-icon">⌕</span>
          <input type="text" placeholder="Search models, data, and methodologies...">
          <router-link to="/model" class="search-action">Explore</router-link>
        </div>
      </div>
    </section>

    <section class="platform-section">
      <div class="section-shell">
        <div class="platform-grid">
          <router-link to="/model" class="platform-card">
            <span class="card-mark">◈</span>
            <h2 class="font-headline">Computational Models</h2>
            <p>
              Deploy pre-trained neural networks for terrain classification, hydrological
              forecasting, and urban expansion simulations.
            </p>
            <span class="card-link">Explore Models →</span>
          </router-link>

          <div class="visual-card terrain-card" aria-hidden="true">
            <div class="terrain-glow"></div>
          </div>

          <router-link to="/data" class="platform-card">
            <span class="card-mark">◔</span>
            <h2 class="font-headline">Global Data Resources</h2>
            <p>
              Access curated satellite imagery, climate datasets, and socioeconomic spatial
              layers from trusted institutional partners.
            </p>
            <span class="card-link">View Resources →</span>
          </router-link>

          <router-link to="/datamethod" class="method-band">
            <div>
              <span class="card-mark light">⚗</span>
              <h2 class="font-headline">Advanced Data Methods</h2>
              <p>
                Standardize your research with validated methodologies for spatial interpolation,
                geostatistics, and multi-temporal analysis.
              </p>
            </div>
            <span class="method-band-action">Access Methodology</span>
          </router-link>
        </div>
      </div>
    </section>

    <section class="workflow-section">
      <div class="section-shell workflow-grid">
        <div class="workflow-copy">
          <p class="section-label">Unified Environment</p>
          <h2 class="font-headline">Research Workflow redefined by AI.</h2>

          <div class="workflow-step">
            <span class="step-index">01</span>
            <div>
              <h3 class="font-headline">Discovery &amp; Identification</h3>
              <p>
                Search through models, datasets, and methods to assemble the right research stack.
              </p>
            </div>
          </div>

          <div class="workflow-step">
            <span class="step-index">02</span>
            <div>
              <h3 class="font-headline">Automated Preparation</h3>
              <p>
                Coordinate systems, parameter inputs, and resource alignment stay within one
                connected workspace.
              </p>
            </div>
          </div>

          <div class="workflow-step">
            <span class="step-index">03</span>
            <div>
              <h3 class="font-headline">Jupyter Analysis</h3>
              <p>
                Launch cloud notebooks and extend experiments with the OpenGeoLab AI Agent.
              </p>
            </div>
          </div>
        </div>

        <div class="workflow-visual">
          <div class="visual-screen">
            <div class="screen-grid"></div>
            <div class="screen-panel panel-a"></div>
            <div class="screen-panel panel-b"></div>
            <div class="screen-radar"></div>
          </div>
          <div class="agent-status">
            <span class="agent-dot"></span>
            <div>
              <p class="agent-label">AI Agent Status</p>
              <p class="agent-copy">
                “Analyzing terrain complexity and optimizing platform workflows for model execution.”
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="stats-section">
      <div class="stats-shell">
        <div class="stat-item">
          <strong>1,240+</strong>
          <span>Models Deployed</span>
        </div>
        <div class="stat-item">
          <strong>85 PB</strong>
          <span>Datasets Hosted</span>
        </div>
        <div class="stat-item">
          <strong>12k</strong>
          <span>Active Researchers</span>
        </div>
        <div class="stat-item">
          <strong>42</strong>
          <span>Institutional Partners</span>
        </div>
      </div>
    </section>

    <section class="cta-section">
      <div class="cta-shell">
        <h2 class="font-headline">Ready to pioneer the next spatial discovery?</h2>
        <p>
          Join a global network of earth scientists and computational researchers pushing the
          boundaries of geographic modeling on our open platform.
        </p>
        <div class="cta-actions">
          <router-link to="/model" class="cta-primary">Start Modeling Now</router-link>
          <router-link to="/jupyter" class="cta-secondary">Open Workspace</router-link>
        </div>
      </div>
    </section>

    <footer class="home-footer">
      <div class="footer-shell">
        <div>
          <p class="footer-brand font-headline">OpenGeoLab</p>
          <p class="footer-copy">© 2024 OpenGeoLab. Precision geographic platform and collaborative discovery.</p>
        </div>
        <div class="footer-links">
          <a href="#">Institutional Repository</a>
          <a href="#">Research Methodology</a>
          <a href="#">API Documentation</a>
          <a href="#">Privacy Policy</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.home-page {
  background: #f8f9fa;
}

.hero-section,
.platform-section,
.workflow-section,
.cta-section,
.home-footer {
  padding: 0 1.5rem;
}

.hero-shell,
.section-shell,
.stats-shell,
.cta-shell,
.footer-shell {
  max-width: 1360px;
  margin: 0 auto;
}

.hero-section {
  position: relative;
  padding-top: 6rem;
  padding-bottom: 7rem;
  overflow: hidden;
}

.hero-pattern {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='60' viewBox='0 0 160 60'%3E%3Cpath d='M0 10c20 0 20-8 40-8s20 8 40 8 20-8 40-8 20 8 40 8' fill='none' stroke='%23dbe1e8' stroke-width='1'/%3E%3Cpath d='M0 30c20 0 20-8 40-8s20 8 40 8 20-8 40-8 20 8 40 8' fill='none' stroke='%23dbe1e8' stroke-width='1'/%3E%3Cpath d='M0 50c20 0 20-8 40-8s20 8 40 8 20-8 40-8 20 8 40 8' fill='none' stroke='%23dbe1e8' stroke-width='1'/%3E%3C/svg%3E");
  background-size: 160px 60px;
}

.hero-shell {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  text-align: center;
}

.hero-badge,
.section-label {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 1rem;
  border-radius: 999px;
  background: rgba(158, 239, 255, 0.32);
  color: var(--accent-color);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero-title {
  margin: 1.5rem 0 0;
  font-size: clamp(4rem, 8vw, 6.8rem);
  line-height: 0.92;
  letter-spacing: -0.06em;
  color: var(--primary-strong);
  max-width: 820px;
}

.hero-title span {
  display: block;
  background: linear-gradient(135deg, var(--primary-strong), var(--accent-color));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-copy {
  margin: 1.5rem 0 0;
  max-width: 700px;
  font-size: 1.08rem;
  line-height: 1.8;
  color: var(--text-secondary);
}

.hero-search {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.85rem;
  width: min(100%, 760px);
  margin-top: 2rem;
  padding: 0.7rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 22px 36px rgba(var(--primary-rgb), 0.08);
}

.search-icon {
  padding-left: 0.7rem;
  color: var(--text-muted);
}

.hero-search input {
  min-height: 50px;
  border: none;
  background: transparent;
  color: var(--primary-strong);
  outline: none;
  font: inherit;
}

.search-action,
.method-band-action,
.cta-primary,
.cta-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 1.25rem;
  border-radius: 10px;
  text-decoration: none;
  font-family: 'Manrope', sans-serif;
  font-weight: 800;
}

.search-action,
.cta-primary {
  background: linear-gradient(135deg, var(--primary-strong), var(--primary-soft));
  color: white;
}

.section-shell {
  padding: 1rem 0 0;
}

.platform-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  gap: 1rem;
}

.platform-card,
.visual-card,
.method-band,
.workflow-visual,
.stat-item,
.cta-shell {
  border-radius: 22px;
}

.platform-card {
  min-height: 248px;
  padding: 1.6rem;
  background: rgba(255, 255, 255, 0.96);
  text-decoration: none;
  color: inherit;
  box-shadow: 0 18px 30px rgba(var(--primary-rgb), 0.06);
}

.platform-card h2,
.workflow-copy h2,
.cta-shell h2 {
  margin: 1rem 0 0;
  font-size: clamp(2rem, 4vw, 3.6rem);
  line-height: 0.96;
  letter-spacing: -0.04em;
  color: var(--primary-strong);
}

.platform-card h2 {
  font-size: 2.3rem;
}

.platform-card p,
.workflow-step p,
.cta-shell p {
  margin: 1rem 0 0;
  line-height: 1.7;
  color: var(--text-secondary);
}

.card-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(213, 227, 255, 0.7);
  color: var(--primary-strong);
  font-weight: 800;
}

.card-mark.light {
  background: rgba(255, 255, 255, 0.14);
  color: white;
}

.card-link {
  display: inline-block;
  margin-top: 1.25rem;
  font-family: 'Manrope', sans-serif;
  font-weight: 800;
  color: var(--primary-strong);
}

.visual-card {
  min-height: 248px;
  background:
    radial-gradient(circle at 50% 18%, rgba(120, 255, 243, 0.35), transparent 36%),
    linear-gradient(180deg, #13263d 0%, #07121f 100%);
  position: relative;
  overflow: hidden;
}

.terrain-card::before {
  content: '';
  position: absolute;
  inset: 18px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 14%, rgba(158, 239, 255, 0.55), transparent 20%),
    repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0 2px, transparent 2px 9px);
  opacity: 0.65;
  transform: perspective(600px) rotateX(68deg);
  transform-origin: center bottom;
}

.terrain-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 40%, rgba(120, 255, 243, 0.18), transparent 35%);
}

.method-band {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  padding: 1.8rem 2rem;
  background:
    linear-gradient(135deg, #08203b 0%, #0a2d55 100%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40' viewBox='0 0 120 40'%3E%3Cpath d='M0 12c15 0 15-6 30-6s15 6 30 6 15-6 30-6 15 6 30 6' fill='none' stroke='%23ffffff' opacity='0.08'/%3E%3Cpath d='M0 28c15 0 15-6 30-6s15 6 30 6 15-6 30-6 15 6 30 6' fill='none' stroke='%23ffffff' opacity='0.08'/%3E%3C/svg%3E");
  color: white;
  text-decoration: none;
}

.method-band h2 {
  margin: 0.9rem 0 0;
  font-size: 2.1rem;
  color: white;
}

.method-band p {
  color: rgba(255, 255, 255, 0.8);
}

.method-band-action {
  background: rgba(17, 182, 205, 0.94);
  color: white;
  white-space: nowrap;
}

.workflow-section {
  padding-top: 6rem;
}

.workflow-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(420px, 520px);
  gap: 3rem;
  align-items: center;
}

.workflow-copy h2 {
  margin-top: 1rem;
}

.workflow-step {
  display: grid;
  grid-template-columns: 46px 1fr;
  gap: 1rem;
  align-items: start;
  margin-top: 1.5rem;
}

.step-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(243, 244, 245, 0.95);
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--primary-strong);
}

.workflow-step h3 {
  margin: 0;
  font-size: 1.08rem;
  color: var(--primary-strong);
}

.workflow-visual {
  padding: 1.1rem;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 28px 40px rgba(var(--primary-rgb), 0.1);
}

.visual-screen {
  position: relative;
  min-height: 420px;
  border-radius: 18px;
  overflow: hidden;
  background:
    radial-gradient(circle at 70% 34%, rgba(28, 235, 255, 0.2), transparent 18%),
    linear-gradient(135deg, #09111b 0%, #0d2335 100%);
}

.screen-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(93, 125, 156, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(93, 125, 156, 0.18) 1px, transparent 1px);
  background-size: 26px 26px;
  opacity: 0.35;
}

.screen-panel {
  position: absolute;
  border-radius: 14px;
  border: 1px solid rgba(158, 239, 255, 0.16);
  background: rgba(8, 30, 46, 0.72);
}

.panel-a {
  top: 56px;
  left: 42px;
  right: 42px;
  height: 118px;
}

.panel-b {
  left: 42px;
  right: 180px;
  bottom: 48px;
  height: 164px;
}

.screen-radar {
  position: absolute;
  top: 110px;
  right: 54px;
  width: 122px;
  height: 122px;
  border-radius: 999px;
  border: 2px solid rgba(28, 235, 255, 0.45);
  box-shadow: 0 0 0 22px rgba(28, 235, 255, 0.05), 0 0 0 46px rgba(28, 235, 255, 0.03);
}

.agent-status {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.8rem;
  align-items: start;
  width: 280px;
  margin: -78px 0 0 1.3rem;
  padding: 0.9rem 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 24px rgba(var(--primary-rgb), 0.12);
}

.agent-dot {
  width: 8px;
  height: 8px;
  margin-top: 0.45rem;
  border-radius: 999px;
  background: var(--accent-color);
}

.agent-label {
  margin: 0;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--text-muted);
}

.agent-copy {
  margin: 0.35rem 0 0;
  font-size: 0.83rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.stats-section {
  margin-top: 5.5rem;
  background: rgba(225, 227, 228, 0.8);
}

.stats-shell {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  padding: 2rem 1.5rem;
}

.stat-item {
  text-align: center;
  padding: 1.4rem 1rem;
}

.stat-item strong {
  display: block;
  font-family: 'Manrope', sans-serif;
  font-size: 2.8rem;
  font-weight: 800;
  color: var(--primary-strong);
}

.stat-item span {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--accent-color);
}

.cta-section {
  padding-top: 5.5rem;
  padding-bottom: 5.5rem;
}

.cta-shell {
  display: grid;
  justify-items: center;
  text-align: center;
  padding: 0;
}

.cta-shell h2 {
  max-width: 700px;
}

.cta-shell p {
  max-width: 760px;
}

.cta-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 2rem;
}

.cta-secondary {
  background: rgba(255, 255, 255, 0.95);
  color: var(--primary-strong);
  box-shadow: inset 0 0 0 1px rgba(195, 198, 209, 0.55);
}

.home-footer {
  padding-bottom: 3rem;
}

.footer-shell {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(195, 198, 209, 0.55);
}

.footer-brand {
  margin: 0;
  font-size: 1.5rem;
  color: var(--primary-strong);
}

.footer-copy {
  margin: 0.6rem 0 0;
  max-width: 380px;
  color: var(--text-secondary);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 1.2rem 2rem;
  align-content: start;
}

.footer-links a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
}

@media (max-width: 1080px) {
  .platform-grid,
  .workflow-grid,
  .stats-shell {
    grid-template-columns: 1fr;
  }

  .method-band {
    flex-direction: column;
    align-items: flex-start;
  }

  .workflow-visual {
    max-width: 620px;
  }
}

@media (max-width: 720px) {
  .hero-section,
  .platform-section,
  .workflow-section,
  .cta-section,
  .home-footer {
    padding-left: 0.9rem;
    padding-right: 0.9rem;
  }

  .hero-search {
    grid-template-columns: 1fr;
    text-align: left;
  }

  .search-icon {
    display: none;
  }

  .workflow-visual {
    padding: 0.85rem;
  }

  .visual-screen {
    min-height: 320px;
  }

  .agent-status {
    width: auto;
    margin: 1rem 0 0;
  }

  .footer-shell {
    flex-direction: column;
  }

  .footer-links {
    justify-content: flex-start;
  }
}
</style>
