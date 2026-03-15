import React from 'react';
import './Header.css';

export default function Header({ onOpenImageSearch }) {
  return (
    <header className="header glass-panel">
      <div className="container header-container">
        <div className="logo">
          <span className="text-gradient">NexGen</span> Retail
        </div>
        
        <div className="search-bar">
          <input type="text" placeholder="What are you looking for?" />
          <button className="icon-btn search-icon">🔍</button>
          <button className="icon-btn camera-icon" title="Search by Image" onClick={onOpenImageSearch}>📷</button>
        </div>

        <nav className="nav-actions">
          <button className="nav-btn">Sign In</button>
          <button className="nav-btn cart-btn">
            🛒 <span className="cart-badge">2</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
