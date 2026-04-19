'use server'

import { getSettings } from '@/app/actions/settings'

import { getActiveWpSite, parseWpSites } from '@/lib/settings-parser'

export async function draftPostAction(formData: FormData) {
  try {
    const settings = await getSettings()
    if (!settings) return { error: 'Settings not configured' }

    const selectedWpSiteId = formData.get('selectedWpSiteId') as string | null

    const allSites = parseWpSites(settings.wp_site_url, settings.wp_username, settings.wp_app_password)
    const activeWp = selectedWpSiteId
      ? (allSites.find(s => s.id === selectedWpSiteId) ?? getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password))
      : getActiveWpSite(settings.wp_site_url, settings.wp_username, settings.wp_app_password)

    if (!activeWp || !activeWp.url || !activeWp.username || !activeWp.password) {
      return { error: 'WordPress settings are not fully configured' }
    }

    const authHeader = `Basic ${Buffer.from(`${activeWp.username}:${activeWp.password}`).toString('base64')}`

    const thumbnail = formData.get('thumbnail') as File
    const title = formData.get('title') as string
    const content = formData.get('content') as string
    const excerpt = formData.get('excerpt') as string
    const tagsString = formData.get('tags') as string
    const categoriesString = formData.get('categories') as string
    const image_alt = formData.get('image_alt') as string
    const image_title = formData.get('image_title') as string
    const image_caption = formData.get('image_caption') as string

    let tags: number[] = []
    let categories: number[] = []
    try { tags = JSON.parse(tagsString || '[]') } catch {}
    try { categories = JSON.parse(categoriesString || '[]') } catch {}

    let mediaId = null

    // Phase 4: Upload Media
    if (thumbnail && thumbnail.size > 0) {
       const buffer = Buffer.from(await thumbnail.arrayBuffer())
       
       // Saring karakter non-Latin1 (UTF-8, smart quotes, emojis) agar undici/fetch tidak crash dengan error ByteString.
       const safeFilename = thumbnail.name.replace(/[^\x20-\x7E]/g, '') || 'image.jpg'

       const mediaRes = await fetch(`${activeWp.url}/wp-json/wp/v2/media`, {
         method: 'POST',
         headers: {
           'Authorization': authHeader,
           'Content-Disposition': `attachment; filename="${safeFilename}"`,
           'Content-Type': thumbnail.type,
           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
         },
         body: buffer
       })

       if (!mediaRes.ok) {
         return { error: `Failed to upload image: ${await mediaRes.text()}` }
       }
       
       const mediaJson = await mediaRes.json()
       mediaId = mediaJson.id

       // Update Media Metadata (alt_text, title, caption)
       // Some fields can be sent in initial POST, others require UPDATE. Let's do a subsequent POST to safely update metadata.
       await fetch(`${activeWp.url}/wp-json/wp/v2/media/${mediaId}`, {
         method: 'POST',
         headers: {
           'Authorization': authHeader,
           'Content-Type': 'application/json',
           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
         },
         body: JSON.stringify({
           alt_text: image_alt,
           title: image_title,
           caption: image_caption
         })
       })
    }

    const postPayload = {
      title,
      content,
      excerpt,
      tags,
      categories,
      status: 'draft',
      ...(mediaId && { featured_media: mediaId })
    }

    const postRes = await fetch(`${activeWp.url}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(postPayload)
    })

    if (!postRes.ok) {
      return { error: `Failed to create draft: ${await postRes.text()}` }
    }

    return { success: true }
  } catch (err) {
    console.error('Draft post error:', err)
    return { error: err instanceof Error ? err.message : 'Server error occurred during drafting' }
  }
}
