/**
 * OpenGeoLab Top Bar Brand Widget
 * 
 * A header bar that displays the platform logo, name, and user avatar.
 * Added to the 'header' area of JupyterLab shell.
 */
import { Widget } from '@lumino/widgets';
import { LOGO_BASE64, FAVICON_BASE64 } from './assets';

export class TopBarWidget extends Widget {
  constructor() {
    super();
    this.id = 'opengeolab-topbar';
    this.addClass('opengeolab-topbar');

    this.node.innerHTML = `
      <div class="opengeolab-topbar-inner">
        <div class="opengeolab-topbar-brand">
          <img class="opengeolab-topbar-logo" 
               src="data:image/png;base64,${LOGO_BASE64}" 
               alt="OpenGeoLab" />
          <div class="opengeolab-topbar-text">
            <span class="opengeolab-topbar-name">OpenGeoLab</span>
            <span class="opengeolab-topbar-sep">·</span>
            <span class="opengeolab-topbar-subtitle">Geographic Modeling Platform</span>
          </div>
        </div>
        <div class="opengeolab-topbar-right">
          <img class="opengeolab-topbar-avatar" 
               src="data:image/x-icon;base64,${FAVICON_BASE64}" 
               alt="User" />
        </div>
      </div>
    `;
  }
}
