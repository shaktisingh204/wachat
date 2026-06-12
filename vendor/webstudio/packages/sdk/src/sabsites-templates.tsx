import { $, css, ws, type TemplateMeta } from "@webstudio-is/template";

/**
 * SabSites — animated, ready-made section + page templates.
 *
 * Webstudio's style model rejects @keyframes, so each template embeds a small
 * <style> block (via HtmlEmbed, which renders raw markup) that defines the
 * keyframes, and elements drive them through the normal `animation` property.
 * Entrance (fade/slide), continuous (float/marquee/shimmer/gradient) and hover
 * micro-interactions are all pure CSS — no proprietary animation package.
 *
 * Authored with SabSites; surfaced in the builder's "Sections" panel for users
 * to drop into their own pages.
 */

const FONT = `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`;
const BRAND = `linear-gradient(135deg, #6366f1 0%, #a855f7 100%)`;

// Shared keyframes — embedded once per inserted section (duplicates are inert).
const KEYFRAMES = `<style>
@keyframes sabFadeUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
@keyframes sabFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes sabFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-22px); } }
@keyframes sabFloatSlow { 0%,100% { transform: translateY(0) translateX(0); } 50% { transform: translateY(26px) translateX(-18px); } }
@keyframes sabMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes sabShimmer { from { transform: translateX(-120%) skewX(-18deg); } to { transform: translateX(220%) skewX(-18deg); } }
@keyframes sabGradient { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes sabPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.45); } 50% { box-shadow: 0 0 0 16px rgba(99,102,241,0); } }
</style>`;

const Keyframes = () => (
  <$.HtmlEmbed ws:label="Animations CSS" code={KEYFRAMES}></$.HtmlEmbed>
);

