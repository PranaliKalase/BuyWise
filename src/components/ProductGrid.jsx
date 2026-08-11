import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProductCard from './ProductCard';
import './ProductGrid.css';

export default function ProductGrid({ title, products, personalized }) {
  const navigate = useNavigate();

  const handleViewAll = () => {
    // Navigate to Search Results for this specific category
    navigate(`/search.html?cat=${encodeURIComponent(title)}`);
  };

  return (
    <section className="product-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">
            {personalized && <span className="sparkle">✨</span>}
            {title}
          </h2>
        </div>
        
        <div className="product-grid">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        
        <div className="view-all-container" style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button className="btn-view-all btn btn-secondary" onClick={handleViewAll} style={{ padding: '0.8rem 2rem', fontSize: '1rem', borderRadius: '8px' }}>View All {title} ↗</button>
        </div>
      </div>
    </section>
  );
}
