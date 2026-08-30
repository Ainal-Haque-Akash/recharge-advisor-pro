# Recharge Advisor Pro

Build a fully interactive, dynamic React (TypeScript) dashboard for a prepaid meter recharge advisor. Use Tailwind CSS for styling and react-plotly.js for charts. The app must work without a backend – embed the provided JSON dataset as mock data (all 25 cases) and implement all simulation logic on the client side. Keep dependencies minimal: react, react-plotly.js, date-fns, and tailwindcss. No authentication, no databases, no serverless functions – everything runs in the browser.

Core Features (interactive):

Case Selector – Dropdown list of case IDs. When a user picks a case, all views update with a smooth fade/transition.

Balance History Chart (Plotly):

Line chart of daily balance over time.

Recharge events as red upward‑triangle markers – click a marker to display a tooltip with the recharge amount.

Enable zoom, pan, and hover details.

Add an interactive slider below the chart to filter the date range (e.g., show last 30/60/90 days) and update the chart dynamically.

Run‑Out Predictor:

Show the predicted date when the balance reaches zero, based on the case’s usual_daily_units.

Add an interactive slider (range 0–50) to adjust daily units – the run‑out date updates in real‑time as you slide.

Display the remaining days count and a visual progress bar.

Recharge Requirement Calculator:

A date picker to set a target date.

Calculate the total recharge required today to last until that date.

Show a donut/pie chart that breaks down the required amount into energy, fixed charges, and VAT.

Include an animated number counter that counts up to the total when the target date changes.

Strategy Comparator (most interactive part):

Two side‑by‑side cards: “Low Balance” vs “Monthly”.

For each strategy, add interactive sliders:

Low Balance: threshold (100–500 BDT) and recharge amount (500–5000 BDT).

Monthly: recharge amount per month (500–5000 BDT).

When any slider moves, re‑run the simulation instantly and update the total cost.

Highlight the cheaper strategy with a green badge and show the exact savings (e.g., “Monthly saves 230 BDT”).

Display a comparison bar chart side‑by‑side showing the cost components (energy, fixed, VAT) for both strategies.

Summary Dashboard:

Below the main content, show a responsive table with key metrics: opening balance, total consumption, total recharge amount, average daily units, and number of recharges – all updating when the case changes.

Extra interactivity:

When hovering over a recharge marker on the chart, highlight that recharge in the summary table.

Add a reset button to restore default parameters.

Free‑tier constraints:

All data and logic are client‑side (no API calls).

Keep the component tree shallow and use React.memo / useMemo to avoid unnecessary renders.

Use date-fns for date manipulations.

Optimise build size – only import needed Plotly modules.

Build a polished, professional-looking tool that feels like a real financial dashboard, with smooth animations and instant feedback on every user action.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a61c10bf-a3cc-4d36-bb96-fd79407151be).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
