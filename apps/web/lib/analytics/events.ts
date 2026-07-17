import {Product, ProductVariant} from "@/graphql/generated/graphql";
import {pushEvent} from "@/lib/analytics/index";

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

export function viewItem(product: ProductVariant) {
  pushEvent({
    event: "view_item",
    ecommerce: {
      currency: "GBP",
      value: Number(product.price.amount),
      items: [
        {
          item_id: product.id,
          item_name: product.title,
          item_category: product.product.category,
          item_brand: "Forged & Found",
          price: Number(product.price.amount),
        },
      ],
    },
  });
}