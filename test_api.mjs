import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://khgfgtnoamatjdqgftdl.supabase.co";
const SUPABASE_KEY = "sb_secret_7KBJTqXR2YcRKbjatPUB4g_VnwJd8Zz"; // VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  console.log("Fetching configs...");
  const { data: configs, error: configsErr } = await supabase
    .from('auto_management_configs')
    .select('*')
    .order('created_at', { ascending: false });
  
  console.log("Configs Error:", configsErr);
  console.log("Configs Count:", configs?.length);
  if (configs?.length > 0) {
    console.log("First Config:", configs[0]);
  }

  console.log("Fetching history...");
  const { data: history, error: historyErr } = await supabase
    .from('auto_management_history')
    .select('*, auto_management_configs (asset, timeframe, analysis_period_minutes, leverage)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log("History Error:", historyErr);
  console.log("History Count:", history?.length);
  if (history?.length > 0) {
    console.log("First History:", history[0]);
  }
}

test();
