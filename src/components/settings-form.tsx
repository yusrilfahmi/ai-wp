'use client'

import { useState, useTransition } from 'react'
import { UserSettings } from '@/types'
import { saveSettings } from '@/app/actions/settings'
import { toast } from 'sonner'
import { Save, KeyRound, Globe, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { ApiKeyItem, WpSiteItem, parseApiKeys, parseWpSites } from '@/lib/settings-parser'
import { ArticleHtmlEditor } from './rich-text-editor'

export function SettingsForm({ initialData }: { initialData?: UserSettings | null }) {
  const [isPending, startTransition] = useTransition()
  
  const [activeModel, setActiveModel] = useState(initialData?.active_model || 'gemini-2.5-flash')
  const [openRouterModelString, setOpenRouterModelString] = useState(initialData?.openrouter_model_string || '')
  const [customPrompt, setCustomPrompt] = useState(initialData?.custom_prompt || '')

  const [geminiKeys, setGeminiKeys] = useState<ApiKeyItem[]>(() => parseApiKeys(initialData?.gemini_api_key))
  const allOtherKeys = parseApiKeys(initialData?.openrouter_api_key)
  const [openRouterKeys, setOpenRouterKeys] = useState<ApiKeyItem[]>(() => allOtherKeys.filter(k => k.provider === 'openrouter' || !k.provider))
  const [dashScopeKeys, setDashScopeKeys] = useState<ApiKeyItem[]>(() => allOtherKeys.filter(k => k.provider === 'dashscope'))
  const [wpSites, setWpSites] = useState<WpSiteItem[]>(() => parseWpSites(initialData?.wp_site_url, initialData?.wp_username, initialData?.wp_app_password))

  const [showGemini, setShowGemini] = useState(false)
  const [showOpenRouter, setShowOpenRouter] = useState(false)
  const [showDashScope, setShowDashScope] = useState(false)

  const handleSetGeminiActive = (id: string) => {
    setGeminiKeys(prev => prev.map(k => ({ ...k, is_active: k.id === id })))
  }
  const handleSetOpenRouterActive = (id: string) => {
    setOpenRouterKeys(prev => prev.map(k => ({ ...k, is_active: k.id === id })))
  }
  const handleSetDashScopeActive = (id: string) => {
    setDashScopeKeys(prev => prev.map(k => ({ ...k, is_active: k.id === id })))
  }
  const handleSetWpActive = (id: string) => {
    setWpSites(prev => prev.map(s => ({ ...s, is_active: s.id === id })))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (wpSites.some(s => !s.url || !s.username || !s.password)) {
      toast.error('Pastikan URL, Username, dan Password seluruh WP Sites telah terisi!')
      return
    }

    startTransition(async () => {
      const payload: UserSettings = {
        active_model: activeModel,
        openrouter_model_string: openRouterModelString,
        custom_prompt: customPrompt,
        gemini_api_key: JSON.stringify(geminiKeys),
        openrouter_api_key: JSON.stringify([
          ...openRouterKeys.map(k => ({ ...k, provider: 'openrouter' })),
          ...dashScopeKeys.map(k => ({ ...k, provider: 'dashscope' }))
        ]),
        wp_site_url: JSON.stringify(wpSites),
        wp_username: '',
        wp_app_password: ''
      }
      
      const res = await saveSettings(payload)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Konfigurasi API & WordPress Multi-Akun Tersimpan!")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {/* Model Selection */}
      <div className="glass-panel p-6 space-y-4 relative overflow-hidden">
        <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-gray-200 pb-2">
          <ChevronDown className="w-5 h-5 text-indigo-400" />
          AI Model Configuration
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Active Model</label>
            <div className="relative">
              <select
                value={activeModel}
                onChange={e => setActiveModel(e.target.value)}
                className="input-field appearance-none bg-white border-gray-300 pr-10"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash-Lite Preview</option>
                <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                <option value="openrouter">OpenRouter (Custom)</option>
                <option value="qwen3.5-flash">Alibaba Qwen 3.5 Flash</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {activeModel === 'openrouter' && (
            <div className="space-y-2">
               <label className="text-sm font-medium text-gray-700">OpenRouter Model String</label>
               <input
                 type="text"
                 value={openRouterModelString}
                 onChange={e => setOpenRouterModelString(e.target.value)}
                 placeholder="e.g. anthropic/claude-3-opus"
                 className="input-field"
                 required
               />
            </div>
          )}
        </div>
        
        <div className="pt-4 border-t border-gray-200 mt-4">
          <label className="text-sm font-medium text-gray-700">Global Tag Extraction Rules (Prompt Tag)</label>
          <p className="text-[10px] text-gray-500 mb-2">Instruksi ini akan selalu disisipkan ke semua mode untuk mengatur cara AI mengekstrak tag/keyword.</p>
          <ArticleHtmlEditor
             value={customPrompt}
             onChange={setCustomPrompt}
             placeholder="Contoh: 1. KEYWORDS (TAG EXTRACTION): Extract up to 5 highly specific..."
             minHeight="200px"
          />
        </div>
      </div>

      {/* API Keys */}
      <div className="glass-panel p-6 space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-gray-200 pb-2">
          <KeyRound className="w-5 h-5 text-yellow-400" />
          API Keys (Multi-Account)
        </h2>
        
        <div className="space-y-6">
          {/* Gemini List */}
          <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowGemini(!showGemini)}>
              <div className="flex items-center gap-2">
                {showGemini ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                <label className="text-sm font-semibold text-gray-800 cursor-pointer">Gemini API Keys <span className="text-gray-400 font-normal">({geminiKeys.length} akun)</span></label>
              </div>
              <a href="https://aistudio.google.com/app/api-keys" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-500 hover:underline border border-blue-100 rounded px-2 py-1 bg-blue-50">Ambil API Key</a>
            </div>
            
            {showGemini && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                {geminiKeys.map(k => (
                  <div key={k.id} className={`flex items-start gap-3 p-3 rounded-lg border ${k.is_active ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-200 bg-gray-50'}`}>
                    <input type="radio" name="active_gemini" className="mt-2.5 h-4 w-4 bg-white accent-indigo-600" checked={k.is_active} onChange={() => handleSetGeminiActive(k.id)} />
                    <div className="flex-1 space-y-2">
                      <input type="text" placeholder="Label Akun (Opsional)" className="input-field text-sm py-1.5" value={k.label} onChange={e => setGeminiKeys(prev => prev.map(x => x.id === k.id ? { ...x, label: e.target.value } : x))} />
                      <input type="password" placeholder="AIzaSy..." className="input-field text-sm py-1.5" value={k.key} onChange={e => setGeminiKeys(prev => prev.map(x => x.id === k.id ? { ...x, key: e.target.value } : x))} />
                    </div>
                    <button type="button" onClick={() => setGeminiKeys(prev => prev.filter(x => x.id !== k.id))} className="text-gray-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
                <button type="button" onClick={() => setGeminiKeys(prev => [...prev, { id: Date.now().toString(), label: `Akun Gemini ${prev.length+1}`, key: '', is_active: prev.length === 0 }])} className="text-xs font-medium text-indigo-600 flex items-center gap-1 hover:underline"><Plus className="w-3 h-3"/> Tambah Akun Gemini</button>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 my-4" />

          {/* OpenRouter List */}
          <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowOpenRouter(!showOpenRouter)}>
              <div className="flex items-center gap-2">
                {showOpenRouter ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                <label className="text-sm font-semibold text-gray-800 cursor-pointer">OpenRouter API Keys <span className="text-gray-400 font-normal">({openRouterKeys.length} akun)</span></label>
              </div>
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-500 hover:underline border border-blue-100 rounded px-2 py-1 bg-blue-50">Ambil API Key</a>
            </div>
            
            {showOpenRouter && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                {openRouterKeys.map(k => (
                  <div key={k.id} className={`flex items-start gap-3 p-3 rounded-lg border ${k.is_active ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-200 bg-gray-50'}`}>
                    <input type="radio" name="active_openrouter" className="mt-2.5 h-4 w-4 bg-white accent-indigo-600" checked={k.is_active} onChange={() => handleSetOpenRouterActive(k.id)} />
                    <div className="flex-1 space-y-2">
                      <input type="text" placeholder="Label Akun (Opsional)" className="input-field text-sm py-1.5" value={k.label} onChange={e => setOpenRouterKeys(prev => prev.map(x => x.id === k.id ? { ...x, label: e.target.value } : x))} />
                      <input type="password" placeholder="sk-or-v1-..." className="input-field text-sm py-1.5" value={k.key} onChange={e => setOpenRouterKeys(prev => prev.map(x => x.id === k.id ? { ...x, key: e.target.value } : x))} />
                    </div>
                    <button type="button" onClick={() => setOpenRouterKeys(prev => prev.filter(x => x.id !== k.id))} className="text-gray-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
                <button type="button" onClick={() => setOpenRouterKeys(prev => [...prev, { id: Date.now().toString(), label: `Akun OpenRouter ${prev.length+1}`, key: '', is_active: prev.length === 0, provider: 'openrouter' }])} className="text-xs font-medium text-indigo-600 flex items-center gap-1 hover:underline"><Plus className="w-3 h-3"/> Tambah Akun OpenRouter</button>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 my-4" />

          {/* DashScope List */}
          <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowDashScope(!showDashScope)}>
              <div className="flex items-center gap-2">
                {showDashScope ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                <label className="text-sm font-semibold text-gray-800 cursor-pointer">Alibaba DashScope API Keys <span className="text-gray-400 font-normal">({dashScopeKeys.length} akun)</span></label>
              </div>
              <a href="https://modelstudio.console.alibabacloud.com/ap-southeast-1" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-500 hover:underline border border-blue-100 rounded px-2 py-1 bg-blue-50">API Keys</a>
            </div>
            
            {showDashScope && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                {dashScopeKeys.map(k => (
                  <div key={k.id} className={`flex items-start gap-3 p-3 rounded-lg border ${k.is_active ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-200 bg-gray-50'}`}>
                    <input type="radio" name="active_dashscope" className="mt-2.5 h-4 w-4 bg-white accent-indigo-600" checked={k.is_active} onChange={() => handleSetDashScopeActive(k.id)} />
                    <div className="flex-1 space-y-2">
                      <input type="text" placeholder="Label Akun (Opsional)" className="input-field text-sm py-1.5" value={k.label} onChange={e => setDashScopeKeys(prev => prev.map(x => x.id === k.id ? { ...x, label: e.target.value } : x))} />
                      <input type="password" placeholder="sk-..." className="input-field text-sm py-1.5" value={k.key} onChange={e => setDashScopeKeys(prev => prev.map(x => x.id === k.id ? { ...x, key: e.target.value } : x))} />
                    </div>
                    <button type="button" onClick={() => setDashScopeKeys(prev => prev.filter(x => x.id !== k.id))} className="text-gray-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
                <button type="button" onClick={() => setDashScopeKeys(prev => [...prev, { id: Date.now().toString(), label: `Akun DashScope ${prev.length+1}`, key: '', is_active: prev.length === 0, provider: 'dashscope' }])} className="text-xs font-medium text-indigo-600 flex items-center gap-1 hover:underline"><Plus className="w-3 h-3"/> Tambah Akun DashScope</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WordPress Credentials */}
      <div className="glass-panel p-6 space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-gray-200 pb-2">
          <Globe className="w-5 h-5 text-emerald-500" />
          WordPress Integration (Multi-Site)
        </h2>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Pilih situs WordPress mana yang akan digunakan server untuk injeksi Kategori, Tags, dan draf otomatis.</p>
          
          {wpSites.map(site => (
            <div key={site.id} className={`p-4 rounded-lg border ${site.is_active ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-2">
                <input type="radio" name="active_wp" className="h-4 w-4 bg-white accent-emerald-600" checked={site.is_active} onChange={() => handleSetWpActive(site.id)} />
                <input type="text" placeholder="Label Target WP (Contoh: Web Olahraga)" className="input-field font-medium bg-transparent border-none p-0 focus:ring-0 text-sm flex-1" value={site.label} onChange={e => setWpSites(prev => prev.map(x => x.id === site.id ? { ...x, label: e.target.value } : x))} />
                <button type="button" onClick={() => setWpSites(prev => prev.filter(x => x.id !== site.id))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">WP Site URL</label>
                  <input type="url" className="input-field text-sm mt-1" placeholder="https://..." value={site.url} onChange={e => setWpSites(prev => prev.map(x => x.id === site.id ? { ...x, url: e.target.value } : x))} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Username</label>
                    <input type="text" className="input-field text-sm mt-1" placeholder="admin" value={site.username} onChange={e => setWpSites(prev => prev.map(x => x.id === site.id ? { ...x, username: e.target.value } : x))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">App Password</label>
                    <input type="password" className="input-field text-sm mt-1" placeholder="xxxx xxxx xxxx" value={site.password} onChange={e => setWpSites(prev => prev.map(x => x.id === site.id ? { ...x, password: e.target.value } : x))} />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button type="button" onClick={() => setWpSites(prev => [...prev, { id: Date.now().toString(), label: `Target WP ${prev.length+1}`, url: '', username: '', password: '', is_active: prev.length === 0 }])} className="text-sm font-medium text-emerald-600 flex items-center gap-1 hover:underline mt-2"><Plus className="w-4 h-4"/> Tambah WordPress Site Baru</button>
        </div>
      </div>

      <div className="flex justify-end pt-4">
         <button 
           type="submit" 
           disabled={isPending}
           className="primary-btn w-full md:w-auto min-w-[160px]"
         >
           {isPending ? (
             <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
           ) : (
             <>
                <Save className="w-4 h-4" />
                Save Settings
             </>
           )}
         </button>
      </div>
    </form>
  )
}
