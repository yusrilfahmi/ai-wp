'use client'

import { useState, useEffect } from 'react'
import { processContentAction, scrapeUrlAction, translateFreeAction } from '@/app/actions/process-content'
import { draftPostAction } from '@/app/actions/draft-post'
import { getWpCategoriesAction, getWpSiteOptionsAction, getApiKeyOptionsAction } from '@/app/actions/get-wp-data'
import { ImageCropper } from '@/components/image-cropper'
import { SourceTextEditor, ArticleHtmlEditor } from '@/components/rich-text-editor'
import { toast } from 'sonner'
import { Loader2, Image as ImageIcon, Send, Sparkles, Trash2, X, Download, Languages } from 'lucide-react'

const DEFAULT_DASHBOARD_PROMPT = `<p>You are an expert sports and news journalist. Write a comprehensive, engaging article in Bahasa Indonesia based on the provided title, source links, and highlights. SELURUH OUTPUT WAJIB DALAM BAHASA INDONESIA. Jangan gunakan bahasa lain selain Bahasa Indonesia.</p>
<h3>CRITICAL RULES FOR CONTENT &amp; FORMATTING:</h3>
<ol>
  <li><strong>10 TITLES (REPRESENTATIVE &amp; SPOK):</strong> The provided 'Fix Judul' is ONLY A REFERENCE. You MUST generate EXACTLY 10 new, factual titles.
    <ul>
      <li>BATAS MAKSIMAL: Setiap judul MAKSIMAL 14 KATA. Jika lebih dari 14 kata, padatkan.</li>
      <li>PUEBI/EYD TITLE CASE: Semua kata hubung dan kata depan WAJIB ditulis secara huruf kecil di judul!</li>
      <li>GAYA BAHASA JURNALISTIK: Gunakan diksi berita yang luwes dan "punchy". Hindari bahasa formal yang terlalu kaku.</li>
      <li>Strictly follow the SPOK (Subjek, Predikat, Objek, Keterangan) structure accurately without sensational clickbait.</li>
    </ul>
  </li>
  <li><strong>QUOTES &amp; STATEMENTS:</strong> You MUST state the specific assigned source or person when writing a quote. CRITICAL HTML RULE: Whenever you include a direct statement, interview excerpt, or quote, you MUST wrap the ENTIRE quote and its attribution strictly inside an HTML &lt;blockquote&gt; tag. Example Format: <em>&lt;blockquote&gt;"Pertandingan yang sangat sulit, tapi kami bangga," ujar Jay Idzes.&lt;/blockquote&gt;</em></li>
  <li><strong>LEAD PARAGRAPH (5W1H):</strong> The FIRST TWO paragraphs (&lt;p&gt;) of the article MUST be the "Lead". They MUST directly answer the Title and contain the 5W1H elements (What, Who, When, Where, Why, How) based on the scraped text. Do not start with empty fluff or filler sentences; get straight to the facts.</li>
  <li><strong>ARTICLE STRUCTURE:</strong>
    <ul>
      <li>The HTML article MUST contain at least 2 subheadings (&lt;h2&gt; or &lt;h3&gt;).</li>
      <li>The opening section before the first subheading MUST have at least 3 distinct paragraphs (&lt;p&gt;), starting with the 5W1H Lead.</li>
      <li>Under EACH subheading, you MUST write at least 3 distinct paragraphs (&lt;p&gt;).</li>
      <li>NEVER put internal links or &lt;a&gt; tags inside &lt;h2&gt; or &lt;h3&gt; subheadings.</li>
    </ul>
  </li>
</ol>`;


