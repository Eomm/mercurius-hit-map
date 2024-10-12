'use strict'

const EventEmitter = require('events')
const fp = require('fastify-plugin')
const { GraphQLObjectType } = require('graphql')

const MemoryStore = require('./lib/MemoryStore')

const kVisited = Symbol('mercurius-hit-map:visited')

function mercuriusHitMap (app, opts, next) {
  const ee = new EventEmitter()

  const store = opts.store?.(ee) || MemoryStore(ee)
  if (opts.store && typeof store.readHits !== 'function') {
    return next(new Error('store factory must return an object with a readHits function'))
  }
  app.decorate('getHitMap', async function getHitMap () { return store.readHits() })

  try {
    wrapGqlSchema(app.graphql.schema, hitCounter)
    next()
  } catch (error) {
    next(error)
  }

  function hitCounter (originalFn, objectType, objectField) {
    ee.emit('wrap', {
      typeName: objectType.name,
      fieldName: objectField.name,
      rawType: objectType,
      rawField: objectField
    })

    return function hitResolver (...args) {
      try {
        ee.emit('hit', {
          typeName: objectType.name,
          fieldName: objectField.name,
          rawType: objectType,
          rawField: objectField
        })
      } catch (error) {
        app.log.warn(error, 'Error while emitting hit event')
      }
      return originalFn(...args)
    }
  }
}

function wrapGqlSchema (schema, hitCounter) {
  const typeMap = schema.getTypeMap()
  for (const type of Object.values(typeMap)) {
    if (type instanceof GraphQLObjectType && !isSystemType(type)) {
      wrapType(type, hitCounter)
    }
  }
}

function wrapType (objectType, hitCounter) {
  // if (objectType[kVisited] || !objectType.getFields) { return }

  const fields = objectType.getFields()
  for (const typeField of Object.values(fields)) {
    const resolveFn = typeField.resolve || buildDefaultResolver(typeField)
    // if (!typeField[kVisited]) { // ? coverage
    typeField[kVisited] = true
    typeField.resolve = hitCounter(resolveFn, objectType, typeField)
    // }
  }
}

function buildDefaultResolver (objectField) {
  return parent => parent[objectField.name]
}

function isSystemType (objectType) {
  // __Schema, __Type, __TypeKind, __Field, __InputValue, __EnumValue, __Directive
  return objectType.astNode === undefined && objectType.name.startsWith('__')
}

module.exports = fp(mercuriusHitMap,
  {
    name: 'mercurius-hit-map',
    fastify: '5.x',
    dependencies: ['mercurius']
  }
)
