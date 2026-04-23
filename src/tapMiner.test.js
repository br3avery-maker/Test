import { TapMiner } from '../src/tapMiner.js'

// Mock crypto API
global.crypto = {
  subtle: {
    digest: () => Promise.resolve(new Uint8Array(32))
  }
}

describe('TapMiner', () => {
  let tapMiner

  beforeEach(() => {
    tapMiner = new TapMiner()
    jest.clearAllMocks()

    // Mock SHA-256 to return predictable hashes
    global.crypto.subtle.digest.mockImplementation(async (algorithm, data) => {
      // Simple mock: return first byte of data repeated
      const dataArray = new Uint8Array(data)
      const result = new Uint8Array(32)
      result.fill(dataArray[0] || 0)
      return result.buffer
    })
  })

  test('should initialize with correct default values', () => {
    expect(tapMiner.taps).toEqual([])
    expect(tapMiner.hashAttempts).toBe(0)
    expect(tapMiner.successCount).toBe(0)
    expect(tapMiner.difficulty).toBe(4)
    expect(tapMiner.isMining).toBe(false)
  })

  test('should record taps correctly', () => {
    const tapData = {
      x: 100,
      y: 200,
      pressure: 0.8,
      duration: 150,
      radius: 20
    }

    const beforeTime = Date.now()
    tapMiner.recordTap(tapData)
    const afterTime = Date.now()

    expect(tapMiner.taps).toHaveLength(1)
    expect(tapMiner.taps[0]).toMatchObject(tapData)
    expect(tapMiner.taps[0].recordTime).toBeGreaterThanOrEqual(beforeTime)
    expect(tapMiner.taps[0].recordTime).toBeLessThanOrEqual(afterTime)
  })

  test('should maintain rolling window of taps', () => {
    // Record more than maxWindowSize taps
    for (let i = 0; i < 60; i++) {
      tapMiner.recordTap({ x: i, y: i, pressure: 0.5 })
    }

    expect(tapMiner.tapWindow).toHaveLength(50) // maxWindowSize
    expect(tapMiner.tapWindow[0]).toEqual(
      expect.objectContaining({ x: 10, y: 10 }) // Oldest remaining tap
    )
  })

  test('should build tap entropy from recent taps', () => {
    // Record some test taps
    tapMiner.recordTap({ x: 100, y: 200, pressure: 0.8, duration: 150, interval: 200 })
    tapMiner.recordTap({ x: 150, y: 250, pressure: 0.7, duration: 140, interval: 180 })
    tapMiner.recordTap({ x: 120, y: 220, pressure: 0.9, duration: 160, interval: 190 })

    const entropy = tapMiner.buildTapEntropy()

    expect(entropy).toBeDefined()
    expect(entropy.taps).toHaveLength(3)
    expect(entropy.aggregate).toBeDefined()
    expect(entropy.aggregate).toHaveProperty('avgX')
    expect(entropy.aggregate).toHaveProperty('avgY')
    expect(entropy.aggregate).toHaveProperty('avgDuration')
  })

  test('should set difficulty correctly', () => {
    tapMiner.setDifficulty(6)
    expect(tapMiner.difficulty).toBe(6)

    tapMiner.setDifficulty(2)
    expect(tapMiner.difficulty).toBe(2)
  })

  test('should calculate hash correctly', async () => {
    const testData = {
      account: '0x123',
      previous: 'abc123',
      nonce: 42
    }

    const hash = await tapMiner.calculateHash(testData)

    expect(typeof hash).toBe('string')
    expect(hash.length).toBe(64)
    expect(global.crypto.subtle.digest).toHaveBeenCalledWith(
      'SHA-256',
      expect.any(Uint8Array)
    )
  })

  test('should mine successfully with low difficulty', async () => {
    tapMiner.setDifficulty(0) // Easy difficulty

    // Mock getLatestBlockHash
    tapMiner.getLatestBlockHash = jest.fn().mockReturnValue('genesis123')

    // Record a tap to provide entropy
    tapMiner.recordTap({ x: 100, y: 200, pressure: 0.8 })

    const mockCallback = jest.fn()
    tapMiner.on('hashFound', mockCallback)

    const result = await tapMiner.mineFromTaps('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')

    expect(result).toBe(true)
    expect(tapMiner.successCount).toBeGreaterThan(0)
    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        difficulty: 0,
        reward: 100
      })
    )
  })

  test('should handle mining failure', async () => {
    tapMiner.setDifficulty(10) // Very hard difficulty

    tapMiner.recordTap({ x: 100, y: 200, pressure: 0.8 })
    tapMiner.getLatestBlockHash = jest.fn().mockReturnValue('genesis123')

    const mockCallback = jest.fn()
    tapMiner.on('miningFailed', mockCallback)

    const result = await tapMiner.mineFromTaps('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')

    expect(result).toBe(false)
    expect(mockCallback).toHaveBeenCalled()
  })

  test('should prevent concurrent mining', async () => {
    tapMiner.setDifficulty(0)
    tapMiner.recordTap({ x: 100, y: 200, pressure: 0.8 })
    tapMiner.getLatestBlockHash = jest.fn().mockReturnValue('genesis123')

    // Start two mining operations
    const promise1 = tapMiner.mineFromTaps('0x123')
    const promise2 = tapMiner.mineFromTaps('0x456')

    const results = await Promise.all([promise1, promise2])

    // One should succeed, one should be blocked by concurrency check
    expect(results.filter(r => r === true)).toHaveLength(1)
    expect(results.filter(r => r === false)).toHaveLength(1)
  })

  test('should construct block data correctly', async () => {
    const params = {
      account: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      representative: '0x456',
      tapEntropy: 'entropy123',
      nonce: 42,
      previousBlock: 'prev123',
      tapData: { x: 100, y: 200, pressure: 0.8, timestamp: 1234567890 }
    }

    const blockData = await tapMiner.constructBlockData(params)

    expect(blockData).toMatchObject({
      index: expect.any(Number),
      type: 'mined',
      account: params.account,
      previous: params.previousBlock,
      representative: params.representative,
      balance: 100,
      link: expect.any(String),
      work: expect.any(String),
      tap_entropy: params.tapEntropy,
      timestamp: expect.any(Number)
    })
  })

  test('should emit tap recorded events', () => {
    const mockCallback = jest.fn()
    tapMiner.on('tapRecorded', mockCallback)

    const tapData = { x: 100, y: 200, pressure: 0.8 }
    tapMiner.recordTap(tapData)

    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining(tapData)
    )
  })
})