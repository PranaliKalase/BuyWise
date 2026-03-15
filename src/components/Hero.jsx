import React from 'react';
import './Hero.css';

export default function Hero() {
  return (
    <section className="hero">
      <div className="container hero-container">
        <div className="hero-content">
          <span className="badge glass-panel text-gradient">New AI Arrival</span>
          <h1 className="hero-title">Experience the <br />Future of Retail</h1>
          <p className="hero-subtitle">
            Personalized recommendations fueled by our next-gen quantum matching engine.
            Discover products you didn't know you needed.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary">Shop Top AI Picks</button>
            <button className="btn btn-secondary glass-panel">Watch Demo</button>
          </div>
        </div>
        <div className="hero-visual">
          {/* Abstract placeholder for high-end graphic/3D object */}
          <div className="floating-object glass-panel glow">
            <img src="/assets/FuturisticDrone.jpg" alt="Futuristic Drone" className="hero-img" />
          </div>
        </div>
      </div>
    </section>
  );
}
