import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../components/ui';

export default function Layout() {
  return <SafeAreaProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.ink, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg }, headerTitleStyle: { fontWeight: '600' } }}>
      <Stack.Screen name="index" options={{
        headerTitle: () => <Text style={{ fontSize: 25, fontWeight: '600', letterSpacing: -1, color: colors.accent }}>cosmedia<Text style={{ color: '#A8B89D' }}>.</Text></Text>,
        headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Nasıl çalışır?" onPress={() => router.push('/guide')} style={{ padding: 12 }}><Text style={{ color: colors.accent, fontWeight: '600' }}>Rehber ↗</Text></Pressable>,
      }} />
      <Stack.Screen name="products/[id]" options={{ title: 'Ürün detayı' }} />
      <Stack.Screen name="guide" options={{ title: 'Cosmedia rehberi' }} />
      <Stack.Screen name="+not-found" options={{ title: 'Sayfa bulunamadı' }} />
    </Stack>
  </SafeAreaProvider>;
}
