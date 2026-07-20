# Prod migration is deferred. Pre-existing Vercel/Shopify/SES records in the
# root zone are removed out-of-band first so terraform owns its own; Google
# Workspace records (apex MX, google._domainkey, ...) are left alone.
