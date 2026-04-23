import { Blockchain } from '../src/blockchain.js'

describe('Blockchain', () => {
  let blockchain

  beforeEach(() => {
    blockchain = new Blockchain()
    // Clear localStorage for clean tests
    localStorage.clear()
  })

  test('should create genesis block', () => {
    const genesis = blockchain.createGenesisBlock()
    expect(genesis).toBeDefined()
    expect(genesis.index).toBe(0)
    expect(genesis.type).toBe('genesis')
    expect(genesis.hash).toBeDefined()
  })

  test('should calculate hash correctly', async () => {
    const testBlock = {
      index: 1,
      type: 'mined',
      account: '0x123',
      previous: 'abc123',
      representative: '0x456',
      balance: 100,
      link: 'def456',
      work: '0000',
      tap_entropy: 'entropy123',
      timestamp: Date.now()
    }

    const hash = await blockchain.calculateHash(testBlock)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBe(64) // SHA-256 produces 64 char hex string
  })

  test('should add valid block', async () => {
    blockchain.createGenesisBlock()
    const initialLength = blockchain.chain.length

    const testBlock = {
      type: 'mined',
      account: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      previous: blockchain.chain[blockchain.chain.length - 1].hash,
      representative: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      balance: 100,
      link: 'test-link',
      work: '1234',
      tap_entropy: 'tap-entropy-123',
      timestamp: Date.now()
    }

    // Mock difficulty to 0 for easier testing
    blockchain.difficulty = 0

    const result = await blockchain.addBlock(testBlock)
    expect(result).toBe(true)
    expect(blockchain.chain.length).toBe(initialLength + 1)
  })

  test('should reject invalid difficulty', async () => {
    blockchain.createGenesisBlock()

    const testBlock = {
      type: 'mined',
      account: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      previous: blockchain.chain[blockchain.chain.length - 1].hash,
      representative: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      balance: 100,
      link: 'test-link',
      work: '1234',
      tap_entropy: 'tap-entropy-123',
      timestamp: Date.now()
    }

    // Set high difficulty that won't be met
    blockchain.difficulty = 8

    const result = await blockchain.addBlock(testBlock)
    expect(result).toBe(false)
  })

  test('should maintain account chains', async () => {
    blockchain.createGenesisBlock()

    const account = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'

    const testBlock = {
      type: 'mined',
      account: account,
      previous: blockchain.chain[blockchain.chain.length - 1].hash,
      representative: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      balance: 100,
      link: 'test-link',
      work: '1234',
      tap_entropy: 'tap-entropy-123',
      timestamp: Date.now()
    }

    blockchain.difficulty = 0
    await blockchain.addBlock(testBlock)

    expect(blockchain.accountChains.has(account)).toBe(true)
    expect(blockchain.accountChains.get(account).length).toBe(1)
  })

  test('should calculate balance correctly', () => {
    blockchain.createGenesisBlock()

    // Manually add some mined blocks to test balance
    blockchain.chain.push({
      type: 'mined',
      balance: 100
    })
    blockchain.chain.push({
      type: 'mined',
      balance: 100
    })

    const balance = blockchain.getBalance()
    expect(balance).toBe(200) // 2 mined blocks × 100 tokens each
  })

  test('should export and load chain data', () => {
    blockchain.createGenesisBlock()

    const exported = blockchain.export()
    expect(exported).toBeDefined()
    expect(Array.isArray(exported)).toBe(true)

    const newBlockchain = new Blockchain()
    newBlockchain.load(exported)

    expect(newBlockchain.chain.length).toBe(blockchain.chain.length)
    expect(newBlockchain.chain[0].hash).toBe(blockchain.chain[0].hash)
  })
})