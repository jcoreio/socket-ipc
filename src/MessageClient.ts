/*
 This file is written in ES5 Java, to make it easy to use in small node.js utilities
 that aren't transpiled from ES6 to ES5.
 */

import {
  MessageEvent,
  MessageHandlerOptions,
  validateMessageHandlerOptions,
} from './types'
import EventEmitter from 'events'
import { StrictEventEmitter } from 'strict-event-emitter-types'

const RECONNECT_WAIT = 2000 // 2 seconds

import net, { NetConnectOpts } from 'net'

import pTimeout from 'p-timeout'
import emitted from 'p-event'
import { VError } from 'verror'

import MessageConnection from './MessageConnection'

export type MessageClientOptions = MessageHandlerOptions & {
  host?: string
  oneShot?: boolean
}

export interface MessageClientEvents {
  connection: MessageConnection
  message: (event: MessageEvent, connection: MessageConnection) => void
  close: MessageConnection
  error: Error
}

type MessageClientEmitter = StrictEventEmitter<
  EventEmitter,
  MessageClientEvents
>

export default class MessageClient extends (EventEmitter as {
  new (): MessageClientEmitter
}) {
  private running = false
  private readonly options: MessageClientOptions
  private readonly binary: boolean

  private connection: MessageConnection | undefined
  private reconnectTimeout: ReturnType<typeof setTimeout> | undefined
  private socket: net.Socket | undefined

  constructor(options: MessageClientOptions = {}) {
    super()
    validateMessageHandlerOptions(options)
    this.options = options
    this.binary = Boolean(options.binary)
  }

  async start(): Promise<void> {
    if (!this.running) {
      this.running = true
      this.connect()
    }
    await this.waitForConnection()
  }

  stop(): void {
    if (this.running) {
      this.running = false
      if (!this.connection) {
        this.emit('error', new Error('stopped before connection completed'))
      }
      this.cleanUp()
    }
  }

  isConnected(): boolean {
    return Boolean(this.connection)
  }

  async waitForConnection(): Promise<void> {
    if (!this.running) throw new Error('client is stopped')
    if (this.isConnected()) return
    const { host, port, path } = this.options
    const connectionDescr = port
      ? `TCP connection to ${host || 'localhost'}:${port}`
      : `UNIX socket connection to ${path || ''}`
    await pTimeout(
      emitted(this, 'connection'),
      10000,
      `timed out waiting for socket IPC ${connectionDescr}`
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
            this.emit(
              'error',
              new VError(err, 'MessageClient got socket error')
            )
          }
          this.cleanUp()
        }
        const { path, host, port } = this.options
        const connectOptions: NetConnectOpts = (path
          ? { path }
          : { host, port }) as NetConnectOpts
        const socket = (this.socket = net.connect(connectOptions, () => {
          if (this.running) {
            socket.removeListener('error', onConnectError)
            const connection = (this.connection = new MessageConnection(
              socket,
              { binary: this.binary }
            ))
            connection.on('message', (event: MessageEvent) =>
              this.emit('message', event, connection)
            )
            connection.on('error', (err: Error) => {
              this.cleanUp()
              this.emit(
                'error',
                new VError(
                  err,
                  'MessageClient got error from MessageConnection'
                )
              )
            })
            connection.on('close', () => {
              this.emit('close', connection)
              this.cleanUp()
            })

            this.emit('connection', connection)
          }
        }))
        socket.on('error', onConnectError)
      }
    }
  }

  private cleanUp(): void {
    this.socket = undefined
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = undefined
    }
    if (this.connection) {
      this.connection.close()
      this.connection = undefined
    }

    if (this.running && !this.reconnectTimeout && !this.options.oneShot) {
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
