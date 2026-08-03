/* Copyright 2025 Hotelumo LLC */
const commander = require('commander')
const {
  printJson,
  withJson,
  fail,
} = require('@monorepool/agentfirst/output.js')
const buildQuery = require('./buildQuery.js')
const parseBody = require('./parseBody.js')
const api = require('./request.js')

// API keys — the credential every other command can authenticate with.
//
// Managed with an operator session and an admin role only
// (hotelumo/api/handlers/keysHandler.js: withAccessToken + assertAdmin), so
// these commands need `hotelumo login --browser`. That asymmetry is the
// point: it closes the loop for an agent that just ran `hotelumo signup` —
// log in, mint a key, export it as HOTELUMO_API_KEY, and every later run is
// headless.
//
// The secret is returned exactly once, by `add`. There is no way to read it
// back afterwards without re-entering the account password in the dashboard.
const SCOPES = [
  'reservations:read',
  'reservations:write',
  'guests:read',
  'guests:write',
  'rooms:read',
  'rooms:write',
  'rates:read',
  'rates:write',
]

function keysCommand() {
  const command = new commander.Command('keys')
  command.description(
    'manage API keys (operator session + admin role — log in with --browser)',
  )

  withJson(
    command
      .command('list')
      .description(
        'list API keys without their secrets (GET /api/keys)',
      )
      .option('--hotelId <hotelId>', 'only keys pinned to this hotel')
      .option('-n, --limit <limit>', 'max results')
      .option('--skip <skip>', 'skip the first N results')
      .option('--fields <fields>', 'comma-separated projection of fields'),
  ).action(async options => {
    try {
      const keys = await api.get(
        `/api/keys${buildQuery({
          hotelId: options.hotelId,
          limit: options.limit,
          skip: options.skip,
          fields: options.fields,
        })}`,
      )

      if (options.json) {
        printJson(keys)
        return
      }

      if (keys.length === 0) {
        console.log('No API keys found')
        return
      }

      console.log(`Found ${keys.length} key(s):`)
      keys.forEach((key, index) => {
        console.log(
          `${index + 1}. ${key.name || key._id}` +
            `${key.hotelId ? ` — hotel ${key.hotelId}` : ' — organization-wide'}` +
            ` [${(key.scopes || SCOPES).join(' ')}] (${key._id})`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('get <keyId>')
      .description(
        'raw JSON for one key, without its secret (GET /api/keys/:keyId)',
      ),
  ).action(async (keyId, options) => {
    try {
      const key = await api.get(`/api/keys/${keyId}`)
      printJson(key)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('add')
      .description(
        'create an API key — the secret is returned exactly once, here (POST /api/keys)',
      )
      .requiredOption('--name <name>', 'human label for the key')
      .option(
        '--hotelId <hotelId>',
        'pin the key to one hotel; omit for an organization-wide key',
      )
      .option(
        '--scopes <scopes>',
        `comma-separated scopes (${SCOPES.join(', ')}) — defaults to the four :read scopes`,
      )
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async options => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const key = await api.post('/api/keys', {
        ...body,
        name: options.name,
        ...(options.hotelId && { hotelId: options.hotelId }),
        ...(options.scopes && {
          scopes: options.scopes.split(',').map(scope => scope.trim()),
        }),
      })
      if (options.json) {
        printJson({ ok: true, id: key._id, secret: key.secret })
        return
      }
      printJson(key)
      console.error(
        'The secret above is shown once — store it now, or export it as HOTELUMO_API_KEY.',
      )
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('delete <keyId...>')
      .description(
        'delete one or more API keys by id, revoking them immediately (DELETE /api/keys/:keyId)',
      ),
  ).action(async (keyIds, options) => {
    const deleted = []
    for (let index = 0; index < keyIds.length; index += 1) {
      const keyId = keyIds[index]
      try {
        await api.del(`/api/keys/${keyId}`)
        deleted.push(keyId)
        if (!options.json) {
          console.log(`deleted ${keyId}`)
        }
      } catch (error) {
        fail(error, { json: options.json })
      }
    }
    if (options.json) {
      printJson({ ok: deleted.length === keyIds.length, deleted })
    }
  })

  return command
}

module.exports = keysCommand
