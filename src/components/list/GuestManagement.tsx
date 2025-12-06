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
import { UserPlus, Trash2, Mail, Loader2, Users, Crown } from "lucide-react";
import { ListGuest } from "@/types";
import { canInviteGuests, getGuestLimit } from "@/lib/tierUtils";
import { validateEmail } from "@/lib/validation";

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
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<"view" | "edit">("edit");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isOwner = user?.id === listOwnerId;
  const guestLimit = getGuestLimit(user?.tier || "free");
  const canInvite = canInviteGuests(user?.tier || "free");
  const isAtLimit = guestLimit !== -1 && guests.length >= guestLimit;

  useEffect(() => {
    fetchGuests();
  }, [listId]);

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
        .single();

      if (userError || !userData) {
        toast({
          title: "❌ User Not Found",
          description: "No user found with that email address. They need to create an account first.",
          variant: "destructive",
        });
        return;
      }

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

      toast({
        title: "✅ Guest Invited",
        description: `Successfully invited ${emailValidation.value} as a guest`,
        className: "bg-green-50 border-green-200",
      });

      setInviteEmail("");
      fetchGuests();
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
        className: "bg-green-50 border-green-200",
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
        className: "bg-green-50 border-green-200",
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
              {guests.length}/{guestLimit}
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
            <p className="text-xs text-amber-600">
              Guest limit reached. Upgrade to Lots More for unlimited guests.
            </p>
          )}
        </div>
      )}

      {/* Upgrade prompt for non-eligible tiers */}
      {isOwner && !canInvite && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            <Crown className="w-4 h-4 inline mr-1" />
            Upgrade to <strong>Even Better</strong> or <strong>Lots More</strong> tier to invite guests to collaborate on your lists.
          </p>
        </div>
      )}

      {/* Guest List */}
      <div className="space-y-2">
        {guests.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No guests invited yet
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
