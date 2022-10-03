'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const mercurius = require('mercurius')
const WebSocket = require('ws')
const { GraphQLEnumType } = require('graphql')
const { once } = require('events')

const mercuriusHitMap = require('..')

const schema = `

  scalar Date

  enum Status {
    PENDING
  }

  directive @fooDirective(
    requires: Status = PENDING,
  ) on OBJECT | FIELD_DEFINITION

  type TypeObject {
    plainField: String
    scalarField: Date
    objectField: ObjectTypeField
    enumField: Status
  }

  type ObjectTypeField {
    intField: Int
    zeroField: Int
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
    testSub: Boolean
    neverCalled: String
  }

  type Notification {
    id: ID!
    message: String
  }

  type Subscription {
    notificationAdded: Notification
  }
`

let globalCounter = 0

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
    async testSub (parent, args, context, info) {
      globalCounter++
      await context.pubsub.publish({
        topic: 'NOTIFICATION_ADDED',
        payload: {
          notificationAdded: { id: globalCounter, message: 'foo bar' }
        }
      })
      return true
    },
    neverCalled (parent, args, context, info) { return 'neverCalled' }
  },
  ObjectTypeField: {
    intField (parent, args, context, info) { return parent.intField }
    // zeroField intentionally not implemented
  },
  TypeObject: {
    plainField (parent, args, context, info) { return parent.plainField },
    scalarField (parent, args, context, info) { return new Date('2022-10-02') },
    objectField (parent, args, context, info) { return { intField: 66 } }
  },
  Status: new GraphQLEnumType({
    name: 'Status',
    values: {
      pending: { value: 'PENDING' }
    }
  }),
  Subscription: {
    notificationAdded: {
      subscribe: async (root, args, context) =>
        await context.pubsub.subscribe('NOTIFICATION_ADDED')
    }
  }
}

function buildApp (t, opts) {
  const app = Fastify()
  t.teardown(app.close.bind(app))

  app.register(mercurius, {
    schema,
    resolvers,
    subscription: true
  })
  app.register(mercuriusHitMap, opts)

  app.get('/hit', () => {
    return app.getHitMap()
  })

  return app
}

test('should count the resolvers\' executions', async (t) => {
  const app = buildApp(t)

  const query = `
  query {
    A: testPlain(msg: "A")
    B: testPlain(msg: "B")
    BB: testPlain(msg: "B")
    C: testObject { plainField x:enumField y:enumField z:enumField}
    D: testObject { plainField scalarField objectField { intField } }
  }`

  const response = await gqlReq(app, query)
  t.strictSame(response, {
    data: {
      A: 'testPlain',
      B: 'testPlain',
      BB: 'testPlain',
      C: {
        plainField: 'testObject',
        x: 'pending',
        y: 'pending',
        z: 'pending'
      },
      D: {
        plainField: 'testObject',
        scalarField: '2022-10-02T00:00:00.000Z',
        objectField: {
          intField: 66
        }
      }
    }
  })

  const hitMap = await app.getHitMap()
  t.same(hitMap, {
    Query: {
      testPlain: 3,
      testObject: 2
    },
    TypeObject: {
      plainField: 2,
      scalarField: 1,
      objectField: 1,
      enumField: 3
    },
    ObjectTypeField: {
      intField: 1,
      zeroField: 0
    },
    Mutation: {
      testInput: 0,
      testSub: 0,
      neverCalled: 0
    },
    Notification: {
      id: 0,
      message: 0
    },
    Subscription: {
      notificationAdded: 0
    }
  })
})

test('should count the resolvers\' executions mutation', async (t) => {
  const app = buildApp(t)

  const query = `
  mutation {
    A: testInput(input: { inputField: "A" })
    B: testInput(input: { inputField: "B", inputObjectField: { inputIntField: 1 } })
    C: testInput(input: { inputField: "C" })
  }`

  const response = await gqlReq(app, query)
  t.strictSame(response, { data: { A: 'testInput', B: 'testInput', C: 'testInput' } })

  const hitMap = await app.getHitMap()
  t.same(hitMap, {
    TypeObject: {
      plainField: 0,
      scalarField: 0,
      objectField: 0,
      enumField: 0
    },
    ObjectTypeField: {
      intField: 0,
      zeroField: 0
    },
    Query: {
      testPlain: 0,
      testObject: 0
    },
    Mutation: {
      testInput: 3,
      testSub: 0,
      neverCalled: 0
    },
    Notification: {
      id: 0,
      message: 0
    },
    Subscription: {
      notificationAdded: 0
    }
  })
})

test('should count the resolvers\' executions mutation and subscription', async (t) => {
  const app = buildApp(t)

  const query = 'mutation { A: testSub }'

  await app.listen({ port: 0 })
  {
    const response = await gqlReq(app, query)
    t.strictSame(response, { data: { A: true } })
  }

  const hitMap = await app.getHitMap()
  t.same(hitMap, {
    TypeObject: {
      plainField: 0,
      scalarField: 0,
      objectField: 0,
      enumField: 0
    },
    ObjectTypeField: {
      intField: 0,
      zeroField: 0
    },
    Query: {
      testPlain: 0,
      testObject: 0
    },
    Mutation: {
      testInput: 0,
      testSub: 1,
      neverCalled: 0
    },
    Notification: {
      id: 0,
      message: 0
    },
    Subscription: {
      notificationAdded: 0
    }
  })

  const ws = new WebSocket('ws://localhost:' + (app.server.address()).port + '/graphql', 'graphql-ws')
  const client = WebSocket.createWebSocketStream(ws, { encoding: 'utf8', objectMode: true })
  t.teardown(client.destroy.bind(client))
  client.setEncoding('utf8')

  client.write(JSON.stringify({
    type: 'connection_init'
  }))

  client.write(JSON.stringify({
    id: 1,
    type: 'start',
    payload: {
      query: 'subscription { notificationAdded { id } }'
    }
  }))

  {
    const chunk = await once(client, 'data')
    const data = JSON.parse(chunk)
    t.equal(data.type, 'connection_ack')
  }

  {
    const response = await gqlReq(app, query)
    t.strictSame(response, { data: { A: true } })
  }

  {
    const chunk = await once(client, 'data')
    const data = JSON.parse(chunk)
    t.equal(data.type, 'data')
    t.same(data.payload, { data: { notificationAdded: { id: '2' } } })
  }

  const hitMapSub = await app.inject('/hit')
  t.same(hitMapSub.json(), {
    TypeObject: {
      plainField: 0,
      scalarField: 0,
      objectField: 0,
      enumField: 0
    },
    ObjectTypeField: {
      intField: 0,
      zeroField: 0
    },
    Query: {
      testPlain: 0,
      testObject: 0
    },
    Mutation: {
      testInput: 0,
      testSub: 2,
      neverCalled: 0
    },
    Notification: {
      id: 1,
      message: 0
    },
    Subscription: {
      notificationAdded: 1
    }
  })
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
