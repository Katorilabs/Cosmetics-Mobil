import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Notice, Pagination, ProductVisual, ui } from '../components/ui';
import { api } from '../lib/api';
import { useResource } from '../hooks/use-resource';

export default function CatalogScreen() {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const scroll = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const compact = width < 640;
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(draft.trim()); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [draft]);
  const products = useResource(`products:${search}:${page}`, (signal) => api.products(search, page, signal));
  const changing = draft.trim() !== search;
  return <SafeAreaView style={ui.page} edges={['bottom']}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
      <View style={[styles.hero, compact && { padding: 25 }]}>
        <View style={{ flex: 1, gap: 18 }}>
          <Text style={ui.eyebrow}>BAKIMIN BİLGİYLE BAŞLASIN</Text>
          <Text accessibilityRole="header" style={[styles.heroTitle, compact && { fontSize: 38, lineHeight: 43 }]}>İçeriğini tanı.{"\n"}Bakımını keşfet.</Text>
          <Text style={[ui.body, { maxWidth: 420 }]}>Ürünlerin içindekilere yakından bak, gerçek kullanım deneyimlerini keşfet.</Text>
          <Pressable onPress={() => router.push('/guide')} accessibilityRole="button" style={{ paddingVertical: 8, alignSelf: 'flex-start' }}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Cosmedia nasıl çalışır?  ↗</Text>
          </Pressable>
        </View>
        {!compact && <View accessibilityElementsHidden style={styles.heroNote}>
          <Text style={{ fontSize: 65, color: colors.accent, fontWeight: '200' }}>c.</Text>
          <View style={{ height: 1, width: 65, backgroundColor: '#CCB9C0' }} />
          <Text style={[ui.small, { textAlign: 'center', marginTop: 15 }]}>Daha yakından bak.{'\n'}Daha bilinçli seç.</Text>
        </View>}
      </View>
      <View style={{ gap: 14 }}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <Text accessibilityRole="header" style={ui.sectionTitle}>Ürünleri keşfet</Text>
          {products.data && !changing && <Text style={ui.small}>{products.data.meta.total} ürün</Text>}
        </View>
        <View style={styles.search}>
          <Text style={{ color: colors.accent, fontSize: 24 }} accessibilityElementsHidden>⌕</Text>
          <TextInput accessibilityLabel="Ürün veya marka ara" placeholder="Ürün veya marka ara…" placeholderTextColor={colors.muted}
            value={draft} onChangeText={setDraft} autoCorrect={false} returnKeyType="search"
            onSubmitEditing={() => { setSearch(draft.trim()); setPage(1); }} style={styles.input} />
          {draft.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={() => setDraft('')} style={{ padding: 12 }}><Text style={{ color: colors.accent, fontSize: 18 }}>×</Text></Pressable>}
        </View>
      </View>
      {(products.loading || changing) ? <Notice loading title="Ürünler yükleniyor" detail="Katalog hazırlanıyor." />
        : products.error ? <Notice title="Kataloğa ulaşılamadı" detail={products.error.message} action="Tekrar dene" onAction={products.retry} />
          : products.data?.data.length === 0 ? <Notice title={search ? 'Aradığın ürünü bulamadık' : 'Katalog henüz hazır değil'} detail={search ? 'Başka bir ürün veya marka adıyla tekrar ara.' : 'Ürünler yayınlandığında burada görünecek.'} action={search ? 'Aramayı temizle' : 'Yenile'} onAction={search ? () => setDraft('') : products.retry} />
            : <View style={styles.grid}>{products.data?.data.map((product) => <Pressable key={product.id}
              accessibilityRole="button" accessibilityLabel={`${product.brand.name}, ${product.name}, detayları aç`}
              onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })}
              style={({ pressed }) => [styles.card, { width: compact ? '100%' : (Math.min(width, 1080) - 68) / 2, opacity: pressed ? 0.8 : 1 }]}>
              <ProductVisual url={product.variants[0]?.images[0]?.url} name={product.name} />
              <View style={{ padding: 6, gap: 7 }}>
                <Text style={ui.eyebrow}>{product.brand.name}</Text>
                <Text style={{ fontSize: 19, lineHeight: 26, color: colors.ink, fontWeight: '600' }}>{product.name}</Text>
                <View style={[ui.row, { justifyContent: 'space-between' }]}>
                  <Text style={ui.small}>{product.category.name} · {product.variants[0]?.name ?? 'Varyant bilgisi yok'}</Text>
                  <Text style={{ color: colors.accent, fontSize: 20 }}>↗</Text>
                </View>
              </View>
            </Pressable>)}</View>}
      {!products.loading && !changing && products.data && <Pagination page={page} pages={products.data.meta.pageCount} onPage={(next) => { setPage(next); scroll.current?.scrollTo({ y: 0, animated: true }); }} />}
      <View style={styles.footer}>
        <Text style={ui.small}>İçerik bilgisi ve kullanıcı deneyimi, birlikte.</Text>
        <Text style={ui.small}>Kozmetik ürün bilgileri tıbbi tavsiye değildir.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  hero: { padding: 38, borderRadius: 25, backgroundColor: '#F0E8E5', flexDirection: 'row', gap: 25 },
  heroTitle: { fontSize: 49, lineHeight: 55, letterSpacing: -2, fontWeight: '500', color: colors.ink },
  heroNote: { width: 170, alignItems: 'center', justifyContent: 'center', borderRadius: 100, backgroundColor: '#E4D5D7', margin: 5 },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white, paddingLeft: 18, minHeight: 58 },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingHorizontal: 12, paddingVertical: 17, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between' },
  card: { backgroundColor: colors.white, borderRadius: 21, borderWidth: 1, borderColor: colors.line, padding: 13, gap: 15 },
  footer: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 22, gap: 5, marginTop: 8 },
});
