/* eslint-disable  @typescript-eslint/no-var-requires,  @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-explicit-any */

import path from 'path'
import { execSync } from 'child_process'
import touch from 'touch'
import fs from 'fs-extra'
import chalk from 'chalk'

const Promake = require('promake')

const promake = new Promake()

process.chdir(__dirname)
const pathDelimiter = /^win/.test(process.platform) ? ';' : ':'
const npmBin = execSync(`npm bin`)
  .toString('utf8')
  .trim()
process.env.PATH = process.env.PATH
  ? `${npmBin}${pathDelimiter}${process.env.PATH}`
  : npmBin

const { rule, task, exec, cli } = promake

const spawn = (command: string, args?: Array<string>, options?: any) => {
  if (!Array.isArray(args)) {
    options = args
    args = []
  }
  if (!args) args = []
  if (!options) options = {}
  return promake.spawn(command, args, {
    stdio: 'inherit',
    ...options,
  })
}

function remove(path: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.error(
    chalk.gray('$'),
    chalk.gray('rm'),
    chalk.gray('-rf'),
    chalk.gray(path)
  ) // eslint-disable-line no-console
  return fs.remove(path)
}

rule('node_modules', ['package.json', 'yarn.lock'], async () => {
  await exec('yarn --ignore-scripts')
  await touch('node_modules')
})

function env /* ...names */() /* : {[name: string]: ?string} */ {
  /* : Array<string> */
  return {
    ...process.env,
    //...require('defaultenv')(names.map(name => `env/${name}.js`), {noExport: true}),
    ...require('defaultenv')([], { noExport: true }),
  }
}

const cleanTask = task('clean', () => remove(path.resolve('lib'))).description(
  'remove build output'
)

const buildJSTask = task('build:js', ['node_modules'], () =>
  spawn('babel', [
    'src',
    '--out-dir',
    'lib',
    '--extensions',
    '.ts,.tsx',
    '--source-maps',
    'inline',
  ])
)

const buildTypesTask = task('build:types', ['node_modules'], () =>
  spawn('tsc', ['--emitDeclarationOnly', '-p', 'src'])
)

// Just transpile from src to lib
task('build', [cleanTask, buildJSTask, buildTypesTask])

task('types', 'node_modules', () => spawn('tsc', ['--noEmit'])).description(
  'check files with TypeScript'
)

const lintFiles = ['run.ts', 'src/**/*.ts', 'test/**/*.js', 'test/**/*.ts']

task('lint', ['node_modules'], () =>
  spawn('eslint', [...lintFiles, '--cache'])
).description('check files with eslint')
task('lint:fix', 'node_modules', () =>
  spawn('eslint', ['--fix', ...lintFiles, '--cache'])
).description('fix eslint errors automatically')
task('lint:watch', 'node_modules', () =>
  spawn('esw', ['-w', ...lintFiles, '--changed', '--cache'])
).description('run eslint in watch mode')

function testRecipe(options: {
  unit?: boolean
  integration?: boolean
  coverage?: boolean
  watch?: boolean
  debug?: boolean
}): (rule: { args: Array<string> }) => Promise<void> {
  const { unit, integration, coverage, watch, debug } = options
  const args = ['./test/configure.js']
  if (watch) args.push('./test/clearConsole.js')

  if (unit) args.push('./test/unit/**/*.ts')
  if (integration) args.push('./test/integration/**/*.ts')
  if (watch) args.push('--watch')
  if (debug) args.push('--inspect-brk')
  let command = 'mocha'
  if (coverage) {
    args.unshift('--reporter=lcov', '--reporter=text', command)
    command = 'nyc'
  }

  return rule =>
    spawn(command, [...args, ...rule.args], {
      env: {
        BABEL_ENV: coverage ? 'coverage' : 'test',
        ...env(),
      },
      stdio: 'inherit',
    })
}

for (const coverage of [false, true]) {
  const prefix = coverage ? 'coverage' : 'test'
  for (const watch of coverage ? [false] : [false, true]) {
    for (const debug of watch ? [false] : [false, true]) {
      const suffix = watch ? ':watch' : debug ? ':debug' : ''
      task(
        `${prefix}${suffix}`,
        ['node_modules'],
        testRecipe({ unit: true, coverage, watch, debug })
      ).description(
        `run unit tests${coverage ? ' with code coverage' : ''}${
          watch ? ' in watch mode' : ''
        }${debug ? ' in debug mode' : ''}`
      )
      task(
        `${prefix}:all${suffix}`,
        ['node_modules'],
        testRecipe({ unit: true, integration: true, coverage, watch, debug })
      ).description(
        `run all tests${coverage ? ' with code coverage' : ''}${
          watch ? ' in watch mode' : ''
        }${debug ? ' in debug mode' : ''}`
      )
    }
  }
}

for (const fix of [false, true]) {
  task(fix ? 'prep' : 'check', [
    task(`lint${fix ? ':fix' : ''}`),
    task('types'),
    task('test'),
  ]).description(
    `run all checks${fix ? ', automatic fixes,' : ''} and unit tests`
  )
}

task('open:coverage', () => {
  require('opn')('coverage/lcov-report/index.html')
}).description('open test coverage output')

cli()
