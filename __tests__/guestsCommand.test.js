/* Copyright 2025 Hotelumo LLC */

import { stripVTControlCharacters } from 'node:util'

import { fail, printJson } from '@monorepool/agentfirst/output.js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import guestsCommand from '../guestsCommand.js'
import api from '../request.js'

vi.mock('../request.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() },
}))
vi.mock('@monorepool/agentfirst/output.js', async importOriginal => ({
  ...(await importOriginal()),
  printJson: vi.fn(),
  fail: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const run = args =>
  guestsCommand().exitOverride().parseAsync(args, { from: 'user' })
const contact = {
  firstName: 'Alex',
  lastName: 'Example',
  email: 'guest@example.test',
  phone: '+123',
  language: 'en',
  country: 'IT',
}
const contactOptions = Object.entries(contact).flatMap(([key, value]) => [
  `--${key}`,
  value,
])

it('lists exact hotel, contact, ID and projection filters without inventing pagination', async () => {
  const guests = [{ _id: 'one', firstName: 'Alex' }]
  api.get.mockResolvedValue(guests)
  await run([
    'list',
    '--hotelId',
    'hotel',
    '--email',
    'a+b@example.test',
    '--ids',
    'one,two',
    '--userId',
    'user',
    '--fields',
    'firstName,email',
    '--json',
  ])
  expect(api.get).toHaveBeenCalledExactlyOnceWith(
    '/api/guests?hotelId=hotel&email=a%2Bb%40example.test&_ids=one%2Ctwo&userId=user&fields=firstName%2Cemail',
  )
  expect(printJson).toHaveBeenCalledExactlyOnceWith(guests)
  expect(fail).not.toHaveBeenCalled()
})

it('omits absent filters rather than appending a query marker', async () => {
  api.get.mockResolvedValue([])
  await run(['list', '--json'])
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/guests')
  expect(printJson).toHaveBeenCalledExactlyOnceWith([])
})

it.each(['get', 'read'])(
  'returns the complete raw record for %s --json',
  async action => {
    const guest = { _id: 'one', ...contact }
    api.get.mockResolvedValue(guest)
    await run([action, 'one', '--json'])
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/guests/one')
    expect(printJson).toHaveBeenCalledExactlyOnceWith(guest)
  },
)

it.each([false, true])(
  'creates with explicit fields taking precedence, json=%j',
  async json => {
    const guest = { _id: 'created', hotelId: 'hotel', ...contact }
    api.post.mockResolvedValue(guest)
    await run([
      'add',
      '--hotelId',
      'hotel',
      ...contactOptions,
      '--body',
      JSON.stringify({
        hotelId: 'other',
        ...Object.fromEntries(
          Object.keys(contact).map(key => [key, 'overridden']),
        ),
        note: 'keep',
      }),
      ...(json ? ['--json'] : []),
    ])
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/api/guests', {
      hotelId: 'hotel',
      ...contact,
      note: 'keep',
    })
    expect(printJson).toHaveBeenCalledExactlyOnceWith(
      json ? { ok: true, id: 'created' } : guest,
    )
  },
)

it('does not invent optional contact fields on a minimal create', async () => {
  api.post.mockResolvedValue({ _id: 'created' })
  await run(['add', '--hotelId', 'hotel', '--json'])
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/api/guests', {
    hotelId: 'hotel',
  })
})

it.each([false, true])(
  'updates with path and explicit field precedence, json=%j',
  async json => {
    const guest = { _id: 'one', hotelId: 'body-hotel', ...contact }
    api.put.mockResolvedValue(guest)
    await run([
      'update',
      'one',
      ...contactOptions,
      '--body',
      JSON.stringify({
        _id: 'other',
        hotelId: 'body-hotel',
        ...Object.fromEntries(
          Object.keys(contact).map(key => [key, 'overridden']),
        ),
        note: 'keep',
      }),
      ...(json ? ['--json'] : []),
    ])
    expect(api.get).not.toHaveBeenCalled()
    expect(api.put).toHaveBeenCalledExactlyOnceWith('/api/guests/one', {
      ...guest,
      note: 'keep',
    })
    expect(printJson).toHaveBeenCalledExactlyOnceWith(
      json ? { ok: true, id: 'one' } : guest,
    )
  },
)

it('uses the explicit hotel option ahead of the body without reading the record', async () => {
  api.put.mockResolvedValue({ _id: 'one' })
  await run([
    'update',
    'one',
    '--hotelId',
    'chosen',
    '--body',
    '{"hotelId":"other"}',
    '--json',
  ])
  expect(api.get).not.toHaveBeenCalled()
  expect(api.put).toHaveBeenCalledExactlyOnceWith('/api/guests/one', {
    _id: 'one',
    hotelId: 'chosen',
  })
})

it('looks up the existing hotel exactly once when neither option nor body supplies it', async () => {
  api.get.mockResolvedValue({ hotelId: 'existing' })
  api.put.mockResolvedValue({ _id: 'one' })
  await run(['update', 'one', '--json'])
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/guests/one')
  expect(api.put).toHaveBeenCalledExactlyOnceWith('/api/guests/one', {
    _id: 'one',
    hotelId: 'existing',
  })
})

