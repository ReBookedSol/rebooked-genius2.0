import React from 'react';
import { motion, useReducedMotion, HTMLMotionProps } from 'framer-motion';
import { useAnimationContext } from '@/contexts/AnimationContext';

interface MotionConditionalProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "span" | "section" | "article" | "aside" | "header" | "footer" | "nav" | "main";
}

/**
 * A wrapper for framer-motion's motion.div that respects the global animationsEnabled 
 * preference and the OS-level prefers-reduced-motion setting.
 * When animations are disabled, it renders a plain element without motion overhead.
 */
export const MotionConditional: React.FC<MotionConditionalProps> = ({ 
  children, 
  as = "div",
  ...motionProps 
}) => {
  const { animationsEnabled } = useAnimationContext();
  const shouldReduce = useReducedMotion();

  // If animations are globally disabled or the user prefers reduced motion
  if (!animationsEnabled || shouldReduce) {
    // Extract motion-specific props to avoid passing them to a plain DOM element
    const { 
      initial, 
      animate, 
      exit, 
      transition, 
      variants, 
      whileHover, 
      whileTap, 
      whileFocus, 
      whileDrag, 
      whileInView,
      viewport,
      onAnimationStart,
      onAnimationComplete,
      onUpdate,
      onPan,
      onPanStart,
      onPanEnd,
      onTap,
      onTapStart,
      onTapCancel,
      onDrag,
      onDragStart,
      onDragEnd,
      onDirectionLock,
      layout,
      layoutId,
      layoutScroll,
      drag,
      dragControls,
      dragListener,
      dragMomentum,
      dragElastic,
      dragConstraints,
      dragSnapToOrigin,
      dragPropagation,
      dragTransition,
      ...htmlProps 
    } = motionProps as any;

    const Component = as as any;
    return <Component {...htmlProps}>{children}</Component>;
  }

  const MotionComponent = (motion as any)[as];
  return <MotionComponent {...motionProps}>{children}</MotionComponent>;
};
