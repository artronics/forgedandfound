"use client";

import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";

const ACCORDION_ITEMS = [
  {
    id: "composition",
    label: "Composition & Care",
    content:
      "Crafted from recycled 18k gold. Clean with a soft cloth and store in the provided pouch. Avoid contact with perfumes and chlorine. Each piece is hallmarked and comes with a certificate of authenticity.",
  },
  {
    id: "shipping",
    label: "Shipping & Returns",
    content:
      "Complimentary shipping on all orders over £150. Standard delivery 3–5 business days. Express delivery available at checkout. Returns accepted within 30 days in original condition.",
  },
  {
    id: "sizing",
    label: "Size & Fit Guide",
    content:
      "This necklace is available in three chain lengths: Small (16\"), Medium (18\"), and Large (20\"). If you are unsure which length to choose, we recommend Medium for a classic fit.",
  },
];

export function ProductAccordion() {
  return (
    <Accordion type="multiple" className="border-t border-border/30">
      {ACCORDION_ITEMS.map((item) => (
        <AccordionItem
          key={item.id}
          value={item.id}
          className="border-b border-border/30"
        >
          <AccordionTrigger
            className="py-5 font-sans text-[10px] tracking-[0.2em] uppercase text-foreground hover:no-underline hover:text-secondary"
          >
            {item.label}
          </AccordionTrigger>
          <AccordionContent className="font-sans text-sm font-light leading-relaxed text-muted-foreground pb-5">
            {item.content}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
