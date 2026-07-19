import React, {Suspense} from "react";
import {getLogger} from "@forgedandfound/logger/web";
import {StoreProviders} from "@/components/providers";
import {Navbar} from "@/components/navbar/navbar";
import {Footer} from "@/components/footer";
import CartSheet from "@/components/cart/CartSheet";
import {SearchSheet} from "@/components/search/SearchSheet";
import LoginSheet from "@/components/auth/LoginSheet";
import {getMenu} from "@/lib/shopify/server";

// Fetches the navigation menu on the server; streamed in via Suspense so the
// page shell never waits on Shopify. A menu failure degrades to an empty nav
// instead of failing the whole page.
async function NavbarWithMenu() {
  const menu = await getMenu().catch((err) => {
    getLogger().error({err}, "failed to load navigation menu");
    return [];
  });
  return <Navbar menu={menu}/>;
}

export default function StoreLayout({children}: {
  children: React.ReactNode,
}) {
  return (
    <StoreProviders>
      <Suspense fallback={<Navbar menu={[]}/>}>
        <NavbarWithMenu/>
      </Suspense>
      <div className="flex-1">
        {children}
      </div>
      <Footer/>
      <CartSheet/>
      <SearchSheet/>
      <LoginSheet/>
    </StoreProviders>
  );
}
