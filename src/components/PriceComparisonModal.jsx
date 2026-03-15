import React from 'react';
import './PriceComparisonModal.css';

export default function PriceComparisonModal({ product, isOpen, onClose }) {
  if (!isOpen || !product) return null;

  const mockCompetitors = [
    { name: 'GlobalMarket', price: product.price + 15, shipping: 'Free', aiTake: 'Slightly higher price.' },
    { name: 'TechHaven', price: product.price - 5, shipping: '₹800.00', aiTake: 'Lower base price, but higher total due to shipping.' },
    { name: 'BuyWise Retail (Us)', price: product.price, shipping: 'Prime Free', aiTake: 'Best overall value match based on your preferences.' }
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel comparison-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2 className="modal-title">AI Price Analysis</h2>
        <p className="modal-subtitle">Real-time market scan for <strong>{product.name}</strong></p>

        <div className="comparison-list">
          {mockCompetitors.map((comp, idx) => (
            <div key={idx} className={`comparison-card ${comp.name.includes('NexGen') ? 'highlight' : ''}`}>
              <div className="comp-header">
                <h3>{comp.name}</h3>
                <span className="comp-price">₹{comp.price.toFixed(2)}</span>
              </div>
              <p className="comp-shipping">Shipping: {comp.shipping}</p>
              <div className="ai-take">
                <span className="ai-badge">AI Insight</span>
                {comp.aiTake}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
