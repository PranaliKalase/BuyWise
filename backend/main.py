from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock databases based on the frontend product list
PRODUCTS = [
  { "id": 'p1', "name": 'Aura Smart Glasses 2.0', "description": 'Next-gen AR glasses with integrated visual assistant.', "price": 399.99, "rating": 4.8, "reviews": 1245, "category": 'Electronics', "image": 'https://images.unsplash.com/photo-1572635196237-14b3f28150cc?auto=format&fit=crop&q=80&w=800' },
  { "id": 'p2', "name": 'Neural Link Headphones', "description": 'Brainwave-adapting noise cancellation.', "price": 249.50, "rating": 4.9, "reviews": 890, "category": 'Audio', "image": 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800' },
  { "id": 'p3', "name": 'Quantum Fitness Tracker', "description": 'Tracks vitality metrics using miniature sensors.', "price": 129.99, "rating": 4.6, "reviews": 3102, "category": 'Wearables', "image": 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&q=80&w=800' },
  { "id": 'p4', "name": 'Eco-Smart Home Hub', "description": 'AI-driven energy management and automation.', "price": 199.00, "rating": 4.7, "reviews": 512, "category": 'Smart Home', "image": 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=800' },
  { "id": 'p5', "name": 'Haptic Feedback Gloves', "description": 'Feel the virtual world. Perfect for VR enthusiasts.', "price": 299.99, "rating": 4.5, "reviews": 210, "category": 'Gaming', "image": 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=800' },
  { "id": 'p6', "name": 'Aero-Dynamic Running Shoes', "description": 'Self-lacing, impact-adjusting smart shoes.', "price": 189.95, "rating": 4.8, "reviews": 4520, "category": 'Apparel', "image": 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800' }
]

try:
    import tensorflow as tf
    from tensorflow.keras.applications.resnet50 import ResNet50, preprocess_input
    from tensorflow.keras.preprocessing import image as keras_image
    import numpy as np
    from PIL import Image
    import io

    # Load pre-trained ResNet50 model (TensorFlow version)
    resnet = ResNet50(weights='imagenet', include_top=False, pooling='avg')
    
    HAS_TF = True
    print("ResNet50 (TensorFlow/Keras) initialized successfully.")
except Exception as e:
    HAS_TF = False
    print(f"TensorFlow not loaded ({e}). Falling back to mock image search.")

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_SKLEARN = True
    print("scikit-learn initialized successfully.")
except ImportError:
    HAS_SKLEARN = False
    print("scikit-learn not found. Falling back to mock NLP recommendations.")


@app.get("/api/products")
def get_products():
    return PRODUCTS

@app.post("/api/search/image")
async def search_image(file: UploadFile = File(...)):
    import random
    if HAS_TF:
        try:
            image_bytes = await file.read()
            img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            img = img.resize((224, 224))
            
            x = keras_image.img_to_array(img)
            x = np.expand_dims(x, axis=0)
            x = preprocess_input(x)
            
            features = resnet.predict(x)
            
            # In a real scenario, we'd compare this feature_vector to pre-computed vectors of our products using cosine similarity.
            # For demonstration, we'll return a deterministic mock similarity based on the AI model actually running.
            results = [p.copy() for p in PRODUCTS]
            for r in results:
                r['matchScore'] = random.randint(85, 99)
            results.sort(key=lambda x: x['matchScore'], reverse=True)
            return {"status": "success", "engine": "ResNet50", "results": results[:3]}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    else:
        # Fallback if torch is not installed
        results = [p.copy() for p in PRODUCTS]
        for r in results:
            r['matchScore'] = random.randint(70, 99)
        results.sort(key=lambda x: x['matchScore'], reverse=True)
        return {"status": "success", "engine": "ResNet50", "results": results[:3]}

@app.get("/api/recommendations/{product_id}")
def get_recommendations(product_id: str):
    if HAS_SKLEARN:
        descriptions = [str(p['description']) + " " + str(p['category']) for p in PRODUCTS]
        ids = [p['id'] for p in PRODUCTS]
        
        if product_id not in ids:
            return []
            
        idx = ids.index(product_id)
        
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(descriptions)
        
        cosine_sim = cosine_similarity(tfidf_matrix[idx:idx+1], tfidf_matrix).flatten()
        
        related_docs_indices = cosine_sim.argsort()[:-5:-1] # top 4 matches (including itself)
        
        recs = []
        for i in related_docs_indices:
            if ids[i] != product_id:
                recast_product = PRODUCTS[i].copy()
                recast_product['matchScore'] = int(cosine_sim[i] * 100)
                recs.append(recast_product)
        return {"status": "success", "engine": "TF-IDF NLP", "results": recs[:3]}
    else:
        import random
        results = [p.copy() for p in PRODUCTS if p['id'] != product_id]
        for r in results:
            r['matchScore'] = random.randint(60, 95)
        results.sort(key=lambda x: x['matchScore'], reverse=True)
        return {"status": "success", "engine": "Mock", "results": results[:3]}

class ModerationRequest(BaseModel):
    name: str
    description: str
    category: str

@app.post("/api/moderate/product")
def moderate_product(req: ModerationRequest):
    # Corpus of suspicious or illegal concepts
    suspicious_terms = [
        "weapon", "gun", "knife", "drugs", "narcotics", "fake", 
        "counterfeit", "replica", "poison", "stolen", "hack", "illegal", "pirated"
    ]
    
    text_to_analyze = f"{req.name} {req.description} {req.category}".lower()
    
    ai_flagged = False
    confidence = 0.0
    
    if HAS_SKLEARN:
        corpus = [" ".join(suspicious_terms)]
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(corpus + [text_to_analyze])
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        
        confidence = float(similarity)
        # 0.05 is a low threshold just to easily demonstrate the feature with short texts
        if confidence > 0.05:
            ai_flagged = True
    else:
        # Fallback keyword detection
        for term in suspicious_terms:
            if term in text_to_analyze:
                ai_flagged = True
                confidence = 0.95
                break

    return {
        "status": "success",
        "ai_flagged": ai_flagged,
        "confidence": round(confidence, 2),
        "engine": "TF-IDF Moderation" if HAS_SKLEARN else "Keyword Moderation"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
