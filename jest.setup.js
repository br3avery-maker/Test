// Jest setup for browser APIs
import { TextEncoder, TextDecoder } from 'util'

// Polyfill TextEncoder/TextDecoder
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString() },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
global.localStorage = localStorageMock

// Mock performance.now
global.performance = {
  now: () => Date.now(),
}

// Ensure crypto.getRandomValues is available
if (!global.crypto) {
  global.crypto = {}
}
if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = (array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
    return array
  }
}