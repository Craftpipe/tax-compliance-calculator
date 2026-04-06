# Tax Compliance Calculator

A CLI tool that generates accurate tax calculations, compliance reports, and filing checklists for freelancers and small businesses. Handles multi-jurisdiction tax rules, deduction categorization, quarterly estimated taxes, and audit-ready documentation.

**Save 15+ hours of tax research and spreadsheet building.**

## Installation

Install globally via npm:

```bash
npm install -g tax-compliance-calculator
```

Or run directly with npx:

```bash
npx tax-compliance-calculator
```

## Quick Start

### Initialize a new tax profile

```bash
tax-compliance-calculator init
```

Follow the prompts to set up your business details, jurisdiction, and tax year.

### Calculate quarterly estimated taxes

```bash
tax-compliance-calculator estimate --income 50000 --deductions 12000 --state CA
```

### Generate a compliance report

```bash
tax-compliance-calculator report --year 2024 --format pdf
```

### Create a filing checklist

```bash
tax-compliance-calculator checklist --jurisdiction federal --business-type freelance
```

### Categorize expenses

```bash
tax-compliance-calculator categorize --file expenses.csv
```

### View tax summary

```bash
tax-compliance-calculator summary
```

## Features

- **Multi-jurisdiction support** — Federal, state, and local tax rules
- **Deduction categorization** — Automatically organize business expenses
- **Quarterly estimated taxes** — Calculate and track quarterly payments
- **Audit-ready reports** — Generate compliance documentation
- **Filing checklists** — Never miss a deadline or requirement
- **Expense tracking** — Import and categorize transactions

## Configuration

Create a `.tax-config.json` file in your project root:

```json
{
  "businessName": "Your Business",
  "businessType": "freelance",
  "jurisdiction": "US",
  "state": "CA",
  "taxYear": 2024,
  "filingStatus": "self-employed"
}
```

## FAQ

**Q: Does this replace an accountant?**  
A: This tool handles calculations and documentation. Consult a tax professional for complex situations.

**Q: Which jurisdictions are supported?**  
A: All US states, federal taxes, and common international jurisdictions. Check `tax-compliance-calculator list-jurisdictions`.

**Q: Can I export reports?**  
A: Yes. Use `--format pdf`, `--format csv`, or `--format json` with any report command.

**Q: How often is tax law updated?**  
A: We update quarterly. Run `npm update -g tax-compliance-calculator` to get the latest rules.

**Q: Can I import data from accounting software?**  
A: Yes. Supports CSV, JSON, and common accounting formats via the `--file` flag.

---

**Built with AI by Craftpipe**  
Support: support@heijnesdigital.com
## ⭐ Pro Features

Upgrade to Pro for:
- **advanced config**
- **dashboard**
- **api integration**

**Get Pro** → [craftpipe.gumroad.com](https://craftpipe.gumroad.com) (€49)

Set `PRO_LICENSE=<your-key>` environment variable to unlock.
