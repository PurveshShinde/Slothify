import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component
 * Ensures that whenever the route or page changes, the window, the main content area,
 * and any inner scroll containers are immediately and reliably scrolled to the very top.
 */
const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const scrollToTop = () => {
      // 1. Reset standard browser window scroll
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;

      // 2. Reset the main app scrolling container and any page-level containers
      const containers = document.querySelectorAll(
        'main, [class*="overflow-y-auto"], [class*="overflow-auto"]'
      );
      containers.forEach(el => {
        el.scrollTop = 0;
      });
    };

    // Immediate scroll reset
    scrollToTop();

    // Re-assert on next animation frame after component mounts and renders
    const rafId = requestAnimationFrame(() => {
      scrollToTop();
    });

    // Final safety timeout to account for dynamic DOM adjustments / transitions
    const timerId = setTimeout(() => {
      scrollToTop();
    }, 50);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [pathname, search]);

  return null;
};

export default ScrollToTop;
