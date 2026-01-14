import { load } from "https://esm.sh/cheerio@1.0.0-rc.12";

const DEBUG = (Deno.env.get('DEBUG_SCRAPE_HTML') || '').toLowerCase() === 'true';

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex special chars
}

const ALLOWED_HEADERS = 'authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-requested-with';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': ALLOWED_HEADERS,
};

const ALLOWED_ORIGINS = ['https://app.listmine.com'];

function getCorsHeaders(origin: string | null) {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScrapedItem {
  name: string;
  price?: string;
  link?: string;
  image?: string;
  links?: string[];
  attributes?: {
    custom?: {
      availability?: string;
      price?: string;
      image?: string;
    };
  };
}

const detectRetailer = (url: string): string | null => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("amazon.com")) {
    // Detect Amazon Registry URLs - multiple patterns
    if (lowerUrl.includes("/registries/gl/guest-view/")) return "AmazonRegistry";
    if (lowerUrl.includes("/registries/")) return "AmazonRegistry";
    if (lowerUrl.includes("/wedding/registry/")) return "AmazonRegistry";
    if (lowerUrl.includes("/baby-reg/")) return "AmazonRegistry";
    if (lowerUrl.includes("/gp/registry/")) return "AmazonRegistry";
    if (lowerUrl.includes("/registry/")) return "AmazonRegistry";
    return "Amazon";
  }
  // Detect Target registry URLs - multiple patterns
  if (lowerUrl.includes("target.com")) {
    // Pattern 1: /gift-registry/gift/<uuid>
    if (lowerUrl.includes("/gift-registry/gift/") && !lowerUrl.includes("gift-giver")) return "Target";
    // Pattern 2: /gift-registry/gift-giver with registryId query param
    if (lowerUrl.includes("/gift-registry/gift-giver")) {
      try {
        const urlObj = new URL(url);
        if (urlObj.searchParams.get("registryId")) return "Target";
      } catch (e) {
        // URL parsing failed
      }
    }
  }
  // Detect Walmart URLs
  if (lowerUrl.includes("walmart.com")) {
    // Walmart Registry URLs: /registry/WR/<uuid>
    if (lowerUrl.includes("/registry/wr/") || lowerUrl.includes("/registry/WR/")) return "WalmartRegistry";
    // Walmart Wishlist URLs: /lists/wishlist/<uuid>
    if (lowerUrl.includes("/lists/wishlist/") || lowerUrl.includes("/lists/")) return "WalmartWishlist";
  }
  // Detect Bed Bath & Beyond (MyRegistry) URLs
  if (lowerUrl.includes("bedbathandbeyond.myregistry.com")) {
    return "MyRegistryBedBathAndBeyond";
  }
  // Detect The Knot Registry URLs
  if (lowerUrl.includes("theknot.com") && lowerUrl.includes("/registry")) {
    return "TheKnotRegistry";
  }
  // Detect Crate & Barrel Registry URLs
  if (lowerUrl.includes("crateandbarrel.com") && lowerUrl.includes("/gift-registry/")) {
    return "CrateAndBarrelRegistry";
  }
  // Detect CB2 Registry URLs (same parent company, similar structure)
  if (lowerUrl.includes("cb2.com") && lowerUrl.includes("/gift-registry/")) {
    return "CB2Registry";
  }
  // Detect IKEA Registry URLs: https://www.ikea.com/us/en/gift-registry/guest/?id=<shareId>
  if (lowerUrl.includes("ikea.com") && lowerUrl.includes("/gift-registry/guest")) {
    return "IKEARegistry";
  }
  return null;
};

// Extract Target registry ID from URL
const extractTargetRegistryId = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    
    // Pattern 1: /gift-registry/gift/<uuid>
    const giftPathMatch = urlObj.pathname.match(/\/gift-registry\/gift\/([a-f0-9-]+)/i);
    if (giftPathMatch && giftPathMatch[1]) {
      return giftPathMatch[1];
    }
    
    // Pattern 2: /gift-registry/gift-giver with registryId query param
    if (urlObj.pathname.includes("/gift-registry/gift-giver")) {
      const registryId = urlObj.searchParams.get("registryId");
      if (registryId) return registryId;
    }
    
    return null;
  } catch (e) {
    console.error("Failed to extract Target registry ID:", e);
    return null;
  }
};

// Extract IKEA registry share ID from URL
const extractIKEARegistryShareId = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    // Pattern: /gift-registry/guest/?id=<shareId>
    const shareId = urlObj.searchParams.get("id");
    if (shareId) return shareId;
    return null;
  } catch (e) {
    console.error("Failed to extract IKEA registry share ID:", e);
    return null;
  }
};

// IKEA GraphQL-based registry fetcher
interface IKEARegistryItem {
  product: {
    productName?: string;
    productId?: string;
    images?: Array<{ url?: string }>;
    price?: {
      price?: number;
      priceNumeral?: number;
      currency?: string;
      formatted?: string;
    };
    url?: string;
  };
  quantity?: {
    total?: number;
    purchased?: number;
    reserved?: number;
    available?: number;
  };
}

interface IKEARegistryResponse {
  data?: {
    sharedRegistry?: {
      registry?: {
        wishlist?: IKEARegistryItem[];
      };
    };
  };
  errors?: Array<{ message: string }>;
}

async function fetchIKEARegistryViaGraphQL(
  shareId: string,
  originalUrl: string
): Promise<{ success: boolean; items: ScrapedItem[]; error?: string }> {
  console.log(`[IKEA_API] ========== Starting IKEA GraphQL Request ==========`);
  console.log(`[IKEA_API] Share ID: ${shareId}`);
  console.log(`[IKEA_API] Original URL: ${originalUrl}`);
  
  // IKEA GraphQL endpoint
  const graphqlUrl = "https://igift.ingka.com/graphql";
  
  // Default zip and store for availability (US defaults)
  const defaultZip = "90210";
  const defaultStoreId = "204";
  
  // GraphQL query for shared registry
  const graphqlQuery = `
    query sharedRegistry($shareId: String!, $availability: AvailabilityInput, $languageCode: String) {
      sharedRegistry(shareId: $shareId) {
        registry {
          wishlist {
            product(availability: $availability, languageCode: $languageCode) {
              productName
              productId
              images {
                url
              }
              price {
                price
                priceNumeral
                currency
                formatted
              }
              url
            }
            quantity {
              total
              purchased
              reserved
              available
            }
          }
        }
      }
    }
  `;
  
  const requestBody = {
    operationName: "sharedRegistry",
    variables: {
      shareId: shareId,
      availability: {
        zip: defaultZip,
        storeId: defaultStoreId,
      },
      languageCode: "en-US",
    },
    query: graphqlQuery,
  };
  
  console.log(`[IKEA_API] GraphQL URL: ${graphqlUrl}`);
  console.log(`[IKEA_API] Request variables: ${JSON.stringify(requestBody.variables)}`);
  
  try {
    console.log(`[IKEA_API] Sending POST request...`);
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Preferred-Locale": "en-US",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Origin": "https://www.ikea.com",
        "Referer": originalUrl,
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log(`[IKEA_API] Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[IKEA_API] ERROR: Non-OK response status ${response.status}`);
      console.log(`[IKEA_API] Error response body (first 1000 chars): ${errorText.substring(0, 1000)}`);
      return {
        success: false,
        items: [],
        error: `IKEA GraphQL API returned status ${response.status}: ${errorText.substring(0, 200)}`,
      };
    }
    
    const responseText = await response.text();
    console.log(`[IKEA_API] Raw response length: ${responseText.length} chars`);
    console.log(`[IKEA_API] Raw response (first 2000 chars): ${responseText.substring(0, 2000)}`);
    
    let data: IKEARegistryResponse;
    try {
      data = JSON.parse(responseText);
      console.log(`[IKEA_API] Response parsed as JSON successfully`);
    } catch (parseError: any) {
      console.log(`[IKEA_API] ERROR: Failed to parse response as JSON: ${parseError.message}`);
      return {
        success: false,
        items: [],
        error: `IKEA API returned invalid JSON: ${parseError.message}`,
      };
    }
    
    // Check for GraphQL errors
    if (data.errors && data.errors.length > 0) {
      const errorMessages = data.errors.map(e => e.message).join(", ");
      console.log(`[IKEA_API] GraphQL errors: ${errorMessages}`);
      return {
        success: false,
        items: [],
        error: `IKEA API error: ${errorMessages}`,
      };
    }
    
    // Extract wishlist items
    const rawItems = data.data?.sharedRegistry?.registry?.wishlist || [];
    console.log(`[IKEA_API] Found ${rawItems.length} raw items in response`);
    
    if (rawItems.length === 0) {
      console.log(`[IKEA_API] WARNING: Zero items found!`);
      console.log(`[IKEA_API] Full response: ${JSON.stringify(data)}`);
      return {
        success: false,
        items: [],
        error: "No items found in IKEA registry. The registry may be empty, private, or requires authentication.",
      };
    }
    
    // Map to ScrapedItem format
    const items: ScrapedItem[] = rawItems.map((item: IKEARegistryItem) => {
      const product = item.product || {};
      const quantity = item.quantity || {};
      
      // Get first image URL
      const imageUrl = product.images && product.images.length > 0 
        ? product.images[0].url 
        : undefined;
      
      // Format price
      const priceStr = product.price?.formatted || 
        (product.price?.price ? `$${product.price.price.toFixed(2)}` : undefined);
      
      // Build IKEA product URL if product ID available
      const productUrl = product.url || (product.productId 
        ? `https://www.ikea.com/us/en/p/${product.productId}/`
        : undefined);
      
      return {
        name: product.productName || "Unknown IKEA Product",
        price: priceStr,
        image: imageUrl,
        link: productUrl,
        links: productUrl ? [productUrl] : [],
        attributes: {
          custom: {
            image: imageUrl,
            price: priceStr,
            availability: quantity.available !== undefined 
              ? `${quantity.available} available (${quantity.total || 0} total, ${quantity.purchased || 0} purchased, ${quantity.reserved || 0} reserved)`
              : undefined,
          },
        },
      };
    });
    
    console.log(`[IKEA_API] Successfully extracted ${items.length} items`);
    console.log(`[IKEA_API] ========== IKEA GraphQL Request Complete ==========`);
    return { success: true, items };
    
  } catch (e: any) {
    console.error(`[IKEA_API] ========== FETCH ERROR ==========`);
    console.error(`[IKEA_API] Error type: ${e.constructor?.name || 'Unknown'}`);
    console.error(`[IKEA_API] Error message: ${e.message}`);
    console.error(`[IKEA_API] Error stack: ${e.stack || 'No stack trace'}`);
    return {
      success: false,
      items: [],
      error: `IKEA API fetch failed: ${e.message}`,
    };
  }
}

