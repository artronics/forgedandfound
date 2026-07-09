type VariantPrice = {
  price: {
    amount: number;
  };
  compareAtPrice: {
    amount: number;
  } | null;
}

export function useVariantPrice(variants: VariantPrice | VariantPrice[]) {
  // TODO: add logic for price range when multiple variants are available

  const format = (p: number) => new Intl.NumberFormat("en-UK", {
    style: "currency",
    currency: "GBP",
  }).format(p);

  const selectedVariant = Array.isArray(variants) ? variants[0] : variants;
  if (!selectedVariant) return {price: "", compareAtPrice: ""};

  const price = selectedVariant.price.amount;
  const compareAtPrice = selectedVariant.compareAtPrice?.amount ?? null;

  return {
    price: format(price),
    compareAtPrice: compareAtPrice ? format(compareAtPrice) : "",
  };
}