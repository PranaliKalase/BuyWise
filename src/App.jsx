import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import './App.css'
import Header from './components/Header'
import Hero from './components/Hero'
import ProductGrid from './components/ProductGrid'
import ShoppingAssistant from './components/ShoppingAssistant'
import ImageSearchModal from './components/ImageSearchModal'
import Cart from './components/Cart'
import Auth from './pages/Auth'
import AdminUpload from './pages/AdminUpload'
import ManageProducts from './pages/ManageProducts'
import { CartProvider } from './context/CartContext'
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
    <CartProvider>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home session={session} />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/upload" element={<AdminUpload session={session} />} />
          <Route path="/manage" element={<ManageProducts session={session} />} />
        </Routes>
        <Cart />
      </div>
    </CartProvider>
  )
}

function Home({ session }) {
  const [isImageSearchOpen, setImageSearchOpen] = useState(false);
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [recommended, setRecommended] = useState(MOCK_PRODUCTS.filter(p => p.matchScore && p.matchScore > 90));
  const [searchResults, setSearchResults] = useState(null);
  const [searchTitle, setSearchTitle] = useState("Search Results");

  const handleTextSearch = (query) => {
    if (!query || !query.trim()) {
      setSearchResults(null);
      return;
    }
    const q = query.toLowerCase();
    const matches = products.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) || 
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
    setSearchResults(matches);
    setSearchTitle(`Results for "${query}"`);
  };

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
          setProducts(data);
          
          // Generate mock recommendations by just picking random items for now
          // (Since we don't have python TFIDF backend running)
          const shuffled = [...data].sort(() => 0.5 - Math.random());
          const mockRecs = shuffled.slice(0, 3).map(p => ({
            ...p,
            matchScore: Math.floor(Math.random() * (99 - 85 + 1)) + 85
          }));
          setRecommended(mockRecs);
        } else {
           // Fallback to mock data if table is empty
           console.log("No data in Supabase yet, showing local mocks.");
        }
      } catch (e) {
        console.warn("Failed to reach Supabase database. Are the keys setup?", e);
      }
    };
    
    fetchProducts();
  }, []);

  return (
    <>
      <Header 
        session={session} 
        onOpenImageSearch={() => {
          setImageSearchOpen(true);
          setSearchTitle("Visual AI Search Results");
        }} 
        onSearch={handleTextSearch}
      />
      <main className="main-content">
        <Hero />
        
        {searchResults && (
          <ProductGrid 
            title={searchTitle} 
            products={searchResults} 
            personalized={true} 
          />
        )}

        <ProductGrid 
          title="Top Matches for You" 
          products={recommended} 
          personalized={true} 
        />
        <ProductGrid 
          title="Trending Now" 
          products={products} 
          personalized={false} 
        />
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
