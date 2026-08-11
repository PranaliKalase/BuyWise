import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/Header';
import OrderHistory from '../components/OrderHistory';
import { User, Lock, Save, ArrowLeft, CheckCircle, AlertTriangle, Package } from 'lucide-react';
import './ProfilePage.css';

export default function ProfilePage({ session }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'orders';
  const [activeTab, setActiveTab] = useState(defaultTab); // 'orders' | 'settings'

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [joinedAt, setJoinedAt] = useState('');

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Feedback
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!session) {
      navigate('/auth');
      return;
    }

    const user = session.user;
    setEmail(user.email || '');
    setFullName(user.user_metadata?.full_name || '');
    setJoinedAt(new Date(user.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    }));

    // Fetch role from users table
    const fetchRole = async () => {
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      setRole(data?.role || user.user_metadata?.role || 'customer');
    };
    fetchRole();
  }, [session, navigate]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });
      if (error) throw error;

      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setSavingPassword(false);
    }
  };

  const roleLabel = role === 'retailer' ? '🏬 Retailer' : role === 'admin' ? '🛡️ Admin' : '🛒 Customer';

  if (!session) return null;

  return (
    <>
      <Header session={session} />
      <div className="profile-page-container">
        <button className="profile-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>

        <div className="profile-page-header">
          <div className="profile-avatar-large">
            {fullName ? fullName.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1>{fullName || 'User Profile'}</h1>
            <p className="profile-meta">{email} · <span className="profile-role-badge">{roleLabel}</span></p>
            <p className="profile-meta">Member since {joinedAt}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              background: activeTab === 'orders' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: activeTab === 'orders' ? '1px solid #6366f1' : '1px solid transparent',
              color: activeTab === 'orders' ? '#6366f1' : '#94a3b8',
              padding: '0.65rem 1.25rem', borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
            }}
          >
            <Package size={18} /> My Orders
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            style={{
              background: activeTab === 'settings' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: activeTab === 'settings' ? '1px solid #6366f1' : '1px solid transparent',
              color: activeTab === 'settings' ? '#6366f1' : '#94a3b8',
              padding: '0.65rem 1.25rem', borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
            }}
          >
            <User size={18} /> Account Settings
          </button>
        </div>

        {/* TAB 1: MY ORDERS */}
        {activeTab === 'orders' && (
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-color, #0f172a)' }}>
              Order History
            </h2>
            <OrderHistory userId={session?.user?.id} userEmail={session?.user?.email} />
          </div>
        )}

        {/* TAB 2: ACCOUNT SETTINGS */}
        {activeTab === 'settings' && (
          <div className="profile-grid">
            {/* Edit Name Section */}
            <div className="profile-card glass-panel">
              <div className="profile-card-header">
                <User size={20} />
                <h2>Edit Profile</h2>
              </div>
              <form onSubmit={handleUpdateProfile}>
                <div className="profile-form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div className="profile-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="disabled-input"
                  />
                  <span className="profile-hint">Email cannot be changed</span>
                </div>

                {profileMsg.text && (
                  <div className={`profile-feedback ${profileMsg.type}`}>
                    {profileMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {profileMsg.text}
                  </div>
                )}

                <button type="submit" className="profile-save-btn" disabled={savingProfile}>
                  <Save size={16} />
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>

            {/* Change Password Section */}
            <div className="profile-card glass-panel">
              <div className="profile-card-header">
                <Lock size={20} />
                <h2>Change Password</h2>
              </div>
              <form onSubmit={handleChangePassword}>
                <div className="profile-form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                    required
                    minLength={6}
                  />
                </div>
                <div className="profile-form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    minLength={6}
                  />
                </div>

                {passwordMsg.text && (
                  <div className={`profile-feedback ${passwordMsg.type}`}>
                    {passwordMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {passwordMsg.text}
                  </div>
                )}

                <button type="submit" className="profile-save-btn password-btn" disabled={savingPassword}>
                  <Lock size={16} />
                  {savingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
