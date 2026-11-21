/* Copyright 2025 Hotelumo LLC */

import { stripVTControlCharacters } from 'node:util'

import { fail, printJson } from '@monorepool/agentfirst/output.js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import api from '../request.js'
import roomBlocksCommand from '../roomBlocksCommand.js'

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

// Commander copies exitOverride and the output settings into a subcommand
// when it is created, so they are set on each subcommand: a missing required
// option then throws instead of exiting the test process.
const run = args => {
  const command = roomBlocksCommand().exitOverride()
  command.commands.forEach(subcommand =>
    subcommand.exitOverride().configureOutput({ writeErr: () => {} }),
  )
  return command.parseAsync(args, { from: 'user' })
}
const dates = ['--startDate', '2026-08-10', '--endDate', '2026-08-12']
const roomBlock = {
  _id: 'block',
  hotelId: 'hotel',
  roomId: 'room',
  startDate: '2026-08-10',
  endDate: '2026-08-12',
  type: 'OUT_OF_ORDER',
  note: 'Leaking shower',
  creationTime: '2026-07-01T00:00:00Z',
}
const humanLines = () =>
  console.log.mock.calls.map(args => args.map(stripVTControlCharacters))

it('lists exact hotel, room and night-window filters', async () => {
  api.get.mockResolvedValue([roomBlock])
  await run([
    'list',
    '--hotelId',
    'hotel',
    '--roomId',
    'room',
    '--from',
    '2026-08-01',
    '--to',
    '2026-09-01',
    '--json',
  ])
  expect(api.get).toHaveBeenCalledExactlyOnceWith(
    '/api/roomblocks?hotelId=hotel&roomId=room&from=2026-08-01&to=2026-09-01',
  )
  expect(printJson).toHaveBeenCalledExactlyOnceWith([roomBlock])
  expect(fail).not.toHaveBeenCalled()
})

it('omits absent filters rather than appending a query marker', async () => {
  api.get.mockResolvedValue([])
  await run(['list', '--json'])
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/roomblocks')
  expect(printJson).toHaveBeenCalledExactlyOnceWith([])
})

it.each(['get', 'read'])(
  'returns the complete raw record for %s --json',
  async action => {
    api.get.mockResolvedValue(roomBlock)
    await run([action, 'block', '--json'])
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/roomblocks/block')
    expect(printJson).toHaveBeenCalledExactlyOnceWith(roomBlock)
  },
)

it.each([false, true])(
  'blocks a room with explicit fields taking precedence, json=%j',
  async json => {
    api.post.mockResolvedValue(roomBlock)
    await run([
      'add',
      '--roomId',
      'room',
      ...dates,
      '--type',
      'PRIVATE_USE',
      '--note',
      'Owner stay',
      '--hotelId',
      'hotel',
      '--body',
      JSON.stringify({
        roomId: 'other',
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        type: 'OTHER',
        note: 'overridden',
        hotelId: 'other',
        _id: 'client-id',
      }),
      ...(json ? ['--json'] : []),
    ])
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/api/roomblocks', {
      _id: 'client-id',
      roomId: 'room',
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      type: 'PRIVATE_USE',
      note: 'Owner stay',
      hotelId: 'hotel',
    })
    expect(printJson).toHaveBeenCalledExactlyOnceWith(
      json ? { ok: true, id: 'block' } : roomBlock,
    )
  },
)

it('sends no type, note or hotel the caller did not give, and reads nothing first', async () => {
  api.post.mockResolvedValue(roomBlock)
  await run(['add', '--roomId', 'room', ...dates, '--json'])
  expect(api.get).not.toHaveBeenCalled()
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/api/roomblocks', {
    roomId: 'room',
    startDate: '2026-08-10',
    endDate: '2026-08-12',
  })
})

it.each([
  ['--roomId', ['--startDate', '2026-08-10', '--endDate', '2026-08-12']],
  ['--startDate', ['--roomId', 'room', '--endDate', '2026-08-12']],
  ['--endDate', ['--roomId', 'room', '--startDate', '2026-08-10']],
])('refuses an add without %s before any request', async (missing, args) => {
  await expect(run(['add', ...args, '--json'])).rejects.toMatchObject({
    code: 'commander.missingMandatoryOptionValue',
    message: expect.stringContaining(missing),
  })
  expect(api.post).not.toHaveBeenCalled()
})

it('reports a refused block as a failure, not a result', async () => {
  const error = Object.assign(
    new Error('This room has a reservation during these nights.'),
    { status: 409 },
  )
  api.post.mockRejectedValue(error)
  await run(['add', '--roomId', 'room', ...dates, '--json'])
  expect(fail).toHaveBeenCalledExactlyOnceWith(error, { json: true })
  expect(printJson).not.toHaveBeenCalled()
})

