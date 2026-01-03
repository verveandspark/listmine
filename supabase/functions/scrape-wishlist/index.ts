import { load } from "https://esm.sh/cheerio@1.0.0-rc.12";

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex special chars
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  return null;
};

// Normalize Target registry URLs to canonical form: /gift-registry/gift-giver?registryId=<uuid>
const normalizeTargetRegistryUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    
    // Pattern 1: /gift-registry/gift/<uuid> -> extract uuid from path
    const giftPathMatch = urlObj.pathname.match(/\/gift-registry\/gift\/([a-f0-9-]+)/i);
    if (giftPathMatch && giftPathMatch[1]) {
      const registryId = escapeRegex(giftPathMatch[1]);
      console.log('[SAFE_QUERY] Target registryId (escaped):', registryId);
      return `https://www.target.com/gift-registry/gift-giver?registryId=${registryId}`;
    }
    
    // Pattern 2: /gift-registry/gift-giver with registryId query param
    if (urlObj.pathname.includes("/gift-registry/gift-giver")) {
      const rawRegistryId = urlObj.searchParams.get("registryId");
      if (rawRegistryId) {
        const registryId = escapeRegex(rawRegistryId);
        console.log('[SAFE_QUERY] Target registryId from query (escaped):', registryId);
        // Normalize to just the registryId param for consistency
        return `https://www.target.com/gift-registry/gift-giver?registryId=${registryId}`;
      }
    }
    
    // Return original if no normalization needed
    return url;
  } catch (e) {
    console.error("Failed to normalize Target registry URL:", e);
    return url;
  }
};

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

// Walmart-specific fetch with retries and random user-agent rotation
interface WalmartRetryFetchResult {
  success: boolean;
  html: string;
  status: number;
  error?: string;
  attemptsMade: number;
}

async function fetchWalmartWithRetries(
  url: string,
  maxRetries: number = 3
): Promise<WalmartRetryFetchResult> {
  let attempt = 0;
  let lastError = "";
  
  while (attempt < maxRetries) {
    try {
      // Randomize User-Agent header for each attempt
      const userAgent = getRandomUserAgent();
      console.log(`[WALMART_RETRY_FETCH] Attempt ${attempt + 1}/${maxRetries} with UA: ${userAgent.substring(0, 50)}...`);
      
      const fetchOptions: RequestInit = {
        method: "GET",
        headers: {
          "User-Agent": userAgent,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Upgrade-Insecure-Requests": "1",
          "Referer": "https://www.walmart.com/",
        },
        redirect: "follow",
      };
      
      const response = await fetch(url, fetchOptions);
      const html = await response.text();
      
      console.log(`[WALMART_RETRY_FETCH] Response status: ${response.status}, length: ${html.length}`);
      
      // Check if blocked
      if (!isBlockedResponse(html) && !isWalmartBlockPage(html) && html.length > 5000) {
        console.log(`[WALMART_RETRY_FETCH] Success on attempt ${attempt + 1}`);
        return {
          success: true,
          html,
          status: response.status,
          attemptsMade: attempt + 1,
        };
      } else {
        const title = extractHtmlTitle(html);
        console.log(`[WALMART_RETRY_FETCH] Block detected on attempt ${attempt + 1} | title="${title}" | length=${html.length}`);
        lastError = `Block detected (title: ${title})`;
      }
    } catch (e: any) {
      console.log(`[WALMART_RETRY_FETCH] Fetch error on attempt ${attempt + 1}: ${e.message}`);
      lastError = e.message;
    }
    
    // Random delay between retries (1-3 seconds)
    const delay = 1000 + Math.random() * 2000;
    console.log(`[WALMART_RETRY_FETCH] Waiting ${Math.round(delay)}ms before retry...`);
    await new Promise((res) => setTimeout(res, delay));
    attempt++;
  }
  
  console.log(`[WALMART_RETRY_FETCH] Max retries (${maxRetries}) reached, all attempts blocked`);
  return {
    success: false,
    html: "",
    status: 0,
    error: lastError || "Max retries reached, fetch blocked.",
    attemptsMade: maxRetries,
  };
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
  
  console.log("[AMAZON_REGISTRY_ANALYZE] Shell page markers:");
  console.log(`  - registry-item: ${markers.hasRegistryItem}`);
  console.log(`  - gl-guest-view: ${markers.hasGlGuestView}`);
  console.log(`  - p13n: ${markers.hasP13n}`);
  console.log(`  - csrf: ${markers.hasCsrf}`);
  console.log(`  - data-a-state: ${markers.hasDataAState}`);
  
  // Extract configuration for potential API calls
  const extractedConfig: AmazonRegistryAnalysis["extractedConfig"] = {};
  
  // Extract registry ID from URL or HTML
  const registryIdMatch = url.match(/\/guest-view\/([A-Z0-9]+)/i) || 
                          url.match(/registryId[=\/]([A-Z0-9]+)/i) ||
                          html.match(/registryId["']\s*:\s*["']([A-Z0-9]+)["']/i) ||
                          html.match(/listId["']\s*:\s*["']([A-Z0-9]+)["']/i);
  if (registryIdMatch) {
    extractedConfig.registryId = registryIdMatch[1];
    console.log(`[AMAZON_REGISTRY_ANALYZE] Found registryId: ${extractedConfig.registryId}`);
  }
  
  // Extract list ID
  const listIdMatch = html.match(/["']listId["']\s*:\s*["']([A-Z0-9]+)["']/i) ||
                      html.match(/data-list-id=["']([A-Z0-9]+)["']/i);
  if (listIdMatch) {
    extractedConfig.listId = listIdMatch[1];
    console.log(`[AMAZON_REGISTRY_ANALYZE] Found listId: ${extractedConfig.listId}`);
  }
  
  // Extract marketplace ID
  const marketplaceIdMatch = html.match(/marketplaceId["']\s*:\s*["']([A-Z0-9]+)["']/i) ||
                             html.match(/obfuscatedMarketplaceId["']\s*:\s*["']([A-Z0-9]+)["']/i);
  if (marketplaceIdMatch) {
    extractedConfig.marketplaceId = marketplaceIdMatch[1];
    console.log(`[AMAZON_REGISTRY_ANALYZE] Found marketplaceId: ${extractedConfig.marketplaceId}`);
  }
  
  // Extract CSRF token
  const csrfMatch = html.match(/anti-csrftoken-a2z["']\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/csrf["']\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/csrfToken["']\s*:\s*["']([^"']+)["']/i) ||
                    html.match(/name=["']csrf[^"']*["']\s+value=["']([^"']+)["']/i);
  if (csrfMatch) {
    extractedConfig.csrfToken = csrfMatch[1];
    console.log(`[AMAZON_REGISTRY_ANALYZE] Found CSRF token (length: ${extractedConfig.csrfToken?.length})`);
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
      console.log(`[AMAZON_REGISTRY_ANALYZE] Found potential API endpoint: ${extractedConfig.apiEndpoint}`);
      break;
    }
  }
  
  // Determine if this is a shell page (minimal content, markers present but no actual items rendered)
  const hasMinimalContent = html.length < 50000;
  const hasShellMarkers = markers.hasDataAState || markers.hasP13n;
  const lacksItemData = !lowerHtml.includes('"asin"') && !lowerHtml.includes('data-asin=');
  
  const isShellPage = hasMinimalContent && hasShellMarkers && lacksItemData;
  console.log(`[AMAZON_REGISTRY_ANALYZE] Shell page detection: isShell=${isShellPage} (minContent=${hasMinimalContent}, shellMarkers=${hasShellMarkers}, lacksItems=${lacksItemData})`);
  
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
  console.log("[AMAZON_REGISTRY_API] Attempting API-based extraction...");
  
  const { extractedConfig } = analysis;
  
  // If we don't have enough info to call an API, return early
  if (!extractedConfig.registryId && !extractedConfig.listId) {
    console.log("[AMAZON_REGISTRY_API] No registry/list ID found, cannot attempt API call");
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
        console.log("[AMAZON_REGISTRY_API] API endpoint returned captcha/blocked");
        return { success: false, items: [], requiresAuth: true, error: "Blocked by Amazon" };
      }
      
      // Try to parse as JSON
      let items: ScrapedItem[] = [];
      
      try {
        const jsonData = JSON.parse(responseText);
        console.log("[AMAZON_REGISTRY_API] Successfully parsed JSON response");
        
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
            console.log(`[AMAZON_REGISTRY_API] Found ${itemArray.length} items in JSON`);
            
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
              console.log(`[AMAZON_REGISTRY_API] Extracted ${items.length} items from API`);
              return { success: true, items, requiresAuth: false };
            }
          }
        }
      } catch (jsonErr) {
        // Not JSON, try HTML parsing
        console.log("[AMAZON_REGISTRY_API] Response is not JSON, checking for HTML items...");
        
        // Check if response contains ASIN data
        const asinMatches = responseText.matchAll(/data-asin=["']([A-Z0-9]{10})["']/gi);
        const asins = [...asinMatches].map(m => m[1]);
        
        if (asins.length > 0) {
          console.log(`[AMAZON_REGISTRY_API] Found ${asins.length} ASINs in HTML response`);
          // If we found ASINs, the page has some data but needs DOM parsing
          // Return empty to let DOM parser handle it
        }
      }
      
    } catch (e: any) {
      console.log(`[AMAZON_REGISTRY_API] Error with endpoint: ${e.message}`);
    }
  }
  
  console.log("[AMAZON_REGISTRY_API] All API endpoints failed or require auth");
  return { success: false, items: [], requiresAuth: true, error: "No accessible API found" };
};

