import {Icon} from "@/components/ui/icon";
import {Button} from "@/components/ui/button";
import Link from "next/link";

export function WishlistButton() {
  return (
    <Button variant="ghost" asChild>
      <Link href="/account/favourites">
        <Icon icon="heart" size="md"/>
      </Link>
    </Button>
  );
}