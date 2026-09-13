import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (no existe en el registro de Animate UI — se
// comprobó, HTTP 404 para "share") — mismo trazo que el `IconShare`
// estático que ya vivía en `ui/shared/icons.tsx` (3 nodos conectados por
// líneas), armado con el mismo motor: los 3 nodos "laten" (scale) al
// hover/tap, las líneas quedan quietas.
type ShareProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    nodes: {
      initial: { scale: 1 },
      animate: { scale: [1, 1.3, 1], transition: { duration: 0.5, ease: 'easeInOut' as const } },
    },
    lines: {},
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: ShareProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4" variants={variants.lines} initial="initial" animate={controls} />
      <motion.circle cx={18} cy={5} r={2.5} style={{ transformOrigin: '18px 5px' }} variants={variants.nodes} initial="initial" animate={controls} />
      <motion.circle cx={6} cy={12} r={2.5} style={{ transformOrigin: '6px 12px' }} variants={variants.nodes} initial="initial" animate={controls} />
      <motion.circle cx={18} cy={19} r={2.5} style={{ transformOrigin: '18px 19px' }} variants={variants.nodes} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function Share(props: ShareProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Share, Share as ShareIcon, type ShareProps, type ShareProps as ShareIconProps }
