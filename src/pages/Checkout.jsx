import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/Header';
import { CheckCircle, XCircle, ShoppingBag } from 'lucide-react';
import './Checkout.css';

export default function Checkout({ session }) {
  const navigate = useNavigate();
  const { cartItems, cartTotal, clearCart } = useCart();
  
  const [address, setAddress] = useState({ street: '', city: '', state: '', zip: '' });
  const [paymentType, setPaymentType] = useState('online');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mockSuccess, setMockSuccess] = useState(false);
  // 'idle' | 'success' | 'failed'
  const [orderStatus, setOrderStatus] = useState('idle');
  const [orderError, setOrderError] = useState('');
  const [savedTotal, setSavedTotal] = useState(0);

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
      const orderData = {
        retailer_id: cartItems[0]?.retailer_id || null,
        customer_name: session?.user?.user_metadata?.full_name || 'Guest User',
        customer_email: session?.user?.email || 'guest@example.com',
        total_amount: cartTotal,
        cart_items: cartItems,
        shipping_address: address,
        payment_method: paymentType,
        status: paymentType === 'online' ? 'Payment Successful' : 'Processing'
      };

      const { error } = await supabase.from('orders').insert([orderData]);
      if (error) throw error;

      setSavedTotal(cartTotal);
      clearCart();
      setOrderStatus('success');
    } catch (err) {
      console.error(err);
      setOrderError(err.message || "Unknown error. Have you run the updated SQL script?");
      setOrderStatus('failed');
    } finally {
      setIsProcessing(false);
      setMockSuccess(false);
    }
  };

  // ─── Order Confirmation / Failure Screen ───
  if (orderStatus === 'success') {
    return (
      <>
        <Header session={session} />
        <div className="checkout-container">
          <div className="order-result-card glass-panel" style={{
            maxWidth: '550px', margin: '4rem auto', padding: '3rem', textAlign: 'center'
          }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'
            }}>
              <CheckCircle size={40} color="#10b981" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Payment Successful!
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.5rem' }}>
              Your order has been placed and is now being processed. You will receive a confirmation at <strong>{session?.user?.email}</strong>.
            </p>

            <div style={{
              background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px',
              padding: '1.25rem', marginBottom: '2rem', textAlign: 'left'
            }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Order Details</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Payment Method</span>
                <strong>{paymentType === 'online' ? '💳 Online Payment' : '💵 Cash on Delivery'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Shipping To</span>
                <strong>{address.city}, {address.state} {address.zip}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Total Paid</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>₹{savedTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/')}
              className="btn btn-primary"
              style={{
                width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 600,
                borderRadius: '10px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '0.5rem'
              }}
            >
              <ShoppingBag size={18} /> Continue Shopping
            </button>
          </div>
        </div>
      </>
    );
  }

  if (orderStatus === 'failed') {
    return (
      <>
        <Header session={session} />
        <div className="checkout-container">
          <div className="order-result-card glass-panel" style={{
            maxWidth: '550px', margin: '4rem auto', padding: '3rem', textAlign: 'center'
          }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'
            }}>
              <XCircle size={40} color="#ef4444" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ef4444' }}>
              Payment Failed
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1rem' }}>
              We could not process your payment. Please try again.
            </p>
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px',
              padding: '0.75rem 1rem', marginBottom: '2rem', color: '#ef4444',
              fontSize: '0.85rem', textAlign: 'left'
            }}>
              <strong>Error:</strong> {orderError}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => { setOrderStatus('idle'); setOrderError(''); }}
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.9rem', fontSize: '1rem', fontWeight: 600, borderRadius: '10px' }}
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/')}
                className="btn"
                style={{
                  flex: 1, padding: '0.9rem', fontSize: '1rem', fontWeight: 600,
                  borderRadius: '10px', background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)', color: 'var(--text-main)'
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

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

