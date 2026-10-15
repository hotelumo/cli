/* Copyright 2025 Hotelumo LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import buildQuery from './buildQuery.js'
import { bold, cyan, dim } from './formatOutput.js'
import api from './request.js'

// Hotels are read-only here on purpose. A hotel is the per-tenant container
// created at signup and edited in the dashboard, so there is no `hotels`
// scope and no public write route worth wrapping.
//
// Auth asymmetry worth knowing before reading the code: GET /api/hotels
// (hotelumo/api/handlers/hotelsHandler.js) is guarded by withAccessToken
// alone, so it answers only to an operator session — `hotelumo login
// --browser`. A single hotel by id is reachable either way, which is what an
// API key needs: a key is already pinned to one organization, optionally to
// one hotel, and every other command takes the hotel id as a filter.
function hotelsCommand() {
  const command = new commander.Command('hotels')
  command.description('read the hotels of your organization (read-only)')

  withJson(
    command
      .command('list')
      .description(
        'list hotels (GET /api/hotels) — needs a browser session, not an API key',
      )
      .option('-n, --limit <limit>', 'max results')
      .option('--skip <skip>', 'skip the first N results')
      .option('--fields <fields>', 'comma-separated projection of fields'),
  ).action(async options => {
    try {
      const hotels = await api.get(
        `/api/hotels${buildQuery({
          limit: options.limit,
          skip: options.skip,
          fields: options.fields,
        })}`,
      )

      if (options.json) {
        printJson(hotels)
        return
      }

      if (hotels.length === 0) {
        console.log('No hotels found')
        return
      }

      console.log(`Found ${hotels.length} hotel(s):`)
      hotels.forEach((hotel, index) => {
        const place = [hotel.city, hotel.country].filter(Boolean).join(', ')
        console.log(
          `${index + 1}. ${hotel.name || hotel._id}` +
            `${place ? ` — ${place}` : ''} (${hotel._id})`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('get <hotelId>')
      .description('raw JSON for one hotel (GET /api/hotels/:hotelId)')
      .option('--fields <fields>', 'comma-separated projection of fields'),
  ).action(async (hotelId, options) => {
    try {
      const hotel = await api.get(
        `/api/hotels/${hotelId}${buildQuery({ fields: options.fields })}`,
      )
      printJson(hotel)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('read <hotelId>')
      .description('read one hotel formatted for the terminal'),
  ).action(async (hotelId, options) => {
    try {
      const hotel = await api.get(`/api/hotels/${hotelId}`)
      if (options.json) {
        printJson(hotel)
        return
      }
      if (!hotel) {
        console.log('Hotel not found')
        return
      }
      console.log()
      console.log(bold(hotel.name || hotel._id))
      console.log(dim(hotel._id))
      console.log()
      if (hotel.address) console.log(`${cyan('address')}  ${hotel.address}`)
      if (hotel.city) console.log(`${cyan('city')}  ${hotel.city}`)
      if (hotel.country) console.log(`${cyan('country')}  ${hotel.country}`)
      if (hotel.currency) console.log(`${cyan('currency')}  ${hotel.currency}`)
      if (hotel.timezone) console.log(`${cyan('timezone')}  ${hotel.timezone}`)
      if (hotel.checkInTime) {
        console.log(`${cyan('check-in')}  ${hotel.checkInTime}`)
      }
      if (hotel.checkOutTime) {
        console.log(`${cyan('check-out')}  ${hotel.checkOutTime}`)
      }
      if (hotel.creationTime) {
        console.log(`${cyan('created')}  ${hotel.creationTime}`)
      }
      console.log()
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

export default hotelsCommand
