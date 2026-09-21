const PALETTE = [
  '#D83131',
  '#31D831',
  '#3131D8',
  '#D8D831',
  '#D86931',
  '#D8A031',
  '#A0D831',
  '#69D831',
  '#31D869',
  '#31D8A0',
  '#31D8D8',
  '#31A0D8',
  '#3169D8',
  '#6931D8',
  '#A031D8',
  '#D831D8',
  '#D831A0',
  '#D83169',
]

const HUES = [0, 120, 240, 60, 20, 40, 80, 100, 140, 160, 180, 200, 220, 260, 280, 300, 320, 340]

const MIN_HUE_DISTANCE = 40

function stringHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0
  }
  return hash
}

function mixHash(value: number): number {
  let h = value
  h ^= h >>> 16
  h = Math.imul(h, -0x7ee3623b)
  h ^= h >>> 13
  h = Math.imul(h, -0x3b314601)
  h ^= h >>> 16
  return h
}

function preferredIndex(id: string): number {
  return Math.abs(mixHash(stringHash(id))) % PALETTE.length
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return Math.min(diff, 360 - diff)
}

export function resolveColors(ids: string[]): Map<string, string> {
  const validIds = [...new Set(ids.filter((id) => id !== ''))].sort()
  const used: number[] = []
  const result = new Map<string, string>()

  for (const id of validIds) {
    let index = preferredIndex(id)
    let attempts = 0
    while (
      used.some((usedIndex) => hueDistance(HUES[usedIndex], HUES[index]) < MIN_HUE_DISTANCE) &&
      attempts < PALETTE.length
    ) {
      index = (index + 1) % PALETTE.length
      attempts++
    }
    used.push(index)
    result.set(id, PALETTE[index])
  }
  return result
}

export function colorFor(colors: Map<string, string>, id: string): string {
  return colors.get(id) ?? PALETTE[preferredIndex(id)]
}
