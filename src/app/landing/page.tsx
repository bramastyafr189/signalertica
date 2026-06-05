"use client";

import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Clock,
  Globe,
  LayoutGrid,
  Lock,
  Moon,
  Radar,
  Radio,
  Search,
  ShieldCheck,
  Signal,
  Smartphone,
  Sun,
  Terminal,
  Zap,
} from "lucide-react";

const channels = [
  { name: "Middle East War", count: "+4", source: "Global policy watch" },
  { name: "Crypto", count: "+2", source: "Market volatility" },
  { name: "Gold", count: "+3", source: "Commodity desk" },
];

const steps = [
  {
    icon: Search,
    title: "Track the exact keywords",
    body: "Create focused channels for markets, politics, crypto, conflict, or any topic that matters to your work.",
  },
  {
    icon: Clock,
    title: "Let intervals do the checking",
    body: "Set each channel to scan on its own schedule. Manual scan stays available for quick keyword testing.",
  },
  {
    icon: Bell,
    title: "Receive one useful alert",
    body: "New articles are grouped into a compact signal report, so your phone gets context instead of noise.",
  },
];

const qualities = [
  "Private channels per user",
  "Server-side scans, not phone polling",
  "PWA-ready mobile alerts",
  "Logs auto-cleaned for fresh signal history",
];

export default function LandingPage() {
  const [isLight, setIsLight] = useState(false);

  return (
    <main className={`landing-shell ${isLight ? "is-light" : ""}`}>
      <section className="landing-hero">
        <div className="landing-hero-scene" aria-hidden="true">
          <div className="landing-orbit landing-orbit-a" />
          <div className="landing-orbit landing-orbit-b" />
          <div className="landing-scanline" />
          <div className="landing-device">
            <div className="landing-device-top">
              <div className="landing-logo-mark">
                <Image src="/icon-192x192.png" alt="" width={42} height={42} priority />
              </div>
              <div>
                <p>SIGNALERTICA</p>
                <span>SMART SIGNAL TRACKER</span>
              </div>
              <LayoutGrid size={18} />
            </div>
            <div className="landing-channel-strip">
              {["Crypto", "Conflict", "Policy", "Markets"].map((label, index) => (
                <div key={label} className={index === 1 ? "is-active" : ""}>
                  <Radar size={16} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="landing-signal-card">
              <div className="landing-badges">
                <span>ACTIVE CHANNEL</span>
                <span><Globe size={12} /> GLOBAL</span>
              </div>
              <h2>MIDDLE EAST WAR</h2>
              <div className="landing-pulse-row">
                <div>
                  <span>AUTO ALERTS</span>
                  <strong>ACTIVE</strong>
                </div>
                <div>
                  <span>INTERVAL</span>
                  <strong>15 MIN</strong>
                </div>
                <div className="landing-switch"><span /></div>
              </div>
              <div className="landing-keywords">
                <span>IRAN</span>
                <span>TRUMP</span>
                <span>HORMUZ</span>
              </div>
              <div className="landing-cta-fake">
                <Search size={16} />
                SCAN PIPELINE
              </div>
            </div>
          </div>
          <div className="landing-report">
            <span>INTELLIGENCE FEED</span>
            {channels.map((item) => (
              <div key={item.name}>
                <strong>{item.name}</strong>
                <em>{item.count}</em>
                <small>{item.source}</small>
              </div>
            ))}
          </div>
        </div>

        <nav className="landing-nav">
          <Link href="/landing" className="landing-brand">
            <Image src="/icon-192x192.png" alt="Signalertica" width={46} height={46} priority />
            <span>
              SIGNALERTICA
              <small>SMART SIGNAL TRACKER</small>
            </span>
          </Link>
          <div className="landing-nav-actions">
            <Link href="/" className="landing-ghost-link">Open App</Link>
            <button
              onClick={() => setIsLight((value) => !value)}
              className="landing-icon-button"
              aria-label={isLight ? "Switch to dark landing theme" : "Switch to light landing theme"}
            >
              {isLight ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={() => signIn("google")} className="landing-icon-button" aria-label="Authorize access">
              <Lock size={18} />
            </button>
          </div>
        </nav>

        <div className="landing-hero-content">
          <div className="landing-kicker">
            <Radio size={15} />
            Keyword intelligence for fast-moving news
          </div>
          <h1>Track signals before they become noise.</h1>
          <p>
            Signalertica watches the topics you care about, groups matching articles into clean intelligence logs,
            and sends focused mobile alerts on the interval you choose.
          </p>
          <div className="landing-actions">
            <button onClick={() => signIn("google")} className="landing-primary">
              Authorize Access
              <ArrowRight size={18} />
            </button>
            <Link href="/" className="landing-secondary">
              View Demo
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section landing-proof">
        <div className="landing-section-title">
          <span>BUILT FOR PHONE-FIRST ALERTING</span>
          <h2>Runs quietly until there is something worth seeing.</h2>
        </div>
        <div className="landing-proof-grid">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.title}>
                <div><Icon size={22} /></div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section landing-split">
        <div className="landing-monitor-panel">
          <div className="landing-monitor-head">
            <span><Signal size={16} /> LIVE MONITOR</span>
            <em>SERVER SIDE</em>
          </div>
          <div className="landing-monitor-radar">
            <Radar size={74} />
          </div>
          <div className="landing-monitor-list">
            <div>
              <strong>Crypto</strong>
              <span>Next scan 04:12</span>
            </div>
            <div>
              <strong>War Watch</strong>
              <span>Next scan 09:44</span>
            </div>
            <div>
              <strong>Market Pulse</strong>
              <span>Manual mode</span>
            </div>
          </div>
        </div>

        <div className="landing-copy">
          <span>WHY IT FEELS LIGHT</span>
          <h2>Alerts come from the server, not from your phone working overtime.</h2>
          <p>
            The PWA does not need to keep polling in the background to deliver alerts. Server scans handle the heavy
            work, then Web Push wakes the device only when a channel finds new signals.
          </p>
          <div className="landing-quality-list">
            {qualities.map((quality) => (
              <div key={quality}>
                <ShieldCheck size={16} />
                {quality}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-final">
        <div>
          <Zap size={28} />
          <h2>Start with one channel. Let the pipeline prove itself.</h2>
          <p>Create a focused channel, add a few keywords, run a manual scan, then let interval alerts take over.</p>
        </div>
        <div className="landing-final-actions">
          <button onClick={() => signIn("google")} className="landing-primary">
            Get Access
            <ArrowRight size={18} />
          </button>
          <Link href="/" className="landing-secondary">
            Open Demo
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <span>SIGNALERTICA</span>
        <div>
          <Smartphone size={15} />
          PWA-ready signal monitoring
        </div>
        <Terminal size={15} />
      </footer>
    </main>
  );
}
