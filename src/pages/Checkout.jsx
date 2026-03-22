import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/Header';
import './Checkout.css';

export default function Checkout({ session }) {
  const navigate = useNavigate();
  const { cartItems, cartTotal, clearCart } = useCart();
  
  const [address, setAddress] = useState({ street: '', city: '', state: '', zip: '' });
  const [paymentType, setPaymentType] = useState('online');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mockSuccess, setMockSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    if (paymentType === 'online' && !mockSuccess) {
      setMockSuccess(true);
      return; // Stop here, show mock success message
    }

    setIsProcessing(true);
    try {
      // Create the order object securely
      const orderData = {
        retailer_id: cartItems[0]?.retailer_id || null, // Grabbing first item's retailer for now (mixed carts handled separately later)
        customer_name: session?.user?.user_metadata?.full_name || 'Guest User',
        customer_email: session?.user?.email || 'guest@example.com',
        total_amount: cartTotal,
        cart_items: cartItems,
        shipping_address: address,
        payment_method: paymentType,
        status: 'Processing'
      };

      const { error } = await supabase.from('orders').insert([orderData]);
      if (error) throw error;

      clearCart();
      alert("Order placed successfully!");
      navigate('/');
    } catch (err) {
      console.error(err);
      alert("Failed to place order: " + (err.message || "Unknown schema error. Have you run the updated SQL script?"));
    } finally {
      setIsProcessing(false);
      setMockSuccess(false);
    }
  };

  return (
    <>
      <Header session={session} />
      <div className="checkout-container">
        <h1 className="text-gradient" style={{ textAlign: 'center', margin: '2rem 0' }}>Complete Your Order</h1>
        
        <div className="checkout-grid">
          <div className="checkout-form-section glass-panel">
            <h2>Shipping Address</h2>
            <form id="checkout-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Street Address</label>
                <input type="text" value={address.street} onChange={e => setAddress({...address, street: e.target.value})} required placeholder="123 Main St" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input type="text" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} required placeholder="New York" />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input type="text" value={address.state} onChange={e => setAddress({...address, state: e.target.value})} required placeholder="NY" />
                </div>
              </div>
              <div className="form-group" style={{maxWidth: '200px'}}>
                <label>ZIP Code</label>
                <input type="text" value={address.zip} onChange={e => setAddress({...address, zip: e.target.value})} required placeholder="10001" />
              </div>

              <h2 style={{marginTop: '2rem'}}>Payment Method</h2>
              <div className="payment-options">
                <label className={`payment-card ${paymentType === 'online' ? 'selected' : ''}`}>
                  <input type="radio" name="payment" value="online" checked={paymentType === 'online'} onChange={() => { setPaymentType('online'); setMockSuccess(false); }} />
                  <span>Online Payment (Bank/UPI)</span>
                </label>
                <label className={`payment-card ${paymentType === 'cod' ? 'selected' : ''}`}>
                  <input type="radio" name="payment" value="cod" checked={paymentType === 'cod'} onChange={() => { setPaymentType('cod'); setMockSuccess(false); }} />
                  <span>Cash on Delivery</span>
                </label>
              </div>

              {mockSuccess && paymentType === 'online' && (
                <div className="mock-success">
                  ✅ Online Payment Done Successfully!
                  <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem'}}>Click "Place Order Here" below to finalize.</p>
                </div>
              )}
            </form>
          </div>

          <div className="checkout-summary-section glass-panel">
            <h2>Order Summary</h2>
            <div className="summary-items">
              {cartItems.map(item => (
                <div key={item.id} className="summary-item">
                  <img src={item.image} alt={item.name} />
                  <div className="item-info">
                    <h4>{item.name}</h4>
                    <span>Qty: {item.quantity}</span>
                  </div>
                  <div className="item-price">₹{(item.price * item.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>
            
            <div className="summary-totals">
              <div className="total-row">
                <span>Subtotal</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="total-row final">
                <span>Total</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <button type="submit" form="checkout-form" disabled={isProcessing} className="btn btn-primary place-order-btn">
              {isProcessing ? 'Processing...' : (paymentType === 'online' && !mockSuccess ? 'Pay Securely' : 'Place Order Here')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
