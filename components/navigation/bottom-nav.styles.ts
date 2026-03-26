import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#9CA3AF',
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  navItem: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 12,
  },
  navItemActive: {
    backgroundColor: '#E5E7EB',
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
