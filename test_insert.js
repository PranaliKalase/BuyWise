import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('c:/Users/SHREE/OneDrive/Desktop/BuyWise/BuyWise/.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Testing insert into products...");
  const { data, error } = await supabase.from('products').insert([
    {
      name: "Test",
      description: "Test desc",
      price: 10,
      category: "test",
      image: "test",
      rating: 0.0,
      reviews: 0,
      status: 'pending',
      ai_flagged: false,
      ai_confidence: 0.0
    }
  ]);
  console.log("Insert outcome:", error || data);
}

main();
