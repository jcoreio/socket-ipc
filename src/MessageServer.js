
/*
 This file is written in ES5 Java, to make it easy to use in small node.js utilities
 that aren't transpiled from ES6 to ES5.
 */

var fs = require('fs')
var net = require('net')
var util = require('util')

var MessageConnection = require('./MessageConnection')
var MessageHandlerCommon = require('./MessageHandlerCommon')

function MessageServer(path, options) {
  if (typeof path !== 'string' || !path.length) throw new Error("path must be a non-empty string")
  MessageHandlerCommon.call(this)
  this.path = path
  this._options = options || {}
  this._connections = []
}

util.inherits(MessageServer, MessageHandlerCommon)

/**
 * Starts the message server. This method blocks while checking deleting any pre-existing
 * socket, so it should only be called during startup.
 */
MessageServer.prototype.start = function start() {
  if (this._running) return
  try {
    // Delete the socket if it exists
    fs.unlinkSync(this.path)
  } catch (err) {
    // Swallow "ENOENT" error, which is thrown if the socket does not exist
    if (err && "ENOENT" !== err.code) console.error(err.stack)
  }
  var server = this._server = net.createServer()
  server.on('connection', MessageServer.prototype._onServerConnection.bind(this))
  server.on('error',      MessageServer.prototype._onServerError     .bind(this))
  server.listen(this.path)
  this._running = true
}

MessageServer.prototype.stop = function stop() {
  if (!this._running) return
  this._running = false
  if (this._server) {
    this._server.close()
    this._server = undefined
    this._connections.forEach(function(connection) {
      connection.close()
    })
    this._connections = []
  }
}

MessageServer.prototype._onServerConnection = function _onServerConnection(socket) {
  if (!this._running) return
  var connection = new MessageConnection(socket, this._options)
  var self = this
  connection.on('message', function(message) { self._onMessage(message, connection) })
  connection.on('error',   function(err)     { self._onError(err)                   })
  connection.on('close',   function()        { self._onConnectionClose(connection)  })

  this._connections.push(connection)
  this.emit('connection', connection)
}

MessageServer.prototype._onConnectionClose = function(connection) {
  var connIdx = this._connections.indexOf(connection)
  if (connIdx >= 0) {
    this._connections.splice(connIdx, 1)
    if (this._running)
      this._onClose(connection)
  }
}

MessageServer.prototype._onServerError = function(err) {
  this._onError("server error: " + (err && err.message) ? err.message : err)
}

MessageServer.prototype.isConnected = function() {
  return this._connections.length > 0
}

/**
 * @param message Buffer or String containing the message
 */
MessageServer.prototype.send = function send(message) {
  this._connections.forEach(function(connection) {
    connection.send(message)
  })
}

module.exports = MessageServer
