import React from 'react';
import ProductCard from './ProductCard';
import './ProductGrid.css';

export default function ProductGrid({ title, products, personalized }) {
  return (
    <section className="product-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">
            {personalized && <span className="sparkle">✨</span>}
            {title}
          </h2>
          <button className="btn-view-all">View All ↗</button>
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
