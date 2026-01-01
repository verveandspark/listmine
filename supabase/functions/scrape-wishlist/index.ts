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
    // Detect Amazon Registry URLs (e.g., /registries/gl/guest-view/<id>)
    if (lowerUrl.includes("/registries/")) return "AmazonRegistry";
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

// Debug helper to log HTML snippet
const logHtmlDebugInfo = (html: string, retailer: string, url: string): void => {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : "No title found";
  const snippet = html.substring(0, 1000).replace(/\s+/g, ' ');
  console.log(`[DEBUG_HTML] Retailer: ${retailer} | URL: ${url}`);
  console.log(`[DEBUG_HTML] Page title: ${pageTitle}`);
  console.log(`[DEBUG_HTML] First 1000 chars: ${snippet}`);
};

const scrapeTargetRegistry = ($: any, html: string): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
  console.log("[TARGET_PARSE] Starting Target registry parsing...");
  
  // Try to parse embedded JSON first (__NEXT_DATA__)
  try {
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      console.log("[TARGET_PARSE] Found __NEXT_DATA__ script, parsing...");
      const nextData = JSON.parse(nextDataScript);
      
      // Navigate through multiple possible paths in __NEXT_DATA__
      const possibleRegistryPaths = [
        nextData?.props?.pageProps?.registryData,
        nextData?.props?.pageProps?.registry,
        nextData?.props?.pageProps?.giftRegistry,
        nextData?.props?.pageProps?.pageData?.registry,
        nextData?.props?.pageProps?.initialData?.registry,
        nextData?.props?.pageProps,
      ];
      
      for (const registryData of possibleRegistryPaths) {
        if (!registryData) continue;
        
        const registryItems = registryData.items || 
                             registryData.registryItems || 
                             registryData.giftRegistryItems ||
                             registryData.registryItemList ||
                             [];
        
        if (registryItems.length > 0) {
          console.log("[TARGET_PARSE] Found registryItems array with", registryItems.length, "items");
          registryItems.forEach((item: any) => {
            const product = item.product || item.productDetails || item;
            const name = product.title || product.name || product.productTitle || 
                        product.description || item.title || item.name || "Unknown Item";
            
            if (!name || name === "Unknown Item") return;
            
            const url = product.url || product.pdpUrl || product.productUrl || item.url;
            const productUrl = url ? (url.startsWith('http') ? url : `https://www.target.com${url}`) : undefined;
            
            const imageUrl = product.images?.[0]?.baseUrl || 
                            product.image?.baseUrl || 
                            product.primaryImageUrl ||
                            product.imageUrl ||
                            item.imageUrl || undefined;
            
            const price = product.price?.currentRetail?.toString() || 
                         product.price?.formattedCurrentPrice || 
                         product.formattedPrice ||
                         item.price || undefined;
            
            items.push({
              name,
              link: productUrl,
              image: imageUrl,
              price,
            });
          });
          
          if (items.length > 0) {
            console.log("[TARGET_PARSE] Parsed from __NEXT_DATA__:", items.length, "items");
            return items;
          }
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

const scrapeAmazonRegistry = ($: any, html: string, url: string): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
  console.log("[AMAZON_REGISTRY_PARSE] Starting Amazon registry parsing...");
  
  // Helper to validate item has proper product URL
  const isValidRegistryItem = (link?: string): boolean => {
    if (!link) return false;
    return link.includes('/dp/') || link.includes('/gp/product/');
  };
  
  // Extract registry ID from URL for potential API call
  const registryIdMatch = url.match(/\/guest-view\/([A-Z0-9]+)/i) || 
                          url.match(/registryId[=\/]([A-Z0-9]+)/i) ||
                          url.match(/\/registry\/([A-Z0-9]+)/i);
  const registryId = registryIdMatch ? registryIdMatch[1] : null;
  console.log("[AMAZON_REGISTRY_PARSE] Extracted registry ID:", registryId || "Not found");
  
  // Try to parse embedded JSON first - look for registry-specific data structures
  try {
    console.log("[AMAZON_REGISTRY_PARSE] Searching for embedded JSON data...");
    const scripts = $('script').toArray();
    let foundScriptContent = false;
    
    for (const script of scripts) {
      const content = $(script).html() || "";
      
      // Look for Amazon registry data structures
      // Pattern 1: window.P.when with registry items or similar data injection
      if (content.includes('registryItemList') || content.includes('itemList') || 
          content.includes('"items":') || content.includes('"registryItems"')) {
        foundScriptContent = true;
        console.log("[AMAZON_REGISTRY_PARSE] Found potential registry data in script tag");
        
        // Try multiple extraction patterns
        const extractPatterns = [
          { pattern: /"items"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/, name: 'items array' },
          { pattern: /"registryItemList"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/, name: 'registryItemList' },
          { pattern: /"registryItems"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/, name: 'registryItems' },
          { pattern: /"listItems"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/, name: 'listItems' },
        ];
        
        for (const { pattern, name } of extractPatterns) {
          const match = content.match(pattern);
          if (match) {
            try {
              const itemsArray = JSON.parse(match[1]);
              console.log(`[AMAZON_REGISTRY_PARSE] Found ${name} with ${itemsArray.length} potential items`);
              
              for (const item of itemsArray) {
                const asin = item.asin || item.ASIN || item.itemId || item.productId;
                const title = item.title || item.name || item.productTitle || item.itemName || item.productName;
                const link = asin ? `https://www.amazon.com/dp/${asin}` : 
                            (item.itemUrl || item.productUrl || item.link || item.url);
                
                if (title && isValidRegistryItem(link)) {
                  items.push({
                    name: title,
                    link,
                    image: item.image || item.imageUrl || item.mainImage || item.smallImage || 
                           item.mediumImage || item.thumbnailImage || undefined,
                    price: item.price?.displayPrice || item.displayPrice || item.formattedPrice || 
                           item.price?.amount || item.priceString || undefined,
                  });
                }
              }
              
              if (items.length > 0) {
                console.log(`[AMAZON_REGISTRY_PARSE] Parsed ${items.length} items from ${name}`);
                return items;
              }
            } catch (e: any) {
              console.log(`[AMAZON_REGISTRY_PARSE] Failed to parse ${name}:`, e.message);
            }
          }
        }
      }
      
      // Pattern 2: __PRELOADED_STATE__ with registry data
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
            ].filter(Boolean);
            
            for (const itemArray of possibleItemArrays) {
              if (Array.isArray(itemArray)) {
                console.log(`[AMAZON_REGISTRY_PARSE] Found item array with ${itemArray.length} items in __PRELOADED_STATE__`);
                for (const item of itemArray) {
                  const asin = item.asin || item.ASIN;
                  const title = item.title || item.name || item.productTitle;
                  const link = asin ? `https://www.amazon.com/dp/${asin}` : item.productUrl;
                  
                  if (title && isValidRegistryItem(link)) {
                    items.push({
                      name: title,
                      link,
                      image: item.image || item.imageUrl || undefined,
                      price: item.price?.displayPrice || item.formattedPrice || undefined,
                    });
                  }
                }
              }
            }
            if (items.length > 0) {
              console.log("[AMAZON_REGISTRY_PARSE] Parsed from __PRELOADED_STATE__:", items.length, "items");
              return items;
            }
          } catch (e: any) {
            console.log("[AMAZON_REGISTRY_PARSE] Failed to parse __PRELOADED_STATE__:", e.message);
          }
        }
      }
      
      // Pattern 3: Look for P.when data loading (Amazon's lazy load pattern)
      if (content.includes('P.when') && (content.includes('registry') || content.includes('Registry'))) {
        console.log("[AMAZON_REGISTRY_PARSE] Found P.when with registry data");
        // Try to find JSON data blocks
        const dataBlockMatches = content.matchAll(/\{[^{}]*"asin"\s*:\s*"[A-Z0-9]{10}"[^{}]*\}/g);
        for (const match of dataBlockMatches) {
          try {
            const itemData = JSON.parse(match[0]);
            const asin = itemData.asin || itemData.ASIN;
            const title = itemData.title || itemData.name;
            if (asin && title) {
              const link = `https://www.amazon.com/dp/${asin}`;
              if (!items.some(i => i.link === link)) {
                items.push({
                  name: title,
                  link,
                  image: itemData.image || itemData.imageUrl || undefined,
                  price: itemData.price || undefined,
                });
              }
            }
          } catch (e) {
            // Continue trying other matches
          }
        }
        if (items.length > 0) {
          console.log("[AMAZON_REGISTRY_PARSE] Parsed from P.when data blocks:", items.length, "items");
          return items;
        }
      }
    }
    
    if (!foundScriptContent) {
      console.log("[AMAZON_REGISTRY_PARSE] No registry-related script content found");
    }
  } catch (e: any) {
    console.log("[AMAZON_REGISTRY_PARSE] JSON parsing failed:", e.message);
  }
  
  // DOM parsing fallback - scope to registry list region
  console.log("[AMAZON_REGISTRY_PARSE] Falling back to DOM parsing...");
  
  // Look for the main registry items container first
  const registryContainerSelectors = [
    '#item-page-wrapper',
    '#registry-items',
    '[id*="registry-item"]',
    '[class*="registry-items"]',
    '.g-item-page',
    '#gift-list',
    '[data-a-container="registryItem"]',
    '#registryItemList',
    '.still-needs-section',
  ];
  
  let $registryContainer = $('body');
  for (const containerSelector of registryContainerSelectors) {
    const $container = $(containerSelector);
    if ($container.length > 0) {
      $registryContainer = $container;
      console.log("[AMAZON_REGISTRY_PARSE] Found registry container:", containerSelector);
      break;
    }
  }
  
  // Registry item selectors - scoped to the registry region
  const registryItemSelectors = [
    '.g-item-sortable[data-itemid]',
    '[data-itemid]',
    'li[data-id]',
    '.a-section[data-asin]',
    '[data-component-type="s-search-result"]',
  ];
  
  for (const selector of registryItemSelectors) {
    $registryContainer.find(selector).each((_index: number, element: any) => {
      const $item = $(element);
      
      const asin = $item.attr('data-asin') || 
                   $item.attr('data-itemid') ||
                   $item.attr('data-id') ||
                   $item.find('[data-asin]').first().attr('data-asin');
      
      const href = $item.find('a[href*="/dp/"], a[href*="/gp/product/"]').first().attr('href');
      let link: string | undefined;
      
      if (asin && asin.length === 10) {
        link = `https://www.amazon.com/dp/${asin}`;
      } else if (href) {
        link = href.startsWith('http') ? href : `https://www.amazon.com${href}`;
      }
      
      if (!isValidRegistryItem(link)) return;
      
      const name = $item.find('h3, h2, [id*="itemName"], .a-size-base-plus, .a-text-normal').first().text().trim() ||
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
      }
    });
    
    if (items.length > 0) {
      console.log("[AMAZON_REGISTRY_PARSE] Parsed from DOM with selector:", selector, items.length, "items");
      break;
    }
  }
  
  // If still no items, try a more aggressive approach
  if (items.length === 0) {
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
      }
    });
    
    if (items.length > 0) {
      console.log("[AMAZON_REGISTRY_PARSE] Parsed from ASIN elements:", items.length, "items");
    }
  }
  
  console.log("[AMAZON_REGISTRY_PARSE] Final item count:", items.length);
  return items;
};

