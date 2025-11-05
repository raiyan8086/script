const tls = require('tls')

const url = new URL('wss://s-usc1b-nss-2159.firebaseio.com/.ws?v=5&r=f&ns=founder-v1-default-rtdb');

let host = url.hostname
let port = 443
let path = url.pathname + url.search
let id = 1

let socket = tls.connect({ host, port, servername: host }, () => {

    socket.write(`GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: ${randomWebSocketKey()}\r\nSec-WebSocket-Version: 13\r\nOrigin: https://console.firebase.google.com\r\n\r\n`);

    sendMessage(socket, JSON.stringify({"t":"d","d":{"r":id++,"a":"m","b":{"p":"/£uck々you/user/Process","d":{"t":{".sv":"timestamp"}, "s":1}}}}))
    sendMessage(socket, JSON.stringify({"t":"d","d":{"r":id++,"a":"om","b":{"p":"/£uck々you/user/Process","d":{"t":{".sv":"timestamp"}, "s":0}}}}))
})

socket.on('data', (data) => {
    console.log('Received:', data.toString())
})

socket.on('end', () => console.log('Disconnected'))
socket.on('error', (err) => socket.destroy())

function sendMessage(socket, message) {
    try {
        let payload = Buffer.from(message, 'utf8')
        let frame = Buffer.alloc(2 + 4 + payload.length)
        frame[0] = 0x81
        frame[1] = 0x80 | payload.length

        let mask = []
        for (let i = 0; i < 4; i++) mask.push(Math.floor(Math.random() * 256))
        for (let i = 0; i < 4; i++) frame[2 + i] = mask[i]

        for (let i = 0; i < payload.length; i++) {
            frame[6 + i] = payload[i] ^ mask[i % 4]
        }

        socket.write(frame)
        return true
    } catch (error) {
        console.log(error)
        
        return false
    }
}


function randomWebSocketKey() {
    let arr = []
    for (let i = 0; i < 16; i++) {
        arr.push(Math.floor(Math.random() * 256))
    }
    let binary = String.fromCharCode(...arr)
    return Buffer.from(binary, 'binary').toString('base64')
}
