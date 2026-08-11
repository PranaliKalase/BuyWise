import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ShoppingBag, CreditCard, Clock, PackageCheck, Star } from 'lucide-react';
import ReviewModal from './ReviewModal';
import './OrderHistory.css';

export default function OrderHistory({ userId, userEmail, session }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReviewItem, setSelectedReviewItem] = useState(null);
  const [selectedReviewOrder, setSelectedReviewOrder] = useState(null);
  const [selectedReviewEmail, setSelectedReviewEmail] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      let combinedOrders = [];

      // 1. Load LocalStorage Backup Orders (100% reliable & persistent across sessions)
      try {
        const localSaved = JSON.parse(localStorage.getItem('buywise_user_orders') || '[]');
        if (Array.isArray(localSaved)) {
          const filteredLocal = localSaved.filter(o => !userEmail || o.customer_email === userEmail || !o.customer_email);
          combinedOrders = [...filteredLocal];
        }
      } catch (err) {
        console.warn("Failed to load local orders:", err);
      }

      // 2. Fetch Supabase Orders
      try {
        let dbOrders = null;
        if (userId) {
          const { data } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
          if (data && data.length > 0) dbOrders = data;
        }

        if (!dbOrders && userEmail) {
          const { data } = await supabase.from('orders').select('*').eq('customer_email', userEmail).order('created_at', { ascending: false });
          if (data && data.length > 0) dbOrders = data;
        }

        if (!dbOrders) {
          const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
          if (data) {
            dbOrders = data.filter(o => o.user_id === userId || o.customer_email === userEmail);
          }
        }

        if (dbOrders && dbOrders.length > 0) {
          const existingIds = new Set(combinedOrders.map(o => o.order_id || o.id));
          dbOrders.forEach(o => {
            const key = o.order_id || o.id;
            if (key && !existingIds.has(key)) {
              combinedOrders.push(o);
              existingIds.add(key);
            }
          });
        }
      } catch (err) {
        console.warn('Order history Supabase fetch notice:', err);
      }

      // Sort by created_at descending
      combinedOrders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      setOrders(combinedOrders);
      setLoading(false);
    };

    fetchOrders();
  }, [userId, userEmail]);

  const handleOpenReview = (item, order) => {
    setSelectedReviewItem({
      id: item.product_id || item.id || 'p1',
      name: item.name,
      image: item.image,
      price: item.price
    });
    setSelectedReviewOrder(order.order_id || order.id || 'BW-ORDER');
    setSelectedReviewEmail(order.customer_email);
    setIsReviewModalOpen(true);
  };

  if (loading) {
    return (
      <div className="orders-loading">
        <Clock className="spin-icon" size={24} /> Loading your order history...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="orders-empty">
        <ShoppingBag size={48} color="#64748b" />
        <h3 style={{ margin: 0, color: 'var(--text-color, #1e293b)' }}>No Orders Found</h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted, #64748b)' }}>
          You haven't placed any orders yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="orders-history-container">
        {orders.map((order) => {
          const orderItems = order.items || order.cart_items || [];
          const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          const orderIdDisplay = order.order_id || (order.id ? `BW${order.id.slice(0, 6)}` : 'BW-ORDER');
          const finalPrice = order.final_amount || order.total_amount || 0;

          return (
            <div key={order.order_id || order.id} className="order-card">
              <div className="order-card-header">
                <div className="order-header-left">
                  <PackageCheck size={20} color="#6366f1" />
                  <div>
                    <div className="order-id-tag">Order #{orderIdDisplay}</div>
                    <div className="order-date-tag">{formattedDate}</div>
                  </div>
                </div>
                <div className="order-header-right">
                  <span className={`order-status-badge ${order.order_status?.toLowerCase() === 'confirmed' || order.status?.toLowerCase() === 'confirmed' ? 'confirmed' : 'processing'}`}>
                    {order.order_status || order.status || 'Confirmed'}
                  </span>
                </div>
              </div>

              <div className="order-card-body">
                <div className="order-items-list">
                  {Array.isArray(orderItems) && orderItems.map((item, idx) => (
                    <div key={idx} className="order-item-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '220px' }}>
                        {item.image && <img src={item.image} alt={item.name} className="order-item-img" />}
                        <div className="order-item-details">
                          <div 
                            className="order-item-name" 
                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => navigate(`/product/${item.product_id || item.id}`)}
                          >
                            {item.name}
                          </div>
                          <div className="order-item-meta">Qty: {item.qty || item.quantity || 1} × ₹{(item.price || 0).toFixed(2)}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="order-item-price">
                          ₹{((item.price || 0) * (item.qty || item.quantity || 1)).toFixed(2)}
                        </div>

                        <button 
                          className="btn" 
                          onClick={() => handleOpenReview(item, order)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.82rem',
                            background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: '#f59e0b', fontWeight: '600', cursor: 'pointer'
                          }}
                        >
                          <Star size={14} fill="#f59e0b" color="#f59e0b" /> Rate & Review
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="order-card-footer">
                <div className="order-payment-info">
                  <CreditCard size={16} /> Payment Method: <strong>{order.payment_method || 'Online Payment'}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Total Paid:</span>
                  <span className="order-total-amount">₹{finalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ReviewModal 
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        product={selectedReviewItem}
        orderId={selectedReviewOrder}
        orderEmail={selectedReviewEmail}
        session={session}
      />
    </>
  );
}
