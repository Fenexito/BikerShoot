import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (logo de marca) — mismo trazo que el
// `IconInstagram` estático de `ui/shared/icons.tsx`, armado con el mismo
// motor que el resto: el "flash" de la cámara (el puntito) pulsa al
// hover/tap, el resto se queda quieto.
type InstagramProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    frame: {},
    lens: {},
    flash: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.8, 1],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: InstagramProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.rect x={3} y={3} width={18} height={18} rx={5} variants={variants.frame} initial="initial" animate={controls} />
      <motion.circle cx={12} cy={12} r={4} variants={variants.lens} initial="initial" animate={controls} />
      <motion.circle cx={17.5} cy={6.5} r={0.6} fill="currentColor" stroke="none" variants={variants.flash} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function Instagram(props: InstagramProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Instagram, Instagram as InstagramIcon, type InstagramProps, type InstagramProps as InstagramIconProps }
