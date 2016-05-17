
var PREFIX = "/tmp/"

var exports = module.exports

exports.SOCKET_PATH_ADC  = PREFIX + "socket-analog-inputs"
exports.SOCKET_PATH_GPIO = PREFIX + "socket-gpio"
exports.SOCKET_PATH_API  = PREFIX + "socket-jcore-api"

exports.GPIO_MESSAGE_ID_OFFSET = 0

exports.GPIO_MESSAGE_ID_INPUTS          = 1
exports.GPIO_MESSAGE_ID_RELAYS          = 2
exports.GPIO_MESSAGE_ID_CONN_STATUS_LED = 3

// Inputs message
exports.GPIO_INPUT_BTN_CONNECT     = 1
exports.GPIO_INPUT_IP_STATIC       = 2
exports.GPIO_INPUT_IP_DHCP         = 3
exports.GPIO_MESSAGE_INPUTS_LENGTH = 4

// Relay outputs message
exports.GPIO_RELAY_OUTPUTS_BASE    = 1
exports.GPIO_NUM_RELAY_OUTPUTS     = 4
exports.GPIO_RELAYS_MESSAGE_LENGTH = 5

// LED message
exports.GPIO_LED_MESSAGE_FLASH_RATE     = 1 // 2 bytes
exports.GPIO_LED_MESSAGE_NUM_COLORS     = 3 // 1 byte
exports.GPIO_LED_MESSAGE_HEADER_LEN     = 4
exports.GPIO_LED_MESSAGE_COLORS_BASE    = 4
exports.GPIO_LED_MESSAGE_EACH_COLOR_LEN = 2

// LED colors
exports.GPIO_LED_COLOR_GREEN  = 1 << 0
exports.GPIO_LED_COLOR_RED    = 1 << 1
// a tri-color LED makes yellow by turning on both red and green :-)
exports.GPIO_LED_COLOR_YELLOW = exports.GPIO_LED_COLOR_GREEN | exports.GPIO_LED_COLOR_RED






