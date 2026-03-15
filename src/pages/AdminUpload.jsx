import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './AdminUpload.css'; // We'll style it similarly to Auth

export default function AdminUpload({ session }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('electronics');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isRetailer, setIsRetailer] = useState(null);
  
  const navigate = useNavigate();

  // Route Protection: Ensure User is a Retailer
  useEffect(() => {
    const verifyRole = async () => {
      if (!session) {
        navigate('/auth');
        return;
      }
      
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
        
      const role = data?.role || session.user.user_metadata?.role;
      
      if (role === 'retailer') {
        setIsRetailer(true);
      } else {
        navigate('/'); // Kick non-retailers out to the storefront
      }
    };
    verifyRole();
  }, [session, navigate]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      setStatusMsg("Please select an image file.");
      return;
    }
    
    setLoading(true);
    setStatusMsg("Uploading image to Storage...");

    try {
      // 1. Upload Image to Supabase Storage
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      // 2. Get Public URL for the uploaded image
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setStatusMsg("Image uploaded. Saving product details...");

      // 3. Insert Product into Supabase Database
      const { error: dbError } = await supabase.from('products').insert([
        {
          name,
          description,
          price: parseFloat(price),
          category,
          image: publicUrl,
          rating: 0.0, // Default new product rating
          reviews: 0,
          retailer_id: session.user.id
        }
      ]);

      if (dbError) throw dbError;

      setStatusMsg("Product added successfully!");
      // Reset form
      setName('');
      setDescription('');
      setPrice('');
      setCategory('electronics');
      setImageFile(null);
      e.target.reset(); // Clear file input visually

    } catch (err) {
      console.error(err);
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (isRetailer !== true) {
    return null; // Don't render while redirecting or checking
  }

  return (
    <div className="admin-container">
      <div className="admin-card glass-panel">
        <h2 className="text-gradient">Retailer Portal</h2>
        <p className="admin-subtitle">Add a new product to the storefront catalog.</p>

        {statusMsg && (
          <div className={`admin-status ${statusMsg.includes('Error') ? 'error' : 'success'} glass-panel`}>
            {statusMsg}
          </div>
        )}

        <form onSubmit={handleUpload} className="admin-form">
          <div className="form-group">
            <label htmlFor="name">Product Name</label>
            <input 
              type="text" 
              id="name" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quantum Hoverboard"
            />
          </div>

          <div className="form-group row">
            <div className="form-group flex-1">
              <label htmlFor="price">Price (₹)</label>
              <input 
                type="number" 
                id="price" 
                required 
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="299.99"
              />
            </div>
            
            <div className="form-group flex-1">
              <label htmlFor="category">Category</label>
              <select 
                id="category" 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="electronics">Electronics</option>
                <option value="wearables">Wearables</option>
                <option value="home">Smart Home</option>
                <option value="vehicles">Vehicles</option>
                <option value="fashion">Fashion</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="desc">Description</label>
            <textarea 
              id="desc" 
              required 
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the main features..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="image">Product Image</label>
            <input 
              type="file" 
              id="image" 
              accept="image/*"
              required
              onChange={(e) => setImageFile(e.target.files[0])}
            />
          </div>

          <button type="submit" className="btn btn-primary admin-btn" disabled={loading}>
            {loading ? 'Uploading...' : 'Publish Product'}
          </button>
        </form>
      </div>
    </div>
  );
}
