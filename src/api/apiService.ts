// api/apiService.ts - Centralized API service
// const API_BASE_URL = 'http://127.0.0.1:8000';
const API_BASE_URL = 'https://id-ocr-s3bfstl62a-eu.a.run.app';

export interface ServerResponse {
  result?: any;
  [key: string]: any;
}

/**
 * Upload and process ID card image
 * @param blob - Image blob to upload
 * @param filename - Filename for the upload
 * @returns Server response with processed data
 */
export async function uploadCardImage(
  blob: Blob,
  filename: string = 'idcard.jpg',
  hasSpikeReflection: boolean = false
): Promise<ServerResponse> {
  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('has_spike_reflection', String(hasSpikeReflection));

  const response = await fetch(`${API_BASE_URL}/check`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Server error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('Backend response:', data);
  return data;
}

/**
 * Parse nested JSON response from backend
 */
export function parseNestedResponse(data: any): any {
  try {
    let result = data;

    // Handle nested result structure
    if (data?.result) {
      result = typeof data.result === 'string' 
        ? JSON.parse(data.result) 
        : data.result;
    }

    // Unwrap single-key objects
    let unwraps = 0;
    while (result && typeof result === 'object' && Object.keys(result).length === 1 && unwraps < 6) {
      const key = Object.keys(result)[0];
      const value = result[key];
      
      if (key === 'result' && value && typeof value === 'object') {
        result = value;
        unwraps++;
        continue;
      }
      
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          result = JSON.parse(value);
          unwraps++;
          continue;
        } catch (e) {
          break;
        }
      }
      
      break;
    }

    return result;
  } catch (e) {
    console.error('Error parsing response:', e);
    return data;
  }
}
