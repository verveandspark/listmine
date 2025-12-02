import { Plus, Download, MessageSquare } from "lucide-react";
import { useLists } from "@/contexts/useListsHook";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckSquare,
  ShoppingCart,
  Lightbulb,
  Plane,
  ListChecks,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ListCategory } from "@/types";
import { useState } from "react";
import CreateListModal from "./CreateListModal";

const categoryIcons: Record<string, any> = {
  Tasks: CheckSquare,
  Groceries: ShoppingCart,
  Ideas: Lightbulb,
  Shopping: ShoppingCart,
  Travel: Plane,
  Work: CheckSquare,
  Home: CheckSquare,
  Other: ListChecks,
};

export function ListSidebar() {
  const { lists } = useLists();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Group lists by category
  const groupedLists = lists.reduce(
    (acc, list) => {
      if (!acc[list.category]) {
        acc[list.category] = [];
      }
      acc[list.category].push(list);
      return acc;
    },
    {} as Record<ListCategory, typeof lists>,
  );

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Lists</h2>
          <Badge variant="secondary">{lists.length}</Badge>
        </div>

        <div className="space-y-2 mb-4">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full bg-primary hover:bg-primary/90 text-white min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            New List
          </Button>

          <Button
            onClick={() => navigate("/import-export")}
            variant="outline"
            className="w-full min-h-[44px]"
          >
            <Download className="w-4 h-4 mr-2" />
            Import List
          </Button>
        </div>

        <div className="space-y-4">
          {Object.entries(groupedLists).map(([category, categoryLists]) => {
            const Icon = categoryIcons[category] || ListChecks;
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-700">
                    {category}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {categoryLists.length}
                  </Badge>
                </div>
                <div className="space-y-1 ml-6">
                  {categoryLists.map((list) => (
                    <Button
                      key={list.id}
                      variant={list.id === id ? "secondary" : "ghost"}
                      className={`w-full justify-between text-left h-auto py-2 ${
                        list.id === id ? "bg-primary/20 text-primary font-semibold" : ""
                      }`}
                      onClick={() => navigate(`/list/${list.id}`)}
                    >
                      <span className="truncate text-sm">{list.title}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {list.items.length}
                        </Badge>
                        {list.id === id && <ChevronRight className="w-4 h-4" />}
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback Button */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => window.open('https://forms.gle/9uQRYmrC8qC38Raj9', '_blank')}
                variant="outline"
                className="w-full border-primary text-primary hover:bg-primary/10 min-h-[44px]"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Beta Feedback
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Help us improve! Share your feedback or report bugs here.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <CreateListModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </div>
  );
}