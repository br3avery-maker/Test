# TapMine Chain - Tap-to-Mine Blockchain PWA

## Overview
A Progressive Web App (PWA) that combines literal physical screen-tapping mechanics with blockchain technology. Users tap their screens to generate cryptographic hashes, which are used as proof-of-work to mine blocks on their own blockchain. Each user's blockchain node data is persisted to Google Drive.

## Architecture

### Frontend
- **Framework**: Vite + Vanilla JavaScript (ES2022+)
- **PWA**: Service worker, offline support, installable
- **UI**: Canvas-based tap visualization with real-time feedback
- **Wallet**: Web3Modal integration (MetaMask, Coinbase, WalletConnect)

### Blockchain
- **Type**: Custom block-lattice (Nano-style) implementation
- **Consensus**: Delegated Proof of Stake (DPoS)
- **Mining**: Tap-to-mine using physical input entropy (SHA-256)
- **Validation**: Representative voting via Open Representative Voting (ORV)

### Storage
- **Primary**: Google Drive API (multipart uploads, resumable)
- **Local**: IndexedDB for offline-first caching
- **Sync**: Delta sync with conflict resolution

## Tap-to-Mine Mechanics

### Physical Input Capture
Each tap records:
- Screen coordinates (x, y)
- Touch pressure (0.0-1.0)
- Touch radius/contact area
- Timestamp (microsecond precision via `performance.now()`)
- Duration (touch_start to touch_end)
- Inter-tap interval
- Multi-touch patterns

### Hash Generation
```javascript
const tapData = {
  coords: [x, y],
  pressure,
  duration,
  prevInterval,
  nonce: randomBytes(32),
  timestamp: performance.now()
};
const message = JSON.stringify(tapData) + previousBlockHash;
const hash = await crypto.subtle.digest('SHA-256', 
  new TextEncoder().encode(message));
const isValid = hash.startsWith('0'.repeat(difficulty));
```

### Difficulty
- Adjustable leading zeros (default: 4)
- Dynamically adjusts based on network hash rate
- Higher difficulty = fewer valid hashes per tap = rarer blocks

### Anti-Cheating
- **Human verification**: Tap timing analysis (100-300ms human variability)
- **Pattern detection**: ML-based bot pattern recognition
- **Rate limiting**: Max 10 taps/second (physical limit)
- **Entropy quality**: Verifies natural coordinate jitter
- **Device fingerprinting**: Prevents multi-account farming

## File Structure
```
src/
├── main.js              # App initialization, event handlers
├── blockchain.js        # Block-lattice implementation
├── tapMiner.js          # Tap-to-mine hashing engine
├── wallet.js            # Wallet management, key generation
├── botDetector.js       # Anti-cheating & bot detection
├── drive.js             # Google Drive storage layer
├── ui.js                # UI renderer, animations, feedback
└── sw.js                # Service worker (PWA)

public/
├── index.html           # App shell
├── manifest.json        # PWA manifest
└── sw.js                # Service worker (copied to dist)
```

## Development

### Install
```bash
npm install
```

### Dev Server
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Test
```bash
npm run test          # Unit tests
npm run test:e2e      # E2E tests (Cypress)
npm run lint          # ESLint
```

## Key Features

### 1. Literal Tap Mining
- Physical taps → hash generation → block creation
- No computational waste (human-powered)
- Verifiable randomness from motor imprecision

### 2. Google Drive Node Hosting
- Each user hosts their own blockchain node
- OAuth 2.0 authentication
- Automatic sync in background
- Conflict resolution via vector clocks

### 3. Wallet Integration
- MetaMask, Coinbase Wallet, WalletConnect
- Local wallet generation (Web Crypto API)
- Encrypted keystore files on Drive
- BIP-32/BIP-44 HD derivation

### 4. Monetization
- Rewarded videos (extra taps, boosters)
- Interstitial & banner ads
- In-app purchases (cosmetics, multipliers)
- Web Monetization API integration

### 5. Progressive Web App
- Installable to home screen
- Offline-first with service worker
- Push notifications (optional)
- Responsive design

## Security

- **AES-256** encryption at rest
- **TLS 1.3** for all communications
- **PBKDF2/Argon2** for key derivation
- **ECDSA** signatures (P-256)
- **Bot detection** via tap pattern analysis
- **Rate limiting** & device fingerprinting

## Performance

### Targets
- Initial sync: <30s (1000 blocks)
- Tap response: <100ms
- Hash computation: <50ms
- Page load: <2s (cached)
- Drive sync: <5s (100 blocks)

### Optimizations
- Lazy loading
- IndexedDB local-first
- Delta sync
- Web Workers for crypto
- WASM acceleration (optional)

## Implementation Phases

**Phase 1 (MVP - 4 weeks)**: Basic PWA, tap-to-mine, Drive sync
**Phase 2 (8 weeks)**: Multi-wallet, DPoS, full monetization
**Phase 3 (12 weeks)**: Performance, security, testing
**Phase 4 (13+ weeks)**: Beta, launch, iteration

## License
MIT
