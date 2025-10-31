import { OpenGraphData } from "@/hooks/useOpenGraphPreview";
import { ExternalLink, AlertCircle } from "lucide-react";

interface LinkPreviewCardProps {
  data: OpenGraphData;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export const LinkPreviewCard = ({
  data,
  isLoading,
  hasError,
  errorMessage,
}: LinkPreviewCardProps) => {
  if (isLoading) {
    return (
      <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64 z-50">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64 z-50">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage || "No preview available"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-64 z-50 hover:shadow-xl transition-shadow">
      {data.image && (
        <img
          src={data.image}
          alt={data.title}
          className="w-full h-32 object-cover"
        />
      )}
      <div className="p-3">
        <h4 className="font-semibold text-sm text-gray-900 line-clamp-2">
          {data.title}
        </h4>
        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
          {data.description}
        </p>
        <p className="text-xs text-blue-600 mt-2 truncate flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />
          {new URL(data.url || "").hostname}
        </p>
      </div>
    </div>
  );
};
