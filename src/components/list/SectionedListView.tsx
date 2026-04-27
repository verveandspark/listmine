import React from "react";
import { ListItem as ListItemType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import ListItemCardContent from "@/components/list/ListItemCardContent";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  GripVertical,
  Pencil,
  Trash2,
  Check,
  X,
  Edit,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SectionedListViewProps {
  // Section data
  getSortedSections: string[];
  getGroupedSectionItems: Record<string, ListItemType[]>;

  // Section drag state
  draggedSection: string | null;
  dropTargetSection: string | null;
  sectionDropPosition: "before" | "after" | null;

  // Section edit state
  editingSectionName: string | null;
  editedSectionValue: string;
  setEditedSectionValue: (v: string) => void;
  setDeletingSectionName: (name: string | null) => void;
  setShowDeleteSectionDialog: (v: boolean) => void;

  // Section drag handlers
  handleSectionDragStart: (e: React.DragEvent, sectionName: string) => void;
  handleSectionDragOver: (e: React.DragEvent, sectionName: string) => void;
  handleSectionDragLeave: (e: React.DragEvent) => void;
  handleSectionDrop: (e: React.DragEvent, sectionName: string) => void;
  handleSectionDragEnd: (e: React.DragEvent) => void;

  // Section edit handlers
  handleStartEditSection: (sectionName: string) => void;
  handleSaveEditedSection: () => void;
  handleCancelEditSection: () => void;

  // Item state
  isSelectMode: boolean;
  selectedItems: Set<string>;
  toggleItemSelection: (itemId: string) => void;
  itemSortBy: string;
  draggedItem: ListItemType | null;
  dropTargetId: string | null;
  dropPosition: "before" | "after" | null;
  itemToDelete: string | null;
  setItemToDelete: (id: string | null) => void;

  // Item flags
  canEditListItems: boolean;
  showCompletionCheckbox: boolean;
  isRegistryOrWishlistType: boolean;
  isTodo: boolean;
  isIdea: boolean;
  isShoppingList: boolean;
  isGrocery: boolean;

  // Item link helpers (passed from ListDetail where they have closure access)
  shouldShowItemLinks: (item: ListItemType) => boolean;
  ItemLinkActionsComponent: React.ComponentType<{ item: ListItemType }>;

  // Item drag handlers
  handleDragStart: (e: React.DragEvent, item: ListItemType) => void;
  handleDragOver: (e: React.DragEvent, item: ListItemType) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, item: ListItemType) => void;
  handleDragEnd: (e: React.DragEvent) => void;

  // Item action handlers
  updateListItem: (
    listId: string,
    itemId: string,
    updates: Partial<ListItemType>
  ) => void;
  handleOwnerPurchaseRecord: (
    listId: string,
    itemId: string,
    purchased: boolean
  ) => void;
  deleteListItem: (listId: string, itemId: string) => Promise<void>;
  restoreListItem: (listId: string, itemData: ListItemType) => Promise<void>;
  executeWithUndo: (
    key: string,
    data: any,
    action: () => Promise<void>,
    undo: (data: any) => Promise<void>,
    messages: { title: string; description: string; undoDescription: string }
  ) => Promise<void>;

  // Edit item modal handlers
  setEditingItem: (item: ListItemType | null) => void;
  setOriginalItemLinks: (links: string[] | null) => void;
  setLinkFieldTouched: (v: boolean) => void;
  setDueDateInput: (v: string) => void;
  setIsEditModalOpen: (v: boolean) => void;

  // Render helper
  renderNotesWithLinks: (notes: string) => React.ReactNode;

  // List id (for item mutations)
  listId: string;
}

