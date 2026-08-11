import React, { useState } from 'react';
import { ShieldCheck, X, CreditCard, QrCode, Building2, Wallet as WalletIcon, Lock, CheckCircle2 } from 'lucide-react';
import './PaymentModal.css';

export default function PaymentModal({ isOpen, onClose, amount, onProceedPayment }) {
  const [activeTab, setActiveTab] = useState('upi'); // 'upi' | 'card' | 'debit' | 'netbanking' | 'wallet'

  // Form states
  // UPI
  const [upiId, setUpiId] = useState('');
  const [upiError, setUpiError] = useState('');

  // Credit / Debit Card
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardError, setCardError] = useState('');

  // Net Banking
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');

  // Wallet
  const [selectedWallet, setSelectedWallet] = useState('BuyWise Wallet');

  if (!isOpen) return null;

  // Format Card Number (adds space every 4 digits)
  const handleCardNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (e) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = raw.slice(0, 2) + '/' + raw.slice(2);
    }
    setExpiry(raw);
  };

  // Format CVV
  const handleCvvChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 3);
    setCvv(raw);
  };

  // Card Type Detector
  const getCardBrand = (num) => {
    const clean = num.replace(/\s/g, '');
    if (clean.startsWith('4')) return 'Visa';
    if (clean.startsWith('5')) return 'Mastercard';
    if (clean.startsWith('6') || clean.startsWith('35')) return 'RuPay';
    return 'Card';
  };

  // Form Validation & Submission
  const handleSubmit = (e) => {
    e.preventDefault();

    if (activeTab === 'upi') {
      if (!upiId || !upiId.includes('@')) {
        setUpiError('Please enter a valid UPI ID (e.g. name@oksbi)');
        return;
      }
      setUpiError('');
      const maskedUpi = upiId.split('@')[0].slice(0, 3) + '***@' + upiId.split('@')[1];
      onProceedPayment({
        method: 'UPI',
        method_details: { upi: maskedUpi }
      });
    } else if (activeTab === 'card' || activeTab === 'debit') {
      const cleanNum = cardNumber.replace(/\s/g, '');
      if (cleanNum.length < 16) {
        setCardError('Please enter a valid 16-digit card number');
        return;
      }
      if (!cardName.trim()) {
        setCardError('Please enter cardholder name');
        return;
      }
      if (!expiry || expiry.length < 5) {
        setCardError('Please enter expiry date as MM/YY');
        return;
      }
      // Validate future expiry
      const [mm, yy] = expiry.split('/');
      const month = parseInt(mm, 10);
      const year = parseInt('20' + yy, 10);
      const now = new Date();
      if (month < 1 || month > 12 || new Date(year, month - 1) < new Date(now.getFullYear(), now.getMonth())) {
        setCardError('Card expiry date must be in the future');
        return;
      }
      if (!cvv || cvv.length < 3) {
        setCardError('Please enter 3-digit CVV');
        return;
      }
      setCardError('');
      const last4 = cleanNum.slice(-4);
      const brand = getCardBrand(cleanNum);
      const methodTitle = activeTab === 'card' ? 'Credit Card' : 'Debit Card';
      onProceedPayment({
        method: methodTitle,
        method_details: { last4, brand, name: cardName }
      });
    } else if (activeTab === 'netbanking') {
      onProceedPayment({
        method: 'Net Banking',
        method_details: { bank: selectedBank }
      });
    } else if (activeTab === 'wallet') {
      onProceedPayment({
        method: 'Wallet',
        method_details: { wallet: selectedWallet }
      });
    }
  };

  return (
    <div className="pm-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pm-modal">
        {/* Header */}
        <div className="pm-header">
          <div className="pm-header-left">
            <span className="pm-brand-logo">BuyWise Pay</span>
            <span className="pm-badge-secure">
              <ShieldCheck size={13} /> Secure Checkout
            </span>
          </div>
          <div className="pm-header-right">
            <div className="pm-amount-box">
              <div className="pm-amount-label">Payable Amount</div>
              <div className="pm-amount-value">₹{amount.toFixed(2)}</div>
            </div>
            <button className="pm-close-btn" onClick={onClose} aria-label="Close modal">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="pm-tabs">
          <button className={`pm-tab ${activeTab === 'upi' ? 'active' : ''}`} onClick={() => setActiveTab('upi')}>
            <QrCode size={16} /> UPI
          </button>
          <button className={`pm-tab ${activeTab === 'card' ? 'active' : ''}`} onClick={() => setActiveTab('card')}>
            <CreditCard size={16} /> Credit Card
          </button>
          <button className={`pm-tab ${activeTab === 'debit' ? 'active' : ''}`} onClick={() => setActiveTab('debit')}>
            <CreditCard size={16} /> Debit Card
          </button>
          <button className={`pm-tab ${activeTab === 'netbanking' ? 'active' : ''}`} onClick={() => setActiveTab('netbanking')}>
            <Building2 size={16} /> Net Banking
          </button>
          <button className={`pm-tab ${activeTab === 'wallet' ? 'active' : ''}`} onClick={() => setActiveTab('wallet')}>
            <WalletIcon size={16} /> Wallet
          </button>
        </div>

        {/* Form Body */}
        <div className="pm-body">
          <form onSubmit={handleSubmit}>
            {/* UPI TAB */}
            {activeTab === 'upi' && (
              <div className="pm-upi-container">
                <div className="pm-qr-box">
                  <div className="pm-qr-code">
                    <svg viewBox="0 0 100 100" width="90" height="90">
                      <rect width="100" height="100" fill="#fff"/>
                      <path d="M10,10 h30 v30 h-30 z M15,15 h20 v20 h-20 z M20,20 h10 v10 h-10 z" fill="#0f172a"/>
                      <path d="M60,10 h30 v30 h-30 z M65,15 h20 v20 h-20 z M70,20 h10 v10 h-10 z" fill="#0f172a"/>
                      <path d="M10,60 h30 v30 h-30 z M15,65 h20 v20 h-20 z M20,70 h10 v10 h-10 z" fill="#0f172a"/>
                      <circle cx="50" cy="50" r="8" fill="#6366f1"/>
                      <rect x="50" y="20" width="8" height="20" fill="#0f172a"/>
                      <rect x="65" y="60" width="20" height="20" fill="#0f172a"/>
                      <rect x="50" y="70" width="10" height="10" fill="#0f172a"/>
                    </svg>
                  </div>
                  <div className="pm-qr-details">
                    <h4>Scan & Pay with Any UPI App</h4>
                    <p>Google Pay, PhonePe, Paytm, BHIM</p>
                    <div className="pm-quick-upi">
                      <span className="pm-upi-tag" onClick={() => setUpiId('demo@oksbi')}>demo@oksbi</span>
                      <span className="pm-upi-tag" onClick={() => setUpiId('user@paytm')}>user@paytm</span>
                      <span className="pm-upi-tag" onClick={() => setUpiId('buyer@ybl')}>buyer@ybl</span>
                    </div>
                  </div>
                </div>

                <div className="pm-form-group">
                  <label>Or Enter UPI ID / VPA</label>
                  <div className="pm-input-wrap">
                    <input
                      type="text"
                      className="pm-input"
                      placeholder="e.g. mobile@oksbi, user@paytm"
                      value={upiId}
                      onChange={(e) => { setUpiId(e.target.value); setUpiError(''); }}
                    />
                  </div>
                  {upiError && <div className="pm-error-text">{upiError}</div>}
                </div>
              </div>
            )}

            {/* CARD & DEBIT TAB */}
            {(activeTab === 'card' || activeTab === 'debit') && (
              <div>
                <div className="pm-form-group">
                  <label>Card Number</label>
                  <div className="pm-input-wrap">
                    <input
                      type="text"
                      className="pm-input"
                      placeholder="4111 2222 3333 4444"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                    />
                    <span className="pm-input-icon" style={{ fontWeight: 700, color: '#6366f1' }}>
                      {getCardBrand(cardNumber)}
                    </span>
                  </div>
                </div>

                <div className="pm-form-group">
                  <label>Cardholder Name</label>
                  <input
                    type="text"
                    className="pm-input"
                    placeholder="Full Name as on Card"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                  />
                </div>

                <div className="pm-form-row">
                  <div className="pm-form-group" style={{ flex: 1 }}>
                    <label>Expiry (MM/YY)</label>
                    <input
                      type="text"
                      className="pm-input"
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={handleExpiryChange}
                    />
                  </div>
                  <div className="pm-form-group" style={{ flex: 1 }}>
                    <label>CVV / CVC</label>
                    <input
                      type="password"
                      className="pm-input"
                      placeholder="123"
                      value={cvv}
                      onChange={handleCvvChange}
                    />
                  </div>
                </div>

                {cardError && <div className="pm-error-text" style={{ marginBottom: '1rem' }}>{cardError}</div>}
              </div>
            )}

            {/* NET BANKING TAB */}
            {activeTab === 'netbanking' && (
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.75rem', display: 'block' }}>
                  Popular Banks
                </label>
                <div className="pm-banks-grid">
                  {[
                    { name: 'HDFC Bank', icon: '🏦' },
                    { name: 'SBI', icon: '🏛️' },
                    { name: 'ICICI Bank', icon: '💳' },
                    { name: 'Axis Bank', icon: '⚡' },
                    { name: 'Kotak Bank', icon: '🔴' },
                    { name: 'PNB', icon: '🔷' },
                  ].map((bank) => (
                    <div
                      key={bank.name}
                      className={`pm-bank-card ${selectedBank === bank.name ? 'selected' : ''}`}
                      onClick={() => setSelectedBank(bank.name)}
                    >
                      <span className="pm-bank-icon">{bank.icon}</span>
                      <span className="pm-bank-name">{bank.name}</span>
                    </div>
                  ))}
                </div>

                <div className="pm-form-group">
                  <label>All Other Banks</label>
                  <select
                    className="pm-input"
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                  >
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="State Bank of India">State Bank of India</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                    <option value="Axis Bank">Axis Bank</option>
                    <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                    <option value="Punjab National Bank">Punjab National Bank</option>
                    <option value="Bank of Baroda">Bank of Baroda</option>
                    <option value="IDFC FIRST Bank">IDFC FIRST Bank</option>
                    <option value="Yes Bank">Yes Bank</option>
                  </select>
                </div>
              </div>
            )}

            {/* WALLET TAB */}
            {activeTab === 'wallet' && (
              <div className="pm-wallets-list">
                {[
                  { name: 'BuyWise Wallet', desc: 'Instant 1-Click Pay · Balance: ₹5,000.00', icon: '✨' },
                  { name: 'Paytm Wallet', desc: 'Linked Paytm Account', icon: '📲' },
                  { name: 'Amazon Pay', desc: 'Amazon Pay Balance & UPI', icon: '📦' },
                  { name: 'PhonePe Wallet', desc: 'PhonePe Cashback & Balance', icon: '💜' }
                ].map((wallet) => (
                  <div
                    key={wallet.name}
                    className={`pm-wallet-item ${selectedWallet === wallet.name ? 'selected' : ''}`}
                    onClick={() => setSelectedWallet(wallet.name)}
                  >
                    <div className="pm-wallet-left">
                      <span style={{ fontSize: '1.4rem' }}>{wallet.icon}</span>
                      <div>
                        <div className="pm-wallet-name">{wallet.name}</div>
                        <div className="pm-wallet-balance">{wallet.desc}</div>
                      </div>
                    </div>
                    {selectedWallet === wallet.name && <CheckCircle2 color="#6366f1" size={20} />}
                  </div>
                ))}
              </div>
            )}

            {/* Submit Button */}
            <div className="pm-footer">
              <button type="submit" className="pm-pay-btn">
                <Lock size={16} /> Pay ₹{amount.toFixed(2)}
              </button>
              <div className="pm-trust-indicators">
                <span>🔒 256-Bit Encryption</span>
                <span>·</span>
                <span>🛡️ PCI-DSS Compliant</span>
                <span>·</span>
                <span>✓ Verified Merchant</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
