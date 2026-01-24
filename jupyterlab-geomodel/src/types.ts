/**
 * Type Definitions
 */

// Parameter options (for dropdown selection)
export interface IParamOption {
  label: string;
  value: string | number;
}

// Parameter definition
export interface IParameter {
  name: string;
  label?: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'select' | 'textarea';
  description?: string;
  required?: boolean;
  default?: any;
  defaultValue?: any;  // Default value
  placeholder?: string;
  // Number type specific
  min?: number;
  max?: number;
  step?: number;
  // Select type specific
  options?: IParamOption[];
}

// Model definition
export interface IModel {
  id: string;
  name: string;
  description?: string;
  author?: string;
  type?: 'model';
  parameters?: IParameter[];
  // OpenGMS specific fields
  md5?: string;
  mdlJson?: any;
}

// Data method definition
export interface IDataMethod {
  id: string | number;
  name: string;
  description?: string;
  author?: string;
  type?: 'datamethod';
  parameters?: IParameter[];
  // Specific fields
  toolId?: string;
}

// API Response
export interface IApiResponse<T> {
  data: T[];
  total: number;
  page: number;
}

// API Configuration
export interface IApiConfig {
  baseUrl: string;
  token?: string;
}
