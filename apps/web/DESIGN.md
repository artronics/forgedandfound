# Design System Document: High-End Editorial E-Commerce

## 1. Overview & Creative North Star

### Creative North Star: "The Modern Heirloom"

This design system rejects the "templated" nature of standard e-commerce. Instead, it treats the digital interface as a
curated gallery space. By blending the raw, grounded tones of Emerald Green and Almond with the airy sophistication of
Noto Serif and Inter, we create an experience that feels both "Forged" (artisanal, structural) and "Found" (discovered,
rare).

The system breaks the rigid grid through **Intentional Asymmetry**. Product images should rarely be perfectly uniform;
we utilize varying aspect ratios and "editorial whitespace" to allow the jewellery pieces to breathe. Overlapping
elements—such as a serif headline partially masking a high-definition product shot—create a sense of physical layering
and depth that standard flat layouts lacks.

---

## 2. Colors

The palette is rooted in organic luxury, moving away from harsh pure blacks or whites. It utilizes a sophisticated
Material-based tonal scale to define hierarchy.

### Core Palette

* **Emerald Green (`primary` / `#464836`):** Our foundational weight. Used for main brand actions and high-contrast
  typography.
* **Satin Linen (`surface` / `#fafbe1`):** The primary canvas. It provides a warmer, more premium feel than standard
  `#ffffff`.
* **Champagne & Almond (`secondary` / `#6f5a4d` & `tertiary` / `#4b463b`):** Used for supporting elements, secondary
  CTAs, and tonal layering.

### The "No-Line" Rule

To maintain a high-end editorial feel, **1px solid borders are strictly prohibited** for sectioning. Boundaries must be
defined through:

* **Background Shifts:** Transitioning from `surface` to `surface-container-low` to define a new section (e.g., the
  footer or a featured carousel).
* **Tonal Transitions:** Using the `surface-variant` (`#e3e4cb`) to subtly distinguish the header from the main
  viewport.

### Surface Hierarchy & Nesting

Treat the UI as physical layers of fine paper.

* **Level 0 (Canvas):** `surface` (`#fafbe1`)
* **Level 1 (Sectioning):** `surface-container-low` (`#f5f5db`)
* **Level 2 (Cards/Interactive):** `surface-container-lowest` (`#ffffff`) placed atop Level 1 to create a natural, "
  lifted" appearance without heavy shadows.

### The "Glass & Gradient" Rule

For floating elements like sticky navigation or quick-buy overlays, use **Glassmorphism**:

* **Token:** `primary-container` (`#5e604c`) at 80% opacity with a `backdrop-blur-md` effect.
* **Signature Texture:** Main CTAs should use a subtle linear gradient from `primary` to `primary-container` (Emerald
  Green tones) to give buttons a "gemstone" depth.

---

## 3. Typography

The typography strategy is a dialogue between the classical (Serif) and the functional (Sans).

### Headline Scales (Noto Serif)

* **Display-lg (3.5rem):** Reserved for hero editorial moments. High tracking (letter-spacing: -0.02em).
* **Headline-md (1.75rem):** Used for product category titles. It conveys authority and craftsmanship.

### Body & Label Scales (Inter)

* **Body-lg (1rem):** Standard product descriptions. High line-height (1.6) for maximum readability.
* **Label-md (0.75rem):** Used for technical specs, material types, and secondary metadata. Often rendered in uppercase
  with 0.1em letter spacing for a "technical luxury" feel.

---

## 4. Elevation & Depth

### The Layering Principle

We achieve depth through **Tonal Layering**. Instead of a shadow, a `surface-container-high` card sitting on a `surface`
background creates a sophisticated, soft-touch separation.

### Ambient Shadows

Where floating depth is required (e.g., Cart Drawer, Modals):

* **Blur:** 24px - 40px.
* **Opacity:** 4% - 6% of the `on-surface` color (`#1b1d0d`).
* **Logic:** Shadows must feel like ambient light hitting a matte surface, not a digital drop-shadow.

### The "Ghost Border" Fallback

If a border is required for accessibility (e.g., Input fields):

* Use `outline-variant` (`#c8c7bc`) at **15% opacity**. High-contrast, 100% opaque borders are strictly forbidden.

---

## 5. Components

### Buttons (Tailwind/Shadcn)

* **Primary:** Emerald Green gradient (`primary` to `primary-container`). White text. `rounded-sm`.
* **Secondary:** Satin Linen background with a Ghost Border of Emerald Green. `on-surface` text.
* **Tertiary/Link:** Underlined `on-surface` text with a 2px offset. No container.

### Product Cards

* **Structure:** No borders or dividers.
* **Imagery:** Use `aspect-[4/5]` for a taller, more editorial look.
* **Separation:** Vertical whitespace (using the `2xl` spacing token) separates the image from the product title.

### Input Fields

* **Style:** Minimalist. Background: `surface-container-low`.
* **Focus State:** Transition background to `surface-container-highest` with a 1px `primary` Ghost Border (20% opacity).
  No heavy glow.

### Signature Component: The "Editorial Reveal"

A custom Shadcn-based hover state for images where the secondary product shot (the "Found" lifestyle shot) fades in with
a 0.8s ease-in-out transition, replacing the "Forged" (studio shot).

---

## 6. Do's and Don'ts

### Do's

* **DO** use generous whitespace (margins of 80px+ on desktop) to imply luxury.
* **DO** mix serif and sans-serif within the same component (e.g., Serif for Price, Sans for "Add to Cart").
* **DO** use Emerald Green as a "flood" color for high-impact sections like the Newsletter signup to break the
  light-mode monotony.

### Don'ts

* **DON'T** use 1px dividers to separate list items. Use 16px of vertical padding and tonal shifts instead.
* **DON'T** use `rounded-full` (pill shapes) for buttons. Use `rounded-sm` (0.125rem) to maintain a sharp, "forged"
  architectural feel.
* **DON'T** use pure #000000 for text. Use `on-surface` (#1b1d0d) to keep the contrast soft and high-end.