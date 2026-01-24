/**
 * GeoModel Main Panel Component
 */
import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ModelBrowser } from './ModelBrowser';
import { ParameterForm } from './ParameterForm';
import { CodePreview } from './CodePreview';
import { 
  fetchModels, fetchDataMethods, fetchMyModels, fetchMyDataMethods,
  fetchModelDetail, fetchDataMethodDetail, isAuthenticated, IPaginatedResult
} from '../services/api';
import { generateModelCode, generateDataMethodCode, generateDependencyFile } from '../utils/codeGenerator';
import { IModel, IDataMethod, IParameter } from '../types';

interface IProps {
  notebookTracker: INotebookTracker;
}

type TabType = 'model' | 'datamethod';
type SourceType = 'all' | 'personal';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export const GeoModelPanel: React.FC<IProps> = ({ notebookTracker }) => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('model');
  const [source, setSource] = useState<SourceType>('all');
  const [items, setItems] = useState<(IModel | IDataMethod)[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authWarning, setAuthWarning] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 20;
  
  // Debounced search query (300ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Selected item (with full details)
  const [selectedItem, setSelectedItem] = useState<IModel | IDataMethod | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Parameter values
  const [paramValues, setParamValues] = useState<Record<string, any>>({});
  
  // Generated code
  const [generatedCode, setGeneratedCode] = useState('');

  // Reset page when search query or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, activeTab, source]);

  // Load data
  useEffect(() => {
    loadItems();
  }, [activeTab, source, debouncedSearchQuery, currentPage]);

  const loadItems = async () => {
    setLoading(true);
    setAuthWarning(false);
    try {
      if (activeTab === 'model') {
        if (source === 'all') {
          const result = await fetchModels(debouncedSearchQuery, currentPage, pageSize);
          setItems(result.data);
          setTotalItems(result.total);
          setTotalPages(result.totalPages);
        } else {
          if (!isAuthenticated()) {
            setAuthWarning(true);
            setItems([]);
            setTotalItems(0);
            setTotalPages(0);
          } else {
            const data = await fetchMyModels();
            setItems(data);
            setTotalItems(data.length);
            setTotalPages(1);
          }
        }
      } else {
        if (source === 'all') {
          const result = await fetchDataMethods(debouncedSearchQuery, currentPage, pageSize);
          setItems(result.data);
          setTotalItems(result.total);
          setTotalPages(result.totalPages);
        } else {
          if (!isAuthenticated()) {
            setAuthWarning(true);
            setItems([]);
            setTotalItems(0);
            setTotalPages(0);
          } else {
            const data = await fetchMyDataMethods();
            setItems(data);
            setTotalItems(data.length);
            setTotalPages(1);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Select item - load detailed info
  const handleSelectItem = async (item: IModel | IDataMethod) => {
    setLoadingDetail(true);
    setParamValues({});
    setGeneratedCode('');
    
    try {
      let detail: IModel | IDataMethod | null = null;
      
      // Use name as ID to get details
      const itemName = item.name || item.id;
      
      if (activeTab === 'model') {
        detail = await fetchModelDetail(String(itemName));
      } else {
        detail = await fetchDataMethodDetail(String(itemName));
      }
      
      if (detail) {
        setSelectedItem(detail);
        console.log('[GeoModel] Loaded detail with parameters:', detail.parameters);
        
        // Generate initial code immediately
        const initialCode = activeTab === 'model'
          ? generateModelCode(detail as IModel, {})
          : generateDataMethodCode(detail as IDataMethod, {});
        setGeneratedCode(initialCode);
      } else {
        // If getting details failed, use original data
        setSelectedItem(item);
        console.warn('[GeoModel] Failed to load detail, using original item');
        
        // Use original data to generate code
        const initialCode = activeTab === 'model'
          ? generateModelCode(item as IModel, {})
          : generateDataMethodCode(item as IDataMethod, {});
        setGeneratedCode(initialCode);
      }
    } catch (error) {
      console.error('Failed to load item detail:', error);
      setSelectedItem(item);
      
      // Generate basic code even on error
      const initialCode = activeTab === 'model'
        ? generateModelCode(item as IModel, {})
        : generateDataMethodCode(item as IDataMethod, {});
      setGeneratedCode(initialCode);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Back to list
  const handleBack = () => {
    setSelectedItem(null);
    setParamValues({});
    setGeneratedCode('');
  };

  // Parameter value change
  const handleParamChange = (name: string, value: any) => {
    const newValues = { ...paramValues, [name]: value };
    setParamValues(newValues);
    
    // Generate code preview in realtime
    if (selectedItem) {
      const code = activeTab === 'model'
        ? generateModelCode(selectedItem as IModel, newValues)
        : generateDataMethodCode(selectedItem as IDataMethod, newValues);
      setGeneratedCode(code);
    }
  };

  // Insert code into Notebook
  const handleInsertCode = async () => {
    const notebook = notebookTracker.currentWidget;
    if (!notebook || !generatedCode) {
      alert('Please open a Notebook and generate code first');
      return;
    }

    const notebookModel = notebook.content.model;
    if (!notebookModel) {
      return;
    }

    // If data method, first create dependency.py file
    if (activeTab === 'datamethod') {
      try {
        // Generate dependency.py content and convert to base64
        const dependencyContent = generateDependencyFile();
        const base64Content = btoa(unescape(encodeURIComponent(dependencyContent)));
        
        // Use base64 decode to avoid quote escaping issues
        await notebook.context.sessionContext.session?.kernel?.requestExecute({
          code: `
# Auto-create dependency.py helper file
import base64
_dep_b64 = "${base64Content}"
_dep_content = base64.b64decode(_dep_b64).decode('utf-8')
with open('dependency.py', 'w', encoding='utf-8') as f:
    f.write(_dep_content)
print('✓ dependency.py created/updated')
del _dep_b64, _dep_content
`
        }).done;
        console.log('[GeoModel] dependency.py created/updated');
      } catch (error) {
        console.error('Failed to create dependency.py:', error);
        // Continue inserting code even if creating dependency file failed
      }
    }

    // Get current active cell index
    const activeCellIndex = notebook.content.activeCellIndex;
    
    // Create new code cell
    const cellModel = notebookModel.sharedModel.insertCell(activeCellIndex + 1, {
      cell_type: 'code',
      source: generatedCode
    });

    // Activate newly inserted cell
    notebook.content.activeCellIndex = activeCellIndex + 1;
    
    console.log('Code inserted successfully!');
  };

  return (
    <div className="geomodel-panel">
      {/* Header */}
      <div className="geomodel-header">
        <h2>OpenGeoLab</h2>
        <p>Model & Data Method Browser</p>
      </div>

      {/* Tab Switch */}
      <div className="geomodel-tabs">
        <button 
          className={`tab-btn ${activeTab === 'model' ? 'active' : ''}`}
          onClick={() => { setActiveTab('model'); setSelectedItem(null); }}
        >
          Model
        </button>
        <button 
          className={`tab-btn ${activeTab === 'datamethod' ? 'active' : ''}`}
          onClick={() => { setActiveTab('datamethod'); setSelectedItem(null); }}
        >
          Data Method
        </button>
      </div>

      {/* Main Content Area */}
      {!selectedItem ? (
        <>
          {/* Source Switch */}
          <div className="geomodel-source">
            <label>
              <input 
                type="radio" 
                name="source" 
                value="all"
                checked={source === 'all'}
                onChange={() => setSource('all')}
              />
              All
            </label>
            <label>
              <input 
                type="radio" 
                name="source" 
                value="personal"
                checked={source === 'personal'}
                onChange={() => setSource('personal')}
              />
              My Favorites
            </label>
          </div>

          {/* Search Box */}
          <div className="geomodel-search">
            <input 
              type="text"
              placeholder={`Search ${activeTab === 'model' ? 'models' : 'data methods'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Results count */}
          {!loading && source === 'all' && (
            <div className="geomodel-results-info">
              {searchQuery ? (
                <span>Found {totalItems} {activeTab === 'model' ? 'models' : 'data methods'} for "{searchQuery}"</span>
              ) : (
                <span>Total: {totalItems} {activeTab === 'model' ? 'models' : 'data methods'}</span>
              )}
            </div>
          )}

          {/* Unauthenticated Notice */}
          {authWarning && (
            <div className="geomodel-auth-warning">
              <p>Not logged in, cannot view favorites</p>
              <p className="auth-hint">Please reopen Jupyter from OpenGeoLab to authenticate</p>
            </div>
          )}

          {/* List */}
          <ModelBrowser 
            items={items}
            loading={loading}
            onSelect={handleSelectItem}
            type={activeTab}
          />

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="geomodel-pagination">
              <button 
                className="page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="First page"
              >
                «
              </button>
              <button 
                className="page-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ‹ Prev
              </button>
              <span className="page-info">
                Page {currentPage} / {totalPages}
              </span>
              <button 
                className="page-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next ›
              </button>
              <button 
                className="page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                title="Last page"
              >
                »
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Back Button */}
          <div className="geomodel-back">
            <button onClick={handleBack}>← Back to List</button>
            <span className="item-name">{selectedItem.name}</span>
          </div>

          {loadingDetail ? (
            <div className="geomodel-loading">
              <div className="spinner"></div>
              <p>Loading parameter info...</p>
            </div>
          ) : (
            <>
              {/* Parameter Form */}
              <ParameterForm 
                item={selectedItem}
                values={paramValues}
                onChange={handleParamChange}
              />

              {/* Code Preview */}
              <CodePreview code={generatedCode} />

              {/* Insert Button */}
              <div className="geomodel-actions">
                <button 
                  className="insert-btn"
                  onClick={handleInsertCode}
                  disabled={!generatedCode}
                >
                  Insert Code
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
