/* Copyright 2025 Hotelumo LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import buildQuery from './buildQuery.js'
import { bold, cyan, dim } from './formatOutput.js'
import parseBody from './parseBody.js'
import api from './request.js'
import resolveHotelId from './resolveHotelId.js'

// Rate plans — the sellable price products attached to a room type. They
// share the `rates` scope with daily rates and the availability query
// (hotelumo/api/handlers/scopes.js). `basePrice` is in minor currency units:
// 9000 is 90.00 in a two-decimal currency.
function ratePlansCommand() {
  const command = new commander.Command('rate-plans')
  command.description(
    'manage the rate plans of your hotels (rates:read / rates:write)',
  )

  withJson(
    command
      .command('list')
      .description('list rate plans (GET /api/ratePlans)')
      .option(
        '--hotelId <hotelId>',
        'hotel to list the rate plans of — required unless the API key is pinned to one hotel',
      )
      .option('--roomTypeId <roomTypeId>', 'only plans of this room type'),
  ).action(async options => {
    try {
      const ratePlans = await api.get(
        `/api/ratePlans${buildQuery({
          hotelId: options.hotelId,
          roomTypeId: options.roomTypeId,
        })}`,
      )

      if (options.json) {
        printJson(ratePlans)
        return
      }

      if (ratePlans.length === 0) {
        console.log('No rate plans found')
        return
      }

      console.log(`Found ${ratePlans.length} rate plan(s):`)
      ratePlans.forEach((ratePlan, index) => {
        const price =
          ratePlan.basePrice != null
            ? ` — ${ratePlan.basePrice}${ratePlan.currency ? ` ${ratePlan.currency}` : ''}`
            : ''
        console.log(
          `${index + 1}. ${ratePlan.title || ratePlan._id}${price}` +
            `${ratePlan.isDefault ? ' [default]' : ''} (${ratePlan._id})`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('get <ratePlanId>')
      .description(
        'raw JSON for one rate plan (GET /api/ratePlans/:ratePlanId)',
      ),
  ).action(async (ratePlanId, options) => {
    try {
      const ratePlan = await api.get(`/api/ratePlans/${ratePlanId}`)
      printJson(ratePlan)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('read <ratePlanId>')
      .description('read one rate plan formatted for the terminal'),
  ).action(async (ratePlanId, options) => {
    try {
      const ratePlan = await api.get(`/api/ratePlans/${ratePlanId}`)
      if (options.json) {
        printJson(ratePlan)
        return
      }
      if (!ratePlan) {
        console.log('Rate plan not found')
        return
      }
      console.log()
      console.log(bold(ratePlan.title || ratePlan._id))
      console.log(dim(ratePlan._id))
      console.log()
      if (ratePlan.basePrice != null) {
        console.log(
          `${cyan('basePrice')}  ${ratePlan.basePrice}` +
            `${ratePlan.currency ? ` ${ratePlan.currency}` : ''} (minor units)`,
        )
      }
      if (ratePlan.mealPlan) {
        console.log(`${cyan('mealPlan')}  ${ratePlan.mealPlan}`)
      }
      if (ratePlan.sellMode) {
        console.log(`${cyan('sellMode')}  ${ratePlan.sellMode}`)
      }
      if (ratePlan.rateMode) {
        console.log(`${cyan('rateMode')}  ${ratePlan.rateMode}`)
      }
      if (ratePlan.roomTypeId) {
        console.log(`${cyan('roomTypeId')}  ${ratePlan.roomTypeId}`)
      }
      if (ratePlan.hotelId) {
        console.log(`${cyan('hotelId')}  ${ratePlan.hotelId}`)
      }
      console.log(`${cyan('isDefault')}  ${Boolean(ratePlan.isDefault)}`)
      console.log()
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('add')
      .description('create a rate plan (POST /api/ratePlans)')
      .requiredOption('--hotelId <hotelId>', 'hotel the plan belongs to')
      .requiredOption('--roomTypeId <roomTypeId>', 'room type the plan sells')
      .option('--title <title>', 'plan title (default "Best Available Rate")')
      .option(
        '--basePrice <basePrice>',
        'catalog price in minor currency units, e.g. 9000 for 90.00',
      )
      .option(
        '--mealPlan <mealPlan>',
        'room_only, bed_and_breakfast, half_board, full_board or all_inclusive',
      )
      .option('--sellMode <sellMode>', 'per_room or per_person')
      .option('--rateMode <rateMode>', 'manual or derived')
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async options => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const ratePlan = await api.post('/api/ratePlans', {
        ...body,
        hotelId: options.hotelId,
        roomTypeId: options.roomTypeId,
        ...(options.title && { title: options.title }),
        ...(options.basePrice && {
          basePrice: Number.parseInt(options.basePrice, 10),
        }),
        ...(options.mealPlan && { mealPlan: options.mealPlan }),
        ...(options.sellMode && { sellMode: options.sellMode }),
        ...(options.rateMode && { rateMode: options.rateMode }),
      })
      if (options.json) {
        printJson({ ok: true, id: ratePlan._id })
        return
      }
      printJson(ratePlan)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('update <ratePlanId>')
      .description('update a rate plan (PUT /api/ratePlans/:ratePlanId)')
      .option(
        '--hotelId <hotelId>',
        "hotel the plan belongs to (defaults to the stored plan's hotel)",
      )
      .option('--roomTypeId <roomTypeId>', 'room type the plan sells')
      .option('--title <title>', 'plan title')
      .option(
        '--basePrice <basePrice>',
        'catalog price in minor currency units, e.g. 9000 for 90.00',
      )
      .option(
        '--mealPlan <mealPlan>',
        'room_only, bed_and_breakfast, half_board, full_board or all_inclusive',
      )
      .option('--sellMode <sellMode>', 'per_room or per_person')
      .option('--rateMode <rateMode>', 'manual or derived')
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async (ratePlanId, options) => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const hotelId = await resolveHotelId(options, body, () =>
        api.get(`/api/ratePlans/${ratePlanId}`),
      )
      const ratePlan = await api.put(`/api/ratePlans/${ratePlanId}`, {
        ...body,
        _id: ratePlanId,
        ...(hotelId && { hotelId }),
        ...(options.roomTypeId && { roomTypeId: options.roomTypeId }),
        ...(options.title && { title: options.title }),
        ...(options.basePrice && {
          basePrice: Number.parseInt(options.basePrice, 10),
        }),
        ...(options.mealPlan && { mealPlan: options.mealPlan }),
        ...(options.sellMode && { sellMode: options.sellMode }),
        ...(options.rateMode && { rateMode: options.rateMode }),
      })
      if (options.json) {
        printJson({ ok: true, id: ratePlan._id })
        return
      }
      printJson(ratePlan)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('delete <ratePlanId...>')
      .description(
        'delete one or more rate plans by id, together with their daily rates (DELETE /api/ratePlans/:ratePlanId)',
      ),
  ).action(async (ratePlanIds, options) => {
    const deleted = []
    for (let index = 0; index < ratePlanIds.length; index += 1) {
      const ratePlanId = ratePlanIds[index]
      try {
        await api.del(`/api/ratePlans/${ratePlanId}`)
        deleted.push(ratePlanId)
        if (!options.json) {
          console.log(`deleted ${ratePlanId}`)
        }
      } catch (error) {
        fail(error, { json: options.json })
      }
    }
    if (options.json) {
      printJson({ ok: deleted.length === ratePlanIds.length, deleted })
    }
  })

  return command
}

export default ratePlansCommand
