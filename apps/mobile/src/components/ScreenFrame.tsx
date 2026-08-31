import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { BottomNav } from './BottomNav';

interface ScreenFrameProps {
  footer?: ReactNode;
  bottomNav?: boolean;
  testID?: string;
}

export function ScreenFrame({
  children,
  footer,
  bottomNav = true,
  testID,
}: PropsWithChildren<ScreenFrameProps>) {
  return (
    <View style={styles.root} testID={testID}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
      {bottomNav ? <BottomNav /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  footer: {
    padding: 12,
    paddingTop: 10,
    backgroundColor: colors.paper,
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

