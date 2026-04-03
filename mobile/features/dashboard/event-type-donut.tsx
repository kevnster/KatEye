import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { resolveEventTypeColor } from '@/features/dashboard/event-type-colors';
import type { DashboardStyles } from '@/features/dashboard/styles/index.styles';
import type { EventTypeSlice } from '@/features/dashboard/types';
import type { ThemeColors } from '@/styles/app-theme';

const DONUT_SIZE = 120;
const STROKE_PAD = 1;

function polar(cx: number, cy: number, r: number, angleFromTopDeg: number) {
  const rad = ((angleFromTopDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlicePath(
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = endDeg - startDeg;
  if (sweep <= 0.05) return '';
  const largeArc = sweep > 180 ? 1 : 0;
  const p1 = polar(cx, cy, rOut, startDeg);
  const p2 = polar(cx, cy, rOut, endDeg);
  const p3 = polar(cx, cy, rIn, endDeg);
  const p4 = polar(cx, cy, rIn, startDeg);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOut} ${rOut} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rIn} ${rIn} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

function buildPathsForProgress(
  slices: EventTypeSlice[],
  progress: number,
  themeColors: ThemeColors,
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
): { key: string; d: string; color: string }[] {
  const revealEnd = progress * 360;
  if (revealEnd <= 0) return [];
  let cum = 0;
  const out: { key: string; d: string; color: string }[] = [];
  for (let i = 0; i < slices.length; i++) {
    const s = slices[i]!;
    const sliceAngle = s.fraction * 360;
    const sliceStart = cum;
    const sliceEnd = cum + sliceAngle;
    cum += sliceAngle;
    const visibleEnd = Math.min(sliceEnd, revealEnd);
    if (visibleEnd <= sliceStart + 0.05) continue;
    const d = donutSlicePath(cx, cy, rOut, rIn, sliceStart, visibleEnd);
    if (!d) continue;
    out.push({
      key: `${s.eventType}-${i}`,
      d,
      color: resolveEventTypeColor(s.eventType, themeColors),
    });
  }
  return out;
}

export function EventTypeDonut({
  slices,
  colors,
  styles,
}: {
  slices: EventTypeSlice[];
  colors: ThemeColors;
  styles: DashboardStyles;
}) {
  const cx = DONUT_SIZE / 2;
  const cy = DONUT_SIZE / 2;
  const rOut = DONUT_SIZE / 2 - STROKE_PAD;
  const rIn = rOut * 0.55;

  const progress = useSharedValue(0);
  const [paths, setPaths] = useState<{ key: string; d: string; color: string }[]>([]);

  const slicesKey = useMemo(
    () => slices.map((s) => `${s.eventType}:${s.count}`).join('|'),
    [slices],
  );

  const applyProgress = useCallback(
    (p: number) => {
      setPaths(buildPathsForProgress(slices, p, colors, cx, cy, rOut, rIn));
    },
    [slices, colors, cx, cy, rOut, rIn],
  );

  const runReplay = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    applyProgress(0);
    progress.value = withTiming(1, {
      duration: 950,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, applyProgress]);

  useAnimatedReaction(
    () => progress.value,
    (p) => {
      runOnJS(applyProgress)(p);
    },
    [applyProgress],
  );

  useFocusEffect(
    useCallback(() => {
      runReplay();
      return () => {
        cancelAnimation(progress);
      };
    }, [runReplay, progress]),
  );

  useEffect(() => {
    runReplay();
  }, [slicesKey, runReplay]);

  if (slices.length === 0) return null;

  return (
    <View style={styles.mixSection}>
      <Text style={styles.mixLabel}>Event types</Text>
      <View style={styles.mixDonutRow}>
        <View style={styles.mixDonutSvgWrap}>
          <Svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
            {paths.map((p) => (
              <Path key={p.key} d={p.d} fill={p.color} />
            ))}
          </Svg>
        </View>
        <View style={styles.mixLegendCol}>
          {slices.map((s) => {
            const sliceColor = resolveEventTypeColor(s.eventType, colors);
            return (
              <View key={s.eventType} style={styles.mixLegendLine}>
                <View style={[styles.mixLegendSwatch, { backgroundColor: sliceColor }]} />
                <Text style={[styles.mixLegendItemText, { color: sliceColor }]} numberOfLines={1}>
                  {s.eventType}{' '}
                  <Text style={[styles.mixLegendPct, { color: colors.textMuted }]}>
                    {Math.round(s.fraction * 100)}%
                  </Text>
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
