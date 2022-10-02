'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const mercurius = require('mercurius')

const mercuriusHitMap = require('..')

const schema = `

  scalar Date

  enum Status {
    PENDING
  }

  type TypeObject {
    plainField: String
    scalarField: Date
    objectField: ObjectTypeField
    enumField: Status
  }

  type ObjectTypeField {
    intField: Int
  }

  input TypeInput {
    inputField: String
    inputObjectField: InputObjectField
  }

  input InputObjectField {
    inputIntField: Int
  }

  type Query {
    testPlain(msg: String!): String
    testObject: TypeObject
  }

  type Mutation {
    testInput(input: TypeInput!): String
    neverCalled: String
  }
`

const resolvers = {
  Query: {
    testPlain (parent, args, context, info) { return 'testPlain' },
    testObject (parent, args, context, info) {
      return {
        plainField: 'testObject',
        scalarField: new Date(),
        enumField: 'PENDING',
        objectField: {
          intField: 99
        }
      }
    }
  },
  Mutation: {
    testInput (parent, args, context, info) { return 'testInput' },
    neverCalled (parent, args, context, info) { return 'neverCalled' }
  },
  TypeInput (parent, args, context, info) {
    return {
      inputField: 'testInput',
      inputObjectField: {
        inputIntField: 42
      }
    }
  },
  ObjectTypeField: {
    intField (parent, args, context, info) { return parent.intField }
  },
  TypeObject: {
    plainField (parent, args, context, info) { return 'plainField' },
    scalarField (parent, args, context, info) { return new Date('2022-10-02') },
    objectField (parent, args, context, info) { return { intField: 66 } }
  },
  Status (parent, args, context, info) {
    return 'pending'
  }
}

function buildApp (t, opts) {
  const app = Fastify()
  t.teardown(app.close.bind(app))

  app.register(mercurius, {
    schema,
    resolvers
  })
  app.register(mercuriusHitMap, opts)

  return app
}

test('should count the resolvers\' executions', async (t) => {
  const app = buildApp(t)

  const query = `
  query {
    A: testPlain(msg: "A")
    B: testPlain(msg: "B")
    C: testObject { plainField enumField }
    D: testObject { plainField scalarField objectField { intField } }
  }`

  const response = await gqlReq(app, query)

  const hitMap = await app.getHitMap()

  console.log(JSON.stringify(response, null, 2))
  console.log(JSON.stringify(hitMap, null, 2))
})

async function gqlReq (app, query, variables) {
  const response = await app.inject({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    url: '/graphql',
    body: { query, variables }
  })

  return response.json()
}
