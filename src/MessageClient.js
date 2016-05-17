/*
 This file is written in ES5 Java, to make it easy to use in small node.js utilities
 that aren't transpiled from ES6 to ES5.
 */

var RECONNECT_WAIT = 1000 // 1 second

var net = require('net')
var util = require('util')

var MessageHandlerCommon = require('./MessageHandlerCommon')
var MessageConnection = require('./MessageConnection')

function MessageClient(path, options) {
  MessageHandlerCommon.call(this)
  if (typeof path !== 'string' || !path.length) throw new Error("path must be a non-empty string")
  this.path = path
  this._options = options || {}
}

util.inherits(MessageClient, MessageHandlerCommon)

MessageClient.prototype.start = function() {
  if (this._running) return
  this._running = true
  this._connect()
}

MessageClient.prototype.stop = function() {
  if (!this._running) return
  this._running = false
  this._cleanUp()
}

MessageClient.prototype.isConnected = function() {
  return !!this._connection
}

/**
 * @param message Buffer containing the message
 */
MessageClient.prototype.send = function(message) {
  this._connection && this._connection.send(message)
}

MessageClient.prototype._connect = function _connect() {
  if (!this._running || this._connection) return
  this._reconnectTimeout = undefined
  this._socket = net.connect({path: this.path}, MessageClient.prototype._onSockConnect.bind(this))
  var self = this
  this._onConnectError = function(err) {
    if (err && 'ENOENT' !== err.code && 'ECONNREFUSED' !== err.code) {
      self._onError("socket error: " + (err && err.message) ? err.message : err)
    }
    self._cleanUp()
    self._maybeScheduleReconnect()
  }
  this._socket.on('error', this._onConnectError)
}

MessageClient.prototype._onSockConnect = function _onSockConnect() {
  if (!this._running) return

  this._socket.removeListener('error', this._onConnectError)
  this._onConnectError = undefined

  var self = this
  var connection = this._connection = new MessageConnection(this._socket, this._options)
  connection.on('message', function(event)   { self._onMessage(event, connection) })
  connection.on('error',   function(err)     { self._onError(err)                   })
  connection.on('close',   function()        { self._onConnectionClose(connection)   })

  this.emit('connection', connection)
}

MessageClient.prototype._onConnectionClose = function(connection) {
  this._onClose(connection)
  this._cleanUp()
  this._maybeScheduleReconnect()
}

MessageClient.prototype._maybeScheduleReconnect = function _maybeScheduleReconnect() {
  if (this._running && !this._reconnectTimeout && !this._options.oneShot)
    this._reconnectTimeout = setTimeout(MessageClient.prototype._connect.bind(this), RECONNECT_WAIT)
}

MessageClient.prototype._cleanUp = function _cleanUp() {
  if (this._reconnectTimeout) {
    clearTimeout(this._reconnectTimeout)
    this._reconnectTimeout = undefined
  }
  if (this._connection) {
    this._connection.close()
    this._connection = undefined
  }
}

module.exports = MessageClient
