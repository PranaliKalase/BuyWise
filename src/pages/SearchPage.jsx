import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/Header';
import './SearchPage.css';

const extractAttributes = (product) => {
  const attrs = [];
  const desc = (product.description || '').toLowerCase();
  const cat = (product.category || '').toLowerCase();

  if (cat.includes('electronic') || cat.includes('computer') || cat.includes('phone') || cat.includes('laptop') || cat.includes('audio') || cat.includes('smart')) {
    const ramMatch = desc.match(/(\d+\s*(?:gb|tb))\s*ram/i) || desc.match(/ram:?\s*(\d+\s*(?:gb|tb))/i);
    if (ramMatch) attrs.push({ label: 'RAM', value: ramMatch[1].toUpperCase() });
    
    const storageMatch = desc.match(/(\d+\s*(?:gb|tb))\s*(?:storage|ssd|hdd)/i);
    if (storageMatch) attrs.push({ label: 'Storage', value: storageMatch[1].toUpperCase() });
    
    const batteryMatch = desc.match(/(\d+(?:\.\d+)?)\s*(?:mah|hours?)\s*battery/i) || desc.match(/battery\s*life[^\d]*(\d+(?:\.\d+)?)\s*(?:hours?)/i);
    if (batteryMatch) attrs.push({ label: 'Battery', value: batteryMatch[1] + (batteryMatch[0].toLowerCase().includes('mah') ? ' mAh' : ' Hours') });
  } else if (cat.includes('apparel') || cat.includes('shoe') || cat.includes('fashion') || cat.includes('clothing') || cat.includes('wearable')) {
    const materialMatch = desc.match(/(?:made of|material:?)\s*([a-z]+)/i);
    if (materialMatch && !['the', 'a', 'an'].includes(materialMatch[1])) {
      attrs.push({ label: 'Material', value: materialMatch[1].charAt(0).toUpperCase() + materialMatch[1].slice(1) });
    }
  } else if (cat.includes('home') || cat.includes('appliance')) {
    const capacityMatch = desc.match(/(\d+)\s*(?:liters?|l)\s*capacity/i);
    if (capacityMatch) attrs.push({ label: 'Capacity', value: capacityMatch[1] + 'L' });
  }

  // Common fallbacks if no structured regex match
  if (attrs.length === 0) {
     if (desc.length > 80) {
        attrs.push({ label: 'Overview', value: desc.substring(0, 80) + '...' });
     } else if (desc) {
        attrs.push({ label: 'Overview', value: desc });
     } else {
        attrs.push({ label: 'Specs', value: 'Standard Specifications' });
     }
  }

  return attrs;
};

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

        let finalProducts = data || [];

        // Strict Category Filter (Match AI Assistant logic)
        const lowerQ = cleanQuery.toLowerCase();
        const mentionsShoes = lowerQ.includes('shoe') || lowerQ.includes('sneaker') || lowerQ.includes('boot') || lowerQ.includes('footwear') || lowerQ.includes('sandal');
        const mentionsClothing = lowerQ.includes('cloth') || lowerQ.includes('shirt') || lowerQ.includes('dress') || lowerQ.includes('hoodie') || lowerQ.includes('pant');

        if (mentionsShoes && !mentionsClothing) {
           finalProducts = finalProducts.filter(m => {
              const n = (m.name || '').toLowerCase();
              const c = (m.category || '').toLowerCase();
              // HARD FILTER: Must mention footwear in NAME or CATEGORY (exclude description for strictness)
              return n.includes('shoe') || n.includes('sneaker') || n.includes('boot') || n.includes('footwear') || n.includes('sandal') || 
                     c.includes('shoe') || c.includes('footwear');
           });
        } else if (mentionsClothing && !mentionsShoes) {
           finalProducts = finalProducts.filter(m => {
              const n = (m.name || '').toLowerCase();
              const c = (m.category || '').toLowerCase();
              return n.includes('shirt') || n.includes('dress') || n.includes('pant') || n.includes('hoodie') || n.includes('top') || n.includes('tshirt') || n.includes('jeans') ||
                     c.includes('apparel') || c.includes('clothing');
           });
        }

        setProducts(finalProducts);

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
      // 1. MUST MATCH CATEGORY
      let queryBase = supabase
        .from('products')
        .select('*')
        .neq('id', product.id)
        .eq('status', 'approved');

      if (product.category) {
        queryBase = queryBase.eq('category', product.category);
      }

      const targetName = (product.name || '').toLowerCase();
      
      // 2. EXTRACT PRODUCT TYPE DYNAMICALLY
      // Stop words to avoid matching generic terms
      const stopWords = ['new', 'sale', 'the', 'and', 'with', 'for', 'pro', 'max', 'plus', 'ultra', 'smart', 'wireless', 'bluetooth', 'mens', 'womens', 'kids'];
      const nameWords = targetName.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stopWords.includes(w));
      const lastWord = nameWords.length > 0 ? nameWords[nameWords.length - 1] : null;

      // 3. TRY EXACT PRODUCT TYPE MATCH WITHIN CATEGORY
      let comparisonList = [product];
      
      if (lastWord) {
        // Find products in the same category that share the main product type (noun)
        const { data, error } = await queryBase.ilike('name', `%${lastWord}%`).limit(2);
        
        if (!error && data && data.length > 0) {
          comparisonList = [product, ...data];
        }
      }
      
      // 4. INTELLIGENT FALLBACK: If no exact product type match, just get anything in the same category
      if (comparisonList.length === 1 && product.category) {
        const fallbackQuery = supabase
          .from('products')
          .select('*')
          .neq('id', product.id)
          .eq('status', 'approved')
          .eq('category', product.category)
          .limit(2);
          
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        if (!fallbackError && fallbackData && fallbackData.length > 0) {
          comparisonList = [product, ...fallbackData];
        }
      }

      setComparisonList(comparisonList);
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
                     <div className="dynamic-attributes" style={{ fontSize: '0.9rem', color: 'var(--text-main)', flex: 1, marginTop: '0.5rem' }}>
                       <div style={{ marginBottom: '6px' }}>
                         <strong>Category:</strong> {item.category || "General"}
                       </div>
                       <div style={{ marginBottom: '6px' }}>
                         <strong>Rating:</strong> ⭐ {item.rating || 0} <span style={{color: 'var(--text-muted)'}}>({item.reviews || 0} reviews)</span>
                       </div>
                       {extractAttributes(item).map((attr, i) => (
                         <div key={i} style={{ marginBottom: '6px' }}>
                           <strong>{attr.label}:</strong> <span style={{color: 'var(--text-muted)'}}>{attr.value}</span>
                         </div>
                       ))}
                     </div>
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
