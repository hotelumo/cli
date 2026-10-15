/* Copyright 2025 Hotelumo LLC */

// ANSI helpers for the human-formatted `read` views only. JSON output goes
// through @monorepool/agentfirst/output.js — real JSON.stringify, never
// util.inspect, never colored.
const dim = text => `\x1b[2m${text}\x1b[0m`
const bold = text => `\x1b[1m${text}\x1b[0m`
const cyan = text => `\x1b[36m${text}\x1b[0m`

// eslint-disable-next-line @stylistic/object-curly-newline
export { bold, cyan, dim }
