'use strict'

class MemoryStore {
  constructor (eventEmitter) {
    this.store = Object.create(null)
    this.eventEmitter = eventEmitter
    this.eventEmitter.on('hit', this.storeHit.bind(this))
  }

  storeHit (hitEvent) {
    const { typeName, fieldName } = hitEvent

    if (!this.store[typeName]) {
      this.store[typeName] = Object.create(null)
    }
    if (!this.store[typeName][fieldName]) {
      this.store[typeName][fieldName] = 0
    }

    this.store[typeName][fieldName]++
  }

  readHits () {
    return Object.assign({}, this.store)
  }
}

module.exports = MemoryStore
