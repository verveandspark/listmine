import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as cheerio from 'cheerio';
import axios from 'axios';

interface ScrapedItem {
  name: string;
  price?: string;
  link?: string;
  image?: string;
}

interface ScraperResponse {
  success: boolean;
  retailer?: string;
  items?: ScrapedItem[];
  error?: string;
}

const detectRetailer = (url: string): string | null => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('amazon.com')) return 'Amazon';
  return null;
};

const scrapeAmazon = ($: cheerio.CheerioAPI): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
  // Amazon wishlist selectors
  $('[data-itemid], .g-item-sortable, li[data-id]').each((_, element) => {
    const $item = $(element);
    
    const name = $item.find('h3, h2, .a-size-base, [data-item-name]').first().text().trim() ||
                 $item.find('a[title]').attr('title')?.trim() ||
                 $item.find('.a-link-normal').first().text().trim();
    
    const priceWhole = $item.find('.a-price-whole').first().text().trim();
    const priceFraction = $item.find('.a-price-fraction').first().text().trim();
    const price = priceWhole ? `$${priceWhole}${priceFraction}` : 
                  $item.find('.a-price, .a-offscreen').first().text().trim();
    
    const link = $item.find('a[href*="/dp/"], a[href*="/gp/product/"]').first().attr('href');
    const fullLink = link ? (link.startsWith('http') ? link : `https://www.amazon.com${link}`) : undefined;
    
    const image = $item.find('img').first().attr('src') || 
                  $item.find('img').first().attr('data-src');
    
    if (name) {
      items.push({
        name,
        price: price || undefined,
        link: fullLink,
        image: image || undefined
      });
    }
  });
  
  return items;
};

const scrapeTarget = ($: cheerio.CheerioAPI): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
  // Target registry/list selectors
  $('[data-test="list-item"], .styles__Item, .RegistryItem').each((_, element) => {
    const $item = $(element);
    
    const name = $item.find('[data-test="product-title"], h3, .ProductTitle, a').first().text().trim();
    
    const price = $item.find('[data-test="product-price"], .Price, .h-text-bs').first().text().trim();
    
    const link = $item.find('a[href*="/p/"]').first().attr('href');
    const fullLink = link ? (link.startsWith('http') ? link : `https://www.target.com${link}`) : undefined;
    
    const image = $item.find('img').first().attr('src') || 
                  $item.find('img').first().attr('data-src');
    
    if (name) {
      items.push({
        name,
        price: price || undefined,
        link: fullLink,
        image: image || undefined
      });
    }
  });
  
  return items;
};

const scrapeWalmart = ($: cheerio.CheerioAPI): ScrapedItem[] => {
  const items: ScrapedItem[] = [];
  
  // Walmart list selectors
  $('[data-item-id], .list-item, .Grid-col').each((_, element) => {
    const $item = $(element);
    
    const name = $item.find('[data-automation-id="product-title"], .product-title-link, a span').first().text().trim() ||
                 $item.find('a[link-identifier]').first().text().trim();
    
    const price = $item.find('[data-automation-id="product-price"], .price-main, .price-characteristic').first().text().trim();
    
    const link = $item.find('a[href*="/ip/"]').first().attr('href');
    const fullLink = link ? (link.startsWith('http') ? link : `https://www.walmart.com${link}`) : undefined;
    
    const image = $item.find('img').first().attr('src') || 
                  $item.find('img').first().attr('data-src');
    
    if (name) {
      items.push({
        name,
        price: price || undefined,
        link: fullLink,
        image: image || undefined
      });
    }
  });
  
  return items;
};

async function fetchWithScraperAPI(url: string, apiKey?: string): Promise<string> {
  if (!apiKey) {
    throw new Error('ScraperAPI key required for Amazon scraping. Please add SCRAPER_API_KEY to environment variables.');
  }

  const scraperApiUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true`;
  
  const response = await axios.get(scraperApiUrl, {
    timeout: 30000,
  });

  return response.data;
}

async function fetchDirectly(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    console.log('=== API ROUTE CALLED ===');
    console.log('Request method:', req.method);
    console.log('Request body:', JSON.stringify(req.body));

    if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS request');
      res.status(200).json({ success: true });
      return;
    }

    if (req.method !== 'POST') {
      console.log('Invalid method:', req.method);
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      console.log('Missing or invalid URL');
      res.status(400).json({ success: false, error: 'URL is required' });
      return;
    }

    const retailer = detectRetailer(url);
    console.log('Detected retailer:', retailer);

    if (!retailer) {
      res.status(400).json({ 
        success: false, 
        error: 'Unsupported URL. Please use Amazon wishlist URLs only.' 
      });
      return;
    }

    console.log('Fetching URL:', url);

    let html: string;
    const scraperApiKey = process.env.SCRAPER_API_KEY;
    console.log('ScraperAPI key available:', !!scraperApiKey);

    if (!scraperApiKey) {
      res.status(400).json({
        success: false,
        error: 'Amazon scraping requires ScraperAPI key. Please contact support.'
      });
      return;
    }
    
    console.log('Using ScraperAPI for Amazon');
    html = await fetchWithScraperAPI(url, scraperApiKey);
    console.log('HTML length:', html.length);

    const $ = cheerio.load(html);
    const items: ScrapedItem[] = scrapeAmazon($);

    console.log('Scraped items count:', items.length);

    if (items.length === 0) {
      res.status(400).json({ 
        success: false, 
        error: 'No items found. The list might be empty, private, or the page structure has changed.' 
      });
      return;
    }

    res.status(200).json({
      success: true,
      retailer,
      items
    });

  } catch (error: any) {
    console.error('=== API ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      res.status(408).json({ 
        success: false, 
        error: 'Request timed out. The page took too long to load.' 
      });
      return;
    }

    if (error.response?.status === 404) {
      res.status(404).json({ 
        success: false, 
        error: 'List not found. Make sure the URL is correct and the list is public.' 
      });
      return;
    }

    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to scrape wishlist. Please try again or check if the list is public.' 
    });
  }
}