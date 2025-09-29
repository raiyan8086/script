const axios = require('axios')


let USER = getUserName()
let FINISH = new Date().getTime()+21000000

let STORAGE = decode('aHR0cHM6Ly9maXJlYmFzZXN0b3JhZ2UuZ29vZ2xlYXBpcy5jb20vdjAvYi9qb2Itc2VydmVyLTA4OC5hcHBzcG90LmNvbS9vLw==')

startServer()


setInterval(async () => {
    await checkStatus()
}, 120000)

async function startServer() {
    console.log('Node: ---START-SERVER---')

    let mData = await readAllData()

    console.log('Node: Read Data')

    while (true) {
        
        console.log('Load Start: '+Object.keys(mData).length)

        for (let [key, value] of Object.entries(mData)) {
            try {
                let now = new Date(). getTime()
                if (value.time < now) {
                    await checkNewSms(key+'@oletters.com', value)
                    console.log(key+' : '+parseInt((new Date(). getTime() - now)/1000)+'s')
                }
            } catch (error) {}
        }

        console.log('Load Success: '+new Date().toString())

        await delay(60000)
    }
}

async function checkNewSms(user, value) {
    try {
        let msgs = value.msg
        let response = await axiosGet('https://mail-server.1timetech.com/api/email/'+value.token+'/messages?params='+reverse(encode('{"email":"'+user+'"}')), {
            headers: {
                'Host': 'mail-server.1timetech.com',
                'Accept': 'application/json',
                'X-App-Key': 'f07bed4503msh719c2010df3389fp1d6048jsn411a41a84a3c',
                'Accept-Encoding': 'gzip, deflate',
                'User-Agent': 'okhttp/4.9.2',
                'Connection': 'close'
            },
            validateStatus: null
        })
        
        let list = JSON.parse(decode(reverse(response.data['data'])))

        let error = false

        await delay(500)

        for (let i = 0; i < list.length; i++) {
            try {
                let id = list[i]['id']
                let from = list[i]['from']
                let subject = list[i]['subject']
                let createdAt = list[i]['createdAt']

                if (!msgs || !msgs[id]) {
                    let response = await axiosGet('https://mail-server.1timetech.com/api/email/'+value.token+'/messages/'+id+'?params='+reverse(encode('{"email":"'+user+'"}')), {
                        headers: {
                            'Host': 'mail-server.1timetech.com',
                            'Accept': 'application/json',
                            'X-App-Key': 'f07bed4503msh719c2010df3389fp1d6048jsn411a41a84a3c',
                            'Accept-Encoding': 'gzip, deflate',
                            'User-Agent': 'okhttp/4.9.2',
                            'Connection': 'close'
                        },
                        validateStatus: null
                    })

                    let data = reverse(response.data['data'])

                    await axios.patch('https://job-server-088-default-rtdb.firebaseio.com/%C2%A3uck%E3%80%85you/recover_msg/'+id+'.json', JSON.stringify({ from: from, subject : subject, createdAt : createdAt, data : data }), {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })

                    await axios.patch('https://job-server-088-default-rtdb.firebaseio.com/%C2%A3uck%E3%80%85you/recover/'+user.replace('@oletters.com', '')+'/msg.json', '{"'+id+'":"x"}', {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })

                    if (msgs) {
                        value.msg[id] = 'x'
                    } else {
                        value.msg = {}
                        value.msg[id] = 'x'
                    }

                    await delay(500)
                }
            } catch (e) {
                error = true
            }
        }

        value.time = new Date().getTime()+(error ? 3600000: 86400000)
        
        await axios.patch('https://job-server-088-default-rtdb.firebaseio.com/%C2%A3uck%E3%80%85you/recover/'+user.replace('@oletters.com', '')+'.json', JSON.stringify({ time:value.time }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
    } catch (error) {}
}

async function readAllData() {
    for (let i = 0; i < 5; i++) {
        try {
            let response = await axios.get('https://job-server-088-default-rtdb.firebaseio.com/%C2%A3uck%E3%80%85you/recover.json', { timeout: 120000 })

            let data = response.data

            if (data) {
                return data
            }
        } catch (error) {}

        await delay(1000)
    }

    return null
}


async function checkStatus() {
    if (FINISH > 0 && FINISH < new Date().getTime()) {
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

async function axiosGet(url, config = {}, maxRetry = 3) {
    let attempt = 0

    config.timeout = 10000

    while (attempt < maxRetry) {
        try {
            const response = await axios.get(url, config)
            return response
        } catch (err) {
            attempt++
            if (attempt < maxRetry) {
                await delay(1000)
            }
        }
    }

    return null
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

function reverse(str) { 
    return str.split('').reverse().join('')
}

function encode(str) {
    return Buffer.from(str).toString('base64')
}

function decode(str) {
    return Buffer.from(str, 'base64').toString('ascii')
}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}
