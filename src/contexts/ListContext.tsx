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

const OPERATION_TIMEOUT = 15000;

const withTimeout = <T,>(
  promise: Promise<T> | any,
  timeoutMs: number = OPERATION_TIMEOUT,
): Promise<T> => {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs),
    ),
  ]);
};

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

      const listsChannel = supabase
        .channel("lists-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "lists",
            filter: `user_id=eq.\${user.id}`,
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
      const listsResult = (await withTimeout(
        supabase
          .from("lists")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      )) as any;
      const { data: listsData, error: listsError } = listsResult;

      if (listsError) throw listsError;

      const itemsResult = (await withTimeout(
        supabase
          .from("items")
          .select("*")
          .in("list_id", listsData?.map((l: any) => l.id) || [])
          .order("position", { ascending: true }),
      )) as any;
      const { data: itemsData, error: itemsError } = itemsResult;

      if (itemsError) throw itemsError;

      const listsWithItems: List[] = (listsData || []).map((list: any) => ({
        id: list.id,
        title: list.title,
        category: list.category as ListCategory,
        listType: list.list_type as ListType,
        items: (itemsData || [])
          .filter((item: any) => item.list_id === list.id)
          .map((item: any) => ({
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

    const nameValidation = validateListName(title);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    const categoryValidation = validateCategory(category);
    if (!categoryValidation.valid) {
      throw new Error(categoryValidation.error);
    }

    const existingList = lists.find(
      (l) => l.title.toLowerCase() === nameValidation.value!.toLowerCase(),
    );
    if (existingList) {
      throw new Error(
        `This list name already exists. Try another name like "\${nameValidation.value} 2" or "\${nameValidation.value} - New".`,
      );
    }

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
        `You've reached your limit of \${user.listLimit} lists on the \${tierName} tier. Upgrade to create more lists.`,
      );
    }

    try {
      const result = (await withTimeout(
        supabase.from("lists").insert({
          user_id: user.id,
          title: nameValidation.value,
          category: categoryValidation.value,
          list_type: listType,
        }),
      )) as any;
      const { error } = result;

      if (error) {
        if (error.message.includes("unique")) {
          throw new Error("This list name already exists. Try another name.");
        }
        throw error;
      }

      await loadLists();
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
      const result = (await withTimeout(
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
      )) as any;
      const { error } = result;

      if (error) throw error;
      await loadLists();
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
      const result = (await withTimeout(
        supabase.from("lists").delete().eq("id", listId),
      )) as any;
      const { error } = result;

      if (error) throw error;
      await loadLists();
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

    const nameValidation = validateItemName(item.text);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    if (item.quantity !== undefined) {
      const quantityValidation = validateQuantity(item.quantity);
      if (!quantityValidation.valid) {
        throw new Error(quantityValidation.error);
      }
    }

    if (item.notes) {
      const notesValidation = validateNotes(item.notes);
      if (!notesValidation.valid) {
        throw new Error(notesValidation.error);
      }
    }

    const existingItem = list.items.find(
      (i) => i.text.toLowerCase() === nameValidation.value!.toLowerCase(),
    );
    if (existingItem) {
      throw new Error(
        `This item already exists in your list. Add it anyway or choose a different name?`,
      );
    }

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
        `This list has reached the \${user.itemsPerListLimit} item limit for your \${tierName} tier. Upgrade to add more items.`,
      );
    }

    try {
      const result = (await withTimeout(
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
          links: item.links,
          attributes: item.attributes,
        }),
      )) as any;
      const { error } = result;

      if (error) throw error;

      await loadLists();
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
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Only include fields that are being updated
      if (updates.text !== undefined) updateData.text = updates.text;
      if (updates.quantity !== undefined)
        updateData.quantity = updates.quantity;
      if (updates.priority !== undefined)
        updateData.priority = updates.priority;
      if (updates.dueDate !== undefined)
        updateData.due_date = updates.dueDate?.toISOString();
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.assignedTo !== undefined)
        updateData.assigned_to = updates.assignedTo;
      if (updates.completed !== undefined)
        updateData.is_completed = updates.completed;
      if (updates.links !== undefined) updateData.links = updates.links;
      if (updates.attributes !== undefined)
        updateData.attributes = updates.attributes;

      const result = await supabase
        .from("items")
        .update(updateData)
        .eq("id", itemId);
      const { error } = result;

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("updateListItem", error, user?.id);
      throw error;
    }
  };

  const deleteListItem = async (listId: string, itemId: string) => {
    try {
      const result = await supabase.from("items").delete().eq("id", itemId);
      const { error } = result;

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("deleteListItem", error, user?.id);
      throw error;
    }
  };

  const bulkDeleteItems = async (listId: string, itemIds: string[]) => {
    try {
      const result = await supabase.from("items").delete().in("id", itemIds);
      const { error } = result;

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("bulkDeleteItems", error, user?.id);
      throw error;
    }
  };

  const bulkUpdateItems = async (
    listId: string,
    itemIds: string[],
    updates: Partial<ListItem>,
  ) => {
    try {
      const result = await supabase
        .from("items")
        .update({
          is_completed: updates.completed,
          priority: updates.priority,
          updated_at: new Date().toISOString(),
        })
        .in("id", itemIds);
      const { error } = result;

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("bulkUpdateItems", error, user?.id);
      throw error;
    }
  };

  const reorderListItems = async (listId: string, items: ListItem[]) => {
    try {
      for (const item of items) {
        const index = items.indexOf(item);
        const result = await supabase
          .from("items")
          .update({ position: index })
          .eq("id", item.id);
        const { error } = result;
        if (error) throw error;
      }
      await loadLists();
    } catch (error: any) {
      logError("reorderListItems", error, user?.id);
      throw error;
    }
  };

  const togglePin = async (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    try {
      const result = (await withTimeout(
        supabase
          .from("lists")
          .update({ is_pinned: !list.isPinned })
          .eq("id", listId),
      )) as any;
      const { error } = result;

      if (error) throw error;
      await loadLists();
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
      const result = (await withTimeout(
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
      )) as any;
      const { data: newList, error: listError } = result;

      if (listError) throw listError;

      const itemsToInsert = items.map((item, index) => ({
        list_id: newList.id,
        text: item.text,
        quantity: item.quantity,
        is_completed: false,
        position: index,
      }));

      const itemsResult = (await withTimeout(
        supabase.from("items").insert(itemsToInsert),
      )) as any;
      const { error: itemsError } = itemsResult;

      if (itemsError) throw itemsError;
      await loadLists();
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
              `"\${item.text}","\${item.quantity || ""}","\${item.priority || ""}","\${item.dueDate?.toISOString() || ""}","\${item.notes || ""}","\${item.assignedTo || ""}","\${item.links?.join(";") || ""}","\${item.completed}"`,
          )
          .join("\n");
      } else if (format === "txt") {
        content = list.items
          .map((item) => {
            let line = item.text;
            if (item.quantity) line = `\${item.quantity}x \${line}`;
            if (item.assignedTo) line += ` (\${item.assignedTo})`;
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
    const shareId =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const shareLink = `${window.location.origin}/shared/${shareId}`;

    try {
      const result = (await withTimeout(
        supabase
          .from("lists")
          .update({
            share_link: shareId,
            is_shared: true,
          } as any)
          .eq("id", listId),
      )) as any;
      const { error } = result;

      if (error) throw error;
      await loadLists();
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

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw new Error(emailValidation.error);
    }

    const collaborators = list.collaborators || [];

    if (collaborators.includes(emailValidation.value!)) {
      throw new Error("This person is already a collaborator on this list.");
    }

    try {
      const result = (await withTimeout(
        supabase
          .from("lists")
          .update({
            collaborators: [...collaborators, emailValidation.value],
          } as any)
          .eq("id", listId),
      )) as any;
      const { error } = result;

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
      await loadLists();
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

    const tagValidation = validateTag(tag);
    if (!tagValidation.valid) {
      throw new Error(tagValidation.error);
    }

    const tags = list.tags || [];

    if (tags.includes(tagValidation.value!)) {
      throw new Error("This tag already exists on this list.");
    }

    try {
      const result = (await withTimeout(
        supabase
          .from("lists")
          .update({
            tags: [...tags, tagValidation.value],
          } as any)
          .eq("id", listId),
      )) as any;
      const { error } = result;

      if (error) throw error;
      await loadLists();
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

    try {
      const result = await supabase
        .from("lists")
        .update({
          tags: (list.tags || []).filter((t) => t !== tag),
        } as any)
        .eq("id", listId);
      const { error } = result;

      if (error) throw error;
      await loadLists();
    } catch (error: any) {
      logError("removeTagFromList", error, user?.id);
      throw error;
    }
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

export function useList() {
  const context = useContext(ListContext);
  if (context === undefined) {
    throw new Error("useList must be used within a ListProvider");
  }
  return context;
}
