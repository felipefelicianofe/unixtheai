import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf8');
let url = '';
let key = '';
envFile.split('\n').forEach(line => {
  if (line.includes('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/"/g, '');
  if (line.includes('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = line.split('=')[1].trim().replace(/"/g, '');
});

async function main() {
  console.log("Calling: " + url + "/functions/v1/run-auto-analyses");
  try {
    const r = await fetch(url + '/functions/v1/run-auto-analyses', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key }
    });
    console.log("Status:", r.status);
    console.log("Body:", await r.text());
  } catch (e) {
    console.error(e);
  }
}
main();
