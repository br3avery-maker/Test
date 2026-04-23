export class Blockchain {
  constructor() {
    this.chain = []
    this.accountChains = new Map() // address -> chain
    this.difficulty = 4
    this.pendingBlocks = new Map()
  }

  async init() {
    const stored = localStorage.getItem('tapmine-chain')
    if (stored) {
      this.load(JSON.parse(stored))
    }
  }

  createGenesisBlock() {
    const genesis = {
      index: 0,
      type: 'genesis',
      account: '0x0000000000000000000000000000000000000000',
      previous: '0'.repeat(64),
      representative: '0x0000000000000000000000000000000000000000',
      balance: 0,
      link: '0'.repeat(64),
      work: '0'.repeat(64),
      tap_entropy: '0'.repeat(64),
      signature: '0'.repeat(128),
      timestamp: Date.now(),
      hash: ''
    }
    genesis.hash = this.calculateHash(genesis)
    this.chain.push(genesis)
    localStorage.setItem('tapmine-chain', JSON.stringify(this.export()))
    return genesis
  }

  calculateHash(block) {
    const data = JSON.stringify({
      index: block.index,
      type: block.type,
      account: block.account,
      previous: block.previous,
      representative: block.representative,
      balance: block.balance,
      link: block.link,
      work: block.work,
      tap_entropy: block.tap_entropy,
      timestamp: block.timestamp
    })
    return this.sha256(data)
  }

  async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async addBlock(blockData) {
    const hash = await this.calculateHash(blockData)
    
    // Verify difficulty
    const isValid = hash.startsWith('0'.repeat(this.difficulty))
    if (!isValid) {
      console.warn('Block does not meet difficulty target', hash, this.difficulty)
      return false
    }

    // Verify signature if wallet is present
    if (blockData.signature && blockData.signature !== '0'.repeat(128)) {
      if (!(await this.verifySignature(blockData))) {
        console.warn('Invalid signature')
        return false
      }
    }

    const newBlock = {
      ...blockData,
      hash,
      index: this.chain.length
    }

    this.chain.push(newBlock)
    
    // Update account chain
    const account = blockData.account
    if (!this.accountChains.has(account)) {
      this.accountChains.set(account, [])
    }
    this.accountChains.get(account).push(newBlock)

    localStorage.setItem('tapmine-chain', JSON.stringify(this.export()))
    return true
  }

  async verifySignature(blockData) {
    // Verify ECDSA signature for block data
    if (!blockData.signature || blockData.signature.length !== 128) {
      return false
    }

    try {
      // Reconstruct the message that was signed (must match signTransaction)
      const messageData = {
        index: blockData.index,
        type: blockData.type,
        account: blockData.account,
        previous: blockData.previous,
        representative: blockData.representative,
        balance: blockData.balance,
        link: blockData.link,
        work: blockData.work,
        tap_entropy: blockData.tap_entropy,
        timestamp: blockData.timestamp
      }
      const message = JSON.stringify(messageData)

      // For now, we only validate local wallet signatures
      // TODO: Implement full public key lookup and verification
      if (window.app && window.app.walletManager && window.app.walletManager.localKeyPair) {
        const signatureBytes = this.hexToArrayBuffer(blockData.signature)
        const messageBytes = new TextEncoder().encode(message)

        return await window.crypto.subtle.verify(
          {
            name: 'ECDSA',
            hash: { name: 'SHA-256' }
          },
          window.app.walletManager.localKeyPair.publicKey,
          signatureBytes,
          messageBytes
        )
      }

      // Check signature format (hex string) as fallback
      return /^[0-9a-f]{128}$/i.test(blockData.signature)
    } catch (error) {
      console.error('Signature verification error:', error)
      return false
    }
  }

  hexToArrayBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
    }
    return bytes.buffer
  }

  getBalance(account = null) {
    if (account) {
      return this.accountChains.get(account)?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
    }
    // Return total mined blocks as balance
    return this.chain.filter(b => b.type === 'mined').length * 100
  }

  getChainLength() {
    return this.chain.length
  }

  getAverageBlockTime() {
    const minedBlocks = this.chain.filter(b => b.type === 'mined' && b.timestamp)
    if (minedBlocks.length < 2) return 3000
    
    let totalDiff = 0
    for (let i = 1; i < minedBlocks.length; i++) {
      totalDiff += minedBlocks[i].timestamp - minedBlocks[i-1].timestamp
    }
    return totalDiff / (minedBlocks.length - 1)
  }

  export() {
    return {
      chain: this.chain,
      accountChains: Array.from(this.accountChains.entries()),
      difficulty: this.difficulty,
      version: '1.0'
    }
  }

  load(data) {
    this.chain = data.chain || []
    this.accountChains = new Map(data.accountChains || [])
    this.difficulty = data.difficulty || 4
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1]
  }
}