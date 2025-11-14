const { getDatabase, ref, onDisconnect, serverTimestamp, set } = require("firebase/database")
const { initializeApp } = require("firebase/app")

const firebaseConfig = {
    apiKey: "AIzaSyCwmbmiWe2jCxhnuypRDc-HJlvR36ICMgA",
    authDomain: "founder-v2.firebaseapp.com",
    projectId: "founder-v2",
    storageBucket: "founder-v2.firebasestorage.app",
    messagingSenderId: "205910732394",
    appId: "1:205910732394:web:b5bfb41681c9b899222413",
    measurementId: "G-R8QYQ3YDL5"
}

const app = initializeApp(firebaseConfig)

const db = getDatabase(app)

const userId = "USER_TEST"

const userStatusRef = ref(db, `status/${userId}`)

set(userStatusRef, { state: "online", last_changed: serverTimestamp(), now: Date.now() })

onDisconnect(userStatusRef).set({ state: "offline", last_changed: serverTimestamp(), now: Date.now() })

console.log("🔥 onDisconnect() setup complete")
