import { useState, type ComponentType } from 'react'
import { cn } from '../../lib/cn'
import type { IconProps } from '../../ui/animate-icons/icon'
import { ThemeTogglerButton } from '../../ui/animate-components/ThemeTogglerButton'
import type { ThemeSelection } from '../../ui/animate-components/theme-toggler-primitive'
import { Bell } from '../../ui/animate-icons/icons/Bell'
import { BellRing } from '../../ui/animate-icons/icons/BellRing'
import { Bot } from '../../ui/animate-icons/icons/Bot'
import { Check } from '../../ui/animate-icons/icons/Check'
import { ChevronDown } from '../../ui/animate-icons/icons/ChevronDown'
import { Clock } from '../../ui/animate-icons/icons/Clock'
import { Edit } from '../../ui/animate-icons/icons/Edit'
import { Info } from '../../ui/animate-icons/icons/Info'
import { Images } from '../../ui/animate-icons/icons/Images'
import { Whatsapp } from '../../ui/animate-icons/icons/Whatsapp'
import { Instagram } from '../../ui/animate-icons/icons/Instagram'
import { Facebook } from '../../ui/animate-icons/icons/Facebook'
import { Tiktok } from '../../ui/animate-icons/icons/Tiktok'
import { Gift } from '../../ui/animate-icons/icons/Gift'
import { CreditCard } from '../../ui/animate-icons/icons/CreditCard'
import { Archive } from '../../ui/animate-icons/icons/Archive'
import { ChevronUp } from '../../ui/animate-icons/icons/ChevronUp'
import { ArrowUp } from '../../ui/animate-icons/icons/ArrowUp'
import { Cart } from '../../ui/animate-icons/icons/Cart'
import { ChevronLeft } from '../../ui/animate-icons/icons/ChevronLeft'
import { CirclePlus } from '../../ui/animate-icons/icons/CirclePlus'
import { CircleX } from '../../ui/animate-icons/icons/CircleX'
import { ClipboardCheck } from '../../ui/animate-icons/icons/ClipboardCheck'
import { CloudDownload } from '../../ui/animate-icons/icons/CloudDownload'
import { Compass } from '../../ui/animate-icons/icons/Compass'
import { Copy } from '../../ui/animate-icons/icons/Copy'
import { Download } from '../../ui/animate-icons/icons/Download'
import { Ellipsis } from '../../ui/animate-icons/icons/Ellipsis'
import { ExternalLink } from '../../ui/animate-icons/icons/ExternalLink'
import { Heart } from '../../ui/animate-icons/icons/Heart'
import { LayoutDashboard } from '../../ui/animate-icons/icons/LayoutDashboard'
import { Link2 } from '../../ui/animate-icons/icons/Link2'
import { List } from '../../ui/animate-icons/icons/List'
import { Loader } from '../../ui/animate-icons/icons/Loader'
import { LoaderCircle } from '../../ui/animate-icons/icons/LoaderCircle'
import { LoaderPinwheel } from '../../ui/animate-icons/icons/LoaderPinwheel'
import { Lock } from '../../ui/animate-icons/icons/Lock'
import { LockOpen } from '../../ui/animate-icons/icons/LockOpen'
import { LogIn } from '../../ui/animate-icons/icons/LogIn'
import { LogOut } from '../../ui/animate-icons/icons/LogOut'
import { MapPin } from '../../ui/animate-icons/icons/MapPin'
import { Maximize } from '../../ui/animate-icons/icons/Maximize'
import { Menu } from '../../ui/animate-icons/icons/Menu'
import { Minimize } from '../../ui/animate-icons/icons/Minimize'
import { Moon } from '../../ui/animate-icons/icons/Moon'
import { PanelRightClose } from '../../ui/animate-icons/icons/PanelRightClose'
import { Pause } from '../../ui/animate-icons/icons/Pause'
import { Play } from '../../ui/animate-icons/icons/Play'
import { Plus } from '../../ui/animate-icons/icons/Plus'
import { RefreshCcw } from '../../ui/animate-icons/icons/RefreshCcw'
import { Route } from '../../ui/animate-icons/icons/Route'
import { Search } from '../../ui/animate-icons/icons/Search'
import { Send } from '../../ui/animate-icons/icons/Send'
import { Settings } from '../../ui/animate-icons/icons/Settings'
import { SlidersHorizontal } from '../../ui/animate-icons/icons/SlidersHorizontal'
import { Sparkles } from '../../ui/animate-icons/icons/Sparkles'
import { Star } from '../../ui/animate-icons/icons/Star'
import { Sun } from '../../ui/animate-icons/icons/Sun'
import { Trash } from '../../ui/animate-icons/icons/Trash'
import { Upload } from '../../ui/animate-icons/icons/Upload'
import { UserRound } from '../../ui/animate-icons/icons/UserRound'
import { X } from '../../ui/animate-icons/icons/X'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ITEMS: { Icon: ComponentType<IconProps<any>>; name: string; use: string }[] = [
  { Icon: Bell, name: 'Bell', use: 'Notificaciones' },
  { Icon: Clock, name: 'Clock', use: 'Horas de inicio/fin' },
  { Icon: Edit, name: 'Edit', use: '(propio) Editar — lápiz' },
  { Icon: Info, name: 'Info', use: '(propio) Información' },
  { Icon: Images, name: 'Images', use: '(propio) Imágenes' },
  { Icon: Whatsapp, name: 'Whatsapp', use: '(propio) WhatsApp' },
  { Icon: Instagram, name: 'Instagram', use: '(propio) Instagram' },
  { Icon: Facebook, name: 'Facebook', use: '(propio) Facebook' },
  { Icon: Tiktok, name: 'Tiktok', use: '(propio) TikTok' },
  { Icon: Gift, name: 'Gift', use: '(propio) Regalo' },
  { Icon: CreditCard, name: 'CreditCard', use: '(propio) Planes y facturación' },
  { Icon: Archive, name: 'Archive', use: '(propio) Almacenamiento' },
  { Icon: ChevronUp, name: 'ChevronUp', use: 'Expandir punto' },
  { Icon: ArrowUp, name: 'ArrowUp', use: 'Ir al inicio' },
  { Icon: Cart, name: 'Cart', use: '(propio) Carrito' },
  { Icon: BellRing, name: 'BellRing', use: 'Notificación recibida' },
  { Icon: Bot, name: 'Bot', use: '(futuro) Asistente/bot' },
  { Icon: Check, name: 'Check', use: 'Confirmaciones' },
  { Icon: ChevronDown, name: 'ChevronDown', use: 'Extender menú del header' },
  { Icon: ChevronLeft, name: 'ChevronLeft', use: 'Ir hacia atrás' },
  { Icon: CirclePlus, name: 'CirclePlus', use: 'Agregar' },
  { Icon: CircleX, name: 'CircleX', use: 'Remover' },
  { Icon: ClipboardCheck, name: 'ClipboardCheck', use: 'Pegar' },
  { Icon: CloudDownload, name: 'CloudDownload', use: 'Descarga de la nube' },
  { Icon: Compass, name: 'Compass', use: 'Rutas / mapa' },
  { Icon: Copy, name: 'Copy', use: 'Copiar' },
  { Icon: Download, name: 'Download', use: 'Descarga' },
  { Icon: Ellipsis, name: 'Ellipsis', use: 'Acciones (···)' },
  { Icon: ExternalLink, name: 'ExternalLink', use: 'Abrir en nueva pestaña / link externo' },
  { Icon: Heart, name: 'Heart', use: 'Like' },
  { Icon: LayoutDashboard, name: 'LayoutDashboard', use: 'Galería' },
  { Icon: List, name: 'List', use: 'Lista' },
  { Icon: Link2, name: 'Link2', use: 'Links' },
  { Icon: Loader, name: 'Loader', use: 'Carga (1)' },
  { Icon: LoaderCircle, name: 'LoaderCircle', use: 'Carga (2)' },
  { Icon: LoaderPinwheel, name: 'LoaderPinwheel', use: 'Carga (3)' },
  { Icon: Lock, name: 'Lock', use: 'Candado cerrado' },
  { Icon: LockOpen, name: 'LockOpen', use: 'Candado abierto' },
  { Icon: LogIn, name: 'LogIn', use: 'Login' },
  { Icon: LogOut, name: 'LogOut', use: 'Logout' },
  { Icon: MapPin, name: 'MapPin', use: 'Punto en el mapa' },
  { Icon: Maximize, name: 'Maximize', use: 'Expandir' },
  { Icon: Menu, name: 'Menu', use: 'Menú hamburguesa' },
  { Icon: Minimize, name: 'Minimize', use: 'Minimizar' },
  { Icon: Moon, name: 'Moon', use: 'Tema oscuro' },
  { Icon: PanelRightClose, name: 'PanelRightClose', use: 'Panel derecho cerrándose' },
  { Icon: Pause, name: 'Pause', use: 'Pausar' },
  { Icon: Play, name: 'Play', use: 'Play' },
  { Icon: Plus, name: 'Plus', use: 'Agregar (plus)' },
  { Icon: RefreshCcw, name: 'RefreshCcw', use: 'Recargar' },
  { Icon: Route, name: 'Route', use: 'Ruta' },
  { Icon: Search, name: 'Search', use: 'Búsqueda' },
  { Icon: Send, name: 'Send', use: 'Enviar' },
  { Icon: Settings, name: 'Settings', use: 'Configuración' },
  { Icon: SlidersHorizontal, name: 'SlidersHorizontal', use: 'Ajustes' },
  { Icon: Sparkles, name: 'Sparkles', use: 'Novedades' },
  { Icon: Star, name: 'Star', use: 'Estrella' },
  { Icon: Sun, name: 'Sun', use: 'Tema claro' },
  { Icon: Trash, name: 'Trash', use: 'Eliminar / basurero' },
  { Icon: Upload, name: 'Upload', use: 'Subir / carga' },
  { Icon: UserRound, name: 'UserRound', use: 'Perfil' },
  { Icon: X, name: 'X', use: 'Cerrar (equis)' },
]

