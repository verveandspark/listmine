import { useState, useCallback } from "react";

export interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  url?: string;
}

export const useOpenGraphPreview = () => {
  const [previewData, setPreviewData] = useState<Record<string, OpenGraphData>>(
    {},
  );
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});

  const fetchPreview = useCallback(
    async (url: string) => {
      if (previewData[url]) return; // Already cached

      console.log("🔍 Fetching preview for URL:", url);
      setLoading((prev) => ({ ...prev, [url]: true }));

      try {
        // Try multiple CORS proxy services
        const proxies = [
          `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
          `https://corsproxy.io/?${encodeURIComponent(url)}`,
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        ];

        let html = "";
        let success = false;

        // Try each proxy until one works
        for (let i = 0; i < proxies.length; i++) {
          const proxyUrl = proxies[i];
          console.log(`🌐 Trying proxy ${i + 1}/${proxies.length}:`, proxyUrl);

          try {
            const response = await fetch(proxyUrl, {
              headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml',
              },
            });

            console.log(`📡 Response status: ${response.status} ${response.statusText}`);

            if (response.ok) {
              try {
                const data = await response.json();
                console.log("📦 Response data type:", typeof data);
                
                // Handle different proxy response formats
                html = data.contents || data.content || data;
                
                if (html && typeof html === 'string') {
                  console.log("✅ Successfully fetched HTML, length:", html.length);
                  success = true;
                  break;
                } else {
                  console.warn("⚠️ Response data is not a string:", typeof html);
                }
              } catch (jsonError) {
                console.error("❌ JSON parse error:", jsonError);
              }
            } else {
              console.warn(`⚠️ Response not OK: ${response.status}`);
            }
          } catch (proxyError) {
            console.error(`❌ Proxy ${i + 1} failed:`, proxyError);
            continue;
          }
        }

        if (!success || !html) {
          throw new Error("All proxies failed to fetch the page");
        }

        console.log("🔨 Parsing HTML...");
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Extract OG meta tags
        const getMetaContent = (property: string) => {
          try {
            const tag = doc.querySelector(
              `meta[property="${property}"], meta[name="${property}"]`,
            );
            return tag?.getAttribute("content") || "";
          } catch (err) {
            console.error(`Error getting meta tag ${property}:`, err);
            return "";
          }
        };

        // Get title with fallbacks
        const title = 
          getMetaContent("og:title") || 
          getMetaContent("twitter:title") || 
          doc.title || 
          "No title";

        // Get description with fallbacks
        const description =
          getMetaContent("og:description") ||
          getMetaContent("twitter:description") ||
          getMetaContent("description") ||
          "No description";

        // Get image with fallbacks
        const image = 
          getMetaContent("og:image") || 
          getMetaContent("twitter:image") || 
          "";

        console.log("📝 Extracted data:", { title, description, image: image ? "✓" : "✗" });

        const ogData: OpenGraphData = {
          title,
          description,
          image,
          url: url,
        };

        // Get favicon
        try {
          const faviconLink =
            doc.querySelector('link[rel="icon"]') ||
            doc.querySelector('link[rel="shortcut icon"]');
          if (faviconLink) {
            ogData.favicon = faviconLink.getAttribute("href") || "";
          }
        } catch (faviconError) {
          console.warn("⚠️ Error getting favicon:", faviconError);
        }

        setPreviewData((prev) => ({ ...prev, [url]: ogData }));
        setError((prev) => ({ ...prev, [url]: "" }));
        console.log("✅ Preview data saved successfully");
      } catch (err) {
        console.error("❌ Failed to fetch Open Graph data:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load preview";
        setError((prev) => ({ ...prev, [url]: errorMessage }));
        
        // Fallback: Extract hostname and create basic preview
        try {
          const urlObj = new URL(url);
          console.log("🔄 Using fallback preview for:", urlObj.hostname);
          setPreviewData((prev) => ({ 
            ...prev, 
            [url]: { 
              url,
              title: urlObj.hostname,
              description: "Preview not available",
            } 
          }));
        } catch (fallbackError) {
          console.error("❌ Fallback also failed:", fallbackError);
          setPreviewData((prev) => ({ ...prev, [url]: { url } }));
        }
      } finally {
        setLoading((prev) => ({ ...prev, [url]: false }));
        console.log("🏁 Fetch complete for:", url);
      }
    },
    [previewData],
  );

  return { previewData, loading, error, fetchPreview };
};