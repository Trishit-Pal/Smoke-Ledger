# EU catalog prices (French legal retail, 1 September 2026)

Seed prices for `smoke_seed.brand_catalog` rows with `market = 'EU'` are the legal French pack price in euros, stored in `avg_price_inr`. They are one default for every EU country, not a national price outside France. Users can override a variant; an override sets `price_count = 1`, so `refresh_seed_prices_from_catalog` leaves it alone.

Source: nomenclature homologuée in force 1 September 2026.

https://www.douane.gouv.fr/sites/default/files/2026-08/12/Maquette%20JORF%201er%20septembre%202026.pdf

The onboarding stick hint (`0.6525`) is the median of these 14 pack prices divided by 20.
