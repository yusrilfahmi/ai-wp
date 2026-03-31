'use server'

import * as cheerio from 'cheerio'

import { getSettings } from '@/app/actions/settings'
import { getActiveApiKey, getActiveWpSite, parseApiKeys, parseWpSites } from '@/lib/settings-parser'

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export async function scrapeUrlAction(url: string): Promise<{ text?: string; error?: string }> {
  const text = await scrapeWebText(url)
  return { text }
}

export async function translateFreeAction(text: string): Promise<{ translated?: string; error?: string }> {
  if (!text.trim()) return { error: 'Teks kosong' }
  try {
    // Dynamic import needed: @vitalets/google-translate-api is ESM-only
    const { translate } = await import('@vitalets/google-translate-api')

    // Split into chunks at paragraph boundaries to stay under Google's ~5000 char limit
    const CHUNK_SIZE = 4500
    const paragraphs = text.split('\n\n')
    const chunks: string[] = []
    let current = ''
    for (const para of paragraphs) {
      if ((current + '\n\n' + para).length > CHUNK_SIZE && current) {
        chunks.push(current.trim())
        current = para
      } else {
        current = current ? current + '\n\n' + para : para
      }
    }
    if (current.trim()) chunks.push(current.trim())

    const translatedChunks = await Promise.all(
      chunks.map(async (chunk) => {
        const result = await translate(chunk, { from: 'auto', to: 'id' })
        return result.text
      })
    )

    return { translated: translatedChunks.join('\n\n') }
  } catch (err: any) {
    console.error('[translateFreeAction] Error:', err)
    const msg = err?.message || 'Terjemahan gagal'
    if (msg.includes('429') || msg.includes('Too Many Requests')) {
      return { error: 'Rate limit Google Translate tercapai. Coba lagi dalam beberapa detik.' }
    }
    return { error: `Terjemahan gagal: ${msg}` }
  }
}

async function scrapeWebText(url: string): Promise<string> {
  if (!url || !url.startsWith('http')) return ''
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
      },
      signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) return `[Failed to fetch source: HTTP ${res.status}]`

    const html = await res.text()
    const $ = cheerio.load(html)

    // Aggressively remove noise: ads, nav, lists, related/share widgets
    $('script, style, nav, footer, header, aside, noscript, ul, ol, figure, figcaption').remove()
    $('[class*="ads"], [class*="advertisement"], [class*="sidebar"], [class*="related"], [class*="baca-juga"], [class*="read-more"], [class*="share"], [class*="tags"], [class*="promo"], [data-type="related"]').remove()

    // Try to find main article content using common selectors (ordered by specificity)
    const articleSelectors = [
      'article',
      '[class*="article-body"]',
      '[class*="article-content"]',
      '[class*="detail-content"]',
      '[class*="post-content"]',
      '[class*="entry-content"]',
      '[class*="content-detail"]',
      'main',
      '.content',
      '#content'
    ]

    let contentEl = $('')
    for (const selector of articleSelectors) {
      if ($(selector).length > 0) {
        contentEl = $(selector).first()
        break
      }
    }

    // Fall back to body if no specific container found
    const target = contentEl.length > 0 ? contentEl : $('body')

    // Promo/noise phrases common in Indonesian news sites
    const promoPatterns = [
      'baca juga', 'yuk gabung', 'klik di sini', 'simak video',
      'selengkapnya', 'baca selengkapnya', 'ikuti kami', 'follow us',
      'daftarkan diri', 'download aplikasi', 'subscribe', 'telegram',
    ]

    // Extract only clean paragraph and heading text
    const parts: string[] = []
    target.find('p, h2, h3').each((_, el) => {
      const text = $(el).text().trim().replace(/[ \t]+/g, ' ')
      if (text.length < 40) return // skip stray metadata / dates / author blobs
      const textLower = text.toLowerCase()
      if (promoPatterns.some(phrase => textLower.includes(phrase))) return
      parts.push(text)
    })

    // Join with double newline between blocks, clean excess whitespace
    return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
  } catch (err) {
    console.error(`[scrapeWebText] Failed for ${url}:`, err)
    return `[Could not retrieve content from source]`
  }
}

