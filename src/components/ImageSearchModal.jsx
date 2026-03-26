import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { supabase } from '../lib/supabaseClient';
import './ImageSearchModal.css';

export default function ImageSearchModal({ isOpen, onClose, onSearchResults }) {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [model, setModel] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Load the model when the component mounts
    const loadModel = async () => {
      try {
        // Load the smallest, fastest variant of MobileNet
        const loadedModel = await mobilenet.load({
          version: 1, 
          alpha: 0.25 
        });
        setModel(loadedModel);
        console.log("MobileNet (Fast Mode) loaded locally!");
      } catch (err) {
        console.error("Failed to load MobileNet model", err);
      }
    };
    loadModel();
  }, []);

  if (!isOpen) return null;

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!model) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setImagePreview(URL.createObjectURL(file));
      await performSearch(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!model) return;
    setIsDragging(true);
  };
  
  const handleFileSelect = async (e) => {
    if (!model) return;
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImagePreview(URL.createObjectURL(file));
      await performSearch(file);
    }
  };

  const performSearch = async (file) => {
    if (!model) {
      console.warn("MobileNet model not yet loaded. Please wait.");
      return;
    }

    setIsSearching(true);
    
    try {
      // Create a temporary local image element to feed into TensorFlow.js
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      
      // Wait for image to load before classification
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Classify the image using the local MobileNet model
      const predictions = await model.classify(img);
      console.log('MobileNet Predictions: ', predictions);

      // Extract the best search keyword from predictions
      let searchKeyword = '';
      if (predictions && predictions.length > 0) {
        // Get all meaningful words from top predictions
        const allWords = predictions
          .flatMap(p => p.className.toLowerCase().split(/[\s,]+/))
          .filter(w => w.length > 2);

        // Category mapping: map AI labels to product-friendly search terms
        const categoryMap = {
          'shoe': 'shoes', 'sneaker': 'shoes', 'boot': 'shoes', 'sandal': 'shoes',
          'loafer': 'shoes', 'clog': 'shoes', 'running': 'shoes',
          'sunglass': 'glasses', 'spectacle': 'glasses',
          'watch': 'watch', 'clock': 'watch', 'digital': 'watch',
          'headphone': 'headphone', 'headset': 'headphone', 'earphone': 'headphone',
          'laptop': 'laptop', 'notebook': 'laptop', 'computer': 'computer',
          'mouse': 'mouse', 'keyboard': 'keyboard',
          'monitor': 'monitor', 'screen': 'monitor', 'television': 'tv',
          'phone': 'phone', 'cellular': 'phone', 'mobile': 'phone', 'smartphone': 'phone',
          'shirt': 'shirt', 'jersey': 'shirt', 'sweatshirt': 'shirt',
          'jean': 'jeans', 'trouser': 'pants', 'pant': 'pants',
          'jacket': 'jacket', 'coat': 'jacket',
          'bag': 'bag', 'backpack': 'bag', 'purse': 'bag', 'handbag': 'bag',
          'camera': 'camera', 'reflex': 'camera',
          'speaker': 'speaker', 'loudspeaker': 'speaker',
          'book': 'books', 'bookshop': 'books',
          'perfume': 'perfume', 'lotion': 'beauty',
          'car': 'car', 'vehicle': 'car',
          'bicycle': 'bicycle', 'bike': 'bicycle',
          'ring': 'jewelry', 'necklace': 'jewelry', 'bracelet': 'jewelry',
          'toy': 'toys', 'game': 'gaming', 'console': 'gaming',
          'chair': 'furniture', 'table': 'furniture', 'desk': 'furniture',
          'lamp': 'lamp', 'light': 'lighting'
        };

        // Try to find a mapped keyword first
        for (const word of allWords) {
          for (const [key, value] of Object.entries(categoryMap)) {
            if (word.includes(key) || key.includes(word)) {
              searchKeyword = value;
              break;
            }
          }
          if (searchKeyword) break;
        }

        // If no mapping found, use the longest meaningful word from predictions
        if (!searchKeyword) {
          searchKeyword = allWords.sort((a, b) => b.length - a.length)[0] || predictions[0].className;
        }
      }

      console.log('Image search navigating with keyword:', searchKeyword);

      setIsSearching(false);
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
      }
      onClose();

      // Navigate to SearchPage with the AI prediction as query
      if (searchKeyword) {
        navigate('/search.html?q=' + encodeURIComponent(searchKeyword));
      }

    } catch (err) {
      console.warn("Client-side Vision Analysis failed...", err);
      setIsSearching(false);
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
      }
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2 className="modal-title text-gradient">Visual AI Search</h2>
        <p className="modal-subtitle">Upload an image to find similar products instantly using our Local MobileNet Vision Engine.</p>
        
        <div 
          className={`dropzone ${isDragging ? 'dragging' : ''} ${isSearching ? 'searching' : ''} ${!model ? 'disabled' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
        >
          {isSearching ? (
            <div className="scanning-ui">
               {imagePreview && (
                 <img src={imagePreview} alt="Uploaded preview" style={{maxHeight: '160px', objectFit: 'contain', marginBottom: '1rem', borderRadius: '8px', zIndex: 1, position: 'relative'}} />
               )}
               <div className="scanner-line"></div>
               <p style={{marginTop: '1rem', zIndex: 1, position: 'relative'}}>Extracting visual features via MobileNet...</p>
            </div>
          ) : !model ? (
            <div className="loading-ui" style={{padding: '2rem'}}>
              <div className="spinner" style={{width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#00d2ff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem'}}></div>
              <p>Initializing AI Vision Engine...</p>
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <>
              <div className="upload-icon">📷</div>
              <h3>Drag & Drop</h3>
              <p>or <button className="text-btn" onClick={() => fileInputRef.current?.click()}>browse files</button></p>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{display: 'none'}} 
                accept="image/*"
                onChange={handleFileSelect}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
