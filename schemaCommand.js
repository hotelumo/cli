/* Copyright 2025 Hotelumo LLC */
const schemaCommand = require('@monorepool/agentfirst/schemaCommand.js')

// `hotelumo schema` — the whole command tree as JSON, so an agent can
// discover what the CLI can do without scraping --help text. index.js
// passes the fully-assembled commander program (after every addCommand),
// so the schema describes the CLI exactly as it runs, `schema` included.
module.exports = program => schemaCommand({ program })
