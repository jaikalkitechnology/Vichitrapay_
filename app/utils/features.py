"""Feature switches read from the environment."""
import os

# Partner panel / partner login. Off by default; set PARTNER_PANEL_ENABLED=true to turn it on.
PARTNER_PANEL_ENABLED = os.getenv("PARTNER_PANEL_ENABLED", "false").strip().lower() in ("1", "true", "yes")

PARTNER_DISABLED_MSG = "Partner login is not available"
