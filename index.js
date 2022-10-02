'use strict'

const EventEmitter = require('events')
const fp = require('fastify-plugin')
const {
  GraphQLObjectType,
  GraphQLInputObjectType
} = require('graphql')

const MemoryStore = require('./lib/MemoryStore')

const kVisited = Symbol('mercurius-hit-map:visited')

function mercuriusHitMap (app, opts, next) {
  const ee = new EventEmitter()

  function hitCounter (originalFn, objectType, objectField) {
    return function hitResolver (...args) {
      ee.emit('hit', {
        typeName: objectType.name,
        fieldName: objectField.name,
        rawType: objectType,
        rawField: objectField
      })
      return originalFn(...args)
    }
  }

  wrapGqlSchema(app.graphql.schema, hitCounter)

  const store = new MemoryStore(ee)
  app.decorate('getHitMap', async function getHitMap () {
    return store.readHits()
  })

  next()
}

function wrapGqlSchema (schema, hitCounter) {
  const typeMap = schema.getTypeMap()
  for (const type of Object.values(typeMap)) {
    if ((type instanceof GraphQLObjectType ||
       type instanceof GraphQLInputObjectType) &&
       !isSystemType(type)) {
      wrapType(type, hitCounter)
    }
  }
}

function wrapType (type, hitCounter) {
  if (type[kVisited] || !type.getFields) { return }

  const fields = type.getFields()
  for (const schemaTypeField of Object.values(fields)) {
    const resolveFn = schemaTypeField.resolve
    if (!schemaTypeField[kVisited] && resolveFn) {
      schemaTypeField[kVisited] = true
      schemaTypeField.resolve = hitCounter(resolveFn, type, schemaTypeField)
    }
  }
}

function isSystemType (objectType) {
  // __Schema, __Type, __TypeKind, __Field, __InputValue, __EnumValue, __Directive
  return objectType.astNode === undefined && objectType.name.startsWith('__')
}

module.exports = fp(mercuriusHitMap,
  {
    name: 'mercurius-hit-map',
    fastify: '4.x',
    dependencies: ['mercurius']
  }
)
