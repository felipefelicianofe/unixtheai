import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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
  const { data: history, error: hErr } = await supabase
    .from('auto_management_history')
    .select('id, asset, signal, status, closed_at, deleted_at')
    .is('deleted_at', null)
    .is('closed_at', null)
    .in('status', ['PENDING', 'WIN_TP1', 'WIN_TP2']);

  if (hErr) console.error("History Error:", hErr);
  else console.log("History Data:", JSON.stringify(history, null, 2));

  const { data: configs, error: cErr } = await supabase
    .from('auto_management_configs')
    .select('id, asset, is_active');

  if (cErr) console.error("Configs Error:", cErr);
  else console.log("Configs Data:", JSON.stringify(configs, null, 2));
}

check();
