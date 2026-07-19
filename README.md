# Balviora — Digital Experience

The foundational landing experience for **Balviora**, a premium natural wellness
company. Honey is the first chapter — the site is architected to grow into a
complete wellness ecosystem (bee products → functional foods → supplements →
education → community → digital wellness).

The launch collection is **Black Sea Balance**: small-batch, laboratory-tested
pine, chestnut, and wildflower honey from the Eastern Black Sea.

Static site. No build step, no dependencies, no framework. Every section is
modular so it can be lifted into a Shopify Online Store 2.0 theme later.

## Structure

| Path | Purpose |
|------|---------|
| `index.html` | The full experience — hero, trust, story, Black Sea journey, bee-wellness education, science/compounds, product ecosystem, Black Sea Balance collection, ingredient explorer, wellness quiz, origin, founder, community, journal, waitlist, FAQ, footer. Includes Organization / WebSite / Breadcrumb / Product / FAQ schema, Open Graph, and Twitter cards. |
| `css/styles.css` | Design system (tokens, type, layout, components, motion, responsive, reduced-motion) plus legal-page styles. |
| `js/main.js` | Vanilla JS: header state, mobile nav, scroll reveal, animated counters, hero parallax, timeline progress, ingredient tabs, origin-map pins, wellness quiz, forms, scroll-spy, and a privacy-first consent banner. |
| `assets/` | `favicon.svg`, `og-cover.svg` social image. |
| `privacy.html` · `terms.html` · `cookies.html` · `disclaimer.html` | Legal templates (GDPR/CCPA/FDA placeholders). |
| `404.html` | Branded not-found page. |
| `robots.txt` · `sitemap.xml` · `site.webmanifest` | Crawl + PWA metadata. |

## Design system

- **Palette:** warm white / soft ivory base, forest-green cinematic sections,
  charcoal ink, stone-gray support, golden-honey accent. No saturated colour.
- **Type:** Fraunces (editorial serif display) + Inter (UI/body).
- **Motion:** subtle scroll reveals, parallax, counters, timeline fill — all
  disabled under `prefers-reduced-motion`.

## Integration points (wired as placeholders)

- **Analytics / Consent Mode:** GA4, GTM, Meta / Pinterest / TikTok pixels,
  Microsoft Clarity. Nothing loads until the consent banner is accepted — see
  the head of `index.html` and the consent handler in `js/main.js`.
- **Email:** waitlist and quiz forms are ESP-ready (Klaviyo / Mailchimp /
  Brevo / ConvertKit). Set `data-endpoint` on the waitlist `<form>` to enable a
  real POST; double opt-in is assumed.

## Running locally

```
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Not medical advice

Balviora products are foods, not medicines. Content is educational only and is
not intended to diagnose, treat, cure, or prevent any disease.
