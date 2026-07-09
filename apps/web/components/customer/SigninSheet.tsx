import React, {useState} from "react";
import {Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger} from "@/components/ui/sheet";
import {Button} from "@/components/ui/button";
import {Icon} from "@/components/ui/icon";
import {cn} from "@/lib/utils";
import LoginForm from "@/components/auth/LoginForm";

type SigninSheetProps = {
  onLogin?: () => void;
  className?: string;
};

export default function SigninSheet({onLogin, className}: SigninSheetProps) {
  const [open, setOpen] = useState(false);

  const handleSuccess = () => {
    setOpen(false);
    onLogin?.();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetDescription aria-describedby="login-drawer"/>
      <SheetTitle/>

      <SheetTrigger asChild>
        <Button variant="ghost" aria-label="Sign in" className={cn("relative", className)}>
          <Icon icon="user" size="md"/>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0">
        <div className="flex items-center justify-center min-h-full py-12 px-4">
          <LoginForm onSuccess={handleSuccess} className="w-full"/>
        </div>
      </SheetContent>
    </Sheet>
  );
}
