export type ApiKeyItem = {
  id: string
  label: string
  key: string
  is_active: boolean
  provider?: 'openrouter' | 'dashscope'
}

export type WpSiteItem = {
  id: string
  label: string
  url: string
  username: string
  password: string
  is_active: boolean
}

/**
 * Parses a db text column into an array of ApiKeyItem.
 * Gracefully downgrades legacy raw strings.
 */
export function parseApiKeys(dbString: string | undefined): ApiKeyItem[] {
  if (!dbString) return []
  try {
    const parsed = JSON.parse(dbString)
    if (Array.isArray(parsed)) return parsed
  } catch (e) {
    // Legacy single string scenario
    return [{ id: 'legacy', label: 'Default', key: dbString, is_active: true }]
  }
  return []
}

/**
 * Returns the currently active API key string, optionally filtered by provider
 */
export function getActiveApiKey(dbString: string | undefined, provider?: 'openrouter' | 'dashscope'): string | null {
  const keys = parseApiKeys(dbString)
  const filteredKeys = provider ? keys.filter(k => k.provider === provider || (!k.provider && provider === 'openrouter')) : keys
  const active = filteredKeys.find(k => k.is_active)
  return active ? active.key : (filteredKeys[0]?.key || null)
}

/**
 * Parses the WP site URL db column into an array of WpSiteItem.
 * Gracefully downgrades legacy multi-column credentials.
 */
export function parseWpSites(
  urlStr: string | undefined, 
  userStr: string | undefined, 
  passStr: string | undefined
): WpSiteItem[] {
  if (!urlStr) return []
  try {
    const parsed = JSON.parse(urlStr)
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'url' in parsed[0]) {
      return parsed
    }
  } catch (e) {
    // Legacy fallback using individual db columns
    return [{ 
      id: 'legacy', 
      label: 'Default WordPress', 
      url: urlStr, 
      username: userStr || '', 
      password: passStr || '', 
      is_active: true 
    }]
  }
  return []
}

/**
 * Returns the currently active WP Site object
 */
export function getActiveWpSite(urlStr?: string, userStr?: string, passStr?: string): WpSiteItem | null {
  const sites = parseWpSites(urlStr, userStr, passStr)
  const active = sites.find(s => s.is_active)
  return active || sites[0] || null
}
