import React from 'react';
import {SafeAreaView, View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {WebView} from 'react-native-webview';
import Constants from 'expo-constants';
const ROOT=Constants.expoConfig.extra.invoiceOrigin;
export default function App() {
  return <SafeAreaView style={styles.root}>
    <View style={styles.header}><Text style={styles.brand}>AVANTAGE</Text><Text style={styles.sub}>INVOICE CONTROL 2.0</Text></View>
    <WebView source={{uri:ROOT+'/app'}} originWhitelist={['https://*']}
      sharedCookiesEnabled={true} thirdPartyCookiesEnabled={false}
      javaScriptEnabled={true} domStorageEnabled={true}
      allowsBackForwardNavigationGestures={true}
      startInLoadingState={true}
      renderLoading={()=> <ActivityIndicator size="large" style={styles.loader}/>}
      onShouldStartLoadWithRequest={request=>request.url.startsWith(ROOT+'/') || request.url===ROOT}
      renderError={()=> <View style={styles.error}><Text style={styles.errorTitle}>Bağlantı kurulamadı</Text><Text style={styles.errorText}>Sunucu erişimini ve internet bağlantısını kontrol edin.</Text></View>}
    />
  </SafeAreaView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#101827'},header:{paddingHorizontal:18,paddingVertical:9,backgroundColor:'#101827',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 brand:{fontSize:19,color:'#fff',fontWeight:'900'},sub:{fontSize:10,color:'#A9C8E8',letterSpacing:1},
 loader:{position:'absolute',top:'50%',alignSelf:'center'},error:{padding:24},errorTitle:{color:'#fff',fontWeight:'800',fontSize:20},errorText:{color:'#ddd',marginTop:10}
});
