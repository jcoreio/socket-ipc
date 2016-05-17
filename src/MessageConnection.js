
var util = require('util')
var EventEmitter = require('events').EventEmitter

var MessageCodec = require('./MessageCodec')

exports = module.exports = MessageConnection

function MessageConnection(socket, options) {
  EventEmitter.call(this)
  this._socket = socket
  this._messageCodec = new MessageCodec(options)
  socket.on('data',  MessageConnection.prototype._onSockData.bind(this))
  socket.on('close', MessageConnection.prototype.close      .bind(this))
  socket.on('error', MessageConnection.prototype._onError   .bind(this))
}

util.inherits(MessageConnection, EventEmitter)

MessageConnection.prototype.send = function(message) {
  try {
    this._socket.write(this._messageCodec.encode(message))
  } catch (err) {
    this._onError(err)
  }
}

MessageConnection.prototype._onSockData = function(data) {
  try {
    var self = this
    this._messageCodec.decode(data, function(message) { self._onMessage(message) })
  } catch (err) {
    this._onError(err)
  }
}

MessageConnection.prototype.close = function() {
  if (this._socket) {
    this._socket.destroy()
    this._socket = undefined
    if (this.onclose) this.onclose()
    this.emit('close')
  }
}

// Maintain API compatibility with WebSockets.
MessageConnection.prototype.destroy = MessageConnection.prototype.close

MessageConnection.prototype._onMessage = function(message) {
  var event = { data: message }
  if (this.onmessage) this.onmessage(event)
  this.emit('message', event)
}

MessageConnection.prototype._onError = function(err) {
  if (!err.stack) err = new Error(err)
  if (this.onerror)
    this.onerror(err)
  else
    this.emit('error', err)
  this.close()
}
