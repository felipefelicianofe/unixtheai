import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readFileSync } from "node:fs";

const envFile = readFileSync('.env', 'utf8');
let url = '';
let serviceKey = '';
envFile.split('\n').forEach(line => {
  if (line.includes('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/"/g, '');
  if (line.includes('SUPABASE_SERVICE_ROLE_KEY=')) serviceKey = line.split('=')[1].trim().replace(/"/g, '');
  // if service key not in frontend env, we need to try with normal publishable key and user token
});
