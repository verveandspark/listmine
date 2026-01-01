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
  if (lowerUrl.includes("target.com") && lowerUrl.includes("/gift-registry/gift/")) return "Target";
  return null;
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
  
  // Try to parse embedded JSON first (window.__PRELOADED_STATE__ or similar)
  try {
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const content = $(script).html() || "";
      
      // Look for preloaded state or registry data
      if (content.includes("__PRELOADED_STATE__") || content.includes("registryItems") || content.includes("listItems")) {
        const stateMatch = content.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:window|<\/script>)/);
        if (stateMatch) {
          try {
            const state = JSON.parse(stateMatch[1]);
            const registryItems = state?.registryItems || state?.list?.items || state?.items || [];
            registryItems.forEach((item: any) => {
              items.push({
                name: item.title || item.name || item.productTitle || "Unknown Item",
                link: item.productUrl || item.link || (item.asin ? `https://www.amazon.com/dp/${item.asin}` : undefined),
                image: item.image || item.imageUrl || item.mainImage || undefined,
                price: item.price?.displayPrice || item.formattedPrice || item.price || undefined,
              });
            });
            if (items.length > 0) {
              console.log("Amazon Registry: Parsed from __PRELOADED_STATE__:", items.length, "items");
              return items;
            }
          } catch (e) {
            console.log("Amazon Registry: Failed to parse __PRELOADED_STATE__");
          }
        }
        
        // Try to find inline JSON registry data
        const jsonMatch = content.match(/\{"registryItems":\s*\[[\s\S]*?\]\s*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            (parsed.registryItems || []).forEach((item: any) => {
              items.push({
                name: item.title || item.name || "Unknown Item",
                link: item.link || item.url || undefined,
                image: item.image || undefined,
                price: item.price || undefined,
              });
            });
            if (items.length > 0) {
              console.log("Amazon Registry: Parsed from inline JSON:", items.length, "items");
              return items;
            }
          } catch (e) {
            console.log("Amazon Registry: Failed to parse inline JSON");
          }
        }
      }
    }
  } catch (e) {
    console.log("Amazon Registry: JSON parsing failed, falling back to DOM");
  }
  
  // DOM parsing fallback - Amazon registry specific selectors
  const registrySelectors = [
    '[data-asin]',
    '.a-list-item',
    '[data-itemid]',
    '.gift-list-item',
    '.gr-card',
    '[class*="registry-item"]',
    '[class*="RegistryItem"]',
    '.a-section[data-csa-c-item-id]',
  ];
  
  for (const selector of registrySelectors) {
    $(selector).each((_index: number, element: any) => {
      const $item = $(element);
      
      const name = $item.find('h3, h2, [data-item-name], .a-size-base-plus, .a-text-normal, a[title]').first().text().trim() ||
                   $item.find('a[title]').attr('title')?.trim() ||
                   $item.find('img').first().attr('alt') || "";
      
      if (!name || name.length < 2) return;
      
      const asin = $item.attr('data-asin') || $item.find('[data-asin]').attr('data-asin');
      const href = $item.find('a[href*="/dp/"], a[href*="/gp/product/"]').first().attr('href');
      const link = asin ? `https://www.amazon.com/dp/${asin}` : 
                   (href ? (href.startsWith('http') ? href : `https://www.amazon.com${href}`) : undefined);
      
      const image = $item.find('img').first().attr('src') || 
                    $item.find('img').first().attr('data-src') || undefined;
      
      const priceWhole = $item.find('.a-price-whole').first().text().trim();
      const priceFraction = $item.find('.a-price-fraction').first().text().trim();
      const price = priceWhole ? `$${priceWhole}${priceFraction}` :
                    $item.find('.a-price, .a-offscreen').first().text().trim() || undefined;
      
      // Check if we already have this item (avoid duplicates)
      if (!items.some(i => i.name === name || (link && i.link === link))) {
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
  
  // Last resort: find any product links
  if (items.length === 0) {
    $('a[href*="/dp/"]').each((_index: number, element: any) => {
      const $link = $(element);
      const href = $link.attr('href');
      const name = $link.text().trim() || $link.find('img').attr('alt') || $link.attr('title') || "";
      
      if (name && name.length > 3 && !items.some(i => i.name === name)) {
        const fullLink = href?.startsWith('http') ? href : `https://www.amazon.com${href}`;
        items.push({
          name,
          link: fullLink,
          image: $link.find('img').attr('src') || undefined,
        });
      }
    });
    console.log("Amazon Registry: Parsed from product links:", items.length, "items");
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
      JSON.stringify({ error: "Method not allowed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      }
    );
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const retailer = detectRetailer(url);

    if (!retailer) {
      // Return structured response (not 400 error) for unsupported retailers
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: "UNSUPPORTED_RETAILER",
          error: "This retailer requires sign-in or doesn't provide a public share link. Please use File Import or Paste Items.",
          requiresManualUpload: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const scraperApiKey = Deno.env.get("SCRAPER_API_KEY");
    console.log("SCRAPER_API_KEY available:", !!scraperApiKey);

    if (!scraperApiKey) {
      console.error("SCRAPER_API_KEY is not set in environment variables");
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Amazon scraping is temporarily unavailable. The service is not properly configured. Please contact support or try again later.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("Fetching URL via ScraperAPI:", url, "Retailer:", retailer);
    const html = await fetchWithScraperAPI(url, scraperApiKey);
    console.log("HTML fetched, length:", html?.length || 0);
    const $ = load(html);
    
    let items: ScrapedItem[];
    let displayRetailer = retailer;
    
    if (retailer === "Target") {
      items = scrapeTargetRegistry($, html);
    } else if (retailer === "AmazonRegistry") {
      items = scrapeAmazonRegistry($, html);
      displayRetailer = "Amazon Registry";
    } else {
      items = scrapeAmazon($);
    }
    console.log("Items scraped:", items.length);

    if (items.length === 0) {
      let errorMessage: string;
      if (retailer === "Target") {
        errorMessage = "We couldn't find items at that link. Please double-check the Target registry share URL.";
      } else if (retailer === "AmazonRegistry") {
        errorMessage = "We couldn't find items at that link. Please double-check the Amazon registry share URL.";
      } else {
        errorMessage = "No items found. The list might be empty, private, or the page structure has changed.";
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        retailer: displayRetailer,
        items,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Scrape error:", error);

    if (error.message?.includes("ScraperAPI")) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Scraping service error. Please try again in a few minutes or contact support.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error.message ||
          "Failed to import wishlist. Please verify the URL is correct and the wishlist is public, then try again.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
