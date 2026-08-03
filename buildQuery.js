/* Copyright 2025 Hotelumo LLC */

// Builds `?a=1&b=2` from an object, skipping null-ish/empty values.
module.exports = function buildQuery(parameters) {
  const searchParams = new URLSearchParams()

  Object.entries(parameters).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(name, value)
    }
  })

  const queryString = searchParams.toString()

  return queryString ? `?${queryString}` : ''
}
