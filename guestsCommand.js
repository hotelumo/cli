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

// Guests — the CRM directory. guests:read for list/get/read, guests:write
// for add/update/delete (hotelumo/api/handlers/guestsHandler.js).
function guestsCommand() {
  const command = new commander.Command('guests')
  command.description(
    'manage the guest directory of your hotels (guests:read / guests:write)',
  )

  withJson(
    command
      .command('list')
      .description('list guests (GET /api/guests)')
      .option('--hotelId <hotelId>', 'only guests of this hotel')
      .option('--email <email>', 'only guests with this exact email')
      .option('--ids <ids>', 'comma-separated list of guest ids')
      .option('--userId <userId>', 'only guests linked to this user')
      .option('--fields <fields>', 'comma-separated projection of fields'),
  ).action(async options => {
    try {
      const guests = await api.get(
        `/api/guests${buildQuery({
          hotelId: options.hotelId,
          email: options.email,
          _ids: options.ids,
          userId: options.userId,
          fields: options.fields,
        })}`,
      )

      if (options.json) {
        printJson(guests)
        return
      }

      if (guests.length === 0) {
        console.log('No guests found')
        return
      }

      console.log(`Found ${guests.length} guest(s):`)
      guests.forEach((guest, index) => {
        const contact = [guest.email, guest.phone].filter(Boolean).join(' · ')
        const name =
          guest.name ||
          [guest.firstName, guest.lastName].filter(Boolean).join(' ') ||
          guest._id
        console.log(
          `${index + 1}. ${name}${contact ? ` — ${contact}` : ''}` +
            ` (${guest._id})`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('get <guestId>')
      .description('raw JSON for one guest (GET /api/guests/:guestId)'),
  ).action(async (guestId, options) => {
    try {
      const guest = await api.get(`/api/guests/${guestId}`)
      printJson(guest)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('read <guestId>')
      .description('read one guest formatted for the terminal'),
  ).action(async (guestId, options) => {
    try {
      const guest = await api.get(`/api/guests/${guestId}`)
      if (options.json) {
        printJson(guest)
        return
      }
      if (!guest) {
        console.log('Guest not found')
        return
      }
      const name =
        guest.name ||
        [guest.firstName, guest.lastName].filter(Boolean).join(' ') ||
        guest._id
      console.log()
      console.log(bold(name))
      console.log(dim(guest._id))
      console.log()
      if (guest.email) console.log(`${cyan('email')}  ${guest.email}`)
      if (guest.phone) console.log(`${cyan('phone')}  ${guest.phone}`)
      if (guest.language) console.log(`${cyan('language')}  ${guest.language}`)
      if (guest.country) console.log(`${cyan('country')}  ${guest.country}`)
      if (guest.hotelId) console.log(`${cyan('hotelId')}  ${guest.hotelId}`)
      if (guest.creationTime) {
        console.log(`${cyan('created')}  ${guest.creationTime}`)
      }
      console.log()
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('add')
      .description('create a guest (POST /api/guests, fires guest.created)')
      .requiredOption('--hotelId <hotelId>', 'hotel the guest belongs to')
      .option('--firstName <firstName>', 'guest first name')
      .option('--lastName <lastName>', 'guest last name')
      .option('--email <email>', 'guest email')
      .option('--phone <phone>', 'guest phone number')
      .option('--language <language>', 'two-letter language code, e.g. en')
      .option('--country <country>', 'two-letter country code, e.g. IT')
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async options => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const guest = await api.post('/api/guests', {
        ...body,
        hotelId: options.hotelId,
        ...(options.firstName && { firstName: options.firstName }),
        ...(options.lastName && { lastName: options.lastName }),
        ...(options.email && { email: options.email }),
        ...(options.phone && { phone: options.phone }),
        ...(options.language && { language: options.language }),
        ...(options.country && { country: options.country }),
      })
      if (options.json) {
        printJson({ ok: true, id: guest._id })
        return
      }
      printJson(guest)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('update <guestId>')
      .description(
        'update a guest (PUT /api/guests/:guestId, fires guest.updated)',
      )
      .option(
        '--hotelId <hotelId>',
        "hotel the guest belongs to (defaults to the stored guest's hotel)",
      )
      .option('--firstName <firstName>', 'guest first name')
      .option('--lastName <lastName>', 'guest last name')
      .option('--email <email>', 'guest email')
      .option('--phone <phone>', 'guest phone number')
      .option('--language <language>', 'two-letter language code, e.g. en')
      .option('--country <country>', 'two-letter country code, e.g. IT')
      .option(
        '--body <json>',
        'extra JSON fields merged into the request body',
      ),
  ).action(async (guestId, options) => {
    try {
      const body = options.body ? parseBody(options.body) : {}
      const hotelId = await resolveHotelId(options, body, () =>
        api.get(`/api/guests/${guestId}`),
      )
      const guest = await api.put(`/api/guests/${guestId}`, {
        ...body,
        _id: guestId,
        ...(hotelId && { hotelId }),
        ...(options.firstName && { firstName: options.firstName }),
        ...(options.lastName && { lastName: options.lastName }),
        ...(options.email && { email: options.email }),
        ...(options.phone && { phone: options.phone }),
        ...(options.language && { language: options.language }),
        ...(options.country && { country: options.country }),
      })
      if (options.json) {
        printJson({ ok: true, id: guest._id })
        return
      }
      printJson(guest)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('delete <guestId...>')
      .description(
        'delete one or more guests by id (DELETE /api/guests/:guestId)',
      ),
  ).action(async (guestIds, options) => {
    const deleted = []
    for (let index = 0; index < guestIds.length; index += 1) {
      const guestId = guestIds[index]
      try {
        await api.del(`/api/guests/${guestId}`)
        deleted.push(guestId)
        if (!options.json) {
          console.log(`deleted ${guestId}`)
        }
      } catch (error) {
        fail(error, { json: options.json })
      }
    }
    if (options.json) {
      printJson({ ok: deleted.length === guestIds.length, deleted })
    }
  })

  return command
}

module.exports = guestsCommand
