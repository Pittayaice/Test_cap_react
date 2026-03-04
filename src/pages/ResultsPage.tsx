import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ExtractDataTab from '../components/ExtractDataTab';
import FraudDetectionTab from '../components/FraudDetectionTab';

type TabType = 'extract' | 'fraud';

const ResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('extract');
  const [imageData, setImageData] = useState<string | null>(null);

  useEffect(() => {
    const storedImage = sessionStorage.getItem('capturedImage');
    if (!storedImage) {
      navigate('/');
      return;
    }
    setImageData(storedImage);
  }, [navigate]);

  const handleBack = () => {
    sessionStorage.removeItem('capturedImage');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <button onClick={handleBack} className="p-2 hover:bg-gray-900 rounded-lg">
          Back
        </button>
        <h1 className="text-xl font-bold absolute left-1/2 transform -translate-x-1/2">ID Card OCR</h1>
        <div className="w-16"></div>
      </div>

      <div className="border-b border-gray-800 flex">
        <button
          onClick={() => setActiveTab('extract')}
          className={`flex-1 py-4 px-6 ${
            activeTab === 'extract' ? 'bg-white text-black' : 'text-gray-400'
          }`}
        >
          Extract Data
        </button>
        <button
          onClick={() => setActiveTab('fraud')}
          className={`flex-1 py-4 px-6 ${
            activeTab === 'fraud' ? 'bg-white text-black' : 'text-gray-400'
          }`}
        >
          Fraud Detection
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'extract' && <ExtractDataTab imageData={imageData} />}
        {activeTab === 'fraud' && <FraudDetectionTab imageData={imageData} />}
      </div>
    </div>
  );
};

export default ResultsPage;
