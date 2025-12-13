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
  Archive,
  LayoutDashboard,
  Plus,
  Download,
  LogOut,
  MessageSquare,
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
import { useAuth } from "@/contexts/useAuthHook";

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
  const [showArchived, setShowArchived] = useState(false);
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  // Filter out archived lists unless showArchived is true
  const filteredLists = lists.filter((list) => {
    const isArchived = list.isArchived || list.title.startsWith("[Archived]");
    return showArchived || !isArchived;
  });

  // Count archived lists
  const archivedCount = lists.filter(
    (list) => list.isArchived || list.title.startsWith("[Archived]")
  ).length;

  // Group lists by category
  const groupedLists = filteredLists.reduce(
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
          <Badge variant="secondary">{filteredLists.length}</Badge>
        </div>

        {/* Dashboard Button */}
        <Button
          onClick={() => {
            localStorage.setItem("dashboardViewMode", "dashboard");
            navigate("/dashboard");
          }}
          variant="outline"
          className="w-full mb-4 min-h-[44px] border-primary/30 text-primary hover:bg-primary/10"
        >
          <LayoutDashboard className="w-4 h-4 mr-2" />
          Dashboard
        </Button>

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

        {/* Archived toggle */}
        {archivedCount > 0 && (
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start text-sm ${showArchived ? "text-primary" : "text-gray-500"}`}
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="w-4 h-4 mr-2" />
              {showArchived ? "Hide" : "Show"} archived ({archivedCount})
            </Button>
          </div>
        )}

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
                  {categoryLists.map((list) => {
                    const isArchived = list.isArchived || list.title.startsWith("[Archived]");
                    return (
                      <Button
                        key={list.id}
                        variant={list.id === id ? "secondary" : "ghost"}
                        className={`w-full justify-between text-left h-auto py-2 ${
                          list.id === id ? "bg-primary/20 text-primary font-semibold" : ""
                        } ${isArchived ? "opacity-60" : ""}`}
                        onClick={() => {
                          // Store the current list ID before navigating
                          localStorage.setItem("last_list_id", list.id);
                          navigate(`/list/${list.id}`);
                        }}
                      >
                        <span className={`truncate text-sm ${isArchived ? "italic" : ""}`}>
                          {list.title}
                        </span>
                        <div className="flex items-center gap-1">
                          {isArchived && <Archive className="w-3 h-3 text-gray-400" />}
                          <Badge variant="outline" className="text-xs">
                            {list.items.length}
                          </Badge>
                          {list.id === id && <ChevronRight className="w-4 h-4" />}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Logout and Feedback Buttons */}
      <div className="p-4 border-t border-gray-200 mt-auto space-y-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-100 min-h-[44px]"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sign out of your account</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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