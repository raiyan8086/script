const express = require('express')
const WebSocket = require('ws')
const axios = require('axios')
const http = require('http')
const fs = require('fs')

let mStart = new Date().toString()

//Make WebSocket & Server

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


app.get('/log', async (req, res) => {
    try {
        const data = await fs.promises.readFile('server.log', 'utf8')
        res.type('text/plain')
        res.send(data)
    } catch (err) {
        res.send('Error reading server.log file.')
    }
})

server.listen(process.env.PORT || 8080, ()=>{
    console.log('Listening on port 8080...')
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



//Run Github Server
let id = 1
let counter = 0
let mPendingServer = {}
let mLiveServer = {}
let mRepoData = {}
let mWebSocketUrl = null
let mConnection = null

let BASE_URL = decode('aHR0cHM6Ly9kYXRhYmFzZTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vJUMyJUEzdWNrJUUzJTgwJTg1eW91Lw==')


startServer()

setInterval(() => {
    try {
        if (mConnection && mConnection.readyState === WebSocket.OPEN) {
            mConnection.send('0')
        }
    } catch (error) {}

    counter += 30

    if (counter >= 60) {
        counter = 0
        callEveryMinute()
    }
}, 30000)


async function startServer() {
    
    let mData = await readServerData()

    if (mData) {
        console.log('Data Load Success')

        await runWebSocket(mWebSocketUrl)

        let active = 0
        let entries = Object.entries(mData)
        let delayPerLoop = Math.min(100, 10000 / entries.length)

        for(let [key, value] of entries) {
            try {
                if(mLiveServer[key]) {
                    mPendingServer[key] = value.t
                    if (value.s == 0 || value.t < Date.now()-400000) {
                        await delay(delayPerLoop)
                        runGithubAction(key, 0)
                        active++
                    }
                }
            } catch (error) {}
        }

        if (active > 0) {
            console.log('Active Server: '+active)
        }
    } else {
        console.log('Data Load Failed')
    }
}

async function readServerData() {
    try {
        let response = await axios.get(BASE_URL+'controller.json')
        try {
            let data = response.data
            if (data) {
                for (let key of Object.keys(data)) {
                    mLiveServer[key] = 'x'
                }
            }
        } catch (error) {}
        response = await axios.get(BASE_URL+'database/controller.json')
        mWebSocketUrl = response.data
        response = await axios.get(BASE_URL+'live.json')
        return response.data
    } catch (error) {}

    return null
}

async function callEveryMinute() {
    let active = 0
    let entries = Object.entries(mPendingServer)
    let delayPerLoop = Math.min(100, 10000 / entries.length)

    for(let [key, value] of entries) {
        try {
            if(mLiveServer[key]) {
                if (value < Date.now()-400000) {
                    await delay(delayPerLoop)
                    runGithubAction(key, 0)
                    active++
                }
            }
        } catch (error) {}
    }

    if (active > 0) {
        console.log('Active Server: '+active)
    }
}

async function runWebSocket(url) {

    let ws = new WebSocket(url, {
        headers: {
            'Origin': 'https://console.firebase.google.com',
            'User-Agent': randomUserAgent()
        }
    })

    ws.on('open', () => {
        mConnection = ws
        ws.send(JSON.stringify({"t":"d","d":{"r":id++,"a":"q","b":{"p":"/£uck々you/live","h":""}}}))
    })

    ws.on('message', (data) => {
        try {
            let msg = data.toString()

            try {
                let json = JSON.parse(msg)
                if (json.d && json.d.a && json.d) {
                    let data = json.d.b
                    if (json.d.a == 'm') {
                        if (data && data.p && data.d && data.p.includes('£uck々you/live')) {
                            if (data.d.t || data.d.s !== undefined) {
                                let user = data.p.substring(data.p.lastIndexOf('/') + 1)
                                let time = data.d.t
                                let type = data.d.s

                                if (time) mPendingServer[user] = time

                                if (type === 0) runGithubAction(user, 5000)
                            } else {
                                for (let key in data.d) {
                                    if (key.includes('/t') || key.includes('/s')) {
                                        let [user, field] = key.split('/')
                                        let value = data.d[key]

                                        if (field === 't') mPendingServer[user] = value

                                        if (field === 's' && value === 0) {
                                            runGithubAction(user, 5000)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch {}
        } catch (err) {}
    })

    ws.on('close', () => {
        mConnection = null
        
        setTimeout(async () => {
            await runWebSocket(url)
        }, 3000)
    })

    ws.on('error', err => {
        mConnection = null
        ws.close()
    })
}

async function runGithubAction(repo, timeout) {
    setTimeout(async () => {
        try {
            if (mRepoData[repo]) {
                let data = mRepoData[repo]
                await activeAction(data.user, repo, data.action, data.access)
            } else {
                let response = await axios.get(BASE_URL+'controller/'+repo+'.json')
                    
                let data = response.data
                
                if(data != null && data != 'null') {
                    let action = data['action']
                    let user = data['user']

                    response = await axios.get(BASE_URL+'github/account/'+user+'.json')
                
                    data = response.data

                    if(data != null && data != 'null') {
                        let access = data['access']

                        mRepoData[repo] = {
                            user: user,
                            action: action,
                            access: access
                        }

                        await activeAction(user, repo, action, access)
                    } else {
                        console.log('User Not Found: '+user)
                    }
                } else {
                    console.log('Repo Not Found: '+repo)
                }
            }
        } catch (error) {}
    }, timeout)
}


async function activeAction(user, repo, action, token) {
    try {
        let response = await axios.get(`https://api.github.com/repos/${user}/${repo}/actions/runs/${action}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github+json"
            }
        })

        let body = response.data

        if (body.status == 'completed') {
            try {
                response = await axios.post(`https://api.github.com/repos/${user}/${repo}/actions/runs/${action}/rerun`,{}, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Accept": "application/vnd.github+json"
                    }
                })

                body = response.data

                try {
                    let time = 300000
                    if (!body || Object.keys(body).length == 0) {
                        console.log('Success: '+user+'/'+repo)
                    } else {
                        time = 0
                        console.log('Block: '+user+'/'+repo)
                    }

                    mPendingServer[repo] = Date.now()-time

                    try {
                        await axios.patch(BASE_URL+'live/'+repo+'.json', JSON.stringify({ t: Date.now()-time, s:1 }), {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        })
                    } catch (error) {}
                } catch (error) {}
            } catch (error) {
                try {
                    if (error.response) {
                        if (error.response.status === 403 && error.response.data.message.includes('over a month ago')) {
                            let newId = await runNewAction(user, repo, token)
                            if (newId) {
                                if (mRepoData[repo]) {
                                    mRepoData[repo].action = newId
                                }
                                await saveAction(repo, newId)
                                console.log('New Action Success: '+user+'/'+repo)
                            } else {
                                console.log('New Action Failed: '+user+'/'+repo)
                            }
                        } else {
                            console.log(error)
                            console.log('Error: '+user+'/'+repo)
                        }
                    } else {
                        console.log(error)
                        console.log('Error: '+user+'/'+repo)
                    }
                } catch (error) {
                    console.log('Error: '+user+'/'+repo)
                }
            }
        } else if (body.status == 'queued' || body.status == 'in_progress') {
            let time = 350000
            if (body.status == 'queued') {
                time = 100000
                console.log('Panding: '+user+'/'+repo)
            } else {
                console.log('Runing: '+user+'/'+repo)
            }

            mPendingServer[repo] = Date.now()-time

            try {
                await axios.patch(BASE_URL+'live/'+repo+'.json', JSON.stringify({ t: Date.now()-time, s:1 }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
            } catch (error) {}
        }
    } catch (error) {}

    if (token == null) {
        console.log('Token Null: '+user+'/'+repo)
    }
}

async function runNewAction(user, repo, token) {
    try {
        let oldResp = await axios.get(`https://api.github.com/repos/${user}/${repo}/actions/runs?branch=main&event=workflow_dispatch`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github+json"
            }
        })

        let oldRuns = oldResp.data.workflow_runs
        let oldId = oldRuns && oldRuns.length > 0 ? oldRuns[0].id : null
        let runAttempt = oldRuns && oldRuns.length > 0 ? oldRuns[0].run_attempt : 1

        if (runAttempt < 5 && oldId) {
            return oldId
        }

        await axios.post(`https://api.github.com/repos/${user}/${repo}/actions/workflows/main.yml/dispatches`, { ref: 'main' },  { 
            headers: {
                "Authorization": `Bearer ${token}`, 
                "Accept": "application/vnd.github+json" 
            }
        })

        await delay(3000)

        for (let i = 0; i < 5; i++) {
            await delay(2000)

            let resp = await axios.get(`https://api.github.com/repos/${user}/${repo}/actions/runs?branch=main&event=workflow_dispatch`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/vnd.github+json"
                }
            })

            let runs = resp.data.workflow_runs
            
            if (runs && runs.length > 0) {
                let latestId = runs[0].id
                
                if (latestId !== oldId) {
                    return latestId
                }
            }
        }
    } catch (err) {}

    return null
}

async function saveAction(repo, action) {
    try {
        await axios.patch(BASE_URL+'controller/'+repo+'.json', JSON.stringify({ action:action }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
    } catch (error) {}
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomUserAgent() {
    let windowsTokens = [
        'Windows NT 10.0; Win64; x64',
        'Windows NT 10.0; Win64; x86',
        'Windows NT 10.0; WOW64',
        'Windows NT 10.0; Win64',
        'Windows NT 10.0; x64; rv:99.0',
        'Windows 11; Win64; x64',
        'Windows NT 10.0; Win64; x64; Windows 11',
        'Windows 11; WOW64; Win64',
        'Windows 11; x64; rv:100.0'
    ]
    let os = windowsTokens[randInt(0, windowsTokens.length - 1)]
    let major = randInt(112, 141)
    let chromeVer = `${major}.0.0.0`
    return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`
}


function decode(data) {
    return Buffer.from(data, 'base64').toString('ascii')
}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}
