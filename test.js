const WebSocket = require('ws')

let mConnection = null


runServerWebSocket('wss://database.raiyan086.xyz')


setInterval(() => {
    try {
        if (mConnection.readyState === WebSocket.OPEN) {
            mConnection.send(new Uint8Array([0]), { binary: true })
        }
    } catch (error) {}
}, 60000)


async function runServerWebSocket(url) {

    let ws = new WebSocket(url)

    ws.on('open', () => {
        mConnection = ws
        console.log('Node: ---CONNECTION-OPEN---', new Date().toString())

        ws.send(JSON.stringify({
            t: 2,
            s: 'user',
            d: { s:2, o:0, i:'mnmyqlmofv55343' }
        }))
    })

    ws.on('close', () => {
        mConnection = null
        console.log('Node: ---CONNECTION-CLOSE---', new Date().toString())
        setTimeout(async () => {
            await runServerWebSocket(url)
        }, 3000)
    })

    ws.on('error', err => {
        mConnection = null
        ws.close()
    })
}
