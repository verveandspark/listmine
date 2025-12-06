import { useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";

interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  operation?: string;
  userId?: string;
}

const getErrorMessage = (error: SupabaseError | Error | any): string => {
  // Network errors
  if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
    return "Network error. Please check your internet connection and try again.";
  }

  // Timeout errors
  if (error.message?.includes("timeout") || error.message?.includes("timed out")) {
    return "The request timed out. Please try again.";
  }

  // Auth errors
  if (error.code === "invalid_credentials" || error.message?.includes("Invalid login")) {
    return "Invalid email or password. Please try again.";
  }

  if (error.code === "email_not_confirmed") {
    return "Please verify your email address before logging in.";
  }

  if (error.code === "user_not_found") {
    return "No account found with this email address.";
  }

  if (error.message?.includes("JWT") || error.message?.includes("token")) {
    return "Your session has expired. Please log in again.";
  }

  // Permission errors
  if (error.code === "42501" || error.message?.includes("permission denied")) {
    return "You don't have permission to perform this action.";
  }

  if (error.code === "PGRST301" || error.message?.includes("Row level security")) {
    return "Access denied. You may not have permission to view or modify this data.";
  }

  // Validation errors
  if (error.code === "23505" || error.message?.includes("duplicate key")) {
    return "This item already exists. Please use a different name.";
  }

  if (error.code === "23503" || error.message?.includes("foreign key")) {
    return "This action cannot be completed because it references data that doesn't exist.";
  }

  if (error.code === "22P02" || error.message?.includes("invalid input")) {
    return "Invalid input provided. Please check your data and try again.";
  }

  // Rate limiting
  if (error.code === "429" || error.message?.includes("rate limit")) {
    return "Too many requests. Please wait a moment and try again.";
  }

  // Server errors
  if (error.code?.startsWith("5") || error.message?.includes("Internal server error")) {
    return "A server error occurred. Please try again later.";
  }

  // Default to the error message or a generic message
  return error.message || "An unexpected error occurred. Please try again.";
};

export const useSupabaseError = () => {
  const { toast } = useToast();

  const handleError = useCallback(
    (
      error: SupabaseError | Error | any,
      options: ErrorHandlerOptions = {}
    ): string => {
      const {
        showToast = true,
        logToConsole = true,
        operation = "operation",
        userId,
      } = options;

      const userMessage = getErrorMessage(error);

      // Log detailed error to console
      if (logToConsole) {
        console.error(`[Supabase Error] ${operation}:`, {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId,
          timestamp: new Date().toISOString(),
          stack: error.stack,
        });
      }

      // Show user-friendly toast
      if (showToast) {
        toast({
          title: "❌ Error",
          description: userMessage,
          variant: "destructive",
        });
      }

      return userMessage;
    },
    [toast]
  );

  const handleSuccess = useCallback(
    (title: string, description?: string) => {
      toast({
        title: `✅ ${title}`,
        description,
        className: "bg-green-50 border-green-200",
      });
    },
    [toast]
  );

  const wrapAsync = useCallback(
    async <T>(
      asyncFn: () => Promise<T>,
      options: ErrorHandlerOptions & {
        successMessage?: { title: string; description?: string };
      } = {}
    ): Promise<T | null> => {
      try {
        const result = await asyncFn();
        
        if (options.successMessage) {
          handleSuccess(
            options.successMessage.title,
            options.successMessage.description
          );
        }
        
        return result;
      } catch (error: any) {
        handleError(error, options);
        return null;
      }
    },
    [handleError, handleSuccess]
  );

  return {
    handleError,
    handleSuccess,
    wrapAsync,
    getErrorMessage,
  };
};

export default useSupabaseError;
