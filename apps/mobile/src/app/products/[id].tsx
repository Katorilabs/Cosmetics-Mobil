import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, colors, Notice, ProductVisual, ui } from '../../components/ui';
import { Experience } from '../../components/experience';
import { useResource } from '../../hooks/use-resource';
import { api } from '../../lib/api';

export default function ProductScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const product = useResource(`product:${id}`, (signal) => api.product(id, signal));
  const [selectedId, setSelectedId] = useState<string>();
  const [expanded, setExpanded] = useState<string>();
  const [linkError, setLinkError] = useState(false);
  const { width } = useWindowDimensions();
  const variant = product.data?.variants.find((item) => item.id === selectedId) ?? product.data?.variants[0];
  const formula = variant?.formulas[0];
  return <SafeAreaView style={ui.page} edges={['bottom']}><ScrollView contentContainerStyle={ui.content}>
    {product.loading ? <Notice loading title="Ürün hazırlanıyor" /> : product.error ? <>
      <Notice title="Ürün görüntülenemedi" detail={product.error.message} action="Tekrar dene" onAction={product.retry} />
      <Action quiet label="Kataloğa dön" onPress={() => router.replace('/')} />
    </> : product.data && <>
      <View style={{ flexDirection: width < 700 ? 'column' : 'row', gap: 26 }}>
        <ProductVisual large url={variant?.images[0]?.url} name={product.data.name} style={{ flex: width < 700 ? undefined : 1 }} />
        <View style={{ flex: 1, gap: 16, justifyContent: 'center' }}>
          <Text style={ui.eyebrow}>{product.data.brand.name} / {product.data.category.name}</Text>
          <Text accessibilityRole="header" style={ui.heading}>{product.data.name}</Text>
          {product.data.description && <Text style={ui.body}>{product.data.description}</Text>}
          <Text style={ui.small}>VARYANT</Text>
          <View style={ui.row}>{product.data.variants.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: variant?.id === item.id }}
            onPress={() => { setSelectedId(item.id); setExpanded(undefined); setLinkError(false); }}
            style={{ minHeight: 44, padding: 12, paddingHorizontal: 18, borderRadius: 24, borderWidth: 1, borderColor: variant?.id === item.id ? colors.accent : colors.line, backgroundColor: variant?.id === item.id ? colors.accentLight : colors.white }}>
            <Text style={{ color: colors.ink }}>{item.name}</Text>
          </Pressable>)}</View>
          {!variant && <Text style={ui.body}>Bu ürün için aktif varyant bulunmuyor.</Text>}
        </View>
      </View>
      <View style={{ gap: 15, marginTop: 6 }}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}><Text accessibilityRole="header" style={ui.sectionTitle}>Formülün içindekiler</Text>{formula && <Text style={ui.small}>FORMÜL v{formula.version} · {formula.ingredients.length} içerik</Text>}</View>
        {!formula ? <Notice title="İçerik bilgisi henüz eklenmedi" detail="Kayıtlı bir INCI listesi eklendiğinde burada görebilirsin." /> : <>
          <Text style={ui.body}>INCI, içeriklerin uluslararası adlandırmasıdır. Bir içeriğe dokunarak kayıtlı bilgileri görebilirsin.</Text>
          <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.white }}>
            {formula.ingredients.map((entry, index) => {
              const entryKey = `${formula.id}:${entry.position}`;
              const open = expanded === entryKey;
              return <View key={entryKey} style={{ borderTopWidth: index ? 1 : 0, borderColor: colors.line }}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setExpanded(open ? undefined : entryKey)} style={{ padding: 18, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                  <Text style={[ui.small, { width: 22 }]}>{String(entry.position).padStart(2, '0')}</Text>
                  <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '500', fontSize: 15 }}>{entry.ingredient?.inciName ?? entry.rawName}</Text>{(!entry.ingredient || entry.isUncertain) && <Text style={ui.small}>Eşleşme doğrulaması bekliyor</Text>}</View>
                  <Text style={{ color: colors.accent, fontSize: 20 }}>{open ? '−' : '+'}</Text>
                </Pressable>
                {open && <View style={{ paddingHorizontal: 54, paddingBottom: 20, gap: 8 }}>
                  <Text style={ui.body}>{entry.ingredient?.description ?? 'Bu içerik için henüz ek açıklama bulunmuyor.'}</Text>
                  {!!entry.ingredient?.commonNames.length && <Text style={ui.small}>Diğer adları: {entry.ingredient.commonNames.join(', ')}</Text>}
                  {!!entry.ingredient?.functions.length && <Text style={ui.small}>Kayıtlı işlevler: {entry.ingredient.functions.join(', ')}</Text>}
                </View>}
              </View>;
            })}
          </View>
          <View style={[ui.panel, { backgroundColor: 'transparent' }]}><Text style={ui.eyebrow}>KAYNAKTAKİ INCI LİSTESİ</Text><Text selectable style={ui.body}>{formula.rawInci}</Text>{formula.sourceName && <Text style={ui.small}>Kaynak: {formula.sourceName}</Text>}
            {formula.sourceUrl && /^https?:\/\//i.test(formula.sourceUrl) && <Action quiet label="Kaynağı aç ↗" onPress={() => { setLinkError(false); void Linking.openURL(formula.sourceUrl!).catch(() => setLinkError(true)); }} />}
            {linkError && <Text accessibilityLiveRegion="polite" style={ui.small}>Kaynak bağlantısı açılamadı.</Text>}
          </View>
        </>}
      </View>
      {variant && <Experience key={variant.id} variantId={variant.id} />}
      <Text style={[ui.small, { paddingBottom: 20 }]}>İçerik sırası, konsantrasyonu veya ürünün senin için uygunluğunu tek başına göstermez. Bu bilgiler tıbbi tavsiye değildir.</Text>
    </>}
  </ScrollView></SafeAreaView>;
}
