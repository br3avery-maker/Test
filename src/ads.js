export class AdsManager {
  constructor() {
    this.sdk = null
    this.initialized = false
    this.rewardedVideoCallback = null
  }

  async init() {
    if (typeof playgama !== 'undefined') {
      try {
        this.sdk = playgama
        // Initialize with your app ID (placeholder - replace with actual)
        await this.sdk.init({
          appId: 'tapmine-chain', // Replace with actual Playgama app ID
          debug: true // Set to false in production
        })
        this.initialized = true
        console.log('Playgama SDK initialized')
      } catch (error) {
        console.error('Failed to initialize Playgama SDK:', error)
      }
    } else {
      console.warn('Playgama SDK not loaded')
    }
  }

  isSupported() {
    return this.initialized && this.sdk
  }

  // Rewarded Video Ads
  async showRewardedVideo(callback) {
    if (!this.isSupported()) {
      console.warn('Rewarded videos not supported')
      return false
    }

    try {
      this.rewardedVideoCallback = callback
      const result = await this.sdk.ads.showRewardedVideo({
        onRewarded: () => {
          console.log('Rewarded video completed')
          if (this.rewardedVideoCallback) {
            this.rewardedVideoCallback('rewarded')
          }
        },
        onClosed: () => {
          console.log('Rewarded video closed')
          if (this.rewardedVideoCallback) {
            this.rewardedVideoCallback('closed')
          }
        },
        onError: (error) => {
          console.error('Rewarded video error:', error)
          if (this.rewardedVideoCallback) {
            this.rewardedVideoCallback('error', error)
          }
        }
      })

      return result
    } catch (error) {
      console.error('Failed to show rewarded video:', error)
      return false
    }
  }

  // Interstitial Ads
  async showInterstitial() {
    if (!this.isSupported()) {
      console.warn('Interstitial ads not supported')
      return false
    }

    try {
      const result = await this.sdk.ads.showInterstitial({
        onClosed: () => console.log('Interstitial closed'),
        onError: (error) => console.error('Interstitial error:', error)
      })
      return result
    } catch (error) {
      console.error('Failed to show interstitial:', error)
      return false
    }
  }

  // Banner Ads
  async showBanner(position = 'bottom') {
    if (!this.isSupported()) {
      console.warn('Banner ads not supported')
      return false
    }

    try {
      const result = await this.sdk.ads.showBanner({
        position: position, // 'top' or 'bottom'
        onError: (error) => console.error('Banner error:', error)
      })
      return result
    } catch (error) {
      console.error('Failed to show banner:', error)
      return false
    }
  }

  async hideBanner() {
    if (!this.isSupported()) return false

    try {
      await this.sdk.ads.hideBanner()
      return true
    } catch (error) {
      console.error('Failed to hide banner:', error)
      return false
    }
  }

  // Check ad availability
  canShowRewardedVideo() {
    return this.isSupported() && this.sdk.ads.isRewardedVideoAvailable()
  }

  canShowInterstitial() {
    return this.isSupported() && this.sdk.ads.isInterstitialAvailable()
  }

  canShowBanner() {
    return this.isSupported() && this.sdk.ads.isBannerAvailable()
  }

  // Game-specific reward methods
  async rewardExtraTaps(count = 5) {
    return new Promise((resolve) => {
      this.showRewardedVideo((result, error) => {
        if (result === 'rewarded') {
          resolve({ success: true, taps: count })
        } else {
          resolve({ success: false, reason: result, error })
        }
      })
    })
  }

  async rewardBooster(multiplier = 2, duration = 30) {
    return new Promise((resolve) => {
      this.showRewardedVideo((result, error) => {
        if (result === 'rewarded') {
          resolve({
            success: true,
            booster: { multiplier, duration, expires: Date.now() + duration * 1000 }
          })
        } else {
          resolve({ success: false, reason: result, error })
        }
      })
    })
  }

  async rewardTokens(amount = 100) {
    return new Promise((resolve) => {
      this.showRewardedVideo((result, error) => {
        if (result === 'rewarded') {
          resolve({ success: true, tokens: amount })
        } else {
          resolve({ success: false, reason: result, error })
        }
      })
    })
  }
}