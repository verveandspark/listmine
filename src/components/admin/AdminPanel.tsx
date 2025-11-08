import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/useAuthHook";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Search, Loader2, ArrowLeft, Crown, Shield } from "lucide-react";
import { format } from "date-fns";

interface User {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchEmail, setSearchEmail] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }

      console.log("Checking admin status for user:", user.id, user.email);

      const { data, error } = await supabase
        .from("users")
        .select("role, email")
        .eq("id", user.id)
        .single();

      console.log("Admin check result:", { data, error });

      if (error) {
        console.error("Error checking admin status:", error);
        toast({
          title: "⛔ Access Denied",
          description: "Failed to verify admin status.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      if (data?.role !== "admin") {
        console.log("User is not admin. Role:", data?.role);
        toast({
          title: "⛔ Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      console.log("User is admin, loading panel");
      fetchUsers();
    };

    checkAdmin();
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);
    console.log("Fetching all users...");
    
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    console.log("Fetch users result:", { 
      count: data?.length, 
      data, 
      error 
    });

    if (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "❌ Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } else {
      console.log(`Successfully fetched ${data?.length || 0} users`);
      setUsers(data || []);
      setFilteredUsers(data || []);
    }
    setLoading(false);
  };

  const handleSearch = (email: string) => {
    setSearchEmail(email);
    if (email.trim() === "") {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter((u) =>
        u.email.toLowerCase().includes(email.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  };

  const handleUpgradeTier = async (userId: string, newTier: string) => {
    setUpgrading(userId);

    // Get current user data
    const currentUser = users.find((u) => u.id === userId);
    if (!currentUser) {
      console.error("User not found:", userId);
      setUpgrading(null);
      return;
    }

    console.log("Updating tier:", {
      userId,
      userEmail: currentUser.email,
      oldTier: currentUser.tier,
      newTier,
    });

    // Update tier
    const { data, error: updateError } = await supabase
      .from("users")
      .update({ tier: newTier, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select();

    console.log("Update result:", { data, error: updateError });

    if (updateError) {
      console.error("Failed to update tier:", updateError);
      toast({
        title: "❌ Error",
        description: `Failed to update tier: ${updateError.message}`,
        variant: "destructive",
      });
      setUpgrading(null);
      return;
    }

    // Log the change (optional - ignore if table doesn't exist)
    const { error: logError } = await supabase
      .from("tier_change_logs")
      .insert({
        user_id: userId,
        admin_email: user?.email || "unknown",
        old_tier: currentUser.tier,
        new_tier: newTier,
      });

    if (logError) {
      console.warn("Failed to log tier change (table may not exist):", logError);
    }

    toast({
      title: "✅ Tier Updated",
      description: `User upgraded to ${getTierLabel(newTier)}`,
    });

    // Refresh users
    fetchUsers();
    setUpgrading(null);
  };

  const getTierLabel = (tier: string) => {
    const labels: Record<string, string> = {
      free: "Free",
      good: "Good",
      "even-better": "Even Better",
      "lots-more": "Lots More",
    };
    return labels[tier] || tier;
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      free: "bg-gray-100 text-gray-700 border-gray-300",
      good: "bg-blue-100 text-blue-700 border-blue-300",
      "even-better": "bg-primary/10 text-primary border-primary/30",
      "lots-more": "bg-yellow-100 text-yellow-700 border-yellow-300",
    };
    return colors[tier] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-6 h-6 text-primary" />
                  <h1 className="text-2xl font-bold text-gray-900">
                    Admin Panel
                  </h1>
                </div>
                <p className="text-sm text-gray-600">
                  Manage user tiers and accounts
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-primary/10 border-primary">
              <Crown className="w-3 h-3 mr-1" />
              Admin
            </Badge>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1"
            />
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-sm text-gray-600">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{users.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Free Tier</p>
            <p className="text-2xl font-bold text-gray-900">
              {users.filter((u) => u.tier === "free").length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Paid Users</p>
            <p className="text-2xl font-bold text-primary">
              {users.filter((u) => u.tier !== "free").length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Admins</p>
            <p className="text-2xl font-bold text-gray-900">
              {users.filter((u) => u.role === "admin").length}
            </p>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Current Tier</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <p className="text-gray-500">No users found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{u.name || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getTierColor(u.tier)}
                      >
                        {getTierLabel(u.tier)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.role === "admin" ? (
                        <Badge variant="outline" className="bg-primary/10 border-primary">
                          <Crown className="w-3 h-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="outline">User</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(u.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={u.tier}
                          onValueChange={(newTier) =>
                            handleUpgradeTier(u.id, newTier)
                          }
                          disabled={upgrading === u.id}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="even-better">
                              Even Better
                            </SelectItem>
                            <SelectItem value="lots-more">
                              Lots More
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {upgrading === u.id && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}