import { getSettings } from '@/app/actions/settings'
import { SettingsForm } from '@/components/settings-form'

export default async function SettingsPage() {
  const initialData = await getSettings()

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Configure your API keys and WordPress connection securely.</p>
      </div>

      <SettingsForm initialData={initialData} />
    </div>
  )
}
