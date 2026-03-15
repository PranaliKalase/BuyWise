import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './ManageProducts.css';

export default function ManageProducts({ session }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRetailer, setIsRetailer] = useState(null);
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

  if (isRetailer !== true) return null;

  return (
    <div className="manage-container container">
      <div className="manage-header">
        <h1 className="text-gradient">Manage Inventory</h1>
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
    </div>
  );
}
