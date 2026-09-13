import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (no existe en el registro de Animate UI — se
// comprobó, HTTP 404 para "receipt") — mismo trazo que el `IconReceipt`
// estático que ya vivía en `ui/shared/icons.tsx`, armado con el mismo
// motor: las 3 líneas de texto "se escriben" (dibujado vía pathLength) al
// hover/tap, el borde del recibo queda quieto.
type ReceiptProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    body: {},
    lines: {
      initial: { pathLength: 1, opacity: 1 },
      animate: {
        pathLength: [0, 1],
        opacity: [0, 1],
        transition: { duration: 0.4, ease: 'easeInOut' as const },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: ReceiptProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.path d="M6 2h12v19.5a.5.5 0 0 1-.8.4l-1.7-1.3-1.7 1.3a.5.5 0 0 1-.6 0l-1.7-1.3-1.7 1.3a.5.5 0 0 1-.6 0l-1.7-1.3-1.7 1.3a.5.5 0 0 1-.8-.4V2Z" variants={variants.body} initial="initial" animate={controls} />
      <motion.line x1={8.5} y1={7} x2={15.5} y2={7} variants={variants.lines} initial="initial" animate={controls} />
      <motion.line x1={8.5} y1={11} x2={15.5} y2={11} variants={variants.lines} initial="initial" animate={controls} />
      <motion.line x1={8.5} y1={15} x2={12.5} y2={15} variants={variants.lines} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function Receipt(props: ReceiptProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Receipt, Receipt as ReceiptIcon, type ReceiptProps, type ReceiptProps as ReceiptIconProps }
