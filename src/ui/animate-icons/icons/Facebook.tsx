import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (logo de marca) — mismo trazo que el
// `IconFacebook` estático de `ui/shared/icons.tsx`, armado con el mismo
// motor que el resto: un pulso (scale) al hover/tap.
type FacebookProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    path: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.15, 1],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: FacebookProps) {
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
      <motion.path d="M15 4h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h2.5l.5-4H13V8a1 1 0 0 1 1-1h2z" variants={variants.path} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function Facebook(props: FacebookProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Facebook, Facebook as FacebookIcon, type FacebookProps, type FacebookProps as FacebookIconProps }
