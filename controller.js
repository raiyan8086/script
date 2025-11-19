const jwt = require('jsonwebtoken')
const WebSocket = require('ws')
const axios = require('axios')


let mPendingServer = {}
let mLiveServer = {}
let mWebUrl = null
let DATABASE = null
let mRepoData = {}
let mClientConnection = null
let mServerConnection = null
let USER = getUserName()
let FINISH = new Date().getTime()+21000000


let BASE_URL = decode('aHR0cHM6Ly9kYXRhYmFzZTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vJUMyJUEzdWNrJUUzJTgwJTg1eW91Lw==')
let STORAGE = decode('aHR0cHM6Ly9maXJlYmFzZXN0b3JhZ2UuZ29vZ2xlYXBpcy5jb20vdjAvYi9kYXRhYmFzZTA4OC5hcHBzcG90LmNvbS9vLw==')

// USER = 'qsnrhamara86079'

startServer()


setInterval(async () => {
    try {
        if (mServerConnection && mServerConnection.readyState === WebSocket.OPEN) {
            mServerConnection.ping()
        }
    } catch (error) {}

    try {
        if (mClientConnection && mClientConnection.readyState === WebSocket.OPEN) {
            mClientConnection.ping()
        }
    } catch (error) {}

    try {
        await callEveryMinute()
    } catch (error) {}
}, 60000)

setInterval(async () => {
    await checkStatus(false)
}, 300000)


async function startServer() {
    console.log('Node: ---START-SERVER---')
    
    let data = await onServerDetails()
    
    if (!data) {
        console.log('---PROCESS-CLOSE---')
        process.exit(0)
    }

    await runServerWebSocket(data.database)

    console.log('Node: ---RUN-SERVER-SOCKET---')

    await checkStatus(true)

    let mData = await readServerData(data.server, data.auth)

    if (mData) {
        console.log('Node: ---DATA-LOAD-SUCCESS---')
        
        await runClientWebSocket(mWebUrl)

        console.log('Node: ---RUN-CLIENT-SOCKET---')

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
        } else {
            console.log('Node: ---ACTION-SERVER-START---')
        }
    } else {
        console.log('Node: ---DATA-LOAD-FAILED---')
        process.exit(0)
    }
}

async function onServerDetails() {
    try {
        let response = await axios.get(BASE_URL+'controller/'+USER+'.json')
        let data = response.data

        if (data) {
            response = await axios.get(BASE_URL+'database/'+data.database+'.json')
            data.database = response.data
            response = await axios.get(BASE_URL+'auth/'+data.auth+'.json')
            data.auth = response.data
            return data
        }
    } catch (error) {}

    return null
}

