const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY="(.*)"/);

if (!urlMatch || !keyMatch) {
  console.error("Missing env vars");
  process.exit(1);
}

const url = urlMatch[1];
const key = keyMatch[1];

const supabase = createClient(url, key);

async function check() {
  // Query a system table to see if it responds (basic connectivity check)
  const { data: configs, error: cErr } = await supabase
    .from('auto_management_configs')
    .select('*');

  if (cErr) {
    console.error("Configs Query Error:", cErr.message);
  } else {
    console.log("Configs Table Row Count:", configs.length);
  }

  const { data: history, error: hErr } = await supabase
    .from('auto_management_history')
    .select('*');

  if (hErr) {
    console.error("History Query Error:", hErr.message);
  } else {
    console.log("History Table Row Count:", history.length);
  }
}

check();
