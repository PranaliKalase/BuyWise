import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('c:/Users/SHREE/OneDrive/Desktop/BuyWise/BuyWise/.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.auth.signUp({
    email: `testadmin_${Date.now()}@example.com`,
    password: "Password123!",
    options: {
      data: { role: 'admin' }
    }
  });
  
  if (error) {
    console.log("ERROR_JSON:", JSON.stringify(error));
  } else {
    console.log("Success:", data.user.id);
  }
}

main();
