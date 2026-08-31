// Kompatibilitäts-Shim: die alte handgeschriebene Icon-API, jetzt auf Lucide.
// Neuer Code nutzt bitte <Icon name="…" /> aus ./Icon.
import {
  Archive,
  Check,
  CheckCheck,
  ChevronDown,
  Circle,
  Clock,
  Copy,
  Download,
  FileText,
  Inbox,
  MoreHorizontal,
  Moon,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Reply,
  Rows3,
  Search,
  Send,
  Settings,
  Star,
  Sun,
  Trash2,
  X
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

type P = LucideProps

export const IconArchive = (p: P): JSX.Element => <Archive strokeWidth={2} {...p} />
export const IconCheck = (p: P): JSX.Element => <Check strokeWidth={2} {...p} />
export const IconCheckAll = (p: P): JSX.Element => <CheckCheck strokeWidth={2} {...p} />
export const IconChevron = (p: P): JSX.Element => <ChevronDown strokeWidth={2} {...p} />
export const IconClock = (p: P): JSX.Element => <Clock strokeWidth={2} {...p} />
export const IconCopy = (p: P): JSX.Element => <Copy strokeWidth={2} {...p} />
export const IconDensity = (p: P): JSX.Element => <Rows3 strokeWidth={2} {...p} />
export const IconDot = (p: P): JSX.Element => <Circle strokeWidth={2} {...p} />
export const IconDownload = (p: P): JSX.Element => <Download strokeWidth={2} {...p} />
export const IconFile = (p: P): JSX.Element => <FileText strokeWidth={2} {...p} />
export const IconInbox = (p: P): JSX.Element => <Inbox strokeWidth={2} {...p} />
export const IconMoon = (p: P): JSX.Element => <Moon strokeWidth={2} {...p} />
export const IconMore = (p: P): JSX.Element => <MoreHorizontal strokeWidth={2} {...p} />
export const IconPaperclip = (p: P): JSX.Element => <Paperclip strokeWidth={2} {...p} />
export const IconPencil = (p: P): JSX.Element => <Pencil strokeWidth={2} {...p} />
export const IconPlus = (p: P): JSX.Element => <Plus strokeWidth={2} {...p} />
export const IconRefresh = (p: P): JSX.Element => <RefreshCw strokeWidth={2} {...p} />
export const IconReply = (p: P): JSX.Element => <Reply strokeWidth={2} {...p} />
export const IconSearch = (p: P): JSX.Element => <Search strokeWidth={2} {...p} />
export const IconSend = (p: P): JSX.Element => <Send strokeWidth={2} {...p} />
export const IconSettings = (p: P): JSX.Element => <Settings strokeWidth={2} {...p} />
export const IconStar = (p: P): JSX.Element => <Star strokeWidth={2} {...p} />
export const IconSun = (p: P): JSX.Element => <Sun strokeWidth={2} {...p} />
export const IconTrash = (p: P): JSX.Element => <Trash2 strokeWidth={2} {...p} />
export const IconX = (p: P): JSX.Element => <X strokeWidth={2} {...p} />
