#!/usr/bin/env node
/* Copyright 2025 Hotelumo LLC */

import { existsSync, realpathSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import skillsCommand from '@monorepool/agentfirst/skillsCommand.js'
import { program } from 'commander'

import availabilityCommand from './availabilityCommand.js'
import dailyRatesCommand from './dailyRatesCommand.js'
import guestsCommand from './guestsCommand.js'
import hotelsCommand from './hotelsCommand.js'
import keysCommand from './keysCommand.js'
import loginCommand from './loginCommand.js'
import logoutCommand from './logoutCommand.js'
import packageJson from './package.json' with { type: 'json' }
import ratePlansCommand from './ratePlansCommand.js'
import reservationsCommand from './reservationsCommand.js'
import roomsCommand from './roomsCommand.js'
import roomTypesCommand from './roomTypesCommand.js'
import schemaCommand from './schemaCommand.js'
import signupCommand from './signupCommand.js'
import webhooksCommand from './webhooksCommand.js'

const cliDirectory = fileURLToPath(new URL('.', import.meta.url))

function isDirectRun() {
  return Boolean(
    process.argv[1] &&
    existsSync(process.argv[1]) &&
    import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href,
  )
}

program
  .name('hotelumo')
  .description(
    'hotelumo cli — manage the reservations, guests, rooms and rates' +
      ' of your hotels from the terminal',
  )
  .version(packageJson.version)
  .addCommand(signupCommand())
  .addCommand(loginCommand())
  .addCommand(logoutCommand())
  .addCommand(hotelsCommand())
  .addCommand(reservationsCommand())
  .addCommand(guestsCommand())
  .addCommand(roomsCommand())
  .addCommand(roomTypesCommand())
  .addCommand(ratePlansCommand())
  .addCommand(dailyRatesCommand())
  .addCommand(availabilityCommand())
  .addCommand(webhooksCommand())
  .addCommand(keysCommand())
  // baseDirectory must be this file's directory: the shared factory resolves
  // the bundled skills/ relative to it (dist/index.js → ../skills).
  .addCommand(skillsCommand({ baseDirectory: cliDirectory }))

// `schema` describes the assembled program, itself included, so it is added
// after every other command is registered and before parsing.
program.addCommand(schemaCommand(program))
if (isDirectRun()) program.parse(process.argv)

export default program