// Target API-based registry fetcher
interface TargetRegistryApiItem {
  tcin?: string;
  title?: string;
  product_description?: {
    title?: string;
    [key: string]: any;
  };
  product_title?: string;
  name?: string;
  description?: string;
  images?: Array<{ base_url?: string; primary?: string }>;
  primary_image_url?: string;
  image_url?: string;
  enrichment?: {
    buy_url?: string;
    images?: {
      primary_image_url?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  price?: {
    current_retail?: number;
    formatted_current_price?: string;
    reg_retail?: number;
    formatted_reg_price?: string;
  };
  current_price?: number;
  formatted_price?: string;
  registry_info?: {
    requested_quantity?: number;
    needed_quantity?: number;
    purchased_quantity?: number;
    is_unavailable?: boolean;
  };
  requested_quantity?: number;
  purchased_quantity?: number;
  availability?: {
    is_unavailable?: boolean;
  };
}

interface TargetRegistryApiResponse {
  registry_items?: {
    target_items?: TargetRegistryApiItem[];
  } | TargetRegistryApiItem[];
  items?: TargetRegistryApiItem[];
  data?: {
    registry_items?: {
      target_items?: TargetRegistryApiItem[];
    } | TargetRegistryApiItem[];
    items?: TargetRegistryApiItem[];
  };
}

async function fetchTargetRegistryViaApi(
  registryId: string,
  originalUrl: string
): Promise<{ success: boolean; items: ScrapedItem[]; error?: string }> {
  console.log(`[TARGET_API] ========== Starting Target API Request ==========`);
  console.log(`[TARGET_API] Registry ID: ${registryId}`);
  console.log(`[TARGET_API] Original URL: ${originalUrl}`);
  
  // Target API endpoint
  const apiUrl = `https://api.target.com/registries/v2/${registryId}/gift_givers`;
  
  // Target public API key - this is a public key visible in Target's frontend code
  const TARGET_API_KEY = "9f36aeafbe60771e321a7cc95a78140772ab3e96";
  console.log(`[TARGET_API] Using API key: ${TARGET_API_KEY.substring(0, 8)}...${TARGET_API_KEY.substring(TARGET_API_KEY.length - 8)} (masked)`);
  
  // Query parameters
  const queryParams = new URLSearchParams({
    channel: "WEB",
    sub_channel: "TGTWEB",
    location_id: "1904",
    pricing_context: "DIGITAL",
    contents_field_group: "REGISTRY_ITEMS",
    key: TARGET_API_KEY,
  });
  
  const fullApiUrl = `${apiUrl}?${queryParams.toString()}`;
  console.log(`[TARGET_API] Full API URL: ${fullApiUrl}`);
  
  // Request body - no filters to fetch ALL items regardless of purchase status
  // Previously had filters: { types: ["TARGET_ITEMS"] } but removing to get all items
  const requestBody = {
    registry_id: registryId,
    channel: "WEB",
    sub_channel: "TGTWEB",
    location_id: "1904",
    pricing_context: "DIGITAL",
    contents_field_group: "REGISTRY_ITEMS",
    // NOTE: filters removed to fetch all items (purchased, unpurchased, all types)
    sort: {
      field: "PRICE",
      order: "ASCENDING",
    },
  };
  
  console.log(`[TARGET_API] Request body: ${JSON.stringify(requestBody)}`);
  
  try {
    console.log(`[TARGET_API] Sending POST request...`);
    const response = await fetch(fullApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Origin": "https://www.target.com",
        "Referer": originalUrl,
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log(`[TARGET_API] Response status: ${response.status} ${response.statusText}`);
    console.log(`[TARGET_API] Response headers:`);
    response.headers.forEach((value, key) => {
      console.log(`[TARGET_API]   ${key}: ${value}`);
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[TARGET_API] ERROR: Non-OK response status ${response.status}`);
      console.log(`[TARGET_API] Error response body (first 1000 chars): ${errorText.substring(0, 1000)}`);
      return {
        success: false,
        items: [],
        error: `Target API returned status ${response.status}: ${errorText.substring(0, 200)}`,
      };
    }
    
    const responseText = await response.text();
    console.log(`[TARGET_API] Raw response length: ${responseText.length} chars`);
    console.log(`[TARGET_API] Raw response (first 2000 chars): ${responseText.substring(0, 2000)}`);
    
    let data: TargetRegistryApiResponse;
    try {
      data = JSON.parse(responseText);
      console.log(`[TARGET_API] Response parsed as JSON successfully`);
    } catch (parseError: any) {
      console.log(`[TARGET_API] ERROR: Failed to parse response as JSON: ${parseError.message}`);
      console.log(`[TARGET_API] Full raw response: ${responseText}`);
      return {
        success: false,
        items: [],
        error: `Target API returned invalid JSON: ${parseError.message}`,
      };
    }
    
    // Log the full response structure for debugging
    console.log(`[TARGET_API] Response top-level keys: ${Object.keys(data).join(", ")}`);
    console.log(`[TARGET_API] Full response JSON: ${JSON.stringify(data).substring(0, 5000)}`);
    
    // Check for error fields in response
    if ((data as any).error || (data as any).errors || (data as any).message) {
      console.log(`[TARGET_API] WARNING: Response contains error fields:`);
      if ((data as any).error) console.log(`[TARGET_API]   error: ${JSON.stringify((data as any).error)}`);
      if ((data as any).errors) console.log(`[TARGET_API]   errors: ${JSON.stringify((data as any).errors)}`);
      if ((data as any).message) console.log(`[TARGET_API]   message: ${(data as any).message}`);
    }
    
    // Find items array in response - prioritize registry_items.target_items structure
    let rawItems: TargetRegistryApiItem[] = [];
    
    // Check for registry_items.target_items (primary expected structure)
    if (data.registry_items && typeof data.registry_items === 'object' && !Array.isArray(data.registry_items)) {
      const registryItemsObj = data.registry_items as { target_items?: TargetRegistryApiItem[] };
      if (registryItemsObj.target_items && Array.isArray(registryItemsObj.target_items)) {
        rawItems = registryItemsObj.target_items;
        console.log(`[TARGET_API] Found items in data.registry_items.target_items`);
      }
    }
    
    // Fallback: check if registry_items is directly an array
    if (rawItems.length === 0 && data.registry_items && Array.isArray(data.registry_items)) {
      rawItems = data.registry_items as TargetRegistryApiItem[];
      console.log(`[TARGET_API] Found items in data.registry_items (array)`);
    }
    
    // Fallback: check data.items
    if (rawItems.length === 0 && data.items && Array.isArray(data.items)) {
      rawItems = data.items;
      console.log(`[TARGET_API] Found items in data.items`);
    }
    
    // Fallback: check data.data.registry_items.target_items
    if (rawItems.length === 0 && data.data?.registry_items && typeof data.data.registry_items === 'object' && !Array.isArray(data.data.registry_items)) {
      const nestedRegistryItems = data.data.registry_items as { target_items?: TargetRegistryApiItem[] };
      if (nestedRegistryItems.target_items && Array.isArray(nestedRegistryItems.target_items)) {
        rawItems = nestedRegistryItems.target_items;
        console.log(`[TARGET_API] Found items in data.data.registry_items.target_items`);
      }
    }
    
    // Fallback: check data.data.registry_items (array)
    if (rawItems.length === 0 && data.data?.registry_items && Array.isArray(data.data.registry_items)) {
      rawItems = data.data.registry_items as TargetRegistryApiItem[];
      console.log(`[TARGET_API] Found items in data.data.registry_items (array)`);
    }
    
    // Fallback: check data.data.items
    if (rawItems.length === 0 && data.data?.items && Array.isArray(data.data.items)) {
      rawItems = data.data.items;
      console.log(`[TARGET_API] Found items in data.data.items`);
    }
    
    if (rawItems.length === 0) {
      console.log(`[TARGET_API] WARNING: Could not find items array in any expected location`);
    }
    
    console.log(`[TARGET_API] Found ${rawItems.length} raw items in response`);
    
    if (rawItems.length === 0) {
      // Log detailed response structure for debugging
      console.log(`[TARGET_API] WARNING: Zero items found!`);
      console.log(`[TARGET_API] Response keys: ${Object.keys(data).join(", ")}`);
      if (data.registry_items && typeof data.registry_items === 'object') {
        console.log(`[TARGET_API] registry_items keys: ${Object.keys(data.registry_items).join(", ")}`);
      }
      if (data.data) {
        console.log(`[TARGET_API] data.data keys: ${Object.keys(data.data).join(", ")}`);
      }
      // Log full response for debugging empty responses
      console.log(`[TARGET_API] Full response (no items): ${JSON.stringify(data)}`);
      return {
        success: false,
        items: [],
        error: "No items found in Target registry. The registry may be empty, private, or temporarily unavailable. Please verify your list and try again, or use Manual Upload.",
      };
    }
    
    // Log first raw item for debugging
    if (rawItems.length > 0) {
      console.log(`[TARGET_API] First raw item sample: ${JSON.stringify(rawItems[0]).substring(0, 1000)}`);
    }
    
    // Transform to ScrapedItem format
    const items: ScrapedItem[] = [];
    
    for (const rawItem of rawItems) {
      try {
        // Extract name: title or fallback to product_description.title
        const name = rawItem.title || rawItem.product_description?.title || rawItem.product_title || rawItem.name || rawItem.description;
        if (!name) {
          if (DEBUG) console.log(`[TARGET_API] Skipping item without name`);
          continue;
        }
        
        // Extract image: prioritize enrichment.images.primary_image_url
        let image: string | undefined;
        if (rawItem.enrichment?.images?.primary_image_url) {
          image = rawItem.enrichment.images.primary_image_url;
        } else if (rawItem.images && rawItem.images.length > 0) {
          const primaryImage = rawItem.images.find(img => img.primary) || rawItem.images[0];
          image = primaryImage?.base_url;
        }
        if (!image) {
          image = rawItem.primary_image_url || rawItem.image_url;
        }
        
        // Extract price: prioritize price.formatted_current_price
        let price: string | undefined;
        if (rawItem.price) {
          price = rawItem.price.formatted_current_price || 
                  (rawItem.price.current_retail ? `$${rawItem.price.current_retail.toFixed(2)}` : undefined) ||
                  rawItem.price.formatted_reg_price ||
                  (rawItem.price.reg_retail ? `$${rawItem.price.reg_retail.toFixed(2)}` : undefined);
        } else if (rawItem.current_price) {
          price = `$${rawItem.current_price.toFixed(2)}`;
        } else if (rawItem.formatted_price) {
          price = rawItem.formatted_price;
        }
        
        // Extract TCIN and build link
        const tcin = rawItem.tcin;
        let link: string | undefined;
        let links: string[] = [];
        
        // Prioritize enrichment.buy_url if present
        if (rawItem.enrichment?.buy_url) {
          link = rawItem.enrichment.buy_url;
          links = [link];
        } else if (tcin) {
          link = `https://www.target.com/p/-/A-${tcin}`;
          links = [link];
        }
        
        // Ensure links is never null
        if (!links) {
          links = [];
        }
        
        // Extract registry metadata from both registry_info and root-level fields
        const registryInfo = rawItem.registry_info;
        const requestedQty = registryInfo?.requested_quantity ?? rawItem.requested_quantity;
        const purchasedQty = registryInfo?.purchased_quantity ?? rawItem.purchased_quantity;
        const neededQty = registryInfo?.needed_quantity;
        const isUnavailable = registryInfo?.is_unavailable || rawItem.availability?.is_unavailable;
        
        const scrapedItem: ScrapedItem = {
          name,
          link,
          links,
          image,
          price,
          attributes: {
            custom: {
              image,
              price,
              tcin,
              requested_quantity: requestedQty,
              needed_quantity: neededQty,
              purchased_quantity: purchasedQty,
              is_unavailable: isUnavailable,
            },
            registry: {
              requested: requestedQty,
              needed: neededQty,
              purchased: purchasedQty,
            },
          },
        };
        
        items.push(scrapedItem);
        if (DEBUG) console.log(`[TARGET_API] Item: "${name}" | tcin: ${tcin || 'N/A'} | price: ${price || 'N/A'} | image: ${image ? 'Yes' : 'No'} | requested: ${requestedQty || 'N/A'} | purchased: ${purchasedQty || 'N/A'}`);
      } catch (e: any) {
        if (DEBUG) console.log(`[TARGET_API] Error processing item: ${e.message}`);
      }
    }
    
    console.log(`[TARGET_API] Successfully extracted ${items.length} items (includes all purchase statuses)`);
    console.log(`[TARGET_API] ========== Target API Request Complete ==========`);
    return { success: true, items, message: "Imported items may include already purchased items." };
    
  } catch (e: any) {
    console.error(`[TARGET_API] ========== FETCH ERROR ==========`);
    console.error(`[TARGET_API] Error type: ${e.constructor?.name || 'Unknown'}`);
    console.error(`[TARGET_API] Error message: ${e.message}`);
    console.error(`[TARGET_API] Error stack: ${e.stack || 'No stack trace'}`);
    return {
      success: false,
      items: [],
      error: `Target API fetch failed: ${e.message}`,
    };
  }
}

// Random User-Agent strings for rotation
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
];

// Helper to pick a random user-agent string
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Check if Amazon returned a blocked/captcha page
const isAmazonBlockedPage = (html: string): boolean => {
  const blockedMarkers = [
    "Type the characters you see in this image",
    "Enter the characters you see below",
    "captcha",
    "Robot Check",
    "To discuss automated access",
    "api-services-support@amazon.com",
    "Sorry, we just need to make sure you're not a robot",
    "automated access to Amazon data",
  ];
  const lowerHtml = html.toLowerCase();
  return blockedMarkers.some(marker => lowerHtml.includes(marker.toLowerCase()));
};

// Check if Amazon returned a blocked or login-required page (enhanced for registry)
const isAmazonBlockedOrLogin = (html: string): boolean => {
  const blockedOrLoginMarkers = [
    "Robot Check",
    "Enter the characters you see below",
    "Type the characters",
    "Sign in",
    "Sign-In",
    "To continue, please sign in",
    "Sorry, we just need to make sure you're not a robot",
    "captcha",
    "ap_email",
    "ap_password",
    "createAccount",
  ];
  const lowerHtml = html.toLowerCase();
  return blockedOrLoginMarkers.some(marker => lowerHtml.includes(marker.toLowerCase()));
};

// Analyze Amazon registry HTML for shell page markers and potential API endpoints
interface AmazonRegistryAnalysis {
  isShellPage: boolean;
  markers: {
    hasRegistryItem: boolean;
    hasGlGuestView: boolean;
    hasP13n: boolean;
    hasCsrf: boolean;
    hasDataAState: boolean;
  };
  extractedConfig: {
    registryId?: string;
    listId?: string;
    marketplaceId?: string;
    csrfToken?: string;
    apiEndpoint?: string;
  };
}

const analyzeAmazonRegistryHtml = (html: string, url: string): AmazonRegistryAnalysis => {
  const lowerHtml = html.toLowerCase();
  
  // Check for shell page markers
  const markers = {
    hasRegistryItem: lowerHtml.includes("registry-item") || lowerHtml.includes("registryitem"),
    hasGlGuestView: lowerHtml.includes("gl-guest-view") || lowerHtml.includes("guest-view"),
    hasP13n: lowerHtml.includes("p13n") || lowerHtml.includes("personalization"),
    hasCsrf: lowerHtml.includes("csrf") || lowerHtml.includes("anti-csrftoken") || lowerHtml.includes("csrftoken"),
    hasDataAState: lowerHtml.includes("data-a-state") || lowerHtml.includes('data-a-state="'),
  };
  
  if (DEBUG) {
    console.log("[AMAZON_REGISTRY_ANALYZE] Shell page markers:");
    console.log(`  - registry-item: ${markers.hasRegistryItem}`);
    console.log(`  - gl-guest-view: ${markers.hasGlGuestView}`);
    console.log(`  - p13n: ${markers.hasP13n}`);
    console.log(`  - csrf: ${markers.hasCsrf}`);
    console.log(`  - data-a-state: ${markers.hasDataAState}`);
  }
  
  // Extract configuration for potential API calls
  const extractedConfig: AmazonRegistryAnalysis["extractedConfig"] = {};
  
  // Extract registry ID from URL or HTML
  const registryIdMatch = url.match(/\/guest-view\/([A-Z0-9]+)/i) || 
                          url.match(/registryId[=\/]([A-Z0-9]+)/i) ||
                          html.match(/registryId["']\s*:\s*["']([A-Z0-9]+)["']/i) ||
                          html.match(/listId["']\s*:\s*["']([A-Z0-9]+)["']/i);
  if (registryIdMatch) {
    extractedConfig.registryId = registryIdMatch[1];
    if (DEBUG) console.log(`[AMAZON_REGISTRY_ANALYZE] Found registryId: ${extractedConfig.registryId}`);
  }
  
  // Extract list ID
  const listIdMatch = html.match(/["']listId["']\s*:\s*["']([A-Z0-9]+)["']/i) ||
                      html.match(/data-list-id=["']([A-Z0-9]+)["']/i);
  if (listIdMatch) {
    extractedConfig.listId = listIdMatch[1];
    if (DEBUG) console.log(`[AMAZON_REGISTRY_ANALYZE] Found listId: ${extractedConfig.listId}`);
  }
  
  // Extract marketplace ID
  const marketplaceIdMatch = html.match(/marketplaceId["']\s*:\s*["']([A-Z0-9]+)["']/i) ||
                             html.match(/obfuscatedMarketplaceId["']\s*:\s*["']([A-Z0-9]+)["']/i);
  if (marketplaceIdMatch) {
    extractedConfig.marketplaceId = marketplaceIdMatch[1];
    if (DEBUG) console.log(`[AMAZON_REGISTRY_ANALYZE] Found marketplaceId: ${extractedConfig.marketplaceId}`);
  }
  
  // Extract CSRF token
  const csrfMatch = html.match(/anti-csrftoken-a2z["']\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/csrf["']\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/csrfToken["']\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/name=["']csrf[^"']*["']\s+value=["']([^"']+)["']/i);
  if (csrfMatch) {
    extractedConfig.csrfToken = csrfMatch[1];
    if (DEBUG) console.log(`[AMAZON_REGISTRY_ANALYZE] Found CSRF token (length: ${extractedConfig.csrfToken?.length})`);
  }
  
  // Look for API endpoints
  const apiEndpointPatterns = [
    /["'](\/hz\/wishlist\/[^"']*api[^"']*)["']/i,
    /["'](\/gp\/registry\/[^"']*api[^"']*)["']/i,
    /["'](\/api\/[^"']*registry[^"']*)["']/i,
    /["'](https:\/\/[^"']*amazon[^"']*\/api\/[^"']*)["']/i,
    /["']([^"']*\/ajax\/[^"']*registry[^"']*)["']/i,
    /["']([^"']*\/fetch\/[^"']*registry[^"']*)["']/i,
    /fetchEndpoint["']\s*:\s*["']([^"']+)["']/i,
    /dataEndpoint["']\s*:\s*["']([^"']+)["']/i,
  ];
  
  for (const pattern of apiEndpointPatterns) {
    const match = html.match(pattern);
    if (match) {
      extractedConfig.apiEndpoint = match[1];
      if (DEBUG) console.log(`[AMAZON_REGISTRY_ANALYZE] Found potential API endpoint: ${extractedConfig.apiEndpoint}`);
      break;
    }
  }
  
  // Determine if this is a shell page (minimal content, markers present but no actual items rendered)
  const hasMinimalContent = html.length < 50000;
  const hasShellMarkers = markers.hasDataAState || markers.hasP13n;
  const lacksItemData = !lowerHtml.includes('"asin"') && !lowerHtml.includes('data-asin=');
  
  const isShellPage = hasMinimalContent && hasShellMarkers && lacksItemData;
  if (DEBUG) console.log(`[AMAZON_REGISTRY_ANALYZE] Shell page detection: isShell=${isShellPage} (minContent=${hasMinimalContent}, shellMarkers=${hasShellMarkers}, lacksItems=${lacksItemData})`);
  
  return {
    isShellPage,
    markers,
    extractedConfig,
  };
};

// Attempt to call Amazon registry API endpoint directly
interface AmazonApiResult {
  success: boolean;
  items: ScrapedItem[];
  requiresAuth: boolean;
  error?: string;
}

const tryAmazonRegistryApi = async (
  analysis: AmazonRegistryAnalysis,
  scraperApiKey: string
): Promise<AmazonApiResult> => {
  if (DEBUG) console.log("[AMAZON_REGISTRY_API] Attempting API-based extraction...");
  
  const { extractedConfig } = analysis;
  
  // If we don't have enough info to call an API, return early
  if (!extractedConfig.registryId && !extractedConfig.listId) {
    if (DEBUG) console.log("[AMAZON_REGISTRY_API] No registry/list ID found, cannot attempt API call");
    return { success: false, items: [], requiresAuth: false, error: "No registry ID found" };
  }
  
  const rawRegistryId = extractedConfig.registryId || extractedConfig.listId;
  const registryId = escapeRegex(rawRegistryId!);
  console.log('[SAFE_QUERY] Amazon registry ID (escaped):', registryId);
  
  // Try known Amazon registry API patterns
  const apiUrls = [
    `https://www.amazon.com/hz/wishlist/ls/${registryId}?reveal=&filter=DEFAULT&sort=default&viewType=list&type=registry`,
    `https://www.amazon.com/baby-reg/baby-reg-items?registryId=${registryId}`,
    `https://www.amazon.com/gp/registry/api/v1/registry/${registryId}/items`,
    `https://www.amazon.com/wedding/registry/guest-view/${registryId}`,
  ];
  
  if (extractedConfig.apiEndpoint) {
    apiUrls.unshift(extractedConfig.apiEndpoint);
  }
  
  for (const apiUrl of apiUrls) {
    console.log(`[AMAZON_REGISTRY_API] Trying endpoint: ${apiUrl}`);
    
    try {
      const scraperUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(apiUrl)}&render=true`;
      
      const response = await fetch(scraperUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/html, */*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      
      if (!response.ok) {
        console.log(`[AMAZON_REGISTRY_API] Endpoint returned status ${response.status}`);
        continue;
      }
      
      const responseText = await response.text();
      console.log(`[AMAZON_REGISTRY_API] Response length: ${responseText.length} chars`);
      
      // Check if we got blocked
      if (responseText.toLowerCase().includes("captcha") || 
          responseText.toLowerCase().includes("robot check")) {
        if (DEBUG) console.log("[AMAZON_REGISTRY_API] API endpoint returned captcha/blocked");
        return { success: false, items: [], requiresAuth: true, error: "Blocked by Amazon" };
      }
      
      // Try to parse as JSON
      let items: ScrapedItem[] = [];
      
      try {
        const jsonData = JSON.parse(responseText);
        if (DEBUG) console.log("[AMAZON_REGISTRY_API] Successfully parsed JSON response");
        
        // Look for items in various JSON structures
        const itemArrays = [
          jsonData.items,
          jsonData.registryItems,
          jsonData.data?.items,
          jsonData.data?.registryItems,
          jsonData.itemList,
          jsonData.products,
        ].filter(Boolean);
        
        for (const itemArray of itemArrays) {
          if (Array.isArray(itemArray) && itemArray.length > 0) {
            if (DEBUG) console.log(`[AMAZON_REGISTRY_API] Found ${itemArray.length} items in JSON`);
            
            for (const item of itemArray) {
              const asin = item.asin || item.ASIN || item.itemId;
              const title = item.title || item.name || item.productTitle;
              
              if (asin && title) {
                items.push({
                  name: title,
                  link: `https://www.amazon.com/dp/${asin}`,
                  image: item.image || item.imageUrl || item.mainImage,
                  price: item.price?.displayPrice || item.formattedPrice || item.price,
                });
              }
            }
            
            if (items.length > 0) {
              if (DEBUG) console.log(`[AMAZON_REGISTRY_API] Extracted ${items.length} items from API`);
              return { success: true, items, requiresAuth: false };
            }
          }
        }
      } catch (jsonErr) {
        // Not JSON, try HTML parsing
        if (DEBUG) console.log("[AMAZON_REGISTRY_API] Response is not JSON, checking for HTML items...");
        
        // Check if response contains ASIN data
        const asinMatches = responseText.matchAll(/data-asin=["']([A-Z0-9]{10})["']/gi);
        const asins = [...asinMatches].map(m => m[1]);
        
        if (asins.length > 0) {
          if (DEBUG) console.log(`[AMAZON_REGISTRY_API] Found ${asins.length} ASINs in HTML response`);
          // If we found ASINs, the page has some data but needs DOM parsing
          // Return empty to let DOM parser handle it
        }
      }
      
    } catch (e: any) {
      if (DEBUG) console.log(`[AMAZON_REGISTRY_API] Error with endpoint: ${e.message}`);
    }
  }
  
  if (DEBUG) console.log("[AMAZON_REGISTRY_API] All API endpoints failed or require auth");
  return { success: false, items: [], requiresAuth: true, error: "No accessible API found" };
};

// Target restricted page check removed - using API instead of HTML parsing

// Debug helper to log HTML snippet (only if debug enabled)
const logHtmlDebugInfo = (html: string, retailer: string, url: string, debugEnabled: boolean): void => {
  if (!debugEnabled) return;
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : "No title found";
  const snippet = html.substring(0, 1000).replace(/\s+/g, ' ');
  console.log(`[DEBUG_HTML] Retailer: ${retailer} | URL: ${url}`);
  console.log(`[DEBUG_HTML] Page title: ${pageTitle}`);
  console.log(`[DEBUG_HTML] HTML length: ${html.length} chars`);
  console.log(`[DEBUG_HTML] First 1000 chars: ${snippet}`);
};

// Helper to safely get nested values by string path
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : null), obj);
};

