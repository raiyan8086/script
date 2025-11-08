const express = require('express')
const WebSocket = require('ws')
const http = require('http')

let mStart = new Date().toString()

let clients = new Map()
let peers = new Map()
let app = express()

app.use(express.json())

let server = http.createServer(app)

let wss = new WebSocket.Server({ server })

wss.on('connection', (ws, request) => {
    let clientId = request.headers['clientid']

    if (!clientId || clientId.length !== 32) {
        ws.close(1008, 'Invalid clientId')
        return
    }
    
    ws.isAlive = true

    clients.set(clientId, ws)

    let peerClients = peers.get(clientId)
    if (peerClients) {
        peerClients.forEach(cId => {
            let cWs = clients.get(cId)
            if (cWs && cWs.readyState === WebSocket.OPEN) {
                cWs.send(JSON.stringify({ type: 'connect', id: clientId }))
            }
        })
    }

    ws.on('pong', () => {
        ws.isAlive = true
    })

    ws.on('ping', () => {
        ws.isAlive = true
    })

    ws.on('message', (msg, isBinary) => {
        if (!clientId || clientId.length !== 32) {
            ws.close(1008, 'Invalid clientId')
            return
        }
        
        ws.isAlive = true
        try {
            if (isBinary) {
                let buffer = Buffer.from(msg)
                
                let type = buffer.readUInt8(0)
                if (type != 0) {
                    let targetId = buffer.slice(1, 17).toString('hex')
                    let payload = buffer.slice(17)

                    if (type == 1 && targetId) {
                        let reply = Buffer.alloc(1 + 16 + 1)
                        reply.writeUInt8(2, 0)
                        Buffer.from(targetId, "hex").copy(reply, 1)
                        reply.writeUInt8(isClientAlive(targetId) ? 1 : 0, 17)
                        ws.send(reply, { binary: true })
                    } else if ((type == 2 || type == 3) && targetId && payload) {
                        let targetWs = clients.get(targetId)

                        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                            let idBuffer = clientId ? Buffer.from(clientId, "hex") : Buffer.alloc(16)
                            let reply = Buffer.alloc(1 + 16 + payload.length)
                            reply.writeUInt8(type, 0)
                            idBuffer.copy(reply, 1)
                            payload.copy(reply, 17)
                            targetWs.send(reply, { binary: true })
                        } else {
                            let reply = Buffer.alloc(1 + 16 + 1)
                            reply.writeUInt8(2, 0)
                            Buffer.from(targetId, "hex").copy(reply, 1)
                            reply.writeUInt8(0, 17)
                            ws.send(reply, { binary: true })
                        }
                    }
                }
            } else {
                let data = JSON.parse(msg)

                if (data.type === 'check' && data.targetId) {
                    ws.send(JSON.stringify({ type: 'alive', id: data.targetId, alive: isClientAlive(data.targetId) }))
                } else if (data.type === 'peer' && data.targetId && clientId) {
                    let peerSet = peers.get(data.targetId) || new Set()
                    peerSet.add(clientId)
                    peers.set(data.targetId, peerSet)
                    let targetWs = clients.get(data.targetId)

                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'connect', id: data.targetId }))
                    } else {
                        ws.send(JSON.stringify({ type: 'disconnect', id: data.targetId }))
                    }
                } else if ((data.type === 'message' || data.type === 'message_save') && data.targetId && data.message) {
                    let targetWs = clients.get(data.targetId)

                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        targetWs.send(JSON.stringify({ type: data.type, id: clientId ? clientId : '', message: data.message }))
                    } else {
                        ws.send(JSON.stringify({ type: 'alive', id: data.targetId, alive: false }))
                    }
                }
            }
        } catch (e) {}
    })

    ws.on('close', () => {
        if (!clientId) return

        if (clients.get(clientId) === ws) {
            clients.delete(clientId)

            let peerClients = peers.get(clientId)
            if (peerClients) {
                peerClients.forEach(cId => {
                    let cWs = clients.get(cId)
                    if (cWs && cWs.readyState === WebSocket.OPEN) {
                        cWs.send(JSON.stringify({ type: 'disconnect', id: clientId }))
                    }
                })
                peers.delete(clientId)
            }
        }
    })
})


app.get('/', async (req, res) => {
    res.end(''+mStart)
})

app.get('/clients', async (req, res) => {
    let size = clients.size
    let keys = Array.from(clients.keys())

    res.json({
        total: size,
        clients: keys
    })
})

server.listen(process.env.PORT || 443, ()=>{
    console.log('Listening on port 443...')
})


setInterval(async () => {
    try {
        wss.clients.forEach((ws) => {
            try {
                if (!ws.isAlive) {
                    return ws.terminate()
                }
            } catch (error) {}
            ws.isAlive = false
        })
    } catch (error) {}
}, 60000)


function isClientAlive(clientId) {
    try {
        return clients.has(clientId) && clients.get(clientId).readyState === WebSocket.OPEN
    } catch (error) {
        return false
    }
}
