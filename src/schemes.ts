// @ts-expect-error to import flattenColorPalette without declaration
import flattenColorPalette from 'tailwindcss/lib/util/flattenColorPalette'
import { TailwindSchemesConfig } from './types'
import plugin from 'tailwindcss/plugin'
import { RecursiveKeyValuePair } from 'tailwindcss/types/config'

function _isHexColor(color: string): boolean {
  return /^#([0-9a-f]{3}){1,2}$/i.test(color)
}

function _isRGBColor(color: string): boolean {
  return /^rgb\(\s*(\d{1,3}\s*,\s*){2}\d{1,3}\s*\)$/.test(color)
}

function _canOpacitize(color: string): boolean {
  return _isHexColor(color) || _isRGBColor(color)
}

function _getRGB(color: string): string {
  if (_isHexColor(color)) {
    const rgb = color.replace(
      /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
      (_, r, g, b) => r + r + g + g + b + b
    )
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(rgb)
    if (result) {
      const [r, g, b] = result.slice(1).map((v) => parseInt(v, 16))
      return `${r}, ${g}, ${b}`
    }
  } else if (_isRGBColor(color)) {
    return color.slice(4, -1)
  }
  return color
}

function withOpacity(variableName: string, prefix: string) {
  return ({ opacityValue }: { opacityValue: string }) => {
    return opacityValue
      ? `rgba(var(--${prefix}-${variableName}), ${opacityValue})`
      : `rgb(var(--${prefix}-${variableName}))`
  }
}

function getSelectorKey(selector: TailwindSchemesConfig['selector'], scheme: string): string {
  return selector === 'class' ? `.${scheme}` : `[${selector}="${scheme}"]`
}

function getBaseVariables(colors: object, prefix: string) {
  const flattenedColors = flattenColorPalette(colors)
  return Object.fromEntries(
    Object.entries(flattenedColors).map(([key, value]) => [
      `--${prefix}-${key}`,
      _getRGB(value as string),
    ])
  )
}

function getColorEntries(colors: object, prefix: string) {
  const flattenedColors = flattenColorPalette(colors)
  return Object.fromEntries(
    Object.entries(flattenedColors).map(([key, value]) => [
      key,
      _canOpacitize(value as string) ? withOpacity(key, prefix) : `var(--${prefix}-${key})`,
    ])
  ) as RecursiveKeyValuePair<string, string>
}

export const schemes = plugin.withOptions<TailwindSchemesConfig>(
  // Add css variables
  ({ schemes = {}, selector = 'data-theme', prefix = 'tw-schemes' }) => {
    return ({ addBase }) => {
      if (schemes.root) {
        addBase({
          ':root': getBaseVariables(schemes.root, prefix),
        })
      }

      Object.entries(schemes).forEach(([schemeName, schemeColors]) => {
        // Ignore root
        if (schemeName === 'root') return
        addBase({
          [getSelectorKey(selector, schemeName)]: getBaseVariables(schemeColors as object, prefix),
        })
      })
    }
  },
  // Map the configuration keys to the above variables
  ({ schemes = {}, prefix = 'tw-schemes' }) => {
    let colors = {}

    if (typeof schemes.root === 'object') {
      colors = { ...colors, ...schemes.root }
    }

    Object.entries(schemes).forEach(([schemeName, schemeColors]) => {
      // Ignore root
      if (schemeName === 'root') return
      colors = { ...colors, ...getColorEntries(schemeColors as object, prefix) }
    })

    return { theme: { extend: { colors } } }
  }
)
