import { Plus, Download } from "lucide-react";
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
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
                        list.id === id ? "bg-blue-50 text-blue-900" : ""
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

      <CreateListModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </div>
  );
}