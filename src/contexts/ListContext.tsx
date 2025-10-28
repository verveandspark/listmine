import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { List, ListItem, ListCategory, ListType } from "@/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/useAuthHook";
import {
  validateListName,
  validateItemName,
  validateEmail,
  validateTag,
  validateNotes,
  validateQuantity,
  validateCategory,
  sanitizeInput,
} from "@/lib/validation";

const OPERATION_TIMEOUT = 15000; // 15 seconds

// Helper function to add timeout to promises
const withTimeout = <T,>(
  promise: Promise<T>,
  timeoutMs: number = OPERATION_TIMEOUT,
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs),
    ),
  ]);
};

// Helper function to log errors
const logError = (operation: string, error: any, userId?: string) => {
  console.error("[ListMine Error]", {
    operation,
    error: error.message || error,
    userId,
    timestamp: new Date().toISOString(),
  });
};

interface ListContextType {
  lists: List[];
  addList: (
    title: string,
    category: ListCategory,
    listType: ListType,
  ) => Promise<void>;
  updateList: (id: string, updates: Partial<List>) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  addItemToList: (
    listId: string,
    item: Omit<ListItem, "id" | "order">,
  ) => Promise<void>;
  updateListItem: (
    listId: string,
    itemId: string,
    updates: Partial<ListItem>,
  ) => Promise<void>;
  deleteListItem: (listId: string, itemId: string) => Promise<void>;
  bulkDeleteItems: (listId: string, itemIds: string[]) => Promise<void>;
  bulkUpdateItems: (
    listId: string,
    itemIds: string[],
    updates: Partial<ListItem>,
  ) => Promise<void>;
  reorderListItems: (listId: string, items: ListItem[]) => Promise<void>;
  togglePin: (listId: string) => Promise<void>;
  importList: (
    data: string,
    format: "csv" | "txt",
    category: ListCategory,
    listType: ListType,
  ) => Promise<void>;
  exportList: (listId: string, format: "csv" | "txt" | "pdf") => void;
  generateShareLink: (listId: string) => Promise<string>;
  addCollaborator: (listId: string, email: string) => Promise<void>;
  searchLists: (query: string) => List[];
  filterLists: (filters: {
    category?: ListCategory;
    type?: ListType;
    tags?: string[];
  }) => List[];
  addTagToList: (listId: string, tag: string) => Promise<void>;
  removeTagFromList: (listId: string, tag: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  retryLoad: () => Promise<void>;
}

export const ListContext = createContext<ListContextType | undefined>(
  undefined,
);

export function ListProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadLists();

