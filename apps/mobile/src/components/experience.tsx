import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../lib/api';
import { useResource } from '../hooks/use-resource';
import { colors, Notice, Pagination, ui } from './ui';

export function Experience({ variantId }: { variantId: string }) {
  const [page, setPage] = useState(1);
  const stats = useResource(`stats:${variantId}`, (signal) => api.statistics(variantId, signal));
  const reviews = useResource(`reviews:${variantId}:${page}`, (signal) => api.reviews(variantId, page, signal));
  return <View style={{ gap: 18 }}>
    <View style={{ gap: 8 }}><Text style={ui.eyebrow}>TOPLULUKTAN</Text><Text accessibilityRole="header" style={ui.sectionTitle}>Kullanım deneyimleri</Text><Text style={ui.small}>Yayınlanmış kullanıcı yorumlarıdır; içerik uyumluluk skoru değildir.</Text></View>
    {stats.loading ? <Notice loading title="Deneyimler yükleniyor" /> : stats.error ? <Notice title="İstatistiklere ulaşılamadı" detail={stats.error.message} action="Tekrar dene" onAction={stats.retry} />
      : stats.data && <View style={[ui.panel, { backgroundColor: '#F0E8E5' }]}>
        <View style={ui.row}><Text style={{ fontSize: 42, color: colors.accent, fontWeight: '500' }}>{stats.data.averageRating === null ? '—' : stats.data.averageRating.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</Text><Text style={ui.body}>/ 5 · {stats.data.count} yorum</Text></View>
        {stats.data.count === 0 ? <Text style={ui.body}>Bu varyant için henüz yayınlanmış bir deneyim yok.</Text> : stats.data.distribution?.slice().reverse().map((item) => <View key={item.rating} style={[ui.row, { flexWrap: 'nowrap' }]}>
          <Text style={ui.small}>{item.rating} ★</Text><View style={{ flex: 1, height: 5, backgroundColor: '#DED0D4', borderRadius: 3 }}><View style={{ height: 5, width: `${item.count / stats.data!.count * 100}%`, backgroundColor: colors.accent, borderRadius: 3 }} /></View><Text style={[ui.small, { width: 25, textAlign: 'right' }]}>{item.count}</Text>
        </View>)}
      </View>}
    {reviews.loading ? <Notice loading title="Yorumlar yükleniyor" /> : reviews.error ? <Notice title="Yorumlar yüklenemedi" detail={reviews.error.message} action="Tekrar dene" onAction={reviews.retry} />
      : <>{reviews.data?.data.map((review) => <View key={review.id} style={ui.panel}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}><Text accessibilityLabel={`5 üzerinden ${review.rating} yıldız`} style={{ color: colors.accent }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text><Text style={ui.small}>{new Date(review.createdAt).toLocaleDateString('tr-TR')}</Text></View>
        {review.title && <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>{review.title}</Text>}
        {review.body && <Text style={ui.body}>{review.body}</Text>}
        {!review.title && !review.body && <Text style={ui.small}>Yalnızca puan verilmiş.</Text>}
      </View>)}
      {reviews.data && <Pagination page={page} pages={reviews.data.meta.pageCount} onPage={setPage} />}</>}
  </View>;
}
