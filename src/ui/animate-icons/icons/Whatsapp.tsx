import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (logo de marca — Animate UI no tiene íconos de
// marca, solo el set genérico de Lucide) — mismo trazo que el WhatsApp
// estático que ya vivía en `ui/shared/icons.tsx` (`IconWhatsapp`), armado
// con el mismo motor que el resto: un pulso (scale) al hover/tap.
type WhatsappProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    bubble: {},
    phone: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.15, 1],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: WhatsappProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <motion.path
        d="M12.02 2C6.5 2 2.02 6.48 2.02 12c0 1.85.51 3.58 1.38 5.06L2 22l5.08-1.34a9.94 9.94 0 0 0 4.94 1.31h.01c5.52 0 10-4.48 10-10S17.54 2 12.02 2Zm0 18.17h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.01.79.8-2.94-.19-.3a8.17 8.17 0 0 1-1.25-4.4c0-4.53 3.68-8.21 8.21-8.21 4.53 0 8.21 3.68 8.21 8.21 0 4.53-3.68 8.18-8.28 8.18Z"
        variants={variants.bubble}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M17.47 14.38c-.29-.15-1.7-.84-1.97-.93-.26-.1-.46-.15-.65.14-.2.3-.75.94-.92 1.13-.17.2-.34.22-.63.08-.29-.15-1.23-.46-2.34-1.46-.87-.77-1.45-1.73-1.62-2.02-.17-.3-.02-.46.13-.6.13-.13.29-.34.44-.51.15-.17.2-.3.29-.49.1-.2.05-.37-.02-.51-.08-.15-.65-1.58-.9-2.16-.24-.58-.48-.5-.65-.5h-.56c-.2 0-.5.07-.77.37-.26.3-1 .98-1 2.4s1.03 2.79 1.17 2.98c.15.2 2.03 3.1 4.92 4.35.69.3 1.22.47 1.64.6.69.22 1.31.19 1.81.11.55-.08 1.7-.7 1.94-1.37.24-.68.24-1.26.17-1.38-.07-.13-.26-.2-.55-.35Z"
        variants={variants.phone}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  )
}

function Whatsapp(props: WhatsappProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Whatsapp, Whatsapp as WhatsappIcon, type WhatsappProps, type WhatsappProps as WhatsappIconProps }
