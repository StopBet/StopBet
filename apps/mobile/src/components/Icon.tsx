import React from 'react';
import type { FC } from 'react';
// Los íconos se importan de a uno y NO desde 'lucide-react-native'. Metro no hace tree
// shaking: importar del índice mete los 1.714 íconos del paquete en el bundle, que son
// 1,5 MB para usar 67. Los tipos de estas rutas los declara `src/types/lucide-icons.d.ts`.
import House from 'lucide-react-native/dist/esm/icons/house.mjs';
import User from 'lucide-react-native/dist/esm/icons/user.mjs';
import Users from 'lucide-react-native/dist/esm/icons/users.mjs';
import UserPlus from 'lucide-react-native/dist/esm/icons/user-plus.mjs';
import Trophy from 'lucide-react-native/dist/esm/icons/trophy.mjs';
import MessageCircle from 'lucide-react-native/dist/esm/icons/message-circle.mjs';
import Siren from 'lucide-react-native/dist/esm/icons/siren.mjs';
import Sparkles from 'lucide-react-native/dist/esm/icons/sparkles.mjs';
import ChevronRight from 'lucide-react-native/dist/esm/icons/chevron-right.mjs';
import ChevronDown from 'lucide-react-native/dist/esm/icons/chevron-down.mjs';
import ChevronLeft from 'lucide-react-native/dist/esm/icons/chevron-left.mjs';
import Eye from 'lucide-react-native/dist/esm/icons/eye.mjs';
import EyeOff from 'lucide-react-native/dist/esm/icons/eye-off.mjs';
import TriangleAlert from 'lucide-react-native/dist/esm/icons/triangle-alert.mjs';
import Calendar from 'lucide-react-native/dist/esm/icons/calendar.mjs';
import CircleCheck from 'lucide-react-native/dist/esm/icons/circle-check.mjs';
import Bell from 'lucide-react-native/dist/esm/icons/bell.mjs';
import Wind from 'lucide-react-native/dist/esm/icons/wind.mjs';
import Leaf from 'lucide-react-native/dist/esm/icons/leaf.mjs';
import Shield from 'lucide-react-native/dist/esm/icons/shield.mjs';
import ShieldCheck from 'lucide-react-native/dist/esm/icons/shield-check.mjs';
import Check from 'lucide-react-native/dist/esm/icons/check.mjs';
import X from 'lucide-react-native/dist/esm/icons/x.mjs';
import ChartColumn from 'lucide-react-native/dist/esm/icons/chart-column.mjs';
import Moon from 'lucide-react-native/dist/esm/icons/moon.mjs';
import ClipboardList from 'lucide-react-native/dist/esm/icons/clipboard-list.mjs';
import ArrowLeft from 'lucide-react-native/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide-react-native/dist/esm/icons/arrow-right.mjs';
import ArrowUp from 'lucide-react-native/dist/esm/icons/arrow-up.mjs';
import Medal from 'lucide-react-native/dist/esm/icons/medal.mjs';
import Smile from 'lucide-react-native/dist/esm/icons/smile.mjs';
import Frown from 'lucide-react-native/dist/esm/icons/frown.mjs';
import Angry from 'lucide-react-native/dist/esm/icons/angry.mjs';
import Annoyed from 'lucide-react-native/dist/esm/icons/annoyed.mjs';
import Lightbulb from 'lucide-react-native/dist/esm/icons/lightbulb.mjs';
import Heart from 'lucide-react-native/dist/esm/icons/heart.mjs';
import Hand from 'lucide-react-native/dist/esm/icons/hand.mjs';
import IdCard from 'lucide-react-native/dist/esm/icons/id-card.mjs';
import Mail from 'lucide-react-native/dist/esm/icons/mail.mjs';
import MapPin from 'lucide-react-native/dist/esm/icons/map-pin.mjs';
import Search from 'lucide-react-native/dist/esm/icons/search.mjs';
import CreditCard from 'lucide-react-native/dist/esm/icons/credit-card.mjs';
import Smartphone from 'lucide-react-native/dist/esm/icons/smartphone.mjs';
import Landmark from 'lucide-react-native/dist/esm/icons/landmark.mjs';
import Lock from 'lucide-react-native/dist/esm/icons/lock.mjs';
import Link from 'lucide-react-native/dist/esm/icons/link.mjs';
import Share2 from 'lucide-react-native/dist/esm/icons/share-2.mjs';
import Phone from 'lucide-react-native/dist/esm/icons/phone.mjs';
import Handshake from 'lucide-react-native/dist/esm/icons/handshake.mjs';
import HandHeart from 'lucide-react-native/dist/esm/icons/hand-heart.mjs';
import Settings from 'lucide-react-native/dist/esm/icons/settings.mjs';
import Hospital from 'lucide-react-native/dist/esm/icons/hospital.mjs';
import Clock from 'lucide-react-native/dist/esm/icons/clock.mjs';
import Hourglass from 'lucide-react-native/dist/esm/icons/hourglass.mjs';
import Megaphone from 'lucide-react-native/dist/esm/icons/megaphone.mjs';
import Send from 'lucide-react-native/dist/esm/icons/send.mjs';
import ThumbsUp from 'lucide-react-native/dist/esm/icons/thumbs-up.mjs';
import Flame from 'lucide-react-native/dist/esm/icons/flame.mjs';
import Target from 'lucide-react-native/dist/esm/icons/target.mjs';
import Star from 'lucide-react-native/dist/esm/icons/star.mjs';
import Crown from 'lucide-react-native/dist/esm/icons/crown.mjs';
import Sprout from 'lucide-react-native/dist/esm/icons/sprout.mjs';
import Sunrise from 'lucide-react-native/dist/esm/icons/sunrise.mjs';
import Ellipsis from 'lucide-react-native/dist/esm/icons/ellipsis.mjs';
import LogOut from 'lucide-react-native/dist/esm/icons/log-out.mjs';
import Trash2 from 'lucide-react-native/dist/esm/icons/trash-2.mjs';
import Flag from 'lucide-react-native/dist/esm/icons/flag.mjs';
import type { LucideProps } from 'lucide-react-native';
import { useColors } from '../context/ThemeContext';

