/* Copyright 2025 Hotelumo LLC */

// Every hotelumo write needs a hotelId: the handlers read it from
// `response.locals.hotelId || request.query.hotelId || request.body.hotelId`
// and reject the request with `400 missing hotelId` when all three are
// empty — and they do that check *before* loading the record being updated,
// so an update cannot inherit it server-side.
//
// A key pinned to one hotel supplies it implicitly (response.locals wins);
// an organization-wide key or a browser session must send it. On update,
// when the caller passed no --hotelId, reuse the hotelId of the existing
// record — one extra read, which needs the matching `:read` scope.
module.exports = async function resolveHotelId(options, body, getExisting) {
  let hotelId = options.hotelId || body.hotelId

  if (!hotelId) {
    const existing = await getExisting()
    hotelId = existing?.hotelId
  }

  return hotelId
}
