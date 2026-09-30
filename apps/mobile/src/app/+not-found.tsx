import { router } from 'expo-router';
import { View } from 'react-native';
import { Notice, ui } from '../components/ui';
export default function NotFound() {
  return <View style={[ui.page, ui.content]}><Notice title="Bu sayfa bulunamadı" action="Ürünlere dön" onAction={() => router.replace('/')} /></View>;
}
