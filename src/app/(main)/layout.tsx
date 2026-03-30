import { Navbar } from '@/components/navbar'
import { Suspense } from 'react'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>
      <main className="flex-1 min-h-screen w-full md:ml-64 p-4 md:p-8 pt-20 md:pt-8 transition-all duration-300">
        {children}
      </main>
    </div>
  )
}
