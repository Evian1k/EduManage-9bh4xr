# BUSINESS MODEL — EduManage

## Overview
EduManage is a multi-tenant SaaS school management platform with TWO revenue streams:
1. **Subscriptions** — recurring monthly/yearly fees per school
2. **Marketplace** — commission on products sold through the marketplace

## Subscription Plans

| Plan | Monthly | Yearly | Max Students | Max Staff | AI Limit | Storage | Target |
|---|---|---|---|---|---|---|---|
| Starter | $29 | $290 | 500 | 50 | 1,000 | 1GB | Small schools |
| Professional | $99 | $990 | 5,000 | 200 | 10,000 | 10GB | Growing schools |
| Enterprise | $299 | $2,990 | 50,000 | 1,000 | 100,000 | 100GB | Large institutions |
| Government | $199 | $1,990 | 100,000 | 2,000 | 50,000 | 50GB | Govt schools |
| University | $499 | $4,990 | 200,000 | 5,000 | 200,000 | 100GB | Universities |
| Custom | Custom | Custom | Custom | Custom | Custom | Custom | School networks |

## Revenue Streams

### Stream 1: Subscriptions (Primary)
- Monthly recurring revenue (MRR) from each school
- 6 tiers from $29/mo to $499/mo
- Average revenue per school (ARPS): ~$75/mo (blended average)
- Annual contract discount: ~17% (2 months free)

### Stream 2: Marketplace (Secondary — High Growth)
- Commission on every transaction: 10-15%
- Products: books, uniforms, transport software, LMS content, exam papers, teacher training, supplies
- Average order value: ~$200
- Estimated marketplace revenue per school: $50/mo
- Marketplace can exceed subscription revenue at scale

### Stream 3: Payment Processing (Future)
- Transaction fees on school fee payments (1.5-2%)
- M-Pesa, Stripe, PayPal integration
- Revenue share with payment providers

## Startup Costs

