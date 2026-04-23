export class UIRenderer {
  constructor() {
    this.app = null
    this.tapArea = null
    this.hud = null
    this.particles = []
    this.confettiActive = false
  }

  init(app) {
    this.app = app
    this.render()
    this.bindEvents()
    this.startGameLoop()
  }

  render() {
    const uiHTML = `
      <div id="hud" class="hud">
        <div class="hud-section wallet-section">
          <button id="connect-wallet" class="btn btn-primary">🔗 Connect Wallet</button>
          <span id="wallet-address" class="wallet-address">Not Connected</span>
        </div>
        
        <div class="hud-section stats-section">
          <div class="stat">
            <span class="stat-label">Balance</span>
            <span id="balance" class="stat-value">0</span>
            <span class="stat-unit">tokens</span>
          </div>
          <div class="stat">
            <span class="stat-label">Blocks</span>
            <span id="chain-length" class="stat-value">0</span>
          </div>
          <div class="stat">
            <span class="stat-label">Difficulty</span>
            <span id="difficulty" class="stat-value">4</span>
          </div>
          <div class="stat">
            <span class="stat-label">Hash Rate</span>
            <span id="hash-rate" class="stat-value">0</span>
            <span class="stat-unit">/s</span>
          </div>
        </div>

        <div class="hud-section sync-section">
          <span class="sync-status" id="sync-status">
            <span class="sync-dot"></span>
            <span class="sync-text">Ready</span>
          </span>
        </div>
      </div>

      <div id="tap-area" class="tap-area">
        <div class="tap-instruction">
          <span class="tap-icon">💎</span>
          <span class="tap-text">TAP TO MINE</span>
        </div>
        <canvas id="tap-visualizer" class="tap-visualizer"></canvas>
      </div>

      <div id="mining-feedback" class="mining-feedback"></div>

      <div id="notification-container"></div>

      <div id="ad-container" class="ad-container">
        <div class="ad-placeholder">
          <span>Advertisement</span>
        </div>
      </div>
    `

    document.getElementById('app').innerHTML = uiHTML
    
    this.tapArea = document.getElementById('tap-area')
    this.hud = document.getElementById('hud')
    this.visualizerCanvas = document.getElementById('tap-visualizer')
    this.visualizerCtx = this.visualizerCanvas.getContext('2d')
    
    this.resizeCanvas()
  }

  bindEvents() {
    // Touch/mouse events for mining
    let isPointerDown = false
    let pointers = new Map()

    const handlePointerDown = (e) => {
      e.preventDefault()
      isPointerDown = true
      
      const rect = this.tapArea.getBoundingClientRect()
      
      for (const touch of e.changedTouches || [e]) {
        const pointerId = touch.pointerId || touch.identifier || 0
        pointers.set(pointerId, {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
          pressure: touch.pressure || 0.5,
          radius: touch.radius || 10,
          startTime: performance.now(),
          element: touch.target
        })
      }
      
      this.visualizeTapStart(pointers)
    }

    const handlePointerMove = (e) => {
      if (!isPointerDown) return
      e.preventDefault()
      
      const rect = this.tapArea.getBoundingClientRect()
      
      for (const touch of e.changedTouches || [e]) {
        const pointerId = touch.pointerId || touch.identifier || 0
        if (pointers.has(pointerId)) {
          const pointer = pointers.get(pointerId)
          pointer.x = touch.clientX - rect.left
          pointer.y = touch.clientY - rect.top
          pointer.pressure = touch.pressure || 0.5
          pointer.radius = touch.radius || 10
        }
      }
    }

    const handlePointerUp = (e) => {
      isPointerDown = false
      
      const rect = this.tapArea.getBoundingClientRect()
      const endTime = performance.now()
      
      for (const touch of e.changedTouches || [e]) {
        const pointerId = touch.pointerId || touch.identifier || 0
        if (pointers.has(pointerId)) {
          const pointer = pointers.get(pointerId)
          
          const tapData = {
            x: pointer.x,
            y: pointer.y,
            pressure: pointer.pressure,
            radius: pointer.radius,
            duration: endTime - pointer.startTime,
            interval: 0, // Will be calculated by tapMiner
            target: pointer.element
          }
          
          this.recordTap(tapData)
          pointers.delete(pointerId)
        }
      }
      
      this.visualizeTapEnd()
    }

    const handlePointerCancel = (e) => {
      isPointerDown = false
      pointers.clear()
      this.visualizeTapEnd()
    }

    // Mouse events
    this.tapArea.addEventListener('mousedown', handlePointerDown)
    this.tapArea.addEventListener('mousemove', handlePointerMove)
    this.tapArea.addEventListener('mouseup', handlePointerUp)
    this.tapArea.addEventListener('mouseleave', handlePointerCancel)

    // Touch events
    this.tapArea.addEventListener('touchstart', handlePointerDown, { passive: false })
    this.tapArea.addEventListener('touchmove', handlePointerMove, { passive: false })
    this.tapArea.addEventListener('touchend', handlePointerUp, { passive: false })
    this.tapArea.addEventListener('touchcancel', handlePointerCancel, { passive: false })

    // Wallet connection
    document.getElementById('connect-wallet').addEventListener('click', () => {
      this.app.connectWallet()
    })

    // Window resize
    window.addEventListener('resize', () => this.resizeCanvas())
  }

  recordTap(tapData) {
    // Record tap in tapMiner
    this.app.tapMiner.recordTap(tapData)
    
    // Trigger mining attempt
    const walletAddress = this.app.walletManager.accounts[0] || '0x0000000000000000000000000000000000000000'
    this.app.tapMiner.mineFromTaps(walletAddress)
    
    // Visual feedback
    this.showTapRipple(tapData.x, tapData.y, tapData.pressure)
  }

  showTapRipple(x, y, pressure) {
    const ripple = document.createElement('div')
    ripple.className = 'tap-ripple'
    ripple.style.left = `${x}px`
    ripple.style.top = `${y}px`
    ripple.style.transform = `translate(-50%, -50%) scale(${0.5 + pressure * 0.5})`
    
    this.tapArea.appendChild(ripple)
    
    setTimeout(() => ripple.remove(), 600)
  }

  visualizeTapStart(pointers) {
    this.visualizerCtx.clearRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height)
    
    pointers.forEach((p, id) => {
      const gradient = this.visualizerCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 50)
      gradient.addColorStop(0, `rgba(0, 255, 136, ${p.pressure})`)
      gradient.addColorStop(1, 'rgba(0, 255, 136, 0)')
      
      this.visualizerCtx.fillStyle = gradient
      this.visualizerCtx.beginPath()
      this.visualizerCtx.arc(p.x, p.y, 50, 0, Math.PI * 2)
      this.visualizerCtx.fill()
    })
  }

  visualizeTapEnd() {
    setTimeout(() => {
      this.visualizerCtx.clearRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height)
    }, 300)
  }

  updateChainDisplay(state) {
    document.getElementById('balance').textContent = state.balance || 0
    document.getElementById('chain-length').textContent = state.chainLength || 0
    document.getElementById('difficulty').textContent = state.difficulty || 4
    document.getElementById('hash-rate').textContent = state.hashRate || 0
  }

  updateWalletDisplay(state) {
    const display = state || this.app.state
    const addressEl = document.getElementById('wallet-address')
    const connectBtn = document.getElementById('connect-wallet')
    
    if (display.isConnected && display.walletAddress) {
      addressEl.textContent = display.walletAddress.slice(0, 6) + '...' + display.walletAddress.slice(-4)
      connectBtn.textContent = '🔗 Connected'
      connectBtn.disabled = true
    } else {
      addressEl.textContent = 'Not Connected'
      connectBtn.textContent = '🔗 Connect Wallet'
      connectBtn.disabled = false
    }
  }

  updateSyncStatus(state) {
    const statusEl = document.getElementById('sync-status')
    const dot = statusEl.querySelector('.sync-dot')
    const text = statusEl.querySelector('.sync-text')
    
    const statuses = {
      idle: { color: '#666', text: 'Ready' },
      syncing: { color: '#00ff88', text: 'Syncing...' },
      synced: { color: '#00ff88', text: 'Synced' },
      error: { color: '#ff4444', text: 'Error' }
    }
    
    const status = statuses[state.syncStatus] || statuses.idle
    dot.style.background = status.color
    text.textContent = status.text
  }

  showMiningSuccess(difficulty, reward) {
    const feedback = document.getElementById('mining-feedback')
    const successEl = document.createElement('div')
    successEl.className = 'mining-success'
    successEl.innerHTML = `
      <span class="mining-icon">✅</span>
      <span class="mining-text">Block Mined! Difficulty: ${difficulty}, Reward: ${reward} tokens</span>
    `
    
    feedback.appendChild(successEl)
    
    setTimeout(() => successEl.remove(), 3000)
    
    // Update difficulty periodically
    setTimeout(() => {
      this.app.adjustDifficulty()
    }, 5000)
  }

  showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container')
    const notification = document.createElement('div')
    notification.className = `notification notification-${type}`
    notification.textContent = message
    
    container.appendChild(notification)
    
    setTimeout(() => {
      notification.classList.add('show')
    }, 10)
    
    setTimeout(() => {
      notification.classList.remove('show')
      setTimeout(() => notification.remove(), 300)
    }, 3000)
  }

  triggerConfetti() {
    if (this.confettiActive) return
    
    this.confettiActive = true
    const colors = ['#00ff88', '#00ccff', '#ff6b6b', '#ffd93d', '#6c5ce7']
    
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div')
        confetti.className = 'confetti'
        confetti.style.left = Math.random() * 100 + '%'
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)]
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's'
        
        document.body.appendChild(confetti)
        
        setTimeout(() => confetti.remove(), 5000)
      }, i * 50)
    }
    
    setTimeout(() => {
      this.confettiActive = false
    }, 5000)
  }

  playSuccessSound() {
    // Web Audio API sound
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime) // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1) // E5
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (err) {
      // Audio not supported
    }
  }

  resizeCanvas() {
    if (this.visualizerCanvas) {
      const rect = this.tapArea.getBoundingClientRect()
      this.visualizerCanvas.width = rect.width
      this.visualizerCanvas.height = rect.height
    }
  }

  startGameLoop() {
    const loop = () => {
      // Update game state
      this.updateGameState()
      requestAnimationFrame(loop)
    }
    loop()
  }

  updateGameState() {
    // Update particle effects
    this.updateParticles()
  }

  updateParticles() {
    // Simple particle system
    this.particles = this.particles.filter(p => {
      p.life--
      p.y -= p.vy
      p.x += p.vx
      return p.life > 0
    })
  }
}