const SectionedListView: React.FC<SectionedListViewProps> = ({
  getSortedSections,
  getGroupedSectionItems,
  draggedSection,
  dropTargetSection,
  sectionDropPosition,
  editingSectionName,
  editedSectionValue,
  setEditedSectionValue,
  setDeletingSectionName,
  setShowDeleteSectionDialog,
  handleSectionDragStart,
  handleSectionDragOver,
  handleSectionDragLeave,
  handleSectionDrop,
  handleSectionDragEnd,
  handleStartEditSection,
  handleSaveEditedSection,
  handleCancelEditSection,
  isSelectMode,
  selectedItems,
  toggleItemSelection,
  itemSortBy,
  draggedItem,
  dropTargetId,
  dropPosition,
  itemToDelete,
  setItemToDelete,
  canEditListItems,
  showCompletionCheckbox,
  isRegistryOrWishlistType,
  isTodo,
  isIdea,
  isShoppingList,
  isGrocery,
  shouldShowItemLinks,
  ItemLinkActionsComponent,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDragEnd,
  updateListItem,
  handleOwnerPurchaseRecord,
  deleteListItem,
  restoreListItem,
  executeWithUndo,
  setEditingItem,
  setOriginalItemLinks,
  setLinkFieldTouched,
  setDueDateInput,
  setIsEditModalOpen,
  renderNotesWithLinks,
  listId,
}) => {
  return (
    <>
      {getSortedSections.map((sectionName) => {
        const sectionItems = getGroupedSectionItems[sectionName];
        if (!sectionItems) return null;

        const isSectionDropTarget = dropTargetSection === sectionName;

        return (
          <div key={sectionName} className="space-y-2 mb-4 relative">
            {/* Section drop indicator - before */}
            {isSectionDropTarget && sectionDropPosition === "before" && (
              <div className="absolute -top-2 left-0 right-0 h-1 bg-primary rounded-full z-10 animate-pulse" />
            )}

            {/* Section Header with edit functionality */}
            <div
              className={`flex items-center gap-2 mt-4 mb-2 ${
                draggedSection === sectionName ? "opacity-50" : ""
              } ${
                isSectionDropTarget
                  ? "ring-2 ring-primary/30 rounded-md p-1 -m-1"
                  : ""
              }`}
              draggable={canEditListItems && editingSectionName !== sectionName}
              onDragStart={(e) =>
                canEditListItems && handleSectionDragStart(e, sectionName)
              }
              onDragOver={(e) =>
                canEditListItems && handleSectionDragOver(e, sectionName)
              }
              onDragLeave={(e) =>
                canEditListItems && handleSectionDragLeave(e)
              }
              onDrop={(e) =>
                canEditListItems && handleSectionDrop(e, sectionName)
              }
              onDragEnd={(e) =>
                canEditListItems && handleSectionDragEnd(e)
              }
            >
              {editingSectionName === sectionName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editedSectionValue}
                    onChange={(e) => setEditedSectionValue(e.target.value)}
                    className="h-8 text-sm font-semibold uppercase tracking-wide"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveEditedSection();
                      } else if (e.key === "Escape") {
                        handleCancelEditSection();
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={handleSaveEditedSection}
                  >
                    <Check className="w-4 h-4 text-success" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={handleCancelEditSection}
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </Button>
                </div>
              ) : (
                <>
                  {canEditListItems && (
                    <div
                      className="cursor-grab active:cursor-grabbing touch-none"
                      title="Drag to reorder sections"
                    >
                      <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </div>
                  )}
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {sectionName}
                  </h3>
                  {canEditListItems && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                        onClick={() => handleStartEditSection(sectionName)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      {/* Only show delete if there's more than one section */}
                      {Object.keys(getGroupedSectionItems).length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-50 hover:opacity-100 hover:text-red-600"
                          onClick={() => {
                            setDeletingSectionName(sectionName);
                            setShowDeleteSectionDialog(true);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
              <div className="flex-1 h-px bg-border"></div>
              <Badge variant="outline" className="text-xs">
                {sectionItems.length}
              </Badge>
            </div>

            {/* Section drop indicator - after */}
            {isSectionDropTarget && sectionDropPosition === "after" && (
              <div className="absolute -bottom-2 left-0 right-0 h-1 bg-primary rounded-full z-10 animate-pulse" />
            )}

            {/* Section Items */}
            {sectionItems.map((item, index) => {
              const isPurchased =
                isRegistryOrWishlistType &&
                (item.attributes?.purchaseStatus === "purchased" ||
                  item.attributes?.purchaseStatus === "received");
              const isDropTarget = dropTargetId === item.id;

              return (
                <div key={item.id} className="relative">
                  {/* Drop indicator - before */}
                  {isDropTarget &&
                    dropPosition === "before" &&
                    itemSortBy === "manual" && (
                      <div className="absolute -top-1 left-0 right-0 h-1 bg-primary rounded-full z-10 animate-pulse" />
                    )}
                  <Card
                    className={`p-1.5 sm:p-2 hover:shadow-md transition-all relative ${
                      index % 2 === 1 ? "bg-gray-50" : "bg-white"
                    } ${
                      isPurchased ? "border-success/20 bg-success/5" : ""
                    } ${
                      draggedItem?.id === item.id
                        ? "animate-drag-lift border-primary border-2 opacity-50"
                        : ""
                    } ${
                      isDropTarget && itemSortBy === "manual"
                        ? "ring-2 ring-primary/30"
                        : ""
                    }`}
                    draggable={itemSortBy === "manual" && canEditListItems}
                    onDragStart={(e) => {
                      const target = e.target as HTMLElement | null;
                      if (target?.closest("a")) return;
                      itemSortBy === "manual" &&
                        canEditListItems &&
                        handleDragStart(e, item);
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement | null;
                      if (target?.closest("a")) return;
                    }}
                    onMouseDown={(e) => {
                      const target = e.target as HTMLElement | null;
                      if (target?.closest("a")) return;
                    }}
                    onDragOver={(e) =>
                      itemSortBy === "manual" && handleDragOver(e, item)
                    }
                    onDragLeave={(e) =>
                      itemSortBy === "manual" && handleDragLeave(e)
                    }
                    onDrop={(e) =>
                      itemSortBy === "manual" && handleDrop(e, item)
                    }
                    onDragEnd={(e) =>
                      itemSortBy === "manual" && handleDragEnd(e)
                    }
                  >
                    <div className="flex items-center gap-2 sm:gap-3 w-full">
                      {isSelectMode && (
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => toggleItemSelection(item.id)}
                          className="h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0"
                        />
                      )}
                      {itemSortBy === "manual" && (
                        <div className="cursor-grab active:cursor-grabbing touch-none" title="Drag to reorder items">
                          <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                        </div>
                      )}
                      {showCompletionCheckbox && (
                        <Checkbox
                          checked={
                            isRegistryOrWishlistType
                              ? isPurchased
                              : item.completed
                          }
                          onCheckedChange={(checked) => {
                            const isChecked = checked as boolean;
                            let attributeUpdate: Record<string, any> = {};
                            if (isTodo) {
                              attributeUpdate = {
                                status: isChecked ? "completed" : undefined,
                              };
                            } else if (isRegistryOrWishlistType) {
                              if (isChecked) {
                                attributeUpdate = {
                                  purchaseStatus: "purchased",
                                };
                              } else {
                                const current =
                                  item.attributes?.purchaseStatus;
                                attributeUpdate = {
                                  purchaseStatus:
                                    current === "received"
                                      ? "purchased"
                                      : "not-purchased",
                                };
                              }
                            } else if (isShoppingList) {
                              attributeUpdate = {
                                purchaseStatus: isChecked
                                  ? "purchased"
                                  : "not-purchased",
                              };
                            }
                            updateListItem(listId, item.id, {
                              completed: isChecked,
                              ...(Object.keys(attributeUpdate).length > 0
                                ? {
                                    attributes: {
                                      ...item.attributes,
                                      ...attributeUpdate,
                                    },
                                  }
                                : {}),
                            });
                            // Sync owner purchase record for registry/wishlist
                            if (isRegistryOrWishlistType && isChecked) {
                              handleOwnerPurchaseRecord(
                                listId,
                                item.id,
                                true
                              );
                            } else if (
                              isRegistryOrWishlistType &&
                              !isChecked &&
                              item.attributes?.purchaseStatus !== "received"
                            ) {
                              handleOwnerPurchaseRecord(
                                listId,
                                item.id,
                                false
                              );
                            }
                          }}
                          className={`mt-1 h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0 transition-transform ${
                            (
                              isRegistryOrWishlistType
                                ? isPurchased
                                : item.completed
                            )
                              ? "animate-check-bounce"
                              : ""
                          }`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          {/* ── Shared item card content (qty, text, notes, badges) ── */}
                          <div className="flex-1 min-w-0">
                            <ListItemCardContent
                              item={item}
                              isPurchased={isPurchased}
                              isRegistryOrWishlistType={isRegistryOrWishlistType}
                              isTodo={isTodo}
                              isIdea={isIdea}
                              isShoppingList={isShoppingList}
                              isGrocery={isGrocery}
                              renderNotesWithLinks={renderNotesWithLinks}
                              shouldShowItemLinks={shouldShowItemLinks}
                              ItemLinkActionsComponent={ItemLinkActionsComponent}
                            />
                          </div>
                          {/* ── Edit / Delete buttons ── */}
                          {canEditListItems && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setOriginalItemLinks(item.links ?? null);
                                  setLinkFieldTouched(false);
                                  if (item.dueDate) {
                                    const d =
                                      typeof item.dueDate === "string"
                                        ? item.dueDate
                                        : new Date(item.dueDate)
                                            .toISOString()
                                            .split("T")[0];
                                    setDueDateInput(d);
                                  } else {
                                    setDueDateInput("");
                                  }
                                  setIsEditModalOpen(true);
                                }}
                                className="p-1 text-gray-500 hover:text-primary transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <AlertDialog
                                open={itemToDelete === item.id}
                                onOpenChange={(open) =>
                                  !open && setItemToDelete(null)
                                }
                              >
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setItemToDelete(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Are you sure?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this
                                      item? You can undo this action for a
                                      few seconds after deletion.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-muted hover:bg-primary/10">
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={async () => {
                                        const itemData = { ...item };
                                        const itemText = item.text;
                                        await executeWithUndo(
                                          `delete-item-${item.id}`,
                                          itemData,
                                          async () => {
                                            await deleteListItem(
                                              listId,
                                              item.id
                                            );
                                          },
                                          async (data) => {
                                            await restoreListItem(
                                              listId,
                                              data
                                            );
                                          },
                                          {
                                            title: "Item deleted",
                                            description: `"${itemText}" removed from list`,
                                            undoDescription: `"${itemText}" has been restored`,
                                          }
                                        );
                                        setItemToDelete(null);
                                      }}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                  {/* Drop indicator - after */}
                  {isDropTarget &&
                    dropPosition === "after" &&
                    itemSortBy === "manual" && (
                      <div className="absolute -bottom-1 left-0 right-0 h-1 bg-primary rounded-full z-10 animate-pulse" />
                    )}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
};

export default SectionedListView;