it.each([false, true])(
  'updates with a partial body and no hotel lookup, json=%j',
  async json => {
    const updated = { ...roomBlock, endDate: '2026-08-14' }
    api.put.mockResolvedValue(updated)
    await run([
      'update',
      'block',
      '--endDate',
      '2026-08-14',
      ...(json ? ['--json'] : []),
    ])
    expect(api.get).not.toHaveBeenCalled()
    expect(api.put).toHaveBeenCalledExactlyOnceWith('/api/roomblocks/block', {
      _id: 'block',
      endDate: '2026-08-14',
    })
    expect(printJson).toHaveBeenCalledExactlyOnceWith(
      json ? { ok: true, id: 'block' } : updated,
    )
  },
)

it('updates with path and explicit field precedence over the body', async () => {
  api.put.mockResolvedValue(roomBlock)
  await run([
    'update',
    'block',
    '--roomId',
    'room-two',
    ...dates,
    '--type',
    'OUT_OF_SERVICE',
    '--note',
    'Painting',
    '--hotelId',
    'hotel',
    '--body',
    JSON.stringify({
      _id: 'other',
      roomId: 'overridden',
      type: 'OTHER',
      note: 'overridden',
      hotelId: 'other',
      creationTime: 'kept',
    }),
    '--json',
  ])
  expect(api.put).toHaveBeenCalledExactlyOnceWith('/api/roomblocks/block', {
    _id: 'block',
    roomId: 'room-two',
    startDate: '2026-08-10',
    endDate: '2026-08-12',
    type: 'OUT_OF_SERVICE',
    note: 'Painting',
    hotelId: 'hotel',
    creationTime: 'kept',
  })
})

it('clears the note with an empty --note', async () => {
  api.put.mockResolvedValue({ ...roomBlock, note: '' })
  await run(['update', 'block', '--note', '', '--json'])
  expect(api.put).toHaveBeenCalledExactlyOnceWith('/api/roomblocks/block', {
    _id: 'block',
    note: '',
  })
})

it.each([
  ['add', '--roomId', 'room', ...dates],
  ['update', 'block'],
])('rejects malformed JSON before any write for %j', async (...args) => {
  await run([...args, '--body', '{', '--json'])
  expect(api.post).not.toHaveBeenCalled()
  expect(api.put).not.toHaveBeenCalled()
  expect(fail).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      message: expect.stringContaining('--body is not valid JSON:'),
    }),
    { json: true },
  )
})

it.each([['list'], ['get', 'block'], ['read', 'block']])(
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
  expect(api.del.mock.calls).toEqual([
    ['/api/roomblocks/one'],
    ['/api/roomblocks/two'],
  ])
  expect(printJson).toHaveBeenCalledExactlyOnceWith({
    ok: true,
    deleted: ['one', 'two'],
  })
})

it('reports partial deletion without including a failed ID', async () => {
  const error = new Error('synthetic deletion denied')
  api.del.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined)
  await run(['delete', 'one', 'two', '--json'])
  expect(api.del.mock.calls).toEqual([
    ['/api/roomblocks/one'],
    ['/api/roomblocks/two'],
  ])
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

it('prints an empty room block list', async () => {
  api.get.mockResolvedValue([])
  await run(['list'])
  expect(console.log).toHaveBeenCalledExactlyOnceWith('No room blocks found')
})

it('renders each block with its room, nights, type and the ID fallback', async () => {
  api.get.mockResolvedValue([
    roomBlock,
    {
      _id: 'short',
      roomId: 'room-two',
      startDate: '2026-08-31',
      endDate: '2026-09-01',
      type: 'PRIVATE_USE',
    },
    { _id: 'bare' },
  ])
  await run(['list'])
  expect(console.log.mock.calls).toEqual([
    ['Found 3 room block(s):'],
    ['1. room room — 2026-08-10 → 2026-08-12, 2 nights [OUT_OF_ORDER] (block)'],
    [
      '2. room room-two — 2026-08-31 → 2026-09-01, 1 night [PRIVATE_USE] (short)',
    ],
    ['3. bare (bare)'],
  ])
})

it('prints a missing room block in human mode', async () => {
  api.get.mockResolvedValue(null)
  await run(['read', 'block'])
  expect(console.log).toHaveBeenCalledExactlyOnceWith('Room block not found')
})

it('renders the nights up to the first free one without JSON', async () => {
  api.get.mockResolvedValue(roomBlock)
  await run(['read', 'block'])
  expect(humanLines()).toEqual([
    [],
    ['2026-08-10 → 2026-08-12'],
    ['block'],
    [],
    ['type  OUT_OF_ORDER'],
    ['roomId  room'],
    ['nights  2, free again on 2026-08-12'],
    ['note  Leaking shower'],
    ['hotelId  hotel'],
    ['created  2026-07-01T00:00:00Z'],
    [],
  ])
  expect(printJson).not.toHaveBeenCalled()
})

it.each([
  [{ _id: 'block' }, 'block'],
  [{ _id: 'block', startDate: '2026-08-10' }, '2026-08-10'],
  [
    { _id: 'block', startDate: '2026-08-10', endDate: 'soon' },
    '2026-08-10 → soon',
  ],
])('skips the nights it cannot count for %j', async (record, title) => {
  api.get.mockResolvedValue(record)
  await run(['read', 'block'])
  expect(humanLines()).toEqual([[], [title], ['block'], [], []])
})
