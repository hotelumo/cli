/* Copyright 2025 Hotelumo LLC */

import { stripVTControlCharacters } from 'node:util'

import { fail, printJson } from '@monorepool/agentfirst/output.js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import api from '../request.js'
import roomsCommand from '../roomsCommand.js'

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
  roomsCommand().exitOverride().parseAsync(args, { from: 'user' })
const writes = {
  add: {
    args: ['add', '--hotelId', 'hotel'],
    method: 'post',
    path: '/api/rooms',
  },
  update: {
    args: ['update', 'combined', '--hotelId', 'hotel'],
    method: 'put',
    path: '/api/rooms/combined',
    body: { _id: 'combined' },
  },
}

it.each(Object.keys(writes))(
  '%s sends --componentRoomIds as a trimmed list of room ids',
  async action => {
    const { args, method, path, body } = writes[action]
    api[method].mockResolvedValue({ _id: 'combined' })
    await run([...args, '--componentRoomIds', ' one, two,,three ', '--json'])
    expect(api[method]).toHaveBeenCalledExactlyOnceWith(path, {
      ...body,
      hotelId: 'hotel',
      componentRoomIds: ['one', 'two', 'three'],
    })
    expect(printJson).toHaveBeenCalledExactlyOnceWith({
      ok: true,
      id: 'combined',
    })
    expect(fail).not.toHaveBeenCalled()
  },
)

it.each(Object.keys(writes))(
  '%s sends an empty list for --componentRoomIds "", making an ordinary room',
  async action => {
    const { args, method, path, body } = writes[action]
    api[method].mockResolvedValue({ _id: 'combined' })
    await run([...args, '--componentRoomIds', '', '--json'])
    expect(api[method]).toHaveBeenCalledExactlyOnceWith(path, {
      ...body,
      hotelId: 'hotel',
      componentRoomIds: [],
    })
  },
)

it.each(Object.keys(writes))(
  '%s leaves the parts of a room alone without --componentRoomIds',
  async action => {
    const { args, method, path, body } = writes[action]
    api[method].mockResolvedValue({ _id: 'combined' })
    await run([...args, '--json'])
    expect(api[method]).toHaveBeenCalledExactlyOnceWith(path, {
      ...body,
      hotelId: 'hotel',
    })
  },
)

it('lets --componentRoomIds win over the same field in --body', async () => {
  api.put.mockResolvedValue({ _id: 'combined' })
  await run([
    'update',
    'combined',
    '--hotelId',
    'hotel',
    '--body',
    '{"componentRoomIds":["body"]}',
    '--componentRoomIds',
    'one,two',
    '--json',
  ])
  expect(api.put).toHaveBeenCalledExactlyOnceWith('/api/rooms/combined', {
    _id: 'combined',
    hotelId: 'hotel',
    componentRoomIds: ['one', 'two'],
  })
})

it('shows what a combined room is made of in the list', async () => {
  api.get.mockResolvedValue([
    {
      _id: 'combined',
      number: '1+2',
      status: 'AVAILABLE',
      housekeepingStatus: 'CLEAN',
      componentRoomIds: ['one', 'two'],
    },
    { _id: 'one', number: '1', status: 'AVAILABLE', componentRoomIds: [] },
    { _id: 'bare' },
  ])
  await run(['list'])
  expect(console.log.mock.calls).toEqual([
    ['Found 3 room(s):'],
    ['1. 1+2 — AVAILABLE · CLEAN · combined from one, two (combined)'],
    ['2. 1 — AVAILABLE (one)'],
    ['3. bare (bare)'],
  ])
})

it('shows what a combined room is made of when reading it', async () => {
  api.get.mockResolvedValue({
    _id: 'combined',
    number: '1+2',
    roomTypeId: 'family',
    componentRoomIds: ['one', 'two'],
    hotelId: 'hotel',
  })
  await run(['read', 'combined'])
  expect(
    console.log.mock.calls.map(args => args.map(stripVTControlCharacters)),
  ).toEqual([
    [],
    ['1+2'],
    ['combined'],
    [],
    ['roomTypeId  family'],
    ['combined from  one, two'],
    ['hotelId  hotel'],
    [],
  ])
})
