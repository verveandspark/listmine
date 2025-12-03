import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/useAuthHook";
import { useLists } from "@/contexts/useListsHook";
import { resetOnboarding } from "@/components/onboarding/OnboardingTooltips";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  MessageSquare,
  RotateCcw,
  Pencil,
  Check,
  X,
  Lock,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const navigate = useNavigate();
  const { user, updateProfile, updateEmail, updatePassword } = useAuth();
  const { lists } = useLists();

  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Password change states
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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

  const handleEditName = () => {
    setEditName(user.name);
    setIsEditingName(true);
    setNameError(null);
    setNameSuccess(false);
  };

  const handleSaveName = async () => {
    if (!editName.trim()) {
      setNameError("Name cannot be empty");
      return;
    }

    setIsSavingName(true);
    setNameError(null);

    try {
      await updateProfile({ name: editName.trim() });
      setIsEditingName(false);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (error: any) {
      setNameError(error.message || "Failed to update name");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelName = () => {
    setIsEditingName(false);
    setEditName("");
    setNameError(null);
  };

  const handleEditEmail = () => {
    setEditEmail(user.email);
    setIsEditingEmail(true);
    setEmailError(null);
    setEmailSuccess(false);
  };

  const handleSaveEmail = async () => {
    if (!editEmail.trim()) {
      setEmailError("Email cannot be empty");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setIsSavingEmail(true);
    setEmailError(null);

    try {
      await updateEmail(editEmail.trim());
      setIsEditingEmail(false);
      setEmailSuccess(true);
      setTimeout(() => setEmailSuccess(false), 3000);
    } catch (error: any) {
      setEmailError(error.message || "Failed to update email");
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleCancelEmail = () => {
    setIsEditingEmail(false);
    setEditEmail("");
    setEmailError(null);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password");
      return;
    }

    if (!newPassword) {
      setPasswordError("Please enter a new password");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setIsChangingPassword(true);

    try {
      await updatePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (error: any) {
      setPasswordError(error.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const resetPasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10">
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
                {isEditingName ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        id="name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={isSavingName}
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleSaveName}
                        disabled={isSavingName}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        {isSavingName ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCancelName}
                        disabled={isSavingName}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    {nameError && (
                      <p className="text-sm text-red-600">{nameError}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input id="name" value={user.name} disabled />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleEditName}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {nameSuccess && (
                  <p className="text-sm text-green-600">Name updated successfully!</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                {isEditingEmail ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <Input
                        id="email"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        disabled={isSavingEmail}
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleSaveEmail}
                        disabled={isSavingEmail}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        {isSavingEmail ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCancelEmail}
                        disabled={isSavingEmail}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    {emailError && (
                      <p className="text-sm text-red-600">{emailError}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      A confirmation email will be sent to verify your new address.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <Input id="email" value={user.email} disabled />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleEditEmail}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {emailSuccess && (
                  <p className="text-sm text-green-600">
                    Email update initiated! Check your inbox to confirm.
                  </p>
                )}
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
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetPasswordModal();
                    setIsPasswordModalOpen(true);
                  }}
                  className="w-full sm:w-auto"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
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
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <p className="text-sm font-medium text-primary">
                      Total Lists
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <p className="text-3xl font-bold text-primary">{totalLists}</p>
              </div>

              <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-success" />
                    <p className="text-sm font-medium text-success">
                      Total Items
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-success" />
                </div>
                <p className="text-3xl font-bold text-success">
                  {totalItems}
                </p>
              </div>

              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <p className="text-sm font-medium text-accent">
                      Completed
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-accent" />
                </div>
                <p className="text-3xl font-bold text-accent">
                  {completedItems}
                </p>
              </div>

              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Pin className="w-5 h-5 text-warning" />
                    <p className="text-sm font-medium text-warning">
                      Pinned
                    </p>
                  </div>
                  <TrendingDown className="w-4 h-4 text-warning" />
                </div>
                <p className="text-3xl font-bold text-warning">
                  {pinnedLists}
                </p>
              </div>

              <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-secondary" />
                    <p className="text-sm font-medium text-secondary">Shared</p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-secondary" />
                </div>
                <p className="text-3xl font-bold text-secondary">
                  {sharedLists}
                </p>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-primary" />
                    <p className="text-sm font-medium text-primary">
                      Avg Items
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <p className="text-3xl font-bold text-primary">
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

        {/* Feedback Card */}
        <Card>
          <CardHeader>
            <CardTitle>Help Us Improve</CardTitle>
            <CardDescription>Share your feedback or report bugs</CardDescription>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => window.open('https://forms.gle/9uQRYmrC8qC38Raj9', '_blank')}
                    className="w-full bg-primary hover:bg-primary/90 text-white min-h-[44px]"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Submit Beta Feedback
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Help us improve! Share your feedback or report bugs here.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        {/* Onboarding Card */}
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Tour</CardTitle>
            <CardDescription>Replay the welcome tour anytime</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Click the button below, then navigate to the Dashboard to see the tour.
            </p>
            <Button
              onClick={() => {
                resetOnboarding();
                window.location.reload();
              }}
              variant="outline"
              className="w-full min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Replay Onboarding Tour
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Change Password Modal */}
      <Dialog
        open={isPasswordModalOpen}
        onOpenChange={(open) => {
          if (!open) resetPasswordModal();
          setIsPasswordModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[425px] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>

          {passwordSuccess ? (
            <div className="py-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-medium text-green-600">
                Password changed successfully!
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={isChangingPassword}
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isChangingPassword}
                      placeholder="Enter new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be at least 6 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isChangingPassword}
                      placeholder="Confirm new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                </div>

                {passwordError && (
                  <p className="text-sm text-red-600">{passwordError}</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={isChangingPassword}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    "Change Password"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}