// Target HTML parsing removed - using API-based approach instead

const scrapeAmazon = ($: any): ScrapedItem[] => {
  const items: ScrapedItem[] = [];

  $("[data-itemid], .g-item-sortable, li[data-id]").each(
    (_: number, element: any) => {
      const $item = $(element);

      const name =
        $item.find("h3, h2, .a-size-base, [data-item-name]").first().text().trim() ||
        $item.find("a[title]").attr("title")?.trim() ||
        $item.find(".a-link-normal").first().text().trim();

      const priceWhole = $item
        .find(".a-price-whole")
        .first()
        .text()
        .trim();
      const priceFraction = $item
        .find(".a-price-fraction")
        .first()
        .text()
        .trim();
      const price = priceWhole
        ? `$${priceWhole}${priceFraction}`
        : $item.find(".a-price, .a-offscreen").first().text().trim();

      const link = $item
        .find('a[href*="/dp/"], a[href*="/gp/product/"]')
        .first()
        .attr("href");
      const fullLink = link
        ? link.startsWith("http")
          ? link
          : `https://www.amazon.com${link}`
        : undefined;

      const image =
        $item.find("img").first().attr("src") ||
        $item.find("img").first().attr("data-src");

      if (name) {
        items.push({
          name,
          price: price || undefined,
          link: fullLink,
          image: image || undefined,
        });
      }
    }
  );

  return items;
};

// MyRegistry Bed Bath & Beyond Registry Scraper
interface MyRegistryMetadata {
  registryId: string;
  merchantWebsiteId: string;
  merchantSiteKey: string;
  isWishList?: boolean;
}

// Extract hidden input values from MyRegistry page HTML
const extractMyRegistryMetadata = ($: any): MyRegistryMetadata | null => {
  const registryId = $('input#hidRegistryId').val() || $('input[name="hidRegistryId"]').val();
  const merchantWebsiteId = $('input#hidMerchantWebsiteId').val() || $('input[name="hidMerchantWebsiteId"]').val();
  const merchantSiteKey = $('input#hidMerchantSiteKey').val() || $('input[name="hidMerchantSiteKey"]').val();
  const isWishList = $('input#hidIsWishList').val() || $('input[name="hidIsWishList"]').val();
  
  if (DEBUG) {
    console.log("[MYREGISTRY_PARSE] hidRegistryId:", registryId || "NOT FOUND");
    console.log("[MYREGISTRY_PARSE] hidMerchantWebsiteId:", merchantWebsiteId || "NOT FOUND");
    console.log("[MYREGISTRY_PARSE] hidMerchantSiteKey:", merchantSiteKey || "NOT FOUND");
    console.log("[MYREGISTRY_PARSE] hidIsWishList:", isWishList || "NOT FOUND");
  }
  
  if (!registryId || !merchantWebsiteId || !merchantSiteKey) {
    return null;
  }
  
  return {
    registryId,
    merchantWebsiteId,
    merchantSiteKey,
    isWishList: isWishList === 'True',
  };
};

