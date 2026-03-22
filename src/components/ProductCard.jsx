import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import './ProductCard.css';
import PriceComparisonModal from './PriceComparisonModal';

export default function ProductCard({ product }) {
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const { addToCart, setIsCartOpen } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();

  const handleAddToCart = () => {
    addToCart(product);
    setIsCartOpen(true);
  };

  return (
    <>
      <div className="product-card glass-panel">
        
        {/* AI Match Badge */}
        {product.matchScore && (
          <div className="match-badge">
            ✨ {product.matchScore}% Match
          </div>
        )}

        <div className="card-image-wrapper">
          <img src={product.image} alt={product.name} className="card-image" />
          
          {/* Hover Actions */}
          <div className="card-overlay">
            <button 
              className="action-btn icon-btn" 
              title={isFavorite(product.id) ? "Remove from Favorites" : "Add to Favorites"}
              onClick={() => toggleFavorite(product)}
              style={{ background: isFavorite(product.id) ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)' }}
            >
              {isFavorite(product.id) ? '❤️' : '🤍'}
            </button>
            <button className="action-btn icon-btn" title="View Similar">🔍</button>
          </div>
          
          {product.in_stock === false && (
            <div className="out-of-stock-overlay">
              <span>Out of Stock</span>
            </div>
          )}
        </div>

        <div className="card-content">
          <p className="category text-gradient">{product.category}</p>
          <h3 className="product-name">{product.name}</h3>
          <p className="product-desc">{product.description}</p>
          
          <div className="card-footer">
            <span className="price">₹{product.price.toFixed(2)}</span>
            <div className="rating">
               ⭐ {product.rating} <span className="reviews">({product.reviews})</span>
            </div>
          </div>

          <button 
            className="btn btn-add-cart" 
            onClick={handleAddToCart}
            disabled={product.in_stock === false}
          >
            {product.in_stock === false ? 'Out of Stock' : 'Add to Cart'}
          </button>
          <button 
            className="btn btn-secondary ai-analysis-btn" 
            onClick={() => setIsCompareOpen(true)}
            style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.9rem', padding: '0.5rem' }}
          >
            ⚖️ AI Price Analysis
          </button>
        </div>
      </div>
      
      <PriceComparisonModal 
        product={product} 
        isOpen={isCompareOpen} 
        onClose={() => setIsCompareOpen(false)} 
      />
    </>
  );
}
