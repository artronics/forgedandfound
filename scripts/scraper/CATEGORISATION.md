# Product Categorisation & Terminology

Domain model for classifying jewellery products in the Shopify (headless) catalogue.
This document is the human-readable reference; [`taxonomy.json`](taxonomy.json) is the
machine-readable version the scraper uses to normalise third-party terminology into ours.

## 1. Research summary

Vocabulary was collected from the navigation/collection structures of:
Mejuri, Monica Vinader, Missoma, Astrid & Miyu, Daisy London, Otiumberg, Astley Clarke
(UK demi-fine segment), and Brilliant Earth, Gabriel & Co, David Yurman, Foundrae
(fine/bridal segment). Key observations:

- **Everyone splits by the same four product types** — necklaces, earrings, rings,
  bracelets — then subdivides by *physical form*: Missoma (Chains / Chokers / Pendants /
  T-Bar), David Yurman (Chain / Pearl / Pendant / Lariat), Astley Clarke (Locket /
  Station / Chain / Pendant), Daisy London (Stacking / Chain / Band / Signet).
  This confirms our **Design** axis is the industry's primary browse structure.
- **Subjective styling words appear as secondary edits/filters**, not primary nav:
  Daisy London ("Chunky", "Bold", "Organic", "Textured"), Missoma ("Molten",
  "Everyday Essentials", "The Talisman Edit"), Astley Clarke ("Celestial"),
  Gabriel & Co ("Classic", "Contemporary", "Vintage Inspired"). This confirms
  **Style** as a cross-category tag axis.
- **Materials are always a separate facet**, phrased in the UK as
  *18ct Gold Vermeil / 18ct Gold Plated / Sterling Silver / 14ct Solid Gold*
  (Missoma, Astley Clarke, Otiumberg, Daisy London all use this exact ladder).
  US brands say "14k"; UK brands say "14ct" — we standardise on **ct**.
- **Bridal/fine brands add stone dimensions**: shape (Round, Oval, Pear, …),
  setting (Solitaire, Halo, Bezel, Three Stone, Hidden Halo — Brilliant Earth,
  Gabriel & Co), and gemstone type. We adopt these as optional stone facets.
