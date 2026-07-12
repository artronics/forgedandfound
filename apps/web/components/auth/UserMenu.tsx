import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {MenuItem} from "@/components/ui/menu-item";
import {signOutWithCognito} from "@/actions/auth-actions";
import {Icon} from "../ui/icon";

export default function UserMenu({open, setOpen, children}: {
  open: boolean,
  setOpen: (open: boolean) => void,
  children?: React.ReactNode
}) {
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {children && <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>}
      <DropdownMenuContent className="px-4 bg-surface-container" align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <MenuItem icon={<Icon icon="log-out"/>}>
              <form action={signOutWithCognito}>
                <button type="submit" className="cursor-pointer">
                  Log Out
                </button>
              </form>
            </MenuItem>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
