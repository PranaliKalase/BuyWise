import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  LayoutDashboard, Package, Tag, Users, ShoppingCart, 
  PieChart, Settings, LogOut, Search, Bell, MoreHorizontal,
  ArrowUpRight, ArrowDownRight, Filter, User
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';
import ManageProducts from './ManageProducts';
import './RetailerDashboard.css';

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function RetailerDashboard({ session }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isRetailer, setIsRetailer] = useState(null);
  
  // Real DB State
  const [ordersList, setOrdersList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [allProductsList, setAllProductsList] = useState([]);
  const [flashSales, setFlashSales] = useState([]);
  const [flashForm, setFlashForm] = useState({ title: '', description: '', product_id: '', discount_percentage: '', image_url: '', valid_until: '' });
  const [creatingFlash, setCreatingFlash] = useState(false);
  const [editingFlashId, setEditingFlashId] = useState(null);

  // Settings State
  const [profileData, setProfileData] = useState({
    fullName: session?.user?.user_metadata?.full_name || '',
    company: session?.user?.user_metadata?.company || '',
    phone: session?.user?.user_metadata?.phone || '',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSucc, setSettingsSucc] = useState('');

  // Dashboard State
  const [metrics, setMetrics] = useState({
    sales: 0,
    orders: 0,
    revenue: 0,
    customers: 0,
  });
  const [revenueData, setRevenueData] = useState([]);
  const [salesByLocation, setSalesByLocation] = useState([]);
  const [totalSalesData, setTotalSalesData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!session) {
        navigate('/auth');
        return;
      }

      try {
        // Verify role before fetching anything else
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
          
        const role = userData?.role || session.user.user_metadata?.role;
        if (role !== 'retailer') {
          navigate('/');
          return;
        }
        setIsRetailer(true);

        // Fetch products owned by this retailer
        const { data: products, error } = await supabase
          .from('products')
          .select('*')
          .eq('retailer_id', session.user.id);

        if (error) throw error;

        if (products && products.length > 0) {
          // Calculate Metrics (using reviews as a proxy for sales quantity since we don't have an orders table)
          let totalSales = 0;
          let totalRevenue = 0;
          
          products.forEach(p => {
            const salesQty = p.reviews || 0; // estimate sales based on review count
            totalSales += salesQty;
            totalRevenue += (salesQty * p.price);
          });

          setMetrics({
            sales: totalSales,
            orders: Math.floor(totalSales * 0.95), // Assume 1.05 items per order
            revenue: totalRevenue,
            customers: Math.floor(totalSales * 0.8), // Assume some repeat customers
          });

          // Top Selling Products
          const sortedProducts = [...products].sort((a, b) => (b.reviews || 0) - (a.reviews || 0)).slice(0, 6);
          setTopProducts(sortedProducts.map(p => ({
            id: p.id,
            name: p.name,
            image: p.image && p.image.startsWith('http') ? <img src={p.image} alt={p.name} style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'4px'}}/> : '🛍️',
            price: p.price,
            category: p.category,
            qty: p.reviews || 0,
            amount: (p.reviews || 0) * p.price
          })));
          setAllProductsList(products);
          // Generate synthetic chart data matching the real totals
          const monthlyRev = totalRevenue / 6;
          setRevenueData([
            { name: 'Jan', currentWeek: monthlyRev * 0.8, previousWeek: monthlyRev * 0.7 },
            { name: 'Feb', currentWeek: monthlyRev * 0.9, previousWeek: monthlyRev * 1.1 },
            { name: 'Mar', currentWeek: monthlyRev * 1.2, previousWeek: monthlyRev * 0.9 },
            { name: 'Apr', currentWeek: monthlyRev * 1.5, previousWeek: monthlyRev * 1.2 },
            { name: 'May', currentWeek: monthlyRev * 1.1, previousWeek: monthlyRev * 1.3 },
            { name: 'Jun', currentWeek: monthlyRev * 1.4, previousWeek: monthlyRev * 1.1 },
          ]);

          const totalS = totalSales > 0 ? totalSales : 100; // prevent div by zero
          setSalesByLocation([
            { city: 'New York', value: Math.floor(totalS * 0.35), percentage: 35, color: '#6366f1' },
            { city: 'San Francisco', value: Math.floor(totalS * 0.25), percentage: 25, color: '#ec4899' },
            { city: 'Sydney', value: Math.floor(totalS * 0.15), percentage: 15, color: '#f59e0b' },
            { city: 'Singapore', value: Math.floor(totalS * 0.25), percentage: 25, color: '#10b981' },
          ]);

          setTotalSalesData([
            { name: 'Direct', value: totalRevenue * 0.45, color: '#6366f1' },
            { name: 'Affiliate', value: totalRevenue * 0.25, color: '#10b981' },
            { name: 'Sponsored', value: totalRevenue * 0.20, color: '#8b5cf6' },
            { name: 'E-mail', value: totalRevenue * 0.10, color: '#ec4899' },
          ]);

        } else {
          // Fallbacks for zero products
          setRevenueData([{ name: 'Jan', currentWeek: 0, previousWeek: 0 }]);
          setSalesByLocation([]);
          setTopProducts([]);
        }

        // Fetch Real Orders
        const { data: dbOrders, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('retailer_id', session.user.id)
          .order('created_at', { ascending: false });

        if (!ordersError && dbOrders) {
          setOrdersList(dbOrders);
          
          // Derive Customers List by grouping orders by email
          const customerMap = {};
          dbOrders.forEach(o => {
            const email = o.customer_email || 'unknown';
            if (!customerMap[email]) {
              customerMap[email] = {
                name: o.customer_name || 'Unknown Customer',
                email: email,
                orders: 0,
                spent: 0,
                active: o.created_at
              };
            }
            customerMap[email].orders += 1;
            customerMap[email].spent += Number(o.total_amount) || 0;
            if (new Date(o.created_at) > new Date(customerMap[email].active)) {
              customerMap[email].active = o.created_at;
            }
          });
          setCustomersList(Object.values(customerMap));
        }

        // Fetch Real Flash Sales
        const { data: dbFlash, error: flashError } = await supabase
          .from('flash_sales')
          .select('*')
          .eq('retailer_id', session.user.id)
          .order('created_at', { ascending: false });
        
        if (!flashError && dbFlash) {
          setFlashSales(dbFlash);
        }

      } catch (err) {
        console.error("Error fetching dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [session]);

  const handleCreateFlashSale = async (e) => {
    e.preventDefault();
    setCreatingFlash(true);
    try {
      const eventData = {
        retailer_id: session.user.id,
        title: flashForm.title,
        description: flashForm.description,
        product_id: flashForm.product_id || null,
        discount_percentage: Number(flashForm.discount_percentage) || 0,
        image_url: flashForm.image_url,
        valid_until: flashForm.valid_until ? new Date(flashForm.valid_until).toISOString() : null
      };

      if (editingFlashId) {
        const { data, error } = await supabase
          .from('flash_sales')
          .update(eventData)
          .eq('id', editingFlashId)
          .select();
        if (error) throw error;
        setFlashSales(flashSales.map(f => f.id === editingFlashId ? data[0] : f));
        alert("Flash Sale event successfully updated!");
      } else {
        const { data, error } = await supabase
          .from('flash_sales')
          .insert([eventData])
          .select();
        if (error) throw error;
        if (data) setFlashSales([data[0], ...flashSales]);
        alert("Flash Sale event successfully published!");
      }

      setFlashForm({ title: '', description: '', product_id: '', discount_percentage: '', image_url: '', valid_until: '' });
      setEditingFlashId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save Flash Sale Event. Please make sure the table exists.");
    } finally {
      setCreatingFlash(false);
    }
  };

  const handleEditFlash = (event) => {
    setFlashForm({
      title: event.title,
      description: event.description || '',
      product_id: event.product_id || '',
      discount_percentage: event.discount_percentage || '',
      image_url: event.image_url || '',
      valid_until: event.valid_until ? event.valid_until.split('T')[0] : ''
    });
    setEditingFlashId(event.id);
  };

  const handleCancelEditFlash = () => {
    setFlashForm({ title: '', description: '', product_id: '', discount_percentage: '', image_url: '', valid_until: '' });
    setEditingFlashId(null);
  };

  const handleDeleteFlash = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      const { error } = await supabase.from('flash_sales').delete().eq('id', id);
      if (error) throw error;
      setFlashSales(flashSales.filter(f => f.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete event.");
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSucc('');
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.fullName,
          company: profileData.company,
          phone: profileData.phone
        }
      });
      if (error) throw error;
      setSettingsSucc('Profile updated successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (isRetailer !== true) return null;
  if (loading) return null;

  return (
    <div className="retailer-layout">
      {/* Sidebar */}
      <aside className="retailer-sidebar glass-panel">
        <div className="retailer-logo">
          <span className="logo-icon">♾️</span>
          <span>BuyWise</span>
        </div>

        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button className={`nav-item ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
            <Package size={20} /> Products
          </button>
          <button className={`nav-item ${activeTab === 'flash' ? 'active' : ''}`} onClick={() => setActiveTab('flash')}>
            <Tag size={20} /> Flash Sales
          </button>
          <button className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
            <Users size={20} /> Customers
          </button>
          <button className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
            <ShoppingCart size={20} /> Order List
          </button>
          <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings size={20} /> Settings
          </button>
          
          <button className="nav-item logout" onClick={handleSignOut}>
            <LogOut size={20} /> Log out
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="retailer-main">
        <header className="retailer-header">
          <h1>
            {activeTab === 'dashboard' && 'Report Analysis'}
            {activeTab === 'products' && 'Manage Inventory'}
            {activeTab === 'flash' && 'Flash Sales Events'}
            {activeTab === 'customers' && 'Customers'}
            {activeTab === 'orders' && 'Order List'}
            {activeTab === 'settings' && 'Settings'}
          </h1>
          <div className="header-actions">
            <Search className="header-icon" size={20} />
            <Bell className="header-icon" size={20} />
            <div className="profile-avatar">
              <User size={20} />
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="dashboard-content">
            {/* Top Metrics Grid */}
          <div className="metrics-grid">
            <div className="metric-card glass-panel">
              <div className="metric-header">
                <span>Total Sales</span>
                <MoreHorizontal size={18} />
              </div>
              <div className="metric-value">{metrics.sales.toLocaleString()}</div>
              <div className="metric-trend">
                <span className="trend-up"><ArrowUpRight size={14} /> 14%</span>
                <span className="trend-text">in the last month</span>
              </div>
            </div>

            <div className="metric-card glass-panel">
              <div className="metric-header">
                <span>Total Order</span>
                <MoreHorizontal size={18} />
              </div>
              <div className="metric-value">{metrics.orders.toLocaleString()}</div>
              <div className="metric-trend">
                <span className="trend-up"><ArrowUpRight size={14} /> 8%</span>
                <span className="trend-text">in the last month</span>
              </div>
            </div>

            <div className="metric-card glass-panel">
              <div className="metric-header">
                <span>Total Revenue</span>
                <MoreHorizontal size={18} />
              </div>
              <div className="metric-value">{formatCurrency(metrics.revenue)}</div>
              <div className="metric-trend">
                <span className="trend-up"><ArrowUpRight size={14} /> 14%</span>
                <span className="trend-text">in the last month</span>
              </div>
            </div>

            <div className="metric-card glass-panel">
              <div className="metric-header">
                <span>Total Customer</span>
                <MoreHorizontal size={18} />
              </div>
              <div className="metric-value">{metrics.customers.toLocaleString()}</div>
              <div className="metric-trend">
                <span className="trend-up"><ArrowUpRight size={14} /> 5%</span>
                <span className="trend-text">in the last month</span>
              </div>
            </div>
          </div>

          {/* Middle Section: Charts */}
          <div className="middle-grid">
            <div className="dashboard-widget glass-panel">
              <div className="widget-title">
                <span>Revenue</span>
                <div className="revenue-legend">
                  <span className="legend-item"><div className="legend-dot dot-current"></div> Current <span style={{display:'none'}}>{formatCurrency((metrics.revenue / 6) * 1.4)}</span></span>
                  <span className="legend-item"><div className="legend-dot dot-previous"></div> Previous</span>
                </div>
              </div>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <LineChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => '$' + (val >= 1000 ? (val/1000).toFixed(0) + 'K' : val)} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} formatter={(value) => formatCurrency(value)} />
                    <Line type="smooth" dataKey="currentWeek" stroke="#10b981" strokeWidth={3} dot={false} />
                    <Line type="smooth" dataKey="previousWeek" stroke="#6366f1" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-widget glass-panel">
              <div className="widget-title"><span>Sales By Location</span></div>
              <div className="location-list">
                {salesByLocation.length > 0 ? salesByLocation.map((loc, i) => (
                  <div key={i} className="location-item">
                    <div className="loc-header">
                      <span>{loc.city}</span>
                      <span>{loc.value} Items</span>
                    </div>
                    <div className="loc-bar-bg">
                      <div className="loc-bar-fill" style={{ width: `${loc.percentage}%`, backgroundColor: loc.color }}></div>
                    </div>
                  </div>
                )) : <div style={{color: 'var(--text-muted)'}}>No sales data available.</div>}
              </div>
            </div>

            <div className="dashboard-widget glass-panel">
              <div className="widget-title">
                <span>Total Sales</span>
                <MoreHorizontal size={18} />
              </div>
              <div style={{ width: '100%', height: 160, display: 'flex', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={totalSalesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {totalSalesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="sales-breakdown">
                {totalSalesData.map((d, i) => (
                  <div key={i} className="sales-breakdown-item">
                    <span className="s-cat">
                      <div className="legend-dot" style={{ backgroundColor: d.color }}></div>
                      {d.name}
                    </span>
                    <span className="s-val">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Section: Tables and Targets */}
          <div className="bottom-grid">
            <div className="dashboard-widget glass-panel">
              <div className="widget-title" style={{ marginBottom: '1.5rem' }}>
                <span>Top Selling Products</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Filter size={14} /> Filter</button>
                  <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>See All</button>
                </div>
              </div>
              <div className="products-table-wrapper">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" /> Product Name</th>
                      <th>Price</th>
                      <th>Category</th>
                      <th>Quantity</th>
                      <th>Amount</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.length > 0 ? topProducts.map((p, i) => (
                      <tr key={i}>
                        <td>
                          <div className="product-cell">
                            <input type="checkbox" />
                            <div className="p-image" style={{padding: p.image === '🛍️' ? '0' : '2px'}}>{p.image}</div>
                            <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px'}}>{p.name}</span>
                          </div>
                        </td>
                        <td>{formatCurrency(p.price)}</td>
                        <td>{p.category}</td>
                        <td>{p.qty}</td>
                        <td>{formatCurrency(p.amount)}</td>
                        <td><MoreHorizontal size={18} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} /></td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="6" style={{textAlign: 'center', color: 'var(--text-muted)', padding: '2rem'}}>No products match your criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dashboard-widget glass-panel">
              <div className="widget-title" style={{ marginBottom: '0.2rem' }}>
                <span>Monthly Target</span>
                <MoreHorizontal size={18} />
              </div>
              <div className="target-subtitle">Target you've set for each month</div>
              
              <div className="gauge-container">
                <ResponsiveContainer width="100%" height="200%">
                  <RechartsPieChart>
                    <Pie
                      data={[{ value: 75.34 }, { value: 100 - 75.34 }]}
                      cx="50%"
                      cy="100%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#6366f1" />
                      <Cell fill="rgba(255,255,255,0.05)" />
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="gauge-text">
                  <div className="g-val">75.34%</div>
                  <div className="g-sub">+12%</div>
                </div>
              </div>

              <div className="target-msg">
                Your monthly target is $25k. Keep up the good work!
              </div>

              <div className="target-stats">
                <div className="ts-item">
                  <span className="ts-label">Target</span>
                  <span className="ts-val">$25k</span>
                </div>
                <div className="ts-item">
                  <span className="ts-label">Revenue</span>
                  <span className="ts-val">${(metrics.revenue / 1000).toFixed(1)}k <ArrowUpRight size={14} color="#10b981" /></span>
                </div>
                <div className="ts-item">
                  <span className="ts-label">Today</span>
                  <span className="ts-val">${((metrics.revenue / 30) / 1000).toFixed(1)}k <ArrowUpRight size={14} color="#10b981" /></span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'products' && (
          <div className="embedded-products-view">
            <ManageProducts session={session} />
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="dashboard-content">
            <div className="dashboard-widget glass-panel">
              <div className="widget-title" style={{ marginBottom: '1.5rem' }}>
                <span>Your Real Customers</span>
              </div>
              <div className="products-table-wrapper">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Email</th>
                      <th>Total Orders</th>
                      <th>Total Spent</th>
                      <th>Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customersList.length > 0 ? customersList.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                            <div className="profile-avatar" style={{width:'32px', height:'32px', fontSize:'0.8rem'}}>{c.name.charAt(0).toUpperCase()}</div>
                            <span style={{fontWeight:'500'}}>{c.name}</span>
                          </div>
                        </td>
                        <td style={{color:'var(--text-muted)'}}>{c.email}</td>
                        <td>{c.orders}</td>
                        <td style={{color:'#10b981', fontWeight:'500'}}>{formatCurrency(c.spent)}</td>
                        <td style={{color:'var(--text-muted)', fontSize:'0.8rem'}}>{new Date(c.active).toLocaleDateString()}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" style={{textAlign:'center', padding:'2rem', color:'var(--text-muted)'}}>
                          No customers found. Execute the SQL script to create the <code>orders</code> table to start collecting data!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="dashboard-content">
            <div className="dashboard-widget glass-panel">
              <div className="widget-title" style={{ marginBottom: '1.5rem' }}>
                <span>Recent Real Orders</span>
              </div>
              <div className="products-table-wrapper">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersList.length > 0 ? ordersList.map((o, i) => (
                      <tr key={o.id || i}>
                        <td style={{fontWeight:'500', fontSize:'0.8rem'}}>{o.id ? o.id.split('-')[0] : 'N/A'}</td>
                        <td style={{color:'var(--text-muted)'}}>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td>{o.customer_name}</td>
                        <td>
                          <span style={{
                            padding: '4px 8px', 
                            borderRadius: '12px', 
                            fontSize: '0.75rem', 
                            backgroundColor: o.status === 'Delivered' ? 'rgba(16, 185, 129, 0.1)' : o.status === 'Processing' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                            color: o.status === 'Delivered' ? '#10b981' : o.status === 'Processing' ? '#f59e0b' : '#6366f1'
                          }}>
                            {o.status || 'Processing'}
                          </span>
                        </td>
                        <td style={{fontWeight:'500'}}>{formatCurrency(o.total_amount)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" style={{textAlign:'center', padding:'2rem', color:'var(--text-muted)'}}>
                          No orders found yet. Execute the SQL script to create the <code>orders</code> table!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'flash' && (
          <div className="dashboard-content">
            <div className="bottom-grid" style={{gridTemplateColumns: '1fr 1fr'}}>
              <div className="dashboard-widget glass-panel">
                <div className="widget-title" style={{ marginBottom: '1.5rem' }}>
                  <span>{editingFlashId ? 'Edit Flash Sale' : 'Broadcast a Flash Sale to the Storefront'}</span>
                </div>
                <form onSubmit={handleCreateFlashSale} style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                  <div>
                    <label style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>Event Title</label>
                    <input type="text" value={flashForm.title} onChange={e => setFlashForm({...flashForm, title: e.target.value})} placeholder="e.g. Winter Mega Clearance" required style={{width:'100%', padding:'0.75rem', borderRadius:'8px', background:'rgba(128,128,128,0.1)', border:'1px solid rgba(128,128,128,0.2)', color:'var(--text-color)', marginTop:'0.3rem'}} />
                  </div>
                  <div>
                    <label style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>Description</label>
                    <textarea value={flashForm.description} onChange={e => setFlashForm({...flashForm, description: e.target.value})} placeholder="Get ready for the biggest drop..." required style={{width:'100%', padding:'0.75rem', borderRadius:'8px', background:'rgba(128,128,128,0.1)', border:'1px solid rgba(128,128,128,0.2)', color:'var(--text-color)', marginTop:'0.3rem', minHeight:'80px'}} />
                  </div>
                  <div>
                    <label style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>Link to Product (Optional)</label>
                    <select value={flashForm.product_id} onChange={e => setFlashForm({...flashForm, product_id: e.target.value})} style={{width:'100%', padding:'0.75rem', borderRadius:'8px', background:'rgba(128,128,128,0.1)', border:'1px solid rgba(128,128,128,0.2)', color:'var(--text-color)', marginTop:'0.3rem'}}>
                      <option value="" style={{color:'#000'}}>-- None --</option>
                      {allProductsList.map(p => (
                        <option key={p.id} value={p.id} style={{color:'#000'}}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                    <div>
                      <label style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>Discount %</label>
                      <input type="number" min="0" max="100" value={flashForm.discount_percentage} onChange={e => setFlashForm({...flashForm, discount_percentage: e.target.value})} placeholder="e.g. 50" required style={{width:'100%', padding:'0.75rem', borderRadius:'8px', background:'rgba(128,128,128,0.1)', border:'1px solid rgba(128,128,128,0.2)', color:'var(--text-color)', marginTop:'0.3rem'}} />
                    </div>
                    <div>
                      <label style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>Cover Image URL (Optional)</label>
                      <input type="url" value={flashForm.image_url} onChange={e => setFlashForm({...flashForm, image_url: e.target.value})} placeholder="https://..." style={{width:'100%', padding:'0.75rem', borderRadius:'8px', background:'rgba(128,128,128,0.1)', border:'1px solid rgba(128,128,128,0.2)', color:'var(--text-color)', marginTop:'0.3rem'}} />
                    </div>
                  </div>
                  <div style={{display:'flex', gap:'1rem', marginTop:'0.5rem'}}>
                    <button type="submit" disabled={creatingFlash} className="btn btn-primary" style={{flex:1}}>
                      {creatingFlash ? 'Saving...' : (editingFlashId ? 'Update Event' : 'Publish Event Card')}
                    </button>
                    {editingFlashId && (
                      <button type="button" onClick={handleCancelEditFlash} className="btn btn-secondary">
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="dashboard-widget glass-panel">
                <div className="widget-title" style={{ marginBottom: '1.5rem' }}>
                  <span>Active Events Hosted by You</span>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:'1rem', overflowY:'auto', maxHeight:'400px'}}>
                  {flashSales.length > 0 ? flashSales.map(event => (
                    <div key={event.id} style={{background:'rgba(128,128,128,0.05)', padding:'1rem', borderRadius:'12px', border:'1px solid rgba(128,128,128,0.1)'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                        <div>
                          <h4 style={{margin:0, color:'var(--text-color)'}}>{event.title}</h4>
                          <p style={{margin:'0.3rem 0', fontSize:'0.85rem', color:'var(--text-muted)'}}>{event.description}</p>
                        </div>
                        <span style={{background:'rgba(239, 68, 68, 0.2)', color:'#ef4444', padding:'4px 8px', borderRadius:'6px', fontSize:'0.8rem', fontWeight:'600', whiteSpace:'nowrap'}}>
                          {event.discount_percentage}% OFF
                        </span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'1rem'}}>
                        <div style={{fontSize:'0.75rem', color:'var(--color-primary)'}}>
                          Published: {new Date(event.created_at).toLocaleDateString()}
                        </div>
                        <div style={{display:'flex', gap:'0.5rem'}}>
                          <button onClick={() => handleEditFlash(event)} style={{background:'transparent', border:'none', color:'var(--color-primary)', cursor:'pointer', fontSize:'0.8rem', textDecoration:'underline'}}>Edit</button>
                          <button onClick={() => handleDeleteFlash(event.id)} style={{background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'0.8rem', textDecoration:'underline'}}>Delete</button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p style={{color:'var(--text-muted)', textAlign:'center', padding:'2rem'}}>
                      You are not hosting any events.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="dashboard-content">
            <div className="dashboard-widget glass-panel" style={{maxWidth: '600px'}}>
              <div className="widget-title" style={{ marginBottom: '1.5rem' }}>
                <span>Profile Settings</span>
              </div>
              <form onSubmit={handleSaveSettings} style={{display:'flex', flexDirection:'column', gap:'1.5rem'}}>
                <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                  <label style={{fontSize:'0.9rem', color:'var(--text-muted)'}}>Email Address</label>
                  <input type="email" value={session?.user?.email || ''} disabled style={{padding:'0.8rem', borderRadius:'8px', background:'rgba(128,128,128,0.1)', border:'1px solid rgba(128,128,128,0.2)', color:'var(--text-muted)', cursor:'not-allowed'}} />
                  <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Email address cannot be changed from the dashboard.</span>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                  <label style={{fontSize:'0.9rem', color:'var(--text-muted)'}}>Full Name</label>
                  <input type="text" value={profileData.fullName} onChange={e => setProfileData({...profileData, fullName: e.target.value})} placeholder="Retailer Name" style={{padding:'0.8rem', borderRadius:'8px', background:'rgba(128,128,128,0.1)', border:'1px solid rgba(128,128,128,0.2)', color:'var(--text-color)'}} required />
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                  <label style={{fontSize:'0.9rem', color:'var(--text-muted)'}}>Company / Store Name</label>
                  <input type="text" value={profileData.company} onChange={e => setProfileData({...profileData, company: e.target.value})} placeholder="Store Name" style={{padding:'0.8rem', borderRadius:'8px', background:'rgba(128,128,128,0.1)', border:'1px solid rgba(128,128,128,0.2)', color:'var(--text-color)'}} required />
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                  <label style={{fontSize:'0.9rem', color:'var(--text-muted)'}}>Phone Number</label>
                  <input type="tel" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} placeholder="+1 (555) 000-0000" style={{padding:'0.8rem', borderRadius:'8px', background:'rgba(128,128,128,0.1)', border:'1px solid rgba(128,128,128,0.2)', color:'var(--text-color)'}} />
                </div>
                
                {settingsSucc && <div style={{color:'#10b981', background:'rgba(16, 185, 129, 0.1)', padding:'0.8rem', borderRadius:'8px', fontSize:'0.9rem'}}>{settingsSucc}</div>}
                
                <button type="submit" disabled={savingSettings} className="btn btn-primary" style={{marginTop:'1rem', alignSelf:'flex-start'}}>
                  {savingSettings ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
