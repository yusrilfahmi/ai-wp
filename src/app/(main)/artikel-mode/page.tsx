import { Metadata } from 'next'
import { ArtikelModeClient } from '@/components/artikel-mode-client'

export const metadata: Metadata = {
  title: 'Artikel Mode - AI Publisher',
  description: 'AI Content Generator for Images and Stats',
}

export default function ArtikelModePage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
          <span className="bg-emerald-100 p-1.5 rounded-md text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          </span>
          Artikel Mode
        </h1>
        <p className="text-gray-500 mt-2 text-sm">
          Generate artikel berdasakan analisis gambar data (Klasemen, Skor, Rating Pemain).
        </p>
      </div>

      <ArtikelModeClient />
    </div>
  )
}
