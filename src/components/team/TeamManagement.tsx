import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/useAuthHook";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserPlus, Trash2, Mail, Loader2, Users, Crown, Shield, CreditCard, RefreshCw, Clock } from "lucide-react";
import { TeamMember, Account } from "@/types";
import { canHaveTeamMembers, TeamMemberRole } from "@/lib/tierUtils";
import { validateEmail } from "@/lib/validation";

interface TeamManagementProps {
  onClose?: () => void;
}

interface PendingTeamInvite {
  id: string;
  accountId: string;
  guestEmail: string;
  role: TeamMemberRole;
  status: string;
  invitedAt: Date;
  expiresAt: Date;
}

const ROLE_LABELS: Record<TeamMemberRole, string> = {
  member: "Member",
  manager: "Manager",
  billing_admin: "Billing Admin",
};

const ROLE_DESCRIPTIONS: Record<TeamMemberRole, string> = {
  member: "Can view and edit all lists",
  manager: "Can manage team members and lists",
  billing_admin: "Can manage billing and payments",
};

const ROLE_ICONS: Record<TeamMemberRole, React.ReactNode> = {
  member: <Users className="w-4 h-4" />,
  manager: <Shield className="w-4 h-4" />,
  billing_admin: <CreditCard className="w-4 h-4" />,
};

