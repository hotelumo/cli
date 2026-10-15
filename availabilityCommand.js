/* Copyright 2025 Hotelumo LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import buildQuery from './buildQuery.js'
import parseBody from './parseBody.js'
import api from './request.js'

// The booking-engine pair: what is bookable for a stay, and the request that
// books it. `check` needs rates:read, `book` needs reservations:write
// (hotelumo/api/handlers/availabilityHandler.js).
//
// `book` creates a REQUESTED reservation with one unassigned PENDING room
// for hotel staff to approve — it is not a confirmed stay until
// `hotelumo reservations approve <reservationId>` runs.
function availabilityCommand() {
  const command = new commander.Command('availability')
  command.description(
    'query what is bookable for a stay, and request a booking (rates:read / reservations:write)',
  )

  withJson(
    command
      .command('check <hotelId>')
      .description(
        'list the bookable offers for a stay (GET /api/hotels/:hotelId/availability)',
      )
      .requiredOption('--checkInDate <date>', 'YYYY-MM-DD arrival date')
      .requiredOption(
        '--checkOutDate <date>',
        'YYYY-MM-DD departure date (exclusive)',
      )
      .option('--adults <adults>', 'number of adults (default 2)')
      .option('--children <children>', 'number of children (default 0)')
      .option('--infants <infants>', 'number of infants (default 0)'),
  ).action(async (hotelId, options) => {
    try {
      const availability = await api.get(
        `/api/hotels/${hotelId}/availability${buildQuery({
          checkInDate: options.checkInDate,
          checkOutDate: options.checkOutDate,
          adults: options.adults,
          children: options.children,
          infants: options.infants,
        })}`,
      )

      if (options.json) {
        printJson(availability)
        return
      }

      const offers = availability?.offers || []

      if (offers.length === 0) {
        console.log('No offers available for this stay')
        return
      }

      console.log(`${availability.nights} night(s), ${offers.length} offer(s):`)
      offers.forEach((offer, index) => {
        console.log(
          `${index + 1}. ${offer.roomType?.name || offer.roomType?._id}` +
            ` · ${offer.ratePlan?.title || offer.ratePlan?._id}` +
            ` — total ${offer.totalPrice}${offer.currency ? ` ${offer.currency}` : ''}` +
            ` · ${offer.availableRooms} room(s) left`,
        )
        console.log(
          `   roomTypeId ${offer.roomType?._id} · ratePlanId ${offer.ratePlan?._id}`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('book <hotelId>')
      .description(
        'request a reservation for one offer (POST /api/hotels/:hotelId/book-reservation)',
      )
      .requiredOption('--roomTypeId <roomTypeId>', 'room type of the offer')
      .requiredOption('--ratePlanId <ratePlanId>', 'rate plan of the offer')
      .requiredOption('--checkInDate <date>', 'YYYY-MM-DD arrival date')
      .requiredOption(
        '--checkOutDate <date>',
        'YYYY-MM-DD departure date (exclusive)',
      )
      .requiredOption('--name <name>', 'guest full name')
      .requiredOption('--email <email>', 'guest email')
      .requiredOption('--phone <phone>', 'guest phone number')
      .requiredOption(
        '--quotedTotal <quotedTotal>',
        "the offer's totalPrice, in minor currency units — the API rejects the request if it no longer matches",
      )
      .requiredOption(
        '--quotedCurrency <quotedCurrency>',
        "the offer's currency, e.g. EUR",
      )
      .option('--adults <adults>', 'number of adults (default 2)')
      .option('--children <children>', 'number of children (default 0)')
      .option('--infants <infants>', 'number of infants (default 0)')
      .option('--note <note>', 'free-text note for the hotel')
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async (hotelId, options) => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const reservation = await api.post(
        `/api/hotels/${hotelId}/book-reservation`,
        {
          ...body,
          roomTypeId: options.roomTypeId,
          ratePlanId: options.ratePlanId,
          checkInDate: options.checkInDate,
          checkOutDate: options.checkOutDate,
          name: options.name,
          email: options.email,
          phone: options.phone,
          quotedTotal: Number.parseInt(options.quotedTotal, 10),
          quotedCurrency: options.quotedCurrency,
          ...(options.adults && {
            adults: Number.parseInt(options.adults, 10),
          }),
          ...(options.children && {
            children: Number.parseInt(options.children, 10),
          }),
          ...(options.infants && {
            infants: Number.parseInt(options.infants, 10),
          }),
          ...(options.note && { note: options.note }),
        },
      )

      if (options.json) {
        printJson({
          ok: true,
          id: reservation?._id,
          status: reservation?.status,
        })
        return
      }

      printJson(reservation)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

export default availabilityCommand
