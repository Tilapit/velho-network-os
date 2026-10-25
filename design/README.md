# Design reference

These four files are the clickable design prototypes made in the design canvas
(a custom `.dc.html` format: HTML with `{{ }}` bindings, `<sc-for>`/`<sc-if>`
and a small component class at the bottom). Read them for layout, copy, colors
and interaction; do not import them. The markup and inline styles are the spec.

- Import.dc.html: first run, bring in the team's networks
- Main.dc.html: network view, list, person analysis (the core)
- Ask.dc.html: rank by industry + ask your network (themes/events)
- Outreach.dc.html: CRM view. **Not being built** (CRM unknown); only its idea
  of "export to CRM" survives as CSV export.

The network drawing in Main.dc.html is a sample of ~90 dots. The real app draws
**every contact as a node** (see docs/prompts/OVERNIGHT_PROMPT.md).
