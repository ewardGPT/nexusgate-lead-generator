# NexusGate Lead Generator

A production-grade, high-conversion lead generation system for **NexusGate** — an open-source, lightweight AI Agent & LLM application monitoring and management platform.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────┐     ┌───────────────┐
│   Lead Form     │────▶│   n8n        │────▶│   Apify       │
│  (Multi-Step)   │     │  Webhook     │     │  Enrichment   │
└─────────────────┘     └──────┬───────┘     └───────┬───────┘
                               │                     │
                               │                     ▼
                               │            ┌───────────────┐
                               │            │  OpenClaw     │
                               │            │  AI Scoring   │
                               │            └───────┬───────┘
                               │                    │
                               ▼                    ▼
                        ┌─────────────┐    ┌──────────────┐
                        │   Switch    │───▶│ High Intent  │
                        │   Router    │    │ > 7          │
                        └─────────────┘    └──────┬───────┘
                               │                  │
                     ┌─────────┼─────────┐        ▼
                     │         │         │  ┌──────────────┐
                     ▼         ▼         ▼  │ OpenClaw     │
                Medium     Low        High │ Outreach     │
                (3-7)      (<3)       (>7) │ Generation   │
                     │         │         │ └──────┬───────┘
                     ▼         ▼         ▼        │
                Email       Google     Slack/      ▼
                Nurture     Sheet      Telegram ┌──────────┐
                List        Log        Alert    │ Sales    │
                                                │ Team     │
                                                └──────────┘
```

## Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Automation | n8n | Orchestrates the entire workflow |
| Enrichment | Apify | Scrapes company websites for lead context |
| Intelligence | OpenClaw + LLM | Scores leads and generates personalized outreach |
| Frontend | HTML/JS Multi-Step Form | Captures leads with minimal friction |
| Testing | Playwright CLI | Validates form + webhook end-to-end |
| Version Control | GitHub CLI | Manages all code and workflow exports |
| CI/CD | GitHub Actions | Runs tests and validates workflows on every push |
| Monitoring | Google Sheets + Telegram | Tracks performance and alerts on errors |

## Setup

### Prerequisites

- Node.js >= 20.0.0
- n8n instance (self-hosted or cloud)
- Apify account with API token
- OpenClaw API access
- Slack or Telegram bot (for notifications)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/nexusgate-lead-generator.git
cd nexusgate-lead-generator

# Install dependencies
npm install

# Copy environment variables and fill in your credentials
cp .env.example .env
```

### n8n Workflow Import

1. Open your n8n instance
2. Create a new workflow
3. Import `workflows/nexusgate-lead-generator.json`
4. Configure credentials for all nodes (Apify, OpenClaw, Slack, etc.)
5. Activate the workflow

### Frontend Form

Embed the form on `nexusgate.tech` by copying `forms/index.html` or embedding it via iframe:

```html
<iframe src="https://your-domain.com/forms/index.html" width="100%" height="600" frameborder="0"></iframe>
```

Update `forms/config.js` with your n8n webhook URL.

## Testing

### Run Playwright E2E Tests

```bash
# Headless (CI mode)
npx playwright test

# With browser UI
npx playwright test --headed

# Interactive UI
npx playwright test --ui
```

### Validate n8n Workflow

```bash
node scripts/validate-workflow.js
```

## CI/CD

GitHub Actions pipelines run on every push and PR:

- **Playwright E2E Tests**: Validates the lead form submission flow
- **Workflow Validation**: Ensures n8n JSON is valid and contains required nodes

## Project Structure

```
nexusgate-lead-generator/
├── workflows/                    # n8n workflow JSON exports
│   └── nexusgate-lead-generator.json
├── forms/                        # Frontend lead capture form
│   ├── index.html
│   └── config.js
├── tests/                        # Playwright E2E tests
│   └── lead-form.spec.js
├── scripts/                      # Utility scripts
│   └── validate-workflow.js
├── .github/workflows/            # GitHub Actions CI/CD
│   ├── playwright.yml
│   └── validate-workflow.yml
├── .env.example                  # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

## Lead Scoring Rubric

| Score | Criteria | Action |
|-------|----------|--------|
| 8-10 | Strong ICP fit: AI/ML teams, active LLM deployment, tech-forward | Immediate personalized outreach |
| 3-7 | Moderate fit: some signals present, needs nurturing | Add to email nurture sequence |
| 0-2 | Weak fit: non-technical, no AI signals, consumer-focused | Log for future analysis |

## A/B Testing

The workflow supports A/B testing of scoring prompts. Two variants (A and B) are randomly assigned via a Code node. Conversion rates are tracked in Google Sheets to identify the most effective scoring criteria.

## License

MIT
