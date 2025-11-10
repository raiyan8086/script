const WebSocket = require('ws')
const axios = require('axios')

let id = 1
let mServerConnection = null
let USER = getUserName()
let FINISH = new Date().getTime()+21000000

let BASE_URL = decode('aHR0cHM6Ly9kYXRhYmFzZTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vJUMyJUEzdWNrJUUzJTgwJTg1eW91Lw==')

// USER = 'qsnrhamara86079'

startServer()

setInterval(() => {
    try {
        if (mServerConnection && mServerConnection.readyState === WebSocket.OPEN) {
            mServerConnection.send('0')
        }
    } catch (error) {}
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

async function runServerWebSocket(url) {

    let ws = new WebSocket(url, {
        headers: {
            'Origin': 'https://console.firebase.google.com',
            'User-Agent': randomUserAgent()
        }
    })

    ws.on('open', () => {
        mServerConnection = ws
        ws.send(JSON.stringify({"t":"d","d":{"r":id++,"a":"om","b":{"p":"/£uck々you/live/"+USER,"d":{"t":{".sv":"timestamp"}, "s":0}}}}))
    })

    ws.on('close', () => {
        mServerConnection = null
        
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

async function checkStatus() {
    if (FINISH > 0 && FINISH < new Date().getTime()) {
        
        if (!sendWSMessage(mServerConnection, JSON.stringify({"t":"d","d":{"r":id++,"a":"m","b":{"p":"/£uck々you/live/"+USER,"d":{"t":{".sv":"timestamp"}, "s":0}}}}))) {
            try {
                await axios.patch(BASE_URL+'live/'+USER+'.json', JSON.stringify({ t: Date.now(), s:0 }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
            } catch (error) {}
        }

        console.log('---COMPLETED---')
        process.exit(0)
    } else {
        if (!sendWSMessage(mServerConnection, JSON.stringify({"t":"d","d":{"r":id++,"a":"m","b":{"p":"/£uck々you/live/"+USER,"d":{"t":{".sv":"timestamp"}, "s":1}}}}))) {
            try {
                await axios.patch(BASE_URL+'live/'+USER+'.json', JSON.stringify({ t: Date.now(), s:1 }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
            } catch (error) {}
        }
    }
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
