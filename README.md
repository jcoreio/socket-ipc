# Socket IPC

WebSocket-like communications over local UNIX sockets

## Installation

```
$ npm install socket-ipc
```

## Creating a Message Server

```js
var ipc = require('socket-ipc')

var server = new ipc.MessageServer('/tmp/socket-loc')

server.on('message', function(message) {
  console.log('got message:', message.data)
  server.send('back at you: ' + message.data)
})

server.on('connection', function(connection) {
  console.log('client connected')
})

server.start()
```

## Connecting To a Message Server

```js
var ipc = require('socket-ipc')

var client = new ipc.MessageClient('/tmp/socket-loc')

client.on('connection', function(connection) {
  console.log('connected. sending greetings...')
  client.send('greetings')
})

client.on('message', function(message) {
  console.log('got message:', message.data)
})

client.start()
```

## License

(The Apache 2.0 License)

Copyright (c) 2016 JCore Systems LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.