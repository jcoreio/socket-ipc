
var util = require('util')
var EventEmitter = require('events').EventEmitter

function MessageHandlerCommon() {
  EventEmitter.call(this)
}

util.inherits(MessageHandlerCommon, EventEmitter)

MessageHandlerCommon.prototype._onMessage = function(event, connection) {
  if (this.onmessage) this.onmessage(event, connection)
  this.emit('message', event, connection)
}

MessageHandlerCommon.prototype._onError = function _onError(err) {
  if (!err.stack) err = new Error(err)
  if (this._running) {
    if (this.onerror)
      this.onerror(err)
    else
      this.emit('error', err)
  }
}

MessageHandlerCommon.prototype._onClose = function(connection) {
  if (this.onclose) this.onclose(connection)
  this.emit('close', connection)
}

module.exports = MessageHandlerCommon
