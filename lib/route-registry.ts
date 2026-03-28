export type ParseContext = {
  params:       Record<string, string | string[]>
  searchParams: Record<string, string | string[] | undefined>
  cookies:      Record<string, string>
}

type Entry<P> = {
  href:  (params: P) => string
  parse: (ctx: ParseContext) => P
}

type Exits = Record<string, (params: any) => string>

export function createRoute<P, E extends Exits>(config: {
  entry: Entry<P>
  exits: E
}) {
  return config
}
