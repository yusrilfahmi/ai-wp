'use client'

import { useState, useEffect } from 'react'
import { processImageContentAction } from '@/app/actions/process-image-content'
import { draftPostAction } from '@/app/actions/draft-post'
import { getWpCategoriesAction, getWpSiteOptionsAction, getApiKeyOptionsAction } from '@/app/actions/get-wp-data'
import { ImageCropper } from '@/components/image-cropper'
import { ArticleHtmlEditor } from '@/components/rich-text-editor'
import { toast } from 'sonner'
import { Loader2, Image as ImageIcon, Send, Sparkles, Trash2, X, FileImage, Plus, Edit, Check } from 'lucide-react'

const MODES = [
  'Hasil Pertandingan (Sepak Bola)',
  'Hasil Sementara (Sepak Bola)',
  'Klasemen',
  'Top Skor Terbaru',
  'Bagan Turnamen (Bracket)',
  'Hasil Laga Esports (Mobile Legends)',
  'Jadwal',
  'Rating',
  'Artikel Lain'
]

const getDefaultModePrompt = (modeName: string) => {
  let specificRules = "";
  let specificTitle = "";

  if (modeName === 'Hasil Pertandingan') {
    specificRules = 'Do NOT use the word "Akhir" in titles. Use "Hasil [Tim A] vs [Tim B] [Skor]".';
    specificTitle = '<em>Contoh: "Hasil Manchester City vs Real Madrid 1-2: Puncak Drama VAR dan Gol Telat Vinicius Junior Benamkan Sepuluh Pemain Tuan Rumah"</em>';
  } else if (modeName === 'Hasil Sementara') {
    specificRules = 'Do NOT use the word "Akhir" in titles. Use "Hasil [Tim A] vs [Tim B] [Skor]".';
    specificTitle = '<em>Contoh: "Hasil Sementara Indonesia vs Saint Kitts and Nevis 2-0: Dwigol Beckham Putra Bawa Skuad Garuda Memimpin di Paruh Pertama"</em>';
  } else if (modeName === 'Klasemen') {
    specificRules = 'You MUST include an HTML table representing the standings based on the image. Masukkan lengkap klasemen semua tim.';
    specificTitle = '<em>Contoh: "Klasemen Lengkap Championship Liga Indonesia Grup A Pekan ke-22: Gilas FC Bekasi City 4-0, Garudayaksa Terus Bayangi Adhyaksa"</em>';
  } else if (modeName === 'Top Skor') {
    specificRules = 'You MUST include an HTML table representing the top scorers based on the image. Masukkan lengkap daftar top skor.';
    specificTitle = '<em>Contoh: "Top Skor Liga 1 Musim 2024/2025: Cetak Hattrick, David da Silva Langsung Puncaki Daftar Pencetak Gol Terbanyak"</em>';
  } else if (modeName === 'Rating Pemain' || modeName === 'Rating') {
    specificRules = 'Do NOT use the word "Rapor". Use "Penilaian", "Nilai", or "Evaluasi".<br>You MUST include an HTML table (Posisi | Nama Pemain | Nilai). Tulis semua rating pemain ya, dan pisahkan satu tim satu sub bab.';
    specificTitle = '<em>Contoh: "Penilaian Pemain Chelsea vs Paris Saint-Germain: Matvei Safonov Tampil Sempurna, Lini Belakang Tuan Rumah Terpuruk"</em>';
  } else if (modeName === 'Bagan Turnamen') {
    specificRules = 'Deskripsikan dengan detail bagan turnamen dari gambar.';
    specificTitle = '<em>Contoh: "Bagan Perempat Final Liga Champions: Singkirkan Bayer Leverkusen, Arsenal Tantang Sporting CP"</em>';
  } else if (modeName === 'Jadwal') {
    specificRules = 'PENTING: Di mode ini Anda membuat artikel preview/jadwal laga. Gambar pertama = Jadwal Utama, Gambar kedua = Klasemen, Gambar ketiga = Statistik Head to Head. Rangkum info penting dari ketiganya secara urut.';
    specificTitle = '<em>Contoh: "Jadwal Pertandingan Liga Inggris: Arsenal Menantang Manchester City di Emirates Stadium"</em>';
  } else if (modeName === 'Hasil Laga Esports (Mobile Legends)') {
    specificRules = 'Do not mention player names individually for hero drafts, just mention the team\'s overall hero composition.<br>ATURAN MUTLAK HERO DRAFT: JANGAN MENGARANG BEBAS NAMA HERO! AI harus melihat 1 per 1 wajah kecil hero yang ada di screenshot laga, lalu MENCOCOKKAN SECARA VISUAL SATU PER SATU wajah/ikon tersebut ke dalam daftar wajah yang ada di gambar referensi hero. Hanya tulis nama hero yang fotonya 100% identik di gambar referensi. Jika tidak yakin, tulis \'beberapa hero andalan\'. JANGAN menyebut hero yang wajahnya tidak ada!<br>Jika ada gambar klasemen tambahan, bahas klasemen tersebut.';
    specificTitle = '<em>Contoh: "Hasil Bigetron Alpha vs Alter Ego 2-1: Sengit Hingga Gim Ketiga, Skuad Robot Merah Kunci Kemenangan"</em>';
  } else {
    // Artikel Lain
    specificRules = 'Focus entirely on fulfilling the specific instructions from the MUTLAK HIGHLIGHT section provided by the user. Maintain the same high-quality journalism style as other modes.';
    specificTitle = '<em>Contoh: Judul disesuaikan dengan fokus perintah pada instruksi MUTLAK HIGHLIGHT. Bebas namun tetap ikuti PUEBI/EYD SPOK journalism format.</em>';
  }

  return `<p>You are an expert sports journalist writing hard news articles in formal Indonesian (Bahasa Indonesia baku). SELURUH OUTPUT WAJIB DALAM BAHASA INDONESIA. Jangan gunakan bahasa lain selain Bahasa Indonesia dalam artikel, judul, meta description, maupun tag reasoning.</p>
<h3>CRITICAL RULES FOR CONTENT &amp; FORMATTING:</h3>
<ol>
  <li><strong>MODE-SPECIFIC RULES (You are writing for mode: "${modeName}"):</strong><br>${specificRules}</li>
  <li><strong>PLAYER NAMES &amp; TERMINOLOGY:</strong>
    <ul>
      <li>NEVER abbreviate player names (e.g., "Putra B." MUST be expanded to "Beckham Putra").</li>
      <li>Translate foreign terms to standard Indonesian (e.g., injury time = masa tambahan waktu, leg = pertemuan).</li>
    </ul>
  </li>
  <li><strong>HTML ARTICLE STRUCTURE (For "content_raw_html"):</strong>
    <ul>
      <li>The opening section before the first subheading MUST have at least 3 distinct paragraphs (&lt;p&gt;).</li>
      <li>Include at least 2 subheadings using &lt;h2&gt; tags.</li>
      <li>Under EACH &lt;h2&gt; subheading, write at least 3 distinct paragraphs (&lt;p&gt;).</li>
      <li>Include properly formatted &lt;table&gt; tags if required by the mode.</li>
      <li>NEVER put internal links or &lt;a&gt; tags inside &lt;h2&gt; or &lt;h3&gt; subheadings.</li>
    </ul>
  </li>
  <li><strong>TITLES (STRICT FEW-SHOT EXAMPLES):</strong>
    <ul>
      <li>Generate EXACTLY 5 reference titles.</li>
      <li>BATAS MAKSIMAL: Setiap judul MAKSIMAL 14 KATA. Jika lebih dari 14 kata, padatkan agar tetap informatif.</li>
      <li>PUEBI/EYD TITLE CASE: Semua kata hubung dan kata depan WAJIB ditulis dengan huruf kecil di judul!</li>
      <li>GAYA BAHASA JURNALISTIK: Gunakan diksi berita gaya olahraga yang luwes dan "punchy". Hindari kata awalan formal yang kaku.</li>
      <li>FORMATTING: Titles MUST use a "Two-Part Structure" separated by a colon (:). Part 1 is the Core Fact. Part 2 is the Key Highlight in SPOK structure.</li>
      <li>NEVER use clickbait, question marks, or exaggerated words.</li>
      <li>YOU MUST MIMIC THIS EXACT PATTERN BASED ON THE MODE:<br>${specificTitle}</li>
    </ul>
  </li>
</ol>`;
};

