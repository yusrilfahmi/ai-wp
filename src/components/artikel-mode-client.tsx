'use client'

import { useState, useEffect } from 'react'
import { processImageContentAction } from '@/app/actions/process-image-content'
import { draftPostAction } from '@/app/actions/draft-post'
import { getWpCategoriesAction } from '@/app/actions/get-wp-data'
import { ImageCropper } from '@/components/image-cropper'
import { toast } from 'sonner'
import { Loader2, Image as ImageIcon, Send, Sparkles, Trash2, X, FileImage } from 'lucide-react'

const MODES = [
  'Hasil Pertandingan (Sepak Bola)',
  'Hasil Sementara (Sepak Bola)',
  'Klasemen',
  'Top Skor Terbaru',
  'Penilaian Pemain (Rating/Statistik)',
  'Bagan Turnamen (Bracket)',
  'Hasil Laga Esports (Mobile Legends)'
]

export function ArtikelModeClient() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDrafting, setIsDrafting] = useState(false)
  const [isFetchingData, setIsFetchingData] = useState(true)
  
  // Left form state
  const [categories, setCategories] = useState<{id: number, name: string}[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  
  const [modeArtikel, setModeArtikel] = useState(MODES[0])
  const [imageData, setImageData] = useState<File | null>(null)
  const [highlights, setHighlights] = useState('')
  const [isHoveringImageData, setIsHoveringImageData] = useState(false)
  const [isHoveringThumbnail, setIsHoveringThumbnail] = useState(false)
  
  const [uncroppedFile, setUncroppedFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [previewMode, setPreviewMode] = useState<'preview' | 'html'>('preview')
  
  const [sumberGambarType, setSumberGambarType] = useState('Instagram')
  const [sumberGambarUrl, setSumberGambarUrl] = useState('Foto: instagram.com/')

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
    setImageData(null)
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
      }
    }
    document.addEventListener('paste', handleGlobalPaste)
    return () => document.removeEventListener('paste', handleGlobalPaste)
  }, [isHoveringImageData, isHoveringThumbnail])

  // Right form state (Outputs)
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([])
  const [selectedTitle, setSelectedTitle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [rawHtml, setRawHtml] = useState('')
  const [selectedTags, setSelectedTags] = useState<{id: number, name: string, link: string}[]>([])

  useEffect(() => {
    async function loadWpData() {
      setIsFetchingData(true)
      const res = await getWpCategoriesAction()
      if (res.data) {
        setCategories(res.data)
      } else {
        toast.error(`WP Connection warning: ${res.error || 'Failed to load categories'}`)
      }
      setIsFetchingData(false)
    }
    loadWpData()
  }, [])

  const handleProcess = async () => {
    if (!imageData) {
      toast.error('Image Data wajib diunggah untuk dianalisis oleh AI')
      return
    }

    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('imageData', imageData)
      formData.append('modeArtikel', modeArtikel)
      formData.append('sumberGambarUrl', sumberGambarUrl)
      if (highlights) formData.append('highlights', highlights)

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
             <label className="text-sm font-medium text-gray-700">Image Data (Untuk dianalisis AI)</label>
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

           <div>
             <label className="text-sm font-medium text-gray-700 block mt-4 flex items-center justify-between">
                Yang Harus Dihighlight 
                <span className="text-xs text-gray-500 font-normal">(Opsional)</span>
             </label>
             <textarea 
               value={highlights} onChange={e => setHighlights(e.target.value)} 
               className="input-field mt-1 min-h-[100px] resize-y" 
               placeholder="Poin penting yang wajib dibahas AI condong ke apa..."
             />
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
              <div className="space-y-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                {generatedTitles.map((title, idx) => (
                  <label key={idx} className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors bg-white border border-gray-200">
                    <input 
                      type="radio" 
                      name="selectedTitle" 
                      value={title} 
                      checked={selectedTitle === title}
                      onChange={() => setSelectedTitle(title)}
                      className="accent-emerald-500 w-4 h-4 mt-0.5"
                    />
                    <span className="text-sm font-medium leading-tight">{title}</span>
                  </label>
                ))}
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
                <div 
                  className="rounded-lg border border-gray-300 p-5 min-h-[400px] max-h-[600px] overflow-y-auto bg-white text-sm leading-relaxed [&>p]:mb-4 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-6 [&>h2]:mb-3 [&>h2]:text-gray-900 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mt-5 [&>h3]:mb-2 [&>h3]:text-gray-800 [&>blockquote]:border-l-4 [&>blockquote]:border-indigo-500 [&>blockquote]:bg-indigo-50 [&>blockquote]:pl-4 [&>blockquote]:pr-4 [&>blockquote]:py-2 [&>blockquote]:rounded-r-md [&>blockquote]:text-gray-700 [&>blockquote]:italic [&>blockquote]:my-5 [&>a]:text-red-600 [&>a]:font-medium [&>a]:underline hover:[&>a]:text-red-800 [&>table]:w-full [&>table]:border-collapse [&>table]:my-5 border [&>table]:border-gray-200 [&_th]:bg-gray-100 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-gray-300 [&_td]:p-2"
                  dangerouslySetInnerHTML={{ __html: rawHtml || '<p class="text-gray-400 italic text-center mt-10">Pratinjau artikel akan muncul di sini setelah diproses...</p>' }}
                />
             )}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Pilih Kategori</h3>
            {isFetchingData ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-1">
                <Loader2 className="w-4 h-4 animate-spin" /> Fetching...
              </div>
            ) : categories.length === 0 ? (
              <div className="text-sm text-red-500 py-1">Belum ada kategori / Koneksi WP gagal.</div>
            ) : (
              <select 
                className="input-field mt-1"
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
