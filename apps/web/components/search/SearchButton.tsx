import * as React from "react";
import {Button} from "@/components/ui/button";
import {Icon} from "@/components/ui/icon";
import {useSearchSheet} from "@/lib/search/useSearchSheet";

type SearchButtonProps = React.ComponentPropsWithoutRef<typeof Button>;

// Icon-only below md, labelled from md up. Toggled by CSS rather than a
// measured breakpoint so the server and client render the same markup (see
// Navbar for why).
export function SearchButton({...props}: SearchButtonProps) {
  const {setOpen} = useSearchSheet();

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="ghost"
        size="icon"
        className="md:hidden"
        {...props}
      >
        <Icon icon="search"/>
      </Button>
      <Button
        onClick={() => setOpen(true)}
        variant="ghost"
        className="hidden border-primary border-0 border-b p-1 md:inline-flex"
        {...props}
      >
        <Icon icon="search" size="md"/>
        <span className="pl-8">Search</span>
      </Button>
    </>
  );
}
