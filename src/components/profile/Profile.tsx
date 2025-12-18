import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/useAuthHook";
import { useLists } from "@/contexts/useListsHook";
import { resetOnboarding } from "@/components/onboarding/OnboardingTooltips";
import { getTierDisplayName, getAvailableListTypes, ALL_LIST_TYPES, canHaveTeamMembers, canShareLists, canInviteGuests, type UserTier } from "@/lib/tierUtils";
import TeamManagement from "@/components/team/TeamManagement";
import GuestManagement from "@/components/list/GuestManagement";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Star,
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
  ChevronDown,
  Upload,
  Download,
  Users,
  Camera,
} from "lucide-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";

export default function Profile() {
  const navigate = useNavigate();
  const { user, updateProfile, updateEmail, updatePassword, updateAvatar } = useAuth();
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

  // Avatar upload states
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  
  // Plan features collapsible state
  const [isPlanFeaturesOpen, setIsPlanFeaturesOpen] = useState(false);
  const [isTeamManagementOpen, setIsTeamManagementOpen] = useState(false);
  const [isGuestManagementOpen, setIsGuestManagementOpen] = useState(false);
  const [selectedListForGuests, setSelectedListForGuests] = useState<string | null>(null);

  if (!user) {
    navigate("/");
    return null;
  }

  // Calculate stats from lists - use cached data if available
  // Count only owned active lists (exclude guest access and archived)
  const totalLists = Math.max(0, lists.filter(
    (l) => l.userId === user.id && !l.isGuestAccess && !l.isArchived && !l.title.startsWith("[Archived]")
  ).length);
  const totalItems = Math.max(0, lists.reduce((sum, list) => sum + (list.items?.length || 0), 0));
  const completedItems = Math.max(0, lists.reduce(
    (sum, list) => sum + (list.items?.filter((item) => item.completed).length || 0),
    0,
  ));
  const favoriteLists = Math.max(0, lists.filter((list) => list.isFavorite).length);
  const sharedLists = Math.max(0, lists.filter((list) => list.isShared).length);

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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setAvatarError(null);
    setAvatarSuccess(false);
    setUploadProgress(0);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 100);

    try {
      await updateAvatar(file);
      setUploadProgress(100);
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
    } catch (error: any) {
      setAvatarError(error.message || "Failed to upload avatar");
    } finally {
      clearInterval(progressInterval);
      setIsUploadingAvatar(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 animate-in fade-in duration-200">
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
              <div className="relative group">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary hover:ring-offset-2"
                  onClick={handleAvatarClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAvatarClick()}
                  aria-label="Change profile picture"
                >
                  {user.avatarUrl ? (
                    <img 
                      src={user.avatarUrl} 
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary flex items-center justify-center">
                      <User className="w-10 h-10 text-primary-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                  aria-label="Upload profile picture"
                />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {user.name}
                </h2>
                <p className="text-gray-600">{user.email}</p>
                {avatarError && (
                  <p className="text-sm text-red-600 mt-1">{avatarError}</p>
                )}
                {avatarSuccess && (
                  <p className="text-sm text-accent mt-1">Profile picture updated!</p>
                )}
                {isUploadingAvatar && (
                  <div className="mt-2 w-32">
                    <Progress value={uploadProgress} className="h-1" />
                  </div>
                )}
                {user.tier !== "free" ? (
                  <div className="mt-2 space-y-2">
                    <Badge className="bg-gradient-to-r from-accent to-accent/90 text-white text-base px-4 py-1">
                      <Crown className="w-4 h-4 mr-2" />
                      {getTierDisplayName(user.tier)} Tier
                    </Badge>
                    <div>
                      <Button variant="outline" size="sm" className="mt-2">
                        Manage Subscription
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Badge variant="secondary" className="mt-2">
                    {getTierDisplayName(user.tier)} Tier
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
                        className="text-accent hover:text-accent hover:bg-accent/10"
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
                  <p className="text-sm text-accent">Name updated successfully!</p>
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
                        className="text-accent hover:text-accent hover:bg-accent/10"
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
                  <p className="text-sm text-accent">
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
            <CardDescription>Your current plan limits and features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Plan Features Summary */}
              <Collapsible open={isPlanFeaturesOpen} onOpenChange={setIsPlanFeaturesOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-primary" />
                      What's included in your {getTierDisplayName(user.tier as UserTier)} plan?
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isPlanFeaturesOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  {/* List Types */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ListChecks className="w-4 h-4 text-primary" />
                      <h4 className="font-semibold text-sm">Available List Types</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ALL_LIST_TYPES.map((listType) => {
                        const available = getAvailableListTypes(user.tier as UserTier).includes(listType.value);
                        return (
                          <Badge 
                            key={listType.value} 
                            variant={available ? "default" : "secondary"}
                            className={available ? "" : "opacity-50"}
                          >
                            {available && <Check className="w-3 h-3 mr-1" />}
                            {listType.label}
                          </Badge>
                        );
                      })}
                    </div>
                    {user.tier === "free" && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Upgrade to unlock Grocery, Idea, Registry, and Wishlist templates
                      </p>
                    )}
                    {user.tier === "good" && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Upgrade to Even Better for Registry & Wishlist templates
                      </p>
                    )}
                  </div>

                  {/* Collaboration Features */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-primary" />
                      <h4 className="font-semibold text-sm">Collaboration</h4>
                    </div>
                    <ul className="space-y-2 text-sm">
                      {user.tier === "free" && (
                        <li className="flex items-start gap-2 text-muted-foreground">
                          <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>Collaboration not available on Free plan</span>
                        </li>
                      )}
                      {user.tier === "good" && (
                        <>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                            <span>Share read-only links</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Button
                              variant="link"
                              className="p-0 h-auto text-primary"
                              onClick={() => navigate("/dashboard")}
                            >
                              <Share2 className="w-4 h-4 mr-1" />
                              Manage Shared Lists
                            </Button>
                          </li>
                        </>
                      )}
                      {user.tier === "even_better" && (
                        <>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                            <span>Share read-only links</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                            <span>Invite up to 2 guests to edit</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Button
                              variant="link"
                              className="p-0 h-auto text-primary"
                              onClick={() => navigate("/dashboard")}
                            >
                              <Share2 className="w-4 h-4 mr-1" />
                              Manage Shared Lists
                            </Button>
                          </li>
                          <li className="flex items-start gap-2">
                            <Button
                              variant="link"
                              className="p-0 h-auto text-primary"
                              onClick={() => {
                                const sharedList = lists.find(l => l.isShared && l.userId === user.id);
                                if (sharedList) {
                                  setSelectedListForGuests(sharedList.id);
                                  setIsGuestManagementOpen(true);
                                } else {
                                  navigate("/dashboard");
                                }
                              }}
                            >
                              <Users className="w-4 h-4 mr-1" />
                              Manage Guests
                            </Button>
                          </li>
                        </>
                      )}
                      {user.tier === "lots_more" && (
                        <>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                            <span>Share read-only links</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                            <span>3 admin accounts + unlimited guests</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Button
                              variant="link"
                              className="p-0 h-auto text-primary"
                              onClick={() => navigate("/dashboard")}
                            >
                              <Share2 className="w-4 h-4 mr-1" />
                              Manage Shared Lists
                            </Button>
                          </li>
                          <li className="flex items-start gap-2">
                            <Button
                              variant="link"
                              className="p-0 h-auto text-primary"
                              onClick={() => {
                                const sharedList = lists.find(l => l.isShared && l.userId === user.id);
                                if (sharedList) {
                                  setSelectedListForGuests(sharedList.id);
                                  setIsGuestManagementOpen(true);
                                } else {
                                  navigate("/dashboard");
                                }
                              }}
                            >
                              <Users className="w-4 h-4 mr-1" />
                              Manage Guests
                            </Button>
                          </li>
                          <li className="flex items-start gap-2">
                            <Button
                              variant="link"
                              className="p-0 h-auto text-primary"
                              onClick={() => setIsTeamManagementOpen(true)}
                            >
                              <Users className="w-4 h-4 mr-1" />
                              Manage Team Members
                            </Button>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Import/Export Features */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1">
                        <Upload className="w-4 h-4 text-primary" />
                        <Download className="w-4 h-4 text-primary" />
                      </div>
                      <h4 className="font-semibold text-sm">Import & Export</h4>
                    </div>
                    <ul className="space-y-2 text-sm">
                      {user.tier === "free" && (
                        <li className="flex items-start gap-2 text-muted-foreground">
                          <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>Import/Export not available on Free plan</span>
                        </li>
                      )}
                      {user.tier === "good" && (
                        <>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                            <span>Import from multiple sources</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                            <span>Export to CSV/TXT</span>
                          </li>
                        </>
                      )}
                      {(user.tier === "even_better" || user.tier === "lots_more") && (
                        <>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                            <span>Import from multiple sources</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                            <span>Export to CSV/TXT/PDF</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Upgrade CTA for non-premium users */}
                  {user.tier !== "lots_more" && (
                    <>
                      <Button
                        onClick={() => navigate("/upgrade")}
                        className="w-full"
                        variant="default"
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        Upgrade to unlock more features
                      </Button>
                      
                      {/* Missing features for next tier */}
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-dashed">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Features you're missing:
                        </p>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {user.tier === "free" && (
                            <>
                              <li className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 text-amber-500" />
                                Share lists with read-only links
                              </li>
                              <li className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 text-amber-500" />
                                Import lists from CSV, TXT, and URLs
                              </li>
                              <li className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 text-amber-500" />
                                Export lists to multiple formats
                              </li>
                              <li className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 text-amber-500" />
                                Grocery, Idea, and more list types
                              </li>
                            </>
                          )}
                          {user.tier === "good" && (
                            <>
                              <li className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 text-amber-500" />
                                Invite guests to edit your lists
                              </li>
                              <li className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 text-amber-500" />
                                Registry & Wishlist templates
                              </li>
                              <li className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 text-amber-500" />
                                More lists and items per list
                              </li>
                            </>
                          )}
                          {user.tier === "even_better" && (
                            <>
                              <li className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 text-amber-500" />
                                Unlimited lists and items
                              </li>
                              <li className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 text-amber-500" />
                                3 admin team accounts
                              </li>
                              <li className="flex items-center gap-1.5">
                                <Star className="w-3 h-3 text-amber-500" />
                                Unlimited guests per list
                              </li>
                            </>
                          )}
                        </ul>
                      </div>
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <div className="border-t pt-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">Lists</p>
                    <p className="text-sm font-medium text-gray-900">
                      {totalLists} / {user.listLimit === -1 ? "∞" : user.listLimit}
                    </p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        user.listLimit !== -1 && totalLists >= user.listLimit * 0.9
                          ? "bg-red-500"
                          : "bg-primary"
                      }`}
                      style={{
                        width: `${user.listLimit === -1 ? 0 : Math.min((totalLists / user.listLimit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    Items per List Limit
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {user.itemsPerListLimit === -1 ? "∞" : user.itemsPerListLimit}
                  </p>
                </div>
              </div>

              {user.tier === "free" && (
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
                  <p className="text-sm text-accent mb-3">
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
              <div className="bg-white border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <p className="text-sm font-medium text-foreground">
                      Total Lists
                    </p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{totalLists}</p>
              </div>

              <div className="bg-white border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    <p className="text-sm font-medium text-foreground">
                      Total Items
                    </p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {totalItems}
                </p>
              </div>

              <div className="bg-white border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-foreground">
                      Completed
                    </p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {completedItems}
                </p>
              </div>

              <div className="bg-white border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <p className="text-sm font-medium text-foreground">
                      Favorites
                    </p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {favoriteLists}
                </p>
              </div>

              <div className="bg-white border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-primary" />
                    <p className="text-sm font-medium text-foreground">Shared</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {sharedLists}
                </p>
              </div>

              <div className="bg-white border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-primary" />
                    <p className="text-sm font-medium text-foreground">
                      Avg Items
                    </p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">
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
                <div className="w-full bg-muted rounded-full h-3">
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
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-accent" />
              </div>
              <p className="text-lg font-medium text-accent">
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

      {/* Team Management Dialog */}
      <Dialog open={isTeamManagementOpen} onOpenChange={setIsTeamManagementOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Team Management
            </DialogTitle>
            <DialogDescription>
              Manage team members who have account-wide access to all your lists.
            </DialogDescription>
          </DialogHeader>
          <TeamManagement onClose={() => setIsTeamManagementOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Guest Management Dialog */}
      {isGuestManagementOpen && selectedListForGuests && (
        <Dialog open={isGuestManagementOpen} onOpenChange={(open) => {
          setIsGuestManagementOpen(open);
          if (!open) setSelectedListForGuests(null);
        }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Manage Guests
              </DialogTitle>
              <DialogDescription>
                Invite guests to collaborate on your shared list.
              </DialogDescription>
            </DialogHeader>
            <GuestManagement
              listId={selectedListForGuests}
              listOwnerId={user?.id || ''}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}