// Check if Target returned a restricted/private/blocked page
const isTargetRestrictedPage = (html: string): { restricted: boolean; reason: string } => {
  const lowerHtml = html.toLowerCase();
  
  // Check for access restriction markers
  const restrictedMarkers = [
    { marker: "registry not found", reason: "Registry not found" },
    { marker: "this registry is private", reason: "Private registry" },
    { marker: "unable to load registry", reason: "Unable to load registry" },
    { marker: "no items in this registry", reason: "Empty registry page" },
    { marker: "registry is no longer available", reason: "Registry no longer available" },
    { marker: "page you requested cannot be found", reason: "Page not found" },
    { marker: "sorry, something went wrong", reason: "Error page" },
    { marker: "access denied", reason: "Access denied" },
    { marker: "403 forbidden", reason: "Forbidden" },
    { marker: "please sign in", reason: "Sign-in required" },
    { marker: "sign in to view", reason: "Sign-in required to view" },
  ];
  
  for (const { marker, reason } of restrictedMarkers) {
    if (lowerHtml.includes(marker)) {
      return { restricted: true, reason };
    }
  }
  
  // Check if page has very minimal content (might be a loading/error page)
  if (html.length < 5000 && !lowerHtml.includes("__next_data__") && !lowerHtml.includes("registry")) {
    return { restricted: true, reason: "Minimal page content - possible loading/error state" };
  }
  
  return { restricted: false, reason: "" };
};

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

// Helper to check if object looks like a Target product item
const isPlausibleTargetItem = (item: any): boolean => {
  if (typeof item !== 'object' || !item) return false;
  const keys = Object.keys(item);
  const productKeys = ['tcin', 'tcinList', 'product', 'productTitle', 'title', 'price', 'image', 'primaryImageUrl', 'name', 'dpci', 'pdpUrl'];
  return productKeys.some(k => keys.includes(k));
};

// Helper to deep search for plausible items array in Target data
const findTargetItemsDeep = (obj: any, depth = 0, maxDepth = 8, currentPath = ""): { items: any[]; path: string } | null => {
  if (depth > maxDepth || !obj || typeof obj !== 'object') return null;
  
  if (Array.isArray(obj)) {
    if (obj.length > 0 && isPlausibleTargetItem(obj[0])) {
      return { items: obj, path: currentPath };
    }
    for (let i = 0; i < obj.length; i++) {
      const found = findTargetItemsDeep(obj[i], depth + 1, maxDepth, `${currentPath}[${i}]`);
      if (found) return found;
    }
  } else {
    for (const key in obj) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      const found = findTargetItemsDeep(obj[key], depth + 1, maxDepth, newPath);
      if (found) return found;
    }
  }
  return null;
};

// Normalize Target items to standard shape
const normalizeTargetItem = (item: any): ScrapedItem | null => {
  const product = item.product || item.productDetails || item.productInfo || item;
  
  const name = product.productTitle || product.title || product.name || 
               product.description || product.displayName ||
               item.productTitle || item.title || item.name || item.displayName;
  
  if (!name || name === "Unknown Item") return null;
  
  // Build URL from tcin if needed
  let productUrl: string | undefined;
  const url = product.canonicalUrl || product.url || product.pdpUrl || product.productUrl || 
              item.canonicalUrl || item.url || item.pdpUrl;
  if (url) {
    productUrl = url.startsWith('http') ? url : `https://www.target.com${url}`;
  } else if (product.tcin || item.tcin) {
    productUrl = `https://www.target.com/p/-/A-${product.tcin || item.tcin}`;
  }
  
  const imageUrl = product.images?.[0] || 
                   product.image?.baseUrl || 
                   product.image ||
                   product.primaryImageUrl ||
                   product.imageUrl ||
                   product.thumbnailUrl ||
                   item.images?.[0] ||
                   item.imageUrl || 
                   item.image || 
                   item.primaryImageUrl || undefined;
  
  const price = product.price?.formattedCurrentPrice ||
               product.price?.currentRetail?.toString() || 
               product.price?.regularPrice?.toString() ||
               product.formattedPrice ||
               product.price ||
               item.price?.formattedCurrentPrice ||
               item.price || 
               item.formattedPrice || undefined;
  
  const quantity = item.quantity || item.quantityNeeded || item.quantityWanted || 1;
  
  return { name, link: productUrl, image: imageUrl, price, quantity };
};

// Helper function to detect if an object looks like a product item
function looksLikeProductItem(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const hasProductKeys = ['productTitle', 'title', 'name', 'product'].some(k => k in obj);
  const hasPriceKeys = ['price', 'currentPrice', 'listPrice'].some(k => k in obj);
  const hasUrlKeys = ['url', 'canonicalUrl', 'productUrl'].some(k => k in obj);
  return hasProductKeys || (hasPriceKeys && hasUrlKeys);
}

// Recursive function to find and log all arrays of plausible product items
function logAllProductArrays(obj: any, path = '', debugEnabled: boolean) {
  if (!debugEnabled) return;
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    if (obj.length > 0 && looksLikeProductItem(obj[0])) {
      console.log(`[TARGET_DEEP_SEARCH] Found product array at path: ${path} length: ${obj.length}`);
    }
    obj.forEach((item: any, i: number) => logAllProductArrays(item, `${path}[${i}]`, debugEnabled));
  } else {
    for (const key in obj) {
      logAllProductArrays(obj[key], path ? `${path}.${key}` : key, debugEnabled);
    }
  }
}