export function DashboardClient() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDrafting, setIsDrafting] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [isFetchingData, setIsFetchingData] = useState(true)
  
  // Left form state
  const [categories, setCategories] = useState<{id: number, name: string}[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  // Site / API key selector
  const [wpSites, setWpSites] = useState<{id: string, label: string, is_active: boolean}[]>([])
  const [selectedWpSiteId, setSelectedWpSiteId] = useState<string>('')
  const [apiKeyOptions, setApiKeyOptions] = useState<{id: string, label: string, type: string, is_active?: boolean}[]>([])
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string>('')
  const [activeModel, setActiveModel] = useState<string>('')
  const [selectedModelOverride, setSelectedModelOverride] = useState<string>('')
  const [fixJudul, setFixJudul] = useState('')
  const [linkSumber, setLinkSumber] = useState('')
  const [sumberLain, setSumberLain] = useState('')
  const [highlights, setHighlights] = useState('')
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_DASHBOARD_PROMPT)
  // Dual-state text editor
  const [originalText, setOriginalText] = useState('')
  const [translatedText, setTranslatedText] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'original' | 'translated'>('original')
  const [uncroppedFile, setUncroppedFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [previewMode, setPreviewMode] = useState<'preview' | 'html'>('preview')
  const [isHoveringThumbnail, setIsHoveringThumbnail] = useState(false)
  
  const [sumberGambarType, setSumberGambarType] = useState('Instagram')
  const [sumberGambarUrl, setSumberGambarUrl] = useState('Foto: instagram.com/')

  useEffect(() => {
    const saved = localStorage.getItem('ai_wp_draft')
    if (saved) {
      try {
        const d = JSON.parse(saved)
        if (d.fixJudul) setFixJudul(d.fixJudul)
        if (d.linkSumber) setLinkSumber(d.linkSumber)
        if (d.sumberLain) setSumberLain(d.sumberLain)
        if (d.highlights) setHighlights(d.highlights)
        if (d.customPrompt) setCustomPrompt(d.customPrompt)
        if (d.sumberGambarType) setSumberGambarType(d.sumberGambarType)
        if (d.sumberGambarUrl) setSumberGambarUrl(d.sumberGambarUrl)
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('ai_wp_draft', JSON.stringify({
      fixJudul, linkSumber, sumberLain, highlights, sumberGambarType, sumberGambarUrl, customPrompt
    }))
  }, [fixJudul, linkSumber, sumberLain, highlights, sumberGambarType, sumberGambarUrl, customPrompt])

  const handleClearForm = () => {
    setFixJudul(''); setLinkSumber(''); setSumberLain(''); setHighlights(''); setCustomPrompt(DEFAULT_DASHBOARD_PROMPT);
    setOriginalText(''); setTranslatedText(null); setViewMode('original');
    setSumberGambarType('Instagram'); setSumberGambarUrl('Foto: instagram.com/');
    localStorage.removeItem('ai_wp_draft');
    toast.success('Formulir dibersihkan');
  }

  const removeTag = (tagToRemove: {id: number, name: string, link: string}) => {
    setSelectedTags(prev => prev.filter(t => t.id !== tagToRemove.id))
    if (tagToRemove.link) {
       const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
       const linkRegex = new RegExp(`<a[^>]*href="${escapeRegExp(tagToRemove.link)}"[^>]*>(.*?)</a>`, 'gi')
       setRawHtml(prev => prev.replace(linkRegex, '$1'))
    }
  }

  const handleSumberGambarTypeChange = (type: string) => {
    setSumberGambarType(type)
    if (type === 'Instagram') setSumberGambarUrl('Foto: instagram.com/')
    else if (type === 'X.com') setSumberGambarUrl('Foto: x.com/')
    else if (type === 'Site') setSumberGambarUrl('Foto: ')
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
       if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile()
          if (file) setUncroppedFile(file)
          break
       }
    }
  }

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (isHoveringThumbnail && e.clipboardData) {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
           if (items[i].type.indexOf('image') !== -1) {
              const file = items[i].getAsFile()
              if (file) {
                 setUncroppedFile(file)
                 e.preventDefault()
              }
              break
           }
        }
      }
    }
    document.addEventListener('paste', handleGlobalPaste)
    return () => document.removeEventListener('paste', handleGlobalPaste)
  }, [isHoveringThumbnail])

  // Right form state (Outputs)
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([])
  const [selectedTitle, setSelectedTitle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [rawHtml, setRawHtml] = useState('')
  const [selectedTags, setSelectedTags] = useState<{id: number, name: string, link: string}[]>([])

  useEffect(() => {
    async function loadWpData() {
      setIsFetchingData(true)
      // Load sites and API key options in parallel
      const [sitesRes, keysRes, catsRes] = await Promise.all([
        getWpSiteOptionsAction(),
        getApiKeyOptionsAction(),
        getWpCategoriesAction()
      ])
      if (sitesRes.data) {
        setWpSites(sitesRes.data)
        const activeSite = sitesRes.data.find(s => s.is_active) || sitesRes.data[0]
        if (activeSite) setSelectedWpSiteId(activeSite.id)
      }
      if (keysRes.data) {
        const allKeys = [
          ...keysRes.data.gemini.map(k => ({ ...k, type: 'gemini' })),
          ...keysRes.data.openrouter.map(k => ({ ...k, type: 'openrouter' })),
          ...(keysRes.data.dashscope || []).map(k => ({ ...k, type: 'dashscope' }))
        ]
        setApiKeyOptions(allKeys)
        const activeModel = keysRes.data.active_model
        setActiveModel(activeModel)
        // Pre-select active key matching the active model type
        let reqType = 'gemini'
        if (activeModel === 'openrouter') reqType = 'openrouter'
        if (activeModel === 'qwen3.5-flash') reqType = 'dashscope'

        const activeKey = allKeys.find(k => k.type === reqType && k.is_active) || allKeys.find(k => k.type === reqType)
        if (activeKey) setSelectedApiKeyId(activeKey.id)
      }
      if (catsRes.data) {
        setCategories(catsRes.data)
      } else {
        toast.error(`WP Connection warning: ${catsRes.error || 'Failed to load categories'}`)
      }
      setIsFetchingData(false)
    }
    loadWpData()
  }, [])

  // Reload categories when the selected WP site changes
  useEffect(() => {
    if (!selectedWpSiteId) return
    async function reloadCategories() {
      setIsFetchingData(true)
      setCategories([])
      const res = await getWpCategoriesAction(selectedWpSiteId)
      if (res.data) setCategories(res.data)
      setIsFetchingData(false)
    }
    reloadCategories()
  }, [selectedWpSiteId])

  const handleScrape = async () => {
    if (!linkSumber) {
      toast.error('Link Sumber wajib diisi untuk menarik teks')
      return
    }
    setIsScraping(true)
    setOriginalText('')
    setTranslatedText(null)
    setViewMode('original')
    try {
      const [mainRes, otherRes] = await Promise.all([
        scrapeUrlAction(linkSumber),
        sumberLain ? scrapeUrlAction(sumberLain) : Promise.resolve({ text: '' })
      ])
      const combined = [
        `=== KONTEN DARI SUMBER UTAMA (${linkSumber}) ===`,
        mainRes.text || '[Gagal mengambil konten dari sumber utama]',
        sumberLain
          ? `\n=== KONTEN DARI SUMBER LAIN (${sumberLain}) ===\n${otherRes.text || '[Gagal mengambil konten dari sumber lain]'}`
          : ''
      ].join('\n').trim()
      setOriginalText(combined)
      toast.success('Teks berhasil ditarik! Silakan review dan edit sebelum proses.')
    } catch {
      toast.error('Gagal menarik teks dari URL')
    } finally {
      setIsScraping(false)
    }
  }

  const handleTranslate = async () => {
    if (!originalText.trim()) {
      toast.error('Teks Asli kosong — isi dulu dengan Tarik Teks atau paste manual')
      return
    }
    setIsTranslating(true)
    try {
      const res = await translateFreeAction(originalText)
      if (res.error) {
        toast.error(res.error)
      } else {
        setTranslatedText(res.translated || '')
        setViewMode('translated')
        toast.success('Teks berhasil diterjemahkan! Tampilan beralih ke Terjemahan.')
      }
    } catch {
      toast.error('Terjemahan gagal — coba lagi')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleProcess = async () => {
    if (!fixJudul || !linkSumber) {
      toast.error('Judul dan Link Sumber wajib diisi')
      return
    }

    setIsProcessing(true)
    try {
      const res = await processContentAction({
        fixJudul,
        linkSumber,
        sumberLain,
        highlights,
        customPrompt,
        rawScrapedText: viewMode === 'translated' && translatedText ? translatedText : originalText,
        selectedWpSiteId: selectedWpSiteId || undefined,
        selectedApiKeyId: selectedApiKeyId || undefined,
        selectedModelOverride: selectedModelOverride || undefined
      })

      if (res.error || !res.data) {
        toast.error(res.error || 'Failed to generate content')
        return
      }

      toast.success('Content generated successfully!')
      setGeneratedTitles(res.data.titles)
      setSelectedTitle(res.data.titles[0] || '')
      setMetaDesc(res.data.meta_desc)
      setRawHtml(res.data.content_raw_html)
      setSelectedTags(res.data.selected_tags)
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDraft = async () => {
    if (!selectedTitle || !rawHtml) {
      toast.error('Mohon generate konten terlebih dahulu')
      return
    }
    if (!thumbnail) {
      toast.error('Thumbnail wajib diunggah')
      return
    }

    setIsDrafting(true)
    const formData = new FormData()
    formData.append('thumbnail', thumbnail)
    formData.append('title', selectedTitle)
    formData.append('content', rawHtml)
    formData.append('excerpt', metaDesc)
    formData.append('tags', JSON.stringify(selectedTags.map(t => t.id)))
    formData.append('categories', JSON.stringify(selectedCategoryIds))
    formData.append('selectedWpSiteId', selectedWpSiteId)
    
    // Set Image Metadata from Title & Sumber Gambar
    formData.append('image_alt', selectedTitle)
    formData.append('image_title', selectedTitle)
    formData.append('image_caption', sumberGambarUrl)

    try {
      const res = await draftPostAction(formData)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Post successfully drafted to WordPress!')
      }
    } catch {
      toast.error('An unexpected error occurred during drafting')
    } finally {
      setIsDrafting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* LEFT COLUMN */}
      <div className="glass-panel p-6 space-y-5">
        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-blue-400">
            Content Inputs
          </h2>
          <button onClick={handleClearForm} className="text-xs text-red-500 py-1 px-3 border border-red-200 rounded-md hover:bg-red-50 transition-colors flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Bersihkan
          </button>
        </div>
        
        <div className="space-y-4">
          
          

          <div>
            <div className="flex justify-between items-end">
              <label className="text-sm font-medium text-gray-700">Fix Judul</label>
              <span className="text-xs text-gray-500 font-medium">{fixJudul.trim() ? fixJudul.trim().split(/\s+/).length : 0} kata</span>
            </div>
            <input 
              value={fixJudul} onChange={e => setFixJudul(e.target.value)} 
              className="input-field mt-1" placeholder="Judul artikel utama" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Link Sumber</label>
              <input 
                value={linkSumber} onChange={e => setLinkSumber(e.target.value)} 
                className="input-field mt-1" placeholder="https://..." 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
                Sumber Lain 
                <span className="text-xs text-gray-500 font-normal">(Opsional)</span>
              </label>
              <input 
                value={sumberLain} onChange={e => setSumberLain(e.target.value)} 
                className="input-field mt-1" placeholder="https://..." 
              />
            </div>
          </div>

          {/* ACTION BUTTONS: TARIK TEKS + TERJEMAHKAN */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleScrape}
              disabled={isScraping || !linkSumber}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-blue-400/40 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-400/60 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScraping ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menarik Teks...</>
              ) : (
                <><Download className="w-4 h-4" /> Tarik Teks dari URL</>
              )}
            </button>
            <button
              type="button"
              onClick={handleTranslate}
              disabled={isTranslating || !originalText.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-violet-400/40 text-violet-400 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-400/60 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTranslating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menerjemahkan...</>
              ) : (
                <><Languages className="w-4 h-4" /> Terjemahkan (Gratis)</>
              )}
            </button>
          </div>

          {/* REVIEW & EDIT SCRAPED TEXT — with toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">
                Review &amp; Edit Teks Sumber
              </label>
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-md p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('original')}
                  className={`px-3 py-1 rounded-sm transition-colors font-medium ${
                    viewMode === 'original'
                      ? 'bg-white shadow text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🇬🇧 Teks Asli
                </button>
                <button
                  type="button"
                  onClick={() => translatedText !== null && setViewMode('translated')}
                  disabled={translatedText === null}
                  className={`px-3 py-1 rounded-sm transition-colors font-medium ${
                    viewMode === 'translated'
                      ? 'bg-white shadow text-violet-600'
                      : 'text-gray-500 hover:text-gray-700'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  🇮🇩 Terjemahan
                </button>
              </div>
            </div>
            <p className="text-xs text-amber-600 mb-2">
              ⚠️ Silakan hapus kalimat iklan atau teks yang tidak relevan sebelum diproses AI.
              {viewMode === 'translated' && (
                <span className="ml-2 text-violet-500 font-medium">
                  (Membaca terjemahan — AI akan menerima teks aktif sesuai tampilan ini)
                </span>
              )}
            </p>
            <SourceTextEditor
              value={viewMode === 'translated' && translatedText !== null ? translatedText : originalText}
              onChange={(val) =>
                viewMode === 'translated'
                  ? setTranslatedText(val)
                  : setOriginalText(val)
              }
              minHeight="500px"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Yang Harus Dihighlight</label>
            <textarea 
              value={highlights} onChange={e => setHighlights(e.target.value)} 
              className="input-field mt-1 min-h-[100px] resize-y" 
              placeholder="Poin penting yang wajib dibahas AI..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mt-4">Full System Prompt (Bisa Diedit)</label>
            <p className="text-[10px] text-gray-500 mb-2">Edit aturan judul, HTML, atau gaya bahasa. (Prompt Tag diatur di Settings).</p>
            <ArticleHtmlEditor 
              value={customPrompt} onChange={setCustomPrompt} 
              minHeight="300px" 
            />
          </div>

          <div>
             <label className="text-sm font-medium text-gray-700">Thumbnail (1280x720)</label>
             <div 
               className="mt-1 flex justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-6 hover:border-blue-500 transition-colors bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer relative min-h-[160px] items-center"
               onPaste={handlePaste}
               onMouseEnter={() => setIsHoveringThumbnail(true)}
               onMouseLeave={() => setIsHoveringThumbnail(false)}
               tabIndex={0}
             >
                {thumbnail ? (
                  <div className="text-center w-full">
                     <img src={URL.createObjectURL(thumbnail)} alt="Preview" className="mx-auto h-32 w-auto object-cover rounded-md mb-2 border border-gray-200 shadow-sm" />
                     <p className="text-xs font-medium text-gray-700 truncate max-w-[200px] mx-auto">{thumbnail.name}</p>
                     <p className="text-[10px] text-gray-500 mt-1">Tekan Ctrl+V (Paste) atau klik di sini untuk mengganti gambar</p>
                  </div>
                ) : (
                  <div className="text-center">
                     <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" aria-hidden="true" />
                     <div className="flex text-sm leading-6 text-gray-600 items-center justify-center gap-1">
                        <span className="font-semibold text-blue-600">Klik untuk upload</span>
                        <p>atau tekan Ctrl+V (Paste)</p>
                     </div>
                     <p className="text-xs leading-5 text-gray-500">
                       PNG, JPG up to 5MB
                     </p>
                  </div>
                )}
                
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  accept="image/*" 
                  title="Upload atau Paste Gambar"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setUncroppedFile(file)
                      e.target.value = ''
                    }
                  }} 
                />
             </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200/50">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Sumber Gambar</label>
            <div className="flex gap-4 mb-3">
              {['Instagram', 'X.com', 'Site'].map(type => (
                <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    type="radio" name="sumberGambarType" value={type} 
                    checked={sumberGambarType === type} onChange={() => handleSumberGambarTypeChange(type)}
                    className="accent-blue-500"
                  />
                  {type}
                </label>
              ))}
            </div>
            <input 
              value={sumberGambarUrl} onChange={e => setSumberGambarUrl(e.target.value)} 
              className="input-field" placeholder="URL Sumber Gambar..." 
            />
          </div>
        </div>

        <button 
          onClick={handleProcess} disabled={isProcessing}
          className="primary-btn w-full mt-6 py-3"
        >
          {isProcessing ? (
             <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
             <Sparkles className="w-5 h-5" />
          )}
          Proses dengan AI
        </button>
      </div>

      {/* RIGHT COLUMN */}
      <div className="glass-panel p-6 space-y-5">
        <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-gray-200 pb-2 text-emerald-400">
          Review & Output
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Reference Judul</label>
            {generatedTitles.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                  {generatedTitles.map((title, idx) => (
                    <label key={idx} className="flex items-start gap-3 p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors bg-white border border-gray-200">
                      <input 
                        type="radio" 
                        name="selectedTitle" 
                        value={title} 
                        checked={selectedTitle === title}
                        onChange={() => setSelectedTitle(title)}
                        className="accent-emerald-500 w-4 h-4 mt-1 flex-shrink-0"
                      />
                      <span className="text-sm font-medium leading-tight">{title}</span>
                    </label>
                  ))}
                </div>
                <div>
                   <div className="flex justify-between items-end mb-1">
                     <label className="text-xs font-semibold text-emerald-700 block flex items-center gap-1">Judul Final (Bisa Diedit):</label>
                     <span className="text-xs text-emerald-600/80 font-medium">{selectedTitle.trim() ? selectedTitle.trim().split(/\s+/).length : 0} kata</span>
                   </div>
                   <input 
                     value={selectedTitle} onChange={e => setSelectedTitle(e.target.value)} 
                     className="input-field border-emerald-300 focus:ring-emerald-500 bg-emerald-50/30 font-medium text-emerald-900" 
                     placeholder="Pilih dari atas atau ketik judul Anda sendiri..."
                   />
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic p-4 bg-gray-100/50 rounded-lg text-center border border-dashed border-gray-200">
                Judul akan muncul di sini setelah diproses
              </div>
            )}
          </div>

          <div>
             <label className="text-sm font-medium text-gray-700">Meta Description</label>
             <textarea 
               value={metaDesc} onChange={e => setMetaDesc(e.target.value)} 
               className="input-field mt-1 min-h-[80px] bg-white text-sm" 
               placeholder="Meta description dari AI..."
             />
          </div>

          <div>
             <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                   Isi Artikel
                </label>
                <div className="flex bg-gray-100 rounded-md p-1">
                   <button
                     type="button"
                     onClick={() => setPreviewMode('preview')}
                     className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors \${previewMode === 'preview' ? 'bg-white shadow relative text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                   >
                     👁️ Preview
                   </button>
                   <button
                     type="button"
                     onClick={() => setPreviewMode('html')}
                     className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors \${previewMode === 'html' ? 'bg-white shadow relative text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                   >
                     📝 Raw HTML
                   </button>
                </div>
             </div>
             
             {previewMode === 'html' ? (
                <textarea 
                  value={rawHtml} onChange={e => setRawHtml(e.target.value)} 
                  className="input-field min-h-[400px] font-mono text-xs bg-gray-50 text-gray-800" 
                  placeholder="<p>Konten artikel...</p>"
                />
             ) : (
                <ArticleHtmlEditor
                  value={rawHtml}
                  onChange={setRawHtml}
                  minHeight="400px"
                />
             )}
          </div>

          {/* WP SITE + API KEY SELECTORS */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">⚙️ Pilih Integrasi</h3>

            {/* WP Site */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Situs WordPress</label>
              {wpSites.length === 0 ? (
                <div className="text-xs text-gray-400 italic">Belum ada situs terkonfigurasi</div>
              ) : (
                <select
                  className="input-field"
                  value={selectedWpSiteId}
                  onChange={e => setSelectedWpSiteId(e.target.value)}
                >
                  {wpSites.map(s => (
                    <option key={s.id} value={s.id}>{s.label}{s.is_active ? ' (Default)' : ''}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Pilih Model AI */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Pilih Model AI</label>
              <select
                 className="input-field"
                 value={selectedModelOverride}
                 onChange={e => {
                   const newVal = e.target.value;
                   setSelectedModelOverride(newVal);
                   const effectiveModel = newVal || activeModel;
                   let reqType = 'gemini';
                   if (effectiveModel === 'openrouter') reqType = 'openrouter';
                   if (effectiveModel === 'qwen3.5-flash') reqType = 'dashscope';
                   const firstKey = apiKeyOptions.find(k => k.type === reqType && k.is_active) || apiKeyOptions.find(k => k.type === reqType);
                   if (firstKey) setSelectedApiKeyId(firstKey.id);
                 }}
              >
                 <option value="">Gunakan Default dari Settings</option>
                 <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash-Lite Preview</option>
                 <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                 <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                 <option value="openrouter">OpenRouter (Sesuai Settings)</option>
                 <option value="qwen3.5-flash">Alibaba Qwen 3.5 Flash</option>
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">API Key</label>
              {(() => {
                const effectiveModel = selectedModelOverride || activeModel;
                let reqType = 'gemini';
                if (effectiveModel === 'openrouter') reqType = 'openrouter';
                if (effectiveModel === 'qwen3.5-flash') reqType = 'dashscope';

                const filteredKeys = apiKeyOptions.filter(k => k.type === reqType)
                return filteredKeys.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">Belum ada API key terkonfigurasi</div>
                ) : (
                  <select
                    className="input-field"
                    value={selectedApiKeyId}
                    onChange={e => setSelectedApiKeyId(e.target.value)}
                  >
                    {filteredKeys.map(k => (
                      <option key={k.id} value={k.id}>[{k.type === 'gemini' ? 'Gemini' : k.type === 'openrouter' ? 'OpenRouter' : 'DashScope'}] {k.label}</option>
                    ))}
                  </select>
                )
              })()}
            </div>

            {/* Kategori */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Kategori WordPress</label>
              {isFetchingData ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Memuat kategori...
                </div>
              ) : categories.length === 0 ? (
                <div className="text-xs text-red-500 py-1">Belum ada kategori / Koneksi WP gagal.</div>
              ) : (
                <select
                  className="input-field"
                  value={selectedCategoryIds[0] || ''}
                  onChange={(e) => setSelectedCategoryIds([Number(e.target.value)])}
                >
                  <option value="" disabled>Pilih Kategori...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
             <label className="text-sm font-medium text-gray-700 mb-2 block">Semantic Tags Matched</label>
             {selectedTags.length > 0 ? (
               <div className="flex flex-wrap gap-2">
                 {selectedTags.map(tag => (
                   <span key={tag.id} className="flex items-center gap-1 px-3 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full text-xs font-medium">
                     {tag.name}
                     <button onClick={() => removeTag(tag)} className="hover:text-red-500 ml-1 transition-colors rounded-full p-0.5" title="Hapus Tag & Lepas Link">
                       <X className="w-3 h-3" />
                     </button>
                   </span>
                 ))}
               </div>
             ) : (
                <div className="text-xs text-gray-500 italic">Belum ada tag yang dipilih</div>
             )}
          </div>
        </div>

        <button 
          onClick={handleDraft} disabled={isDrafting || !rawHtml}
          className="secondary-btn w-full mt-6 py-3 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/50"
        >
          {isDrafting ? (
             <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
             <Send className="w-5 h-5" />
          )}
          Draft to WordPress
        </button>
      </div>

      {/* CROPPER MODAL */}
      {uncroppedFile && (
        <ImageCropper
          imageFile={uncroppedFile}
          onCancel={() => setUncroppedFile(null)}
          onCropComplete={(blob) => {
            const finalFile = new File([blob], uncroppedFile.name.replace(/\.[^/.]+$/, "") + "-cropped.jpg", {
              type: 'image/jpeg'
            })
            setThumbnail(finalFile)
            setUncroppedFile(null)
          }}
        />
      )}
    </div>
  )
}
