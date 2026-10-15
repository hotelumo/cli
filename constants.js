/* Copyright 2025 Hotelumo LLC */

// The per-product configuration every @monorepool/agentfirst factory needs.
//
// HOTELUMO_API_KEY is read from the environment at request time; a stored
// login (browser session or pasted key) always wins over it, so a globally
// exported key cannot silently hijack an interactive session.
export const binaryName = 'hotelumo'

export const appUrl = 'https://app.hotelumo.com'
export const envKeyName = 'HOTELUMO_API_KEY'
