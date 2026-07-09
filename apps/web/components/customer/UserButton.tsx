import {Button} from "@/components/ui/button";
import React from "react";
import {IconButton} from "@/components/ui/icon";
import {useLoginSheet} from "@/lib/auth/useLoginSheet";

type UserButtonProps = React.ComponentPropsWithoutRef<typeof Button>;

export function UserButton({...props}: UserButtonProps) {
  const {setOpen} = useLoginSheet();
  return (
    <IconButton
      icon="user"
      variant="ghost"
      onClick={() => setOpen(true)}
      {...props}
    />
  );
}