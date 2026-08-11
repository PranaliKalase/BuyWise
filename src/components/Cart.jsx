import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { ShoppingCart, X, Plus, Minus, Check } from 'lucide-react';
import './Cart.css';

export default function Cart() {
  const navigate = useNavigate();
  const { cartItems, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, cartTotal } = useCart();
  
  const [unselectedIds, setUnselectedIds] = useState(new Set());

  const toggleSelection = (id) => {
    setUnselectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const selectedTotal = cartItems
    .filter(item => !unselectedIds.has(item.id))
    .reduce((total, item) => total + (item.price * item.quantity), 0);

  if (!isCartOpen) return null;

  return (
    <>
      {/* Overlay to dim background */}
      <div className="cart-overlay" onClick={() => setIsCartOpen(false)} />
      
      {/* Sliding Panel */}
      <div className={`cart-panel glass-panel ${isCartOpen ? 'open' : ''}`}>
        <div className="cart-header">
          <div className="cart-title">
            <ShoppingCart className="cart-icon-title" />
            <h2>Your Cart</h2>
          </div>
          <button className="icon-btn close-cart" onClick={() => setIsCartOpen(false)}>
            <X />
          </button>
        </div>

        <div className="cart-items-container">
          {cartItems.length === 0 ? (
            <div className="empty-cart">
              <p>Your cart is empty.</p>
              <button className="btn btn-secondary" onClick={() => setIsCartOpen(false)}>
                Continue Shopping
              </button>
            </div>
          ) : (
            cartItems.map((item) => {
              const isSelected = !unselectedIds.has(item.id);
              return (
                <div 
                  key={item.id} 
                  className={`cart-item-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleSelection(item.id)}
                >
                  <div className="cart-item-left">
                    <div className={`cart-checkbox ${isSelected ? 'checked' : ''}`}>
                      {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                    </div>
                    <img src={item.image} alt={item.name} className="cart-item-img" />
                  </div>
                  
                  <div className="cart-item-right">
                    <div className="cart-item-header">
                      <h4 className="cart-item-title" title={item.name}>{item.name}</h4>
                      <button 
                        className="cart-item-remove" 
                        onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                        title="Remove item"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="cart-item-price-row">
                      <span className="cart-item-price">₹{item.price.toFixed(2)}</span>
                    </div>
                    
                    <div className="cart-item-footer">
                      <div className="quantity-controls" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus size={14}/></button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus size={14}/></button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>Subtotal</span>
              <span className="total-amount">₹{selectedTotal.toFixed(2)}</span>
            </div>
            <p className="shipping-note">Shipping and taxes calculated at checkout.</p>
            <button className="btn btn-primary checkout-btn" onClick={() => {
              setIsCartOpen(false);
              navigate('/checkout');
            }}>
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
