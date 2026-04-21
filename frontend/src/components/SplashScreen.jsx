import React from 'react';
import './SplashScreen.css';

const SplashScreen = () => {
  return (
    <div className="app-splash" role="status" aria-live="polite" aria-label="Loading Bireena Atithi app">
      <div className="app-splash-inner">
        <img src="/images/Bireena atithi.png" alt="Bireena Atithi logo" className="app-splash-logo" />
        <h1 className="app-splash-title">BIREENA ATITHI</h1>
      </div>
    </div>
  );
};

export default SplashScreen;
