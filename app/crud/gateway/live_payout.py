from decimal import Decimal, ROUND_HALF_UP

GST_RATE = Decimal("0.18")
THRESHOLD = Decimal("1000.00")


def quantize2(v: Decimal) -> Decimal:
    return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_payout_charges(amount: Decimal, settings):
    """
    Rules:
    - amount <= 1000  -> flat charge
    - amount > 1000   -> percentage charge
    - GST @18% on charges
    """

    amount = quantize2(amount)

    # -------- CHARGES --------
    if amount <= THRESHOLD:
        charges = Decimal(str(settings.payOutChargesFlat))
    else:
        # payOutCharges is percentage, e.g. 1.5 => 1.5%
        charges = amount * (Decimal(str(settings.payOutCharges)) / Decimal("100"))

    charges = quantize2(charges)

    # -------- GST --------
    gst = quantize2(charges * GST_RATE)

    # -------- TOTAL DEBIT --------
    total = quantize2(amount + charges + gst)

    return charges, gst, total
