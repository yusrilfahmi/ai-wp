'use server'

import { getSettings } from '@/app/actions/settings'
import { getActiveWpSite, parseWpSites, parseApiKeys } from '@/lib/settings-parser'

export async function getWpCategoriesAction(wpSiteId?: string) {
  try {
    const settings = await getSettings()
    if (!settings) return { error: 'Settings not configured' }

    const allSites = parseWpSites(settings.wp_site_url, settings.wp_username, settings.wp_app_password)
    const activeWp = wpSiteId
      ? (allSites.find(s => s.id === wpSiteId) || getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password))
      : getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password)
    
    if (!activeWp || !activeWp.url || !activeWp.username || !activeWp.password) {
      return { error: 'WordPress settings are not fully configured' }
    }

    const authHeader = `Basic ${Buffer.from(`${activeWp.username}:${activeWp.password}`).toString('base64')}`
    const categoryUrl = new URL('/wp-json/wp/v2/categories?per_page=100', activeWp.url)
    
    const res = await fetch(categoryUrl.toString(), {
      headers: { 
        Authorization: authHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      cache: 'no-store' 
    })

    if (!res.ok) {
      return { error: `Failed to fetch categories: ${await res.text()}` }
    }

    const categoriesRaw = await res.json()
    const categories: Array<{ id: number, name: string }> = categoriesRaw.map((c: any) => ({
      id: c.id,
      name: c.name
    }))

    return { data: categories }

  } catch (error) {
    console.error('getWpCategoriesAction error:', error)
    return { error: error instanceof Error ? error.message : 'Server error occurred while fetching WP Categories' }
  }
}

/** Returns the list of configured WP sites for the dropdown selector */
export async function getWpSiteOptionsAction() {
  try {
    const settings = await getSettings()
    if (!settings) return { error: 'Settings not configured' }

    const sites = parseWpSites(settings.wp_site_url, settings.wp_username, settings.wp_app_password)
    return {
      data: sites.map(s => ({ id: s.id, label: s.label, is_active: s.is_active }))
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Server error' }
  }
}

/** Returns the list of configured Gemini / OpenRouter API key options for the dropdown selector */
export async function getApiKeyOptionsAction() {
  try {
    const settings = await getSettings()
    if (!settings) return { error: 'Settings not configured' }

    const geminiKeys = parseApiKeys(settings.gemini_api_key).map(k => ({
      id: k.id,
      label: k.label,
      type: 'gemini' as const,
      is_active: k.is_active
    }))

    const orKeys = parseApiKeys(settings.openrouter_api_key).map(k => ({
      id: k.id,
      label: k.label,
      type: 'openrouter' as const,
      is_active: k.is_active
    }))

    return { data: { gemini: geminiKeys, openrouter: orKeys, active_model: settings.active_model } }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Server error' }
  }
}
