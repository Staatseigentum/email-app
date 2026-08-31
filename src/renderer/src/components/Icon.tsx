// Ein Iconset, eine Strichstärke. Lucide 0.474, Stroke 2.
// Namen sind die kebab-case-Lucide-Namen aus dem Design-Handoff.
import {
  Archive,
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  Clock,
  Command,
  CornerUpLeft,
  Download,
  ExternalLink,
  FileBox,
  FileText,
  Forward,
  Inbox,
  Info,
  Layers,
  LoaderCircle,
  Mail,
  MailCheck,
  MailOpen,
  Minimize2,
  Minus,
  Moon,
  OctagonAlert,
  Paperclip,
  Pencil,
  Plus,
  Reply,
  ReplyAll,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Star,
  Sun,
  Trash2,
  TriangleAlert,
  Users,
  WifiOff,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const MAP = {
  mail: Mail,
  'mail-check': MailCheck,
  'mail-open': MailOpen,
  inbox: Inbox,
  send: Send,
  'file-text': FileText,
  'file-box': FileBox,
  archive: Archive,
  'shield-alert': ShieldAlert,
  'shield-check': ShieldCheck,
  'trash-2': Trash2,
  star: Star,
  clock: Clock,
  paperclip: Paperclip,
  pencil: Pencil,
  plus: Plus,
  minus: Minus,
  square: Square,
  x: X,
  search: Search,
  'sliders-horizontal': SlidersHorizontal,
  'refresh-cw': RefreshCw,
  check: Check,
  reply: Reply,
  'reply-all': ReplyAll,
  forward: Forward,
  'corner-up-left': CornerUpLeft,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'arrow-left': ArrowLeft,
  download: Download,
  command: Command,
  settings: Settings,
  sun: Sun,
  moon: Moon,
  users: Users,
  layers: Layers,
  'alert-triangle': TriangleAlert,
  'alert-octagon': OctagonAlert,
  'wifi-off': WifiOff,
  bell: Bell,
  info: Info,
  'external-link': ExternalLink,
  'check-circle': CircleCheckBig,
  'minimize-2': Minimize2,
  spinner: LoaderCircle
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof MAP

export function Icon(props: {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}): JSX.Element {
  const Cmp = MAP[props.name]
  return (
    <Cmp
      size={props.size ?? 16}
      strokeWidth={props.strokeWidth ?? 2}
      className={props.className}
      aria-hidden
    />
  )
}
