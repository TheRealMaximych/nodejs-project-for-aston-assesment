## ADDED Requirements

### Requirement: README documents the API check page URL
The README MUST include one short line that tells a developer how to open the local API check page after `npm run dev`, using the host and `PORT` from the environment example (for the example port, `http://localhost:3000/`). That line MUST NOT describe architecture, layering, or stack justification.

#### Scenario: Check page URL is documented
- **WHEN** a developer follows `README.md` after starting the API with `npm run dev` and `PORT` from `.env.example`
- **THEN** the instructions give the API check page URL using path `/` (for the example port, `http://localhost:3000/`)
