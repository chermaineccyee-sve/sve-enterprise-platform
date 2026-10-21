"use client";

import { m, useScroll, useSpring } from "motion/react";
import { useEffect, useState } from "react";

/** Sticky contents with the active section highlighted and reading progress. */
export function ArticleToc({ items, targetId }: { items: { id: string; text: string }[]; targetId: string }) {
  const [active, setActive] = useState(items[0]?.id);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resolve the article element after mount
    setTarget(document.getElementById(targetId));
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    items.forEach((i) => {
      const el = document.getElementById(i.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [items, targetId]);

  return (
    <nav aria-label="Contents" className="hidden lg:block">
      <p className="eyebrow text-stone">Contents</p>
      <div className="relative mt-4">
        <span className="absolute inset-y-0 left-0 w-px bg-rule" />
        {target && <Progress target={target} />}
        <ol className="space-y-2.5">
          {items.map((h) => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                aria-current={active === h.id ? "location" : undefined}
                className={`block pl-4 text-[13.5px] leading-snug transition-colors ${active === h.id ? "font-medium text-teal-900" : "text-stone hover:text-teal-800"}`}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

function Progress({ target }: { target: HTMLElement }) {
  const { scrollYProgress } = useScroll({ target: { current: target }, offset: ["start 30%", "end 70%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return <m.span aria-hidden className="absolute inset-y-0 left-0 w-[2px] origin-top bg-gold-500" style={{ scaleY }} />;
}
