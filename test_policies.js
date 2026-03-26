import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('c:/Users/SHREE/OneDrive/Desktop/BuyWise/BuyWise/.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching policies from pg_policies...");
  // We cannot query pg_policies using the anon key via PostgREST unless exposed.
  // Instead, let's check if we can just trigger the users select and see the full error
  const { data, error } = await supabase.from('users').select('*');
  console.log("Select users outcome:", error || data);
}

main();
