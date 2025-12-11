import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to normalize item keys
const normalizeKey = (item: { id?: string; name?: string }) => {
  if (item.id) return item.id.toLowerCase()
  return (item.name || '').trim().toLowerCase()
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

    if (!listMineListId || !Array.isArray(retailerList)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
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

    const onlyInListMine: any[] = []
    const newItems: any[] = []
    const updatedItems: any[] = []

    // Find items only in ListMine or updated
    Object.keys(existingItemsIndex).forEach(key => {
      if (!retailerItemsIndex[key]) {
        onlyInListMine.push(existingItemsIndex[key])
      } else {
        const listMineItem = existingItemsIndex[key]
        const retailerItem = retailerItemsIndex[key]
        // Simple deep comparison for differences
        if (JSON.stringify(listMineItem) !== JSON.stringify(retailerItem)) {
          updatedItems.push({ listMineItem, retailerItem })
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