async function fetchWithScraperAPI(
  url: string,
  apiKey?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error(
      "ScraperAPI key required for Amazon scraping. Please add SCRAPER_API_KEY to environment variables."
    );
  }

  const scraperApiUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true`;

  const response = await fetch(scraperApiUrl, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`ScraperAPI error: ${response.status}`);
  }

  return await response.text();
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
    
    console.log("[SCRAPE_FETCH] Fetching URL via ScraperAPI:", fetchUrl, "| Retailer:", retailer);
    
    let html: string;
    try {
      html = await fetchWithScraperAPI(fetchUrl, scraperApiKey);
      console.log("[SCRAPE_FETCH] HTML fetched successfully, length:", html?.length || 0, "characters");
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
        console.log("[SCRAPE_PARSE] Target parsing complete, items extracted:", items.length);
        
        // Debug log if no items found
        if (items.length === 0) {
          console.log("[SCRAPE_DEBUG] Target returned 0 items, logging HTML info...");
          logHtmlDebugInfo(html, retailer, url);
        }
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: Target | URL: ${url} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        logHtmlDebugInfo(html, retailer, url);
        scrapeError = "We couldn't find items at that link. Please double-check the Target registry share URL.";
      }
    } else if (retailer === "AmazonRegistry") {
      try {
        items = scrapeAmazonRegistry($, html, url);
        displayRetailer = "Amazon Registry";
        console.log("[SCRAPE_PARSE] Amazon Registry parsing complete, items extracted:", items.length);
        
        // Debug log if no items found
        if (items.length === 0) {
          console.log("[SCRAPE_DEBUG] AmazonRegistry returned 0 items, logging HTML info...");
          logHtmlDebugInfo(html, retailer, url);
        }
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: AmazonRegistry | URL: ${url} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        logHtmlDebugInfo(html, retailer, url);
        scrapeError = "We couldn't find items at that link. Please double-check the Amazon registry share URL.";
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
      if (scrapeError) {
        errorMessage = scrapeError;
      } else if (retailer === "Target") {
        console.log(`[SCRAPE_EMPTY] Retailer: Target | URL: ${url} | Reason: 0 items found`);
        errorMessage = "We couldn't find items at that link. Please double-check the Target registry share URL.";
      } else if (retailer === "AmazonRegistry") {
        console.log(`[SCRAPE_EMPTY] Retailer: AmazonRegistry | URL: ${url} | Reason: 0 items found`);
        errorMessage = "We couldn't find items at that link. Please double-check the Amazon registry share URL.";
      } else {
        console.log(`[SCRAPE_EMPTY] Retailer: Amazon | URL: ${url} | Reason: 0 items found`);
        errorMessage = "No items found. The list might be empty, private, or the page structure has changed.";
      }
      console.log("[SCRAPE_RESULT] success: false | items: 0 | message:", errorMessage);
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
