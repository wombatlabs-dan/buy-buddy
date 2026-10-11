import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/pricing";
import "./hero-crate.css";

const pieces = [
  { name: "box", file: "crate-empty.webp" },
  { name: "gpu", file: "crate-gpu.webp" },
  { name: "note", file: "crate-note-midnight.webp" },
  { name: "glass", file: "crate-glass.webp" },
] as const;

/** The original composition stays intact at rest; cutout layers unpack on hover. */
export function HeroCrate() {
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const loaded = useRef(new Set<string>());
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !button.current?.contains(event.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [expanded]);

  return (
    <button
      ref={button}
      type="button"
      className="hero-crate"
      data-expanded={ready && expanded}
      aria-label="Unpack the crate illustration"
      aria-description="Hover to spread the pieces out. On a touchscreen, tap to open or close. Press Escape to close."
      aria-pressed={ready && expanded}
      disabled={!ready}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setExpanded(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setExpanded(false);
      }}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) setExpanded(true);
      }}
      onBlur={() => setExpanded(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setExpanded(false);
          event.stopPropagation();
        }
      }}
      onClick={(event) => {
        if (event.detail === 0 || window.matchMedia("(hover: none)").matches) {
          setExpanded((value) => !value);
        }
      }}
    >
      <img
        src={asset("images/hero-crate.png")}
        alt="An orange crate holding a used graphics card, a handwritten note and a magnifying glass"
        className="hero-crate__original"
        width={1024}
        height={1024}
        draggable={false}
        fetchPriority="high"
      />
      {pieces.map(({ name, file }) => (
        <img
          key={name}
          src={asset(`images/${file}`)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={`hero-crate__piece hero-crate__${name}`}
          onLoad={() => {
            loaded.current.add(name);
            if (loaded.current.size === pieces.length) setReady(true);
          }}
          onError={() => {
            loaded.current.delete(name);
            setReady(false);
          }}
        />
      ))}
    </button>
  );
}
