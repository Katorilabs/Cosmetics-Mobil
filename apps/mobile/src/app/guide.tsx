import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, ui } from '../components/ui';

export default function GuideScreen() {
  return <SafeAreaView style={ui.page} edges={['bottom']}><ScrollView contentContainerStyle={[ui.content, { maxWidth: 780 }]}>
    <Text style={ui.eyebrow}>DAHA BİLİNÇLİ BİR BAKIM</Text>
    <Text accessibilityRole="header" style={ui.heading}>Ürününü tanımak,{'\n'}içeriğini anlamakla başlar.</Text>
    <Text style={ui.body}>Cosmedia, ürün bilgilerini ve kullanıcı deneyimlerini bir araya getirir. Her bilginin neyi anlattığını bilmek, seçimlerinin önemli bir parçasıdır.</Text>
    {[
      ['01', 'İçindekilere yakından bak', 'Ürün detayında seçtiğin varyantın kayıtlı INCI listesini görürsün. İçerik adlarını açarak açıklamaları ve kayıtlı işlevlerini okuyabilirsin.'],
      ['02', 'Kaynağını bil', 'Formülün kaynağı ve sürümü, bilgi mevcutsa detayda gösterilir. Formüller değişebilir; satın aldığın ürünün ambalajını da kontrol et.'],
      ['03', 'Deneyimi ayrı değerlendir', 'Yıldız puanları, yayınlanmış kullanıcı yorumlarının ortalamasıdır. Bilimsel kanıt, güvenlik notu veya kişisel uyumluluk skoru değildir.'],
    ].map(([number, title, body]) => <View key={number} style={ui.panel}><Text style={ui.eyebrow}>{number}</Text><Text style={ui.sectionTitle}>{title}</Text><Text style={ui.body}>{body}</Text></View>)}
    <Text style={ui.small}>Cosmedia tıbbi teşhis veya tedavi önermez. Cilt şikâyetlerin için bir sağlık uzmanına danış.</Text>
    <Action label="Ürünleri keşfet" onPress={() => router.replace('/')} />
  </ScrollView></SafeAreaView>;
}
