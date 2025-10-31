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

      setLoading((prev) => ({ ...prev, [url]: true }));

      try {
        // Use a CORS-friendly approach: fetch the page and parse OG tags
        const response = await fetch(
          `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        );
        const data = await response.json();

        if (data.status.http_code !== 200) {
          throw new Error("Failed to fetch page");
        }

        const html = data.contents;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Extract OG meta tags
        const getMetaContent = (property: string) => {
          const tag = doc.querySelector(
            `meta[property="${property}"], meta[name="${property}"]`,
          );
          return tag?.getAttribute("content") || "";
        };

        const ogData: OpenGraphData = {
          title: getMetaContent("og:title") || doc.title || "No title",
          description:
            getMetaContent("og:description") ||
            getMetaContent("description") ||
            "No description",
          image: getMetaContent("og:image") || "",
          url: url,
        };

        // Get favicon
        const faviconLink =
          doc.querySelector('link[rel="icon"]') ||
          doc.querySelector('link[rel="shortcut icon"]');
        if (faviconLink) {
          ogData.favicon = faviconLink.getAttribute("href") || "";
        }

        setPreviewData((prev) => ({ ...prev, [url]: ogData }));
        setError((prev) => ({ ...prev, [url]: "" }));
      } catch (err) {
        setError((prev) => ({ ...prev, [url]: "No preview available" }));
        setPreviewData((prev) => ({ ...prev, [url]: { url } }));
      } finally {
        setLoading((prev) => ({ ...prev, [url]: false }));
      }
    },
    [previewData],
  );

  return { previewData, loading, error, fetchPreview };
};
