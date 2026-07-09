import React from "react";
import {CartLines_CartFragmentDoc} from "@/graphql/generated/graphql";
import {CartLine, CartLineSkeleton} from "@/components/cart/CartLine";
import {Separator} from "@/components/ui/separator";
import {FragmentType, useFragment} from "@/graphql/generated";

type CartLinesContainerProps = {
  fragment: FragmentType<typeof CartLines_CartFragmentDoc> | null;
}

export function CartLinesContainer({fragment}: CartLinesContainerProps) {
  const cart = useFragment(CartLines_CartFragmentDoc, fragment);
  const loading = false; // TODO: the loading requires to be notified from mutations. useQuery is not getting updated until mutation is completed
  if (loading) return (
    <CartSkeleton count={3}/>
  );

  const lines = cart?.lines?.nodes?.filter(
    (line): line is Extract<typeof line, { __typename?: "CartLine" }> =>
      line?.__typename === "CartLine",
  ) ?? [];

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line) => (
        <div key={line.id}>
          <CartLine lineFragment={line}/>
          <Separator className="my-2"/>
        </div>
      ))}
    </div>
  );
}

function CartSkeleton({count = 3}: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({length: count}).map((_, index) => (
        <CartLineSkeleton key={index}/>
      ))}
    </div>
  );
}

