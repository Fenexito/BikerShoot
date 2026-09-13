import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (no existe en el registro de Animate UI — se
// comprobó, HTTP 404 para "eye") — mismo trazo que el "Eye" de Lucide,
// armado a mano con el mismo motor que el resto: el párpado se "cierra y
// abre" (scaleY, eje en el centro vertical) simulando un parpadeo al
// hover/tap, la pupila queda quieta.
type EyeProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    lid: {
      initial: { scaleY: 1 },
      animate: {
        scaleY: [1, 0.1, 1],
        transition: { duration: 0.4, ease: 'easeInOut' as const },
      },
    },
    pupil: {},
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: EyeProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" style={{ transformOrigin: '12px 12px' }} variants={variants.lid} initial="initial" animate={controls} />
      <motion.circle cx={12} cy={12} r={3} variants={variants.pupil} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function Eye(props: EyeProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Eye, Eye as EyeIcon, type EyeProps, type EyeProps as EyeIconProps }
