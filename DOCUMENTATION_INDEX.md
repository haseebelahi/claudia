# Documentation Index

This document provides an overview of the project's documentation structure.

## Root Documentation

### Core Documents
- **[README.md](README.md)** - Project overview, quick start, tech stack
- **[MVP.md](MVP.md)** - Living vision document with future phases and ideas
- **[TODO.md](TODO.md)** - Current sprint, roadmap, and task tracking
- **[USAGE.md](USAGE.md)** - Complete user guide for the bot

## Technical Documentation

### Development (`docs/development/`)
For developers building and extending the project:

- **[SETUP.md](docs/development/SETUP.md)** - Detailed development environment setup
- **[AGENTS.md](docs/development/AGENTS.md)** - Guidelines for AI coding assistants
- **[LOCAL_TESTING.md](docs/development/LOCAL_TESTING.md)** - Testing without production conflicts

### Deployment (`docs/deployment/`)
For deploying to production:

- **[DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)** - Multi-platform deployment guide (Railway, Render, DigitalOcean, VPS, Docker)
- **[POST_DEPLOYMENT_CHECKLIST.md](docs/deployment/POST_DEPLOYMENT_CHECKLIST.md)** - Verification steps after deployment

### Architecture (`docs/architecture/`)
Technical deep-dives into system design:

- **[CONVERSATION_MANAGEMENT.md](docs/architecture/CONVERSATION_MANAGEMENT.md)** - Conversation lifecycle and state management
- **[CONVERSATION_PERSISTENCE.md](docs/architecture/CONVERSATION_PERSISTENCE.md)** - How conversations persist across restarts
- **[SYSTEM_PROMPTS.md](docs/architecture/SYSTEM_PROMPTS.md)** - Self-awareness implementation details

## Archive

Historical documents (completed milestones, old specs):

- **[archive/PHASE_1_COMPLETE.md](archive/PHASE_1_COMPLETE.md)** - Phase 1 completion summary
- **[archive/TEST_SUMMARY.md](archive/TEST_SUMMARY.md)** - Test implementation summary
- **[archive/codereview.md](archive/codereview.md)** - Code review improvements
- **[archive/spec.md](archive/spec.md)** - Original project spec

## Quick Navigation

### I want to...

**Use the bot**
→ Start with [USAGE.md](USAGE.md)

**Set up development environment**
→ Follow [docs/development/SETUP.md](docs/development/SETUP.md)

**Deploy to production**
→ See [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)

**Understand the vision and roadmap**
→ Read [MVP.md](MVP.md) and [TODO.md](TODO.md)

**Understand how conversations work**
→ Check [docs/architecture/CONVERSATION_MANAGEMENT.md](docs/architecture/CONVERSATION_MANAGEMENT.md)

**Contribute code**
→ Review [docs/development/AGENTS.md](docs/development/AGENTS.md)

**Test locally without conflicts**
→ Follow [docs/development/LOCAL_TESTING.md](docs/development/LOCAL_TESTING.md)

## Document Ownership

| Document | Purpose | Audience | Update Frequency |
|----------|---------|----------|------------------|
| README.md | Overview & quick start | Everyone | When major changes occur |
| MVP.md | Vision & future ideas | Everyone | Ongoing (living document) |
| TODO.md | Current tasks & roadmap | Developers | Weekly/Sprint |
| USAGE.md | Bot usage guide | End users | When commands change |
| docs/development/* | Dev setup & guidelines | Developers | As needed |
| docs/deployment/* | Production deployment | DevOps | When deployment changes |
| docs/architecture/* | Technical details | Developers | When architecture changes |
| archive/* | Historical reference | Reference only | Never (archived) |

---

**Last Updated:** January 2, 2026
