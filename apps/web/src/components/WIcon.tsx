import type { CSSProperties } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, BarChart2, Bell, Calendar,
  Camera, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert,
  CircleCheck, ClipboardList, Clock, Download, Hand, HeartHandshake,
  Home, Inbox, LifeBuoy, MapPin, MessageCircle, MoreHorizontal,
  NotebookPen, Search, Send, Settings, Shield, Sparkles, Target,
  TrendingUp, Trophy, Users, UserRound, Wallet, X,
  type LucideProps,
} from 'lucide-react'
import type { FC } from 'react'

const ICON_MAP: Record<string, FC<LucideProps>> = {
  'activity':       Activity,
  'arrow-right':    ArrowRight,
  'bell':           Bell,
  'calendar':       Calendar,
  'camera':         Camera,
  'chart-column':   BarChart2,
  'check':          Check,
  'chevron-down':   ChevronDown,
  'chevron-left':   ChevronLeft,
  'chevron-right':  ChevronRight,
  'circle-alert':   CircleAlert,
  'circle-check':   CircleCheck,
  'clipboard-list': ClipboardList,
  'clock':          Clock,
  'download':       Download,
  'hand':           Hand,
  'heart-handshake':HeartHandshake,
  'house':          Home,
  'inbox':          Inbox,
  'life-buoy':      LifeBuoy,
  'map-pin':        MapPin,
  'message-circle': MessageCircle,
  'more-horizontal':MoreHorizontal,
  'notebook-pen':   NotebookPen,
  'search':         Search,
  'send':           Send,
  'settings':       Settings,
  'shield':         Shield,
  'sparkles':       Sparkles,
  'target':         Target,
  'trending-up':    TrendingUp,
  'triangle-alert': AlertTriangle,
  'trophy':         Trophy,
  'users':          Users,
  'user-round':     UserRound,
  'wallet':         Wallet,
  'x':              X,
}

interface WIconProps {
  name: string
  size?: number
  color?: string
  style?: CSSProperties
}

export function WIcon({ name, size = 20, color, style }: WIconProps) {
  const Icon = ICON_MAP[name]
  if (!Icon) return <span style={{ width: size, height: size, display: 'inline-block', flexShrink: 0 }} />
  return (
    <Icon
      size={size}
      color={color ?? 'currentColor'}
      style={{ flexShrink: 0, display: 'inline-block', ...style }}
    />
  )
}

export function DownloadIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
