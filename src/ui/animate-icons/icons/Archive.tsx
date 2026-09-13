import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (no existe en el registro de Animate UI — se
// comprobó, HTTP 404 para "archive"/"box"/"package") — mismo trazo que el
// "Archive" de Lucide, armado a mano con el mismo motor. La tapa "se
// levanta" un poco (translate) al hover/tap — pensado para Almacenamiento.
type ArchiveProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    lid: {
      initial: { y: 0 },
      animate: {
        y: [0, -1.5, 0],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
    box: {},
    slot: {},
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: ArchiveProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.rect width={20} height={5} x={2} y={3} rx={1} variants={variants.lid} initial="initial" animate={controls} />
      <motion.path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" variants={variants.box} initial="initial" animate={controls} />
      <motion.path d="M10 12h4" variants={variants.slot} initial="initial" animate={controls} />
    </motion.svg>
  )
}

function Archive(props: ArchiveProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Archive, Archive as ArchiveIcon, type ArchiveProps, type ArchiveProps as ArchiveIconProps }
