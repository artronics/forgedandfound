# Prod migration is deferred. aws_account_ids.prod must be set before anything
# can be applied against prod — the provider's allowed_account_ids rejects
# every apply until then. Pre-existing Vercel/Shopify/SES records in the root
# zone are removed out-of-band first so terraform owns its own; Google
# Workspace records (apex MX, google._domainkey, ...) are left alone.
