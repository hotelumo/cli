/* Copyright 2025 Hotelumo LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import buildQuery from './buildQuery.js'
import { bold, cyan, dim } from './formatOutput.js'
import parseBody from './parseBody.js'
import api from './request.js'

// Room blocks — one room taken out of sale for a run of nights: a repair, the
// owner's own stay, a room kept free. A block is physical inventory, so it
// reads and writes under the `rooms` scopes
// (hotelumo/api/handlers/roomBlocksHandler.js).
//
// Dates are nights, exactly like a stay: --startDate is the first blocked
// night and --endDate the first night the room is free again (exclusive, like
// a check-out), so 2026-08-10 → 2026-08-12 blocks the nights of the 10th and
// the 11th.
//
// A block always takes its room's hotel, so unlike the other writes nothing
// here needs or looks up a hotelId: --hotelId only asserts the room's hotel.
const DAY_IN_MS = 24 * 60 * 60 * 1000

// The nights from startDate up to, not including, endDate; null when either
// date is missing or unreadable.
function countNights({ startDate, endDate }) {
  const nights = Math.round(
    (Date.parse(`${endDate}T00:00:00.000Z`) -
      Date.parse(`${startDate}T00:00:00.000Z`)) /
      DAY_IN_MS,
  )

  return Number.isFinite(nights) ? nights : null
}

const formatNights = nights => (nights === 1 ? '1 night' : `${nights} nights`)

function roomBlocksCommand() {
  const command = new commander.Command('room-blocks')
  command.description(
    'take rooms out of sale for some nights: out of order, out of service, private use (rooms:read / rooms:write)',
  )

  withJson(
    command
      .command('list')
      .description('list room blocks, earliest first (GET /api/roomblocks)')
      .option('--hotelId <hotelId>', 'only blocks of this hotel')
      .option('--roomId <roomId>', 'only blocks of this room')
      .option(
        '--from <date>',
        'YYYY-MM-DD — only blocks with a night on or after this date',
      )
      .option(
        '--to <date>',
        'YYYY-MM-DD, exclusive — only blocks with a night before this date',
      ),
  ).action(async options => {
    try {
      const roomBlocks = await api.get(
        `/api/roomblocks${buildQuery({
          hotelId: options.hotelId,
          roomId: options.roomId,
          from: options.from,
          to: options.to,
        })}`,
      )

      if (options.json) {
        printJson(roomBlocks)
        return
      }

      if (roomBlocks.length === 0) {
        console.log('No room blocks found')
        return
      }

      console.log(`Found ${roomBlocks.length} room block(s):`)
      roomBlocks.forEach((roomBlock, index) => {
        const dates = [roomBlock.startDate, roomBlock.endDate]
          .filter(Boolean)
          .join(' → ')
        const nights = countNights(roomBlock)
        console.log(
          `${index + 1}. ${roomBlock.roomId ? `room ${roomBlock.roomId}` : roomBlock._id}` +
            `${dates ? ` — ${dates}` : ''}` +
            `${nights > 0 ? `, ${formatNights(nights)}` : ''}` +
            `${roomBlock.type ? ` [${roomBlock.type}]` : ''}` +
            ` (${roomBlock._id})`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('get <roomBlockId>')
      .description(
        'raw JSON for one room block (GET /api/roomblocks/:roomBlockId)',
      ),
  ).action(async (roomBlockId, options) => {
    try {
      const roomBlock = await api.get(`/api/roomblocks/${roomBlockId}`)
      printJson(roomBlock)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('read <roomBlockId>')
      .description('read one room block formatted for the terminal'),
  ).action(async (roomBlockId, options) => {
    try {
      const roomBlock = await api.get(`/api/roomblocks/${roomBlockId}`)
      if (options.json) {
        printJson(roomBlock)
        return
      }
      if (!roomBlock) {
        console.log('Room block not found')
        return
      }
      const dates = [roomBlock.startDate, roomBlock.endDate]
        .filter(Boolean)
        .join(' → ')
      const nights = countNights(roomBlock)
      console.log()
      console.log(bold(dates || roomBlock._id))
      console.log(dim(roomBlock._id))
      console.log()
      if (roomBlock.type) console.log(`${cyan('type')}  ${roomBlock.type}`)
      if (roomBlock.roomId) {
        console.log(`${cyan('roomId')}  ${roomBlock.roomId}`)
      }
      if (nights > 0) {
        console.log(
          `${cyan('nights')}  ${nights}, free again on ${roomBlock.endDate}`,
        )
      }
      if (roomBlock.note) console.log(`${cyan('note')}  ${roomBlock.note}`)
      if (roomBlock.hotelId) {
        console.log(`${cyan('hotelId')}  ${roomBlock.hotelId}`)
      }
      if (roomBlock.creationTime) {
        console.log(`${cyan('created')}  ${roomBlock.creationTime}`)
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
        'block a room for some nights (POST /api/roomblocks); 409 when the room has a stay or another block on one of them',
      )
      .requiredOption('--roomId <roomId>', 'room to take out of sale')
      .requiredOption(
        '--startDate <date>',
        'YYYY-MM-DD — the first blocked night',
      )
      .requiredOption(
        '--endDate <date>',
        'YYYY-MM-DD — the first night the room is free again (exclusive, like a check-out date); at most 366 nights',
      )
      .option(
        '--type <type>',
        'OUT_OF_ORDER, OUT_OF_SERVICE, PRIVATE_USE or OTHER (default OUT_OF_ORDER) — a label only, every type closes the room',
      )
      .option('--note <note>', 'free-text note, up to 2000 characters')
      .option(
        '--hotelId <hotelId>',
        "the room's hotel — optional: a block always takes its room's hotel, and any other is refused",
      )
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async options => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const roomBlock = await api.post('/api/roomblocks', {
        ...body,
        roomId: options.roomId,
        startDate: options.startDate,
        endDate: options.endDate,
        ...(options.type && { type: options.type }),
        ...(options.note !== undefined && { note: options.note }),
        ...(options.hotelId && { hotelId: options.hotelId }),
      })
      if (options.json) {
        printJson({ ok: true, id: roomBlock._id })
        return
      }
      printJson(roomBlock)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('update <roomBlockId>')
      .description(
        'change a room block, sending only the fields given (PUT /api/roomblocks/:roomBlockId)',
      )
      .option('--roomId <roomId>', 'move the block to another room')
      .option('--startDate <date>', 'YYYY-MM-DD — the first blocked night')
      .option(
        '--endDate <date>',
        'YYYY-MM-DD — the first night the room is free again (exclusive, like a check-out date)',
      )
      .option(
        '--type <type>',
        'OUT_OF_ORDER, OUT_OF_SERVICE, PRIVATE_USE or OTHER',
      )
      .option(
        '--note <note>',
        'free-text note, up to 2000 characters; "" clears it',
      )
      .option(
        '--hotelId <hotelId>',
        "the room's hotel — optional: a block always takes its room's hotel, and any other is refused",
      )
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async (roomBlockId, options) => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const roomBlock = await api.put(`/api/roomblocks/${roomBlockId}`, {
        ...body,
        _id: roomBlockId,
        ...(options.roomId && { roomId: options.roomId }),
        ...(options.startDate && { startDate: options.startDate }),
        ...(options.endDate && { endDate: options.endDate }),
        ...(options.type && { type: options.type }),
        ...(options.note !== undefined && { note: options.note }),
        ...(options.hotelId && { hotelId: options.hotelId }),
      })
      if (options.json) {
        printJson({ ok: true, id: roomBlock._id })
        return
      }
      printJson(roomBlock)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('delete <roomBlockId...>')
      .description(
        'delete one or more room blocks by id, putting their nights back on sale (DELETE /api/roomblocks/:roomBlockId)',
      ),
  ).action(async (roomBlockIds, options) => {
    const deleted = []
    for (let index = 0; index < roomBlockIds.length; index += 1) {
      const roomBlockId = roomBlockIds[index]
      try {
        await api.del(`/api/roomblocks/${roomBlockId}`)
        deleted.push(roomBlockId)
        if (!options.json) {
          console.log(`deleted ${roomBlockId}`)
        }
      } catch (error) {
        fail(error, { json: options.json })
      }
    }
    if (options.json) {
      printJson({ ok: deleted.length === roomBlockIds.length, deleted })
    }
  })

  return command
}

export default roomBlocksCommand
