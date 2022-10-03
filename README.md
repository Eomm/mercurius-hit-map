# mercurius-hit-map

[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![ci](https://github.com/Eomm/mercurius-hit-map/actions/workflows/ci.yml/badge.svg)](https://github.com/Eomm/mercurius-hit-map/actions/workflows/ci.yml)

Find out which resolvers are used.

Versioning a GraphQL API is a hard task. You have to be sure that no one is using a resolver that you are going to remove and you have deprecated 42 months ago.

To know it you can dig into your logs and find out which resolvers are used, hoping all your team members have enabled the logs OR you can use this plugin that does it for you.

## Install

```
npm install mercurius-hit-map
```

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

TBD

- change the in-memory object to a database

## License

Copyright [Manuel Spigolon](https://github.com/Eomm), Licensed under [MIT](./LICENSE).
