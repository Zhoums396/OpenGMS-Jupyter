/**
 * Agent Widget
 * JupyterLab 左侧边栏的 Agent 面板 Widget
 */

import { ReactWidget } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
import * as React from 'react';
import { AgentPanel } from './components/AgentPanel';

/**
 * Agent Panel Widget - 用于左侧边栏
 */
export class AgentWidget extends ReactWidget {
    private _notebookTracker: INotebookTracker | null = null;
    private _app: any = null;

    constructor(notebookTracker?: INotebookTracker, app?: any) {
        super();
        this._notebookTracker = notebookTracker || null;
        this._app = app || null;
        this.addClass('jp-AgentWidget');
        this.id = 'opengeolab-agent';
        this.title.label = '';  // 不显示文字，只显示图标
        this.title.caption = 'OpenGeoLab AI Agent';
        this.title.closable = true;
        this.title.iconClass = 'jp-AgentIcon';
    }

    /**
     * 更新 Notebook Tracker
     */
    setNotebookTracker(tracker: INotebookTracker): void {
        this._notebookTracker = tracker;
        this.update();
    }

    /**
     * 渲染 React 组件
     */
    protected render(): React.ReactElement {
        return (
            <AgentPanel 
                notebookTracker={this._notebookTracker || undefined}
                app={this._app || undefined}
            />
        );
    }
}
