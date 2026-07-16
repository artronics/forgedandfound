import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {MenuItem} from "@/components/ui/menu-item";
import {Icon} from "../ui/icon";
import {useRouter} from "next/navigation";
import {signOut} from "next-auth/react";

export default function UserMenu({open, setOpen, children}: {
  open: boolean,
  setOpen: (open: boolean) => void,
  children?: React.ReactNode
}) {
  const router = useRouter();

  const handleLogout = async () => {
    // Client-side sign out clears the session cookie and immediately updates
    // useSession() everywhere, so the UI reflects the logged-out state right
    // away. router.refresh() then re-renders server components to match.
    await signOut({redirect: false});
    router.refresh();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {children && <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>}
      <DropdownMenuContent className="px-4 bg-surface-container" align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() => router.push("/account/me")}
            className="cursor-pointer"
          >
            <MenuItem icon={<Icon icon="user"/>}>
              Account
            </MenuItem>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleLogout} className="cursor-pointer">
            <MenuItem icon={<Icon icon="log-out"/>}>
              Log Out
            </MenuItem>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
