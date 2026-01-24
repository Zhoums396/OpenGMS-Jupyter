/**
 * Parameter Form Component - Dynamically generate forms based on model/method parameter definitions
 */
import * as React from 'react';
import { IModel, IDataMethod, IParameter } from '../types';
import { fetchJupyterFiles } from '../services/api';

interface IProps {
  item: IModel | IDataMethod;
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
}

interface IFileInfo {
  name: string;
  type: string;
  size: number;
}

export const ParameterForm: React.FC<IProps> = ({ item, values, onChange }) => {
  // Get parameter list
  const parameters: IParameter[] = item.parameters || [];
  
  // File browser state
  const [showFileBrowser, setShowFileBrowser] = React.useState(false);
  const [browserFiles, setBrowserFiles] = React.useState<IFileInfo[]>([]);
  const [browserLoading, setBrowserLoading] = React.useState(false);
  const [activeParamName, setActiveParamName] = React.useState<string>('');

  if (parameters.length === 0) {
    return (
      <div className="geomodel-form">
        <div className="form-notice">
          <p>This {item.type === 'model' ? 'model' : 'data method'} requires no input parameters</p>
        </div>
      </div>
    );
  }

  // Render single parameter input control
  const renderInput = (param: IParameter) => {
    const value = values[param.name] ?? param.defaultValue ?? param.default ?? '';

    switch (param.type) {
      case 'file':
        return (
          <div className="file-input-wrapper">
            <input
              type="text"
              placeholder="Enter file path..."
              value={value}
              onChange={(e) => onChange(param.name, e.target.value)}
            />
            <button 
              className="browse-btn"
              onClick={() => handleFileBrowse(param.name)}
            >
              Browse...
            </button>
          </div>
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onChange(param.name, e.target.value)}
          >
            <option value="">-- Please select --</option>
            {param.options?.map((opt) => (
              <option key={String(opt.value)} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            min={param.min}
            max={param.max}
            step={param.step || 1}
            onChange={(e) => onChange(param.name, parseFloat(e.target.value))}
          />
        );

      case 'boolean':
        return (
          <label className="checkbox-wrapper">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(param.name, e.target.checked)}
            />
            <span>{param.label || param.name}</span>
          </label>
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            rows={4}
            placeholder={param.placeholder || ''}
            onChange={(e) => onChange(param.name, e.target.value)}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            placeholder={param.placeholder || ''}
            onChange={(e) => onChange(param.name, e.target.value)}
          />
        );
    }
  };

  // Open file browser - select from Jupyter working directory
  const handleFileBrowse = async (paramName: string) => {
    setActiveParamName(paramName);
    setBrowserLoading(true);
    setShowFileBrowser(true);
    
    try {
      const files = await fetchJupyterFiles();
      // Filter to show only files, not folders or notebooks
      const dataFiles = files.filter((f: IFileInfo) => f.type === 'file');
      setBrowserFiles(dataFiles);
    } catch (e) {
      console.error('Error fetching files:', e);
      setBrowserFiles([]);
    } finally {
      setBrowserLoading(false);
    }
  };
  
  // Select file
  const handleFileSelect = (fileName: string) => {
    onChange(activeParamName, `./${fileName}`);
    setShowFileBrowser(false);
    setActiveParamName('');
  };
  
  // Close file browser
  const handleCloseBrowser = () => {
    setShowFileBrowser(false);
    setActiveParamName('');
  };
  
  // Refresh file list
  const handleRefreshFiles = async () => {
    setBrowserLoading(true);
    try {
      const files = await fetchJupyterFiles();
      const dataFiles = files.filter((f: IFileInfo) => f.type === 'file');
      setBrowserFiles(dataFiles);
    } catch (e) {
      console.error('Error refreshing files:', e);
    } finally {
      setBrowserLoading(false);
    }
  };

  // Render file browser modal
  const renderFileBrowser = () => {
    if (!showFileBrowser) return null;
    
    return (
      <div className="file-browser-overlay">
        <div className="file-browser-modal">
          <div className="file-browser-header">
            <h4>Select File (Working Directory)</h4>
            <div className="header-actions">
              <button 
                className="refresh-btn" 
                onClick={handleRefreshFiles}
                disabled={browserLoading}
                title="Refresh file list"
              >
                🔄
              </button>
              <button className="close-btn" onClick={handleCloseBrowser}>×</button>
            </div>
          </div>
          <div className="file-browser-content">
            {browserLoading ? (
              <div className="loading">Loading...</div>
            ) : browserFiles.length === 0 ? (
              <div className="empty-notice">
                <p>No data files in working directory</p>
                <p className="hint">Please upload files via Jupyter file browser first</p>
              </div>
            ) : (
              <ul className="file-list">
                {browserFiles.map((file) => (
                  <li 
                    key={file.name}
                    className="file-item"
                    onClick={() => handleFileSelect(file.name)}
                  >
                    <span className="file-icon">📄</span>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="geomodel-form">
      <h3>Parameter Settings</h3>
      
      {parameters.map((param) => (
        <div key={param.name} className="form-group">
          <label>
            {param.label || param.name}
            {param.required && <span className="required">*</span>}
          </label>
          {param.description && (
            <p className="param-desc">{param.description}</p>
          )}
          {renderInput(param)}
        </div>
      ))}
      
      {/* File browser modal */}
      {renderFileBrowser()}
    </div>
  );
};
