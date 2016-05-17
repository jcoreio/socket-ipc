/*
 This file is written in ES5 Java, to make it easy to use in small node.js utilities
 that aren't transpiled from ES6 to ES5.
 */

var PREAMBLE = 35 // '#' character
var LENGTH_LEN = 4 // Length of the length? WTF?
var HEADER_LEN = 1 + LENGTH_LEN // 1 preamble byte + 4 length bytes

var DECODE_STATE_INITIAL     = 0
var DECODE_STATE_READ_LENGTH = 1
var DECODE_STATE_READ_DATA   = 2

exports = module.exports = MessageCodec

function MessageCodec(options) {
  options = options || {}
  this._binary = !!options.binary
  this._decodeState = DECODE_STATE_INITIAL
  this._lengthBuf = new Buffer(LENGTH_LEN)
  this._lengthBuf.fill(0)
  this._lengthBufPos = 0
  this._decodeBufferPos = 0
}

/**
 *
 * @param data String, if the 'utf8' option is set, or Buffer otherwise.
 * @return Buffer with preamble and length, followed by the original data.
 */
MessageCodec.prototype.encode = function(data) {
  var buffer = this._binary ? data : new Buffer(data, 'utf8');
  var encoded = new Buffer(buffer.length + HEADER_LEN)
  var pos = 0
  encoded.writeUInt8(PREAMBLE, 0)
  pos += 1
  encoded.writeUInt32BE(buffer.length, pos)
  pos += LENGTH_LEN
  buffer.copy(encoded, pos, 0, buffer.length)
  return encoded
}

/**
 *
 * @param srcBuffer Buffer containing incoming bytes
 * @param onMessage function with the signature callback(message). Called each time a complete message is read.
 * @returns {Array} Array of buffers containing decoded messages.
 */
MessageCodec.prototype.decode = function(srcBuffer, onMessage) {
  var binary = this._binary
  var srcPos = 0
  while (srcPos < srcBuffer.length) {
    var srcRemain = srcBuffer.length - srcPos
    var bytesRead = 0
    switch (this._decodeState) {
    case DECODE_STATE_INITIAL:
      var preamble = srcBuffer.readUInt8(srcPos)
      bytesRead = 1
      if (PREAMBLE !== preamble) throw new Error("preamble did not match: expected " + PREAMBLE + ", was " + preamble)
      this._decodeState = DECODE_STATE_READ_LENGTH
      break
    case DECODE_STATE_READ_LENGTH:
      bytesRead = Math.min(srcRemain, LENGTH_LEN - this._lengthBufPos)
      srcBuffer.copy(this._lengthBuf, this._lengthBufPos, srcPos, srcPos + bytesRead)
      this._lengthBufPos += bytesRead
      if (this._lengthBufPos >= LENGTH_LEN) {
        var messageLength = this._lengthBuf.readUInt32BE(0)
        if (messageLength) {
            this._decodeBuffer = new Buffer(messageLength)
            this._decodeBuffer.fill(0)
            this._decodeBufferPos = 0
            this._decodeState = DECODE_STATE_READ_DATA
          } else {
            // Empty message...
            messageComplete(new Buffer(0))
            this._decodeState = DECODE_STATE_INITIAL
          }
        this._lengthBufPos = 0
        this._lengthBuf.fill(0)
      }
      break
    case DECODE_STATE_READ_DATA:
      bytesRead = Math.min(srcRemain, this._decodeBuffer.length - this._decodeBufferPos)
      srcBuffer.copy(this._decodeBuffer, this._decodeBufferPos, srcPos, srcPos + bytesRead)
      this._decodeBufferPos += bytesRead
      if (this._decodeBufferPos >= this._decodeBuffer.length) {
        messageComplete(this._decodeBuffer)
        this._decodeState = DECODE_STATE_INITIAL
        this._decodeBuffer = undefined
      }
      break
    }
    if (!bytesRead) throw new Error("unexpected: bytesRead == 0")
    srcPos += bytesRead
  }

  function messageComplete(buffer) {
    onMessage(binary ? buffer : buffer.toString())
  }
}




