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
import { UserPlus, Trash2, Mail, Loader2, Users, Crown, Clock } from "lucide-react";
import { ListGuest } from "@/types";
import { canInviteGuests, getGuestLimit } from "@/lib/tierUtils";
import { validateEmail } from "@/lib/validation";

interface PendingInvite {
  id: string;
  listId: string;
  guestEmail: string;
  permission: "view" | "edit";
  invitedAt: Date;
  expiresAt: Date;
  status: "pending" | "accepted" | "expired";
}

interface GuestManagementProps {
  listId: string;
  listOwnerId: string;
}

export const GuestManagement: React.FC<GuestManagementProps> = ({
  listId,
  listOwnerId,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [guests, setGuests] = useState<ListGuest[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<"view" | "edit">("edit");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isOwner = user?.id === listOwnerId;
  const guestLimit = getGuestLimit(user?.tier || "free");
  const canInvite = canInviteGuests(user?.tier || "free");
  const totalGuests = guests.length + pendingInvites.length;
  const isAtLimit = guestLimit !== -1 && totalGuests >= guestLimit;

  useEffect(() => {
    fetchGuests();
    fetchPendingInvites();
  }, [listId]);

  const fetchPendingInvites = async () => {
    try {
      const { data, error } = await supabase
        .from("pending_list_invites")
        .select("*")
        .eq("list_id", listId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString());

      if (error) throw error;

      const formatted: PendingInvite[] = (data || []).map((inv: any) => ({
        id: inv.id,
        listId: inv.list_id,
        guestEmail: inv.guest_email,
        permission: inv.permission,
        invitedAt: new Date(inv.invited_at),
        expiresAt: new Date(inv.expires_at),
        status: inv.status,
      }));

      setPendingInvites(formatted);
    } catch (error: any) {
      console.error("[GuestManagement] Error fetching pending invites:", error);
    }
  };

  const fetchGuests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("list_guests")
        .select(`
          id,
          list_id,
          user_id,
          permission,
          invited_at,
          users:user_id (
            id,
            email,
            name
          )
        `)
        .eq("list_id", listId);

      if (error) throw error;

      const formattedGuests: ListGuest[] = (data || []).map((g: any) => ({
        id: g.id,
        listId: g.list_id,
        userId: g.user_id,
        permission: g.permission,
        invitedAt: new Date(g.invited_at),
        user: g.users ? {
          id: g.users.id,
          email: g.users.email,
          name: g.users.name,
          createdAt: new Date(),
          tier: "free",
          listLimit: 0,
          itemsPerListLimit: 0,
        } : undefined,
      }));

      setGuests(formattedGuests);
    } catch (error: any) {
      console.error("[GuestManagement] Error fetching guests:", error);
      toast({
        title: "❌ Error",
        description: "Failed to load guests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteGuest = async () => {
    if (!inviteEmail.trim()) return;

    const emailValidation = validateEmail(inviteEmail);
    if (!emailValidation.valid) {
      toast({
        title: "❌ Invalid Email",
        description: emailValidation.error,
        variant: "destructive",
      });
      return;
    }

    if (!canInvite) {
      toast({
        title: "⚠️ Upgrade Required",
        description: "Upgrade to Even Better or Lots More tier to invite guests",
        variant: "destructive",
      });
      return;
    }

    if (isAtLimit) {
      toast({
        title: "⚠️ Guest Limit Reached",
        description: `You can only invite up to ${guestLimit} guests per list. Upgrade to Lots More for unlimited guests.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setInviting(true);

      // First, find the user by email
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", emailValidation.value)
        .maybeSingle();

      // If user exists, add them directly
      if (userData && !userError) {
        // Check if already a guest
        const existingGuest = guests.find(g => g.userId === userData.id);
        if (existingGuest) {
          toast({
            title: "⚠️ Already Invited",
            description: "This user is already a guest on this list",
            variant: "destructive",
          });
          return;
        }

        // Add the guest
        const { error: insertError } = await supabase
          .from("list_guests")
          .insert({
            list_id: listId,
            user_id: userData.id,
            permission: invitePermission,
          });

        if (insertError) throw insertError;

        // Get list title for notification email
        const { data: listData } = await supabase
          .from("lists")
          .select("title")
          .eq("id", listId)
          .single();

        // Send notification email to existing user
        const listUrl = `${window.location.origin}/list/${listId}`;
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const emailRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite-email`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({
                guestEmail: emailValidation.value,
                inviterName: user?.name || user?.email || "A ListMine user",
                listName: listData?.title || "a list",
                signupUrl: listUrl,
                isExistingUser: true,
              }),
            }
          );
          
          if (!emailRes.ok) {
            const errorText = await emailRes.text();
            console.error("Email notification error:", errorText);
            toast({
              title: "⚠️ Email Failed",
              description: "Guest was added but email notification failed to send",
              variant: "destructive",
            });
          } else {
            const emailData = await emailRes.json();
            console.log("Email sent successfully:", emailData);
          }
        } catch (emailErr) {
          console.error("Email notification error:", emailErr);
          toast({
            title: "⚠️ Email Failed",
            description: "Guest was added but email notification failed to send",
            variant: "destructive",
          });
        }

        toast({
          title: "✅ Guest Invited",
          description: `Successfully invited ${emailValidation.value} as a guest`,
          duration: 5000,
        });

        setInviteEmail("");
        fetchGuests();
        return;
      }

      // User doesn't exist - create pending invite and send email
      const existingPending = pendingInvites.find(
        inv => inv.guestEmail.toLowerCase() === emailValidation.value.toLowerCase()
      );
      
      if (existingPending) {
        toast({
          title: "⚠️ Invite Already Sent",
          description: "An invitation has already been sent to this email",
          variant: "destructive",
        });
        return;
      }

      // Create pending invite
      const { error: pendingError } = await supabase
        .from("pending_list_invites")
        .insert({
          list_id: listId,
          inviter_id: user?.id,
          guest_email: emailValidation.value,
          permission: invitePermission,
        });

      if (pendingError) throw pendingError;

      // Get list title for email
      const { data: listData } = await supabase
        .from("lists")
        .select("title")
        .eq("id", listId)
        .single();

      // Send invite email
      const signupUrl = `${window.location.origin}/auth?email=${encodeURIComponent(emailValidation.value)}`;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const emailRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              guestEmail: emailValidation.value,
              inviterName: user?.name || user?.email || "A ListMine user",
              listName: listData?.title || "a list",
              signupUrl,
            }),
          }
        );

        if (!emailRes.ok) {
          const errorText = await emailRes.text();
          console.error("Email send error:", errorText);
          toast({
            title: "⚠️ Email Failed",
            description: "Invite created but email failed to send. Check console for details.",
            variant: "destructive",
          });
        } else {
          const emailData = await emailRes.json();
          console.log("Email sent successfully:", emailData);
        }
      } catch (emailError) {
        console.error("Email send error:", emailError);
        toast({
          title: "⚠️ Email Failed",
          description: "Invite created but email failed to send. Check console for details.",
          variant: "destructive",
        });
      }

      toast({
        title: "📧 Invitation Sent",
        description: `We've sent an invite to ${emailValidation.value}. They'll need to create a free account to access your list.`,
        duration: 5000,
      });

      setInviteEmail("");
      fetchPendingInvites();
    } catch (error: any) {
      console.error("[GuestManagement] Error inviting guest:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to invite guest",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemovePendingInvite = async (inviteId: string, email: string) => {
    try {
      const { error } = await supabase
        .from("pending_list_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;

      toast({
        title: "✅ Invite Cancelled",
        description: `Cancelled invitation to ${email}`,
        duration: 5000,
      });

      setPendingInvites(pendingInvites.filter(inv => inv.id !== inviteId));
    } catch (error: any) {
      console.error("[GuestManagement] Error removing pending invite:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to cancel invite",
        variant: "destructive",
      });
    }
  };

  const handleRemoveGuest = async (guestId: string, guestEmail?: string) => {
    try {
      setRemovingId(guestId);

      const { error } = await supabase
        .from("list_guests")
        .delete()
        .eq("id", guestId);

      if (error) throw error;

      toast({
        title: "✅ Guest Removed",
        description: guestEmail ? `Removed ${guestEmail} from this list` : "Guest removed successfully",
        duration: 5000,
      });

      setGuests(guests.filter(g => g.id !== guestId));
    } catch (error: any) {
      console.error("[GuestManagement] Error removing guest:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to remove guest",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

  const handleUpdatePermission = async (guestId: string, newPermission: "view" | "edit") => {
    try {
      const { error } = await supabase
        .from("list_guests")
        .update({ permission: newPermission })
        .eq("id", guestId);

      if (error) throw error;

      setGuests(guests.map(g => 
        g.id === guestId ? { ...g, permission: newPermission } : g
      ));

      toast({
        title: "✅ Permission Updated",
        description: `Guest permission changed to ${newPermission}`,
        className: "bg-accent/10 border-accent/20",
      });
    } catch (error: any) {
      console.error("[GuestManagement] Error updating permission:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to update permission",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">List Guests</h3>
          {guestLimit !== -1 && (
            <Badge variant="secondary" className="text-xs">
              {totalGuests}/{guestLimit}
            </Badge>
          )}
        </div>
      </div>

      {/* Invite Form - Only for owners with permission */}
      {isOwner && canInvite && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="email"
                placeholder="Enter email to invite..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting || isAtLimit}
              />
            </div>
            <Select
              value={invitePermission}
              onValueChange={(v) => setInvitePermission(v as "view" | "edit")}
              disabled={inviting}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleInviteGuest}
              disabled={inviting || !inviteEmail.trim() || isAtLimit}
              size="sm"
            >
              {inviting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
            </Button>
          </div>
          {isAtLimit && (
            <p className="text-xs text-teal-600">
              Guest limit reached. Upgrade to Lots More for unlimited guests.
            </p>
          )}
        </div>
      )}

      {/* Upgrade prompt for non-eligible tiers */}
      {isOwner && !canInvite && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
          <p className="text-sm text-teal-800">
            <Crown className="w-4 h-4 inline mr-1" />
            Upgrade to <strong>Even Better</strong> or <strong>Lots More</strong> tier to invite guests to collaborate on your lists.
          </p>
        </div>
      )}

      {/* Pending Invites Section */}
      {isOwner && pendingInvites.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-secondary" />
            <h4 className="font-medium text-sm text-secondary-foreground">Pending Invites</h4>
            <Badge variant="secondary" className="text-xs">
              {pendingInvites.length}
            </Badge>
          </div>
          {pendingInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between p-3 bg-secondary/10 border border-secondary/30 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">
                    {invite.guestEmail}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Invite sent • Expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {invite.permission}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      // Resend the invite
                      const { data: listData } = await supabase
                        .from("lists")
                        .select("title")
                        .eq("id", listId)
                        .single();

                      const signupUrl = `${window.location.origin}/auth?email=${encodeURIComponent(invite.guestEmail)}`;
                      
                      const { data: { session } } = await supabase.auth.getSession();
                      const emailRes = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite-email`,
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`,
                          },
                          body: JSON.stringify({
                            guestEmail: invite.guestEmail,
                            inviterName: user?.name || user?.email || "A ListMine user",
                            listName: listData?.title || "a list",
                            signupUrl,
                          }),
                        }
                      );

                      if (!emailRes.ok) {
                        const errorText = await emailRes.text();
                        console.error("Email resend error:", errorText);
                        toast({
                          title: "⚠️ Email Failed",
                          description: "Failed to resend invitation email",
                          variant: "destructive",
                        });
                      } else {
                        toast({
                          title: "📧 Invite Resent",
                          description: `Resent invitation to ${invite.guestEmail}`,
                          duration: 5000,
                        });
                      }
                    } catch (error) {
                      console.error("Resend error:", error);
                      toast({
                        title: "❌ Error",
                        description: "Failed to resend invitation",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="text-primary hover:text-primary/80"
                >
                  <Mail className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel the invitation to {invite.guestEmail}?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRemovePendingInvite(invite.id, invite.guestEmail)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Cancel Invite
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guest List */}
      <div className="space-y-2">
        {guests.length === 0 && pendingInvites.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No guests invited yet
          </p>
        ) : guests.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No active guests yet
          </p>
        ) : (
          guests.map((guest) => (
            <div
              key={guest.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {guest.user?.name || guest.user?.email || "Unknown User"}
                  </p>
                  {guest.user?.name && (
                    <p className="text-xs text-gray-500">{guest.user.email}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && (
                  <>
                    <Select
                      value={guest.permission}
                      onValueChange={(v) => handleUpdatePermission(guest.id, v as "view" | "edit")}
                    >
                      <SelectTrigger className="w-20 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">View</SelectItem>
                        <SelectItem value="edit">Edit</SelectItem>
                      </SelectContent>
                    </Select>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={removingId === guest.id}
                        >
                          {removingId === guest.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Guest</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {guest.user?.email || "this guest"} from this list? They will no longer have access.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveGuest(guest.id, guest.user?.email)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
                {!isOwner && (
                  <Badge variant="secondary" className="text-xs">
                    {guest.permission}
                  </Badge>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default GuestManagement;
