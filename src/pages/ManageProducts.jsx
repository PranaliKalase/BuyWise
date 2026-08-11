import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, X } from 'lucide-react';
import './ManageProducts.css';

export default function ManageProducts({ session }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRetailer, setIsRetailer] = useState(null);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState("Men's Fashion");
  const [editImageFile, setEditImageFile] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editStatusMsg, setEditStatusMsg] = useState('');

  const navigate = useNavigate();

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
        fetchProducts();
      } else {
        navigate('/'); // Kick non-retailers out
      }
    };
    verifyRole();
  }, [session, navigate]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('retailer_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, imageUrl) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      // 1. Delete the product from the database
      const { error: dbError } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      // 2. Try to clean up the image from storage if it's stored in our bucket
      if (imageUrl && imageUrl.includes('supabase.co/storage/v1/object/public/product-images/')) {
        const urlParts = imageUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        await supabase
          .storage
          .from('product-images')
          .remove([`public/${fileName}`]);
      }

      // Update local state
      setProducts(products.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting product:', error.message);
      alert('Failed to delete product: ' + error.message);
    }
  };

  const handleToggleStock = async (id, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('products')
        .update({ in_stock: newStatus })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setProducts(products.map(p => 
        p.id === id ? { ...p, in_stock: newStatus } : p
      ));
    } catch (error) {
      console.error('Error updating stock status:', error.message);
      alert('Failed to update stock status.');
    }
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditDescription(product.description || '');
    setEditCategory(product.category || "Men's Fashion");
    setEditImageFile(null);
    setEditStatusMsg('');
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingProduct(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      setEditStatusMsg("Product name is required.");
      return;
    }
    
    setEditLoading(true);
    setEditStatusMsg("Saving changes...");

    try {
      let finalImageUrl = editingProduct.image;

      // 1. Upload new image if selected
      if (editImageFile) {
        setEditStatusMsg("Uploading new image...");
        const fileExt = editImageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `public/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, editImageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);
          
        finalImageUrl = publicUrl;

        // Try to delete old image
        if (editingProduct.image && editingProduct.image.includes('supabase.co/storage/v1/object/public/product-images/')) {
          const oldUrlParts = editingProduct.image.split('/');
          const oldFileName = oldUrlParts[oldUrlParts.length - 1];
          await supabase.storage.from('product-images').remove([`public/${oldFileName}`]);
        }
      }

      // 2. AI Moderation Check
      setEditStatusMsg("Running AI Moderation check...");
      let isFlagged = editingProduct.ai_flagged;
      let aiConfidence = editingProduct.ai_confidence;
      
      try {
        const aiResponse = await fetch('http://localhost:8000/api/moderate/product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             name: editName,
             description: editDescription,
             category: editCategory
          })
        });
        const aiResult = await aiResponse.json();
        if (aiResult.status === 'success') {
           isFlagged = aiResult.ai_flagged;
           aiConfidence = aiResult.confidence;
        }
      } catch (aiErr) {
        console.warn("AI Moderation endpoint unreachable, defaulting to previous safe state.", aiErr);
      }

      setEditStatusMsg("Updating database...");

      // 3. Update Product in Supabase
      const { error: dbError } = await supabase.from('products').update({
        name: editName,
        description: editDescription,
        category: editCategory,
        image: finalImageUrl,
        ai_flagged: isFlagged,
        ai_confidence: aiConfidence
      }).eq('id', editingProduct.id);

      if (dbError) throw dbError;

      // 4. Update local state
      setProducts(products.map(p => 
        p.id === editingProduct.id 
          ? { ...p, name: editName, description: editDescription, category: editCategory, image: finalImageUrl, ai_flagged: isFlagged, ai_confidence: aiConfidence } 
          : p
      ));

      setEditStatusMsg("Product updated successfully!");
      setTimeout(() => {
        closeEditModal();
      }, 1000);

    } catch (err) {
      console.error(err);
      setEditStatusMsg(`Error: ${err.message}`);
    } finally {
      setEditLoading(false);
    }
  };

  if (isRetailer !== true) return null;

  return (
    <div className="manage-container container">
      <div className="manage-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="back-btn" onClick={() => navigate('/')} title="Back to Storefront">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-gradient" style={{ margin: 0 }}>Manage Inventory</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/upload')}>
          Add New Product
        </button>
      </div>

      {loading ? (
        <div className="manage-loading">Loading inventory...</div>
      ) : products.length === 0 ? (
        <div className="glass-panel manage-empty">
          <p>No products found in your inventory.</p>
        </div>
      ) : (
        <div className="manage-list">
          {products.map(product => (
            <div key={product.id} className={`manage-item glass-panel ${product.in_stock === false ? 'out-of-stock' : ''}`}>
              <div className="item-image-wrapper">
                 <img src={product.image} alt={product.name} className="item-image" />
              </div>
              <div className="item-details">
                <span className="item-category">{product.category}</span>
                <h3 className="item-name">{product.name}</h3>
                <p className="item-price">₹{product.price.toFixed(2)}</p>
              </div>
              <div className="item-actions">
                <button 
                  className={`btn ${product.in_stock === false ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleToggleStock(product.id, product.in_stock !== false)}
                >
                  {product.in_stock === false ? 'Mark in Stock' : 'Mark Out of Stock'}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => openEditModal(product)}
                >
                  Edit
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={() => handleDelete(product.id, product.image)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isEditModalOpen && editingProduct && (
        <div className="edit-modal-overlay" onClick={closeEditModal}>
          <div className="edit-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="text-gradient" style={{ margin: 0 }}>Edit Product</h2>
              <button onClick={closeEditModal} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            {editStatusMsg && (
              <div className={`admin-status ${editStatusMsg.includes('Error') ? 'error' : 'success'} glass-panel`}>
                {editStatusMsg}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="admin-form">
              <div className="form-group">
                <label>Current Image</label>
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <img src={editingProduct.image} alt={editingProduct.name} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                  <div style={{ flex: 1 }}>
                    <label htmlFor="edit-image" style={{ fontSize: '0.85rem' }}>Upload New Image (Optional)</label>
                    <input 
                      type="file" 
                      id="edit-image" 
                      accept="image/*"
                      onChange={(e) => setEditImageFile(e.target.files[0])}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="edit-name">Product Name</label>
                <input 
                  type="text" 
                  id="edit-name" 
                  required 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-category">Category</label>
                <select 
                  id="edit-category" 
                  value={editCategory} 
                  onChange={(e) => setEditCategory(e.target.value)}
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

              <div className="form-group">
                <label htmlFor="edit-desc">Description</label>
                <textarea 
                  id="edit-desc" 
                  required 
                  rows="3"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
