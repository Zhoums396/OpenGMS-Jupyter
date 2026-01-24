/**
 * Code Generator - Generate Python code based on model/method and parameter values
 * Uses ogmsServer2.openModel to call OGMS models
 */
import { IModel, IDataMethod, IParameter } from '../types';

/**
 * Get API Host Address
 * Prioritize the current browser's host address for auto-adaptation from any IP
 */
function getApiHost(): string {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  // Non-browser environment (e.g., Node.js) uses localhost
  return 'localhost';
}

/**
 * Generate dependency.py content - Helper function library for data methods
 */
export function generateDependencyFile(): string {
  const hostname = getApiHost();
  const apiUrl = `http://${hostname}:3000/api`;
  
  return `"""
OpenGMS Data Method Helper Library
Auto-generated dependency file containing helper functions for data method calls
"""
import requests
import os
import re

# ============ Configuration ============
GEOMODEL_API = "${apiUrl}"
DATA_SERVER_URL = "http://221.224.35.86:38083/data"

# ============ Helper Functions ============

def upload_file(filepath):
    """Upload local file to relay server, return file ID"""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")
    
    with open(filepath, "rb") as f:
        files = {"file": (os.path.basename(filepath), f)}
        resp = requests.post(f"{GEOMODEL_API}/upload", files=files)
    
    result = resp.json()
    if result.get("status") == "success":
        print(f"✓ File uploaded: {filepath} -> ID: {result['id']}")
        return result["id"]
    else:
        raise Exception(f"File upload failed: {result}")


def is_uuid(s):
    """Check if string is UUID format"""
    return bool(re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", str(s), re.I))


def download_file(file_id_or_url, output_path):
    """Download file from URL or file ID to local"""
    if is_uuid(file_id_or_url):
        url = f"{DATA_SERVER_URL}/{file_id_or_url}"
    elif str(file_id_or_url).startswith("http"):
        url = file_id_or_url
    else:
        print(f"⚠ Unrecognized output format: {file_id_or_url}")
        return None
    
    print(f"Downloading: {url}")
    resp = requests.get(url)
    if resp.status_code == 200:
        with open(output_path, "wb") as f:
            f.write(resp.content)
        print(f"✓ File downloaded: {output_path} ({len(resp.content)} bytes)")
        return output_path
    else:
        raise Exception(f"File download failed: HTTP {resp.status_code}")


def run_datamethod(method_name, params):
    """
    Execute OpenGMS data method (simplified interface)
    
    Parameters:
        method_name: Data method name
        params: Parameter list, passed in order shown in interface
                - File parameters: pass local path (will be auto-uploaded)
                - Output parameters: pass desired save path
                - Other parameters: pass value directly
    
    Returns:
        dict: Contains execution status and output file paths
    
    Example:
        result = run_datamethod("AggregateRaster", [
            "./input.tif",      # Input file
            "./output.tif",     # Output file
            "2",                # Aggregation factor
            "AVG"               # Aggregation type
        ])
    """
    print(f"\\n{'='*50}")
    print(f"Executing data method: {method_name}")
    print(f"{'='*50}\\n")
    
    # 1. Get data method info
    info_resp = requests.get(f"{GEOMODEL_API}/datamethods/info/{method_name}")
    method_info = info_resp.json()
    
    if method_info.get("code") != 0:
        raise Exception(f"Failed to get data method info: {method_info}")
    
    method_data = method_info["method"]
    method_id = method_data["id"]
    param_type = method_info.get("paramType", {})
    
    print(f"Method ID: {method_id}")
    
    # 2. Get parameter key list (in API required order)
    val_keys = []
    val_keys.extend(param_type.get("FileInput", []))
    val_keys.extend(param_type.get("Output", []))
    val_keys.extend(param_type.get("ParamInput", []))
    
    file_input_keys = set(param_type.get("FileInput", []))
    output_keys = set(param_type.get("Output", []))
    
    # 3. Process parameter values
    processed_values = []
    output_files = {}  # Save output file mapping {key: local_path}
    
    for key, val in zip(val_keys, params):
        val = str(val)
        if key in file_input_keys and os.path.exists(val):
            # FileInput: Upload local file
            file_id = upload_file(val)
            processed_values.append(file_id)
        elif key in output_keys:
            # Output: Record local path, extract filename
            output_files[key] = val
            basename = os.path.basename(val)
            name_without_ext = os.path.splitext(basename)[0]
            processed_values.append(name_without_ext)
            print(f"Output param: {key} -> {name_without_ext} (save to: {val})")
        else:
            # ParamInput: Use directly
            processed_values.append(val)
    
    # 4. Build and call API
    inputs = {key: val for key, val in zip(val_keys, processed_values)}
    print(f"\\nCall params: {inputs}\\n")
    
    run_resp = requests.post(
        f"{GEOMODEL_API}/datamethods/run",
        json={"modelId": method_id, "inputs": inputs}
    )
    result = run_resp.json()
    
    # 5. Handle result
    if result.get("status") != "success":
        raise Exception(f"Execution failed: {result.get('message', result)}")
    
    print("✓ Data method executed successfully!")
    
    # 6. Download output files
    output_info = result.get("output", {})
    downloaded_files = {}
    
    if output_info:
        for key, value in output_info.items():
            file_ids = value if isinstance(value, list) else [value] if value else []
            local_path = output_files.get(key, f"output_{key}.tif")
            
            for idx, file_id in enumerate(file_ids):
                if file_id:
                    save_name = local_path
                    if len(file_ids) > 1:
                        base, ext = os.path.splitext(save_name)
                        save_name = f"{base}_{idx+1}{ext}"
                    
                    download_file(file_id, save_name)
                    downloaded_files[key] = save_name
    
    print(f"\\n{'='*50}")
    print("Execution complete!")
    print(f"{'='*50}\\n")
    
    return {
        "status": "success",
        "outputs": downloaded_files,
        "info": result.get("info", "")
    }
`;
}

