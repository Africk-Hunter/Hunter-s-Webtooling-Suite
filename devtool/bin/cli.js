#!/usr/bin/env node
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { shouldCopy } from './copy-filter.js'

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
const bundled = join(pkgRoot, 'templates')
const templatesDir = existsSync(bundled) ? bundled : join(pkgRoot, '..', 'Site Templates')

function listTemplates() {
  if (!existsSync(templatesDir)) return []
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(templatesDir, entry.name, 'package.json')))
    .map((entry) => entry.name)
}

function install(name, target) {
  cpSync(join(templatesDir, name), target, { recursive: true, filter: shouldCopy })
  const pkgPath = join(target, 'package.json')
  const json = JSON.parse(readFileSync(pkgPath, 'utf8'))
  json.name = target.split(/[\/]/).pop()
  for (const key of ['dependencies', 'devDependencies']) {
    if (json[key]?.['webtool-devtool']) json[key]['webtool-devtool'] = `^${pkg.version}`
  }
  writeFileSync(pkgPath, JSON.stringify(json, null, 2) + '\n')
}

async function init() {
  const templates = listTemplates()
  if (!templates.length) {
    console.log('No templates found.')
    return
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  console.log('Site templates:')
  templates.forEach((name, i) => console.log(`  ${i + 1}) ${name}`))
  const answer = await rl.question('Pick one or more (e.g. 1,2), or press Enter to skip: ')
  const picks = answer.split(/[\s,]+/).filter(Boolean).map((n) => templates[Number(n) - 1])
  for (const name of picks) {
    if (!name) {
      console.log('Skipping an invalid choice.')
      continue
    }
    const dir = (await rl.question(`Folder for ${name} [./${name}]: `)).trim() || name
    const target = resolve(dir)
    if (existsSync(target) && readdirSync(target).length) {
      console.log(`Skipped ${name}: ${target} is not empty.`)
      continue
    }
    install(name, target)
    console.log(`Created ${target}\n  cd ${dir} && npm install && npm run dev`)
  }
  rl.close()
}

function add(name, dir = name) {
  if (!listTemplates().includes(name)) {
    console.log(`Unknown template "${name}". Available: ${listTemplates().join(', ')}`)
    process.exitCode = 1
    return
  }
  const target = resolve(dir)
  if (existsSync(target) && readdirSync(target).length) {
    console.log(`Skipped ${name}: ${target} is not empty.`)
    process.exitCode = 1
    return
  }
  install(name, target)
  console.log(`Created ${target}`)
}

const [command, ...args] = process.argv.slice(2)
if (!command || command === 'init') await init()
else if (command === 'list') listTemplates().forEach((name) => console.log(name))
else if (command === 'add' && args[0]) add(args[0], args[1])
else {
  console.log('Usage: npx webtool-devtool [init | list | add <template> [folder]]')
  process.exitCode = 1
}
