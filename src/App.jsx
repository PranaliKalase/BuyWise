import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import './App.css'
import Header from './components/Header'
import CategoryStrip from './components/CategoryStrip'
import Hero from './components/Hero'
import ProductGrid from './components/ProductGrid'
import ShoppingAssistant from './components/ShoppingAssistant'
import ImageSearchModal from './components/ImageSearchModal'
import Cart from './components/Cart'
import Auth from './pages/Auth'
import AdminUpload from './pages/AdminUpload'
import ManageProducts from './pages/ManageProducts'
import RetailerDashboard from './pages/RetailerDashboard'
import SearchPage from './pages/SearchPage'
import FavoritesPage from './pages/FavoritesPage'
import Checkout from './pages/Checkout'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { supabase } from './lib/supabaseClient'
import { MOCK_PRODUCTS } from './mockData/products'

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <FavoritesProvider>
      <CartProvider>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Home session={session} />} />
            <Route path="/search.html" element={<SearchPage session={session} />} />
            <Route path="/favorites.html" element={<FavoritesPage session={session} />} />
            <Route path="/checkout" element={<Checkout session={session} />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/upload" element={<AdminUpload session={session} />} />
            <Route path="/manage" element={<ManageProducts session={session} />} />
            <Route path="/retailer-dashboard" element={<RetailerDashboard session={session} />} />
          </Routes>
          <Cart />
        </div>
      </CartProvider>
    </FavoritesProvider>
  )
}
function Home({ session }) {
  const navigate = useNavigate();
  const [isImageSearchOpen, setImageSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchTitle, setSearchTitle] = useState("Search Results");
  const [categoryGrids, setCategoryGrids] = useState([]);
  const [flashSales, setFlashSales] = useState([]);

  useEffect(() => {
    // Fetch from Supabase
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Supabase fetch error:", error);
          throw error;
        }

        if (data && data.length > 0) {
           const groupMap = {};
           
           // Legacy Migration map
           const CAT_MAP = {
              'wearables': 'Sports & Fitness',
              'smart home': 'Home & Kitchen',
              'home': 'Home & Kitchen',
              'vehicles': 'Automotives',
              'fashion': "Men's Fashion",
              'gaming': 'Computers & Gaming',
              'audio': 'Electronics',
              'apparel': "Men's Fashion"
           };

           data.forEach(p => {
              let rawCat = (p.category || "General").toLowerCase();
              let canonicalCat = p.category; // fallback to original
              
              if (CAT_MAP[rawCat]) canonicalCat = CAT_MAP[rawCat];
              if (rawCat === 'electronics') canonicalCat = 'Electronics';
              
              const cat = canonicalCat;
              
              if (!groupMap[cat]) groupMap[cat] = [];
              groupMap[cat].push(p);
           });
           
           // Convert isolated bucket object to array map 
           const grids = Object.keys(groupMap).map(catName => ({
              title: catName,
              products: groupMap[catName].slice(0, 10) // Limit rows
           }));
           
           grids.sort((a,b) => b.products.length - a.products.length);
           setCategoryGrids(grids);

        } else {
           setCategoryGrids([]);
        }
      } catch (e) {
        console.warn("Failed to reach Supabase database. Are the keys setup?", e);
      }
    };
    
    const fetchFlashSales = async () => {
      try {
        const { data, error } = await supabase
          .from('flash_sales')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          setFlashSales(data);
        }
      } catch (e) {
        console.warn("Failed to fetch flash sales", e);
      }
    };

    fetchProducts();
    fetchFlashSales();
  }, []);

  return (
    <>
      <Header 
        session={session} 
        onOpenImageSearch={() => {
          setImageSearchOpen(true);
          setSearchTitle("Visual AI Search Results");
        }}
      />
      <main className="main-content">
        <CategoryStrip />
        <Hero />
        
        {flashSales.length > 0 && (
          <div className="container" style={{ margin: '2rem auto' }}>
            <h2 className="text-gradient" style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>Special Events & Flash Sales</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {flashSales.map(sale => (
                <div key={sale.id} className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', overflow: 'hidden', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  {sale.discount_percentage > 0 && (
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#ef4444', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.85rem', zIndex: 2 }}>
                      {sale.discount_percentage}% OFF
                    </div>
                  )}
                  {sale.image_url && <img src={sale.image_url} alt={sale.title} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px' }} />}
                  {!sale.image_url && <div style={{width: '100%', height: '120px', background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(236,72,153,0.2))', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem'}}>🎉</div>}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-color)' }}>{sale.title}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: '1.5' }}>{sale.description}</p>
                  </div>
                  <button className="btn btn-primary" onClick={() => navigate('/search.html')} style={{ marginTop: 'auto', width: '100%' }}>
                    Shop Event
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {searchResults && (
          <ProductGrid 
            title={searchTitle} 
            products={searchResults} 
            personalized={true} 
          />
        )}

        {categoryGrids.map((grid, idx) => (
           <ProductGrid 
             key={idx}
             title={grid.title} 
             products={grid.products} 
             personalized={false} 
           />
        ))}

      </main>
      
      <ShoppingAssistant />
      <ImageSearchModal 
        isOpen={isImageSearchOpen} 
        onClose={() => setImageSearchOpen(false)} 
        onSearchResults={setSearchResults}
      />
    </>
  )
}

export default App
