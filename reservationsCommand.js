/* Copyright 2025 Hotelumo LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import buildQuery from './buildQuery.js'
import { bold, cyan, dim } from './formatOutput.js'
import parseBody from './parseBody.js'
import api from './request.js'
import resolveHotelId from './resolveHotelId.js'

// Reservations — the booking record, with its rooms. Scopes:
// reservations:read for list/get/read, reservations:write for
// add/update/approve/delete (hotelumo/api/handlers/reservationsHandler.js).
function reservationsCommand() {
  const command = new commander.Command('reservations')
  command.description(
    'manage the reservations of your hotels (reservations:read / reservations:write)',
  )

  withJson(
    command
      .command('list')
      .description('list reservations (GET /api/reservations)')
      .option('--hotelId <hotelId>', 'only reservations of this hotel')
      .option('--guestId <guestId>', 'only reservations of this guest')
      .option(
        '--startTime <startTime>',
        'ISO-8601 lower bound on the reservation startTime',
      )
      .option(
        '--endTime <endTime>',
        'ISO-8601 exclusive upper bound on the reservation endTime',
      )
      .option(
        '--stayDateFrom <date>',
        'YYYY-MM-DD — include stays checking out after this date',
      )
      .option(
        '--stayDateTo <date>',
        'YYYY-MM-DD — include stays checking in on or before this date',
      )
      .option('-n, --limit <limit>', 'max results')
      .option('--skip <skip>', 'skip the first N results')
      .option('--sortField <field>', 'field to sort by, e.g. checkInDate')
      .option('--sortDirection <direction>', 'ASC or DESC (default DESC)')
      .option('--fields <fields>', 'comma-separated projection of fields'),
  ).action(async options => {
    try {
      const reservations = await api.get(
        `/api/reservations${buildQuery({
          hotelId: options.hotelId,
          guestId: options.guestId,
          startTime: options.startTime,
          endTime: options.endTime,
          stayDateFrom: options.stayDateFrom,
          stayDateTo: options.stayDateTo,
          limit: options.limit,
          skip: options.skip,
          sortField: options.sortField,
          sortDirection: options.sortDirection,
          fields: options.fields,
        })}`,
      )

      if (options.json) {
        printJson(reservations)
        return
      }

      if (reservations.length === 0) {
        console.log('No reservations found')
        return
      }

      console.log(`Found ${reservations.length} reservation(s):`)
      reservations.forEach((reservation, index) => {
        const stay = [reservation.checkInDate, reservation.checkOutDate]
          .filter(Boolean)
          .join(' → ')
        console.log(
          `${index + 1}. ${reservation.guestName || reservation._id}` +
            `${stay ? ` — ${stay}` : ''}` +
            `${reservation.status ? ` [${reservation.status}]` : ''}` +
            ` (${reservation._id})`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('get <reservationId>')
      .description(
        'raw JSON for one reservation (GET /api/reservations/:reservationId)',
      ),
  ).action(async (reservationId, options) => {
    try {
      const reservation = await api.get(`/api/reservations/${reservationId}`)
      printJson(reservation)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('read <reservationId>')
      .description('read one reservation formatted for the terminal'),
  ).action(async (reservationId, options) => {
    try {
      const reservation = await api.get(`/api/reservations/${reservationId}`)
      if (options.json) {
        printJson(reservation)
        return
      }
      if (!reservation) {
        console.log('Reservation not found')
        return
      }
      console.log()
      console.log(bold(reservation.guestName || reservation._id))
      console.log(dim(reservation._id))
      console.log()
      if (reservation.status) {
        console.log(`${cyan('status')}  ${reservation.status}`)
      }
      if (reservation.source) {
        console.log(`${cyan('source')}  ${reservation.source}`)
      }
      if (reservation.checkInDate) {
        console.log(`${cyan('check-in')}  ${reservation.checkInDate}`)
      }
      if (reservation.checkOutDate) {
        console.log(`${cyan('check-out')}  ${reservation.checkOutDate}`)
      }
      if (reservation.hotelId) {
        console.log(`${cyan('hotelId')}  ${reservation.hotelId}`)
      }
      if (reservation.guestId) {
        console.log(`${cyan('guestId')}  ${reservation.guestId}`)
      }
      if (Array.isArray(reservation.rooms)) {
        console.log(`${cyan('rooms')}  ${reservation.rooms.length}`)
      }
      if (reservation.creationTime) {
        console.log(`${cyan('created')}  ${reservation.creationTime}`)
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
        'create a reservation (POST /api/reservations, fires reservation.created)',
      )
      .requiredOption('--hotelId <hotelId>', 'hotel the stay belongs to')
      .option('--guestId <guestId>', 'existing guest to attach the stay to')
      .option('--guestName <guestName>', 'guest name shown on the reservation')
      .option('--checkInDate <date>', 'YYYY-MM-DD arrival date')
      .option('--checkOutDate <date>', 'YYYY-MM-DD departure date (exclusive)')
      .option(
        '--status <status>',
        'INQUIRY, REQUESTED, CONFIRMED, CHECKED_IN, CHECKED_OUT, NO_SHOW or CANCELED (default CONFIRMED)',
      )
      .option(
        '--source <source>',
        'DIRECT, BOOKING_COM, EXPEDIA, AIRBNB, WALK_IN, PHONE or EMAIL (default DIRECT)',
      )
      .option('--note <note>', 'free-text note on the reservation')
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body — this is how you pass the `rooms` array',
      ),
  ).action(async options => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const reservation = await api.post('/api/reservations', {
        ...body,
        hotelId: options.hotelId,
        ...(options.guestId && { guestId: options.guestId }),
        ...(options.guestName && { guestName: options.guestName }),
        ...(options.checkInDate && { checkInDate: options.checkInDate }),
        ...(options.checkOutDate && { checkOutDate: options.checkOutDate }),
        ...(options.status && { status: options.status }),
        ...(options.source && { source: options.source }),
        ...(options.note && { note: options.note }),
      })
      if (options.json) {
        printJson({ ok: true, id: reservation._id })
        return
      }
      printJson(reservation)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('update <reservationId>')
      .description(
        'update a reservation (PUT /api/reservations/:reservationId, fires reservation.updated)',
      )
      .option(
        '--hotelId <hotelId>',
        "hotel the stay belongs to (defaults to the stored reservation's hotel)",
      )
      .option('--guestId <guestId>', 'guest the stay belongs to')
      .option('--guestName <guestName>', 'guest name shown on the reservation')
      .option('--checkInDate <date>', 'YYYY-MM-DD arrival date')
      .option('--checkOutDate <date>', 'YYYY-MM-DD departure date (exclusive)')
      .option(
        '--status <status>',
        'INQUIRY, REQUESTED, CONFIRMED, CHECKED_IN, CHECKED_OUT, NO_SHOW or CANCELED',
      )
      .option('--note <note>', 'free-text note on the reservation')
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async (reservationId, options) => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const hotelId = await resolveHotelId(options, body, () =>
        api.get(`/api/reservations/${reservationId}`),
      )
      const reservation = await api.put(`/api/reservations/${reservationId}`, {
        ...body,
        _id: reservationId,
        ...(hotelId && { hotelId }),
        ...(options.guestId && { guestId: options.guestId }),
        ...(options.guestName && { guestName: options.guestName }),
        ...(options.checkInDate && { checkInDate: options.checkInDate }),
        ...(options.checkOutDate && { checkOutDate: options.checkOutDate }),
        ...(options.status && { status: options.status }),
        ...(options.note && { note: options.note }),
      })
      if (options.json) {
        printJson({ ok: true, id: reservation._id })
        return
      }
      printJson(reservation)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('approve <reservationId>')
      .description(
        'approve a REQUESTED reservation, assigning its pending rooms (POST /api/reservations/:reservationId/approve)',
      ),
  ).action(async (reservationId, options) => {
    try {
      const reservation = await api.post(
        `/api/reservations/${reservationId}/approve`,
      )
      if (options.json) {
        printJson({ ok: true, id: reservationId, status: reservation?.status })
        return
      }
      printJson(reservation)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('delete <reservationId...>')
      .description(
        'delete one or more reservations by id (DELETE /api/reservations/:reservationId)',
      ),
  ).action(async (reservationIds, options) => {
    const deleted = []
    for (let index = 0; index < reservationIds.length; index += 1) {
      const reservationId = reservationIds[index]
      try {
        await api.del(`/api/reservations/${reservationId}`)
        deleted.push(reservationId)
        if (!options.json) {
          console.log(`deleted ${reservationId}`)
        }
      } catch (error) {
        fail(error, { json: options.json })
      }
    }
    if (options.json) {
      printJson({ ok: deleted.length === reservationIds.length, deleted })
    }
  })

  return command
}

export default reservationsCommand
