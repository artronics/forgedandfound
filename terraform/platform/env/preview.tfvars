# Protected deployment — Vercel's Preview environment points here. The only
# deployment wired to the prv infra environment.
# (Destroy protection is enforced by the Taskfile guard.)
vercel_alias   = true
extra_app_urls = ["https://preview.forgedandfound.co.uk"]