| Item | Cost (USD) |
|---|---|
| Legal + incorporation | $2,000 |
| Initial development (completed) | $0 (founder-built) |
| Supabase (first 3 months, Team plan) | $1,800 |
| Domain + DNS | $100 |
| Email (SendGrid) | $0 (free tier) |
| SMS (Africa's Talking) | $200 |
| AI API (OpenAI) | $300 |
| Stripe account setup | $0 |
| Marketing (website, ads) | $1,000 |
| Misc | $600 |
| **Total Startup** | **$6,000** |

## Monthly Infrastructure Costs

| Scale | Supabase | AI | Email/SMS | Storage | CDN | Monitoring | Total/mo |
|---|---|---|---|---|---|---|---|
| 100 schools | $599 (Team) | $200 | $100 | $50 | $20 | $26 | ~$995 |
| 1,000 schools | $599 (Team) | $1,500 | $500 | $200 | $50 | $26 | ~$2,875 |
| 10,000 schools | $1,500 (Enterprise) | $10,000 | $3,000 | $1,000 | $200 | $200 | ~$15,900 |
| 100,000 schools | $5,000 (Enterprise) | $50,000 | $20,000 | $5,000 | $1,000 | $500 | ~$81,500 |
| 1,000,000 schools | $20,000+ (Enterprise) | $200,000 | $100,000 | $20,000 | $5,000 | $2,000 | ~$347,000+ |

## Projected Revenue

| Scale | Schools | ARPS/mo | Subscription MRR | Marketplace/mo | Total MRR | Total ARR |
|---|---|---|---|---|---|---|
| 100 | 100 | $75 | $7,500 | $5,000 | $12,500 | $150,000 |
| 1,000 | 1,000 | $75 | $75,000 | $50,000 | $125,000 | $1,500,000 |
| 10,000 | 10,000 | $75 | $750,000 | $500,000 | $1,250,000 | $15,000,000 |
| 100,000 | 100,000 | $75 | $7,500,000 | $5,000,000 | $12,500,000 | $150,000,000 |
| 1,000,000 | 1,000,000 | $75 | $75,000,000 | $50,000,000 | $125,000,000 | $1,500,000,000 |

## Projected Profit

| Scale | Revenue/mo | Costs/mo | Profit/mo | Margin |
|---|---|---|---|---|
| 100 schools | $12,500 | $995 | $11,505 | 92% |
| 1,000 schools | $125,000 | $2,875 | $122,125 | 98% |
| 10,000 schools | $1,250,000 | $15,900 | $1,234,100 | 99% |
| 100,000 schools | $12,500,000 | $81,500 | $12,418,500 | 99% |
| 1,000,000 schools | $125,000,000 | $347,000 | $124,653,000 | 99.7% |

## Break-Even Analysis

**Break-even point: ~80 schools**

- Monthly costs at 100 schools: ~$995
- Monthly revenue at 80 schools: ~$10,000 (subscription) + ~$4,000 (marketplace) = $14,000
- Break-even: 80 schools × $75 ARPS = $6,000 subscription + ~$4,000 marketplace = $10,000 > $995 costs

**With $6,000 startup costs:**
- At 100 schools: profit = $11,505/mo → startup costs recovered in **< 1 month**
- At 50 schools: profit = ~$5,750/mo → startup costs recovered in **~1 month**

## Growth Forecasts

### Scenario: 100 Schools (Month 1-6)
- **Target:** Onboard 100 schools in first 6 months
- **Strategy:** Free 14-day trial, direct sales to Kenyan schools, referral program
- **Revenue:** $150,000 ARR
- **Team needed:** 2-3 (founder + 1-2 support/sales)

### Scenario: 1,000 Schools (Year 1)
- **Target:** 1,000 schools by end of Year 1
- **Strategy:** Partner with education ministries, conference marketing, content marketing
- **Revenue:** $1,500,000 ARR
- **Team needed:** 5-8 (founder + 2 support + 2 sales + 1 engineering + 1 marketing)

### Scenario: 10,000 Schools (Year 2)
- **Target:** 10,000 schools by end of Year 2
- **Strategy:** Government contracts, university partnerships, white-label deals
- **Revenue:** $15,000,000 ARR
- **Team needed:** 15-20 (full company structure with all 10 departments)

### Scenario: 100,000 Schools (Year 3-4)
- **Target:** 100,000 schools across Africa, Asia, Latin America
- **Strategy:** Multi-region deployment, local partnerships, offline support
- **Revenue:** $150,000,000 ARR
- **Team needed:** 50-100

### Scenario: 1,000,000 Schools (Year 5+)
- **Target:** 1M schools globally
- **Strategy:** Platform ecosystem, developer API, marketplace dominance
- **Revenue:** $1,500,000,000 ARR ($1.5B)
- **Team needed:** 200-500

## Key Metrics to Track

| Metric | Formula | Target |
|---|---|---|
| MRR | Sum of active subscription amounts | Grow 15%+ MoM |
| ARR | MRR × 12 | — |
| ARPS | Subscription revenue / paying schools | $75+ |
| CLV | ARPS × average school lifetime (months) | $2,700+ (3yr) |
| CAC | Sales + marketing spend / new schools | < $200 |
| LTV:CAC | CLV / CAC | > 3:1 |
| Churn Rate | Lost schools / total schools | < 3% monthly |
| Marketplace GMV | Total marketplace order value | Grow to match subscription |
| Marketplace Take Rate | Commission / GMV | 10-15% |
| NPS | Net Promoter Score | > 50 |

## Competitive Advantage

1. **Multi-tenant architecture** — purpose-built SaaS (not on-premise legacy)
2. **Marketplace** — second revenue stream competitors don't have
3. **AI integration** — teacher AI, student AI, principal AI, company AI
4. **Multi-language** — English, Swahili, French, Arabic, Spanish
5. **Mobile-first** — Expo React Native (works on any device)
6. **Africa-focused** — M-Pesa integration, Africa's Talking SMS, Swahili support
7. **Affordable** — $29/mo Starter plan beats most competitors
8. **Fast deployment** — new school live in 5 minutes

## Funding Strategy

### Seed Round: $500K (at 100 schools)
- Use for: Team expansion (5-8 people), marketing, infrastructure scaling
- Valuation: $2-3M (pre-money)

### Series A: $5M (at 1,000 schools)
- Use for: Multi-region expansion, enterprise sales team, marketplace development
- Valuation: $15-20M (pre-money)

### Series B: $25M (at 10,000 schools)
- Use for: Global expansion, acquisitions, platform ecosystem
- Valuation: $75-100M (pre-money)