- Synonym collisions worth deciding once: *Bold = Chunky* (Mejuri "Bold Hoops" ≈
  Daisy "Chunky"), *Statement* is used both as a ring design (Missoma "Statement
  Rings" ≈ cocktail) and as a style (≈ chunky), *Huggies = Mini Hoops*,
  *Choker = Collar* (Foundrae "Sleek Collars"), *Drop = Dangle*,
  *Three Stone = Trilogy* (UK) *= Toi et Moi* (loosely, two-stone).

## 2. The model

| Facet | Axis type | Cardinality | Shopify representation | Storefront API filter |
|---|---|---|---|---|
| `category` | physical | one | `product_type` (+ 4 top-level collections) | `productType` |
| `design` | physical, category-scoped | one | **automated collection** per category×design, driven by tag `design:<id>` | `tag` / collection handle |
| `style` | subjective, cross-category | many | tag `style:<id>` | `tag` |
| `material` | attribute | one | metafield `custom.material` | `productMetafield` |
| `metal_colour` | attribute | one | metafield `custom.metal_colour` | `productMetafield` |
| `purity` | attribute | one | metafield `custom.purity` | `productMetafield` |
| `gemstone` | attribute | many | metafield `custom.gemstones` (list) | `productMetafield` |
| `stone_shape` | attribute | many | metafield `custom.stone_shapes` (list) | `productMetafield` |
| `setting` | attribute | one | metafield `custom.setting` | `productMetafield` |
| `chain_type` | attribute | one | metafield `custom.chain_type` | `productMetafield` |

Principles:

- **Design is exclusive** — a product has exactly one design (the shape you'd name
  first). A chain necklace with a pendant on it is a *Pendant*, not a *Chain*.
- **Style is additive** — zero or more tags (`style:chunky`, `style:organic`).
- **Design terms live under a category**; the same word can exist in two categories
  as two distinct terms (`necklace/chain` and `bracelet/chain`) with their own
  collections (`chain-necklaces`, `chain-bracelets`).
- Tags are namespaced (`design:`, `style:`) so free-form merchandising tags never
  collide with the model. Automated collections use the tag rule
  (`product_type = Necklace AND tag = design:choker`), which keeps collection
  membership derivable from product data alone — important for headless, where a
  collection is a query, not a menu entry.
- Attributes are **metafields, not tags**, because they are typed, hold lists, and
  are directly filterable in the Storefront API (`productMetafield` filters) and in
  Search & Discovery.

### Canonicalisation rule for the scraper

When a scraped product uses any synonym, register the **canonical id**. E.g. a
"Bold Ring" → `style:chunky`; a "Collar Necklace" → `design:choker`; "3-stone" →
`setting: three-stone`. Matching order: exact synonym match (case/diacritic-folded)
→ embedding similarity against `label + synonyms + definition` (see `taxonomy.json`)
→ leave unclassified (`other`) rather than guess.

> Note: the scraper currently writes `data/products/earings/…`; the canonical
> category id is **`earring`** — fix the spelling when wiring the taxonomy in.

---

## 3. Categories

Canonical ids: `ring`, `necklace`, `earring`, `bracelet`.
(Extensions seen in research, for later: anklets, charms, body/piercing jewellery.)

---

## 4. Designs (→ collections)

### 4.1 Necklace designs

### Chain
A necklace whose interest is the links themselves; worn alone or as a layering base
(Missoma "Chain Necklaces", Monica Vinader "Chains", David Yurman "Chain"). The link
pattern is captured separately in `chain_type`.
#### Synonyms:
    Chain
    Link Necklace
    Layering Chain

### Choker
Short necklace sitting tight at the base of the neck (roughly 14–16" / 35–40cm)
(Missoma "Chokers", Foundrae "Sleek Collars").
#### Synonyms:
    Choker
    Collar
    Torque

### Pendant
A chain carrying a single focal drop — coin, medallion, amulet, tag, cross, initial
(Missoma "Coin & Pendant", Astley Clarke "Pendant Necklaces", Foundrae "Medallions").
#### Synonyms:
    Pendant
    Medallion
    Coin Necklace
    Amulet
    Tag Necklace
    Charm Necklace

### Locket
Pendant that opens to hold a photo or keepsake (Astley Clarke "Lockets").
#### Synonyms:
    Locket

### Lariat
Open-ended necklace that drapes or pulls through itself in a Y shape
(Otiumberg "Lariat Necklace", David Yurman "Lariat").
#### Synonyms:
    Lariat
    Y-Necklace
    Wrap Necklace

### Station
Chain with gems or motifs spaced at intervals along its length
(Astley Clarke "Station Necklaces").
#### Synonyms:
    Station
    Satellite
    By-the-Yard

### Tennis Necklace
Continuous line of uniformly set stones around the whole length
(Missoma "Tennis Necklaces", Mejuri "Tennis Jewelry").
#### Synonyms:
    Tennis
    Rivière
    Line Necklace

### Beaded Necklace
Strung beads or pearls rather than metal links (David Yurman "Bead",
Missoma "Beaded").
#### Synonyms:
    Beaded
    Bead Necklace
    Pearl Strand
    String Necklace

### T-Bar
Chain fastened or decorated with a horizontal bar toggle at the front
(Missoma "T-Bar Jewellery", Daisy London "T Bar Necklaces").
#### Synonyms:
    T-Bar
    Toggle Necklace

### 4.2 Ring designs

### Band
Continuous metal band without a focal stone; includes wide cigar and bookend bands
(Daisy London "Band Rings", David Yurman "Band", Foundrae "Cigar Bands").
#### Synonyms:
    Band
    Cigar Band
    Wedding Band
    Plain Band

### Signet
Flat-faced ring, traditionally engravable (Missoma, Daisy London, Foundrae,
Otiumberg — universal term).
#### Synonyms:
    Signet
    Seal Ring
    Crest Ring

### Stacking
Slim ring designed to be worn in combination (Missoma, Daisy London,
Astley Clarke "Stacking Rings", Foundrae "Stacking Bands").
#### Synonyms:
    Stacking
    Stackable
    Skinny Ring

### Eternity
Stones set uniformly all (or half) the way around the band (Missoma
"Eternity & Wedding", Astley Clarke, Gabriel & Co "Eternity Wedding Bands").
#### Synonyms:
    Eternity
    Infinity Band
    Half Eternity
    Tennis Ring

### Solitaire
Single focal stone on a plain band (Brilliant Earth, Gabriel & Co "Solitaire").
#### Synonyms:
    Solitaire
    Single Stone

### Halo
Centre stone encircled by smaller pavé stones (Brilliant Earth "Halo",
"Hidden Halo", Gabriel & Co "Double Halo").
#### Synonyms:
    Halo
    Hidden Halo
    Double Halo

### Three Stone
Three (or paired) stones in a row; "trilogy" in UK usage (Brilliant Earth
"Three Stone", Gabriel & Co "Toi et Moi").
#### Synonyms:
    Three Stone
    Trilogy
    Toi et Moi
    Two Stone

### Cluster
Multiple small stones grouped into one motif (Gabriel & Co "Cluster").
#### Synonyms:
    Cluster
    Cluster Ring

### Cocktail
Oversized decorative ring with a dominant stone or motif (Missoma
"Cocktail Rings", Astley Clarke, Gabriel & Co).
#### Synonyms:
    Cocktail
    Statement Ring
    Dress Ring

### Dome
Rounded, puffed profile with no stones as the focus (Mejuri "Dôme",
Astrid & Miyu "Dome", dlouise "Dome Ring").
#### Synonyms:
    Dome
    Bombé
    Croissant
    Chunky Dome

### Chain Ring
Flexible ring made of chain links (Daisy London "Chain Rings").
#### Synonyms:
    Chain Ring

### Open Ring
Band with a deliberate gap or wrap; often adjustable (Missoma "Open Rings").
#### Synonyms:
    Open
    Adjustable Ring
    Wrap Ring
    Cuff Ring

### Pinky
Small-sized ring styled for the little finger (David Yurman "Pinky",
"Pavé Pinky").
#### Synonyms:
    Pinky
    Little Finger Ring

### 4.3 Earring designs

### Stud
Sits directly on the lobe on a post (universal: Missoma, Gabriel & Co,
Astley Clarke, Foundrae "Studs").
#### Synonyms:
    Stud
    Post Earring
    Solitaire Earring

### Hoop
Closed circular earring, from small to XL (Missoma "Hoop Earrings",
Mejuri "Bold Hoops", Astrid & Miyu "XL Hoops").
#### Synonyms:
    Hoop
    Creole

### Huggie
Small hinged hoop that hugs the lobe (Missoma "Mini Hoops & Huggies",
Astrid & Miyu "Huggies", Astley Clarke "Huggies").
#### Synonyms:
    Huggie
    Mini Hoop
    Hinged Hoop
    Huggie Hoop

### Drop
Hangs below the lobe with movement (Missoma, David Yurman, Daisy London,
Foundrae "Drop").
#### Synonyms:
    Drop
    Dangle
    Pendant Earring

### Chandelier
Multi-tiered, elaborate drop (fine-jewellery standard term).
#### Synonyms:
    Chandelier
    Statement Drop

### Ear Cuff
Clamps onto the ear, no piercing needed (Missoma, Astrid & Miyu,
Daisy London, Gabriel & Co "Ear Cuffs").
#### Synonyms:
    Ear Cuff
    Cuff Earring

### Climber
Runs up the ear line from the lobe (industry standard "ear climber").
#### Synonyms:
    Climber
    Crawler
    Ear Climber

### Threader
Fine chain pulled through the piercing (industry standard term).
#### Synonyms:
    Threader
    Pull-Through
    Chain Earring

### 4.4 Bracelet designs

### Chain Bracelet
Linked-metal bracelet; link pattern in `chain_type` (Missoma, Daisy London
"Chain Bracelets", David Yurman "Curb Chain").
#### Synonyms:
    Chain
    Link Bracelet

### Bangle
Rigid closed circle, slips over the hand (Missoma "Bangles", Gabriel & Co
"Bangle Bracelets", Astley Clarke).
#### Synonyms:
    Bangle

### Cuff
Rigid with an opening at the back (Missoma "Cuff Bracelets", David Yurman
"Cuff").
#### Synonyms:
    Cuff
    Open Bangle
    Torque Bangle

### Tennis Bracelet
Continuous line of uniformly set stones (Missoma, Gabriel & Co
"Tennis Bracelets").
#### Synonyms:
    Tennis
    Line Bracelet
    Rivière Bracelet

### Charm Bracelet
Carries one or more hanging charms (Missoma, Otiumberg "Charm Bracelets").
#### Synonyms:
    Charm

### Beaded Bracelet
Strung beads or pearls (David Yurman "Bead", Gabriel & Co "Beaded
Bracelets").
#### Synonyms:
    Beaded
    Bead Bracelet
    Pearl Bracelet

### Cord
Fabric/leather cord, often with a metal motif (David Yurman "Cord & Leather").
#### Synonyms:
    Cord
    Friendship Bracelet
    Leather Bracelet
    String Bracelet

---

## 5. Styles (→ tags, cross-category)

### Chunky
Visually heavy, wide or thick proportions (Daisy London "Chunky"/"Bold",
Mejuri "Bold" line, Missoma "Oversized Studs").
#### Synonyms:
    Chunky
    Bold
    Oversized
    Statement
    XL

### Dainty
Small-scale and fine in proportion (Mejuri/US usage "dainty";
UK brands say "delicate"/"fine").
#### Synonyms:
    Dainty
    Delicate
    Fine
    Petite
    Mini
    Skinny

### Minimalist
Clean, unadorned, geometric-simple; about restraint rather than size
(Mejuri brand positioning; "sleek" — Foundrae "Sleek Collars").
#### Synonyms:
    Minimalist
    Minimal
    Simple
    Sleek
    Clean
    Essential

### Classic
Conventional forms that don't date — plain bands, solitaires, pearls
(Gabriel & Co "Classic", ubiquitous "timeless").
#### Synonyms:
    Classic
    Timeless
    Traditional
    Iconic

### Modern
Contemporary, design-led, architectural (Gabriel & Co "Contemporary").
#### Synonyms:
    Modern
    Contemporary
    Architectural
    Abstract

### Vintage
Antique-inspired detailing — milgrain, filigree, old cuts (Brilliant Earth
"Antique & Vintage", Gabriel & Co "Vintage Inspired").
#### Synonyms:
    Vintage
    Antique
    Vintage-Inspired
    Retro
    Heirloom
    Estate
    Art Deco

### Organic
Fluid, irregular, molten or nature-derived forms (Missoma "Molten",
Daisy London "Organic", Astrid & Miyu "Molten").
#### Synonyms:
    Organic
    Molten
    Sculptural
    Fluid
    Wave
    Nature-Inspired

### Textured
Visible surface work — hammered, ridged, ribbed, twisted (Daisy London
"Textured").
#### Synonyms:
    Textured
    Hammered
    Ridged
    Ribbed
    Twisted
    Beaded-Texture

### Geometric
Angular shapes as the motif — bars, hexagons, squares.
#### Synonyms:
    Geometric
    Angular
    Bar
    Hexagon

### Celestial
Star, moon, sun, constellation motifs (Astley Clarke "Celestial",
Astrid & Miyu "Cosmic", "Orbit").
#### Synonyms:
    Celestial
    Cosmic
    Star
    Moon
    Constellation
    Astral

### Romantic
Hearts, bows, ribbons, love symbolism (Foundrae "Heart", "True Love";
David Yurman heart pendants).
#### Synonyms:
    Romantic
    Heart
    Love
    Bow
    Ribbon

### Talisman
Symbolic or protective motifs — evil eye, amulets, zodiac, chakra
(Missoma "The Talisman Edit", Foundrae tenets, Astley Clarke "Evil Eye",
Daisy London "Chakra"/"Healing Stone").
#### Synonyms:
    Talisman
    Symbolic
    Amulet
    Evil Eye
    Protection
    Spiritual
    Chakra
    Zodiac

### Personalised
Made individual — initials, engraving, names, birthstones (Missoma
"Initial"/"Engravable", Otiumberg "Name & Date", Daisy London
"Personalised").
#### Synonyms:
    Personalised
    Engravable
    Initial
    Letter
    Monogram
    Custom
    Name
    Birthstone

### Everyday
Low-key staples meant for constant wear (Missoma "Everyday Essentials",
Mejuri "everyday fine jewelry", A&M/dlouise "waterproof" positioning).
#### Synonyms:
    Everyday
    Essential
    Staple
    Basic
    Capsule
    Waterproof

### Boho
Relaxed, beachy, festival-leaning — shells, cords, mixed beads.
#### Synonyms:
    Boho
    Bohemian
    Beachy
    Festival

---

## 6. Dimensions (→ metafields)

### 6.1 Material (`custom.material`, one of)

| Canonical | Synonyms / notes |
|---|---|
| Solid Gold | 14ct Solid Gold, Recycled Gold, real gold (purity captured separately) |
| Gold Vermeil | Vermeil — thick gold layer on sterling silver (Missoma, Monica Vinader, Otiumberg core material) |
| Gold Plated | 18ct Gold Plate, PVD Gold, gold tone — gold layer on brass/steel (Daisy London, Astrid & Miyu) |
| Sterling Silver | 925 Silver, Recycled Sterling Silver |
| Platinum | — (bridal segment) |
| Stainless Steel | 316L Steel, Titanium, PVD-coated steel — "waterproof" brands (dlouise) |
| Mixed Metal | Two Tone, Mixed Metals |

### 6.2 Metal colour (`custom.metal_colour`, one of)
`Yellow Gold` · `White Gold` · `Rose Gold` (pink gold) · `Silver` · `Two-Tone`

### 6.3 Purity (`custom.purity`, one of)

| Canonical | Synonyms |
|---|---|
| 18ct | 18k, 750 |
| 14ct | 14k, 585 |
| 9ct | 9k, 375 |
| Sterling Silver | 925 |

UK convention is **ct**; scraper must normalise `k → ct`. Purity applies to the gold
layer for vermeil/plated pieces (e.g. "18ct Gold Vermeil" → material=Gold Vermeil,
purity=18ct).

### 6.4 Gemstones (`custom.gemstones`, list)
Diamond (incl. white diamond) · Lab-Grown Diamond (created/cultivated diamond) ·
Moissanite · Cubic Zirconia (CZ, crystal, diamond-inspired, diamond simulant) ·
Pearl (freshwater, keshi, baroque, seed pearl) · Sapphire · Emerald · Ruby ·
Amethyst · Aquamarine · Topaz (incl. blue topaz) · Citrine · Garnet · Peridot ·
Opal · Moonstone · Turquoise · Malachite · Lapis Lazuli · Mother of Pearl ·
Onyx (black spinel) · Enamel (technically a surface material — kept here as an
"accent" value because brands merchandise it like a stone colour; Foundrae
"Enamel & Ceramic").

### 6.5 Stone shape / cut (`custom.stone_shapes`, list)
Round (round brilliant) · Oval · Pear (teardrop) · Marquise (navette) ·
Emerald Cut (rectangular step cut) · Cushion (incl. elongated cushion) ·
Princess (square) · Radiant · Asscher · Heart · Baguette · Trillion ·
Rose Cut · Cabochon · Briolette
(Source: Brilliant Earth and Gabriel & Co shape selectors.)

### 6.6 Setting (`custom.setting`, one of)
| Canonical | Synonyms |
|---|---|
| Claw | Prong, 4-claw, 6-prong (UK says claw — dlouise "Classic Claw") |
| Bezel | Rubover, rub-over |
| Pavé | Micro-pavé, pave |
| Channel | — |
| Flush | Gypsy, burnish |
| Tension | Floating |

(Halo / Cluster / Three Stone are ring *designs*, not settings, in our model.)

### 6.7 Chain type (`custom.chain_type`, one of)
Curb (Cuban) · Cable (trace) · Belcher (rolo) · Box (venetian) · Rope (twisted) ·
Figaro · Herringbone · Snake · Paperclip (rectangular link, staple chain) ·
Ball (bead chain) · Byzantine

### 6.8 Length & size vocabulary (variants, not filters)
Reference for interpreting scraped copy — store on variants:
- Necklace lengths: **Choker** 14–16" (35–40cm) · **Princess** 17–19" (45cm, the
  default) · **Matinee** 20–24" · **Opera** 28–36" · **Rope** 36"+
- Ring sizes: UK letters (H–Z); scraped US numeric sizes should keep the original
  plus a UK conversion when present (dlouise lists "US 7 / UK N / EU 54").
- Bracelets: S/M/L or cm; note "adjustable".

---

## 7. Shopify implementation

1. **Category** → `product_type` = `Ring | Necklace | Earring | Bracelet`, plus four
   automated top-level collections (`rings`, `necklaces`, `earrings`, `bracelets`)
   keyed on product type. Also set Shopify's standard product taxonomy category for
   marketplace/feed benefits.
2. **Design** → tag `design:<id>` on the product (exactly one), plus one automated
   collection per category×design, e.g. handle `chokers`
   (rule: `product_type = Necklace AND tag = design:choker`); where a design name
   repeats across categories use suffixed handles (`chain-necklaces`,
   `chain-bracelets`). Collections exist for querying/SEO/filtering — the headless
   menu chooses which to surface.
3. **Style** → tags `style:<id>` (zero or more). Filterable headlessly via the
   Storefront API `tag` filter and in Search & Discovery.
4. **Dimensions** → metafield definitions as in §6 (namespace `custom`), each with
   "Filterable" enabled in Search & Discovery. Query headlessly with
   `productMetafield` filters, e.g.:

   ```graphql
   collection(handle: "rings") {
     products(first: 24, filters: [
       {tag: "style:chunky"},
       {productMetafield: {namespace: "custom", key: "material", value: "Gold Vermeil"}}
     ]) { ... }
   }
   ```

5. **Scraper contract**: every seeded product carries `category`, `design`,
   `styles[]`, and whatever dimensions were extractable, all as canonical ids from
   `taxonomy.json`. Unmatched vocabulary → omit rather than guess; log the source
   term so the taxonomy can grow.
