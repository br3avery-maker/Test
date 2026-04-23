# GitHub Pages Deployment Guide

## Quick Start

### 1. Build for Production
```bash
npm run build
```

Build output will be in `dist/`:
- `dist/index.html` - Main app page
- `dist/assets/index-*.js` - Bundled JavaScript (24 KB minified)
- `dist/sw.js` - Service worker
- `dist/manifest.json` - PWA manifest

### 2. Deploy to GitHub Pages

#### Option A: gh-pages branch (Recommended)

```bash
# Install gh-pages
npm install --save-dev gh-pages

# Add to package.json scripts:
# "predeploy": "npm run build",
# "deploy": "gh-pages -d dist"

# Deploy
npm run deploy
```

#### Option B: GitHub Actions (Auto-deploy on push)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

#### Option C: Manual Upload

1. Go to repository Settings → Pages
2. Source: Deploy from branch
3. Branch: `gh-pages` / `/(root)`
4. Upload `dist/` contents

### 3. Verify Deployment

```bash
# Test build
npm run build

# Preview locally
npm run preview
# Visit http://localhost:4000
```

## Configuration

### Base URL

The app uses relative paths (`base: './'`) so it works on any domain:
- `https://username.github.io/repo/` ✓
- `https://username.github.io/` ✓
- Custom domain ✓

### Environment Variables (Optional)

Create `.env` (not committed):

```bash
# Google OAuth (for Drive integration)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Monetization
VITE_PLAYGAMA_PROJECT_ID=your-project-id
VITE_WALLETCONNECT_PROJECT_ID=your-wc-project-id
```

**Never commit `.env`!** It's in `.gitignore`.

## PWA Setup

### Manifest

The `manifest.json` is already configured:
- Name: "TapMine Chain"
- Display: standalone
- Theme: #0f0f23 (dark)
- Icons: SVG emoji fallback

### Add to Home Screen

1. Deploy to HTTPS (GitHub Pages provides this)
2. Service worker registers automatically
3. Browser shows "Add to Home screen" prompt
4. Works offline after first visit

### iOS Safari

Add to `index.html` `<head>`:

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/icon.png">
```

### Android Chrome

The manifest handles Android. Verify with:

```bash
# Lighthouse audit
npm install -g lighthouse
lighthouse https://username.github.io/repo --view
```

## Google Drive Integration (Optional)

To enable blockchain persistence to Google Drive:

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project "TapMine"
3. Enable **Google Drive API**
4. Enable **Google Identity Services**

### 2. Configure OAuth Consent

1. APIs & Services → OAuth consent screen
2. User Type: External (for testing)
3. Add scopes: `.../auth/drive.file`
4. Add test users (your email)

### 3. Create OAuth Client ID

1. Credentials → Create Credentials → OAuth client ID
2. Application type: Web application
3. Name: "TapMine Web App"
4. Authorized JS origins: `https://username.github.io`
5. Authorized redirect URIs: `https://username.github.io`
6. Click Create → Copy **Client ID**

### 4. Add to App

```bash
# In your .env file
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

The app will detect this and enable Drive sync.

## Monetization Setup

### Playgama (Ads)

1. Register at [playgama.com](https://playgama.com)
2. Create project
3. Copy Project ID
4. Add `.env`:
   ```bash
   VITE_PLAYGAMA_PROJECT_ID=your-id
   ```
5. Import SDK in `src/ui.js`:
   ```javascript
   import { initPlaygama } from 'playgama'
   initPlaygama(VITE_PLAYGAMA_PROJECT_ID)
   ```

### AdSense (Banners)

1. Apply for AdSense (if approved)
2. Get ad unit IDs
3. Add to `public/index.html`:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
   <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="ca-pub-XXXXXXXXXX"
        data-ad-slot="XXXXXXX"></ins>
   ```

### Web Monetization (Streaming)

