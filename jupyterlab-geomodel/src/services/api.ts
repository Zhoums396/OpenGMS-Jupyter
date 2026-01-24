/**
 * API Service - Communicate with OpenGeoLab backend
 */
import { IModel, IDataMethod, IParameter } from '../types';

// API Base URL - Dynamic detection
const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // @ts-ignore - Allow configuration via global variable
    if (window.GEOMODEL_API_URL) {
      // @ts-ignore
      return window.GEOMODEL_API_URL;
    }
    
    // JupyterLab frontend runs in user's browser
    // Use the host address that accesses Jupyter (backend port 3000 on same server)
    const hostname = window.location.hostname;
    return `http://${hostname}:3000/api`;
  }
  return 'http://localhost:3000/api';
};

const API_BASE_URL = getApiBaseUrl();

console.log('[GeoModel Extension] API Base URL:', API_BASE_URL);

// Check and save JWT Token immediately on page load
if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('geomodel_token');
  if (tokenFromUrl) {
    console.log('[GeoModel Extension] Found JWT token in URL, saving to localStorage');
    localStorage.setItem('geomodel_jwt', tokenFromUrl);
    
    // After saving token, remove it from URL (security consideration), but keep other params
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('geomodel_token');
    window.history.replaceState({}, '', newUrl.toString());
  }
}

// Get JWT Token (from localStorage)
const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('geomodel_jwt');
    if (!token) {
      console.warn('[GeoModel Extension] No JWT token found. Personal favorites will not be available.');
      console.warn('[GeoModel Extension] Please reopen Jupyter from OpenGeoLab to get authenticated.');
    }
    return token;
  }
  return null;
};

// Check if authenticated
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

// Create request headers
const createHeaders = (withAuth: boolean = false): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  if (withAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
};

/**
 * Parse parameters from OGMS model details
 * Parse mdlJson.ModelClass structure to get input parameters
 */
