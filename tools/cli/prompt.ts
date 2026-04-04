import * as readline from 'readline'

export function prompt(question: string, defaultValue: boolean): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const hint = defaultValue ? '[Y/n]' : '[y/N]'

  return new Promise((resolve) => {
    rl.question(`${question} ${hint} `, (answer) => {
      rl.close()
      const trimmed = answer.trim().toLowerCase()
      if (trimmed === '') resolve(defaultValue)
      else resolve(trimmed === 'y' || trimmed === 'yes')
    })
  })
}
