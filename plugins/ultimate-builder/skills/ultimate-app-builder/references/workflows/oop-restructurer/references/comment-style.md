---
name: comment-style
description: House comment style for restructured code — exact separator widths, file headers, per-function doc blocks, and a worked example.
---

# House Comment Style

Referenced by `oop-restructurer` (Phase 3) and `sw-developer` (Coding Standards).
Apply to EVERY restructured file. The widths are not approximate.

## Separator widths (exact)

| Width | Character | Used for |
|---|---|---|
| 77 | `=` | File header block, double separator before functions, end of file |
| 37 | `-` | Section separators (logic groups) |
| 34 | `-` | Before every `if` / `elif` / `else` |
| 22 | `-` | Minor separators inside a logic group |

Count the characters. A 76- or 78-wide rule is a defect, not a rounding.

## The eight rules

1. **File header block** — `=` x77 separators enclosing date, description, author.
2. **Imports** — wrapped with separators and introduced by `# Importing the libraries`.
3. **Class doc block** — before every class.
4. **Function header** — a *double* 77-wide separator before EVERY function/method,
   carrying the signature summary in `-> input type to output type` form.
5. **Docstring** — triple-quoted, after every `def`, listing each parameter.
6. **Branch separator** — 34-wide before EVERY `if` / `elif` / `else`.
7. **Logic grouping** — 37-wide section separators, 22-wide minor separators.
8. **End of file** — double 77-wide separator.

## Worked example

```python
# =============================================================================
# =============================================================================
# File        : order_total_calculator.py
# Date        : 2026-08-16
# Description : Calculates order totals including tax and discounts.
# Author      : Lyra
# =============================================================================
# =============================================================================


# -------------------------------------
# Importing the libraries
# -------------------------------------
from decimal import Decimal
from typing import Iterable
# -------------------------------------


# =============================================================================
# Class : OrderTotalCalculator
# Role  : Turns a basket of line items into a final payable amount.
# Notes : Pure computation. No I/O, no persistence, no logging side effects.
# =============================================================================
class OrderTotalCalculator:

    # =============================================================================
    # =============================================================================
    # calculate -> Iterable[LineItem], Decimal to Decimal
    # =============================================================================
    # =============================================================================
    def calculate(self, items: Iterable["LineItem"], tax_rate: Decimal) -> Decimal:
        """Return the payable total for *items* at *tax_rate*.

        Parameters
        ----------
        items : Iterable[LineItem]
            Basket contents. An empty basket is legal and yields Decimal("0").
        tax_rate : Decimal
            Fractional rate, e.g. Decimal("0.20") for 20 percent.

        Returns
        -------
        Decimal
            Total rounded to two places, tax included.
        """

        # -------------------------------------
        # Accumulate the untaxed subtotal
        # -------------------------------------
        subtotal = Decimal("0")

        for item in items:

            # ----------------------
            subtotal += item.unit_price * item.quantity
            # ----------------------

        # ----------------------------------
        if subtotal == 0:
        # ----------------------------------
            return Decimal("0.00")

        # ----------------------------------
        elif subtotal < Decimal("25"):
        # ----------------------------------
            subtotal += self.SMALL_BASKET_FEE

        # ----------------------------------
        else:
        # ----------------------------------
            subtotal -= self._volume_discount(subtotal)

        # -------------------------------------
        # Apply tax and round
        # -------------------------------------
        return (subtotal * (1 + tax_rate)).quantize(Decimal("0.01"))


# =============================================================================
# =============================================================================
```

## Applying it to non-Python languages

Keep the widths and the block structure; swap the comment token
(`//` for JS/TS/Go/Java/C, `#` for Python/Ruby/Shell). The docstring rule becomes
the language's standard doc format (JSDoc, godoc, Javadoc) and must still list
every parameter.

## What this style is not

It does not license restating the code. The separators mark structure; the prose
must still carry only non-obvious WHY — hidden constraints, invariants, and bug
workarounds — exactly as `sw-developer` requires.
