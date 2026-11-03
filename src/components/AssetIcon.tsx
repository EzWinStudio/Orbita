import { Bot, Globe2, Server } from 'lucide-react';
import type { AssetType } from '../types';

export function AssetIcon({ type, size = 16 }: { type: AssetType; size?: number }) {
  if (type === 'discord') return <Bot size={size} />;
  if (type === 'pterodactyl') return <Server size={size} />;
  return <Globe2 size={size} />;
}
