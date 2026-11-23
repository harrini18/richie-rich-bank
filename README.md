# Bank portal template

Register the bank with the SharedBank operator. Set its bank ID, name, IFSC and branding in `src/bank-config.js`. Set the common HTTPS Worker URL in `src/cloudflare-config.js`, or set the repository variable `VITE_X42_API_URL`.

On Node.js 22 or newer, run `npm ci` and `npm run dev` to work locally. The portal uses the bank's Firebase test account and displays live synthetic balances from the Worker.

Publish this folder to a GitHub repository and enable its GitHub Pages source with **GitHub Actions**. The supplied workflow deploys the `main` branch.

## Royal Executive UI

The interface uses the Richie Rich Bank royal executive theme: navy, champagne gold and warm ivory, Playfair Display headings, Inter body text, and a light and dark mode toggle saved in the browser.

Only these files carry the design: `index.html`, `src/main.jsx`, `src/style.css`, `src/live.css` and the markup returned by `src/LiveBank.jsx`.

These files are unchanged from the original and hold the Worker, central bank and inter-bank connection: `src/live-api.js`, `src/cloudflare-config.js`, `src/bank-config.js`, `src/amount.js`, `package.json`, `package-lock.json`, `vite.config.js`, `.x42-portal.json` and `.github/workflows/pages.yml`.

The Playfair Display font loads from Google Fonts, and falls back to Georgia if it cannot load.
