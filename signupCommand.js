/* Copyright 2025 Hotelumo LLC */
import signupCommand from '@monorepool/agentfirst/signupCommand.js'

import { appUrl, binaryName } from './constants.js'
import getApiUrl from './getApiUrl.js'
import session from './session.js'

// The step that used to need a person. `login` assumes the account already
// exists; an agent pointed at hotelumo.com for the first time has nothing to
// log into, and the browser flow it would fall back to blocks with nobody
// there to complete it.
//
//   hotelumo signup --email founder@example.com --json
//
// drives the same public POST /api/signup the web signup form posts to
// (hotelumo/api/handlers/signupHandler.js: Basic base64(email:password), no
// verification gate), then stores the session in the same ~/.hotelumo/ the
// browser login writes — so every other command works immediately after.
// Signup seeds a demo hotel with room types, rooms and rate plans, so the
// read commands have something to return straight away.
export default () => signupCommand({ binaryName, getApiUrl, appUrl, session })
