# Supplier intelligence design preview

The approved direction is Signal, implemented in the Next.js application at `/`. Run `bun run dev` and open http://localhost:3000.

The interface uses the original `b5JgvMPyq` shadcn preset: `base-maia`, Zinc, Geist, rounded controls, and the preset’s blue chart tokens. The workspace switcher was removed because the application currently has one procurement workspace.

`SupplierDashboard` uses the installed shadcn sidebar, cards, controls, table and overlays. The four fact cards use `@number-flow/react`. Search and risk filters update the cards, scatter plot and table using all 10,000 CSV records. NumberFlow animates subsequent changes, keeps the initial values stable and respects reduced motion. Comparison supports up to 20 suppliers.

`supplier-workspace.html` is a self-contained, static visual snapshot of the current application. Open the running app for NumberFlow, filtering and other interactions. Earlier design directions are archived in `archive/initial-design-directions.html`.

The analyst panel supports deterministic CSV-based example answers. External company research is a workflow preview. No language model or web research service is connected yet.
