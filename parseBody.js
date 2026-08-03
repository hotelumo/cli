/* Copyright 2025 Hotelumo LLC */

// Parses a --body '<json>' option value, with a friendlier error than
// JSON.parse's own.
module.exports = function parseBody(json) {
  try {
    return JSON.parse(json)
  } catch (error) {
    throw new Error(`--body is not valid JSON: ${error.message}`, {
      cause: error,
    })
  }
}
