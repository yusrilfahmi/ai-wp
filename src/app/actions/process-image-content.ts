'use server'

import { getSettings } from '@/app/actions/settings'
import { getActiveApiKey, getActiveWpSite, parseApiKeys, parseWpSites } from '@/lib/settings-parser'
import { convertToGutenberg } from '@/lib/gutenberg-converter'
import fs from 'fs'
import path from 'path'

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
    const extraImageFile = formData.get('extraImageData') as File | null
    const headToHeadImageFile = formData.get('headToHeadImageData') as File | null
    const dynamicImages = formData.getAll('dynamicImages') as File[]
    const penjelasanGambar = formData.get('penjelasanGambar') as string | null
    const selectedWpSiteId = formData.get('selectedWpSiteId') as string | null
    const selectedApiKeyId = formData.get('selectedApiKeyId') as string | null
    const selectedModelOverride = formData.get('selectedModelOverride') as string | null
    const customPrompt = formData.get('customPrompt') as string | null

    if (!modeArtikel || !sumberGambar || !imageFile) {
      return { error: 'Mode Artikel, Sumber Gambar, dan Image Data wajib diisi' }
    }

    // Convert File to Base64
    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type

    let base64ExtraImage: string | null = null
    let extraMimeType = ''
    if (extraImageFile) {
      const exArrayBuffer = await extraImageFile.arrayBuffer()
      base64ExtraImage = Buffer.from(exArrayBuffer).toString('base64')
      extraMimeType = extraImageFile.type
    }

    let base64H2HImage: string | null = null
    let h2hMimeType = ''
    if (headToHeadImageFile) {
      const h2hArrayBuffer = await headToHeadImageFile.arrayBuffer()
      base64H2HImage = Buffer.from(h2hArrayBuffer).toString('base64')
      h2hMimeType = headToHeadImageFile.type
    }

    const dynamicImagesBase64 = await Promise.all(dynamicImages.map(async img => {
      const b = await img.arrayBuffer()
      return { mime: img.type, data: Buffer.from(b).toString('base64') }
    }))

    let base64HeroList: string | null = null
    const isEsportsMode = modeArtikel === 'Hasil Laga Esports (Mobile Legends)'
    if (isEsportsMode) {
      try {
        const heroListPath = path.join(process.cwd(), 'src/app/actions/hero_list_mlbb.png')
        if (fs.existsSync(heroListPath)) {
            base64HeroList = fs.readFileSync(heroListPath).toString('base64')
        }
      } catch (err) {
        console.error('Failed to load hero_list_mlbb.png', err)
      }
    }

    // Phase 2: Multimodal AI Content Generation (Image to JSON)
    const basePrompt = customPrompt || `You are an expert sports journalist writing hard news articles in formal Indonesian (Bahasa Indonesia baku). SELURUH OUTPUT WAJIB DALAM BAHASA INDONESIA. Jangan gunakan bahasa lain selain Bahasa Indonesia dalam artikel, judul, meta description, maupun tag reasoning.`

    const systemPrompt = `${basePrompt}

TAGGING INSTRUCTIONS:
${settings?.custom_prompt || 'Extract up to 5 highly specific, core entities from the text/image. Output purely as an array of strings.'}

Output MUST be strictly in JSON format (DO NOT wrap in markdown \`\`\`json blocks):
{
  "titles": ["SPOK Title 1", "SPOK Title 2", "SPOK Title 3", "SPOK Title 4", "SPOK Title 5"],
  "meta_desc": "Write 1-2 compelling sentences summarizing the match/data for SEO.",
  "content_raw_html": "<p>...</p><h2>...</h2><p>...</p>",
  "tag_reasoning": "Explain step-by-step why you extracted each keyword.",
  "suggested_keywords": [
    {
      "tag": "Standard Tag Name (e.g. Liga Super Indonesia)",
      "phrases_in_article": ["Exact phrase 1 (e.g. BRI Super League)", "Exact phrase 2 (e.g. Liga 1)"]
    }
  ]
}`

    const userPromptText = `Input Data:
Mode Artikel: ${modeArtikel}
Sumber Gambar: ${sumberGambar}
${penjelasanGambar ? `Penjelasan Gambar: ${penjelasanGambar}\n` : ''}${highlights ? `\n===================================\nINSTRUKSI MUTLAK (HIGHLIGHT UTAMA):\nAnda WAJIB dan HARUS memastikan seluruh isi artikel sejalan, merepresentasikan, dan memasukkan poin-poin berikut ini. Highlight ini adalah panduan UTAMA arah artikel, LEBIH PENTING dari pada opini data lainnya:\n[ ${highlights} ]\n===================================\n` : ''}Tugas: Analisis gambar statistik/data yang dilampirkan dan buatkan artikel JSON sesuai dengan mode yang dipilih.`

    // Resolve which API key to use (override or global active)
    const resolveApiKey = (dbString: string | undefined, provider?: 'openrouter'|'dashscope', preferredId?: string | null): string | null => {
      if (!preferredId) return getActiveApiKey(dbString, provider)
      const keys = parseApiKeys(dbString)
      const filteredKeys = provider ? keys.filter(k => k.provider === provider || (!k.provider && provider === 'openrouter')) : keys
      return filteredKeys.find(k => k.id === preferredId)?.key || getActiveApiKey(dbString, provider)
    }

    let generatedJsonString = ''

    const baseModel = selectedModelOverride || settings.active_model || 'gemini-2.5-flash'
    const useOpenRouter = baseModel === 'openrouter'
    const useDashScope = baseModel === 'qwen3.5-flash'

    // Helper to call the AI once and return the raw JSON string
    const callAi = async (): Promise<string> => {
      if (useOpenRouter) {
        const orKey = resolveApiKey(settings.openrouter_api_key, 'openrouter', selectedApiKeyId)
        if (!orKey || !settings.openrouter_model_string) throw new Error('OpenRouter Model String or API Key is missing in settings.')
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${orKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.openrouter_model_string,
            messages: [
              { role: 'system', content: systemPrompt },
              { 
                role: 'user', 
                content: (() => {
                  const arr: any[] = [
                    { type: 'text', text: userPromptText },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                  ]
                  if (base64ExtraImage) {
                     arr.push({ type: 'text', text: "\nGAMBAR KEDUA (KLASEMEN/TAMBAHAN):\n" })
                     arr.push({ type: 'image_url', image_url: { url: `data:${extraMimeType};base64,${base64ExtraImage}` } })
                  }
                  if (base64H2HImage) {
                     arr.push({ type: 'text', text: "\nGAMBAR KETIGA (STATISTIK HEAD TO HEAD):\n" })
                     arr.push({ type: 'image_url', image_url: { url: `data:${h2hMimeType};base64,${base64H2HImage}` } })
                  }
                  if (base64HeroList) {
                     arr.push({ type: 'text', text: "\nREFERENSI WAJAH & NAMA HERO MOBILE LEGENDS (GUNAKAN INI UNTUK MENEBAK HERO DI SCREENSHOT):\n" })
                     arr.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${base64HeroList}` } })
                  }
                  if (dynamicImagesBase64.length > 0) {
                     dynamicImagesBase64.forEach((dimg, idx) => {
                         arr.push({ type: 'text', text: `\nGAMBAR TAMBAHAN ${idx+1} (DARI MULTIPLE UPLOAD):\n` })
                         arr.push({ type: 'image_url', image_url: { url: `data:${dimg.mime};base64,${dimg.data}` } })
                     })
                  }
                  return arr
                })()
              }
            ],
            response_format: { type: 'json_object' }
          })
        })
        if (!orRes.ok) throw new Error(`OpenRouter error: ${await orRes.text()}`)
        const orJson = await orRes.json()
        return orJson.choices[0].message.content
      } else if (useDashScope) {
        const dsKey = resolveApiKey(settings.openrouter_api_key, 'dashscope', selectedApiKeyId)
        if (!dsKey) throw new Error('DashScope API Key is missing in settings.')
        const dsRes = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${dsKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen3.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { 
                role: 'user', 
                content: (() => {
                  const arr: any[] = [
                    { type: 'text', text: userPromptText },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                  ]
                  if (base64ExtraImage) {
                     arr.push({ type: 'text', text: "\nGAMBAR KEDUA (KLASEMEN/TAMBAHAN):\n" })
                     arr.push({ type: 'image_url', image_url: { url: `data:${extraMimeType};base64,${base64ExtraImage}` } })
                  }
                  if (base64H2HImage) {
                     arr.push({ type: 'text', text: "\nGAMBAR KETIGA (STATISTIK HEAD TO HEAD):\n" })
                     arr.push({ type: 'image_url', image_url: { url: `data:${h2hMimeType};base64,${base64H2HImage}` } })
                  }
                  if (base64HeroList) {
                     arr.push({ type: 'text', text: "\nREFERENSI WAJAH & NAMA HERO MOBILE LEGENDS (GUNAKAN INI UNTUK MENEBAK HERO DI SCREENSHOT):\n" })
                     arr.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${base64HeroList}` } })
                  }
                  if (dynamicImagesBase64.length > 0) {
                     dynamicImagesBase64.forEach((dimg, idx) => {
                         arr.push({ type: 'text', text: `\nGAMBAR TAMBAHAN ${idx+1} (DARI MULTIPLE UPLOAD):\n` })
                         arr.push({ type: 'image_url', image_url: { url: `data:${dimg.mime};base64,${dimg.data}` } })
                     })
                  }
                  return arr
                })()
              }
            ],
            response_format: { type: 'json_object' }
          })
        })
        if (!dsRes.ok) throw new Error(`DashScope error: ${await dsRes.text()}`)
        const dsJson = await dsRes.json()
        return dsJson.choices[0].message.content
      } else {
        const apiKey = resolveApiKey(settings.gemini_api_key, undefined, selectedApiKeyId)
        if (!apiKey) throw new Error('Gemini API Key missing in settings.')
        const model = baseModel === 'gemini-3.0' ? 'gemini-3.0-flash' : baseModel
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{
              parts: (() => {
                  const arr: any[] = [
                    { text: userPromptText },
                    { inlineData: { mimeType: mimeType, data: base64Image } }
                  ]
                  if (base64ExtraImage) {
                     arr.push({ text: "\nGAMBAR KEDUA (KLASEMEN/TAMBAHAN):\n" })
                     arr.push({ inlineData: { mimeType: extraMimeType, data: base64ExtraImage } })
                  }
                  if (base64H2HImage) {
                     arr.push({ text: "\nGAMBAR KETIGA (STATISTIK HEAD TO HEAD):\n" })
                     arr.push({ inlineData: { mimeType: h2hMimeType, data: base64H2HImage } })
                  }
                  if (base64HeroList) {
                     arr.push({ text: "\nREFERENSI WAJAH & NAMA HERO MOBILE LEGENDS (GUNAKAN INI UNTUK MENEBAK HERO DI SCREENSHOT):\n" })
                     arr.push({ inlineData: { mimeType: 'image/png', data: base64HeroList } })
                  }
                  if (dynamicImagesBase64.length > 0) {
                     dynamicImagesBase64.forEach((dimg, idx) => {
                         arr.push({ text: `\nGAMBAR TAMBAHAN ${idx+1} (DARI MULTIPLE UPLOAD):\n` })
                         arr.push({ inlineData: { mimeType: dimg.mime, data: dimg.data } })
                     })
                  }
                  return arr
              })()
            }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        })
        if (!geminiRes.ok) throw new Error(`Gemini API error: ${await geminiRes.text()}`)
        const gemJson = await geminiRes.json()
        if (!gemJson.candidates || !gemJson.candidates[0].content || !gemJson.candidates[0].content.parts) {
          console.error('Unexpected Gemini response:', gemJson)
          throw new Error('Gemini sent an unexpected response structure.')
        }
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
    let verified_tags: Array<{id: number, name: string, link: string, matched_keyword_in_text: string, matched_keywords_in_text?: string[]}> = []
    
    const allWpSites = parseWpSites(settings.wp_site_url, settings.wp_username, settings.wp_app_password)
    const activeWp = selectedWpSiteId
      ? (allWpSites.find(s => s.id === selectedWpSiteId) || getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password))
      : getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password)

    if (aiOutput.suggested_keywords && Array.isArray(aiOutput.suggested_keywords) && activeWp?.url) {
      const authHeader = `Basic ${Buffer.from(`${activeWp.username}:${activeWp.password}`).toString('base64')}`
      
      const searchPromises = aiOutput.suggested_keywords.map(async (kwItem: any) => {
        try {
          const keyword = typeof kwItem === 'string' ? kwItem : kwItem.tag;
          let phrasesToLink: string[] = [];
          if (typeof kwItem === 'string') {
            phrasesToLink = [kwItem];
          } else if (Array.isArray(kwItem.phrases_in_article)) {
            phrasesToLink = kwItem.phrases_in_article;
          } else if (kwItem.phrase_in_article) {
            phrasesToLink = [kwItem.phrase_in_article];
          } else {
            phrasesToLink = [keyword];
          }
          
          if (!keyword) return null;

          const encodedKeyword = encodeURIComponent(keyword)
          const searchUrl = new URL(`/wp-json/wp/v2/tags?search=${encodedKeyword}`, activeWp.url)
          console.log(`[ArtikelMode] Searching WP for tag: ${keyword} -> ${searchUrl}`)
          
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
              matched_keywords_in_text: phrasesToLink
            }
          }
        } catch (e) {
          console.error(`Tag search failed for item:`, e)
        }
        return null
      })

      const results = await Promise.all(searchPromises)
      verified_tags = results.filter((t): t is NonNullable<typeof t> => t !== null)
      
      console.log('[ArtikelMode] VERIFIED ACTUAL TAGS DARI WP:', verified_tags)
    }

    // Phase 3.5: Fetch Related Posts (Baca Juga) - maximum 3
    let relatedPosts: Array<{ title: string, link: string }> = []
    if (aiOutput.suggested_keywords && Array.isArray(aiOutput.suggested_keywords) && activeWp?.url) {
      const authHeader = `Basic ${Buffer.from(`${activeWp.username}:${activeWp.password}`).toString('base64')}`
      
      const postSearchPromises = aiOutput.suggested_keywords.slice(0, 3).map(async (kwItem: any) => {
        try {
          const keyword = typeof kwItem === 'string' ? kwItem : kwItem.tag;
          if (!keyword) return null;

          const encodedKeyword = encodeURIComponent(keyword)
          const searchUrl = new URL(`/wp-json/wp/v2/posts?search=${encodedKeyword}&per_page=1&_fields=id,title,link`, activeWp.url)
          const res = await fetch(searchUrl.toString(), {
            headers: { Authorization: authHeader }
          })
          if (!res.ok) return null
          
          const postsMatches = await res.json()
          if (postsMatches && postsMatches.length > 0) {
            return {
              title: postsMatches[0].title.rendered,
              link: postsMatches[0].link
            }
          }
        } catch (e) {
          console.error(`Post search failed for keyword:`, e)
        }
        return null
      })

      const postResults = await Promise.all(postSearchPromises)
      const uniquePosts = new Map()
      postResults.forEach(p => {
        if (p && !uniquePosts.has(p.link)) uniquePosts.set(p.link, p)
      })
      relatedPosts = Array.from(uniquePosts.values()).slice(0, 3)
      console.log('[ArtikelMode] RELATED POSTS DARI WP:', relatedPosts)
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
         const keywordsToSearch = tag.matched_keywords_in_text || [tag.matched_keyword_in_text];
         let linkInjectedForThisTag = false;
         
         keywordsToSearch.forEach((keywordToSearch: string) => {
             if (keywordToSearch && tag.link && !linkInjectedForThisTag) {
               try {
                 // Gunakan regex flag 'i' TANPA 'g' agar HANYA me-replace KEMUNCULAN PERTAMA
                 const tagRegex = new RegExp(`(?![^<]*>)(\\b${escapeRegExp(keywordToSearch)}\\b)`, 'i')
                 if (tagRegex.test(processedHtml)) {
                     processedHtml = processedHtml.replace(tagRegex, `<a href="${tag.link}" title="Link Internal: ${tag.link}" target="_blank" rel="noopener">$&</a>`)
                     linkInjectedForThisTag = true;
                 }
               } catch {
                 const fallbackRegex = new RegExp(`\\b${escapeRegExp(keywordToSearch)}\\b`, 'i')
                 if (fallbackRegex.test(processedHtml)) {
                     processedHtml = processedHtml.replace(fallbackRegex, `<a href="${tag.link}" title="Link Internal: ${tag.link}" target="_blank" rel="noopener">$&</a>`)
                     linkInjectedForThisTag = true;
                 }
               }
             }
         });
      })
    }

    // RESTORE HEADINGS
    placeholders.forEach((hdr, idx) => {
      processedHtml = processedHtml.replace(`___HEADER_PLACEHOLDER_${idx}___`, hdr)
    })

    // Phase 4.5: Inject Related Articles HTML
    if (relatedPosts.length > 0) {
      const escapedTitle = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      let pCount = 0
      let relatedIndex = 0
      
      processedHtml = processedHtml.replace(/<\/p>/gi, (match: string) => {
         pCount++
         // Sisipkan satu artikel "Baca Juga" setiap jeda 2 paragraf
         if (pCount % 2 === 0 && relatedIndex < relatedPosts.length) {
            const p = relatedPosts[relatedIndex]
            relatedIndex++
            const relatedHtml = `\n<p><strong style="font-size: 16px;">Baca Juga: <a href="${p.link}" target="_blank" rel="noopener">${escapedTitle(p.title)}</a></strong></p>\n`
            return match + relatedHtml
         }
         return match
      })
      
      // Jika ada sisa artikel (misal karena paragraf terlalu pendek), letakkan di bawah
      while (relatedIndex < relatedPosts.length) {
         const p = relatedPosts[relatedIndex]
         relatedIndex++
         processedHtml += `\n<p><strong style="font-size: 16px;">Baca Juga: <a href="${p.link}" target="_blank" rel="noopener">${escapedTitle(p.title)}</a></strong></p>\n`
      }
    }

    aiOutput.content_raw_html = convertToGutenberg(processedHtml)

    // Deduplicate verified tags based on ID to avoid duplicate rendering in UI
    const uniqueTagsMap = new Map()
    verified_tags.forEach(t => {
       if (!uniqueTagsMap.has(t.id)) uniqueTagsMap.set(t.id, t)
    })
    aiOutput.selected_tags = Array.from(uniqueTagsMap.values()) // Re-map to expected UI param

    return { data: aiOutput }
  } catch (error) {
    console.error('processImageContent error:', error)
    return { error: error instanceof Error ? error.message : 'Server error occurred' }
  }
}
