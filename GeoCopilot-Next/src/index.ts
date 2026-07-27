import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { LabIcon } from '@jupyterlab/ui-components';

import { GeoCopilotPanel } from './panel';

const icon = new LabIcon({
  name: '@opengeolab/geocopilot:sidebar',
  svgstr: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="currentColor" d="M5.3 4.3h8.9l4.5 4.5v10.9H5.3V4.3Zm2 2v11.4h9.4v-8h-3.4V6.3h-6Zm7.9.9v.5h.5l-.5-.5Z"/>
      <path fill="currentColor" d="M9 10h4.8v1.6H9V10Zm0 3.2h5.9v1.6H9v-1.6Z"/>
    </svg>`
});

const plugin: JupyterFrontEndPlugin<void> = {
  id: '@opengeolab/geocopilot:plugin',
  autoStart: true,
  requires: [INotebookTracker, IRenderMimeRegistry],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    rendermime: IRenderMimeRegistry
  ): void => {
    const panel = new GeoCopilotPanel(
      tracker,
      rendermime,
      app.serviceManager.contents
    );
    panel.id = 'geocopilot-sidebar';
    panel.title.caption = 'GeoCopilot';
    panel.title.icon = icon;
    panel.title.closable = false;
    app.shell.add(panel, 'right', { rank: 460 });

    void app.restored.then(() => {
      if (!panel.isDisposed) {
        app.shell.activateById(panel.id);
      }
    });

    app.commands.addCommand('@opengeolab/geocopilot:open', {
      label: 'Open GeoCopilot',
      icon,
      execute: async () => {
        if (!panel.isAttached) {
          app.shell.add(panel, 'right', { rank: 460 });
        }
        app.shell.activateById(panel.id);
      }
    });
  }
};

export default plugin;