// Parse items from MyRegistry GridGiftList HTML response
const parseMyRegistryItems = (html: string): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  const $ = load(html);
  const BASE_URL = 'https://bedbathandbeyond.myregistry.com';
  
  // Track link/image extraction stats
  let itemsWithLink = 0;
  let itemsWithImage = 0;
  
  // Each item is wrapped in .itemGiftVisitorList
  $('.itemGiftVisitorList').each((_, element) => {
    try {
      const itemEl = $(element);
      
      // Extract title/name - try multiple selectors
      let name = '';
      const titleEl = itemEl.find('.productTitle, .gift-title, .item-title, .product-name, h3, h4').first();
      if (titleEl.length) {
        name = titleEl.text().trim();
      }
      if (!name) {
        // Fallback to finding any meaningful text content
        const allText = itemEl.find('a').first().text().trim();
        if (allText && allText.length > 2 && allText.length < 200) {
          name = allText;
        }
      }
      if (!name) {
        // Try to get text from product link
        const productLinkEl = itemEl.find('a[href*="product"], a[href*="item"]').first();
        if (productLinkEl.length) {
          name = productLinkEl.text().trim();
        }
      }
      
      // Check for unavailable status (button text matches /unavailable/i)
      let isUnavailable = false;
      const buttonEls = itemEl.find('button, a.btn, .button, [class*="action"], [class*="cta"]');
      buttonEls.each((_: number, btnEl: any) => {
        const btnText = $(btnEl).text().trim();
        if (/unavailable/i.test(btnText)) {
          isUnavailable = true;
        }
      });
      
      // Also check for unavailable text elsewhere in the card
      const cardText = itemEl.text();
      if (/item.*unavailable|out.*of.*stock|no longer available/i.test(cardText)) {
        isUnavailable = true;
      }
      
      // Collect first 10 anchors for debugging (before any filtering)
      const first10Anchors: Array<{ text: string; href: string }> = [];
      const allAnchorsDebug = itemEl.find('a, button');
      allAnchorsDebug.each((idx: number, anchorEl: any) => {
        if (first10Anchors.length < 10) {
          const anchorText = $(anchorEl).text().trim().replace(/\s+/g, ' ').substring(0, 60);
          const href = $(anchorEl).attr('href') || $(anchorEl).attr('data-href') || $(anchorEl).attr('data-url') || '';
          first10Anchors.push({ text: anchorText, href });
        }
      });
      
      // Helper to normalize URLs
      const normalizeUrl = (href: string): string | undefined => {
        if (!href || href === '#' || href.startsWith('javascript:')) return undefined;
        if (href.startsWith('http')) return href;
        if (href.startsWith('//')) return `https:${href}`;
        if (href.startsWith('/')) return `https://bedbathandbeyond.myregistry.com${href}`;
        return undefined;
      };
      
      // Extract "Buy This Gift" URL with improved logic
      let buyUrl: string | undefined;
      if (!isUnavailable) {
        const allAnchors = itemEl.find('a, button, div, span');
        
        // Priority A: Find anchor whose text matches /buy\s*this\s*gift/i
        allAnchors.each((_: number, anchorEl: any) => {
          if (buyUrl) return;
          const anchorText = $(anchorEl).text().trim();
          if (/buy\s*this\s*gift/i.test(anchorText)) {
            const href = $(anchorEl).attr('href') || $(anchorEl).attr('data-href') || $(anchorEl).attr('data-url') || '';
            const normalized = normalizeUrl(href);
            if (normalized) {
              buyUrl = normalized;
            }
          }
        });
        
        // Priority B: If element with "buy this gift" text found but no href, search card for bedbathandbeyond/buybuybaby anchors
        if (!buyUrl) {
          const hasButtonText = itemEl.text().toLowerCase().includes('buy this gift');
          if (hasButtonText) {
            const cardAnchors = itemEl.find('a[href]');
            cardAnchors.each((_: number, anchorEl: any) => {
              if (buyUrl) return;
              const href = $(anchorEl).attr('href') || '';
              if (/bedbathandbeyond\.com|buybuybaby/i.test(href)) {
                const normalized = normalizeUrl(href);
                if (normalized) {
                  buyUrl = normalized;
                }
              }
            });
          }
        }
        
        // Priority C: Find first anchor with product.html, mrRID=, or mrGID=
        if (!buyUrl) {
          const cardAnchors = itemEl.find('a[href]');
          cardAnchors.each((_: number, anchorEl: any) => {
            if (buyUrl) return;
            const href = $(anchorEl).attr('href') || '';
            if (/product\.html|mrRID=|mrGID=/i.test(href)) {
              const normalized = normalizeUrl(href);
              if (normalized) {
                buyUrl = normalized;
              }
            }
          });
        }
      }
      
      // Extract image URL - find first img with src
      let image: string | undefined;
      const imgEl = itemEl.find('img[src], img[data-src]').first();
      if (imgEl.length) {
        const src = imgEl.attr('src') || imgEl.attr('data-src') || '';
        if (src) {
          if (src.startsWith('http')) {
            image = src;
          } else if (src.startsWith('//')) {
            // Protocol-relative URL - normalize to https
            image = `https:${src}`;
          } else if (src.startsWith('/')) {
            // Relative URL
            image = `${BASE_URL}${src}`;
          }
        }
      }
      
      // Extract price
      let price = '';
      const priceEl = itemEl.find('.price, .product-price, .gift-price, .item-price, [class*="price"]').first();
      if (priceEl.length) {
        const priceText = priceEl.text().trim();
        // Extract dollar amount
        const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
        if (priceMatch) {
          price = priceMatch[0];
        } else if (priceText) {
          price = priceText;
        }
      }
      
      // Extract quantity info if present
      const qtyEl = itemEl.find('.quantity, .qty, [class*="quantity"], [class*="needed"]').first();
      let desiredQty: number | undefined;
      let purchasedQty: number | undefined;
      if (qtyEl.length) {
        const qtyText = qtyEl.text();
        const neededMatch = qtyText.match(/(\d+)\s*(?:needed|wants|desired)/i);
        const purchasedMatch = qtyText.match(/(\d+)\s*(?:purchased|bought|received)/i);
        if (neededMatch) desiredQty = parseInt(neededMatch[1], 10);
        if (purchasedMatch) purchasedQty = parseInt(purchasedMatch[1], 10);
      }
      
      // Only add item if we have at least a name
      if (name) {
        const item: ScrapedItem = { name };
        
        // Set link based on availability
        if (isUnavailable) {
          // No links for unavailable items
          item.link = undefined;
          item.links = [];
        } else if (buyUrl) {
          item.link = buyUrl;
          item.links = [buyUrl];
          itemsWithLink++;
        } else {
          item.link = undefined;
          item.links = [];
        }
        
        if (image) {
          item.image = image;
          itemsWithImage++;
        }
        if (price) item.price = price;
        
        // Set unavailable attribute
        if (isUnavailable) {
          item.attributes = {
            custom: {
              availability: 'unavailable',
            },
          };
        }
        
        // Attach debug fields to first 3 items when DEBUG is enabled (surfaced to frontend)
        if (DEBUG && items.length < 3) {
          (item as any).debug_first10Anchors = first10Anchors;
          (item as any).debug_buyUrl = buyUrl ?? null;
          (item as any).debug_unavailable = isUnavailable;
          
          console.log(`[MYREGISTRY_PARSE] Item ${items.length + 1}: "${name}"`);
          console.log(`  - buyUrl: ${buyUrl || 'N/A'}`);
          console.log(`  - unavailable: ${isUnavailable}`);
          console.log(`  - first10Anchors:`, JSON.stringify(first10Anchors));
        }
        
        items.push(item);
      }
    } catch (e: any) {
      if (DEBUG) console.log(`[MYREGISTRY_PARSE] Error parsing item: ${e.message}`);
    }
  });
  
  // Debug log extraction stats
  if (DEBUG && items.length > 0) {
    console.log(`[MYREGISTRY_PARSE] items with link: ${itemsWithLink}/${items.length} | items with image: ${itemsWithImage}/${items.length}`);
  }
  
  return items;
};

// Fetch all pages from MyRegistry GridGiftList endpoint
const fetchMyRegistryPages = async (metadata: MyRegistryMetadata, originalUrl: string): Promise<ScrapedItem[]> => {
  const allItems: ScrapedItem[] = [];
  let page = 1;
  const maxPages = 50; // Safety limit
  
  const gridEndpoint = 'https://bedbathandbeyond.myregistry.com/ExternalApps/BedBathAndBeyond/UserControls/GridGiftList.aspx';
  
  while (page <= maxPages) {
    try {
      // Build POST body exactly as browser does (all values as strings)
      const formData = new URLSearchParams();
      formData.append('page', String(page));           // page number as string
      formData.append('sortmode', '');                  // empty string, but include the key
      formData.append('categoryId', '-1');              // "-1" for all categories
      formData.append('websiteId', String(metadata.merchantWebsiteId));
      formData.append('registryId', String(metadata.registryId));
      formData.append('sitekey', String(metadata.merchantSiteKey));
      formData.append('showAllGifts', 'false');         // string "false"
      formData.append('lang', 'en-US');
      
      const response = await fetch(gridEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': getRandomUserAgent(),
          'Origin': 'https://bedbathandbeyond.myregistry.com',
          'Referer': originalUrl || 'https://bedbathandbeyond.myregistry.com/',
        },
        body: formData.toString(),
      });
      
      console.log(`[MYREGISTRY_FETCH] Page ${page} | status: ${response.status}`);
      
      if (!response.ok) {
        console.error(`[MYREGISTRY_FETCH] Page ${page} failed with status ${response.status}`);
        // Debug info on failure
        if (DEBUG) {
          console.log(`[MYREGISTRY_FETCH] POST body: page=${page}&sortmode=&categoryId=-1&websiteId=${metadata.merchantWebsiteId}&registryId=${metadata.registryId}&sitekey=${metadata.merchantSiteKey}&showAllGifts=false&lang=en-US`);
        }
        break;
      }
      
      const html = await response.text();
      
      // Parse items from this page
      const pageItems = parseMyRegistryItems(html);
      
      console.log(`[MYREGISTRY_FETCH] Page ${page} | length: ${html.length} | items: ${pageItems.length}`);
      
      // Debug on failure/suspicious response
      const isFailure = pageItems.length === 0 || html.length < 200;
      if (DEBUG || isFailure) {
        if (isFailure) {
          console.log(`[MYREGISTRY_FETCH] POST body: page=${page}&sortmode=&categoryId=-1&websiteId=${metadata.merchantWebsiteId}&registryId=${metadata.registryId}&sitekey=${metadata.merchantSiteKey}&showAllGifts=false&lang=en-US`);
          console.log(`[MYREGISTRY_FETCH] First 1000 chars: ${html.substring(0, 1000)}`);
        }
      }
      
      // If no items on this page, we've reached the end
      if (pageItems.length === 0) {
        break;
      }
      
      allItems.push(...pageItems);
      page++;
      
      // Small delay between pages to be respectful
      if (page <= maxPages) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (e: any) {
      console.error(`[MYREGISTRY_FETCH] Error fetching page ${page}: ${e.message}`);
      break;
    }
  }
  
  return allItems;
};

// Main scraper function for MyRegistry Bed Bath & Beyond
const scrapeMyRegistryBedBathAndBeyond = async ($: any, html: string, url: string): Promise<{ items: ScrapedItem[]; error?: string }> => {
  if (DEBUG) {
    console.log("[MYREGISTRY_PARSE] Starting MyRegistry Bed Bath & Beyond parsing...");
    console.log("[MYREGISTRY_PARSE] HTML length:", html.length, "chars");
    console.log("[MYREGISTRY_PARSE] URL:", url);
  }
  
  // Extract metadata from hidden inputs
  const metadata = extractMyRegistryMetadata($);
  
  if (!metadata) {
    console.error("[MYREGISTRY_PARSE] Unable to scrape: missing registry metadata (hidRegistryId, hidMerchantWebsiteId, or hidMerchantSiteKey)");
    return {
      items: [],
      error: "Unable to scrape: missing registry metadata. The registry page may have changed or be inaccessible.",
    };
  }
  
  if (DEBUG) {
    console.log("[MYREGISTRY_PARSE] Extracted metadata:", JSON.stringify(metadata));
  }
  
  // Fetch all pages from the GridGiftList endpoint
  try {
    const items = await fetchMyRegistryPages(metadata, url);
    
    if (items.length === 0) {
      // Try parsing the initial page HTML directly as a fallback
      if (DEBUG) console.log("[MYREGISTRY_PARSE] No items from API, trying direct HTML parsing...");
      const directItems = parseMyRegistryItems(html);
      if (directItems.length > 0) {
        if (DEBUG) console.log("[MYREGISTRY_PARSE] Found", directItems.length, "items from direct HTML parsing");
        return { items: directItems };
      }
      
      return {
        items: [],
        error: "No items found in this registry. The registry may be empty or private.",
      };
    }
    
    return { items };
  } catch (e: any) {
    console.error("[MYREGISTRY_PARSE] Error during scraping:", e.message);
    return {
      items: [],
      error: `Failed to scrape registry: ${e.message}`,
    };
  }
};

// The Knot Registry Scraper
interface TheKnotItem {
  name?: string;
  imageUrl?: string;
  detailPageUrlKey?: string;
  offers?: Array<{
    price?: number;
    currencyCode?: string;
  }>;
}

interface TheKnotApiResponse {
  data?: TheKnotItem[];
  count?: number;
  totalCount?: number;
}

