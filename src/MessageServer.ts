import fs from 'fs'
import net from 'net'
import { promisify } from 'util'

import pTimeout from 'p-timeout'
import { VError } from 'verror'

import MessageConnection from './MessageConnection'
import MessageHandlerCommon from './MessageHandlerCommon'
import { MessageEvent } from './types'

export type MessageServerOptions = {
  binary?: boolean
}

export default class MessageServer extends MessageHandlerCommon {
  private readonly binary: boolean
  private readonly path: string
  private readonly connections: Set<MessageConnection> = new Set()
  private server: net.Server | undefined
  private listening = false

  constructor(path: string, options: MessageServerOptions = {}) {
    super()
    if (typeof path !== 'string' || !path.length)
      throw Error('path must be a non-empty string')
    this.binary = Boolean(options.binary)
    this.path = path
  }

  async start(): Promise<void> {
    if (!this.running) {
      this.running = true
      try {
        // Delete the socket if it exists
        fs.unlinkSync(this.path)
      } catch (err) {
        // Swallow 'ENOENT' error, which is thrown if the socket does not exist
        if (err && 'ENOENT' !== err.code) throw err
      }
      const server = (this.server = net.createServer())
      server.on('connection', this.onServerConnection)
      server.on('error', (err: Error) =>
        this.onError(new VError(err, 'MessageServer got error from socket'))
      )
      await pTimeout(
        promisify((cb: () => void) => server.listen({ path: this.path }, cb))(),
        2000
      )
      this.listening = true
    }
  }

  stop(): void {
    if (this.running) {
      this.running = false
      this.listening = false
      if (this.server) this.server.close()
      this.server = undefined
      this.connections.forEach((connection: MessageConnection) =>
        connection.close()
      )
      this.connections.clear()
    }
  }

  isConnected(): boolean {
    return this.connections.size > 0
  }

  isListening(): boolean {
    return this.listening
  }

  send(message: Buffer | string): void {
    this.connections.forEach((connection: MessageConnection) =>
      connection.send(message)
    )
  }

  private onServerConnection = (socket: net.Socket): void => {
    if (this.running) {
      const connection = new MessageConnection(socket, { binary: this.binary })
      connection.on('message', (event: MessageEvent) =>
        this.onMessage(event, connection)
      )
      connection.on('error', (err: Error) =>
        this.onError(
          new VError(err, 'MessageServer got error from MessageConnection')
        )
      )
      connection.on('close', () => {
        this.connections.delete(connection)
        this.onClose(connection)
      })
      this.connections.add(connection)
      this.emit('connection', connection)
    }
  }
}
