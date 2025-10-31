// Shared list view component - displays read-only lists via share link
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  ArrowLeft,
  Package,
  Calendar,
  Flag,
  StickyNote,
  Link as LinkIcon,
  User as UserIcon,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { isToday, isPast } from "date-fns";

interface SharedList {
  id: string;
  title: string;
  category: string;
  items: any[];
  tags?: string[] | null;
}

export default function SharedListView() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const [list, setList] = useState<SharedList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSharedList = async () => {
      try {
        if (!shareId) {
          setError("Invalid share link");
          return;
        }

        // Fetch list by share_link
        const { data: listDataArray, error: fetchError } = await supabase
          .from("lists")
          .select("*")
          .eq("share_link", shareId);

        if (fetchError || !listDataArray || listDataArray.length === 0) {
          setError("List not found or has been removed");
          setIsLoading(false);
          return;
        }

        const data = listDataArray[0];

        // Fetch items for this list
        const { data: itemsData, error: itemsError } = await supabase
          .from("items")
          .select("*")
          .eq("list_id", data.id)
          .order("order", { ascending: true });

        if (itemsError) {
          setError("Could not load items");
          setIsLoading(false);
          return;
        }

        setList({
          id: data.id,
          title: data.title,
          category: data.category,
          items: itemsData || [],
          tags: data.tags || [],
        });
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || "An error occurred");
        setIsLoading(false);
      }
    };

    fetchSharedList();
  }, [shareId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading shared list...</p>
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold mb-4 text-red-600">
            {error || "List not found"}
          </h2>
          <p className="text-gray-600 mb-6">
            This list may have been removed or the link is invalid.
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  const getDueDateColor = (dueDate: Date | undefined) => {
    if (!dueDate) return "";
    const date = new Date(dueDate);
    if (isToday(date)) return "text-orange-600 bg-orange-50 border-orange-200";
    if (isPast(date)) return "text-red-600 bg-red-50 border-red-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };

  const priorityColors = {
    low: "bg-green-100 text-green-700 border-green-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    high: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                {list.title}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                {list.category} · {list.items.length} items · Read-only
              </p>
            </div>
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto">
        {/* Tags Section */}
        {list.tags?.length && (
          <Card className="p-3 sm:p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {list.tags?.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Items List */}
        <div className="space-y-2">
          {list.items.length === 0 ? (
            <Card className="p-8 sm:p-16 text-center bg-gradient-to-br from-gray-50 to-white">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  This list is empty
                </h3>
                <p className="text-gray-600">
                  No items have been added to this list yet.
                </p>
              </div>
            </Card>
          ) : (
            list.items.map((item, index) => (
              <Card
                key={item.id}
                className={`p-3 sm:p-4 ${index % 2 === 1 ? "bg-gray-50" : "bg-white"}`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <Checkbox
                    checked={item.completed}
                    disabled
                    className="mt-1 h-6 w-6 md:h-[18px] md:w-[18px] rounded md:rounded-[3px] mr-3 md:mr-2 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={`text-sm sm:text-base text-gray-900 transition-all duration-200 ${item.completed ? "line-through opacity-50" : ""} break-words`}
                      >
                        {item.quantity && (
                          <span className="font-semibold text-blue-600">
                            {item.quantity}×{" "}
                          </span>
                        )}
                        {item.text}
                      </p>
                      {item.dueDate && (
                        <Badge
                          variant="outline"
                          className={`${getDueDateColor(item.dueDate)} flex items-center gap-1 text-xs`}
                        >
                          <Calendar className="w-3 h-3" />
                          {format(new Date(item.dueDate), "MMM d")}
                        </Badge>
                      )}
                      {item.assignedTo && (
                        <Badge variant="outline" className="text-xs">
                          <UserIcon className="w-3 h-3 mr-1" />
                          {item.assignedTo}
                        </Badge>
                      )}
                    </div>

                    {/* Attribute Tags */}
                    {item.attributes && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {item.attributes.color && (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                          >
                            Color: {item.attributes.color}
                          </Badge>
                        )}
                        {item.attributes.size && (
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200 text-xs"
                          >
                            Size: {item.attributes.size}
                          </Badge>
                        )}
                        {item.attributes.weight && (
                          <Badge
                            variant="outline"
                            className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                          >
                            Weight: {item.attributes.weight}
                          </Badge>
                        )}
                        {item.attributes.price && (
                          <Badge
                            variant="outline"
                            className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
                          >
                            ${item.attributes.price}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {item.priority && (
                        <Badge
                          variant="outline"
                          className={`${priorityColors[item.priority]} text-xs`}
                        >
                          <Flag className="w-3 h-3 mr-1" />
                          {item.priority}
                        </Badge>
                      )}
                      {item.notes && (
                        <Badge variant="outline" className="text-xs">
                          <StickyNote className="w-3 h-3 mr-1" />
                          Note
                        </Badge>
                      )}
                      {item.links && item.links.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          {item.links.length} link
                          {item.links.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>

                    {item.notes && !item.completed && (
                      <p className="text-xs sm:text-sm text-gray-600 mt-2 break-words">
                        {item.notes}
                      </p>
                    )}

                    {item.links && item.links.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.links.map((link: string, idx: number) => (
                          <a
                            key={idx}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm text-blue-600 hover:underline flex items-center gap-1 break-all"
                          >
                            <LinkIcon className="w-3 h-3 flex-shrink-0" />
                            {link}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Sign Up CTA */}
        <Card className="mt-8 p-6 sm:p-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <div className="text-center max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Like this list?
            </h3>
            <p className="text-gray-600 mb-4">
              Sign up to create your own lists and import this one.
            </p>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Sign Up Free
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
