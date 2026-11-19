import React, {useState} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
const tiles=[
  ['▣','Fatura tara','Dosya yükleme — API bağlantısı bekleniyor'],
  ['▤','Faturalar','Merkezi arşiv — API bağlantısı bekleniyor'],
  ['▥','Kontroller','KDV, toplam ve mükerrer kayıt kontrolleri'],
  ['▦','Raporlar','Şube karşılaştırması — API bağlantısı bekleniyor']
];
export default function App(){
  const [selected,setSelected]=useState(null);
  return <View style={s.page}>
    <View style={s.header}><Text style={s.brand}>AVANTAGE</Text><Text style={s.eyebrow}>INVOICE CONTROL 2.0 · TEST ORTAMI</Text></View>
    <View style={s.main}><Text style={s.title}>Faturalarınızı tek yerden yönetin</Text>
      <Text style={s.intro}>iOS, Android ve bilgisayar için ortak platformun güvenli önizlemesi.</Text>
      <View style={s.grid}>{tiles.map(([icon,title,desc],i)=><Pressable key={title} onPress={()=>setSelected(i)}
        accessibilityRole="button" style={[s.card,selected===i&&s.active]}>
          <Text style={s.icon}>{icon}</Text><Text style={s.cardTitle}>{title}</Text><Text style={s.description}>{desc}</Text>
        </Pressable>)}</View>
      <View style={s.notice}><Text style={s.noticeTitle}>{selected===null?'Geliştirme sürümü':tiles[selected][1]}</Text>
        <Text style={s.note}>Bu ekranda gerçek belge veya kullanıcı verisi bulunmaz. Fatura tarama ve kayıt, ayrı staging API/veritabanı kurulup güvenlik testleri tamamlandıktan sonra etkinleşecektir.</Text></View>
    </View>
  </View>;
}
const s=StyleSheet.create({
 page:{minHeight:'100%',backgroundColor:'#f5f7fb'},
 header:{backgroundColor:'#101827',padding:22,alignItems:'center'},
 brand:{color:'#fff',fontSize:29,fontWeight:'900',letterSpacing:2},
 eyebrow:{fontSize:11,color:'#A9C8E8',letterSpacing:1,marginTop:4},
 main:{width:'100%',maxWidth:980,alignSelf:'center',padding:24},
 title:{fontSize:30,color:'#17233a',fontWeight:'800',marginTop:24},
 intro:{fontSize:15,color:'#647187',marginTop:10,marginBottom:24},
 grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'},
 card:{width:'48%',minHeight:166,backgroundColor:'white',borderWidth:1,borderColor:'#e2e7f0',padding:22,borderRadius:16,marginBottom:14},
 active:{borderColor:'#3668d7',backgroundColor:'#edf3ff'},
 icon:{fontSize:30,color:'#3668d7'},
 cardTitle:{fontSize:19,color:'#17233a',fontWeight:'800',marginTop:10},
 description:{fontSize:12,color:'#66738a',marginTop:6,lineHeight:19},
 notice:{marginTop:15,borderRadius:14,padding:20,backgroundColor:'#e8f0ff'},
 noticeTitle:{fontSize:17,fontWeight:'700',color:'#1b3968'},
 note:{fontSize:13,lineHeight:20,color:'#435f89',marginTop:7}
});
