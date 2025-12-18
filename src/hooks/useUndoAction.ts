import { useRef, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import React from "react";

interface UndoableAction<T> {
  data: T;
  undoFn: (data: T) => Promise<void>;
  description: string;
  timeoutId?: ReturnType<typeof setTimeout>;
}

const UNDO_TIMEOUT = 8000; // 8 seconds to undo

export function useUndoAction() {
  const { toast } = useToast();
  const pendingActionsRef = useRef<Map<string, UndoableAction<any>>>(new Map());

  const executeWithUndo = useCallback(
    async <T,>(
      actionId: string,
      data: T,
      executeFn: () => Promise<void>,
      undoFn: (data: T) => Promise<void>,
      options: {
        title: string;
        description: string;
        undoDescription?: string;
      }
    ) => {
      // Store the data for potential undo
      const action: UndoableAction<T> = {
        data,
        undoFn,
        description: options.undoDescription || options.description,
      };

      // Execute the action
      await executeFn();

      // Set up timeout to clear the undo option
      const timeoutId = setTimeout(() => {
        pendingActionsRef.current.delete(actionId);
      }, UNDO_TIMEOUT);

      action.timeoutId = timeoutId;
      pendingActionsRef.current.set(actionId, action);

      // Show toast with undo action
      const handleUndo = async () => {
        const pendingAction = pendingActionsRef.current.get(actionId);
        if (pendingAction) {
          // Clear the timeout
          if (pendingAction.timeoutId) {
            clearTimeout(pendingAction.timeoutId);
          }
          pendingActionsRef.current.delete(actionId);

          try {
            await pendingAction.undoFn(pendingAction.data);
            toast({
              title: "✅ Undone!",
              description: pendingAction.description,
              className: "bg-accent/10 border-accent/30",
            });
          } catch (error: any) {
            toast({
              title: "❌ Undo failed",
              description: error.message || "Could not undo the action",
              variant: "destructive",
            });
          }
        }
      };

      toast({
        title: options.title,
        description: options.description,
        action: React.createElement(
          ToastAction,
          {
            altText: "Undo action",
            onClick: handleUndo,
          },
          "Undo"
        ) as unknown as React.ReactElement<typeof ToastAction>,
        duration: UNDO_TIMEOUT,
      });
    },
    [toast]
  );

  const clearPendingAction = useCallback((actionId: string) => {
    const action = pendingActionsRef.current.get(actionId);
    if (action?.timeoutId) {
      clearTimeout(action.timeoutId);
    }
    pendingActionsRef.current.delete(actionId);
  }, []);

  return {
    executeWithUndo,
    clearPendingAction,
  };
}
