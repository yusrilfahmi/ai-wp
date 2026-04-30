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
    const basePersona = `You are an expert sports journalist writing hard news articles in formal Indonesian (Bahasa Indonesia baku). SELURUH OUTPUT WAJIB DALAM BAHASA INDONESIA. Jangan gunakan bahasa lain selain Bahasa Indonesia dalam artikel, judul, meta description, maupun tag reasoning.`
    const injectedCustomPrompt = settings.custom_prompt ? `\nUSER SPECIFIC INSTRUCTIONS: ${settings.custom_prompt}\n` : ''

    const systemPrompt = `${basePersona}${injectedCustomPrompt}
CRITICAL RULES FOR CONTENT & FORMATTING:

1. KEYWORDS (TAG EXTRACTION): Extract up to 5 highly specific, core entities directly present in the image data (e.g., exact Player Names, exact Team Names, Tournament Names, Competition Names). Output purely as an array of strings. Do NOT infer distant relationships or add generic sports terms. Only include what is explicitly visible or referenced.
   - Provide a step-by-step "tag_reasoning" justification for EACH keyword you chose, citing evidence from the image data.

2. MODE-SPECIFIC RULES (You are writing for mode: "${modeArtikel}"):
   - If "hasil" or "hasil sementara": Do NOT use the word "Akhir" in titles. Use "Hasil [Tim A] vs [Tim B] [Skor]".
   - If "rating pemain" or "penilaian pemain": Do NOT use the word "Rapor". Use "Penilaian", "Nilai", or "Evaluasi". You MUST include an HTML table (Posisi | Nama Pemain | Nilai). Tulis semua rating pemain ya, dan pisahkan satu tim satu sub bab.
   - If "top skor" or "klasemen": You MUST include an HTML table representing the standings or top scorers based on the image. Masukkan lengkap klasemen semua tim.
   - If "esports": Do not mention player names individually for hero drafts, just mention the team's overall hero composition.
   - If "artikel lain": Focus entirely on fulfilling the specific instructions from the MUTLAK HIGHLIGHT section provided by the user. Maintain the same high-quality journalism style as other modes.

3. PLAYER NAMES & TERMINOLOGY:
   - NEVER abbreviate player names (e.g., "Putra B." MUST be expanded to "Beckham Putra").
   - Translate foreign terms to standard Indonesian (e.g., injury time = masa tambahan waktu, leg = pertemuan).

4. HTML ARTICLE STRUCTURE (For "content_raw_html"):
   - The opening section before the first subheading MUST have at least 3 distinct paragraphs (<p>).
   - Include at least 2 subheadings using <h2> tags.
   - Under EACH <h2> subheading, write at least 3 distinct paragraphs (<p>).
   - Include properly formatted <table> tags if required by the mode.
   - NEVER put internal links or <a> tags inside <h2> or <h3> subheadings.

5. TITLES (STRICT FEW-SHOT EXAMPLES):
   - Generate EXACTLY 5 reference titles.
   - BATAS MAKSIMAL: Setiap judul MAKSIMAL 14 KATA. Jika lebih dari 14 kata, padatkan agar tetap informatif.
   - PUEBI/EYD TITLE CASE: Semua kata hubung dan kata depan (dan, di, ke, dari, yang, untuk, pada, dalam, dengan) WAJIB ditulis dengan huruf kecil di judul!
   - GAYA BAHASA JURNALISTIK: Gunakan diksi berita gaya olahraga yang luwes dan "punchy". Hindari kata awalan formal yang kaku. Gunakan pemendekan kata dasar (contoh: "mengincar" -> "incar", "tidak akan" -> "tak akan", "membawa" -> "bawa").
   - FORMATTING: Titles MUST use a "Two-Part Structure" separated by a colon (:). Part 1 is the Core Fact (Result/Standings/Rating). Part 2 is the Key Highlight in SPOK structure.
   - NEVER use clickbait, question marks, or exaggerated words.
   - YOU MUST MIMIC THESE EXACT PATTERNS BASED ON THE MODE:
     * Mode "hasil": "Hasil Barito Putera vs Persiku Kudus 1-1: Diwarnai Kartu Merah dan Gol Bunuh Diri, Laskar Antasari Harus Rela Berbagi Poin"
     * Mode "hasil" (with win): "Hasil Manchester City vs Real Madrid 1-2: Puncak Drama VAR dan Gol Telat Vinicius Junior Benamkan Sepuluh Pemain Tuan Rumah"
     * Mode "hasil sementara": "Hasil Sementara Indonesia vs Saint Kitts and Nevis 2-0: Dwigol Beckham Putra Bawa Skuad Garuda Memimpin di Paruh Pertama"
     * Mode "klasemen": "Klasemen Lengkap Championship Liga Indonesia Grup A Pekan ke-22: Gilas FC Bekasi City 4-0, Garudayaksa Terus Bayangi Adhyaksa"
     * Mode "rating pemain": "Penilaian Pemain Chelsea vs Paris Saint-Germain: Matvei Safonov Tampil Sempurna, Lini Belakang Tuan Rumah Terpuruk"
     * Mode "bagan turnamen": "Bagan Perempat Final Liga Champions: Singkirkan Bayer Leverkusen, Arsenal Tantang Sporting CP"
     * Mode "jadwal": "Jadwal Pertandingan Liga Inggris: Arsenal Menantang Manchester City di Emirates Stadium. (PENTING: Di mode ini Anda membuat artikel preview/jadwal laga. Gambar pertama = Jadwal Utama, Gambar kedua = Klasemen, Gambar ketiga = Statistik Head to Head. Rangkum info penting dari ketiganya secara urut.)"
     * Mode "esports": "Hasil Bigetron Alpha vs Alter Ego 2-1: Sengit Hingga Gim Ketiga, Skuad Robot Merah Kunci Kemenangan. (ATURAN MUTLAK HERO DRAFT: JANGAN MENGARANG BEBAS NAMA HERO! AI harus melihat 1 per 1 wajah kecil hero yang ada di screenshot laga, lalu MENCOCOKKAN SECARA VISUAL SATU PER SATU wajah/ikon tersebut ke dalam daftar wajah yang ada di gambar referensi 'hero_list_mlbb'. Hanya tulis nama hero yang fotonya 100% identik di gambar referensi. Jika tidak yakin, tulis 'beberapa hero andalan'. JANGAN menyebut hero yang wajahnya tidak ada! Jika ada gambar klasemen tambahan, bahas klasemen tersebut.)"
     * Mode "artikel lain": Judul disesuaikan dengan fokus perintah pada instruksi MUTLAK HIGHLIGHT. Bebas namun tetap ikuti PUEBI/EYD SPOK journalism format.

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
    let verified_tags: Array<{id: number, name: string, link: string, matched_keyword_in_text: string}> = []
    
    const allWpSites = parseWpSites(settings.wp_site_url, settings.wp_username, settings.wp_app_password)
    const activeWp = selectedWpSiteId
      ? (allWpSites.find(s => s.id === selectedWpSiteId) || getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password))
      : getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password)

    if (aiOutput.suggested_keywords && Array.isArray(aiOutput.suggested_keywords) && activeWp?.url) {
      const authHeader = `Basic ${Buffer.from(`${activeWp.username}:${activeWp.password}`).toString('base64')}`
      
      const searchPromises = aiOutput.suggested_keywords.map(async (keyword: string) => {
        try {
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
      
      console.log('[ArtikelMode] VERIFIED ACTUAL TAGS DARI WP:', verified_tags)
    }

    // Phase 3.5: Fetch Related Posts (Baca Juga) - maximum 3
    let relatedPosts: Array<{ title: string, link: string }> = []
    if (aiOutput.suggested_keywords && Array.isArray(aiOutput.suggested_keywords) && activeWp?.url) {
      const authHeader = `Basic ${Buffer.from(`${activeWp.username}:${activeWp.password}`).toString('base64')}`
      
      const postSearchPromises = aiOutput.suggested_keywords.slice(0, 3).map(async (keyword: string) => {
        try {
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
          console.error(`Post search failed for ${keyword}:`, e)
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
    aiOutput.selected_tags = verified_tags // Re-map to expected UI param

    return { data: aiOutput }
  } catch (error) {
    console.error('processImageContent error:', error)
    return { error: error instanceof Error ? error.message : 'Server error occurred' }
  }
}
