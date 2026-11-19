import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
const portal='https://invoice-control-api.onrender.com/app';
export default function App(){
  return <View style={s.page}><Text style={s.brand}>AVANTAGE</Text>
    <Text style={s.title}>Invoice Control 2.0</Text>
    <Text style={s.body}>Masaüstü fatura paneli güvenli sunucuda açılır. Kullanıcı girişi gereklidir.</Text>
    <Pressable accessibilityRole="link" onPress={()=>window.location.assign(portal)} style={s.button}><Text style={s.link}>Web panelini aç</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({page:{minHeight:'100%',backgroundColor:'#101827',padding:40,alignItems:'center',justifyContent:'center'},brand:{fontSize:34,color:'white',fontWeight:'900'},title:{fontSize:24,color:'#add2ff',marginTop:16},body:{color:'white',maxWidth:420,textAlign:'center',marginVertical:22},button:{backgroundColor:'#306bee',padding:16,borderRadius:12},link:{color:'white',fontWeight:'700'}});
