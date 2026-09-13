import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros — no está en el registro de Animate UI (solo
// trae "chevron-down"/"chevron-left"/"chevron-up"), pero es el espejo
// exacto de ChevronLeft.tsx (mismo trazo de Lucide, mismo motor): se
// desliza hacia la derecha en vez de la izquierda.
type ChevronRightProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    path: {
      initial: { x: 0, transition: { duration: 0.3, ease: 'easeInOut' as const } },
      animate: { x: 4, transition: { duration: 0.3, ease: 'easeInOut' as const } },
    },
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: ChevronRightProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.path d="m9 18 6-6-6-6" variants={variants.path} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function ChevronRight(props: ChevronRightProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, ChevronRight, ChevronRight as ChevronRightIcon, type ChevronRightProps, type ChevronRightProps as ChevronRightIconProps }
