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
          <button className="btn-view-all" onClick={handleViewAll}>View All ↗</button>
        </div>
        
        <div className="product-grid">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
