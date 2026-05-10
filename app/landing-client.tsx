"use client";

// Landing-page interactive bits, isolated from the server-rendered
// markup so the rest of the page stays a server component.
//
//   1. Adds `.scrolled` to the sticky nav after the user scrolls
//      a few pixels — switches the nav from solid to translucent
//      blur.
//   2. Toggles the mobile drawer on hamburger click; closes the
//      drawer when any link inside is clicked.
//   3. Reveal-on-scroll for cards / quotes / tiers — items
//      starting below the fold are hidden until they enter view,
//      then fade up. Items already in view stay visible.
//
// All effects degrade gracefully — no JS = static page in its
// finished, fully visible form.

import { useEffect } from "react";

export default function LandingClient() {
  useEffect(() => {
    const navEl = document.querySelector<HTMLElement>(".landing .nav");
    const onScroll = () => navEl?.classList.toggle("scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const menuBtn = document.getElementById("navMenuBtn");
    const drawer = document.getElementById("navDrawer");
    const onMenuClick = () => drawer?.classList.toggle("open");
    const onDrawerLink = () => drawer?.classList.remove("open");
    menuBtn?.addEventListener("click", onMenuClick);
    const drawerLinks = drawer ? Array.from(drawer.querySelectorAll("a")) : [];
    drawerLinks.forEach((a) => a.addEventListener("click", onDrawerLink));

    // Reveal-on-scroll. Hide items currently below the fold so they
    // animate in; everything above the fold stays visible. If
    // IntersectionObserver fails for any reason, content remains
    // visible — this is purely additive polish.
    let observer: IntersectionObserver | null = null;
    try {
      const els = document.querySelectorAll<HTMLElement>(
        ".landing .aud, .landing .feat, .landing .path, .landing .quote, .landing .tier",
      );
      const vh = window.innerHeight || 800;
      els.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top > vh * 0.9) el.classList.add("reveal", "pre");
      });
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.remove("pre");
              e.target.classList.add("in");
              observer?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
      );
      document
        .querySelectorAll(".landing .reveal.pre")
        .forEach((el) => observer!.observe(el));
    } catch {
      // non-fatal — content is visible by default
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      menuBtn?.removeEventListener("click", onMenuClick);
      drawerLinks.forEach((a) => a.removeEventListener("click", onDrawerLink));
      observer?.disconnect();
    };
  }, []);

  return null;
}
