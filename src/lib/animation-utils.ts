// Animation preset definitions for consistent use across the app
export const animationPresets = {
  // Basic entrance animations
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2, ease: 'linear' },
  },

  fadeUp: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  fadeDown: {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  slideLeft: {
    initial: { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 10 },
    transition: { duration: 0.2, ease: 'easeOut' },
  },

  slideRight: {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -10 },
    transition: { duration: 0.2, ease: 'easeOut' },
  },

  // Scale animations
  scaleIn: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
    transition: { duration: 0.2, ease: 'easeOut' },
  },

  scaleUp: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Bounce animations - simplified to fadeUp for better performance
  bounceIn: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Celebration animations - reduced intensity
  celebration: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.8, opacity: 0 },
    transition: { duration: 0.4, ease: 'backOut' },
  },

  // Floating/pulsing animations
  float: {
    animate: {
      y: [0, -10, 0],
    },
    transition: {
      duration: 3,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },

  pulse: {
    animate: {
      scale: [1, 1.05, 1],
    },
    transition: {
      duration: 2,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },

  // Stagger for lists
  staggerContainer: {
    initial: 'hidden',
    animate: 'visible',
    variants: {
      visible: {
        transition: {
          staggerChildren: 0.1,
        },
      },
    },
  },

  staggerItem: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' },
    },
  },
};

// Delay helper for staggered animations
export const getStaggerDelay = (index: number, baseDelay: number = 0.05): number => {
  return index * baseDelay;
};

// Animation timing presets
export const timingPresets = {
  fast: 0.2,
  normal: 0.4,
  slow: 0.6,
  verySlow: 1,
};

// Spring presets for natural motion - adjusted for stability
export const springPresets = {
  gentle: { stiffness: 80, damping: 20 },
  bouncy: { stiffness: 150, damping: 15 },
  normal: { stiffness: 120, damping: 25 },
  smooth: { stiffness: 60, damping: 25 },
};

// Easing presets
export const easingPresets = {
  easeIn: 'easeIn',
  easeOut: 'easeOut',
  easeInOut: 'easeInOut',
  linear: 'linear',
  cubic: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'spring',
};