const scrapeTargetRegistry = ($: any, html: string, debugEnabled: boolean): ScrapedItem[] => {
  let normalizedItems: any[] = [];
  console.log('[TARGET_PARSER] normalizedItems declared:', typeof normalizedItems !== 'undefined');
  
  console.log("[TARGET_PARSE] Starting Target registry parsing...");
  console.log("[TARGET_PARSE] HTML length:", html.length, "chars");
  
  // Check for basic page content indicators
  const hasNextData = html.includes("__NEXT_DATA__");
  const hasRegistryKeyword = html.toLowerCase().includes("registry");
  const hasGiftKeyword = html.toLowerCase().includes("gift");
  console.log("[TARGET_PARSE] Content indicators - __NEXT_DATA__:", hasNextData, "| 'registry':", hasRegistryKeyword, "| 'gift':", hasGiftKeyword);
  
  // Try to parse embedded JSON first (__NEXT_DATA__)
  try {
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      console.log("[TARGET_PARSE] Found __NEXT_DATA__ script, length:", nextDataScript.length);
      const nextData = JSON.parse(nextDataScript);
      
      // Enhanced debug logging for structure analysis (only if debug enabled)
      if (debugEnabled) {
        console.log("[TARGET_PARSE] nextData keys:", Object.keys(nextData).join(", "));
        console.log("[TARGET_PARSE] nextData.props keys:", Object.keys(nextData?.props ?? {}).join(", "));
        console.log("[TARGET_PARSE] nextData.props.pageProps keys:", Object.keys(nextData?.props?.pageProps ?? {}).join(", "));
        
        const pageProps = nextData?.props?.pageProps ?? {};
        if (pageProps.initialState) {
          console.log("[TARGET_PARSE] pageProps.initialState keys:", Object.keys(pageProps.initialState).join(", "));
        }
        if (pageProps.APOLLO_STATE) {
          console.log("[TARGET_PARSE] pageProps.APOLLO_STATE keys:", Object.keys(pageProps.APOLLO_STATE).slice(0, 10).join(", "), "... (first 10)");
        }
        if (pageProps.dehydratedState) {
          console.log("[TARGET_PARSE] pageProps.dehydratedState keys:", Object.keys(pageProps.dehydratedState).join(", "));
        }
      }
      
      // Expanded candidate paths for registry items
      const candidatePaths = [
        'props.dehydratedState.queries[0].state.data.slots.1008.content.taxonomy_nodes',
        'props.dehydratedState.queries[0].state.data.slots.1058.metadata.components',
        'props.dehydratedState.queries[0].state.data.slots.1008.metadata.components',
        'props.dehydratedState.queries[0].state.data.metadata.breadcrumbs',
        'props.dehydratedState.queries[0].state.data.slots.1608.metadata.components',
        'props.dehydratedState.queries[0].state.data.slots.200.metadata.components',
        'props.dehydratedState.queries[0].state.data.slots.1458.metadata.components',
        'props.dehydratedState.queries[0].state.data.slots.2808.metadata.components',
        'props.dehydratedState.queries[0].state.data.slots.3008.metadata.components',
        'props.dehydratedState.queries[0].state.data.slots.3108.metadata.components',
        'props.dehydratedState.queries[0].state.data.slots.1608.content.taxonomy_nodes',
        'props.sapphireInstance.qualifiedExperiments.pages[0].svc',
        'props.sapphireInstance.qualifiedExperiments.pages[0].svc[0].payload',
        // Previous dehydratedState slot paths
        'props.dehydratedState.queries[0].state.data.slots.1000.metadata.components',
        'props.dehydratedState.queries[0].state.data.slots.3100.metadata.components',
        'props.dehydratedState.queries[0].state.data.slots.1600.content.taxonomy_nodes',
        'props.dehydratedState.queries[0].state.data.slots.1450.metadata.components',
        // Direct item arrays
        "props.pageProps.giftRegistryData.items",
        "props.pageProps.giftGiverData.items",
        "props.pageProps.registryDetails.items",
        "props.pageProps.registryData.items",
        "props.pageProps.registry.items",
        "props.pageProps.giftRegistry.items",
        "props.pageProps.data.items",
        "props.pageProps.props.items",
        "props.pageProps.state.items",
        "props.pageProps.pageData.registry.items",
        "props.pageProps.initialData.registry.items",
        // Registry item variants
        "props.pageProps.registryData.registryItems",
        "props.pageProps.giftRegistryData.registryItems",
        "props.pageProps.registryData.giftRegistryItems",
        "props.pageProps.registryData.registryItemList",
        "props.pageProps.registryData.productItems",
        "props.pageProps.registryData.wantedItems",
        "props.pageProps.registryData.stillNeeded",
        // initialState paths
        "props.pageProps.initialState.items",
        "props.pageProps.initialState.registry.items",
        "props.pageProps.initialState.registryItems",
        "props.pageProps.initialState.giftRegistry.items",
        // dehydratedState paths
        "props.pageProps.dehydratedState.queries",
        // data nested
        "props.pageProps.data.registry.items",
        "props.pageProps.data.giftRegistry.items",
        "props.pageProps.data.registryItems",
      ];
      
      console.log(`[TARGET_PARSE] Checking ${candidatePaths.length} candidate paths...`);
      
      // Run deep search to find all product arrays (only if debug enabled)
      if (debugEnabled) {
        console.log("[TARGET_DEEP_SEARCH] Starting deep recursive search...");
        logAllProductArrays(nextData, '', debugEnabled);
      }
      
      // Combine items from all candidate paths
      const allItems: any[] = [];
      for (const path of candidatePaths) {
        const items = getNestedValue(nextData, path);
        if (Array.isArray(items) && items.length > 0) {
          console.log(`[TARGET_PARSE] Found ${items.length} items at path: ${path}`);
          allItems.push(...items);
        }
      }
      
      console.log(`[TARGET_PARSE] Combined ${allItems.length} items from all paths`);
      
      if (allItems.length > 0) {
        for (const item of allItems) {
          const normalized = normalizeTargetItem(item);
          if (normalized) {
            normalizedItems.push(normalized);
          }
        }
        console.log(`[TARGET_PARSE] Normalized ${normalizedItems.length} items`);
      }
      
      // If primary paths found items, return early
      if (normalizedItems.length > 0) {
        console.log(`[TARGET_PARSE] Returning ${normalizedItems.length} items from combined paths`);
        console.log(`[TARGET_FINAL] items=${normalizedItems.length} via=next_data`);
        return normalizedItems;
      }
      
      // Check APOLLO_STATE for cache entries (common in newer Next.js apps)
      if (pageProps.APOLLO_STATE) {
        console.log("[TARGET_PARSE] Checking APOLLO_STATE for registry items...");
        const apolloState = pageProps.APOLLO_STATE;
        for (const key of Object.keys(apolloState)) {
          const entry = apolloState[key];
          if (entry && typeof entry === 'object') {
            // Look for items arrays in Apollo cache entries
            const possibleItemsKeys = ['items', 'registryItems', 'giftItems', 'productItems'];
            for (const itemKey of possibleItemsKeys) {
              if (Array.isArray(entry[itemKey]) && entry[itemKey].length > 0) {
                console.log(`[TARGET_PARSE] Found ${entry[itemKey].length} items in APOLLO_STATE.${key}.${itemKey}`);
                for (const item of entry[itemKey]) {
                  const normalized = normalizeTargetItem(item);
                  if (normalized) {
                    normalizedItems.push(normalized);
                  }
                }
              }
            }
          }
        }
        
        if (normalizedItems.length > 0) {
          console.log(`[TARGET_PARSE] Items extracted via APOLLO_STATE | Count: ${normalizedItems.length}`);
          console.log(`[TARGET_FINAL] items=${normalizedItems.length} via=apollo_state`);
          return normalizedItems;
        }
      }
      
      // Deep search for any arrays that might contain products
      console.log("[TARGET_PARSE] Standard paths exhausted, attempting deep search fallback...");
      const deepResult = findTargetItemsDeep(nextData?.props?.pageProps);
      
      if (deepResult && deepResult.items.length > 0) {
        console.log(`[TARGET_PARSE] Deep search found ${deepResult.items.length} items at path: ${deepResult.path}`);
        
        for (const item of deepResult.items) {
          const normalized = normalizeTargetItem(item);
          if (normalized && !normalizedItems.some(i => i.name === normalized.name)) {
            normalizedItems.push(normalized);
          }
        }
        
        if (normalizedItems.length > 0) {
          console.log(`[TARGET_PARSE] Items extracted via deep-search at: ${deepResult.path} | Count: ${normalizedItems.length}`);
          console.log(`[TARGET_FINAL] items=${normalizedItems.length} via=deep_search`);
          return normalizedItems;
        }
      }
      
      console.log(`[TARGET_PARSE] __NEXT_DATA__ parsing complete | Total items found: ${normalizedItems.length}`);
    } else {
      console.log("[TARGET_PARSE] No __NEXT_DATA__ script found");
    }
  } catch (e: any) {
    console.log("[TARGET_PARSE] __NEXT_DATA__ parsing failed:", e.message);
  }
  
  // Try to find alternative embedded JSON structures (inline scripts)
  try {
    console.log("[TARGET_PARSE] Searching for alternative embedded JSON...");
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const content = $(script).html() || "";
      if (content.includes("registryItems") || content.includes("giftRegistry") || content.includes("registryItemList")) {
        // Try multiple JSON patterns
        const patterns = [
          /\{"registryItems"\s*:\s*\[[\s\S]*?\]\s*[,}]/,
          /\{"items"\s*:\s*\[[\s\S]*?\]\s*[,}]/,
          /"registryItemList"\s*:\s*(\[[\s\S]*?\])/,
        ];
        
        for (const pattern of patterns) {
          const jsonMatch = content.match(pattern);
          if (jsonMatch) {
            try {
              let itemsArray: any[];
              if (jsonMatch[1]) {
                itemsArray = JSON.parse(jsonMatch[1]);
              } else {
                const parsed = JSON.parse(jsonMatch[0].endsWith(',') ? jsonMatch[0].slice(0, -1) + '}' : jsonMatch[0]);
                itemsArray = parsed.registryItems || parsed.items || [];
              }
              
              itemsArray.forEach((item: any) => {
                const name = item.title || item.name || item.productTitle || "Unknown Item";
                if (name === "Unknown Item") return;
                
                normalizedItems.push({
                  name,
                  link: item.url ? `https://www.target.com${item.url}` : undefined,
                  image: item.image || item.imageUrl || item.primaryImage || undefined,
                  price: item.price || item.formattedPrice || undefined,
                });
              });
              
              if (normalizedItems.length > 0) {
                console.log("[TARGET_PARSE] Parsed from embedded JSON:", normalizedItems.length, "items");
                console.log(`[TARGET_FINAL] items=${normalizedItems.length} via=embedded_json`);
                return normalizedItems;
              }
            } catch (parseErr) {
              // Continue to next pattern
            }
          }
        }
      }
    }
  } catch (e) {
    console.log("[TARGET_PARSE] Alternative JSON parsing failed, falling back to DOM");
  }
  
  // Fallback: DOM parsing
  console.log("[TARGET_PARSE] Attempting DOM parsing...");
  const selectors = [
    '[data-test="registry-item"]',
    '[data-test="gift-registry-item"]',
    '[data-test="productCard"]',
    '.GiftRegistryItem',
    '[class*="RegistryItem"]',
    '[class*="registry-item"]',
    '[class*="ProductCard"]',
    '.styles_productCard',
    '[data-component="ProductCard"]',
    'article[data-test]',
  ];
  
  for (const selector of selectors) {
    $(selector).each((_index: number, element: any) => {
      const $item = $(element);
      
      const name = $item.find('[data-test="product-title"], [class*="ProductTitle"], h3, h4, a[data-test="product-title"]').first().text().trim() ||
                   $item.find('a[href*="/p/"]').first().text().trim() ||
                   $item.find('img').first().attr('alt') || "";
      
      if (!name || name.length < 2) return;
      
      const productLink = $item.find('a[href*="/p/"]').first().attr('href');
      const link = productLink ? `https://www.target.com${productLink}` : undefined;
      
      const image = $item.find('img').first().attr('src') || 
                    $item.find('img').first().attr('data-src') || undefined;
      
      const priceText = $item.find('[data-test="current-price"], [class*="Price"], .styles_price').first().text().trim();
      const price = priceText.match(/\$[\d,.]+/)?.[0] || undefined;
      
      if (!normalizedItems.some(i => i.name === name)) {
        normalizedItems.push({
          name,
          link,
          image,
          price,
        });
      }
    });
    
    if (normalizedItems.length > 0) {
      console.log("[TARGET_PARSE] Parsed from DOM with selector:", selector, normalizedItems.length, "items");
      console.log(`[TARGET_FINAL] items=${normalizedItems.length} via=dom`);
      break;
    }
  }
  
  // Last resort: find any product links
  if (normalizedItems.length === 0) {
    $('a[href*="/p/"]').each((_index: number, element: any) => {
      const $link = $(element);
      const href = $link.attr('href');
      const name = $link.text().trim() || $link.find('img').attr('alt') || "";
      
      if (name && name.length > 3 && !normalizedItems.some(i => i.name === name)) {
        normalizedItems.push({
          name,
          link: href ? `https://www.target.com${href}` : undefined,
          image: $link.find('img').attr('src') || undefined,
        });
      }
    });
    if (normalizedItems.length > 0) {
      console.log("[TARGET_PARSE] Parsed from product links:", normalizedItems.length, "items");
      console.log(`[TARGET_FINAL] items=${normalizedItems.length} via=product_links`);
    }
  }
  
  console.log(`[TARGET_PARSE] ========== END PARSING | Final items: ${normalizedItems.length} ==========`);
  return normalizedItems;
};

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

