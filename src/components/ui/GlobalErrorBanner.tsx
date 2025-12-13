import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerType = "error" | "success" | "warning" | "info";

interface Banner {
  id: string;
  type: BannerType;
  title: string;
  message?: string;
  dismissible?: boolean;
  duration?: number;
}

interface GlobalBannerContextType {
  banners: Banner[];
  showBanner: (banner: Omit<Banner, "id">) => string;
  showError: (title: string, message?: string) => string;
  showSuccess: (title: string, message?: string) => string;
  showWarning: (title: string, message?: string) => string;
  showInfo: (title: string, message?: string) => string;
  dismissBanner: (id: string) => void;
  clearAllBanners: () => void;
}

const GlobalBannerContext = createContext<GlobalBannerContextType | undefined>(undefined);

export const useGlobalBanner = () => {
  const context = useContext(GlobalBannerContext);
  if (!context) {
    throw new Error("useGlobalBanner must be used within a GlobalBannerProvider");
  }
  return context;
};

interface GlobalBannerProviderProps {
  children: ReactNode;
}

export const GlobalBannerProvider: React.FC<GlobalBannerProviderProps> = ({ children }) => {
  const [banners, setBanners] = useState<Banner[]>([]);

  const showBanner = useCallback((banner: Omit<Banner, "id">) => {
    const id = `banner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newBanner: Banner = {
      ...banner,
      id,
      dismissible: banner.dismissible ?? true,
      duration: banner.duration ?? (banner.type === "error" ? 8000 : 5000),
    };

    setBanners((prev) => [...prev, newBanner]);

    // Auto-dismiss after duration
    if (newBanner.duration && newBanner.duration > 0) {
      setTimeout(() => {
        dismissBanner(id);
      }, newBanner.duration);
    }

    return id;
  }, []);

  const showError = useCallback((title: string, message?: string) => {
    console.error("[GlobalBanner] Error:", { title, message, timestamp: new Date().toISOString() });
    return showBanner({ type: "error", title, message, duration: 10000 });
  }, [showBanner]);

  const showSuccess = useCallback((title: string, message?: string) => {
    return showBanner({ type: "success", title, message, duration: 4000 });
  }, [showBanner]);

  const showWarning = useCallback((title: string, message?: string) => {
    console.warn("[GlobalBanner] Warning:", { title, message, timestamp: new Date().toISOString() });
    return showBanner({ type: "warning", title, message, duration: 6000 });
  }, [showBanner]);

  const showInfo = useCallback((title: string, message?: string) => {
    return showBanner({ type: "info", title, message, duration: 5000 });
  }, [showBanner]);

  const dismissBanner = useCallback((id: string) => {
    setBanners((prev) => prev.filter((banner) => banner.id !== id));
  }, []);

  const clearAllBanners = useCallback(() => {
    setBanners([]);
  }, []);

  return (
    <GlobalBannerContext.Provider
      value={{
        banners,
        showBanner,
        showError,
        showSuccess,
        showWarning,
        showInfo,
        dismissBanner,
        clearAllBanners,
      }}
    >
      {children}
      <BannerContainer banners={banners} onDismiss={dismissBanner} />
    </GlobalBannerContext.Provider>
  );
};

interface BannerContainerProps {
  banners: Banner[];
  onDismiss: (id: string) => void;
}

const BannerContainer: React.FC<BannerContainerProps> = ({ banners, onDismiss }) => {
  if (banners.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {banners.map((banner) => (
        <BannerItem key={banner.id} banner={banner} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

interface BannerItemProps {
  banner: Banner;
  onDismiss: (id: string) => void;
}

const BannerItem: React.FC<BannerItemProps> = ({ banner, onDismiss }) => {
  const icons = {
    error: AlertCircle,
    success: CheckCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const styles = {
    error: "bg-red-50 border-red-200 text-red-800",
    success: "bg-accent/10 border-accent/20 text-accent",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    info: "bg-primary/10 border-primary/20 text-primary",
  };

  const iconStyles = {
    error: "text-red-500",
    success: "text-accent",
    warning: "text-amber-500",
    info: "text-primary",
  };

  const Icon = icons[banner.type];

  return (
    <div
      className={cn(
        "pointer-events-auto rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-5 fade-in duration-300",
        styles[banner.type]
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", iconStyles[banner.type])} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{banner.title}</p>
          {banner.message && (
            <p className="text-sm mt-1 opacity-90">{banner.message}</p>
          )}
        </div>
        {banner.dismissible && (
          <button
            onClick={() => onDismiss(banner.id)}
            className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default GlobalBannerProvider;
