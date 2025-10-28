import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/useAuthHook";
import { useLists } from "@/contexts/useListsHook";
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
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  ListChecks,
  Crown,
  TrendingUp,
  TrendingDown,
  FileText,
  Package,
  CheckCircle,
  Pin,
  Share2,
} from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lists } = useLists();

  if (!user) {
    navigate("/");
    return null;
  }

  const totalLists = lists.length;
  const totalItems = lists.reduce((sum, list) => sum + list.items.length, 0);
  const completedItems = lists.reduce(
    (sum, list) => sum + list.items.filter((item) => item.completed).length,
    0,
  );
  const pinnedLists = lists.filter((list) => list.isPinned).length;
  const sharedLists = lists.filter((list) => list.isShared).length;

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
              <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
              <p className="text-sm text-gray-600">
                Manage your account and view statistics
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                <User className="w-10 h-10 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {user.name}
                </h2>
                <p className="text-gray-600">{user.email}</p>
                {user.tier === "premium" ? (
                  <div className="mt-2 space-y-2">
                    <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 text-base px-4 py-1">
                      <Crown className="w-4 h-4 mr-2" />
                      Premium Member
                    </Badge>
                    <div>
                      <Button variant="outline" size="sm" className="mt-2">
                        Manage Subscription
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Badge variant="secondary" className="mt-2">
                    Free Tier
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={user.name} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <Input id="email" value={user.email} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="joined">Member Since</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <Input
                    id="joined"
                    value={format(new Date(user.createdAt), "MMMM d, yyyy")}
                    disabled
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Account Limits</CardTitle>
            <CardDescription>Your current plan limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Lists</p>
                  <p className="text-sm font-medium text-gray-900">
                    {totalLists} / {user.listLimit}
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      totalLists >= user.listLimit * 0.9
                        ? "bg-red-500"
                        : "bg-primary"
                    }`}
                    style={{
                      width: `${Math.min((totalLists / user.listLimit) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    Items per List Limit
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {user.itemsPerListLimit}
                  </p>
                </div>
              </div>

              {user.tier === "free" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-900 mb-3">
                    Upgrade to Premium for higher limits and advanced features!
                  </p>
                  <Button
                    onClick={() => navigate("/upgrade")}
                    size="sm"
                    className="w-full"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Premium
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
            <CardDescription>Your list management activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <p className="text-sm font-medium text-blue-900">
                      Total Lists
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-blue-600">{totalLists}</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-green-900">
                      Total Items
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {totalItems}
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-purple-600" />
                    <p className="text-sm font-medium text-purple-900">
                      Completed
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-3xl font-bold text-purple-600">
                  {completedItems}
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Pin className="w-5 h-5 text-orange-600" />
                    <p className="text-sm font-medium text-orange-900">
                      Pinned
                    </p>
                  </div>
                  <TrendingDown className="w-4 h-4 text-orange-400" />
                </div>
                <p className="text-3xl font-bold text-orange-600">
                  {pinnedLists}
                </p>
              </div>

              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-pink-600" />
                    <p className="text-sm font-medium text-pink-900">Shared</p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-pink-600" />
                </div>
                <p className="text-3xl font-bold text-pink-600">
                  {sharedLists}
                </p>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-indigo-600" />
                    <p className="text-sm font-medium text-indigo-900">
                      Avg Items
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-3xl font-bold text-indigo-600">
                  {totalLists > 0 ? Math.round(totalItems / totalLists) : 0}
                </p>
              </div>
            </div>

            {totalItems > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    Completion Rate
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {Math.round((completedItems / totalItems) * 100)}%
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-primary h-3 rounded-full transition-all"
                    style={{ width: `${(completedItems / totalItems) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
