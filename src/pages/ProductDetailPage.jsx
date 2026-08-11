import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, Star, ShieldCheck, Truck, RefreshCw, Lock, Heart } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ReviewSection from '../components/ReviewSection';
import ReviewModal from '../components/ReviewModal';
import ToastContainer from '../components/Toast';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { supabase } from '../lib/supabaseClient';
import { MOCK_PRODUCTS } from '../mockData/products';
import './ProductDetailPage.css';

export default function ProductDetailPage({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, setIsCartOpen } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userOrders, setUserOrders] = useState([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [toasts, setToasts] = useState([]);

  const addToast = (title, message, type = 'info') => {
    const toastId = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-1), { id: toastId, title, message, type }]);
  };

  const removeToast = (toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  };

  // Fetch product and verified orders
  useEffect(() => {
    const fetchProductData = async () => {
      setLoading(true);
      let foundProduct = null;

      // 1. Check MOCK_PRODUCTS
      foundProduct = MOCK_PRODUCTS.find(p => String(p.id) === String(id));

      // 2. Fetch from Supabase products
      try {
        const { data } = await supabase.from('products').select('*').eq('id', id).single();
        if (data) {
          foundProduct = {
            ...data,
            image: data.image_url || data.image || foundProduct?.image
          };
        }
      } catch (e) {
        console.warn("Product detail fetch notice:", e);
      }

      if (!foundProduct) {
        // Fallback default item
        foundProduct = {
          id: id || 'p1',
          name: 'BuyWise Smart Premium Gadget',
          price: 1499.00,
          description: 'High performance futuristic gadget engineered for modern efficiency.',
          category: 'Electronics',
          image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
          rating: 4.8,
          reviews: 24,
          in_stock: true
        };
      }

      setProduct(foundProduct);

      // Fetch user confirmed orders to verify purchase
      try {
        const userEmail = session?.user?.email;
        const localSaved = JSON.parse(localStorage.getItem('buywise_user_orders') || '[]');
        if (Array.isArray(localSaved)) {
          const userOrdersFiltered = localSaved.filter(o => !userEmail || o.customer_email === userEmail);
          setUserOrders(userOrdersFiltered);
        }
      } catch (e) {
        console.warn("User orders load notice:", e);
      }

      setLoading(false);
    };

    fetchProductData();
  }, [id, session]);

  if (loading) {
    return (
      <>
        <Header session={session} />
        <div className="pdp-container">
          <div className="loading-container">
            <div className="loader"></div>
            <p>Loading product details...</p>
          </div>
        </div>
      </>
    );
  }

  const userEmail = session?.user?.email;
  // Check if current user bought this product in confirmed orders
  const verifiedOrder = userOrders.find(order => {
    const items = order.items || order.cart_items || [];
    return items.some(item => String(item.product_id || item.id) === String(product.id));
  });

  const handleOpenWriteReview = (revToEdit = null) => {
    setEditingReview(revToEdit);
    setIsReviewModalOpen(true);
  };

  const handleReviewSubmitted = (reviewPayload, mode) => {
    addToast(
      mode === 'updated' ? 'Review Updated' : 'Review Submitted',
      `Thank you for reviewing ${product.name}!`,
      'success'
    );
  };

  return (
    <>
      <Header session={session} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="pdp-container">
        
        {/* Back Button */}
        <button className="pdp-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>

        {/* Product Details Section */}
        <div className="pdp-main-grid glass-panel">
          
          {/* Product Gallery */}
          <div className="pdp-gallery">
            <img 
              src={product.image || product.image_url} 
              alt={product.name} 
              className="pdp-main-img" 
            />
          </div>

          {/* Product Info */}
          <div className="pdp-info">
            <span className="pdp-category text-gradient">{product.category || 'General'}</span>
            <h1 className="pdp-title">{product.name}</h1>

            {/* Quick Rating Header */}
            <div className="pdp-rating-header">
              <span className="pdp-rating-score">⭐ {product.rating || 4.5}</span>
              <span className="pdp-rating-count">({product.reviews || 12} customer reviews)</span>
              {verifiedOrder && (
                <span className="pdp-verified-tag">
                  <ShieldCheck size={16} color="#10b981" /> Verified Buyer
                </span>
              )}
            </div>

            {/* Price Box */}
            <div className="pdp-price-row">
              <span className="pdp-price">₹{parseFloat(product.price).toLocaleString('en-IN')}</span>
              <span className="pdp-tax-inc">Inclusive of all taxes</span>
            </div>

            <p className="pdp-desc">{product.description}</p>

            {/* Value Badges */}
            <div className="pdp-features-grid">
              <div className="pdp-feature-item">
                <Truck size={20} color="#6366f1" />
                <div>
                  <strong>Free Express Delivery</strong>
                  <p>Estimated 3–5 business days</p>
                </div>
              </div>
              <div className="pdp-feature-item">
                <RefreshCw size={20} color="#ec4899" />
                <div>
                  <strong>7-Day Easy Returns</strong>
                  <p>Hassle-free return policy</p>
                </div>
              </div>
              <div className="pdp-feature-item">
                <Lock size={20} color="#10b981" />
                <div>
                  <strong>BuyWise AI Guarantee</strong>
                  <p>100% Authentic Seller Verified</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pdp-actions">
              <button 
                className="btn btn-primary pdp-cart-btn"
                onClick={() => {
                  addToCart(product);
                  setIsCartOpen(true);
                }}
              >
                <ShoppingBag size={20} /> Add to Cart
              </button>

              <button 
                className="btn btn-secondary pdp-fav-btn"
                onClick={() => toggleFavorite(product)}
              >
                <Heart size={20} fill={isFavorite(product.id) ? '#ec4899' : 'none'} color={isFavorite(product.id) ? '#ec4899' : '#ffffff'} />
              </button>

              {verifiedOrder && (
                <button 
                  className="btn pdp-review-trigger-btn"
                  onClick={() => handleOpenWriteReview(null)}
                >
                  <Star size={18} fill="#f59e0b" color="#f59e0b" /> Rate & Review
                </button>
              )}
            </div>

          </div>

        </div>

        {/* Ratings & Reviews Section */}
        <ReviewSection 
          product={product} 
          session={session} 
          onOpenReviewModal={handleOpenWriteReview} 
        />

      </div>

      {/* Review Submission Modal */}
      <ReviewModal 
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        product={product}
        orderId={verifiedOrder?.order_id || 'BW-PURCHASE'}
        orderEmail={verifiedOrder?.customer_email}
        session={session}
        existingReview={editingReview}
        onReviewSubmitted={handleReviewSubmitted}
      />

      <Footer />
    </>
  );
}