      // Subscribe to changes with proper cleanup
      const listsChannel = supabase
        .channel("lists-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "lists",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadLists();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "items",
          },
          () => {
            loadLists();
          },
        )
        .subscribe();

      // Cleanup function
      return () => {
        supabase.removeChannel(listsChannel);
      };
    } else {
      setLists([]);
      setLoading(false);
    }
  }, [user]);

  const loadLists = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data: listsData, error: listsError } = await withTimeout(
        supabase
          .from("lists")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      );

      if (listsError) throw listsError;

      const { data: itemsData, error: itemsError } = await withTimeout(
        supabase
          .from("items")
          .select("*")
          .in("list_id", listsData?.map((l) => l.id) || [])
          .order("position", { ascending: true }),
      );

      if (itemsError) throw itemsError;

      const listsWithItems: List[] = (listsData || []).map((list) => ({
        id: list.id,
        title: list.title,
        category: list.category as ListCategory,
        listType: list.list_type as ListType,
        items: (itemsData || [])
          .filter((item) => item.list_id === list.id)
          .map((item) => ({
            id: item.id,
            text: item.text,
            quantity: item.quantity,
            priority: item.priority as "high" | "medium" | "low" | undefined,
            dueDate: item.due_date ? new Date(item.due_date) : undefined,
            notes: item.notes,
            assignedTo: item.assigned_to,
            completed: item.is_completed,
            order: item.position,
            links: item.links,
            attributes: item.attributes,
          })),
        isPinned: list.is_pinned || false,
        tags: list.tags || [],
        collaborators: list.collaborators || [],
        shareLink: list.share_link,
        isShared: list.is_shared || false,
        createdAt: new Date(list.created_at),
        updatedAt: new Date(list.updated_at),
      }));

      setLists(listsWithItems);
    } catch (error: any) {
      logError("loadLists", error, user?.id);

      if (error.message === "Operation timed out") {
        setError(
          "This is taking longer than expected. Please wait or try again.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        setError(
          "We're having trouble connecting. Check your internet connection and try again.",
        );
      } else if (
        error.message.includes("JWT") ||
        error.message.includes("token")
      ) {
        setError("Your session has expired. Please log in again.");
        // Optionally trigger logout
      } else {
        setError(
          "Couldn't load your lists. Check your connection and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const addList = async (
    title: string,
    category: ListCategory,
    listType: ListType = "custom",
  ) => {
    if (!user) return;

    // Validate and sanitize list name
    const nameValidation = validateListName(title);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    // Validate category
    const categoryValidation = validateCategory(category);
    if (!categoryValidation.valid) {
      throw new Error(categoryValidation.error);
    }

    // Check for duplicate list name
    const existingList = lists.find(
      (l) => l.title.toLowerCase() === nameValidation.value!.toLowerCase(),
    );
    if (existingList) {
      throw new Error(
        `This list name already exists. Try another name like "${nameValidation.value} 2" or "${nameValidation.value} - New".`,
      );
    }

    // Check list limit on client side
    if (user.listLimit !== -1 && lists.length >= user.listLimit) {
      const tierName =
        user.tier === "free"
          ? "Free"
          : user.tier === "good"
            ? "Good"
            : user.tier === "even-better"
              ? "Even Better"
              : "Lots More";
      throw new Error(
        `You've reached your limit of ${user.listLimit} lists on the ${tierName} tier. Upgrade to create more lists.`,
      );
    }

    try {
      const { error } = await withTimeout(
        supabase.from("lists").insert({
          user_id: user.id,
          title: nameValidation.value,
          category: categoryValidation.value,
          list_type: listType,
        }),
      );

      if (error) {
        if (error.message.includes("unique")) {
          throw new Error("This list name already exists. Try another name.");
        }
        throw error;
      }
    } catch (error: any) {
      logError("addList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (error.message.includes("rate limit")) {
        throw new Error(
          "Slow down! You're making too many requests. Wait a moment and try again.",
        );
      } else if (
        error.message.includes("JWT") ||
        error.message.includes("token")
      ) {
        throw new Error("Your session has expired. Please log in again.");
      } else if (
        !error.message.includes("already exists") &&
        !error.message.includes("limit")
      ) {
        throw new Error("Couldn't create list. Try again or contact support.");
      }
      throw error;
    }
  };

  const updateList = async (listId: string, updates: Partial<List>) => {
    try {
      const { error } = await withTimeout(
        supabase
          .from("lists")
          .update({
            title: updates.title,
            category: updates.category,
            list_type: updates.listType,
            is_pinned: updates.isPinned,
            tags: updates.tags,
            updated_at: new Date().toISOString(),
          })
          .eq("id", listId),
      );

      if (error) throw error;
    } catch (error: any) {
      logError("updateList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else {
        throw new Error("Couldn't update list. Try again or contact support.");
      }
    }
  };

  const deleteList = async (listId: string) => {
    try {
      const { error } = await withTimeout(
        supabase.from("lists").delete().eq("id", listId),
      );

      if (error) throw error;
    } catch (error: any) {
      logError("deleteList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else {
        throw new Error("Couldn't delete list. Try again or contact support.");
      }
    }
  };

  const addItemToList = async (
    listId: string,
    item: Omit<ListItem, "id" | "order">,
  ) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    // Validate and sanitize item name
    const nameValidation = validateItemName(item.text);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    // Validate quantity
    if (item.quantity !== undefined) {
      const quantityValidation = validateQuantity(item.quantity);
      if (!quantityValidation.valid) {
        throw new Error(quantityValidation.error);
      }
    }

    // Validate notes
    if (item.notes) {
      const notesValidation = validateNotes(item.notes);
      if (!notesValidation.valid) {
        throw new Error(notesValidation.error);
      }
    }

    // Check for duplicate item
    const existingItem = list.items.find(
      (i) => i.text.toLowerCase() === nameValidation.value!.toLowerCase(),
    );
    if (existingItem) {
      throw new Error(
        `This item already exists in your list. Add it anyway or choose a different name?`,
      );
    }

    // Check item limit on client side
    if (
      user &&
      user.itemsPerListLimit !== -1 &&
      list.items.length >= user.itemsPerListLimit
    ) {
      const tierName =
        user.tier === "free"
          ? "Free"
          : user.tier === "good"
            ? "Good"
            : user.tier === "even-better"
              ? "Even Better"
              : "Lots More";
      throw new Error(
        `This list has reached the ${user.itemsPerListLimit} item limit for your ${tierName} tier. Upgrade to add more items.`,
      );
    }

    try {
      const { error } = await withTimeout(
        supabase.from("items").insert({
          list_id: listId,
          text: nameValidation.value,
          quantity: item.quantity,
          priority: item.priority,
          due_date: item.dueDate?.toISOString(),
          notes: item.notes ? sanitizeInput(item.notes) : null,
          assigned_to: item.assignedTo ? sanitizeInput(item.assignedTo) : null,
          is_completed: item.completed || false,
          position: list.items.length,
        }),
      );

      if (error) throw error;
    } catch (error: any) {
      logError("addItemToList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (error.message.includes("rate limit")) {
        throw new Error(
          "Slow down! You're making too many requests. Wait a moment and try again.",
        );
      } else if (
        !error.message.includes("blank") &&
        !error.message.includes("already exists") &&
        !error.message.includes("limit")
      ) {
        throw new Error("Couldn't add item. Try again or contact support.");
      }
      throw error;
    }
  };

  const updateListItem = async (
    listId: string,
    itemId: string,
    updates: Partial<ListItem>,
  ) => {
    const { error } = await supabase
      .from("items")
      .update({
        text: updates.text,
        quantity: updates.quantity,
        priority: updates.priority,
        due_date: updates.dueDate?.toISOString(),
        notes: updates.notes,
        assigned_to: updates.assignedTo,
        is_completed: updates.completed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    if (error) throw error;
    // Don't call loadLists() - realtime will handle it
  };

  const deleteListItem = async (listId: string, itemId: string) => {
    const { error } = await supabase.from("items").delete().eq("id", itemId);

    if (error) throw error;
    // Don't call loadLists() - realtime will handle it
  };

  const bulkDeleteItems = async (listId: string, itemIds: string[]) => {
    const { error } = await supabase.from("items").delete().in("id", itemIds);

    if (error) throw error;
    // Don't call loadLists() - realtime will handle it
  };

  const bulkUpdateItems = async (
    listId: string,
    itemIds: string[],
    updates: Partial<ListItem>,
  ) => {
    const { error } = await supabase
      .from("items")
      .update({
        is_completed: updates.completed,
        priority: updates.priority,
        updated_at: new Date().toISOString(),
      })
      .in("id", itemIds);

    if (error) throw error;
    // Don't call loadLists() - realtime will handle it
  };

  const reorderListItems = async (listId: string, items: ListItem[]) => {
    const updates = items.map((item, index) => ({
      id: item.id,
      position: index,
    }));

    for (const update of updates) {
      await supabase
        .from("items")
        .update({ position: update.position })
        .eq("id", update.id);
    }
    // Don't call loadLists() - realtime will handle it
  };

  const togglePin = async (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    try {
      const { error } = await withTimeout(
        supabase
          .from("lists")
          .update({ is_pinned: !list.isPinned })
          .eq("id", listId),
      );

      if (error) throw error;
    } catch (error: any) {
      logError("togglePin", error, user?.id);
      throw new Error("Couldn't update pin status. Try again.");
    }
  };

  const importList = async (
    data: string,
    format: "csv" | "txt",
    category: ListCategory,
    listType: ListType = "custom",
  ) => {
    if (!user) return;

    // Validate import data
    if (!data.trim()) {
      throw new Error(
        "This file appears to be empty. Add some items and try again.",
      );
    }

    const lines = data.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error(
        "This file appears to be empty. Add some items and try again.",
      );
    }

    const items: Omit<ListItem, "id" | "order">[] = [];

    try {
      if (format === "csv") {
        if (lines.length < 2) {
          throw new Error(
            "We couldn't read this file. Make sure it's a valid CSV file with headers.",
          );
        }
        const headers = lines[0]
          .toLowerCase()
          .split(",")
          .map((h) => h.trim());
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i]
            .split(",")
            .map((v) => v.trim().replace(/^"|"$/g, ""));
          const item: Omit<ListItem, "id" | "order"> = {
            text: values[headers.indexOf("text")] || values[0] || "",
            completed: false,
          };

          const qtyIndex = headers.indexOf("quantity");
          if (qtyIndex >= 0 && values[qtyIndex]) {
            item.quantity = parseInt(values[qtyIndex]);
          }

          const linkIndex = headers.indexOf("link");
          if (linkIndex >= 0 && values[linkIndex]) {
            item.links = [values[linkIndex]];
          }

          items.push(item);
        }
      } else {
        lines.forEach((line) => {
          items.push({
            text: line.trim(),
            completed: false,
          });
        });
      }
    } catch (error) {
      throw new Error(
        "We couldn't read this file. Make sure it's a valid CSV or TXT file.",
      );
    }

    try {
      // Create list
      const { data: newList, error: listError } = await withTimeout(
        supabase
          .from("lists")
          .insert({
            user_id: user.id,
            title: `Imported ${category} List`,
            category,
            list_type: listType,
          })
          .select()
          .single(),
      );

      if (listError) throw listError;

      // Add items
      const itemsToInsert = items.map((item, index) => ({
        list_id: newList.id,
        text: item.text,
        quantity: item.quantity,
        is_completed: false,
        position: index,
      }));

      const { error: itemsError } = await withTimeout(
        supabase.from("items").insert(itemsToInsert),
      );

      if (itemsError) throw itemsError;
    } catch (error: any) {
      logError("importList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (
        !error.message.includes("empty") &&
        !error.message.includes("read this file")
      ) {
        throw new Error("Couldn't import list. Try again or contact support.");
      }
      throw error;
    }
  };

  const exportList = (listId: string, format: "csv" | "txt" | "pdf") => {
    const list = lists.find((l) => l.id === listId);
    if (!list) {
      throw new Error("List not found. Please select a valid list to export.");
    }

    try {
      let content = "";
      let mimeType = "text/plain";

      if (format === "csv") {
        content =
          "Text,Quantity,Priority,Due Date,Notes,Assigned To,Links,Completed\n";
        content += list.items
          .map(
            (item) =>
              `"${item.text}","${item.quantity || ""}","${item.priority || ""}","${item.dueDate?.toISOString() || ""}","${item.notes || ""}","${item.assignedTo || ""}","${item.links?.join(";") || ""}","${item.completed}"`,
          )
          .join("\n");
      } else if (format === "txt") {
        content = list.items
          .map((item) => {
            let line = item.text;
            if (item.quantity) line = `${item.quantity}x ${line}`;
            if (item.assignedTo) line += ` (${item.assignedTo})`;
            return line;
          })
          .join("\n");
      } else if (format === "pdf") {
        content = `
        <html>
          <head><title>${list.title}</title></head>
          <body>
            <h1>${list.title}</h1>
            <p>Category: ${list.category} | Type: ${list.listType}</p>
            <ul>
              ${list.items.map((item) => `<li>${item.text}${item.quantity ? ` (${item.quantity})` : ""}</li>`).join("")}
            </ul>
          </body>
        </html>
      `;
        mimeType = "text/html";
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${list.title}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      logError("exportList", error, user?.id);
      throw new Error(
        "Export failed. Try again, or contact support if the problem continues.",
      );
    }
  };

  const generateShareLink = async (listId: string): Promise<string> => {
    const shareId = `${listId}-${Date.now()}`;
    const shareLink = `${window.location.origin}/shared/${shareId}`;

    try {
      const { error } = await withTimeout(
        supabase
          .from("lists")
          .update({
            share_link: shareLink,
            is_shared: true,
          })
          .eq("id", listId),
      );

      if (error) throw error;
      return shareLink;
    } catch (error: any) {
      logError("generateShareLink", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else {
        throw new Error(
          "Couldn't generate share link. Try again or contact support.",
        );
      }
    }
  };

  const addCollaborator = async (listId: string, email: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw new Error(emailValidation.error);
    }

    const collaborators = list.collaborators || [];

    // Check if already a collaborator
    if (collaborators.includes(emailValidation.value!)) {
      throw new Error("This person is already a collaborator on this list.");
    }

    try {
      const { error } = await withTimeout(
        supabase
          .from("lists")
          .update({ collaborators: [...collaborators, emailValidation.value] })
          .eq("id", listId),
      );

      if (error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("does not exist")
        ) {
          throw new Error(
            "We couldn't find a user with this email. Make sure they've signed up first.",
          );
        }
        throw error;
      }
    } catch (error: any) {
      logError("addCollaborator", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (
        !error.message.includes("email") &&
        !error.message.includes("already a collaborator")
      ) {
        throw new Error(
          "Couldn't add collaborator. Try again or contact support.",
        );
      }
      throw error;
    }
  };

  const searchLists = (query: string): List[] => {
    const lowerQuery = query.toLowerCase();
    return lists.filter(
      (list) =>
        list.title.toLowerCase().includes(lowerQuery) ||
        list.category.toLowerCase().includes(lowerQuery) ||
        list.items.some((item) =>
          item.text.toLowerCase().includes(lowerQuery),
        ) ||
        list.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)),
    );
  };
  const filterLists = (filters: {
    category?: ListCategory;
    type?: ListType;
    tags?: string[];
  }): List[] => {
    return lists.filter((list) => {
      if (filters.category && list.category !== filters.category) return false;
      if (filters.type && list.listType !== filters.type) return false;
      if (filters.tags && filters.tags.length > 0) {
        const listTags = list.tags || [];
        if (!filters.tags.some((tag) => listTags.includes(tag))) return false;
      }
      return true;
    });
  };

  const addTagToList = async (listId: string, tag: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    // Validate tag
    const tagValidation = validateTag(tag);
    if (!tagValidation.valid) {
      throw new Error(tagValidation.error);
    }

    const tags = list.tags || [];

    // Check if tag already exists
    if (tags.includes(tagValidation.value!)) {
      throw new Error("This tag already exists on this list.");
    }

    try {
      const { error } = await withTimeout(
        supabase
          .from("lists")
          .update({ tags: [...tags, tagValidation.value] })
          .eq("id", listId),
      );

      if (error) throw error;
    } catch (error: any) {
      logError("addTagToList", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (!error.message.includes("tag")) {
        throw new Error("Couldn't add tag. Try again or contact support.");
      }
      throw error;
    }
  };

  const removeTagFromList = async (listId: string, tag: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    const { error } = await supabase
      .from("lists")
      .update({ tags: (list.tags || []).filter((t) => t !== tag) })
      .eq("id", listId);

    if (error) throw error;
  };

  return (
    <ListContext.Provider
      value={{
        lists,
        addList,
        updateList,
        deleteList,
        addItemToList,
        updateListItem,
        deleteListItem,
        bulkDeleteItems,
        bulkUpdateItems,
        reorderListItems,
        togglePin,
        importList,
        exportList,
        generateShareLink,
        addCollaborator,
        searchLists,
        filterLists,
        addTagToList,
        removeTagFromList,
        loading,
        error,
        retryLoad: loadLists,
      }}
    >
      {children}
    </ListContext.Provider>
  );
}
