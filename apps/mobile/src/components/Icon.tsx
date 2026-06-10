import React from 'react';
import type { FC } from 'react';
import {
  House, User, Users, UserPlus, Trophy, MessageCircle, Siren, Sparkles,
  ChevronRight, ChevronDown, ChevronLeft, Eye, EyeOff, TriangleAlert,
  Calendar, CircleCheck, Bell, Wind, Leaf, Shield, ShieldCheck, Check, X,
  ChartColumn, Moon, ClipboardList, ArrowLeft, ArrowRight, ArrowUp,
  Medal, Smile, Frown, Angry, Annoyed, Lightbulb, Heart, Hand, IdCard,
  Mail, MapPin, Search, CreditCard, Smartphone, Landmark, Lock, Link,
  Share2, Phone, Handshake, HandHeart, Settings, Hospital, Clock,
  Hourglass, Megaphone, Send, ThumbsUp, Flame, Target, Star, Crown,
  Sprout, Sunrise, Ellipsis,
  type LucideProps,
} from 'lucide-react-native';
import { Colors } from '../constants/colors';

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
};

export type IconName = keyof typeof ICON_MAP;

interface IconProps {
  name: IconName | string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color = Colors.fg1, strokeWidth = 2 }: IconProps) {
  const Cmp = ICON_MAP[name];
  if (!Cmp) return null;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
