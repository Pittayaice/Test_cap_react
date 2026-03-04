import React, { useEffect, useState } from 'react';
import { parseNestedResponse } from '../api';

interface ExtractDataTabProps {
  imageData: string | null;
}

interface ExtractedData {
  [key: string]: string | number | null;
}

const ExtractDataTab: React.FC<ExtractDataTabProps> = ({ imageData }) => {
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (imageData) {
      fetchExtractedData();
    }
  }, [imageData]);

  const fetchExtractedData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Read the server response from sessionStorage
      const serverResponseStr = sessionStorage.getItem('serverResponse');
      
      if (serverResponseStr) {
        const serverResponse = JSON.parse(serverResponseStr);
        console.log('[ExtractDataTab] Server response:', serverResponse);
        
        // Parse using API service
        const resultData = parseNestedResponse(serverResponse);
        console.log('[ExtractDataTab] Parsed data:', resultData);
        
        setExtractedData(resultData);
      } else {
        // Fallback to mock data if no server response
        await new Promise((resolve) => setTimeout(resolve, 500));
        setExtractedData({
          'Note': 'No backend data available - showing mock data',
          'ID Number': '1234567890123',
          'Name': 'John Doe',
        });
      }
    } catch (err) {
      setError('Failed to extract data');
      console.error('Extract data error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {imageData && (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <img src={imageData} alt="ID Card" className="w-full h-auto" />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <span>Extracting data...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button onClick={fetchExtractedData} className="mt-3 bg-red-800 text-white py-2 px-4 rounded">
            Retry
          </button>
        </div>
      )}

      {extractedData && !loading && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold mb-4">Extracted Information</h2>
          
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-4">
            <div>
              <div className="text-gray-400 text-sm mb-1">fullnameTh</div>
              <div className="text-white font-medium">{extractedData.fullnameTh || 'Not detected'}</div>
            </div>

            <div>
              <div className="text-gray-400 text-sm mb-1">fullnameEn</div>
              <div className="text-white font-medium">{extractedData.fullnameEn || 'Not detected'}</div>
            </div>

            <div>
              <div className="text-gray-400 text-sm mb-1">id</div>
              <div className="text-white font-medium">{extractedData.id || extractedData.idCardNo || 'Not detected'}</div>
            </div>

            <div>
              <div className="text-gray-400 text-sm mb-1">expireDate</div>
              <div className="text-white font-medium">{extractedData.Expire || extractedData.expireDateTH || 'Not detected'}</div>
            </div>

            <div>
              <div className="text-gray-400 text-sm mb-1">issueDate</div>
              <div className="text-white font-medium">{extractedData.Issue || extractedData.issueDateTH || 'Not detected'}</div>
            </div>

            <div>
              <div className="text-gray-400 text-sm mb-1">address</div>
              <div className="text-white font-medium">{extractedData.addressFull || 'Not detected'}</div>
            </div>
            
            <div>
              <div className="text-gray-400 text-sm mb-1">requestNumber</div>
              <div className="text-white font-medium">{extractedData.requestNumber || 'Not detected'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractDataTab;