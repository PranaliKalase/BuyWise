import React from 'react';
import './Hero.css';
import futuristicDrone from '../assets/futuristicDrone.jpg';

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

          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-object glass-panel glow">
            <img src={futuristicDrone} alt="Futuristic Drone" className="hero-img" />
          </div>
        </div>
      </div>
    </section>
  );
}
