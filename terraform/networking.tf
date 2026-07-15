module "networking" {
  source      = "./networking"
  root_domain = var.root_domain
  aws_account = var.aws_account
  vercel_cname = ["c99284151c832333.vercel-dns-016.com"]
  shopify_cname = ["shops.myshopify.com"]
}
