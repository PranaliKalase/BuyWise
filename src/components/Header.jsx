import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { supabase } from '../lib/supabaseClient';
import './Header.css';

export default function Header({ session, onOpenImageSearch }) {
  const { cartItemCount, setIsCartOpen } = useCart();
  const { favorites } = useFavorites();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');

  const executeSearch = () => {
    if (searchQuery.trim()) {
      navigate('/search.html?q=' + encodeURIComponent(searchQuery.trim()));
    }
  };

  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice search. Please try using Google Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechError('');
    };

    recognition.onresult = (event) => {
      const raw = event.results[0][0].transcript;
      // Strip trailing punctuation added by speech recognition
      const transcript = raw.replace(/[.,!?;:]+$/g, '').trim();
      setSearchQuery(transcript);
      // Automatically submit after recognizing
      if (transcript) {
        navigate('/search.html?q=' + encodeURIComponent(transcript));
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setSpeechError("Microphone access blocked.");
      } else {
        setSpeechError("Didn't catch that. Tap to speak again.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

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
          <span className="text-gradient">BuyWise</span> Retail
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder={isListening ? "Listening..." : "What are you looking for?"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                executeSearch();
              }
            }}
            className={isListening ? "listening-input" : ""}
          />
          {speechError && <div className="speech-error-msg">{speechError}</div>}
          <button 
            className={`icon-btn mic-icon ${isListening ? 'listening pulse-animation' : ''}`} 
            title="Voice Search" 
            onClick={startVoiceSearch}
          >
            🎤
          </button>
          <button className="icon-btn search-icon" onClick={executeSearch}>🔍</button>
          <button className="icon-btn camera-icon" title="Search by Image" onClick={onOpenImageSearch}>📷</button>
        </div>

        <nav className="nav-actions">
          {!session ? (
            <button className="nav-btn" onClick={() => navigate('/auth')}>Sign In</button>
          ) : (
            <div className="user-menu" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {userRole === 'retailer' && (
                 <button className="nav-btn" style={{color: 'var(--primary-cyan)'}} onClick={() => navigate('/retailer-dashboard')}>
                   Retailer Dashboard
                 </button>
              )}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {session?.user?.email}
              </span>
              <button className="nav-btn" onClick={() => navigate('/profile')} title="My Profile" style={{ fontSize: '1.1rem' }}>
                👤
              </button>
              <button className="nav-btn" onClick={handleSignOut}>Sign Out</button>
            </div>
          )}
          <button className="nav-btn cart-btn" onClick={() => navigate('/favorites.html')} style={{ marginRight: '10px' }} title="View Favorites">
            ❤️ {favorites.length > 0 && <span className="cart-badge" style={{background:'#e11d48'}}>{favorites.length}</span>}
          </button>
          <button className="nav-btn cart-btn" onClick={() => setIsCartOpen(true)} title="View Cart">
            🛒 {cartItemCount > 0 && <span className="cart-badge">{cartItemCount}</span>}
          </button>
        </nav>
      </div>
    </header>
  );
}
