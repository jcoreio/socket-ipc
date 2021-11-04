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
