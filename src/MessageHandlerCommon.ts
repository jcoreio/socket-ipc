import { EventEmitter } from 'events'

import MessageConnection from './MessageConnection'
import { MessageEvent } from './types'
import StrictEventEmitter from 'strict-event-emitter-types'

export type OnErrorCallback = (err: Error) => void
export type OnMessageCallback = (
  event: MessageEvent,
  connection: MessageConnection
) => void
export type OnCloseCallback = (connection: MessageConnection) => void

export interface MessageHandlerCommonEmittedEvents {
  connection: MessageConnection
  message: (event: MessageEvent, connection: MessageConnection) => void
  close: MessageConnection
  error: Error
}

type MessageHandlerCommonEmitter = StrictEventEmitter<
  EventEmitter,
  MessageHandlerCommonEmittedEvents
>

export default class MessageHandlerCommon extends (EventEmitter as {
  new (): MessageHandlerCommonEmitter
}) {
  protected running = false

  onerror: OnErrorCallback | undefined
  onmessage: OnMessageCallback | undefined
  onclose: OnCloseCallback | undefined

  constructor() {
    super()
  }

  public start(): void {
    throw Error('must be overridden by implementing class')
  }

  public stop(): void {
    throw Error('must be overridden by implementing class')
  }

  protected onMessage(
    event: MessageEvent,
    connection: MessageConnection
  ): void {
    if (this.running) {
      if (this.onmessage) this.onmessage(event, connection)
      this.emit('message', event, connection)
    }
  }

  protected onError = (err: Error): void => {
    if (this.running) {
      if (this.onerror) this.onerror(err)
      else this.emit('error', err)
    }
  }

  protected onClose(connection: MessageConnection): void {
    if (this.running) {
      if (this.onclose) this.onclose(connection)
      this.emit('close', connection)
    }
  }
}
