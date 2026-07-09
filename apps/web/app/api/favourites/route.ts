import {auth} from "@/auth";
import {getCustomerFavourites, setCustomerFavourites} from "@/lib/shopify/admin/favourites";
import {NextResponse} from "next/server";

export async function GET() {
  const session = await auth();
  const customerId = session?.shopifyCustomerId;
  if (!customerId) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  const ids = await getCustomerFavourites(customerId);
  return NextResponse.json({ids});
}

export async function POST(req: Request) {
  const session = await auth();
  const customerId = session?.shopifyCustomerId;
  if (!customerId) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  const {ids} = (await req.json()) as { ids: string[] };
  await setCustomerFavourites(customerId, ids);
  return NextResponse.json({ids});
}
