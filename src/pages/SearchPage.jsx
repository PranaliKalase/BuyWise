import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/Header';
import './SearchPage.css';

export default function SearchPage({ session }) {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const category = searchParams.get('cat') || '';
  const pids = searchParams.get('pids') || '';
  const eventName = searchParams.get('event') || '';
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { addToCart, setIsCartOpen } = useCart();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [compareProduct, setCompareProduct] = useState(null);
  const [comparisonList, setComparisonList] = useState([]);

  useEffect(() => {
    const fetchSearchResults = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Handle product list by IDs (Flash Sales)
        if (pids) {
          const idList = pids.split(',').filter(id => id.length > 0);
          if (idList.length > 0) {
            const { data, error: dbError } = await supabase
              .from('products')
              .select('*')
              .in('id', idList)
              .eq('status', 'approved');

            if (dbError) throw dbError;
            setProducts(data || []);
            setLoading(false);
            return;
          }
        }

        // If category filter is used (from CategoryStrip), do exact category match
        if (category) {
          const { data, error: dbError } = await supabase
            .from('products')
            .select('*')
            .eq('status', 'approved')
            .ilike('category', category);

          if (dbError) throw dbError;
          setProducts(data || []);
          setLoading(false);
          return;
        }

        if (!query.trim()) {
          setProducts([]);
          setLoading(false);
          return;
        }

        // Clean query: remove punctuation that voice recognition might add
        const cleanQuery = query.replace(/[.,!?;:]+/g, '').trim();

        if (!cleanQuery) {
          setProducts([]);
          setLoading(false);
          return;
        }

        // First try full phrase match
        let { data, error: dbError } = await supabase
          .from('products')
          .select('*')
          .eq('status', 'approved')
          .or(`name.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%,category.ilike.%${cleanQuery}%`);

        if (dbError) throw dbError;

        // If no results and query has multiple words, try individual word search
        if ((!data || data.length === 0) && cleanQuery.includes(' ')) {
          const words = cleanQuery.split(/\s+/).filter(w => w.length > 2);
          if (words.length > 0) {
            const orConditions = words.map(w => 
              `name.ilike.%${w}%,description.ilike.%${w}%,category.ilike.%${w}%`
            ).join(',');
            
            const result = await supabase
              .from('products')
              .select('*')
              .eq('status', 'approved')
              .or(orConditions);

            if (!result.error) data = result.data;
          }
        }

        setProducts(data || []);

      } catch (err) {
        console.error("Error fetching from Supabase:", err);
        setError("Failed to fetch search results. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [searchParams]);

  const handleCompare = async (product) => {
    setCompareProduct(product);
    try {
      let queryBase = supabase.from('products').select('*').neq('id', product.id);
      
      const targetName = (product.name || '').toLowerCase();
      const nameWords = targetName.split(/[^a-z0-9]+/).filter(w => w.length > 2);
      
      // Extract exact noun type 
      const isShoe = targetName.includes('shoe') || targetName.includes('sneaker') || targetName.includes('boot');
      const isShirt = targetName.includes('shirt') || targetName.includes('hoodie');
      const isPant = targetName.includes('pant') || targetName.includes('jeans') || targetName.includes('trouser');
      const isWatch = targetName.includes('watch') || targetName.includes('smartwatch');

      if (isShoe) {
         queryBase = queryBase.or('name.ilike.%shoe%,name.ilike.%sneaker%,name.ilike.%boot%');
      } else if (isShirt) {
         queryBase = queryBase.or('name.ilike.%shirt%,name.ilike.%hoodie%');
      } else if (isPant) {
         queryBase = queryBase.or('name.ilike.%pant%,name.ilike.%jeans%,name.ilike.%trouser%');
      } else if (isWatch) {
         queryBase = queryBase.ilike('name', '%watch%');
      } else if (nameWords.length > 0) {
         // Dynamic Fallback: For things like 'Piano' or 'Perfume', forcefully limit results to items 
         // that share at least one significant identifying word in their names natively
         const orConditions = nameWords.map(w => `name.ilike.%${w}%`).join(',');
         queryBase = queryBase.or(orConditions);
      } else {
         // If absolutely no valid name words exist to match, we can try matching strict categories. 
         // But if no category exists, we abort the compare to prevent random weird items (like Piano with Perfume)
         if (product.category) {
            queryBase = queryBase.eq('category', product.category);
         } else {
            setComparisonList([product]);
            return;
         }
      }

      // Fetch up to 2 strictly matching products
      const { data, error } = await queryBase.limit(2);
      
      if (!error && data) {
        setComparisonList([product, ...data]);
      } else {
        setComparisonList([product]);
      }
    } catch (e) {
      setComparisonList([product]);
    }
  };

  // Handle Search coming from the Header within the SearchPage itself
  const handleSearch = (newQuery) => {
    navigate(`/search.html?q=${encodeURIComponent(newQuery)}`);
  };

  return (
    <div className="search-page-container">
      <Header session={session} onSearch={handleSearch} />
      
      <main className="search-main container">
        <div className="search-header-text">
          <h2>{eventName ? `${eventName}` : (category ? `${category}` : (query ? `Search Results for "${query}"` : 'All Products'))}</h2>
          {!loading && !error && (
            <span className="results-count">{products.length} products found</span>
          )}
        </div>

        {loading && (
          <div className="search-loading">
            <div className="spinner"></div>
            <p>Searching database...</p>
          </div>
        )}

        {error && (
          <div className="search-error">
            <p>⚠️ {error}</p>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="search-empty">
            <span className="empty-icon">📂</span>
            <h3>No products found</h3>
            <p>We couldn't find any items matching "{query}". Try checking your spelling or using more general terms.</p>
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="search-results-grid">
            {products.map((product) => (
              <div key={product.id} className="search-product-card">
                <div className="card-image-wrapper">
                  <img src={product.image_url || product.image || 'https://via.placeholder.com/400?text=No+Image'} alt={product.name} loading="lazy" />
                </div>
                <div className="card-details">
                  <h3 className="card-title" title={product.name}>{product.name}</h3>
                  <div className="card-price">₹{parseFloat(product.price).toLocaleString('en-IN')}</div>
                  <div className="card-actions">
                    <button className="btn-primary" onClick={() => setSelectedProduct(product)}>
                      View Details
                    </button>
                    <button className="btn-outline" onClick={() => handleCompare(product)}>
                      Compare
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* View Details Modal */}
      {selectedProduct && (
        <div className="search-modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="search-modal-content" onClick={e => e.stopPropagation()}>
            <button className="search-modal-close" onClick={() => setSelectedProduct(null)}>×</button>
            <h2>{selectedProduct.name}</h2>
            <div className="details-grid">
              <img 
                src={selectedProduct.image_url || selectedProduct.image || 'https://via.placeholder.com/400?text=No+Image'} 
                alt={selectedProduct.name} 
                className="details-image"
              />
              <div className="details-info">
                <p className="details-price">₹{parseFloat(selectedProduct.price).toLocaleString('en-IN')}</p>
                <div>
                  <strong>Category:</strong> {selectedProduct.category || "General"}
                </div>
                <div>
                  <strong>Description:</strong> 
                  <p>{selectedProduct.description || "No specific features listed for this product."}</p>
                </div>
                <button 
                  className="btn-primary" 
                  style={{marginTop: 'auto', padding: '0.8rem'}}
                  onClick={() => {
                    addToCart(selectedProduct);
                    setSelectedProduct(null);
                    setIsCartOpen(true);
                  }}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {compareProduct && (
         <div className="search-modal-overlay" onClick={() => setCompareProduct(null)}>
          <div className="search-modal-content compare-modal" onClick={e => e.stopPropagation()}>
            <button className="search-modal-close" onClick={() => setCompareProduct(null)}>×</button>
            <h2>Compare Similar Items</h2>
            
            {comparisonList.length === 1 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <span style={{ fontSize: '3rem', opacity: 0.5 }}>🤷‍♂️</span>
                <h3 style={{ marginTop: '1rem', color: '#333' }}>No similar products found</h3>
                <p style={{ color: '#666' }}>We currently do not have any other products in our active stock matching this specific style or category to compare against.</p>
              </div>
            ) : (
              <div className="compare-grid">
                {comparisonList.map((item, idx) => (
                  <div key={idx} className="compare-col" style={idx === 0 ? {borderColor: 'var(--color-primary)', borderWidth: '2px'} : {}}>
                     {idx === 0 && <span style={{fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 'bold'}}>Your Selection</span>}
                     <img 
                       src={item.image_url || item.image || 'https://via.placeholder.com/400?text=No+Image'} 
                       alt={item.name} 
                       style={{width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px'}}
                     />
                     <h3 style={{fontSize: '1.1rem'}}>{item.name}</h3>
                     <div style={{fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--color-primary)'}}>
                       ₹{parseFloat(item.price).toLocaleString('en-IN')}
                     </div>
                     <p style={{fontSize: '0.9rem', color: 'var(--text-muted)', flex: 1}}>
                       {item.description || "N/A"}
                     </p>
                     <button 
                       className={idx === 0 ? "btn-primary" : "btn-outline"}
                       onClick={() => {
                         addToCart(item);
                         setCompareProduct(null);
                         setIsCartOpen(true);
                       }}
                     >
                       Add to Cart
                     </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
