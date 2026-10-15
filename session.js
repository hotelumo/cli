/* Copyright 2025 Hotelumo LLC */
import createSessionStore from '@monorepool/agentfirst/sessionStore.js'

// ~/.hotelumo/ holds both credential kinds: the accessToken + refreshToken
// pair a browser login stores, and an API key secret pasted through
// `hotelumo login --with-key`. The directory is only created on first use —
// `hotelumo --help` leaves nothing behind.
export default createSessionStore({ productDirName: 'hotelumo' })
