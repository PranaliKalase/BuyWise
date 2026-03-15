import React, { useState } from 'react';
import './ShoppingAssistant.css';

export default function ShoppingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi there! I am your AI Shopping Assistant. Looking for something specific?' }
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    const newMessages = [...messages, { role: 'user', text: inputValue }];
    setMessages(newMessages);
    setInputValue('');

    // Mock AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: 'I can help with that! Let me scan my database of over 10,000 products for the best match...' 
      }]);
    }, 1000);
  };

  return (
    <div className={`shopping-assistant ${isOpen ? 'open' : ''}`}>
      <button 
        className="assistant-trigger glass-panel pulse"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="avatar">🤖</div>
      </button>

      {isOpen && (
        <div className="chat-window glass-panel">
          <div className="chat-header">
            <div className="header-info">
              <span className="avatar-small">🤖</span>
              <div>
                <h4>NexGen Assistant</h4>
                <span className="status">Online & Ready</span>
              </div>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
          </div>
          
          <div className="chat-body">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                {msg.text}
              </div>
            ))}
          </div>
          
          <div className="chat-input-area">
            <input 
              type="text" 
              placeholder="Ask for recommendations..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} className="send-btn">➤</button>
          </div>
        </div>
      )}
    </div>
  );
}
