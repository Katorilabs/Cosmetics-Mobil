import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export const colors = { ink: '#30282C', muted: '#70686B', accent: '#73495B', accentLight: '#F0E3E6', bg: '#FAF8F5', line: '#E7DFD9', white: '#FFFFFF', sage: '#E5EBDF' };
export const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 24, gap: 24 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: colors.accent, textTransform: 'uppercase' },
  heading: { fontSize: 32, lineHeight: 39, fontWeight: '600', color: colors.ink, letterSpacing: -1 },
  sectionTitle: { fontSize: 21, fontWeight: '600', color: colors.ink, letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 24, color: colors.muted },
  small: { fontSize: 12, lineHeight: 18, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  panel: { padding: 22, borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.white, gap: 12 },
});

export function Action({ label, onPress, quiet = false, disabled = false }: { label: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 46, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, alignSelf: 'flex-start', backgroundColor: quiet ? colors.white : colors.accent, borderWidth: 1, borderColor: quiet ? colors.line : colors.accent, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 })}>
    <Text style={{ color: quiet ? colors.ink : colors.white, fontSize: 14, fontWeight: '600' }}>{label}</Text>
  </Pressable>;
}

export function Notice({ title, detail, action, onAction, loading = false }: { title: string; detail?: string; action?: string; onAction?: () => void; loading?: boolean }) {
  return <View accessibilityLiveRegion="polite" style={[ui.panel, { alignItems: 'flex-start', paddingVertical: 30 }]}>
    {loading && <ActivityIndicator color={colors.accent} accessibilityLabel="Yükleniyor" />}
    <Text style={ui.sectionTitle}>{title}</Text>
    {detail && <Text style={ui.body}>{detail}</Text>}
    {action && onAction && <Action label={action} onPress={onAction} />}
  </View>;
}

export function ProductVisual({ url, name, large = false, style }: { url?: string; name: string; large?: boolean; style?: StyleProp<ViewStyle> }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const valid = url && /^https?:\/\//i.test(url) && url !== failedUrl;
  return <View style={[{ backgroundColor: colors.sage, minHeight: large ? 300 : 185, alignItems: 'center', justifyContent: 'center', borderRadius: 16, overflow: 'hidden' }, style]}>
    {valid ? <Image source={{ uri: url }} accessibilityLabel={name} onError={() => setFailedUrl(url)} resizeMode="contain" style={{ width: '85%', height: large ? 280 : 175 }} /> : <>
      <View accessible={false} style={{ alignItems: 'center', transform: [{ rotate: '-8deg' }], marginVertical: 24 }}>
        <View style={{ width: 38, height: 24, backgroundColor: '#C3CBBD', borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
        <View style={{ width: large ? 105 : 76, height: large ? 140 : 100, backgroundColor: '#FDFCF9', borderRadius: 14, borderWidth: 1, borderColor: '#D2DACD', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
          <Text style={{ color: colors.accent, fontSize: large ? 30 : 24, fontWeight: '300' }}>c.</Text>
          <View style={{ width: 28, height: 2, backgroundColor: '#D8CEC9' }} />
        </View>
      </View>
      <Text style={[ui.small, { marginBottom: 14 }]}>Ürün görseli henüz eklenmedi</Text>
    </>}
  </View>;
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return <View style={[ui.row, { justifyContent: 'center', paddingVertical: 12 }]}>
    <Action quiet label="Önceki" disabled={page <= 1} onPress={() => onPage(page - 1)} />
    <Text style={ui.small}>{page} / {pages}</Text>
    <Action quiet label="Sonraki" disabled={page >= pages} onPress={() => onPage(page + 1)} />
  </View>;
}
