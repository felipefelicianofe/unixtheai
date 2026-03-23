const url = 'https://api.frankfurter.dev/2026-03-01..2026-03-15?from=XAU&to=USD';
async function run() {
  try {
    const r = await fetch(url);
    const data = await r.json();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
run();
