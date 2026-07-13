import {Button} from "@/components/ui/button";
import React from "react";
import {IconButton} from "@/components/ui/icon";
import {useLoginSheet} from "@/lib/auth/useLoginSheet";
import {useSession} from "next-auth/react";
import UserMenu from "@/components/auth/UserMenu";

type UserButtonProps = React.ComponentPropsWithoutRef<typeof Button>;

export function UserButton({...props}: UserButtonProps) {
  const {setOpen: setOpenSheet} = useLoginSheet();
  const {status} = useSession();
  const [openMenu, setOpenMenu] = React.useState(false);

  return (
    <UserMenu
      open={openMenu}
      setOpen={(open) => {
        if (open && status !== "authenticated") {
          setOpenSheet(true);
          return;
        }
        setOpenMenu(open);
      }}
    >
      <IconButton
        icon="user"
        variant="ghost"
        {...props}
      />
    </UserMenu>
  );
}