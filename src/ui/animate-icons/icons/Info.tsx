import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (no existe en el registro de Animate UI — se
// comprobó, HTTP 404 para "info") — mismo trazo que el "Info" de Lucide,
// armado a mano con el mismo motor que el resto. El punto de la "i" hace
// un pulso (scale) al hover/tap, el círculo y la línea se quedan quietos.
type InfoProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    circle: {},
    line: {},
    dot: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.4, 1],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: InfoProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.circle cx={12} cy={12} r={10} variants={variants.circle} initial="initial" animate={controls} />
      <motion.path d="M12 16v-4" variants={variants.line} initial="initial" animate={controls} />
      <motion.path d="M12 8h.01" variants={variants.dot} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function Info(props: InfoProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Info, Info as InfoIcon, type InfoProps, type InfoProps as InfoIconProps }
