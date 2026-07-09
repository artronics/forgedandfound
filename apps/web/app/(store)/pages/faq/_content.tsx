import React from "react";
import Link from "next/link";
import {Warranty} from "@/app/(store)/pages/_snippets/Warranty";

export const faqContent = [
  {
    title: "Products",
    items: [
      [
        "What is the difference between Forged and Found?",
        (<>
          <p><strong>Forged jewellery</strong> refers to our newly crafted pieces, designed for everyday wear using
            materials
            such
            as solid
            gold, gold vermeil and sterling silver.</p>
          <p><strong>Found jewellery</strong> refers to carefully sourced pre-owned pieces. These are chosen for their
            craftsmanship,
            timeless design and ability to sit beautifully within a modern jewellery wardrobe.</p>
        </>),
      ],
      [
        "Are Found pieces authentic?",
        (<>
          <p>Yes. All Found pieces are carefully inspected before being offered for sale. We source jewellery with a
            focus on craftsmanship, quality materials and timeless design.</p>
          <p>Where relevant, hallmarks and material details are checked as part of our sourcing process.</p>
        </>),
      ],
      [
        "Are found pieces one of a kind?",
        (<>
          <p>Many Found pieces are <strong>unique or limited</strong>, as they are sourced individually. Once sold,
            these pieces may not be available again, which is part of what makes them special.</p>
        </>),
      ], [
        "Will Found pieces show signs of wear?",
        (<>
          <p>As pre-owned pieces, some Found jewellery may show <strong>light signs of wear consistent with age</strong>.
            We see this as part of the character of vintage and pre-owned jewellery.</p>
          <p>Any noticeable marks or imperfections will always be clearly described in the product listing.</p>
        </>),
      ],
    ],
  },
  {
    title: "Materials and Quality",
    items: [
      [
        "Can I wear this jewellery every day?",
        (<>
          <p>Yes. Our collections are designed with everyday wear in mind.</p>
          <p>We focus on materials such as solid gold, gold vermeil and sterling silver that balance beauty, durability
            and comfort. Many customers wear their pieces daily — layered with other jewellery or worn alone as part of
            their everyday wardrobe.</p>
          <p>As with all jewellery, removing pieces before swimming, showering or exercising will help preserve their
            finish over time.</p>
        </>),
      ],
      [
        "What is gold vermeil?",
        (<>
          <p>Gold vermeil is a thick layer of gold plated over sterling silver.</p>
          <p>It offers the appearance of solid gold while maintaining the durability of a silver base, making it a
            popular choice for everyday jewellery.</p>
          <p>With proper care, gold vermeil can last for many years.</p>
        </>),
      ],
      [
        "Will my jewellery tarnish or",
        (<>
          <p>Our jewellery is made using materials chosen for their longevity, including solid gold, gold vermeil and
            sterling silver.</p>
          <p>Solid gold will not tarnish over time. Gold vermeil offers the look of gold with a sterling silver base,
            and with proper care can maintain its finish for many years.</p>
          <p>Like all jewellery, avoiding exposure to water, chemicals and perfumes will help preserve its
            appearance.</p>
        </>),
      ], [
        "Is your jewellery suitable for sensitive skin?",
        (<>
          <p>Our jewellery is primarily made using solid gold, gold vermeil and sterling silver, materials that are
            generally well suited to sensitive skin.</p>
          <p>If you have specific sensitivities, we recommend checking the product description for full material details
            before purchasing.</p>
        </>),
      ],
    ],
  },
  {
    title: "Jewellery Care",
    items: [
      [
        "How should I care for my jewellery?",
        (<>
          <div className={" space-y-2"}>
            <p>To keep your jewellery looking its best:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Store pieces in a dry place when not in use</li>
              <li>Avoid contact with perfumes, lotions and chemicals</li>
              <li>Remove jewellery before swimming or showering</li>
              <li>Clean gently with a soft cloth when needed</li>
              <li>Silver can oxidise/tarnish over time</li>
            </ul>
            <p>Taking a little care helps preserve the finish and longevity of your jewellery.</p>
          </div>
        </>),
      ],
    ],
  },
  {
    title: "Returns and Exchanges",
    items: [
      [
        "What is your returns and exchange policy?",
        (<>
          <p>We accept returns within <strong>14 days of delivery</strong>, provided the item is returned in its
            original condition.</p>
        </>),
      ],
      [
        "Can I return earrings?",
        (<>
          <p>Due to hygiene reasons, earrings may not be eligible for return unless faulty.</p>
        </>),
      ],
      [
        "How do I start a return?",
        (<>
          <p>Full return instructions can be found in our <Link className="underline" href="/return-policy">Return
            Policy</Link>.</p>
        </>),
      ],
    ],
  }, {
    title: "Warranty and Repairs",
    items: [
      [
        "Do you offer a warranty or repairs?",
        (<>
          <Warranty/>
        </>),
      ],
    ],
  },
];

