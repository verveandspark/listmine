import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to normalize item keys
const normalizeKey = (item: { id?: string; name?: string; text?: string }) => {
  const itemName = item.name || item.text || ''
  return itemName.trim().toLowerCase()
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )
  }

  try {
    const { listMineListId, retailerList } = await req.json()
    console.log('Request received:', { listMineListId, retailerListLength: retailerList?.length })

    // retailerList is required, but listMineListId can be null for new list creation
    if (!Array.isArray(retailerList)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body: retailerList must be an array' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // If listMineListId is null, this is a new list creation - just return the items as new
    if (!listMineListId) {
      return new Response(
        JSON.stringify({
          existingItems: [],
          newItems: retailerList,
          updatedItems: [],
          summary: {
            existingCount: 0,
            newCount: retailerList.length,
            updatedCount: 0,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch existing items from the list
    const { data: existingItems, error: fetchError } = await supabase
      .from('list_items')
      .select('*')
      .eq('list_id', listMineListId)

    if (fetchError) {
      console.error('Error fetching existing list items:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch existing list items', details: fetchError.message, code: fetchError.code }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('Fetched existing items count:', existingItems?.length || 0)

    // Index existing ListMine items by normalized key
    const existingItemsIndex: Record<string, any> = {}
    ;(existingItems || []).forEach(item => {
      const key = normalizeKey(item)
      existingItemsIndex[key] = item
    })

    // Index retailer scraped items by normalized key
    const retailerItemsIndex: Record<string, any> = {}
    retailerList.forEach((item: any) => {
      const key = normalizeKey(item)
      retailerItemsIndex[key] = item
    })

    console.log('existingItemsIndex keys:', Object.keys(existingItemsIndex))
    console.log('retailerItemsIndex keys:', Object.keys(retailerItemsIndex))
    const onlyInListMine: any[] = []
    const newItems: any[] = []
    const updatedItems: any[] = []

    // Find items only in ListMine or updated
    Object.keys(existingItemsIndex).forEach(key => {
      if (!retailerItemsIndex[key]) {
        onlyInListMine.push(existingItemsIndex[key])
      } else {
        const listMineItem = existingItemsIndex[key]
        // Normalize both sides to comparable shape before diffing
        const retailerItem = retailerItemsIndex[key]
        const comparableLM = {
          name: (listMineItem.text || '').trim().toLowerCase(),
          price: listMineItem.attributes?.custom?.price || null,
          image: listMineItem.attributes?.custom?.image || null,
          link: listMineItem.links?.[0] || null,
          requested: listMineItem.attributes?.registry?.quantity_requested || null,
          purchased: listMineItem.attributes?.registry?.quantity_purchased || null,
          unavailable: listMineItem.is_unavailable || null,
        }
        const comparableRetailer = {
          name: (retailerItem.name || '').trim().toLowerCase(),
          price: retailerItem.attributes?.custom?.price || retailerItem.price || null,
          image: retailerItem.attributes?.custom?.image || retailerItem.image || null,
          link: retailerItem.link || retailerItem.links?.[0] || null,
          requested: retailerItem.attributes?.custom?.requested_quantity || null,
          purchased: retailerItem.attributes?.custom?.purchased_quantity || null,
          unavailable: retailerItem.attributes?.custom?.is_unavailable || null,
        }
        if (JSON.stringify(comparableLM) !== JSON.stringify(comparableRetailer)) {
          updatedItems.push({ listMineItem, retailerItem })
        }
        }
      }
    })

    // Find items only in retailer list
    Object.keys(retailerItemsIndex).forEach(key => {
      if (!existingItemsIndex[key]) {
        newItems.push(retailerItemsIndex[key])
      }
    })

    const summary = {
      existingCount: onlyInListMine.length,
      newCount: newItems.length,
      updatedCount: updatedItems.length,
    }

    console.log('Comparison summary:', summary)

    return new Response(
      JSON.stringify({
        existingItems: onlyInListMine,
        newItems,
        updatedItems,
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Compare and merge error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
