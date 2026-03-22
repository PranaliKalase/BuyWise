import React from 'react';
import { useNavigate } from 'react-router-dom';
import './CategoryStrip.css';

const CATEGORIES = [
  { name: "Men's Fashion", img: "https://images.unsplash.com/photo-1617137968427-85924c400a50?auto=format&fit=crop&w=150&q=80" },
  { name: "Women's Fashion", img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=150&q=80" },
  { name: "Home & Kitchen", img: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=150&q=80" },
  { name: "Kid's Fashion", img: "https://images.unsplash.com/photo-1519238263530-99abad672f66?auto=format&fit=crop&w=150&q=80" },
  { name: "Beauty & Health", img: "https://images.unsplash.com/photo-1596462502278-27bf85033e5a?auto=format&fit=crop&w=150&q=80" },
  { name: "Automotives", img: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=150&q=80" },
  { name: "Mobile Accessories", img: "https://images.unsplash.com/photo-1585338107529-13afc5f02baa?auto=format&fit=crop&w=150&q=80" },
  { name: "Electronics", img: "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=150&q=80" },
  { name: "Sports & Fitness", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=150&q=80" },
  { name: "Computers", img: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=150&q=80" },
  { name: "Books", img: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=150&q=80" }
];

export default function CategoryStrip() {
  const navigate = useNavigate();

  return (
    <div className="category-strip-container glass-panel">
      <div className="category-strip">
        {CATEGORIES.map((cat, idx) => (
          <div 
            key={idx} 
            className="category-item" 
            onClick={() => navigate(`/search.html?q=${encodeURIComponent(cat.name)}`)}
          >
            <div className="category-image-wrapper">
              <img src={cat.img} alt={cat.name} className="category-image" loading="lazy" />
            </div>
            <span className="category-name">{cat.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
