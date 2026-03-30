'use server'

import { getSettings } from '@/app/actions/settings'
import { getActiveApiKey, getActiveWpSite } from '@/lib/settings-parser'

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export async function processContentAction(data: {
  fixJudul: string
  linkSumber: string
  sumberLain: string
  highlights: string
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
2. 10 TITLES (EYD/SPOK): Generate EXACTLY 10 reference titles. Titles MUST be factual, avoid sensational clickbait, and strictly follow the SPOK (Subjek, Predikat, Objek, Keterangan) structure in Indonesian. Penulisan huruf kapital/besar-kecil wajib mematuhi panduan EYD/PUEBI yang ketat (Title Case).
3. QUOTES & STATEMENTS: You MUST state the specific assigned source or person when writing a quote or statement. DO NOT use vague phrases like "dari berbagai sumber" (from various sources). Context must be validated from the provided input sources. NEVER alter, paraphrase loosely, or change the intrinsic meaning/wording of any direct statement.
4. ARTICLE STRUCTURE: 
   - The HTML article MUST contain at least 2 subheadings (<h2> or <h3>).
   - The opening section before the first subheading MUST have at least 3 distinct paragraphs (<p>).
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
Main Source Link: ${data.linkSumber}
Other Source: ${data.sumberLain}
Highlights: ${data.highlights}`

    let generatedJsonString = ''

    if (settings.active_model === 'openrouter') {
       const orKey = getActiveApiKey(settings.openrouter_api_key)
       if (!orKey || !settings.openrouter_model_string) {
          return { error: 'OpenRouter Model String or API Key is missing in settings.' }
       }
       const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${orKey}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           model: settings.openrouter_model_string,
           messages: [
             { role: 'system', content: systemPrompt },
             { role: 'user', content: userPrompt }
           ],
           response_format: { type: 'json_object' }
         })
       })

       if (!orRes.ok) {
         return { error: `OpenRouter error: ${await orRes.text()}` }
       }
       const orJson = await orRes.json()
       generatedJsonString = orJson.choices[0].message.content
    } else {
       // Gemini
       const apiKey = getActiveApiKey(settings.gemini_api_key)
       if (!apiKey) {
          return { error: 'Gemini API Key missing in settings.' }
       }
       const model = settings.active_model === 'gemini-3.0' ? 'gemini-3.0-flash' : 'gemini-2.5-flash' // using flash as typical fallback
       
       const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           system_instruction: { parts: [{ text: systemPrompt }] },
           contents: [{ parts: [{ text: userPrompt }] }],
           generationConfig: { responseMimeType: "application/json" }
         })
       })

       if (!geminiRes.ok) {
         return { error: `Gemini API error: ${await geminiRes.text()}` }
       }
       const gemJson = await geminiRes.json()
       generatedJsonString = gemJson.candidates[0].content.parts[0].text
    }

    const aiOutput = JSON.parse(generatedJsonString)

    console.log("=== ALASAN AI MEMILIH KEYWORDS ===")
    console.log(aiOutput.tag_reasoning)
    console.log("KEYWORDS AI:", aiOutput.suggested_keywords)

    // Phase 3: Dynamic WP Tag Search (Validate keywords against WP API)
    let verified_tags: Array<{id: number, name: string, link: string, matched_keyword_in_text: string}> = []
    
    const activeWp = getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password)

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
