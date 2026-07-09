import {auth} from "@/auth";
import {getCustomerFavourites, setCustomerFavourites} from "@/lib/shopify/admin/favourites";
import {NextResponse} from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  const customerId = session?.shopifyCustomerId;
  if (!customerId) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  const {productId} = (await req.json()) as { productId: string };

  const current = await getCustomerFavourites(customerId);
  const next = current.includes(productId)
    ? current.filter((id) => id !== productId)
    : [...current, productId];

  await setCustomerFavourites(customerId, next);
  return NextResponse.json({ids: next});
}
