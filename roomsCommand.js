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
const resolveHotelId = require('./resolveHotelId.js')
const { dim, bold, cyan } = require('./formatOutput.js')

// Rooms — the physical inventory. The `rooms` scope covers rooms AND room
// types (hotelumo/api/handlers/scopes.js), so both commands read and write
// under rooms:read / rooms:write.
function roomsCommand() {
  const command = new commander.Command('rooms')
  command.description(
    'manage the physical rooms of your hotels (rooms:read / rooms:write)',
  )

  withJson(
    command
      .command('list')
      .description('list rooms (GET /api/rooms)')
      .option('--hotelId <hotelId>', 'only rooms of this hotel')
      .option('--roomTypeId <roomTypeId>', 'only rooms of this room type')
      .option('-n, --limit <limit>', 'max results')
      .option('--skip <skip>', 'skip the first N results')
      .option('--sortField <field>', 'field to sort by, e.g. number')
      .option('--sortDirection <direction>', 'ASC or DESC (default DESC)')
      .option('--fields <fields>', 'comma-separated projection of fields'),
  ).action(async options => {
    try {
      const rooms = await api.get(
        `/api/rooms${buildQuery({
          hotelId: options.hotelId,
          roomTypeId: options.roomTypeId,
          limit: options.limit,
          skip: options.skip,
          sortField: options.sortField,
          sortDirection: options.sortDirection,
          fields: options.fields,
        })}`,
      )

      if (options.json) {
        printJson(rooms)
        return
      }

      if (rooms.length === 0) {
        console.log('No rooms found')
        return
      }

      console.log(`Found ${rooms.length} room(s):`)
      rooms.forEach((room, index) => {
        const state = [room.status, room.housekeepingStatus]
          .filter(Boolean)
          .join(' · ')
        console.log(
          `${index + 1}. ${room.number || room._id}` +
            `${state ? ` — ${state}` : ''} (${room._id})`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('get <roomId>')
      .description('raw JSON for one room (GET /api/rooms/:roomId)'),
  ).action(async (roomId, options) => {
    try {
      const room = await api.get(`/api/rooms/${roomId}`)
      printJson(room)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('read <roomId>')
      .description('read one room formatted for the terminal'),
  ).action(async (roomId, options) => {
    try {
      const room = await api.get(`/api/rooms/${roomId}`)
      if (options.json) {
        printJson(room)
        return
      }
      if (!room) {
        console.log('Room not found')
        return
      }
      console.log()
      console.log(bold(room.number || room._id))
      console.log(dim(room._id))
      console.log()
      if (room.status) console.log(`${cyan('status')}  ${room.status}`)
      if (room.housekeepingStatus) {
        console.log(`${cyan('housekeeping')}  ${room.housekeepingStatus}`)
      }
      if (room.roomTypeId) {
        console.log(`${cyan('roomTypeId')}  ${room.roomTypeId}`)
      }
      if (room.floor) console.log(`${cyan('floor')}  ${room.floor}`)
      if (room.hotelId) console.log(`${cyan('hotelId')}  ${room.hotelId}`)
      if (room.creationTime) {
        console.log(`${cyan('created')}  ${room.creationTime}`)
      }
      console.log()
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('add')
      .description('create a room (POST /api/rooms)')
      .requiredOption('--hotelId <hotelId>', 'hotel the room belongs to')
      .option('--roomTypeId <roomTypeId>', 'room type of this room')
      .option('--number <number>', 'room number or label, e.g. 101')
      .option('--floor <floor>', 'floor the room is on')
      .option(
        '--status <status>',
        'AVAILABLE, OUT_OF_ORDER or OUT_OF_SERVICE (default AVAILABLE)',
      )
      .option(
        '--housekeepingStatus <status>',
        'CLEAN, DIRTY or INSPECTED (default CLEAN)',
      )
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async options => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const room = await api.post('/api/rooms', {
        ...body,
        hotelId: options.hotelId,
        ...(options.roomTypeId && { roomTypeId: options.roomTypeId }),
        ...(options.number && { number: options.number }),
        ...(options.floor && { floor: options.floor }),
        ...(options.status && { status: options.status }),
        ...(options.housekeepingStatus && {
          housekeepingStatus: options.housekeepingStatus,
        }),
      })
      if (options.json) {
        printJson({ ok: true, id: room._id })
        return
      }
      printJson(room)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('update <roomId>')
      .description('update a room (PUT /api/rooms/:roomId)')
      .option(
        '--hotelId <hotelId>',
        "hotel the room belongs to (defaults to the stored room's hotel)",
      )
      .option('--roomTypeId <roomTypeId>', 'room type of this room')
      .option('--number <number>', 'room number or label, e.g. 101')
      .option('--floor <floor>', 'floor the room is on')
      .option(
        '--status <status>',
        'AVAILABLE, OUT_OF_ORDER or OUT_OF_SERVICE',
      )
      .option('--housekeepingStatus <status>', 'CLEAN, DIRTY or INSPECTED')
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async (roomId, options) => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const hotelId = await resolveHotelId(options, body, () =>
        api.get(`/api/rooms/${roomId}`),
      )
      const room = await api.put(`/api/rooms/${roomId}`, {
        ...body,
        _id: roomId,
        ...(hotelId && { hotelId }),
        ...(options.roomTypeId && { roomTypeId: options.roomTypeId }),
        ...(options.number && { number: options.number }),
        ...(options.floor && { floor: options.floor }),
        ...(options.status && { status: options.status }),
        ...(options.housekeepingStatus && {
          housekeepingStatus: options.housekeepingStatus,
        }),
      })
      if (options.json) {
        printJson({ ok: true, id: room._id })
        return
      }
      printJson(room)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('delete <roomId...>')
      .description(
        'delete one or more rooms by id (DELETE /api/rooms/:roomId)',
      ),
  ).action(async (roomIds, options) => {
    const deleted = []
    for (let index = 0; index < roomIds.length; index += 1) {
      const roomId = roomIds[index]
      try {
        await api.del(`/api/rooms/${roomId}`)
        deleted.push(roomId)
        if (!options.json) {
          console.log(`deleted ${roomId}`)
        }
      } catch (error) {
        fail(error, { json: options.json })
      }
    }
    if (options.json) {
      printJson({ ok: deleted.length === roomIds.length, deleted })
    }
  })

  return command
}

module.exports = roomsCommand
