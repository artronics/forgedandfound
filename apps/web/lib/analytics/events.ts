import {
  BaseCartLine,
  Cart,
  Collection,
  Order,
  Product,
  ProductVariant,
} from "@/graphql/generated/graphql";
import { pushEvent } from "@/lib/analytics/index";

/*
| Event               | When                                |
| ------------------- | ----------------------------------- |
| `view_item_list`    | Collection/category page shown      |
| `select_item`       | User clicks a product from a list   |
| `view_item`         | Product page loaded                 |
| `add_to_cart`       | Add to basket                       |
| `remove_from_cart`  | Remove from basket                  |
| `view_cart`         | Cart opened                         |
| `begin_checkout`    | Checkout starts                     |
| `add_shipping_info` | Shipping selected                   |
| `add_payment_info`  | Payment entered                     |
| `purchase`          | Order completed                     |
| `refund`            | Refund issued (usually server-side) |

 */

export function viewItem(product: Product) {
  pushEvent({
    event: "view_item",
    ecommerce: {
      currency: "GBP",
      value: Number(product.priceRange.minVariantPrice.amount),
      items: [
        {
          item_id: product.id,
          item_name: product.title,
          item_category: product.category?.name ?? "jewellery",
          item_brand: product.vendor ?? "Forged & Found",
          price: Number(product.priceRange.minVariantPrice.amount),
        },
      ],
    },
  });
}

export function viewItemList(products: Product[], collection?: Collection) {
  pushEvent({
    event: "view_item_list",
    ecommerce: {
      item_list_id: collection?.id,
      item_list_name: collection?.title,
      items: products.map((product, index) => ({
        item_id: product.id,
        item_name: product.title,
        item_category: product.category?.name ?? "jewellery",
        item_brand: product.vendor ?? "Forged & Found",
        price: Number(product.priceRange.minVariantPrice.amount),
        index: index + 1,
      })),
    },
  });
}

export function selectItem(product: Product, collection?: Collection) {
  pushEvent({
    event: "select_item",
    ecommerce: {
      item_list_id: collection?.id,
      item_list_name: collection?.title,
      items: [
        {
          item_id: product.id,
          item_name: product.title,
          item_category: product.category?.name ?? "jewellery",
          item_brand: product.vendor ?? "Forged & Found",
          price: Number(product.priceRange.minVariantPrice.amount),
        },
      ],
    },
  });
}

export function addToCart(line: BaseCartLine) {
  const variant = line.merchandise as ProductVariant;
  const product = variant.product;
  pushEvent({
    event: "add_to_cart",
    ecommerce: {
      currency: "GBP",
      value: Number(line.cost.totalAmount.amount),
      items: [
        {
          item_id: product.id,
          item_name: product.title,
          item_variant: variant.title,
          item_category: product.category?.name ?? "jewellery",
          item_brand: product.vendor ?? "Forged & Found",
          price: Number(line.cost.amountPerQuantity.amount),
          quantity: line.quantity,
        },
      ],
    },
  });
}

export function removeFromCart(line: BaseCartLine) {
  const variant = line.merchandise as ProductVariant;
  const product = variant.product;
  pushEvent({
    event: "remove_from_cart",
    ecommerce: {
      currency: "GBP",
      value: Number(line.cost.totalAmount.amount),
      items: [
        {
          item_id: product.id,
          item_name: product.title,
          item_variant: variant.title,
          item_category: product.category?.name ?? "jewellery",
          item_brand: product.vendor ?? "Forged & Found",
          price: Number(line.cost.amountPerQuantity.amount),
          quantity: line.quantity,
        },
      ],
    },
  });
}

export function viewCart(cart: Cart) {
  pushEvent({
    event: "view_cart",
    ecommerce: {
      currency: "GBP",
      value: Number(cart.cost.totalAmount.amount),
      items: cart.lines.nodes.map((line) => {
        const variant = line.merchandise as ProductVariant;
        const product = variant.product;
        return {
          item_id: product.id,
          item_name: product.title,
          item_variant: variant.title,
          item_category: product.category?.name ?? "jewellery",
          item_brand: product.vendor ?? "Forged & Found",
          price: Number(line.cost.amountPerQuantity.amount),
          quantity: line.quantity,
        };
      }),
    },
  });
}

export function beginCheckout(cart: Cart) {
  pushEvent({
    event: "begin_checkout",
    ecommerce: {
      currency: "GBP",
      value: Number(cart.cost.totalAmount.amount),
      items: cart.lines.nodes.map((line) => {
        const variant = line.merchandise as ProductVariant;
        const product = variant.product;
        return {
          item_id: product.id,
          item_name: product.title,
          item_variant: variant.title,
          item_category: product.category?.name ?? "jewellery",
          item_brand: product.vendor ?? "Forged & Found",
          price: Number(line.cost.amountPerQuantity.amount),
          quantity: line.quantity,
        };
      }),
    },
  });
}

export function addShippingInfo(cart: Cart) {
  pushEvent({
    event: "add_shipping_info",
    ecommerce: {
      currency: "GBP",
      value: Number(cart.cost.totalAmount.amount),
      items: cart.lines.nodes.map((line) => {
        const variant = line.merchandise as ProductVariant;
        const product = variant.product;
        return {
          item_id: product.id,
          item_name: product.title,
          item_variant: variant.title,
          item_category: product.category?.name ?? "jewellery",
          item_brand: product.vendor ?? "Forged & Found",
          price: Number(line.cost.amountPerQuantity.amount),
          quantity: line.quantity,
        };
      }),
    },
  });
}

export function addPaymentInfo(cart: Cart) {
  pushEvent({
    event: "add_payment_info",
    ecommerce: {
      currency: "GBP",
      value: Number(cart.cost.totalAmount.amount),
      items: cart.lines.nodes.map((line) => {
        const variant = line.merchandise as ProductVariant;
        const product = variant.product;
        return {
          item_id: product.id,
          item_name: product.title,
          item_variant: variant.title,
          item_category: product.category?.name ?? "jewellery",
          item_brand: product.vendor ?? "Forged & Found",
          price: Number(line.cost.amountPerQuantity.amount),
          quantity: line.quantity,
        };
      }),
    },
  });
}

export function purchase(order: Order) {
  pushEvent({
    event: "purchase",
    ecommerce: {
      transaction_id: order.id,
      value: Number(order.totalPrice.amount),
      tax: Number(order.totalTax?.amount ?? 0),
      shipping: Number(order.totalShippingPrice.amount),
      currency: order.currencyCode,
      items: order.lineItems.nodes.map((item) => {
        const variant = item.variant;
        const product = variant?.product;
        return {
          item_id: product?.id,
          item_name: product?.title ?? item.title,
          item_variant: variant?.title,
          item_category: product?.category?.name ?? "jewellery",
          item_brand: product?.vendor ?? "Forged & Found",
          price: Number(variant?.price.amount ?? 0),
          quantity: item.quantity,
        };
      }),
    },
  });
}

export function refund(order: Order) {
  pushEvent({
    event: "refund",
    ecommerce: {
      transaction_id: order.id,
      value: Number(order.totalRefunded.amount),
      currency: order.currencyCode,
      items: order.lineItems.nodes.map((item) => {
        const variant = item.variant;
        const product = variant?.product;
        return {
          item_id: product?.id,
          item_name: product?.title ?? item.title,
          item_variant: variant?.title,
          item_category: product?.category?.name ?? "jewellery",
          item_brand: product?.vendor ?? "Forged & Found",
          price: Number(variant?.price.amount ?? 0),
          quantity: item.quantity,
        };
      }),
    },
  });
}