export async function processContentAction(data: {
  fixJudul: string
  linkSumber: string
  sumberLain: string
  highlights: string
  rawScrapedText: string
  selectedWpSiteId?: string
  selectedApiKeyId?: string
}) {
  try {
    const settings = await getSettings()
    
    if (!settings) {
      return { error: 'Settings not configured or user not authenticated' }
    }

    // Phase 1 (REMOVED: Pre-fetching massive tags array is inefficient).
    
    // Phase 2: AI Content Generation & Keyword Extraction
    const basePersona = `You are an expert sports and news journalist (e.g., covering FC Barcelona, Real Madrid, MotoGP, F1). Write a comprehensive, engaging article based on the provided title, source links, and highlights.`
    const injectedCustomPrompt = settings.custom_prompt ? `\nUSER SPECIFIC INSTRUCTIONS: ${settings.custom_prompt}\n` : ''
    const systemPrompt = `${basePersona}${injectedCustomPrompt}
CRITICAL RULES FOR CONTENT & KEYWORDS:
1. KEYWORDS: Extract up to 5 highly specific, core entities (e.g., Player Names, Team Names, Concepts) from the article. Output purely as an array of strings. Do not infer distant relationships.
2. 10 TITLES (REPRESENTATIVE & SPOK): The provided 'Fix Judul' is ONLY A REFERENCE. You MUST read the provided scraped content and highlights, then generate EXACTLY 10 new, factual titles that accurately represent the ENTIRE article. Avoid sensational clickbait. Strictly follow the SPOK (Subjek, Predikat, Objek, Keterangan) structure in Indonesian and Title Case (EYD/PUEBI).
3. QUOTES & STATEMENTS: You MUST state the specific assigned source or person when writing a quote. CRITICAL HTML RULE: Whenever you include a direct statement, interview excerpt, or quote, you MUST wrap the ENTIRE quote and its attribution strictly inside an HTML <blockquote> tag. Do NOT simply use quotation marks inside a regular <p> tag. Example Format: <blockquote>"Pertandingan yang sangat sulit, tapi kami bangga," ujar Jay Idzes.</blockquote>
4. LEAD PARAGRAPH (5W1H): The FIRST TWO paragraphs (<p>) of the article MUST be the "Lead". They MUST directly answer the Title and contain the 5W1H elements (What, Who, When, Where, Why, How) based on the scraped text. Do not start with empty fluff or filler sentences; get straight to the facts.
5. ARTICLE STRUCTURE:
   - The HTML article MUST contain at least 2 subheadings (<h2> or <h3>).
   - The opening section before the first subheading MUST have at least 3 distinct paragraphs (<p>), starting with the 5W1H Lead.
   - Under EACH subheading, you MUST write at least 3 distinct paragraphs (<p>).
   - NEVER put internal links or <a> tags inside <h2> or <h3> subheadings.

Output MUST be strictly in JSON format:
{
  "titles": ["SPOK Title 1", "SPOK Title 2", "SPOK Title 3", "SPOK Title 4", "SPOK Title 5", "SPOK Title 6", "SPOK Title 7", "SPOK Title 8", "SPOK Title 9", "SPOK Title 10"],
  "meta_desc": "...",
  "content_raw_html": "<p>...</p>",
  "tag_reasoning": "Explain step-by-step why you extracted each keyword based strictly on the text.",
  "suggested_keywords": ["Keyword 1", "Keyword 2"]
}`

    const userPrompt = `Input Data:
Titles (Fix Judul): ${data.fixJudul}
Highlights: ${data.highlights}

=== SCRAPED SOURCE CONTENT ===
${data.rawScrapedText || '[No source content provided — write based on the title and highlights only]'}`

    // Resolve which API key to use (override or global active)
    const resolveApiKey = (dbString: string | undefined, preferredId?: string): string | null => {
      if (!preferredId) return getActiveApiKey(dbString)
      const keys = parseApiKeys(dbString)
      return keys.find(k => k.id === preferredId)?.key || getActiveApiKey(dbString)
    }

    let generatedJsonString = ''

    // Helper to call the AI once and return the raw JSON string
    const callAi = async (): Promise<string> => {
      if (settings.active_model === 'openrouter') {
        const orKey = resolveApiKey(settings.openrouter_api_key, data.selectedApiKeyId)
        if (!orKey || !settings.openrouter_model_string) throw new Error('OpenRouter Model String or API Key is missing in settings.')
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${orKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.openrouter_model_string,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' }
          })
        })
        if (!orRes.ok) throw new Error(`OpenRouter error: ${await orRes.text()}`)
        const orJson = await orRes.json()
        return orJson.choices[0].message.content
      } else {
        const apiKey = resolveApiKey(settings.gemini_api_key, data.selectedApiKeyId)
        if (!apiKey) throw new Error('Gemini API Key missing in settings.')
        const model = settings.active_model === 'gemini-3.0' ? 'gemini-3.0-flash' : 'gemini-2.5-flash'
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        })
        if (!geminiRes.ok) throw new Error(`Gemini API error: ${await geminiRes.text()}`)
        const gemJson = await geminiRes.json()
        return gemJson.candidates[0].content.parts[0].text
      }
    }

    // Attempt AI call with up to 2 keyword retries
    const MAX_KEYWORD_RETRIES = 2
    let aiOutput: any = null
    for (let attempt = 0; attempt <= MAX_KEYWORD_RETRIES; attempt++) {
      generatedJsonString = await callAi()
      aiOutput = JSON.parse(generatedJsonString)
      const hasKeywords = aiOutput.suggested_keywords && Array.isArray(aiOutput.suggested_keywords) && aiOutput.suggested_keywords.length > 0
      console.log(`[Keyword Attempt ${attempt + 1}] tag_reasoning:`, aiOutput.tag_reasoning)
      console.log(`[Keyword Attempt ${attempt + 1}] suggested_keywords:`, aiOutput.suggested_keywords)
      if (hasKeywords) break
      if (attempt < MAX_KEYWORD_RETRIES) console.warn(`[Keyword Attempt ${attempt + 1}] Keywords undefined/empty — retrying...`)
    }

    // Phase 3: Dynamic WP Tag Search — use selected or global active WP site
    let verified_tags: Array<{id: number, name: string, link: string, matched_keyword_in_text: string}> = []
    
    const allWpSites = parseWpSites(settings.wp_site_url, settings.wp_username, settings.wp_app_password)
    const activeWp = data.selectedWpSiteId
      ? (allWpSites.find(s => s.id === data.selectedWpSiteId) || getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password))
      : getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password)

    if (aiOutput.suggested_keywords && Array.isArray(aiOutput.suggested_keywords) && activeWp?.url) {
      const authHeader = `Basic ${Buffer.from(`${activeWp.username}:${activeWp.password}`).toString('base64')}`
      
      const searchPromises = aiOutput.suggested_keywords.map(async (keyword: string) => {
        try {
          const encodedKeyword = encodeURIComponent(keyword)
          const searchUrl = new URL(`/wp-json/wp/v2/tags?search=${encodedKeyword}`, activeWp.url)
          console.log(`Searching WP for tag: ${keyword} -> ${searchUrl}`)
          
          const res = await fetch(searchUrl.toString(), {
            headers: { Authorization: authHeader }
          })
          
          if (!res.ok) return null
          
          const tagsMatches = await res.json()
          if (tagsMatches && tagsMatches.length > 0) {
            // Cari presisi nama tag yang hurufnya 100% sama (Case-Insensitive) dengan kata kunci
            const exactMatch = tagsMatches.find((t: any) => t.name.toLowerCase() === keyword.toLowerCase())
            const matchToUse = exactMatch || tagsMatches[0]

            return {
              id: matchToUse.id,
              name: matchToUse.name,
              link: matchToUse.link,
              matched_keyword_in_text: keyword
            }
          }
        } catch (e) {
          console.error(`Tag search failed for ${keyword}:`, e)
        }
        return null
      })

      const results = await Promise.all(searchPromises)
      // Strip nulls
      verified_tags = results.filter((t): t is NonNullable<typeof t> => t !== null)
      
      console.log("VERIFIED ACTUAL TAGS DARI WP:", verified_tags)
    }

    // Phase 4: The Internal Link Injector (Regex Logic)
    let processedHtml = aiOutput.content_raw_html
    
    // TEMPORARY HIDE HEADINGS to avoid link injection inside them
    const placeholders: string[] = []
    processedHtml = processedHtml.replace(/<(h[1-6])\b[^>]*>(.*?)<\/\1>/gi, (match: string) => {
        placeholders.push(match)
        return `___HEADER_PLACEHOLDER_${placeholders.length - 1}___`
    })
    
    if (verified_tags.length > 0) {
      verified_tags.forEach((tag) => {
         const keywordToSearch = tag.matched_keyword_in_text;
         if (keywordToSearch && tag.link) {
           try {
             const tagRegex = new RegExp(`(?![^<]*>)(\\b${escapeRegExp(keywordToSearch)}\\b)`, 'i')
             processedHtml = processedHtml.replace(tagRegex, `<a href="${tag.link}" title="Link Internal: ${tag.link}" target="_blank" rel="noopener">$&</a>`)
           } catch {
             const fallbackRegex = new RegExp(`\\b${escapeRegExp(keywordToSearch)}\\b`, 'i')
             processedHtml = processedHtml.replace(fallbackRegex, `<a href="${tag.link}" title="Link Internal: ${tag.link}" target="_blank" rel="noopener">$&</a>`)
           }
         }
      })
    }

    // RESTORE HEADINGS
    placeholders.forEach((hdr, idx) => {
      processedHtml = processedHtml.replace(`___HEADER_PLACEHOLDER_${idx}___`, hdr)
    })

    aiOutput.content_raw_html = processedHtml
    aiOutput.selected_tags = verified_tags // Re-map to expected UI param

    return { data: aiOutput }
  } catch (error) {
    console.error('processContent error:', error)
    return { error: error instanceof Error ? error.message : 'Server error occurred' }
  }
}
