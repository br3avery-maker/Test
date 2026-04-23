import { Blockchain } from './blockchain.js'
import { WalletManager } from './wallet.js'
import { DriveStorage } from './drive.js'
import { TapMiner } from './tapMiner.js'
import { BotDetector } from './botDetector.js'
import { UIRenderer } from './ui.js'
import { AdsManager } from './ads.js'

class TapMineApp {
  constructor() {
    this.blockchain = new Blockchain()
    this.walletManager = new WalletManager()
    this.driveStorage = new DriveStorage()
    this.tapMiner = new TapMiner()
    this.botDetector = new BotDetector()
    this.adsManager = new AdsManager()
    this.ui = new UIRenderer()
    this.state = {
      isConnected: false,
      balance: 0,
      chainLength: 0,
      syncStatus: 'idle',
      difficulty: 4,
      hashRate: 0,
      activeBooster: null
    }
  }

  async init() {
    console.log('Initializing TapMine Chain...')
    await this.blockchain.init()
    await this.adsManager.init()
    this.ui.init(this)
    this.tapMiner.on('hashFound', (blockData) => this.onHashFound(blockData))
    this.tapMiner.on('tapRecorded', (tapData) => this.onTapRecorded(tapData))
    await this.loadOrCreateGenesis()
    this.attemptDriveSync()
    console.log('TapMine Chain initialized')
  }

  async loadOrCreateGenesis() {
    const stored = await this.driveStorage.loadChain()
    if (stored) {
      this.blockchain.load(stored)
      this.state.chainLength = this.blockchain.getChainLength()
      this.state.balance = this.blockchain.getBalance()
    } else {
      const genesis = this.blockchain.createGenesisBlock()
      await this.driveStorage.saveChain(this.blockchain.export())
    }
    this.ui.updateChainDisplay(this.state)
  }

  async onHashFound(blockData) {
    if (!this.botDetector.verifyHumanTap(blockData.tapData)) {
      console.warn('Bot-like pattern detected, rejecting block')
      this.ui.showNotification('Bot pattern detected!', 'error')
      return
    }
    const success = this.blockchain.addBlock(blockData)
    if (success) {
      this.state.balance = this.blockchain.getBalance()
      this.state.chainLength = this.blockchain.getChainLength()
      this.state.hashRate = this.tapMiner.getHashRate()
      this.ui.updateChainDisplay(this.state)
      this.ui.showMiningSuccess(blockData.difficulty, blockData.reward)
      this.ui.triggerConfetti()
      this.attemptDriveSync()
      this.ui.playSuccessSound()
    }
  }

  onTapRecorded(tapData) {
    this.botDetector.recordTap(tapData)
  }

  async attemptDriveSync() {
    this.state.syncStatus = 'syncing'
    this.ui.updateSyncStatus(this.state)
    try {
      await this.driveStorage.saveChain(this.blockchain.export())
      this.state.syncStatus = 'synced'
      this.ui.updateSyncStatus(this.state)
    } catch (err) {
      this.state.syncStatus = 'error'
      this.ui.updateSyncStatus(this.state)
      console.error('Drive sync failed:', err)
    }
  }

  async connectWallet() {
    try {
      const address = await this.walletManager.connect()
      this.state.isConnected = true
      this.state.walletAddress = address
      this.ui.updateWalletDisplay(this.state)
    } catch (err) {
      console.error('Wallet connection failed:', err)
      this.ui.showNotification('Wallet connection failed', 'error')
    }
  }

  disconnectWallet() {
    this.walletManager.disconnect()
    this.state.isConnected = false
    this.state.walletAddress = null
    this.ui.updateWalletDisplay(this.state)
  }

  // Ad reward methods
  async watchAdForExtraTaps() {
    try {
      const result = await this.adsManager.rewardExtraTaps(5)
      if (result.success) {
        this.ui.showNotification(`🎁 Earned ${result.taps} extra taps!`, 'success')
        // Could implement extra taps logic here
      } else {
        this.ui.showNotification('Ad not completed', 'warning')
      }
    } catch (error) {
      console.error('Ad error:', error)
      this.ui.showNotification('Ad failed to load', 'error')
    }
  }

  async watchAdForBooster() {
    try {
      const result = await this.adsManager.rewardBooster(2, 30)
      if (result.success) {
        this.state.activeBooster = result.booster
        this.ui.showNotification(`🚀 2x mining speed for ${result.booster.duration}s!`, 'success')
        // Start booster timer
        setTimeout(() => {
          this.state.activeBooster = null
          this.ui.showNotification('Booster expired', 'info')
        }, result.booster.duration * 1000)
      } else {
        this.ui.showNotification('Ad not completed', 'warning')
      }
    } catch (error) {
      console.error('Ad error:', error)
      this.ui.showNotification('Ad failed to load', 'error')
    }
  }

  async watchAdForTokens() {
    try {
      const result = await this.adsManager.rewardTokens(100)
      if (result.success) {
        this.state.balance += result.tokens
        this.ui.showNotification(`💰 Earned ${result.tokens} tokens!`, 'success')
        this.ui.updateStats(this.state)
      } else {
        this.ui.showNotification('Ad not completed', 'warning')
      }
    } catch (error) {
      console.error('Ad error:', error)
      this.ui.showNotification('Ad failed to load', 'error')
    }
  }

  adjustDifficulty() {
    const hashRate = this.tapMiner.getHashRate()
    const targetTime = 3000
    const avgTime = this.blockchain.getAverageBlockTime()
    if (avgTime < targetTime * 0.5) {
      this.state.difficulty++
    } else if (avgTime > targetTime * 2 && this.state.difficulty > 1) {
      this.state.difficulty--
    }
    this.tapMiner.setDifficulty(this.state.difficulty)
    this.ui.updateChainDisplay(this.state)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new TapMineApp()
  window.app.init()
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration failed:', err)
    })
  })
}