/**
 * Generate model invocation code
 * Based on PyGeoModel/ogmsServer2 actual calling method
 */
export function generateModelCode(model: IModel, paramValues: Record<string, any>): string {
  const lines: string[] = [];
  
  // OpenGMS Token (built-in)
  const OGMS_TOKEN = '6U3O1Sy5696I5ryJFaYCYVjcIV7rhd1MKK0QGX9A7zafogi8xTdvejl6ISUP1lEs';
  
  // Import statements
  lines.push('# OpenGMS Model Invocation');
  lines.push('# Using ogmsServer2 SDK to run geographic models');
  lines.push('from ogmsServer2.openModel import OGMSAccess');
  lines.push('');
  
  // Create model instance (Token built-in)
  lines.push(`# Create model access instance: ${model.name}`);
  lines.push(`model = OGMSAccess("${model.name}", token="${OGMS_TOKEN}")`);
  lines.push('');
  
  // Build parameter dictionary
  lines.push('# Set input parameters');
  lines.push('# Parameter format: { "StateName": { "EventName": "file path or value" } }');
  lines.push('params = {');
  
  if (model.parameters && model.parameters.length > 0) {
    // Group parameters by StateName
    const groupedParams: Record<string, Record<string, any>> = {};
    
    for (const param of model.parameters) {
      const value = paramValues[param.name];
      // Parse parameter name: "StateName.EventName" or "StateName.EventName.ChildName"
      const parts = param.name.split('.');
      const stateName = parts[0];
      const eventName = parts[1] || param.name;
      
      if (!groupedParams[stateName]) {
        groupedParams[stateName] = {};
      }
      
      if (parts.length === 3) {
        // Numeric parameter: StateName.EventName.ChildName
        const childName = parts[2];
        if (!groupedParams[stateName][eventName]) {
          groupedParams[stateName][eventName] = { value: '' };
        }
        if (value !== undefined && value !== '') {
          groupedParams[stateName][eventName] = { value: String(value) };
        }
      } else {
        // File parameter: StateName.EventName
        if (value !== undefined && value !== '') {
          groupedParams[stateName][eventName] = value;
        } else {
          groupedParams[stateName][eventName] = `"/path/to/${eventName}_data"  # TODO: Set actual file path`;
        }
      }
    }
    
    // Generate parameter code
    const stateNames = Object.keys(groupedParams);
    stateNames.forEach((stateName, stateIdx) => {
      lines.push(`    "${stateName}": {`);
      const events = Object.entries(groupedParams[stateName]);
      events.forEach(([eventName, eventValue], eventIdx) => {
        const comma = eventIdx < events.length - 1 ? ',' : '';
        if (typeof eventValue === 'object' && eventValue.value !== undefined) {
          // Numeric parameter
          lines.push(`        "${eventName}": "${eventValue.value}"${comma}  # Numeric parameter`);
        } else {
          // File parameter
          const valueStr = typeof eventValue === 'string' && eventValue.startsWith('"') 
            ? eventValue 
            : `"${eventValue}"`;
          lines.push(`        "${eventName}": ${valueStr}${comma}`);
        }
      });
      const stateComma = stateIdx < stateNames.length - 1 ? ',' : '';
      lines.push(`    }${stateComma}`);
    });
  } else {
    lines.push('    # Please add input parameters as required by the model');
    lines.push('    # "StateName": {');
    lines.push('    #     "EventName": "/path/to/input_file"');
    lines.push('    # }');
  }
  
  lines.push('}');
  lines.push('');
  
  // Run model
  lines.push('# Run model (will auto-wait for completion)');
  lines.push('try:');
  lines.push('    outputs = model.createTask(params)');
  lines.push('    print("Model run completed!")');
  lines.push('    print("Output results:", outputs)');
  lines.push('');
  lines.push('    # Download output files');
  lines.push('    model.downloadAllData()');
  lines.push('except Exception as e:');
  lines.push('    print(f"Model run failed: {e}")');
  
  return lines.join('\n');
}

