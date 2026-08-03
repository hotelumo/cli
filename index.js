#!/usr/bin/env node
/* Copyright 2025 Hotelumo LLC */
const program = require('commander')
const skillsCommand = require('@monorepool/agentfirst/skillsCommand.js')
const availabilityCommand = require('./availabilityCommand.js')
const dailyRatesCommand = require('./dailyRatesCommand.js')
const guestsCommand = require('./guestsCommand.js')
const hotelsCommand = require('./hotelsCommand.js')
const keysCommand = require('./keysCommand.js')
const loginCommand = require('./loginCommand.js')
const logoutCommand = require('./logoutCommand.js')
const ratePlansCommand = require('./ratePlansCommand.js')
const reservationsCommand = require('./reservationsCommand.js')
const roomsCommand = require('./roomsCommand.js')
const roomTypesCommand = require('./roomTypesCommand.js')
const schemaCommand = require('./schemaCommand.js')
const signupCommand = require('./signupCommand.js')
const webhooksCommand = require('./webhooksCommand.js')
const packageJson = require('./package.json')

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
  .addCommand(skillsCommand({ baseDirectory: __dirname }))

// `schema` describes the assembled program, itself included, so it is added
// after every other command is registered and before parsing.
program.addCommand(schemaCommand(program))
program.parse(process.argv)
