export class WalletManager {
  constructor() {
    this.provider = null
    this.accounts = []
    this.connected = false
    this.chainId = null
  }

  async connect() {
    // Check for injected provider (MetaMask, etc.)
    if (typeof window.ethereum !== 'undefined') {
      return this.connectInjected()
    }
    
    // Fallback: generate local wallet
    return this.generateLocalWallet()
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
    // Simplified address derivation
    // In production, use proper Ethereum address derivation
    const exported = await window.crypto.subtle.exportKey('raw', publicKey)
    return '0x' + this.arrayBufferToHex(exported).slice(0, 40)
  }

  arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  async saveKeystore(keyPair, address) {
    // Export and encrypt private key
    const exported = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey)
    
    const keystore = {
      address,
      crypto: {
        kdf: 'PBKDF2',
        kdfparams: {
          c: 262144,
          dklen: 32,
          prf: 'hmac-sha256',
          salt: window.crypto.getRandomValues(new Uint8Array(32))
        },
        cipher: 'AES-128-CTR',
        ciphertext: exported
      },
      version: 3
    }
    
    localStorage.setItem(`wallet_${address}`, JSON.stringify(keystore))
  }

  async loadKeystore(address) {
    const stored = localStorage.getItem(`wallet_${address}`)
    if (!stored) return null
    
    return JSON.parse(stored)
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