// Mapa de nombres semánticos kebab-case -> íconos Lucide (mismo set que la web).
// Si falta un ícono, agregar el import arriba y la entrada aquí.
const ICON_MAP: Record<string, FC<LucideProps>> = {
  'house': House,
  'user': User,
  'users': Users,
  'user-plus': UserPlus,
  'trophy': Trophy,
  'message-circle': MessageCircle,
  'siren': Siren,
  'sparkles': Sparkles,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'eye': Eye,
  'eye-off': EyeOff,
  'triangle-alert': TriangleAlert,
  'calendar': Calendar,
  'circle-check': CircleCheck,
  'bell': Bell,
  'wind': Wind,
  'leaf': Leaf,
  'shield': Shield,
  'shield-check': ShieldCheck,
  'check': Check,
  'x': X,
  'chart-column': ChartColumn,
  'moon': Moon,
  'clipboard-list': ClipboardList,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'medal': Medal,
  'smile': Smile,
  'frown': Frown,
  'angry': Angry,
  'annoyed': Annoyed,
  'lightbulb': Lightbulb,
  'heart': Heart,
  'hand': Hand,
  'id-card': IdCard,
  'mail': Mail,
  'map-pin': MapPin,
  'search': Search,
  'credit-card': CreditCard,
  'smartphone': Smartphone,
  'landmark': Landmark,
  'lock': Lock,
  'link': Link,
  'share': Share2,
  'phone': Phone,
  'handshake': Handshake,
  'hand-heart': HandHeart,
  'settings': Settings,
  'hospital': Hospital,
  'clock': Clock,
  'hourglass': Hourglass,
  'megaphone': Megaphone,
  'send': Send,
  'thumbs-up': ThumbsUp,
  'flame': Flame,
  'target': Target,
  'star': Star,
  'crown': Crown,
  'sprout': Sprout,
  'sunrise': Sunrise,
  'ellipsis': Ellipsis,
  'log-out': LogOut,
  'trash-2': Trash2,
  'flag': Flag,
};

export type IconName = keyof typeof ICON_MAP;

interface IconProps {
  name: IconName | string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color, strokeWidth = 2 }: IconProps) {
  // El color por omisión sale del tema; en oscuro el gris del texto es claro
  const c = useColors();
  const Cmp = ICON_MAP[name];
  if (!Cmp) return null;
  return <Cmp size={size} color={color ?? c.fg1} strokeWidth={strokeWidth} />;
}
