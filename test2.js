const WebSocket = require('ws')

let mConnection = null
let mConnection2 = null


runServerWebSocket('wss://database.raiyan086.xyz')
runServerWebSocket2('wss://database.raiyan086.xyz')


setInterval(() => {
    try {
        if (mConnection.readyState === WebSocket.OPEN) {
            mConnection.ping()
        }
    } catch (error) {}

    try {
        if (mConnection2.readyState === WebSocket.OPEN) {
            mConnection2.ping()
        }
    } catch (error) {}
}, 30000)


async function runServerWebSocket(url) {

    let ws = new WebSocket(url)

    ws.on('open', () => {
        mConnection = ws
        console.log('Node: ---CONNECTION-OPEN---', new Date().toString())
    })

    ws.on('close', (code, reason) => {
        console.log('Code:', code)
        console.log('Reason:', reason.toString())

        mConnection = null
        console.log('Node: ---CONNECTION-CLOSE---', new Date().toString())
        setTimeout(async () => {
            await runServerWebSocket(url)
        }, 3000)
    })

    ws.on('error', err => {
        console.error('⚠️ WebSocket error:', err)
        mConnection = null
        ws.close()
    })
}

async function runServerWebSocket2(url) {

    let ws = new WebSocket(url)

    ws.on('open', () => {
        mConnection2 = ws
        console.log('Node: ---CONNECTION-OPEN-2---', new Date().toString())
    })

    ws.on('close', (code, reason) => {
        console.log('Code:', code)
        console.log('Reason:', reason.toString())

        mConnection2 = null
        console.log('Node: ---CONNECTION-CLOSE-2---', new Date().toString())
        setTimeout(async () => {
            await runServerWebSocket2(url)
        }, 3000)
    })

    ws.on('error', err => {
        console.error('⚠️ WebSocket-2 error:', err)
        mConnection2 = null
        ws.close()
    })
}
