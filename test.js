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
        console.log('Node: ---CONNECTION-OPEN---')

        ws.send(JSON.stringify({
            t: 2,
            s: 'user',
            d: { t:2, s:0, i:'mnmyqlmofv55343' }
        }))
    })

    ws.on('close', () => {
        mConnection = null
        console.log('Node: ---CONNECTION-CLOSE---')
        setTimeout(async () => {
            await runServerWebSocket(url)
        }, 3000)
    })

    ws.on('error', err => {
        mConnection = null
        ws.close()
    })
}