/**
 * Generate data method invocation code (simplified version)
 * Depends on helper functions in dependency.py
 */
export function generateDataMethodCode(method: IDataMethod, paramValues: Record<string, any>): string {
  const lines: string[] = [];
  
  // Import dependency
  lines.push('# Import OpenGMS data method helper library');
  lines.push('from dependency import run_datamethod');
  lines.push('');
  
  // Method description
  lines.push(`# Data Method: ${method.name}`);
  if (method.description) {
    lines.push(`# ${method.description}`);
  }
  lines.push('');
  
  // Collect parameters
  const paramList: Array<{name: string, label: string, value: string, type: string}> = [];
  
  if (method.parameters && method.parameters.length > 0) {
    method.parameters.forEach((param) => {
      const value = paramValues[param.name];
      const actualValue = value !== undefined && value !== '' 
        ? String(value) 
        : (param.defaultValue !== undefined ? String(param.defaultValue) : '');
      
      paramList.push({
        name: param.name,
        label: param.label || param.name,
        value: actualValue,
        type: param.type || 'string'
      });
    });
  }
  
  // Generate parameter comments and call
  lines.push('# Execute data method');
  lines.push(`result = run_datamethod("${method.name}", [`);
  
  paramList.forEach((p, idx) => {
    const comma = idx < paramList.length - 1 ? ',' : '';
    const typeHint = p.type === 'file' ? 'file path' : 'parameter';
    lines.push(`    "${p.value}"${comma}  # ${p.label} (${typeHint})`);
  });
  
  lines.push('])');
  lines.push('');
  lines.push('# View results');
  lines.push('print("Output files:", result["outputs"])');
  
  return lines.join('\n');
}

/**
 * Format Python value
 */
function formatPythonValue(value: any, type: string): string {
  switch (type) {
    case 'string':
    case 'file':
    case 'textarea':
      return `"${escapeString(String(value))}"`;
    
    case 'number':
      return String(value);
    
    case 'boolean':
      return value ? 'True' : 'False';
    
    default:
      if (typeof value === 'string') {
        return `"${escapeString(value)}"`;
      }
      return String(value);
  }
}

/**
 * Escape special characters in string
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Generate simplified code (for quick invocation)
 */
export function generateQuickCode(item: IModel | IDataMethod, paramValues: Record<string, any>): string {
  const isModel = 'md5' in item || item.type === 'model';
  
  const params = Object.entries(paramValues)
    .filter(([_, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `    "${k}": ${JSON.stringify(v)}`)
    .join(',\n');
  
  if (isModel) {
    return `from ogmsServer2.openModel import OGMSAccess

model = OGMSAccess("${item.name}", token="your_token")
outputs = model.createTask({
${params}
})
model.downloadAllData()`;
  } else {
    return `import requests

result = requests.post(
    "http://172.21.252.222:8080/container/method/invoke/${item.id}",
    json={
${params}
    }
)
print(result.json())`;
  }
}