it('leaves a missing hotel to server validation without fabricating one', async () => {
  api.get.mockResolvedValue(null)
  api.put.mockResolvedValue({ _id: 'one' })
  await run(['update', 'one', '--json'])
  expect(api.put).toHaveBeenCalledExactlyOnceWith('/api/guests/one', {
    _id: 'one',
  })
})

it.each([
  ['add', '--hotelId', 'hotel'],
  ['update', 'one'],
])('rejects malformed JSON before any write for %j', async (...args) => {
  await run([...args, '--body', '{', '--json'])
  expect(api.post).not.toHaveBeenCalled()
  expect(api.put).not.toHaveBeenCalled()
  expect(api.get).not.toHaveBeenCalled()
  expect(fail).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      message: expect.stringContaining('--body is not valid JSON:'),
    }),
    { json: true },
  )
})

it('stops an update when the hotel lookup fails', async () => {
  const error = new Error('synthetic lookup denied')
  api.get.mockRejectedValue(error)
  await run(['update', 'one', '--json'])
  expect(api.put).not.toHaveBeenCalled()
  expect(fail).toHaveBeenCalledExactlyOnceWith(error, { json: true })
  expect(printJson).not.toHaveBeenCalled()
})

it.each([['list'], ['get', 'one'], ['read', 'one']])(
  'preserves read failures for %j',
  async (...args) => {
    const error = Object.assign(new Error('synthetic denied'), { status: 403 })
    api.get.mockRejectedValue(error)
    await run([...args, '--json'])
    expect(fail).toHaveBeenCalledExactlyOnceWith(error, { json: true })
    expect(printJson).not.toHaveBeenCalled()
  },
)

it('deletes each requested ID and reports all successes', async () => {
  await run(['delete', 'one', 'two', '--json'])
  expect(api.del.mock.calls).toEqual([['/api/guests/one'], ['/api/guests/two']])
  expect(printJson).toHaveBeenCalledExactlyOnceWith({
    ok: true,
    deleted: ['one', 'two'],
  })
})

it('reports partial deletion without including a failed ID', async () => {
  const error = new Error('synthetic deletion denied')
  api.del.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined)
  await run(['delete', 'one', 'two', '--json'])
  expect(api.del.mock.calls).toEqual([['/api/guests/one'], ['/api/guests/two']])
  expect(fail).toHaveBeenCalledExactlyOnceWith(error, { json: true })
  expect(printJson).toHaveBeenCalledExactlyOnceWith({
    ok: false,
    deleted: ['two'],
  })
})

it('prints human deletion results without JSON', async () => {
  await run(['delete', 'one', 'two'])
  expect(console.log.mock.calls).toEqual([['deleted one'], ['deleted two']])
  expect(printJson).not.toHaveBeenCalled()
})

it('prints an empty guest list', async () => {
  api.get.mockResolvedValue([])
  await run(['list'])
  expect(console.log).toHaveBeenCalledExactlyOnceWith('No guests found')
})

it('renders name precedence, contact details and the ID fallback', async () => {
  api.get.mockResolvedValue([
    { _id: 'one', name: 'Display Name', ...contact },
    { _id: 'two', firstName: 'Alex', lastName: 'Example' },
    { _id: 'three' },
  ])
  await run(['list'])
  expect(console.log.mock.calls).toEqual([
    ['Found 3 guest(s):'],
    ['1. Display Name — guest@example.test · +123 (one)'],
    ['2. Alex Example (two)'],
    ['3. three (three)'],
  ])
})

it('prints a missing guest in human mode', async () => {
  api.get.mockResolvedValue(null)
  await run(['read', 'one'])
  expect(console.log).toHaveBeenCalledExactlyOnceWith('Guest not found')
})

it('renders all supplied guest details without JSON', async () => {
  api.get.mockResolvedValue({
    _id: 'one',
    ...contact,
    hotelId: 'hotel',
    creationTime: '2026-01-01T00:00:00Z',
  })
  await run(['read', 'one'])
  expect(
    console.log.mock.calls.map(args => args.map(stripVTControlCharacters)),
  ).toEqual([
    [],
    ['Alex Example'],
    ['one'],
    [],
    ['email  guest@example.test'],
    ['phone  +123'],
    ['language  en'],
    ['country  IT'],
    ['hotelId  hotel'],
    ['created  2026-01-01T00:00:00Z'],
    [],
  ])
  expect(printJson).not.toHaveBeenCalled()
})

it.each([
  { _id: 'one' },
  { _id: 'one', name: 'Display Name', firstName: 'Ignored' },
])('uses display-name or ID fallback for %j', async guest => {
  api.get.mockResolvedValue(guest)
  await run(['read', 'one'])
  expect(
    console.log.mock.calls.map(args => args.map(stripVTControlCharacters)),
  ).toEqual([[], [guest.name || 'one'], ['one'], [], []])
})
