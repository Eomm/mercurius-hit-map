# mercurius-hit-map

[![Build Status](https://github.com/Eomm/mercurius-hit-map/workflows/ci/badge.svg)](https://github.com/Eomm/mercurius-hit-map/actions)
[![npm](https://img.shields.io/npm/v/mercurius-hit-map)](https://www.npmjs.com/package/mercurius-hit-map)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Find out which resolvers are used.

Versioning a GraphQL API is a hard task. You have to be sure that no one is using a resolver that you are going to remove and you have deprecated 42 months ago.

To know it you can dig into your logs and find out which resolvers are used, hoping all your team members have enabled the logs OR you can use this plugin that does it for you.

## Install

```
npm install mercurius-hit-map
```

### Compatibility

| Plugin version | Fastify version |
| ------------- |:---------------:|
| `^2.0.0` | `^5.0.0` |
| `^1.0.0` | `^4.0.0` |

## Usage

Spin up your GQL server as you do usally and add the plugin.
It will add an `async function getHitMap()` decorator to the Fastify instance.

```js
const app = Fastify()
app.register(mercurius, {
  schema,
  resolvers,
  subscription // it is supported too!
})

app.register(require('mercurius-hit-map'))

app.get('/hit', async () => {
  const hitMap = await app.getHitMap()
  return hitMap
})
```

Now you can:

- call the `/hit` your server's endpoint and get the hit map
- configure a cron job to call the endpoint and store the hit map in a database
- configure an interval to log the hit map
- anything you want that gives you the hit map!

The hit map is a JSON object that maps the application's GQL Schema with the number of times that resolver has been called.

By default the hit map is an in-memory object that is reset every time you restart the server.

Given the following schema:

```graphql
  type User {
    nick: String
    name: String
  }

  type Query {
    hello: User
  }

  type Mutation {
    updateName(name: String): User
  }

  type Subscription {
    userChanges: User
  }
```

The hit map will looks like:

```json
{
  "Query": {
    "hello": 4
  },
  "Mutation": {
    "updateName": 1
  },
  "Subscription": {
    "userChanges": 1
  },
  "User": {
    "nick": 1,
    "name": 5
  }
}
```


## Options

The plugin accepts an options object as second parameter.

### store

To store the hit map in a custom datasource you can set the `store` option.
It must be a factory function that accepts an EventEmitter as argument
and returns an object with the `readHits` property.

The event emitter is used to notify two events:

- `wrap`: it is emitted when the application is starting. If you throw an error in the listener the application will not start.
- `hit`: it is emitted every time a resolver is called. If you throw an error in the listener, it will be log as a `WARN`. The resolver will be executed as usual.

If you set an `async function` as listener, the function will be not awaited.
In this case any you must handle the error in the listener itself.

Each event gets an object as argument with the following properties:

```js
{
  typeName: 'Query', // the Type object name
  fieldName: 'hello' // the Type object's field name
}
```

The following code shows the basic structure of the store object:

```js
app.register(require('mercurius-hit-map'), {
  store: function customFactory (eventEmitter) {
  
    // sync function example
    eventEmitter.on('wrap', (item) => {
      // prepare the item to be stored
    })

    // async function example
    eventEmitter.on('hit', async (item) => {
      try {
        // increment the counter
      } catch (error) {
        // ops, something went wrong
      }
    })

    return {
      readHits: async function () {
        // return the hit map
      },
    }
  }
})
```

## License

Copyright [Manuel Spigolon](https://github.com/Eomm), Licensed under [MIT](./LICENSE).
