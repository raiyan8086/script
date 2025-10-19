const WebSocket = require('ws');

const url = "wss://s-usc1b-nss-2160.firebaseio.com/.ws?v=5&r=f&ns=founder-v1-default-rtdb";

const ws = new WebSocket(url)

ws.on('open', async () => {
  console.log('[✅] Connected to WSS server');
  await delay(1000)
  ws.send(JSON.stringify({"t":"d","d":{"r":3,"a":"p","b":{"p":"/test","d":{"o":{".sv":"timestamp"},"s":true}}}}))
  await delay(1000)
  ws.send(JSON.stringify({"t":"d","d":{"r":4,"a":"o","b":{"p":"/test","d":{"o":{".sv":"timestamp"},"s":false}}}}))
});

ws.on('message', (data) => {
  console.log('[📥] Received:', data.toString());
});

ws.on('close', () => console.log('[❌] Disconnected'));
ws.on('error', err => console.error('[💥] Error:', err));

setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send('0');
        console.log('[💓] Heartbeat sent');
    }
}, 30000)

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}