// Walmart Wishlist/List Scraper
const scrapeWalmartWishlist = ($: any, html: string, url: string): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
  console.log("[WALMART_WISHLIST_PARSE] ========== START PARSING ==========");
  console.log("[WALMART_WISHLIST_PARSE] HTML length:", html.length, "chars");
  console.log("[WALMART_WISHLIST_PARSE] URL:", url);
  
  // Log page title for debugging
  const pageTitle = $('title').text();
  console.log("[WALMART_WISHLIST_PARSE] Page title:", pageTitle);
  
  // Try to parse embedded JSON first (__NEXT_DATA__ or similar)
  try {
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      console.log("[WALMART_WISHLIST_PARSE] Found __NEXT_DATA__ script, length:", nextDataScript.length);
      const nextData = JSON.parse(nextDataScript);
      
      // Enhanced debug logging
      console.log("[WALMART_WISHLIST_PARSE] nextData keys:", Object.keys(nextData).join(", "));
      console.log("[WALMART_WISHLIST_PARSE] nextData.props keys:", Object.keys(nextData?.props ?? {}).join(", "));
      console.log("[WALMART_WISHLIST_PARSE] nextData.props.pageProps keys:", Object.keys(nextData?.props?.pageProps ?? {}).join(", "));
      
      // Navigate through possible paths for list items
      const pathDescriptions = [
        { path: "props.sapphireInstance.qualifiedExperiments.pages[0].svc", data: getNestedValue(nextData, "props.sapphireInstance.qualifiedExperiments.pages[0].svc") },
        { path: "props.pageProps.initialData.list.items", data: nextData?.props?.pageProps?.initialData?.list?.items },
        { path: "props.pageProps.list.items", data: nextData?.props?.pageProps?.list?.items },
        { path: "props.pageProps.data.list.items", data: nextData?.props?.pageProps?.data?.list?.items },
        { path: "props.pageProps.pageData.list.items", data: nextData?.props?.pageProps?.pageData?.list?.items },
        { path: "props.pageProps.listItems", data: nextData?.props?.pageProps?.listItems },
        { path: "props.pageProps.items", data: nextData?.props?.pageProps?.items },
      ];
      
      console.log("[WALMART_WISHLIST_PARSE] Checking paths...");
      
      for (const { path, data: listItems } of pathDescriptions) {
        const isArray = Array.isArray(listItems);
        const len = isArray ? listItems.length : 0;
        console.log(`[WALMART_WISHLIST_PARSE] Path: ${path} | isArray=${isArray} | length=${len}`);
        
        if (isArray && len > 0) {
          console.log(`[WALMART_WISHLIST_PARSE] Found items array at ${path} with ${len} items`);
          
          for (const item of listItems) {
            const product = item.product || item.productDetails || item;
            const name = product.name || product.title || product.productName || 
                        item.name || item.title || "";
            
            if (!name) continue;
            
            const productUrl = product.canonicalUrl || product.url || product.productUrl || 
                              item.url || item.productUrl;
            const link = productUrl ? 
              (productUrl.startsWith('http') ? productUrl : `https://www.walmart.com${productUrl}`) : 
              undefined;
            
            const image = product.imageInfo?.thumbnailUrl || product.imageInfo?.url ||
                         product.image || product.imageUrl || product.thumbnailUrl ||
                         item.image || item.imageUrl || undefined;
            
            const price = product.priceInfo?.currentPrice?.price?.toString() ||
                         product.priceInfo?.itemPrice?.price?.toString() ||
                         product.price || product.formattedPrice ||
                         item.price || undefined;
            
            items.push({
              name,
              link,
              image,
              price: price ? `$${price}` : undefined,
            });
          }
          
          // TEMPORARILY DISABLED: No early return, continue for debugging
          // if (items.length > 0) {
          //   console.log("[WALMART_WISHLIST_PARSE] Extracted", items.length, "items from __NEXT_DATA__");
          //   return items;
          // }
          console.log(`[WALMART_WISHLIST_PARSE] After path ${path}, cumulative items: ${items.length}`);
        }
      }
    } else {
      console.log("[WALMART_WISHLIST_PARSE] No __NEXT_DATA__ script found");
    }
  } catch (e: any) {
    console.log("[WALMART_WISHLIST_PARSE] __NEXT_DATA__ parsing failed:", e.message);
  }
  
  // Try to find embedded JSON in other script tags
  try {
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const content = $(script).html() || "";
      if (content.includes('"listItems"') || content.includes('"items"') || content.includes('"products"')) {
        const itemsMatch = content.match(/"(?:listItems|items|products)"\s*:\s*(\[[^\]]*\])/);
        if (itemsMatch) {
          try {
            const itemsArray = JSON.parse(itemsMatch[1]);
            console.log("[WALMART_WISHLIST_PARSE] Found embedded items array with", itemsArray.length, "items");
            
            for (const item of itemsArray) {
              const name = item.name || item.title || item.productName || "";
              if (!name) continue;
              
              const productUrl = item.canonicalUrl || item.url || item.productUrl;
              const link = productUrl ? 
                (productUrl.startsWith('http') ? productUrl : `https://www.walmart.com${productUrl}`) : 
                undefined;
              
              items.push({
                name,
                link,
                image: item.image || item.imageUrl || item.thumbnailUrl || undefined,
                price: item.price ? `$${item.price}` : undefined,
              });
            }
            
            if (items.length > 0) {
              console.log("[WALMART_WISHLIST_PARSE] Extracted", items.length, "items from embedded JSON");
              return items;
            }
          } catch (parseErr) {
            // Continue searching
          }
        }
      }
    }
  } catch (e: any) {
    console.log("[WALMART_WISHLIST_PARSE] Embedded JSON search failed:", e.message);
  }
  
  // DOM parsing fallback
  console.log("[WALMART_WISHLIST_PARSE] Falling back to DOM parsing...");
  
  const itemSelectors = [
    '[data-testid="list-item"]',
    '[data-automation-id="list-item"]',
    '.list-item',
    '.product-card',
    '[class*="ListItem"]',
    '[class*="product-tile"]',
    'article[data-item-id]',
  ];
  
  for (const selector of itemSelectors) {
    $(selector).each((_index: number, element: any) => {
      const $item = $(element);
      
      const name = $item.find('[data-automation-id="product-title"], [data-testid="product-title"], h2, h3, .product-title').first().text().trim() ||
                   $item.find('a[href*="/ip/"]').first().text().trim() ||
                   $item.find('img').first().attr('alt') || "";
      
      if (!name || name.length < 2) return;
      
      const href = $item.find('a[href*="/ip/"]').first().attr('href');
      const link = href ? (href.startsWith('http') ? href : `https://www.walmart.com${href}`) : undefined;
      
      const image = $item.find('img').first().attr('src') || 
                    $item.find('img').first().attr('data-src') || undefined;
      
      const priceText = $item.find('[data-automation-id="product-price"], .price, [class*="price"]').first().text().trim();
      const price = priceText.match(/\$[\d,.]+/)?.[0] || undefined;
      
      if (!items.some(i => i.name === name)) {
        items.push({
          name,
          link,
          image,
          price,
        });
      }
    });
    
    if (items.length > 0) {
      console.log("[WALMART_WISHLIST_PARSE] Parsed", items.length, "items from DOM with selector:", selector);
      break;
    }
  }
  
  // Last resort: find product links
  if (items.length === 0) {
    $('a[href*="/ip/"]').each((_index: number, element: any) => {
      const $link = $(element);
      const href = $link.attr('href');
      const name = $link.text().trim() || $link.find('img').attr('alt') || "";
      
      if (name && name.length > 3 && !items.some(i => i.name === name)) {
        items.push({
          name,
          link: href ? (href.startsWith('http') ? href : `https://www.walmart.com${href}`) : undefined,
          image: $link.find('img').attr('src') || undefined,
        });
      }
    });
    
    if (items.length > 0) {
      console.log("[WALMART_WISHLIST_PARSE] Extracted", items.length, "items from product links");
    }
  }
  
  console.log("[WALMART_WISHLIST_PARSE] Final item count:", items.length);
  return items;
};

