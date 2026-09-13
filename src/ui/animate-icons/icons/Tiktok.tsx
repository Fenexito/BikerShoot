import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (logo de marca) — mismo trazo que el
// `IconTiktok` estático de `ui/shared/icons.tsx`, armado con el mismo
// motor que el resto: un pulso (scale) al hover/tap.
type TiktokProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    note: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.15, 1],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
    swoosh: {},
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: TiktokProps) {
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
      <motion.path d="M14 3v10.5a3 3 0 1 1-3-3" variants={variants.note} initial="initial" animate={controls} />
      <motion.path d="M14 3c.6 2.6 2.3 4.2 5 4.5" variants={variants.swoosh} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function Tiktok(props: TiktokProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Tiktok, Tiktok as TiktokIcon, type TiktokProps, type TiktokProps as TiktokIconProps }
