import React, { useState, useEffect } from 'react';
import { Star, X, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './ReviewModal.css';

export default function ReviewModal({
  isOpen,
  onClose,
  product,
  orderId,
  orderEmail,
  session,
  existingReview = null,
  onReviewSubmitted
}) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const RATING_LABELS = {
    1: '1/5 - Poor 😞',
    2: '2/5 - Fair 😐',
    3: '3/5 - Good 🙂',
    4: '4/5 - Very Good 😊',
    5: '5/5 - Excellent 🎉'
  };

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 5);
      setTitle(existingReview.title || '');
      setBody(existingReview.body || '');
    } else {
      setRating(5);
      setTitle('');
      setBody('');
    }
    setErrorMsg('');
  }, [existingReview, isOpen]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (body.trim().length < 10) {
      setErrorMsg('Review description must be at least 10 characters long.');
      return;
    }

    if (body.trim().length > 500) {
      setErrorMsg('Review description cannot exceed 500 characters.');
      return;
    }

    setSubmitting(true);

    const customerEmail = session?.user?.email || orderEmail || 'customer@buywise.com';
    const customerName = session?.user?.user_metadata?.full_name || customerEmail.split('@')[0] || 'Verified Customer';
    const userId = session?.user?.id || null;
    const nowIso = new Date().toISOString();
    const productIdStr = String(product.id);

    const reviewPayload = {
      product_id: productIdStr,
      customer_id: userId,
      rating,
      review_title: title.trim(),
      review_text: body.trim(),
      is_verified_purchase: !!orderId,
      is_approved: true,
      helpful_count: existingReview?.helpful_count || 0,
      created_at: existingReview?.created_at || nowIso,
      updated_at: nowIso
    };

    if (existingReview?.id) {
      reviewPayload.id = existingReview.id;
    }

    // 1. LocalStorage Backup (Instant & 100% reliable)
    try {
      const allLocal = JSON.parse(localStorage.getItem('buywise_reviews') || '[]');
      const filtered = allLocal.filter(
        r => !(String(r.product_id) === productIdStr && r.customer_email === customerEmail)
      );
      const localReviewPayload = { ...reviewPayload, id: reviewPayload.id || `temp_${Date.now()}` };
      const updated = [localReviewPayload, ...filtered];
      localStorage.setItem('buywise_reviews', JSON.stringify(updated));
    } catch (err) {
      console.warn("LocalStorage save review notice:", err);
    }

    // 2. Supabase Persistence (Insert or Update)
    let submittedReview = { ...reviewPayload };
    try {
      if (existingReview?.id) {
        const { error: updateErr, data } = await supabase
          .from('product_reviews')
          .update({
            rating,
            review_title: title.trim(),
            review_text: body.trim(),
            updated_at: nowIso
          })
          .eq('id', existingReview.id)
          .select();

        if (updateErr) {
          console.warn("Update notice:", updateErr.message);
        } else if (data && data.length > 0) {
          submittedReview = data[0];
        }
      } else {
        const { error: insertErr, data } = await supabase
          .from('product_reviews')
          .insert([reviewPayload])
          .select();

        if (insertErr) {
          console.warn("Insert notice:", insertErr.message);
        } else if (data && data.length > 0) {
          submittedReview = data[0];
        }
      }
    } catch (err) {
      console.warn("Supabase review submission notice:", err);
    }

    setSubmitting(false);
    if (onReviewSubmitted) {
      onReviewSubmitted(submittedReview, existingReview ? 'updated' : 'submitted');
    }
    onClose();
  };

  const activeStarCount = hoverRating || rating;

  return (
    <div className="rm-overlay" onClick={onClose}>
      <div className="rm-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="rm-header">
          <div className="rm-header-left">
            <ShieldCheck size={24} className="rm-shield-icon" />
            <div>
              <h2>{existingReview ? 'Edit Your Review' : 'Rate & Review Product'}</h2>
              <p className="rm-subtitle">Verified Purchase · Order #{orderId || 'BW-ORDER'}</p>
            </div>
          </div>
          <button className="rm-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Product Preview Strip */}
        <div className="rm-product-strip">
          {(product.image || product.image_url) && (
            <img src={product.image || product.image_url} alt={product.name} className="rm-product-img" />
          )}
          <div className="rm-product-info">
            <div className="rm-product-name">{product.name}</div>
            <div className="rm-badge">
              <CheckCircle size={14} color="#10b981" /> Verified Buyer
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="rm-error">
            <AlertCircle size={18} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rm-form">
          {/* Star Rating Selection */}
          <div className="rm-form-group">
            <label className="rm-label">Your Overall Rating <span className="req">*</span></label>
            <div className="rm-stars-container">
              {[1, 2, 3, 4, 5].map((starIndex) => (
                <button
                  type="button"
                  key={starIndex}
                  className={`rm-star-btn ${starIndex <= activeStarCount ? 'active' : ''}`}
                  onClick={() => setRating(starIndex)}
                  onMouseEnter={() => setHoverRating(starIndex)}
                  onMouseLeave={() => setHoverRating(0)}
                  aria-label={`Rate ${starIndex} stars`}
                >
                  <Star
                    size={32}
                    fill={starIndex <= activeStarCount ? '#f59e0b' : 'none'}
                    color={starIndex <= activeStarCount ? '#f59e0b' : '#64748b'}
                  />
                </button>
              ))}
            </div>
            <div className="rm-rating-text">{RATING_LABELS[activeStarCount]}</div>
          </div>

          {/* Review Title */}
          <div className="rm-form-group">
            <label className="rm-label" htmlFor="review-title">Review Title (Optional)</label>
            <input
              id="review-title"
              type="text"
              className="rm-input"
              placeholder="e.g., Outstanding quality and super fast shipping!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Review Body */}
          <div className="rm-form-group">
            <div className="rm-label-row">
              <label className="rm-label" htmlFor="review-body">Detailed Review <span className="req">*</span></label>
              <span className="rm-char-counter">{body.length} / 500 chars</span>
            </div>
            <textarea
              id="review-body"
              className="rm-textarea"
              rows={4}
              placeholder="What did you like or dislike about this product? How is the quality and performance?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              minLength={10}
              maxLength={500}
              required
            />
          </div>

          {/* Modal Actions */}
          <div className="rm-actions">
            <button type="button" className="btn btn-secondary rm-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary rm-submit-btn" disabled={submitting}>
              {submitting ? 'Submitting...' : existingReview ? 'Update Review' : 'Submit Review'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
