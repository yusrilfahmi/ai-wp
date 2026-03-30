'use server'

import { getSettings } from '@/app/actions/settings'
import { getActiveApiKey, getActiveWpSite } from '@/lib/settings-parser'

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function processImageContentAction(formData: FormData) {
  try {
    const settings = await getSettings()
    
    if (!settings) {
      return { error: 'Settings not configured or user not authenticated' }
    }

    const modeArtikel = formData.get('modeArtikel') as string
    const sumberGambar = formData.get('sumberGambarUrl') as string
    const highlights = formData.get('highlights') as string | null
    const imageFile = formData.get('imageData') as File

    if (!modeArtikel || !sumberGambar || !imageFile) {
      return { error: 'Mode Artikel, Sumber Gambar, dan Image Data wajib diisi' }
    }

    // Convert File to Base64
    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type

    // Phase 2: Multimodal AI Content Generation (Image to JSON)
    const basePersona = `You are an expert sports journalist writing hard news articles in formal Indonesian (Bahasa Indonesia baku).`
    const injectedCustomPrompt = settings.custom_prompt ? `\nUSER SPECIFIC INSTRUCTIONS: ${settings.custom_prompt}\n` : ''

    const systemPrompt = `${basePersona}${injectedCustomPrompt}
CRITICAL RULES FOR CONTENT & FORMATTING:

1. MODE-SPECIFIC RULES (You are writing for mode: "${modeArtikel}"):
   - If "hasil" or "hasil sementara": Do NOT use the word "Akhir" in titles. Use "Hasil [Tim A] vs [Tim B]".
   - If "rating pemain": Do NOT use the word "Rapor". Use "Penilaian", "Nilai", or "Evaluasi". You MUST include an HTML table (Posisi | Nama Pemain | Nilai).
   - If "top skor" or "klasemen": You MUST include an HTML table representing the standings or top scorers based on the image.
   - If "esports": Do not mention player names individually for hero drafts, just mention the team's overall hero composition.

2. PLAYER NAMES & TERMINOLOGY:
   - NEVER abbreviate player names (e.g., "Putra B." MUST be expanded to "Beckham Putra" based on your knowledge).
   - Translate foreign terms to standard Indonesian (e.g., injury time = masa tambahan waktu, leg = pertemuan).

3. HTML ARTICLE STRUCTURE (For "content_raw_html"):
   - The opening section before the first subheading MUST have at least 3 distinct paragraphs (<p>).
   - Include at least 2 subheadings using <h2> tags.
   - Under EACH <h2> subheading, write at least 3 distinct paragraphs (<p>).
   - Include properly formatted <table> tags if required by the mode.
   - NEVER put internal links or <a> tags inside <h2> or <h3> subheadings.

4. TITLES & KEYWORDS:
   - Generate EXACTLY 5 reference titles. Titles MUST strictly match the specific context of the requested "Mode Artikel". They must be factual, avoid sensational clickbait, and rigorously follow the SPOK (Subjek, Predikat, Objek, Keterangan) structure in Indonesian. Use proper Title Case (EYD/PUEBI).
   - Extract up to 5 specific core entities (Player Names, Teams, Concepts) for keywords.

5. SOURCE ATTRIBUTION:
   - If relevant, naturally acknowledge the match data based on the provided image source: "${sumberGambar}". Do not use vague phrases like "dari berbagai sumber".

Output MUST be strictly in JSON format (DO NOT wrap in markdown \`\`\`json blocks):
{
  "titles": ["SPOK Title 1", "SPOK Title 2", "SPOK Title 3", "SPOK Title 4", "SPOK Title 5"],
  "meta_desc": "Write 1-2 compelling sentences summarizing the match/data for SEO.",
  "content_raw_html": "<p>...</p><h2>...</h2><p>...</p>",
  "tag_reasoning": "Explain step-by-step why you extracted each keyword.",
  "suggested_keywords": ["Keyword 1", "Keyword 2", "Keyword 3", "Keyword 4", "Keyword 5"]
}`

    const userPromptText = `Input Data:
Mode Artikel: ${modeArtikel}
Sumber Gambar: ${sumberGambar}
${highlights ? `Yang Harus Dihighlight: ${highlights}\n` : ''}
Tugas: Analisis gambar statistik/data yang dilampirkan dan buatkan artikel JSON sesuai dengan mode yang dipilih.`

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
             { 
               role: 'user', 
               content: [
                 { type: "text", text: userPromptText },
                 { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
               ] 
             }
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
           contents: [{
             parts: [
               { text: userPromptText },
               { inlineData: { mimeType: mimeType, data: base64Image } }
             ]
           }],
           generationConfig: { responseMimeType: "application/json" }
         })
       })

       if (!geminiRes.ok) {
         return { error: `Gemini API error: ${await geminiRes.text()}` }
       }
       
       const gemJson = await geminiRes.json()
       // Safeguard for potentially missing parts/text
       if (!gemJson.candidates || !gemJson.candidates[0].content || !gemJson.candidates[0].content.parts) {
          console.error("Unexpected Gemini response:", gemJson)
          return { error: "Gemini sent an unexpected response structure." }
       }
       generatedJsonString = gemJson.candidates[0].content.parts[0].text
    }

    const aiOutput = JSON.parse(generatedJsonString)

    console.log("=== ALASAN AI MEMILIH KEYWORDS (Multimodal) ===")
    console.log(aiOutput.tag_reasoning)
    console.log("KEYWORDS AI (Multimodal):", aiOutput.suggested_keywords)

    // Phase 3: Dynamic WP Tag Search (Validate keywords against WP API)
    let verified_tags: Array<{id: number, name: string, link: string, matched_keyword_in_text: string}> = []
    
    const activeWp = getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password)

    if (aiOutput.suggested_keywords && Array.isArray(aiOutput.suggested_keywords) && activeWp?.url) {
      const authHeader = `Basic ${Buffer.from(`${activeWp.username}:${activeWp.password}`).toString('base64')}`
      
      const searchPromises = aiOutput.suggested_keywords.map(async (keyword: string) => {
        try {
          const encodedKeyword = encodeURIComponent(keyword)
          const searchUrl = new URL(`/wp-json/wp/v2/tags?search=${encodedKeyword}`, activeWp.url)
          
          const res = await fetch(searchUrl.toString(), {
            headers: { Authorization: authHeader }
          })
          
          if (!res.ok) return null
          
          const tagsMatches = await res.json()
          if (tagsMatches && tagsMatches.length > 0) {
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
      verified_tags = results.filter((t): t is NonNullable<typeof t> => t !== null)
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
    console.error('processImageContent error:', error)
    return { error: error instanceof Error ? error.message : 'Server error occurred' }
  }
}
