/* Copyright 2025 Hotelumo LLC */

// Production Hotelumo API. Override with HOTELUMO_API_URL for staging/dev.
//
// Deliberately a three-line local module rather than `@hotelumo/client`: the
// client pulls in @monorepool/env, which carries the internal product roster,
// and none of that belongs in a published npm bundle.
export default function getApiUrl() {
  return process.env.HOTELUMO_API_URL || 'https://api.hotelumo.com'
}
