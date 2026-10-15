/* Copyright 2025 Hotelumo LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import { bold, cyan, dim } from './formatOutput.js'
import parseBody from './parseBody.js'
import api from './request.js'

// Webhook subscriptions deliver reservation.* and guest.* events to your
// server as signed POSTs.
//
// Every route here is guarded by withAccessToken alone
// (hotelumo/api/handlers/webhookSubscriptionsHandler.js) — subscriptions
// are operator-session territory, so these commands need `hotelumo login
// --browser` and answer 401 to an API key. That is deliberate on the API's
// side: a subscription's secret would otherwise be reachable by any key.
const EVENTS = [
  'reservation.created',
  'reservation.updated',
  'reservation.deleted',
  'guest.created',
  'guest.updated',
  'guest.deleted',
]

function webhooksCommand() {
  const command = new commander.Command('webhooks')
  command.description(
    'manage webhook subscriptions (operator session only — log in with --browser)',
  )

  withJson(
    command
      .command('list')
      .description(
        'list webhook subscriptions without their secrets (GET /api/webhooksubscriptions)',
      ),
  ).action(async options => {
    try {
      const subscriptions = await api.get('/api/webhooksubscriptions')

      if (options.json) {
        printJson(subscriptions)
        return
      }

      if (subscriptions.length === 0) {
        console.log('No webhook subscriptions found')
        return
      }

      console.log(`Found ${subscriptions.length} subscription(s):`)
      subscriptions.forEach((subscription, index) => {
        console.log(
          `${index + 1}. ${subscription.url}` +
            `${subscription.active === false ? ' [disabled]' : ''}` +
            ` — ${(subscription.events || []).join(', ') || 'no events'}` +
            ` (${subscription._id})`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('get <webhookSubscriptionId>')
      .description(
        'raw JSON for one subscription (GET /api/webhooksubscriptions/:webhookSubscriptionId)',
      ),
  ).action(async (webhookSubscriptionId, options) => {
    try {
      const subscription = await api.get(
        `/api/webhooksubscriptions/${webhookSubscriptionId}`,
      )
      if (options.json) {
        printJson(subscription)
        return
      }
      console.log()
      console.log(bold(subscription.url || subscription._id))
      console.log(dim(subscription._id))
      console.log()
      console.log(
        `${cyan('events')}  ${(subscription.events || []).join(', ')}`,
      )
      console.log(`${cyan('active')}  ${subscription.active !== false}`)
      if (subscription.hotelId) {
        console.log(`${cyan('hotelId')}  ${subscription.hotelId}`)
      }
      if (subscription.consecutiveFailures != null) {
        console.log(
          `${cyan('failures')}  ${subscription.consecutiveFailures} in a row`,
        )
      }
      console.log()
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('add')
      .description(
        'create a subscription — the signing secret is returned exactly once, here (POST /api/webhooksubscriptions)',
      )
      .requiredOption('--hotelId <hotelId>', 'hotel to subscribe to')
      .requiredOption(
        '--url <url>',
        'https endpoint to POST to; it must resolve to a public address',
      )
      .option(
        '--events <events>',
        `comma-separated events (${EVENTS.join(', ')})`,
      )
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async options => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const subscription = await api.post('/api/webhooksubscriptions', {
        ...body,
        hotelId: options.hotelId,
        url: options.url,
        ...(options.events && {
          events: options.events.split(',').map(event => event.trim()),
        }),
      })
      if (options.json) {
        printJson({
          ok: true,
          id: subscription._id,
          secret: subscription.secret,
        })
        return
      }
      printJson(subscription)
      console.error(
        'The secret above is shown once — store it now; it signs every delivery.',
      )
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('update <webhookSubscriptionId>')
      .description(
        'update url, events or active (PUT /api/webhooksubscriptions/:webhookSubscriptionId)',
      )
      .option('--url <url>', 'https endpoint to POST to')
      .option(
        '--events <events>',
        `comma-separated events (${EVENTS.join(', ')})`,
      )
      .option(
        '--active <active>',
        'true or false — re-enable an auto-disabled endpoint with true',
      )
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async (webhookSubscriptionId, options) => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const subscription = await api.put(
        `/api/webhooksubscriptions/${webhookSubscriptionId}`,
        {
          ...body,
          ...(options.url && { url: options.url }),
          ...(options.events && {
            events: options.events.split(',').map(event => event.trim()),
          }),
          ...(options.active !== undefined && {
            active: options.active === 'true',
          }),
        },
      )
      if (options.json) {
        printJson({ ok: true, id: subscription._id })
        return
      }
      printJson(subscription)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('delete <webhookSubscriptionId...>')
      .description(
        'delete one or more subscriptions by id (DELETE /api/webhooksubscriptions/:webhookSubscriptionId)',
      ),
  ).action(async (webhookSubscriptionIds, options) => {
    const deleted = []
    for (let index = 0; index < webhookSubscriptionIds.length; index += 1) {
      const webhookSubscriptionId = webhookSubscriptionIds[index]
      try {
        await api.del(`/api/webhooksubscriptions/${webhookSubscriptionId}`)
        deleted.push(webhookSubscriptionId)
        if (!options.json) {
          console.log(`deleted ${webhookSubscriptionId}`)
        }
      } catch (error) {
        fail(error, { json: options.json })
      }
    }
    if (options.json) {
      printJson({
        ok: deleted.length === webhookSubscriptionIds.length,
        deleted,
      })
    }
  })

  return command
}

export default webhooksCommand