function parseModelParameters(modelDetail: any): IParameter[] {
  const parameters: IParameter[] = [];
  
  try {
    const mdlJson = modelDetail.mdlJson || modelDetail.mdl;
    if (!mdlJson) {
      console.log('[GeoModel] No mdlJson found in model detail');
      return parameters;
    }

    // Parse ModelClass -> Behavior -> StateGroup -> States -> State -> Event
    const modelClasses = mdlJson.ModelClass || [];
    const relatedDatasets = mdlJson.ModelClass?.[0]?.Behavior?.[0]?.RelatedDatasets?.[0]?.DatasetItem || [];
    
    for (const modelClass of modelClasses) {
      const behaviors = modelClass.Behavior || [];
      for (const behavior of behaviors) {
        const stateGroups = behavior.StateGroup || [];
        for (const stateGroup of stateGroups) {
          const states = stateGroup.States || [];
          for (const statesItem of states) {
            const stateList = statesItem.State || [];
            for (const state of stateList) {
              const stateName = state.name || '';
              const events = state.Event || [];
              
              for (const event of events) {
                // Only handle response type (input parameters)
                if (event.type === 'response') {
                  const eventName = event.name || '';
                  const description = event.description || '';
                  const optional = event.optional !== 'False';
                  
                  // Check if there is a related dataset definition
                  const responseParams = event.ResponseParameter || [];
                  for (const param of responseParams) {
                    const datasetRef = param.datasetReference;
                    const dataset = relatedDatasets.find((d: any) => d.name === datasetRef);
                    
                    // Check if has UdxDeclaration (numeric parameter)
                    if (dataset?.UdxDeclaration) {
                      const udxNodes = dataset.UdxDeclaration[0]?.UdxNode?.[0]?.UdxNode || [];
                      for (const node of udxNodes) {
                        parameters.push({
                          name: `${stateName}.${eventName}.${node.name}`,
                          label: node.name,
                          type: node.type?.includes('INT') ? 'number' : 
                                node.type?.includes('REAL') ? 'number' : 'string',
                          description: node.description || `${stateName} - ${eventName}`,
                          required: !optional
                        });
                      }
                    } else {
                      // File type parameter
                      parameters.push({
                        name: `${stateName}.${eventName}`,
                        label: eventName,
                        type: 'file',
                        description: description || `${stateName} - ${eventName}`,
                        required: !optional
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`[GeoModel] Parsed ${parameters.length} parameters from model`);
  } catch (e) {
    console.error('Error parsing model parameters:', e);
  }
  
  return parameters;
}

/**
 * Parse parameters from data method details
 * Data method parameters are in the params array, each parameter has:
 * - Name: Parameter name
 * - Type: DataInput/DataOutput/ParamInput
 * - Flags: Command line parameter flags
 * - Optional: Whether optional
 * - Description: Description
 * - default_value: Default value
 * - parameter_type: Parameter type specification
 * 
 * parameter_type possible values:
 * - "Boolean": Boolean value
 * - "Integer": Integer
 * - "Float": Float
 * - "String": String
 * - "StringOrNumber": String or number
 * - "Directory": Directory path
 * - { "ExistingFile": "Raster" }: Raster file input
 * - { "ExistingFile": "Csv" }: CSV file input
 * - { "ExistingFile": "Lidar" }: LiDAR file input
 * - { "ExistingFile": { "Vector": "Point"|"Line"|"Polygon"|"Any" } }: Vector file input
 * - { "ExistingFile": { "RasterAndVector": "Point"|"Line"|"Polygon"|"Any" } }: Raster or vector input
 * - { "ExistingFile": "Text" }: Text file input
 * - { "ExistingFileOrFloat": "Raster"|"Csv"|... }: File or float input
 * - { "FileList": "Raster"|... }: Multiple file input
 * - { "NewFile": "Raster"|"Html"|"Csv"|... }: Output file
 * - { "OptionList": ["opt1", "opt2"] }: Enum options
 * - { "VectorAttributeField": ["Number", "--input"] }: Vector attribute field
 */
function parseDataMethodParameters(methodDetail: any): IParameter[] {
  const parameters: IParameter[] = [];
  
  try {
    // Data method parameters are in the params array
    if (methodDetail.params && Array.isArray(methodDetail.params)) {
      methodDetail.params.forEach((param: any) => {
        // Get parameter flags (for command line)
        const flags = param.Flags || [];
        const flagName = flags.length > 0 ? flags[flags.length - 1].replace(/^-+/, '') : param.Name;
        
        // Determine parameter type
        let paramType: 'file' | 'number' | 'string' | 'boolean' | 'select' | 'textarea' = 'string';
        let options: Array<{label: string, value: string}> | undefined;
        let placeholder: string | undefined;
        
        const pType = param.parameter_type;
        const dataType = param.Type; // DataInput/DataOutput/ParamInput
        
        // Determine parameter type based on Type and parameter_type
        if (dataType === 'DataInput' || dataType === 'DataOutput') {
          paramType = 'file';
          
          // Set placeholder based on parameter_type
          if (pType && typeof pType === 'object') {
            if (pType.ExistingFile) {
              const fileType = pType.ExistingFile;
              if (fileType === 'Raster') {
                placeholder = 'Raster file (.tif, .tiff)';
              } else if (fileType === 'Csv') {
                placeholder = 'CSV file (.csv)';
              } else if (fileType === 'Lidar') {
                placeholder = 'LiDAR file (.zlidar, .las)';
              } else if (fileType === 'Text') {
                placeholder = 'Text file (.txt)';
              } else if (typeof fileType === 'object') {
                if (fileType.Vector) {
                  placeholder = `Vector file (.shp) - ${fileType.Vector}`;
                } else if (fileType.RasterAndVector) {
                  placeholder = `Raster or vector file - ${fileType.RasterAndVector}`;
                }
              }
            } else if (pType.NewFile) {
              const outType = pType.NewFile;
              placeholder = `Output filename (${outType})`;
            } else if (pType.FileList) {
              placeholder = 'Multiple file paths (comma separated)';
            } else if (pType.ExistingFileOrFloat) {
              placeholder = 'File path or float number';
            }
          }
        } else if (pType === 'Boolean') {
          paramType = 'boolean';
        } else if (pType === 'Integer') {
          paramType = 'number';
          placeholder = 'Integer';
        } else if (pType === 'Float') {
          paramType = 'number';
          placeholder = 'Float';
        } else if (pType === 'String') {
          paramType = 'string';
        } else if (pType === 'StringOrNumber') {
          paramType = 'string';
          placeholder = 'String or number';
        } else if (pType === 'Directory') {
          paramType = 'string';
          placeholder = 'Directory path';
        } else if (pType && typeof pType === 'object') {
          if (pType.OptionList && Array.isArray(pType.OptionList)) {
            paramType = 'select';
            options = pType.OptionList.map((opt: string) => ({ label: opt, value: opt }));
          } else if (pType.VectorAttributeField) {
            paramType = 'string';
            placeholder = 'Vector attribute field name';
          }
        }
        
        parameters.push({
          name: flagName,
          label: param.Name,
          type: paramType,
          description: param.Description || '',
          required: param.Optional === false,
          defaultValue: param.default_value,
          options: options,
          placeholder: placeholder
        });
      });
    }
    console.log(`[GeoModel] Parsed ${parameters.length} parameters from datamethod:`, parameters);
  } catch (e) {
    console.error('Error parsing data method parameters:', e);
  }
  
  return parameters;
}

/**
 * Pagination result interface
 */
export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Fetch all models list with pagination
 */
export async function fetchModels(query: string = '', page: number = 1, limit: number = 20): Promise<IPaginatedResult<IModel>> {
  try {
    const url = `${API_BASE_URL}/ogms/models?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`;
    console.log('[GeoModel] Fetching models from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[GeoModel] Models response, total:', result.total);
    
    // Convert to unified format, use name as ID (OGMS queries by name)
    const models = (result.data || []).map((m: any) => ({
      id: m.name,  // Use name as ID
      name: m.name,
      description: m.description || '',
      author: m.author || 'OpenGMS',
      type: 'model' as const
    }));
    
    return {
      data: models,
      total: result.total || models.length,
      page: result.page || page,
      limit: result.limit || limit,
      totalPages: Math.ceil((result.total || models.length) / limit)
    };
  } catch (error) {
    console.error('Error fetching models:', error);
    return { data: [], total: 0, page: 1, limit, totalPages: 0 };
  }
}

/**
 * Fetch all data methods list with pagination
 */
export async function fetchDataMethods(query: string = '', page: number = 1, limit: number = 20): Promise<IPaginatedResult<IDataMethod>> {
  try {
    const url = `${API_BASE_URL}/datamethods?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`;
    console.log('[GeoModel] Fetching data methods from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data methods: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[GeoModel] DataMethods response, total:', result.total);
    
    // Convert to unified format, use name as ID
    const methods = (result.data || []).map((m: any) => ({
      id: m.name,  // Use name as ID (API queries details by name)
      name: m.name,
      description: m.description || '',
      author: m.author || 'Unknown',
      type: 'datamethod' as const
    }));
    
    return {
      data: methods,
      total: result.total || methods.length,
      page: result.page || page,
      limit: result.limit || limit,
      totalPages: Math.ceil((result.total || methods.length) / limit)
    };
  } catch (error) {
    console.error('Error fetching data methods:', error);
    return { data: [], total: 0, page: 1, limit, totalPages: 0 };
  }
}

/**
 * Fetch user's favorite models list
 */
export async function fetchMyModels(): Promise<IModel[]> {
  try {
    const url = `${API_BASE_URL}/jupyter/my-models`;
    console.log('[GeoModel] Fetching my models from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders(true)
    });
    
    if (!response.ok) {
      console.log('[GeoModel] My models fetch failed, may not be authenticated');
      return [];
    }
    
    const result = await response.json();
    console.log('[GeoModel] My models response:', result);
    
    return (result.models || []).map((m: any) => ({
      ...m,
      id: m.name || m.id,  // Ensure name is used as ID
      type: 'model' as const
    }));
  } catch (error) {
    console.error('Error fetching my models:', error);
    return [];
  }
}

/**
 * Fetch user's favorite data methods list
 */
export async function fetchMyDataMethods(): Promise<IDataMethod[]> {
  try {
    const url = `${API_BASE_URL}/jupyter/my-datamethods`;
    console.log('[GeoModel] Fetching my datamethods from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders(true)
    });
    
    if (!response.ok) {
      console.log('[GeoModel] My datamethods fetch failed, may not be authenticated');
      return [];
    }
    
    const result = await response.json();
    console.log('[GeoModel] My datamethods response:', result);
    
    return (result.dataMethods || []).map((m: any) => ({
      ...m,
      id: m.name || m.id,
      type: 'datamethod' as const
    }));
  } catch (error) {
    console.error('Error fetching my data methods:', error);
    return [];
  }
}

/**
 * Fetch Jupyter working directory file list
 */
export async function fetchJupyterFiles(subPath: string = ''): Promise<Array<{name: string, type: string, size: number}>> {
  try {
    // Method 1: Use Jupyter built-in contents API to get working directory files
    // Jupyter service runs on the same domain as the current page
    const jupyterBaseUrl = window.location.origin;
    const contentsUrl = `${jupyterBaseUrl}/api/contents/${subPath}`;
    
    console.log('[GeoModel] Fetching files from Jupyter API:', contentsUrl);
    
    const response = await fetch(contentsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log('[GeoModel] Jupyter API failed, status:', response.status);
      throw new Error(`Failed to fetch files: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[GeoModel] Jupyter contents API response:', result);
    
    // Jupyter contents API returns { content: [...] } format
    if (result.content && Array.isArray(result.content)) {
      return result.content.map((item: any) => ({
        name: item.name,
        type: item.type === 'directory' ? 'folder' : 'file',
        size: item.size || 0
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching Jupyter files:', error);
    return [];
  }
}

/**
 * Fetch model details (including parameter definitions)
 * Note: OGMS API uses model name as identifier
 */
export async function fetchModelDetail(modelName: string): Promise<IModel | null> {
  try {
    // OGMS API uses name as path parameter
    const url = `${API_BASE_URL}/ogms/models/${encodeURIComponent(modelName)}`;
    console.log('[GeoModel] Fetching model detail from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch model detail: ${response.status}`);
    }
    
    const modelDetail = await response.json();
    console.log('[GeoModel] Model detail received');
    
    // Parse parameters
    const parameters = parseModelParameters(modelDetail);
    
    return {
      id: modelName,
      name: modelName,
      description: modelDetail.description || '',
      author: modelDetail.author || 'OpenGMS',
      type: 'model',
      parameters,
      mdlJson: modelDetail.mdl || modelDetail.mdlJson
    };
  } catch (error) {
    console.error('Error fetching model detail:', error);
    return null;
  }
}

/**
 * Fetch data method details (including parameter definitions)
 */
export async function fetchDataMethodDetail(methodName: string): Promise<IDataMethod | null> {
  try {
    // Data method API uses name as path parameter
    const url = `${API_BASE_URL}/datamethods/${encodeURIComponent(methodName)}`;
    console.log('[GeoModel] Fetching datamethod detail from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data method detail: ${response.status}`);
    }
    
    const methodDetail = await response.json();
    console.log('[GeoModel] DataMethod detail received');
    
    // Parse parameters
    const parameters = parseDataMethodParameters(methodDetail);
    
    return {
      id: methodDetail.name || methodName,
      name: methodDetail.name || methodName,
      description: methodDetail.description || '',
      author: methodDetail.author || 'Unknown',
      type: 'datamethod',
      parameters,
      toolId: methodDetail.toolId
    };
  } catch (error) {
    console.error('Error fetching data method detail:', error);
    return null;
  }
}
