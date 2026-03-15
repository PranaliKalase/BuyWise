import { useState, useEffect } from 'react'
import './App.css'
import Header from './components/Header'
import Hero from './components/Hero'
import ProductGrid from './components/ProductGrid'
import ShoppingAssistant from './components/ShoppingAssistant'
import ImageSearchModal from './components/ImageSearchModal'
import { MOCK_PRODUCTS } from './mockData/products'

function App() {
  const [isImageSearchOpen, setImageSearchOpen] = useState(false);
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [recommended, setRecommended] = useState(MOCK_PRODUCTS.filter(p => p.matchScore && p.matchScore > 90));
  const [searchResults, setSearchResults] = useState(null);

  useEffect(() => {
    // Attempt to fetch from Python Backend
    const fetchData = async () => {
      try {
        const prodRes = await fetch('http://localhost:8000/api/products');
        if (prodRes.ok) {
          const prods = await prodRes.json();
          setProducts(prods);
        }
        
        // Fetch recommendations based on a popular product (e.g. p1)
        const recRes = await fetch('http://localhost:8000/api/recommendations/p1');
        if (recRes.ok) {
          const recData = await recRes.json();
          if (recData.results) {
            setRecommended(recData.results);
          }
        }
      } catch (e) {
        console.log("Backend not running, using local mock data.");
      }
    };
    fetchData();
  }, []);

  return (
    <div className="app-container">
      <Header onOpenImageSearch={() => setImageSearchOpen(true)} />
      <main className="main-content">
        <Hero />
        
        {searchResults && (
          <ProductGrid 
            title="Visual AI Search Results" 
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
    </div>
  )
}

export default App