// Walmart Registry Scraper
const scrapeWalmartRegistry = ($: any, html: string, url: string): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
  console.log("[WALMART_REGISTRY_PARSE] ========== START PARSING ==========");
  console.log("[WALMART_REGISTRY_PARSE] HTML length:", html.length, "chars");
  console.log("[WALMART_REGISTRY_PARSE] URL:", url);
  
  // Log page title for debugging
  const pageTitle = $('title').text();
  console.log("[WALMART_REGISTRY_PARSE] Page title:", pageTitle);
  
  // Extract registry ID from URL
  const registryIdMatch = url.match(/\/registry\/WR\/([a-f0-9-]+)/i) ||
                          url.match(/registryId=([a-f0-9-]+)/i);
  const rawRegistryId = registryIdMatch ? registryIdMatch[1] : null;
  const registryId = rawRegistryId ? escapeRegex(rawRegistryId) : null;
  console.log("[WALMART_REGISTRY_PARSE] Extracted registry ID:", registryId || "Not found");
  if (rawRegistryId) console.log('[SAFE_QUERY] Walmart registry ID (escaped):', registryId);
  
  // Try to parse embedded JSON first (__NEXT_DATA__)
  try {
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      console.log("[WALMART_REGISTRY_PARSE] Found __NEXT_DATA__ script, length:", nextDataScript.length);
      const nextData = JSON.parse(nextDataScript);
      
      // Enhanced debug logging
      console.log("[WALMART_REGISTRY_PARSE] nextData keys:", Object.keys(nextData).join(", "));
      console.log("[WALMART_REGISTRY_PARSE] nextData.props keys:", Object.keys(nextData?.props ?? {}).join(", "));
      console.log("[WALMART_REGISTRY_PARSE] nextData.props.pageProps keys:", Object.keys(nextData?.props?.pageProps ?? {}).join(", "));
      
      // Navigate through possible paths for registry items
      const pathDescriptions = [
        { path: "props.sapphireInstance.qualifiedExperiments.pages[0].svc", data: getNestedValue(nextData, "props.sapphireInstance.qualifiedExperiments.pages[0].svc") },
        { path: "props.pageProps.initialData.registry.items", data: nextData?.props?.pageProps?.initialData?.registry?.items },
        { path: "props.pageProps.registry.items", data: nextData?.props?.pageProps?.registry?.items },
        { path: "props.pageProps.registryData.items", data: nextData?.props?.pageProps?.registryData?.items },
        { path: "props.pageProps.data.registry.items", data: nextData?.props?.pageProps?.data?.registry?.items },
        { path: "props.pageProps.registryItems", data: nextData?.props?.pageProps?.registryItems },
        { path: "props.pageProps.pageData.registry.items", data: nextData?.props?.pageProps?.pageData?.registry?.items },
        { path: "props.pageProps.giftRegistry.items", data: nextData?.props?.pageProps?.giftRegistry?.items },
        { path: "props.pageProps.weddingRegistry.items", data: nextData?.props?.pageProps?.weddingRegistry?.items },
      ];
      
      console.log("[WALMART_REGISTRY_PARSE] Checking paths...");
      
      for (const { path, data: registryItems } of pathDescriptions) {
        const isArray = Array.isArray(registryItems);
        const len = isArray ? registryItems.length : 0;
        console.log(`[WALMART_REGISTRY_PARSE] Path: ${path} | isArray=${isArray} | length=${len}`);
        
        if (isArray && len > 0) {
          console.log(`[WALMART_REGISTRY_PARSE] Found registry items array at ${path} with ${len} items`);
          
          for (const item of registryItems) {
            const product = item.product || item.productDetails || item.item || item;
            const name = product.name || product.title || product.productName || 
                        product.displayName || item.name || item.title || "";
            
            if (!name) continue;
            
            const productUrl = product.canonicalUrl || product.url || product.productUrl || 
                              product.pdpUrl || item.url || item.productUrl;
            const link = productUrl ? 
              (productUrl.startsWith('http') ? productUrl : `https://www.walmart.com${productUrl}`) : 
              undefined;
            
            const image = product.imageInfo?.thumbnailUrl || product.imageInfo?.url ||
                         product.image || product.imageUrl || product.thumbnailUrl ||
                         product.primaryImage || item.image || item.imageUrl || undefined;
            
            let price: string | undefined;
            const priceValue = product.priceInfo?.currentPrice?.price ||
                              product.priceInfo?.itemPrice?.price ||
                              product.price || product.currentPrice ||
                              item.price;
            if (priceValue) {
              price = typeof priceValue === 'string' && priceValue.startsWith('$') 
                ? priceValue 
                : `$${priceValue}`;
            }
            
            // Extract quantity if available (registry-specific)
            const quantityRequested = item.quantityRequested || item.requestedQuantity || 
                                     item.wantQuantity || 1;
            const quantityPurchased = item.quantityPurchased || item.purchasedQuantity || 
                                     item.fulfilledQuantity || 0;
            
            console.log(`[WALMART_REGISTRY_PARSE] Item: "${name}" | Price: ${price || 'N/A'} | Qty: ${quantityRequested}/${quantityPurchased}`);
            
            items.push({
              name,
              link,
              image,
              price,
            });
          }
          
          // TEMPORARILY DISABLED: No early return, continue for debugging
          // if (items.length > 0) {
          //   console.log("[WALMART_REGISTRY_PARSE] Extracted", items.length, "items from __NEXT_DATA__");
          //   return items;
          // }
          console.log(`[WALMART_REGISTRY_PARSE] After path ${path}, cumulative items: ${items.length}`);
        }
      }
      
      console.log(`[WALMART_REGISTRY_PARSE] __NEXT_DATA__ parsing complete | Total items: ${items.length}`);
    } else {
      console.log("[WALMART_REGISTRY_PARSE] No __NEXT_DATA__ script found");
    }
  } catch (e: any) {
    console.log("[WALMART_REGISTRY_PARSE] __NEXT_DATA__ parsing failed:", e.message);
  }
  
  // Try to find embedded registry data in other scripts
  try {
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const content = $(script).html() || "";
      if (content.includes('"registryItems"') || content.includes('"registry"') || content.includes('"items"')) {
        const registryMatch = content.match(/"(?:registryItems|items)"\s*:\s*(\[[^\]]*\])/);
        if (registryMatch) {
          try {
            const itemsArray = JSON.parse(registryMatch[1]);
            console.log("[WALMART_REGISTRY_PARSE] Found embedded registry items with", itemsArray.length, "items");
            
            for (const item of itemsArray) {
              const name = item.name || item.title || item.productName || "";
              if (!name) continue;
              
              const productUrl = item.canonicalUrl || item.url || item.productUrl;
              const link = productUrl ? 
                (productUrl.startsWith('http') ? productUrl : `https://www.walmart.com${productUrl}`) : 
                undefined;
              
              items.push({
                name,
                link,
                image: item.image || item.imageUrl || item.thumbnailUrl || undefined,
                price: item.price ? `$${item.price}` : undefined,
              });
            }
            
            if (items.length > 0) {
              console.log("[WALMART_REGISTRY_PARSE] Extracted", items.length, "items from embedded JSON");
              return items;
            }
          } catch (parseErr) {
            // Continue searching
          }
        }
      }
    }
  } catch (e: any) {
    console.log("[WALMART_REGISTRY_PARSE] Embedded JSON search failed:", e.message);
  }
  
  // DOM parsing fallback
  console.log("[WALMART_REGISTRY_PARSE] Falling back to DOM parsing...");
  
  const registryItemSelectors = [
    '[data-testid="registry-item"]',
    '[data-automation-id="registry-item"]',
    '.registry-item',
    '[class*="RegistryItem"]',
    '[class*="registry-product"]',
    '.product-card',
    'article[data-item-id]',
    '[data-testid="product-card"]',
  ];
  
  for (const selector of registryItemSelectors) {
    $(selector).each((_index: number, element: any) => {
      const $item = $(element);
      
      const name = $item.find('[data-automation-id="product-title"], [data-testid="product-title"], h2, h3, .product-title').first().text().trim() ||
                   $item.find('a[href*="/ip/"]').first().text().trim() ||
                   $item.find('img').first().attr('alt') || "";
      
      if (!name || name.length < 2) return;
      
      const href = $item.find('a[href*="/ip/"]').first().attr('href');
      const link = href ? (href.startsWith('http') ? href : `https://www.walmart.com${href}`) : undefined;
      
      const image = $item.find('img').first().attr('src') || 
                    $item.find('img').first().attr('data-src') || undefined;
      
      const priceText = $item.find('[data-automation-id="product-price"], .price, [class*="price"]').first().text().trim();
      const price = priceText.match(/\$[\d,.]+/)?.[0] || undefined;
      
      if (!items.some(i => i.name === name)) {
        items.push({
          name,
          link,
          image,
          price,
        });
      }
    });
    
    if (items.length > 0) {
      console.log("[WALMART_REGISTRY_PARSE] Parsed", items.length, "items from DOM with selector:", selector);
      break;
    }
  }
  
  // Last resort: find product links
  if (items.length === 0) {
    $('a[href*="/ip/"]').each((_index: number, element: any) => {
      const $link = $(element);
      const href = $link.attr('href');
      const name = $link.text().trim() || $link.find('img').attr('alt') || "";
      
      if (name && name.length > 3 && !items.some(i => i.name === name)) {
        items.push({
          name,
          link: href ? (href.startsWith('http') ? href : `https://www.walmart.com${href}`) : undefined,
          image: $link.find('img').attr('src') || undefined,
        });
      }
    });
    
    if (items.length > 0) {
      console.log("[WALMART_REGISTRY_PARSE] Extracted", items.length, "items from product links");
    }
  }
  
  console.log("[WALMART_REGISTRY_PARSE] Final item count:", items.length);
  return items;
};

const scrapeAmazonRegistry = ($: any, html: string, url: string): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
  console.log("[AMAZON_REGISTRY_PARSE] Starting Amazon registry parsing...");
  
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
        console.log(`[AMAZON_REGISTRY_PARSE] Skipping recommendation/ad item: ${title}`);
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
      
      console.log(`[AMAZON_REGISTRY_PARSE] Extracted item: "${title}" | ASIN: ${asin} | Price: ${price || 'N/A'} | Qty: ${quantityRequested}/${quantityPurchased}`);
      
      return {
        name: title,
        link,
        image,
        price,
      };
    } catch (e: any) {
      console.log(`[AMAZON_REGISTRY_PARSE] Error extracting item: ${e.message}`);
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
  console.log("[AMAZON_REGISTRY_PARSE] Extracted registry ID:", registryId || "Not found");
  if (rawRegistryId) console.log('[SAFE_QUERY] Amazon parse registry ID (escaped):', registryId);
  
  // Try to parse embedded JSON first - look for registry-specific data structures
  try {
    console.log("[AMAZON_REGISTRY_PARSE] Searching for embedded JSON data...");
    const scripts = $('script').toArray();
    let foundScriptContent = false;
    let pWhenBlocksFound = 0;
    let pWhenItemsExtracted = 0;
    
    for (const script of scripts) {
      const content = $(script).html() || "";
      
      // Pattern 1: P.when data loading - Amazon's primary lazy load pattern for registries
      if (content.includes('P.when')) {
        pWhenBlocksFound++;
        console.log(`[AMAZON_REGISTRY_PARSE] Found P.when block #${pWhenBlocksFound}`);
        
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
              console.log(`[AMAZON_REGISTRY_PARSE] P.when: Found array with ${itemsArray.length} potential items`);
              
              let validItemsFromBlock = 0;
              for (const item of itemsArray) {
                const extracted = extractRegistryItem(item);
                if (extracted && !items.some(i => i.link === extracted.link)) {
                  items.push(extracted);
                  validItemsFromBlock++;
                  pWhenItemsExtracted++;
                }
              }
              console.log(`[AMAZON_REGISTRY_PARSE] P.when block yielded ${validItemsFromBlock} valid registry items`);
              
            } catch (e: any) {
              console.log(`[AMAZON_REGISTRY_PARSE] P.when JSON parse error: ${e.message}`);
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
        console.log("[AMAZON_REGISTRY_PARSE] Found standard registry data script");
        
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
              console.log(`[AMAZON_REGISTRY_PARSE] Found ${name} with ${itemsArray.length} potential items`);
              
              let validItems = 0;
              for (const item of itemsArray) {
                const extracted = extractRegistryItem(item);
                if (extracted && !items.some(i => i.link === extracted.link)) {
                  items.push(extracted);
                  validItems++;
                }
              }
              console.log(`[AMAZON_REGISTRY_PARSE] ${name} yielded ${validItems} valid registry items`);
              
            } catch (e: any) {
              console.log(`[AMAZON_REGISTRY_PARSE] Failed to parse ${name}: ${e.message}`);
            }
          }
        }
      }
      
      // Pattern 3: __PRELOADED_STATE__ with registry data
      if (content.includes("__PRELOADED_STATE__")) {
        console.log("[AMAZON_REGISTRY_PARSE] Found __PRELOADED_STATE__");
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
                console.log(`[AMAZON_REGISTRY_PARSE] Found ${itemArray.length} items in __PRELOADED_STATE__`);
                let validItems = 0;
                for (const item of itemArray) {
                  const extracted = extractRegistryItem(item);
                  if (extracted && !items.some(i => i.link === extracted.link)) {
                    items.push(extracted);
                    validItems++;
                  }
                }
                console.log(`[AMAZON_REGISTRY_PARSE] __PRELOADED_STATE__ yielded ${validItems} valid items`);
              }
            }
          } catch (e: any) {
            console.log("[AMAZON_REGISTRY_PARSE] Failed to parse __PRELOADED_STATE__:", e.message);
          }
        }
      }
    }
    
    // Log P.when summary
    if (pWhenBlocksFound > 0) {
      console.log(`[AMAZON_REGISTRY_PARSE] P.when Summary: ${pWhenBlocksFound} blocks found, ${pWhenItemsExtracted} items extracted`);
    }
    
    if (items.length > 0) {
      console.log(`[AMAZON_REGISTRY_PARSE] JSON parsing successful: ${items.length} total items extracted`);
      return items;
    }
    
    if (!foundScriptContent && pWhenBlocksFound === 0) {
      console.log("[AMAZON_REGISTRY_PARSE] No registry-related script content found");
    }
  } catch (e: any) {
    console.log("[AMAZON_REGISTRY_PARSE] JSON parsing error:", e.message, "| Stack:", e.stack?.substring(0, 200));
  }
  
  // DOM parsing fallback - scope to registry list region
  console.log("[AMAZON_REGISTRY_PARSE] Falling back to DOM parsing...");
  
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
      console.log("[AMAZON_REGISTRY_PARSE] Found registry container:", containerSelector, "| Elements:", $container.length);
      break;
    }
  }
  
  if (!foundContainer) {
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
    console.log(`[AMAZON_REGISTRY_PARSE] DOM selector "${selector}" found ${$foundItems.length} elements`);
    
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
        console.log(`[AMAZON_REGISTRY_PARSE] DOM: Extracted "${name}" | ASIN: ${asin}`);
      }
    });
    
    if (items.length > 0) {
      console.log("[AMAZON_REGISTRY_PARSE] Parsed from DOM with selector:", selector, "| Items:", items.length);
      break;
    }
  }
  
  // If still no items, try a more aggressive approach
  if (items.length === 0) {
    console.log("[AMAZON_REGISTRY_PARSE] Attempting aggressive ASIN extraction...");
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
    
    if (aggressiveCount > 0) {
      console.log("[AMAZON_REGISTRY_PARSE] Aggressive extraction found:", aggressiveCount, "items");
    }
  }
  
  console.log("[AMAZON_REGISTRY_PARSE] Final item count:", items.length);
  return items;
};

