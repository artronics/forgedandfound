# Protected deployment — the permanent test env; Vercel Preview points here.
# The only deployment wired to the prv infra environment.
# (Destroy protection is enforced by the Taskfile guard.)
vercel_alias_target = ["preview.forgedandfound.co.uk"]
extra_app_urls      = ["https://preview.forgedandfound.co.uk"]
