import React from 'react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="footer-logo"><span className="text-gradient">BuyWise</span> Retail</span>
            <p>Your smart shopping destination. Discover quality products from verified retailers at the best prices.</p>
          </div>
          <div className="footer-links">
            <h4>Quick Links</h4>
            <a href="/">Home</a>
            <a href="/search.html?q=Electronics">Electronics</a>
            <a href="/search.html?q=Fashion">Fashion</a>
            <a href="/favorites.html">Favorites</a>
          </div>
          <div className="footer-links">
            <h4>Support</h4>
            <a href="#">Help Center</a>
            <a href="#">Shipping Info</a>
            <a href="#">Returns</a>
            <a href="#">Contact Us</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} BuyWise Retail. All rights reserved.</p>
          <div className="footer-bottom-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
