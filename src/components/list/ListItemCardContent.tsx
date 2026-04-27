/**
 * ListItemCardContent
 *
 * Shared item-card content used by both the non-sectioned item rows in ListDetail
 * and the sectioned rows in SectionedListView.  Renders:
 *   – quantity prefix (for shopping / registry / grocery)
 *   – item text (with strikethrough when completed/purchased)
 *   – notes line
 *   – meta-badge row  (Received · Unavailable · Status · Price · DueDate · AssignedTo)
 *   – attribute tags  (Color · Size · Weight · Unit)
 *   – priority / idea-status badge row
 *   – ItemLinkActions  (universal link strip)
 */

import React from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Flag,
  User as UserIcon,
} from "lucide-react";
import { ListItem as ListItemType } from "@/types";

// ─── helpers ────────────────────────────────────────────────────────────────

export const priorityColors: Record<string, string> = {
  low: "bg-success/10 text-success border-success/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  high: "bg-red-100 text-red-700 border-red-200",
};

export function getDueDateColor(dueDate: Date | string | undefined): string {
  if (!dueDate) return "";
  const date = new Date(dueDate);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "bg-red-100 text-red-700 border-red-200";
  if (diffDays < 3) return "bg-warning/10 text-warning border-warning/20";
  return "bg-success/10 text-success border-success/20";
}

function isTruthy(val: unknown): boolean {
  return val === true || val === "true" || val === "1" || val === 1;
}

export function isItemUnavailable(item: ListItemType): boolean {
  if ((item as any).is_unavailable === true) return true;
  if (item.attributes?.unavailable === true) return true;
  if (isTruthy((item.attributes?.custom as Record<string, unknown> | undefined)?.unavailable)) return true;
  return false;
}

// ─── props ───────────────────────────────────────────────────────────────────

export interface ListItemCardContentProps {
  item: ListItemType;

  /** Visual state – completed (checked-off) for this item */
  isPurchased: boolean;

  /** List-type flags */
  isRegistryOrWishlistType: boolean;
  isTodo: boolean;
  isIdea: boolean;
  isShoppingList: boolean;
  isGrocery: boolean;

  /** Notes renderer that wraps URLs as clickable links */
  renderNotesWithLinks: (notes: string) => React.ReactNode;

  /** Whether to render ItemLinkActions for this item */
  shouldShowItemLinks: (item: ListItemType) => boolean;

  /** The actual link-actions component, rendered if shouldShowItemLinks returns true */
  ItemLinkActionsComponent: React.ComponentType<{ item: ListItemType }>;

  /** Whether the item has extra link metadata (title/description/image) not shown inline */
  hasLinkDetails?: (item: ListItemType) => boolean;
}

// ─── component ───────────────────────────────────────────────────────────────

