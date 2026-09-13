import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (no existe en el registro de Animate UI — se
// comprobó, HTTP 404 para "edit"/"pen"/"pen-line"/"square-pen") — mismo
// trazo que el "SquarePen"/"Edit" de Lucide (el mismo set de íconos en el
// que se basa toda la librería), armado a mano con el mismo motor
// (IconWrapper/useAnimateIconContext/useVariants) para que se vea y
// funcione IGUAL que el resto: el lápiz "pulsa" (scale) al hover/tap,
// el cuadro se queda quieto.
type EditProps = IconProps<keyof typeof animations>

const animations = {
  default: {
    square: {},
    pen: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.15, 1],
        transition: { duration: 0.5, ease: 'easeInOut' as const },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, ...props }: EditProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" variants={variants.square} initial="initial" animate={controls} />
      <motion.path
        d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"
        variants={variants.pen}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  )
}

function Edit(props: EditProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Edit, Edit as EditIcon, type EditProps, type EditProps as EditIconProps }
