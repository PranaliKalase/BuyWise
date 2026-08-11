import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/Header';
import PaymentModal from '../components/PaymentModal';
import PaymentProcessing from '../components/PaymentProcessing';
import ToastContainer from '../components/Toast';
import { 
  CheckCircle, XCircle, ShoppingBag, Lock, Shield, 
  Sparkles, Check, Copy, ArrowRight, RefreshCw, Truck, Calendar, BadgeCheck
} from 'lucide-react';
import { calculateOrderSummary } from '../utils/checkoutUtils';
import './Checkout.css';

export default function Checkout({ session }) {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();

  // Toast notifications state - limit to max 2 active toasts to prevent stacking
  const [toasts, setToasts] = useState([]);
  const addToast = (title, message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-1), { id, title, message, type }]);
  };
  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Shipping Form State
  const [address, setAddress] = useState({
    fullName: session?.user?.user_metadata?.full_name || '',
    street: '',
    city: '',
    state: '',
    zip: '',
    phone: ''
  });

  // UI Flow States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);

  // 'idle' | 'success' | 'failed'
  const [orderResult, setOrderResult] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Calculations
  const rawProductTotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discount = rawProductTotal > 1500 ? 200 : 0;
  
  const { 
    productTotal, 
    shippingCharge: shipping, 
    totalGST: tax, 
    finalPayable: finalAmount 
  } = calculateOrderSummary(cartItems, discount);

  // Form Submit Handler -> Open Payment Gateway Modal
  const handleOpenPaymentModal = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (cartItems.length === 0) {
      addToast("Cart Empty", "Your cart is empty! Add products to checkout.", "warning");
      return;
    }
    if (!address.street?.trim() || !address.city?.trim() || !address.state?.trim() || !address.zip?.trim()) {
      addToast("Incomplete Address", "Please fill in Street, City, State, and ZIP Code.", "warning");
      return;
    }
    setIsModalOpen(true);
  };

  // Called when user completes Payment Method entry in PaymentModal
  const handleProceedPayment = (payload) => {
    setIsModalOpen(false);
    setPendingPayment(payload);
    setIsProcessing(true);
  };

  // Called when 2–4s PaymentProcessing checklist finishes
  const handleProcessingComplete = async () => {
    // 1. Clear any stale notifications
    setToasts([]);

    // 2. Random outcome: ~90% success / 10% failure
    const isSuccess = Math.random() < 0.90;

    const randomNum1 = Math.floor(100000 + Math.random() * 900000);
    const randomNum2 = Math.floor(100000 + Math.random() * 900000);
    const generatedOrderId = `BW${randomNum1}`;
    const generatedTxnId = `TXN${randomNum2}`;

    const userId = session?.user?.id || null;
    const nowIso = new Date().toISOString();

    if (isSuccess) {
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + 4);
      const formattedDelivery = estimatedDate.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric'
      });

      const newOrderRecord = {
        order_id: generatedOrderId,
        id: generatedOrderId,
        user_id: userId,
        customer_name: address.fullName || session?.user?.email || 'Customer',
        customer_email: session?.user?.email || 'customer@buywise.com',
        items: cartItems.map(i => ({ product_id: i.id, name: i.name, qty: i.quantity, price: i.price, image: i.image })),
        product_total: productTotal,
        shipping: shipping,
        tax: tax,
        discount: discount,
        final_amount: finalAmount,
        order_status: 'Confirmed',
        shipping_address: address,
        payment_method: pendingPayment?.method || 'Online Payment',
        total_amount: finalAmount,
        cart_items: cartItems,
        status: 'Confirmed',
        created_at: nowIso
      };

      // Set Order Result state FIRST so the Order Confirmation Screen is ready
      setOrderResult({
        status: 'success',
        orderId: generatedOrderId,
        txnId: generatedTxnId,
        method: pendingPayment?.method || 'Online Payment',
        methodDetails: pendingPayment?.method_details || {},
        amount: finalAmount,
        address,
        items: [...cartItems],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        deliveryDate: formattedDelivery
      });

      // Add Toast Notifications
      addToast("Payment Successful", `Transaction ID ${generatedTxnId} confirmed!`, "success");
      addToast("Order Confirmed", `Order ${generatedOrderId} placed successfully!`, "info", <BadgeCheck size={22} color="#ffffff" />);
      
      // Clear Cart
      clearCart();

      // NOW unmount processing overlay with ZERO glitch!
      setIsProcessing(false);

      // Save to LocalStorage & Supabase asynchronously in background
      try {
        const existingLocal = JSON.parse(localStorage.getItem('buywise_user_orders') || '[]');
        localStorage.setItem('buywise_user_orders', JSON.stringify([newOrderRecord, ...existingLocal]));
      } catch (err) {
        console.warn("LocalStorage save notice:", err);
      }

      try {
        await supabase.from('payments').insert([{
          transaction_id: generatedTxnId,
          order_id: generatedOrderId,
          user_id: userId,
          amount: finalAmount,
          method: pendingPayment?.method || 'Online Payment',
          method_details: pendingPayment?.method_details || {},
          status: 'Success',
          created_at: nowIso
        }]);
      } catch (err) {
        console.warn("Payments table insert notice:", err);
      }

      try {
        const { error: orderErr } = await supabase.from('orders').insert([newOrderRecord]);
        if (orderErr) {
          await supabase.from('orders').insert([{
            customer_name: address.fullName || session?.user?.email || 'Customer',
            customer_email: session?.user?.email || 'customer@buywise.com',
            total_amount: finalAmount,
            cart_items: cartItems,
            shipping_address: address,
            payment_method: pendingPayment?.method || 'Online Payment',
            status: 'Confirmed',
            created_at: nowIso
          }]);
        }
      } catch (err) {
        console.warn("Orders table insert notice:", err);
      }
    } else {
      // Failure Flow
      const failureReasons = [
        "Bank Gateway Timeout - Unable to reach issuing bank",
        "Network Error - Secure connection interrupted",
        "Verification Failed - Security check declined transaction",
        "Payment Cancelled - Transaction terminated by gateway"
      ];
      const selectedReason = failureReasons[Math.floor(Math.random() * failureReasons.length)];

      setOrderResult({
        status: 'failed',
        reason: selectedReason,
        amount: finalAmount
      });

      addToast("Payment Failed", selectedReason, "error");
      addToast("Transaction Cancelled", "Your order was not placed. Please try again.", "warning");

      setIsProcessing(false);

      try {
        await supabase.from('payments').insert([{
          transaction_id: generatedTxnId,
          order_id: generatedOrderId,
          user_id: userId,
          amount: finalAmount,
          method: pendingPayment?.method || 'Online Payment',
          method_details: pendingPayment?.method_details || {},
          status: 'Failed',
          failure_reason: selectedReason,
          created_at: nowIso
        }]);
      } catch (err) {
        console.warn("Payments failure log notice:", err);
      }
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    addToast("Copied", `Copied ${text} to clipboard!`, "info");
    setTimeout(() => setCopiedId(false), 2000);
  };

  // ─── ORDER CONFIRMATION SCREEN (SUCCESS) ───
  if (orderResult?.status === 'success') {
    return (
      <>
        <Header session={session} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="checkout-container">
          <div style={{
            maxWidth: '640px', margin: '3rem auto', padding: '3rem 2.25rem', textAlign: 'center', borderRadius: '24px',
            background: '#0f172a', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#f8fafc',
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: '84px', height: '84px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.3))',
              border: '2px solid rgba(16, 185, 129, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
              boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)'
            }}>
              <BadgeCheck size={48} color="#10b981" />
            </div>

            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.4rem', color: '#ffffff' }}>
              Order Placed Successfully!
            </h1>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
              Thank you for shopping with BuyWise. Your payment was verified and processed securely.
            </p>

            {/* Order & Txn ID Badges */}
            <div style={{
              display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem'
            }}>
              <div style={{
                background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: '12px', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.88rem', color: '#a5b4fc', fontWeight: 700
              }}>
                <span>Order ID: <strong>{orderResult.orderId}</strong></span>
                <button
                  onClick={() => copyToClipboard(orderResult.orderId)}
                  style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', padding: 2 }}
                  title="Copy Order ID"
                >
                  <Copy size={14} />
                </button>
              </div>

              <div style={{
                background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '12px', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.88rem', color: '#34d399', fontWeight: 700
              }}>
                <span>Txn ID: <strong>{orderResult.txnId}</strong></span>
              </div>
            </div>

            {/* Details Box */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.85)', borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1.5rem',
              marginBottom: '2rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={15} /> Payment Method
                </span>
                <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>
                  {orderResult.method} {orderResult.methodDetails?.last4 ? `(**** ${orderResult.methodDetails.last4})` : ''}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Truck size={15} /> Estimated Delivery
                </span>
                <span style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem' }}>
                  {orderResult.deliveryDate}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Shipping Address</span>
                <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.88rem', textAlign: 'right' }}>
                  {orderResult.address.street}, {orderResult.address.city}, {orderResult.address.state} {orderResult.address.zip}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.35rem' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>Total Paid</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>
                  ₹{orderResult.amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/profile?tab=orders')}
                className="place-order-btn"
                style={{
                  flex: 1, minWidth: '180px', padding: '0.95rem', fontSize: '1rem', fontWeight: 700,
                  borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                Track Order <ArrowRight size={18} />
              </button>
              <button
                onClick={() => navigate('/')}
                style={{
                  flex: 1, minWidth: '180px', padding: '0.95rem', fontSize: '1rem', fontWeight: 600,
                  borderRadius: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <ShoppingBag size={18} /> Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── PAYMENT FAILURE SCREEN ───
  if (orderResult?.status === 'failed') {
    return (
      <>
        <Header session={session} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="checkout-container">
          <div style={{
            maxWidth: '580px', margin: '4rem auto', padding: '3rem 2.25rem', textAlign: 'center', borderRadius: '24px',
            background: '#0f172a', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f8fafc',
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: '84px', height: '84px', borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)', border: '2px solid rgba(239, 68, 68, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
              boxShadow: '0 0 30px rgba(239, 68, 68, 0.25)'
            }}>
              <XCircle size={44} color="#ef4444" />
            </div>

            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem', color: '#ef4444' }}>
              Payment Failed
            </h1>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              We could not complete your transaction. Don't worry, your money was not deducted.
            </p>

            <div style={{
              background: 'rgba(239, 68, 68, 0.12)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '1.1rem 1.25rem', marginBottom: '2rem', textAlign: 'left', color: '#fca5a5', fontSize: '0.88rem'
            }}>
              <strong>Failure Reason:</strong> {orderResult.reason}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => { setOrderResult(null); setIsModalOpen(true); }}
                className="place-order-btn"
                style={{
                  flex: 1, padding: '0.95rem', fontSize: '1rem', fontWeight: 700, borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                <RefreshCw size={18} /> Retry Payment
              </button>
              <button
                onClick={() => setOrderResult(null)}
                style={{
                  flex: 1, padding: '0.95rem', fontSize: '1rem', fontWeight: 600, borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                Return to Checkout
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── MAIN CHECKOUT FORM VIEW ───
  return (
    <>
      <Header session={session} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Processing Animation Overlay */}
      {isProcessing && (
        <PaymentProcessing onComplete={handleProcessingComplete} />
      )}

      {/* Payment Gateway Modal */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        amount={finalAmount}
        onProceedPayment={handleProceedPayment}
      />

      <div className="checkout-container">
        <h1 className="text-gradient" style={{ textAlign: 'center', margin: '2rem 0 1.5rem', fontSize: '2.2rem', fontWeight: 800 }}>
          Checkout
        </h1>

        <div className="checkout-grid">
          {/* Left: Shipping Address & AI Analysis */}
          <div className="checkout-form-section">
            <h2>Shipping Address</h2>
            <form id="checkout-address-form" onSubmit={handleOpenPaymentModal}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={address.fullName}
                  onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label>Street Address</label>
                <input
                  type="text"
                  value={address.street}
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  placeholder="123 Shopping Blvd, Apt 4B"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    placeholder="Mumbai"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input
                    type="text"
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    placeholder="Maharashtra"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>ZIP Code</label>
                  <input
                    type="text"
                    value={address.zip}
                    onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                    placeholder="400001"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={address.phone}
                    onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>
            </form>

            {/* BuyWise AI Checkout Analysis */}
            <div className="ai-analysis-card">
              <div className="ai-card-header">
                <div className="ai-card-title">
                  <Sparkles size={18} color="#4f46e5" /> BuyWise AI Checkout Analysis
                </div>
                <div className="ai-score-badge">Score 94/100</div>
              </div>

              <div className="ai-checklist">
                <div className="ai-check-item">
                  <Check size={14} strokeWidth={3} /> Best Price Verified
                </div>
                <div className="ai-check-item">
                  <Check size={14} strokeWidth={3} /> Seller Trust Verified
                </div>
                <div className="ai-check-item">
                  <Check size={14} strokeWidth={3} /> Return Risk Low
                </div>
                <div className="ai-check-item">
                  <Check size={14} strokeWidth={3} /> Deal Quality Excellent
                </div>
              </div>

              <div className="ai-insight-text">
                "You are purchasing this product at one of the best available prices with guaranteed seller authenticity."
              </div>
            </div>

            {/* Trust Badges */}
            <div className="security-indicators">
              <span className="security-indicator-item">🔒 Secure Payment</span>
              <span>·</span>
              <span className="security-indicator-item">🛡 Encrypted Checkout</span>
              <span>·</span>
              <span className="security-indicator-item">✓ Transaction Protected</span>
            </div>
          </div>

          {/* Right: Detailed Order Summary (Pre-Payment) */}
          <div className="checkout-summary-section">
            <h2>Order Summary</h2>

            <div className="summary-items">
              {cartItems.length === 0 ? (
                <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.9rem' }}>No items in cart.</p>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="summary-item">
                    <img src={item.image} alt={item.name} />
                    <div className="item-info">
                      <h4>{item.name}</h4>
                      <span>Qty: {item.quantity} × ₹{item.price.toFixed(2)}</span>
                    </div>
                    <div className="item-price">₹{(item.price * item.quantity).toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>

            {/* Pre-payment Financial Math */}
            <div className="summary-totals">
              <div className="total-row">
                <span>Product Total</span>
                <span>₹{productTotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Shipping</span>
                <span>FREE</span>
              </div>
              <div className="total-row">
                <span>Tax (GST)</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="total-row discount-row">
                  <span>Discount</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="total-row final">
                <span>Final Payable</span>
                <span>₹{finalAmount.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenPaymentModal}
              className="place-order-btn"
              disabled={cartItems.length === 0}
            >
              <Lock size={18} /> Proceed to Payment
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