const ListItemCardContent: React.FC<ListItemCardContentProps> = ({
  item,
  isPurchased,
  isRegistryOrWishlistType,
  isTodo,
  isIdea,
  isShoppingList,
  isGrocery,
  renderNotesWithLinks,
  shouldShowItemLinks,
  ItemLinkActionsComponent,
  hasLinkDetails,
}) => {
  // Quantity prefix logic (mirrors VIEW 1 in ListDetail)
  const qty =
    item.quantity ||
    item.attributes?.quantityNeeded ||
    (isShoppingList || isRegistryOrWishlistType || isGrocery ? 1 : 0);
  const showQtyTypes = isShoppingList || isRegistryOrWishlistType || isGrocery;
  const showQty = showQtyTypes && qty && qty >= 1;

  return (
    <div className="flex flex-col gap-0.5 min-w-0 w-full">
      {/* ── Main text line ── */}
      <div className="flex items-start gap-1 min-w-0 w-full">
        <p
          className={`text-sm sm:text-base text-gray-900 transition-all duration-200 ${
            isPurchased ? "line-through opacity-50" : ""
          } break-words overflow-hidden flex-1`}
          style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
        >
          {showQty && (
            <span className="font-semibold text-primary">{qty}× </span>
          )}
          {item.text}
        </p>

      </div>

      {/* ── Notes ── */}
      {item.notes &&
        !(
          item.text.match(
            /^(Main idea|Supporting details|Action items|Follow-up needed|Resources\/links|Breakfast|Lunch|Dinner|Snack|Notes)$/
          ) ||
          item.notes.match(
            /^(Add meal|Add snack|Add idea|Add item|Ideas for next week)/
          )
        ) && (
          <p className="text-xs text-gray-500 -mt-0.5 break-words italic">
            {renderNotesWithLinks(item.notes)}
          </p>
        )}

      {/* ── First badge row: Received · Unavailable · Status · Price · DueDate · AssignedTo ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {isRegistryOrWishlistType &&
          item.attributes?.purchaseStatus === "received" && (
            <Badge className="bg-blue-100 text-blue-700 border-blue-300">
              ✓ Received
            </Badge>
          )}

        {isItemUnavailable(item) && (
          <Badge
            variant="outline"
            className="bg-gray-100 text-gray-600 border-gray-300"
          >
            Unavailable
          </Badge>
        )}

        {/* Status badge – todo / idea */}
        {(isTodo || (isIdea && item.attributes?.status_set_by_user === true)) && item.attributes?.status && (
          <Badge
            variant="outline"
            className={`text-xs ${
              item.attributes.status === "completed"
                ? "bg-success/10 text-success border-success/20"
                : item.attributes.status === "in-progress"
                ? "bg-warning/10 text-warning border-warning/20"
                : item.attributes.status === "brainstorm"
                ? "bg-purple-100 text-purple-700 border-purple-200"
                : item.attributes.status === "on-hold"
                ? "bg-gray-100 text-gray-600 border-gray-200"
                : "bg-primary/10 text-primary border-primary/20"
            }`}
          >
            <Clock className="w-3 h-3 mr-1" />
            {item.attributes.status === "not-started"
              ? "Not started"
              : item.attributes.status === "in-progress"
              ? "In progress"
              : item.attributes.status === "completed"
              ? "Completed"
              : item.attributes.status === "brainstorm"
              ? "Brainstorm"
              : item.attributes.status === "on-hold"
              ? "On hold"
              : item.attributes.status}
          </Badge>
        )}

        {/* Price */}
        {(item.attributes?.price || item.attributes?.custom?.price) && (
          <span className="text-sm font-medium text-gray-700">
            {(() => {
              const priceVal = String(
                item.attributes?.price || item.attributes?.custom?.price || ""
              );
              return priceVal.startsWith("$") ? priceVal : `$${priceVal}`;
            })()}
          </span>
        )}

        {/* Due date */}
        {item.dueDate && (
          <Badge
            variant="outline"
            className={`${getDueDateColor(item.dueDate)} flex items-center gap-1 text-xs`}
          >
            <Calendar className="w-3 h-3" />
            {format(new Date(item.dueDate), "MMM d")}
          </Badge>
        )}

        {/* AssignedTo */}
        {item.assignedTo && (
          <Badge variant="outline" className="text-xs">
            <UserIcon className="w-3 h-3 mr-1" />
            {item.assignedTo}
          </Badge>
        )}
      </div>

      {/* ── Attribute tags: Color · Size · Weight · Unit ── */}
      {item.attributes && (
        <div className="flex items-center gap-2 mt-1 flex-wrap pointer-events-none">
          {item.attributes.color && (
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-xs"
            >
              Color: {item.attributes.color}
            </Badge>
          )}
          {item.attributes.size && (
            <Badge
              variant="outline"
              className="bg-success/10 text-success border-success/20 text-xs"
            >
              Size: {item.attributes.size}
            </Badge>
          )}
          {item.attributes.weight && (
            <Badge
              variant="outline"
              className="bg-warning/10 text-warning border-warning/20 text-xs"
            >
              Weight: {item.attributes.weight}
            </Badge>
          )}
          {item.attributes.unit && (
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-xs"
            >
              {item.attributes.unit}
            </Badge>
          )}
        </div>
      )}

      {/* ── Priority / status second row ── */}
      {item.priority && (
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.priority && (
            <Badge
              variant="outline"
              className={`${priorityColors[item.priority] ?? ""} text-xs`}
            >
              <Flag className="w-3 h-3 mr-1" />
              {item.priority}
            </Badge>
          )}
        </div>
      )}

      {/* ── Item link actions ── */}
      {shouldShowItemLinks(item) && (
        <div className="mt-1">
          <ItemLinkActionsComponent item={item} />
        </div>
      )}
    </div>
  );
};

export default ListItemCardContent;
