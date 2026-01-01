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

const scrapeTargetRegistry = ($: any, html: string): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
  // Try to parse embedded JSON first (__NEXT_DATA__ or similar)
  try {
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      const nextData = JSON.parse(nextDataScript);
      const registryData = nextData?.props?.pageProps?.registryData || 
                           nextData?.props?.pageProps?.registry ||
                           nextData?.props?.pageProps?.giftRegistry;
      
      if (registryData?.items || registryData?.registryItems) {
        const registryItems = registryData.items || registryData.registryItems || [];
        registryItems.forEach((item: any) => {
          const product = item.product || item;
          items.push({
            title: product.title || product.name || product.description || "Unknown Item",
            productUrl: product.url ? `https://www.target.com${product.url}` : 
                       (product.pdpUrl ? `https://www.target.com${product.pdpUrl}` : undefined),
            imageUrl: product.images?.[0]?.baseUrl || product.image?.baseUrl || product.primaryImageUrl || undefined,
            price: product.price?.currentRetail?.toString() || 
                   product.price?.formattedCurrentPrice || 
                   product.formattedPrice || undefined,
            quantity: item.requestedQuantity || item.quantity || 1,
            source: "target_registry",
          });
        });
        console.log("Target: Parsed from __NEXT_DATA__:", items.length, "items");
        return items;
      }
    }
  } catch (e) {
    console.log("Target: __NEXT_DATA__ parsing failed, trying alternative JSON");
  }
  
  // Try to find alternative embedded JSON structures
  try {
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const content = $(script).html() || "";
      if (content.includes("registryItems") || content.includes("giftRegistry")) {
        const jsonMatch = content.match(/\{[\s\S]*"registryItems"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const registryItems = parsed.registryItems || parsed.items || [];
          registryItems.forEach((item: any) => {
            items.push({
              title: item.title || item.name || item.productTitle || "Unknown Item",
              productUrl: item.url ? `https://www.target.com${item.url}` : undefined,
              imageUrl: item.image || item.imageUrl || item.primaryImage || undefined,
              price: item.price || item.formattedPrice || undefined,
              quantity: item.requestedQuantity || item.quantity || 1,
              source: "target_registry",
            });
          });
          if (items.length > 0) {
            console.log("Target: Parsed from embedded JSON:", items.length, "items");
            return items;
          }
        }
      }
    }
  } catch (e) {
    console.log("Target: Alternative JSON parsing failed, falling back to DOM");
  }
  
  // Fallback: DOM parsing
  // Target registry items are typically in cards or list items
  const selectors = [
    '[data-test="registry-item"]',
    '[data-test="gift-registry-item"]',
    '.GiftRegistryItem',
    '[class*="RegistryItem"]',
    '[class*="registry-item"]',
    '.styles_productCard',
    '[data-component="ProductCard"]',
  ];
  
  for (const selector of selectors) {
    $(selector).each((_index: number, element: any) => {
      const $item = $(element);
      
      const title = $item.find('[data-test="product-title"], [class*="ProductTitle"], h3, h4').first().text().trim() ||
                   $item.find('a[href*="/p/"]').first().text().trim() ||
                   $item.find('img').first().attr('alt') || "";
      
      if (!title || title.length < 2) return;
      
      const productLink = $item.find('a[href*="/p/"]').first().attr('href');
      const productUrl = productLink ? `https://www.target.com${productLink}` : undefined;
      
      const imageUrl = $item.find('img').first().attr('src') || 
                       $item.find('img').first().attr('data-src') || undefined;
      
      const priceText = $item.find('[data-test="current-price"], [class*="Price"], .styles_price').first().text().trim();
      const price = priceText.match(/\$[\d,.]+/)?.[0] || undefined;
      
      const quantityText = $item.find('[class*="quantity"], [data-test*="quantity"]').first().text();
      const quantityMatch = quantityText.match(/(\d+)/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
      
      items.push({
        title,
        productUrl,
        imageUrl,
        price,
        quantity,
        source: "target_registry",
      });
    });
    
    if (items.length > 0) {
      console.log("Target: Parsed from DOM with selector:", selector, items.length, "items");
      break;
    }
  }
  
  // Last resort: find any product-like elements
  if (items.length === 0) {
    $('a[href*="/p/"]').each((_index: number, element: any) => {
      const $link = $(element);
      const href = $link.attr('href');
      const title = $link.text().trim() || $link.find('img').attr('alt') || "";
      
      if (title && title.length > 3 && !items.some(i => i.title === title)) {
        items.push({
          title,
          productUrl: href ? `https://www.target.com${href}` : undefined,
          imageUrl: $link.find('img').attr('src') || undefined,
          quantity: 1,
          source: "target_registry",
        });
      }
    });
    console.log("Target: Parsed from product links:", items.length, "items");
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

const scrapeAmazonRegistry = ($: any, html: string): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
  // Helper to validate item has proper product URL
  const isValidRegistryItem = (link?: string): boolean => {
    if (!link) return false;
    return link.includes('/dp/') || link.includes('/gp/product/');
  };
  
  // Try to parse embedded JSON first - look for registry-specific data structures
  try {
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const content = $(script).html() || "";
      
      // Look for Amazon registry data structures
      // Pattern 1: window.P.when with registry items
      if (content.includes('registryItemList') || content.includes('itemList') || content.includes('"items":')) {
        // Try to extract JSON objects containing registry items
        const itemListMatch = content.match(/"items"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
        if (itemListMatch) {
          try {
            const itemsArray = JSON.parse(itemListMatch[1]);
            for (const item of itemsArray) {
              const asin = item.asin || item.ASIN || item.itemId;
              const title = item.title || item.name || item.productTitle || item.itemName;
              const link = asin ? `https://www.amazon.com/dp/${asin}` : 
                          (item.itemUrl || item.productUrl || item.link);
              
              if (title && isValidRegistryItem(link)) {
                items.push({
                  name: title,
                  link,
                  image: item.image || item.imageUrl || item.mainImage || item.smallImage || undefined,
                  price: item.price?.displayPrice || item.displayPrice || item.formattedPrice || undefined,
                });
              }
            }
            if (items.length > 0) {
              console.log("Amazon Registry: Parsed from embedded items JSON:", items.length, "items");
              return items;
            }
          } catch (e) {
            console.log("Amazon Registry: Failed to parse items JSON array");
          }
        }
        
        // Pattern 2: Look for registryItemList
        const registryListMatch = content.match(/"registryItemList"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
        if (registryListMatch) {
          try {
            const registryItems = JSON.parse(registryListMatch[1]);
            for (const item of registryItems) {
              const asin = item.asin || item.ASIN || item.itemId;
              const title = item.title || item.itemName || item.productTitle;
              const link = asin ? `https://www.amazon.com/dp/${asin}` : item.itemUrl;
              
              if (title && isValidRegistryItem(link)) {
                items.push({
                  name: title,
                  link,
                  image: item.smallImage || item.image || item.imageUrl || undefined,
                  price: item.price || item.displayPrice || undefined,
                });
              }
            }
            if (items.length > 0) {
              console.log("Amazon Registry: Parsed from registryItemList:", items.length, "items");
              return items;
            }
          } catch (e) {
            console.log("Amazon Registry: Failed to parse registryItemList");
          }
        }
      }
      
      // Pattern 3: __PRELOADED_STATE__ with registry data
      if (content.includes("__PRELOADED_STATE__")) {
        const stateMatch = content.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/);
        if (stateMatch) {
          try {
            const state = JSON.parse(stateMatch[1]);
            // Navigate through possible registry item locations
            const possibleItemArrays = [
              state?.registryItems,
              state?.registry?.items,
              state?.data?.items,
              state?.pageData?.items,
            ].filter(Boolean);
            
            for (const itemArray of possibleItemArrays) {
              if (Array.isArray(itemArray)) {
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
              console.log("Amazon Registry: Parsed from __PRELOADED_STATE__:", items.length, "items");
              return items;
            }
          } catch (e) {
            console.log("Amazon Registry: Failed to parse __PRELOADED_STATE__");
          }
        }
      }
    }
  } catch (e) {
    console.log("Amazon Registry: JSON parsing failed, falling back to DOM");
  }
  
  // DOM parsing fallback - scope to registry list region
  // Look for the main registry items container first
  const registryContainerSelectors = [
    '#item-page-wrapper',
    '[id*="registry-item"]',
    '[class*="registry-items"]',
    '.g-item-page',
    '#gift-list',
    '[data-a-container="registryItem"]',
  ];
  
  let $registryContainer = $('body');
  for (const containerSelector of registryContainerSelectors) {
    const $container = $(containerSelector);
    if ($container.length > 0) {
      $registryContainer = $container;
      console.log("Amazon Registry: Found registry container:", containerSelector);
      break;
    }
  }
  
  // Registry item selectors - scoped to the registry region
  const registryItemSelectors = [
    '.g-item-sortable[data-itemid]',
    '[data-itemid]',
    'li[data-id]',
    '.a-section[data-asin]',
  ];
  
  for (const selector of registryItemSelectors) {
    $registryContainer.find(selector).each((_index: number, element: any) => {
      const $item = $(element);
      
      // Get ASIN first - this is the most reliable identifier
      const asin = $item.attr('data-asin') || 
                   $item.attr('data-itemid') ||
                   $item.attr('data-id') ||
                   $item.find('[data-asin]').first().attr('data-asin');
      
      // Build product URL from ASIN
      const href = $item.find('a[href*="/dp/"], a[href*="/gp/product/"]').first().attr('href');
      let link: string | undefined;
      
      if (asin && asin.length === 10) {
        link = `https://www.amazon.com/dp/${asin}`;
      } else if (href) {
        link = href.startsWith('http') ? href : `https://www.amazon.com${href}`;
      }
      
      // Only process if we have a valid product link
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
      
      // Avoid duplicates by checking ASIN/link
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
      console.log("Amazon Registry: Parsed from DOM with selector:", selector, items.length, "items");
      break;
    }
  }
  
  // If still no items, try a more aggressive approach on the registry page only
  if (items.length === 0) {
    // Look for items with both a title and a valid ASIN link
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
      console.log("Amazon Registry: Parsed from ASIN elements:", items.length, "items");
    }
  }
  
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
    
    console.log("[SCRAPE_PARSE] Starting HTML parsing for retailer:", retailer);
    const $ = load(html);
    
    let items: ScrapedItem[] = [];
    let displayRetailer = retailer;
    let scrapeError: string | null = null;
    
    // Wrap each retailer scraping in try/catch to prevent non-2xx responses
    if (retailer === "Target") {
      try {
        console.log("[SCRAPE_PARSE] Starting Target registry parsing...");
        items = scrapeTargetRegistry($, html);
        console.log("[SCRAPE_PARSE] Target parsing complete, items extracted:", items.length);
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: Target | URL: ${url} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        scrapeError = "We couldn't find items at that link. Please double-check the Target registry share URL.";
      }
    } else if (retailer === "AmazonRegistry") {
      try {
        console.log("[SCRAPE_PARSE] Starting Amazon Registry parsing...");
        items = scrapeAmazonRegistry($, html);
        displayRetailer = "Amazon Registry";
        console.log("[SCRAPE_PARSE] Amazon Registry parsing complete, items extracted:", items.length);
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: AmazonRegistry | URL: ${url} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
        scrapeError = "We couldn't find items at that link. Please double-check the Amazon registry share URL.";
      }
    } else {
      try {
        console.log("[SCRAPE_PARSE] Starting Amazon wishlist parsing...");
        items = scrapeAmazon($);
        console.log("[SCRAPE_PARSE] Amazon wishlist parsing complete, items extracted:", items.length);
      } catch (e: any) {
        console.error(`[SCRAPE_PARSE_ERROR] Retailer: Amazon | URL: ${url} | Error: ${e.message}`);
        console.error(`[SCRAPE_PARSE_ERROR] Stack:`, e.stack || "No stack trace");
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
