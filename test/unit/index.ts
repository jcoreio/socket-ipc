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

const waitForMessage = (handler: MessageHandlerCommon): Promise<MessageEvent> =>
  pTimeout(
    new Promise((resolve: (event: MessageEvent) => void) => {
      handler.on('message', resolve)
    }),
    WAIT_TIMEOUT
  )

const pause = (): Promise<void> =>
  new Promise((resolve: () => void) => {
    setTimeout(resolve, 2)
  })

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

  for (const tcp of [false, true]) {
    describe(`with ${tcp ? 'TCP' : 'UNIX'} sockets`, () => {
      function getOptions(opts: MessageHandlerOptions): MessageHandlerOptions {
        const socketOpts = tcp ? { port: 9898 } : { path: TEST_SOCKET_PATH }
        return { ...socketOpts, ...opts }
      }

      function getServer(opts: MessageHandlerOptions = {}): MessageServer {
        const server = new MessageServer(getOptions(opts))
        messageHandlers.push(server)
        return server
      }

      function getClient(opts: MessageHandlerOptions = {}): MessageClient {
        const client = new MessageClient(getOptions(opts))
        messageHandlers.push(client)
        return client
      }

      it('resolves waitForConnection after connecting', async function() {
        const server = getServer()
        const client = getClient()

        expect(client.isConnected()).to.be.false
        await server.start()
        await client.start()
        expect(client.isConnected()).to.be.true
      })

      it('rejects waitForConnection after stopping client', async function() {
        const server = getServer()
        const client = getClient()

        expect(client.isConnected()).to.be.false
        await server.start()
        await client.start()
        client.stop()
        await expect(client.waitForConnection()).to.be.rejectedWith(
          'client is stopped'
        )
      })

      it('is listening to server socket when server.start() resolves', async function() {
        const server = getServer()

        expect(server.isListening()).to.be.false
        await server.start()
        expect(server.isListening()).to.be.true
      })

      it('sends string messages from client to server', async function() {
        const server = getServer()
        const client = getClient()

        await server.start()
        await client.start()

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

        await server.start()
        await client.start()

        if (tcp) await pause()

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

        await server.start()
        await client.start()

        const messagePromise = waitForMessage(server)
        client.send(TEST_BUFFER)
        const event: MessageEvent = await messagePromise
        expect(event).to.deep.equal({
          data: TEST_BUFFER,
        })
      })

      it('sends binary messages from server to client', async function() {
        const server = getServer({ binary: true })
        const client = getClient({ binary: true })

        await server.start()
        await client.start()

        if (tcp) await pause()

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

        await server.start()
        await Promise.all(
          clients.map((client: MessageClient) => client.start())
        )

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
            new Promise(
              (resolve: (replies: Array<Buffer | string>) => void) => {
                const replies: Array<Buffer | string> = []
                client.on('message', (event: MessageEvent) => {
                  replies.push(event.data)
                  if (NUM_MESSAGES === replies.length) resolve(replies)
                })
              }
            ),
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

        await server.start()
        await client.start()

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

        await server.start()
        await client.start()

        const messagePromise = waitForMessage(server)
        client.send(TEST_BUFFER)
        const event: MessageEvent = await messagePromise
        expect(event).to.deep.equal({
          data: TEST_BUFFER.toString(),
        })
      })
    })
  }
})
