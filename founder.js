const args = process.argv.slice(2)

let USER = args[0]

console.log('User: '+USER)

let mConfig = null

process.on('message', (data) => {
    try {
        let json = (typeof data === 'string') ? JSON.parse(data) : data
        if (json.t == 1) {
            mConfig = json
        }
    } catch (error) {}
})


foundLoginNumber()


async function foundLoginNumber() {
    let loopDelay = 500
    let load = 0

    while (true) {
        if (mConfig) {
            try {
                let prev = mConfig.n
                let size = mConfig.s
                let key = mConfig.u

                for (let i = 0; i < size; i++) {
                    try {
                        if (prev != mConfig.n) {
                            i = 0
                            size = mConfig.s
                            prev = mConfig.n
                        }

                        let number = mConfig.n+i

                        await delay(loopDelay)
                    } catch (error) {
                        break
                    }
                }

                mConfig = null
                process.send({ t: 3, s: 'controller_status', d: { c:1, u:key, s:USER, f:0, o:0 } })
            } catch (error) {}
        } else {
            await delay(1000)
        }
    }
}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}