async function readServerData(server, auth) {
    try {
        let response = await axios.get(BASE_URL+'server/'+getServerName(server)+'.json')
        mLiveServer = response.data
        response = await axios.get(BASE_URL+'database/v'+server+'.json')
        mWebUrl = response.data
        return await getStorageData(mLiveServer, auth)
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

async function runServerWebSocket(url) {

    let ws = new WebSocket(url, {
        headers: {
            'x-client-id': USER
        }
    })

    ws.on('open', () => {
        console.log('Node: ---SERVER-CONNECTION-OPEN---')
        mServerConnection = ws
        ws.send(JSON.stringify({ t: 2, s: 'server', d: { s:0, i:USER } }))
        ws.send(JSON.stringify({ t: 3, s: 'server', d: { s:1, t: Date.now(), i:USER } }))
    })

    ws.on('close', () => {
        mServerConnection = null
        console.log('Node: ---SERVER-CONNECTION-CLOSE---')
        setTimeout(async () => {
            await runServerWebSocket(url)
        }, 3000)
    })

    ws.on('error', err => {
        mServerConnection = null
        ws.close()
    })

    for (let i = 0; i < 30; i++) {
        if (mServerConnection) {
            break
        }
        await delay(1000)
    }
}


async function runClientWebSocket(url) {

    let ws = new WebSocket(url, {
        headers: {
            'x-client-id': USER
        }
    })

    ws.on('open', () => {
        mClientConnection = ws
        console.log('Node: ---CLIENT-CONNECTION-OPEN---')
        ws.send(JSON.stringify({ t: 1, s: 'controller' }))
    })

    ws.on('message', (data, isBinary) => {
        try {
            if (!isBinary) {
                let json = JSON.parse(data.toString())
                if (json.i && json.t) {
                    mPendingServer[json.i] = json.t
                   if (json.s === 0) runGithubAction(json.i, 5000)
                }
            }
        } catch (err) {}
    })

    ws.on('close', () => {
        mClientConnection = null
        console.log('Node: ---CLIENT-CONNECTION-CLOSE---')
        setTimeout(async () => {
            await runClientWebSocket(url)
        }, 3000)
    })

    ws.on('error', err => {
        mClientConnection = null
        ws.close()
    })

    for (let i = 0; i < 30; i++) {
        if (mClientConnection) {
            break
        }
        await delay(1000)
    }
}


async function checkStatus(firstTime) {
    if (FINISH > 0 && FINISH < new Date().getTime()) {
        try {
            await axios.patch(BASE_URL+'live/'+USER+'.json', JSON.stringify({ s:0, t: Date.now() }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
        } catch (error) {}

        try {
            if (mServerConnection) {
                mServerConnection.close()
                mServerConnection = null
            }
        } catch (error) {}

        console.log('---COMPLETED---')
        process.exit(0)
    } else {
        if(!firstTime) sendWSMessage(mServerConnection, JSON.stringify({ t: 3, s: 'server', d: { s:1, t: Date.now(), i:USER } }))

        try {
            await axios.patch(BASE_URL+'live/'+USER+'.json', JSON.stringify({ s:1, t: Date.now() }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
        } catch (error) {}
    }
}

async function getStorageData(liveServer, auth) {
    try {
        let split = decode(auth).split('||')
        let token = jwt.sign({ iss: split[0], scope: 'https://www.googleapis.com/auth/devstorage.full_control', aud: 'https://www.googleapis.com/oauth2/v4/token', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), }, split[1], { algorithm: "RS256" })
        
        let response = await axios.post('https://www.googleapis.com/oauth2/v4/token', 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion='+token, {
            headers: {
                'Host': 'www.googleapis.com',
                'User-Agent': 'google-api-nodejs-client/9.15.1',
                'X-Goog-Api-Client': 'gl-node/22.19.0',
                'Accept': 'application/json'
            }
        })
        
        let access_token = response.data.access_token

        if (access_token) {
            response = await axios.get('https://storage.googleapis.com/storage/v1/b/database088.appspot.com/o?prefix=realtime/', {
                headers: {
                    'Host': 'storage.googleapis.com',
                    'User-Agent': 'gcloud-node-storage/7.17.3',
                    'Authorization': 'Bearer '+access_token,
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate'
                }
            })

            let data = response.data
            
            if (data) {
                let result = {}

                let items = data.items

                if (items) {
                    for (let i = 0; i < items.length; i++) {
                        try {
                            let item = items[i]
                            let name = item.name.substring(9)
                            if (name && name.length > 0 && name.endsWith('.json')) {
                                let user = name.substring(0, name.length-5)
                                let split = item.contentType.split('/')
                                result[user] = {
                                    s: parseInt(split[0]),
                                    t: parseInt(split[1])
                                }
                            }
                        } catch (error) {}
                    }
                }

                return result
            }
        }
    } catch (error) {}

    try {
        let result = {}

        for(let key of Object.keys(liveServer)) {
            try {
                let response = await axios.get(STORAGE+encodeURIComponent('realtime/'+key+'.json'))
                let item = response.data
                let name = item.name.substring(9)
                if (name && name.length > 0 && name.endsWith('.json')) {
                    let user = name.substring(0, name.length-5)
                    let split = item.contentType.split('/')
                    result[user] = {
                        s: parseInt(split[0]),
                        t: parseInt(split[1])
                    }
                }
            } catch (error) {}
        }

        return result
    } catch (error) {}

    return null
}

async function runGithubAction(repo, timeout) {
    setTimeout(async () => {
        try {
            if (mRepoData[repo]) {
                let data = mRepoData[repo]
                await activeAction(data.user, repo, data.action, data.access)
            } else {
                let response = await axios.get(BASE_URL+'running/'+repo+'.json')
                    
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
                        await axios.patch('https://'+DATABASE+decode('LmZpcmViYXNlaW8uY29tLyVDMiVBM3VjayVFMyU4MCU4NXlvdS91c2VyLw==')+repo+'.json', JSON.stringify({ t: Date.now()-time, s:1 }), {
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
                await axios.patch('https://'+DATABASE+decode('LmZpcmViYXNlaW8uY29tLyVDMiVBM3VjayVFMyU4MCU4NXlvdS91c2VyLw==')+repo+'.json', JSON.stringify({ t: Date.now()-time, s:1 }), {
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
        await axios.patch(BASE_URL+'running/'+repo+'.json', JSON.stringify({ action:action }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
    } catch (error) {}
}

function sendWSMessage(connection, data) {
    try {
        if (connection && connection.readyState === WebSocket.OPEN) {
            connection.send(data)
            return true
        }
    } catch (error) {}

    return false
}


function getUserName() {
    try {
        let directory = __dirname.split('\\')
        if (directory.length > 1) {
            let name = directory[directory.length-1]
            if (name) {
                return name
            }
        }
    } catch (error) {}

    try {
        let directory = __dirname.split('/')
        if (directory.length > 1) {
            let name = directory[directory.length-1]
            if (name) {
                return name
            }
        }
    } catch (error) {}

    return null
}

function getServerName(id) {
    if (id < 10) {
        return 'server0'+id
    }
    return 'server'+id
}

function decode(data) {
    return Buffer.from(data, 'base64').toString('utf-8')
}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}
