/* Copyright 2025 Hotelumo LLC */

import { describe, expect, it, vi } from 'vitest'

import buildQuery from '../buildQuery.js'
import parseBody from '../parseBody.js'
import resolveHotelId from '../resolveHotelId.js'

describe('buildQuery', () => {
  it('omits absent values without dropping zero or false', () => {
    expect(
      buildQuery({
        missing: undefined,
        empty: '',
        absent: null,
        skip: 0,
        active: false,
      }),
    ).toBe('?skip=0&active=false')
  })
  it('encodes keys and values without accepting additional query parameters', () => {
    expect(
      buildQuery({
        'email address': 'owner+test@example.com',
        name: 'A&B=1',
        text: 'café',
      }),
    ).toBe(
      '?email+address=owner%2Btest%40example.com&name=A%26B%3D1&text=caf%C3%A9',
    )
  })
  it.each([{}, { a: '', b: undefined, c: null }])(
    'does not add a question mark for %j',
    parameters => {
      expect(buildQuery(parameters)).toBe('')
    },
  )
})

describe('parseBody', () => {
  it.each([
    [
      '{"name":"Jane","active":false,"count":0}',
      { name: 'Jane', active: false, count: 0 },
    ],
    ['[1,"two"]', [1, 'two']],
    ['null', null],
    ['false', false],
    ['0', 0],
    ['"text"', 'text'],
  ])('preserves valid JSON %s', (json, value) => {
    expect(parseBody(json)).toEqual(value)
  })
  it.each(['{', '{"trailing":1,}', 'undefined', ''])(
    'explains malformed --body %s and retains the parser error',
    json => {
      let failure
      try {
        parseBody(json)
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(Error)
      expect(failure.cause).toBeInstanceOf(SyntaxError)
      expect(failure.message).toBe(
        `--body is not valid JSON: ${failure.cause.message}`,
      )
    },
  )
})

describe('resolveHotelId', () => {
  it.each([
    [{ hotelId: 'flag' }, { hotelId: 'body' }, 'flag'],
    [{}, { hotelId: 'body' }, 'body'],
    [{ hotelId: '' }, { hotelId: 'body' }, 'body'],
  ])(
    'uses supplied hotel values without fetching the record',
    async (options, body, expected) => {
      const getExisting = vi.fn()
      expect(await resolveHotelId(options, body, getExisting)).toBe(expected)
      expect(getExisting).not.toHaveBeenCalled()
    },
  )
  it('reads the existing record exactly once when no hotel was supplied', async () => {
    const getExisting = vi.fn().mockResolvedValue({ hotelId: 'existing' })
    expect(await resolveHotelId({}, {}, getExisting)).toBe('existing')
    expect(getExisting).toHaveBeenCalledExactlyOnceWith()
  })
  it.each([undefined, null, {}])(
    'leaves missing hotel resolution to the API for %j',
    async record => {
      expect(await resolveHotelId({}, {}, async () => record)).toBeUndefined()
    },
  )
  it('propagates read failures instead of continuing a write', async () => {
    const failure = new Error('record unavailable')
    await expect(
      resolveHotelId({}, {}, async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
  })
})
