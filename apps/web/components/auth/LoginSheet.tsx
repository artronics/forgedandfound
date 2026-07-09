import React from "react";
import {Sheet, SheetContent, SheetDescription, SheetTitle} from "@/components/ui/sheet";
import {useLoginSheet} from "@/lib/auth/useLoginSheet";
import LoginForm from "@/components/auth/LoginForm";

type SigninSheetProps = {
  onLogin?: () => void;
};

export default function LoginSheet({onLogin}: SigninSheetProps) {
  const {open, setOpen} = useLoginSheet();

  const handleSuccess = () => {
    setOpen(false);
    onLogin?.();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetDescription aria-describedby="login-drawer"/>
      <SheetContent side="right" className="w-full overflow-y-auto p-0">
        <SheetTitle/>
        <div className="flex items-center justify-center p-0 md:py-4 md:px-0">
          <LoginForm onSuccess={handleSuccess} className="w-full"/>
        </div>
      </SheetContent>
    </Sheet>
  );
}
