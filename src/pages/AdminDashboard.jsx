import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
  ShieldCheck, Users, PackageSearch, LayoutDashboard,
  Settings, LogOut, CheckCircle, XCircle, Search, User,
  ShoppingCart, Trash2, Brain, Plus, X, Zap, AlertTriangle
} from 'lucide-react';
import './RetailerDashboard.css';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function AdminDashboard({ session }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('customers');
  const [isAdmin, setIsAdmin] = useState(null);

  // Data State
  const [customers, setCustomers] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  // AI Product Management State
  const [bannedKeywords, setBannedKeywords] = useState(() => {
    const saved = localStorage.getItem('buywise_banned_keywords');
    return saved ? JSON.parse(saved) : ['illegal', 'counterfeit', 'fake', 'drugs', 'weapon'];
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [scanResults, setScanResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(null);

  // Helper to get retailer info
  const getRetailerEmail = (retailerId) => {
    const r = retailers.find(ret => ret.id === retailerId);
    return r?.email || retailerId?.substring(0, 8) + '...';
  };

  useEffect(() => {
    const fetchAdminData = async () => {
      if (!session) {
        navigate('/auth');
        return;
      }

      try {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();

        const role = userData?.role || session.user.user_metadata?.role;
        if (role !== 'admin') {
          navigate('/');
          return;
        }
        setIsAdmin(true);

        // Fetch Users
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (!usersError && usersData) {
          setCustomers(usersData.filter(u => u.role === 'customer'));
          setRetailers(usersData.filter(u => u.role === 'retailer'));
        }

        // Fetch Products
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*') // Simple fetch to avoid cross-schema join issues
          .order('created_at', { ascending: false });

        if (productsError) console.error("Products Fetch Error:", productsError);

        if (!productsError && productsData) {
          setAllProducts(productsData);
          setPendingProducts(productsData.filter(p => p.status === 'pending'));
        }

        // Fetch Orders
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (ordersError) console.error("Orders Fetch Error:", ordersError);
        if (!ordersError && ordersData) {
          setOrders(ordersData);
        }

        if (usersError) console.error("Users Fetch Error:", usersError);

      } catch (err) {
        console.error("Error fetching admin data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [session, navigate]);

  const handleModerate = async (productId, newStatus) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('id', productId);

      if (error) throw error;

      setPendingProducts(prev => prev.filter(p => p.id !== productId));
      setAllProducts(prev => prev.map(p => p.id === productId ? { ...p, status: newStatus } : p));
      alert(`Product ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully.`);
    } catch (err) {
      console.error(err);
      alert('Failed to moderate product.');
    }
  };

  const handleRemoveProduct = async (productId) => {
    if (!productId) {
      alert("CRITICAL ERROR: Product ID is missing. Cannot delete.");
      return;
    }

    console.log("Attempting to remove product with ID:", productId);

    if (!window.confirm(`ACTION REQUIRED: Are you sure you want to PERMANENTLY delete this product?\n(Product ID: ${productId})`)) return;

    try {
      // Use RPC to bypass client-side RLS hurdles permanently
      const { data, error } = await supabase.rpc('delete_product_as_admin', {
        target_product_id: productId
      });

      console.log("Delete RPC response data:", data);
      console.log("Delete RPC response error:", error);

      if (error) {
        console.error("Supabase RPC Error:", error);
        throw error;
      }

      if (data === true) {
        setPendingProducts(prev => prev.filter(p => p.id !== productId));
        setAllProducts(prev => prev.filter(p => p.id !== productId));
        alert('SUCCESS: Product deleted from database.');
      } else {
        throw new Error("The database returned FALSE. This usually means you are not recognized as an Admin in the public.users table.");
      }
    } catch (err) {
      console.error("Delete operation failed:", err);
      alert(`FAILED TO DELETE: ${err.message || 'Unknown database error'}\n\nPlease ensure you have run the latest SQL script in Supabase.`);
    }
  };

  // ─── AI Keyword Management ───
  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !bannedKeywords.includes(kw)) {
      const updated = [...bannedKeywords, kw];
      setBannedKeywords(updated);
      localStorage.setItem('buywise_banned_keywords', JSON.stringify(updated));
    }
    setNewKeyword('');
  };

  const removeKeyword = (kw) => {
    const updated = bannedKeywords.filter(k => k !== kw);
    setBannedKeywords(updated);
    localStorage.setItem('buywise_banned_keywords', JSON.stringify(updated));
  };

  const runAIScan = async () => {
    setIsScanning(true);
    setScanResults([]);

    // Fetch all products fresh
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('AI Scan fetch error:', error);
      setIsScanning(false);
      return;
    }

    const flagged = [];
    let rejectedCount = 0;

    for (const product of products) {
      const text = `${product.name || ''} ${product.description || ''} ${product.category || ''}`.toLowerCase();
      const matchedKeywords = bannedKeywords.filter(kw => text.includes(kw));

      if (matchedKeywords.length > 0) {
        flagged.push({ ...product, matchedKeywords });

        // Auto-reject if currently approved or pending
        if (product.status !== 'rejected') {
          const { error: updateError } = await supabase
            .from('products')
            .update({ status: 'rejected', ai_flagged: true })
            .eq('id', product.id);

          if (!updateError) rejectedCount++;
        }
      }
    }

    setScanResults(flagged);
    setLastScanTime(new Date().toLocaleTimeString());
    setIsScanning(false);

    // Refresh the products list
    setAllProducts(products.map(p => {
      const match = flagged.find(f => f.id === p.id);
      if (match && p.status !== 'rejected') return { ...p, status: 'rejected', ai_flagged: true };
      return p;
    }));
    setPendingProducts(prev => prev.filter(p => !flagged.find(f => f.id === p.id)));

    if (rejectedCount > 0) {
      alert(`AI Scan Complete: ${flagged.length} product(s) flagged, ${rejectedCount} auto-rejected.`);
    } else if (flagged.length > 0) {
      alert(`AI Scan Complete: ${flagged.length} product(s) flagged (already rejected).`);
    } else {
      alert('AI Scan Complete: No suspicious products found. Your catalog is clean! ✅');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (isAdmin !== true) return null;
  if (loading) return null;

  return (
    <div className="retailer-layout">
      {/* Sidebar */}
      <aside className="retailer-sidebar glass-panel">
        <div className="retailer-logo" style={{ color: '#ec4899' }}>
          <ShieldCheck size={28} />
          <span>Admin Portal</span>
        </div>

        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
            <Users size={20} /> Customer Mgt
          </button>
          <button className={`nav-item ${activeTab === 'retailers' ? 'active' : ''}`} onClick={() => setActiveTab('retailers')}>
            <User size={20} /> Retailer Mgt
          </button>
          <button className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
            <ShoppingCart size={20} /> Order Mgt
          </button>
          <button className={`nav-item ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
            <PackageSearch size={20} /> Product Mgt
            {pendingProducts.length > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '12px', fontSize: '0.7rem', marginLeft: 'auto' }}>
                {pendingProducts.length}
              </span>
            )}
          </button>
          <button className={`nav-item ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
            <Brain size={20} /> AI Product Mgt
          </button>
          <div style={{ flex: 1 }}></div>
          <button className="nav-item logout" onClick={handleSignOut} style={{ marginTop: 'auto' }}>
            <LogOut size={20} /> Log out
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="retailer-main">
        <header className="retailer-header">
          <h1>
            {activeTab === 'customers' && 'Customer Management'}
            {activeTab === 'retailers' && 'Retailer Management'}
            {activeTab === 'orders' && 'Order Management'}
            {activeTab === 'products' && 'Product Management & Moderation'}
            {activeTab === 'ai' && 'AI Product Management'}
          </h1>

        </header>

        {/* CUSTOMERS TAB */}
        {activeTab === 'customers' && (
          <div className="dashboard-content">
            <div className="dashboard-widget glass-panel">
              <div className="widget-title" style={{ marginBottom: '1.5rem' }}>
                <span>All Customers</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Count: {customers.length}</span>
              </div>
              <div className="products-table-wrapper">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Account ID</th>
                      <th>Email</th>
                      <th>Joined Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length > 0 ? customers.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{c.id?.substring(0, 8)}...</td>
                        <td style={{ fontSize: '0.85rem' }}>{c.email}</td>
                        <td>{new Date(c.created_at).toLocaleDateString()}</td>
                        <td><span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>Active</span></td>
                      </tr>
                    )) : <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No customers found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* RETAILERS TAB */}
        {activeTab === 'retailers' && (
          <div className="dashboard-content">
            <div className="dashboard-widget glass-panel">
              <div className="widget-title" style={{ marginBottom: '1.5rem' }}>
                <span>All Retailers</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Count: {retailers.length}</span>
              </div>
              <div className="products-table-wrapper">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Account ID</th>
                      <th>Email</th>
                      <th>Joined Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retailers.length > 0 ? retailers.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.id?.substring(0, 8)}...</td>
                        <td style={{ fontSize: '0.85rem' }}>{r.email}</td>
                        <td>{new Date(r.created_at).toLocaleDateString()}</td>
                        <td><span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>Active</span></td>
                      </tr>
                    )) : <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No retailers found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="dashboard-content">
            <div className="dashboard-widget glass-panel">
              <div className="widget-title" style={{ marginBottom: '1.5rem' }}>
                <span>Global Orders</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Orders: {orders.length}</span>
              </div>
              <div className="products-table-wrapper">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer Name</th>
                      <th>Total Amount</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length > 0 ? orders.map(o => (
                      <tr key={o.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{o.id.substring(0, 8)}...</td>
                        <td>{o.customer_name}</td>
                        <td>{formatCurrency(o.total_amount)}</td>
                        <td>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td>
                          <span style={{
                            background: (o.status === 'Payment Successful' || o.status === 'Delivered') ? 'rgba(16, 185, 129, 0.1)' :
                              o.status === 'Processing' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                            color: (o.status === 'Payment Successful' || o.status === 'Delivered') ? '#10b981' :
                              o.status === 'Processing' ? '#eab308' : '#94a3b8',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem'
                          }}>
                            {(o.status === 'Payment Successful' || o.status === 'Delivered') ? '✅ Payment Successful' : o.status}
                          </span>
                        </td>
                      </tr>
                    )) : <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No orders found in the system.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="dashboard-content">

            {/* Pending Queue Section */}
            {pendingProducts.length > 0 && (
              <div className="dashboard-widget glass-panel" style={{ marginBottom: '2rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div className="widget-title" style={{ marginBottom: '1.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                    <XCircle size={18} /> Action Required: Moderation Queue
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{pendingProducts.length} Pending</span>
                </div>

                <div className="products-table-wrapper">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Product Info</th>
                        <th>Category</th>
                        <th>Retailer</th>
                        <th>Price</th>
                        <th>AI Analysis</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingProducts.map(p => (
                        <tr key={p.id} style={{ borderLeft: p.ai_flagged ? '4px solid #ef4444' : '4px solid #eab308' }}>
                          <td>
                            <div className="product-cell">
                              <div className="p-image" style={{ padding: p.image && p.image.includes('http') ? '0' : '2px' }}>
                                {p.image && p.image.includes('http') ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} /> : '📦'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxWidth: '200px' }}>
                                <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</span>
                              </div>
                            </div>
                          </td>
                          <td>{p.category}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={p.retailer_id}>
                            {getRetailerEmail(p.retailer_id)}
                          </td>
                          <td>{formatCurrency(p.price)}</td>
                          <td>
                            {p.ai_flagged ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  ⚠️ Suspicious Item
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Confidence: {(p.ai_confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <CheckCircle size={14} /> Safe
                                </span>
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => handleModerate(p.id, 'approved')}
                                style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                title="Approve"
                              >
                                <CheckCircle size={16} /> Approve
                              </button>
                              <button
                                onClick={() => handleModerate(p.id, 'rejected')}
                                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                title="Reject"
                              >
                                <XCircle size={16} /> Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveProduct(p.id)}
                                className="admin-delete-btn"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid #ef4444',
                                  color: '#ef4444',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  position: 'relative',
                                  zIndex: 10
                                }}
                                title="Delete Product"
                              >
                                <Trash2 size={16} /> <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* All Products Section */}
            <div className="dashboard-widget glass-panel">
              <div className="widget-title" style={{ marginBottom: '1.5rem' }}>
                <span>All Assorted Products</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Catalog: {allProducts.length}</span>
              </div>

              <div className="products-table-wrapper">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Product Info</th>
                      <th>Category</th>
                      <th>Retailer</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allProducts.length > 0 ? allProducts.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div className="product-cell">
                            <div className="p-image" style={{ padding: p.image && p.image.includes('http') ? '0' : '2px' }}>
                              {p.image && p.image.includes('http') ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} /> : '📦'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxWidth: '200px' }}>
                              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                            </div>
                          </div>
                        </td>
                        <td>{p.category}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={p.retailer_id}>
                          {getRetailerEmail(p.retailer_id)}
                        </td>
                        <td>{formatCurrency(p.price)}</td>
                        <td>
                          <span style={{
                            background: p.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' :
                              p.status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                            color: p.status === 'approved' ? '#10b981' :
                              p.status === 'rejected' ? '#ef4444' : '#eab308',
                            padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', textTransform: 'capitalize'
                          }}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {p.status === 'approved' ? (
                            <button
                              type="button"
                              onClick={() => handleModerate(p.id, 'rejected')}
                              className="admin-delete-btn"
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid #ef4444',
                                color: '#ef4444',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                position: 'relative',
                                zIndex: 10
                              }}
                              title="Reject and Hide Product"
                            >
                              <XCircle size={16} /> <span>Reject</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleModerate(p.id, 'approved')}
                              style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid #10b981',
                                color: '#10b981',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                position: 'relative',
                                zIndex: 10
                              }}
                              title="Approve Product"
                            >
                              <CheckCircle size={16} /> <span>Approve</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )) : <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No products in the catalog.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* AI PRODUCT MANAGEMENT TAB */}
        {activeTab === 'ai' && (
          <div className="dashboard-content">
            {/* Keyword Manager */}
            <div className="dashboard-widget glass-panel">
              <div className="widget-title" style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Brain size={20} /> Banned Keywords
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{bannedKeywords.length} active</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Products containing these keywords in their name, description, or category will be automatically rejected during a scan.
              </p>

              {/* Add keyword input */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  placeholder="Enter a keyword (e.g., 'weapon', 'replica')..."
                  style={{
                    flex: 1, padding: '0.7rem 1rem', borderRadius: '8px',
                    border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
                    color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none'
                  }}
                />
                <button
                  onClick={addKeyword}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', border: 'none', borderRadius: '8px',
                    padding: '0.7rem 1.2rem', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: '0.3rem', fontWeight: 600, fontSize: '0.9rem'
                  }}
                >
                  <Plus size={16} /> Add
                </button>
              </div>

              {/* Keywords list */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {bannedKeywords.map(kw => (
                  <span key={kw} style={{
                    background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                    padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                  }}>
                    {kw}
                    <button onClick={() => removeKeyword(kw)} style={{
                      background: 'none', border: 'none', color: '#ef4444',
                      cursor: 'pointer', padding: '0', display: 'flex'
                    }}>
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Scan Button */}
            <div className="dashboard-widget glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
              <button
                onClick={runAIScan}
                disabled={isScanning}
                style={{
                  background: isScanning
                    ? 'rgba(148, 163, 184, 0.2)'
                    : 'linear-gradient(135deg, #6366f1, #ec4899)',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  padding: '1rem 2.5rem', cursor: isScanning ? 'not-allowed' : 'pointer',
                  fontSize: '1.1rem', fontWeight: 700, display: 'inline-flex',
                  alignItems: 'center', gap: '0.5rem',
                  boxShadow: isScanning ? 'none' : '0 4px 15px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                <Zap size={20} />
                {isScanning ? 'Scanning Products...' : 'Scan & Auto-Reject'}
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                {lastScanTime
                  ? `Last scan: ${lastScanTime} · ${scanResults.length} flagged`
                  : 'Click to scan all products against your banned keywords'}
              </p>
            </div>

            {/* Scan Results */}
            {scanResults.length > 0 && (
              <div className="dashboard-widget glass-panel">
                <div className="widget-title" style={{ marginBottom: '1rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                    <AlertTriangle size={20} /> Flagged Products ({scanResults.length})
                  </span>
                </div>
                <div className="products-table-wrapper">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Retailer</th>
                        <th>Matched Keywords</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanResults.map(p => (
                        <tr key={p.id}>
                          <td>
                            <div className="product-cell">
                              <div className="p-image" style={{ padding: p.image && p.image.includes('http') ? '0' : '2px' }}>
                                {p.image && p.image.includes('http')
                                  ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                                  : '📦'}
                              </div>
                              <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                            </div>
                          </td>
                          <td>{p.category}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {getRetailerEmail(p.retailer_id)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {p.matchedKeywords.map(kw => (
                                <span key={kw} style={{
                                  background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                                  padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem',
                                  fontWeight: 600
                                }}>
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <span style={{
                              background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                              padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem'
                            }}>
                              🚫 Rejected
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
