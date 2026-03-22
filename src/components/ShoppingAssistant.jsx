import React, { useState, useRef, useEffect } from 'react';
import './ShoppingAssistant.css';
import { supabase } from '../lib/supabaseClient';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';

export default function ShoppingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      text: "Hi! 👋 What would you like to shop for today?\n\nTip: You can say \"Show my favorites\" to view items you've saved!",
      products: [] 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const { addToCart, setIsCartOpen } = useCart();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  // State Machine for Sequential Conversation
  const [chatState, setChatState] = useState({
    activeCategory: null, 
    stepIndex: 0,
    collectedData: {}
  });

  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isOpen, isTyping]);

  const SHOE_QUESTIONS = [
    { key: 'type', text: "Great choice! 👟 What type of shoes are you looking for? (sports, casual, formal, sneakers, etc.)" },
    { key: 'size', text: "Nice! What is your shoe size?" },
    { key: 'brand_budget', text: "Got it 👍 Any preferred brand or budget range?" },
    { key: 'color_features', text: "Almost done. Any specific color preference or features? (comfort, running, party wear)" }
  ];

  const CLOTHING_QUESTIONS = [
    { key: 'type', text: "Awesome! 👕 What type of clothing are you looking for? (t-shirt, dress, hoodie, etc.)" },
    { key: 'size_fit', text: "What size do you wear, and do you have a preferred fit? (slim, regular, oversized)" },
    { key: 'color_occasion', text: "Got it! Any color preference? And what is the occasion? (casual, formal, party, gym)" },
    { key: 'budget', text: "Finally, what is your budget range?" }
  ];

  const processInput = async (inputText) => {
    const lowerText = inputText.toLowerCase();

    // Favorites Intercept
    if (lowerText.includes('show my favorite') || lowerText.includes('view wishlist') || lowerText.includes('show my favorites') || lowerText.includes('show favorites')) {
       if (favorites.length === 0) {
          return { text: "You haven't added any favorites yet ❤️\nTry searching for some items first and tap the ❤️ icon to save them!" };
       } else {
          return { 
             text: "Here are your favorite items ❤️\nYou can easily move them to your Cart by tapping 🛒!",
             products: favorites 
          };
       }
    }

    const currentState = { ...chatState };

    // 1. If we are just starting
    if (!currentState.activeCategory) {
      if (lowerText.includes('shoe') || lowerText.includes('sneaker') || lowerText.includes('boot')) {
        currentState.activeCategory = 'shoes';
        setChatState(currentState);
        return { text: SHOE_QUESTIONS[0].text };
      } else if (lowerText.includes('cloth') || lowerText.includes('shirt') || lowerText.includes('dress') || lowerText.includes('hoodie') || lowerText.includes('pant') || lowerText.includes('jeans')) {
        currentState.activeCategory = 'clothing';
        setChatState(currentState);
        return { text: CLOTHING_QUESTIONS[0].text };
      } else {
        // Broad search intercept
        currentState.activeCategory = 'general';
        setChatState(currentState);
        return { text: "I can help you find Shoes or Clothing perfectly! Which one are you looking for?" };
      }
    }

    // 2. We are in an active workflow
    let questionsList = [];
    if (currentState.activeCategory === 'shoes') questionsList = SHOE_QUESTIONS;
    else if (currentState.activeCategory === 'clothing') questionsList = CLOTHING_QUESTIONS;
    
    // Save user response
    if (questionsList.length > 0 && currentState.stepIndex < questionsList.length) {
      const currentQKey = questionsList[currentState.stepIndex].key;
      currentState.collectedData[currentQKey] = inputText;
      currentState.stepIndex += 1;
      
      if (currentState.stepIndex < questionsList.length) {
        setChatState(currentState);
        return { text: questionsList[currentState.stepIndex].text };
      }
    }

    // 3. Workflow is complete -> query Supabase
    let dbProducts = [];
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (data && !error) dbProducts = data;
    } catch (e) {
      console.error(e);
    }

    const prefsText = Object.values(currentState.collectedData).join(" ") + " " + inputText;
    const lowerPrefs = prefsText.toLowerCase();

    const numbers = lowerPrefs.match(/\d+/g);
    let budget = null;
    let size = null;
    
    if (numbers) {
       numbers.forEach(n => {
          const num = parseInt(n, 10);
          if (num >= 100) budget = num; 
          else if (num > 0 && num < 100) size = num; 
       });
    }

    const ignoreList = ['the', 'and', 'for', 'with', 'under', 'size', 'price', 'budget', 'looking', 'buy', 'want', 'show', 'shoes', 'clothing', 'shirt', 'pant'];
    const rawWords = lowerPrefs.match(/[a-z]+/g) || [];
    const keywords = rawWords.filter(w => w.length > 2 && !ignoreList.includes(w));

    let matches = [...dbProducts];

    if (budget) {
      matches = matches.filter(p => parseFloat(p.price) <= budget);
    }

    if (keywords.length > 0) {
      matches.forEach(m => {
        m.score = 0;
        const nameDesc = ((m.name || '') + ' ' + (m.description || '') + ' ' + (m.category || '')).toLowerCase();
        
        keywords.forEach(kw => {
          if (nameDesc.includes(kw)) m.score += 1;
        });
        
        if (size && nameDesc.includes(parseInt(size, 10).toString())) {
             m.score += 2; 
        }
      });
      matches = matches.filter(m => m.score > 0);
      matches.sort((a, b) => b.score - a.score);
    } else if (size) {
      matches = matches.filter(m => ((m.name || '') + ' ' + (m.description || '')).toLowerCase().includes(size.toString()));
    }

    setChatState({ activeCategory: null, stepIndex: 0, collectedData: {} });

    if (matches.length > 0) {
      const topMatches = matches.slice(0, Math.min(matches.length, 3));
      
      let summaryText = `Here are some great options matching your preferences:\n`;
      summaryText += `Tap ❤️ to save to Favorites | Tap 🛒 to add to Cart\n`;
      
      return {
        text: summaryText,
        products: topMatches
      };
    } else {
      let failMsg = `I'm sorry, we couldn't find any products in stock right now that match those exact requirements`;
      if (budget) failMsg += ` (under ₹${budget})`;
      failMsg += `.\n\nWould you like to try searching for something else with broader criteria?`;
      return { text: failMsg };
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const currentInput = inputValue;
    setMessages(prev => [...prev, { role: 'user', text: currentInput }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await processInput(currentInput);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: response.text,
        products: response.products || []
      }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'assistant', text: "I'm having trouble connecting to the database right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderTextFormating = (text) => {
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  // Heart formatting hook for internal UI
  const handleHeartClick = (product) => {
     const isNowFav = toggleFavorite(product);
     // Inject a system confirmation string into chat 
     // We bypass `processInput` directly into standard messages
     setMessages(prev => [...prev, {
        role: 'assistant',
        text: isNowFav ? `Added ${product.name} to your Favorites ❤️` : `Removed ${product.name} from Favorites 💔`,
        isSystemPopup: true
     }]);
  };

  const handleCartClick = (product) => {
     addToCart(product);
     setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Added ${product.name} to Cart 🛒!`,
        isSystemPopup: true
     }]);
     setIsCartOpen(true);
  };

  return (
    <div className={`shopping-assistant ${isOpen ? 'open' : ''}`}>
      <button 
        className="assistant-trigger glass-panel pulse"
        onClick={() => setIsOpen(!isOpen)}
        title="Open AI Shopping Assistant"
      >
        <div className="avatar">🤖</div>
      </button>

      {isOpen && (
        <div className="chat-window glass-panel">
          <div className="chat-header">
            <div className="header-info">
              <span className="avatar-small">🤖</span>
              <div>
                <h4>Fashion Assistant</h4>
                <span className="status">Online & Ready</span>
              </div>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
          </div>
          
          <div className="chat-body" ref={chatBodyRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role} ${msg.isSystemPopup ? 'system-popup' : ''}`}>
                {renderTextFormating(msg.text)}
                
                {/* Advanced Interactive Product UI rendering directly inside chat */}
                {msg.products && msg.products.length > 0 && (
                   <div className="assistant-products-shelf" style={{marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                     {msg.products.map(p => (
                        <div key={p.id} className="assistant-product-widget" style={{display:'flex', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', padding:'8px', borderRadius:'8px', alignItems:'center'}}>
                           <img src={p.image_url || p.image || 'https://via.placeholder.com/100?text=No+Image'} style={{width:'45px',height:'45px',borderRadius:'4px',objectFit:'cover'}} alt={p.name} />
                           
                           <div style={{flex: 1, marginLeft:'10px'}}>
                              <div style={{fontSize:'0.85rem', fontWeight:'bold', lineHeight:'1.2', display:'-webkit-box', WebkitLineClamp:'1', WebkitBoxOrient:'vertical', overflow:'hidden'}} title={p.name}>
                                {p.name}
                              </div>
                              <div style={{color:'var(--primary-cyan)', fontWeight:'bold', fontSize:'0.9rem'}}>
                                ₹{parseFloat(p.price).toLocaleString('en-IN')}
                              </div>
                           </div>

                           <div style={{display:'flex', gap:'5px'}}>
                              <button 
                                onClick={() => handleHeartClick(p)}
                                style={{background: isFavorite(p.id) ? 'rgba(225,29,72,0.2)' : 'rgba(255,255,255,0.1)', border: isFavorite(p.id) ? '1px solid #e11d48' : '1px solid rgba(255,255,255,0.2)', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', fontSize:'1rem', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center'}}
                                title={isFavorite(p.id) ? "Remove from Favorites" : "Add to Favorites"}
                              >
                                {isFavorite(p.id) ? '❤️' : '🤍'}
                              </button>
                              
                              <button 
                                onClick={() => handleCartClick(p)}
                                style={{background:'var(--primary-cyan)', color:'#0f1111', border:'none', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center'}}
                                title="Add to Cart"
                              >
                                🛒
                              </button>
                           </div>
                        </div>
                     ))}
                   </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="message assistant typing-indicator">
                <span>.</span><span>.</span><span>.</span>
              </div>
            )}
          </div>
          
          <div className="chat-input-area">
            <input 
              type="text" 
              placeholder="Ask me for favorites or products..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isTyping}
            />
            <button onClick={handleSend} className="send-btn" disabled={isTyping}>➤</button>
          </div>
        </div>
      )}
    </div>
  );
}
