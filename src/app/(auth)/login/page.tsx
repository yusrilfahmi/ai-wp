'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { toast } from 'sonner'

export default function LoginPage() {
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4 flex-col lg:flex-row">
      <div className="w-full max-w-md glass-panel p-8 text-center bg-white border border-gray-200 shadow-xl relative overflow-hidden">
        {/* Decorative Gradients */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold mb-2 bg-gradient-to-br from-blue-600 to-indigo-700 bg-clip-text text-transparent">
            AI Publisher
          </h1>
          <p className="text-gray-600 mb-8 mt-2 text-sm leading-relaxed">
            Automate WordPress content generation with advanced AI models & precise internal linking.
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full relative flex items-center justify-center gap-3 bg-white text-black font-semibold py-3.5 px-4 rounded-xl transition-all hover:bg-neutral-100 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Sign in with Google
          </button>
          
          <div className="mt-8 pt-6 border-t border-gray-200 flex flex-row items-center justify-center gap-6 text-xs text-gray-500 font-medium">
             <span>Protected by Supabase</span>
             <span>Powered by Next.js</span>
          </div>
        </div>
      </div>
    </div>
  )
}