/** Página pública de muestra (mismo patrón que StudioSample/FlatSample) —
 * para ver en vivo, sin login, cómo se ven/animan los íconos portados de
 * Animate UI antes de usarlos en páginas reales. Se agrega un ítem por cada
 * ícono nuevo que se porte. */
export function IconsSample() {
  // Estado LOCAL solo para esta página de muestra — el ThemeTogglerButton
  // real recibe `theme`/`setTheme` por props (ver ThemeTogglerButton.tsx),
  // así que en una página real vendría de `useFlatTheme`/`useStudioTheme` en
  // vez de este `useState`. Arranca en 'dark' para calzar con el fondo
  // oscuro que esta página ya tenía por defecto.
  //
  // OJO: el fondo/texto de ESTA página se pintan a mano con `dark ? ... :
  // ...` (no con el prefijo `dark:` de Tailwind) porque el `darkMode` de
  // este proyecto está configurado como `['class', '.theme-studio.dark']`
  // (ver tailwind.config) — el `dark:` de Tailwind solo se activa dentro
  // del portal Studio, no con una clase `dark` genérica en `<html>` como
  // esta página de muestra (que vive fuera de PortalLayout). El resto de
  // la app usa tokens semánticos (`bg-background`, etc.) resueltos por
  // variables CSS, no por `dark:`.
  const [theme, setTheme] = useState<ThemeSelection>('dark')
  const dark = theme === 'dark'

  return (
    <div className={cn('min-h-screen font-sans transition-colors duration-500', dark ? 'bg-[#0a0a0a] text-white' : 'bg-white text-neutral-900')}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Animate UI Icons — muestra</h1>
            <p className={cn('mt-2', dark ? 'text-white/60' : 'text-neutral-500')}>
              Pasa el mouse (o toca) cada ícono para ver su animación. {ITEMS.length} portados.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            {/* `onImmediateChange` es lo que de verdad sincroniza el fondo
                de ESTA página con el barrido — se dispara en el mismo
                instante síncrono que la animación, antes de que termine
                (a diferencia de `setTheme`, que se llama recién AL
                terminar). Sin esto, el fondo cambiaría de golpe después
                del barrido en vez de ser lo que el barrido revela. */}
            <ThemeTogglerButton theme={theme} setTheme={setTheme} onImmediateChange={setTheme} size="lg" />
            <span className={cn('text-[11px]', dark ? 'text-white/50' : 'text-neutral-500')}>ThemeTogglerButton</span>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {ITEMS.map(({ Icon, name, use }) => (
            <div
              key={name}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition-colors',
                dark ? 'border-white/10 hover:border-white/30' : 'border-neutral-200 hover:border-neutral-400',
              )}
            >
              <Icon size={28} animateOnHover />
              <span className="text-xs font-semibold">{name}</span>
              <span className={cn('text-[11px]', dark ? 'text-white/50' : 'text-neutral-500')}>{use}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
