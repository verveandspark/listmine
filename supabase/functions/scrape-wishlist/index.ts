import { load } from "https://esm.sh/cheerio@1.0.0-rc.12";

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
      const registryId = giftPathMatch[1];
      return `https://www.target.com/gift-registry/gift-giver?registryId=${registryId}`;
    }
    
    // Pattern 2: /gift-registry/gift-giver with registryId query param
    if (urlObj.pathname.includes("/gift-registry/gift-giver")) {
      const registryId = urlObj.searchParams.get("registryId");
      if (registryId) {
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
  
  const registryId = extractedConfig.registryId || extractedConfig.listId;
  
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

// Debug helper to log HTML snippet
const logHtmlDebugInfo = (html: string, retailer: string, url: string): void => {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : "No title found";
  const snippet = html.substring(0, 1000).replace(/\s+/g, ' ');
  console.log(`[DEBUG_HTML] Retailer: ${retailer} | URL: ${url}`);
  console.log(`[DEBUG_HTML] Page title: ${pageTitle}`);
  console.log(`[DEBUG_HTML] HTML length: ${html.length} chars`);
  console.log(`[DEBUG_HTML] First 1000 chars: ${snippet}`);
};

const scrapeTargetRegistry = ($: any, html: string): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
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
      
      // Log the structure to help debug
      const pagePropsKeys = Object.keys(nextData?.props?.pageProps || {});
      console.log("[TARGET_PARSE] pageProps keys:", pagePropsKeys.join(", "));
      
      // Navigate through multiple possible paths in __NEXT_DATA__
      const possibleRegistryPaths = [
        { path: "registryData", data: nextData?.props?.pageProps?.registryData },
        { path: "registry", data: nextData?.props?.pageProps?.registry },
        { path: "giftRegistry", data: nextData?.props?.pageProps?.giftRegistry },
        { path: "pageData.registry", data: nextData?.props?.pageProps?.pageData?.registry },
        { path: "initialData.registry", data: nextData?.props?.pageProps?.initialData?.registry },
        { path: "giftRegistryData", data: nextData?.props?.pageProps?.giftRegistryData },
        { path: "registryDetails", data: nextData?.props?.pageProps?.registryDetails },
        { path: "giftGiverData", data: nextData?.props?.pageProps?.giftGiverData },
        { path: "pageProps (direct)", data: nextData?.props?.pageProps },
      ];
      
      for (const { path, data: registryData } of possibleRegistryPaths) {
        if (!registryData) continue;
        
        console.log(`[TARGET_PARSE] Checking path: ${path}`);
        
        // Check for items in various locations
        const registryItems = registryData.items || 
                             registryData.registryItems || 
                             registryData.giftRegistryItems ||
                             registryData.registryItemList ||
                             registryData.productItems ||
                             registryData.wantedItems ||
                             registryData.stillNeeded ||
                             [];
        
        if (registryItems.length > 0) {
          console.log(`[TARGET_PARSE] Found items array at ${path} with`, registryItems.length, "items");
          registryItems.forEach((item: any, idx: number) => {
            const product = item.product || item.productDetails || item.productInfo || item;
            const name = product.title || product.name || product.productTitle || 
                        product.description || product.displayName ||
                        item.title || item.name || item.displayName || "Unknown Item";
            
            if (!name || name === "Unknown Item") {
              console.log(`[TARGET_PARSE] Item ${idx} has no valid name, skipping`);
              return;
            }
            
            const url = product.url || product.pdpUrl || product.productUrl || 
                       product.canonicalUrl || item.url || item.pdpUrl;
            const productUrl = url ? (url.startsWith('http') ? url : `https://www.target.com${url}`) : undefined;
            
            const imageUrl = product.images?.[0]?.baseUrl || 
                            product.image?.baseUrl || 
                            product.primaryImageUrl ||
                            product.imageUrl ||
                            product.thumbnailUrl ||
                            item.imageUrl || 
                            item.image || undefined;
            
            const price = product.price?.currentRetail?.toString() || 
                         product.price?.formattedCurrentPrice || 
                         product.price?.regularPrice?.toString() ||
                         product.formattedPrice ||
                         item.price || 
                         item.formattedPrice || undefined;
            
            items.push({
              name,
              link: productUrl,
              image: imageUrl,
              price,
            });
            console.log(`[TARGET_PARSE] Extracted item: "${name}" | Price: ${price || 'N/A'}`);
          });
          
          if (items.length > 0) {
            console.log("[TARGET_PARSE] Parsed from __NEXT_DATA__:", items.length, "items");
            return items;
          }
        }
      }
      
      // Deep search for any arrays that might contain products
      console.log("[TARGET_PARSE] __NEXT_DATA__ standard paths exhausted, attempting deep search...");
      const deepSearchForItems = (obj: any, depth = 0, currentPath = ""): any[] => {
        if (depth > 10 || !obj || typeof obj !== 'object') return [];
        
        let foundItems: any[] = [];
        
        for (const key of Object.keys(obj)) {
          const value = obj[key];
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          
          // Check if this is an array that might contain products
          if (Array.isArray(value) && value.length > 0) {
            const firstItem = value[0];
            if (firstItem && typeof firstItem === 'object') {
              // Check if items look like products
              const hasProductKeys = firstItem.title || firstItem.name || firstItem.product || 
                                    firstItem.productTitle || firstItem.tcin || firstItem.dpci;
              if (hasProductKeys) {
                console.log(`[TARGET_PARSE] Deep search found potential items at: ${newPath} (${value.length} items)`);
                foundItems = [...foundItems, ...value];
              }
            }
          }
          
          // Recurse into objects
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            foundItems = [...foundItems, ...deepSearchForItems(value, depth + 1, newPath)];
          }
        }
        
        return foundItems;
      };
      
      const deepFoundItems = deepSearchForItems(nextData?.props?.pageProps);
      if (deepFoundItems.length > 0) {
        console.log("[TARGET_PARSE] Deep search found", deepFoundItems.length, "potential items");
        for (const item of deepFoundItems) {
          const product = item.product || item.productDetails || item;
          const name = product.title || product.name || product.productTitle || item.title || item.name;
          
          if (!name) continue;
          
          const url = product.url || product.pdpUrl || product.productUrl || item.url;
          const productUrl = url ? (url.startsWith('http') ? url : `https://www.target.com${url}`) : undefined;
          
          if (!items.some(i => i.name === name)) {
            items.push({
              name,
              link: productUrl,
              image: product.images?.[0]?.baseUrl || product.imageUrl || item.imageUrl || undefined,
              price: product.price?.currentRetail?.toString() || product.formattedPrice || item.price || undefined,
            });
          }
        }
        
        if (items.length > 0) {
          console.log("[TARGET_PARSE] Deep search extracted", items.length, "items");
          return items;
        }
      }
      
      console.log("[TARGET_PARSE] __NEXT_DATA__ found but no registry items extracted");
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
                
                items.push({
                  name,
                  link: item.url ? `https://www.target.com${item.url}` : undefined,
                  image: item.image || item.imageUrl || item.primaryImage || undefined,
                  price: item.price || item.formattedPrice || undefined,
                });
              });
              
              if (items.length > 0) {
                console.log("[TARGET_PARSE] Parsed from embedded JSON:", items.length, "items");
                return items;
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
      console.log("[TARGET_PARSE] Parsed from DOM with selector:", selector, items.length, "items");
      break;
    }
  }
  
  // Last resort: find any product links
  if (items.length === 0) {
    $('a[href*="/p/"]').each((_index: number, element: any) => {
      const $link = $(element);
      const href = $link.attr('href');
      const name = $link.text().trim() || $link.find('img').attr('alt') || "";
      
      if (name && name.length > 3 && !items.some(i => i.name === name)) {
        items.push({
          name,
          link: href ? `https://www.target.com${href}` : undefined,
          image: $link.find('img').attr('src') || undefined,
        });
      }
    });
    if (items.length > 0) {
      console.log("[TARGET_PARSE] Parsed from product links:", items.length, "items");
    }
  }
  
  return items;
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
  
  console.log("[WALMART_WISHLIST_PARSE] Starting Walmart wishlist parsing...");
  console.log("[WALMART_WISHLIST_PARSE] HTML length:", html.length, "chars");
  
  // Try to parse embedded JSON first (__NEXT_DATA__ or similar)
  try {
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      console.log("[WALMART_WISHLIST_PARSE] Found __NEXT_DATA__ script");
      const nextData = JSON.parse(nextDataScript);
      
      // Navigate through possible paths for list items
      const possiblePaths = [
        nextData?.props?.pageProps?.initialData?.list?.items,
        nextData?.props?.pageProps?.list?.items,
        nextData?.props?.pageProps?.data?.list?.items,
        nextData?.props?.pageProps?.pageData?.list?.items,
        nextData?.props?.pageProps?.listItems,
        nextData?.props?.pageProps?.items,
      ];
      
      for (const listItems of possiblePaths) {
        if (Array.isArray(listItems) && listItems.length > 0) {
          console.log("[WALMART_WISHLIST_PARSE] Found items array with", listItems.length, "items");
          
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
          
          if (items.length > 0) {
            console.log("[WALMART_WISHLIST_PARSE] Extracted", items.length, "items from __NEXT_DATA__");
            return items;
          }
        }
      }
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
  
  console.log("[WALMART_REGISTRY_PARSE] Starting Walmart registry parsing...");
  console.log("[WALMART_REGISTRY_PARSE] HTML length:", html.length, "chars");
  
  // Extract registry ID from URL
  const registryIdMatch = url.match(/\/registry\/WR\/([a-f0-9-]+)/i) ||
                          url.match(/registryId=([a-f0-9-]+)/i);
  const registryId = registryIdMatch ? registryIdMatch[1] : null;
  console.log("[WALMART_REGISTRY_PARSE] Extracted registry ID:", registryId || "Not found");
  
  // Try to parse embedded JSON first (__NEXT_DATA__)
  try {
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      console.log("[WALMART_REGISTRY_PARSE] Found __NEXT_DATA__ script");
      const nextData = JSON.parse(nextDataScript);
      
      // Log available keys for debugging
      const pagePropsKeys = Object.keys(nextData?.props?.pageProps || {});
      console.log("[WALMART_REGISTRY_PARSE] pageProps keys:", pagePropsKeys.join(", "));
      
      // Navigate through possible paths for registry items
      const possiblePaths = [
        nextData?.props?.pageProps?.initialData?.registry?.items,
        nextData?.props?.pageProps?.registry?.items,
        nextData?.props?.pageProps?.registryData?.items,
        nextData?.props?.pageProps?.data?.registry?.items,
        nextData?.props?.pageProps?.registryItems,
        nextData?.props?.pageProps?.pageData?.registry?.items,
        nextData?.props?.pageProps?.giftRegistry?.items,
        nextData?.props?.pageProps?.weddingRegistry?.items,
      ];
      
      for (const registryItems of possiblePaths) {
        if (Array.isArray(registryItems) && registryItems.length > 0) {
          console.log("[WALMART_REGISTRY_PARSE] Found registry items array with", registryItems.length, "items");
          
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
          
          if (items.length > 0) {
            console.log("[WALMART_REGISTRY_PARSE] Extracted", items.length, "items from __NEXT_DATA__");
            return items;
          }
        }
      }
      
      console.log("[WALMART_REGISTRY_PARSE] __NEXT_DATA__ found but no registry items extracted");
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
  const registryId = registryIdMatch ? registryIdMatch[1] : null;
  console.log("[AMAZON_REGISTRY_PARSE] Extracted registry ID:", registryId || "Not found");
  
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

async function fetchWithBrightDataUnlocker(url: string): Promise<BrightDataUnlockerResponse> {
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
  
  try {
    const response = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${brightDataToken}`,
        "Content-Type": "application/json",
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
  method: "DIRECT" | "SCRAPERAPI" | "BRIGHTDATA";
  status: number;
  error?: string;
  requiresManualUpload?: boolean;
}

async function fetchWalmartWithFallback(
  url: string,
  scraperApiKey: string
): Promise<WalmartFetchResult> {
  console.log("[WALMART_FETCH] Starting Walmart fetch with multi-provider strategy...");
  
  // Strategy 1: Try BrightData Web Unlocker first (best for anti-bot sites)
  console.log("[WALMART_FETCH] Trying BrightData Web Unlocker...");
  const brightDataResult = await fetchWithBrightDataUnlocker(url);
  
  if (brightDataResult.success && brightDataResult.html.length > 10000) {
    console.log(`[WALMART_FETCH] BrightData Unlocker succeeded: ${brightDataResult.html.length} chars`);
    return {
      html: brightDataResult.html,
      method: "BRIGHTDATA",
      status: brightDataResult.status,
    };
  }
  
  console.log(`[WALMART_FETCH] BrightData insufficient (success=${brightDataResult.success}, length=${brightDataResult.html?.length || 0}, error=${brightDataResult.error || "none"})`);
  
  // Strategy 2: Try direct fetch
  console.log("[WALMART_FETCH] Trying direct fetch...");
  const directResult = await fetchDirect(url);
  
  if (directResult.ok && directResult.html.length > 20000 && !isBlockedResponse(directResult.html)) {
    console.log("[WALMART_FETCH] Direct fetch succeeded:", directResult.html.length, "chars");
    return {
      html: directResult.html,
      method: "DIRECT",
      status: directResult.status,
    };
  }
  
  console.log(`[WALMART_FETCH] Direct fetch insufficient (ok=${directResult.ok}, length=${directResult.html.length}, blocked=${isBlockedResponse(directResult.html)})`);
  
  // Strategy 3: Fall back to ScraperAPI with enhanced options for Walmart
  console.log("[WALMART_FETCH] Falling back to ScraperAPI with premium options...");
  
  try {
    // Use enhanced ScraperAPI options for Walmart: keep_headers, country_code=us, premium, render
    const scraperApiUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}&render=true&keep_headers=true&country_code=us&premium=true`;
    
    const response = await fetch(scraperApiUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.walmart.com/",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    
    console.log(`[WALMART_FETCH] ScraperAPI response status: ${response.status}`);
    
    if (!response.ok) {
      if (response.status === 500) {
        return {
          html: "",
          method: "SCRAPERAPI",
          status: response.status,
          error: "Walmart import is temporarily unavailable. Please try again later or use File Import.",
          requiresManualUpload: true,
        };
      }
      return {
        html: "",
        method: "SCRAPERAPI",
        status: response.status,
        error: `Walmart import failed (error ${response.status}). Please try again later or use File Import.`,
        requiresManualUpload: true,
      };
    }
    
    const html = await response.text();
    console.log(`[WALMART_FETCH] ScraperAPI succeeded: ${html.length} chars`);
    
    // Check if ScraperAPI returned blocked content
    if (isBlockedResponse(html)) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : "No title found";
      console.log(`[WALMART_FETCH] ScraperAPI returned blocked content | Title: ${pageTitle}`);
      return {
        html: "",
        method: "SCRAPERAPI",
        status: response.status,
        error: "Walmart import is temporarily unavailable. Please try again later or use File Import.",
        requiresManualUpload: true,
      };
    }
    
    return {
      html,
      method: "SCRAPERAPI",
      status: response.status,
    };
  } catch (e: any) {
    console.log(`[WALMART_FETCH] ScraperAPI error: ${e.message}`);
    return {
      html: "",
      method: "SCRAPERAPI",
      status: 0,
      error: "Walmart import is temporarily unavailable. Please try again later or use File Import.",
      requiresManualUpload: true,
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
  console.log("[AMAZON_REGISTRY_FETCH] Starting Amazon Registry fetch with BrightData Unlocker...");
  
  // Strategy 1: Try BrightData Web Unlocker (only viable option for Amazon)
  console.log("[AMAZON_REGISTRY_FETCH] Trying BrightData Web Unlocker...");
  const brightDataResult = await fetchWithBrightDataUnlocker(url);
  
  console.log(`[AMAZON_REGISTRY_FETCH] BrightData result: success=${brightDataResult.success}, status=${brightDataResult.status}, length=${brightDataResult.html?.length || 0}`);
  
  if (brightDataResult.success && brightDataResult.html.length > 5000) {
    // Check if blocked or login required
    const blockedOrLogin = isAmazonBlockedOrLogin(brightDataResult.html);
    console.log(`[AMAZON_REGISTRY_FETCH] BrightData response blocked/login check: ${blockedOrLogin}`);
    
    if (blockedOrLogin) {
      // Log debug info
      const titleMatch = brightDataResult.html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : "No title found";
      console.log(`[AMAZON_REGISTRY_FETCH] Blocked/login page detected | Title: ${pageTitle}`);
      console.log(`[AMAZON_REGISTRY_FETCH] First 500 chars: ${brightDataResult.html.substring(0, 500).replace(/\s+/g, ' ')}`);
      
      return {
        html: brightDataResult.html,
        method: "BRIGHTDATA",
        status: brightDataResult.status,
        error: "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.",
        requiresManualUpload: true,
        blockedOrLogin: true,
      };
    }
    
    console.log(`[AMAZON_REGISTRY_FETCH] BrightData Unlocker succeeded: ${brightDataResult.html.length} chars, not blocked`);
    return {
      html: brightDataResult.html,
      method: "BRIGHTDATA",
      status: brightDataResult.status,
      blockedOrLogin: false,
    };
  }
  
  console.log(`[AMAZON_REGISTRY_FETCH] BrightData insufficient (success=${brightDataResult.success}, length=${brightDataResult.html?.length || 0}, error=${brightDataResult.error || "none"})`);
  
  // Strategy 2: Try direct fetch as last resort (usually won't work for Amazon)
  console.log("[AMAZON_REGISTRY_FETCH] Trying direct fetch...");
  const directResult = await fetchDirect(url);
  
  console.log(`[AMAZON_REGISTRY_FETCH] Direct fetch result: ok=${directResult.ok}, status=${directResult.status}, length=${directResult.html?.length || 0}`);
  
  if (directResult.ok && directResult.html.length > 5000) {
    const blockedOrLogin = isAmazonBlockedOrLogin(directResult.html);
    console.log(`[AMAZON_REGISTRY_FETCH] Direct fetch blocked/login check: ${blockedOrLogin}`);
    
    if (blockedOrLogin) {
      const titleMatch = directResult.html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : "No title found";
      console.log(`[AMAZON_REGISTRY_FETCH] Blocked/login page detected via direct | Title: ${pageTitle}`);
      
      return {
        html: directResult.html,
        method: "DIRECT",
        status: directResult.status,
        error: "Amazon registries can't be imported automatically right now due to Amazon restrictions. Please use File Import or Paste Items.",
        requiresManualUpload: true,
        blockedOrLogin: true,
      };
    }
    
    console.log(`[AMAZON_REGISTRY_FETCH] Direct fetch succeeded: ${directResult.html.length} chars, not blocked`);
    return {
      html: directResult.html,
      method: "DIRECT",
      status: directResult.status,
      blockedOrLogin: false,
    };
  }
  
  // All strategies failed - return manual upload required
  console.log("[AMAZON_REGISTRY_FETCH] All fetch strategies failed");
  return {
    html: "",
    method: "BRIGHTDATA",
    status: brightDataResult.status || 0,
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, items: [], message: "Method not allowed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const scraperApiKey = Deno.env.get("SCRAPER_API_KEY");
    console.log("[SCRAPE_CONFIG] SCRAPER_API_KEY available:", !!scraperApiKey);

    if (!scraperApiKey) {
      console.error("[SCRAPE_ERROR] SCRAPER_API_KEY is not set in environment variables");
      return new Response(
        JSON.stringify({
          success: false,
          items: [],
          message: "Scraping service is temporarily unavailable. Please contact support or try again later.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        
        // Check for Target restricted/private pages
        const restrictedCheck = isTargetRestrictedPage(html);
        if (restrictedCheck.restricted) {
          console.log(`[SCRAPE_RESTRICTED] Target page appears restricted: ${restrictedCheck.reason}`);
          console.log("[SCRAPE_RESTRICTED] URL:", fetchUrl);
          logHtmlDebugInfo(html, retailer, url);
          
          // Return friendly message for restricted pages
          return new Response(
            JSON.stringify({
              success: false,
              items: [],
              message: "We couldn't retrieve items from this Target registry share link. The registry may be private or the link may have changed. If this persists, please contact support or use manual import.",
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
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
              headers: { ...corsHeaders, "Content-Type": "application/json" },
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
              headers: { ...corsHeaders, "Content-Type": "application/json" },
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
              headers: { ...corsHeaders, "Content-Type": "application/json" },
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
              headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        items = scrapeTargetRegistry($, html);
        console.log("[SCRAPE_PARSE] Target parsing complete, items extracted:", items.length, "| Fetch strategy used:", fetchStrategy);
        
        // Debug log if no items found
        if (items.length === 0) {
          console.log("[SCRAPE_DEBUG] Target returned 0 items despite successful fetch");
          console.log("[SCRAPE_DEBUG] Fetch strategy was:", fetchStrategy);
          console.log("[SCRAPE_DEBUG] URL:", fetchUrl);
          logHtmlDebugInfo(html, retailer, url);
          
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
          logHtmlDebugInfo(html, retailer, url);
          
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
          logHtmlDebugInfo(html, retailer, url);
        }
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: WalmartWishlist | URL: ${url} | Fetch method: ${fetchMethod} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        logHtmlDebugInfo(html, retailer, url);
        scrapeError = "We couldn't find items at that link. Please double-check the Walmart wishlist URL.";
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
          logHtmlDebugInfo(html, retailer, url);
        }
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: WalmartRegistry | URL: ${url} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        logHtmlDebugInfo(html, retailer, url);
        scrapeError = "We couldn't find items at that link. Please double-check the Walmart registry share URL.";
      }
    } else {
      try {
        console.log("[SCRAPE_PARSE] Starting Amazon wishlist parsing...");
        items = scrapeAmazon($);
        console.log("[SCRAPE_PARSE] Amazon wishlist parsing complete, items extracted:", items.length);
        
        // Debug log if no items found
        if (items.length === 0) {
          console.log("[SCRAPE_DEBUG] Amazon wishlist returned 0 items, logging HTML info...");
          logHtmlDebugInfo(html, retailer, url);
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
        errorMessage = "We couldn't find items at that link. The Walmart wishlist might be private or empty. Please double-check the URL.";
      } else if (retailer === "WalmartRegistry") {
        console.log(`[SCRAPE_EMPTY] Retailer: WalmartRegistry | URL: ${url} | Reason: 0 items found`);
        errorMessage = "We couldn't find items at that link. The Walmart registry might be private or empty. Please double-check the share URL.";
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
