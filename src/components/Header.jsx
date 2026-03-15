import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { supabase } from '../lib/supabaseClient';
import './Header.css';

export default function Header({ session, onOpenImageSearch }) {
  const { cartItemCount, setIsCartOpen } = useCart();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);

  React.useEffect(() => {
    const fetchRole = async () => {
      if (session?.user) {
        // Fetch role from the users table
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
          
        if (data && !error) {
          setUserRole(data.role);
        } else {
          // Fallback if row doesn't exist yet
          setUserRole(session.user.user_metadata?.role || 'customer');
        }
      } else {
        setUserRole(null);
      }
    };
    
    fetchRole();
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };
  return (
    <header className="header glass-panel">
      <div className="container header-container">
        <div className="logo">
          <span className="text-gradient">NexGen</span> Retail
        </div>
        
        <div className="search-bar">
          <input type="text" placeholder="What are you looking for?" />
          <button className="icon-btn search-icon">🔍</button>
          <button className="icon-btn camera-icon" title="Search by Image" onClick={onOpenImageSearch}>📷</button>
        </div>

        <nav className="nav-actions">
          {!session ? (
            <button className="nav-btn" onClick={() => navigate('/auth')}>Sign In</button>
          ) : (
            <div className="user-menu" style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
              {userRole === 'retailer' && (
                 <button className="nav-btn" style={{color: 'var(--primary-cyan)'}} onClick={() => navigate('/upload')}>
                   Add Products
                 </button>
              )}
              <span style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>
                {session?.user?.email}
              </span>
              <button className="nav-btn" onClick={handleSignOut}>Sign Out</button>
            </div>
          )}
          <button className="nav-btn cart-btn" onClick={() => setIsCartOpen(true)}>
            🛒 {cartItemCount > 0 && <span className="cart-badge">{cartItemCount}</span>}
          </button>
        </nav>
      </div>
    </header>
  );
}
