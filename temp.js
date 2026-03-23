import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf8');
let url = '';
let serviceKey = '';
envFile.split('\n').forEach(line => {
  if (line.includes('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/"/g, '');
  if (line.includes('VITE_SUPABASE_PROJECT_ID=')) {
    // try to get service key from env if not there
  }
});
// The Service key isn't in .env typically. But we can just use deno edge function logs!
