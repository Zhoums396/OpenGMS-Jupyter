/**
 * OpenGeoLab Welcome Page Widget
 * 
 * A branded landing page displayed when JupyterLab first opens.
 * Shows quick action cards for common tasks.
 */
import { Widget } from '@lumino/widgets';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { LOGO_BASE64 } from './assets';

export class WelcomeWidget extends Widget {
  private _app: JupyterFrontEnd;

  constructor(app: JupyterFrontEnd) {
    super();
    this._app = app;
    this.id = 'opengeolab-welcome';
    this.title.label = 'Welcome';
    this.title.closable = true;
    this.addClass('opengeolab-welcome');

    this.node.innerHTML = `
      <div class="welcome-container">
        <div class="welcome-hero">
          <div class="welcome-logo-wrap">
            <img class="welcome-logo" 
                 src="data:image/png;base64,${LOGO_BASE64}" 
                 alt="OpenGeoLab" />
          </div>
          <h1 class="welcome-title">Welcome to OpenGeoLab</h1>
          <p class="welcome-subtitle">Open-source Geographic Modeling &amp; Computation Platform</p>
        </div>
        <div class="welcome-cards">
          <div class="welcome-card" data-command="geomodel:open-agent">
            <div class="welcome-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none"/><path d="M9 18h6"/></svg>
            </div>
            <div class="welcome-card-title">AI Agent</div>
            <div class="welcome-card-desc">Start the AI modeling assistant to help with your geographic research</div>
          </div>
          <div class="welcome-card" data-command="notebook:create-new">
            <div class="welcome-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M8 4v16"/><path d="M12 8h4"/><path d="M12 12h4"/><path d="M12 16h2"/></svg>
            </div>
            <div class="welcome-card-title">New Notebook</div>
            <div class="welcome-card-desc">Create a new Jupyter notebook for data analysis and visualization</div>
          </div>
          <div class="welcome-card" data-command="geomodel:open-tools">
            <div class="welcome-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a14.5 14.5 0 0 1 0 18"/><path d="M12 3a14.5 14.5 0 0 0 0 18"/><path d="M3 12h18"/></svg>
            </div>
            <div class="welcome-card-title">Model Hub</div>
            <div class="welcome-card-desc">Browse and invoke geographic models and data processing methods</div>
          </div>
          <div class="welcome-card" data-command="filebrowser:toggle-main">
            <div class="welcome-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
            </div>
            <div class="welcome-card-title">File Browser</div>
            <div class="welcome-card-desc">Manage your files, datasets and project resources</div>
          </div>
        </div>
        <div class="welcome-footer">
          <p>Powered by JupyterLab &middot; OpenGMS Project</p>
        </div>
      </div>
    `;

    // Bind click handlers to cards
    this._bindCardActions();
  }

  private _bindCardActions(): void {
    const cards = this.node.querySelectorAll('.welcome-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const command = card.getAttribute('data-command');
        if (command && this._app.commands.hasCommand(command)) {
          this._app.commands.execute(command);
        }
      });
    });
  }
}
