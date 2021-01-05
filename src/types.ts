export type MessageEvent = {
  data: Buffer | string
}

export type MessageHandlerOptions = {
  binary?: boolean
}

export type OnErrorCallback = (err: Error) => void
export type OnMessageCallback = (event: MessageEvent) => void
export type OnCloseCallback = () => void
