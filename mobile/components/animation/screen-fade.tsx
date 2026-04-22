import type { ReactNode } from 'react';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';

export function ScreenFade({
  children,
  delayMs = 0,
}: {
  children: ReactNode;
  delayMs?: number;
}) {
  return (
    <Animated.View
      style={{ flex: 1 }}
      entering={FadeIn.duration(240).delay(delayMs).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}>
      {children}
    </Animated.View>
  );
}
