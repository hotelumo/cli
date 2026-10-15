/* Copyright 2025 Hotelumo LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import buildQuery from './buildQuery.js'
import { bold, cyan, dim } from './formatOutput.js'
import parseBody from './parseBody.js'
import api from './request.js'
import resolveHotelId from './resolveHotelId.js'

// Room types — the sellable categories rooms belong to. They share the
// `rooms` scope with physical rooms (hotelumo/api/handlers/scopes.js).
// Prices do NOT live here: they live on the room type's rate plans.
function roomTypesCommand() {
  const command = new commander.Command('room-types')
  command.description(
    'manage the room types of your hotels (rooms:read / rooms:write)',
  )

  withJson(
    command
      .command('list')
      .description('list room types (GET /api/roomTypes)')
      .option('--hotelId <hotelId>', 'only room types of this hotel')
      .option('-n, --limit <limit>', 'max results')
      .option('--skip <skip>', 'skip the first N results')
      .option('--sortField <field>', 'field to sort by, e.g. name')
      .option('--sortDirection <direction>', 'ASC or DESC (default DESC)')
      .option('--fields <fields>', 'comma-separated projection of fields'),
  ).action(async options => {
    try {
      const roomTypes = await api.get(
        `/api/roomTypes${buildQuery({
          hotelId: options.hotelId,
          limit: options.limit,
          skip: options.skip,
          sortField: options.sortField,
          sortDirection: options.sortDirection,
          fields: options.fields,
        })}`,
      )

      if (options.json) {
        printJson(roomTypes)
        return
      }

      if (roomTypes.length === 0) {
        console.log('No room types found')
        return
      }

      console.log(`Found ${roomTypes.length} room type(s):`)
      roomTypes.forEach((roomType, index) => {
        const capacity =
          roomType.maxGuests != null ? ` — max ${roomType.maxGuests}` : ''
        console.log(
          `${index + 1}. ${roomType.name || roomType._id}${capacity}` +
            ` (${roomType._id})`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('get <roomTypeId>')
      .description(
        'raw JSON for one room type (GET /api/roomTypes/:roomTypeId)',
      ),
  ).action(async (roomTypeId, options) => {
    try {
      const roomType = await api.get(`/api/roomTypes/${roomTypeId}`)
      printJson(roomType)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('read <roomTypeId>')
      .description('read one room type formatted for the terminal'),
  ).action(async (roomTypeId, options) => {
    try {
      const roomType = await api.get(`/api/roomTypes/${roomTypeId}`)
      if (options.json) {
        printJson(roomType)
        return
      }
      if (!roomType) {
        console.log('Room type not found')
        return
      }
      console.log()
      console.log(bold(roomType.name || roomType._id))
      console.log(dim(roomType._id))
      console.log()
      if (roomType.maxGuests != null) {
        console.log(`${cyan('maxGuests')}  ${roomType.maxGuests}`)
      }
      if (roomType.description) {
        console.log(`${cyan('description')}  ${roomType.description}`)
      }
      if (roomType.facilities?.length) {
        console.log(`${cyan('facilities')}  ${roomType.facilities.join(', ')}`)
      }
      if (roomType.hotelId) {
        console.log(`${cyan('hotelId')}  ${roomType.hotelId}`)
      }
      if (roomType.creationTime) {
        console.log(`${cyan('created')}  ${roomType.creationTime}`)
      }
      console.log()
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('add')
      .description('create a room type (POST /api/roomTypes)')
      .requiredOption('--hotelId <hotelId>', 'hotel the room type belongs to')
      .requiredOption('--name <name>', 'room type name, e.g. Double room')
      .option(
        '--maxGuests <maxGuests>',
        'maximum occupancy of one room of this type (default 2)',
      )
      .option('--description <description>', 'public description')
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async options => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const roomType = await api.post('/api/roomTypes', {
        ...body,
        hotelId: options.hotelId,
        name: options.name,
        ...(options.maxGuests && {
          maxGuests: Number.parseInt(options.maxGuests, 10),
        }),
        ...(options.description && { description: options.description }),
      })
      if (options.json) {
        printJson({ ok: true, id: roomType._id })
        return
      }
      printJson(roomType)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('update <roomTypeId>')
      .description('update a room type (PUT /api/roomTypes/:roomTypeId)')
      .option(
        '--hotelId <hotelId>',
        "hotel the room type belongs to (defaults to the stored room type's hotel)",
      )
      .option('--name <name>', 'room type name, e.g. Double room')
      .option(
        '--maxGuests <maxGuests>',
        'maximum occupancy of one room of this type',
      )
      .option('--description <description>', 'public description')
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async (roomTypeId, options) => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const hotelId = await resolveHotelId(options, body, () =>
        api.get(`/api/roomTypes/${roomTypeId}`),
      )
      const roomType = await api.put(`/api/roomTypes/${roomTypeId}`, {
        ...body,
        _id: roomTypeId,
        ...(hotelId && { hotelId }),
        ...(options.name && { name: options.name }),
        ...(options.maxGuests && {
          maxGuests: Number.parseInt(options.maxGuests, 10),
        }),
        ...(options.description && { description: options.description }),
      })
      if (options.json) {
        printJson({ ok: true, id: roomType._id })
        return
      }
      printJson(roomType)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('delete <roomTypeId...>')
      .description(
        'delete one or more room types by id, together with their rate plans and daily rates (DELETE /api/roomTypes/:roomTypeId)',
      ),
  ).action(async (roomTypeIds, options) => {
    const deleted = []
    for (let index = 0; index < roomTypeIds.length; index += 1) {
      const roomTypeId = roomTypeIds[index]
      try {
        await api.del(`/api/roomTypes/${roomTypeId}`)
        deleted.push(roomTypeId)
        if (!options.json) {
          console.log(`deleted ${roomTypeId}`)
        }
      } catch (error) {
        fail(error, { json: options.json })
      }
    }
    if (options.json) {
      printJson({ ok: deleted.length === roomTypeIds.length, deleted })
    }
  })

  return command
}

export default roomTypesCommand
