import React from "react";
import {Brand} from "@/components/brand";
import Link from "next/link";

export function Footer() {
  return (
    <div className="bg-primary flex flex-col items-center max-md:text-center">
      <div className="flex text-background/70 flex-col md:inline-grid md:grid-cols-3 gap-16 px-12 py-24">
        <div className="flex flex-col max-md:items-center">
          <Brand size="lg" className="text-background"/>
          <p>Artisanal jewellery crafted with reverence for history and respect for the earth.</p>
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-lg text-background pb-2">Customer Care</h3>
          <Link href="/pages/shipping-policy"><p>Shipping</p></Link>
          <Link href="/pages/return-policy"><p>Return Policy</p></Link>
          <Link href="/pages/refund-policy"><p>Refund Policy</p></Link>
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-lg text-background pb-2">Legal</h3>
          <Link href="/pages/privacy-policy"><p>Privacy Policy</p></Link>
          <Link href="/pages/terms-of-service"><p>Terms of Service</p></Link>
        </div>
      </div>
      <div className="text-background/10 text-center title-sm py-10">© 2026 FORGED & FOUND.<span
        className="md:hidden"><br/></span> FORGED IN CRAFT, FOUND IN NATURE.
      </div>
    </div>
  );
}