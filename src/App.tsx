import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EnhancedCapturePage from './pages/EnhancedCapturePage';
import ResultsPage from './pages/ResultsPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App min-h-screen bg-black text-white">
        <Routes>
          <Route path="/" element={<EnhancedCapturePage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
