import { DashboardClient } from '@/components/dashboard-client'

export default function DashboardPage() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">AI Publisher
          <span className="text-blue-600 ml-2">Dashboard</span>
        </h1>
        <p className="text-gray-600 mt-1">Generate and publish AI-powered content directly to WordPress.</p>
      </div>

      <DashboardClient />
    </div>
  )
}
