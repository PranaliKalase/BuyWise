import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './Auth.css'; // We'll create this next

export default function Auth({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer'); // Default to customer
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        // Sign Up Flow
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: role, // Store role in user metadata
            }
          }
        });

        if (error) throw error;

        if (data?.user && data?.session === null) {
          setSuccessMsg("Registration successful! Check your email to confirm your account (or just sign in if email confirmation is disabled).");
        } else if (data?.session) {
          setSuccessMsg("Registration successful! Redirecting...");
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(data.session.user);
            const userRole = data.session.user.user_metadata?.role || role;
            navigate(userRole === 'retailer' ? '/retailer-dashboard' : userRole === 'admin' ? '/admin-dashboard' : '/');
          }, 1200);
        }
      } else {
        // Sign In Flow
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data?.session) {
          // Fetch role dynamically from the database using the session user id to handle older accounts or changed roles
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', data.session.user.id)
            .single();

          const finalRole = userData?.role || data.session.user.user_metadata?.role || 'customer';

          setSuccessMsg("Sign in successful! Redirecting...");
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(data.session.user);
            navigate(finalRole === 'retailer' ? '/retailer-dashboard' : finalRole === 'admin' ? '/admin-dashboard' : '/');
          }, 1200);
        }
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel">
        <h2 className="text-gradient">{isSignUp ? 'Create an Account' : 'Welcome Back'}</h2>
        <p className="auth-subtitle">
          {isSignUp
            ? 'Join NexGen Retail today and explore futuristic shopping.'
            : 'Sign in to manage your cart and view personalized recommendations.'}
        </p>

        {errorMsg && <div className="auth-error glass-panel">{errorMsg}</div>}
        {successMsg && <div className="auth-success glass-panel">{successMsg}</div>}

        <form onSubmit={handleAuth} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength="6"
            />
          </div>

          {isSignUp && (
            <div className="form-group role-selection">
              <label>I am a...</label>
              <div className="role-options">
                <label className={`role-option ${role === 'customer' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="customer"
                    checked={role === 'customer'}
                    onChange={() => setRole('customer')}
                  />
                  <span>Customer 🛒</span>
                </label>
                <label className={`role-option ${role === 'retailer' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="retailer"
                    checked={role === 'retailer'}
                    onChange={() => setRole('retailer')}
                  />
                  <span>Retailer 🏬</span>
                </label>

              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>





        <div className="auth-switch">
          <p>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              className="text-btn"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg('');
              }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>

        <button className="btn btn-secondary back-home-btn" onClick={() => navigate('/')}>
          Return to Store
        </button>
      </div>
    </div>
  );
}
