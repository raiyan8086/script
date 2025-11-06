console.log('Load Success')

const arg = process.argv[2]

console.log('Received arg:', arg)

process.on('message', (data) => {
    console.log('From index:', data)
    // process.send(JSON.stringify({"s":300}))
})
