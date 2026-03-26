import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft } from 'lucide-react';
import './AdminUpload.css'; // We'll style it similarly to Auth

export default function AdminUpload({ session }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState("Men's Fashion");
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

      // 3. AI Moderation Check
      setStatusMsg("Running AI Moderation check...");
      let isFlagged = false;
      let aiConfidence = 0.0;
      
      try {
        const aiResponse = await fetch('http://localhost:8000/api/moderate/product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             name: name,
             description: description,
             category: category
          })
        });
        const aiResult = await aiResponse.json();
        if (aiResult.status === 'success') {
           isFlagged = aiResult.ai_flagged;
           aiConfidence = aiResult.confidence;
        }
      } catch (aiErr) {
        console.warn("AI Moderation endpoint unreachable, defaulting to safe.", aiErr);
      }

      setStatusMsg("Saving product details...");

      // 4. Insert Product into Supabase Database
      const { error: dbError } = await supabase.from('products').insert([
        {
          name,
          description,
          price: parseFloat(price),
          category,
          image: publicUrl,
          rating: 0.0, // Default new product rating
          reviews: 0,
          retailer_id: session.user.id,
          status: 'pending',
          ai_flagged: isFlagged,
          ai_confidence: aiConfidence
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
        <div className="admin-header">
          <button className="back-btn" onClick={() => navigate('/manage')} title="Back to Manage Inventory">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-gradient" style={{ margin: 0 }}>Retailer Portal</h2>
        </div>
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
                <option value="Men's Fashion">Men's Fashion</option>
                <option value="Women's Fashion">Women's Fashion</option>
                <option value="Home & Kitchen">Home & Kitchen</option>
                <option value="Kid's Fashion">Kid's Fashion</option>
                <option value="Beauty & Health">Beauty & Health</option>
                <option value="Automotives">Automotives</option>
                <option value="Mobile Accessories">Mobile Accessories</option>
                <option value="Electronics">Electronics</option>
                <option value="Sports & Fitness">Sports & Fitness</option>
                <option value="Computers">Computers</option>
                <option value="Books">Books</option>
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
