const { execSync, fork } = require('child_process')


startProcess() 

async function startProcess() {
    mScript = fork('./founder.js', [ 'xxxxxxxxxx12345', 'ehIe98VNCzcLzPOa68WDfejEseSyap4S', 'ehIe98VNCzcLzPOa68WDfQ==' ])

    mScript.send(JSON.stringify({ t:1, n: 919304319704, s:100, u:'00000000000000000000000000000000', k: 1745896853096, d:0, b:3 }))

    mScript.on('message', (data) => {
        console.log(data)
    })
}
