import { createElement, type SVGAttributes } from 'react'

// A tiny, safe description of an SVG icon: a list of shapes. We never store or show raw SVG text,
// so an uploaded file cannot contain scripts, links or anything surprising.
export type SvgNode = [tag: string, attrs: Record<string, string>]
export type SvgIconData = { viewBox: string; root: Record<string, string>; nodes: SvgNode[] }

const TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse'])
const SKIP_TAGS = new Set(['defs', 'title', 'desc', 'metadata', 'clippath', 'mask', 'symbol', 'namedview', 'sodipodi:namedview'])
const GEOMETRY = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points'])
const STYLE_ATTRS = new Set(['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform'])
const INHERITED = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity']
const SAFE_VALUE = /^[A-Za-z0-9\s.,+\-()#%]*$/
export const MAX_ICON_BYTES = 30000
const MAX_NODES = 300

class SvgError extends Error {}

function cleanValue(name: string, value: string): string | null {
  const v = value.trim()
  const max = name === 'd' || name === 'points' ? 24000 : 200
  if (v.length > max || !SAFE_VALUE.test(v)) return null
  if (name === 'fill' || name === 'stroke') return v === 'none' || v === 'currentColor' ? v : 'currentColor' // every colour becomes the task colour
  return v
}

function walk(el: Element, inherited: Record<string, string>, transform: string, out: SvgNode[], flags: { css: boolean; rootStroke: boolean }) {
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase()
    if (tag === 'style') {
      flags.css = true
      continue
    }
    if (SKIP_TAGS.has(tag)) continue
    if (child.getAttribute('display') === 'none') continue
    if (child.getAttribute('class')) flags.css = true

    const own: Record<string, string> = { ...inherited }
    for (const a of INHERITED) {
      const raw = child.getAttribute(a)
      if (raw !== null) {
        const v = cleanValue(a, raw)
        if (v !== null) own[a] = v
      }
    }
    const tr = child.getAttribute('transform')
    const nextTransform = [transform, tr && cleanValue('transform', tr) ? tr.trim() : ''].filter(Boolean).join(' ')

    if (tag === 'g' || tag === 'svg' || tag === 'a') {
      walk(child, own, nextTransform, out, flags)
      continue
    }
    if (!TAGS.has(tag)) continue
    const attrs: Record<string, string> = {}
    for (const a of GEOMETRY) {
      const raw = child.getAttribute(a)
      if (raw === null) continue
      const v = cleanValue(a, raw)
      if (v === null) throw new SvgError('This icon has something unusual in it, so I skipped it.')
      attrs[a] = v
    }
    if (tag === 'path' && !attrs.d) continue
    for (const [k, v] of Object.entries(own)) if (STYLE_ATTRS.has(k)) attrs[k] = v
    if (nextTransform) attrs.transform = nextTransform
    // invisible helper shapes (e.g. a transparent square behind the icon) are dropped
    const hasStroke = (attrs.stroke ?? (flags.rootStroke ? 'currentColor' : 'none')) !== 'none'
    if (attrs.fill === 'none' && !hasStroke) continue
    out.push([tag, attrs])
    if (out.length > MAX_NODES) throw new SvgError('This icon is too detailed.')
  }
}

/** Turn the text of an .svg file into safe icon data. Throws an Error with a friendly message. */
export function parseSvgIcon(text: string): SvgIconData {
  if (text.length > 400_000) throw new SvgError('That file is too big for an icon.')
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (!svg || svg.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new SvgError('That does not look like an SVG file.')

  const root: Record<string, string> = {}
  for (const a of INHERITED) {
    const raw = svg.getAttribute(a)
    if (raw === null) continue
    const v = cleanValue(a, raw)
    if (v !== null && ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule'].includes(a)) root[a] = v
  }

  let viewBox = (svg.getAttribute('viewBox') ?? '').trim().replace(/,/g, ' ').replace(/\s+/g, ' ')
  if (!/^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/.test(viewBox)) {
    const w = parseFloat(svg.getAttribute('width') ?? '')
    const h = parseFloat(svg.getAttribute('height') ?? '')
    viewBox = w > 0 && h > 0 ? `0 0 ${w} ${h}` : '0 0 24 24'
  }

  const nodes: SvgNode[] = []
  const flags = { css: false, rootStroke: Boolean(root.stroke && root.stroke !== 'none') }
  walk(svg, {}, '', nodes, flags)
  if (!nodes.length) {
    throw new SvgError(flags.css ? 'This icon is coloured with CSS styles. Export it again as plain shapes (no styles) and retry.' : 'I could not find any shapes in that file.')
  }
  const data = { viewBox, root, nodes }
  if (JSON.stringify(data).length > MAX_ICON_BYTES) throw new SvgError('This icon is too detailed (more than 30 KB).')
  return data
}

const camel = (k: string) => k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

/** Draws icon data. Always uses the text colour (currentColor), so it takes the task colour like every other icon. */
export function SvgGlyph({ data, size = 20, viewBox }: { data: { nodes: SvgNode[]; root?: Record<string, string>; viewBox?: string }; size?: number; viewBox?: string }) {
  const r = data.root ?? {}
  const rootProps: Record<string, string> = {}
  for (const [k, v] of Object.entries(r)) rootProps[camel(k)] = v
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox ?? data.viewBox ?? '0 0 24 24'}
      fill={r.fill ?? 'currentColor'}
      {...(rootProps as unknown as SVGAttributes<SVGSVGElement>)}
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      {data.nodes.map(([tag, attrs], i) => {
        const props: Record<string, string> = {}
        for (const [k, v] of Object.entries(attrs)) props[camel(k)] = v
        return createElement(tag, { key: i, ...props })
      })}
    </svg>
  )
}
