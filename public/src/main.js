import { Blockchain } from './blockchain.js'
import { WalletManager } from './wallet.js'
import { DriveStorage } from './drive.js'
import { TapMiner } from './tapMiner.js'
import { BotDetector } from './botDetector.js'
import { UIRenderer } from './ui.js'

class TapMineApp {
  constructor() {
    this.blockchain = new Blockchain()
    this.walletManager = new WalletManager()
    this.driveStorage = new DriveStorage()
    this.tapMiner = new TapMiner()
    this.botDetector = new BotDetector()
    this.ui = new UIRenderer()
    this.state = {
      isConnected: false,
      balance: 0,
      chainLength: 0,
      syncStatus: 'idle',
      difficulty: 4,
      hashRate: 0
    }
  }

  async init() {
    console.log('Initializing TapMine Chain...')
    await this.blockchain.init()
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