'use strict'

const fp = require('fastify-plugin')

function mercuriusHitMap (app, opts, next) {
  next()
}

module.exports = fp(mercuriusHitMap,
  {
    name: 'mercurius-hit-map',
    fastify: '4.x',
    dependencies: ['mercurius']
  }
)
