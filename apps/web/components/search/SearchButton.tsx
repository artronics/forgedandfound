import * as React from "react";
import {Button} from "@/components/ui/button";
import {Icon} from "@/components/ui/icon";
import {useBreakpoint} from "@/lib/layout/BreakpointProvider";
import {useSearchSheet} from "@/lib/search/useSearchSheet";

type SearchButtonProps = React.ComponentPropsWithoutRef<typeof Button>;

export function SearchButton({...props}: SearchButtonProps) {

  const {setOpen} = useSearchSheet();
  const {isMobile} = useBreakpoint();

  return (
    <>
      {isMobile
        ? (<Button
          onClick={() => setOpen(true)}
          variant="ghost"
          size="icon"
          {...props}
        >
          <Icon icon="search"/>
        </Button>)
        : (
          <Button
            onClick={() => setOpen(true)}
            variant="ghost"
            className="border-primary border-0 border-b p-1"
            {...props}
          >
            <Icon icon="search" size="md"/>
            <span className="pl-8">Search</span>
          </Button>
        )
      }
    </>
  );
}
