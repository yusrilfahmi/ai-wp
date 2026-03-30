'use server'

import { getSettings } from '@/app/actions/settings'

import { getActiveWpSite } from '@/lib/settings-parser'

export async function getWpCategoriesAction() {
  try {
    const settings = await getSettings()
    if (!settings) return { error: 'Settings not configured' }

    const activeWp = getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password)
    
    if (!activeWp || !activeWp.url || !activeWp.username || !activeWp.password) {
      return { error: 'WordPress settings are not fully configured' }
    }

    const authHeader = `Basic ${Buffer.from(`${activeWp.username}:${activeWp.password}`).toString('base64')}`
    
    // Fetch categories with high per_page to ensure we capture most/all of them
    const categoryUrl = new URL('/wp-json/wp/v2/categories?per_page=100', activeWp.url)
    
    const res = await fetch(categoryUrl.toString(), {
      headers: { Authorization: authHeader },
      // Use next.js caching if preferred, but 'no-store' ensures live data
      cache: 'no-store' 
    })

    if (!res.ok) {
      return { error: `Failed to fetch categories: ${await res.text()}` }
    }

    const categoriesRaw = await res.json()
    
    // Map to a clean object array
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
