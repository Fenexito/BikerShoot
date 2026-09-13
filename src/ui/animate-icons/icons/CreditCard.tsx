import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (no existe en el registro de Animate UI — se
// comprobó, HTTP 404 para "credit-card") — mismo trazo que el
// "CreditCard" de Lucide, armado a mano con el mismo motor. La franja
// magnética se "desliza" (una barra que cruza la tarjeta) al hover/tap —
// pensado para Planes y facturación.
type CreditCardProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    card: {},
    stripe: {
      initial: { scaleX: 1, opacity: 1 },
      animate: {
        scaleX: [1, 0.85, 1],
        opacity: [1, 0.5, 1],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: CreditCardProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.rect width={20} height={14} x={2} y={5} rx={2} variants={variants.card} initial="initial" animate={controls} />
      <motion.line x1={2} x2={22} y1={10} y2={10} variants={variants.stripe} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function CreditCard(props: CreditCardProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, CreditCard, CreditCard as CreditCardIcon, type CreditCardProps, type CreditCardProps as CreditCardIconProps }