// Extract memberId from The Knot registry page HTML
const extractTheKnotMemberId = ($: any, htmlLength?: number): string | null => {
  // Primary: data-member-id attribute on #products-grid-app-root
  const productsGridElement = $('#products-grid-app-root');
  const hasProductsGridRoot = productsGridElement.length > 0;
  let memberId = productsGridElement.attr('data-member-id');
  
  // Debug logging for memberId extraction
  console.log(`[THEKNOT_PARSE] #products-grid-app-root found: ${hasProductsGridRoot}`);
  if (hasProductsGridRoot) {
    console.log(`[THEKNOT_PARSE] #products-grid-app-root data-member-id: ${memberId || "NOT_PRESENT"}`);
  }
  
  if (!memberId) {
    // Fallback: look for data-member-id anywhere
    const anyMemberIdElement = $('[data-member-id]').first();
    const hasAnyMemberId = anyMemberIdElement.length > 0;
    console.log(`[THEKNOT_PARSE] Any [data-member-id] element found: ${hasAnyMemberId}`);
    if (hasAnyMemberId) {
      memberId = anyMemberIdElement.attr('data-member-id');
      console.log(`[THEKNOT_PARSE] Fallback data-member-id value: ${memberId || "NOT_PRESENT"}`);
    }
  }
  
  if (!memberId) {
    // Fallback: try to find memberId in script tags
    $('script').each((_: number, el: any) => {
      const text = $(el).html() || '';
      const match = text.match(/memberId[\"']?\s*[:=]\s*[\"']([^\"']+)[\"']/);
      if (match && match[1]) {
        memberId = match[1];
        console.log(`[THEKNOT_PARSE] Found memberId in script tag: ${memberId}`);
        return false; // break
      }
    });
  }
  
  console.log(`[THEKNOT_PARSE] Final memberId: ${memberId || "NOT FOUND"} | HTML length: ${htmlLength || "unknown"}`);
  
  return memberId || null;
};

// Fetch items from The Knot registry-item-gateway API
const fetchTheKnotItems = async (memberId: string): Promise<{ items: ScrapedItem[]; error?: string }> => {
  const items: ScrapedItem[] = [];
  const baseUrl = 'https://registry-item-gateway.regsvcs.theknot.com/items';
  
  // Try to fetch with large limit first
  const limit = 256;
  let offset = 0;
  let totalCount = -1;
  const maxIterations = 50; // Safety limit
  let iteration = 0;
  
  while (iteration < maxIterations) {
    iteration++;
    
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      memberId: memberId,
      showCash: 'true',
      registryStatusFilter: 'active,visible',
      sort: 'retailerSortOrder-asc',
      showGiftCards: 'true',
      showDisabled: 'false',
    });
    
    const requestUrl = `${baseUrl}?${params.toString()}`;
    
    if (DEBUG) {
      console.log(`[THEKNOT_FETCH] Fetching page ${iteration}, offset=${offset}...`);
      console.log(`[THEKNOT_FETCH] URL: ${requestUrl}`);
    }
    
    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': getRandomUserAgent(),
          'Origin': 'https://www.theknot.com',
          'Referer': 'https://www.theknot.com/',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[THEKNOT_FETCH] API request failed with status ${response.status}: ${errorText.substring(0, 500)}`);
        if (items.length > 0) {
          // We already have some items, return what we have
          break;
        }
        return {
          items: [],
          error: `The Knot API returned status ${response.status}. The registry may be private or unavailable.`,
        };
      }
      
      const json: TheKnotApiResponse = await response.json();
      
      if (DEBUG) {
        console.log(`[THEKNOT_FETCH] Response count: ${json.data?.length || 0}, totalCount: ${json.totalCount || json.count || 'unknown'}`);
      }
      
      // Set totalCount on first request
      if (totalCount === -1) {
        totalCount = json.totalCount || json.count || 0;
        if (DEBUG) console.log(`[THEKNOT_FETCH] Total items to fetch: ${totalCount}`);
      }
      
      // Parse items from response
      if (json.data && Array.isArray(json.data)) {
        for (const item of json.data) {
          if (!item.name) continue;
          
          const scrapedItem: ScrapedItem = {
            name: item.name,
          };
          
          // Extract image URL
          if (item.imageUrl) {
            scrapedItem.image = item.imageUrl;
          }
          
          // Build product link
          if (item.detailPageUrlKey) {
            if (item.detailPageUrlKey.startsWith('http')) {
              scrapedItem.link = item.detailPageUrlKey;
            } else {
              scrapedItem.link = `https://gifts.theknot.com/${item.detailPageUrlKey}`;
            }
          }
          
          // Extract price from offers
          if (item.offers && Array.isArray(item.offers) && item.offers.length > 0) {
            const offer = item.offers[0];
            if (offer.price !== undefined && offer.price !== null) {
              if (offer.currencyCode === 'USD') {
                scrapedItem.price = `$${Number(offer.price).toFixed(2)}`;
              } else {
                scrapedItem.price = String(offer.price);
              }
            }
          }
          
          if (DEBUG) {
            console.log(`[THEKNOT_PARSE] Item: "${scrapedItem.name}" | price: ${scrapedItem.price || 'N/A'} | link: ${scrapedItem.link ? 'yes' : 'no'} | image: ${scrapedItem.image ? 'yes' : 'no'}`);
          }
          
          items.push(scrapedItem);
        }
      }
      
      // Check if we've fetched all items
      if (!json.data || json.data.length === 0) {
        if (DEBUG) console.log(`[THEKNOT_FETCH] No more items, stopping pagination`);
        break;
      }
      
      // Update offset for next page
      offset += json.data.length;
      
      // If we've fetched all items based on totalCount, stop
      if (totalCount > 0 && offset >= totalCount) {
        if (DEBUG) console.log(`[THEKNOT_FETCH] Fetched all ${totalCount} items`);
        break;
      }
      
      // If we got less items than limit, we've reached the end
      if (json.data.length < limit) {
        if (DEBUG) console.log(`[THEKNOT_FETCH] Got ${json.data.length} items (less than limit ${limit}), stopping pagination`);
        break;
      }
      
      // Small delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (e: any) {
      console.error(`[THEKNOT_FETCH] Error fetching items: ${e.message}`);
      if (items.length > 0) {
        // Return what we have
        break;
      }
      return {
        items: [],
        error: `Failed to fetch The Knot registry items: ${e.message}`,
      };
    }
  }
  
  if (DEBUG) console.log(`[THEKNOT_FETCH] Total items fetched: ${items.length}`);
  return { items };
};

// Main scraper function for The Knot Registry
const scrapeTheKnotRegistry = async ($: any, html: string, url: string): Promise<{ items: ScrapedItem[]; error?: string }> => {
  if (DEBUG) {
    console.log("[THEKNOT_PARSE] Starting The Knot Registry parsing...");
    console.log("[THEKNOT_PARSE] HTML length:", html.length, "chars");
    console.log("[THEKNOT_PARSE] URL:", url);
  }
  
  // Extract memberId from the page HTML
  const memberId = extractTheKnotMemberId($, html.length);
  
  if (!memberId) {
    console.error("[THEKNOT_PARSE] Unable to scrape: missing The Knot memberId");
    return {
      items: [],
      error: "Unable to scrape: missing The Knot memberId. The registry page may have changed or be inaccessible.",
    };
  }
  
  if (DEBUG) {
    console.log("[THEKNOT_PARSE] Extracted memberId:", memberId);
  }
  
  // Fetch items from The Knot API
  try {
    const result = await fetchTheKnotItems(memberId);
    
    if (result.items.length === 0 && !result.error) {
      return {
        items: [],
        error: "No items found in this registry. The registry may be empty or private.",
      };
    }
    
    return result;
  } catch (e: any) {
    console.error("[THEKNOT_PARSE] Error during scraping:", e.message);
    return {
      items: [],
      error: `Failed to scrape registry: ${e.message}`,
    };
  }
};

// Crate & Barrel / CB2 scraping code removed - import disabled

