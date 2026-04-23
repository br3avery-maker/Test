export class BotDetector {
  constructor() {
    this.tapHistory = []
    this.maxHistory = 100
    this.humanThresholds = {
      minInterval: 80,
      maxInterval: 500,
      maxRegularity: 0.3,
      minVariance: 5
    }
  }

  recordTap(tapData) {
    this.tapHistory.push({
      ...tapData,
      recordTime: Date.now()
    })
    
    if (this.tapHistory.length > this.maxHistory) {
      this.tapHistory.shift()
    }
  }

  verifyHumanTap(tapData) {
    if (this.tapHistory.length < 3) {
      return true
    }

    const checks = []
    
    // Check 1: Interval regularity
    const intervals = this.getRecentIntervals()
    if (intervals.length >= 2) {
      const regularity = this.calculateRegularity(intervals)
      checks.push({
        name: 'regularity',
        pass: regularity < this.humanThresholds.maxRegularity,
        value: regularity
      })
    }
    
    // Check 2: Coordinate variance (humans have natural jitter)
    const coords = this.tapHistory.slice(-10).map(t => [t.x, t.y])
    if (coords.length >= 3) {
      const variance = this.calculateCoordVariance(coords)
      checks.push({
        name: 'variance',
        pass: variance.x > this.humanThresholds.minVariance || 
              variance.y > this.humanThresholds.minVariance,
        value: variance
      })
    }
    
    // Check 3: Tap interval bounds
    if (intervals.length > 0) {
      const lastInterval = intervals[intervals.length - 1]
      checks.push({
        name: 'interval',
        pass: lastInterval >= this.humanThresholds.minInterval && 
              lastInterval <= this.humanThresholds.maxInterval,
        value: lastInterval
      })
    }
    
    // Check 4: Pressure plausibility
    if (tapData.pressure !== undefined) {
      checks.push({
        name: 'pressure',
        pass: tapData.pressure >= 0 && tapData.pressure <= 1,
        value: tapData.pressure
      })
    }
    
    // Check 5: Burst detection (too many taps too fast)
    const burstScore = this.detectBurst()
    checks.push({
      name: 'burst',
      pass: burstScore < 0.8,
      value: burstScore
    })
    
    const allPass = checks.every(c => c.pass)
    
    if (!allPass) {
      console.log('Bot check failed:', checks.filter(c => !c.pass))
    }
    
    return allPass
  }

  getRecentIntervals() {
    const intervals = []
    for (let i = 1; i < this.tapHistory.length; i++) {
      intervals.push(this.tapHistory[i].recordTime - this.tapHistory[i-1].recordTime)
    }
    return intervals
  }

  calculateRegularity(intervals) {
    if (intervals.length < 2) return 0
    
    const mean = intervals.reduce((sum, v) => sum + v, 0) / intervals.length
    const variance = intervals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / intervals.length
    const stdDev = Math.sqrt(variance)
    
    return mean > 0 ? stdDev / mean : 0
  }

  calculateCoordVariance(coords) {
    const xs = coords.map(c => c[0])
    const ys = coords.map(c => c[1])
    
    const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length
    const meanY = ys.reduce((sum, y) => sum + y, 0) / ys.length
    
    const varX = xs.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0) / xs.length
    const varY = ys.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0) / ys.length
    
    return { x: varX, y: varY }
  }

  detectBurst() {
    const recent = this.tapHistory.slice(-10)
    if (recent.length < 5) return 0
    
    const timeSpan = recent[recent.length - 1].recordTime - recent[0].recordTime
    if (timeSpan === 0) return 1
    
    const tapsPerSecond = (recent.length / timeSpan) * 1000
    return Math.min(tapsPerSecond / 15, 1) // 15 taps/sec is max plausible
  }

  isLikelyBot() {
    if (this.tapHistory.length < 10) return false
    
    const recentIntervals = this.getRecentIntervals().slice(-10)
    const regularity = this.calculateRegularity(recentIntervals)
    
    return regularity > 0.1 // Very regular = likely bot
  }
}