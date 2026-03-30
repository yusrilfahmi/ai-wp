'use server'

import { createClient } from '@/lib/supabase/server'
import { UserSettings } from '@/types'
import { revalidatePath } from 'next/cache'

export async function getSettings(): Promise<UserSettings | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching settings:', error)
    return null
  }

  return data as UserSettings | null
}

export async function saveSettings(settings: UserSettings) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      gemini_api_key: settings.gemini_api_key,
      openrouter_api_key: settings.openrouter_api_key,
      wp_site_url: settings.wp_site_url,
      wp_username: settings.wp_username,
      wp_app_password: settings.wp_app_password,
      active_model: settings.active_model,
      openrouter_model_string: settings.openrouter_model_string,
      custom_prompt: settings.custom_prompt
    })

  if (error) {
    console.error('Upsert config error:', error)
    return { error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/')
  return { success: true }
}
