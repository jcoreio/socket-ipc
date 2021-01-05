const PREAMBLE = 35 // '#' character
const LENGTH_LEN = 4 // Length of the length? WTF?
const HEADER_LEN = 1 + LENGTH_LEN // 1 preamble byte + 4 length bytes

enum DecodeState {
  Initial,
  ReadLength,
  ReadData,
}

export type MessageCodecOptions = {
  binary?: boolean
}

export type MessageDecodedCallback = (message: Buffer | string) => void

export default class MessageCodec {
  private readonly binary: boolean
  private decodeState: DecodeState = DecodeState.Initial
  private readonly lengthBuf: Buffer = Buffer.alloc(LENGTH_LEN)
  private lengthBufPos = 0
  private decodeBuf: Buffer | undefined
  private decodeBufPos = 0

  constructor(options: MessageCodecOptions) {
    this.binary = Boolean(options.binary)
  }

  encode(data: string | Buffer): Buffer {
    const buffer: Buffer = typeof data === 'string' ? Buffer.from(data) : data
    const encoded = Buffer.alloc(buffer.length + HEADER_LEN)
    let pos = 0
    encoded.writeUInt8(PREAMBLE, pos++)
    encoded.writeUInt32BE(buffer.length, pos)
    pos += LENGTH_LEN
    buffer.copy(encoded, pos, 0, buffer.length)
    return encoded
  }

  decode(srcBuffer: Buffer, onMessage: MessageDecodedCallback): void {
    const messageComplete = (buffer: Buffer): void =>
      onMessage(this.binary ? buffer : buffer.toString())

    let srcPos = 0
    while (srcPos < srcBuffer.length) {
      const srcRemain = srcBuffer.length - srcPos
      let bytesRead = 0
      switch (this.decodeState) {
        case DecodeState.Initial:
          const preamble = srcBuffer.readUInt8(srcPos)
          bytesRead = 1
          if (PREAMBLE !== preamble)
            throw Error(
              `preamble did not match: expected ${PREAMBLE}, was ${preamble}`
            )
          this.decodeState = DecodeState.ReadLength
          break
        case DecodeState.ReadLength:
          bytesRead = Math.min(srcRemain, LENGTH_LEN - this.lengthBufPos)
          srcBuffer.copy(
            this.lengthBuf,
            this.lengthBufPos,
            srcPos,
            srcPos + bytesRead
          )
          this.lengthBufPos += bytesRead
          if (this.lengthBufPos >= LENGTH_LEN) {
            const messageLength = this.lengthBuf.readUInt32BE(0)
            if (messageLength) {
              this.decodeBuf = Buffer.alloc(messageLength)
              this.decodeBufPos = 0
              this.decodeState = DecodeState.ReadData
            } else {
              // Empty message...
              messageComplete(Buffer.alloc(0))
              this.decodeState = DecodeState.Initial
            }
            this.lengthBufPos = 0
          }
          break
        case DecodeState.ReadData:
          {
            const decodeBuf = this.decodeBuf
            if (!decodeBuf) throw Error('unexpected missing decodeBuf')
            bytesRead = Math.min(
              srcRemain,
              decodeBuf.length - this.decodeBufPos
            )
            srcBuffer.copy(
              decodeBuf,
              this.decodeBufPos,
              srcPos,
              srcPos + bytesRead
            )
            this.decodeBufPos += bytesRead
            if (this.decodeBufPos >= decodeBuf.length) {
              messageComplete(decodeBuf)
              this.decodeState = DecodeState.Initial
              this.decodeBuf = undefined
            }
          }
          break
      }
      if (!bytesRead) throw Error('unexpected: bytesRead == 0')
      srcPos += bytesRead
    }
  }
}
