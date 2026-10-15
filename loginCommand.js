/* Copyright 2025 Hotelumo LLC */
import loginCommand from '@monorepool/agentfirst/loginCommand.js'

import { appUrl, binaryName, envKeyName } from './constants.js'
import getApiUrl from './getApiUrl.js'
import packageJson from './package.json' with { type: 'json' }
import api from './request.js'
import session from './session.js'

// Verifies a pasted key with the cheapest read the API offers to a key.
// GET /api/roomTypes needs no parameters and only rooms:read, which every
// new key starts with. Resolving (instead of throwing) on a scope gap keeps
// a narrowly-scoped key stored — a missing scope is a permissions choice,
// not a bad secret.
async function verify() {
  try {
    const roomTypes = await api.get('/api/roomTypes')

    return `Logged in — ${roomTypes.length} room type(s) visible to this key.`
  } catch (error) {
    if (error.status === 403 && String(error.message).includes('scope')) {
      return (
        'Key stored. It lacks the rooms:read scope, so it could not be' +
        ' verified — commands within its granted scopes will still work.'
      )
    }

    if (error.status === 401 || error.status === 403) {
      throw error
    }

    return `Key stored, but the verification call failed: ${error.message}`
  }
}

// `hotelumo login` via the shared factory: `--browser` opens
// app.hotelumo.com/cli (the page hotelumo/app/pages/CliPage.jsx serves) and
// stores a token session; `--device` prints a link, a QR code and a one-time
// code to approve on app.hotelumo.com/cli from a phone or another computer, for
// a terminal whose browser cannot be used; `--with-key` prompts (masked) for an
// API key secret. Headless with no flags it fails fast with instructions
// instead of hanging on a prompt or opening a browser.
export default () =>
  loginCommand({
    binaryName,
    appUrl,
    getApiUrl,
    version: packageJson.version,
    session,
    verify,
    envKeyName,
  })
