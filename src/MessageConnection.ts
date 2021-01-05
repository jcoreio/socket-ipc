import { EventEmitter } from 'events'
import net from 'net'

import StrictEventEmitter from 'strict-event-emitter-types'
import { VError } from 'verror'

import MessageCodec from './MessageCodec'
import {
  MessageEvent,
  OnErrorCallback,
  OnMessageCallback,
  OnCloseCallback,
} from './types'

export type MessageConnectionOptions = {
  binary?: boolean
}

export interface MessageConnectionEmittedEvents {
  message: MessageEvent
  error: Error
  close: void
}

type MessageConnectionEmitter = StrictEventEmitter<
  EventEmitter,
  MessageConnectionEmittedEvents
>

export default class MessageConnection extends (EventEmitter as {
  new (): MessageConnectionEmitter
}) {
  private socket: net.Socket | undefined
  private readonly messageCodec: MessageCodec

  public onmessage: OnMessageCallback | undefined
  public onclose: OnCloseCallback | undefined
  public onerror: OnErrorCallback | undefined

  constructor(socket: net.Socket, options: MessageConnectionOptions) {
    super()
    this.socket = socket
    this.messageCodec = new MessageCodec({ binary: options.binary })

    socket.on('data', this.onSocketData)
    socket.on('close', this.close)
    socket.on('error', (err: Error) =>
      this.onError(new VError(err, 'MessageConnection got error from socket'))
    )
  }

  send(message: string | Buffer): void {
    const { socket } = this
    if (!socket) throw Error('unexpected missing socketWrite')
    socket.write(
      this.messageCodec.encode(message),
      (err: Error | undefined) => {
        if (err) this.onError(new VError(err, 'socket error during send'))
      }
    )
  }

  private onSocketData = (data: Buffer): void => {
    try {
      this.messageCodec.decode(data, (message: Buffer | string) => {
        const event: MessageEvent = { data: message }
        if (this.onmessage) this.onmessage(event)
        this.emit('message', event)
      })
    } catch (err) {
      this.onError(new VError(err, 'error while decoding message from socket'))
    }
  }

  /**
   * Included for compatibility with the WebSocket API
   */
  destroy(): void {
    this.close()
  }

  close = (): void => {
    if (this.socket) {
      this.socket.destroy()
      this.socket = undefined
      if (this.onclose) this.onclose()
      this.emit('close')
    }
  }

  private onError(err: Error): void {
    if (this.onerror) this.onerror(err)
    else this.emit('error', err)
    this.close()
  }
}
