import { useEffect, useRef, useState } from 'react';

const BATCH = 250;
export function useInfiniteScroll<T>(items: T[], batch = BATCH) {
  const [count, setCount] = useState(batch);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCount(batch);
  }, [items, batch]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCount((c) => (c < items.length ? c + batch : c));
        }
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length, count, batch]);

  return {
    visible: count >= items.length ? items : items.slice(0, count),
    hasMore: count < items.length,
    sentinelRef
  };
}
