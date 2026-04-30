/**
 * Converts plain HTML content into WordPress Gutenberg block format.
 *
 * Gutenberg blocks use HTML comments as delimiters, e.g.:
 *   <!-- wp:paragraph -->
 *   <p>Hello World</p>
 *   <!-- /wp:paragraph -->
 *
 * This converter handles: paragraphs, headings (h1-h6), blockquotes,
 * tables, lists (ul/ol), images, and separators (hr).
 * Any unrecognised top-level HTML is wrapped in an `html` block.
 */

/**
 * Convert raw HTML string to Gutenberg block markup.
 *
 * The approach:
 *  1. Split the HTML into top-level block elements using a regex that
 *     identifies opening tags at the root level.
 *  2. Wrap each element with the corresponding Gutenberg block comment.
 *  3. Join everything back together with blank lines (Gutenberg standard).
 */
export function convertToGutenberg(html: string): string {
  if (!html || !html.trim()) return ''

  // Normalise line-endings and trim
  let cleaned = html.replace(/\r\n/g, '\n').trim()

  // Split into top-level block elements.
  // We match opening tags for block-level elements and capture everything
  // until the corresponding closing tag (including nested same-tags via a
  // non-greedy strategy — works well for the expected AI output which is
  // shallow).
  const blockPattern =
    /(<(p|h[1-6]|blockquote|table|ul|ol|figure|hr|div)(?:\s[^>]*)?>[\s\S]*?<\/\2>|<hr\s*\/?>)/gi

  const blocks: string[] = []
  let lastIndex = 0

  // Use matchAll to iterate over all top-level block elements
  const matches = [...cleaned.matchAll(new RegExp(blockPattern.source, 'gi'))]

  for (const match of matches) {
    // Capture any stray text between blocks
    if (match.index !== undefined && match.index > lastIndex) {
      const gap = cleaned.slice(lastIndex, match.index).trim()
      if (gap) {
        // Wrap stray inline text in a paragraph block
        blocks.push(wrapBlock('paragraph', `<p>${gap}</p>`))
      }
    }
    blocks.push(convertElement(match[0], match[2]?.toLowerCase() || ''))
    lastIndex = (match.index ?? 0) + match[0].length
  }

  // Handle any trailing content after the last match
  if (lastIndex < cleaned.length) {
    const trailing = cleaned.slice(lastIndex).trim()
    if (trailing) {
      blocks.push(wrapBlock('paragraph', `<p>${trailing}</p>`))
    }
  }

  // If the regex matched nothing (e.g. plain text with no tags), wrap the
  // whole thing in a single paragraph block.
  if (blocks.length === 0) {
    blocks.push(wrapBlock('paragraph', `<p>${cleaned}</p>`))
  }

  return blocks.join('\n\n')
}

/**
 * Convert a single top-level HTML element to a Gutenberg block.
 */
function convertElement(outerHtml: string, tagName: string): string {
  switch (tagName) {
    case 'p':
      return wrapBlock('paragraph', outerHtml)

    case 'h1':
      return wrapBlock('heading', outerHtml, { level: 1 })
    case 'h2':
      return wrapBlock('heading', outerHtml, { level: 2 })
    case 'h3':
      return wrapBlock('heading', outerHtml, { level: 3 })
    case 'h4':
      return wrapBlock('heading', outerHtml, { level: 4 })
    case 'h5':
      return wrapBlock('heading', outerHtml, { level: 5 })
    case 'h6':
      return wrapBlock('heading', outerHtml, { level: 6 })

    case 'blockquote':
      return wrapBlock('quote', outerHtml)

    case 'table':
      return wrapBlock('table', wrapTableForGutenberg(outerHtml))

    case 'ul':
      return wrapBlock('list', outerHtml)

    case 'ol':
      return wrapBlock('list', outerHtml, { ordered: true })

    case 'figure':
      return wrapBlock('image', outerHtml)

    case 'hr':
      return wrapBlock('separator', '<hr class="wp-block-separator has-alpha-channel-opacity"/>')

    default:
      // Fallback: wrap in a raw HTML block
      return wrapBlock('html', outerHtml)
  }
}

/**
 * Wrap content with Gutenberg block comment delimiters.
 *
 * @param blockName - The Gutenberg block name (without `wp:` prefix).
 * @param innerHTML - The HTML content to place inside the block.
 * @param attrs     - Optional JSON attributes for the block opening comment.
 */
function wrapBlock(blockName: string, innerHTML: string, attrs?: Record<string, any>): string {
  const attrStr = attrs ? ` ${JSON.stringify(attrs)}` : ''
  return `<!-- wp:${blockName}${attrStr} -->\n${innerHTML}\n<!-- /wp:${blockName} -->`
}

/**
 * Wrap a <table> element with Gutenberg's expected figure wrapper.
 * Gutenberg stores tables inside:
 *   <figure class="wp-block-table"><table>...</table></figure>
 */
function wrapTableForGutenberg(tableHtml: string): string {
  // If it's already wrapped in a figure, return as-is
  if (tableHtml.trim().startsWith('<figure')) return tableHtml
  return `<figure class="wp-block-table">${tableHtml}</figure>`
}
