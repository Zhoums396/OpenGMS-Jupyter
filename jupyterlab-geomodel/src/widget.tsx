/**
 * GeoModel Sidebar Main Widget
 */
import { ReactWidget } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
import * as React from 'react';
import { GeoModelPanel } from './components/GeoModelPanel';

/**
 * Main Widget Class - Wraps React Component
 */
export class GeoModelWidget extends ReactWidget {
  private _notebookTracker: INotebookTracker;

  constructor(notebookTracker: INotebookTracker) {
    super();
    this._notebookTracker = notebookTracker;
    this.addClass('jp-GeoModel-sidebar');
  }

  /**
   * Render React Component
   */
  protected render(): React.ReactElement<any> {
    return (
      <GeoModelPanel 
        notebookTracker={this._notebookTracker}
      />
    );
  }
}
