/*
 This file is written in ES5 Java, to make it easy to use in small node.js utilities
 that aren't transpiled from ES6 to ES5.
 */

import { MessageEvent, MessageHandlerOptions } from './types'

const RECONNECT_WAIT = 1000 // 1 second

import net from 'net'

import pTimeout from 'p-timeout'
import { VError } from 'verror'

import MessageConnection from './MessageConnection'
import MessageHandlerCommon from './MessageHandlerCommon'

type ResolveConnectCallback = () => void
type RejectConnectCallback = (err: Error) => void

export type MessageClientOptions = MessageHandlerOptions & {
  oneShot?: boolean
}

export default class MessageClient extends MessageHandlerCommon {
  private readonly path: string
  private readonly binary: boolean
  private readonly oneShot: boolean

  private connection: MessageConnection | undefined
  private reconnectTimeout: ReturnType<typeof setTimeout> | undefined
  private socket: net.Socket | undefined

  private waitForConnectionPromise: Promise<void> | undefined
  private waitForConnectionResolve: ResolveConnectCallback | undefined
  private waitForConnectionReject: RejectConnectCallback | undefined

  constructor(path: string, options: MessageClientOptions = {}) {
    super()
    if (typeof path !== 'string' || !path.length)
      throw Error('path must be a non-empty string')
    this.path = path
    this.binary = Boolean(options.binary)
    this.oneShot = Boolean(options.oneShot)
    this.initWaitForConnectionPromise()
  }

  async start(): Promise<void> {
    if (!this.running) {
      this.running = true
      if (!this.waitForConnectionPromise) this.initWaitForConnectionPromise()
      this.connect()
    }
    await this.waitForConnection()
  }

  stop(): void {
    if (this.running) {
      this.running = false
      this.cleanUp('client was stopped before connecting')
    }
  }

  isConnected(): boolean {
    return Boolean(this.connection)
  }

  waitForConnection(): Promise<void> {
    return this.waitForConnectionPromise
      ? this.waitForConnectionPromise
      : Promise.reject(
          Error(this.running ? 'connection failed' : 'client is stopped')
        )
  }

  private initWaitForConnectionPromise(): void {
    this.waitForConnectionPromise = pTimeout(
      new Promise(
        (resolve: ResolveConnectCallback, reject: RejectConnectCallback) => {
          this.waitForConnectionResolve = resolve
          this.waitForConnectionReject = reject
        }
      ),
      10000
    )
  }

  /**
   * @param message Buffer or string containing the message
   */
  send(message: Buffer | string): void {
    if (this.connection) this.connection.send(message)
  }

  private connect(): void {
    if (this.running) {
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = undefined
      if (!this.socket) {
        const onConnectError = (err: Error & { code: string }): void => {
          if (err && 'ENOENT' !== err.code && 'ECONNREFUSED' !== err.code) {
            this.onError(new VError(err, 'MessageClient got socket error'))
          }
          this.cleanUp('error while attempting to connect')
        }

        const socket = (this.socket = net.connect({ path: this.path }, () => {
          if (this.running) {
            socket.removeListener('error', onConnectError)
            const connection = (this.connection = new MessageConnection(
              socket,
              { binary: this.binary }
            ))
            connection.on('message', (event: MessageEvent) =>
              this.onMessage(event, connection)
            )
            connection.on('error', (err: Error) =>
              this.onError(
                new VError(
                  err,
                  'MessageClient got error from MessageConnection'
                )
              )
            )
            connection.on('close', () => {
              this.onClose(connection)
              this.cleanUp('connection was closed by server')
            })

            this.emit('connection', connection)
            if (this.waitForConnectionResolve) this.waitForConnectionResolve()
            this.waitForConnectionResolve = undefined
            this.waitForConnectionReject = undefined
          }
        }))
        socket.on('error', onConnectError)
      }
    }
  }

  private cleanUp(reason: string): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = undefined
    }
    if (this.connection) {
      this.connection.close()
      this.connection = undefined
    }

    // notify anyone waiting on the connect promise
    if (this.waitForConnectionReject) {
      this.waitForConnectionReject(Error(reason))
      this.waitForConnectionReject = undefined
      this.waitForConnectionResolve = undefined
    }
    this.waitForConnectionPromise = undefined

    if (this.running && !this.reconnectTimeout && !this.oneShot) {
      // schedule reconnect
      const timeout = (this.reconnectTimeout = setTimeout(() => {
        if (timeout === this.reconnectTimeout) {
          this.reconnectTimeout = undefined
          this.connect()
        }
      }, RECONNECT_WAIT))
    }
  }
}
