import { motion, type Variants } from 'motion/react'

import { useVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../icon'

// Ícono CREADO por nosotros (no existe en el registro de Animate UI — se
// comprobó, HTTP 404 para "bookmark") — mismo trazo que el `IconBookmark`
// estático que ya vivía en `ui/shared/icons.tsx` (incluido el prop
// `filled`, para el estado "ya guardada"), armado con el mismo motor:
// "rebota" (scale) al hover/tap.
type BookmarkProps = IconProps<keyof typeof animations> & { filled?: boolean }

const animations = {
  default: {
    path: {
      initial: { scale: 1 },
      animate: { scale: [1, 1.15, 0.97, 1], transition: { duration: 0.5, ease: 'easeInOut' as const } },
    },
  } satisfies Record<string, Variants>,
} as const

function IconComponent({ size, filled, ...props }: BookmarkProps) {
  const { controls } = useAnimateIconContext()
  const variants = useVariants(animations)

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.path
        d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2-7 4.2V4.5a1 1 0 0 1 1-1z"
        style={{ transformOrigin: '12px 12px' }}
        variants={variants.path}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  )
}

function Bookmark(props: BookmarkProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}

export { animations, Bookmark, Bookmark as BookmarkIcon, type BookmarkProps, type BookmarkProps as BookmarkIconProps }