export const TeamManagement: React.FC<TeamManagementProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [account, setAccount] = useState<Account | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingTeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMemberRole>("member");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const canManageTeam = canHaveTeamMembers(user?.tier || "free");

  useEffect(() => {
    if (canManageTeam) {
      fetchAccountAndMembers();
    } else {
      setLoading(false);
    }
  }, [user?.id, canManageTeam]);

  const fetchPendingInvites = async (accountId: string) => {
    try {
      const { data, error } = await supabase
        .from("pending_team_invites")
        .select("*")
        .eq("account_id", accountId)
        .eq("status", "pending");

      if (error) throw error;

      const formatted: PendingTeamInvite[] = (data || []).map((inv: any) => ({
        id: inv.id,
        accountId: inv.account_id,
        guestEmail: inv.guest_email,
        role: inv.role as TeamMemberRole,
        status: inv.status,
        invitedAt: new Date(inv.invited_at),
        expiresAt: new Date(inv.expires_at),
      }));

      setPendingInvites(formatted);

      // Check for accepted invites and show toast
      const { data: acceptedData } = await supabase
        .from("pending_team_invites")
        .select("guest_email")
        .eq("account_id", accountId)
        .eq("inviter_id", user?.id)
        .eq("status", "accepted");

      if (acceptedData && acceptedData.length > 0) {
        const acceptedEmails = acceptedData.map((inv: any) => inv.guest_email).join(", ");
        toast({
          title: "🎉 Team Invite Accepted!",
          description: `${acceptedEmails} joined your team`,
          className: "bg-green-50 border-green-200",
          duration: 5000,
        });

        // Clean up accepted invites
        await supabase
          .from("pending_team_invites")
          .delete()
          .eq("account_id", accountId)
          .eq("inviter_id", user?.id)
          .eq("status", "accepted");
      }
    } catch (error: any) {
      console.error("[TeamManagement] Error fetching pending invites:", error);
    }
  };

  const fetchAccountAndMembers = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get or create account
      let { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("*")
        .eq("owner_id", user.id)
        .single();

      if (accountError && accountError.code === "PGRST116") {
        // No account exists, create one
        const { data: newAccount, error: createError } = await supabase
          .from("accounts")
          .insert({
            owner_id: user.id,
            name: `${user.name}'s Account`,
          })
          .select()
          .single();

        if (createError) throw createError;
        accountData = newAccount;
      } else if (accountError) {
        throw accountError;
      }

      if (accountData) {
        setAccount({
          id: accountData.id,
          ownerId: accountData.owner_id,
          name: accountData.name,
          createdAt: new Date(accountData.created_at),
          updatedAt: new Date(accountData.updated_at),
        });

        // Fetch team members
        const { data: membersData, error: membersError } = await supabase
          .from("account_team_members")
          .select(`
            id,
            account_id,
            user_id,
            role,
            invited_at,
            users:user_id (
              id,
              email,
              name
            )
          `)
          .eq("account_id", accountData.id);

        if (membersError) throw membersError;

        const formattedMembers: TeamMember[] = (membersData || []).map((m: any) => ({
          id: m.id,
          accountId: m.account_id,
          userId: m.user_id,
          role: m.role as TeamMemberRole,
          invitedAt: new Date(m.invited_at),
          user: m.users ? {
            id: m.users.id,
            email: m.users.email,
            name: m.users.name,
            createdAt: new Date(),
            tier: "free",
            listLimit: 0,
            itemsPerListLimit: 0,
          } : undefined,
        }));

        setTeamMembers(formattedMembers);

        // Fetch pending invites
        await fetchPendingInvites(accountData.id);
      }
    } catch (error: any) {
      console.error("[TeamManagement] Error fetching account:", error);
      toast({
        title: "❌ Error",
        description: "Failed to load team information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteTeamMember = async () => {
    if (!inviteEmail.trim() || !account) return;

    const emailValidation = validateEmail(inviteEmail);
    if (!emailValidation.valid) {
      toast({
        title: "❌ Invalid Email",
        description: emailValidation.error,
        variant: "destructive",
      });
      return;
    }

    try {
      setInviting(true);

      // Check if already a pending invite
      const existingPending = pendingInvites.find(
        (inv) => inv.guestEmail.toLowerCase() === emailValidation.value.toLowerCase()
      );
      if (existingPending) {
        toast({
          title: "⚠️ Already Invited",
          description: "This email already has a pending invite",
          variant: "destructive",
        });
        return;
      }

      // Find the user by email using SECURITY DEFINER RPC (bypasses RLS)
      const { data: userData, error: userError } = await supabase
        .rpc("check_user_exists_by_email", { p_email: emailValidation.value });

      if (userError) {
        console.error("[TeamManagement] Error checking user existence:", userError);
        throw userError;
      }

      const existingUser = userData && userData.length > 0 ? userData[0] : null;

      if (existingUser) {
        // User exists - check if already a team member
        const existingMember = teamMembers.find((m) => m.userId === existingUser.user_id);
        if (existingMember) {
          toast({
            title: "⚠️ Already a Team Member",
            description: "This user is already a member of your team",
            variant: "destructive",
          });
          return;
        }

        // Add the team member directly
        const { error: insertError } = await supabase
          .from("account_team_members")
          .insert({
            account_id: account.id,
            user_id: existingUser.user_id,
            role: inviteRole,
          });

        if (insertError) throw insertError;

        // Send notification email (user existence determined server-side)
        await sendTeamInviteEmail(emailValidation.value);

        toast({
          title: "✅ Team Member Added",
          description: `Successfully added ${emailValidation.value} to your team`,
          className: "bg-green-50 border-green-200",
        });
      } else {
        // User doesn't exist (existingUser is null) - create pending invite
        const { error: inviteError } = await supabase
          .from("pending_team_invites")
          .insert({
            account_id: account.id,
            inviter_id: user?.id,
            guest_email: emailValidation.value,
            role: inviteRole,
          });

        if (inviteError) throw inviteError;

        // Send invite email (user existence determined server-side)
        await sendTeamInviteEmail(emailValidation.value);

        toast({
          title: "✅ Invite Sent",
          description: `Invitation sent to ${emailValidation.value}. They'll be added when they sign up.`,
          className: "bg-green-50 border-green-200",
        });
      }

      setInviteEmail("");
      fetchAccountAndMembers();
    } catch (error: any) {
      console.error("[TeamManagement] Error inviting team member:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const sendTeamInviteEmail = async (email: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        console.error("[TeamManagement] No auth token for email");
        return;
      }

      const baseUrl = window.location.origin;
      const signupUrl = `${baseUrl}/auth?email=${encodeURIComponent(email)}`;

      // NOTE: isExistingUser is now determined server-side in the edge function
      const payload = {
        guestEmail: email,
        listName: account?.name || "Team",
        inviterName: user?.name || user?.email || "A team owner",
        context: "team",
        accountId: account?.id,
        signupUrl: signupUrl,
      };

      console.log("[TeamManagement] Sending team invite email with payload:", payload);

      const response = await supabase.functions.invoke("supabase-functions-send-invite-email", {
        body: payload,
      });

      if (response.error) {
        console.error("[TeamManagement] Email send error:", response.error);
      }
    } catch (error) {
      console.error("[TeamManagement] Failed to send email:", error);
    }
  };

  const handleResendInvite = async (invite: PendingTeamInvite) => {
    try {
      setResendingId(invite.id);

      // Update expires_at
      const { error } = await supabase
        .from("pending_team_invites")
        .update({ expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
        .eq("id", invite.id);

      if (error) throw error;

      // User existence is now determined server-side in the edge function
      console.log("[TeamManagement] Resend invite - email:", invite.guestEmail);

      await sendTeamInviteEmail(invite.guestEmail);

      toast({
        title: "✅ Invite Resent",
        description: `Invitation resent to ${invite.guestEmail}`,
        className: "bg-green-50 border-green-200",
      });

      if (account) {
        await fetchPendingInvites(account.id);
      }
    } catch (error: any) {
      console.error("[TeamManagement] Error resending invite:", error);
      toast({
        title: "❌ Error",
        description: "Failed to resend invite",
        variant: "destructive",
      });
    } finally {
      setResendingId(null);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      setCancellingId(inviteId);

      const { error } = await supabase
        .from("pending_team_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;

      setPendingInvites(pendingInvites.filter((inv) => inv.id !== inviteId));

      toast({
        title: "✅ Invite Cancelled",
        description: "The pending invite has been cancelled",
        className: "bg-green-50 border-green-200",
      });
    } catch (error: any) {
      console.error("[TeamManagement] Error cancelling invite:", error);
      toast({
        title: "❌ Error",
        description: "Failed to cancel invite",
        variant: "destructive",
      });
    } finally {
      setCancellingId(null);
    }
  };

  const handleRemoveTeamMember = async (memberId: string, memberEmail?: string) => {
    try {
      setRemovingId(memberId);

      const { error } = await supabase
        .from("account_team_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "✅ Team Member Removed",
        description: memberEmail ? `Removed ${memberEmail} from your team` : "Team member removed successfully",
        className: "bg-green-50 border-green-200",
      });

      setTeamMembers(teamMembers.filter(m => m.id !== memberId));
    } catch (error: any) {
      console.error("[TeamManagement] Error removing team member:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: TeamMemberRole) => {
    try {
      const { error } = await supabase
        .from("account_team_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      setTeamMembers(teamMembers.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ));

      toast({
        title: "✅ Role Updated",
        description: `Team member role changed to ${ROLE_LABELS[newRole]}`,
        className: "bg-green-50 border-green-200",
      });
    } catch (error: any) {
      console.error("[TeamManagement] Error updating role:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManageTeam) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <Crown className="w-12 h-12 mx-auto text-teal-500" />
          <h3 className="text-lg font-semibold">Team Members</h3>
          <p className="text-gray-600">
            Team members are available exclusively for <strong>Lots More</strong> tier users.
            Upgrade to add team members who can access and manage all your lists.
          </p>
          <Button variant="default" onClick={onClose}>
            Upgrade to Lots More
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Team Members</h3>
          <Badge variant="secondary" className="text-xs">
            {teamMembers.length} members
          </Badge>
        </div>
      </div>

      {/* Role Descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(ROLE_LABELS) as TeamMemberRole[]).map((role) => (
          <div key={role} className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              {ROLE_ICONS[role]}
              <span className="font-medium text-sm">{ROLE_LABELS[role]}</span>
            </div>
            <p className="text-xs text-gray-600">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      {/* Invite Form */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Add Team Member</h4>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="Enter email to invite..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviting}
            />
          </div>
          <Select
            value={inviteRole}
            onValueChange={(v) => setInviteRole(v as TeamMemberRole)}
            disabled={inviting}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="billing_admin">Billing Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleInviteTeamMember}
            disabled={inviting || !inviteEmail.trim()}
          >
            {inviting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            Add
          </Button>
        </div>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600" />
            Pending Invites
            <Badge variant="secondary" className="text-xs">
              {pendingInvites.length}
            </Badge>
          </h4>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-4 bg-teal-50 border border-teal-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium">{invite.guestEmail}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {ROLE_LABELS[invite.role]}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        Invited {invite.invitedAt.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResendInvite(invite)}
                    disabled={resendingId === invite.id}
                    className="text-teal-600 hover:text-teal-700 hover:bg-teal-100"
                  >
                    {resendingId === invite.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelInvite(invite.id)}
                    disabled={cancellingId === invite.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {cancellingId === invite.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Member List */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Current Team Members</h4>
        {teamMembers.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-lg">
            No team members yet. Add team members to give them access to all your lists.
          </p>
        ) : (
          <div className="space-y-2">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.user?.name || member.user?.email || "Unknown User"}
                    </p>
                    {member.user?.name && (
                      <p className="text-sm text-gray-500">{member.user.email}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      Added {member.invitedAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={member.role}
                    onValueChange={(v) => handleUpdateRole(member.id, v as TeamMemberRole)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="billing_admin">Billing Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={removingId === member.id}
                      >
                        {removingId === member.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {member.user?.email || "this team member"}? 
                          They will lose access to all your lists.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveTeamMember(member.id, member.user?.email)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default TeamManagement;
