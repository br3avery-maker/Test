export class TapMiner {
  constructor() {
    this.taps = []
    this.hashAttempts = 0
    this.successCount = 0
    this.startTime = Date.now()
    this.difficulty = 4
    this.isMining = false
    this.tapWindow = []
    this.maxWindowSize = 50
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty
  }

  recordTap(tapData) {
    const timestamp = performance.now()
    const enrichedTap = {
      ...tapData,
      timestamp,
      sessionTime: timestamp - this.startTime
    }
    
    this.taps.push(enrichedTap)
    this.tapWindow.push(enrichedTap)
    
    if (this.tapWindow.length > this.maxWindowSize) {
      this.tapWindow.shift()
    }

    this.emit('tapRecorded', enrichedTap)
  }

  async mineFromTaps(account, representative = null) {
    if (this.tapWindow.length === 0) {
      this.emit('error', 'No tap data available')
      return false
    }

    this.isMining = true
    const latestTap = this.tapWindow[this.tapWindow.length - 1]
    const previousBlock = this.getLatestBlockHash()
    
    const tapEntropy = this.buildTapEntropy()
    
    let nonce = 0
    const maxNonces = 10000
    
    while (nonce < maxNonces) {
      const blockData = await this.constructBlockData({
        account,
        representative,
        tapEntropy,
        nonce,
        previousBlock,
        tapData: latestTap
      })
      
      this.hashAttempts++
      
      const hash = await this.calculateHash(blockData)
      
      if (hash.startsWith('0'.repeat(this.difficulty))) {
        this.successCount++
        this.isMining = false
        
        blockData.hash = hash
        this.emit('hashFound', {
          ...blockData,
          difficulty: this.difficulty,
          reward: 100,
          attempts: this.hashAttempts
        })
        
        return true
      }
      
      nonce++
      
      if (nonce % 100 === 0) {
        await this.sleep(0)
      }
    }
    
    this.isMining = false
    this.emit('miningFailed', { attempts: this.hashAttempts })
    return false
  }

  buildTapEntropy() {
    const recentTaps = this.tapWindow.slice(-5)
    
    const entropyData = {
      taps: recentTaps.map(t => ({
        x: t.x,
        y: t.y,
        pressure: t.pressure,
        duration: t.duration,
        interval: t.interval,
        radius: t.radius,
        timestamp: Math.floor(t.timestamp)
      })),
      aggregate: {
        avgX: recentTaps.reduce((sum, t) => sum + t.x, 0) / recentTaps.length,
        avgY: recentTaps.reduce((sum, t) => sum + t.y, 0) / recentTaps.length,
        avgDuration: recentTaps.reduce((sum, t) => sum + t.duration, 0) / recentTaps.length,
        varianceX: this.calculateVariance(recentTaps.map(t => t.x)),
        varianceY: this.calculateVariance(recentTaps.map(t => t.y)),
        timestamp: Date.now()
      }
    }
    
    return this.sha256(JSON.stringify(entropyData))
  }

  calculateVariance(values) {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  }

  async constructBlockData({ account, representative, tapEntropy, nonce, previousBlock, tapData }) {
    const latestBlock = this.getLatestBlockInfo()
    const previousHash = latestBlock ? latestBlock.hash : '0'.repeat(64)
    
    const balance = this.getCurrentBalance(account) + 100

    return {
      type: 'mined',
      account,
      previous: previousHash,
      representative: representative || account,
      balance,
      link: tapEntropy,
      work: nonce.toString(16).padStart(16, '0'),
      tap_entropy: tapEntropy,
      signature: '0'.repeat(128),
      nonce,
      timestamp: Date.now(),
      tapData: {
        x: tapData.x,
        y: tapData.y,
        pressure: tapData.pressure,
        duration: tapData.duration,
        timestamp: tapData.timestamp
      }
    }
  }

  getCurrentBalance(account) {
    return 0
  }

  getLatestBlockHash() {
    return '0'.repeat(64)
  }

  getLatestBlockInfo() {
    return null
  }

  async calculateHash(blockData) {
    const dataStr = JSON.stringify({
      type: blockData.type,
      account: blockData.account,
      previous: blockData.previous,
      representative: blockData.representative,
      balance: blockData.balance,
      link: blockData.link,
      work: blockData.work,
      tap_entropy: blockData.tap_entropy,
      nonce: blockData.nonce,
      timestamp: blockData.timestamp
    })
    
    const msgBuffer = new TextEncoder().encode(dataStr)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  getHashRate() {
    const elapsed = (Date.now() - this.startTime) / 1000
    return elapsed > 0 ? Math.round(this.hashAttempts / elapsed) : 0
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  listeners = {}
  
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }
  
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data))
    }
  }
}