import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import Header from '../components/Header';
import '../pages/SearchPage.css'; // Inheriting styling for grid system

export default function FavoritesPage({ session }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { favorites, removeFromFavorites } = useFavorites();

  return (
    <div className="search-page-container">
      <Header session={session} onSearch={(q) => navigate(`/search.html?q=${encodeURIComponent(q)}`)} />
      
      <main className="search-main container">
        <div className="search-header-text">
          <h2>Your Favorites ❤️</h2>
          <span className="results-count">{favorites.length} items saved</span>
        </div>

        {favorites.length === 0 ? (
          <div className="search-empty">
            <span className="empty-icon">💔</span>
            <h3>No favorites yet</h3>
            <p>You haven't saved any items. Tap the ❤️ icon on products to save them for later!</p>
            <button className="btn-primary" onClick={() => navigate('/')} style={{marginTop: '1.5rem', padding: '0.8rem 2rem'}}>
              Browse Store
            </button>
          </div>
        ) : (
          <div className="search-results-grid">
            {favorites.map((product) => (
              <div key={product.id} className="search-product-card">
                <div className="card-image-wrapper">
                  <img src={product.image_url || product.image || 'https://via.placeholder.com/400?text=No+Image'} alt={product.name} loading="lazy" />
                  <button 
                    onClick={() => removeFromFavorites(product.id)}
                    style={{ position: 'absolute', top:'10px', right:'10px', background:'white', border:'none', borderRadius:'50%', width:'35px', height:'35px', cursor:'pointer', boxShadow:'0 2px 5px rgba(0,0,0,0.2)', fontSize:'1.2rem'}}
                    title="Remove from Favorites"
                  >
                    ❌
                  </button>
                </div>
                <div className="card-details">
                  <h3 className="card-title" title={product.name}>{product.name}</h3>
                  <div className="card-price">₹{parseFloat(product.price).toLocaleString('en-IN')}</div>
                  <div className="card-actions">
                    <button className="btn-primary" onClick={() => {
                       addToCart(product);
                       alert("Added to Cart!");
                    }}>
                      Move to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
