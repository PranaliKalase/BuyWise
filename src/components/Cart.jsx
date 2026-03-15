import React from 'react';
import { useCart } from '../context/CartContext';
import { ShoppingCart, X, Plus, Minus, Trash2 } from 'lucide-react';
import './Cart.css'; // We'll create this next

export default function Cart() {
  const { cartItems, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, cartTotal } = useCart();

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
            cartItems.map((item) => (
              <div key={item.id} className="cart-item">
                <img src={item.image} alt={item.name} className="cart-item-img" />
                
                <div className="cart-item-details">
                  <h4>{item.name}</h4>
                  <p className="cart-item-price">₹{item.price.toFixed(2)}</p>
                  
                  <div className="cart-item-controls">
                    <div className="quantity-controls">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus size={14}/></button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus size={14}/></button>
                    </div>
                    
                    <button className="remove-btn" onClick={() => removeFromCart(item.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>Subtotal</span>
              <span className="total-amount">₹{cartTotal.toFixed(2)}</span>
            </div>
            <p className="shipping-note">Shipping and taxes calculated at checkout.</p>
            <button className="btn btn-primary checkout-btn">
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
