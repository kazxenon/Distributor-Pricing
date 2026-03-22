# Distributor Price

Small web app for browsing a private Schlegel price list without committing pricing data to a public repo.

## Features

- Select a distributor and apply its discount percentage.
- Search products by `Type number`.
- Respect the workbook's `Discountable` flag.
- Apply scale pricing automatically based on quantity.
- Show MOQ guidance from `Price unit`.
- Load pricing from a private JSON file stored only in the browser.

## Public repo setup

This repo is prepared so the UI can be public while pricing stays private.

- `data/products.json` is ignored by Git.
- Excel files are ignored by Git.
- The app does not ship pricing data by default.
- Users must load a private Excel workbook or exported JSON file in the browser.

## Use Excel directly

1. Open the app.
2. On the login screen, choose your private `.xlsx` workbook.
3. Click `Load pricing file`.
4. Log in normally.

The workbook data is parsed in the browser and cached on that device only.

## Optional distributor sheet in the same Excel file

You can add a second sheet named `Distributors` to the same workbook.

Recommended columns:

- `Distributor ID`
- `Distributor Name`
- `Country`
- `Discount`

Example:

```text
Distributor ID | Distributor Name       | Country   | Discount
singapore      | Singapore Distributor  | Singapore | 15
malaysia       | Malaysia Distributor   | Malaysia  | 12.5
thailand       | Thailand Distributor   | Thailand  | 10
```

Behavior:

- Sheet 1 is still used for product pricing.
- The `Distributors` sheet is used for distributor names and discounts.
- If the `Distributors` sheet exists, the app loads that distributor list from Excel.
- If it does not exist, the app falls back to the browser-saved distributor list.

## Optional: create a private JSON file

From the app folder:

```bash
python3 scripts/export_price_list.py "../Schlegel 2023 Price List.xlsx" "data/products.json"
```

Do not commit `data/products.json`.

## Use the private pricing file

1. Open the app.
2. On the login screen, choose `data/products.json` from your device.
3. Click `Load pricing file`.
4. Log in normally.

The pricing file is cached in that browser only.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.