export function ArtikelModeClient() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDrafting, setIsDrafting] = useState(false)
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
  
  const [modeArtikel, setModeArtikel] = useState(MODES[0])
  const [imageData, setImageData] = useState<File | null>(null)
  const [highlights, setHighlights] = useState('')
  const [isHoveringImageData, setIsHoveringImageData] = useState(false)
  const [isHoveringExtraImageData, setIsHoveringExtraImageData] = useState(false)
  const [isHoveringThumbnail, setIsHoveringThumbnail] = useState(false)
  
  const [extraImageData, setExtraImageData] = useState<File | null>(null)
  const [headToHeadImageData, setHeadToHeadImageData] = useState<File | null>(null)
  const [isHoveringHeadToHeadData, setIsHoveringHeadToHeadData] = useState(false)
  const [penjelasanGambar, setPenjelasanGambar] = useState('')
  const [dynamicImages, setDynamicImages] = useState<File[]>([])
  const [isHoveringDynamicAdd, setIsHoveringDynamicAdd] = useState(false)
  const [uncroppedFile, setUncroppedFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [previewMode, setPreviewMode] = useState<'preview' | 'html'>('preview')
  
  const [sumberGambarType, setSumberGambarType] = useState('Instagram')
  const [sumberGambarUrl, setSumberGambarUrl] = useState('Foto: instagram.com/')

  const [modeNotes, setModeNotes] = useState<Record<string, {id: string, text: string}[]>>({})
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])
  const [newNoteText, setNewNoteText] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [modePrompts, setModePrompts] = useState<Record<string, string>>({})

  useEffect(() => {
    const savedNotes = localStorage.getItem('ai_wp_mode_notes')
    if (savedNotes) {
      try {
        setModeNotes(JSON.parse(savedNotes))
      } catch (e) {}
    }
    const savedPrompts = localStorage.getItem('ai_wp_mode_prompts')
    if (savedPrompts) {
      try {
        setModePrompts(JSON.parse(savedPrompts))
      } catch (e) {}
    }
  }, [])
  
  const handlePromptChange = (val: string) => {
    setModePrompts(prev => {
      const newPrompts = { ...prev, [modeArtikel]: val }
      localStorage.setItem('ai_wp_mode_prompts', JSON.stringify(newPrompts))
      return newPrompts
    })
  }
  
  const handleSaveNote = () => {
    if (!newNoteText.trim()) return
    setModeNotes(prev => {
      const currentNotes = prev[modeArtikel] || []
      let updatedNotes
      if (editingNoteId) {
        updatedNotes = currentNotes.map(n => n.id === editingNoteId ? { ...n, text: newNoteText } : n)
      } else {
        updatedNotes = [...currentNotes, { id: Date.now().toString(), text: newNoteText }]
      }
      const newModeNotes = { ...prev, [modeArtikel]: updatedNotes }
      localStorage.setItem('ai_wp_mode_notes', JSON.stringify(newModeNotes))
      return newModeNotes
    })
    setNewNoteText('')
    setEditingNoteId(null)
  }

  const handleDeleteNote = (id: string) => {
    setModeNotes(prev => {
      const currentNotes = prev[modeArtikel] || []
      const updatedNotes = currentNotes.filter(n => n.id !== id)
      const newModeNotes = { ...prev, [modeArtikel]: updatedNotes }
      localStorage.setItem('ai_wp_mode_notes', JSON.stringify(newModeNotes))
      return newModeNotes
    })
    setSelectedNoteIds(prev => prev.filter(selectedId => selectedId !== id))
  }

  const handleEditNote = (note: {id: string, text: string}) => {
    setNewNoteText(note.text)
    setEditingNoteId(note.id)
  }
  
  const handleToggleNote = (id: string) => {
    setSelectedNoteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  useEffect(() => {
    const saved = localStorage.getItem('ai_wp_artikel_draft')
    if (saved) {
      try {
        const d = JSON.parse(saved)
        if (d.modeArtikel) setModeArtikel(d.modeArtikel)
        if (d.highlights) setHighlights(d.highlights)
        if (d.sumberGambarType) setSumberGambarType(d.sumberGambarType)
        if (d.sumberGambarUrl) setSumberGambarUrl(d.sumberGambarUrl)
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('ai_wp_artikel_draft', JSON.stringify({
      modeArtikel, highlights, sumberGambarType, sumberGambarUrl
    }))
  }, [modeArtikel, highlights, sumberGambarType, sumberGambarUrl])

  const handleClearForm = () => {
    setModeArtikel(MODES[0])
    setHighlights('')
    setPenjelasanGambar('')
    setImageData(null)
    setExtraImageData(null)
    setHeadToHeadImageData(null)
    setDynamicImages([])
    setThumbnail(null)
    setSumberGambarType('Instagram'); setSumberGambarUrl('Foto: instagram.com/');
    localStorage.removeItem('ai_wp_artikel_draft');
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

  const handlePasteImageData = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
       if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile()
          if (file) setImageData(file)
          break
       }
    }
  }

  const handlePasteThumbnail = (e: React.ClipboardEvent) => {
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
      if (isHoveringImageData && e.clipboardData) {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
           if (items[i].type.indexOf('image') !== -1) {
              const file = items[i].getAsFile()
              if (file) {
                 setImageData(file)
                 e.preventDefault()
              }
              break
           }
        }
      } else if (isHoveringThumbnail && e.clipboardData) {
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
      } else if (isHoveringExtraImageData && e.clipboardData) {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
           if (items[i].type.indexOf('image') !== -1) {
              const file = items[i].getAsFile()
              if (file) {
                 setExtraImageData(file)
                 e.preventDefault()
              }
              break
           }
        }
      } else if (isHoveringHeadToHeadData && e.clipboardData) {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
           if (items[i].type.indexOf('image') !== -1) {
              const file = items[i].getAsFile()
              if (file) {
                 setHeadToHeadImageData(file)
                 e.preventDefault()
              }
              break
           }
        }
      } else if (isHoveringDynamicAdd && e.clipboardData) {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
           if (items[i].type.indexOf('image') !== -1) {
              const file = items[i].getAsFile()
              if (file) {
                 setDynamicImages(prev => [...prev, file])
                 e.preventDefault()
              }
              break
           }
        }
      }
    }
    document.addEventListener('paste', handleGlobalPaste)
    return () => document.removeEventListener('paste', handleGlobalPaste)
  }, [isHoveringImageData, isHoveringThumbnail, isHoveringExtraImageData, isHoveringHeadToHeadData, isHoveringDynamicAdd])

  // Right form state (Outputs)
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([])
  const [selectedTitle, setSelectedTitle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [rawHtml, setRawHtml] = useState('')
  const [selectedTags, setSelectedTags] = useState<{id: number, name: string, link: string}[]>([])

  useEffect(() => {
    async function loadWpData() {
      setIsFetchingData(true)
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

  const handleProcess = async () => {
    if (!imageData) {
      toast.error('Image Data wajib diunggah untuk dianalisis oleh AI')
      return
    }

    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('imageData', imageData)
      if (extraImageData) formData.append('extraImageData', extraImageData)
      if (headToHeadImageData) formData.append('headToHeadImageData', headToHeadImageData)
      dynamicImages.forEach(img => formData.append('dynamicImages', img))
      formData.append('modeArtikel', modeArtikel)
      formData.append('sumberGambarUrl', sumberGambarUrl)

      const activeNotes = (modeNotes[modeArtikel] || [])
        .filter(n => selectedNoteIds.includes(n.id))
        .map(n => n.text)
      const finalHighlights = [highlights, ...activeNotes].filter(Boolean).join('\n\n')

      if (finalHighlights) formData.append('highlights', finalHighlights)
      if (penjelasanGambar) formData.append('penjelasanGambar', penjelasanGambar)
      if (selectedWpSiteId) formData.append('selectedWpSiteId', selectedWpSiteId)
      if (selectedApiKeyId) formData.append('selectedApiKeyId', selectedApiKeyId)
      if (selectedModelOverride) formData.append('selectedModelOverride', selectedModelOverride)
      
      const currentPrompt = modePrompts[modeArtikel] !== undefined ? modePrompts[modeArtikel] : getDefaultModePrompt(modeArtikel)
      formData.append('customPrompt', currentPrompt)

      const res = await processImageContentAction(formData)

      if (res?.error || !res?.data) {
        toast.error(res?.error || 'Failed to generate content')
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
      toast.error('Thumbnail (Featured Image) wajib diunggah')
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
            Image Content Inputs
          </h2>
          <button onClick={handleClearForm} className="text-xs text-red-500 py-1 px-3 border border-red-200 rounded-md hover:bg-red-50 transition-colors flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Bersihkan
          </button>
        </div>
        
        <div className="space-y-4">
          
          {/* Main Image Data for AI */}
          <div>
             <label className="text-sm font-medium text-gray-700">{modeArtikel === 'Jadwal' ? 'Gambar Utama (Jadwal Pertandingan)' : 'Image Data (Untuk dianalisis AI)'}</label>
             <div 
               className="mt-1 flex justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-6 hover:border-blue-500 transition-colors bg-blue-50/50 focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer relative min-h-[160px] items-center"
               onPaste={handlePasteImageData}
               onMouseEnter={() => setIsHoveringImageData(true)}
               onMouseLeave={() => setIsHoveringImageData(false)}
               tabIndex={0}
             >
                {imageData ? (
                  <div className="text-center w-full">
                     <img src={URL.createObjectURL(imageData)} alt="Data Preview" className="mx-auto h-40 w-auto object-contain rounded-md mb-2 border border-gray-200 shadow-sm" />
                     <p className="text-xs font-medium text-gray-700 truncate max-w-[200px] mx-auto">{imageData.name}</p>
                     <p className="text-[10px] text-gray-500 mt-1">Tekan Ctrl+V atau klik untuk mengganti gambar data</p>
                  </div>
                ) : (
                  <div className="text-center">
                     <FileImage className="mx-auto h-12 w-12 text-blue-400 mb-3" aria-hidden="true" />
                     <div className="flex text-sm leading-6 text-gray-600 items-center justify-center gap-1">
                        <span className="font-semibold text-blue-600">Klik untuk upload data</span>
                        <p>atau tekan Ctrl+V</p>
                     </div>
                     <p className="text-xs leading-5 text-gray-500">
                       Screenshot Klasemen, Hasil, Rating dll
                     </p>
                  </div>
                )}
                
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  accept="image/*" 
                  title="Upload atau Paste Gambar Data"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setImageData(file)
                      e.target.value = ''
                    }
                  }} 
                />
             </div>
          </div>

           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200/50">
             <label className="text-sm font-medium text-gray-700 mb-2 block">Pilih Mode Artikel</label>
             <div className="flex flex-col gap-2">
                {MODES.map(mode => (
                  <label key={mode} className="flex items-center gap-3 p-2 rounded hover:bg-white cursor-pointer transition-colors border border-transparent hover:border-gray-200">
                    <input 
                      type="radio" name="modeArtikel" value={mode} 
                      checked={modeArtikel === mode} onChange={() => setModeArtikel(mode)}
                      className="accent-blue-500 w-4 h-4 mt-0.5"
                    />
                    <span className="text-sm font-medium text-gray-800">{mode}</span>
                  </label>
                ))}
             </div>
          </div>

          {modeArtikel === 'Hasil Laga Esports (Mobile Legends)' && (
            <div className="space-y-4 bg-blue-50/30 p-4 rounded-xl border border-blue-100">
               <div>
                  <label className="text-sm font-medium text-blue-800 block">Gambar Tambahan (Klasemen dll)</label>
                  <p className="text-[10px] text-blue-600 mb-2 mt-0.5">Opsional. Data klasemen terbaru atau penunjang artikel laga esports.</p>
                  <div 
                    className="mt-1 flex justify-center rounded-lg border-2 border-dashed border-blue-300 px-6 py-4 hover:border-blue-500 transition-colors bg-white focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer relative min-h-[120px] items-center"
                    onMouseEnter={() => setIsHoveringExtraImageData(true)}
                    onMouseLeave={() => setIsHoveringExtraImageData(false)}
                    tabIndex={0}
                  >
                     {extraImageData ? (
                       <div className="text-center w-full">
                          <img src={URL.createObjectURL(extraImageData)} alt="Extra Data Preview" className="mx-auto h-32 w-auto object-contain rounded-md mb-2 border border-gray-200 shadow-sm" />
                          <p className="text-xs font-medium text-gray-700 truncate max-w-[200px] mx-auto">{extraImageData.name}</p>
                       </div>
                     ) : (
                       <div className="text-center">
                          <FileImage className="mx-auto h-8 w-8 text-blue-300 mb-2" aria-hidden="true" />
                          <div className="flex text-xs leading-6 text-gray-600 items-center justify-center gap-1">
                             <span className="font-medium text-blue-600">Klik / Paste (Ctrl+V)</span>
                          </div>
                          <p className="text-[10px] text-gray-400">Silakan area ini disorot lalu paste gambar</p>
                       </div>
                     )}
                     
                     <input 
                       type="file" 
                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                       accept="image/*" 
                       onChange={e => {
                         const file = e.target.files?.[0]
                         if (file) {
                           setExtraImageData(file)
                           e.target.value = ''
                         }
                       }} 
                     />
                  </div>
               </div>

               <div>
                 <label className="text-sm font-medium text-blue-800 block">
                    Penjelasan Gambar
                    <span className="text-xs text-blue-500 font-normal ml-1">(Opsional)</span>
                 </label>
                 <textarea 
                   value={penjelasanGambar} onChange={e => setPenjelasanGambar(e.target.value)} 
                   className="input-field mt-1 min-h-[60px] text-sm bg-white" 
                   placeholder="Beri arahan tambahan pada AI tentang gambar khusus MLBB ini..."
                 />
               </div>
            </div>
          )}

          {imageData && (
            <div className="space-y-4 bg-purple-50/30 p-4 rounded-xl border border-purple-100">
               <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-purple-800">Gambar Data Tambahan</label>
                  <span className="text-[10px] text-purple-500">{dynamicImages.length} gambar tambahan</span>
               </div>

               {dynamicImages.map((img, idx) => (
                  <div key={idx} className="relative mt-2 flex justify-center rounded-lg border-2 border-dashed border-purple-300 px-6 py-4 bg-white min-h-[120px] items-center">
                     <div className="text-center w-full">
                        <img src={URL.createObjectURL(img)} alt={`Gambar ${idx + 2}`} className="mx-auto h-32 w-auto object-contain rounded-md mb-2 border border-gray-200 shadow-sm" />
                        <p className="text-xs font-medium text-gray-700 truncate max-w-[200px] mx-auto">Gambar Data {idx + 2}</p>
                     </div>
                     <button
                       type="button"
                       onClick={() => setDynamicImages(prev => prev.filter((_, i) => i !== idx))}
                       className="absolute top-2 right-2 p-1 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
                       title="Hapus gambar ini"
                     >
                       <X className="w-4 h-4" />
                     </button>
                  </div>
               ))}

               <div
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border-2 border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50 cursor-pointer transition-all text-sm font-medium text-purple-700 relative min-h-[60px]"
                  onMouseEnter={() => setIsHoveringDynamicAdd(true)}
                  onMouseLeave={() => setIsHoveringDynamicAdd(false)}
                  tabIndex={0}
               >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Gambar Data (Klik atau Paste)</span>
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setDynamicImages(prev => [...prev, file])
                        e.target.value = ''
                      }
                    }}
                  />
               </div>

               <div>
                 <label className="text-sm font-medium text-purple-800 block">
                    Penjelasan Gambar
                    <span className="text-xs text-purple-500 font-normal ml-1">(Opsional)</span>
                 </label>
                 <textarea 
                   value={penjelasanGambar} onChange={e => setPenjelasanGambar(e.target.value)} 
                   className="input-field mt-1 min-h-[60px] text-sm bg-white" 
                   placeholder="Beri arahan tambahan pada AI tentang gambar ini..."
                 />
               </div>
            </div>
          )}

          {modeArtikel === 'Jadwal' && (
            <div className="space-y-4 bg-orange-50/30 p-4 rounded-xl border border-orange-100">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-medium text-orange-800 block">Gambar Klasemen</label>
                    <p className="text-[10px] text-orange-600 mb-2 mt-0.5">Wajib: Data posisi tim di klasemen.</p>
                    <div 
                      className="mt-1 flex justify-center rounded-lg border-2 border-dashed border-orange-300 px-4 py-4 hover:border-orange-500 transition-colors bg-white focus-within:ring-2 focus-within:ring-orange-500 cursor-pointer relative min-h-[120px] items-center"
                      onMouseEnter={() => setIsHoveringExtraImageData(true)}
                      onMouseLeave={() => setIsHoveringExtraImageData(false)}
                      tabIndex={0}
                    >
                       {extraImageData ? (
                         <div className="text-center w-full">
                            <img src={URL.createObjectURL(extraImageData)} alt="Extra Data Preview" className="mx-auto h-24 w-auto object-contain rounded-md mb-2 border border-gray-200 shadow-sm" />
                            <p className="text-xs font-medium text-gray-700 truncate max-w-[150px] mx-auto">{extraImageData.name}</p>
                         </div>
                       ) : (
                         <div className="text-center">
                            <FileImage className="mx-auto h-6 w-6 text-orange-300 mb-1" aria-hidden="true" />
                            <span className="text-xs font-medium text-orange-600 block">Klik / Paste</span>
                         </div>
                       )}
                       <input 
                         type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" 
                         onChange={e => { const file = e.target.files?.[0]; if (file) { setExtraImageData(file); e.target.value = '' } }} 
                       />
                    </div>
                 </div>

                 <div>
                    <label className="text-sm font-medium text-orange-800 block">Gambar Head to Head</label>
                    <p className="text-[10px] text-orange-600 mb-2 mt-0.5">Opsional: Rekor/sejarah pertemuan.</p>
                    <div 
                      className="mt-1 flex justify-center rounded-lg border-2 border-dashed border-orange-300 px-4 py-4 hover:border-orange-500 transition-colors bg-white focus-within:ring-2 focus-within:ring-orange-500 cursor-pointer relative min-h-[120px] items-center"
                      onMouseEnter={() => setIsHoveringHeadToHeadData(true)}
                      onMouseLeave={() => setIsHoveringHeadToHeadData(false)}
                      tabIndex={0}
                    >
                       {headToHeadImageData ? (
                         <div className="text-center w-full">
                            <img src={URL.createObjectURL(headToHeadImageData)} alt="H2H Preview" className="mx-auto h-24 w-auto object-contain rounded-md mb-2 border border-gray-200 shadow-sm" />
                            <p className="text-xs font-medium text-gray-700 truncate max-w-[150px] mx-auto">{headToHeadImageData.name}</p>
                         </div>
                       ) : (
                         <div className="text-center">
                            <FileImage className="mx-auto h-6 w-6 text-orange-300 mb-1" aria-hidden="true" />
                            <span className="text-xs font-medium text-orange-600 block">Klik / Paste</span>
                         </div>
                       )}
                       <input 
                         type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" 
                         onChange={e => { const file = e.target.files?.[0]; if (file) { setHeadToHeadImageData(file); e.target.value = '' } }} 
                       />
                    </div>
                 </div>
               </div>
            </div>
          )}

           <div>
             <label className="text-sm font-medium text-gray-700 block mt-4 flex items-center justify-between">
                Yang Harus Dihighlight 
                <span className="text-xs text-gray-500 font-normal">(Opsional)</span>
             </label>
             <textarea 
               value={highlights} onChange={e => setHighlights(e.target.value)} 
               className="input-field mt-1 min-h-[100px] resize-y mb-3" 
               placeholder="Poin penting yang wajib dibahas AI condong ke apa..."
             />
             
             {/* Notes Feature for current mode */}
             <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2">
               <div className="flex items-center justify-between mb-2">
                 <label className="text-sm font-medium text-gray-700">Notes (Khusus mode: {modeArtikel})</label>
                 <span className="text-xs text-gray-500">{modeNotes[modeArtikel]?.length || 0} tersimpan</span>
               </div>
               
               <div className="flex gap-2 mb-3">
                 <input 
                   type="text" 
                   value={newNoteText} 
                   onChange={e => setNewNoteText(e.target.value)} 
                   placeholder="Tambahkan catatan baru..." 
                   className="input-field text-sm"
                   onKeyDown={e => e.key === 'Enter' && handleSaveNote()}
                 />
                 <button 
                   type="button" 
                   onClick={handleSaveNote} 
                   disabled={!newNoteText.trim()}
                   className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50 flex items-center gap-1 whitespace-nowrap transition-colors"
                 >
                   {editingNoteId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                   {editingNoteId ? 'Simpan' : 'Tambah'}
                 </button>
                 {editingNoteId && (
                   <button 
                     type="button" 
                     onClick={() => { setEditingNoteId(null); setNewNoteText(''); }}
                     className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                   >
                     Batal
                   </button>
                 )}
               </div>
               
               {modeNotes[modeArtikel] && modeNotes[modeArtikel].length > 0 && (
                 <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                   {modeNotes[modeArtikel].map(note => (
                     <div key={note.id} className="flex items-start gap-2 p-2 bg-white border border-gray-200 rounded-md hover:border-blue-300 transition-colors group">
                       <input 
                         type="checkbox" 
                         checked={selectedNoteIds.includes(note.id)}
                         onChange={() => handleToggleNote(note.id)}
                         className="accent-blue-600 mt-0.5 cursor-pointer w-4 h-4 rounded border-gray-300 flex-shrink-0"
                       />
                       <span className="text-sm text-gray-700 flex-1 break-words">{note.text}</span>
                       <div className="flex items-center gap-1 flex-shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                         <button 
                           type="button" 
                           onClick={() => handleEditNote(note)}
                           className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                           title="Edit Note"
                         >
                           <Edit className="w-3.5 h-3.5" />
                         </button>
                         <button 
                           type="button" 
                           onClick={() => handleDeleteNote(note.id)}
                           className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                           title="Hapus Note"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
             
             <div className="mt-4">
               <label className="text-sm font-medium text-gray-700 block mt-4">Full System Prompt (Bisa Diedit Khusus Mode {modeArtikel})</label>
               <p className="text-[10px] text-gray-500 mb-2">Edit aturan judul, HTML, atau gaya bahasa. (Prompt Tag diatur di Settings).</p>
               <ArticleHtmlEditor
                 value={modePrompts[modeArtikel] !== undefined ? modePrompts[modeArtikel] : getDefaultModePrompt(modeArtikel)}
                 onChange={handlePromptChange}
                 minHeight="300px"
               />
             </div>
          </div>

          <div>
             <label className="text-sm font-medium text-gray-700 block mt-4">Thumbnail WP (1280x720)</label>
             <div 
               className="mt-1 flex justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-6 hover:border-blue-500 transition-colors bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer relative min-h-[160px] items-center"
               onPaste={handlePasteThumbnail}
               onMouseEnter={() => setIsHoveringThumbnail(true)}
               onMouseLeave={() => setIsHoveringThumbnail(false)}
               tabIndex={0}
             >
                {thumbnail ? (
                  <div className="text-center w-full">
                     <img src={URL.createObjectURL(thumbnail)} alt="Preview" className="mx-auto h-32 w-auto object-cover rounded-md mb-2 border border-gray-200 shadow-sm" />
                     <p className="text-xs font-medium text-gray-700 truncate max-w-[200px] mx-auto">{thumbnail.name}</p>
                     <p className="text-[10px] text-gray-500 mt-1">Tekan Ctrl+V (Paste) atau klik di sini untuk mengganti</p>
                  </div>
                ) : (
                  <div className="text-center">
                     <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" aria-hidden="true" />
                     <div className="flex text-sm leading-6 text-gray-600 items-center justify-center gap-1">
                        <span className="font-semibold text-blue-600">Klik untuk upload thumbnail</span>
                        <p>atau tekan Ctrl+V</p>
                     </div>
                     <p className="text-xs leading-5 text-gray-500">
                       PNG, JPG up to 5MB (Bisa sama atau beda dengan data)
                     </p>
                  </div>
                )}
                
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  accept="image/*" 
                  title="Upload atau Paste Thumbnail"
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
            <label className="text-sm font-medium text-gray-700 mb-2 block">Sumber Gambar (Kredit)</label>
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
          Analisis & Generate AI
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
                Judul akan muncul di sini setelah AI menganalisis gambar
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

      {/* CROPPER MODAL (Only for Thumbnail) */}
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
