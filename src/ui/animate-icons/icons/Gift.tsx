import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (no existe en el registro de Animate UI — se
// comprobó, HTTP 404 para "gift") — mismo trazo EXACTO que el `IconGift`
// estático que ya vivía en `ui/shared/icons.tsx` (incluido el prop
// `filled`, para el estado de "regalo activo"), armado con el mismo motor
// que el resto: el moño (los dos lazos de arriba) se "abre" un poco
// (scale) al hover/tap.
type GiftProps = IconProps<keyof typeof animations> & { filled?: boolean }

const animations = {
  default: {
    box: {},
    lid: {},
    ribbon: {},
    bowLeft: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.15, 1],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
    bowRight: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.15, 1],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, filled, ...props }: GiftProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      fillOpacity={filled ? 0.2 : undefined}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.rect x={3} y={8.5} width={18} height={4} rx={1} variants={variants.box} initial="initial" animate={controls} />
      <motion.path d="M5 12.5h14V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7.5z" variants={variants.lid} initial="initial" animate={controls} />
      <motion.path d="M12 8.5V21" variants={variants.ribbon} initial="initial" animate={controls} />
      <motion.path d="M12 8.5c0-2 -1.5-4 -3.5-4S6 6 6 7.25 7.5 8.5 9 8.5h3z" variants={variants.bowLeft} initial="initial" animate={controls} />
      <motion.path d="M12 8.5c0-2 1.5-4 3.5-4S18 6 18 7.25 16.5 8.5 15 8.5h-3z" variants={variants.bowRight} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function Gift(props: GiftProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Gift, Gift as GiftIcon, type GiftProps, type GiftProps as GiftIconProps }
