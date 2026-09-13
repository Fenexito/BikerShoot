import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (no existe en el registro de Animate UI — se
// comprobó, HTTP 404 para "images"/"image") — mismo trazo que el "Images"
// de Lucide, armado a mano con el mismo motor que el resto. El "sol" (el
// círculo chico) pulsa (scale) al hover/tap, el resto se queda quieto.
type ImagesProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    back: {},
    mountain: {},
    sun: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.3, 1],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
    frame: {},
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: ImagesProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.path d="M18 22H4a2 2 0 0 1-2-2V6" variants={variants.back} initial="initial" animate={controls} />
      <motion.path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" variants={variants.mountain} initial="initial" animate={controls} />
      <motion.circle cx={12} cy={8} r={2} variants={variants.sun} initial="initial" animate={controls} />
      <motion.rect width={16} height={16} x={6} y={2} rx={2} variants={variants.frame} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function Images(props: ImagesProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Images, Images as ImagesIcon, type ImagesProps, type ImagesProps as ImagesIconProps }
