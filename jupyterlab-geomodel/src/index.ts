/**
 * JupyterLab GeoModel Extension
 * 
 * Main entry file - Register extension and sidebar panels
 * - Left sidebar: AI Agent Panel
 * - Right sidebar: GeoModel Tools Panel
 */
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import { INotebookTracker } from '@jupyterlab/notebook';
import { LabIcon } from '@jupyterlab/ui-components';
import { GeoModelWidget } from './widget';
import { AgentWidget } from './agentWidget';

// GeoModel icon SVG
const geoModelIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
</svg>`;

// AI Agent icon SVG
const agentIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5z"/>
</svg>`;

const geoModelIcon = new LabIcon({
  name: 'geomodel:icon',
  svgstr: geoModelIconSvg
});

const agentIcon = new LabIcon({
  name: 'geomodel:agent-icon',
  svgstr: agentIconSvg
});

/**
 * Extension ID
 */
const EXTENSION_ID = 'jupyterlab-geomodel:plugin';

/**
 * Command IDs
 */
const CommandIds = {
  openTools: 'geomodel:open-tools',
  openAgent: 'geomodel:open-agent'
};

/**
 * Main plugin definition
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: EXTENSION_ID,
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ILayoutRestorer],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    restorer: ILayoutRestorer | null
  ) => {
    console.log('JupyterLab GeoModel extension is activated!');

    // ==================== Right Sidebar: GeoModel Tools ====================
    const toolsWidget = new GeoModelWidget(notebookTracker);
    toolsWidget.id = 'geomodel-sidebar';
    toolsWidget.title.icon = geoModelIcon;
    toolsWidget.title.caption = 'OpenGeoLab';

    // Add to right sidebar
    app.shell.add(toolsWidget, 'right', { rank: 100 });

    // Register tools panel command
    app.commands.addCommand(CommandIds.openTools, {
      label: 'OpenGeoLab Panel',
      icon: geoModelIcon,
      execute: () => {
        app.shell.activateById(toolsWidget.id);
      }
    });

    // ==================== Left Sidebar: AI Agent ====================
    const agentWidget = new AgentWidget(notebookTracker);
    agentWidget.id = 'geomodel-agent';
    agentWidget.title.icon = agentIcon;
    agentWidget.title.caption = 'OpenGeoLab AI Agent';

    // Add to left sidebar
    app.shell.add(agentWidget, 'left', { rank: 200 });

    // Register agent panel command
    app.commands.addCommand(CommandIds.openAgent, {
      label: 'OpenGeoLab AI Agent',
      icon: agentIcon,
      execute: () => {
        app.shell.activateById(agentWidget.id);
      }
    });

    // ==================== Restorer ====================
    if (restorer) {
      restorer.add(toolsWidget, 'geomodel-sidebar');
      restorer.add(agentWidget, 'geomodel-agent');
    }

    console.log('OpenGeoLab: Tools panel added to right sidebar');
    console.log('OpenGeoLab: AI Agent panel added to left sidebar');
  }
};

export default plugin;