const scrapeAmazonRegistry = ($: any, html: string, url: string): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
  if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] Starting Amazon registry parsing...");
  
  // Helper to validate item has proper Amazon product URL
  const isValidAmazonProductUrl = (link?: string): boolean => {
    if (!link) return false;
    return link.includes('/dp/') || link.includes('/gp/product/');
  };
  
  // Helper to check if item looks like a recommendation/ad (not a registry item)
  const isRecommendationOrAd = (item: any): boolean => {
    // Exclude items with recommendation markers
    const adMarkers = ['sponsored', 'recommendation', 'similar', 'also viewed', 'customers also'];
    const itemStr = JSON.stringify(item).toLowerCase();
    return adMarkers.some(marker => itemStr.includes(marker));
  };
  
  // Helper to extract item with full details
  const extractRegistryItem = (item: any): ScrapedItem | null => {
    try {
      // Extract ASIN/product ID
      const asin = item.asin || item.ASIN || item.itemId || item.productId || 
                   item.id || item.catalogItemId || item.productASIN;
      
      // Extract title
      const title = item.title || item.name || item.productTitle || item.itemName || 
                   item.productName || item.displayTitle || item.itemTitle;
      
      // Build product URL
      let link: string | undefined;
      if (asin && typeof asin === 'string' && asin.length === 10) {
        link = `https://www.amazon.com/dp/${asin}`;
      } else if (item.itemUrl || item.productUrl || item.link || item.url || item.detailPageUrl) {
        const rawUrl = item.itemUrl || item.productUrl || item.link || item.url || item.detailPageUrl;
        link = rawUrl.startsWith('http') ? rawUrl : `https://www.amazon.com${rawUrl}`;
      }
      
      // Validate - must have title and valid Amazon product URL
      if (!title || !isValidAmazonProductUrl(link)) {
        return null;
      }
      
      // Check if this looks like an ad/recommendation
      if (isRecommendationOrAd(item)) {
        if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] Skipping recommendation/ad item: ${title}`);
        return null;
      }
      
      // Extract image URL
      const image = item.image || item.imageUrl || item.mainImage || item.smallImage || 
                   item.mediumImage || item.thumbnailImage || item.largeImage ||
                   item.productImage || item.itemImage || item.primaryImage?.url ||
                   (Array.isArray(item.images) && item.images[0]?.url) || undefined;
      
      // Extract price
      let price: string | undefined;
      if (item.price) {
        if (typeof item.price === 'string') {
          price = item.price;
        } else if (item.price.displayPrice) {
          price = item.price.displayPrice;
        } else if (item.price.amount) {
          price = `$${item.price.amount}`;
        } else if (item.price.formattedPrice) {
          price = item.price.formattedPrice;
        }
      } else {
        price = item.displayPrice || item.formattedPrice || item.priceString || 
                item.listPrice || item.currentPrice || undefined;
      }
      
      // Extract quantity information (registry specific)
      const quantityRequested = item.quantityRequested || item.requestedQuantity || 
                               item.desiredQuantity || item.wantedQuantity || 1;
      const quantityPurchased = item.quantityPurchased || item.purchasedQuantity || 
                               item.fulfilledQuantity || item.boughtQuantity || 0;
      
      if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] Extracted item: "${title}" | ASIN: ${asin} | Price: ${price || 'N/A'} | Qty: ${quantityRequested}/${quantityPurchased}`);
      
      return {
        name: title,
        link,
        image,
        price,
      };
    } catch (e: any) {
      if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] Error extracting item: ${e.message}`);
      return null;
    }
  };
  
  // Extract registry ID from URL for potential API call
  const registryIdMatch = url.match(/\/guest-view\/([A-Z0-9]+)/i) || 
                          url.match(/registryId[=\/]([A-Z0-9]+)/i) ||
                          url.match(/\/registry\/([A-Z0-9]+)/i) ||
                          url.match(/\/hz\/wishlist\/ls\/([A-Z0-9]+)/i);
  const rawRegistryId = registryIdMatch ? registryIdMatch[1] : null;
  const registryId = rawRegistryId ? escapeRegex(rawRegistryId) : null;
  if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] Extracted registry ID:", registryId || "Not found");
  if (DEBUG && rawRegistryId) console.log('[SAFE_QUERY] Amazon parse registry ID (escaped):', registryId);
  
  // Try to parse embedded JSON first - look for registry-specific data structures
  try {
    if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] Searching for embedded JSON data...");
    const scripts = $('script').toArray();
    let foundScriptContent = false;
    let pWhenBlocksFound = 0;
    let pWhenItemsExtracted = 0;
    
    for (const script of scripts) {
      const content = $(script).html() || "";
      
      // Pattern 1: P.when data loading - Amazon's primary lazy load pattern for registries
      if (content.includes('P.when')) {
        pWhenBlocksFound++;
        if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] Found P.when block #${pWhenBlocksFound}`);
        
        // Look for registry item data structures within P.when
        // Pattern: P.when('A', 'ready').register(...) with registry data
        const pWhenDataPatterns = [
          // Full registry item list in P.when
          /"registryItemList"\s*:\s*(\[[\s\S]*?\])\s*[,}]/g,
          /"itemList"\s*:\s*(\[[\s\S]*?\])\s*[,}]/g,
          /"items"\s*:\s*(\[[\s\S]*?\])\s*[,}]/g,
          // Registry items with quantities
          /"registryItems"\s*:\s*(\[[\s\S]*?\])\s*[,}]/g,
          /"giftListItems"\s*:\s*(\[[\s\S]*?\])\s*[,}]/g,
        ];
        
        for (const pattern of pWhenDataPatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            try {
              // Clean up JSON before parsing
              let jsonStr = match[1];
              // Handle nested brackets more carefully
              let bracketCount = 0;
              let endIndex = 0;
              for (let i = 0; i < jsonStr.length; i++) {
                if (jsonStr[i] === '[') bracketCount++;
                if (jsonStr[i] === ']') bracketCount--;
                if (bracketCount === 0) {
                  endIndex = i + 1;
                  break;
                }
              }
              if (endIndex > 0) {
                jsonStr = jsonStr.substring(0, endIndex);
              }
              
              const itemsArray = JSON.parse(jsonStr);
              if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] P.when: Found array with ${itemsArray.length} potential items`);
              
              let validItemsFromBlock = 0;
              for (const item of itemsArray) {
                const extracted = extractRegistryItem(item);
                if (extracted && !items.some(i => i.link === extracted.link)) {
                  items.push(extracted);
                  validItemsFromBlock++;
                  pWhenItemsExtracted++;
                }
              }
              if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] P.when block yielded ${validItemsFromBlock} valid registry items`);
              
            } catch (e: any) {
              if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] P.when JSON parse error: ${e.message}`);
            }
          }
        }
        
        // Also try to find individual item objects with ASIN in P.when blocks
        const individualItemPattern = /\{[^{}]*"asin"\s*:\s*"([A-Z0-9]{10})"[^{}]*"title"\s*:\s*"([^"]+)"[^{}]*\}/gi;
        const individualMatches = content.matchAll(individualItemPattern);
        for (const match of individualMatches) {
          try {
            const itemJson = match[0];
            const itemData = JSON.parse(itemJson);
            const extracted = extractRegistryItem(itemData);
            if (extracted && !items.some(i => i.link === extracted.link)) {
              items.push(extracted);
              pWhenItemsExtracted++;
            }
          } catch (e) {
            // Continue to next match
          }
        }
        
        // Try reverse pattern: title first, then asin
        const reversePattern = /\{[^{}]*"title"\s*:\s*"([^"]+)"[^{}]*"asin"\s*:\s*"([A-Z0-9]{10})"[^{}]*\}/gi;
        const reverseMatches = content.matchAll(reversePattern);
        for (const match of reverseMatches) {
          try {
            const itemJson = match[0];
            const itemData = JSON.parse(itemJson);
            const extracted = extractRegistryItem(itemData);
            if (extracted && !items.some(i => i.link === extracted.link)) {
              items.push(extracted);
              pWhenItemsExtracted++;
            }
          } catch (e) {
            // Continue to next match
          }
        }
      }
      
      // Pattern 2: Standard JSON data blocks (registryItemList, items, etc.)
      if (!content.includes('P.when') && (content.includes('registryItemList') || 
          content.includes('itemList') || content.includes('"items":') || 
          content.includes('"registryItems"'))) {
        foundScriptContent = true;
        if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] Found standard registry data script");
        
        const extractPatterns = [
          { pattern: /"items"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/, name: 'items array' },
          { pattern: /"registryItemList"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/, name: 'registryItemList' },
          { pattern: /"registryItems"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/, name: 'registryItems' },
          { pattern: /"listItems"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/, name: 'listItems' },
          { pattern: /"giftListItems"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/, name: 'giftListItems' },
        ];
        
        for (const { pattern, name } of extractPatterns) {
          const match = content.match(pattern);
          if (match) {
            try {
              const itemsArray = JSON.parse(match[1]);
              if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] Found ${name} with ${itemsArray.length} potential items`);
              
              let validItems = 0;
              for (const item of itemsArray) {
                const extracted = extractRegistryItem(item);
                if (extracted && !items.some(i => i.link === extracted.link)) {
                  items.push(extracted);
                  validItems++;
                }
              }
              if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] ${name} yielded ${validItems} valid registry items`);
              
            } catch (e: any) {
              if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] Failed to parse ${name}: ${e.message}`);
            }
          }
        }
      }
      
      // Pattern 3: __PRELOADED_STATE__ with registry data
      if (content.includes("__PRELOADED_STATE__")) {
        if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] Found __PRELOADED_STATE__");
        const stateMatch = content.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/);
        if (stateMatch) {
          try {
            const state = JSON.parse(stateMatch[1]);
            const possibleItemArrays = [
              state?.registryItems,
              state?.registry?.items,
              state?.data?.items,
              state?.pageData?.items,
              state?.listData?.items,
              state?.giftList?.items,
            ].filter(Boolean);
            
            for (const itemArray of possibleItemArrays) {
              if (Array.isArray(itemArray)) {
                if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] Found ${itemArray.length} items in __PRELOADED_STATE__`);
                let validItems = 0;
                for (const item of itemArray) {
                  const extracted = extractRegistryItem(item);
                  if (extracted && !items.some(i => i.link === extracted.link)) {
                    items.push(extracted);
                    validItems++;
                  }
                }
                if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] __PRELOADED_STATE__ yielded ${validItems} valid items`);
              }
            }
          } catch (e: any) {
            if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] Failed to parse __PRELOADED_STATE__:", e.message);
          }
        }
      }
    }
    
    // Log P.when summary
    if (DEBUG && pWhenBlocksFound > 0) {
      console.log(`[AMAZON_REGISTRY_PARSE] P.when Summary: ${pWhenBlocksFound} blocks found, ${pWhenItemsExtracted} items extracted`);
    }
    
    if (items.length > 0) {
      if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] JSON parsing successful: ${items.length} total items extracted`);
      return items;
    }
    
    if (DEBUG && !foundScriptContent && pWhenBlocksFound === 0) {
      console.log("[AMAZON_REGISTRY_PARSE] No registry-related script content found");
    }
  } catch (e: any) {
    if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] JSON parsing error:", e.message, "| Stack:", e.stack?.substring(0, 200));
  }
  
  // DOM parsing fallback - scope to registry list region
  if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] Falling back to DOM parsing...");
  
  // Look for the main registry items container first
  const registryContainerSelectors = [
    '#item-page-wrapper',
    '#registry-items',
    '#g-items',
    '[id*="registry-item"]',
    '[class*="registry-items"]',
    '.g-item-page',
    '#gift-list',
    '[data-a-container="registryItem"]',
    '#registryItemList',
    '.still-needs-section',
    '#itemList',
  ];
  
  let $registryContainer = $('body');
  let foundContainer = false;
  for (const containerSelector of registryContainerSelectors) {
    const $container = $(containerSelector);
    if ($container.length > 0) {
      $registryContainer = $container;
      foundContainer = true;
      if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] Found registry container:", containerSelector, "| Elements:", $container.length);
      break;
    }
  }
  
  if (DEBUG && !foundContainer) {
    console.log("[AMAZON_REGISTRY_PARSE] No specific registry container found, using body");
  }
  
  // Registry item selectors - scoped to the registry region
  const registryItemSelectors = [
    '.g-item-sortable[data-itemid]',
    'li[data-itemid]',
    '[data-itemid]',
    'li[data-id]',
    '.a-section[data-asin]',
    '[data-csa-c-item-id]',
  ];
  
  for (const selector of registryItemSelectors) {
    const $foundItems = $registryContainer.find(selector);
    if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] DOM selector "${selector}" found ${$foundItems.length} elements`);
    
    $foundItems.each((_index: number, element: any) => {
      const $item = $(element);
      
      const asin = $item.attr('data-asin') || 
                   $item.attr('data-itemid') ||
                   $item.attr('data-id') ||
                   $item.attr('data-csa-c-item-id') ||
                   $item.find('[data-asin]').first().attr('data-asin');
      
      const href = $item.find('a[href*="/dp/"], a[href*="/gp/product/"]').first().attr('href');
      let link: string | undefined;
      
      if (asin && asin.length === 10) {
        link = `https://www.amazon.com/dp/${asin}`;
      } else if (href) {
        link = href.startsWith('http') ? href : `https://www.amazon.com${href}`;
      }
      
      if (!isValidAmazonProductUrl(link)) return;
      
      const name = $item.find('h3, h2, [id*="itemName"], .a-size-base-plus, .a-text-normal, a[id*="itemName"]').first().text().trim() ||
                   $item.find('a[title]').attr('title')?.trim() ||
                   $item.find('[data-item-name]').text().trim() ||
                   $item.find('img[alt]').first().attr('alt') || "";
      
      if (!name || name.length < 2) return;
      
      const image = $item.find('img[src*="images-amazon"], img[src*="media-amazon"]').first().attr('src') || 
                    $item.find('img').first().attr('src') || 
                    $item.find('img').first().attr('data-src') || undefined;
      
      const priceWhole = $item.find('.a-price-whole').first().text().trim();
      const priceFraction = $item.find('.a-price-fraction').first().text().trim();
      const price = priceWhole ? `$${priceWhole}${priceFraction}` :
                    $item.find('.a-price .a-offscreen').first().text().trim() || 
                    $item.find('.a-color-price').first().text().trim() || undefined;
      
      if (!items.some(i => i.link === link)) {
        items.push({
          name,
          link,
          image,
          price,
        });
        if (DEBUG) console.log(`[AMAZON_REGISTRY_PARSE] DOM: Extracted "${name}" | ASIN: ${asin}`);
      }
    });
    
    if (items.length > 0) {
      if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] Parsed from DOM with selector:", selector, "| Items:", items.length);
      break;
    }
  }
  
  // If still no items, try a more aggressive approach
  if (items.length === 0) {
    if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] Attempting aggressive ASIN extraction...");
    let aggressiveCount = 0;
    
    $('[data-asin], [data-itemid]').each((_index: number, element: any) => {
      const $item = $(element);
      const asin = $item.attr('data-asin') || $item.attr('data-itemid');
      
      if (!asin || asin.length !== 10) return;
      
      const link = `https://www.amazon.com/dp/${asin}`;
      const $titleLink = $item.find('a[href*="/dp/"]').first();
      const name = $titleLink.text().trim() || 
                   $titleLink.attr('title')?.trim() ||
                   $item.find('img').first().attr('alt') || "";
      
      if (name && name.length > 3 && !items.some(i => i.link === link)) {
        items.push({
          name,
          link,
          image: $item.find('img').first().attr('src') || undefined,
          price: $item.find('.a-price .a-offscreen').first().text().trim() || undefined,
        });
        aggressiveCount++;
      }
    });
    
    if (DEBUG && aggressiveCount > 0) {
      console.log("[AMAZON_REGISTRY_PARSE] Aggressive extraction found:", aggressiveCount, "items");
    }
  }
  
  if (DEBUG) console.log("[AMAZON_REGISTRY_PARSE] Final item count:", items.length);
  return items;
};

interface FetchOptions {
  withBrowserHeaders?: boolean;
  country?: string;
  premium?: boolean;
  ultraPremium?: boolean; // Use ultra_premium for most demanding JS-rendered sites
}

interface DirectFetchResult {
  ok: boolean;
  status: number;
  html: string;
}

// Direct fetch with browser-like headers (no proxy)
async function fetchDirect(url: string): Promise<DirectFetchResult> {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
  };
  
  // Add Referer for Walmart URLs
  if (url.includes("walmart.com")) {
    headers["Referer"] = "https://www.walmart.com/";
  }
  
  try {
    console.log("[FETCH_DIRECT] Attempting direct fetch:", url);
    const response = await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow",
    });
    
    const html = await response.text();
    console.log(`[FETCH_DIRECT] Response status: ${response.status} | HTML length: ${html.length}`);
    
    // Enhanced logging for blocked/short responses
    if (response.ok && (html.length < 20000 || isBlockedResponse(html))) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : "No title found";
      const snippet = html.substring(0, 300).replace(/\s+/g, ' ');
      console.log(`[FETCH_DIRECT_DEBUG] Blocked/short response detected`);
      console.log(`[FETCH_DIRECT_DEBUG] Status: ${response.status} | Length: ${html.length} | Title: ${pageTitle}`);
      console.log(`[FETCH_DIRECT_DEBUG] First 300 chars: ${snippet}`);
    }
    
    return {
      ok: response.ok,
      status: response.status,
      html,
    };
  } catch (e: any) {
    console.log(`[FETCH_DIRECT] Error: ${e.message}`);
    return {
      ok: false,
      status: 0,
      html: "",
    };
  }
}

// Helper to extract <title> text from HTML
const extractHtmlTitle = (html: string): string => {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : "";
};

// Helper to detect Walmart block page specifically
const isWalmartBlockPage = (html: string): boolean => {
  const lowerHtml = html.toLowerCase();
  const title = extractHtmlTitle(html).toLowerCase();
  
  // Check for specific Walmart block indicators
  if (title === "robot or human?") return true;
  if (lowerHtml.includes("/blocked?url=")) return true;
  if (lowerHtml.includes("activate and hold the button to confirm that you're human")) return true;
  if (lowerHtml.includes("captcha") && lowerHtml.includes("walmart")) return true;
  
  return false;
};

// Check if HTML looks blocked/captcha
const isBlockedResponse = (html: string): boolean => {
  const lowerHtml = html.toLowerCase();
  const blockedMarkers = [
    "captcha",
    "robot check",
    "access denied",
    "403 forbidden",
    "please verify you are a human",
    "enable javascript",
    "browser check",
  ];
  return blockedMarkers.some(marker => lowerHtml.includes(marker));
};

// BrightData Web Unlocker API fetch
interface BrightDataUnlockerResponse {
  success: boolean;
  html: string;
  status: number;
  error?: string;
}

