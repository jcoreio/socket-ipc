export type MessageEvent = {
  data: Buffer | string
}

export type MessageHandlerOptions = {
  path?: string
  port?: number
  binary?: boolean
}

export function validateMessageHandlerOptions({
  path,
  port,
}: MessageHandlerOptions): void {
  if (!path && !port) throw Error('either path or port must be provided')
}

export type OnErrorCallback = (err: Error) => void
export type OnMessageCallback = (event: MessageEvent) => void
export type OnCloseCallback = () => void