const ICON_BOLT = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>`;
const ICON_SHIELD = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>`;
const ICON_SPARK = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>`;

// ── Hero ─────────────────────────────────────────────────────────────────────

const Hero = () => (
  <ws.element
    ws:tag="section"
    ws:label="Hero"
    ws:style={css`
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
      padding: 120px 24px;
      text-align: center;
      font-family: ${FONT};
      color: #0f172a;
      background: radial-gradient(60% 60% at 50% 0%, #eef2ff 0%, #ffffff 60%);
    `}
  >
    {Keyframes()}
    <ws.element
      ws:tag="div"
      ws:label="Orb"
      ws:style={css`
        position: absolute;
        top: -120px;
        right: -80px;
        width: 320px;
        height: 320px;
        border-radius: 999px;
        filter: blur(40px);
        opacity: 0.5;
        background: ${BRAND};
        animation: sabFloat 8s ease-in-out infinite;
      `}
    ></ws.element>
    <ws.element
      ws:tag="div"
      ws:label="Orb"
      ws:style={css`
        position: absolute;
        bottom: -140px;
        left: -90px;
        width: 280px;
        height: 280px;
        border-radius: 999px;
        filter: blur(44px);
        opacity: 0.35;
        background: linear-gradient(135deg, #22d3ee, #6366f1);
        animation: sabFloatSlow 11s ease-in-out infinite;
      `}
    ></ws.element>
    <ws.element
      ws:tag="span"
      ws:label="Eyebrow"
      ws:style={css`
        position: relative;
        padding: 7px 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        color: #4338ca;
        background: #eef2ff;
        border: 1px solid #e0e7ff;
        animation: sabFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
      `}
    >
      ✨ Build beautiful sites with SabSites
    </ws.element>
    <ws.element
      ws:tag="h1"
      ws:label="Heading"
      ws:style={css`
        position: relative;
        max-width: 820px;
        margin: 0;
        font-size: 64px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.03em;
        animation: sabFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
      `}
    >
      Launch a stunning website in minutes
    </ws.element>
    <ws.element
      ws:tag="p"
      ws:label="Subheading"
      ws:style={css`
        position: relative;
        max-width: 560px;
        margin: 0;
        font-size: 19px;
        line-height: 1.6;
        color: #475569;
        animation: sabFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.16s both;
      `}
    >
      Design visually, animate effortlessly, and publish anywhere — no code
      required.
    </ws.element>
    <ws.element
      ws:tag="div"
      ws:label="Actions"
      ws:style={css`
        position: relative;
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        justify-content: center;
        animation: sabFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.24s both;
      `}
    >
      <ws.element
        ws:tag="a"
        ws:label="Primary button"
        href="#"
        ws:style={css`
          display: inline-flex;
          align-items: center;
          padding: 15px 30px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          text-decoration: none;
          background: ${BRAND};
          box-shadow: 0 12px 28px rgba(99, 102, 241, 0.4);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
          &:hover {
            transform: translateY(-3px);
            box-shadow: 0 18px 38px rgba(99, 102, 241, 0.5);
          }
        `}
      >
        Get started free
      </ws.element>
      <ws.element
        ws:tag="a"
        ws:label="Secondary button"
        href="#"
        ws:style={css`
          display: inline-flex;
          align-items: center;
          padding: 15px 30px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          text-decoration: none;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          transition:
            transform 0.2s ease,
            border-color 0.2s ease;
          &:hover {
            transform: translateY(-3px);
            border-color: #c7d2fe;
          }
        `}
      >
        Watch demo
      </ws.element>
    </ws.element>
  </ws.element>
);

// ── Logo marquee ─────────────────────────────────────────────────────────────

const logoPill = (name: string) => (
  <ws.element
    ws:tag="span"
    ws:label="Logo"
    ws:style={css`
      flex: 0 0 auto;
      padding: 10px 26px;
      border-radius: 10px;
      font-family: ${FONT};
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #94a3b8;
      background: #f8fafc;
      border: 1px solid #eef2f7;
    `}
  >
    {name}
  </ws.element>
);

const LogoMarquee = () => (
  <ws.element
    ws:tag="section"
    ws:label="Logo Marquee"
    ws:style={css`
      overflow: hidden;
      padding: 48px 0;
      font-family: ${FONT};
      background: #ffffff;
      -webkit-mask-image: linear-gradient(
        90deg,
        transparent,
        #000 12%,
        #000 88%,
        transparent
      );
      mask-image: linear-gradient(
        90deg,
        transparent,
        #000 12%,
        #000 88%,
        transparent
      );
    `}
  >
    {Keyframes()}
    <ws.element
      ws:tag="div"
      ws:label="Track"
      ws:style={css`
        display: flex;
        width: max-content;
        gap: 28px;
        animation: sabMarquee 22s linear infinite;
      `}
    >
      {logoPill("Northwind")}
      {logoPill("Acme")}
      {logoPill("Lumen")}
      {logoPill("Vertex")}
      {logoPill("Quanta")}
      {logoPill("Orbit")}
      {logoPill("Northwind")}
      {logoPill("Acme")}
      {logoPill("Lumen")}
      {logoPill("Vertex")}
      {logoPill("Quanta")}
      {logoPill("Orbit")}
    </ws.element>
  </ws.element>
);

// ── Features ─────────────────────────────────────────────────────────────────

const featureCard = (
  icon: string,
  title: string,
  body: string,
  delay: string
) => (
  <ws.element
    ws:tag="div"
    ws:label="Feature"
    ws:style={css`
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 32px;
      border-radius: 18px;
      background: #ffffff;
      border: 1px solid #eef2f7;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      animation: sabFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay} both;
      transition:
        transform 0.25s ease,
        box-shadow 0.25s ease;
      &:hover {
        transform: translateY(-6px);
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.1);
      }
    `}
  >
    <ws.element
      ws:tag="div"
      ws:label="Icon"
      ws:style={css`
        display: grid;
        place-items: center;
        width: 52px;
        height: 52px;
        border-radius: 14px;
        background: ${BRAND};
        box-shadow: 0 8px 18px rgba(99, 102, 241, 0.35);
      `}
    >
      <$.HtmlEmbed ws:label="Glyph" code={icon}></$.HtmlEmbed>
    </ws.element>
    <ws.element
      ws:tag="h3"
      ws:label="Title"
      ws:style={css`
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
      `}
    >
      {title}
    </ws.element>
    <ws.element
      ws:tag="p"
      ws:label="Body"
      ws:style={css`
        margin: 0;
        font-size: 15px;
        line-height: 1.65;
        color: #64748b;
      `}
    >
      {body}
    </ws.element>
  </ws.element>
);

const Features = () => (
  <ws.element
    ws:tag="section"
    ws:label="Features"
    ws:style={css`
      padding: 100px 24px;
      font-family: ${FONT};
      background: #ffffff;
    `}
  >
    {Keyframes()}
    <ws.element
      ws:tag="div"
      ws:label="Header"
      ws:style={css`
        max-width: 640px;
        margin: 0 auto 56px;
        text-align: center;
        animation: sabFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
      `}
    >
      <ws.element
        ws:tag="h2"
        ws:label="Heading"
        ws:style={css`
          margin: 0 0 14px;
          font-size: 42px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        `}
      >
        Everything you need to ship
      </ws.element>
      <ws.element
        ws:tag="p"
        ws:label="Subheading"
        ws:style={css`
          margin: 0;
          font-size: 18px;
          line-height: 1.6;
          color: #64748b;
        `}
      >
        Powerful building blocks, beautifully animated out of the box.
      </ws.element>
    </ws.element>
    <ws.element
      ws:tag="div"
      ws:label="Grid"
      ws:style={css`
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        max-width: 1100px;
        margin: 0 auto;
        @media (max-width: 860px) {
          grid-template-columns: 1fr;
        }
      `}
    >
      {featureCard(
        ICON_BOLT,
        "Lightning fast",
        "Visually edit and preview changes instantly with a real-time canvas.",
        "0.05s"
      )}
      {featureCard(
        ICON_SHIELD,
        "Reliable by default",
        "Production-grade output with clean, semantic, accessible markup.",
        "0.15s"
      )}
      {featureCard(
        ICON_SPARK,
        "Animated & advanced",
        "Drop in motion-rich sections and fine-tune every interaction.",
        "0.25s"
      )}
    </ws.element>
  </ws.element>
);

// ── Stats ────────────────────────────────────────────────────────────────────

const stat = (value: string, label: string, delay: string) => (
  <ws.element
    ws:tag="div"
    ws:label="Stat"
    ws:style={css`
      text-align: center;
      animation: sabFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay} both;
    `}
  >
    <ws.element
      ws:tag="div"
      ws:label="Value"
      ws:style={css`
        font-size: 52px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: #ffffff;
      `}
    >
      {value}
    </ws.element>
    <ws.element
      ws:tag="div"
      ws:label="Label"
      ws:style={css`
        margin-top: 6px;
        font-size: 15px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.75);
      `}
    >
      {label}
    </ws.element>
  </ws.element>
);

const Stats = () => (
  <ws.element
    ws:tag="section"
    ws:label="Stats"
    ws:style={css`
      padding: 72px 24px;
      font-family: ${FONT};
      background: linear-gradient(135deg, #4f46e5, #7c3aed, #a855f7);
      background-size: 200% 200%;
      animation: sabGradient 12s ease infinite;
    `}
  >
    {Keyframes()}
    <ws.element
      ws:tag="div"
      ws:label="Grid"
      ws:style={css`
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 32px;
        max-width: 1000px;
        margin: 0 auto;
        @media (max-width: 720px) {
          grid-template-columns: repeat(2, 1fr);
        }
      `}
    >
      {stat("99.9%", "Uptime", "0.05s")}
      {stat("12k+", "Sites launched", "0.12s")}
      {stat("4.9/5", "Customer rating", "0.19s")}
      {stat("180+", "Countries", "0.26s")}
    </ws.element>
  </ws.element>
);

// ── Pricing ──────────────────────────────────────────────────────────────────

const priceCard = (
  name: string,
  price: string,
  features: string,
  featured: boolean,
  delay: string
) => (
  <ws.element
    ws:tag="div"
    ws:label={featured ? "Plan (featured)" : "Plan"}
    ws:style={css`
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding: 34px;
      border-radius: 20px;
      background: ${featured ? "#0f172a" : "#ffffff"};
      color: ${featured ? "#ffffff" : "#0f172a"};
      border: 1px solid ${featured ? "transparent" : "#eef2f7"};
      box-shadow: ${featured
        ? "0 24px 60px rgba(99,102,241,0.4)"
        : "0 1px 2px rgba(15,23,42,0.05)"};
      transform: ${featured ? "scale(1.04)" : "none"};
      animation: sabFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay} both;
      transition: transform 0.25s ease;
      &:hover {
        transform: ${featured ? "scale(1.06)" : "translateY(-6px)"};
      }
    `}
  >
    <ws.element
      ws:tag="div"
      ws:label="Name"
      ws:style={css`
        font-size: 15px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: ${featured ? "#a5b4fc" : "#6366f1"};
      `}
    >
      {name}
    </ws.element>
    <ws.element
      ws:tag="div"
      ws:label="Price"
      ws:style={css`
        font-size: 44px;
        font-weight: 800;
        letter-spacing: -0.02em;
      `}
    >
      {price}
    </ws.element>
    <ws.element
      ws:tag="p"
      ws:label="Features"
      ws:style={css`
        margin: 0;
        font-size: 15px;
        line-height: 1.9;
        color: ${featured ? "rgba(255,255,255,0.8)" : "#64748b"};
      `}
    >
      {features}
    </ws.element>
    <ws.element
      ws:tag="a"
      ws:label="Button"
      href="#"
      ws:style={css`
        margin-top: auto;
        display: inline-flex;
        justify-content: center;
        padding: 13px 22px;
        border-radius: 11px;
        font-size: 15px;
        font-weight: 600;
        text-decoration: none;
        color: ${featured ? "#0f172a" : "#ffffff"};
        background: ${featured ? "#ffffff" : BRAND};
        transition: opacity 0.2s ease;
        &:hover {
          opacity: 0.9;
        }
      `}
    >
      Choose {name}
    </ws.element>
  </ws.element>
);

const Pricing = () => (
  <ws.element
    ws:tag="section"
    ws:label="Pricing"
    ws:style={css`
      padding: 100px 24px;
      font-family: ${FONT};
      background: #f8fafc;
    `}
  >
    {Keyframes()}
    <ws.element
      ws:tag="h2"
      ws:label="Heading"
      ws:style={css`
        max-width: 640px;
        margin: 0 auto 56px;
        text-align: center;
        font-size: 42px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: #0f172a;
        animation: sabFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
      `}
    >
      Simple, transparent pricing
    </ws.element>
    <ws.element
      ws:tag="div"
      ws:label="Grid"
      ws:style={css`
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        max-width: 1040px;
        margin: 0 auto;
        align-items: center;
        @media (max-width: 860px) {
          grid-template-columns: 1fr;
        }
      `}
    >
      {priceCard("Starter", "$0", "1 site • SabSites subdomain • Community support", false, "0.05s")}
      {priceCard("Pro", "$19", "Unlimited sites • Custom domains • Animations • Priority support", true, "0.13s")}
      {priceCard("Team", "$49", "Everything in Pro • Collaboration • Roles • SSO", false, "0.21s")}
    </ws.element>
  </ws.element>
);

// ── Testimonials ─────────────────────────────────────────────────────────────

const quote = (text: string, name: string, role: string, delay: string) => (
  <ws.element
    ws:tag="figure"
    ws:label="Quote"
    ws:style={css`
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding: 30px;
      border-radius: 18px;
      background: #ffffff;
      border: 1px solid #eef2f7;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      animation: sabFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay} both;
    `}
  >
    <ws.element
      ws:tag="blockquote"
      ws:label="Text"
      ws:style={css`
        margin: 0;
        font-size: 16px;
        line-height: 1.7;
        color: #334155;
      `}
    >
      “{text}”
    </ws.element>
    <ws.element
      ws:tag="figcaption"
      ws:label="Author"
      ws:style={css`
        display: flex;
        align-items: center;
        gap: 12px;
      `}
    >
      <ws.element
        ws:tag="span"
        ws:label="Avatar"
        ws:style={css`
          width: 40px;
          height: 40px;
          border-radius: 999px;
          background: ${BRAND};
        `}
      ></ws.element>
      <ws.element ws:tag="span" ws:label="Meta">
        <ws.element
          ws:tag="div"
          ws:label="Name"
          ws:style={css`
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
          `}
        >
          {name}
        </ws.element>
        <ws.element
          ws:tag="div"
          ws:label="Role"
          ws:style={css`
            font-size: 13px;
            color: #94a3b8;
          `}
        >
          {role}
        </ws.element>
      </ws.element>
    </ws.element>
  </ws.element>
);

const Testimonials = () => (
  <ws.element
    ws:tag="section"
    ws:label="Testimonials"
    ws:style={css`
      padding: 100px 24px;
      font-family: ${FONT};
      background: #ffffff;
    `}
  >
    {Keyframes()}
    <ws.element
      ws:tag="div"
      ws:label="Grid"
      ws:style={css`
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        max-width: 1100px;
        margin: 0 auto;
        @media (max-width: 860px) {
          grid-template-columns: 1fr;
        }
      `}
    >
      {quote("SabSites cut our launch time from weeks to an afternoon.", "Maya Chen", "Founder, Lumen", "0.05s")}
      {quote("The animated sections look like a design agency built them.", "Diego Santos", "Marketing, Vertex", "0.13s")}
      {quote("Finally a builder my whole team can actually use.", "Aisha Khan", "PM, Orbit", "0.21s")}
    </ws.element>
  </ws.element>
);

// ── CTA ──────────────────────────────────────────────────────────────────────

const Cta = () => (
  <ws.element
    ws:tag="section"
    ws:label="CTA"
    ws:style={css`
      padding: 90px 24px;
      font-family: ${FONT};
      background: #ffffff;
    `}
  >
    {Keyframes()}
    <ws.element
      ws:tag="div"
      ws:label="Banner"
      ws:style={css`
        position: relative;
        overflow: hidden;
        max-width: 1000px;
        margin: 0 auto;
        padding: 64px 32px;
        border-radius: 24px;
        text-align: center;
        color: #ffffff;
        background: linear-gradient(135deg, #4f46e5, #7c3aed, #a855f7);
        background-size: 200% 200%;
        animation:
          sabGradient 10s ease infinite,
          sabFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
      `}
    >
      <ws.element
        ws:tag="div"
        ws:label="Shine"
        ws:style={css`
          position: absolute;
          top: 0;
          left: 0;
          width: 40%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.25),
            transparent
          );
          animation: sabShimmer 4.5s ease-in-out infinite;
        `}
      ></ws.element>
      <ws.element
        ws:tag="h2"
        ws:label="Heading"
        ws:style={css`
          position: relative;
          margin: 0 0 14px;
          font-size: 40px;
          font-weight: 800;
          letter-spacing: -0.02em;
        `}
      >
        Ready to build your site?
      </ws.element>
      <ws.element
        ws:tag="p"
        ws:label="Subheading"
        ws:style={css`
          position: relative;
          margin: 0 0 28px;
          font-size: 18px;
          color: rgba(255, 255, 255, 0.85);
        `}
      >
        Start free with SabSites — no credit card required.
      </ws.element>
      <ws.element
        ws:tag="a"
        ws:label="Button"
        href="#"
        ws:style={css`
          position: relative;
          display: inline-flex;
          padding: 15px 34px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          text-decoration: none;
          color: #4338ca;
          background: #ffffff;
          animation: sabPulse 2.4s ease-in-out infinite;
        `}
      >
        Get started free
      </ws.element>
    </ws.element>
  </ws.element>
);

// ── Footer ───────────────────────────────────────────────────────────────────

// NOTE: the template compiler does not flatten nested array children
// (jsx.ts getElementChildren), so children must be passed as discrete JSX
// nodes — never an array literal (e.g. from `.map`). fLink() returns one node.
const fLink = (text: string) => (
  <ws.element
    ws:tag="a"
    ws:label="Link"
    href="#"
    ws:style={css`
      display: block;
      margin-bottom: 10px;
      font-size: 15px;
      color: #cbd5e1;
      text-decoration: none;
      transition: color 0.2s ease;
      &:hover {
        color: #ffffff;
      }
    `}
  >
    {text}
  </ws.element>
);

const fHeading = (text: string) => (
  <ws.element
    ws:tag="div"
    ws:label="Heading"
    ws:style={css`
      margin-bottom: 14px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
    `}
  >
    {text}
  </ws.element>
);

const Footer = () => (
  <ws.element
    ws:tag="footer"
    ws:label="Footer"
    ws:style={css`
      padding: 72px 24px 40px;
      font-family: ${FONT};
      background: #0f172a;
    `}
  >
    <ws.element
      ws:tag="div"
      ws:label="Top"
      ws:style={css`
        display: grid;
        grid-template-columns: 1.5fr 1fr 1fr 1fr;
        gap: 40px;
        max-width: 1100px;
        margin: 0 auto 48px;
        @media (max-width: 760px) {
          grid-template-columns: 1fr 1fr;
        }
      `}
    >
      <ws.element ws:tag="div" ws:label="Brand">
        <ws.element
          ws:tag="div"
          ws:label="Wordmark"
          ws:style={css`
            font-size: 22px;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 12px;
          `}
        >
          SabSites
        </ws.element>
        <ws.element
          ws:tag="p"
          ws:label="Tagline"
          ws:style={css`
            margin: 0;
            max-width: 260px;
            font-size: 15px;
            line-height: 1.6;
            color: #94a3b8;
          `}
        >
          The visual website builder for teams who move fast.
        </ws.element>
      </ws.element>
      <ws.element ws:tag="div" ws:label="Column">
        {fHeading("Product")}
        {fLink("Features")}
        {fLink("Templates")}
        {fLink("Pricing")}
        {fLink("Changelog")}
      </ws.element>
      <ws.element ws:tag="div" ws:label="Column">
        {fHeading("Company")}
        {fLink("About")}
        {fLink("Blog")}
        {fLink("Careers")}
        {fLink("Contact")}
      </ws.element>
      <ws.element ws:tag="div" ws:label="Column">
        {fHeading("Legal")}
        {fLink("Privacy")}
        {fLink("Terms")}
        {fLink("Security")}
      </ws.element>
    </ws.element>
    <ws.element
      ws:tag="div"
      ws:label="Bottom"
      ws:style={css`
        max-width: 1100px;
        margin: 0 auto;
        padding-top: 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 14px;
        color: #64748b;
      `}
    >
      © 2026 SabSites. Built with SabSites.
    </ws.element>
  </ws.element>
);

// ── Composite landing page ───────────────────────────────────────────────────

const LandingPage = () => (
  <ws.element ws:tag="div" ws:label="Landing Page">
    {Hero()}
    {LogoMarquee()}
    {Features()}
    {Stats()}
    {Pricing()}
    {Testimonials()}
    {Cta()}
    {Footer()}
  </ws.element>
);

const sectionMeta = (
  label: string,
  description: string,
  order: number,
  template: JSX.Element
): TemplateMeta => ({
  category: "sections",
  label,
  description,
  order,
  template,
});

export const sabsitesTemplates = {
  SabLandingPage: sectionMeta(
    "Landing page",
    "Full animated landing page — hero, logos, features, stats, pricing, testimonials, CTA, footer.",
    1,
    LandingPage()
  ),
  SabHero: sectionMeta(
    "Hero",
    "Animated gradient hero with eyebrow, heading, and call-to-action buttons.",
    2,
    Hero()
  ),
  SabLogoMarquee: sectionMeta(
    "Logo marquee",
    "Infinite horizontally scrolling row of logos.",
    3,
    LogoMarquee()
  ),
  SabFeatures: sectionMeta(
    "Features",
    "Three feature cards with staggered entrance and hover lift.",
    4,
    Features()
  ),
  SabStats: sectionMeta(
    "Stats",
    "Animated gradient band with key metrics.",
    5,
    Stats()
  ),
  SabPricing: sectionMeta(
    "Pricing",
    "Three pricing tiers with a highlighted featured plan.",
    6,
    Pricing()
  ),
  SabTestimonials: sectionMeta(
    "Testimonials",
    "Customer quote cards with avatars.",
    7,
    Testimonials()
  ),
  SabCta: sectionMeta(
    "Call to action",
    "Gradient CTA banner with shimmer and pulsing button.",
    8,
    Cta()
  ),
  SabFooter: sectionMeta(
    "Footer",
    "Multi-column dark footer with brand and link groups.",
    9,
    Footer()
  ),
} satisfies Record<string, TemplateMeta>;
