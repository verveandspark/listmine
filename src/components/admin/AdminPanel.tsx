"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MoreVertical,
  Mail,
  Lock,
  Trash2,
  AlertCircle,
  Check,
  LogOut,
  Loader2,
  Search,
  Download,
  HelpCircle,
  X,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  email: string;
  name: string;
  tier: string;
  is_admin: boolean;
  is_disabled?: boolean;
  created_at: string;
  role?: string;
  updated_at?: string;
}

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [reason, setReason] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    console.log("[Admin] useEffect triggered - calling fetchUsers");
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    console.log("[Admin] fetchUsers() called");
    try {
      setLoading(true);
      
      // First, check if the current user is an admin
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        console.error("[Admin] No authenticated user");
        throw new Error("Not authenticated");
      }
      
      // Check if user is admin
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", currentUser.id)
        .single();
      
      if (userError) {
        console.error("[Admin] Error checking admin status:", userError);
        throw userError;
      }
      
      const isAdmin = userData?.is_admin === true;
      console.log("[Admin] User is admin:", isAdmin);
      
      let data;
      let error;
      
      if (isAdmin) {
        // Admin: use the secure RPC function to fetch all users
        console.log("[Admin] Fetching all users via admin_get_all_users RPC...");
        const result = await supabase.rpc("admin_get_all_users");
        data = result.data;
        error = result.error;
      } else {
        // Non-admin: fetch only their own row
        console.log("[Admin] Non-admin - fetching only own user data...");
        const result = await supabase
          .from("users")
          .select("*")
          .eq("id", currentUser.id);
        data = result.data;
        error = result.error;
      }

      console.log("[Admin] Supabase response received");
      console.log("[Admin] Data:", data);
      console.log("[Admin] Error:", error);

      if (error) {
        console.error("[Admin] Supabase error thrown:", error);
        throw error;
      }
      
      // Sort by created_at descending
      const sortedData = (data || []).sort((a: User, b: User) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      console.log("[Admin] Setting users, count:", sortedData.length);
      setUsers(sortedData);
    } catch (error) {
      console.error("[Admin] Catch block - Error fetching users:", error);
    } finally {
      console.log("[Admin] Finally block - setting loading to false");
      setLoading(false);
    }
  };

  // Send Magic Login Link
  const handleSendMagicLink = async (email: string) => {
    try {
      setActionLoading(true);
      setErrorMessage("");
      
      // Use signInWithOtp which sends a magic link email
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          shouldCreateUser: false, // Don't create new user, just send link to existing
        },
      });
      
      if (error) throw error;
      setSuccessMessage(`Magic link sent to ${email}`);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error: any) {
      console.error("Error sending magic link:", error);
      setErrorMessage(`Failed to send magic link: ${error.message || "Unknown error"}`);
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      console.error("Error logging out:", error);
      setErrorMessage("Failed to logout. Please try again.");
      setTimeout(() => setErrorMessage(""), 5000);
      setLoggingOut(false);
    }
  };

  // Disable Account
  const handleDisableAccount = async (userId: string) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.rpc("disable_user_account", {
        target_user_id: userId,
        reason: reason || "Admin action",
      });
      if (error) throw error;
      setSuccessMessage("Account disabled");
      setShowConfirmDialog(false);
      setReason("");
      fetchUsers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error disabling account:", error);
      alert("Failed to disable account");
    } finally {
      setActionLoading(false);
    }
  };

  // Enable Account
  const handleEnableAccount = async (userId: string) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.rpc("enable_user_account", {
        target_user_id: userId,
      });
      if (error) throw error;
      setSuccessMessage("Account enabled");
      fetchUsers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error enabling account:", error);
      alert("Failed to enable account");
    } finally {
      setActionLoading(false);
    }
  };

  // Clear User Data
  const handleClearData = async (userId: string) => {
    try {
      setActionLoading(true);
      const { data, error } = await supabase.rpc("clear_user_data", {
        target_user_id: userId,
      });
      if (error) throw error;
      setSuccessMessage(
        `User data cleared. \${data.lists_deleted} lists deleted.`,
      );
      setShowConfirmDialog(false);
      fetchUsers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error clearing data:", error);
      alert("Failed to clear data");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Account
  const handleDeleteAccount = async (userId: string) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.rpc("delete_user_account", {
        target_user_id: userId,
      });
      if (error) throw error;
      setSuccessMessage("Account deleted permanently");
      setShowConfirmDialog(false);
      fetchUsers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Failed to delete account");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTierChange = async (userId: string, newTier: string) => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("users")
        .update({ tier: newTier })
        .eq("id", userId);
      if (error) throw error;
      setSuccessMessage(`Tier updated to ${newTier}`);
      await fetchUsers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error updating tier:", error);
      alert("Failed to update tier");
    } finally {
      setActionLoading(false);
    }
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter((user) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      searchQuery === "" ||
      user.email.toLowerCase().includes(searchLower) ||
      (user.name && user.name.toLowerCase().includes(searchLower));
    
    // Tier filter
    const matchesTier = tierFilter === "all" || user.tier === tierFilter;
    
    // Status filter
    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "active" && !user.is_disabled) ||
      (statusFilter === "disabled" && user.is_disabled);
    
    // Role filter
    const matchesRole = 
      roleFilter === "all" ||
      (roleFilter === "admin" && user.is_admin) ||
      (roleFilter === "user" && !user.is_admin);
    
    return matchesSearch && matchesTier && matchesStatus && matchesRole;
  });

  // Export users to CSV
  const handleExportCSV = () => {
    try {
      setExportLoading(true);
      
      // Define CSV headers
      const headers = ["Email", "Name", "Tier", "Role", "Status", "Created At"];
      
      // Map users to CSV rows
      const rows = filteredUsers.map((user) => [
        user.email,
        user.name || "",
        user.tier,
        user.is_admin ? "Admin" : "User",
        user.is_disabled ? "Disabled" : "Active",
        new Date(user.created_at).toLocaleDateString(),
      ]);
      
      // Combine headers and rows
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `users_export_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSuccessMessage(`Exported ${filteredUsers.length} users to CSV`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      setErrorMessage("Failed to export users to CSV");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setExportLoading(false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setTierFilter("all");
    setStatusFilter("all");
    setRoleFilter("all");
  };

  const hasActiveFilters = searchQuery !== "" || tierFilter !== "all" || statusFilter !== "all" || roleFilter !== "all";

  if (loading) {
    console.log("[Admin] Rendering loading state...");
    return (
      <div className="flex items-center justify-center p-8 min-h-[200px]">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-gray-600">Loading users...</span>
        </div>
      </div>
    );
  }

  console.log("[Admin] Rendering main content, users count:", users.length);

  return (
    <div className="space-y-6 p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Admin Panel</h1>
          <p className="text-gray-600 text-sm sm:text-base">Manage user tiers and accounts</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  disabled={exportLoading || filteredUsers.length === 0}
                  className="flex items-center gap-2 min-h-[44px]"
                >
                  {exportLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Export CSV</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export {filteredUsers.length} users to CSV file</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="rounded-lg bg-blue-50 px-3 sm:px-4 py-2">
            <span className="text-xs sm:text-sm font-medium text-blue-900">Admin</span>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 min-h-[44px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            {loggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 min-h-[44px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Filter Controls */}
          <div className="flex gap-2 flex-wrap">
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[130px] min-h-[44px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="even_better">Even Better</SelectItem>
                <SelectItem value="lots_more">Lots More</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] min-h-[44px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[120px] min-h-[44px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            
            {hasActiveFilters && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearFilters}
                      className="min-h-[44px] min-w-[44px]"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear all filters</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        
        {/* Filter Results Info */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>Showing {filteredUsers.length} of {users.length} users</span>
          </div>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800">
          <Check size={18} />
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800">
          <AlertCircle size={18} />
          {errorMessage}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-4 cursor-help">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600">Total Users</p>
                  <HelpCircle className="w-3 h-3 text-gray-400" />
                </div>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Total registered users in the system</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-4 cursor-help">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600">Free Tier</p>
                  <HelpCircle className="w-3 h-3 text-gray-400" />
                </div>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.tier === "free").length}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Users on the free tier plan</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-4 cursor-help">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600">Paid Users</p>
                  <HelpCircle className="w-3 h-3 text-gray-400" />
                </div>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.tier !== "free").length}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Users on any paid tier (Good, Even Better, Lots More)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-4 cursor-help">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600">Admins</p>
                  <HelpCircle className="w-3 h-3 text-gray-400" />
                </div>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.is_admin).length}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Users with admin privileges</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-lg border">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {hasActiveFilters ? (
              <div className="space-y-2">
                <p>No users match your filters</p>
                <Button variant="outline" onClick={clearFilters} className="min-h-[44px]">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <p>No users found</p>
            )}
          </div>
        ) : (
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold">
                Email
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold hidden sm:table-cell">
                Name
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold">
                Tier
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold hidden md:table-cell">
                Role
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold">
                Status
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold hidden lg:table-cell">
                Created
              </th>
              <th className="px-4 sm:px-6 py-3 text-right text-sm font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="px-4 sm:px-6 py-4 text-sm">
                  <div className="max-w-[150px] sm:max-w-none truncate">{user.email}</div>
                  <div className="sm:hidden text-xs text-gray-500 mt-1">{user.name}</div>
                </td>
                <td className="px-4 sm:px-6 py-4 text-sm hidden sm:table-cell">{user.name}</td>
                <td className="px-4 sm:px-6 py-4 text-sm">
                  <span className="inline-block rounded-full bg-blue-100 px-2 sm:px-3 py-1 text-xs font-medium text-blue-800">
                    {user.tier}
                  </span>
                </td>
                <td className="px-4 sm:px-6 py-4 text-sm hidden md:table-cell">
                  {user.is_admin ? (
                    <span className="inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">
                      Admin
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                      User
                    </span>
                  )}
                </td>
                <td className="px-4 sm:px-6 py-4 text-sm">
                  {user.is_disabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 sm:px-3 py-1 text-xs font-medium text-red-800">
                      <AlertCircle size={14} />
                      <span className="hidden sm:inline">Disabled</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 sm:px-3 py-1 text-xs font-medium text-green-800">
                      <Check size={14} />
                      <span className="hidden sm:inline">Active</span>
                    </span>
                  )}
                </td>
                <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 sm:px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <select
                            value={user.tier}
                            onChange={(e) =>
                              handleTierChange(user.id, e.target.value)
                            }
                            disabled={actionLoading}
                            className="rounded border px-2 py-1 text-sm min-h-[36px] cursor-pointer"
                          >
                            <option value="free">Free</option>
                            <option value="good">Good</option>
                            <option value="even_better">Even Better</option>
                            <option value="lots_more">Lots More</option>
                          </select>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Change user's subscription tier</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actionLoading}
                          className="min-h-[36px] min-w-[36px]"
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuItem
                          onClick={() => handleSendMagicLink(user.email)}
                          disabled={actionLoading}
                          className="min-h-[44px]"
                        >
                          <Mail size={14} className="mr-2" />
                          <div className="flex flex-col">
                            <span>Send Magic Login Link</span>
                            <span className="text-xs text-gray-500">Email a one-click login link</span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {user.is_disabled ? (
                          <DropdownMenuItem
                            onClick={() => handleEnableAccount(user.id)}
                            className="text-green-600 min-h-[44px]"
                            disabled={actionLoading}
                          >
                            <Lock size={14} className="mr-2" />
                            <div className="flex flex-col">
                              <span>Enable Account</span>
                              <span className="text-xs text-green-500">Allow user to log in again</span>
                            </div>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setActionType("disable");
                              setShowConfirmDialog(true);
                            }}
                            className="text-yellow-600 min-h-[44px]"
                            disabled={actionLoading}
                          >
                            <AlertCircle size={14} className="mr-2" />
                            <div className="flex flex-col">
                              <span>Disable Account</span>
                              <span className="text-xs text-yellow-500">Prevent user from logging in</span>
                            </div>
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user);
                            setActionType("clear_data");
                            setShowConfirmDialog(true);
                          }}
                          className="text-orange-600 min-h-[44px]"
                          disabled={actionLoading}
                        >
                          <Trash2 size={14} className="mr-2" />
                          <div className="flex flex-col">
                            <span>Clear All Data</span>
                            <span className="text-xs text-orange-500">Delete all lists (irreversible)</span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user);
                            setActionType("delete");
                            setShowConfirmDialog(true);
                          }}
                          className="text-red-600 min-h-[44px]"
                          disabled={actionLoading}
                        >
                          <Trash2 size={14} className="mr-2" />
                          <div className="flex flex-col">
                            <span>Delete Account</span>
                            <span className="text-xs text-red-500">Permanently remove user</span>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
          <AlertDialogTitle>
            {actionType === "disable" && "Disable Account?"}
            {actionType === "clear_data" && "Clear All User Data?"}
            {actionType === "delete" && "Delete Account Permanently?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {actionType === "disable" &&
              "This will prevent the user from logging in. They can be re-enabled later."}
            {actionType === "clear_data" &&
              "This will delete all lists and items for this user. This cannot be undone."}
            {actionType === "delete" &&
              "This will permanently delete the user account and all associated data. This cannot be undone."}
          </AlertDialogDescription>

          {actionType === "disable" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Violation of terms"
                className="w-full rounded border px-3 py-2 text-sm min-h-[44px]"
              />
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4">
            <AlertDialogCancel disabled={actionLoading} className="min-h-[44px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionType === "disable")
                  handleDisableAccount(selectedUser!.id);
                if (actionType === "clear_data")
                  handleClearData(selectedUser!.id);
                if (actionType === "delete")
                  handleDeleteAccount(selectedUser!.id);
              }}
              disabled={actionLoading}
              className={`min-h-[44px] ${
                actionType === "delete"
                  ? "bg-red-600 hover:bg-red-700"
                  : actionType === "clear_data"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : ""
              }`}
            >
              {actionLoading ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
