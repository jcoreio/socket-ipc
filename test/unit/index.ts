import { afterEach, describe, it } from 'mocha'
import { expect } from 'chai'

import fs from 'fs'
import { range } from 'lodash'
import pTimeout from 'p-timeout'

import {
  MessageClient,
  MessageConnection,
  MessageEvent,
  MessageHandlerCommon,
  MessageHandlerOptions,
  MessageServer,
} from '../../src'

const TEST_SOCKET_PATH = '/tmp/socket-ipc-test'
const WAIT_TIMEOUT = 200

const waitForConnect = (
  handler: MessageHandlerCommon
): Promise<MessageConnection> =>
  pTimeout(
    new Promise((resolve: (connection: MessageConnection) => void) => {
      handler.on('connection', resolve)
    }),
    WAIT_TIMEOUT
  )

const waitForMessage = (handler: MessageHandlerCommon): Promise<MessageEvent> =>
  pTimeout(
    new Promise((resolve: (event: MessageEvent) => void) => {
      handler.on('message', resolve)
    }),
    WAIT_TIMEOUT
  )

const TEST_STRING = 'a test string message'
const TEST_BUFFER = Buffer.from('a test binary message')

describe('socket-ipc', () => {
  let messageHandlers: Array<MessageHandlerCommon> = []

  afterEach(() => {
    for (const messageHandler of messageHandlers) {
      messageHandler.stop()
    }
    messageHandlers = []
    if (fs.existsSync(TEST_SOCKET_PATH)) fs.unlinkSync(TEST_SOCKET_PATH)
  })

  function getServer(opts: MessageHandlerOptions = {}): MessageServer {
    const server = new MessageServer(TEST_SOCKET_PATH, opts)
    messageHandlers.push(server)
    return server
  }

  function getClient(opts: MessageHandlerOptions = {}): MessageClient {
    const client = new MessageClient(TEST_SOCKET_PATH, opts)
    messageHandlers.push(client)
    return client
  }

  it('resolves waitForConnection after connecting', async function() {
    const server = getServer()
    const client = getClient()

    expect(client.isConnected()).to.be.false
    server.start()
    client.start()
    await client.waitForConnection()
    expect(client.isConnected()).to.be.true
  })

  it('rejects waitForConnection after stopping client', async function() {
    const server = getServer()
    const client = getClient()

    expect(client.isConnected()).to.be.false
    server.start()
    client.start()
    await client.waitForConnection()
    client.stop()
    await expect(client.waitForConnection()).to.be.rejectedWith(
      'client is stopped'
    )
  })

  it('sends string messages from client to server', async function() {
    const server = getServer()
    const client = getClient()

    const connectPromise = waitForConnect(client)
    server.start()
    client.start()
    await connectPromise

    const messagePromise = waitForMessage(server)
    client.send(TEST_STRING)
    const event: MessageEvent = await messagePromise
    expect(event).to.deep.equal({
      data: TEST_STRING,
    })
  })

  it('sends string messages from server to client', async function() {
    const server = getServer()
    const client = getClient()

    const connectPromise = waitForConnect(server)
    server.start()
    client.start()
    await connectPromise

    const messagePromise = waitForMessage(client)
    server.send(TEST_STRING)
    const event: MessageEvent = await messagePromise
    expect(event).to.deep.equal({
      data: TEST_STRING,
    })
  })

  it('sends binary messages from client to server', async function() {
    const server = getServer({ binary: true })
    const client = getClient({ binary: true })

    const connectPromise = waitForConnect(client)
    server.start()
    client.start()
    await connectPromise

    const messagePromise = waitForMessage(server)
    client.send(TEST_BUFFER)
    const event: MessageEvent = await messagePromise
    expect(event).to.deep.equal({
      data: TEST_BUFFER,
    })
  })

  it('sends string messages from server to client', async function() {
    const server = getServer({ binary: true })
    const client = getClient({ binary: true })

    const connectPromise = waitForConnect(server)
    server.start()
    client.start()
    await connectPromise

    const messagePromise = waitForMessage(client)
    server.send(TEST_BUFFER)
    const event: MessageEvent = await messagePromise
    expect(event).to.deep.equal({
      data: TEST_BUFFER,
    })
  })

  it('sends messages from the server to specific clients', async function() {
    const server = getServer()
    const CLIENT_IDS = range(2)
    const clients = CLIENT_IDS.map(() => getClient())

    const connectPromises = clients.map(waitForConnect)
    server.start()
    for (const client of clients) client.start()
    await Promise.all(connectPromises)

    const getRequest = (clientId: number, messageId: number): string =>
      `client ${clientId} request ${messageId}`
    const getReply = (request: string): string => `reply: ${request}`

    server.on(
      'message',
      (event: MessageEvent, connection: MessageConnection) => {
        const { data } = event
        if (typeof data === 'string') connection.send(getReply(data))
      }
    )

    const NUM_MESSAGES = 3
    const waitForReplies = (
      client: MessageClient
    ): Promise<Array<Buffer | string>> =>
      pTimeout(
        new Promise((resolve: (replies: Array<Buffer | string>) => void) => {
          const replies: Array<Buffer | string> = []
          client.on('message', (event: MessageEvent) => {
            replies.push(event.data)
            if (NUM_MESSAGES === replies.length) resolve(replies)
          })
        }),
        WAIT_TIMEOUT
      )
    const replyPromises = clients.map(waitForReplies)

    for (const messageId of range(NUM_MESSAGES)) {
      for (const clientId of CLIENT_IDS) {
        clients[clientId].send(getRequest(clientId, messageId))
      }
    }

    const replies: Array<Array<Buffer | string>> = await Promise.all(
      replyPromises
    )
    expect(replies).to.deep.equal(
      CLIENT_IDS.map((clientId: number) =>
        range(NUM_MESSAGES).map((messageId: number) =>
          getReply(getRequest(clientId, messageId))
        )
      )
    )
  })

  it('converts from string to buffer at the server', async function() {
    const server = getServer({ binary: true })
    const client = getClient()

    const connectPromise = waitForConnect(client)
    server.start()
    client.start()
    await connectPromise

    const messagePromise = waitForMessage(server)
    client.send(TEST_STRING)
    const event: MessageEvent = await messagePromise
    expect(event).to.deep.equal({
      data: Buffer.from(TEST_STRING),
    })
  })

  it('converts from buffer to string at the server', async function() {
    const server = getServer()
    const client = getClient({ binary: true })

    const connectPromise = waitForConnect(client)
    server.start()
    client.start()
    await connectPromise

    const messagePromise = waitForMessage(server)
    client.send(TEST_BUFFER)
    const event: MessageEvent = await messagePromise
    expect(event).to.deep.equal({
      data: TEST_BUFFER.toString(),
    })
  })
})
