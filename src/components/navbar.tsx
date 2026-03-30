'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, Settings, LayoutDashboard, Menu, X, FileImage } from 'lucide-react'

export function Navbar() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  if (pathname === '/login') return null

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const closeMenu = () => setIsOpen(false)

  const navClass = (path: string) => 
    `flex items-center gap-2 px-4 py-3 md:py-2 rounded-md transition-colors ${
      pathname === path ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-gray-700'
    }`

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b border-gray-200 z-40 p-4 flex items-center justify-between shadow-sm">
        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          AI Publisher
        </h1>
        <button onClick={() => setIsOpen(true)} className="p-2 -mr-2 text-gray-600">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
          onClick={closeMenu}
        />
      )}

      {/* Sidebar Drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out md:translate-x-0 flex flex-col p-4 shadow-xl md:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-8 px-4 mt-4 md:mt-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AI Publisher
          </h1>
          <button onClick={closeMenu} className="md:hidden p-1 text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          <Link href="/" className={navClass('/')} onClick={closeMenu}>
            <LayoutDashboard className="w-5 h-5 md:w-4 md:h-4" />
            Dashboard
          </Link>
          <Link href="/artikel-mode" className={navClass('/artikel-mode')} onClick={closeMenu}>
            <FileImage className="w-5 h-5 md:w-4 md:h-4" />
            Artikel Mode
          </Link>
          <Link href="/settings" className={navClass('/settings')} onClick={closeMenu}>
            <Settings className="w-5 h-5 md:w-4 md:h-4" />
            Settings
          </Link>
        </nav>

        <div className="border-t border-gray-200 pt-4 mt-auto">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-3 md:py-2 rounded-md transition-colors hover:bg-red-50 text-gray-700 hover:text-red-600 w-full text-left"
          >
            <LogOut className="w-5 h-5 md:w-4 md:h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  )
}

