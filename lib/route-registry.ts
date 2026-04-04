export type ParseContext = {
  params:       Record<string, string | string[]>
  searchParams: Record<string, string | string[] | undefined>
  cookies:      Record<string, string>
}

export type Entry<P> = {
  href:  (params: P) => string
  parse: (ctx: ParseContext) => P
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExitFn = (...args: any[]) => string

export type Route<P = unknown, E extends Record<string, ExitFn> = Record<string, ExitFn>> = {
  readonly entry: Entry<P>
  readonly exits: { readonly [K in keyof E]: E[K] }
}

export function createRoute<P, E extends Record<string, ExitFn>>(config: {
  entry: Entry<P>
  exits: E
}): Route<P, E> {
  return config
}
