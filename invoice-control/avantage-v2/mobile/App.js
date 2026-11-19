import React from 'react';
import {SafeAreaView, ScrollView, View, Text, StyleSheet, StatusBar} from 'react-native';
const items=[['▣','Fatura tara','Kamera ve dosya yükleme: sonraki aşama'],['◷','Kontrol bekleyenler','Onay kuyruğu: sonraki aşama'],['▤','Faturalar','Gerçek API entegrasyonu: sonraki aşama'],['▥','Raporlar','Şube raporları: sonraki aşama']];
export default function App() {
 return <SafeAreaView style={styles.root}><StatusBar barStyle="light-content"/><ScrollView contentContainerStyle={styles.page}>
  <Text style={styles.brand}>AVANTAGE</Text><Text style={styles.subtitle}>INVOICE CONTROL 2.0</Text>
  <View style={styles.hero}><Text style={styles.title}>Fatura kontrolü, tek yerde.</Text><Text style={styles.hint}>iOS · Android · Web</Text></View>
  <Text style={styles.heading}>İşlemler</Text>
  {items.map(([icon,title,sub])=><View key={title} style={styles.item}>
    <Text style={styles.icon}>{icon}</Text><View style={{flex:1}}><Text style={styles.name}>{title}</Text><Text style={styles.small}>{sub}</Text></View>
  </View>)}
  <View style={styles.notice}><Text style={styles.name}>Geliştirme sürümü</Text><Text style={styles.small}>Bu ekran yalnızca arayüz taslağıdır. Gerçek fatura işleme ve kullanıcı girişi henüz bağlanmadı.</Text></View>
 </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#101827'},page:{padding:24,paddingTop:45,paddingBottom:48},
 brand:{color:'#fff',fontSize:30,fontWeight:'900'},subtitle:{color:'#A9C8E8',fontSize:12,letterSpacing:2,marginBottom:26},
 hero:{backgroundColor:'#2858CF',padding:22,borderRadius:18,marginBottom:28},
 title:{fontSize:23,color:'#fff',fontWeight:'800'},hint:{fontSize:13,color:'#DCE8FF',marginTop:8},
 heading:{color:'#fff',fontSize:19,fontWeight:'700',marginBottom:12},
 item:{flexDirection:'row',alignItems:'center',backgroundColor:'#1D2B41',padding:17,borderRadius:14,marginBottom:11},
 icon:{fontSize:25,color:'#8ED0FF',marginRight:17},name:{color:'#fff',fontSize:15,fontWeight:'700'},
 small:{color:'#AEC0D7',fontSize:12,marginTop:4,lineHeight:19},
 notice:{borderColor:'#4B6077',borderWidth:1,borderRadius:12,padding:16,marginTop:20}
});
