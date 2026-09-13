import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (no existe en el registro de Animate UI — se
// comprobó, HTTP 404 para "shopping-cart") — mismo trazo EXACTO que el
// `IconCart` estático que ya vivía en `ui/shared/icons.tsx` (incluido el
// prop `filled`, para el estado "ya está en el carrito"), armado con el
// mismo motor que el resto: la canasta "rebota" (scale) al hover/tap.
type CartProps = IconProps<keyof typeof animations> & { filled?: boolean }

const animations = {
  default: {
    wheelLeft: {},
    wheelRight: {},
    basket: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.1, 0.97, 1],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, filled, ...props }: CartProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.circle cx={9} cy={20} r={1} fill={filled ? 'currentColor' : 'none'} variants={variants.wheelLeft} initial="initial" animate={controls} />
      <motion.circle cx={18} cy={20} r={1} fill={filled ? 'currentColor' : 'none'} variants={variants.wheelRight} initial="initial" animate={controls} />
      <motion.path
        d="M2.5 3h2l2.4 12.1a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6"
        fill={filled ? 'currentColor' : 'none'}
        fillOpacity={filled ? 0.25 : undefined}
        variants={variants.basket}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  )
}

function Cart(props: CartProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Cart, Cart as CartIcon, type CartProps, type CartProps as CartIconProps }