1. Get payment pointer from [Coil](https://coil.com) or [XRPL](https://xrpl.org)
2. Add to `index.html`:
   ```html
   <meta name="monetization" content="$ilp.uphold.com/your-payment-pointer">
   ```
3. Check in code:
   ```javascript
   if (document.monetization?.state === 'started') {
     // User is paying! Grant premium features
   }
   ```

## Custom Domain

### 1. Buy Domain

- Cloudflare, Namecheap, Google Domains, etc.

### 2. Configure DNS

Add CNAME record:
```
Type:  CNAME
Name:  @
Value: username.github.io
```

Or A records (recommended):
```
Type:  A
Name:  @
Value: 185.199.108.153
      185.199.109.153
      185.199.110.153
      185.199.111.153
```

### 3. Configure GitHub Pages

1. Repository Settings → Pages
2. Custom domain: `yourdomain.com`
3. Save → GitHub creates `CNAME` file

### 4. Enable HTTPS

1. Settings → Pages → HTTPS
2. Wait ~1 minute
3. Check "Enforce HTTPS"

## Testing

### Lighthouse Audit

```bash
# Performance, PWA, Accessibility, SEO
lighthouse https://username.github.io/repo --view
```

Target scores:
- Performance: >90
- PWA: >90
- Accessibility: >90
- SEO: >90

### Cross-Browser Test

- Chrome ✓ (primary)
- Firefox ✓
- Safari ✓
- Edge ✓
- Mobile Chrome ✓
- Mobile Safari ✓

### Offline Test

1. Visit site (caches assets)
2. Turn off WiFi
3. Refresh
4. Should work offline!

## Monitoring

### Analytics (Optional)

Add to `index.html` `<head>`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>

<!-- Plausible (privacy-focused alternative) -->
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

### Error Tracking

Add Sentry (optional):

```bash
npm install @sentry/browser
```

```javascript
import * as Sentry from '@sentry/browser'
Sentry.init({ dsn: 'YOUR_DSN' })
```

## Troubleshooting

### Blank Page After Deploy

**Problem**: 404 on `main.js`

**Solution**: Check paths in `index.html`:
```html
<!-- For root deployment -->
<script type="module" src="/src/main.js"></script>

<!-- For subfolder deployment (e.g., /repo/) -->
<script type="module" src="./src/main.js"></script>
```

### Service Worker Not Registering

**Problem**: SW registration fails

**Solution**: 
1. Must be HTTPS (GitHub Pages provides this)
2. Check browser console
3. Update `sw.js` registration path:
```javascript
navigator.serviceWorker.register('./sw.js')  // relative path
```

### Build Fails

**Problem**: `vite build` errors

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Google OAuth Not Working

**Problem**: `Error 403: Origin not allowed`

**Solution**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit OAuth 2.0 Client
3. Add authorized origin: `https://username.github.io`
4. Add authorized redirect: `https://username.github.io`

## Performance Optimization

### Lazy Loading

Code-split large modules:

```javascript
const WalletModal = () => import('./components/WalletModal.vue')
```

### Image Optimization

- Use WebP format
- Compress with Squoosh
- Use CDN (Cloudinary, Imgix)

### Bundle Size

Current: ~24 KB gzipped ✅

Keep it under 50 KB for fast load times.

## Security

### Content Security Policy (CSP)

Add to `dist/_headers` (Netlify) or server config:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://*.google.com; connect-src 'self' https://*.googleapis.com; style-src 'self' 'unsafe-inline';
```

### HTTPS Only

GitHub Pages forces HTTPS. Good! ✅

### XSS Prevention

- Never use `innerHTML` with user data
- Sanitize all inputs
- Use CSP headers

## Maintenance

### Regular Updates

```bash
# Update dependencies
npm update

# Check for vulnerabilities
npm audit

# Fix critical issues
npm audit fix
```

### Backup Strategy

- Code: GitHub repository ✅
- Build artifacts: `dist/` (rebuildable)
- User data: Google Drive (cloud)
- Config: `.env.example` (template only)

### Version Releases

1. Update `package.json` version
2. Create git tag: `git tag v1.0.0`
3. Push: `git push origin v1.0.0`
4. GitHub creates Release automatically

## Cost

All free tier! 🎉

- **Hosting**: GitHub Pages (free)
- **CDN**: GitHub (free)
- **HTTPS**: Let's Encrypt via GitHub (free)
- **Domain**: ~$10-15/year (optional)
- **Build**: GitHub Actions (2000 min/month free)
- **Google Drive**: 15 GB free per user

## Support

- GitHub Issues: Bug reports, feature requests
- Discussions: Q&A, community help
- Wiki: Documentation, tutorials

## Checklist

- [x] Build passes locally
- [x] `dist/` directory created
- [x] `sw.js` in `dist/`
- [x] `manifest.json` in `dist/`
- [x] GitHub Pages enabled in Settings
- [x] Branch selected (gh-pages or main)
- [ ] Custom domain configured (optional)
- [ ] Google OAuth configured (optional)
- [ ] Analytics installed (optional)
- [ ] Lighthouse audit >90 (target)

## Resources

- [Vite Docs](https://vitejs.dev/)
- [GitHub Pages Docs](https://docs.github.com/en/pages)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Google Drive API](https://developers.google.com/drive)
- [Workbox (Service Workers)](https://developers.google.com/web/tools/workbox)
