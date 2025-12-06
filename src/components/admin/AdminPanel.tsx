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
  History,
  KeyRound,
  UserCog,
  Send,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface AuditLog {
  id: string;
  admin_id: string;
  admin_email: string;
  admin_name: string;
  action_type: string;
  target_user_id: string | null;
  target_user_email: string | null;
  details: Record<string, any>;
  created_at: string;
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
  
  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogPage, setAuditLogPage] = useState(0);
  const [auditLogFilter, setAuditLogFilter] = useState<string>("all");
  
  // Password reset state
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  
  // Impersonation state
  const [showImpersonateDialog, setShowImpersonateDialog] = useState(false);
  const [impersonateUser, setImpersonateUser] = useState<User | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  
  // Active tab
  const [activeTab, setActiveTab] = useState("users");

  useEffect(() => {
    console.log("[Admin] useEffect triggered - calling fetchUsers");
    fetchUsers();
  }, []);

  // Refetch audit logs when filter or page changes
  useEffect(() => {
    if (showAuditLog) {
      fetchAuditLogs();
    }
  }, [auditLogFilter, auditLogPage]);

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
      
      const user = users.find(u => u.email === email);
      
      // Use signInWithOtp which sends a magic link email
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          shouldCreateUser: false, // Don't create new user, just send link to existing
        },
      });
      
      if (error) throw error;
      
      // Log the action
      await logAdminAction("magic_link_sent", user?.id, email);
      
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
      const user = users.find(u => u.id === userId);
      const { error } = await supabase.rpc("disable_user_account", {
        target_user_id: userId,
        reason: reason || "Admin action",
      });
      if (error) throw error;
      
      // Log the action
      await logAdminAction("account_disabled", userId, user?.email, { reason: reason || "Admin action" });
      
      setSuccessMessage(`Account disabled successfully for ${user?.email || "user"}`);
      setShowConfirmDialog(false);
      setSelectedUser(null);
      setReason("");
      fetchUsers();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error: any) {
      console.error("Error disabling account:", error);
      setErrorMessage(`Failed to disable account: ${error.message || "Unknown error"}`);
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  // Enable Account (Re-activate)
  const handleEnableAccount = async (userId: string) => {
    try {
      setActionLoading(true);
      const user = users.find(u => u.id === userId);
      const { error } = await supabase.rpc("enable_user_account", {
        target_user_id: userId,
      });
      if (error) throw error;
      
      // Log the action
      await logAdminAction("account_enabled", userId, user?.email);
      
      setSuccessMessage(`Account re-activated successfully for ${user?.email || "user"}`);
      setShowConfirmDialog(false);
      setSelectedUser(null);
      fetchUsers();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error: any) {
      console.error("Error enabling account:", error);
      setErrorMessage(`Failed to re-activate account: ${error.message || "Unknown error"}`);
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  // Clear User Data
  const handleClearData = async (userId: string) => {
    try {
      setActionLoading(true);
      const user = users.find(u => u.id === userId);
      const { data, error } = await supabase.rpc("clear_user_data", {
        target_user_id: userId,
      });
      if (error) throw error;
      
      // Log the action
      await logAdminAction("data_cleared", userId, user?.email, { lists_deleted: data?.lists_deleted });
      
      setSuccessMessage(
        `User data cleared for ${user?.email || "user"}. ${data?.lists_deleted || 0} lists deleted.`,
      );
      setShowConfirmDialog(false);
      setSelectedUser(null);
      fetchUsers();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error: any) {
      console.error("Error clearing data:", error);
      setErrorMessage(`Failed to clear data: ${error.message || "Unknown error"}`);
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Account
  const handleDeleteAccount = async (userId: string) => {
    try {
      setActionLoading(true);
      const user = users.find(u => u.id === userId);
      const { error } = await supabase.rpc("delete_user_account", {
        target_user_id: userId,
      });
      if (error) throw error;
      
      // Log the action
      await logAdminAction("account_deleted", userId, user?.email);
      
      setSuccessMessage(`Account deleted permanently for ${user?.email || "user"}`);
      setShowConfirmDialog(false);
      setSelectedUser(null);
      fetchUsers();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error: any) {
      console.error("Error deleting account:", error);
      setErrorMessage(`Failed to delete account: ${error.message || "Unknown error"}`);
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTierChange = async (userId: string, newTier: string) => {
    try {
      setActionLoading(true);
      const user = users.find(u => u.id === userId);
      const oldTier = user?.tier;
      const { error } = await supabase
        .from("users")
        .update({ tier: newTier })
        .eq("id", userId);
      if (error) throw error;
      
      // Log the action
      await logAdminAction("tier_changed", userId, user?.email, { old_tier: oldTier, new_tier: newTier });
      
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

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      setAuditLogsLoading(true);
      const { data, error } = await supabase.rpc("get_admin_audit_logs", {
        p_limit: 50,
        p_offset: auditLogPage * 50,
        p_action_type: auditLogFilter === "all" ? null : auditLogFilter,
      });
      
      if (error) throw error;
      
      // Parse details from JSON string to object if needed
      // Supabase Json type can be string | number | boolean | null | object
      const rawLogs = data || [];
      const parsedLogs: AuditLog[] = rawLogs.map((log: {
        id: string;
        admin_id: string;
        admin_email: string;
        admin_name: string;
        action_type: string;
        target_user_id: string | null;
        target_user_email: string | null;
        details: unknown;
        created_at: string;
      }) => {
        let parsedDetails: Record<string, any> = {};
        const rawDetails = log.details;
        
        if (rawDetails) {
          if (typeof rawDetails === 'string') {
            try {
              parsedDetails = JSON.parse(rawDetails);
            } catch {
              parsedDetails = { raw: rawDetails };
            }
          } else if (typeof rawDetails === 'object' && rawDetails !== null && !Array.isArray(rawDetails)) {
            parsedDetails = rawDetails as Record<string, any>;
          }
        }
        
        return {
          id: log.id,
          admin_id: log.admin_id,
          admin_email: log.admin_email || '',
          admin_name: log.admin_name || '',
          action_type: log.action_type,
          target_user_id: log.target_user_id,
          target_user_email: log.target_user_email,
          details: parsedDetails,
          created_at: log.created_at,
        };
      });
      
      setAuditLogs(parsedLogs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      setErrorMessage("Failed to load audit logs");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  // Log admin action helper
  const logAdminAction = async (
    actionType: string,
    targetUserId?: string,
    targetUserEmail?: string,
    details?: Record<string, any>
  ) => {
    try {
      await supabase.rpc("log_admin_action", {
        p_action_type: actionType,
        p_target_user_id: targetUserId || null,
        p_target_user_email: targetUserEmail || null,
        p_details: details || {},
      });
    } catch (error) {
      console.error("Error logging admin action:", error);
    }
  };

  // Handle password reset
  const handlePasswordReset = async (email: string) => {
    try {
      setActionLoading(true);
      setErrorMessage("");
      
      // Send password reset email via Supabase Auth
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      // Log the action
      await logAdminAction(
        "password_reset_sent",
        passwordResetUser?.id,
        email,
        { initiated_by: "admin" }
      );
      
      setSuccessMessage(`Password reset email sent to ${email}`);
      setShowPasswordResetDialog(false);
      setPasswordResetUser(null);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error: any) {
      console.error("Error sending password reset:", error);
      setErrorMessage(`Failed to send password reset: ${error.message || "Unknown error"}`);
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle resend welcome email (magic link for new/inactive users)
  const handleResendWelcomeEmail = async (email: string, userId: string) => {
    try {
      setActionLoading(true);
      setErrorMessage("");
      
      // Send magic link as welcome email
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          shouldCreateUser: false,
        },
      });
      
      if (error) throw error;
      
      // Log the action
      await logAdminAction(
        "welcome_email_resent",
        userId,
        email,
        { initiated_by: "admin" }
      );
      
      setSuccessMessage(`Welcome email sent to ${email}`);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error: any) {
      console.error("Error sending welcome email:", error);
      setErrorMessage(`Failed to send welcome email: ${error.message || "Unknown error"}`);
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle user impersonation
  const handleImpersonateUser = async (user: User) => {
    try {
      setImpersonating(true);
      setErrorMessage("");
      
      // Get current admin session
      const { data: { session } } = await supabase.auth.getSession();
      const adminEmail = session?.user?.email;
      
      if (!adminEmail) {
        throw new Error("Admin session not found");
      }
      
      // Log the impersonation action
      await logAdminAction(
        "user_impersonation_started",
        user.id,
        user.email,
        { admin_action: "impersonate", admin_email: adminEmail }
      );
      
      // Store admin session info in localStorage for return
      localStorage.setItem("admin_return_session", JSON.stringify({
        adminId: session.user.id,
        adminEmail: adminEmail,
        targetUserId: user.id,
        targetUserEmail: user.email,
        timestamp: new Date().toISOString(),
      }));
      
      // Send magic link to the target user's email
      // Note: Supabase Auth requires the magic link to go to the target user's email
      // The admin will need to coordinate with the user to get the link
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/app?impersonated=true`,
          shouldCreateUser: false,
        },
      });
      
      if (error) throw error;
      
      setSuccessMessage(`Impersonation link sent to ${user.email}. Please ask the user to share the magic link from their email, or access their email directly to click the link and log in as them.`);
      setShowImpersonateDialog(false);
      setImpersonateUser(null);
      setTimeout(() => setSuccessMessage(""), 12000);
    } catch (error: any) {
      console.error("Error impersonating user:", error);
      setErrorMessage(`Failed to impersonate user: ${error.message || "Unknown error"}`);
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setImpersonating(false);
    }
  };

  // Format action type for display
  const formatActionType = (actionType: string): string => {
    return actionType
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Get action type color
  const getActionTypeColor = (actionType: string): string => {
    if (actionType.includes("delete")) return "bg-red-100 text-red-800";
    if (actionType.includes("disable")) return "bg-yellow-100 text-yellow-800";
    if (actionType.includes("enable")) return "bg-green-100 text-green-800";
    if (actionType.includes("tier")) return "bg-blue-100 text-blue-800";
    if (actionType.includes("impersonation")) return "bg-purple-100 text-purple-800";
    return "bg-gray-100 text-gray-800";
  };

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
                  onClick={() => {
                    setShowAuditLog(true);
                    fetchAuditLogs();
                  }}
                  className="flex items-center gap-2 min-h-[44px]"
                >
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">Audit Log</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View admin action history</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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

                        <DropdownMenuItem
                          onClick={() => {
                            setPasswordResetUser(user);
                            setShowPasswordResetDialog(true);
                          }}
                          disabled={actionLoading}
                          className="min-h-[44px]"
                        >
                          <KeyRound size={14} className="mr-2" />
                          <div className="flex flex-col">
                            <span>Reset Password</span>
                            <span className="text-xs text-gray-500">Send password reset email</span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => handleResendWelcomeEmail(user.email, user.id)}
                          disabled={actionLoading}
                          className="min-h-[44px]"
                        >
                          <Send size={14} className="mr-2" />
                          <div className="flex flex-col">
                            <span>Resend Welcome Email</span>
                            <span className="text-xs text-gray-500">For new or inactive users</span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => {
                            setImpersonateUser(user);
                            setShowImpersonateDialog(true);
                          }}
                          disabled={actionLoading || user.is_admin}
                          className="min-h-[44px] text-purple-600"
                        >
                          <UserCog size={14} className="mr-2" />
                          <div className="flex flex-col">
                            <span>Login as User</span>
                            <span className="text-xs text-purple-500">Send link to user's email</span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {user.is_disabled ? (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setActionType("enable");
                              setShowConfirmDialog(true);
                            }}
                            className="text-green-600 min-h-[44px]"
                            disabled={actionLoading}
                          >
                            <Lock size={14} className="mr-2" />
                            <div className="flex flex-col">
                              <span>Re-activate Account</span>
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
            {actionType === "enable" && "Re-activate Account?"}
            {actionType === "disable" && "Disable Account?"}
            {actionType === "clear_data" && "Clear All User Data?"}
            {actionType === "delete" && "Delete Account Permanently?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {actionType === "enable" &&
              "This will re-activate the user's account and allow them to log in again."}
            {actionType === "disable" &&
              "This will prevent the user from logging in. They can be re-enabled later."}
            {actionType === "clear_data" &&
              "This will delete all lists and items for this user. This cannot be undone."}
            {actionType === "delete" &&
              "This will permanently delete the user account and all associated data. This cannot be undone."}
          </AlertDialogDescription>

          {actionType === "enable" && selectedUser && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-600">User to re-activate</p>
              <p className="font-medium text-green-800">{selectedUser.email}</p>
              {selectedUser.name && (
                <p className="text-sm text-green-600">{selectedUser.name}</p>
              )}
            </div>
          )}

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
                if (actionType === "enable")
                  handleEnableAccount(selectedUser!.id);
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
                    : actionType === "enable"
                      ? "bg-green-600 hover:bg-green-700"
                      : ""
              }`}
            >
              {actionLoading ? "Processing..." : actionType === "enable" ? "Re-activate" : "Confirm"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordResetDialog} onOpenChange={setShowPasswordResetDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Reset User Password
            </DialogTitle>
            <DialogDescription>
              Send a password reset email to this user. They will receive a link to create a new password.
            </DialogDescription>
          </DialogHeader>
          {passwordResetUser && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">User</p>
                <p className="font-medium">{passwordResetUser.email}</p>
                {passwordResetUser.name && (
                  <p className="text-sm text-gray-500">{passwordResetUser.name}</p>
                )}
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPasswordResetDialog(false);
                    setPasswordResetUser(null);
                  }}
                  disabled={actionLoading}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handlePasswordReset(passwordResetUser.email)}
                  disabled={actionLoading}
                  className="min-h-[44px]"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Reset Email
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Impersonation Dialog */}
      <Dialog open={showImpersonateDialog} onOpenChange={setShowImpersonateDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-600">
              <UserCog className="w-5 h-5" />
              Login as User
            </DialogTitle>
            <DialogDescription>
              Send a magic link to impersonate this user for troubleshooting purposes.
            </DialogDescription>
          </DialogHeader>
          {impersonateUser && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-600">Target User</p>
                <p className="font-medium">{impersonateUser.email}</p>
                {impersonateUser.name && (
                  <p className="text-sm text-purple-500">{impersonateUser.name}</p>
                )}
                <p className="text-xs text-purple-400 mt-2">Tier: {impersonateUser.tier}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">How it works</p>
                    <p>A magic link will be sent to <strong>the user's email ({impersonateUser.email})</strong>. To log in as this user, you'll need to either:</p>
                    <ul className="list-disc ml-4 mt-1 space-y-1">
                      <li>Ask the user to share the magic link with you</li>
                      <li>Access the user's email directly (if authorized)</li>
                    </ul>
                    <p className="mt-2 text-xs text-yellow-600">This action is logged for security purposes.</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowImpersonateDialog(false);
                    setImpersonateUser(null);
                  }}
                  disabled={impersonating}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleImpersonateUser(impersonateUser)}
                  disabled={impersonating}
                  className="min-h-[44px] bg-purple-600 hover:bg-purple-700"
                >
                  {impersonating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Send Link to User's Email
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Audit Log Dialog */}
      <Dialog open={showAuditLog} onOpenChange={setShowAuditLog}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Admin Audit Log
            </DialogTitle>
            <DialogDescription>
              View history of all admin actions for accountability and tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Audit Log Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Select value={auditLogFilter} onValueChange={(value) => {
                setAuditLogFilter(value);
                setAuditLogPage(0);
              }}>
                <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="tier_changed">Tier Changes</SelectItem>
                  <SelectItem value="account_disabled">Account Disabled</SelectItem>
                  <SelectItem value="account_enabled">Account Enabled</SelectItem>
                  <SelectItem value="password_reset_sent">Password Resets</SelectItem>
                  <SelectItem value="user_impersonation_started">Impersonations</SelectItem>
                  <SelectItem value="welcome_email_resent">Welcome Emails</SelectItem>
                  <SelectItem value="data_cleared">Data Cleared</SelectItem>
                  <SelectItem value="account_deleted">Account Deleted</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={fetchAuditLogs}
                disabled={auditLogsLoading}
                className="min-h-[44px]"
              >
                {auditLogsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-2 hidden sm:inline">Refresh</span>
              </Button>
            </div>

            {/* Audit Log Table */}
            <ScrollArea className="h-[400px] rounded-lg border">
              {auditLogsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No audit logs found
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 rounded-lg border">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionTypeColor(log.action_type)}`}>
                            {formatActionType(log.action_type)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm">
                        <p>
                          <span className="text-gray-500">Admin:</span>{" "}
                          <span className="font-medium">{log.admin_email || "Unknown"}</span>
                        </p>
                        {log.target_user_email && (
                          <p>
                            <span className="text-gray-500">Target:</span>{" "}
                            <span className="font-medium">{log.target_user_email}</span>
                          </p>
                        )}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Details: {JSON.stringify(log.details)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setAuditLogPage(Math.max(0, auditLogPage - 1))}
                disabled={auditLogPage === 0 || auditLogsLoading}
                className="min-h-[44px]"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-500">Page {auditLogPage + 1}</span>
              <Button
                variant="outline"
                onClick={() => {
                  setAuditLogPage(auditLogPage + 1);
                  fetchAuditLogs();
                }}
                disabled={auditLogs.length < 50 || auditLogsLoading}
                className="min-h-[44px]"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
