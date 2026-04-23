import { AdsManager } from '../src/ads.js'

describe('AdsManager', () => {
  let adsManager

  beforeEach(() => {
    adsManager = new AdsManager()
    // Mock playgama SDK
    global.playgama = {
      init: () => Promise.resolve(),
      ads: {
        showRewardedVideo: () => Promise.resolve({ success: true }),
        showInterstitial: () => Promise.resolve({ success: true }),
        showBanner: () => Promise.resolve({ success: true }),
        hideBanner: () => Promise.resolve(),
        isRewardedVideoAvailable: () => true,
        isInterstitialAvailable: () => true,
        isBannerAvailable: () => true
      }
    }
  })

  test('should initialize SDK successfully', async () => {
    let initCalled = false
    global.playgama.init = () => {
      initCalled = true
      return Promise.resolve()
    }

    await adsManager.init()

    expect(initCalled).toBe(true)
    expect(adsManager.initialized).toBe(true)
    expect(adsManager.sdk).toBe(global.playgama)
  })

  test('should handle initialization failure', async () => {
    global.playgama.init = () => Promise.reject(new Error('SDK failed'))

    await adsManager.init()

    expect(adsManager.initialized).toBe(false)
  })

  test('should check SDK availability', () => {
    expect(adsManager.isSupported()).toBe(false)

    adsManager.sdk = global.playgama
    adsManager.initialized = true

    expect(adsManager.isSupported()).toBe(true)
  })

  test('should show rewarded video with callbacks', async () => {
    adsManager.sdk = global.playgama
    adsManager.initialized = true

    let rewarded = false
    let closed = false

    global.playgama.ads.showRewardedVideo = ({ onRewarded, onClosed }) => {
      onRewarded()
      onClosed()
      return Promise.resolve({ success: true })
    }

    const result = await adsManager.showRewardedVideo((status) => {
      if (status === 'rewarded') rewarded = true
      if (status === 'closed') closed = true
    })

    expect(result.success).toBe(true)
    expect(rewarded).toBe(true)
    expect(closed).toBe(true)
  })

  test('should show interstitial ads', async () => {
    adsManager.sdk = global.playgama
    adsManager.initialized = true

    const result = await adsManager.showInterstitial()

    expect(result.success).toBe(true)
  })

  test('should show banner ads', async () => {
    adsManager.sdk = global.playgama
    adsManager.initialized = true

    const result = await adsManager.showBanner('bottom')

    expect(result.success).toBe(true)
  })

  test('should check ad availability', () => {
    adsManager.sdk = global.playgama
    adsManager.initialized = true

    expect(adsManager.canShowRewardedVideo()).toBe(true)
    expect(adsManager.canShowInterstitial()).toBe(true)
    expect(adsManager.canShowBanner()).toBe(true)
  })

  test('should reward extra taps on ad completion', async () => {
    adsManager.sdk = global.playgama
    adsManager.initialized = true

    global.playgama.ads.showRewardedVideo = ({ onRewarded }) => {
      onRewarded()
      return Promise.resolve({ success: true })
    }

    const result = await adsManager.rewardExtraTaps(5)

    expect(result.success).toBe(true)
    expect(result.taps).toBe(5)
  })

  test('should reward tokens on ad completion', async () => {
    adsManager.sdk = global.playgama
    adsManager.initialized = true

    global.playgama.ads.showRewardedVideo = ({ onRewarded }) => {
      onRewarded()
      return Promise.resolve({ success: true })
    }

    const result = await adsManager.rewardTokens(100)

    expect(result.success).toBe(true)
    expect(result.tokens).toBe(100)
  })

  test('should handle ad failure', async () => {
    adsManager.sdk = global.playgama
    adsManager.initialized = true

    global.playgama.ads.showRewardedVideo = ({ onClosed }) => {
      onClosed()
      return Promise.resolve({ success: true })
    }

    const result = await adsManager.rewardExtraTaps()

    expect(result.success).toBe(false)
    expect(result.reason).toBe('closed')
  })

  test('should return false when SDK not available', async () => {
    adsManager.initialized = false

    const result = await adsManager.showRewardedVideo()

    expect(result).toBe(false)
  })
})