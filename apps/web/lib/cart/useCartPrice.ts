type CartPrice = {
  totalAmount: {
    amount: number
  };
  subtotalAmount: {
    amount: number
  }
  subtotalAmountEstimated: boolean
}

export function useCartPrice(price?: CartPrice) {
  const format = (p: number) => new Intl.NumberFormat("en-UK", {
    style: "currency",
    currency: "GBP",
  }).format(p);

  if (!price) return {total: "", subtotal: "", subtotalEstimated: false};
  const {totalAmount, subtotalAmount, subtotalAmountEstimated} = price;

  return {
    total: format(totalAmount.amount),
    subtotal: format(subtotalAmount.amount),
    subtotalEstimated: subtotalAmountEstimated,
  };
}