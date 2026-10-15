/* Copyright 2025 Hotelumo LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import buildQuery from './buildQuery.js'
import parseBody from './parseBody.js'
import api from './request.js'

// Daily rates — the per-day price/availability grid (the ARI surface a
// channel manager pushes). Scope `rates` (hotelumo/api/handlers/scopes.js).
//
// The write route is a batch upsert keyed on (ratePlanId, date), which is
// why the command is `set` rather than `add`/`update`: POST /api/dailyRates
// takes `{ values: [...] }` and upserts every row in one call, capped at 500
// values. Prices are minor currency units.
const MAX_BATCH_SIZE = 500

function toDate(value) {
  return new Date(`${value}T00:00:00.000Z`)
}

// Expands --dateFrom/--dateTo into one value per day so a whole range can be
// priced from flags alone. Inclusive of both ends, mirroring the grid the
// dashboard edits.
function expandDates(dateFrom, dateTo) {
  const from = toDate(dateFrom)
  const to = toDate(dateTo || dateFrom)

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('--dateFrom and --dateTo must be YYYY-MM-DD dates')
  }

  if (to < from) {
    throw new Error('--dateTo must not be earlier than --dateFrom')
  }

  const dates = []

  for (
    let date = from;
    date <= to;
    date = new Date(date.getTime() + 24 * 60 * 60 * 1000)
  ) {
    dates.push(date.toISOString().slice(0, 10))
  }

  return dates
}

function dailyRatesCommand() {
  const command = new commander.Command('daily-rates')
  command.description(
    'read and publish the per-day prices of your rate plans (rates:read / rates:write)',
  )

  withJson(
    command
      .command('list')
      .description(
        'list the daily rates of one rate plan over a date range, max 365 days (GET /api/dailyRates)',
      )
      .option(
        '--hotelId <hotelId>',
        'hotel the rate plan belongs to — required unless the API key is pinned to one hotel',
      )
      .requiredOption('--ratePlanId <ratePlanId>', 'rate plan to read')
      .requiredOption('--dateFrom <dateFrom>', 'YYYY-MM-DD, inclusive')
      .requiredOption('--dateTo <dateTo>', 'YYYY-MM-DD, inclusive'),
  ).action(async options => {
    try {
      const dailyRates = await api.get(
        `/api/dailyRates${buildQuery({
          hotelId: options.hotelId,
          ratePlanId: options.ratePlanId,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
        })}`,
      )

      if (options.json) {
        printJson(dailyRates)
        return
      }

      if (dailyRates.length === 0) {
        console.log('No daily rates found')
        return
      }

      console.log(`Found ${dailyRates.length} daily rate(s):`)
      dailyRates.forEach(dailyRate => {
        const flags = [
          dailyRate.stopSell ? 'stop-sell' : null,
          dailyRate.closedToArrival ? 'CTA' : null,
          dailyRate.closedToDeparture ? 'CTD' : null,
        ]
          .filter(Boolean)
          .join(' ')
        console.log(
          `${dailyRate.date}  ${dailyRate.price ?? '-'}` +
            `${dailyRate.availability != null ? `  avail ${dailyRate.availability}` : ''}` +
            `${flags ? `  ${flags}` : ''}`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('set')
      .description(
        'upsert per-day prices and restrictions in one batch, max 500 values (POST /api/dailyRates)',
      )
      .option(
        '--hotelId <hotelId>',
        'hotel the rate plan belongs to — required unless the API key is pinned to one hotel',
      )
      .option('--ratePlanId <ratePlanId>', 'rate plan to price')
      .option('--dateFrom <dateFrom>', 'YYYY-MM-DD, inclusive')
      .option(
        '--dateTo <dateTo>',
        'YYYY-MM-DD, inclusive (defaults to --dateFrom)',
      )
      .option(
        '--price <price>',
        'price in minor currency units, e.g. 12000 for 120.00',
      )
      .option('--availability <availability>', 'rooms sellable on those days')
      .option('--minStay <minStay>', 'minimum nights')
      .option('--maxStay <maxStay>', 'maximum nights')
      .option('--stopSell', 'close the days for sale')
      .option('--closedToArrival', 'no arrivals on those days')
      .option('--closedToDeparture', 'no departures on those days')
      .option(
        '--values <json>',
        'the raw `values` array as JSON — use instead of the flags above to set several rate plans or prices in one call',
      ),
  ).action(async options => {
    try {
      let values

      if (options.values) {
        values = parseBody(options.values)

        if (!Array.isArray(values)) {
          throw new Error('--values must be a JSON array')
        }
      } else {
        if (!options.ratePlanId) {
          throw new Error('--ratePlanId is required (or pass --values)')
        }

        if (!options.dateFrom) {
          throw new Error('--dateFrom is required (or pass --values)')
        }

        values = expandDates(options.dateFrom, options.dateTo).map(date => ({
          ratePlanId: options.ratePlanId,
          date,
          ...(options.price !== undefined && {
            price: Number.parseInt(options.price, 10),
          }),
          ...(options.availability !== undefined && {
            availability: Number.parseInt(options.availability, 10),
          }),
          ...(options.minStay !== undefined && {
            minStay: Number.parseInt(options.minStay, 10),
          }),
          ...(options.maxStay !== undefined && {
            maxStay: Number.parseInt(options.maxStay, 10),
          }),
          ...(options.stopSell && { stopSell: true }),
          ...(options.closedToArrival && { closedToArrival: true }),
          ...(options.closedToDeparture && { closedToDeparture: true }),
        }))
      }

      if (values.length === 0) {
        throw new Error('nothing to set — the values array is empty')
      }

      // The API rejects a bigger batch outright, so say so here rather than
      // sending a request that is guaranteed to 400.
      if (values.length > MAX_BATCH_SIZE) {
        throw new Error(
          `too many values: ${values.length}, max ${MAX_BATCH_SIZE} per call — split the date range`,
        )
      }

      const dailyRates = await api.post(
        `/api/dailyRates${buildQuery({ hotelId: options.hotelId })}`,
        { values },
      )

      if (options.json) {
        printJson({ ok: true, count: dailyRates.length })
        return
      }

      console.log(`Upserted ${dailyRates.length} daily rate(s)`)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('delete <dailyRateId...>')
      .description(
        'delete one or more daily rates by id (DELETE /api/dailyRates/:dailyRateId)',
      ),
  ).action(async (dailyRateIds, options) => {
    const deleted = []
    for (let index = 0; index < dailyRateIds.length; index += 1) {
      const dailyRateId = dailyRateIds[index]
      try {
        await api.del(`/api/dailyRates/${dailyRateId}`)
        deleted.push(dailyRateId)
        if (!options.json) {
          console.log(`deleted ${dailyRateId}`)
        }
      } catch (error) {
        fail(error, { json: options.json })
      }
    }
    if (options.json) {
      printJson({ ok: deleted.length === dailyRateIds.length, deleted })
    }
  })

  return command
}

export default dailyRatesCommand