async function fetchWithBrightDataUnlocker(url: string, isAmazonRegistry = false): Promise<BrightDataUnlockerResponse> {
  const brightDataToken = Deno.env.get("BRIGHTDATA_UNLOCKER_API_TOKEN");
  const brightDataZone = Deno.env.get("BRIGHTDATA_UNLOCKER_ZONE");
  
  if (!brightDataToken || !brightDataZone) {
    console.log("[BRIGHTDATA_UNLOCKER] Missing env vars: BRIGHTDATA_UNLOCKER_API_TOKEN or BRIGHTDATA_UNLOCKER_ZONE");
    return {
      success: false,
      html: "",
      status: 0,
      error: "BrightData Unlocker not configured",
    };
  }
  
  console.log(`[BRIGHTDATA_UNLOCKER] Fetching URL via BrightData Web Unlocker: ${url}`);
  console.log(`[BRIGHTDATA_UNLOCKER] Using zone: ${brightDataZone}`);
  
  // Set appropriate expect header based on retailer
  let expectHeader: string;
  if (isAmazonRegistry) {
    expectHeader = JSON.stringify({ text: 'Add to Cart' });
  } else {
    expectHeader = JSON.stringify({ text: 'items in stock' });
  }
  
  try {
    const response = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${brightDataToken}`,
        "Content-Type": "application/json",
        "x-unblock-expect": expectHeader,
      },
      body: JSON.stringify({
        zone: brightDataZone,
        url: url,
        format: "raw",
      }),
    });
    
    console.log(`[BRIGHTDATA_UNLOCKER] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[BRIGHTDATA_UNLOCKER] Error response: ${errorText.substring(0, 500)}`);
      return {
        success: false,
        html: "",
        status: response.status,
        error: `BrightData Unlocker error: ${response.status}`,
      };
    }
    
    const html = await response.text();
    console.log(`[BRIGHTDATA_UNLOCKER] Success: ${html.length} chars received`);
    
    // Check if response looks blocked
    if (isBlockedResponse(html)) {
      console.log("[BRIGHTDATA_UNLOCKER] Response appears blocked");
      return {
        success: false,
        html: html,
        status: response.status,
        error: "BrightData returned blocked content",
      };
    }
    
    return {
      success: true,
      html: html,
      status: response.status,
    };
  } catch (e: any) {
    console.log(`[BRIGHTDATA_UNLOCKER] Fetch error: ${e.message}`);
    return {
      success: false,
      html: "",
      status: 0,
      error: `BrightData Unlocker fetch failed: ${e.message}`,
    };
  }
}

// Amazon Registry-specific fetch with BrightData Unlocker (no ScraperAPI fallback - Amazon blocks it)
interface AmazonRegistryFetchResult {
  html: string;
  method: "BRIGHTDATA" | "DIRECT";
  status: number;
  error?: string;
  requiresManualUpload?: boolean;
  blockedOrLogin?: boolean;
}

async function fetchAmazonRegistryWithUnlocker(url: string): Promise<AmazonRegistryFetchResult> {
  // Essential: Request start line
  console.log(`[AMAZON_REGISTRY_FETCH] Request for URL: ${url}`);
  
  const maxRetries = 3;
  const delays = [1500, 3000, 5000]; // Backoff delays in ms
  const amazonExpect = JSON.stringify({ text: 'Add to Cart' });
  
  // Try BrightData with retries and UA rotation
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const ua = getRandomUserAgent();
    if (DEBUG) console.log(`[AMAZON_REGISTRY_FETCH] Attempt ${attempt}/${maxRetries} | UA: "${ua.substring(0, 50)}..."`);
    
    const brightDataToken = Deno.env.get("BRIGHTDATA_UNLOCKER_API_TOKEN");
    const brightDataZone = Deno.env.get("BRIGHTDATA_UNLOCKER_ZONE");
    
    if (!brightDataToken || !brightDataZone) {
      if (DEBUG) console.log("[AMAZON_REGISTRY_FETCH] Missing BrightData credentials");
      break;
    }
    
    try {
      const response = await fetch("https://api.brightdata.com/request", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${brightDataToken}`,
          "Content-Type": "application/json",
          "User-Agent": ua,
          "x-unblock-expect": amazonExpect,
        },
        body: JSON.stringify({
          zone: brightDataZone,
          url: url,
          format: "raw",
        }),
      });
      
      const status = response.status;
      if (DEBUG) console.log(`[AMAZON_REGISTRY_FETCH] Response status: ${status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (DEBUG) console.log(`[AMAZON_REGISTRY_FETCH] Failed attempt ${attempt} | status=${status} | error=${errorText.substring(0, 200)}`);
      } else {
        const html = await response.text();
        const title = extractHtmlTitle(html);
        const blocked = isAmazonBlockedOrLogin(html);
        
        if (DEBUG) console.log(`[AMAZON_REGISTRY_FETCH] Attempt ${attempt} | status=${status} | title="${title}" | blocked=${blocked} | length=${html.length}`);
        
        if (!blocked && html.length > 5000) {
          // Essential: Fetch summary
          console.log(`[AMAZON_REGISTRY_FETCH] Fetch success via BRIGHTDATA | status=${status} | length=${html.length}`);
          return {
            html,
            method: "BRIGHTDATA",
            status,
            blockedOrLogin: false,
          };
        }
        
        if (DEBUG && blocked) {
          console.log(`[AMAZON_REGISTRY_FETCH] Blocked/login detected on attempt ${attempt} | title="${title}"`);
        }
      }
    } catch (e: any) {
      if (DEBUG) console.log(`[AMAZON_REGISTRY_FETCH] Fetch error on attempt ${attempt}: ${e.message}`);
    }
    
    // Sleep before retry (except after last attempt)
    if (attempt < maxRetries) {
      const delay = delays[attempt - 1];
      const randomizedDelay = delay + Math.floor(Math.random() * 1000);
      if (DEBUG) console.log(`[AMAZON_REGISTRY_FETCH] Waiting ${randomizedDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, randomizedDelay));
    }
  }
  
  if (DEBUG) console.log("[AMAZON_REGISTRY_FETCH] All BrightData retry attempts exhausted");
  
  // Strategy 2: Try direct fetch as last resort (usually won't work for Amazon)
  const directResult = await fetchDirect(url);
  
  if (DEBUG) console.log(`[AMAZON_REGISTRY_FETCH] Direct fetch result: ok=${directResult.ok}, status=${directResult.status}, length=${directResult.html?.length || 0}`);
  
  if (directResult.ok && directResult.html.length > 5000) {
    const blockedOrLogin = isAmazonBlockedOrLogin(directResult.html);
    if (DEBUG) console.log(`[AMAZON_REGISTRY_FETCH] Direct fetch blocked/login check: ${blockedOrLogin}`);
    
    if (!blockedOrLogin) {
      // Essential: Fetch summary
      console.log(`[AMAZON_REGISTRY_FETCH] Fetch success via DIRECT | status=${directResult.status} | length=${directResult.html.length}`);
      return {
        html: directResult.html,
        method: "DIRECT",
        status: directResult.status,
        blockedOrLogin: false,
      };
    }
    
    if (DEBUG) {
      const titleMatch = directResult.html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : "No title found";
      console.log(`[AMAZON_REGISTRY_FETCH] Blocked/login page detected via direct | Title: ${pageTitle}`);
    }
  }
  
  // All strategies failed - return manual upload required
  // Essential: Final result line
  console.log("[AMAZON_REGISTRY_FETCH] All strategies failed - requiresManualUpload=true");
  return {
    html: "",
    method: "BRIGHTDATA",
    status: 0,
    error: "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.",
    requiresManualUpload: true,
    blockedOrLogin: true,
  };
}

