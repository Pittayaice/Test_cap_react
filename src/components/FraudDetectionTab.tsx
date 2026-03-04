import React, { useEffect, useState } from 'react';
import { parseNestedResponse } from '../api';

interface FraudDetectionTabProps {
  imageData: string | null;
}

interface FraudCheck {
  name: string;
  status: 'pass' | 'fail';
  message: string;
}

const FraudDetectionTab: React.FC<FraudDetectionTabProps> = ({ imageData }) => {
  const [fraudChecks, setFraudChecks] = useState<FraudCheck[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setOverallStatus] = useState<'pass' | 'fail'>('pass');

  useEffect(() => {
    if (imageData) {
      runFraudDetection();
    }
  }, [imageData]);

  const runFraudDetection = async () => {
    setLoading(true);
    setError(null);

    try {
      const serverResponseStr = sessionStorage.getItem('serverResponse');
      
      if (serverResponseStr) {
        const serverResponse = JSON.parse(serverResponseStr);
        console.log('[FraudDetectionTab] Server response:', serverResponse);
        
        const resultData = parseNestedResponse(serverResponse);
        console.log('[FraudDetectionTab] Parsed data:', resultData);
        
        const checks: FraudCheck[] = [];
        
        if (resultData.hologram_detection !== undefined) {
          checks.push({
            name: 'Hologram Detection',
            status: resultData.hologram_detection ? 'pass' : 'fail',
            message: resultData.hologram_detection ? 'Hologram detected and verified' : 'Hologram not detected'
          });
        }
        
        if (resultData.red_line_detection !== undefined) {
          checks.push({
            name: 'Red Line Detection',
            status: resultData.red_line_detection ? 'pass' : 'fail',
            message: resultData.red_line_detection ? 'Security line present' : 'Security line missing'
          });
        }
        
        if (resultData.spoof_detection !== undefined) {
          checks.push({
            name: 'Spoof Detection',
            status: resultData.spoof_detection ? 'fail' : 'pass',
            message: resultData.spoof_detection ? 'Potential tampering detected' : 'No tampering detected'
          });
        }
        
        if (resultData.info_verification !== undefined) {
          checks.push({
            name: 'Information Verification',
            status: resultData.info_verification ? 'pass' : 'fail',
            message: resultData.info_verification ? 'All fields valid' : 'Some fields need verification'
          });
        }
        
        if (resultData.location_check !== undefined) {
          checks.push({
            name: 'Location Code Check',
            status: resultData.location_check ? 'pass' : 'fail',
            message: resultData.location_check ? 'Valid location code' : 'Invalid location code'
          });
        }
        
        // If no specific checks found, show all available data as checks
        if (checks.length === 0) {
          Object.entries(resultData).forEach(([key, value]) => {
            if (typeof value === 'boolean') {
              checks.push({
                name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                status: value ? 'pass' : 'fail',
                message: value ? 'Check passed' : 'Check failed'
              });
            }
          });
        }
        
        // If still no checks, show a summary
        if (checks.length === 0) {
          checks.push({
            name: 'Analysis Complete',
            status: 'pass',
            message: 'Document processed successfully'
          });
        }
        
        setFraudChecks(checks);
        
        const hasFail = checks.some((check) => check.status === 'fail');
        setOverallStatus(hasFail ? 'fail' : 'pass');
      }
    } catch (err) {
      setError('Failed to run fraud detection');
      console.error('Fraud detection error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: 'pass' | 'fail') => {
    switch (status) {
      case 'pass': return 'border-green-800 bg-green-900 bg-opacity-20';
      case 'fail': return 'border-red-800 bg-red-900 bg-opacity-20';
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
          <span>Running fraud detection...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button onClick={runFraudDetection} className="mt-3 bg-red-800 text-white py-2 px-4 rounded">
            Retry
          </button>
        </div>
      )}

      {fraudChecks && !loading && (
        <div className="space-y-4">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Security Checks</h2>
            {fraudChecks.map((check, index) => (
              <div key={index} className={`rounded-lg p-4 border ${getStatusColor(check.status)}`}>
                <h4 className="font-medium">{check.name}</h4>
                <p className="text-sm text-gray-400 mt-1">{check.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FraudDetectionTab;