interface FetchOptions {
  withBrowserHeaders?: boolean;
  country?: string;
  premium?: boolean;
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

// Helper to get a random user agent
function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Helper for sleep delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

// Walmart-specific fetch with direct-first fallback
interface WalmartFetchResult {
  html: string;
  method: "DIRECT" | "SCRAPERAPI" | "BRIGHTDATA" | "DIRECT_RETRY";
  status: number;
  error?: string;
  requiresManualUpload?: boolean;
}

async function fetchWalmartWithFallback(
  url: string,
  scraperApiKey: string
): Promise<WalmartFetchResult> {
  console.log("[WALMART_FETCH] Starting Walmart fetch with multi-provider strategy...");
  console.log("[WALMART_FETCH] Strategy: BrightData → Direct with retries");
  
  // Strategy 1: Try BrightData Web Unlocker first (best for anti-bot sites)
  console.log("[WALMART_FETCH] Trying BrightData Web Unlocker...");
  const brightDataResult = await fetchWithBrightDataUnlocker(url);
  
  if (brightDataResult.success && brightDataResult.html.length > 0) {
    const title = extractHtmlTitle(brightDataResult.html);
    const blocked = isWalmartBlockPage(brightDataResult.html);
    console.log(`[WALMART_BRIGHTDATA] title="${title}" blocked=${blocked} len=${brightDataResult.html.length}`);
    
    // Debug HTML capture
    if (DEBUG_SCRAPE_HTML) {
      const titleMatch = brightDataResult.html.match(/<title[^>]*>(.*?)<\/title>/i);
      const titleDebug = titleMatch?.[1]?.trim() || '';
      console.log(`[DEBUG_HTML][WALMART][BRIGHTDATA] title="${titleDebug}" len=${brightDataResult.html.length} snippet="${safeSnippet(brightDataResult.html)}"`);
      await maybeWriteDebugHtml('debug_walmart_brightdata.html', brightDataResult.html);
      
      if (DEBUG_SCRAPE_HTML) {
        const next = tryExtractNextDataJson(brightDataResult.html);
        if (!next) {
          console.log('[DEBUG_JSON][WALMART] no __NEXT_DATA__ found');
        } else {
          const candidates = findCandidateArrays(next);
          console.log('[DEBUG_JSON][WALMART] __NEXT_DATA__ candidate arrays:', JSON.stringify(candidates, null, 2));
          const payloads = findPayloadObjects(next);
          console.log('[DEBUG_JSON][WALMART] payload objects:', JSON.stringify(payloads, null, 2));
          const apollo = (next?.props?.pageProps as any)?.apolloState || (next?.props?.pageProps as any)?.__APOLLO_STATE__;
          if (apollo) {
            const apolloCandidates = findCandidateArrays(apollo);
            console.log('[DEBUG_JSON][WALMART] APOLLO candidate arrays:', JSON.stringify(apolloCandidates, null, 2));
          }
        }
      }
    }
    
    if (!blocked) {
      console.log(`[WALMART_FETCH] BrightData Unlocker succeeded: ${brightDataResult.html.length} chars`);
      return {
        html: brightDataResult.html,
        method: "BRIGHTDATA",
        status: brightDataResult.status,
      };
    }
    console.log("[WALMART_FETCH] BrightData returned blocked page");
  }
  
  console.log(`[WALMART_FETCH] BrightData insufficient (success=${brightDataResult.success}, length=${brightDataResult.html?.length || 0}, error=${brightDataResult.error || "none"})`);
  
  // Strategy 2: Try direct fetch with retries and user-agent rotation
  console.log("[WALMART_FETCH] Trying direct fetch with retries and UA rotation...");
  const retryResult = await fetchWalmartWithRetries(url, 3);
  
  if (retryResult.success && retryResult.html.length > 5000) {
    console.log(`[WALMART_FETCH] Direct fetch with retries succeeded on attempt ${retryResult.attemptsMade}: ${retryResult.html.length} chars`);
    return {
      html: retryResult.html,
      method: "DIRECT_RETRY",
      status: retryResult.status,
    };
  }
  
  console.log(`[WALMART_FETCH] Direct fetch with retries failed after ${retryResult.attemptsMade} attempts | Error: ${retryResult.error || "unknown"}`);
  console.log("[WALMART_FETCH] All strategies exhausted - advising manual upload");
  
  // Return error with manual upload fallback
  return {
    html: "",
    method: "DIRECT_RETRY",
    status: 0,
    error: "Walmart import is temporarily unavailable due to site restrictions. Please try again later or use File Import.",
    requiresManualUpload: true,
  };
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
  console.log("[AMAZON_REGISTRY_FETCH] Starting Amazon Registry fetch with BrightData Unlocker...");
  console.log("[AMAZON_REGISTRY_FETCH] Strategy: Enhanced retry with UA rotation and expect headers");
  
  const maxRetries = 3;
  const delays = [1500, 3000, 5000]; // Backoff delays in ms
  const amazonExpect = JSON.stringify({ text: 'Add to Cart' });
  
  // Try BrightData with retries and UA rotation
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const ua = getRandomUserAgent();
    console.log(`[AMAZON_REGISTRY_FETCH] Attempt ${attempt}/${maxRetries} | UA: "${ua.substring(0, 50)}..."`);
    
    const brightDataToken = Deno.env.get("BRIGHTDATA_UNLOCKER_API_TOKEN");
    const brightDataZone = Deno.env.get("BRIGHTDATA_UNLOCKER_ZONE");
    
    if (!brightDataToken || !brightDataZone) {
      console.log("[AMAZON_REGISTRY_FETCH] Missing BrightData credentials");
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
      console.log(`[AMAZON_REGISTRY_FETCH] Response status: ${status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[AMAZON_REGISTRY_FETCH] Failed attempt ${attempt} | status=${status} | error=${errorText.substring(0, 200)}`);
      } else {
        const html = await response.text();
        const title = extractHtmlTitle(html);
        const blocked = isAmazonBlockedOrLogin(html);
        
        console.log(`[AMAZON_REGISTRY_FETCH] Attempt ${attempt} | status=${status} | title="${title}" | blocked=${blocked} | length=${html.length}`);
        
        if (!blocked && html.length > 5000) {
          console.log(`[AMAZON_REGISTRY_FETCH] Success on attempt ${attempt}`);
          console.log(`[AMAZON_REGISTRY_FINAL] success=true requiresManualUpload=false`);
          return {
            html,
            method: "BRIGHTDATA",
            status,
            blockedOrLogin: false,
          };
        }
        
        if (blocked) {
          console.log(`[AMAZON_REGISTRY_FETCH] Blocked/login detected on attempt ${attempt} | title="${title}"`);
          console.log(`[AMAZON_REGISTRY_FETCH] First 500 chars: ${html.substring(0, 500).replace(/\s+/g, ' ')}`);
        }
      }
    } catch (e: any) {
      console.log(`[AMAZON_REGISTRY_FETCH] Fetch error on attempt ${attempt}: ${e.message}`);
    }
    