async function fetchWithScraperAPI(
  url: string,
  apiKey?: string,
  options: FetchOptions = {}
): Promise<string> {
  if (!apiKey) {
    throw new Error(
      "ScraperAPI key required for Amazon scraping. Please add SCRAPER_API_KEY to environment variables."
    );
  }

  // Build ScraperAPI URL with options
  let scraperApiUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true`;
  
  // Add browser headers option for better compatibility
  if (options.withBrowserHeaders) {
    scraperApiUrl += "&keep_headers=true";
  }
  
  // Add country code if specified
  if (options.country) {
    scraperApiUrl += `&country_code=${options.country}`;
  }
  
  // Use premium proxy if needed for restricted pages
  if (options.premium) {
    scraperApiUrl += "&premium=true";
  }
  
  // Use ultra_premium for most demanding JS-rendered sites (Crate/CB2)
  if (options.ultraPremium) {
    scraperApiUrl += "&ultra_premium=true";
  }

  const headers: Record<string, string> = {};
  
  // Add browser-like headers when requested
  if (options.withBrowserHeaders) {
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
    headers["Accept-Language"] = "en-US,en;q=0.9";
    headers["Accept-Encoding"] = "gzip, deflate, br";
    headers["Cache-Control"] = "no-cache";
    headers["Pragma"] = "no-cache";
  }

  const response = await fetch(scraperApiUrl, {
    method: "GET",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (!response.ok) {
    throw new Error(`ScraperAPI error: ${response.status}`);
  }

  return await response.text();
}

// Target HTML fetch removed - using API-based approach instead

Deno.serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const origin = req.headers.get('Origin');
  const dynamicCorsHeaders = { ...CORS_HEADERS, ...getCorsHeaders(origin) };

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, items: [], message: "Method not allowed" }),
      {
        headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }

  try {
    const { url: rawUrl } = await req.json();
    
    // Normalize incoming URL: trim whitespace and ensure protocol
    let url = (rawUrl || '').toString().trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const retailer = detectRetailer(url);
    
    // Essential: Request start line (show normalized URL)
    console.log(`[SCRAPE_START] retailer=${retailer || "UNSUPPORTED"} | url=${url} | raw=${rawUrl}`);

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ success: false, items: [], message: "URL is required" }),
        {
          headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (!retailer) {
      return new Response(
        JSON.stringify({
          success: false,
          items: [],
          message: "This retailer requires sign-in or doesn't provide a public share link. Please use File Import or Paste Items.",
        }),
        {
          headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const scraperApiKey = Deno.env.get("SCRAPER_API_KEY");
    
    const DEBUG_SCRAPE_HTML = (Deno.env.get('DEBUG_SCRAPE_HTML') || '').toLowerCase() === 'true';
    
    function escapeRegex(string: string): string {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape all regex special chars including brackets
    }
    
    function safeSnippet(html: string, len = 800) {
      if (!html) return '';
      return html.slice(0, len).replace(/\s+/g, ' ').trim();
    }
    
    async function maybeWriteDebugHtml(filename: string, html: string) {
      if (!DEBUG_SCRAPE_HTML) return;
      try {
        await Deno.writeTextFile(filename, html);
        console.log(`[DEBUG_HTML] wrote ${filename} (${html?.length || 0} chars)`);
      } catch (e) {
        console.log(`[DEBUG_HTML] failed to write ${filename}: ${String(e)}`);
      }
    }
    
    function tryExtractNextDataJson(html: string): any | null {
      try {
        const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/i);
        if (!m) return null;
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    }
    
    function looksLikeProductItem(obj: any): boolean {
      if (!obj || typeof obj !== 'object') return false;
      const keys = Object.keys(obj);

      // Target signals
      const targetSignals =
        keys.includes('tcin') ||
        keys.includes('product') ||
        keys.includes('product_description') ||
        keys.includes('productTitle') ||
        keys.includes('item') ||
        keys.includes('item_id') ||
        keys.includes('images') ||
        keys.includes('image') ||
        keys.includes('price') ||
        keys.includes('formatted_current_price') ||
        keys.includes('current_retail') ||
        keys.includes('primary_offer') ||
        keys.includes('offers');

      // Walmart signals
      const walmartSignals =
        keys.includes('usItemId') ||
        keys.includes('itemId') ||
        keys.includes('canonicalUrl') ||
        keys.includes('name') ||
        keys.includes('title') ||
        keys.includes('priceInfo') ||
        keys.includes('imageInfo') ||
        keys.includes('thumbnailUrl');

      return targetSignals || walmartSignals;
    }
    
    function findCandidateArrays(obj: any, maxDepth = 9) {
      const results: Array<{ path: string; length: number; sampleKeys: string[] }> = [];
      const seen = new Set<any>();

      function walk(node: any, path: string, depth: number) {
        if (!node || depth > maxDepth) return;
        if (typeof node !== 'object') return;
        if (seen.has(node)) return;
        seen.add(node);

        if (Array.isArray(node)) {
          if (node.length > 0 && looksLikeProductItem(node[0])) {
            const sampleKeys = node[0] && typeof node[0] === 'object' ? Object.keys(node[0]).slice(0, 20) : [];
            results.push({ path, length: node.length, sampleKeys });
          }
          for (let i = 0; i < Math.min(node.length, 10); i++) {
            walk(node[i], `${path}[${i}]`, depth + 1);
          }
          return;
        }

        for (const [k, v] of Object.entries(node)) {
          walk(v, path ? `${path}.${k}` : k, depth + 1);
        }
      }

      walk(obj, '', 0);
      results.sort((a, b) => b.length - a.length);
      return results.slice(0, 12);
    }
    
    function findPayloadObjects(obj: any, maxDepth = 10) {
      const results: Array<{ path: string; sampleKeys: string[] }> = [];
      const seen = new Set<any>();

      function walk(node: any, path: string, depth: number) {
        if (!node || depth > maxDepth) return;
        if (typeof node !== 'object') return;
        if (seen.has(node)) return;
        seen.add(node);

        if (!Array.isArray(node)) {
          const keys = Object.keys(node);
          if (keys.includes('payload') && typeof (node as any).payload === 'object') {
            const pk = Object.keys((node as any).payload || {}).slice(0, 25);
            results.push({ path: path ? `${path}.payload` : 'payload', sampleKeys: pk });
          }
          for (const [k, v] of Object.entries(node)) {
            walk(v, path ? `${path}.${k}` : k, depth + 1);
          }
        } else {
          for (let i = 0; i < Math.min(node.length, 10); i++) {
            walk(node[i], `${path}[${i}]`, depth + 1);
          }
        }
      }

      walk(obj, '', 0);
      return results.slice(0, 12);
    }

    if (!scraperApiKey) {
      console.error("[SCRAPE_ERROR] SCRAPER_API_KEY is not set in environment variables");
      return new Response(
        JSON.stringify({
          success: false,
          items: [],
          message: "Scraping service is temporarily unavailable. Please contact support or try again later.",
        }),
        {
          headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Handle Target via API (no HTML scraping)
    if (retailer === "Target") {
      const registryId = extractTargetRegistryId(url);
      if (!registryId) {
        console.log(`[SCRAPE_ERROR] Could not extract Target registry ID from URL: ${url}`);
        return new Response(
          JSON.stringify({
            success: false,
            items: [],
            message: "Invalid Target registry URL. Please ensure the URL is in the format: https://www.target.com/gift-registry/gift/<registryId>",
          }),
          {
            headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
      
      // Use API-based approach for Target
      const targetApiResult = await fetchTargetRegistryViaApi(registryId, url);
      
      if (!targetApiResult.success || targetApiResult.items.length === 0) {
        console.log(`[SCRAPE_RESULT] Target API import failed | error=${targetApiResult.error || "No items found"}`);
        return new Response(
          JSON.stringify({
            success: false,
            items: [],
            message: targetApiResult.error || "No items found in Target registry. The registry may be empty, private, or temporarily unavailable. Please verify your list and try again, or use Manual Upload.",
          }),
          {
            headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
      
      // Essential: Final result line
      console.log(`[SCRAPE_RESULT] success=true | items=${targetApiResult.items.length} | retailer=Target | source=target:${url}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          items: targetApiResult.items,
          retailer: "Target",
          source: `target:${url}`,
          message: "Imported items may include already purchased items.",
        }),
        {
          headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    
    // Handle IKEA via GraphQL API (no HTML scraping)
    if (retailer === "IKEARegistry") {
      const shareId = extractIKEARegistryShareId(url);
      if (!shareId) {
        console.log(`[SCRAPE_ERROR] Could not extract IKEA registry share ID from URL: ${url}`);
        return new Response(
          JSON.stringify({
            success: false,
            items: [],
            message: "Invalid IKEA registry URL. Please ensure the URL is in the format: https://www.ikea.com/us/en/gift-registry/guest/?id=<shareId>",
          }),
          {
            headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
      
      // Use GraphQL API for IKEA
      const ikeaApiResult = await fetchIKEARegistryViaGraphQL(shareId, url);
      
      if (!ikeaApiResult.success || ikeaApiResult.items.length === 0) {
        console.log(`[SCRAPE_RESULT] IKEA GraphQL import failed | error=${ikeaApiResult.error || "No items found"}`);
        return new Response(
          JSON.stringify({
            success: false,
            items: [],
            message: ikeaApiResult.error || "We couldn't retrieve items from this IKEA registry. The registry may be empty, private, or the API structure has changed.",
          }),
          {
            headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
      
      // Essential: Final result line
      console.log(`[SCRAPE_RESULT] success=true | items=${ikeaApiResult.items.length} | retailer=IKEA | source=ikea:${url}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          items: ikeaApiResult.items,
          retailer: "IKEA",
          source: `ikea:${url}`,
        }),
        {
          headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    
    let fetchUrl = url;
    let html: string;
    let fetchStrategy = "standard";
    let fetchMethod = "SCRAPERAPI";
    
    try {
      if (retailer === "WalmartWishlist" || retailer === "WalmartRegistry") {
        // Walmart import is disabled - return unsupported error immediately (no fetch)
        console.log(`[SCRAPE_FETCH] Walmart import disabled | retailer=${retailer} | url=${fetchUrl}`);
        return new Response(
          JSON.stringify({
            success: false,
            items: [],
            message: "Can't import from Walmart right now. Please use Manual Upload.",
            errorCode: "UNSUPPORTED_RETAILER",
          }),
          {
            headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      } else if (retailer === "AmazonRegistry") {
        // Amazon Registry import is disabled - return unsupported error immediately (no fetch)
        console.log(`[SCRAPE_FETCH] Amazon Registry import disabled | retailer=${retailer} | url=${fetchUrl}`);
        return new Response(
          JSON.stringify({
            success: false,
            items: [],
            message: "Can't import from Amazon Registry right now. Please use Manual Upload.",
            errorCode: "UNSUPPORTED_RETAILER",
            requiresManualUpload: true,
          }),
          {
            headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
        
        html = amazonRegistryResult.html;
        
        if (!html || html.length < 1000) {
          return new Response(
            JSON.stringify({
              success: false,
              items: [],
              message: "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.",
              requiresManualUpload: true,
            }),
            {
              headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      } else if (retailer === "MyRegistryBedBathAndBeyond") {
        // Direct fetch for MyRegistry - no ScraperAPI needed
        if (DEBUG) console.log("[SCRAPE_FETCH] MyRegistryBedBathAndBeyond | Using direct fetch");
        fetchMethod = "DIRECT";
        
        try {
          const response = await fetch(fetchUrl, {
            method: "GET",
            headers: {
              "User-Agent": getRandomUserAgent(),
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Cache-Control": "no-cache",
            },
          });
          
          if (!response.ok) {
            console.error(`[MYREGISTRY_FETCH] Initial page fetch failed with status ${response.status}`);
            return new Response(
              JSON.stringify({
                success: false,
                items: [],
                message: "Failed to fetch the Bed Bath & Beyond registry page. Please verify the URL is correct and try again.",
              }),
              {
                headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
                status: 200,
              }
            );
          }
          
          html = await response.text();
          console.log(`[SCRAPE_FETCH] MyRegistryBedBathAndBeyond | provider=DIRECT | length=${html?.length || 0}`);
        } catch (e: any) {
          console.error(`[MYREGISTRY_FETCH] Direct fetch error: ${e.message}`);
          return new Response(
            JSON.stringify({
              success: false,
              items: [],
              message: "Failed to fetch the Bed Bath & Beyond registry page. Please verify the URL is correct and try again.",
            }),
            {
              headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      } else if (retailer === "TheKnotRegistry") {
        // Use ScraperAPI for The Knot (direct fetch gets 403)
        if (DEBUG) console.log("[SCRAPE_FETCH] TheKnotRegistry | Using ScraperAPI");
        fetchMethod = "ScraperAPI";
        
        try {
          html = await fetchWithScraperAPI(fetchUrl, scraperApiKey);
          console.log(`[SCRAPE_FETCH] TheKnotRegistry | provider=ScraperAPI | length=${html?.length || 0}`);
        } catch (e: any) {
          console.error(`[THEKNOT_FETCH] ScraperAPI fetch error: ${e.message}`);
          return new Response(
            JSON.stringify({
              success: false,
              items: [],
              message: "Failed to fetch The Knot registry page. Please verify the URL is correct and try again.",
            }),
            {
              headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      } else if (retailer === "CrateAndBarrelRegistry" || retailer === "CB2Registry") {
        // Crate & Barrel / CB2 import is disabled - return unsupported error immediately (no fetch)
        const displayName = retailer === "CB2Registry" ? "CB2" : "Crate & Barrel";
        console.log(`[SCRAPE_FETCH] ${retailer} import disabled | url=${fetchUrl}`);
        return new Response(
          JSON.stringify({
            success: false,
            items: [],
            message: "Can't import from Crate & Barrel/CB2 right now. Please use Manual Upload.",
            errorCode: "UNSUPPORTED_RETAILER",
          }),
          {
            headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      } else {
        html = await fetchWithScraperAPI(fetchUrl, scraperApiKey);
        // Essential: Fetch summary
        console.log(`[SCRAPE_FETCH] Amazon | provider=ScraperAPI | length=${html?.length || 0}`);
      }
    } catch (fetchError: any) {
      console.error(`[SCRAPE_FETCH_ERROR] Retailer: ${retailer} | Error: ${fetchError.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          items: [],
          message: "Failed to fetch the page. Please verify the URL is correct and try again.",
        }),
        {
          headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    
    // Check for Amazon blocked/captcha pages
    if ((retailer === "Amazon" || retailer === "AmazonRegistry") && isAmazonBlockedPage(html)) {
      if (DEBUG) logHtmlDebugInfo(html, retailer, url);
      return new Response(
        JSON.stringify({
          success: false,
          items: [],
          message: "Amazon blocked the import (captcha/robot check). Please use File Import or Paste Items for Amazon registries.",
        }),
        {
          headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    
    const $ = load(html);
    
    let items: ScrapedItem[] = [];
    let displayRetailer = retailer;
    let scrapeError: string | null = null;
    
    // Wrap each retailer scraping in try/catch to prevent non-2xx responses
    // NOTE: Target is now handled via API above and returns early
    if (retailer === "AmazonRegistry") {
      try {
        displayRetailer = "Amazon Registry";
        
        // First, analyze the HTML to understand what we're dealing with
        const analysis = analyzeAmazonRegistryHtml(html, url);
        
        // Try standard HTML parsing first
        items = scrapeAmazonRegistry($, html, url);
        if (DEBUG) console.log("[SCRAPE_PARSE] Amazon Registry initial parsing, items extracted:", items.length);
        
        // If no items found, check if it's a shell page and try API extraction
        if (items.length === 0) {
          if (DEBUG) console.log("[SCRAPE_DEBUG] AmazonRegistry returned 0 items, analyzing page...");
          if (DEBUG) logHtmlDebugInfo(html, retailer, url, DEBUG_SCRAPE_HTML);
          
          if (analysis.isShellPage || !analysis.markers.hasRegistryItem) {
            if (DEBUG) console.log("[AMAZON_REGISTRY] Detected shell page or no registry items in HTML, attempting API extraction...");
            
            // Try API-based extraction (only if DEBUG enabled for deep recursion)
            if (DEBUG) {
              const apiResult = await tryAmazonRegistryApi(analysis, scraperApiKey);
              
              if (apiResult.success && apiResult.items.length > 0) {
                items = apiResult.items;
                console.log(`[AMAZON_REGISTRY] API extraction successful: ${items.length} items`);
              } else if (apiResult.requiresAuth) {
                if (DEBUG) console.log("[AMAZON_REGISTRY] API requires auth/cookies, falling back to manual import message");
                scrapeError = "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.";
              } else {
                if (DEBUG) console.log("[AMAZON_REGISTRY] API extraction failed:", apiResult.error);
                scrapeError = "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.";
              }
            } else {
              // In production, skip deep recursion and go straight to manual upload
              scrapeError = "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.";
            }
          } else {
            // Page has registry markers but no items - might be empty or parsing failed
            if (DEBUG) console.log("[AMAZON_REGISTRY] Page appears to have registry content but no items extracted");
            scrapeError = "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.";
          }
        }
        
        // Essential: Parse summary
        console.log(`[SCRAPE_PARSE] AmazonRegistry | items=${items.length} | parseMethod=scrapeAmazonRegistry`);
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: AmazonRegistry | URL: ${url} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        logHtmlDebugInfo(html, retailer, url);
        scrapeError = "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.";
      }
    } else if (retailer === "MyRegistryBedBathAndBeyond") {
      try {
        displayRetailer = "Bed Bath & Beyond Registry";
        const result = await scrapeMyRegistryBedBathAndBeyond($, html, url);
        items = result.items;
        
        // Essential: Parse summary
        console.log(`[SCRAPE_PARSE] MyRegistryBedBathAndBeyond | items=${items.length} | parseMethod=scrapeMyRegistryBedBathAndBeyond`);
        
        // Debug log if no items found
        if (items.length === 0 && DEBUG) {
          console.log(`[SCRAPE_DEBUG] MyRegistry Bed Bath & Beyond returned 0 items | Fetch method used: ${fetchMethod}`);
          logHtmlDebugInfo(html, retailer, url, DEBUG_SCRAPE_HTML);
        }
        
        if (result.error) {
          scrapeError = result.error;
        }
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: MyRegistryBedBathAndBeyond | URL: ${url} | Error: ${e.message}`);
        if (DEBUG) logHtmlDebugInfo(html, retailer, url);
        scrapeError = "Bed Bath & Beyond registry import failed. Please try again later or use File Import.";
      }
    } else if (retailer === "TheKnotRegistry") {
      try {
        displayRetailer = "The Knot Registry";
        const result = await scrapeTheKnotRegistry($, html, url);
        items = result.items;
        
        // Essential: Parse summary
        console.log(`[SCRAPE_PARSE] TheKnotRegistry | items=${items.length} | parseMethod=scrapeTheKnotRegistry`);
        
        // Debug log if no items found
        if (items.length === 0 && DEBUG) {
          console.log(`[SCRAPE_DEBUG] The Knot Registry returned 0 items | Fetch method used: ${fetchMethod}`);
          logHtmlDebugInfo(html, retailer, url, DEBUG_SCRAPE_HTML);
        }
        
        if (result.error) {
          scrapeError = result.error;
        }
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: TheKnotRegistry | URL: ${url} | Error: ${e.message}`);
        if (DEBUG) logHtmlDebugInfo(html, retailer, url);
        scrapeError = "The Knot registry import failed. Please try again later or use File Import.";
      }
    } else {
      try {
        items = scrapeAmazon($);
        // Essential: Parse summary
        console.log(`[SCRAPE_PARSE] Amazon | items=${items.length} | parseMethod=scrapeAmazon`);
        
        // Debug log if no items found
        if (items.length === 0 && DEBUG) {
          console.log("[SCRAPE_DEBUG] Amazon wishlist returned 0 items, logging HTML info...");
          logHtmlDebugInfo(html, retailer, url, DEBUG_SCRAPE_HTML);
        }
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: Amazon | URL: ${url} | Error: ${e.message}`);
        if (DEBUG) logHtmlDebugInfo(html, retailer, url);
        scrapeError = "No items found. The list might be empty, private, or the page structure has changed.";
      }
    }
    
    // Return structured error response (HTTP 200) if scraping failed or found 0 items
    if (scrapeError || items.length === 0) {
      let errorMessage: string;
      let requiresManualUpload = false;
      
      if (scrapeError) {
        errorMessage = scrapeError;
        // Check if this is an Amazon registry manual upload case
        if (retailer === "AmazonRegistry" && scrapeError.includes("Amazon restrictions")) {
          requiresManualUpload = true;
        }
      } else if (retailer === "AmazonRegistry") {
        errorMessage = "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.";
        requiresManualUpload = true;
      } else if (retailer === "MyRegistryBedBathAndBeyond") {
        errorMessage = "We couldn't retrieve items from this Bed Bath & Beyond registry. The registry may be empty, private, or the page structure has changed.";
      } else if (retailer === "TheKnotRegistry") {
        errorMessage = "We couldn't retrieve items from this The Knot registry. The registry may be empty, private, or the page structure has changed.";
      } else {
        errorMessage = "No items found. The list might be empty, private, or the page structure has changed.";
      }
      // Essential: Final result line
      console.log(`[SCRAPE_RESULT] success=false | items=0 | retailer=${retailer} | requiresManualUpload=${requiresManualUpload}`);
      return new Response(
        JSON.stringify({
          success: false,
          items: [],
          message: errorMessage,
          requiresManualUpload,
        }),
        {
          headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Essential: Final result line
    console.log(`[SCRAPE_RESULT] success=true | items=${items.length} | retailer=${displayRetailer}`);
    return new Response(
      JSON.stringify({
        success: true,
        retailer: displayRetailer,
        items,
        message: null,
      }),
      {
        headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[SCRAPE_UNEXPECTED_ERROR] Error:", error.message || error);
    console.error("[SCRAPE_UNEXPECTED_ERROR] Stack:", error.stack || "No stack trace");

    const errorMessage = error.message?.includes("ScraperAPI")
      ? "Scraping service error. Please try again in a few minutes or contact support."
      : "Failed to import wishlist. Please verify the URL is correct and the wishlist is public, then try again.";
    
    // Essential: Final result line
    console.log(`[SCRAPE_RESULT] success=false | items=0 | error=${error.message?.substring(0, 100)}`);
    
    // Always return HTTP 200 with structured error for better frontend handling
    return new Response(
      JSON.stringify({
        success: false,
        items: [],
        message: errorMessage,
      }),
      {
        headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
