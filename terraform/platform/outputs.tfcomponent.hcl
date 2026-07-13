output "shopify_event_bus_arn" {
  type  = string
  value = component.shopify_events.event_bus_arn
}

output "shopify_product_queue_url" {
  type  = string
  value = component.shopify_events.product_queue_url
}