    // Sleep before retry (except after last attempt)
    if (attempt < maxRetries) {
      const delay = delays[attempt - 1];
      console.log(`[AMAZON_REGISTRY_FETCH] Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }
  
  console.log("[AMAZON_REGISTRY_FETCH] All BrightData retry attempts exhausted");
  
  // Strategy 2: Try direct fetch as last resort (usually won't work for Amazon)
  console.log("[AMAZON_REGISTRY_FETCH] Trying direct fetch as fallback...");
  const directResult = await fetchDirect(url);
  
  console.log(`[AMAZON_REGISTRY_FETCH] Direct fetch result: ok=${directResult.ok}, status=${directResult.status}, length=${directResult.html?.length || 0}`);
  
  if (directResult.ok && directResult.html.length > 5000) {
    const blockedOrLogin = isAmazonBlockedOrLogin(directResult.html);
    console.log(`[AMAZON_REGISTRY_FETCH] Direct fetch blocked/login check: ${blockedOrLogin}`);
    
    if (!blockedOrLogin) {
      console.log(`[AMAZON_REGISTRY_FETCH] Direct fetch succeeded: ${directResult.html.length} chars, not blocked`);
      console.log(`[AMAZON_REGISTRY_FINAL] success=true requiresManualUpload=false`);
      return {
        html: directResult.html,
        method: "DIRECT",
        status: directResult.status,
        blockedOrLogin: false,
      };
    }
    
    const titleMatch = directResult.html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : "No title found";
    console.log(`[AMAZON_REGISTRY_FETCH] Blocked/login page detected via direct | Title: ${pageTitle}`);
  }
  
  // All strategies failed - return manual upload required
  console.log("[AMAZON_REGISTRY_FETCH] All fetch strategies failed");
  console.log(`[AMAZON_REGISTRY_FINAL] success=false requiresManualUpload=true`);
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

// Fetch with retry and fallback strategies for Target
async function fetchTargetWithRetry(
  url: string,
  apiKey: string
): Promise<{ html: string; strategy: string }> {
  console.log("[TARGET_FETCH] Starting Target fetch with retry strategies...");
  
  // Strategy 1: Standard fetch with render
  try {
    console.log("[TARGET_FETCH] Strategy 1: Standard fetch with render");
    const html = await fetchWithScraperAPI(url, apiKey);
    if (html && html.length > 5000) {
      console.log("[TARGET_FETCH] Strategy 1 succeeded, HTML length:", html.length);
      return { html, strategy: "standard" };
    }
    console.log("[TARGET_FETCH] Strategy 1 returned minimal content:", html?.length || 0);
  } catch (e: any) {
    console.log("[TARGET_FETCH] Strategy 1 failed:", e.message);
  }
  
  // Strategy 2: Fetch with browser headers
  try {
    console.log("[TARGET_FETCH] Strategy 2: Fetch with browser headers");
    const html = await fetchWithScraperAPI(url, apiKey, { withBrowserHeaders: true });
    if (html && html.length > 5000) {
      console.log("[TARGET_FETCH] Strategy 2 succeeded, HTML length:", html.length);
      return { html, strategy: "browser_headers" };
    }
    console.log("[TARGET_FETCH] Strategy 2 returned minimal content:", html?.length || 0);
  } catch (e: any) {
    console.log("[TARGET_FETCH] Strategy 2 failed:", e.message);
  }
  
  // Strategy 3: Try with US country code and browser headers
  try {
    console.log("[TARGET_FETCH] Strategy 3: US country code with browser headers");
    const html = await fetchWithScraperAPI(url, apiKey, { withBrowserHeaders: true, country: "us" });
    if (html && html.length > 5000) {
      console.log("[TARGET_FETCH] Strategy 3 succeeded, HTML length:", html.length);
      return { html, strategy: "us_country" };
    }
    console.log("[TARGET_FETCH] Strategy 3 returned minimal content:", html?.length || 0);
  } catch (e: any) {
    console.log("[TARGET_FETCH] Strategy 3 failed:", e.message);
  }
  
  // Strategy 4: Try alternative URL format (gift-giver vs gift)
  const altUrl = url.includes("gift-giver") 
    ? url.replace("/gift-registry/gift-giver?registryId=", "/gift-registry/gift/")
    : url;
  
  if (altUrl !== url) {
    try {
      console.log("[TARGET_FETCH] Strategy 4: Alternative URL format:", altUrl);
      const html = await fetchWithScraperAPI(altUrl, apiKey, { withBrowserHeaders: true });
      if (html && html.length > 5000) {
        console.log("[TARGET_FETCH] Strategy 4 succeeded, HTML length:", html.length);
        return { html, strategy: "alt_url" };
      }
      console.log("[TARGET_FETCH] Strategy 4 returned minimal content:", html?.length || 0);
    } catch (e: any) {
      console.log("[TARGET_FETCH] Strategy 4 failed:", e.message);
    }
  }
  
  // Return the last attempt even if minimal content
  console.log("[TARGET_FETCH] All strategies exhausted, returning best available");
  const finalHtml = await fetchWithScraperAPI(url, apiKey, { withBrowserHeaders: true });
  return { html: finalHtml, strategy: "final_fallback" };
}

Deno.serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(undefined, { status: 204, headers: CORS_HEADERS });
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
    const { url } = await req.json();
    
    console.log("[SCRAPE_START] Incoming request URL:", url);

    if (!url || typeof url !== "string") {
      console.log("[SCRAPE_ERROR] Invalid URL provided:", url);
      return new Response(
        JSON.stringify({ success: false, items: [], message: "URL is required" }),
        {
          headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const retailer = detectRetailer(url);
    console.log("[SCRAPE_DETECT] Detected retailer:", retailer || "UNSUPPORTED", "for URL:", url);

    if (!retailer) {
      console.log("[SCRAPE_UNSUPPORTED] Retailer not supported for URL:", url);
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
    console.log("[SCRAPE_CONFIG] SCRAPER_API_KEY available:", !!scraperApiKey);
    
    const DEBUG_SCRAPE_HTML = (Deno.env.get('DEBUG_SCRAPE_HTML') || '').toLowerCase() === 'true';
    if (DEBUG_SCRAPE_HTML) console.log('[DEBUG_HTML] DEBUG_SCRAPE_HTML enabled');
    
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

    // Normalize Target registry URLs to canonical form before fetching
    let fetchUrl = url;
    if (retailer === "Target") {
      fetchUrl = normalizeTargetRegistryUrl(url);
      console.log("[SCRAPE_NORMALIZE] Target URL normalized:", url, "->", fetchUrl);
    }
    
    console.log("[SCRAPE_FETCH] Fetching URL:", fetchUrl, "| Retailer:", retailer);
    
    let html: string;
    let fetchStrategy = "standard";
    let fetchMethod = "SCRAPERAPI";
    
    try {
      // Use enhanced retry logic for Target
      if (retailer === "Target") {
        const result = await fetchTargetWithRetry(fetchUrl, scraperApiKey);
        html = result.html;
        fetchStrategy = result.strategy;
        console.log("[SCRAPE_FETCH] Target HTML fetched with strategy:", fetchStrategy, "| Length:", html?.length || 0, "characters");
        
        // Debug HTML capture
        if (DEBUG_SCRAPE_HTML) {
          const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
          const title = titleMatch?.[1]?.trim() || '';
          const hasNextData = /id="__NEXT_DATA__"/.test(html);
          console.log(`[DEBUG_HTML][TARGET][SCRAPERAPI] title="${title}" len=${html.length} hasNextData=${hasNextData} snippet="${safeSnippet(html)}"`);
          await maybeWriteDebugHtml('debug_target_scraperapi.html', html);
          
          const next = tryExtractNextDataJson(html);
          if (!next) {
            console.log('[DEBUG_JSON][TARGET] no __NEXT_DATA__ found');
          } else {
            const candidates = findCandidateArrays(next);
            console.log('[DEBUG_JSON][TARGET] __NEXT_DATA__ candidate arrays:', JSON.stringify(candidates, null, 2));
            const payloads = findPayloadObjects(next);
            console.log('[DEBUG_JSON][TARGET] payload objects:', JSON.stringify(payloads, null, 2));
            const apollo = (next?.props?.pageProps as any)?.__APOLLO_STATE__ || (next?.props?.pageProps as any)?.apolloState;
            if (apollo) {
              const apolloCandidates = findCandidateArrays(apollo);
              console.log('[DEBUG_JSON][TARGET] APOLLO candidate arrays:', JSON.stringify(apolloCandidates, null, 2));
            }
          }
        }
        
        // TEMPORARILY DISABLED: Target restricted page check bypassed for debugging
        const restrictedCheck = isTargetRestrictedPage(html);
        console.log(`[SCRAPE_DEBUG] Target restricted check: restricted=${restrictedCheck.restricted} reason=${restrictedCheck.reason}`);
        // if (restrictedCheck.restricted) {
        //   console.log(`[SCRAPE_RESTRICTED] Target page appears restricted: ${restrictedCheck.reason}`);
        //   console.log("[SCRAPE_RESTRICTED] URL:", fetchUrl);
        //   logHtmlDebugInfo(html, retailer, url);
        //   
        //   // Return friendly message for restricted pages
        //   return new Response(
        //     JSON.stringify({
        //       success: false,
        //       items: [],
        //       message: "We couldn't retrieve items from this Target registry share link. The registry may be private or the link may have changed. If this persists, please contact support or use manual import.",
        //     }),
        //     {
        //       headers: { ...corsHeaders, "Content-Type": "application/json" },
        //       status: 200,
        //     }
        //   );
        // }
      } else if (retailer === "WalmartWishlist" || retailer === "WalmartRegistry") {
        // Use direct-fetch-first strategy for Walmart
        const walmartResult = await fetchWalmartWithFallback(fetchUrl, scraperApiKey);
        fetchMethod = walmartResult.method;
        
        console.log(`[SCRAPE_FETCH] Walmart HTML fetched with method: ${fetchMethod} | Status: ${walmartResult.status} | Length: ${walmartResult.html?.length || 0}`);
        
        if (walmartResult.error) {
          console.log(`[SCRAPE_FETCH] Walmart fetch error: ${walmartResult.error} | requiresManualUpload: ${walmartResult.requiresManualUpload}`);
          return new Response(
            JSON.stringify({
              success: false,
              items: [],
              message: walmartResult.error,
              requiresManualUpload: walmartResult.requiresManualUpload || false,
            }),
            {
              headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
        
        html = walmartResult.html;
        
        if (!html || html.length < 1000) {
          console.log("[SCRAPE_FETCH] Walmart returned minimal/empty HTML");
          return new Response(
            JSON.stringify({
              success: false,
              items: [],
              message: "We couldn't fetch the Walmart page. Please verify the URL is correct and try again.",
            }),
            {
              headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      } else if (retailer === "AmazonRegistry") {
        // Use BrightData Unlocker for Amazon Registry (no ScraperAPI fallback - Amazon blocks it)
        const amazonRegistryResult = await fetchAmazonRegistryWithUnlocker(fetchUrl);
        fetchMethod = amazonRegistryResult.method;
        
        console.log(`[SCRAPE_FETCH] Amazon Registry HTML fetched with method: ${fetchMethod} | Status: ${amazonRegistryResult.status} | Length: ${amazonRegistryResult.html?.length || 0} | Blocked/Login: ${amazonRegistryResult.blockedOrLogin}`);
        
        if (amazonRegistryResult.error || amazonRegistryResult.blockedOrLogin) {
          console.log(`[SCRAPE_FETCH] Amazon Registry fetch blocked/error: ${amazonRegistryResult.error} | requiresManualUpload: ${amazonRegistryResult.requiresManualUpload}`);
          return new Response(
            JSON.stringify({
              success: false,
              items: [],
              message: amazonRegistryResult.error || "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.",
              requiresManualUpload: true,
            }),
            {
              headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
        
        html = amazonRegistryResult.html;
        
        if (!html || html.length < 1000) {
          console.log("[SCRAPE_FETCH] Amazon Registry returned minimal/empty HTML");
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
      } else {
        html = await fetchWithScraperAPI(fetchUrl, scraperApiKey);
        console.log("[SCRAPE_FETCH] HTML fetched successfully, length:", html?.length || 0, "characters");
      }
    } catch (fetchError: any) {
      console.error(`[SCRAPE_FETCH_ERROR] Retailer: ${retailer} | URL: ${url} | Error: ${fetchError.message}`);
      console.error(`[SCRAPE_FETCH_ERROR] Stack:`, fetchError.stack || "No stack trace");
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
      console.log(`[SCRAPE_BLOCKED] Amazon returned captcha/blocked page for URL: ${url}`);
      logHtmlDebugInfo(html, retailer, url);
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
    
    console.log("[SCRAPE_PARSE] Starting HTML parsing for retailer:", retailer);
    const $ = load(html);
    
    let items: ScrapedItem[] = [];
    let displayRetailer = retailer;
    let scrapeError: string | null = null;
    
    // Wrap each retailer scraping in try/catch to prevent non-2xx responses
    if (retailer === "Target") {
      try {
        items = scrapeTargetRegistry($, html, DEBUG_SCRAPE_HTML);
        console.log("[SCRAPE_PARSE] Target parsing complete, items extracted:", items.length, "| Fetch strategy used:", fetchStrategy);
        console.log(`[TARGET_FINAL] url=${url} items=${items.length} via=${fetchStrategy}`);
        
        // Debug log if no items found
        if (items.length === 0) {
          console.log("[SCRAPE_DEBUG] Target returned 0 items despite successful fetch");
          console.log("[SCRAPE_DEBUG] Fetch strategy was:", fetchStrategy);
          console.log("[SCRAPE_DEBUG] URL:", fetchUrl);
          logHtmlDebugInfo(html, retailer, url, DEBUG_SCRAPE_HTML);
          
          // Provide more specific error for Target
          scrapeError = "We couldn't retrieve items from this Target registry share link. If this persists, please contact support or use manual import.";
        }
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: Target | URL: ${url} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        logHtmlDebugInfo(html, retailer, url);
        scrapeError = "We couldn't retrieve items from this Target registry share link. If this persists, please contact support or use manual import.";
      }
    } else if (retailer === "AmazonRegistry") {
      try {
        displayRetailer = "Amazon Registry";
        
        // First, analyze the HTML to understand what we're dealing with
        const analysis = analyzeAmazonRegistryHtml(html, url);
        
        // Try standard HTML parsing first
        items = scrapeAmazonRegistry($, html, url);
        console.log("[SCRAPE_PARSE] Amazon Registry initial parsing, items extracted:", items.length);
        
        // If no items found, check if it's a shell page and try API extraction
        if (items.length === 0) {
          console.log("[SCRAPE_DEBUG] AmazonRegistry returned 0 items, analyzing page...");
          logHtmlDebugInfo(html, retailer, url, DEBUG_SCRAPE_HTML);
          
          if (analysis.isShellPage || !analysis.markers.hasRegistryItem) {
            console.log("[AMAZON_REGISTRY] Detected shell page or no registry items in HTML, attempting API extraction...");
            
            // Try API-based extraction
            const apiResult = await tryAmazonRegistryApi(analysis, scraperApiKey);
            
            if (apiResult.success && apiResult.items.length > 0) {
              items = apiResult.items;
              console.log(`[AMAZON_REGISTRY] API extraction successful: ${items.length} items`);
            } else if (apiResult.requiresAuth) {
              console.log("[AMAZON_REGISTRY] API requires auth/cookies, falling back to manual import message");
              scrapeError = "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.";
            } else {
              console.log("[AMAZON_REGISTRY] API extraction failed:", apiResult.error);
              scrapeError = "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.";
            }
          } else {
            // Page has registry markers but no items - might be empty or parsing failed
            console.log("[AMAZON_REGISTRY] Page appears to have registry content but no items extracted");
            scrapeError = "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.";
          }
        }
        
        console.log("[SCRAPE_PARSE] Amazon Registry parsing complete, final items:", items.length);
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: AmazonRegistry | URL: ${url} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        logHtmlDebugInfo(html, retailer, url);
        scrapeError = "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.";
      }
    } else if (retailer === "WalmartWishlist") {
      try {
        console.log(`[SCRAPE_PARSE] Starting Walmart wishlist parsing... (fetch method: ${fetchMethod})`);
        items = scrapeWalmartWishlist($, html, url);
        displayRetailer = "Walmart Wishlist";
        console.log(`[SCRAPE_PARSE] Walmart wishlist parsing complete | Items: ${items.length} | Fetch method: ${fetchMethod}`);
        
        // Debug log if no items found
        if (items.length === 0) {
          console.log(`[SCRAPE_DEBUG] Walmart wishlist returned 0 items | Fetch method used: ${fetchMethod}`);
          logHtmlDebugInfo(html, retailer, url, DEBUG_SCRAPE_HTML);
        }
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: WalmartWishlist | URL: ${url} | Fetch method: ${fetchMethod} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        logHtmlDebugInfo(html, retailer, url);
        scrapeError = "Walmart import is temporarily unavailable due to site restrictions. Please try again later or use File Import.";
      }
    } else if (retailer === "WalmartRegistry") {
      try {
        console.log(`[SCRAPE_PARSE] Starting Walmart registry parsing... (fetch method: ${fetchMethod})`);
        items = scrapeWalmartRegistry($, html, url);
        displayRetailer = "Walmart Registry";
        console.log(`[SCRAPE_PARSE] Walmart registry parsing complete | Items: ${items.length} | Fetch method: ${fetchMethod}`);
        
        // Debug log if no items found
        if (items.length === 0) {
          console.log(`[SCRAPE_DEBUG] Walmart registry returned 0 items | Fetch method used: ${fetchMethod}`);
          logHtmlDebugInfo(html, retailer, url, DEBUG_SCRAPE_HTML);
        }
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: WalmartRegistry | URL: ${url} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        logHtmlDebugInfo(html, retailer, url);
        scrapeError = "Walmart import is temporarily unavailable due to site restrictions. Please try again later or use File Import.";
      }
    } else {
      try {
        console.log("[SCRAPE_PARSE] Starting Amazon wishlist parsing...");
        items = scrapeAmazon($);
        console.log("[SCRAPE_PARSE] Amazon wishlist parsing complete, items extracted:", items.length);
        
        // Debug log if no items found
        if (items.length === 0) {
          console.log("[SCRAPE_DEBUG] Amazon wishlist returned 0 items, logging HTML info...");
          logHtmlDebugInfo(html, retailer, url, DEBUG_SCRAPE_HTML);
        }
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: Amazon | URL: ${url} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        logHtmlDebugInfo(html, retailer, url);
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
      } else if (retailer === "Target") {
        console.log(`[SCRAPE_EMPTY] Retailer: Target | URL: ${url} | Reason: 0 items found`);
        errorMessage = "We couldn't find items at that link. Please double-check the Target registry share URL.";
      } else if (retailer === "AmazonRegistry") {
        console.log(`[SCRAPE_EMPTY] Retailer: AmazonRegistry | URL: ${url} | Reason: 0 items found`);
        errorMessage = "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.";
        requiresManualUpload = true;
      } else if (retailer === "WalmartWishlist") {
        console.log(`[SCRAPE_EMPTY] Retailer: WalmartWishlist | URL: ${url} | Reason: 0 items found`);
        errorMessage = "Walmart import is temporarily unavailable due to site restrictions. Please try again later or use File Import.";
        requiresManualUpload = true;
      } else if (retailer === "WalmartRegistry") {
        console.log(`[SCRAPE_EMPTY] Retailer: WalmartRegistry | URL: ${url} | Reason: 0 items found`);
        errorMessage = "Walmart import is temporarily unavailable due to site restrictions. Please try again later or use File Import.";
        requiresManualUpload = true;
      } else {
        console.log(`[SCRAPE_EMPTY] Retailer: Amazon | URL: ${url} | Reason: 0 items found`);
        errorMessage = "No items found. The list might be empty, private, or the page structure has changed.";
      }
      console.log("[SCRAPE_RESULT] success: false | items: 0 | message:", errorMessage, "| requiresManualUpload:", requiresManualUpload);
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

    console.log(`[SCRAPE_SUCCESS] Retailer: ${displayRetailer} | Items: ${items.length} | URL: ${url}`);
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
    
    console.log("[SCRAPE_RESULT] success: false | items: 0 | message:", errorMessage);
    
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
