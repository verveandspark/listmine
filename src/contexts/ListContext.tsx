import {
  createContext,
  useEffect,
  useState,
  ReactNode,
  useContext,
} from "react";
import { supabase } from "@/lib/supabase";
import { List, ListItem, ListCategory, ListType } from "@/types";
import { useAuth } from "./useAuthHook";
import {
  validateListName,
  validateCategory,
  validateImportData,
  validateItemName,
  validateQuantity,
  validateNotes,
  sanitizeInput,
  validateEmail,
  validateTag,
} from "@/lib/validation";
import html2pdf from "html2pdf.js";

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
  ) => Promise<string>;
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
  importFromShareLink: (shareId: string) => Promise<string>;
  importFromWishlist: (
    items: Array<{ name: string; price?: string; link?: string; image?: string }>,
    listName: string,
    category: ListCategory,
  ) => Promise<string>;
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
            table: "list_items",
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
          .from("list_items")
          .select("*")
          .in("list_id", listsData?.map((l: any) => l.id) || [])
          .order("item_order", { ascending: true }),
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
            completed: item.completed,
            order: item.item_order,
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
  ): Promise<string> => {
    if (!user) throw new Error("User not authenticated");

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
        `This list name already exists. Try another name like "${nameValidation.value} 2" or "${nameValidation.value} - New".`,
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
        `You've reached your limit of ${user.listLimit} lists on the ${tierName} tier. Upgrade to create more lists.`,
      );
    }

    try {
      const result = (await withTimeout(
        supabase.from("lists").insert({
          user_id: user.id,
          title: nameValidation.value,
          category: categoryValidation.value,
          list_type: listType,
        }).select().single(),
      )) as any;
      const { data: newList, error } = result;

      if (error) {
        if (error.message.includes("unique")) {
          throw new Error("This list name already exists. Try another name.");
        }
        throw error;
      }

      await loadLists();
      return newList.id;
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
        `This list has reached the ${user.itemsPerListLimit} item limit for your ${tierName} tier. Upgrade to add more items.`,
      );
    }

    try {
      const result = (await withTimeout(
        supabase.from("list_items").insert({
          list_id: listId,
          text: nameValidation.value,
          quantity: item.quantity,
          priority: item.priority,
          due_date: item.dueDate?.toISOString(),
          notes: item.notes ? sanitizeInput(item.notes) : null,
          assigned_to: item.assignedTo ? sanitizeInput(item.assignedTo) : null,
          completed: item.completed || false,
          item_order: list.items.length,
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
        updateData.completed = updates.completed;
      if (updates.links !== undefined) updateData.links = updates.links;
      if (updates.attributes !== undefined)
        updateData.attributes = updates.attributes;

      const result = await supabase
        .from("list_items")
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
      const result = await supabase.from("list_items").delete().eq("id", itemId);
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
      const result = await supabase.from("list_items").delete().in("id", itemIds);
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
        .from("list_items")
        .update({
          completed: updates.completed,
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
          .from("list_items")
          .update({ item_order: index })
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
          .map((h) => h.trim().replace(/^"|"$/g, ""));
        
        for (let i = 1; i < lines.length; i++) {
          // Parse CSV line handling quoted fields
          const values: string[] = [];
          let currentValue = "";
          let insideQuotes = false;
          
          for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              values.push(currentValue.trim());
              currentValue = "";
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim());
          
          const getValueByHeader = (headerName: string) => {
            const index = headers.indexOf(headerName);
            return index >= 0 ? values[index]?.replace(/^"|"$/g, "") : "";
          };
          
          const itemText = getValueByHeader("item name") || getValueByHeader("text") || getValueByHeader("name") || values[0] || "";
          
          if (!itemText) continue;
          
          const item: Omit<ListItem, "id" | "order"> = {
            text: itemText,
            completed: getValueByHeader("completed") === "true",
          };

          const quantity = getValueByHeader("quantity");
          if (quantity) item.quantity = parseInt(quantity);

          const priority = getValueByHeader("priority");
          if (priority && ["low", "medium", "high"].includes(priority.toLowerCase())) {
            item.priority = priority.toLowerCase() as "low" | "medium" | "high";
          }

          const dueDate = getValueByHeader("due date");
          if (dueDate) {
            const parsedDate = new Date(dueDate);
            if (!isNaN(parsedDate.getTime())) {
              item.dueDate = parsedDate;
            }
          }

          const notes = getValueByHeader("notes");
          if (notes) item.notes = notes;

          const assignedTo = getValueByHeader("assigned to");
          if (assignedTo) item.assignedTo = assignedTo;

          const link = getValueByHeader("link") || getValueByHeader("links");
          if (link) {
            item.links = link.split(";").map(l => l.trim()).filter(l => l);
          }

          const tags = getValueByHeader("tags");
          if (tags) {
            item.attributes = { 
              ...item.attributes, 
              custom: { tags: tags } 
            };
          }

          items.push(item);
        }
      } else {
        // TXT format - parse formatted text
        let currentItem: Omit<ListItem, "id" | "order"> | null = null;
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Check if it's a new item (starts with □, ☐, -, *, or bullet)
          if (trimmedLine.match(/^[□☐\-\*•]\s+/)) {
            if (currentItem) items.push(currentItem);
            
            const itemText = trimmedLine.replace(/^[□☐\-\*•]\s+/, "").trim();
            currentItem = {
              text: itemText,
              completed: false,
            };
          } else if (currentItem) {
            // Parse item attributes
            if (trimmedLine.toLowerCase().startsWith("notes:")) {
              currentItem.notes = trimmedLine.substring(6).trim();
            } else if (trimmedLine.toLowerCase().startsWith("link:")) {
              const link = trimmedLine.substring(5).trim();
              currentItem.links = [link];
            } else if (trimmedLine.toLowerCase().startsWith("due:")) {
              const dateStr = trimmedLine.substring(4).trim();
              const parsedDate = new Date(dateStr);
              if (!isNaN(parsedDate.getTime())) {
                currentItem.dueDate = parsedDate;
              }
            } else if (trimmedLine.toLowerCase().startsWith("priority:")) {
              const priority = trimmedLine.substring(9).trim().toLowerCase();
              if (["low", "medium", "high"].includes(priority)) {
                currentItem.priority = priority as "low" | "medium" | "high";
              }
            } else if (trimmedLine.toLowerCase().startsWith("assigned:")) {
              currentItem.assignedTo = trimmedLine.substring(9).trim();
            } else if (trimmedLine.toLowerCase().startsWith("tags:")) {
              const tags = trimmedLine.substring(5).trim();
              currentItem.attributes = { 
                ...currentItem.attributes, 
                custom: { tags } 
              };
            }
          } else if (!trimmedLine.match(/^[□☐\-\*•]/)) {
            // Simple line without formatting
            items.push({
              text: trimmedLine,
              completed: false,
            });
          }
        }
        
        if (currentItem) items.push(currentItem);
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
        priority: item.priority,
        due_date: item.dueDate?.toISOString(),
        notes: item.notes,
        assigned_to: item.assignedTo,
        completed: item.completed || false,
        item_order: index,
        links: item.links,
        attributes: item.attributes,
      }));

      const itemsResult = (await withTimeout(
        supabase.from("list_items").insert(itemsToInsert),
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
      let filename = `${list.title}.${format}`;

      if (format === "csv") {
        // CSV with ALL fields
        content = "Item Name,Notes,Link,Due Date,Priority,Tags,Completed,Assigned To,Quantity\n";
        content += list.items
          .map((item) => {
            const tags = item.attributes?.custom?.tags || "";
            const links = item.links?.join(";") || "";
            const dueDate = item.dueDate ? item.dueDate.toISOString().split('T')[0] : "";
            
            return [
              `"${item.text.replace(/"/g, '""')}"`,
              `"${(item.notes || "").replace(/"/g, '""')}"`,
              `"${links}"`,
              `"${dueDate}"`,
              `"${item.priority || ""}"`,
              `"${tags}"`,
              `"${item.completed}"`,
              `"${item.assignedTo || ""}"`,
              `"${item.quantity || ""}"`
            ].join(",");
          })
          .join("\n");
        mimeType = "text/csv";
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "txt") {
        // TXT with formatted details
        content = `${list.title}\n`;
        content += `Category: ${list.category} | Type: ${list.listType}\n`;
        content += `Exported: ${new Date().toLocaleDateString()}\n`;
        content += "=".repeat(50) + "\n\n";
        
        content += list.items
          .map((item) => {
            let itemText = `${item.completed ? "☑" : "□"} ${item.text}`;
            if (item.quantity) itemText = `${item.quantity}x ${itemText}`;
            
            let details = "";
            if (item.notes) details += `\n  Notes: ${item.notes}`;
            if (item.links && item.links.length > 0) details += `\n  Link: ${item.links.join(", ")}`;
            if (item.dueDate) details += `\n  Due: ${item.dueDate.toLocaleDateString()}`;
            if (item.priority) details += `\n  Priority: ${item.priority}`;
            if (item.attributes?.custom?.tags) details += `\n  Tags: ${item.attributes.custom.tags}`;
            if (item.assignedTo) details += `\n  Assigned: ${item.assignedTo}`;
            
            return itemText + details;
          })
          .join("\n\n");
          
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "pdf") {
        // Generate actual PDF using html2pdf.js
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; padding: 40px; background: white;">
            <h1 style="color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 10px;">
              ${list.title}
            </h1>
            <div style="color: #666; margin-bottom: 20px; font-size: 14px;">
              <strong>Category:</strong> ${list.category} | 
              <strong>Type:</strong> ${list.listType} | 
              <strong>Items:</strong> ${list.items.length} | 
              <strong>Exported:</strong> ${new Date().toLocaleDateString()}
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <thead>
                <tr>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 5%;">✓</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 25%;">Item</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 20%;">Notes</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 10%;">Due Date</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 10%;">Priority</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 15%;">Assigned To</th>
                  <th style="background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; width: 15%;">Link</th>
                </tr>
              </thead>
              <tbody>
                ${list.items.map((item, index) => `
                  <tr style="${index % 2 === 0 ? 'background: #f9fafb;' : ''}">
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top;">${item.completed ? "☑" : "□"}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top; ${item.completed ? 'text-decoration: line-through; color: #999;' : ''}">
                      ${item.quantity ? `<strong>${item.quantity}x</strong> ` : ""}${item.text}
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top;">${item.notes || "-"}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top;">${item.dueDate ? item.dueDate.toLocaleDateString() : "-"}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top; ${
                      item.priority === 'high' ? 'color: #dc2626; font-weight: 600;' :
                      item.priority === 'medium' ? 'color: #f59e0b; font-weight: 600;' :
                      item.priority === 'low' ? 'color: #10b981;' : ''
                    }">${item.priority || "-"}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top;">${item.assignedTo || "-"}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; vertical-align: top;">${item.links && item.links.length > 0 ? item.links[0].substring(0, 30) + "..." : "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            
            <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
              Generated by ListMine • ${new Date().toLocaleString()}
            </div>
          </div>
        `;
        
        // Create temporary element
        const element = document.createElement("div");
        element.innerHTML = htmlContent;
        
        // Configure html2pdf options
        const opt = {
          margin: 10,
          filename: filename,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
        };
        
        // Generate and download PDF
        html2pdf().set(opt).from(element).save();
      }
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

  const importFromShareLink = async (shareId: string): Promise<string> => {
    if (!user) throw new Error("User not authenticated");

    try {
      // Fetch the shared list
      const listResult = (await withTimeout(
        supabase
          .from("lists")
          .select("*")
          .eq("share_link", shareId)
          .eq("is_shared", true)
          .single(),
      )) as any;
      const { data: sharedList, error: listError } = listResult;

      if (listError || !sharedList) {
        throw new Error("List not found or not shared. Please check the link and try again.");
      }

      // Fetch the list items
      const itemsResult = (await withTimeout(
        supabase
          .from("list_items")
          .select("*")
          .eq("list_id", sharedList.id)
          .order("item_order", { ascending: true }),
      )) as any;
      const { data: sharedItems, error: itemsError } = itemsResult;

      if (itemsError) throw itemsError;

      // Check list limit
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
          `You've reached your limit of ${user.listLimit} lists on the ${tierName} tier. Upgrade to import more lists.`,
        );
      }

      // Create a new list with "Copy of" prefix
      const newListTitle = `Copy of ${sharedList.title}`;
      const newListResult = (await withTimeout(
        supabase
          .from("lists")
          .insert({
            user_id: user.id,
            title: newListTitle,
            category: sharedList.category,
            list_type: sharedList.list_type,
          })
          .select()
          .single(),
      )) as any;
      const { data: newList, error: newListError } = newListResult;

      if (newListError) throw newListError;

      // Copy all items with completed = false
      if (sharedItems && sharedItems.length > 0) {
        const itemsToInsert = sharedItems.map((item: any, index: number) => ({
          list_id: newList.id,
          text: item.text,
          quantity: item.quantity,
          priority: item.priority,
          due_date: item.due_date,
          notes: item.notes,
          assigned_to: item.assigned_to,
          completed: false, // Fresh start
          item_order: index,
          links: item.links,
          attributes: item.attributes,
        }));

        const insertResult = (await withTimeout(
          supabase.from("list_items").insert(itemsToInsert),
        )) as any;
        const { error: insertError } = insertResult;

        if (insertError) throw insertError;
      }

      await loadLists();
      return newList.id;
    } catch (error: any) {
      logError("importFromShareLink", error, user?.id);

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
        error.message.includes("not found") ||
        error.message.includes("not shared")
      ) {
        throw error;
      } else if (error.message.includes("limit")) {
        throw error;
      } else {
        throw new Error("Couldn't import list. Try again or contact support.");
      }
    }
  };

  const importFromWishlist = async (
    items: Array<{ name: string; price?: string; link?: string; image?: string }>,
    listName: string,
    category: ListCategory = "Shopping",
  ): Promise<string> => {
    if (!user) throw new Error("User not authenticated");

    if (!items || items.length === 0) {
      throw new Error("No items to import");
    }

    const nameValidation = validateListName(listName);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    const categoryValidation = validateCategory(category);
    if (!categoryValidation.valid) {
      throw new Error(categoryValidation.error);
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
        `You've reached your limit of ${user.listLimit} lists on the ${tierName} tier. Upgrade to create more lists.`,
      );
    }

    try {
      const result = (await withTimeout(
        supabase
          .from("lists")
          .insert({
            user_id: user.id,
            title: nameValidation.value,
            category: categoryValidation.value,
            list_type: "shopping-list",
          })
          .select()
          .single(),
      )) as any;
      const { data: newList, error: listError } = result;

      if (listError) throw listError;

      const itemsToInsert = items.map((item, index) => ({
        list_id: newList.id,
        text: item.name,
        notes: item.price ? `Price: ${item.price}` : null,
        links: item.link ? [item.link] : null,
        completed: false,
        item_order: index,
        attributes: item.image ? { custom: { image: item.image } } : null,
      }));

      const itemsResult = (await withTimeout(
        supabase.from("list_items").insert(itemsToInsert),
      )) as any;
      const { error: itemsError } = itemsResult;

      if (itemsError) throw itemsError;

      await loadLists();
      return newList.id;
    } catch (error: any) {
      logError("importFromWishlist", error, user?.id);

      if (error.message === "Operation timed out") {
        throw new Error(
          "This is taking longer than expected. Try again in a moment.",
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Connection lost. Check your internet and try again.");
      } else if (error.message.includes("limit")) {
        throw error;
      } else {
        throw new Error("Couldn't import wishlist. Try again or contact support.");
      }
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
        importFromShareLink,
        importFromWishlist,
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