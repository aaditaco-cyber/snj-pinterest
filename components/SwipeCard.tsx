"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { ExternalLink } from "lucide-react";
import type { Product } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/categories";
import { Badge } from "./Badge";

const SWIPE_THRESHOLD = 110;

export function SwipeCard({
  product,
  stackIndex,
  isTop,
  onSwipe,
}: {
  product: Product;
  stackIndex: number;
  isTop: boolean;
  onSwipe: (direction: "skip" | "save") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);
  const saveOpacity = useTransform(x, [40, 130], [0, 1]);
  const skipOpacity = useTransform(x, [-130, -40], [1, 0]);

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 600) {
      onSwipe("save");
    } else if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -600) {
      onSwipe("skip");
    }
  };

  return (
    <motion.div
      className="absolute inset-0 no-select"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        zIndex: 10 - stackIndex,
      }}
      initial={{ scale: 1 - stackIndex * 0.04, y: stackIndex * 10, opacity: 0 }}
      animate={{
        scale: 1 - stackIndex * 0.04,
        y: stackIndex * 10,
        opacity: 1,
      }}
      exit={{
        x: x.get() > 0 ? 600 : -600,
        rotate: x.get() > 0 ? 25 : -25,
        opacity: 0,
        transition: { duration: 0.28, ease: "easeOut" },
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      whileTap={isTop ? { cursor: "grabbing" } : undefined}
    >
      <div className="relative h-full w-full overflow-hidden rounded-3xl bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-border">
        {/* Image */}
        <div className="relative h-[62%] w-full bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full object-cover"
            draggable={false}
          />

          {/* Drag direction indicators */}
          {isTop && (
            <>
              <motion.div
                style={{ opacity: saveOpacity }}
                className="pointer-events-none absolute left-5 top-5 rounded-md border-2 border-save px-3 py-1.5 text-sm font-bold tracking-widest text-save bg-card/80 backdrop-blur-sm rotate-[-8deg]"
              >
                SAVE
              </motion.div>
              <motion.div
                style={{ opacity: skipOpacity }}
                className="pointer-events-none absolute right-5 top-5 rounded-md border-2 border-skip px-3 py-1.5 text-sm font-bold tracking-widest text-skip bg-card/80 backdrop-blur-sm rotate-[8deg]"
              >
                SKIP
              </motion.div>
            </>
          )}
        </div>

        {/* Info panel */}
        <div className="flex h-[38%] flex-col gap-2 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs uppercase tracking-wide text-muted-2">
                {product.retailer}
              </p>
              <h2 className="mt-0.5 line-clamp-2 text-base font-semibold leading-snug">
                {product.title}
              </h2>
            </div>
            {product.priceDisplay && (
              <div className="shrink-0 text-right">
                <p className="text-lg font-semibold tracking-tight">
                  {product.priceDisplay}
                </p>
              </div>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-1.5">
            <Badge tone="accent">{CATEGORY_LABEL[product.category]}</Badge>
            {product.metalType && <Badge>{product.metalType}</Badge>}
            {product.caratWeight && <Badge>{product.caratWeight}</Badge>}
            {product.stoneType && <Badge tone="muted">{product.stoneType}</Badge>}
          </div>

          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on {product.retailer}
          </a>
        </div>
      </div>
    </motion.div>
  );
}
