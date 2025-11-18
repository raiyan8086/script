const WebSocket = require('ws')

let mConnection = null


runServerWebSocket('wss://database.raiyan086.xyz')


setInterval(() => {
    try {
        if (mConnection.readyState === WebSocket.OPEN) {
            mConnection.ping()
        }
    } catch (error) {}
}, 30000)


async function runServerWebSocket(url) {

    let ws = new WebSocket(url)

    ws.on('open', () => {
        mConnection = ws
        console.log('Node: ---CONNECTION-OPEN---', new Date().toString())
    })

    ws.on('close', () => {
        mConnection = null
        console.log('Node: ---CONNECTION-CLOSE---', new Date().toString())
        setTimeout(async () => {
            await runServerWebSocket(url)
        }, 3000)
    })

    ws.on('error', err => {
        console.log(err, new Date().toString())
        mConnection = null
        ws.close()
    })
}
