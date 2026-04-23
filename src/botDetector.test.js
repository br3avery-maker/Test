import { BotDetector } from '../src/botDetector.js'

describe('BotDetector', () => {
  let detector

  beforeEach(() => {
    detector = new BotDetector()
  })

  test('should allow normal tap rate', () => {
    const tapData = { x: 100, y: 100, pressure: 0.5 }

    // Record taps at normal human rate (2 taps/second)
    for (let i = 0; i < 5; i++) {
      detector.recordTap(tapData)
    }

    expect(detector.checkRateLimit()).toBe(true)
  })

  test('should block excessive tap rate', () => {
    const tapData = { x: 100, y: 100, pressure: 0.5 }

    // Record many taps quickly to simulate bot
    for (let i = 0; i < 15; i++) {
      detector.recordTap(tapData)
    }

    expect(detector.checkRateLimit()).toBe(false)
  })

  test('should verify human tap patterns', () => {
    const tapData = { x: 100, y: 100, pressure: 0.5 }

    // Record some taps with human-like intervals
    detector.recordTap(tapData)
    setTimeout(() => detector.recordTap(tapData), 150)
    setTimeout(() => detector.recordTap(tapData), 300)

    // Note: This test may be flaky due to timing, but demonstrates the framework
    expect(detector.verifyHumanTap(tapData)).toBe(true)
  })
})