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
} from "lucide-react";

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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [reason, setReason] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    console.log("[Admin] useEffect triggered - calling fetchUsers");
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    console.log("[Admin] fetchUsers() called");
    try {
      setLoading(true);
      console.log("[Admin] About to fetch users from Supabase...");
      
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("[Admin] Supabase response received");
      console.log("[Admin] Data:", data);
      console.log("[Admin] Error:", error);

      if (error) {
        console.error("[Admin] Supabase error thrown:", error);
        throw error;
      }
      console.log("[Admin] Setting users, count:", data?.length || 0);
      setUsers(data || []);
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
      const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `\${window.location.origin}/app`,
      });
      if (error) throw error;
      setSuccessMessage(`Magic link sent to \${email}`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error sending magic link:", error);
      alert("Failed to send magic link");
    } finally {
      setActionLoading(false);
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

  if (loading) {
    console.log("[Admin] Rendering loading state...");
    return <div className="p-8">Loading users...</div>;
  }

  console.log("[Admin] Rendering main content, users count:", users.length);

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-gray-600">Manage user tiers and accounts</p>
        </div>
        <div className="rounded-lg bg-blue-50 px-4 py-2">
          <span className="text-sm font-medium text-blue-900">Admin</span>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800">
          <Check size={18} />
          {successMessage}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-600">Total Users</p>
          <p className="text-2xl font-bold">{users.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-600">Free Tier</p>
          <p className="text-2xl font-bold">
            {users.filter((u) => u.tier === "free").length}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-600">Paid Users</p>
          <p className="text-2xl font-bold">
            {users.filter((u) => u.tier !== "free").length}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-600">Admins</p>
          <p className="text-2xl font-bold">
            {users.filter((u) => u.is_admin).length}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Email
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Name
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Tier
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Role
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Created
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">{user.email}</td>
                <td className="px-6 py-4 text-sm">{user.name}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                    {user.tier}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
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
                <td className="px-6 py-4 text-sm">
                  {user.is_disabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                      <AlertCircle size={14} />
                      Disabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                      <Check size={14} />
                      Active
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <select
                      value={user.tier}
                      onChange={(e) =>
                        handleTierChange(user.id, e.target.value)
                      }
                      disabled={actionLoading}
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="free">Free</option>
                      <option value="good">Good</option>
                      <option value="even_better">Even Better</option>
                      <option value="lots_more">Lots More</option>
                    </select>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actionLoading}
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          onClick={() => handleSendMagicLink(user.email)}
                          disabled={actionLoading}
                        >
                          <Mail size={14} className="mr-2" />
                          Send Magic Login Link
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {user.is_disabled ? (
                          <DropdownMenuItem
                            onClick={() => handleEnableAccount(user.id)}
                            className="text-green-600"
                            disabled={actionLoading}
                          >
                            <Lock size={14} className="mr-2" />
                            Enable Account
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setActionType("disable");
                              setShowConfirmDialog(true);
                            }}
                            className="text-yellow-600"
                            disabled={actionLoading}
                          >
                            <AlertCircle size={14} className="mr-2" />
                            Disable Account
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user);
                            setActionType("clear_data");
                            setShowConfirmDialog(true);
                          }}
                          className="text-orange-600"
                          disabled={actionLoading}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Clear All Data
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user);
                            setActionType("delete");
                            setShowConfirmDialog(true);
                          }}
                          className="text-red-600"
                          disabled={actionLoading}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Delete Account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
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
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="flex gap-3">
            <AlertDialogCancel disabled={actionLoading}>
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
              className={
                actionType === "delete"
                  ? "bg-red-600 hover:bg-red-700"
                  : actionType === "clear_data"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : ""
              }
            >
              {actionLoading ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
