async function run() {
  const urls = [
    'https://brapi.dev/api/quote/XAUUSD=X?range=1mo&interval=1d',
    'https://brapi.dev/api/quote/^XAU?range=1mo&interval=1d',
    'https://brapi.dev/api/quote/GC=F?range=1mo&interval=1d',
    'https://brapi.dev/api/quote/GLD?range=1mo&interval=1d'
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url);
      const data = await r.json();
      console.log(url, data.results ? data.results[0].symbol : 'none');
    } catch (e) {
      console.log(url, 'error');
    }
  }
}
run();
