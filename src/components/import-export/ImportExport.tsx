import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLists } from "@/contexts/useListsHook";
import { ListCategory, ListType } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Upload,
  Download,
  FileText,
  FileSpreadsheet,
  HelpCircle,
  Link2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { validateImportData, validateCategory } from "@/lib/validation";

const listTypes: { value: ListType; label: string }[] = [
  { value: "task-list", label: "Task List" },
  { value: "todo-list", label: "To-Do List" },
  { value: "registry-list", label: "Registry List" },
  { value: "checklist", label: "Checklist" },
  { value: "grocery-list", label: "Grocery List" },
  { value: "shopping-list", label: "Shopping List" },
  { value: "idea-list", label: "Idea List" },
  { value: "multi-topic", label: "Multi-Topic" },
  { value: "compare-contrast", label: "Compare & Contrast" },
  { value: "pro-con", label: "Pro/Con List" },
  { value: "multi-option", label: "Multi-Option" },
  { value: "custom", label: "Custom" },
];

export default function ImportExport() {
  const navigate = useNavigate();
  const { importList, exportList, lists, importFromShareLink } = useLists();
  const { toast } = useToast();
  const [importData, setImportData] = useState("");
  const [importCategory, setImportCategory] = useState<ListCategory>("Tasks");
  const [importListType, setImportListType] = useState<ListType>("custom");
  const [importFormat, setImportFormat] = useState<"csv" | "txt">("txt");
  const [selectedListId, setSelectedListId] = useState("");
  const [exportFormat, setExportFormat] = useState<"csv" | "txt" | "pdf">(
    "txt",
  );
  const [shareUrl, setShareUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = () => {
    // Validate import data
    const dataValidation = validateImportData(importData);
    if (!dataValidation.valid) {
      toast({
        title: "⚠️ Invalid import data",
        description: dataValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Validate category
    const categoryValidation = validateCategory(importCategory);
    if (!categoryValidation.valid) {
      toast({
        title: "⚠️ Invalid category",
        description: categoryValidation.error,
        variant: "destructive",
      });
      return;
    }

    try {
      importList(
        dataValidation.value!,
        importFormat,
        importCategory,
        importListType,
      );
      toast({
        title: "✅ List imported successfully!",
        description: "Your list has been added to your dashboard",
        className: "bg-green-50 border-green-200",
      });
      setImportData("");
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "❌ Import failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const extractShareId = (url: string): string | null => {
    try {
      const trimmedUrl = url.trim();
      
      if (trimmedUrl.includes("/shared/")) {
        const parts = trimmedUrl.split("/shared/");
        return parts[1]?.split(/[?#]/)[0] || null;
      }
      
      if (!trimmedUrl.includes("/") && !trimmedUrl.includes("http")) {
        return trimmedUrl;
      }
      
      return null;
    } catch {
      return null;
    }
  };

  const handleImportFromShareLink = async () => {
    if (!shareUrl.trim()) {
      toast({
        title: "⚠️ Invalid share link",
        description: "Please enter a share link or ID",
        variant: "destructive",
      });
      return;
    }

    const shareId = extractShareId(shareUrl);
    if (!shareId) {
      toast({
        title: "⚠️ Invalid share link format",
        description: "Please paste the full URL or share ID.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      const newListId = await importFromShareLink(shareId);
      
      toast({
        title: "✅ List imported successfully!",
        description: "The list has been added to your account.",
        className: "bg-green-50 border-green-200",
      });
      
      setShareUrl("");
      navigate(`/list/${newListId}`);
    } catch (err: any) {
      toast({
        title: "❌ Import failed",
        description: err.message || "Failed to import list",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validExtensions = [".txt", ".csv"];
    const fileExtension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: "⚠️ Invalid file type",
        description:
          "We couldn't read this file. Make sure it's a valid CSV or TXT file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      toast({
        title: "⚠️ File too large",
        description: "File must be less than 1MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;

      // Validate content
      const validation = validateImportData(content);
      if (!validation.valid) {
        toast({
          title: "⚠️ Invalid file content",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }

      setImportData(content);
    };
    reader.onerror = () => {
      toast({
        title: "❌ Failed to read file",
        description:
          "We couldn't read this file. Try again, or contact support if the problem continues.",
        variant: "destructive",
      });
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    if (!selectedListId) {
      toast({
        title: "⚠️ No list selected",
        description: "Please select a list to export",
        variant: "destructive",
      });
      return;
    }

    try {
      exportList(selectedListId, exportFormat);
      toast({
        title: "✅ List exported successfully!",
        description: `${exportFormat.toUpperCase()} file downloaded`,
        className: "bg-green-50 border-green-200",
      });
    } catch (error: any) {
      toast({
        title: "❌ Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const categories: ListCategory[] = [
    "Tasks",
    "Groceries",
    "Ideas",
    "Shopping",
    "Travel",
    "Work",
    "Home",
    "Other",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Import & Export
              </h1>
              <p className="text-sm text-gray-600">Manage your list data</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="w-4 h-4 mr-2" />
              Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="mt-6 space-y-6">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Link2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Import from ListMine Share Link
                </h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-5 h-5 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Paste a share link from another ListMine user to create a copy in your account
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Copy lists shared by other ListMine users
              </p>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="share-url">Share Link or ID</Label>
                  <Input
                    id="share-url"
                    placeholder="https://listmine.vercel.app/shared/abc123 or abc123"
                    value={shareUrl}
                    onChange={(e) => setShareUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isImporting) {
                        handleImportFromShareLink();
                      }
                    }}
                    className="min-h-[44px] mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    You can paste the full URL or just the share ID
                  </p>
                </div>

                <Button 
                  onClick={handleImportFromShareLink} 
                  className="w-full min-h-[44px]"
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Import from Share Link
                    </>
                  )}
                </Button>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Import List from File
                </h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-5 h-5 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Import items from a CSV or TXT file, or paste them
                        directly
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Upload a file or paste your list below
              </p>

              <div className="space-y-4">
                <div>
                  <Label>Upload File</Label>
                  <Input
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleFileUpload}
                    className="min-h-[44px] mt-2"
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">
                      Or paste text
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Paste Items</Label>
                    <p className="text-xs text-gray-500">
                      Paste one item per line. We'll create them all at once.
                    </p>
                  </div>
                  <Textarea
                    placeholder="Example:&#10;Buy milk&#10;Call dentist&#10;Pack sunscreen"
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    <strong>Example:</strong>
                    <br />
                    Buy milk
                    <br />
                    Call dentist
                    <br />
                    Pack sunscreen
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Format</Label>
                    <Select
                      value={importFormat}
                      onValueChange={(value) =>
                        setImportFormat(value as "csv" | "txt")
                      }
                    >
                      <SelectTrigger className="min-h-[44px] mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="txt">Text (.txt)</SelectItem>
                        <SelectItem value="csv">CSV (.csv)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Category</Label>
                    <Select
                      value={importCategory}
                      onValueChange={(value) =>
                        setImportCategory(value as ListCategory)
                      }
                    >
                      <SelectTrigger className="min-h-[44px] mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>List Type</Label>
                  <Select
                    value={importListType}
                    onValueChange={(value) =>
                      setImportListType(value as ListType)
                    }
                  >
                    <SelectTrigger className="min-h-[44px] mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {listTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleImport} className="w-full min-h-[44px]">
                  <Upload className="w-4 h-4 mr-2" />
                  Import List
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Export List</CardTitle>
                <CardDescription>
                  Export your list to CSV, TXT, or PDF format for backup or
                  sharing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Select List</Label>
                  <Select
                    value={selectedListId}
                    onValueChange={setSelectedListId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a list to export" />
                    </SelectTrigger>
                    <SelectContent>
                      {lists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.title} ({list.category}) - {list.items.length}{" "}
                          items
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select
                    value={exportFormat}
                    onValueChange={(value) =>
                      setExportFormat(value as "csv" | "txt" | "pdf")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="txt">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-2" />
                          Text File (.txt)
                        </div>
                      </SelectItem>
                      <SelectItem value="csv">
                        <div className="flex items-center">
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          CSV File (.csv)
                        </div>
                      </SelectItem>
                      <SelectItem value="pdf">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-2" />
                          PDF File (.pdf)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedListId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      <strong>Preview:</strong> The selected list will be
                      exported with all items, quantities, links, and
                      attributes.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleExport}
                  className="w-full"
                  disabled={!selectedListId}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export List
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}