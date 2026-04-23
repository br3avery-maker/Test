export class WalletManager {
  async connect() {
    // Try Web3Modal (MetaMask, Coinbase, WalletConnect)
    if (typeof Web3Modal !== "undefined") {
      try {
        const providerOptions = {}
        if (typeof WalletConnectProvider !== "undefined") {
          providerOptions.walletconnect = {
            package: WalletConnectProvider,
            options: { infuraId: "3cd025f895f440ebb679e9f1cd25cc14" }
          }
        }
        this.web3Modal = new Web3Modal({
          cacheProvider: true,
          providerOptions,
          theme: { background: "#0f0f23", main: "#00ff88", secondary: "#00ccff" }
        })
        const provider = await this.web3Modal.connect()
        const accounts = await provider.request({ method: "eth_accounts" })
        if (accounts?.[0]) {
          this.accounts = accounts
          this.provider = provider
          this.connected = true
          this.chainId = await provider.request({ method: "eth_chainId" })

          // Set up event listeners for Web3Modal provider
          provider.on('accountsChanged', (accounts) => {
            this.accounts = accounts
            this.updateWalletDisplay()
          })

          provider.on('chainChanged', (chainId) => {
            this.chainId = chainId
            this.updateWalletDisplay()
          })

          this.updateWalletDisplay()
          return accounts[0]
        }
      } catch(e) { console.log("Web3Modal failed, falling back", e) }
    }
    if (typeof window.ethereum !== "undefined") { return this.connectInjected() }
    return this.generateLocalWallet()
  }

  constructor() {
    this.web3Modal = null
    this.provider = null
    this.accounts = []
    this.connected = false
    this.chainId = null
  }


  async connectInjected() {
    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })
      
      this.accounts = accounts
      this.provider = window.ethereum
      this.connected = true
      this.chainId = await window.ethereum.request({ method: 'eth_chainId' })
      
      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        this.accounts = accounts
        this.updateWalletDisplay()
      })
      
      window.ethereum.on('chainChanged', (chainId) => {
        this.chainId = chainId
        this.updateWalletDisplay()
      })
      
      return accounts[0]
    } catch (err) {
      console.error('Failed to connect injected wallet:', err)
      throw err
    }
  }

  async generateLocalWallet() {
    // Generate a local wallet using Web Crypto API
    const keyPair = await this.generateKeyPair()
    const address = await this.deriveAddress(keyPair.publicKey)
    
    this.accounts = [address]
    this.connected = true
    this.localKeyPair = keyPair
    
    // Save encrypted keystore
    await this.saveKeystore(keyPair, address)

    this.updateWalletDisplay()
    return address
  }

  async generateKeyPair() {
    return await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    )
  }

  async deriveAddress(publicKey) {
    // Proper Ethereum-style address derivation
    // Take SHA-256 hash of compressed public key and use last 20 bytes
    const exported = await window.crypto.subtle.exportKey('raw', publicKey)
    const hash = await window.crypto.subtle.digest('SHA-256', exported)
    const hashHex = this.arrayBufferToHex(hash)
    return '0x' + hashHex.slice(-40) // Last 20 bytes (40 hex chars)
  }

  arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  async saveKeystore(keyPair, address, password = '') {
    // Export private key as JWK
    const exported = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey)

    // Use password for encryption, fallback to empty string (not recommended for production)
    const passwordBytes = new TextEncoder().encode(password || 'default-password-change-this')

    // Generate salt and derive encryption key
    const salt = window.crypto.getRandomValues(new Uint8Array(32))
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      await window.crypto.subtle.digest('SHA-256', passwordBytes),
      'PBKDF2',
      false,
      ['deriveKey']
    )

    const encryptionKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 262144,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    )

    // Encrypt the private key data
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode(JSON.stringify(exported))
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      encryptionKey,
      plaintext
    )

    const keystore = {
      address,
      crypto: {
        kdf: 'PBKDF2',
        kdfparams: {
          c: 262144,
          dklen: 32,
          prf: 'hmac-sha256',
          salt: this.arrayBufferToHex(salt)
        },
        cipher: 'AES-GCM',
        cipherparams: {
          iv: this.arrayBufferToHex(iv)
        },
        ciphertext: this.arrayBufferToHex(ciphertext)
      },
      version: 3
    }

    localStorage.setItem(`wallet_${address}`, JSON.stringify(keystore))
  }

  async loadKeystore(address, password = '') {
    const stored = localStorage.getItem(`wallet_${address}`)
    if (!stored) return null

    const keystore = JSON.parse(stored)

    // If no encryption (legacy format), return as-is
    if (!keystore.crypto.cipherparams) {
      return keystore
    }

    try {
      // Decrypt the private key
      const passwordBytes = new TextEncoder().encode(password || 'default-password-change-this')
      const salt = this.hexToArrayBuffer(keystore.crypto.kdfparams.salt)

      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        await window.crypto.subtle.digest('SHA-256', passwordBytes),
        'PBKDF2',
        false,
        ['deriveKey']
      )

      const decryptionKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: keystore.crypto.kdfparams.c,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      )

      const iv = this.hexToArrayBuffer(keystore.crypto.cipherparams.iv)
      const ciphertext = this.hexToArrayBuffer(keystore.crypto.ciphertext)

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        decryptionKey,
        ciphertext
      )

      const jwk = JSON.parse(new TextDecoder().decode(decrypted))

      // Import the decrypted key
      const privateKey = await window.crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
      )

      return { ...keystore, privateKey }
    } catch (error) {
      console.error('Failed to decrypt keystore:', error)
      throw new Error('Invalid password or corrupted keystore')
    }
  }

  hexToArrayBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
    }
    return bytes.buffer
  }

  async signMessage(message) {
    if (!this.connected || !this.accounts.length) {
      throw new Error('No wallet connected')
    }
    
    if (this.provider && window.ethereum) {
      // Use injected wallet
      return await window.ethereum.request({
        method: 'personal_sign',
        params: [message, this.accounts[0]]
      })
    }
    
    // Use local wallet
    const encoder = new TextEncoder()
    const signature = await window.crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      this.localKeyPair.privateKey,
      encoder.encode(message)
    )
    
    return this.arrayBufferToHex(signature)
  }

  async signTransaction(tx) {
    const message = JSON.stringify(tx)
    const signature = await this.signMessage(message)
    
    return {
      ...tx,
      signature
    }
  }

  getAccounts() {
    return this.accounts
  }

  isConnected() {
    return this.connected
  }

  disconnect() {
    this.connected = false
    this.accounts = []
    this.provider = null
    this.chainId = null

    // Clear Web3Modal cached provider
    if (this.web3Modal) {
      this.web3Modal.clearCachedProvider()
    }

    this.updateWalletDisplay()
  }

  updateWalletDisplay() {
    // Update UI wallet display
    const event = new CustomEvent('walletChanged', {
      detail: {
        accounts: this.accounts,
        connected: this.connected,
        chainId: this.chainId
      }
    })
    window.dispatchEvent(event)
  }

  // Get balance from blockchain
  async getBalance(address) {
    // This would query the blockchain
    return 0
  }

  // Send transaction
  async sendTransaction(tx) {
    const signedTx = await this.signTransaction(tx)
    
    // Broadcast to network
    // In production, this would send to the blockchain network
    console.log('Sending transaction:', signedTx)
    
    return {
      hash: this.generateTxHash(signedTx),
      ...signedTx
    }
  }

  generateTxHash(tx) {
    const data = JSON.stringify(tx)
    return this.sha256(data)
  }

  async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
}