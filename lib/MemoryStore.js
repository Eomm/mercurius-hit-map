'use strict'

class MemoryStore {
  constructor (eventEmitter) {
    this.store = Object.create(null)
    this.eventEmitter = eventEmitter
    this.eventEmitter.on('wrap', this.prapareHit.bind(this))
    this.eventEmitter.on('hit', this.storeHit.bind(this))
  }

  prapareHit (wrapEvent) {
    const { typeName, fieldName } = wrapEvent

    if (!this.store[typeName]) {
      this.store[typeName] = Object.create(null)
    }
    this.store[typeName][fieldName] = 0
  }

  storeHit (hitEvent) {
    const { typeName, fieldName } = hitEvent
    this.store[typeName][fieldName]++
  }

  readHits () {
    return Object.assign({}, this.store)
  }
}

module.exports = function factory (ee) {
  return new MemoryStore(ee)
}
