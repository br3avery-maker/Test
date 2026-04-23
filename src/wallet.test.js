import { WalletManager } from '../src/wallet.js'

// Mock the global crypto API for testing
global.crypto = {
  subtle: {
    generateKey: () => Promise.resolve({ publicKey: {}, privateKey: {} }),
    deriveBits: () => Promise.resolve(new Uint8Array(32)),
    importKey: () => Promise.resolve({}),
    encrypt: () => Promise.resolve(new Uint8Array(32)),
    decrypt: () => Promise.resolve(new Uint8Array(32)),
    sign: () => Promise.resolve(new Uint8Array(64)),
    verify: () => Promise.resolve(true),
    digest: () => Promise.resolve(new Uint8Array(32))
  },
  getRandomValues: (array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
}

// Mock window.ethereum for testing
global.window = {
  ethereum: {
    request: () => Promise.resolve(['0x742d35Cc6634C0532925a3b844Bc454e4438f44e']),
    on: () => {},
    removeListener: () => {}
  },
  crypto: global.crypto
}

describe('WalletManager', () => {
  let walletManager

  beforeEach(() => {
    walletManager = new WalletManager()
    localStorage.clear()
  })

  test('should initialize with correct default state', () => {
    expect(walletManager.connected).toBe(false)
    expect(walletManager.accounts).toEqual([])
    expect(walletManager.provider).toBeNull()
    expect(walletManager.chainId).toBeNull()
  })

  test('should generate local wallet', async () => {
    // Mock key generation
    const mockKeyPair = {
      publicKey: { type: 'public' },
      privateKey: { type: 'private' }
    }
    global.crypto.subtle.generateKey.mockResolvedValue(mockKeyPair)

    // Mock address derivation
    walletManager.deriveAddress = jest.fn().mockResolvedValue('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')

    const address = await walletManager.generateLocalWallet()

    expect(address).toBe('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')
    expect(walletManager.connected).toBe(true)
    expect(walletManager.accounts).toEqual([address])
    expect(walletManager.localKeyPair).toBe(mockKeyPair)
  })

  test('should connect to injected wallet', async () => {
    const mockAccounts = ['0x742d35Cc6634C0532925a3b844Bc454e4438f44e']
    global.window.ethereum.request
      .mockResolvedValueOnce(mockAccounts) // eth_requestAccounts
      .mockResolvedValueOnce('0x1') // eth_chainId

    const address = await walletManager.connectInjected()

    expect(address).toBe(mockAccounts[0])
    expect(walletManager.connected).toBe(true)
    expect(walletManager.accounts).toEqual(mockAccounts)
    expect(walletManager.chainId).toBe('0x1')
    expect(global.window.ethereum.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function))
    expect(global.window.ethereum.on).toHaveBeenCalledWith('chainChanged', expect.any(Function))
  })

  test('should handle Web3Modal connection', async () => {
    // Mock Web3Modal
    global.Web3Modal = jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue({
        request: jest.fn()
          .mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b844Bc454e4438f44e']) // eth_accounts
          .mockResolvedValueOnce('0x1') // eth_chainId
      })
    }))

    const address = await walletManager.connect()

    expect(address).toBe('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')
    expect(walletManager.connected).toBe(true)
  })

  test('should fall back to local wallet when no Web3 providers', async () => {
    // Mock no Web3 providers available
    delete global.Web3Modal
    delete global.window.ethereum

    walletManager.generateLocalWallet = jest.fn().mockResolvedValue('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')

    const address = await walletManager.connect()

    expect(walletManager.generateLocalWallet).toHaveBeenCalled()
    expect(address).toBe('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')
  })

  test('should sign messages', async () => {
    const mockKeyPair = {
      privateKey: { type: 'private' }
    }
    walletManager.localKeyPair = mockKeyPair

    const mockSignature = new Uint8Array([1, 2, 3, 4])
    global.crypto.subtle.sign.mockResolvedValue(mockSignature)

    const signature = await walletManager.signMessage('test message')

    expect(global.crypto.subtle.sign).toHaveBeenCalledWith(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      mockKeyPair.privateKey,
      expect.any(Uint8Array)
    )
    expect(signature).toBeDefined()
  })

  test('should sign transactions', async () => {
    const mockTx = {
      type: 'transfer',
      amount: 100,
      to: '0x123'
    }

    walletManager.signMessage = jest.fn().mockResolvedValue('signature123')

    const signedTx = await walletManager.signTransaction(mockTx)

    expect(walletManager.signMessage).toHaveBeenCalledWith(JSON.stringify(mockTx))
    expect(signedTx).toEqual({
      ...mockTx,
      signature: 'signature123'
    })
  })

  test('should save and load keystores', async () => {
    const mockKeyPair = {
      publicKey: { type: 'public' },
      privateKey: { type: 'private' }
    }
    const address = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'

    // Mock encryption
    global.crypto.subtle.encrypt.mockResolvedValue(new Uint8Array([1, 2, 3]))

    await walletManager.saveKeystore(mockKeyPair, address)

    expect(localStorage.setItem).toHaveBeenCalledWith(
      `wallet_${address}`,
      expect.any(String)
    )
  })

  test('should disconnect properly', () => {
    // Set up connected state
    walletManager.connected = true
    walletManager.accounts = ['0x123']
    walletManager.provider = { type: 'provider' }
    walletManager.chainId = '0x1'

    // Mock Web3Modal
    walletManager.web3Modal = { clearCachedProvider: jest.fn() }

    walletManager.disconnect()

    expect(walletManager.connected).toBe(false)
    expect(walletManager.accounts).toEqual([])
    expect(walletManager.provider).toBeNull()
    expect(walletManager.chainId).toBeNull()
    expect(walletManager.web3Modal.clearCachedProvider).toHaveBeenCalled()
  })

  test('should dispatch wallet change events', () => {
    const mockDispatch = jest.fn()
    global.window.dispatchEvent = mockDispatch

    walletManager.updateWalletDisplay()

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'walletChanged',
        detail: {
          accounts: [],
          connected: false,
          chainId: null
        }
      })
    )
  })
})